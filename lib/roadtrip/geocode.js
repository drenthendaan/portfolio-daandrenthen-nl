// Plekken zoeken op naam, zodat je geen breedte- en lengtegraad meer hoeft op
// te zoeken. Nominatim heeft geen sleutel nodig, maar vraagt wel om een eigen
// User-Agent en hoogstens één verzoek per seconde — de cache in Redis zorgt dat
// we daar ruim onder blijven.
import { getRedis, GEOCODE_KEY } from "./server";

const DIENST = "https://nominatim.openstreetmap.org/search";

// Nominatim wil weten welke toepassing er klopt. Hier staat bewust alleen de
// naam van de app in: geen naam, mailadres of domein van de gebruiker.
const CLIENT = "roadtrip-planner/1.0";

// Drie letters is de ondergrens: korter levert alleen maar ruis op
export const KORTSTE_TERM = 3;

// Hoofdletters en dubbele spaties maken geen andere plek, maar wel een andere
// cachesleutel. Dus eerst gelijktrekken.
const normaliseer = (term) => String(term ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Nominatim staat één verzoek per seconde toe. Deze instantie houdt bij wanneer
// ze er voor het laatst een deed en wacht zo nodig haar beurt af.
let laatsteAanroep = 0;
async function wachtJeBeurt() {
  const sinds = Date.now() - laatsteAanroep;
  if (sinds < 1100) await new Promise((klaar) => setTimeout(klaar, 1100 - sinds));
  laatsteAanroep = Date.now();
}

// Eén rij van Nominatim naar de velden die een stop nodig heeft
function uitRij(rij) {
  const lat = Number(rij?.lat);
  const lon = Number(rij?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const volledig = String(rij?.display_name ?? "").trim();
  // display_name is "Camping Lido, Lidostrasse, Luzern, …": het eerste deel is
  // de plek zelf, de rest is het adres eromheen.
  const naam = String(rij?.name ?? "").trim() || volledig.split(",")[0].trim();
  if (!naam) return null;

  return {
    naam,
    adres: volledig || null,
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
  };
}

async function vraagNominatim(term) {
  await wachtJeBeurt();

  const url = new URL(DIENST);
  url.searchParams.set("q", term);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");

  const res = await fetch(url, {
    headers: { "User-Agent": CLIENT, "Accept-Language": "nl,en" },
    // Liever snel niets dan een formulier dat blijft hangen
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data)) return null;
  return data.map(uitRij).filter(Boolean);
}

/**
 * Zoekt plekken bij een term. Dezelfde term geeft altijd dezelfde plekken, dus
 * het antwoord gaat in Redis en een tweede keer zoeken raakt de dienst niet.
 *
 * Doet de dienst het niet, dan komt er een lege lijst terug met dienstWeg: true.
 * Het formulier blijft dan gewoon werken: je vult de coördinaten met de hand in.
 */
export async function zoekPlaatsen(term) {
  const schoon = normaliseer(term);
  if (schoon.length < KORTSTE_TERM) return { treffers: [], uitCache: false };

  const redis = getRedis();

  if (redis) {
    try {
      const bewaard = await redis.hget(GEOCODE_KEY, schoon);
      if (Array.isArray(bewaard)) return { treffers: bewaard, uitCache: true };
    } catch {
      /* cache onbereikbaar: gewoon doorvragen */
    }
  }

  let treffers = null;
  try {
    treffers = await vraagNominatim(schoon);
  } catch {
    treffers = null;
  }

  // Een mislukte aanroep bewaren we niet: straks doet de dienst het weer wel.
  if (!treffers) return { treffers: [], uitCache: false, dienstWeg: true };

  if (redis) {
    try {
      await redis.hset(GEOCODE_KEY, { [schoon]: treffers });
    } catch {
      /* niet erg, dan vragen we het de volgende keer opnieuw */
    }
  }

  return { treffers, uitCache: false };
}
