import { getRedis, ITEMS_VERSIE_KEY, leesPrijsData } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Klein en vaak opgevraagd: de prijsversie en de itemsversie, zodat de browser weet wanneer hij
// meer moet ophalen.
export async function GET() {
  try {
    const redis = getRedis({ alleenLezen: true });
    if (!redis) return Response.json({ error: "Geen database ingesteld" }, { status: 503, headers: NO_STORE });
    const [prijsData, itemsVersie] = await Promise.all([leesPrijsData(), redis.get(ITEMS_VERSIE_KEY)]);
    return Response.json(
      { versie: prijsData?.versie ?? null, itemsVersie: itemsVersie ?? null },
      { headers: NO_STORE }
    );
  } catch {
    return Response.json({ error: "Database niet bereikbaar" }, { status: 502, headers: NO_STORE });
  }
}
