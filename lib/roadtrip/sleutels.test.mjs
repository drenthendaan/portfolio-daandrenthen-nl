// Borging: /roadtrip deelt de database met /pokemon, dus geen enkele sleutel van
// deze sectie mag buiten de roadtrip:-ruimte vallen. Deze test faalt zodra iemand
// er een sleutel bij zet die daar niet aan voldoet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bron = readFileSync(new URL("./server.js", import.meta.url), "utf8");

// Alle string-literals die eruitzien als een Redis-sleutel in server.js
const sleutels = [...bron.matchAll(/^export const [A-Z_]+_KEY = "([^"]+)"/gm)].map((m) => m[1]);

test("server.js definieert sleutels", () => {
  assert.ok(sleutels.length >= 4, `verwachtte meerdere sleutels, vond ${sleutels.length}`);
});

test("elke sleutel valt binnen de roadtrip-ruimte", () => {
  for (const sleutel of sleutels) {
    assert.ok(
      sleutel.startsWith("roadtrip:"),
      `"${sleutel}" valt buiten roadtrip: — dit raakt mogelijk data van een andere sectie`
    );
  }
});

test("geen enkele sleutel raakt de pokemon-ruimte", () => {
  for (const sleutel of sleutels) {
    assert.ok(!sleutel.startsWith("pokemon:"), `"${sleutel}" zit in de pokemon-ruimte`);
    assert.ok(!sleutel.startsWith("pikachu:"), `"${sleutel}" zit in de pikachu-ruimte`);
    assert.ok(!sleutel.startsWith("pk:"), `"${sleutel}" zit in de prijsruimte van pokemon`);
    assert.ok(!sleutel.startsWith("pk-dev:"), `"${sleutel}" zit in de prijsruimte van pokemon`);
  }
});

test("de roadtrip-laag importeert niets uit lib/pokemon", () => {
  const bestanden = [
    "server.js",
    "reizen.js",
    "stops.js",
    "api.js",
    "velden.mjs",
    "regels.mjs",
    "ors.js",
    "geocode.js",
  ];
  for (const naam of bestanden) {
    const inhoud = readFileSync(new URL(`./${naam}`, import.meta.url), "utf8");
    assert.ok(
      !/from\s+["'][^"']*pokemon/.test(inhoud),
      `${naam} importeert uit lib/pokemon — houd de secties los van elkaar`
    );
  }
});
