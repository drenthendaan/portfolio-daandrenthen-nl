// Stops en dagnotities. Een stop met dag === null staat in de ideeënlijst, dus
// "slepen naar een dag" is gewoon een PATCH van dat ene veld.
import { randomBytes } from "node:crypto";
import { Invoerfout, bedrag, tekst } from "@/lib/invoer.mjs";
import { getRedis, nieuweVersie, schrijfRedis, DAGEN_KEY, REIZEN_KEY, STOPS_KEY } from "./server";
import { STATUSSEN } from "./regels.mjs";

// Een roadtrip gaat van plek naar plek; elke stop is er één waar je staat.
const SOORTEN = ["overnachting"];
import { afmetingen, getal, jaNee, keuze, koppeling, losseTekst } from "./velden.mjs";

export { Invoerfout };

export function normaliseerStop(stop) {
  return {
    dag: null,
    volgorde: 0,
    lat: null,
    lon: null,
    adres: null,
    nachten: null,
    prijs: null,
    betaald: false,
    notitie: null,
    link: null,
    max: null,
    status: "idee",
    ...stop,
  };
}

function velden(invoer) {
  const v = {};
  if ("naam" in invoer) v.naam = tekst(invoer.naam, "Naam", 80);
  if ("soort" in invoer) v.soort = keuze(invoer.soort, "Soort", SOORTEN);
  if ("status" in invoer) v.status = keuze(invoer.status, "Status", STATUSSEN);
  if ("dag" in invoer) v.dag = getal(invoer.dag, "Dag", { min: 1, max: 400 });
  if ("volgorde" in invoer) v.volgorde = getal(invoer.volgorde, "Volgorde", { max: 10_000 }) ?? 0;
  if ("adres" in invoer) v.adres = losseTekst(invoer.adres, "Adres", 200);
  if ("notitie" in invoer) v.notitie = losseTekst(invoer.notitie, "Notitie", 2000);
  if ("link" in invoer) v.link = koppeling(invoer.link, "Link");
  if ("nachten" in invoer) v.nachten = getal(invoer.nachten, "Nachten", { max: 400 });
  if ("prijs" in invoer) v.prijs = bedrag(invoer.prijs, "Prijs");
  if ("betaald" in invoer) v.betaald = jaNee(invoer.betaald, "Betaald");
  if ("max" in invoer) v.max = afmetingen(invoer.max, "Maximum");

  if ("lat" in invoer) v.lat = getal(invoer.lat, "Breedtegraad", { min: -90, max: 90, heel: false });
  if ("lon" in invoer) v.lon = getal(invoer.lon, "Lengtegraad", { min: -180, max: 180, heel: false });

  return v;
}

export async function leesStops(reis, redis = getRedis({ alleenLezen: true })) {
  if (!redis) return null;
  const hash = (await redis.hgetall(STOPS_KEY)) ?? {};
  return Object.values(hash)
    .filter((s) => s && typeof s === "object" && (!reis || s.reis === reis))
    .map(normaliseerStop);
}

export async function maakStop(invoer) {
  const redis = schrijfRedis();

  const reis = String(invoer?.reis ?? "").trim();
  if (!reis) throw new Invoerfout("Geen reis opgegeven");
  if (!(await redis.hget(REIZEN_KEY, reis))) throw new Invoerfout("Reis bestaat niet");

  const v = velden({ soort: "overnachting", status: "idee", ...invoer });
  const nu = new Date().toISOString();
  const stop = normaliseerStop({
    id: `s${randomBytes(5).toString("hex")}`,
    reis,
    ...v,
    gemaakt: nu,
    bijgewerkt: nu,
  });

  await redis.hset(STOPS_KEY, { [stop.id]: stop });
  return { stop, versie: await nieuweVersie(redis) };
}

export async function wijzigStop(id, invoer) {
  const redis = schrijfRedis();

  const oud = await redis.hget(STOPS_KEY, id);
  if (!oud || typeof oud !== "object") throw new Invoerfout("Stop bestaat niet");

  const v = velden(invoer);
  // reis en id liggen vast: een stop verhuist niet naar een andere reis
  const stop = { ...normaliseerStop(oud), ...v, id, reis: oud.reis, bijgewerkt: new Date().toISOString() };

  await redis.hset(STOPS_KEY, { [id]: stop });
  return { stop, versie: await nieuweVersie(redis) };
}

export async function verwijderStop(id) {
  const redis = schrijfRedis();
  if (!(await redis.hdel(STOPS_KEY, id))) throw new Invoerfout("Stop bestaat niet");
  return { verwijderd: id, versie: await nieuweVersie(redis) };
}

// Dagnotities staan los van de stops, met "<reis>:<nr>" als veld. Twee mensen die
// aan verschillende dagen werken overschrijven elkaar dus niet.
export async function zetDagnotitie(reis, nr, notitie) {
  const redis = schrijfRedis();

  const slug = String(reis ?? "").trim();
  if (!slug) throw new Invoerfout("Geen reis opgegeven");
  if (!(await redis.hget(REIZEN_KEY, slug))) throw new Invoerfout("Reis bestaat niet");

  const dag = getal(nr, "Dag", { min: 1, max: 400 });
  if (dag === null) throw new Invoerfout("Geen dag opgegeven");

  const veld = `${slug}:${dag}`;
  const tekstje = losseTekst(notitie, "Notitie", 4000);

  if (tekstje === null) await redis.hdel(DAGEN_KEY, veld);
  else await redis.hset(DAGEN_KEY, { [veld]: { notitie: tekstje } });

  return { dag, notitie: tekstje, versie: await nieuweVersie(redis) };
}
