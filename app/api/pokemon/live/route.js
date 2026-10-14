import { naarBits } from "@/lib/pokemon/regels.mjs";
import { leesPrijsData, leesStatus } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

// Klein en vaak opgevraagd: de vinkjes als bits (alleen kaarten met iets aan) en de
// prijsversie, zodat de browser weet wanneer hij nieuwe prijzen moet ophalen.
export async function GET() {
  try {
    const [status, prijsData] = await Promise.all([leesStatus(), leesPrijsData()]);
    if (!status) {
      return Response.json({ error: "Geen database ingesteld" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const bits = {};
    for (const [id, v] of Object.entries(status)) {
      const b = naarBits(v);
      if (b) bits[id] = b;
    }
    return Response.json(
      { status: bits, versie: prijsData?.versie ?? null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json({ error: "Database niet bereikbaar" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
