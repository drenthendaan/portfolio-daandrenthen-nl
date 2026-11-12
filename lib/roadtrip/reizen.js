// Reizen lezen en schrijven. Eén hash met slug → reis; de slug is meteen het adres
// (/roadtrip/italie), dus botsingen krijgen -2, -3, …
import { Invoerfout, slug as maakSlug, tekst, vrijeId } from "@/lib/invoer.mjs";
import { getRedis, nieuweVersie, schrijfRedis, DAGEN_KEY, REIZEN_KEY, STOPS_KEY, VERSIE_KEY } from "./server";
import { REISSTATUSSEN, VERVOER, heeftAfmetingen } from "./regels.mjs";
import { afmetingen, datum, getal, keuze, koppeling, losseTekst } from "./velden.mjs";

export { Invoerfout };

// Ouder record aanvullen bij het lezen, zodat er geen schrijfmigratie nodig is
function normaliseer(reis) {
  return {
    gebied: null,
    voertuig: null,
    van: null,
    tot: null,
    status: "idee",
    midden: null,
    afbeelding: null,
    ...reis,
  };
}

const opNaam = (a, b) => String(a.gemaakt ?? "").localeCompare(String(b.gemaakt ?? ""));

export async function leesAlles(redis = getRedis({ alleenLezen: true })) {
  if (!redis) return null;
  const [reizenHash, stopsHash, versie] = await Promise.all([
    redis.hgetall(REIZEN_KEY),
    redis.hgetall(STOPS_KEY),
    redis.get(VERSIE_KEY),
  ]);
  return {
    reizen: Object.values(reizenHash ?? {})
      .filter((r) => r && typeof r === "object")
      .map(normaliseer)
      .sort(opNaam),
    stops: Object.values(stopsHash ?? {}).filter((s) => s && typeof s === "object"),
    versie: versie ?? null,
  };
}

// Alles voor één reispagina in één keer
export async function leesReis(slug, redis = getRedis({ alleenLezen: true })) {
  if (!redis) return null;
  const [reis, stopsHash, dagenHash, versie] = await Promise.all([
    redis.hget(REIZEN_KEY, slug),
    redis.hgetall(STOPS_KEY),
    redis.hgetall(DAGEN_KEY),
    redis.get(VERSIE_KEY),
  ]);
  if (!reis || typeof reis !== "object") return { reis: null, stops: [], dagen: {}, versie: versie ?? null };

  const voorvoegsel = `${slug}:`;
  const dagen = {};
  for (const [veld, waarde] of Object.entries(dagenHash ?? {})) {
    if (veld.startsWith(voorvoegsel)) dagen[veld.slice(voorvoegsel.length)] = waarde;
  }

  return {
    reis: normaliseer(reis),
    stops: Object.values(stopsHash ?? {}).filter((s) => s && typeof s === "object" && s.reis === slug),
    dagen,
    versie: versie ?? null,
  };
}

// Whitelist: onbekende velden worden genegeerd, "in" zodat je op null kunt zetten
function velden(invoer, bestaand = null) {
  const v = {};
  if ("naam" in invoer) v.naam = tekst(invoer.naam, "Naam", 60);
  if ("gebied" in invoer) v.gebied = losseTekst(invoer.gebied, "Gebied", 120);
  // Alleen een http(s)-adres; koppeling() weert javascript: en dergelijke
  if ("afbeelding" in invoer) v.afbeelding = koppeling(invoer.afbeelding, "Afbeelding");
  if ("vervoer" in invoer) v.vervoer = keuze(invoer.vervoer, "Vervoer", VERVOER);
  if ("status" in invoer) v.status = keuze(invoer.status, "Status", REISSTATUSSEN);
  if ("van" in invoer) v.van = datum(invoer.van, "Van");
  if ("tot" in invoer) v.tot = datum(invoer.tot, "Tot");
  if ("voertuig" in invoer) v.voertuig = afmetingen(invoer.voertuig, "Voertuig");

  if ("midden" in invoer) {
    const m = invoer.midden;
    v.midden =
      m === null || m === undefined
        ? null
        : {
            lat: getal(m.lat, "Breedtegraad", { min: -90, max: 90, heel: false }),
            lon: getal(m.lon, "Lengtegraad", { min: -180, max: 180, heel: false }),
            zoom: getal(m.zoom, "Zoom", { min: 0, max: 22, heel: false }) ?? 5,
          };
  }

  // Alleen een camper heeft maten die ergens niet door passen
  const vervoer = v.vervoer ?? bestaand?.vervoer;
  if (v.voertuig && !heeftAfmetingen(vervoer)) v.voertuig = null;

  const van = "van" in v ? v.van : bestaand?.van;
  const tot = "tot" in v ? v.tot : bestaand?.tot;
  if (van && tot && tot < van) throw new Invoerfout("De einddatum ligt voor de begindatum");

  return v;
}

export async function maakReis(invoer) {
  const redis = schrijfRedis();

  // Een reis zonder naam heeft geen adres: tekst() gooit hier op leeg of te lang
  const v = velden({ vervoer: "camper", status: "idee", ...invoer, naam: invoer?.naam });
  const bestaand = (await redis.hgetall(REIZEN_KEY)) ?? {};
  const slug = vrijeId(maakSlug(v.naam, "reis"), (id) => id in bestaand);

  const reis = normaliseer({
    slug,
    naam: v.naam,
    gebied: v.gebied ?? null,
    vervoer: v.vervoer,
    status: v.status,
    van: v.van ?? null,
    tot: v.tot ?? null,
    voertuig: v.voertuig ?? null,
    midden: v.midden ?? null,
    gemaakt: new Date().toISOString(),
  });

  await redis.hset(REIZEN_KEY, { [slug]: reis });
  return { reis, versie: await nieuweVersie(redis) };
}

export async function wijzigReis(slug, invoer) {
  const redis = schrijfRedis();

  const oud = await redis.hget(REIZEN_KEY, slug);
  if (!oud || typeof oud !== "object") throw new Invoerfout("Reis bestaat niet");

  const huidig = normaliseer(oud);
  const v = velden(invoer, huidig);
  // De slug is het adres en verandert niet mee met de naam: bestaande links blijven werken
  const reis = { ...huidig, ...v, slug };

  await redis.hset(REIZEN_KEY, { [slug]: reis });
  return { reis, versie: await nieuweVersie(redis) };
}

// Een reis weggooien neemt haar stops en dagnotities mee
export async function verwijderReis(slug) {
  const redis = schrijfRedis();
  if (!(await redis.hdel(REIZEN_KEY, slug))) throw new Invoerfout("Reis bestaat niet");

  const [stopsHash, dagenHash] = await Promise.all([redis.hgetall(STOPS_KEY), redis.hgetall(DAGEN_KEY)]);

  const stops = Object.entries(stopsHash ?? {})
    .filter(([, s]) => s && typeof s === "object" && s.reis === slug)
    .map(([id]) => id);
  const dagen = Object.keys(dagenHash ?? {}).filter((veld) => veld.startsWith(`${slug}:`));

  if (stops.length) await redis.hdel(STOPS_KEY, ...stops);
  if (dagen.length) await redis.hdel(DAGEN_KEY, ...dagen);

  return { verwijderd: slug, stops: stops.length, versie: await nieuweVersie(redis) };
}
