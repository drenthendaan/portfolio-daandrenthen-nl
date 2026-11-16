// 3D-LUT's: schrijven en lezen als .cube (Adobe/Resolve), en een kleur opzoeken
// met tetraëdrische interpolatie. Dat is hetzelfde algoritme als in de shader,
// zodat Node kan narekenen wat de browser laat zien.
//
// Indeling: rood loopt het snelst, dan groen, dan blauw: index (r + g·N + b·N²)·3.

import { klem } from "./kleur.mjs";

export function schrijfCube(lut, N, titel = "Thailand") {
  const regels = [
    `TITLE "${titel}"`,
    "# daandrenthen.nl/creative/thailand-filter",
    `LUT_3D_SIZE ${N}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
  ];
  for (let i = 0; i < N * N * N * 3; i += 3) {
    regels.push(`${lut[i].toFixed(6)} ${lut[i + 1].toFixed(6)} ${lut[i + 2].toFixed(6)}`);
  }
  return `${regels.join("\n")}\n`;
}

export function leesCube(tekst) {
  let N = 0;
  let min = [0, 0, 0];
  let max = [1, 1, 1];
  const waarden = [];
  for (const ruw of tekst.split(/\r?\n/)) {
    const regel = ruw.trim();
    if (!regel || regel.startsWith("#")) continue;
    const [sleutel, ...rest] = regel.split(/\s+/);
    if (sleutel === "LUT_3D_SIZE") N = Number.parseInt(rest[0], 10);
    else if (sleutel === "DOMAIN_MIN") min = rest.map(Number);
    else if (sleutel === "DOMAIN_MAX") max = rest.map(Number);
    else if (sleutel === "LUT_1D_SIZE") throw new Error("Een 1D-LUT kan ik niet gebruiken, alleen 3D.");
    else if (/^[A-Z_]+$/.test(sleutel)) continue; // TITLE en andere sleutelwoorden
    else waarden.push(Number(sleutel), Number(rest[0]), Number(rest[1]));
  }
  if (!N || waarden.length !== N * N * N * 3 || waarden.some(Number.isNaN)) {
    throw new Error("Dit .cube-bestand klopt niet: verkeerd aantal of ongeldige waarden.");
  }
  return { N, lut: Float32Array.from(waarden), min, max };
}

// Zoekt (r, g, b) op in de LUT. `uit` mag je meegeven om allocaties te sparen.
export function tetraedrisch(lut, N, r, g, b, uit = [0, 0, 0]) {
  const s = N - 1;
  const x = klem(r) * s;
  const y = klem(g) * s;
  const z = klem(b) * s;
  const x0 = Math.min(Math.floor(x), s - 1);
  const y0 = Math.min(Math.floor(y), s - 1);
  const z0 = Math.min(Math.floor(z), s - 1);
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const plek = (xi, yi, zi) => (xi + yi * N + zi * N * N) * 3;

  const c000 = plek(x0, y0, z0);
  const c111 = plek(x0 + 1, y0 + 1, z0 + 1);
  let c1;
  let c2;
  let w0;
  let w1;
  let w2;
  let w3;
  if (fx > fy) {
    if (fy > fz) {
      c1 = plek(x0 + 1, y0, z0);
      c2 = plek(x0 + 1, y0 + 1, z0);
      w0 = 1 - fx;
      w1 = fx - fy;
      w2 = fy - fz;
      w3 = fz;
    } else if (fx > fz) {
      c1 = plek(x0 + 1, y0, z0);
      c2 = plek(x0 + 1, y0, z0 + 1);
      w0 = 1 - fx;
      w1 = fx - fz;
      w2 = fz - fy;
      w3 = fy;
    } else {
      c1 = plek(x0, y0, z0 + 1);
      c2 = plek(x0 + 1, y0, z0 + 1);
      w0 = 1 - fz;
      w1 = fz - fx;
      w2 = fx - fy;
      w3 = fy;
    }
  } else if (fz > fy) {
    c1 = plek(x0, y0, z0 + 1);
    c2 = plek(x0, y0 + 1, z0 + 1);
    w0 = 1 - fz;
    w1 = fz - fy;
    w2 = fy - fx;
    w3 = fx;
  } else if (fz > fx) {
    c1 = plek(x0, y0 + 1, z0);
    c2 = plek(x0, y0 + 1, z0 + 1);
    w0 = 1 - fy;
    w1 = fy - fz;
    w2 = fz - fx;
    w3 = fx;
  } else {
    c1 = plek(x0, y0 + 1, z0);
    c2 = plek(x0 + 1, y0 + 1, z0);
    w0 = 1 - fy;
    w1 = fy - fx;
    w2 = fx - fz;
    w3 = fz;
  }
  for (let k = 0; k < 3; k++) {
    uit[k] = w0 * lut[c000 + k] + w1 * lut[c1 + k] + w2 * lut[c2 + k] + w3 * lut[c111 + k];
  }
  return uit;
}
