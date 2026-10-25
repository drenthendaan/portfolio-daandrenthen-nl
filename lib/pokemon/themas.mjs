// Thema's binnen een verzameling (de categorieën bovenaan de lijst). Pure functies,
// bruikbaar op de server, in de browser en in `node --test`.

// Tijdperken op uitgavedatum van de set (tot = eerste dag van het volgende tijdperk),
// gevolgd door ETB's en Overig. Namen gelijk aan de secties van de Pikachu-verzameling.
export const STANDAARD_THEMAS = [
  { id: "wizards", naam: "Wizards-tijdperk (1999–2003)", kort: "Wizards", tot: "2003-06-01" },
  { id: "ex", naam: "EX-tijdperk (2003–2007)", kort: "EX", tot: "2007-05-01" },
  { id: "dp", naam: "Diamond & Pearl en HeartGold SoulSilver (2007–2011)", kort: "DP & HGSS", tot: "2011-04-01" },
  { id: "bwxy", naam: "Black & White en XY (2011–2016)", kort: "BW & XY", tot: "2017-02-01" },
  { id: "sm", naam: "Sun & Moon (2017–2019)", kort: "Sun & Moon", tot: "2020-02-01" },
  { id: "swsh", naam: "Sword & Shield (2020–2023)", kort: "Sword & Shield", tot: "2023-03-25" },
  { id: "sv", naam: "Scarlet & Violet (2023–2025)", kort: "Scarlet & Violet", tot: "2025-09-20" },
  { id: "me", naam: "Mega Evolution (2025–)", kort: "Mega Evolution", tot: null },
  { id: "etb", naam: "ETB's", kort: "ETB's" },
  { id: "overig", naam: "Overig", kort: "Overig" },
];

// Alleen in de Pikachu-verzameling
export const PIKACHU_THEMAS = [{ id: "topstukken", naam: "Topstukken (€200+)", kort: "Topstukken" }];

// Secties uit de Pikachu-JSON → thema
export const SECTIE_THEMA = {
  1: "wizards",
  2: "ex",
  3: "dp",
  4: "bwxy",
  5: "sm",
  6: "swsh",
  7: "sv",
  8: "me",
  9: "topstukken",
};

const TIJDPERKEN = STANDAARD_THEMAS.filter((t) => "tot" in t);

// TCGplayer-groepen met kaarten uit allerlei jaren: hun datum zegt niets over de kaart
const VERZAMELGROEP =
  /Miscellaneous|Deck Exclusives|League & Championship|World Championship Decks|Prize Pack|Pikachu World Collection|Southeast Asia/i;

// "2016-11-02" (of een langere ISO-datum) → tijdperk-id
export function tijdperkVoorDatum(datum) {
  const d = String(datum || "").slice(0, 10);
  if (!d) return null;
  return (TIJDPERKEN.find((t) => t.tot && d < t.tot) ?? TIJDPERKEN.at(-1)).id;
}

// Voorstel voor het thema van een TCGplayer-product
export function themaVoorProduct({ naam = "", nummer = "", set = "", uitgave = "" }) {
  if (/elite trainer box/i.test(naam)) return "etb";
  if (!nummer || VERZAMELGROEP.test(set)) return "overig";
  return tijdperkVoorDatum(uitgave) ?? "overig";
}

// Alle thema's van een verzameling, in de volgorde van de tabbladen
export function themasVoor(verzameling) {
  const eigen = verzameling?.themas ?? [];
  if (verzameling?.id === "pikachu") {
    const tijdperken = STANDAARD_THEMAS.filter((t) => "tot" in t);
    const rest = STANDAARD_THEMAS.filter((t) => !("tot" in t));
    return [...tijdperken, ...PIKACHU_THEMAS, ...rest, ...eigen];
  }
  return [...STANDAARD_THEMAS, ...eigen];
}
