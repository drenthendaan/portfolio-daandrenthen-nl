import { test } from "node:test";
import assert from "node:assert/strict";
import { Invoerfout } from "../invoer.mjs";
import { afmetingen, datum, getal, jaNee, keuze, koppeling, losseTekst, plek } from "./velden.mjs";

test("getal neemt komma's en rondt af", () => {
  assert.equal(getal("640", "Lengte"), 640);
  assert.equal(getal("6,4", "Lengte", { heel: false }), 6.4);
  assert.equal(getal(640.6, "Lengte"), 641);
  assert.equal(getal("", "Lengte"), null);
  assert.equal(getal(null, "Lengte"), null);
});

test("getal weigert wat buiten de grenzen valt", () => {
  assert.throws(() => getal(-1, "Lengte"), Invoerfout);
  assert.throws(() => getal("abc", "Lengte"), Invoerfout);
  assert.throws(() => getal(91, "Breedtegraad", { min: -90, max: 90 }), Invoerfout);
  assert.equal(getal(-90, "Breedtegraad", { min: -90, max: 90 }), -90);
});

test("keuze laat alleen de bekende waarden door", () => {
  assert.equal(keuze("camper", "Vervoer", ["camper", "auto"]), "camper");
  assert.throws(() => keuze("onderzeeer", "Vervoer", ["camper", "auto"]), Invoerfout);
  assert.throws(() => keuze(null, "Vervoer", ["camper"]), Invoerfout);
});

test("datum eist jjjj-mm-dd en een bestaande dag", () => {
  assert.equal(datum("2027-07-04", "Van"), "2027-07-04");
  assert.equal(datum("", "Van"), null);
  assert.throws(() => datum("04-07-2027", "Van"), Invoerfout);
  assert.throws(() => datum("2027-7-4", "Van"), Invoerfout);
  assert.throws(() => datum("2027-02-30", "Van"), Invoerfout);
  assert.throws(() => datum("2027-13-01", "Van"), Invoerfout);
});

test("datum accepteert een schrikkeldag en weigert hem in een gewoon jaar", () => {
  assert.equal(datum("2028-02-29", "Van"), "2028-02-29");
  assert.throws(() => datum("2027-02-29", "Van"), Invoerfout);
});

test("koppeling laat alleen http en https door", () => {
  assert.equal(koppeling("https://camping.example/plek", "Link"), "https://camping.example/plek");
  assert.equal(koppeling("", "Link"), null);
  assert.throws(() => koppeling("javascript:alert(1)", "Link"), Invoerfout);
  assert.throws(() => koppeling("zomaar wat tekst", "Link"), Invoerfout);
});

test("losseTekst knipt spaties weg en mag leeg zijn", () => {
  assert.equal(losseTekst("  hoi  ", "Notitie", 10), "hoi");
  assert.equal(losseTekst("   ", "Notitie", 10), null);
  assert.equal(losseTekst(null, "Notitie", 10), null);
  assert.throws(() => losseTekst("te lang", "Notitie", 3), Invoerfout);
});

test("afmetingen geeft null als alles leeg is", () => {
  assert.equal(afmetingen({ lengte: "", hoogte: null }, "Voertuig"), null);
  assert.equal(afmetingen(null, "Voertuig"), null);
  assert.deepEqual(afmetingen({ lengte: 640 }, "Voertuig"), {
    lengte: 640,
    hoogte: null,
    gewicht: null,
  });
});

test("afmetingen weigert onzinmaten", () => {
  assert.throws(() => afmetingen({ hoogte: 900 }, "Voertuig"), Invoerfout);
  assert.throws(() => afmetingen("groot", "Voertuig"), Invoerfout);
});

// ---- Betaald: ja of nee -----------------------------------------------------

test("jaNee begrijpt een vinkje en een keuzelijst", () => {
  assert.equal(jaNee(true, "Betaald"), true);
  assert.equal(jaNee(false, "Betaald"), false);
  assert.equal(jaNee("ja", "Betaald"), true);
  assert.equal(jaNee("Nee", "Betaald"), false);
  assert.equal(jaNee("true", "Betaald"), true);
});

test("niets ingevuld betekent niet betaald", () => {
  assert.equal(jaNee(null, "Betaald"), false);
  assert.equal(jaNee(undefined, "Betaald"), false);
  assert.equal(jaNee("", "Betaald"), false);
});

test("jaNee weigert iets wat geen ja of nee is", () => {
  assert.throws(() => jaNee("misschien", "Betaald"), Invoerfout);
  assert.throws(() => jaNee(3, "Betaald"), Invoerfout);
});

test("plek eist coördinaten en geeft een naam als die ontbreekt", () => {
  assert.deepEqual(plek({ naam: "Thuis", lat: "52,09", lon: 5.12 }, "Start"), {
    naam: "Thuis",
    lat: 52.09,
    lon: 5.12,
  });
  assert.deepEqual(plek({ lat: 52, lon: 5 }, "Start"), { naam: "Start", lat: 52, lon: 5 });
  assert.equal(plek(null, "Start"), null);
  assert.throws(() => plek({ naam: "Thuis" }, "Start"), Invoerfout);
  assert.throws(() => plek({ lat: 95, lon: 5 }, "Start"), Invoerfout);
  assert.throws(() => plek("Utrecht", "Start"), Invoerfout);
});
