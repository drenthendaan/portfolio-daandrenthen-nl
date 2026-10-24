// Hulpjes voor items en verzamelingen: invoer controleren en de versie ophogen.
import { ITEMS_VERSIE_KEY } from "./server";

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

// Eén versie voor items, labels en verzamelingen: open pagina's halen alles opnieuw op
export async function nieuweVersie(redis) {
  const versie = new Date().toISOString();
  await redis.set(ITEMS_VERSIE_KEY, versie);
  return versie;
}

// Oudere items hadden alleen "pikachu: true/false". Een item met een TCGplayer-product maar
// zonder plaatje (TCGplayer had er bij het toevoegen nog geen) probeert alsnog dat van TCGplayer.
export function normaliseerItem(item) {
  const { pikachu, ...rest } = item;
  return {
    ...rest,
    verzameling: rest.verzameling !== undefined ? rest.verzameling : pikachu ? "pikachu" : null,
    thema: rest.thema ?? null,
    map: rest.map ?? null,
    img: rest.img?.length ? rest.img : rest.tp?.product ? [`t:${rest.tp.product}`] : [],
  };
}
