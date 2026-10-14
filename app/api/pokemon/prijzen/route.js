import { leesPrijsData } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

// Prijzen, meta en geschiedenis. Komt uit de servercache; alleen nieuw na een verversing.
export async function GET() {
  try {
    const data = await leesPrijsData();
    return Response.json(data ?? { versie: null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Database niet bereikbaar" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
