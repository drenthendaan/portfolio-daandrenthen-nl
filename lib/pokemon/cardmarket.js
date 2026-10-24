// Europese prijzen: de prijslijst die Cardmarket elke nacht publiceert (alle Pokémon-producten),
// en de koppeling van zelf toegevoegde items aan een Cardmarket-product via TCGdex.
import { amsterdamDatum } from "./regels.mjs";
import { cardmarketPrijs, dexSetsVoorGroep, EIGEN_NUMMERING, naamKern, nummer, opNaam } from "./tcgdex.mjs";

const UA = "daandrenthen.nl-pokemon/1.0 (+https://daandrenthen.nl/pokemon)";
const PRIJSLIJST = "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json";
const TCGDEX = "https://api.tcgdex.net/v2/en";

// De prijslijst (± 16 MB), alleen als hij gewijzigd is sinds `gewijzigd` (Last-Modified van de
// vorige keer). null = niets nieuws. prijzen: Map van Cardmarket-product → rij uit de lijst.
export async function haalPrijslijst({ gewijzigd } = {}) {
  const res = await fetch(PRIJSLIJST, {
    cache: "no-store",
    headers: { "User-Agent": UA, ...(gewijzigd ? { "If-Modified-Since": gewijzigd } : {}) },
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 304) return null;
  if (!res.ok) throw new Error(`Cardmarket ${res.status}`);
  const data = await res.json();
  // "2026-10-24T02:45:46+0200": de dag waarop Cardmarket de lijst maakte
  const versie = String(data.createdAt ?? "");
  const tijd = new Date(versie.replace(/([+-]\d\d)(\d\d)$/, "$1:$2"));
  if (Number.isNaN(tijd.getTime()) || !Array.isArray(data.priceGuides)) {
    throw new Error("Cardmarket: onverwachte prijslijst");
  }
  const prijzen = new Map(data.priceGuides.map((r) => [r.idProduct, r]));
  return { versie, dag: amsterdamDatum(tijd), gewijzigd: res.headers.get("last-modified"), prijzen };
}

async function tcgdex(pad) {
  const res = await fetch(TCGDEX + pad, {
    cache: "no-store",
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`TCGdex ${res.status}`);
  return res.json();
}

// Cardmarket-product bij een zelf toegevoegde losse kaart met een TCGplayer-product: via de
// TCGdex-set van de TCGplayer-groep en het kaartnummer (of de naam, als de set anders nummert).
// Kaarten met een variant in de naam (stempel, Cosmos Holo, ...) worden niet gekoppeld. Een prijs
// die meer dan 4× afwijkt van TCGplayer (`tpEur`) wijst op een verkeerd product.
//   uitkomst: { id, holo, dex, trend (centen) } of null
export async function koppelItem(item, { cache = {}, tpEur = null } = {}) {
  if (!item?.tp?.product || !item.nummer) return null;
  const naam = naamKern(item.naam);
  if (naam.variant || !naam.basis) return null;
  cache.sets ??= await tcgdex("/sets");
  const setIds = dexSetsVoorGroep(item.set, cache.sets);
  const nr = nummer(item.nummer);
  const kandidaten = [];
  for (const id of setIds) {
    cache[id] ??= await tcgdex(`/sets/${encodeURIComponent(id)}`);
    const kaarten = cache[id].cards ?? [];
    if (EIGEN_NUMMERING.has(id)) kandidaten.push(...opNaam(kaarten, naam.basis));
    else kandidaten.push(...kaarten.filter((c) => nummer(c.localId) === nr && naamKern(c.name).basis === naam.basis));
  }
  if (kandidaten.length !== 1) return null;
  const kaart = await tcgdex(`/cards/${encodeURIComponent(kandidaten[0].id)}`);
  const holo = item.tp.sub === "Reverse Holofoil";
  const prijs = cardmarketPrijs(kaart?.pricing?.cardmarket, holo);
  const id = kaart?.pricing?.cardmarket?.idProduct;
  if (!id || !prijs) return null;
  if (tpEur > 0 && (prijs.t / tpEur < 0.25 || prijs.t / tpEur > 4)) return null;
  return { id, holo, dex: kaart.id, trend: prijs.t };
}
