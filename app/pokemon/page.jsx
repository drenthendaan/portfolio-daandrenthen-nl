import { leesItems } from "@/lib/pokemon/items";
import { leesMeldingen, leesPrijsData } from "@/lib/pokemon/server";
import Overzicht from "./Overzicht";
import "./overzicht.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pokémon-verzameling",
  description: "Daans Pokémon-verzameling: totale waarde, kaarten en ETB's.",
};

export default async function PokemonPage() {
  const [prijsData, items, meldingen] = await Promise.all([
    leesPrijsData().catch(() => null),
    leesItems().catch(() => null),
    leesMeldingen().catch(() => null),
  ]);
  return <Overzicht beginPrijzen={prijsData} beginItems={items} beginMeldingen={meldingen} />;
}
