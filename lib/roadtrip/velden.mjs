// Kleine controleurs die een Invoerfout gooien. Gedeeld door reizen.js en stops.js.
import { Invoerfout, tekst } from "../invoer.mjs";

export function getal(v, veld, { min = 0, max = 1_000_000, heel = true } = {}) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw new Invoerfout(`${veld} klopt niet`);
  return heel ? Math.round(n) : n;
}

// Een vinkje komt als boolean binnen, maar uit een <select> als "ja" of "nee".
// Leeg betekent nee: niets ingevuld is niet betaald.
export function jaNee(v, veld) {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "boolean") return v;
  const t = String(v).trim().toLowerCase();
  if (t === "ja" || t === "true" || t === "1") return true;
  if (t === "nee" || t === "false" || t === "0") return false;
  throw new Invoerfout(`${veld} moet ja of nee zijn`);
}

export function keuze(v, veld, toegestaan) {
  const t = String(v ?? "").trim();
  if (!toegestaan.includes(t)) throw new Invoerfout(`${veld} moet een van ${toegestaan.join(", ")} zijn`);
  return t;
}

// yyyy-mm-dd, en de datum moet echt bestaan (2027-02-30 niet)
export function datum(v, veld) {
  if (v === null || v === undefined || v === "") return null;
  const t = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Invoerfout(`${veld} moet jjjj-mm-dd zijn`);
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) {
    throw new Invoerfout(`${veld} bestaat niet`);
  }
  return t;
}

export function losseTekst(v, veld, max) {
  if (v === null || v === undefined || v === "") return null;
  const t = String(v).trim();
  if (t.length > max) throw new Invoerfout(`${veld} is te lang`);
  return t || null;
}

// Alleen http(s), zodat er geen javascript: in een href kan belanden
export function koppeling(v, veld) {
  const t = losseTekst(v, veld, 500);
  if (t === null) return null;
  let url;
  try {
    url = new URL(t);
  } catch {
    throw new Invoerfout(`${veld} is geen geldig adres`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Invoerfout(`${veld} moet met http of https beginnen`);
  }
  return url.toString();
}

// Hoeveel je er per stop kwijt kunt. Ruim genoeg voor een week ter plaatse,
// en een grens zodat één stop de hash niet kan laten ontploffen.
export const MAX_ACTIVITEITEN = 20;

/**
 * Wat je bij een stop wilt gaan doen. Elke activiteit moet een plek hebben,
 * want anders valt er niets te tekenen en geen afstand te berekenen — vandaar
 * dat lat en lon verplicht zijn en een activiteit zonder plek wordt geweigerd.
 */
export function activiteiten(v, veld) {
  if (v === null || v === undefined || v === "") return null;
  if (!Array.isArray(v)) throw new Invoerfout(`${veld} klopt niet`);
  if (v.length > MAX_ACTIVITEITEN) {
    throw new Invoerfout(`${veld}: hoogstens ${MAX_ACTIVITEITEN} per stop`);
  }

  const uit = v.map((a, i) => {
    const waar = `${veld} ${i + 1}`;
    if (!a || typeof a !== "object") throw new Invoerfout(`${waar} klopt niet`);

    // plek() doet de coördinaten al, inclusief grenzen; alleen de naam is hier
    // verplicht waar hij daar optioneel is.
    const waar_op_kaart = plek({ lat: a.lat, lon: a.lon }, waar);
    if (!waar_op_kaart) throw new Invoerfout(`${waar} heeft geen plek op de kaart`);

    return {
      naam: tekst(a.naam, `${waar}: naam`, 80),
      lat: waar_op_kaart.lat,
      lon: waar_op_kaart.lon,
      adres: losseTekst(a.adres, `${waar}: adres`, 200),
      link: koppeling(a.link, `${waar}: link`),
    };
  });

  return uit.length ? uit : null;
}

// { lengte, hoogte, gewicht } in centimeters en kilo's; leeg veld blijft null
export function afmetingen(v, veld) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") throw new Invoerfout(`${veld} klopt niet`);
  const uit = {
    lengte: getal(v.lengte, `${veld}: lengte`, { max: 2000 }),
    hoogte: getal(v.hoogte, `${veld}: hoogte`, { max: 800 }),
    gewicht: getal(v.gewicht, `${veld}: gewicht`, { max: 40_000 }),
  };
  return uit.lengte === null && uit.hoogte === null && uit.gewicht === null ? null : uit;
}

// Een plek op de kaart: { naam, lat, lon }. Zonder coördinaten kan hij niet op
// de kaart en valt er geen rit vanaf te rekenen, dus die zijn verplicht.
export function plek(v, veld) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") throw new Invoerfout(`${veld} klopt niet`);
  const lat = getal(v.lat, `${veld}: breedtegraad`, { min: -90, max: 90, heel: false });
  const lon = getal(v.lon, `${veld}: lengtegraad`, { min: -180, max: 180, heel: false });
  if (lat === null || lon === null) throw new Invoerfout(`${veld} heeft coördinaten nodig`);
  return { naam: losseTekst(v.naam, `${veld}: naam`, 120) ?? "Start", lat, lon };
}
