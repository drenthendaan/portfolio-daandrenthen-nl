import { Invoerfout } from "@/lib/pokemon/invoer";
import { tokenOk } from "@/lib/pokemon/server";
import { maakVerzameling, verwijderVerzameling, wijzigVerzameling } from "@/lib/pokemon/verzamelingen";

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

// Nieuwe (lege) verzameling: { naam }
export async function POST(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const body = await request.json().catch(() => null);
  return voerUit(() => maakVerzameling(body?.naam));
}

// Wijzigen: { id, naam } | { id, nieuwThema } | { id, verwijderThema } | { id, verberg } | { id, toon }
export async function PATCH(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const body = await request.json().catch(() => null);
  if (!body?.id) return fout("Geen verzameling opgegeven", 400);
  const { id, ...rest } = body;
  return voerUit(() => wijzigVerzameling(String(id), rest));
}

// Verzameling weg; items blijven bestaan zonder verzameling
export async function DELETE(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fout("Geen verzameling opgegeven", 400);
  return voerUit(() => verwijderVerzameling(id));
}
