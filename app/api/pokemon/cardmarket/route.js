import { productOpId } from "@/lib/pokemon/catalogus";
import { cardmarketOpties } from "@/lib/pokemon/cardmarket";

// Cardmarket-producten om uit te kiezen bij een product uit de zoeklijst ("item toevoegen")
export async function GET(request) {
  const product = productOpId(Number(new URL(request.url).searchParams.get("product")));
  if (!product) return Response.json({ error: "Onbekend product" }, { status: 400 });
  try {
    const opties = await cardmarketOpties(product);
    // Alleen een gevonden lijst bewaren: "niets gevonden" kan morgen anders zijn
    const cache = opties.kandidaten.length ? "public, s-maxage=3600, stale-while-revalidate=3600" : "no-store";
    return Response.json(opties, { headers: { "Cache-Control": cache } });
  } catch (e) {
    console.error("cardmarket", product.product, e);
    return Response.json({ error: "Cardmarket niet bereikbaar" }, { status: 502 });
  }
}
