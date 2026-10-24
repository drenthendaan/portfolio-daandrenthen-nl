// Dagelijkse verversing van de prijzen. De waarde van een kaart is de Cardmarket-trendprijs
// (Europa) uit de prijslijst die Cardmarket elke nacht publiceert; zonder Cardmarket-prijs de
// TCGplayer-prijs via tcgcsv.com, omgerekend met de ECB-koers (Frankfurter). Schrijft het
// resultaat naar Redis; daarna volgen de prijsmeldingen (meldingen.js). Wordt aangeroepen door
// de Vercel Cron en door de knop "Nu verversen".
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import collectie from "@/data/pikachu-collectie.json";
import cardmarketExtra from "@/data/pokemon/cardmarket-extra.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { haalPrijslijst, koppelItem } from "./cardmarket";
import { verwerkPrijsMeldingen } from "./meldingen";
import { amsterdamDatum, cent, isLive, kaartPrijs, VAST_DAG } from "./regels.mjs";
import { getRedis, ITEMS_KEY, PRIJS_TAG, SLEUTEL } from "./server";
import { cardmarketPrijs } from "./tcgdex.mjs";

const UA = "daandrenthen.nl-pokemon/1.0 (+https://daandrenthen.nl/pokemon)";
const BUDGET_GROEPEN_MS = 180_000; // daarna geen nieuwe groepen meer; volgende run haalt de rest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTcgplayer = (p) => p?.t === "m" || p?.t === "l";
// Het TCGplayer-deel van een prijs: de prijs zelf, of bij een Cardmarket-prijs de vergelijking
const tcgplayerDeel = (p) => (isTcgplayer(p) ? p : p?.us ?? null);
// Cardmarket-product van een kaart: via TCGdex (koppelingen.json), anders uit de catalogus van
// Cardmarket (cardmarket-extra.json, ook voor de Japanse kaarten)
const cmVoor = (id) => koppelingen.kaarten[id]?.cm ?? cardmarketExtra.kaarten[id]?.cm ?? null;

async function haal(url, { json = true, timeout = 15000 } = {}) {
  for (let poging = 1; ; poging++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(timeout),
      });
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
    // Zelf toegevoegde items die aan een TCGplayer-product gekoppeld zijn
    const items = Object.values(itemHash ?? {}).filter((i) => i?.tp?.product && i.tp.groep);

    // 1. Welke tcgcsv-versie is er, en welke groepen moeten we nog hebben?
    const versie = (await haal("https://tcgcsv.com/last-updated.txt", { json: false })).trim();
    const dagTcg = amsterdamDatum(new Date(versie.replace(/([+-]\d\d)(\d\d)$/, "$1:$2")));
    const nieuweVersie = versie !== meta.tcgcsv?.versie;
    const alleGroepen = [
      ...new Set([
        ...Object.values(koppelingen.kaarten).flatMap((k) => (k.tp ? [k.tp.groep] : [])),
        ...items.map((i) => i.tp.groep),
      ]),
    ];
    const opgehaald = new Set(nieuweVersie ? [] : meta.tcgcsv?.opgehaald ?? []);
    const teHalen = alleGroepen.filter((g) => !opgehaald.has(g));

    // 2. Cardmarket: de prijslijst van vannacht, alleen als die nieuw is sinds de vorige keer
    let lijst = null;
    let cmFout = null;
    try {
      lijst = await haalPrijslijst({ gewijzigd: meta.cardmarket?.gewijzigd });
    } catch (e) {
      cmFout = String(e?.message || e).slice(0, 120);
    }
    if (!teHalen.length && !lijst) {
      return { ok: true, overgeslagen: true, status: meta.status, dag: meta.dag };
    }
    const cmDag = lijst?.dag ?? meta.cardmarket?.dag ?? null;
    const dag = [dagTcg, cmDag].filter(Boolean).sort().at(-1);

    // 3. Items zonder Cardmarket-product: via TCGdex koppelen, hooguit één poging per item per dag
    const vandaag = amsterdamDatum(new Date());
    const geprobeerd = {};
    const dexCache = {};
    let gekoppeld = 0;
    for (const item of items) {
      if (item.cm?.id || !item.nummer) continue;
      if (meta.cmGeprobeerd?.[item.id] === vandaag) {
        geprobeerd[item.id] = vandaag;
        continue;
      }
      geprobeerd[item.id] = vandaag;
      try {
        const v = vorige[item.id];
        const tpEur = tcgplayerDeel(v)?.e ?? item.start?.e ?? null;
        const k = await koppelItem(item, { cache: dexCache, tpEur });
        if (!k) continue;
        item.cm = { id: k.id, holo: k.holo };
        const vers = await redis.hget(ITEMS_KEY, item.id);
        if (vers) await redis.hset(ITEMS_KEY, { [item.id]: { ...vers, cm: item.cm } });
        delete geprobeerd[item.id];
        gekoppeld++;
      } catch {}
    }

    // 4. TCGplayer-prijzen per groep (tcgcsv: eigen User-Agent, 100 ms tussen verzoeken)
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

    // 5. Koers dollar → euro (ECB), met terugval op de vorige koers
    let fx = meta.fx ?? { koers: 0.88, datum: VAST_DAG, bron: "vast" };
    try {
      const r = await haal("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
      const k = r?.rates?.EUR;
      if (k > 0.7 && k < 1.2) fx = { koers: k, datum: r.date, bron: "ecb" };
    } catch {}

    // 6. Prijs per kaart en per item: Cardmarket uit de lijst van vannacht (alleen als die deze run
    // is opgehaald; anders blijft de vorige Cardmarket-prijs staan), anders TCGplayer
    const uitLijst = (cm) => {
      const p = cm?.id && lijst ? cardmarketPrijs(lijst.prijzen.get(cm.id), cm.holo) : null;
      return p ? { ...p, d: lijst.dag } : null;
    };
    const prijzen = {};
    const tellingen = { c: 0, m: 0, l: 0, v: 0, o: 0, items: 0, verouderd: 0, cmVers: 0, tcgVers: 0, gekoppeld };
    const tel = (p) => {
      if (p.t === "c" && lijst && p.d === lijst.dag) tellingen.cmVers++;
      if (nieuweVersie && tcgplayerDeel(p)?.d === dagTcg) tellingen.tcgVers++;
      if (isLive(p) && p.d !== (p.t === "c" ? cmDag : dagTcg)) tellingen.verouderd++;
    };
    for (const kaart of collectie.cards) {
      const k = koppelingen.kaarten[kaart.id];
      const p = kaartPrijs({
        koppeling: k?.tp,
        rijen: k?.tp && dezeRun.has(k.tp.groep) ? rijen.get(k.tp.product) ?? [] : undefined,
        fx: fx.koers,
        dag: dagTcg,
        vorige: vorige[kaart.id],
        vast: { eur: kaart.price_eur, type: kaart.price_type },
        cm: uitLijst(cmVoor(kaart.id)),
      });
      prijzen[kaart.id] = p;
      tellingen[p.t]++;
      tel(p);
    }
    // Items: alleen live prijzen opslaan; zonder live prijs geldt in de browser de prijs
    // van het moment van toevoegen of de zelf ingevulde waarde
    for (const item of items) {
      const p = kaartPrijs({
        koppeling: item.tp,
        rijen: dezeRun.has(item.tp.groep) ? rijen.get(item.tp.product) ?? [] : undefined,
        fx: fx.koers,
        dag: dagTcg,
        vorige: vorige[item.id],
        cm: uitLijst(item.cm),
      });
      if (isLive(p)) {
        prijzen[item.id] = p;
        tellingen.items++;
        tel(p);
      }
    }

    // 7. Stroomonderbreker: liever niets schrijven dan onzin in de geschiedenis. Per bron: zijn er
    // veel minder verse prijzen dan de vorige keer? En sprong het totaal van wat in beide runs
    // dezelfde soort prijs heeft?
    const toen = meta.tellingen ?? {};
    let verdacht = null;
    if (nieuweVersie && toen.tcgVers >= 50 && tellingen.tcgVers < 0.7 * toen.tcgVers) {
      verdacht = `maar ${tellingen.tcgVers} TCGplayer-prijzen, vorige keer ${toen.tcgVers}`;
    }
    if (!verdacht && lijst && toen.cmVers >= 50 && tellingen.cmVers < 0.7 * toen.cmVers) {
      verdacht = `maar ${tellingen.cmVers} Cardmarket-prijzen, vorige keer ${toen.cmVers}`;
    }
    const gedeeld = Object.entries(prijzen).filter(
      ([id, p]) => isLive(p) && isLive(vorige[id]) && p.t === vorige[id].t
    );
    const somNu = gedeeld.reduce((s, [, p]) => s + p.e, 0);
    const somToen = gedeeld.reduce((s, [id]) => s + vorige[id].e, 0);
    if (!verdacht && gedeeld.length >= 50 && somToen > 0 && Math.abs(somNu / somToen - 1) > 0.5) {
      verdacht = `totaal sprong van ${somToen} naar ${somNu} cent`;
    }

    const status = verdacht ? "verdacht" : mislukt.length || cmFout ? "deels" : "ok";
    // De geschiedenis begint opnieuw bij de eerste run met Cardmarket-prijzen: daarvoor waren het
    // TCGplayer-prijzen, en die zijn niet te vergelijken
    const reeksVanaf = meta.reeksVanaf ?? (tellingen.c ? dag : undefined);
    const { tcgdex, ...metaZonderTcgdex } = meta;
    const nieuweMeta = {
      ...metaZonderTcgdex,
      versie: verdacht ? meta.versie : new Date().toISOString(),
      dag: verdacht ? meta.dag : dag,
      eersteDag: VAST_DAG,
      reeksVanaf,
      geschat: [VAST_DAG],
      status,
      reden: verdacht,
      bron,
      tijd: new Date().toISOString(),
      duurMs: Date.now() - start,
      fx,
      tellingen,
      tcgcsv: { versie, opgehaald: [...opgehaald], mislukt },
      cardmarket: lijst
        ? { versie: lijst.versie, dag: lijst.dag, gewijzigd: lijst.gewijzigd, opgehaald: new Date().toISOString() }
        : meta.cardmarket ?? null,
      cardmarketFout: cmFout,
      cmGeprobeerd: geprobeerd,
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

    // 8. Prijsmeldingen bij grote wijzigingen sinds de vorige prijs. Een fout daarin laat de
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
      cardmarket: nieuweMeta.cardmarket?.versie ?? null,
      cardmarketFout: cmFout,
      fx,
      meldingen,
    };
  } finally {
    if ((await redis.get(SLEUTEL.slot)) === runId) await redis.del(SLEUTEL.slot);
  }
}
