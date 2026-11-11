// Eenmalig: maakt de verzameling "30th Celebration" (masterset: 161 kaarten + Classic Collection,
// in setvolgorde in een Vault X 9-pocket donkergroen) en zet alle 191 kaarten erin.
//   - Losse kaarten uit de set (zonder verzameling) verhuizen naar deze binder.
//   - Pikachu's die je 2× of vaker hebt: 1 exemplaar gaat (afgevinkt) naar deze binder.
//   - De rest komt erbij als nog niet afgevinkt.
// Proef: node --env-file=.env.local scripts/pokemon/maak-30th-celebration.mjs
// Echt:  node --env-file=.env.local scripts/pokemon/maak-30th-celebration.mjs --schrijf
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";
const SCHRIJF = process.argv.includes("--schrijf");
// Per kaart: TCGdex-id, naam, nummer, TCGplayer- en Cardmarket-product, plaatje en trendprijs (11 nov)
const plan = JSON.parse(fs.readFileSync(new URL("./30th-celebration.json", import.meta.url)));
const r = Redis.fromEnv();
const VID = "30th-celebration";
const nu = new Date();
const [verz, hash, omgezet] = await Promise.all([r.hgetall("pokemon:verzamelingen"), r.hgetall("pokemon:items"), r.get("pokemon:items:vast-omgezet")]);
if (!omgezet) throw new Error("items nog niet omgezet");
if (verz?.[VID]) throw new Error("verzameling bestaat al");
const items = Object.values(hash);
const verzameling = {
  id: VID, naam: "30th Celebration", verborgen: [], gemaakt: nu.toISOString(),
  binder: { type: "vaultx-9-donkergroen" },
  themas: [
    { id: "hoofdset", naam: "Hoofdset (001–128)", kort: "Hoofdset" },
    { id: "secret", naam: "Secret rares (129–158 en de Mews)", kort: "Secret rares" },
    { id: "classic", naam: "Classic Collection", kort: "Classic Collection" },
  ],
};
const schrijf = {};
const log = { verplaatst: [], gesplitst: [], nieuwOntbreekt: [], nieuw: 0 };
plan.forEach((p, n) => {
  const map = `${Math.floor(n / 9) + 1}.${(n % 9) + 1}`;
  const thema = p.sub === "cc" ? "classic" : /^\d+$/.test(p.dex.split("-").pop()) && Number(p.dex.split("-").pop()) <= 128 ? "hoofdset" : "secret";
  const los = items.find((i) => i.cm?.id === p.cm && !i.verzameling && !schrijf[i.id]);
  const tijd = new Date(nu.getTime() + n).toISOString();
  if (los) {
    schrijf[los.id] = { ...los, verzameling: VID, thema, map, bijgewerkt: tijd };
    log.verplaatst.push(`${p.nummer} ${los.naam}`);
    return;
  }
  let status = { w: false, b: false, a: false };
  const pika = items.find((i) => i.cm?.id === p.cm && i.verzameling === "pikachu");
  if (pika) {
    if (pika.status?.a && (pika.aantal || 1) >= 2) {
      schrijf[pika.id] = { ...pika, aantal: pika.aantal - 1, bijgewerkt: tijd };
      status = { w: false, b: !!pika.status.b, a: true };
      log.gesplitst.push(`${p.nummer} ${pika.naam} (${pika.aantal}→${pika.aantal - 1})`);
    } else log.nieuwOntbreekt.push(`${p.nummer} ${pika.naam} (in Pikachu: ${pika.aantal}×, a=${!!pika.status?.a})`);
  }
  const id = "i" + randomBytes(5).toString("hex");
  schrijf[id] = {
    id, naam: p.naam, label: "kaarten", verzameling: VID, thema, map, aantal: 1, aankoop: null, waarde: null, notitie: null, status,
    tp: { product: p.tp, groep: p.sub === "cc" ? 24837 : 24722 },
    set: p.sub === "cc" ? "ME: 30th Celebration Classic Collection" : "ME: 30th Celebration",
    nummer: p.nummer, img: [`t:${p.tp}`, ...(p.img ? [`d:${p.img}`] : [])],
    cm: { id: p.cm, holo: false }, start: { e: p.trend, t: "c", s: p.soort, d: "2026-11-11" },
    gemaakt: tijd, bijgewerkt: tijd,
  };
  log.nieuw++;
});
console.log("verplaatst", log.verplaatst.length, log.verplaatst.join(" | "));
console.log("gesplitst", log.gesplitst.length, log.gesplitst.join(" | "));
console.log("pikachu, blijft daar", log.nieuwOntbreekt.length, log.nieuwOntbreekt.join(" | "));
console.log("nieuwe items", log.nieuw, "te schrijven", Object.keys(schrijf).length, "in 30th:", Object.values(schrijf).filter((i) => i.verzameling === VID).length, "afgevinkt:", Object.values(schrijf).filter((i) => i.verzameling === VID && i.status?.a).length);
if (SCHRIJF) {
  await r.hset("pokemon:verzamelingen", { [VID]: verzameling });
  await r.hset("pokemon:items", schrijf);
  await r.set("pokemon:items:versie", new Date().toISOString());
  console.log("Klaar: de verzameling staat op /pokemon/30th-celebration");
}
