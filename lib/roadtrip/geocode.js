// Plekken zoeken op naam, zodat je geen breedte- en lengtegraad meer hoeft op
// te zoeken. Staat er een ORS_API_KEY, dan gaat het naar de geocoder van
// OpenRouteService; anders — en als die niets weet — naar Nominatim. Nominatim
// heeft geen sleutel nodig, maar vraagt wel om een eigen User-Agent en
// hoogstens één verzoek per seconde; de cache in Redis zorgt dat we daar ruim
// onder blijven.
import { getRedis, GEOCODE_KEY } from "./server";
import { MAX_TREFFERS, maakBeurtrij, uitNominatim, uitOrs, zoekMet } from "./geocode.mjs";

export { KORTSTE_TERM } from "./geocode.mjs";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const ORS = "https://api.openrouteservice.org/geocode/search";

// Nominatim wil weten welke toepassing er klopt. Hier staat bewust alleen de
// naam van de app in: geen naam, mailadres of domein van de gebruiker. Wie de
// site draait kan er via de omgeving een eigen contactadres van maken.
const CLIENT = process.env.NOMINATIM_USER_AGENT || "roadtrip-planner/1.0";

// Liever snel niets dan een formulier dat blijft hangen
const TIJDLIMIET = 6000;

// Eén verzoek per seconde naar Nominatim, ook als er twee tegelijk binnenkomen.
// Dit geldt per serverproces; over processen heen is de cache de echte rem,
// want dezelfde zoekterm belt de dienst maar één keer.
const opZijnBeurt = maakBeurtrij(1100);

async function vraagOrs(term) {
  const sleutel = process.env.ORS_API_KEY;
  if (!sleutel) return null;

  const url = new URL(ORS);
  url.searchParams.set("api_key", sleutel);
  url.searchParams.set("text", term);
  url.searchParams.set("size", String(MAX_TREFFERS));

  const res = await fetch(url, { signal: AbortSignal.timeout(TIJDLIMIET) });
  if (!res.ok) return null;
  return uitOrs(await res.json());
}

async function vraagNominatim(term) {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", term);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(MAX_TREFFERS));

  const res = await opZijnBeurt(() =>
    fetch(url, {
      headers: { "User-Agent": CLIENT, "Accept-Language": "nl,en" },
      signal: AbortSignal.timeout(TIJDLIMIET),
    })
  );
  if (!res.ok) return null;
  return uitNominatim(await res.json());
}

// null betekent "de dienst antwoordde niet", een lege lijst "niets gevonden".
// Alleen dat laatste mag de cache in.
async function vraagDienst(term) {
  const viaOrs = await vraagOrs(term).catch(() => null);
  if (viaOrs?.length) return viaOrs;

  // Geen sleutel, of ORS kende de plek niet: Nominatim kent de campings beter
  const viaNominatim = await vraagNominatim(term).catch(() => null);
  return viaNominatim ?? viaOrs;
}

export function zoekPlaatsen(term) {
  return zoekMet({ term, redis: getRedis(), hash: GEOCODE_KEY, haalOp: vraagDienst });
}
