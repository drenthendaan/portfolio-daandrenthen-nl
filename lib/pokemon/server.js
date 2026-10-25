// Alles wat alleen op de server mag draaien: Redis, sleutels, autorisatie en het
// (gecachete) lezen van prijzen. Niet importeren vanuit client components.
import { createHash, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import { unstable_cache } from "next/cache";
import { SEED, cleanStatus } from "@/lib/pikachu";
import { bouwReeks, STANDAARD_DREMPEL } from "./regels.mjs";

export const STATUS_KEY = "pikachu:status";
// Zelf toegevoegde items en labels (zie items.js)
export const ITEMS_KEY = "pokemon:items";
export const LABELS_KEY = "pokemon:labels";
export const ITEMS_VERSIE_KEY = "pokemon:items:versie";
export const VERZAMELINGEN_KEY = "pokemon:verzamelingen";
// Drempel voor prijsmeldingen: geldt overal, net als de vinkjes (zie meldingen.js)
export const MELDINGEN_INSTELLINGEN_KEY = "pokemon:meldingen:instellingen";

// Productie en lokaal/preview hebben elk hun eigen prijsgeschiedenis
const P = process.env.VERCEL_ENV === "production" ? "pk:" : "pk-dev:";
export const SLEUTEL = {
  prijzen: P + "prijzen",
  meta: P + "meta",
  dag: (d) => `${P}dag:${d}`,
  slot: P + "slot",
  handmatig: P + "handmatig",
  meldingen: P + "meldingen", // de laatste prijsmeldingen
  push: P + "push", // apparaten met pushmeldingen aan
  vapid: P + "vapid", // sleutelpaar voor pushmeldingen, als het niet in de env staat
};
export const PRIJS_TAG = "pokemon-prijzen";
export const MELDING_TAG = "pokemon-meldingen";
const REEKS_DAGEN = 90;

export function getRedis({ alleenLezen = false } = {}) {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    (alleenLezen && process.env.KV_REST_API_READ_ONLY_TOKEN) ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

function gelijk(gegeven, verwacht) {
  if (!verwacht || !gegeven) return false;
  const a = createHash("sha256").update(gegeven).digest();
  const b = createHash("sha256").update(verwacht).digest();
  return timingSafeEqual(a, b);
}
export const tokenOk = (gegeven) => gelijk(gegeven, process.env.PIKACHU_TOKEN);
export const cronOk = (autorisatie) =>
  !!process.env.CRON_SECRET && gelijk(autorisatie, `Bearer ${process.env.CRON_SECRET}`);

// Statussen: de startstand uit de JSON, met daaroverheen wat in Redis staat
export async function leesStatus(redis = getRedis({ alleenLezen: true })) {
  if (!redis) return null;
  const opgeslagen = (await redis.hgetall(STATUS_KEY)) ?? {};
  return { ...SEED, ...(cleanStatus(opgeslagen) ?? {}) };
}

function dagenTussen(van, tot) {
  const uit = [];
  if (!van || !tot) return uit;
  const d = new Date(van + "T12:00:00Z");
  const eind = new Date(tot + "T12:00:00Z");
  while (d <= eind) {
    uit.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return uit;
}

// Wat de browser van een run mag zien
export function publiekeMeta(meta) {
  if (!meta) return null;
  const { versie, dag, status, bron, duurMs, tellingen, tijd, cardmarket, reeksVanaf } = meta;
  return {
    versie,
    dag,
    status,
    bron,
    duurMs,
    tellingen,
    tijd,
    reeksVanaf: reeksVanaf ?? null,
    cardmarket: cardmarket ? { versie: cardmarket.versie, dag: cardmarket.dag } : null,
  };
}

// Laatste prijzen, meta en de geschiedenis van de laatste 90 dagen. Gecachet tot de
// verversing `revalidateTag(PRIJS_TAG)` aanroept; null zolang er nog nooit is ververst. De
// geschiedenis begint bij `reeksVanaf`: de dag van de overstap naar Cardmarket-prijzen.
export const leesPrijsData = unstable_cache(
  async () => {
    const redis = getRedis({ alleenLezen: true });
    if (!redis) return null;
    const [prijzen, meta] = await Promise.all([redis.get(SLEUTEL.prijzen), redis.get(SLEUTEL.meta)]);
    if (!prijzen || !meta?.versie) return null;
    const dagen = dagenTussen(meta.reeksVanaf ?? meta.eersteDag, meta.dag).slice(-REEKS_DAGEN);
    const snaps = dagen.length ? await redis.mget(...dagen.map(SLEUTEL.dag)) : [];
    const snapshots = {};
    dagen.forEach((d, i) => {
      if (snaps[i] && typeof snaps[i] === "object") snapshots[d] = snaps[i];
    });
    const bestaand = dagen.filter((d) => snapshots[d]);
    return {
      versie: meta.versie,
      meta: publiekeMeta(meta),
      prijzen,
      reeks: {
        dagen: bestaand,
        geschat: meta.reeksVanaf ? [] : (meta.geschat ?? []).filter((d) => bestaand.includes(d)),
        kaarten: bouwReeks(bestaand, snapshots),
      },
    };
  },
  ["pokemon-prijzen-v1"],
  { tags: [PRIJS_TAG], revalidate: 3600 }
);

// Drempel voor prijsmeldingen, met de standaard (≥ 10 % én ≥ € 1) als er niets is ingesteld
export async function leesDrempel(redis) {
  const d = await redis.get(MELDINGEN_INSTELLINGEN_KEY);
  return {
    procent: d?.procent > 0 ? d.procent : STANDAARD_DREMPEL.procent,
    minimum: d?.minimum >= 0 ? d.minimum : STANDAARD_DREMPEL.minimum,
  };
}

// De laatste 100 prijsmeldingen en de drempel. Gecachet; nieuw na een verversing en als de
// drempel verandert.
export const leesMeldingen = unstable_cache(
  async () => {
    const redis = getRedis({ alleenLezen: true });
    if (!redis) return null;
    const [lijst, drempel] = await Promise.all([redis.get(SLEUTEL.meldingen), leesDrempel(redis)]);
    return { meldingen: Array.isArray(lijst) ? lijst.slice(0, 100) : [], drempel };
  },
  ["pokemon-meldingen-v1"],
  { tags: [PRIJS_TAG, MELDING_TAG], revalidate: 3600 }
);
