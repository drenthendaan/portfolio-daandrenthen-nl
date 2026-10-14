import { createHash, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import { SEED, cleanStatus } from "@/lib/pikachu";

export const dynamic = "force-dynamic";

// Eén Redis-hash: veld = kaart-id, waarde = { w, b, o, a }.
// Per kaart opslaan voorkomt dat telefoon en laptop elkaars wijzigingen overschrijven.
const KEY = "pikachu:status";
const NO_STORE = { "Cache-Control": "no-store" };

function getRedis() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

function tokenOk(given) {
  const expected = process.env.PIKACHU_TOKEN;
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return Response.json(
      { error: "Geen database ingesteld" },
      { status: 503, headers: NO_STORE }
    );
  }
  try {
    const stored = (await redis.hgetall(KEY)) ?? {};
    return Response.json(
      { status: { ...SEED, ...(cleanStatus(stored) ?? {}) } },
      { headers: NO_STORE }
    );
  } catch {
    return Response.json(
      { error: "Database niet bereikbaar" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function PUT(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) {
    return Response.json({ error: "Ongeldige token" }, { status: 401 });
  }
  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: "Geen database ingesteld" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geen geldige JSON" }, { status: 400 });
  }
  const status = cleanStatus(body?.status);
  if (!status || !Object.keys(status).length) {
    return Response.json({ error: "Ongeldige statussen" }, { status: 400 });
  }

  try {
    await redis.hset(KEY, status);
    const updatedAt = new Date().toISOString();
    await redis.set(`${KEY}:updatedAt`, updatedAt);
    return Response.json({ ok: true, saved: Object.keys(status).length, updatedAt });
  } catch {
    return Response.json({ error: "Database niet bereikbaar" }, { status: 502 });
  }
}
