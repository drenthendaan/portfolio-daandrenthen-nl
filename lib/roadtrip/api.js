// Het skelet dat elke /api/roadtrip-route gebruikt. In app/api/pokemon staat dit
// blok vier keer gedupliceerd; hier staat het één keer.
import { Invoerfout } from "@/lib/invoer.mjs";
import { GeenDatabase, tokenOk } from "./server";

export const NO_STORE = { "Cache-Control": "no-store" };

export const fout = (bericht, status) => Response.json({ error: bericht }, { status, headers: NO_STORE });

// Invoerfout → 400, geen database → 503, de rest → 502
export async function voerUit(actie) {
  try {
    return Response.json(await actie(), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Invoerfout) return fout(e.message, 400);
    if (e instanceof GeenDatabase) return fout("Geen database ingesteld", 503);
    return fout("Database niet bereikbaar", 502);
  }
}

// Lezen mag iedereen met de link; schrijven vereist het token
export const magSchrijven = (request) => tokenOk(request.headers.get("x-roadtrip-token"));

export async function leesBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export const queryParam = (request, naam) => new URL(request.url).searchParams.get(naam);
