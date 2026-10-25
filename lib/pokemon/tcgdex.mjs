// Koppeling tussen TCGplayer (tcgcsv) en TCGdex, en via TCGdex aan een Cardmarket-product.
// Gedeeld door het koppelscript (scripts/pokemon) en de server; geen afhankelijkheden.

const zonderAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const woorden = (s) =>
  zonderAccent(String(s ?? ""))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

// "092/128" → "92", "XY174" → "XY174", "RC29/RC32" → "RC29", "TG05" → "TG5"
export function nummer(s) {
  const kop = String(s || "").split("/")[0].replace(/\s+/g, "").toUpperCase();
  const m = kop.match(/^([A-Z]*)0*(\d+)([A-Z]?)$/);
  return m ? m[1] + m[2] + m[3] : kop;
}

// Setnaam zonder TCGplayer-voorvoegsel ("SV02:", "SWSH:", "XY -")
export const kern = (n) =>
  woorden(String(n ?? "").replace(/^[A-Z]{1,6}\d{0,3}(\.\d+)?:\s*/, "").replace(/^(XY|SM|BW|DP|HGSS|EX)\s+-\s+/, "")).join("");

// TCGplayer-groepen die bij TCGdex anders heten (sleutel: kern van de TCGplayer-naam). Een
// trainer kit staat bij TCGdex als twee halve decks; dan wordt in allebei gezocht.
export const DEX_SET_ALIAS = {
  scarletandviolet151: "sv03.5",
  expedition: "ecard1",
  rumble: "ru1",
  extrainerkit1latiasandlatios: ["tk-ex-latia", "tk-ex-latio"],
  hgsstrainerkitgyaradosandraichu: ["tk-hs-r", "tk-hs-g"],
  smtrainerkitlycanrocandalolanraichu: ["tk-sm-r", "tk-sm-l"],
  wotcpromo: "basep",
  nintendopromos: "np",
  diamondandpearlpromos: "dpp",
  hgsspromos: "hgssp",
  blackandwhitepromos: "bwp",
  xypromos: "xyp",
  smpromos: "smp",
  swordandshieldpromocards: "swshp",
  scarletandvioletpromocards: "svp",
  megaevolutionpromo: "mep",
  "30thcelebrationclassiccollection": "30th-c",
  generationsradiantcollection: "g1",
  legendarytreasuresradiantcollection: "bw11",
  exlegendmaker: "ex12",
  exholonphantoms: "ex13",
  mcdonaldspromos2011: "2011bw",
  mcdonaldspromos2012: "2012bw",
  mcdonaldspromos2014: "2014xy",
  mcdonaldspromos2015: "2015xy",
  mcdonaldspromos2016: "2016xy",
  mcdonaldspromos2017: "2017sm",
  mcdonaldspromos2018: "2018sm",
  mcdonaldspromos2019: "2019sm",
  mcdonalds25thanniversarypromos: "2021swsh",
  mcdonaldspromos2022: "2022swsh",
  mcdonaldspromos2023: "2023sv",
  mcdonaldspromos2024: "2024sv",
};

// Sets die anders nummeren dan TCGplayer (de Classic Collections): daar op naam koppelen
export const EIGEN_NUMMERING = new Set(["cel25cc", "30th-c"]);

// TCGdex-set-ids bij een TCGplayer-groepnaam. dexSets: [{ id, name }] van /v2/en/sets.
// EX-sets heten bij TCGplayer "EX Sandstorm", bij TCGdex "Sandstorm".
export function dexSetsVoorGroep(groepNaam, dexSets) {
  const k = kern(groepNaam);
  if (!k) return [];
  if (DEX_SET_ALIAS[k]) return [DEX_SET_ALIAS[k]].flat();
  const opNaam = (x) => dexSets.find((s) => kern(s.name) === x)?.id;
  const id = opNaam(k) ?? (k.startsWith("ex") ? opNaam(k.slice(2)) : undefined);
  return id ? [id] : [];
}

// Naam zonder nummer en varianten: "Umbreon ex - 092/128" → "umbreonex",
// "Pikachu (Winner)" → { basis: "pikachu", variant: true }. "Secret" en "Full Art" zijn geen
// aparte producten: die horen bij het kaartnummer.
const GEEN_VARIANT = /^(secret|full art)$/i;
export function naamKern(naam) {
  let variant = false;
  const rest = String(naam ?? "")
    .replace(/[([]([^)\]]*)[)\]]/g, (_, inhoud) => {
      if (!GEEN_VARIANT.test(inhoud.trim())) variant = true;
      return " ";
    })
    .split(/\s+-\s+/)[0];
  return { basis: woorden(rest).join(""), variant };
}

// Kaarten (van TCGdex) met dezelfde naam. Zonder exacte treffer mag de naam bij TCGdex korter zijn
// ("Palkia" voor "Palkia LV.X"); de aanroeper eist daarna dat er precies één over is.
export function opNaam(kaarten, basis) {
  const exact = kaarten.filter((c) => naamKern(c.name).basis === basis);
  if (exact.length) return exact;
  return kaarten.filter((c) => {
    const b = naamKern(c.name).basis;
    return b && (basis.startsWith(b) || b.startsWith(basis));
  });
}

// Cardmarket-prijs uit TCGdex (pricing.cardmarket) of uit de prijslijst van Cardmarket zelf
// (price_guide_6.json): de "Price Trend" (trend), en zonder trend het gemiddelde van 30 dagen
// (avg30). Nooit de laagste prijs (low): die is vaak van een beschadigde of nepkaart. Voor de
// gewone of de reverse-holo-versie; bedragen in centen.
export function cardmarketPrijs(rij, holo = false) {
  if (!rij) return null;
  const s = holo ? "-holo" : "";
  const cent = (v) => (typeof v === "number" && v > 0 ? Math.round(v * 100) : null);
  const trend = cent(rij["trend" + s]);
  const a30 = cent(rij["avg30" + s]);
  const t = trend ?? a30;
  return t ? { t, soort: trend ? "trend" : "avg30", a7: cent(rij["avg7" + s]), a30 } : null;
}
