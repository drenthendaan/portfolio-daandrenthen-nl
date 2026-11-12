// Het rekenwerk achter het zoeken op naam: de term gelijktrekken, de antwoorden
// van een zoekdienst omzetten, en de cache eromheen. Hier komt geen netwerk en
// geen database aan te pas, zodat dit met node --test te controleren is. Het
// bellen zelf staat in geocode.js.
import { Invoerfout } from "../invoer.mjs";

// Drie letters is de ondergrens: korter levert alleen maar ruis op
export const KORTSTE_TERM = 3;

// En een bovengrens, zodat niemand de cache kan volschrijven met onzin
export const LANGSTE_TERM = 120;

export const MAX_TREFFERS = 6;

/**
 * Hoofdletters en dubbele spaties maken geen andere plek, maar wel een andere
 * cachesleutel. Dus eerst gelijktrekken.
 */
export function normaliseerTerm(term) {
  const schoon = String(term ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (schoon.length > LANGSTE_TERM) throw new Invoerfout("Zoekterm is te lang");
  return schoon;
}

const wacht = (ms) => new Promise((klaar) => setTimeout(klaar, ms));

/**
 * Een wachtrij die er hoogstens één tegelijk doorlaat, met een vaste pauze
 * ertussen. Nominatim staat één verzoek per seconde toe, en daar is een
 * tijdstempel bijhouden net niet genoeg voor: twee verzoeken die tegelijk
 * binnenkomen lezen dan dezelfde waarde, wachten even lang en vertrekken
 * alsnog samen. Achter elkaar in één ketting hangen doet dat wel goed.
 */
export function maakBeurtrij(tussenpoze = 1100) {
  let vorige = Promise.resolve();

  return function opZijnBeurt(actie) {
    const uitslag = vorige.then(actie);
    // Of het lukte of niet: de volgende is pas na de pauze aan de beurt. De
    // catch hoort hier, anders breekt één mislukking de hele ketting.
    vorige = uitslag.catch(() => {}).then(() => wacht(tussenpoze));
    return uitslag;
  };
}

// Eén rij van een zoekdienst naar de velden die een stop nodig heeft
function uitRij(naam, volledigeNaam, lat, lon) {
  const b = Number(lat);
  const l = Number(lon);
  if (!Number.isFinite(b) || !Number.isFinite(l)) return null;

  // Het volledige label is "Camping Lido, Lidostrasse, Luzern, …": het eerste
  // deel is de plek zelf, de rest is het adres eromheen.
  const volledig = String(volledigeNaam ?? "").trim();
  const eigen = String(naam ?? "").trim() || volledig.split(",")[0].trim();
  if (!eigen) return null;

  return {
    naam: eigen,
    adres: volledig || null,
    lat: Number(b.toFixed(5)),
    lon: Number(l.toFixed(5)),
  };
}

export function uitNominatim(data) {
  if (!Array.isArray(data)) return null;
  return data.map((rij) => uitRij(rij?.name, rij?.display_name, rij?.lat, rij?.lon)).filter(Boolean);
}

// Pelias, de geocoder van OpenRouteService, geeft GeoJSON terug. Let op de
// volgorde: coordinates is [lon, lat], andersom dan je zou lezen.
export function uitOrs(data) {
  if (!Array.isArray(data?.features)) return null;
  return data.features
    .map((kenmerk) =>
      uitRij(
        kenmerk?.properties?.name,
        kenmerk?.properties?.label,
        kenmerk?.geometry?.coordinates?.[1],
        kenmerk?.geometry?.coordinates?.[0]
      )
    )
    .filter(Boolean);
}

/**
 * Zoekt plekken bij een term. Dezelfde term geeft altijd dezelfde plekken, dus
 * het antwoord gaat in Redis en een tweede keer zoeken raakt de dienst niet.
 *
 * haalOp geeft null als de dienst niet antwoordde, en een (eventueel lege)
 * lijst als hij dat wel deed. Dat verschil bepaalt of het de cache in mag:
 * een storing van vijf seconden hoort niet eeuwig te blijven hangen.
 */
export async function zoekMet({ term, redis, hash, haalOp }) {
  const schoon = normaliseerTerm(term);
  if (schoon.length < KORTSTE_TERM) return { treffers: [], uitCache: false };

  if (redis) {
    try {
      const bewaard = await redis.hget(hash, schoon);
      if (Array.isArray(bewaard)) return { treffers: bewaard, uitCache: true };
    } catch {
      /* cache onbereikbaar: gewoon doorvragen */
    }
  }

  let treffers = null;
  try {
    treffers = await haalOp(schoon);
  } catch {
    treffers = null;
  }

  // Een mislukte aanroep bewaren we niet: straks doet de dienst het weer wel.
  if (!treffers) return { treffers: [], uitCache: false, dienstWeg: true };

  if (redis) {
    try {
      await redis.hset(hash, { [schoon]: treffers });
    } catch {
      /* niet erg, dan vragen we het de volgende keer opnieuw */
    }
  }

  return { treffers, uitCache: false };
}
