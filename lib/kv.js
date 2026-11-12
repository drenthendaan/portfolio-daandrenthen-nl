// Redis-verbinding en tokenvergelijking. Gedeeld door /pokemon en /roadtrip.
// Alleen op de server: niet importeren vanuit client components.
import { createHash, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";

// Geeft null als de omgevingsvariabelen ontbreken, zodat elke aanroeper zelf kan
// besluiten wat er dan gebeurt (meestal: lege data tonen in plaats van omvallen).
// alleenLezen is een vangnet: met een read-only token kan een leesactie nooit schrijven.
export function getRedis({ alleenLezen = false } = {}) {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    (alleenLezen && process.env.KV_REST_API_READ_ONLY_TOKEN) ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

// Eerst hashen, zodat timingSafeEqual altijd twee even lange buffers krijgt
export function gelijk(gegeven, verwacht) {
  if (!verwacht || !gegeven) return false;
  const a = createHash("sha256").update(gegeven).digest();
  const b = createHash("sha256").update(verwacht).digest();
  return timingSafeEqual(a, b);
}
