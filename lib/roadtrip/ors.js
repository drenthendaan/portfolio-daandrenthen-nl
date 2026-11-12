// Afstand en rijtijd tussen twee punten. Zonder ORS_API_KEY valt dit terug op
// een schatting, zodat de app ook zonder account werkt — duidelijk gemarkeerd
// met schatting: true, zodat de UI het eerlijk kan tonen.
import { getRedis, nieuweVersie, ETAPPES_KEY } from "./server";
import { schatEtappe } from "./regels.mjs";

const PROFIEL = { camper: "driving-hgv", auto: "driving-car", motor: "driving-car", vlucht: "driving-car" };

// Vier decimalen is ongeveer 11 meter: nauwkeurig genoeg, en twee keer dezelfde
// standplaats levert dezelfde sleutel op.
const rond = (n) => Number(n).toFixed(4);
const sleutelVan = (profiel, a, b) =>
  `${profiel}:${rond(a.lat)},${rond(a.lon)}>${rond(b.lat)},${rond(b.lon)}`;

async function vraagOrs(profiel, a, b) {
  const sleutel = process.env.ORS_API_KEY;
  if (!sleutel) return null;

  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profiel}`, {
    method: "POST",
    headers: { Authorization: sleutel, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [[a.lon, a.lat], [b.lon, b.lat]] }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const samenvatting = data?.routes?.[0]?.summary;
  if (!samenvatting) return null;

  return {
    km: Math.round(samenvatting.distance / 1000),
    minuten: Math.round(samenvatting.duration / 60),
    schatting: false,
  };
}

/**
 * Twee vaste punten geven altijd dezelfde rit, dus het antwoord gaat in Redis.
 * Daardoor raakt een volle dagplanning de routedienst maar één keer per etappe.
 */
export async function etappe(a, b, vervoer = "camper") {
  const profiel = PROFIEL[vervoer] ?? "driving-car";
  const schatting = schatEtappe(a, b);
  if (!schatting) return null;

  const redis = getRedis();
  const sleutel = sleutelVan(profiel, a, b);

  if (redis) {
    try {
      const bewaard = await redis.hget(ETAPPES_KEY, sleutel);
      if (bewaard && typeof bewaard === "object") return bewaard;
    } catch {
      /* cache mislukt: gewoon doorgaan */
    }
  }

  let uitslag = null;
  try {
    uitslag = await vraagOrs(profiel, a, b);
  } catch {
    uitslag = null;
  }

  // Alleen echte antwoorden bewaren; een schatting kan straks beter worden
  if (uitslag && redis) {
    try {
      await redis.hset(ETAPPES_KEY, { [sleutel]: uitslag });
    } catch {
      /* niet erg */
    }
  }

  return uitslag ?? schatting;
}

export { nieuweVersie };
