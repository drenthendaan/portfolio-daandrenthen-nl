import { SEED } from "@/lib/pikachu";
import { leesItems } from "@/lib/pokemon/items";
import { KAARTEN, VASTE_PRIJZEN } from "@/lib/pokemon/kaarten";
import { naarBits } from "@/lib/pokemon/regels.mjs";
import { leesPrijsData, leesStatus } from "@/lib/pokemon/server";
import Overzicht from "./Overzicht";
import "./overzicht.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pokémon-verzameling",
  description: "Daans Pokémon-verzameling: totale waarde, kaarten en ETB's.",
};

export default async function PokemonPage() {
  // Valt terug op de startstand en vaste prijzen als de database even niet bereikbaar is
  const [status, prijsData, items] = await Promise.all([
    leesStatus().catch(() => null),
    leesPrijsData().catch(() => null),
    leesItems().catch(() => null),
  ]);
  const bits = {};
  for (const [id, v] of Object.entries(status ?? SEED)) {
    const b = naarBits(v);
    if (b) bits[id] = b;
  }
  return (
    <Overzicht
      kaarten={KAARTEN}
      beginBits={bits}
      beginPrijzen={prijsData}
      vastePrijzen={VASTE_PRIJZEN}
      beginItems={items}
    />
  );
}
