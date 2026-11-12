// Alles wat alleen op de server mag draaien voor /roadtrip: sleutels, autorisatie
// en de versiestempel. Niet importeren vanuit client components.
import { getRedis, gelijk } from "@/lib/kv";
import { nieuweVersie as nieuweVersieVoor } from "@/lib/invoer.mjs";

// Reizen en stops staan in platte hashes, net als pokemon:items. Dagnotities krijgen
// een eigen key met "<reis>:<nr>" als veld, zodat twee mensen tegelijk aan
// verschillende dagen kunnen werken zonder elkaar te overschrijven.
export const REIZEN_KEY = "roadtrip:reizen";
export const STOPS_KEY = "roadtrip:stops";
export const DAGEN_KEY = "roadtrip:dagen";
export const VERSIE_KEY = "roadtrip:versie";
// Antwoorden van de routedienst; twee vaste punten geven altijd dezelfde rit
export const ETAPPES_KEY = "roadtrip:etappes";

export { getRedis };

// Apart van Invoerfout, zodat de API er een 503 van maakt in plaats van een 400:
// er is niets mis met wat de gebruiker invulde, de omgeving is niet ingericht.
export class GeenDatabase extends Error {}

// Schrijfclient of een duidelijke fout
export function schrijfRedis() {
  const redis = getRedis();
  if (!redis) throw new GeenDatabase("Geen database ingesteld");
  return redis;
}

// Eigen token, los van PIKACHU_TOKEN: wie /roadtrip mag bewerken hoeft niet ook
// bij de kaartenverzameling te kunnen.
export const tokenOk = (gegeven) => gelijk(gegeven, process.env.ROADTRIP_TOKEN);

// Eén versie voor reizen, stops en dagnotities samen
export const nieuweVersie = (redis) => nieuweVersieVoor(redis, VERSIE_KEY);
