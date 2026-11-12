import { fout, leesBody, magSchrijven, queryParam, voerUit } from "@/lib/roadtrip/api";
import { leesAlles, leesReis, maakReis, verwijderReis, wijzigReis } from "@/lib/roadtrip/reizen";

export const dynamic = "force-dynamic";

// ?slug=italie geeft één reis met haar stops en dagnotities; zonder slug alle reizen
export async function GET(request) {
  const slug = queryParam(request, "slug");
  return voerUit(async () => {
    if (slug) return (await leesReis(slug)) ?? { reis: null, stops: [], dagen: {}, versie: null };
    return (await leesAlles()) ?? { reizen: [], stops: [], versie: null };
  });
}

export async function POST(request) {
  if (!magSchrijven(request)) return fout("Ongeldige token", 401);
  const body = await leesBody(request);
  if (!body) return fout("Geen geldige JSON", 400);
  return voerUit(() => maakReis(body));
}

export async function PATCH(request) {
  if (!magSchrijven(request)) return fout("Ongeldige token", 401);
  const body = await leesBody(request);
  if (!body?.slug) return fout("Geen reis opgegeven", 400);
  const { slug, ...velden } = body;
  return voerUit(() => wijzigReis(slug, velden));
}

export async function DELETE(request) {
  if (!magSchrijven(request)) return fout("Ongeldige token", 401);
  const slug = queryParam(request, "slug");
  if (!slug) return fout("Geen reis opgegeven", 400);
  return voerUit(() => verwijderReis(slug));
}
