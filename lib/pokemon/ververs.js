// Dagelijkse verversing van de prijzen: de Cardmarket-trend uit de prijslijst die Cardmarket elke
// nacht publiceert, voor elk item met een Cardmarket-product (gekozen bij het toevoegen; bij de
// kaarten uit de oorspronkelijke lijst meegekomen bij de omzetting). Zonder prijs geldt in de
// browser de prijs van het toevoegen, de vaste prijs uit de lijst of de eigen waarde. Schrijft het
// resultaat naar Redis; daarna volgen de prijsmeldingen (meldingen.js). Wordt aangeroepen door de
// Vercel Cron en door de knop "Nu verversen".
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import collectie from "@/data/pikachu-collectie.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { haalPrijslijst } from "./cardmarket";
import { verwerkPrijsMeldingen } from "./meldingen";
import { normaliseerItem } from "./invoer";
import { zorgVoorOmzetting } from "./omzetting";
import { cent, isLive, itemPrijs, kaartPrijs, VAST_DAG } from "./regels.mjs";
import { getRedis, ITEMS_KEY, PRIJS_TAG, SLEUTEL } from "./server";
import { cardmarketPrijs } from "./tcgdex.mjs";

// Welke bron er geldt. Een run zonder dit kenmerk in de meta is een overstap: die haalt alles
// opnieuw op en begint de geschiedenis opnieuw.
const BRONNEN = "cardmarket";

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
    await zorgVoorOmzetting(redis);
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

    // 2. Alle items; alleen die met een Cardmarket-product krijgen een nieuwe prijs
    const items = Object.values(itemHash ?? {})
      .filter((i) => i && typeof i === "object")
      .map(normaliseerItem);

    // 3. Prijs per item: de Cardmarket-trend van het gekoppelde product (nooit de laagste prijs).
    // Alleen live prijzen opslaan; zonder live prijs geldt in de browser de prijs van het
    // toevoegen, de vaste prijs uit de lijst of de eigen waarde.
    const cmPrijs = (cm) => {
      const p = cm?.id ? cardmarketPrijs(lijst.prijzen.get(cm.id), cm.holo) : null;
      return p ? { e: p.t, t: "c", s: p.soort, d: dag } : null;
    };
    const prijzen = {};
    const tellingen = { c: 0, v: 0, h: 0, o: 0, items: items.length, vers: 0, verouderd: 0 };
    for (const item of items) {
      const p = item.cm?.id ? kaartPrijs({ vorige: vorige[item.id], live: cmPrijs(item.cm) }) : null;
      if (isLive(p)) {
        prijzen[item.id] = p;
        if (p.d === dag) tellingen.vers++;
        else tellingen.verouderd++;
      }
      const t = itemPrijs(item, prijzen).t;
      tellingen[t in tellingen ? t : "o"]++;
    }

    // 4. Stroomonderbreker: liever niets schrijven dan onzin in de geschiedenis. Zijn er veel minder
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

    const status = verdacht ? "verdacht" : "ok";
    // Bij een overstap begint de geschiedenis opnieuw: eerdere dagen hadden een andere bron
    const reeksVanaf = overstap ? dag : meta.reeksVanaf ?? dag;
    const { tcgdex, tcgcsv, cardmarketFout, fx, cmGeprobeerd, tcgMislukt, ...metaRest } = meta;
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
      tellingen,
      cardmarket: { versie: lijst.versie, gewijzigd: lijst.gewijzigd },
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

    // 5. Prijsmeldingen bij grote wijzigingen sinds de vorige prijs. Een fout daarin laat de
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
      meldingen,
    };
  } finally {
    if ((await redis.get(SLEUTEL.slot)) === runId) await redis.del(SLEUTEL.slot);
  }
}
