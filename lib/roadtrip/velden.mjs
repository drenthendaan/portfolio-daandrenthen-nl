// Kleine controleurs die een Invoerfout gooien. Gedeeld door reizen.js en stops.js.
import { Invoerfout } from "../invoer.mjs";

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
