import { Invoerfout, maakLabel, verwijderLabel } from "@/lib/pokemon/items";
import { tokenOk } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const fout = (bericht, status) => Response.json({ error: bericht }, { status, headers: NO_STORE });

async function voerUit(actie) {
  try {
    return Response.json(await actie(), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Invoerfout) return fout(e.message, 400);
    return fout("Database niet bereikbaar", 502);
  }
}

// Nieuw eigen label: { naam }
export async function POST(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const body = await request.json().catch(() => null);
  return voerUit(() => maakLabel(body?.naam));
}

// Eigen label weghalen (alleen als er geen items meer onder staan)
export async function DELETE(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const id = new URL(request.url).searchParams.get("id");
  return voerUit(() => verwijderLabel(id));
}
