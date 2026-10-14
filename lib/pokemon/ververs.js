// Dagelijkse verversing van de prijzen. Haalt TCGplayer-prijzen op via tcgcsv.com, de
// ECB-koers via Frankfurter en Cardmarket-prijzen via TCGdex, en schrijft het resultaat
// naar Redis. Wordt aangeroepen door de Vercel Cron en door de knop "Nu verversen".
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import collectie from "@/data/pikachu-collectie.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { amsterdamDatum, cent, kaartPrijs, VAST_DAG } from "./regels.mjs";
import { getRedis, ITEMS_KEY, PRIJS_TAG, SLEUTEL } from "./server";

const UA = "daandrenthen.nl-pokemon/1.0 (+https://daandrenthen.nl/pokemon)";
const BUDGET_GROEPEN_MS = 180_000; // daarna geen nieuwe groepen meer; volgende run haalt de rest
const BUDGET_DEX_MS = 240_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isLive = (p) => p?.t === "m" || p?.t === "l";

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
    const dag = amsterdamDatum(new Date(versie.replace(/([+-]\d\d)(\d\d)$/, "$1:$2")));
    const nieuweVersie = versie !== meta.tcgcsv?.versie;
    const alleGroepen = [
      ...new Set([
        ...Object.values(koppelingen.kaarten).flatMap((k) => (k.tp ? [k.tp.groep] : [])),
        ...items.map((i) => i.tp.groep),
      ]),
    ];
    const opgehaald = new Set(nieuweVersie ? [] : meta.tcgcsv?.opgehaald ?? []);
    const teHalen = alleGroepen.filter((g) => !opgehaald.has(g));
    const dexVers =
      meta.tcgdex?.opgehaald && Date.now() - Date.parse(meta.tcgdex.opgehaald) < 12 * 3600_000;
    if (!teHalen.length && dexVers) {
      return { ok: true, overgeslagen: true, status: meta.status, dag: meta.dag };
    }

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

    // 4. Cardmarket via TCGdex, hooguit twee keer per dag
    let cardmarket = null;
    let tcgdex = meta.tcgdex ?? null;
    if (!dexVers) {
      cardmarket = new Map();
      let dexMislukt = 0;
      const lijst = Object.entries(koppelingen.kaarten).filter(([, k]) => k.dex && k.cm);
      for (let i = 0; i < lijst.length; i += 4) {
        if (Date.now() - start > BUDGET_DEX_MS) {
          dexMislukt += lijst.length - i;
          break;
        }
        await Promise.all(
          lijst.slice(i, i + 4).map(async ([id, k]) => {
            try {
              const c = (await haal(`https://api.tcgdex.net/v2/en/cards/${k.dex}`, { timeout: 10000 }))
                ?.pricing?.cardmarket;
              const s = k.cm === "holo" ? "-holo" : "";
              const trend = c?.["trend" + s] || c?.["avg30" + s];
              if (trend > 0) {
                cardmarket.set(id, {
                  t: cent(trend),
                  a7: c["avg7" + s] > 0 ? cent(c["avg7" + s]) : null,
                  a30: c["avg30" + s] > 0 ? cent(c["avg30" + s]) : null,
                  d: String(c.updated || "").slice(0, 10) || null,
                });
              }
            } catch {
              dexMislukt++;
            }
          })
        );
      }
      tcgdex = { opgehaald: new Date().toISOString(), mislukt: dexMislukt };
    }

    // 5. Prijs per kaart
    const prijzen = {};
    const tellingen = { m: 0, l: 0, v: 0, o: 0, verouderd: 0, cardmarket: 0 };
    for (const kaart of collectie.cards) {
      const k = koppelingen.kaarten[kaart.id];
      const p = kaartPrijs({
        koppeling: k?.tp,
        rijen: k?.tp && dezeRun.has(k.tp.groep) ? rijen.get(k.tp.product) ?? [] : undefined,
        fx: fx.koers,
        dag,
        vorige: vorige[kaart.id],
        vast: { eur: kaart.price_eur, type: kaart.price_type },
      });
      if (isLive(p) && p.d !== dag) tellingen.verouderd++;
      // Cardmarket alleen tonen als het in de buurt van de TCGplayer-prijs ligt
      const cm = cardmarket?.get(kaart.id) ?? vorige[kaart.id]?.cm;
      if (cm && (!p.e || (cm.t / p.e >= 0.2 && cm.t / p.e <= 5))) {
        p.cm = cm;
        tellingen.cardmarket++;
      }
      prijzen[kaart.id] = p;
      tellingen[p.t]++;
    }
    // Items: alleen live prijzen opslaan; zonder live prijs geldt in de browser de prijs
    // van het moment van toevoegen of de zelf ingevulde waarde
    for (const item of items) {
      const p = kaartPrijs({
        koppeling: item.tp,
        rijen: dezeRun.has(item.tp.groep) ? rijen.get(item.tp.product) ?? [] : undefined,
        fx: fx.koers,
        dag,
        vorige: vorige[item.id],
      });
      if (isLive(p)) {
        prijzen[item.id] = p;
        tellingen.items = (tellingen.items || 0) + 1;
      }
    }

    // 6. Stroomonderbreker: liever niets schrijven dan onzin in de geschiedenis
    const vers = Object.entries(prijzen).filter(([, p]) => isLive(p) && p.d === dag);
    const vorigLive = Object.values(vorige).filter(isLive).length;
    let verdacht = null;
    if (nieuweVersie && vorigLive >= 50 && vers.length < 0.7 * vorigLive) {
      verdacht = `maar ${vers.length} live prijzen, vorige keer ${vorigLive}`;
    }
    const gedeeld = vers.filter(([id]) => isLive(vorige[id]));
    const somNu = gedeeld.reduce((s, [, p]) => s + p.e, 0);
    const somToen = gedeeld.reduce((s, [id]) => s + vorige[id].e, 0);
    if (!verdacht && gedeeld.length >= 50 && somToen > 0 && Math.abs(somNu / somToen - 1) > 0.5) {
      verdacht = `totaal sprong van ${somToen} naar ${somNu} cent`;
    }

    const status = verdacht ? "verdacht" : mislukt.length || tcgdex?.mislukt ? "deels" : "ok";
    const nieuweMeta = {
      ...meta,
      versie: verdacht ? meta.versie : new Date().toISOString(),
      dag: verdacht ? meta.dag : dag,
      eersteDag: VAST_DAG,
      geschat: [VAST_DAG],
      status,
      reden: verdacht,
      bron,
      tijd: new Date().toISOString(),
      duurMs: Date.now() - start,
      fx,
      tellingen,
      tcgcsv: { versie, opgehaald: [...opgehaald], mislukt },
      tcgdex,
    };
    if (verdacht) {
      await redis.set(SLEUTEL.meta, { ...meta, status, reden: verdacht, tijd: nieuweMeta.tijd });
      return { ok: false, status, reden: verdacht };
    }

    const snapshot = Object.fromEntries(vers.map(([id, p]) => [id, p.e]));
    const tx = redis.multi();
    tx.set(SLEUTEL.prijzen, prijzen);
    if (vers.length) tx.set(SLEUTEL.dag(dag), snapshot);
    tx.set(SLEUTEL.meta, nieuweMeta);
    await tx.exec();
    await redis.set(SLEUTEL.dag(VAST_DAG), startpunt(), { nx: true });
    revalidateTag(PRIJS_TAG);

    return {
      ok: true,
      status,
      dag,
      duurMs: nieuweMeta.duurMs,
      tellingen,
      groepen: { opgehaald: dezeRun.size, mislukt: mislukt.length },
      fx,
    };
  } finally {
    if ((await redis.get(SLEUTEL.slot)) === runId) await redis.del(SLEUTEL.slot);
  }
}
