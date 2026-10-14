import { zoek } from "@/lib/pokemon/catalogus";

// Zoeken in de TCGplayer-catalogus voor "item toevoegen". De catalogus verandert alleen
// bij een nieuwe deploy, dus het antwoord mag een dag in de CDN-cache.
export async function GET(request) {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 100) ?? "";
  const resultaten = q.trim().length >= 2 ? zoek(q) : [];
  return Response.json(
    { resultaten },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } }
  );
}
