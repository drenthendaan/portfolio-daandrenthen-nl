// Stelt de Thailand-look af zonder browser. ImageMagick zet de testfoto's om
// (HEIC, oriëntatie, P3 → sRGB); daarna gaat de look erover via dezelfde
// 65³-LUT als op de site. Per foto komt er een voor/na en een meetrapport uit,
// plus de .cube voor de hele set.
//
//   npm run thailand:proef -- --uit <map> [--maat 1600] [--fade 0] [--warmte 0] [foto…]
//
// Zonder foto's pakt hij de IMG_*.HEIC's uit ~/Downloads. Alleen voor
// ontwikkeling: de site zelf gebruikt dit script niet.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { schrijfCube, tetraedrisch } from "../../lib/creative/thailand/cube.mjs";
import { bakLut, lookVoor, pasLookToe } from "../../lib/creative/thailand/look.mjs";
import { meet, rapport, vergelijk } from "../../lib/creative/thailand/meten.mjs";

const SRGB = process.env.SRGB_PROFIEL ?? "/System/Library/ColorSync/Profiles/sRGB Profile.icc";
const N = 65;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    uit: { type: "string" },
    maat: { type: "string", default: "1600" },
    fade: { type: "string", default: "0" },
    warmte: { type: "string", default: "0" },
    sterkte: { type: "string", default: "1" },
    controle: { type: "boolean", default: false },
    uitgebreid: { type: "boolean", default: false },
  },
});

if (!values.uit) {
  console.error("Geef een map op voor de uitvoer: --uit <map>");
  process.exit(1);
}
mkdirSync(values.uit, { recursive: true });

function standaardFotos() {
  const map = path.join(homedir(), "Downloads");
  return readdirSync(map)
    .filter((f) => /^IMG_.*\.hei[cf]$/i.test(f))
    .sort()
    .map((f) => path.join(map, f));
}

function leesPpm(buf) {
  const isWit = (c) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09;
  const velden = [];
  let pos = 0;
  while (velden.length < 4) {
    while (isWit(buf[pos])) pos++;
    if (buf[pos] === 0x23) {
      while (buf[pos] !== 0x0a) pos++;
      continue;
    }
    const begin = pos;
    while (!isWit(buf[pos])) pos++;
    velden.push(buf.toString("ascii", begin, pos));
  }
  pos++;
  const [soort, breedte, hoogte, max] = velden;
  if (soort !== "P6" || max !== "255") throw new Error(`Onverwachte PPM-kop: ${velden.join(" ")}`);
  const b = Number(breedte);
  const h = Number(hoogte);
  return { breedte: b, hoogte: h, data: new Uint8Array(buf.buffer, buf.byteOffset + pos, b * h * 3) };
}

function laad(bestand, maat) {
  const buf = execFileSync(
    "magick",
    [bestand, "-auto-orient", "-resize", `${maat}x${maat}>`, "-profile", SRGB, "-depth", "8", "ppm:-"],
    { maxBuffer: 1 << 30 },
  );
  return leesPpm(buf);
}

function schrijfJpeg(beeld, bestand) {
  const kop = Buffer.from(`P6\n${beeld.breedte} ${beeld.hoogte}\n255\n`, "ascii");
  execFileSync("magick", ["ppm:-", "-quality", "90", bestand], { input: Buffer.concat([kop, Buffer.from(beeld.data)]) });
}

function pasToe(beeld, lut) {
  const { data } = beeld;
  const uit = new Uint8Array(data.length);
  const kleur = [0, 0, 0];
  let zaad = 12345;
  const toeval = () => {
    zaad = (zaad * 1664525 + 1013904223) >>> 0;
    return zaad / 4294967296;
  };
  for (let i = 0; i < data.length; i += 3) {
    tetraedrisch(lut, N, data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, kleur);
    for (let k = 0; k < 3; k++) {
      // Driehoeksruis van ±1 niveau tegen banding, net als de shader straks
      const v = Math.round(kleur[k] * 255 + toeval() - toeval());
      uit[i + k] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return { ...beeld, data: uit };
}

const instellingen = lookVoor({
  fade: Number(values.fade),
  warmte: Number(values.warmte),
  sterkte: Number(values.sterkte),
});
const lut = bakLut(instellingen, N);
writeFileSync(path.join(values.uit, "thailand.cube"), schrijfCube(bakLut(instellingen, 33), 33));

// Voor de tweede mening: de look als Hald-CLUT (niveau 8 = 64³) via ImageMagicks
// eigen identiteits-Hald. ImageMagicks cube:-lezer is daarvoor te grof (een
// identiteits-.cube wijkt al ~8/255 af); de Hald-route is exact.
function maakHald(bestand) {
  const ruw = execFileSync("magick", ["hald:8", "-depth", "16", "-endian", "MSB", "rgb:-"], { maxBuffer: 1 << 26 });
  const uit = Buffer.alloc(ruw.length);
  const naar16 = (v) => Math.round(Math.min(Math.max(v, 0), 1) * 65535);
  for (let i = 0; i < ruw.length; i += 6) {
    const [r, g, b] = pasLookToe(ruw.readUInt16BE(i) / 65535, ruw.readUInt16BE(i + 2) / 65535, ruw.readUInt16BE(i + 4) / 65535, instellingen);
    uit.writeUInt16BE(naar16(r), i);
    uit.writeUInt16BE(naar16(g), i + 2);
    uit.writeUInt16BE(naar16(b), i + 4);
  }
  execFileSync("magick", ["-size", "512x512", "-depth", "16", "-endian", "MSB", "rgb:-", bestand], { input: uit });
}
const hald = path.join(values.uit, "thailand-hald8.png");
if (values.controle) maakHald(hald);

const fotos = positionals.length ? positionals : standaardFotos();
const uitslagen = [];
for (const foto of fotos) {
  const naam = path.basename(foto).replace(/\.[^.]+$/, "");
  const voor = laad(foto, values.maat);
  const na = pasToe(voor, lut);
  const voorJpg = path.join(values.uit, `${naam}-voor.jpg`);
  const naJpg = path.join(values.uit, `${naam}-thailand.jpg`);
  schrijfJpeg(voor, voorJpg);
  schrijfJpeg(na, naJpg);
  execFileSync("magick", [voorJpg, naJpg, "-resize", "x900", "+append", "-quality", "85", path.join(values.uit, `${naam}-voorna.jpg`)]);

  const origineel = meet(voor.data, { kanalen: 3, stap: 3 });
  const meting = meet(na.data, { kanalen: 3, stap: 3 });
  const toetsen = vergelijk(meting, origineel);
  if (values.uitgebreid) console.log(`\n${rapport(meting, `${naam}: na het filter`)}`);
  else console.log(`\n== ${naam}`);
  for (const t of toetsen) console.log(`  ${t.ok ? "✓" : "✗"} ${t.naam}: ${t.waarde}  (doel ${t.doel})`);
  uitslagen.push({ naam, goed: toetsen.filter((t) => t.ok).length, van: toetsen.length });

  if (values.controle) {
    // Tweede mening: ImageMagick past de look zelf toe op dezelfde foto
    const imJpg = path.join(values.uit, `${naam}-imagemagick.jpg`);
    execFileSync("magick", [voorJpg, hald, "-hald-clut", "-quality", "90", imJpg]);
    // compare geeft exitcode 1 zodra beelden verschillen; het getal staat op stderr
    const { stderr } = spawnSync("magick", ["compare", "-metric", "MAE", naJpg, imJpg, "null:"], { encoding: "utf8" });
    const genormaliseerd = Number(/\(([\d.e-]+)\)/.exec(stderr)?.[1]);
    console.log(`  ImageMagick (Hald 64³) vs onze LUT: gemiddeld ${(genormaliseerd * 255).toFixed(2)}/255 verschil`);
  }
}

console.log("\nSamenvatting");
for (const u of uitslagen) console.log(`  ${u.naam}: ${u.goed}/${u.van} toetsen binnen de meetlat`);
console.log(`\nUitvoer: ${values.uit}`);
