// Invoer controleren en ids maken. Gedeeld door /pokemon en /roadtrip.

export class Invoerfout extends Error {}

// "60,50" / "€ 60.50" / 60.5 → 6050 centen; leeg → null
export function bedrag(v, veld) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s|€/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new Invoerfout(`${veld} klopt niet`);
  return Math.round(n * 100);
}

export function tekst(v, veld, max) {
  const t = String(v ?? "").trim();
  if (!t || t.length > max) throw new Invoerfout(`${veld} is leeg of te lang`);
  return t;
}

export const slug = (naam, standaard = "x") =>
  String(naam)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || standaard;

// Eerste vrije id: "eevee", "eevee-2", …
export function vrijeId(basis, bezet) {
  let id = basis;
  for (let i = 2; bezet(id); i++) id = `${basis}-${i}`;
  return id;
}

// Elke schrijfactie zet een nieuwe ISO-tijd op de versiesleutel van die sectie.
// ISO-tijden sorteren alfabetisch, dus "nieuwer" is gewoon a > b.
export async function nieuweVersie(redis, sleutel) {
  const versie = new Date().toISOString();
  await redis.set(sleutel, versie);
  return versie;
}
