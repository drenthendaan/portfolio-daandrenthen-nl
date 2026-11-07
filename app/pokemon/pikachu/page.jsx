import collectie from "@/data/pikachu-collectie.json";
import { leesItems } from "@/lib/pokemon/items";
import { leesPrijsData } from "@/lib/pokemon/server";
import { STANDAARD_PIKACHU_BINDER } from "@/lib/pokemon/binders.mjs";
import { PIKACHU } from "@/lib/pokemon/verzamelingen";
import Verzameling from "../_components/Verzameling";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pikachu-verzameling",
  description: "Daans Pikachu-verzameling: wat betaald en binnen is, en de binder.",
};

export default async function PikachuPage() {
  const [items, prijsData] = await Promise.all([
    leesItems().catch(() => null),
    leesPrijsData().catch(() => null),
  ]);
  const verzameling = items?.verzamelingen.find((v) => v.id === PIKACHU.id) ?? { ...PIKACHU, binder: STANDAARD_PIKACHU_BINDER, themas: [], verborgen: [] };
  // De secties van de oorspronkelijke lijst geven de tabbladen hun naam en paginabereik
  return (
    <Verzameling
      verzameling={verzameling}
      secties={collectie.sections}
      beginItems={items}
      beginPrijzen={prijsData}
    />
  );
}
