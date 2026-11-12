import { fout, leesBody, magSchrijven, voerUit } from "@/lib/roadtrip/api";
import { zetDagnotitie } from "@/lib/roadtrip/stops";

export const dynamic = "force-dynamic";

// { reis, dag, notitie }; notitie leeg of null verwijdert hem
export async function PATCH(request) {
  if (!magSchrijven(request)) return fout("Ongeldige token", 401);
  const body = await leesBody(request);
  if (!body?.reis) return fout("Geen reis opgegeven", 400);
  return voerUit(() => zetDagnotitie(body.reis, body.dag, body.notitie));
}
