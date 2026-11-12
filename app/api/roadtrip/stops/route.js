import { fout, leesBody, magSchrijven, queryParam, voerUit } from "@/lib/roadtrip/api";
import { leesStops, maakStop, verwijderStop, wijzigStop } from "@/lib/roadtrip/stops";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const reis = queryParam(request, "reis");
  return voerUit(async () => ({ stops: (await leesStops(reis)) ?? [] }));
}

// { reis, naam, soort, dag?, ... }
export async function POST(request) {
  if (!magSchrijven(request)) return fout("Ongeldige token", 401);
  const body = await leesBody(request);
  if (!body) return fout("Geen geldige JSON", 400);
  return voerUit(() => maakStop(body));
}

// { id, ...velden }; dag: null haalt de stop terug naar de ideeënlijst
export async function PATCH(request) {
  if (!magSchrijven(request)) return fout("Ongeldige token", 401);
  const body = await leesBody(request);
  if (!body?.id) return fout("Geen stop opgegeven", 400);
  const { id, ...velden } = body;
  return voerUit(() => wijzigStop(id, velden));
}

export async function DELETE(request) {
  if (!magSchrijven(request)) return fout("Ongeldige token", 401);
  const id = queryParam(request, "id");
  if (!id) return fout("Geen stop opgegeven", 400);
  return voerUit(() => verwijderStop(id));
}
