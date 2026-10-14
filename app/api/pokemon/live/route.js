import { naarBits } from "@/lib/pokemon/regels.mjs";
import { getRedis, ITEMS_VERSIE_KEY, leesPrijsData, leesStatus } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Klein en vaak opgevraagd: de vinkjes als bits (alleen kaarten met iets aan), de
// prijsversie en de itemsversie, zodat de browser weet wanneer hij meer moet ophalen.
export async function GET() {
  try {
    const redis = getRedis({ alleenLezen: true });
    if (!redis) return Response.json({ error: "Geen database ingesteld" }, { status: 503, headers: NO_STORE });
    const [status, prijsData, itemsVersie] = await Promise.all([
      leesStatus(redis),
      leesPrijsData(),
      redis.get(ITEMS_VERSIE_KEY),
    ]);
    const bits = {};
    for (const [id, v] of Object.entries(status)) {
      const b = naarBits(v);
      if (b) bits[id] = b;
    }
    return Response.json(
      { status: bits, versie: prijsData?.versie ?? null, itemsVersie: itemsVersie ?? null },
      { headers: NO_STORE }
    );
  } catch {
    return Response.json({ error: "Database niet bereikbaar" }, { status: 502, headers: NO_STORE });
  }
}
