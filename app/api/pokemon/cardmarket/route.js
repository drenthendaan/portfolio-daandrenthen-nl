import { productOpId } from "@/lib/pokemon/catalogus";
import { cardmarketOpties } from "@/lib/pokemon/cardmarket";

// Cardmarket-producten om uit te kiezen bij een product uit de zoeklijst ("item toevoegen")
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const product = productOpId(Number(params.get("product")));
  if (!product) return Response.json({ error: "Onbekend product" }, { status: 400 });
  try {
    // Tijdelijk: ?spoor=1 laat zien welke stappen de koppeling zette
    if (params.get("spoor")) {
      const spoor = [];
      const opties = await cardmarketOpties(product, spoor);
      return Response.json({ product, opties, spoor }, { headers: { "Cache-Control": "no-store" } });
    }
    const opties = await cardmarketOpties(product);
    // Alleen een gevonden lijst bewaren: "niets gevonden" kan morgen anders zijn
    const cache = opties.kandidaten.length ? "public, s-maxage=3600, stale-while-revalidate=3600" : "no-store";
    return Response.json(opties, { headers: { "Cache-Control": cache } });
  } catch (e) {
    console.error("cardmarket", product.product, e);
    return Response.json({ error: "Cardmarket niet bereikbaar" }, { status: 502 });
  }
}
