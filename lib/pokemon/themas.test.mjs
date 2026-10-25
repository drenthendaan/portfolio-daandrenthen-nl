import test from "node:test";
import assert from "node:assert/strict";
import {
  japansThema,
  SECTIE_THEMA,
  themasVoor,
  themaVoorProduct,
  tijdperkVoorDatum,
} from "./themas.mjs";

test("tijdperk op uitgavedatum van de set", () => {
  assert.equal(tijdperkVoorDatum("1999-01-09"), "wizards"); // Base Set
  assert.equal(tijdperkVoorDatum("2003-06-18"), "ex"); // Ruby & Sapphire
  assert.equal(tijdperkVoorDatum("2016-11-02T00:00:00"), "bwxy"); // Evolutions
  assert.equal(tijdperkVoorDatum("2017-02-03"), "sm"); // Sun & Moon
  assert.equal(tijdperkVoorDatum("2023-03-31"), "sv"); // Scarlet & Violet
  assert.equal(tijdperkVoorDatum("2026-09-16"), "me"); // 30th Celebration
  assert.equal(tijdperkVoorDatum(""), null);
});

test("themavoorstel voor een product", () => {
  assert.equal(themaVoorProduct({ naam: "Prismatic Evolutions Elite Trainer Box", uitgave: "2025-01-17" }), "etb");
  assert.equal(themaVoorProduct({ naam: "Pikachu - 025/165", nummer: "025/165", set: "SV: Scarlet & Violet 151", uitgave: "2023-09-22" }), "sv");
  assert.equal(themaVoorProduct({ naam: "Booster Box", nummer: "", uitgave: "2023-09-22" }), "overig");
  assert.equal(
    themaVoorProduct({ naam: "Pikachu - 28/73 (Cosmos Holo)", nummer: "028/073", set: "Miscellaneous Cards & Products", uitgave: "2026-10-13" }),
    "overig"
  );
});

test("thema's per verzameling", () => {
  const pikachu = themasVoor({ id: "pikachu", themas: [{ id: "favoriet", naam: "Favoriet" }] }).map((t) => t.id);
  assert.deepEqual(pikachu.slice(0, 8), ["wizards", "ex", "dp", "bwxy", "sm", "swsh", "sv", "me"]);
  assert.deepEqual(pikachu.slice(8), ["topstukken", "etb", "overig", "favoriet"]);
  const eigen = themasVoor({ id: "eevee", themas: [] }).map((t) => t.id);
  assert.ok(!eigen.includes("topstukken"));
  assert.equal(eigen.at(-1), "overig");
  assert.equal(SECTIE_THEMA[9], "topstukken");
});

test("Japanse promo's: tijdperk op de serie", () => {
  assert.equal(japansThema("SM-P promo"), "sm");
  assert.equal(japansThema("S-P promo (zonder nummer)"), "swsh");
  assert.equal(japansThema("SV-P promo"), "sv");
  assert.equal(japansThema("XY-P promo (zonder nummer)"), "bwxy");
  assert.equal(japansThema("BW-P promo"), "bwxy");
  assert.equal(japansThema("DPt-P promo"), "dp");
  assert.equal(japansThema("L-P promo"), "dp");
  assert.equal(japansThema("11th Movie Commemoration Set"), "dp");
  assert.equal(japansThema("PCG-P promo"), "ex");
  assert.equal(japansThema("M-P promo"), "me");
  assert.equal(japansThema("Ongenummerde promo (1998)"), "overig");
  assert.equal(japansThema("P Promos"), "overig");
});
