import collectie from "@/data/pikachu-collectie.json";
import { SEED } from "@/lib/pikachu";
import { leesItems } from "@/lib/pokemon/items";
import { vasteRijen } from "@/lib/pokemon/kaarten";
import { leesPrijsData } from "@/lib/pokemon/server";
import { STANDAARD_PIKACHU_BINDER } from "@/lib/pokemon/binders.mjs";
import { PIKACHU } from "@/lib/pokemon/verzamelingen";
import Verzameling from "../_components/Verzameling";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pikachu-verzameling",
  description: "Daans Pikachu-verzameling: wat betaald en binnen is, en de binder.",
};

// De Engelse kaarten; de Japanse promo's staan in hun eigen verzameling
const CARDS = vasteRijen(PIKACHU.id);
const SECTIES = collectie.sections.filter((s) => s.id !== "JP");

export default async function PikachuPage() {
  // Zonder database: gewoon de vaste lijst met de prijzen van 5 oktober
  const [items, prijsData] = await Promise.all([
    leesItems().catch(() => null),
    leesPrijsData().catch(() => null),
  ]);
  const verzameling = items?.verzamelingen.find((v) => v.id === PIKACHU.id) ?? { ...PIKACHU, binder: STANDAARD_PIKACHU_BINDER, themas: [], verborgen: [] };
  return (
    <Verzameling
      verzameling={verzameling}
      vasteKaarten={CARDS}
      vasteSecties={SECTIES}
      seed={SEED}
      beginItems={items}
      beginPrijzen={prijsData}
    />
  );
}
