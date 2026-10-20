import collectie from "@/data/pikachu-collectie.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { SEED } from "@/lib/pikachu";
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

// Alleen wat de pagina nodig heeft:
// [id, naam, set, nummer, prijs, prijstype, notitie, sectie, mapcode, positie, plaatjes, TCGplayer-product]
const CARDS = collectie.cards.map((c) => [
  c.id,
  c.name,
  c.set,
  c.number,
  c.price_eur,
  c.price_type,
  c.note,
  c.section,
  c.binder?.code ?? null,
  c.binder ? c.binder.page * 100 + c.binder.slot : 99999,
  koppelingen.kaarten[c.id]?.img ?? [],
  koppelingen.kaarten[c.id]?.tp?.product ?? null,
]);

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
      vasteSecties={collectie.sections}
      seed={SEED}
      beginItems={items}
      beginPrijzen={prijsData}
    />
  );
}
