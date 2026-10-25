import { SEED } from "@/lib/pikachu";
import { leesItems } from "@/lib/pokemon/items";
import { vasteRijen } from "@/lib/pokemon/kaarten";
import { leesPrijsData } from "@/lib/pokemon/server";
import { JAPANS } from "@/lib/pokemon/verzamelingen";
import Verzameling from "../_components/Verzameling";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Japanse Pikachu",
  description: "Daans Japanse Pikachu-promo's: wat betaald en binnen is.",
};

const CARDS = vasteRijen(JAPANS.id);

export default async function JapansePikachuPage() {
  // Zonder database: gewoon de vaste lijst met de prijzen van 5 oktober
  const [items, prijsData] = await Promise.all([
    leesItems().catch(() => null),
    leesPrijsData().catch(() => null),
  ]);
  const verzameling = items?.verzamelingen.find((v) => v.id === JAPANS.id) ?? { ...JAPANS, themas: [], verborgen: [] };
  return <Verzameling verzameling={verzameling} vasteKaarten={CARDS} seed={SEED} beginItems={items} beginPrijzen={prijsData} />;
}
