// Zelf toegevoegde items (kaarten, ETB's, overig) en eigen labels, in Redis.
// Dit is echte data, net als de vinkjes: dezelfde sleutels lokaal en in productie.
import { randomBytes } from "node:crypto";
import { productOpId } from "./catalogus";
import { bedrag, Invoerfout, nieuweVersie, normaliseerItem as normaliseer, slug, tekst, vrijeId } from "./invoer";
import { cardmarketLijsten } from "./cardmarket";
import { amsterdamDatum } from "./regels.mjs";
import { cardmarketPrijs } from "./tcgdex.mjs";
import { getRedis, ITEMS_KEY, ITEMS_VERSIE_KEY, LABELS_KEY } from "./server";
import { binderVan, geldigeMapcode } from "./binders.mjs";
import { themasVoor } from "./themas.mjs";
import { leesVerzamelingen } from "./verzamelingen";

export { Invoerfout };

export const VASTE_LABELS = [
  { id: "kaarten", naam: "Kaarten", vast: true },
  { id: "etb", naam: "ETB's", vast: true },
  { id: "overig", naam: "Overig", vast: true },
];

export async function leesItems(redis = getRedis({ alleenLezen: true })) {
  if (!redis) return null;
  const [hash, eigen, versie, verzamelingen] = await Promise.all([
    redis.hgetall(ITEMS_KEY),
    redis.get(LABELS_KEY),
    redis.get(ITEMS_VERSIE_KEY),
    leesVerzamelingen(redis),
  ]);
  const items = Object.values(hash ?? {})
    .filter((i) => i && typeof i === "object")
    .map(normaliseer)
    .sort((a, b) => String(a.gemaakt).localeCompare(String(b.gemaakt)));
  return {
    items,
    labels: [...VASTE_LABELS, ...(Array.isArray(eigen) ? eigen : [])],
    verzamelingen,
    versie: versie ?? null,
  };
}

// ---------- Invoer controleren ----------

// Alleen velden die meegestuurd zijn; onbekende velden worden genegeerd
function velden(invoer, { labels, verzamelingen }) {
  const uit = {};
  if ("naam" in invoer) uit.naam = tekst(invoer.naam, "Naam", 120);
  if ("label" in invoer) {
    if (!labels.some((l) => l.id === invoer.label)) throw new Invoerfout("Onbekend label");
    uit.label = invoer.label;
  }
  if ("verzameling" in invoer) {
    const v = invoer.verzameling || null;
    if (v && !verzamelingen.some((x) => x.id === v)) throw new Invoerfout("Onbekende verzameling");
    uit.verzameling = v;
  }
  if ("thema" in invoer) uit.thema = invoer.thema || null;
  if ("map" in invoer) {
    const m = String(invoer.map ?? "").trim();
    if (m && !geldigeMapcode(m)) throw new Invoerfout("Mapcode moet zoiets zijn als 3.5 (pagina 3, vakje 5)");
    uit.map = m || null;
  }
  if ("aantal" in invoer) {
    const n = Number(invoer.aantal);
    if (!Number.isInteger(n) || n < 1 || n > 999) throw new Invoerfout("Aantal moet tussen 1 en 999 liggen");
    uit.aantal = n;
  }
  if ("aankoop" in invoer) uit.aankoop = bedrag(invoer.aankoop, "Aankoopprijs");
  if ("waarde" in invoer) uit.waarde = bedrag(invoer.waarde, "Waarde");
  if ("status" in invoer) {
    const s = invoer.status || {};
    if (typeof s !== "object") throw new Invoerfout("Status klopt niet");
    // Alleen de meegestuurde vinkjes; de rest blijft zoals hij was
    uit.status = Object.fromEntries(["w", "b", "a"].filter((f) => f in s).map((f) => [f, s[f] === true]));
  }
  return uit;
}

// Thema en mapcode horen bij een verzameling; zonder verzameling vallen ze weg.
// Een mapcode moet in de binder van de verzameling passen.
function controleerThema(item, verzamelingen) {
  if (!item.verzameling) return { ...item, thema: null, map: null };
  const v = verzamelingen.find((x) => x.id === item.verzameling);
  if (item.thema && !themasVoor(v).some((t) => t.id === item.thema)) throw new Invoerfout("Onbekend thema");
  const binder = binderVan(v);
  if (item.map && binder && !geldigeMapcode(item.map, binder)) {
    throw new Invoerfout(`Die plek bestaat niet in deze binder (pagina 1–${binder.paginas}, vakje 1–${binder.vakjes})`);
  }
  return item;
}

// ---------- Prijs bij toevoegen ----------

// Het gekozen Cardmarket-product en zijn prijs van vannacht. Een onbekend product is een invoerfout.
async function cardmarketBijToevoegen(cm) {
  const id = Number(cm?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Invoerfout("Kies een Cardmarket-product");
  let lijsten;
  try {
    lijsten = await cardmarketLijsten();
  } catch {
    throw new Invoerfout("Cardmarket is nu niet bereikbaar, probeer het zo nog eens");
  }
  const { opId, prijzen } = lijsten;
  if (!opId.has(id)) throw new Invoerfout("Onbekend Cardmarket-product");
  // Sommige producten hebben alleen een reverse-holoprijs (zoals de Cosmos-varianten)
  const rij = prijzen.get(id);
  const holo = cm.holo === true || (!cardmarketPrijs(rij) && !!cardmarketPrijs(rij, true));
  const p = cardmarketPrijs(rij, holo);
  return { cm: { id, holo }, start: p ? { e: p.t, t: "c", s: p.soort, d: amsterdamDatum(new Date()) } : null };
}

// ---------- Items ----------

export async function maakItem(invoer) {
  const redis = getRedis();
  const context = await leesItems(redis);
  const productId = invoer.product == null ? null : Number(invoer.product);
  const product = productId ? productOpId(productId) : null;
  if (productId && !product) throw new Invoerfout("Onbekend product");

  const v = velden(
    { label: "overig", aantal: 1, status: { a: true }, ...invoer, naam: invoer.naam || product?.naam },
    context
  );
  let item = {
    id: "i" + randomBytes(5).toString("hex"),
    naam: v.naam,
    label: v.label,
    verzameling: v.verzameling ?? null,
    // Zonder gekozen thema: het voorstel uit de catalogus, anders Overig
    thema: v.thema ?? (v.verzameling ? product?.thema ?? (v.label === "etb" ? "etb" : "overig") : null),
    map: v.map ?? null,
    aantal: v.aantal,
    aankoop: v.aankoop ?? null,
    waarde: v.waarde ?? null,
    status: { w: false, b: false, a: false, ...v.status },
    tp: null,
    set: product?.set ?? null,
    nummer: product?.nummer ?? null,
    img: product?.img ?? [],
    start: null,
    gemaakt: new Date().toISOString(),
  };
  item = controleerThema(item, context.verzamelingen);
  // Het product uit de zoeklijst geeft naam, set en plaatje; de prijs komt van Cardmarket. Zonder
  // Cardmarket-product geldt de zelf ingevulde waarde.
  if (product) item.tp = { product: product.product, groep: product.groep };
  if (invoer.cm) Object.assign(item, await cardmarketBijToevoegen(invoer.cm), { waarde: null });
  item.bijgewerkt = item.gemaakt;
  await redis.hset(ITEMS_KEY, { [item.id]: item });
  return { item, versie: await nieuweVersie(redis) };
}

export async function wijzigItem(id, invoer) {
  const redis = getRedis();
  const [context, bestaand] = await Promise.all([leesItems(redis), redis.hget(ITEMS_KEY, id)]);
  if (!bestaand) throw new Invoerfout("Item bestaat niet");
  const v = velden(invoer, context);
  if (bestaand.cm?.id) delete v.waarde; // gekoppelde items volgen de Cardmarket-prijs
  const oud = normaliseer(bestaand);
  if (v.status) v.status = { w: false, b: false, a: false, ...oud.status, ...v.status };
  // Een ander (of eerste) Cardmarket-product: de prijs volgt voortaan dat product
  if (invoer.cm) Object.assign(v, await cardmarketBijToevoegen(invoer.cm), { waarde: null });
  // Naar een andere verzameling zonder nieuw thema: het oude thema geldt daar misschien niet
  if ("verzameling" in v && v.verzameling !== oud.verzameling && !("thema" in v)) v.thema = null;
  const item = controleerThema({ ...oud, ...v, bijgewerkt: new Date().toISOString() }, context.verzamelingen);
  await redis.hset(ITEMS_KEY, { [id]: item });
  return { item, versie: await nieuweVersie(redis) };
}

export async function verwijderItem(id) {
  const redis = getRedis();
  if (!(await redis.hdel(ITEMS_KEY, id))) throw new Invoerfout("Item bestaat niet");
  return { versie: await nieuweVersie(redis) };
}

// ---------- Labels ----------

export async function maakLabel(naam) {
  const redis = getRedis();
  const t = tekst(naam, "Labelnaam", 40);
  const { labels } = await leesItems(redis);
  if (labels.some((l) => l.naam.toLowerCase() === t.toLowerCase())) throw new Invoerfout("Dat label bestaat al");
  const id = vrijeId(slug(t, "label"), (x) => labels.some((l) => l.id === x));
  const label = { id, naam: t };
  await redis.set(LABELS_KEY, [...labels.filter((l) => !l.vast), label]);
  return { label, versie: await nieuweVersie(redis) };
}

export async function verwijderLabel(id) {
  const redis = getRedis();
  const { labels, items } = await leesItems(redis);
  const label = labels.find((l) => l.id === id);
  if (!label || label.vast) throw new Invoerfout("Dit label kan niet weg");
  if (items.some((i) => i.label === id)) throw new Invoerfout("Er staan nog items onder dit label");
  await redis.set(LABELS_KEY, labels.filter((l) => !l.vast && l.id !== id));
  return { versie: await nieuweVersie(redis) };
}
