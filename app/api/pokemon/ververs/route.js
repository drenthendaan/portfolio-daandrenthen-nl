import { ververs } from "@/lib/pokemon/ververs";
import { cronOk, getRedis, SLEUTEL, tokenOk } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

// Vercel Cron (dagelijks, zie vercel.json)
export async function GET(request) {
  if (!cronOk(request.headers.get("authorization"))) {
    return Response.json({ error: "Niet toegestaan" }, { status: 401, headers: NO_STORE });
  }
  const uitkomst = await ververs({ bron: "cron" });
  return Response.json(uitkomst, { status: uitkomst.ok ? 200 : 500, headers: NO_STORE });
}

// Knop "Nu verversen": alleen met token, en hooguit één keer per kwartier
export async function POST(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) {
    return Response.json({ error: "Ongeldige token" }, { status: 401, headers: NO_STORE });
  }
  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: "Geen database ingesteld" }, { status: 503, headers: NO_STORE });
  }
  if (!(await redis.set(SLEUTEL.handmatig, 1, { nx: true, ex: 900 }))) {
    const over = await redis.ttl(SLEUTEL.handmatig);
    return Response.json(
      { error: "Net al ververst", wachtSeconden: over },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.max(over, 1)) } }
    );
  }
  const uitkomst = await ververs({ bron: "handmatig" });
  return Response.json(uitkomst, { status: uitkomst.ok ? 200 : 500, headers: NO_STORE });
}
