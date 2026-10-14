import { cleanStatus } from "@/lib/pikachu";
import { getRedis, leesStatus, STATUS_KEY, tokenOk } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

// Eén Redis-hash: veld = kaart-id, waarde = { w, b, o, a }.
// Per kaart opslaan voorkomt dat telefoon en laptop elkaars wijzigingen overschrijven.
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const status = await leesStatus();
    if (!status) {
      return Response.json(
        { error: "Geen database ingesteld" },
        { status: 503, headers: NO_STORE }
      );
    }
    return Response.json({ status }, { headers: NO_STORE });
  } catch {
    return Response.json(
      { error: "Database niet bereikbaar" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function PUT(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) {
    return Response.json({ error: "Ongeldige token" }, { status: 401 });
  }
  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: "Geen database ingesteld" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geen geldige JSON" }, { status: 400 });
  }
  const status = cleanStatus(body?.status);
  if (!status || !Object.keys(status).length) {
    return Response.json({ error: "Ongeldige statussen" }, { status: 400 });
  }

  try {
    await redis.hset(STATUS_KEY, status);
    const updatedAt = new Date().toISOString();
    await redis.set(`${STATUS_KEY}:updatedAt`, updatedAt);
    return Response.json({ ok: true, saved: Object.keys(status).length, updatedAt });
  } catch {
    return Response.json({ error: "Database niet bereikbaar" }, { status: 502 });
  }
}
