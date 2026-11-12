import { getRedis, VERSIE_KEY } from "@/lib/roadtrip/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Klein en vaak opgevraagd: alleen de versiestempel, zodat de browser weet wanneer
// hij de zware lijst opnieuw moet ophalen.
export async function GET() {
  try {
    const redis = getRedis({ alleenLezen: true });
    if (!redis) return Response.json({ error: "Geen database ingesteld" }, { status: 503, headers: NO_STORE });
    return Response.json({ versie: (await redis.get(VERSIE_KEY)) ?? null }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "Database niet bereikbaar" }, { status: 502, headers: NO_STORE });
  }
}
