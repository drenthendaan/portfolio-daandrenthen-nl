import { Invoerfout, leesItems, maakItem, verwijderItem, wijzigItem } from "@/lib/pokemon/items";
import { tokenOk } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const fout = (bericht, status) => Response.json({ error: bericht }, { status, headers: NO_STORE });

// Fouten in de invoer worden een 400 met uitleg, de rest een 502
async function voerUit(actie) {
  try {
    return Response.json(await actie(), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Invoerfout) return fout(e.message, 400);
    return fout("Database niet bereikbaar", 502);
  }
}

async function leesBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export async function GET() {
  return voerUit(async () => (await leesItems()) ?? { items: [], labels: [], versie: null });
}

// Nieuw item: { naam, label, pikachu, aantal, aankoop, waarde, status, product? }
export async function POST(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const body = await leesBody(request);
  if (!body) return fout("Geen geldige JSON", 400);
  return voerUit(() => maakItem(body));
}

// Wijzigen: { id, ...velden }
export async function PATCH(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const body = await leesBody(request);
  if (!body?.id) return fout("Geen item opgegeven", 400);
  const { id, ...rest } = body;
  return voerUit(() => wijzigItem(String(id), rest));
}

export async function DELETE(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fout("Geen item opgegeven", 400);
  return voerUit(() => verwijderItem(id));
}
