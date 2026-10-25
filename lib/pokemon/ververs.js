// Dagelijkse verversing van de prijzen. Hoofdbron is de prijslijst die Cardmarket elke nacht
// publiceert: de trendprijs (Europa), zonder trend het gemiddelde van 30 dagen. Kaarten zonder zeker
// Cardmarket-product (varianten, twijfelgevallen) krijgen de TCGplayer-marktprijs via tcgcsv.com,
// omgerekend met de ECB-koers; Japanse twijfelgevallen zonder TCGplayer de beste schatting op
// Cardmarket. Schrijft het resultaat naar Redis; daarna volgen de prijsmeldingen (meldingen.js).
// Wordt aangeroepen door de Vercel Cron en door de knop "Nu verversen".
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import collectie from "@/data/pikachu-collectie.json";
import cardmarketExtra from "@/data/pokemon/cardmarket-extra.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { haalPrijslijst, koppelItem } from "./cardmarket";
import { verwerkPrijsMeldingen } from "./meldingen";
import { amsterdamDatum, bewaakPrijs, bronVan, cent, isLive, kaartPrijs, VAST_DAG } from "./regels.mjs";
import { getRedis, ITEMS_KEY, PRIJS_TAG, SLEUTEL } from "./server";
import { cardmarketPrijs } from "./tcgdex.mjs";

const UA = "daandrenthen.nl-pokemon/1.0 (+https://daandrenthen.nl/pokemon)";
const BUDGET_GROEPEN_MS = 180_000; // daarna geen nieuwe groepen meer; volgende run haalt de rest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Welke bronnen er meedoen. Een run zonder dit kenmerk in de meta is een overstap: die haalt alles
// opnieuw op en begint de geschiedenis opnieuw.
const BRONNEN = "cardmarket+tcgplayer";
// Cardmarket-product van een kaart: eerst wat met de hand is gecontroleerd (voorrang), dan TCGdex
// (koppelingen.json), dan de catalogus van Cardmarket (ook voor de Japanse kaarten)
const cmVoor = (id) =>
  id in cardmarketExtra.voorrang
    ? cardmarketExtra.voorrang[id].cm
    : koppelingen.kaarten[id]?.cm ?? cardmarketExtra.kaarten[id]?.cm ?? null;
// Beste schatting als het product niet zeker is (alleen gebruikt zonder TCGplayer-product)
const gokVoor = (id) => (cardmarketExtra.twijfel[id] ? { id: cardmarketExtra.twijfel[id].gok, holo: false } : null);
// Prijs in de lijst (collectie-JSON) in centen, voor de controle op foute prijzen
const lijstprijs = (kaart) => (kaart.price_eur > 0 ? cent(kaart.price_eur) : null);
// Wat er de vorige keer als bron gold: bij een vastgehouden prijs de nieuwe (gecontroleerde) prijs
const laatsteBron = (v) => v?.controle ?? v;

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
    const items = Object.values(itemHash ?? {}).filter((i) => i?.cm?.id || i?.tp?.product);

    // 1. Cardmarket: de prijslijst van vannacht, alleen als die nieuw is sinds de vorige keer
    let lijst = null;
    let cmFout = null;
    try {
      lijst = await haalPrijslijst({ gewijzigd: overstap ? null : meta.cardmarket?.gewijzigd });
    } catch (e) {
      cmFout = String(e?.message || e).slice(0, 120);
    }

    // 2. TCGplayer alleen voor wat geen zekere Cardmarket-prijs heeft: kaarten zonder (zeker) product,
    // kaarten waarvan het product geen prijs heeft, en items zonder Cardmarket-product
    const cmPrijs = (cm) => (cm?.id && lijst ? cardmarketPrijs(lijst.prijzen.get(cm.id), cm.holo) : null);
    const heeftCm = (id, cm) => !!cm && (lijst ? !!cmPrijs(cm) : vorige[id]?.t === "c" && vorige[id].cm?.id === cm.id);
    const tpVoor = (k) => koppelingen.kaarten[k.id]?.tp ?? null;
    const nodig = [
      ...collectie.cards.filter((k) => tpVoor(k) && !heeftCm(k.id, cmVoor(k.id))).map(tpVoor),
      ...items.filter((i) => i.tp?.groep && !heeftCm(i.id, i.cm)).map((i) => i.tp),
    ];
    let versie = meta.tcgcsv?.versie ?? null;
    let tcgFout = null;
    try {
      versie = (await haal("https://tcgcsv.com/last-updated.txt", { json: false })).trim();
    } catch (e) {
      tcgFout = String(e?.message || e).slice(0, 120);
    }
    const nieuweVersie = versie !== meta.tcgcsv?.versie || overstap;
    const opgehaald = new Set(nieuweVersie ? [] : meta.tcgcsv?.opgehaald ?? []);
    const teHalen = tcgFout ? [] : [...new Set(nodig.map((t) => t.groep))].filter((g) => !opgehaald.has(g));
    if (!lijst && !teHalen.length) {
      if (cmFout && oudeMeta) await redis.set(SLEUTEL.meta, { ...meta, cardmarketFout: cmFout });
      return cmFout && !meta.dag
        ? { ok: false, status: "fout", fout: cmFout }
        : { ok: true, overgeslagen: true, status: meta.status, dag: meta.dag };
    }
    const dagTcg = versie ? amsterdamDatum(new Date(versie.replace(/([+-]\d\d)(\d\d)$/, "$1:$2"))) : null;

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
      await sleep(100); // tcgcsv: rustig aan
    }

    // Koers dollar → euro (ECB), met terugval op de vorige koers
    let fx = meta.fx ?? { koers: 0.88, datum: VAST_DAG, bron: "vast" };
    if (dezeRun.size) {
      try {
        const r = await haal("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
        const k = r?.rates?.EUR;
        if (k > 0.7 && k < 1.2) fx = { koers: k, datum: r.date, bron: "ecb" };
      } catch {}
    }
    // TCGplayer-marktprijs van een product (nooit het laagste aanbod). undefined: niet opgehaald.
    const tcgPrijs = (tp) => {
      if (!tp?.groep || !dezeRun.has(tp.groep)) return undefined;
      const markt = (rijen.get(tp.product) ?? []).find((r) => r.subTypeName === tp.sub)?.marketPrice;
      if (!(markt > 0)) return null;
      const u = cent(markt);
      return { e: Math.round(u * fx.koers), t: "m", u, d: dagTcg };
    };

    const cmDag = lijst?.dag ?? meta.cardmarket?.dag ?? null;
    const dag = [dagTcg, cmDag].filter(Boolean).sort().at(-1);

    // 3. Zelf toegevoegde losse kaarten zonder Cardmarket-product: via TCGdex koppelen, hooguit
    // één poging per item per dag. De TCGplayer-prijs van het toevoegen dient als controle.
    const vandaag = amsterdamDatum(new Date());
    const geprobeerd = {};
    const dexCache = {};
    let gekoppeld = 0;
    for (const item of items) {
      if (item.cm?.id || !item.nummer || !item.tp?.product) continue;
      if (meta.cmGeprobeerd?.[item.id] === vandaag) {
        geprobeerd[item.id] = vandaag;
        continue;
      }
      geprobeerd[item.id] = vandaag;
      try {
        const k = await koppelItem(item, { cache: dexCache, tpEur: item.start?.e ?? null });
        if (!k) continue;
        item.cm = { id: k.id, holo: k.holo };
        const vers = await redis.hget(ITEMS_KEY, item.id);
        if (vers) await redis.hset(ITEMS_KEY, { [item.id]: { ...vers, cm: item.cm } });
        delete geprobeerd[item.id];
        gekoppeld++;
      } catch {}
    }

    // 4. Prijs per kaart en per item, met de controle op foute prijzen (sprong van meer dan 50%, of
    // meer dan 5x afwijking van de lijst)
    const uitLijst = (cm, gok = false) => {
      const p = cmPrijs(cm);
      return p ? { ...p, d: lijst.dag, id: cm.id, ...(gok ? { gok: true } : {}) } : null;
    };
    const prijzen = {};
    const tellingen = { c: 0, m: 0, v: 0, o: 0, items: 0, verouderd: 0, cmVers: 0, tcgVers: 0, schatting: 0, controle: 0, gekoppeld };
    const tel = (p) => {
      const laatst = p.controle ?? p;
      if (laatst.t === "c" && lijst && laatst.d === lijst.dag) tellingen.cmVers++;
      else if (laatst.t === "m" && dezeRun.size && laatst.d === dagTcg) tellingen.tcgVers++;
      else if (isLive(p)) tellingen.verouderd++;
      if (p.cm?.gok) tellingen.schatting++;
      if (p.controle) tellingen.controle++;
    };
    for (const kaart of collectie.cards) {
      const zeker = cmVoor(kaart.id);
      const tp = tpVoor(kaart);
      // Zonder zeker product en zonder TCGplayer: de beste schatting op Cardmarket
      const gok = !zeker && !tp ? gokVoor(kaart.id) : null;
      const product = zeker ?? gok;
      const nieuw = kaartPrijs({
        cm: uitLijst(product, !!gok),
        product: product?.id ?? null,
        vorige: laatsteBron(vorige[kaart.id]),
        vast: { eur: kaart.price_eur, type: kaart.price_type },
        tcg: tp ? tcgPrijs(tp) : null,
      });
      const p = bewaakPrijs({ nieuw, vorige: vorige[kaart.id], lijst: lijstprijs(kaart) });
      prijzen[kaart.id] = p;
      tellingen[p.t] = (tellingen[p.t] ?? 0) + 1;
      tel(p);
    }
    // Items: alleen live prijzen opslaan; zonder live prijs geldt in de browser de prijs
    // van het moment van toevoegen of de zelf ingevulde waarde
    for (const item of items) {
      const nieuw = kaartPrijs({
        cm: uitLijst(item.cm),
        product: item.cm?.id ?? null,
        vorige: laatsteBron(vorige[item.id]),
        tcg: item.tp ? tcgPrijs(item.tp) : null,
      });
      const p = bewaakPrijs({ nieuw, vorige: vorige[item.id], lijst: null });
      if (isLive(p)) {
        prijzen[item.id] = p;
        tellingen.items++;
        tel(p);
      }
    }

    // 5. Stroomonderbreker: liever niets schrijven dan onzin in de geschiedenis. Per bron: zijn er
    // veel minder verse prijzen dan de vorige keer? En sprong het totaal van wat in beide runs
    // dezelfde bron heeft?
    const toen = meta.tellingen ?? {};
    let verdacht = null;
    if (!overstap && lijst && toen.cmVers >= 50 && tellingen.cmVers < 0.7 * toen.cmVers) {
      verdacht = `maar ${tellingen.cmVers} Cardmarket-prijzen, vorige keer ${toen.cmVers}`;
    }
    if (!verdacht && !overstap && nieuweVersie && !mislukt.length && toen.tcgVers >= 20 && tellingen.tcgVers < 0.7 * toen.tcgVers) {
      verdacht = `maar ${tellingen.tcgVers} TCGplayer-prijzen, vorige keer ${toen.tcgVers}`;
    }
    const gedeeld = Object.entries(prijzen).filter(
      ([id, p]) => isLive(p) && isLive(vorige[id]) && bronVan(p) === bronVan(vorige[id])
    );
    const somNu = gedeeld.reduce((s, [, p]) => s + p.e, 0);
    const somToen = gedeeld.reduce((s, [id]) => s + vorige[id].e, 0);
    if (!verdacht && gedeeld.length >= 50 && somToen > 0 && Math.abs(somNu / somToen - 1) > 0.5) {
      verdacht = `totaal sprong van ${somToen} naar ${somNu} cent`;
    }

    const status = verdacht ? "verdacht" : mislukt.length || cmFout || tcgFout ? "deels" : "ok";
    // Bij een overstap begint de geschiedenis opnieuw: eerdere dagen hadden andere bronnen
    const reeksVanaf = overstap ? dag : meta.reeksVanaf ?? dag;
    const { tcgdex, cardmarketFout, ...metaRest } = meta;
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
      cardmarket: lijst
        ? { versie: lijst.versie, dag: lijst.dag, gewijzigd: lijst.gewijzigd, opgehaald: new Date().toISOString() }
        : meta.cardmarket ?? null,
      ...(cmFout ? { cardmarketFout: cmFout } : {}),
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
      cardmarket: nieuweMeta.cardmarket?.versie ?? null,
      fx,
      meldingen,
    };
  } finally {
    if ((await redis.get(SLEUTEL.slot)) === runId) await redis.del(SLEUTEL.slot);
  }
}
