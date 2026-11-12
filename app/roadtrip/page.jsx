import { leesAlles } from "@/lib/roadtrip/reizen";
import Overzicht from "./Overzicht";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roadtrips",
  description: "Reizen plannen.",
};

export default async function RoadtripPage() {
  // Valt nooit om: zonder database rendert de pagina gewoon leeg
  const data = await leesAlles().catch(() => null);
  return <Overzicht begin={data ?? { reizen: [], stops: [], versie: null }} />;
}
