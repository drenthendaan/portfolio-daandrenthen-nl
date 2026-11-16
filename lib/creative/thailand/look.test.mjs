import assert from "node:assert/strict";
import { test } from "node:test";
import { leesCube, schrijfCube, tetraedrisch } from "./cube.mjs";
import { hoekVerschil, naarLch, naarLineair, oklabUitLineair } from "./kleur.mjs";
import { THAILAND, bakLut, lookVoor, pasLookToe } from "./look.mjs";

const oklab = ([r, g, b]) => oklabUitLineair(naarLineair(r), naarLineair(g), naarLineair(b));
const lch = (rgb) => naarLch(oklab(rgb));
const helderheid = ([r, g, b]) => 0.2126 * naarLineair(r) + 0.7152 * naarLineair(g) + 0.0722 * naarLineair(b);
const acht = (r, g, b) => [r / 255, g / 255, b / 255];
const look = (rgb, p) => pasLookToe(rgb[0], rgb[1], rgb[2], p);

// ColorChecker-vlakken in sRGB (BabelColor-gemiddelden)
const VLAKKEN = {
  donkereHuid: acht(115, 82, 68),
  lichteHuid: acht(194, 150, 130),
  blauweLucht: acht(98, 122, 157),
  gebladerte: acht(87, 108, 67),
};

test("een grijsverloop blijft oplopen", () => {
  let vorige = -1;
  for (let i = 0; i <= 64; i++) {
    const v = i / 64;
    const y = helderheid(look([v, v, v]));
    assert.ok(y > vorige, `stap ${i}: ${y} is niet lichter dan ${vorige}`);
    vorige = y;
  }
});

test("grijze schaduwen worden groen getint, grijze lichten crème", () => {
  const [r1, g1, b1] = look([0.1, 0.1, 0.1]);
  assert.ok(g1 > r1 && g1 > b1, `schaduw ${[r1, g1, b1]}`);
  const [r2, g2, b2] = look([0.95, 0.95, 0.95]);
  assert.ok(b2 < r2 && b2 < g2, `licht ${[r2, g2, b2]}`);
});

test("zwart en wit landen op vloer en plafond", () => {
  const zwart = look([0, 0, 0]);
  const wit = look([1, 1, 1]);
  THAILAND.vloer.forEach((v, i) => assert.ok(Math.abs(zwart[i] - v) <= 3 / 255, `zwart kanaal ${i}: ${zwart[i]} vs ${v}`));
  THAILAND.plafond.forEach((v, i) => assert.ok(Math.abs(wit[i] - v) <= 6 / 255, `wit kanaal ${i}: ${wit[i]} vs ${v}`));
});

test("lucht draait richting cyaan", () => {
  const [, , h] = lch(look(VLAKKEN.blauweLucht));
  assert.ok(h >= 195 && h <= 222, `luchttint ${h}`);
});

test("gebladerte wordt gedempt maar blijft groen", () => {
  const [, Cvoor] = lch(VLAKKEN.gebladerte);
  const [, Cna, h] = lch(look(VLAKKEN.gebladerte));
  assert.ok(Cna < Cvoor, `chroma ${Cna} niet lager dan ${Cvoor}`);
  assert.ok(h >= 115 && h <= 165, `groentint ${h}`);
});

test("huid blijft warm en houdt kleur", () => {
  for (const naam of ["donkereHuid", "lichteHuid"]) {
    const [, Cvoor] = lch(VLAKKEN[naam]);
    const [, Cna, h] = lch(look(VLAKKEN[naam]));
    assert.ok(h >= 35 && h <= 75, `${naam}: tint ${h}`);
    assert.ok(Cna >= 0.5 * Cvoor, `${naam}: chroma ${Cna} van ${Cvoor}`);
  }
});

test("tinten klappen nergens om", () => {
  // Een cirkel van middenkleuren: de uitvoertint moet mee blijven draaien
  const tinten = [];
  for (let h = 0; h < 360; h += 2) {
    const r = (h * Math.PI) / 180;
    const [L, a, b] = [0.62, 0.06 * Math.cos(r), 0.06 * Math.sin(r)];
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    const srgb = lin.map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
    tinten.push(lch(look(srgb))[2]);
  }
  for (let i = 1; i < tinten.length; i++) {
    assert.ok(hoekVerschil(tinten[i - 1], tinten[i]) > -1, `bij ${i * 2}°: ${tinten[i - 1]} → ${tinten[i]}`);
  }
});

test("de 65³-LUT volgt de functie (tetraëdrisch)", () => {
  const N = 65;
  const lut = bakLut(THAILAND, N);
  let zaad = 7;
  const toeval = () => {
    zaad = (zaad * 1664525 + 1013904223) >>> 0;
    return zaad / 4294967296;
  };
  let grootste = 0;
  for (let i = 0; i < 3000; i++) {
    const rgb = [toeval(), toeval(), toeval()];
    const direct = oklab(look(rgb));
    const opgezocht = oklab(tetraedrisch(lut, N, ...rgb));
    grootste = Math.max(grootste, Math.hypot(direct[0] - opgezocht[0], direct[1] - opgezocht[1], direct[2] - opgezocht[2]));
  }
  // 0,01 in OKLab is ongeveer ΔE 1: met het oog niet te zien
  assert.ok(grootste < 0.01, `grootste afwijking ${grootste}`);
});

test(".cube schrijven en weer lezen geeft dezelfde tabel", () => {
  const N = 9;
  const lut = bakLut(THAILAND, N);
  const terug = leesCube(schrijfCube(lut, N));
  assert.equal(terug.N, N);
  assert.deepEqual(terug.min, [0, 0, 0]);
  assert.deepEqual(terug.max, [1, 1, 1]);
  for (let i = 0; i < lut.length; i++) assert.ok(Math.abs(lut[i] - terug.lut[i]) < 1e-6);
});

test("een kapotte .cube geeft een duidelijke fout", () => {
  assert.throws(() => leesCube("LUT_3D_SIZE 2\n0 0 0\n"), /klopt niet/);
});

test("sliders: sterkte 0 is het origineel, fade tilt zwart op, warmte maakt geler", () => {
  const rgb = [0.3, 0.5, 0.7];
  const uit = look(rgb, lookVoor({ sterkte: 0 }));
  uit.forEach((v, i) => assert.ok(Math.abs(v - rgb[i]) < 1e-9));

  assert.ok(look([0, 0, 0], lookVoor({ fade: 1 }))[1] > look([0, 0, 0])[1]);
  assert.ok(look([0, 0, 0], lookVoor({ fade: -1 }))[1] < look([0, 0, 0])[1]);

  const grijs = [0.5, 0.5, 0.5];
  assert.ok(oklab(look(grijs, lookVoor({ warmte: 1 })))[2] > oklab(look(grijs))[2]);
});
