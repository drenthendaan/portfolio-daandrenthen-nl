// Dagelijkse verversing van de prijzen: de TCGplayer-marktprijs via tcgcsv.com, omgerekend met de
// ECB-koers (Frankfurter). Elke kaart en elk item is gekoppeld aan zijn eigen TCGplayer-product
// (ook varianten). Zonder marktprijs blijft de vaste prijs uit de lijst staan. Schrijft het
// resultaat naar Redis; daarna volgen de prijsmeldingen (meldingen.js). Wordt aangeroepen door de
// Vercel Cron en door de knop "Nu verversen".
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import collectie from "@/data/pikachu-collectie.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { verwerkPrijsMeldingen } from "./meldingen";
import { amsterdamDatum, cent, isLive, kaartPrijs, VAST_DAG } from "./regels.mjs";
import { getRedis, ITEMS_KEY, PRIJS_TAG, SLEUTEL } from "./server";

const UA = "daandrenthen.nl-pokemon/1.0 (+https://daandrenthen.nl/pokemon)";
const BUDGET_GROEPEN_MS = 180_000; // daarna geen nieuwe groepen meer; volgende run haalt de rest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Welke bron er geldt. Een run zonder dit kenmerk in de meta is een overstap: die haalt alles
// opnieuw op en begint de geschiedenis opnieuw.
const BRONNEN = "tcgplayer";

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
    // Zelf toegevoegde items die aan een TCGplayer-product gekoppeld zijn
    const items = Object.values(itemHash ?? {}).filter((i) => i?.tp?.product && i.tp.groep);

    // 1. Welke tcgcsv-versie is er, en welke groepen moeten we nog hebben?
    const versie = (await haal("https://tcgcsv.com/last-updated.txt", { json: false })).trim();
    const dag = amsterdamDatum(new Date(versie.replace(/([+-]\d\d)(\d\d)$/, "$1:$2")));
    const nieuweVersie = overstap || versie !== meta.tcgcsv?.versie;
    const alleGroepen = [
      ...new Set([
        ...Object.values(koppelingen.kaarten).flatMap((k) => (k.tp ? [k.tp.groep] : [])),
        ...items.map((i) => i.tp.groep),
      ]),
    ];
    const opgehaald = new Set(nieuweVersie ? [] : meta.tcgcsv?.opgehaald ?? []);
    const teHalen = alleGroepen.filter((g) => !opgehaald.has(g));
    if (!teHalen.length) return { ok: true, overgeslagen: true, status: meta.status, dag: meta.dag };

    // 2. TCGplayer-prijzen per groep (tcgcsv: eigen User-Agent, 100 ms tussen verzoeken)
    const rijen = new Map();
    const dezeRun = new Set();
    const mislukt = [];
    for (const g of teHalen) {
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
        opgehaald.add(g);
        dezeRun.add(g);
      } catch {
        mislukt.push(g);
      }
      await sleep(100);
    }

    // 3. Koers dollar → euro (ECB), met terugval op de vorige koers
    let fx = meta.fx ?? { koers: 0.88, datum: VAST_DAG, bron: "vast" };
    try {
      const r = await haal("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
      const k = r?.rates?.EUR;
      if (k > 0.7 && k < 1.2) fx = { koers: k, datum: r.date, bron: "ecb" };
    } catch {}

    // 4. Prijs per kaart en per item. Marktprijs van de gekoppelde variant, nooit het laagste
    // aanbod; undefined als de groep deze run niet is opgehaald (dan blijft de vorige prijs staan).
    const tcgPrijs = (tp) => {
      if (!tp?.groep || !dezeRun.has(tp.groep)) return undefined;
      const markt = (rijen.get(tp.product) ?? []).find((r) => r.subTypeName === tp.sub)?.marketPrice;
      if (!(markt > 0)) return null;
      const u = cent(markt);
      return { e: Math.round(u * fx.koers), t: "m", u, d: dag };
    };
    const prijzen = {};
    const tellingen = { m: 0, v: 0, o: 0, items: 0, vers: 0, verouderd: 0 };
    const tel = (p) => {
      if (isLive(p) && p.d === dag) tellingen.vers++;
      else if (isLive(p)) tellingen.verouderd++;
    };
    for (const kaart of collectie.cards) {
      const tp = koppelingen.kaarten[kaart.id]?.tp;
      const p = kaartPrijs({
        vorige: vorige[kaart.id],
        vast: { eur: kaart.price_eur, type: kaart.price_type },
        tcg: tp ? tcgPrijs(tp) : null,
      });
      prijzen[kaart.id] = p;
      tellingen[p.t] = (tellingen[p.t] ?? 0) + 1;
      tel(p);
    }
    // Items: alleen live prijzen opslaan; zonder live prijs geldt in de browser de prijs
    // van het moment van toevoegen of de zelf ingevulde waarde
    for (const item of items) {
      const p = kaartPrijs({ vorige: vorige[item.id], tcg: tcgPrijs(item.tp) });
      if (isLive(p)) {
        prijzen[item.id] = p;
        tellingen.items++;
        tel(p);
      }
    }

    // 5. Stroomonderbreker: liever niets schrijven dan onzin in de geschiedenis. Zijn er veel minder
    // verse prijzen dan de vorige keer, of sprong het totaal van wat in beide runs live was?
    const toen = meta.tellingen ?? {};
    let verdacht = null;
    if (!overstap && nieuweVersie && !mislukt.length && toen.vers >= 50 && tellingen.vers < 0.7 * toen.vers) {
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
    const { tcgdex, cardmarket, cardmarketFout, cmGeprobeerd, ...metaRest } = meta;
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
      tcgcsv: { versie, opgehaald: [...opgehaald], mislukt },
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
      groepen: { opgehaald: dezeRun.size, mislukt: mislukt.length },
      fx,
      meldingen,
    };
  } finally {
    if ((await redis.get(SLEUTEL.slot)) === runId) await redis.del(SLEUTEL.slot);
  }
}
