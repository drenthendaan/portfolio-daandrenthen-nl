import { notFound } from "next/navigation";
import { leesItems } from "@/lib/pokemon/items";
import { leesPrijsData } from "@/lib/pokemon/server";
import Verzameling from "../_components/Verzameling";

export const dynamic = "force-dynamic";

async function laad(id) {
  const [items, prijsData] = await Promise.all([leesItems().catch(() => null), leesPrijsData().catch(() => null)]);
  const verzameling = items?.verzamelingen.find((v) => v.id === id && !v.vast) ?? null;
  return { items, prijsData, verzameling };
}

export async function generateMetadata({ params }) {
  const { verzameling: id } = await params;
  const { verzameling } = await laad(id);
  return { title: verzameling?.naam ?? "Verzameling niet gevonden" };
}

// Eigen verzameling: dezelfde lijst als de Pikachu-verzameling, maar alleen met items
export default async function VerzamelingPage({ params }) {
  const { verzameling: id } = await params;
  const { items, prijsData, verzameling } = await laad(id);
  if (!verzameling) notFound();
  return <Verzameling verzameling={verzameling} beginItems={items} beginPrijzen={prijsData} />;
}
