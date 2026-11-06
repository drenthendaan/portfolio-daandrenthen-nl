// Europese prijzen: de prijslijst die Cardmarket elke nacht publiceert (alle Pokémon-producten),
// en het kiezen van een Cardmarket-product bij een zelf toegevoegd item.
import cardmarket from "@/data/pokemon/cardmarket.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { amsterdamDatum } from "./regels.mjs";
import { cardmarketPrijs, dexSetsVoorGroep, EIGEN_NUMMERING, naamKern, nummer, opNaam, woorden } from "./tcgdex.mjs";

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

// Productlijsten van Cardmarket (losse kaarten en verzegelde producten, met naam en uitbreiding)
// en de prijslijst, een paar uur in het geheugen: samen ± 30 MB, alleen nodig bij het toevoegen.
const LIJSTEN = "https://downloads.s3.cardmarket.com/productCatalog/productList/";
const LIJST_MS = 6 * 3600_000;
let lijstBelofte = null;
let lijstTijd = 0;

async function haalLijst(naam) {
  const res = await fetch(LIJSTEN + naam, {
    cache: "no-store",
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Cardmarket ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.products)) throw new Error("Cardmarket: onverwachte productlijst");
  return data.products;
}

export function cardmarketLijsten() {
  if (!lijstBelofte || Date.now() - lijstTijd > LIJST_MS) {
    lijstTijd = Date.now();
    lijstBelofte = Promise.all([haalLijst("products_singles_6.json"), haalLijst("products_nonsingles_6.json"), haalPrijslijst()])
      .then(([singles, sealed, lijst]) => ({
        singles,
        sealed,
        prijzen: lijst.prijzen,
        opId: new Map([...singles, ...sealed].map((p) => [p.idProduct, p])),
      }))
      .catch((e) => {
        lijstBelofte = null;
        throw e;
      });
  }
  return lijstBelofte;
}

// Met één nieuwe poging: TCGdex is soms even traag
async function tcgdex(pad, poging = 1) {
  try {
    const res = await fetch(TCGDEX + pad, {
      cache: "no-store",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`TCGdex ${res.status}`);
    return await res.json();
  } catch (e) {
    if (poging >= 2) throw e;
    return tcgdex(pad, poging + 1);
  }
}

// Cardmarket-product van een TCGdex-kaart
const dexProduct = async (id) => (await tcgdex(`/cards/${encodeURIComponent(id)}`))?.pricing?.cardmarket?.idProduct ?? null;

// TCGplayer-groep → Cardmarket-uitbreiding, geleerd van de kaarten in de verzameling (alleen
// groepen die bij precies één uitbreiding horen)
let groepKaart = null;
function uitbreidingVanGroep(groep, opId) {
  if (!groepKaart) {
    const per = new Map();
    for (const [id, k] of Object.entries(koppelingen.kaarten)) {
      const exp = opId.get(cardmarket.kaarten[id]?.cm?.id)?.idExpansion;
      if (!exp || !k.tp?.groep) continue;
      if (!per.has(k.tp.groep)) per.set(k.tp.groep, new Set());
      per.get(k.tp.groep).add(exp);
    }
    groepKaart = new Map([...per].filter(([, s]) => s.size === 1).map(([g, s]) => [g, [...s][0]]));
  }
  return groepKaart.get(groep) ?? null;
}

// Uitbreidingen bij Cardmarket met de meeste kaartnamen uit de TCGdex-set (minstens de helft).
// Bij een gelijke stand allemaal: dezelfde set kan er in meerdere talen staan.
function uitbreidingenOpNaam(kaarten, singles) {
  const namen = new Set(kaarten.map((c) => naamKern(c.name).basis).filter(Boolean));
  if (namen.size < 3) return [];
  const per = new Map();
  for (const p of singles) {
    const b = naamKern(p.name).basis;
    if (!namen.has(b)) continue;
    if (!per.has(p.idExpansion)) per.set(p.idExpansion, new Set());
    per.get(p.idExpansion).add(b);
  }
  const beste = Math.max(0, ...[...per.values()].map((s) => s.size));
  if (beste < Math.max(3, namen.size / 2)) return [];
  return [...per].filter(([, s]) => s.size === beste).map(([e]) => e);
}

// Losse kaart: via de TCGdex-set van de TCGplayer-groep. Kent TCGdex precies één kaart met dit
// nummer en deze naam (en geen variant zoals een stempel), dan is dat product de keuze. Altijd:
// de uitbreiding bij Cardmarket, met alle kaarten van dezelfde naam als kandidaten (een stempel
// of andere variant is daar een eigen versie). TCGdex geeft niet altijd zijn Cardmarket-koppeling
// mee (vanaf de server van de site soms niet bij nieuwe sets); dan de uitbreiding van de
// verzameling, of die met de meeste namen uit de set.
async function kaartOpties(product, { singles, opId }) {
  const naam = naamKern(product.naam);
  if (!naam.basis) return { gekozen: null, ids: [] };
  const sets = await tcgdex("/sets");
  let gekozen = null;
  let uitbreidingen = [];
  let setKaarten = [];
  for (const setId of dexSetsVoorGroep(product.set, sets)) {
    const kaarten = (await tcgdex(`/sets/${encodeURIComponent(setId)}`)).cards ?? [];
    setKaarten.push(...kaarten);
    const zelfde = EIGEN_NUMMERING.has(setId)
      ? opNaam(kaarten, naam.basis)
      : kaarten.filter((c) => nummer(c.localId) === nummer(product.nummer) && naamKern(c.name).basis === naam.basis);
    if (zelfde.length === 1 && !naam.variant) gekozen = (await dexProduct(zelfde[0].id)) ?? null;
    if (gekozen && !opId.has(gekozen)) gekozen = null;
    // De uitbreiding: van de gevonden kaart, anders van een paar andere kaarten uit de set
    for (const c of [...zelfde, ...kaarten.slice(0, 3)]) {
      const exp = opId.get(gekozen ?? (await dexProduct(c.id)))?.idExpansion;
      if (exp) {
        uitbreidingen = [exp];
        break;
      }
    }
    if (uitbreidingen.length) break;
  }
  if (!uitbreidingen.length) {
    const exp = uitbreidingVanGroep(product.groep, opId);
    uitbreidingen = exp ? [exp] : uitbreidingenOpNaam(setKaarten, singles);
  }
  const ids = singles
    .filter((p) => uitbreidingen.includes(p.idExpansion) && naamKern(p.name).basis === naam.basis)
    .map((p) => p.idProduct);
  if (!gekozen && ids.length === 1) gekozen = ids[0];
  if (gekozen && !ids.includes(gekozen)) ids.unshift(gekozen);
  return { gekozen, ids };
}

// Verzegeld product (ETB, booster, tin, ...): op naam, de best passende eerst
function sealedOpties(product, { sealed }) {
  const doel = new Set(woorden(product.naam));
  const gescoord = sealed
    .map((p) => {
      const w = new Set(woorden(p.name));
      const samen = [...doel].filter((x) => w.has(x)).length;
      return [samen / new Set([...doel, ...w]).size, p];
    })
    .filter(([s]) => s >= 0.4)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 6);
  const gekozen = gescoord[0]?.[0] === 1 ? gescoord[0][1].idProduct : null;
  return { gekozen, ids: gescoord.map(([, p]) => p.idProduct) };
}

// Cardmarket-opties bij een product uit de zoeklijst: { gekozen: id | null, kandidaten: [{ id, naam,
// prijs, holo }] }, prijzen in centen (holo: de reverse-holoprijs van een losse kaart, als die er is)
export async function cardmarketOpties(product) {
  const lijsten = await cardmarketLijsten();
  // Een fout (TCGdex even niet bereikbaar) gaat door naar de aanroeper: liever "probeer opnieuw"
  // dan een lege lijst die eruitziet als "staat niet op Cardmarket"
  const opties = product.nummer ? await kaartOpties(product, lijsten) : sealedOpties(product, lijsten);
  const kandidaten = opties.ids.map((id) => {
    const rij = lijsten.prijzen.get(id);
    return {
      id,
      naam: lijsten.opId.get(id)?.name ?? `Product ${id}`,
      prijs: cardmarketPrijs(rij)?.t ?? null,
      holo: product.nummer ? cardmarketPrijs(rij, true)?.t ?? null : null,
    };
  });
  return { gekozen: opties.gekozen, kandidaten };
}
