// De Thailand-look als één kleurfunctie: sRGB erin, sRGB eruit (0–1).
//
// Opbouw, zoals filmemulatie dat doet:
// 1. witbalans (slider Warmte) in lineair licht;
// 2. een filmcurve per kanaal met een zachte toe en shoulder, zonder echt zwart
//    of echt wit. Elk kanaal heeft een eigen vloer en plafond, dus schaduwen
//    krijgen een andere kleur dan lichten (film-"crossover"): groen getinte
//    zwarten, crème lichten;
// 3. een OKLCH-stap per tint: lucht naar cyaan, groen splitst in teal (donker)
//    en olijf (licht), alles minder verzadigd, verzadigde kleuren iets donkerder
//    (dichtheid). Wat er met een pixel gebeurt hangt af van wat hij wás: grijs
//    blijft grijs en huid blijft huid;
// 4. terug naar sRGB binnen het gamut, en mengen met het origineel (Sterkte).
//
// Grain, glow en vignet zijn ruimtelijk en zitten niet hier maar in de shader.
// Deze functie wordt in een 3D-LUT gebakken; die LUT stuurt de shader aan en is
// ook de .cube-export.

import {
  hoekVerschil,
  klem,
  lineairUitOklab,
  naarLch,
  naarLineair,
  naarSrgb,
  oklabUitLineair,
  smoothstep,
  uitLch,
} from "./kleur.mjs";

export const THAILAND = Object.freeze({
  // Filmcurve, per kanaal R/G/B, in sRGB-gecodeerde waarden.
  // Gemeten op de wallpaper: zwart ≈ (44, 52, 40) olijfgroen, wit ≈ (222, 223, 207) crème.
  vloer: [0.115, 0.15, 0.12],
  plafond: [0.875, 0.88, 0.82],
  gamma: [0.97, 0.955, 0.97], // < 1 tilt de middentonen van dat kanaal op
  s: 0.3, // hoeveel S-curve: 0 = recht, 1 = volle smoothstep
  verzadiging: 1.1, // de curve drukt kleur samen; dit geeft een deel terug

  // Tintkaart: invoertint → uitvoertint (OKLCH-graden). Oplopend, dus er
  // klappen nooit twee tinten over elkaar heen.
  tintKaart: [
    [25, 25], // rood
    [55, 55], // oranje, huid, rots: blijft staan
    [95, 100], // geel iets richting groen
    [135, 146], // groen richting blauwgroen; licht/donker regelt `groen`
    [195, 203], // cyaan, water
    [250, 215], // blauw, lucht: teal-blauw (diepe lucht in het voorbeeld: 216°)
    [280, 226], // lavendelblauw (heiige telefoonlucht) wordt lichtblauw
    [315, 300], // paars richting blauw
    [345, 342], // magenta
  ],
  // Groen splitst op helderheid: donker groen richting teal, zonnig groen richting olijf
  groen: { h: 135, k: 3, donker: 8, licht: -10, van: 0.35, tot: 0.75 },
  // Lucht: film maakt hem lichter dan een telefoon, en hij krijgt minder van de
  // groene filmtint, anders wordt een bleke lucht mintgroen
  lucht: { h: 255, k: 2, licht: 0.04, minderTint: 0.9 },

  // Chroma-factor per invoertint (vloeiend tussen de punten)
  chroma: [
    [25, 0.95],
    [55, 1.0],
    [95, 0.8],
    [135, 0.65],
    [195, 0.95],
    [250, 0.8],
    [300, 0.75],
    [340, 0.8],
  ],
  chromaBreedte: 4,
  chromaMax: 0.13, // zacht plafond: daarboven wordt chroma steeds harder afgeremd
  dichtheid: 0.3, // verzadigde kleuren worden zoveel donkerder…
  dichtheidVanaf: 0.06, // …boven deze chroma

  // Kleine extra tint in OKLab (a, b), bovenop wat de curve al doet
  splitSchaduw: [0, 0],
  splitLicht: [0, 0.006],

  // Huid en warme tinten houden hun eigen tint en het grootste deel van hun kleur
  huid: { h: 58, k: 4, sterkte: 0.8, chroma: 0.9, minderTint: 0.6 },
});

// Monotone kubische interpolatie (Fritsch–Carlson) over de tintcirkel
const kaarten = new WeakMap();

function kaartVoor(punten) {
  let kaart = kaarten.get(punten);
  if (kaart) return kaart;

  const xs = [];
  const ys = [];
  for (const ronde of [-1, 0, 1]) {
    for (const [x, y] of punten) {
      xs.push(x + 360 * ronde);
      ys.push(y + 360 * ronde);
    }
  }
  const m = xs.length;
  const d = [];
  for (let i = 0; i < m - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const t = new Array(m);
  t[0] = d[0];
  t[m - 1] = d[m - 2];
  for (let i = 1; i < m - 1; i++) t[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < m - 1; i++) {
    if (d[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / d[i];
    const b = t[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * d[i];
      t[i + 1] = tau * b * d[i];
    }
  }

  kaart = (h) => {
    let lo = 0;
    let hi = m - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= h) lo = mid;
      else hi = mid;
    }
    const dx = xs[hi] - xs[lo];
    const u = (h - xs[lo]) / dx;
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * ys[lo] +
      (u3 - 2 * u2 + u) * dx * t[lo] +
      (-2 * u3 + 3 * u2) * ys[hi] +
      (u3 - u2) * dx * t[hi]
    );
  };
  kaarten.set(punten, kaart);
  return kaart;
}

// Von Mises-venster: 1 op de tint zelf, zakt glad weg naarmate je verder draait
const venster = (h, midden, k) => Math.exp(k * (Math.cos(((h - midden) * Math.PI) / 180) - 1));

function chromaFactor(h, punten, k) {
  let som = 0;
  let factor = 0;
  for (const [midden, c] of punten) {
    const w = venster(h, midden, k);
    som += w;
    factor += w * c;
  }
  return factor / som;
}

function groenVerschuiving(h, L, groen) {
  const richting = groen.donker + (groen.licht - groen.donker) * smoothstep(groen.van, groen.tot, L);
  return venster(h, groen.h, groen.k) * richting;
}

function huidGewicht([L, C, h], huid) {
  return (
    venster(h, huid.h, huid.k) *
    smoothstep(0.012, 0.04, C) *
    (1 - smoothstep(0.16, 0.22, C)) *
    smoothstep(0.3, 0.45, L) *
    (1 - smoothstep(0.9, 0.97, L))
  );
}

function filmcurve(v, kanaal, p) {
  const x = klem(v) ** p.gamma[kanaal];
  const y = x + p.s * (x * x * (3 - 2 * x) - x);
  return p.vloer[kanaal] + (p.plafond[kanaal] - p.vloer[kanaal]) * y;
}

const binnenGamut = (lin) =>
  lin[0] >= -1e-7 && lin[0] <= 1 + 1e-7 && lin[1] >= -1e-7 && lin[1] <= 1 + 1e-7 && lin[2] >= -1e-7 && lin[2] <= 1 + 1e-7;

// Valt een kleur buiten sRGB, dan gaat er chroma af tot hij past: helderheid en
// tint blijven staan. Hard afkappen per kanaal zou de tint laten verspringen.
function lineairBinnenGamut(L, C, h) {
  const l = klem(L);
  const probeer = (c) => lineairUitOklab(...uitLch(l, c, h));
  const lin = probeer(C);
  if (binnenGamut(lin)) return lin;
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (binnenGamut(probeer(mid))) lo = mid;
    else hi = mid;
  }
  return probeer(lo).map((c) => klem(c));
}

export function pasLookToe(r, g, b, p = THAILAND) {
  // 1. Witbalans in lineair licht
  const w = p.warmte ?? 0;
  const lin0 = [
    klem(naarLineair(r) * (1 + 0.12 * w)),
    klem(naarLineair(g)),
    klem(naarLineair(b) * (1 - 0.12 * w)),
  ];
  const invoer = naarLch(oklabUitLineair(lin0[0], lin0[1], lin0[2]));

  // 2. Filmcurve per kanaal, op de pixel én op grijs van dezelfde helderheid.
  //    Wat de curve van grijs maakt is de filmtint (groen in de schaduw, crème in
  //    de lichten). Wat de pixel daarbovenop heeft is zijn eigen kleur; alleen
  //    díe wordt gedraaid en gedempt. Zo zitten tint en kleur elkaar niet in de weg.
  const curve = (lin) => oklabUitLineair(...lin.map((c, i) => naarLineair(filmcurve(naarSrgb(c), i, p))));
  const [Lc, ac, bc] = curve(lin0);
  const Y = 0.2126729 * lin0[0] + 0.7151522 * lin0[1] + 0.072175 * lin0[2];
  const [, tintA, tintB] = curve([Y, Y, Y]);
  let [, C, h] = naarLch([0, ac - tintA, bc - tintB]);

  // 3. Eigen kleur, gestuurd door de tint die de pixel had. De tintkaart zegt
  //    waar een tint eindigt: een lucht van 250° landt op 212°.
  const kleurig = smoothstep(0.004, 0.02, invoer[1]); // grijs heeft geen tint om te draaien
  const kaart = kaartVoor(p.tintKaart);
  const doel = kaart(invoer[2]) + groenVerschuiving(invoer[2], Lc, p.groen);
  h += kleurig * hoekVerschil(h, doel);
  C *= p.verzadiging * chromaFactor(invoer[2], p.chroma, p.chromaBreedte);
  C = p.chromaMax * Math.tanh(C / p.chromaMax);
  const lucht = smoothstep(0.005, 0.025, invoer[1]) * venster(invoer[2], p.lucht.h, p.lucht.k);
  let L = Lc + p.lucht.licht * lucht;
  L -= p.dichtheid * Math.max(invoer[1] - p.dichtheidVanaf, 0);

  // Huid en warme tinten: eigen tint terug, kleur grotendeels houden, en minder
  // van de groene filmtint, zodat niemand groenig wordt
  const huid = huidGewicht(invoer, p.huid) * p.huid.sterkte;
  h += huid * hoekVerschil(h, invoer[2]);
  C += huid * (p.huid.chroma * invoer[1] - C);
  const tint = Math.max(0, 1 - p.huid.minderTint * huid - p.lucht.minderTint * lucht);

  let [, a, bb] = uitLch(L, C, h);
  a += tintA * tint;
  bb += tintB * tint;
  const schaduw = 1 - smoothstep(0.2, 0.6, L);
  const licht = smoothstep(0.6, 0.95, L);
  a += p.splitSchaduw[0] * schaduw + p.splitLicht[0] * licht;
  bb += p.splitSchaduw[1] * schaduw + p.splitLicht[1] * licht;
  const [Lf, Cf, hf] = naarLch([L, a, bb]);

  // 4. Terug naar sRGB en mengen met het origineel
  const uit = lineairBinnenGamut(Lf, Cf, hf).map(naarSrgb);
  const st = p.sterkte ?? 1;
  return [r + (uit[0] - r) * st, g + (uit[1] - g) * st, b + (uit[2] - b) * st];
}

// De kleur-sliders schuiven aan de look; Grain en Glow zitten in de shader.
// fade en warmte lopen van −1 tot 1, sterkte van 0 tot 1.
export function lookVoor({ sterkte = 1, warmte = 0, fade = 0 } = {}, basis = THAILAND) {
  const f = klem(fade, -1, 1);
  return {
    ...basis,
    vloer: basis.vloer.map((v) => v * (1 + 0.8 * f)),
    plafond: basis.plafond.map((v) => 1 - (1 - v) * (1 + 0.6 * f)),
    warmte: klem(warmte, -1, 1),
    sterkte: klem(sterkte, 0, 1),
  };
}

// N×N×N-tabel, rood loopt het snelst (zoals in .cube en in een WebGL-3D-texture)
export function bakLut(p = THAILAND, N = 33) {
  const lut = new Float32Array(N * N * N * 3);
  const stap = 1 / (N - 1);
  let i = 0;
  for (let bi = 0; bi < N; bi++) {
    for (let gi = 0; gi < N; gi++) {
      for (let ri = 0; ri < N; ri++) {
        const [r, g, b] = pasLookToe(ri * stap, gi * stap, bi * stap, p);
        lut[i++] = r;
        lut[i++] = g;
        lut[i++] = b;
      }
    }
  }
  return lut;
}
