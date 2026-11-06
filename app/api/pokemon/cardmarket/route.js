import { productOpId } from "@/lib/pokemon/catalogus";
import { cardmarketOpties } from "@/lib/pokemon/cardmarket";

// Cardmarket-producten om uit te kiezen bij een product uit de zoeklijst ("item toevoegen")
export async function GET(request) {
  const product = productOpId(Number(new URL(request.url).searchParams.get("product")));
  if (!product) return Response.json({ error: "Onbekend product" }, { status: 400 });
  try {
    return Response.json(await cardmarketOpties(product), {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" },
    });
  } catch {
    return Response.json({ error: "Cardmarket niet bereikbaar" }, { status: 502 });
  }
}
