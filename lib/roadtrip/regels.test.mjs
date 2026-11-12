import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groepeerDagen,
  pastVoertuig,
  toon,
  aantalDagen,
  totalen,
  hemelsbreed,
  schatEtappe,
  toonEtappe,
  miniRoute,
} from "./regels.mjs";

const stop = (over) => ({
  id: "s1",
  reis: "italie",
  dag: 1,
  volgorde: 0,
  naam: "Ergens",
  soort: "overnachting",
  nachten: 1,
  prijs: 0,
  status: "gepland",
  gemaakt: "2026-11-12T09:00:00.000Z",
  ...over,
});

test("stops zonder dag vormen de ideeënlijst", () => {
  const { dagen, ideeen } = groepeerDagen([
    stop({ id: "a", dag: 1 }),
    stop({ id: "b", dag: null }),
    stop({ id: "c", dag: undefined }),
  ]);
  assert.equal(dagen.length, 1);
  assert.deepEqual(
    ideeen.map((s) => s.id),
    ["b", "c"]
  );
});

test("dagen komen op nummer, stops binnen een dag op volgorde", () => {
  const { dagen } = groepeerDagen([
    stop({ id: "laat", dag: 4, volgorde: 0 }),
    stop({ id: "tweede", dag: 2, volgorde: 1 }),
    stop({ id: "eerste", dag: 2, volgorde: 0 }),
  ]);
  assert.deepEqual(
    dagen.map((d) => d.nr),
    [2, 4]
  );
  assert.deepEqual(
    dagen[0].stops.map((s) => s.id),
    ["eerste", "tweede"]
  );
});

test("de eerste stop van een dag is de ankerstop", () => {
  const { dagen } = groepeerDagen([
    stop({ id: "tweede", dag: 1, volgorde: 1 }),
    stop({ id: "eerste", dag: 1, volgorde: 0 }),
  ]);
  assert.equal(dagen[0].anker.id, "eerste");
});

test("een lege lijst geeft geen dagen en geen ideeën", () => {
  assert.deepEqual(groepeerDagen([]), { dagen: [], ideeen: [] });
});

test("te lange camper op een te korte plek geeft een probleem", () => {
  const uitslag = pastVoertuig({ lengte: 700 }, { lengte: 640, hoogte: 285 });
  assert.equal(uitslag.past, true);

  const tweede = pastVoertuig({ lengte: 600 }, { lengte: 640 });
  assert.equal(tweede.past, false);
  assert.equal(tweede.problemen[0].veld, "lengte");
  assert.match(tweede.problemen[0].tekst, /6,40 m/);
  assert.match(tweede.problemen[0].tekst, /6,00 m/);
});

test("precies passen is geen probleem", () => {
  assert.equal(pastVoertuig({ hoogte: 285 }, { hoogte: 285 }).past, true);
});

test("onbekende maten geven nooit een waarschuwing", () => {
  assert.equal(pastVoertuig(null, { lengte: 640 }).past, true);
  assert.equal(pastVoertuig({ lengte: 600 }, null).past, true);
  assert.equal(pastVoertuig({ lengte: null }, { lengte: 640 }).past, true);
  assert.equal(pastVoertuig({ lengte: 600 }, { hoogte: 285 }).past, true);
});

test("meerdere problemen tegelijk", () => {
  const uitslag = pastVoertuig(
    { lengte: 600, hoogte: 280, gewicht: 3000 },
    { lengte: 640, hoogte: 285, gewicht: 3500 }
  );
  assert.equal(uitslag.problemen.length, 3);
});

test("maten tonen in meters en kilo's", () => {
  assert.equal(toon(640, "cm"), "6,40 m");
  assert.equal(toon(285, "cm"), "2,85 m");
  assert.equal(toon(null, "cm"), "");
});

test("reisduur telt beide datums mee", () => {
  assert.equal(aantalDagen("2027-07-04", "2027-07-26"), 23);
  assert.equal(aantalDagen("2027-07-04", "2027-07-04"), 1);
  assert.equal(aantalDagen("2027-07-26", "2027-07-04"), null);
  assert.equal(aantalDagen(null, "2027-07-26"), null);
});

test("totalen tellen elke stop", () => {
  const uitslag = totalen([
    stop({ nachten: 2, prijs: 4600, status: "geboekt" }),
    stop({ nachten: 3, prijs: 5800, status: "gepland" }),
    stop({ nachten: 1, prijs: 2000, status: "geboekt" }),
  ]);
  assert.deepEqual(uitslag, { nachten: 6, kosten: 12400, geboekt: 2, plekken: 3 });
});

test("een stop zonder nachten telt als één nacht", () => {
  assert.equal(totalen([stop({ nachten: null })]).nachten, 1);
});

test("hemelsbrede afstand klopt ongeveer", () => {
  // Trier → Luzern is hemelsbreed 325 km (over de weg ongeveer 390)
  const km = hemelsbreed({ lat: 49.7596, lon: 6.6439 }, { lat: 47.0502, lon: 8.3093 });
  assert.ok(km > 315 && km < 335, `verwachtte ~325, kreeg ${km}`);
  assert.equal(hemelsbreed(null, { lat: 1, lon: 1 }), null);
  assert.equal(hemelsbreed({ lat: 1, lon: null }, { lat: 1, lon: 1 }), null);
});

test("dezelfde plek geeft nul", () => {
  assert.equal(Math.round(hemelsbreed({ lat: 52, lon: 6 }, { lat: 52, lon: 6 })), 0);
});

test("etappeschatting telt een omweg mee en is als schatting gemarkeerd", () => {
  const e = schatEtappe({ lat: 49.7596, lon: 6.6439 }, { lat: 47.0502, lon: 8.3093 });
  assert.equal(e.schatting, true);
  // De echte rijafstand is ongeveer 390 km; de schatting mag daar wat boven zitten
  assert.ok(e.km > 380 && e.km < 430, `verwachtte ~405, kreeg ${e.km}`);
  assert.ok(e.minuten > 0);
});

test("etappe tonen als kilometers en tijd", () => {
  assert.equal(toonEtappe({ km: 480, minuten: 290 }), "480 km · 4u50");
  assert.equal(toonEtappe({ km: 12, minuten: 25 }), "12 km · 25 min");
  assert.equal(toonEtappe(null), null);
});

test("miniRoute vertaalt coördinaten naar het vakje", () => {
  const punten = miniRoute([
    { lat: 50, lon: 6 },
    { lat: 46, lon: 10 },
  ], 132, 86, 14);
  assert.equal(punten.length, 2);
  // noordelijkste punt staat bovenaan
  assert.ok(punten[0].y < punten[1].y);
  for (const p of punten) {
    assert.ok(p.x >= 14 && p.x <= 118, `x buiten vak: ${p.x}`);
    assert.ok(p.y >= 14 && p.y <= 72, `y buiten vak: ${p.y}`);
  }
});

test("miniRoute geeft null bij te weinig punten", () => {
  assert.equal(miniRoute([]), null);
  assert.equal(miniRoute([{ lat: 50, lon: 6 }]), null);
  assert.equal(miniRoute([{ lat: 50, lon: 6 }, { naam: "geen coords" }]), null);
});

test("miniRoute deelt niet door nul bij een rechte lijn", () => {
  const punten = miniRoute([
    { lat: 50, lon: 6 },
    { lat: 46, lon: 6 },
  ]);
  assert.ok(punten.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test("een dag met meerdere nachten beslaat een bereik", () => {
  const { dagen } = groepeerDagen([
    stop({ id: "a", dag: 1, nachten: 1 }),
    stop({ id: "b", dag: 2, nachten: 2 }),
    stop({ id: "c", dag: 4, nachten: 3 }),
  ]);
  assert.deepEqual(
    dagen.map((d) => [d.nr, d.tot]),
    [
      [1, 1],
      [2, 3],
      [4, 6],
    ]
  );
});

test("zonder nachten blijft het één dag", () => {
  const { dagen } = groepeerDagen([
    stop({ dag: 3, nachten: null }),
    stop({ dag: 5, nachten: null }),
  ]);
  assert.deepEqual(
    dagen.map((d) => [d.nr, d.tot]),
    [
      [3, 3],
      [5, 5],
    ]
  );
});

test("onzinnige nachten maken het bereik niet korter dan de dag zelf", () => {
  const { dagen } = groepeerDagen([stop({ dag: 2, nachten: 0 })]);
  assert.equal(dagen[0].tot, 2);
});
