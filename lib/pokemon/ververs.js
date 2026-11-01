// Dagelijkse verversing van de prijzen: de Cardmarket-trend uit de prijslijst die Cardmarket elke
// nacht publiceert. Elke kaart is gekoppeld aan zijn eigen Cardmarket-product (data/pokemon/
// cardmarket.json, ook varianten); zonder prijs blijft de vaste prijs uit de lijst staan. Eigen
// items worden via TCGdex aan Cardmarket gekoppeld; lukt dat niet, dan volgen ze de TCGplayer-
// marktprijs (tcgcsv.com, omgerekend met de ECB-koers). Schrijft het resultaat naar Redis; daarna
// volgen de prijsmeldingen (meldingen.js). Wordt aangeroepen door de Vercel Cron en door de knop
// "Nu verversen".
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import collectie from "@/data/pikachu-collectie.json";
import cardmarket from "@/data/pokemon/cardmarket.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { haalPrijslijst, koppelItem } from "./cardmarket";
import { verwerkPrijsMeldingen } from "./meldingen";
import { amsterdamDatum, cent, isLive, kaartPrijs, VAST_DAG } from "./regels.mjs";
import { getRedis, ITEMS_KEY, PRIJS_TAG, SLEUTEL } from "./server";
import { cardmarketPrijs } from "./tcgdex.mjs";

const UA = "daandrenthen.nl-pokemon/1.0 (+https://daandrenthen.nl/pokemon)";
const BUDGET_GROEPEN_MS = 180_000; // daarna geen nieuwe groepen meer; volgende run haalt de rest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Welke bron er geldt. Een run zonder dit kenmerk in de meta is een overstap: die haalt alles
// opnieuw op en begint de geschiedenis opnieuw.
const BRONNEN = "cardmarket";

async function haal(url, { json = true, timeout = 15000 } = {}) {
  for (let poging = 1; ; poging++) {
    try {
      const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return json ? await res.json() : await res.text();
    } catch (e) {
      if (poging >= 2) throw e;
      await sleep(1000);
    }
  }
}

// Startpunt van de geschiedenis: de vaste prijzen van 5 okt, alleen voor kaarten waarvan
// het koppelscript heeft vastgesteld dat die prijs bij hetzelfde product hoort.
function startpunt() {
  const uit = {};
  for (const k of collectie.cards) {
    if (koppelingen.kaarten[k.id]?.vast5okt && k.price_eur > 0) uit[k.id] = cent(k.price_eur);
  }
  return uit;
}

export async function ververs({ bron = "cron" } = {}) {
  const start = Date.now();
  const redis = getRedis();
  if (!redis) return { ok: false, status: "fout", fout: "Geen database ingesteld" };

  const runId = randomUUID();
  if (!(await redis.set(SLEUTEL.slot, runId, { nx: true, ex: 300 }))) {
    return { ok: false, status: "bezig" };
  }
  try {
    const [oudeMeta, oudePrijzen, itemHash] = await Promise.all([
      redis.get(SLEUTEL.meta),
      redis.get(SLEUTEL.prijzen),
      redis.hgetall(ITEMS_KEY),
    ]);
    const meta = oudeMeta ?? {};
    const vorige = oudePrijzen ?? {};
    const overstap = meta.bronnen !== BRONNEN;

    // 1. De Cardmarket-prijslijst van vannacht, alleen als die nieuw is sinds de vorige keer
    let lijst;
    try {
      lijst = await haalPrijslijst({ gewijzigd: overstap ? null : meta.cardmarket?.gewijzigd });
    } catch (e) {
      const fout = String(e?.message || e).slice(0, 120);
      if (oudeMeta) await redis.set(SLEUTEL.meta, { ...meta, cardmarketFout: fout });
      return { ok: false, status: "fout", fout };
    }
    if (!lijst) return { ok: true, overgeslagen: true, status: meta.status, dag: meta.dag };
    const dag = lijst.dag;

    // 2. Zelf toegevoegde losse kaarten zonder Cardmarket-product: via TCGdex koppelen, hooguit
    // één poging per item per dag. De TCGplayer-prijs van het toevoegen dient als controle.
    const items = Object.values(itemHash ?? {}).filter((i) => i?.cm?.id || i?.tp?.product);
    const vandaag = amsterdamDatum(new Date());
    const cmGeprobeerd = {};
    const dexCache = {};
    let gekoppeld = 0;
    for (const item of items) {
      if (item.cm?.id || !item.nummer) continue;
      cmGeprobeerd[item.id] = vandaag;
      if (meta.cmGeprobeerd?.[item.id] === vandaag) continue;
      try {
        const k = await koppelItem(item, { cache: dexCache, tpEur: item.start?.e ?? null });
        if (!k) continue;
        item.cm = { id: k.id, holo: k.holo };
        const vers = await redis.hget(ITEMS_KEY, item.id);
        if (vers) await redis.hset(ITEMS_KEY, { [item.id]: { ...vers, cm: item.cm } });
        delete cmGeprobeerd[item.id];
        gekoppeld++;
      } catch {}
    }

    // 3. Items zonder Cardmarket-product: de TCGplayer-marktprijs per groep (tcgcsv: eigen
    // User-Agent, 100 ms tussen verzoeken), omgerekend met de ECB-koers
    const tpItems = items.filter((i) => !i.cm?.id && i.tp?.product && i.tp.groep);
    const rijen = new Map();
    const dezeRun = new Set();
    const mislukt = [];
    for (const g of new Set(tpItems.map((i) => i.tp.groep))) {
      if (Date.now() - start > BUDGET_GROEPEN_MS) {
        mislukt.push(g);
        continue;
      }
      try {
        const data = await haal(`https://tcgcsv.com/tcgplayer/3/${g}/prices`);
        if (!data?.success || !Array.isArray(data.results)) throw new Error("ongeldig antwoord");
        for (const r of data.results) {
          if (!rijen.has(r.productId)) rijen.set(r.productId, []);
          rijen.get(r.productId).push(r);
        }
        dezeRun.add(g);
      } catch {
        mislukt.push(g);
      }
      await sleep(100);
    }
    let fx = meta.fx ?? { koers: 0.88, datum: VAST_DAG, bron: "vast" };
    if (tpItems.length) {
      try {
        const r = await haal("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
        const k = r?.rates?.EUR;
        if (k > 0.7 && k < 1.2) fx = { koers: k, datum: r.date, bron: "ecb" };
      } catch {}
    }

    // 4. Prijs per kaart en per item: de Cardmarket-trend van het gekoppelde product (nooit de
    // laagste prijs). Items zonder Cardmarket-product: de TCGplayer-marktprijs, undefined als de
    // groep deze run niet is opgehaald (dan blijft de vorige prijs staan).
    const cmPrijs = (cm) => {
      const p = cm?.id ? cardmarketPrijs(lijst.prijzen.get(cm.id), cm.holo) : null;
      return p ? { e: p.t, t: "c", s: p.soort, d: dag } : null;
    };
    const tcgPrijs = (tp) => {
      if (!tp?.groep || !dezeRun.has(tp.groep)) return undefined;
      const markt = (rijen.get(tp.product) ?? []).find((r) => r.subTypeName === tp.sub)?.marketPrice;
      if (!(markt > 0)) return null;
      const u = cent(markt);
      return { e: Math.round(u * fx.koers), t: "m", u, d: dag };
    };
    const prijzen = {};
    const tellingen = { c: 0, v: 0, o: 0, items: 0, itemsTcg: 0, vers: 0, verouderd: 0, gekoppeld };
    const tel = (p) => {
      if (isLive(p) && p.d === dag) tellingen.vers++;
      else if (isLive(p)) tellingen.verouderd++;
    };
    for (const kaart of collectie.cards) {
      const p = kaartPrijs({
        vorige: vorige[kaart.id],
        vast: { eur: kaart.price_eur, type: kaart.price_type },
        live: cmPrijs(cardmarket.kaarten[kaart.id]?.cm),
      });
      prijzen[kaart.id] = p;
      tellingen[p.t] = (tellingen[p.t] ?? 0) + 1;
      tel(p);
    }
    // Items: alleen live prijzen opslaan; zonder live prijs geldt in de browser de prijs
    // van het moment van toevoegen of de zelf ingevulde waarde
    for (const item of items) {
      const live = item.cm?.id ? cmPrijs(item.cm) : tcgPrijs(item.tp);
      const p = kaartPrijs({ vorige: vorige[item.id], live });
      if (isLive(p)) {
        prijzen[item.id] = p;
        tellingen.items++;
        if (p.t === "m") tellingen.itemsTcg++;
        tel(p);
      }
    }

    // 5. Stroomonderbreker: liever niets schrijven dan onzin in de geschiedenis. Zijn er veel minder
    // verse prijzen dan de vorige keer, of sprong het totaal van wat in beide runs live was?
    const toen = meta.tellingen ?? {};
    let verdacht = null;
    if (!overstap && toen.vers >= 50 && tellingen.vers < 0.7 * toen.vers) {
      verdacht = `maar ${tellingen.vers} verse prijzen, vorige keer ${toen.vers}`;
    }
    const gedeeld = Object.entries(prijzen).filter(([id, p]) => isLive(p) && isLive(vorige[id]));
    const somNu = gedeeld.reduce((s, [, p]) => s + p.e, 0);
    const somToen = gedeeld.reduce((s, [id]) => s + vorige[id].e, 0);
    if (!verdacht && gedeeld.length >= 50 && somToen > 0 && Math.abs(somNu / somToen - 1) > 0.5) {
      verdacht = `totaal sprong van ${somToen} naar ${somNu} cent`;
    }

    const status = verdacht ? "verdacht" : mislukt.length ? "deels" : "ok";
    // Bij een overstap begint de geschiedenis opnieuw: eerdere dagen hadden een andere bron
    const reeksVanaf = overstap ? dag : meta.reeksVanaf ?? dag;
    const { tcgdex, tcgcsv, cardmarketFout, ...metaRest } = meta;
    const nieuweMeta = {
      ...metaRest,
      bronnen: BRONNEN,
      versie: new Date().toISOString(),
      dag,
      eersteDag: VAST_DAG,
      reeksVanaf,
      geschat: [VAST_DAG],
      status,
      reden: null,
      bron,
      tijd: new Date().toISOString(),
      duurMs: Date.now() - start,
      fx,
      tellingen,
      cardmarket: { versie: lijst.versie, gewijzigd: lijst.gewijzigd },
      cmGeprobeerd,
      tcgMislukt: mislukt,
    };
    if (verdacht) {
      await redis.set(SLEUTEL.meta, { ...meta, status, reden: verdacht, tijd: nieuweMeta.tijd });
      return { ok: false, status, reden: verdacht };
    }

    // Stand van de dag: alle live prijzen (wat vandaag niet ververst is, telt met de laatste prijs)
    const snapshot = Object.fromEntries(Object.entries(prijzen).filter(([, p]) => isLive(p)).map(([id, p]) => [id, p.e]));
    const tx = redis.multi();
    tx.set(SLEUTEL.prijzen, prijzen);
    if (Object.keys(snapshot).length) tx.set(SLEUTEL.dag(dag), snapshot);
    tx.set(SLEUTEL.meta, nieuweMeta);
    await tx.exec();
    await redis.set(SLEUTEL.dag(VAST_DAG), startpunt(), { nx: true });

    // 6. Prijsmeldingen bij grote wijzigingen sinds de vorige prijs. Een fout daarin laat de
    // verversing zelf niet mislukken.
    let meldingen = null;
    try {
      meldingen = await verwerkPrijsMeldingen({ redis, prijzen, vorige });
    } catch (e) {
      meldingen = { fout: String(e?.message || e).slice(0, 200) };
    }
    revalidateTag(PRIJS_TAG);

    return {
      ok: true,
      status,
      dag,
      duurMs: nieuweMeta.duurMs,
      tellingen,
      tcgGroepen: { opgehaald: dezeRun.size, mislukt: mislukt.length },
      fx,
      meldingen,
    };
  } finally {
    if ((await redis.get(SLEUTEL.slot)) === runId) await redis.del(SLEUTEL.slot);
  }
}
