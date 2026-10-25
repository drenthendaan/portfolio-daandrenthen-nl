// Dagelijkse verversing van de prijzen. Eén bron: de prijslijst die Cardmarket elke nacht
// publiceert. De waarde van een kaart is de trendprijs (Europa), zonder trend het gemiddelde van 30
// dagen; zonder Cardmarket-prijs blijft de vaste prijs uit de lijst staan. Schrijft het resultaat
// naar Redis; daarna volgen de prijsmeldingen (meldingen.js). Wordt aangeroepen door de Vercel Cron
// en door de knop "Nu verversen".
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

// Sinds de overstap op alleen Cardmarket. Een run zonder dit kenmerk in de meta is de overstap:
// die haalt de lijst altijd op en begint de geschiedenis opnieuw.
const BRONNEN = "cardmarket";
// Cardmarket-product van een kaart: eerst wat met de hand is gecontroleerd (voorrang), dan TCGdex
// (koppelingen.json), dan de catalogus van Cardmarket (ook voor de Japanse kaarten)
const cmVoor = (id) =>
  id in cardmarketExtra.voorrang
    ? cardmarketExtra.voorrang[id].cm
    : koppelingen.kaarten[id]?.cm ?? cardmarketExtra.kaarten[id]?.cm ?? null;
// Prijs in de lijst (collectie-JSON) in centen, voor de controle op foute prijzen
const lijstprijs = (kaart) => (kaart.price_eur > 0 ? cent(kaart.price_eur) : null);
// Wat er de vorige keer als bron gold: bij een vastgehouden prijs de nieuwe (gecontroleerde) prijs
const laatsteBron = (v) => v?.controle ?? v;

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

    // 1. De prijslijst van vannacht, alleen als die nieuw is sinds de vorige keer
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
    // één poging per item per dag. De TCGplayer-prijs van het toevoegen dient alleen als controle.
    const items = Object.values(itemHash ?? {}).filter((i) => i?.cm?.id || i?.tp?.product);
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
        const k = await koppelItem(item, { cache: dexCache, tpEur: item.start?.e ?? null });
        if (!k) continue;
        item.cm = { id: k.id, holo: k.holo };
        const vers = await redis.hget(ITEMS_KEY, item.id);
        if (vers) await redis.hset(ITEMS_KEY, { [item.id]: { ...vers, cm: item.cm } });
        delete geprobeerd[item.id];
        gekoppeld++;
      } catch {}
    }

    // 3. Prijs per kaart en per item uit de lijst, met de controle op foute prijzen (sprong van
    // meer dan 50%, of meer dan 5x afwijking van de lijst)
    const uitLijst = (cm) => {
      const p = cm?.id ? cardmarketPrijs(lijst.prijzen.get(cm.id), cm.holo) : null;
      return p ? { ...p, d: dag, id: cm.id } : null;
    };
    const prijzen = {};
    const tellingen = { c: 0, v: 0, o: 0, items: 0, verouderd: 0, cmVers: 0, controle: 0, gekoppeld };
    const tel = (p) => {
      const laatst = p.controle ?? p;
      if (laatst.t === "c" && laatst.d === dag) tellingen.cmVers++;
      else if (p.t === "c") tellingen.verouderd++;
      if (p.controle) tellingen.controle++;
    };
    for (const kaart of collectie.cards) {
      const product = cmVoor(kaart.id);
      const nieuw = kaartPrijs({
        cm: uitLijst(product),
        product: product?.id ?? null,
        vorige: laatsteBron(vorige[kaart.id]),
        vast: { eur: kaart.price_eur, type: kaart.price_type },
      });
      const p = bewaakPrijs({ nieuw, vorige: vorige[kaart.id], lijst: lijstprijs(kaart) });
      prijzen[kaart.id] = p;
      tellingen[p.t] = (tellingen[p.t] ?? 0) + 1;
      tel(p);
    }
    // Items: alleen live prijzen opslaan; zonder live prijs geldt in de browser de prijs
    // van het moment van toevoegen of de zelf ingevulde waarde
    for (const item of items) {
      if (!item.cm?.id) continue;
      const nieuw = kaartPrijs({ cm: uitLijst(item.cm), product: item.cm.id, vorige: laatsteBron(vorige[item.id]) });
      const p = bewaakPrijs({ nieuw, vorige: vorige[item.id], lijst: null });
      if (isLive(p)) {
        prijzen[item.id] = p;
        tellingen.items++;
        tel(p);
      }
    }

    // 4. Stroomonderbreker: liever niets schrijven dan onzin in de geschiedenis. Zijn er veel minder
    // verse prijzen dan de vorige keer? En sprong het totaal van wat in beide runs hetzelfde product is?
    const toen = meta.tellingen ?? {};
    let verdacht = null;
    if (!overstap && toen.cmVers >= 50 && tellingen.cmVers < 0.7 * toen.cmVers) {
      verdacht = `maar ${tellingen.cmVers} Cardmarket-prijzen, vorige keer ${toen.cmVers}`;
    }
    const gedeeld = Object.entries(prijzen).filter(
      ([id, p]) => isLive(p) && isLive(vorige[id]) && bronVan(p) === bronVan(vorige[id])
    );
    const somNu = gedeeld.reduce((s, [, p]) => s + p.e, 0);
    const somToen = gedeeld.reduce((s, [id]) => s + vorige[id].e, 0);
    if (!verdacht && gedeeld.length >= 50 && somToen > 0 && Math.abs(somNu / somToen - 1) > 0.5) {
      verdacht = `totaal sprong van ${somToen} naar ${somNu} cent`;
    }

    const status = verdacht ? "verdacht" : "ok";
    // Bij de overstap begint de geschiedenis opnieuw: eerdere dagen bevatten ook TCGplayer-prijzen
    const reeksVanaf = overstap ? dag : meta.reeksVanaf ?? dag;
    const { tcgdex, tcgcsv, fx, cardmarketFout, ...metaRest } = meta;
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
      cardmarket: { versie: lijst.versie, dag: lijst.dag, gewijzigd: lijst.gewijzigd, opgehaald: new Date().toISOString() },
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
      cardmarket: lijst.versie,
      meldingen,
    };
  } finally {
    if ((await redis.get(SLEUTEL.slot)) === runId) await redis.del(SLEUTEL.slot);
  }
}
