// De "vingerafdruk" van een look: waar zwart en wit landen, welke kleurzweem
// elk toonbereik heeft, waar lucht en groen heen gaan en hoe verzadigd het is.
// REFERENTIE is gemeten op de fjord-wallpaper uit het Pinterest-voorbeeld. Meet
// je een gefilterde foto, dan laat `vergelijk` zien of die in de buurt komt.

import { LINEAIR_8BIT, labUitLineair, oklabUitLineair } from "./kleur.mjs";

const BANDEN = [
  [0, 20],
  [20, 35],
  [35, 50],
  [50, 65],
  [65, 80],
  [80, 101],
];

const SECTOREN = [
  ["rood/oranje", 15, 75],
  ["geel", 75, 115],
  ["groen", 115, 165],
  ["teal/cyaan", 165, 220],
  ["blauw", 220, 290],
];

export const REFERENTIE = Object.freeze({
  zwart: [49, 66, 56], // gemiddelde van de donkerste 2%
  wit: [213, 215, 198], // gemiddelde van de helderste 2%
  p05: [33, 54, 33],
  p995: [218, 218, 202],
  luchtTint: 208,
  groen: { tint: 151, C: 0.04 },
  chromaP90: 0.064,
  Lsd: 14.4,
  warmTint: 62,
});

function percentiel(gesorteerd, p) {
  if (!gesorteerd.length) return Number.NaN;
  const k = ((gesorteerd.length - 1) * p) / 100;
  const i = Math.floor(k);
  const j = Math.min(i + 1, gesorteerd.length - 1);
  return gesorteerd[i] + (gesorteerd[j] - gesorteerd[i]) * (k - i);
}

const tintVan = (a, b) => {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
};

function nieuweSom() {
  return { n: 0, L: 0, C: 0, a: 0, b: 0 };
}

function telOp(som, L, C, a, b) {
  som.n++;
  som.L += L;
  som.C += C;
  som.a += a;
  som.b += b;
}

function gemiddelde(som, totaal) {
  if (!som.n) return null;
  return {
    aandeel: totaal ? som.n / totaal : 0,
    L: som.L / som.n,
    C: som.C / som.n,
    tint: tintVan(som.a / som.n, som.b / som.n),
  };
}

// pixels: Uint8(Clamped)Array met RGB of RGBA. `stap` slaat pixels over voor snelheid.
export function meet(pixels, { kanalen = 4, stap = 1 } = {}) {
  const totaal = Math.floor(pixels.length / kanalen);
  const n = Math.ceil(totaal / stap);
  const R = new Uint8Array(n);
  const G = new Uint8Array(n);
  const B = new Uint8Array(n);
  const Ls = new Float32Array(n);
  const As = new Float32Array(n);
  const Bs = new Float32Array(n);
  const oL = new Float32Array(n);
  const oA = new Float32Array(n);
  const oB = new Float32Array(n);
  const oC = new Float32Array(n);
  const oH = new Float32Array(n);

  for (let p = 0, k = 0; p < totaal; p += stap, k++) {
    const i = p * kanalen;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    R[k] = r;
    G[k] = g;
    B[k] = b;
    const lr = LINEAIR_8BIT[r];
    const lg = LINEAIR_8BIT[g];
    const lb = LINEAIR_8BIT[b];
    const lab = labUitLineair(lr, lg, lb);
    Ls[k] = lab[0];
    As[k] = lab[1];
    Bs[k] = lab[2];
    const ok = oklabUitLineair(lr, lg, lb);
    oL[k] = ok[0];
    oA[k] = ok[1];
    oB[k] = ok[2];
    oC[k] = Math.hypot(ok[1], ok[2]);
    oH[k] = tintVan(ok[1], ok[2]);
  }

  const Lsort = Float32Array.from(Ls).sort();
  const gemL = Ls.reduce((s, v) => s + v, 0) / n;
  const sdL = Math.sqrt(Ls.reduce((s, v) => s + (v - gemL) ** 2, 0) / n);
  const kanaal = (arr) => {
    const s = Uint8Array.from(arr).sort();
    return { p05: percentiel(s, 0.5), p2: percentiel(s, 2), p50: percentiel(s, 50), p98: percentiel(s, 98), p995: percentiel(s, 99.5) };
  };

  // Toonbanden: gemiddelde kleurzweem, en apart die van (bijna) grijze pixels
  const banden = BANDEN.map(([van, tot]) => ({ van, tot, n: 0, a: 0, b: 0, rgb: [0, 0, 0], grijs: { n: 0, a: 0, b: 0, oa: 0, ob: 0 } }));
  const sectoren = SECTOREN.map(([naam, van, tot]) => ({ naam, van, tot, alles: nieuweSom(), donker: nieuweSom(), licht: nieuweSom() }));
  const lucht = nieuweSom();
  const warm = nieuweSom();
  let kleurig = 0;

  const grensDonker = percentiel(Lsort, 2);
  const grensLicht = percentiel(Lsort, 98);
  const donkerste = { n: 0, rgb: [0, 0, 0], a: 0, b: 0 };
  const helderste = { n: 0, rgb: [0, 0, 0], a: 0, b: 0 };

  for (let k = 0; k < n; k++) {
    const band = banden.find((bd) => Ls[k] >= bd.van && Ls[k] < bd.tot) ?? banden[banden.length - 1];
    band.n++;
    band.a += As[k];
    band.b += Bs[k];
    band.rgb[0] += R[k];
    band.rgb[1] += G[k];
    band.rgb[2] += B[k];
    if (oC[k] < 0.035) {
      band.grijs.n++;
      band.grijs.a += As[k];
      band.grijs.b += Bs[k];
      band.grijs.oa += oA[k];
      band.grijs.ob += oB[k];
    }
    if (oC[k] > 0.03) {
      kleurig++;
      const sector = sectoren.find((s) => oH[k] >= s.van && oH[k] < s.tot);
      if (sector) {
        telOp(sector.alles, oL[k], oC[k], oA[k], oB[k]);
        if (oL[k] < 0.5) telOp(sector.donker, oL[k], oC[k], oA[k], oB[k]);
        if (oL[k] > 0.65) telOp(sector.licht, oL[k], oC[k], oA[k], oB[k]);
      }
    }
    if (oC[k] > 0.025 && oH[k] >= 170 && oH[k] < 290 && oL[k] > 0.6) telOp(lucht, oL[k], oC[k], oA[k], oB[k]);
    if (oC[k] > 0.03 && oC[k] < 0.2 && oH[k] >= 30 && oH[k] < 85 && oL[k] > 0.35 && oL[k] < 0.9) {
      telOp(warm, oL[k], oC[k], oA[k], oB[k]);
    }
    for (const [uiterste, hoort] of [
      [donkerste, Ls[k] <= grensDonker],
      [helderste, Ls[k] >= grensLicht],
    ]) {
      if (!hoort) continue;
      uiterste.n++;
      uiterste.rgb[0] += R[k];
      uiterste.rgb[1] += G[k];
      uiterste.rgb[2] += B[k];
      uiterste.a += As[k];
      uiterste.b += Bs[k];
    }
  }

  const rond = (u) => ({
    rgb: u.rgb.map((v) => Math.round(v / u.n)),
    a: u.a / u.n,
    b: u.b / u.n,
  });

  return {
    aantal: n,
    L: {
      p05: percentiel(Lsort, 0.5),
      p2: percentiel(Lsort, 2),
      p50: percentiel(Lsort, 50),
      p98: percentiel(Lsort, 98),
      p995: percentiel(Lsort, 99.5),
      gem: gemL,
      sd: sdL,
    },
    kanalen: { R: kanaal(R), G: kanaal(G), B: kanaal(B) },
    banden: banden
      .filter((bd) => bd.n)
      .map((bd) => ({
        van: bd.van,
        tot: bd.tot,
        aandeel: bd.n / n,
        a: bd.a / bd.n,
        b: bd.b / bd.n,
        rgb: bd.rgb.map((v) => Math.round(v / bd.n)),
        grijs: bd.grijs.n
          ? { n: bd.grijs.n, a: bd.grijs.a / bd.grijs.n, b: bd.grijs.b / bd.grijs.n, tint: tintVan(bd.grijs.oa, bd.grijs.ob) }
          : null,
      })),
    sectoren: Object.fromEntries(
      sectoren.map((s) => [
        s.naam,
        { ...gemiddelde(s.alles, kleurig), donker: gemiddelde(s.donker, s.alles.n), licht: gemiddelde(s.licht, s.alles.n) },
      ]),
    ),
    chroma: (() => {
      const s = Float32Array.from(oC).sort();
      return { p50: percentiel(s, 50), p90: percentiel(s, 90), p99: percentiel(s, 99) };
    })(),
    donkerste: rond(donkerste),
    helderste: rond(helderste),
    lucht: gemiddelde(lucht, n),
    warm: gemiddelde(warm, n),
  };
}

// Toetst een meting aan de look van de referentie. Alleen wat er in de foto zit
// telt mee: zonder lucht geen luchttoets. Geef je de meting van het origineel
// mee, dan tellen verzadiging en contrast relatief: een heiige foto heeft nu
// eenmaal minder kleur dan een fjord in de zon.
export function vergelijk(m, origineel = null) {
  const toetsen = [];
  const toets = (naam, waarde, doel, ok) => toetsen.push({ naam, waarde, doel, ok });
  const { R, G, B } = m.kanalen;

  toets("zwartpunt p0.5", `${R.p05.toFixed(0)}/${G.p05.toFixed(0)}/${B.p05.toFixed(0)}`, "R 20–60, G 35–75, B 20–65",
    R.p05 >= 20 && R.p05 <= 60 && G.p05 >= 35 && G.p05 <= 75 && B.p05 >= 20 && B.p05 <= 65);
  const [zr, zg, zb] = m.donkerste.rgb;
  toets("zwart groen getint", `G−R ${zg - zr}, G−B ${zg - zb}`, "G−R ≥ 6, G−B ≥ 0", zg - zr >= 6 && zg - zb >= 0);
  const hoogste = Math.max(R.p995, G.p995, B.p995);
  toets("wit afgetopt", `max p99.5 ${hoogste.toFixed(0)}`, "≤ 228", hoogste <= 228);

  const grijzeBanden = m.banden.filter((bd) => bd.aandeel >= 0.02 && bd.grijs && bd.grijs.n >= 200);
  const groenGrijs = grijzeBanden.every((bd) => bd.grijs.a < -1.5);
  toets("groene zweem in grijs", grijzeBanden.map((bd) => bd.grijs.a.toFixed(1)).join(" "), "a* < −1.5 per band", groenGrijs);

  if (m.lucht && m.lucht.aandeel >= 0.02) {
    toets("lucht cyaan", `${m.lucht.tint.toFixed(0)}° C ${m.lucht.C.toFixed(3)} L ${m.lucht.L.toFixed(2)}`, "198–218°", m.lucht.tint >= 198 && m.lucht.tint <= 218);
  }
  const groen = m.sectoren.groen;
  if (groen?.aandeel >= 0.02) {
    toets("groen gedempt", `${groen.tint.toFixed(0)}° C ${groen.C.toFixed(3)}`, "120–165°, C ≤ 0,065", groen.tint >= 120 && groen.tint <= 165 && groen.C <= 0.065);
  }
  if (origineel) {
    const v = m.chroma.p90 / origineel.chroma.p90;
    toets("verzadiging", `p90 ${m.chroma.p90.toFixed(3)} (×${v.toFixed(2)})`, "×0,55–0,85 van het origineel", v >= 0.55 && v <= 0.85);
    const c = m.L.sd / origineel.L.sd;
    toets("contrast", `L* sd ${m.L.sd.toFixed(1)} (×${c.toFixed(2)})`, "×0,70–0,92 van het origineel", c >= 0.7 && c <= 0.92);
  } else {
    toets("verzadiging", `p90 ${m.chroma.p90.toFixed(3)}`, "0,045–0,080", m.chroma.p90 >= 0.045 && m.chroma.p90 <= 0.08);
    toets("contrast", `L* sd ${m.L.sd.toFixed(1)}`, "9–18", m.L.sd >= 9 && m.L.sd <= 18);
  }
  if (m.warm && m.warm.aandeel >= 0.01) {
    toets("warm blijft warm", `${m.warm.tint.toFixed(0)}°`, "40–80°", m.warm.tint >= 40 && m.warm.tint <= 80);
  }
  return toetsen;
}

export function rapport(m, titel = "") {
  const f1 = (x) => (x == null || Number.isNaN(x) ? "–" : x.toFixed(1));
  const f3 = (x) => (x == null || Number.isNaN(x) ? "–" : x.toFixed(3));
  const regels = [];
  if (titel) regels.push(`== ${titel}`);
  regels.push(`L*: p0.5 ${f1(m.L.p05)}  p50 ${f1(m.L.p50)}  p99.5 ${f1(m.L.p995)}  sd ${f1(m.L.sd)}`);
  regels.push(`zwart (2%) ${m.donkerste.rgb.join(",")}   wit (2%) ${m.helderste.rgb.join(",")}`);
  regels.push("band     aandeel  a*     b*    | grijs a*  b*   tint");
  for (const bd of m.banden) {
    const g = bd.grijs ? `${f1(bd.grijs.a).padStart(6)} ${f1(bd.grijs.b).padStart(5)} ${bd.grijs.tint.toFixed(0).padStart(4)}°` : "     –";
    regels.push(`${`${bd.van}-${bd.tot}`.padEnd(8)} ${(bd.aandeel * 100).toFixed(1).padStart(5)}% ${f1(bd.a).padStart(6)} ${f1(bd.b).padStart(6)} |${g}`);
  }
  for (const [naam, s] of Object.entries(m.sectoren)) {
    if (!s.aandeel) continue;
    regels.push(`${naam.padEnd(12)} ${(s.aandeel * 100).toFixed(1).padStart(5)}%  tint ${s.tint.toFixed(0).padStart(3)}°  C ${f3(s.C)}  L ${f3(s.L)}`);
  }
  if (m.lucht) regels.push(`lucht: tint ${m.lucht.tint.toFixed(0)}°  C ${f3(m.lucht.C)}  (${(m.lucht.aandeel * 100).toFixed(1)}%)`);
  if (m.warm) regels.push(`warm:  tint ${m.warm.tint.toFixed(0)}°  C ${f3(m.warm.C)}  (${(m.warm.aandeel * 100).toFixed(1)}%)`);
  regels.push(`chroma p50 ${f3(m.chroma.p50)}  p90 ${f3(m.chroma.p90)}  p99 ${f3(m.chroma.p99)}`);
  return regels.join("\n");
}
