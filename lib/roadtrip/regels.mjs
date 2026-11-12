// Pure logica voor /roadtrip: geen Redis, geen React, dus los te testen.
// Lengte en hoogte zijn centimeters, gewicht is kilo's, prijzen zijn centen.

export const VERVOER = ["camper", "auto", "motor", "vlucht"];
export const SOORTEN = ["overnachting", "bezienswaardigheid", "servicepunt"];
export const STATUSSEN = ["idee", "gepland", "geboekt"];
export const REISSTATUSSEN = ["idee", "gepland", "geweest"];

// Alleen een camper heeft afmetingen die ergens niet door passen
export const heeftAfmetingen = (vervoer) => vervoer === "camper";

/**
 * Stops verdelen over dagen. Een stop zonder dag staat in de ideeënlijst.
 * Per dag is de overnachting de ankerstop: die bepaalt waar je die nacht staat.
 */
export function groepeerDagen(stops = []) {
  const ideeen = [];
  const perDag = new Map();

  for (const stop of stops) {
    if (stop?.dag === null || stop?.dag === undefined) {
      if (stop) ideeen.push(stop);
      continue;
    }
    if (!perDag.has(stop.dag)) perDag.set(stop.dag, []);
    perDag.get(stop.dag).push(stop);
  }

  const opVolgorde = (a, b) =>
    (a.volgorde ?? 0) - (b.volgorde ?? 0) ||
    String(a.gemaakt ?? "").localeCompare(String(b.gemaakt ?? ""));

  const dagen = [...perDag.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([nr, lijst]) => {
      const gesorteerd = [...lijst].sort(opVolgorde);
      return {
        nr,
        stops: gesorteerd,
        overnachting: gesorteerd.find((s) => s.soort === "overnachting") ?? null,
        rest: gesorteerd.filter((s) => s.soort !== "overnachting"),
      };
    });

  return { dagen, ideeen: ideeen.sort(opVolgorde) };
}

/**
 * Past het voertuig op deze plek? Vergelijkt de maxima die je zelf bij de stop
 * invulde met de maten van de reis. Alleen waar beide bekend zijn.
 */
export function pastVoertuig(max, voertuig) {
  const problemen = [];
  if (!max || !voertuig) return { past: true, problemen };

  const velden = [
    ["lengte", "Lengte", "cm"],
    ["hoogte", "Hoogte", "cm"],
    ["gewicht", "Gewicht", "kg"],
  ];
  for (const [sleutel, label, eenheid] of velden) {
    const grens = max[sleutel];
    const heeft = voertuig[sleutel];
    if (grens === null || grens === undefined) continue;
    if (heeft === null || heeft === undefined) continue;
    if (heeft > grens) {
      problemen.push({
        veld: sleutel,
        tekst: `${label}: ${toon(heeft, eenheid)} tegen een maximum van ${toon(grens, eenheid)}`,
      });
    }
  }
  return { past: problemen.length === 0, problemen };
}

// 640 → "6,40 m"; 3500 kg → "3.500 kg"
export function toon(waarde, eenheid) {
  if (waarde === null || waarde === undefined) return "";
  if (eenheid === "cm") return `${(waarde / 100).toFixed(2).replace(".", ",")} m`;
  return `${Number(waarde).toLocaleString("nl-NL")} kg`;
}

// Hoeveel dagen duurt de reis? Beide datums inclusief.
export function aantalDagen(van, tot) {
  if (!van || !tot) return null;
  const a = Date.parse(`${van}T00:00:00Z`);
  const b = Date.parse(`${tot}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * De stops met coördinaten omzetten naar punten in een vakje van breedte x hoogte,
 * voor het routeschetsje in het overzicht. Geeft null als er te weinig te tekenen valt.
 */
export function miniRoute(stops = [], breedte = 132, hoogte = 86, rand = 14) {
  const punten = stops
    .filter((s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lon))
    .map((s) => ({ x: s.lon, y: s.lat }));
  if (punten.length < 2) return null;

  const xs = punten.map((p) => p.x);
  const ys = punten.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Een rechte lijn (alle punten op dezelfde lengte- of breedtegraad) zou delen
  // door nul geven; dan zetten we die as in het midden.
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const vakB = breedte - rand * 2;
  const vakH = hoogte - rand * 2;

  return punten.map((p) => ({
    x: spanX === 0 ? breedte / 2 : rand + ((p.x - minX) / spanX) * vakB,
    // schermcoördinaten lopen omlaag, breedtegraden omhoog
    y: spanY === 0 ? hoogte / 2 : rand + ((maxY - p.y) / spanY) * vakH,
  }));
}

const RADIALEN = Math.PI / 180;

// Hemelsbrede afstand in kilometers
export function hemelsbreed(a, b) {
  if (!a || !b) return null;
  if (![a.lat, a.lon, b.lat, b.lon].every((n) => Number.isFinite(n))) return null;

  const R = 6371;
  const dLat = (b.lat - a.lat) * RADIALEN;
  const dLon = (b.lon - a.lon) * RADIALEN;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RADIALEN) * Math.cos(b.lat * RADIALEN) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Ruwe schatting van een rit zolang er geen routedienst is ingesteld. Wegen
 * lopen niet rechtdoor, vandaar de omweg-factor; de snelheid is een gemiddelde
 * voor een camper inclusief pauzes.
 */
export function schatEtappe(a, b, { omweg = 1.25, kmPerUur = 72 } = {}) {
  const recht = hemelsbreed(a, b);
  if (recht === null) return null;
  const km = recht * omweg;
  return { km: Math.round(km), minuten: Math.round((km / kmPerUur) * 60), schatting: true };
}

// "480 km · 4u50"
export function toonEtappe(etappe) {
  if (!etappe) return null;
  const uren = Math.floor(etappe.minuten / 60);
  const minuten = etappe.minuten % 60;
  const tijd = uren ? `${uren}u${String(minuten).padStart(2, "0")}` : `${minuten} min`;
  return `${etappe.km.toLocaleString("nl-NL")} km · ${tijd}`;
}

// Totalen voor de koptekst van een reis
export function totalen(stops = []) {
  let nachten = 0;
  let kosten = 0;
  let geboekt = 0;
  let overnachtingen = 0;

  for (const stop of stops) {
    if (stop?.soort !== "overnachting") continue;
    overnachtingen += 1;
    nachten += stop.nachten ?? 1;
    kosten += stop.prijs ?? 0;
    if (stop.status === "geboekt") geboekt += 1;
  }
  return { nachten, kosten, geboekt, overnachtingen };
}
