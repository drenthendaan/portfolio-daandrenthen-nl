import { Invoerfout } from "@/lib/pokemon/invoer";
import { bewaarAbonnement, stuurTestmelding, vapidSleutels, verwijderAbonnement } from "@/lib/pokemon/push";
import { getRedis, tokenOk } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const fout = (bericht, status) => Response.json({ error: bericht }, { status, headers: NO_STORE });

async function voerUit(actie) {
  try {
    return Response.json(await actie(), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Invoerfout) return fout(e.message, 400);
    return fout("Database of pushdienst niet bereikbaar", 502);
  }
}

// Publieke sleutel waarmee de browser zich aanmeldt voor pushmeldingen
export async function GET() {
  const redis = getRedis();
  if (!redis) return fout("Geen database ingesteld", 503);
  return voerUit(async () => ({ sleutel: (await vapidSleutels(redis)).publicKey }));
}

// Aanmelden: { abonnement, apparaat } · testmelding naar dit apparaat: ?test=1 met { endpoint }
export async function POST(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const body = await request.json().catch(() => null);
  if (new URL(request.url).searchParams.has("test")) return voerUit(() => stuurTestmelding(body?.endpoint));
  return voerUit(() => bewaarAbonnement(body?.abonnement, body?.apparaat));
}

// Afmelden: { endpoint }
export async function DELETE(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) return fout("Ongeldige token", 401);
  const body = await request.json().catch(() => null);
  return voerUit(() => verwijderAbonnement(body?.endpoint));
}
