import { notFound } from "next/navigation";
import { leesReis } from "@/lib/roadtrip/reizen";
import { groepeerDagen } from "@/lib/roadtrip/regels.mjs";
import { etappe } from "@/lib/roadtrip/ors";
import Reis from "../_components/Reis";

export const dynamic = "force-dynamic";

// Gedeeld door generateMetadata en de pagina zelf
async function laad(slug) {
  return (await leesReis(slug).catch(() => null)) ?? { reis: null, stops: [], dagen: {}, versie: null };
}

/**
 * De rit naar elke dag toe: van de plek waar je de vorige nacht stond naar de
 * plek van deze dag. Parallel, want elke etappe komt uit de cache of uit een
 * losse berekening.
 */
async function etappesVoor(reis, stops) {
  const { dagen } = groepeerDagen(stops);
  const ankers = dagen.filter((d) => d.overnachting?.lat != null && d.overnachting?.lon != null);

  const paren = [];
  for (let i = 1; i < ankers.length; i += 1) {
    paren.push([ankers[i].nr, ankers[i - 1].overnachting, ankers[i].overnachting]);
  }

  const uitslagen = await Promise.all(
    paren.map(async ([nr, van, naar]) => {
      try {
        return [nr, await etappe(van, naar, reis.vervoer)];
      } catch {
        return [nr, null];
      }
    })
  );

  return Object.fromEntries(uitslagen.filter(([, e]) => e));
}

export async function generateMetadata({ params }) {
  const { reis: slug } = await params;
  const { reis } = await laad(slug);
  return { title: reis?.naam ?? "Reis niet gevonden" };
}

export default async function ReisPage({ params }) {
  const { reis: slug } = await params;
  const data = await laad(slug);
  if (!data.reis) notFound();

  const etappes = await etappesVoor(data.reis, data.stops).catch(() => ({}));
  return <Reis begin={data} etappes={etappes} />;
}
