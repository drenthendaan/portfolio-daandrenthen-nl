// Kleurrekenwerk voor de Thailand-look. Alle waarden lopen van 0 tot 1.
//
// Drie ruimtes:
// - sRGB-gecodeerd: wat er in een JPEG staat en wat een LUT als invoer krijgt;
// - lineair licht: waar je licht bij elkaar optelt (witbalans, gamut);
// - OKLab/OKLCH: waar je tinten draait. Afstanden kloppen daar met wat je ziet,
//   dus een tint verschuiven verandert de helderheid nauwelijks.

export function naarLineair(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function naarSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

// Tabel voor 8-bit invoer: scheelt een macht per pixel bij het meten
export const LINEAIR_8BIT = Float64Array.from({ length: 256 }, (_, i) => naarLineair(i / 255));

// Lineair sRGB → OKLab (Björn Ottosson, publiek domein)
export function oklabUitLineair(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function lineairUitOklab(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// OKLab → [L, C, h] met h in graden, 0–360
export function naarLch([L, a, b]) {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h];
}

export function uitLch(L, C, h) {
  const r = (h * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
}

// Kortste weg van tint `van` naar tint `naar`, in graden (−180 tot 180)
export function hoekVerschil(van, naar) {
  return ((((naar - van) % 360) + 540) % 360) - 180;
}

// CIELAB (D65), alleen om te meten: L* en a*/b* zijn de taal van kleurcorrectie
const WIT_X = 0.95047;
const WIT_Z = 1.08883;
const labF = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

export function labUitLineair(r, g, b) {
  const fx = labF((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WIT_X);
  const fy = labF(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const fz = labF((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WIT_Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const klem = (x, min = 0, max = 1) => (x < min ? min : x > max ? max : x);

export function smoothstep(rand0, rand1, x) {
  const t = klem((x - rand0) / (rand1 - rand0));
  return t * t * (3 - 2 * t);
}
