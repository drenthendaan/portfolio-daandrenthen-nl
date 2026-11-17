import { notFound } from "next/navigation";
import { leesReis } from "@/lib/roadtrip/reizen";
import { groepeerDagen } from "@/lib/roadtrip/regels.mjs";
import { etappe } from "@/lib/roadtrip/ors";
import { afstandSleutel } from "@/lib/roadtrip/regels.mjs";
import Reis from "../_components/Reis";

export const dynamic = "force-dynamic";

// Gedeeld door generateMetadata en de pagina zelf
async function laad(slug) {
  return (await leesReis(slug).catch(() => null)) ?? { reis: null, stops: [], dagen: {}, versie: null };
}

/**
 * De rit naar elke dag toe: van de plek waar je de vorige nacht stond naar de
 * plek van deze dag. De eerste dag rijd je vanaf de startplek, als die er is.
 * Parallel, want elke etappe komt uit de cache of uit een losse berekening.
 */
async function etappesVoor(reis, stops) {
  const { dagen } = groepeerDagen(stops);
  const metPlek = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon);
  const ankers = dagen.filter((d) => metPlek(d.anker));

  const paren = [];
  if (ankers.length && metPlek(reis.start)) paren.push([ankers[0].nr, reis.start, ankers[0].anker]);
  for (let i = 1; i < ankers.length; i += 1) {
    paren.push([ankers[i].nr, ankers[i - 1].anker, ankers[i].anker]);
  }

  const uitslagen = await Promise.all(
    paren.map(async ([nr, van, naar]) => {
      try {
        // De lijn haalt de kaart zelf op; de dagenlijst heeft alleen km en tijd nodig
        const { lijn, ...rest } = (await etappe(van, naar, reis.vervoer)) ?? {};
        return [nr, rest.km != null ? rest : null];
      } catch {
        return [nr, null];
      }
    })
  );

  return Object.fromEntries(uitslagen.filter(([, e]) => e));
}

/**
 * Hoe ver elke activiteit van zijn eigen stop af ligt. Over de weg, want
 * hemelsbreed is in de bergen misleidend: vijf kilometer vogelvlucht kan een
 * half uur rijden zijn. Dit loopt via dezelfde etappe() als de dagritten, dus
 * het deelt de cache en een paar die je al eens zag kost niets meer.
 */
async function afstandenVoor(reis, stops) {
  const paren = [];
  for (const stop of stops) {
    if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lon)) continue;
    (stop.activiteiten ?? []).forEach((a) => paren.push([stop.id, a, stop]));
  }

  const uitslagen = await Promise.all(
    paren.map(async ([id, naar, van]) => {
      // Op de plek zelf, niet op volgnummer: haal je er eentje tussenuit, dan
      // schuift de rest op en krijgt een activiteit de afstand van zijn buurman.
      const sleutel = afstandSleutel(id, naar);
      try {
        // De lijn is hier niet nodig: het kaartje tekent rechte verbindingen
        const { lijn, ...rest } = (await etappe(van, naar, reis.vervoer)) ?? {};
        return [sleutel, rest.km != null ? rest : null];
      } catch {
        return [sleutel, null];
      }
    })
  );

  return Object.fromEntries(uitslagen.filter(([, a]) => a));
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

  const [etappes, afstanden] = await Promise.all([
    etappesVoor(data.reis, data.stops).catch(() => ({})),
    afstandenVoor(data.reis, data.stops).catch(() => ({})),
  ]);
  return <Reis begin={data} etappes={etappes} afstanden={afstanden} />;
}
