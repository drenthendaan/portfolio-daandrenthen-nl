import { revalidateTag } from "next/cache";
import { Invoerfout } from "@/lib/pokemon/invoer";
import { zetDrempel } from "@/lib/pokemon/meldingen";
import { STANDAARD_DREMPEL } from "@/lib/pokemon/regels.mjs";
import { leesMeldingen, MELDING_TAG, tokenOk } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const fout = (bericht, status) => Response.json({ error: bericht }, { status, headers: NO_STORE });

// De laatste prijsmeldingen en de drempel. Komt uit de servercache; nieuw na een verversing.
export async function GET() {
  try {
    const data = await leesMeldingen();
    return Response.json(data ?? { meldingen: [], drempel: STANDAARD_DREMPEL }, { headers: NO_STORE });
  } catch {
    return fout("Database niet bereikbaar", 502);
  }
}

// Drempel aanpassen: { procent, minimum (in euro) }
export async function PATCH(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const body = await request.json().catch(() => null);
  try {
    const uitkomst = await zetDrempel(body);
    revalidateTag(MELDING_TAG);
    return Response.json(uitkomst, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Invoerfout) return fout(e.message, 400);
    return fout("Database niet bereikbaar", 502);
  }
}
