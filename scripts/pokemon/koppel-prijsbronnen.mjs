// Koppelt de Engelse kaarten uit data/pikachu-collectie.json aan een TCGplayer-product
// (catalogus en prijzen via tcgcsv.com) en, waar dat klopt, aan een TCGdex-kaart
// (Cardmarket-prijs). Schrijft data/pokemon/koppelingen.json.
//
//   npm run pokemon:koppel                 downloadt hooguit één keer per tcgcsv-versie
//   npm run pokemon:koppel -- --offline    gebruikt alleen wat al in de cache staat
//
// Correcties staan in data/pokemon/koppelingen-handmatig.json:
//   { "<kaart-id>": { "product": 123 | null, "sub": "Holofoil", "dex": "xy12-35" | null,
//                     "akkoord": true, "notitie": "..." } }
// Het script eindigt met code 1 zolang er kaarten zijn die nog gecontroleerd moeten worden.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE = path.join(ROOT, "scripts/pokemon/.cache");
const BRON = path.join(ROOT, "data/pikachu-collectie.json");
const UIT = path.join(ROOT, "data/pokemon/koppelingen.json");
const HANDMATIG = path.join(ROOT, "data/pokemon/koppelingen-handmatig.json");
const UA = "daandrenthen.nl-pokemon/1.0 (+https://daandrenthen.nl/pokemon)";
const OFFLINE = process.argv.includes("--offline");
const USD_EUR = 0.88; // koers waarmee de vaste prijzen van 5 okt zijn omgerekend

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const leesJSON = async (p, standaard) => {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return standaard;
  }
};

// ---------- Downloaden (met cache) ----------

async function haal(url, bestand, { tekst = false } = {}) {
  const p = path.join(CACHE, bestand);
  try {
    const t = await readFile(p, "utf8");
    return tekst ? t : JSON.parse(t);
  } catch {}
  if (OFFLINE) throw new Error(`Niet in de cache: ${bestand}`);
  for (let poging = 1; ; poging++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`${res.status} bij ${url}`);
      const t = await res.text();
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, t);
      await sleep(100); // tcgcsv vraagt om 100 ms tussen verzoeken
      return tekst ? t : JSON.parse(t);
    } catch (e) {
      if (poging >= 3) throw e;
      await sleep(1000 * poging);
    }
  }
}

async function laadTcgcsv() {
  let versie;
  if (OFFLINE) {
    versie = (await leesJSON(path.join(CACHE, "tcgcsv/laatste.json"), {})).versie;
    if (!versie) throw new Error("Geen tcgcsv-cache gevonden");
  } else {
    const res = await fetch("https://tcgcsv.com/last-updated.txt", {
      headers: { "User-Agent": UA },
    });
    versie = (await res.text()).trim();
  }
  const map = "tcgcsv/" + versie.replace(/[^0-9T]/g, "-");
  const groepen = (await haal("https://tcgcsv.com/tcgplayer/3/groups", `${map}/groups-3.json`)).results;
  const producten = [];
  const prijzen = new Map();
  let i = 0;
  for (const g of groepen) {
    i++;
    if (i % 40 === 0) console.error(`  tcgcsv: groep ${i}/${groepen.length}`);
    const p = await haal(
      `https://tcgcsv.com/tcgplayer/3/${g.groupId}/products`,
      `${map}/products-3-${g.groupId}.json`
    );
    const pr = await haal(
      `https://tcgcsv.com/tcgplayer/3/${g.groupId}/prices`,
      `${map}/prices-3-${g.groupId}.json`
    );
    for (const prod of p.results) producten.push(prod);
    for (const r of pr.results) {
      if (!prijzen.has(r.productId)) prijzen.set(r.productId, []);
      prijzen.get(r.productId).push(r);
    }
  }
  await writeFile(path.join(CACHE, "tcgcsv/laatste.json"), JSON.stringify({ versie }));
  return { versie, groepen, producten, prijzen };
}

async function laadTcgdex() {
  const dag = new Date().toISOString().slice(0, 10);
  const map = `tcgdex/${dag}`;
  const lijst = await haal("https://api.tcgdex.net/v2/en/cards?name=pikachu", `${map}/lijst.json`);
  const kaarten = [];
  for (let i = 0; i < lijst.length; i += 4) {
    const blok = lijst.slice(i, i + 4);
    kaarten.push(
      ...(await Promise.all(
        blok.map((k) =>
          haal(`https://api.tcgdex.net/v2/en/cards/${k.id}`, `${map}/kaarten/${k.id}.json`).catch(
            () => null
          )
        )
      ))
    );
  }
  return kaarten.filter(Boolean);
}

// ---------- Namen en nummers ontleden ----------

const zonderAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const woorden = (s) =>
  zonderAccent(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
const NUMMERWOORD = /^[a-z]{0,5}\d+[a-z]?$/;

export function nummer(s) {
  const kop = String(s || "").split("/")[0].replace(/\s+/g, "").toUpperCase();
  const m = kop.match(/^([A-Z]*)0*(\d+)([A-Z]?)$/);
  return m ? m[1] + m[2] + m[3] : kop;
}

function variantSet(lijst) {
  return new Set(lijst.flatMap(woorden).filter((w) => !NUMMERWOORD.test(w)));
}

// TCGplayer: "Pikachu - 19/68 (#15 Pikachu Stamped)", "Pikachu ex (Pikachu 60)", "Pikachu - 70/100 [Platinum]"
function ontleedProduct(naam) {
  const varianten = [];
  let stempel = null;
  const rest = naam.replace(/[([]([^)\]]*)[)\]]/g, (_, inhoud) => {
    varianten.push(inhoud);
    return " ";
  });
  const delen = rest.split(/\s+-\s+/);
  const basis = delen.shift();
  varianten.push(...delen);
  const over = [];
  for (const v of varianten) {
    const m = v.trim().match(/^#(\d+)\s+Pikachu Stamped$/i) || v.trim().match(/^Pikachu\s+(\d+)$/i);
    if (m) stempel = Number(m[1]);
    else over.push(v);
  }
  return { basis: woorden(basis).join(""), varianten: variantSet(over), stempel };
}

// Wij: "Pikachu (stempel #15)", "Pikachu δ", "Pikachu ★", "Pikachu (Reverse Cosmos Holo) (Costco Exclusive)"
function ontleedKaart(naam) {
  const varianten = [];
  let stempel = null;
  const rest = naam
    .replace(/δ/g, " (Delta Species)")
    .replace(/★/g, " Star")
    .replace(/\(([^)]*)\)/g, (_, inhoud) => {
      const m = inhoud.trim().match(/^stempel\s+#(\d+)$/i);
      if (m) stempel = Number(m[1]);
      else varianten.push(inhoud);
      return " ";
    });
  return { basis: woorden(rest).join(""), varianten: variantSet(varianten), stempel };
}

// Setnaam zonder TCGplayer-voorvoegsel ("SV02:", "SWSH:", "XY -")
const kern = (n) =>
  woorden(n.replace(/^[A-Z]{1,6}\d{0,3}(\.\d+)?:\s*/, "").replace(/^(XY|SM|BW|DP|HGSS|EX)\s+-\s+/, "")).join("");

const ALIAS = {
  [kern("Diverse promo's")]: ["Miscellaneous Cards & Products"],
  [kern("Wizards Black Star Promo")]: ["WoTC Promo"],
};

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let gedeeld = 0;
  for (const x of a) if (b.has(x)) gedeeld++;
  return gedeeld / (a.size + b.size - gedeeld);
}

// ---------- Variant (subtype) kiezen ----------

const BASIS_SUBS = ["Normal", "Holofoil", "Unlimited Holofoil", "Unlimited"];

function kiesSub(kaart, rijen, { reverse, voorkeur }) {
  const subs = rijen.map((r) => r.subTypeName);
  const bestaat = (s) => subs.includes(s);
  const metMarkt = (s) => rijen.some((r) => r.subTypeName === s && r.marketPrice > 0);
  if (voorkeur && bestaat(voorkeur)) return voorkeur;
  if (reverse && bestaat("Reverse Holofoil")) return "Reverse Holofoil";
  if (/\(holo\)/i.test(kaart.name) && bestaat("Holofoil")) return "Holofoil";
  if (/non-holo/i.test(kaart.name) && bestaat("Normal")) return "Normal";
  return (
    BASIS_SUBS.find(metMarkt) ??
    BASIS_SUBS.find(bestaat) ??
    (bestaat("Reverse Holofoil") ? "Reverse Holofoil" : null) ??
    subs.find((s) => /^1st Edition/.test(s)) ??
    subs[0] ??
    null
  );
}

// ---------- Hoofdprogramma ----------

const euro = (n) => (n == null ? "—" : "€ " + n.toFixed(2).replace(".", ","));
const dollar = (n) => (n == null ? "—" : "$ " + n.toFixed(2));

async function main() {
  const bron = JSON.parse(await readFile(BRON, "utf8"));
  const handmatig = await leesJSON(HANDMATIG, {});
  const vorige = (await leesJSON(UIT, { kaarten: {} })).kaarten;
  const reverse = new Set(bron.reverse_holo_received_instead_of_normal || []);

  console.error("TCGplayer-catalogus laden…");
  const tp = await laadTcgcsv();
  console.error("TCGdex laden…");
  const dex = await laadTcgdex();

  const groepNaam = new Map(tp.groepen.map((g) => [g.groupId, g.name]));
  const productOpId = new Map(tp.producten.map((p) => [p.productId, p]));
  const index = new Map(); // basis -> producten
  for (const p of tp.producten) {
    p._ontleed = ontleedProduct(p.name);
    p._nummer = nummer(p.extendedData?.find((e) => e.name === "Number")?.value);
    if (!index.has(p._ontleed.basis)) index.set(p._ontleed.basis, []);
    index.get(p._ontleed.basis).push(p);
  }
  // TCGdex-kaart per TCGplayer-product-id
  const dexOpProduct = new Map();
  for (const d of dex) {
    const ids = new Set([d.thirdParty?.tcgplayer]);
    for (const v of Object.values(d.pricing?.tcgplayer || {}))
      if (v && typeof v === "object" && v.productId) ids.add(v.productId);
    for (const id of ids) if (id && !dexOpProduct.has(id)) dexOpProduct.set(id, d);
  }
  const dexOpId = new Map(dex.map((d) => [d.id, d]));

  const uit = {};
  const rapport = { auto: [], controleren: [], geen: [], handmatig: [], cm: [] };
  const engels = bron.cards.filter((c) => c.list === "EN");

  for (const kaart of engels) {
    const ons = ontleedKaart(kaart.name);
    const nr = nummer(kaart.number);
    const set = kern(kaart.set);
    const aliassen = (ALIAS[set] || []).map(kern);
    const h = handmatig[kaart.id] || {};

    const scoor = (p) => {
      let s = jaccard(ons.varianten, p._ontleed.varianten);
      if (ons.stempel != null || p._ontleed.stempel != null) {
        if (ons.stempel === p._ontleed.stempel) s += 1;
        else if (ons.stempel != null && p._ontleed.stempel != null) s -= 5;
        else if (p._ontleed.stempel != null) s -= 2;
        else s -= 1;
      }
      const g = kern(groepNaam.get(p.groupId) || "");
      if (g === set || aliassen.includes(g)) s += 1;
      else if (set && g && (g.includes(set) || set.includes(g))) s += 0.5;
      if (/jumbo/i.test(groepNaam.get(p.groupId)) || /^code card/i.test(p.name)) s -= 3;
      if (p._nummer !== nr) s -= 1; // alleen bij de ruimere zoektocht
      return s;
    };

    let kandidaten = (index.get(ons.basis) || []).filter((p) => p._nummer === nr);
    if (!kandidaten.length) {
      // Ruimer: zelfde naam in een groep die op de set lijkt, ander of leeg nummer
      kandidaten = (index.get(ons.basis) || []).filter((p) => {
        const g = kern(groepNaam.get(p.groupId) || "");
        return g === set || aliassen.includes(g) || (set && g && (g.includes(set) || set.includes(g)));
      });
    }
    const gerangschikt = kandidaten
      .map((p) => ({ p, s: scoor(p) }))
      .sort((a, b) => b.s - a.s);

    let gekozen = gerangschikt[0]?.p ?? null;
    let zekerheid;
    if ("product" in h) {
      gekozen = h.product == null ? null : productOpId.get(h.product) ?? null;
      zekerheid = "handmatig";
    }

    let tpKoppeling = null;
    let prijsUsd = null;
    let ratio = null;
    if (gekozen) {
      const rijen = tp.prijzen.get(gekozen.productId) || [];
      const sub = kiesSub(kaart, rijen, { reverse: reverse.has(kaart.id), voorkeur: h.sub });
      const rij = rijen.find((r) => r.subTypeName === sub);
      prijsUsd = rij?.marketPrice || null;
      tpKoppeling = { groep: gekozen.groupId, product: gekozen.productId, sub };
      if (prijsUsd && kaart.price_type === "market" && kaart.price_eur > 0)
        ratio = (prijsUsd * USD_EUR) / kaart.price_eur;
    }

    if (!zekerheid) {
      const beste = gerangschikt[0]?.s ?? -Infinity;
      const tweede = gerangschikt[1]?.s ?? -Infinity;
      const prijsOk = ratio == null || (ratio >= 0.6 && ratio <= 1.6);
      if (!gekozen) zekerheid = "geen";
      else if (beste >= 1.4 && beste - tweede >= 0.25 && prijsOk) zekerheid = "auto";
      else zekerheid = "controleren";
      if (zekerheid !== "auto" && h.akkoord) zekerheid = "handmatig";
    }

    // TCGdex / Cardmarket: alleen als de TCGdex-kaart bij precies dit product hoort
    let dexKaart = null;
    if ("dex" in h) dexKaart = h.dex ? dexOpId.get(h.dex) ?? null : null;
    else if (gekozen) dexKaart = dexOpProduct.get(gekozen.productId) ?? null;
    let cm = null;
    if (dexKaart?.pricing?.cardmarket) {
      const veld = reverse.has(kaart.id) ? "holo" : "normal";
      const trend = dexKaart.pricing.cardmarket[veld === "holo" ? "trend-holo" : "trend"];
      const tpEur = prijsUsd ? prijsUsd * USD_EUR : null;
      const r = trend && tpEur ? trend / tpEur : null;
      if (trend && (r == null || (r >= 0.25 && r <= 4))) cm = veld;
      else if (trend) rapport.cm.push(`${kaart.name} · ${kaart.set} ${kaart.number}: Cardmarket ${euro(trend)} vs TCGplayer ${euro(tpEur)} → genegeerd`);
    }

    const img = [];
    if (gekozen?.imageCount > 0) img.push(`t:${gekozen.productId}`);
    if (dexKaart?.image) img.push("d:" + dexKaart.image.replace("https://assets.tcgdex.net/", ""));

    const regel = {
      tp: tpKoppeling,
      naam: gekozen ? `${gekozen.name} · ${groepNaam.get(gekozen.groupId)}` : null,
      dex: dexKaart?.id ?? null,
      cm,
      img,
      zekerheid,
      vast5okt: ratio != null && ratio >= 0.6 && ratio <= 1.6,
    };
    uit[kaart.id] = regel;

    const omschrijving = `${kaart.name} · ${kaart.set} ${kaart.number} (${euro(kaart.price_eur)}, id ${kaart.id})`;
    const kandidatenTekst = gerangschikt
      .slice(0, 3)
      .map(({ p, s }) => {
        const rijen = tp.prijzen.get(p.productId) || [];
        const subs = rijen.map((r) => `${r.subTypeName} ${dollar(r.marketPrice)}`).join(", ");
        return `      ${s.toFixed(2)}  ${p.productId}  ${p.name} · ${groepNaam.get(p.groupId)}  [${subs || "geen prijs"}]`;
      })
      .join("\n");
    const prijsTekst = ratio == null ? "" : `  nieuw ${euro(prijsUsd * USD_EUR)} (×${ratio.toFixed(2)})`;
    rapport[zekerheid].push(`  ${omschrijving}${prijsTekst}\n${kandidatenTekst}`);
  }

  // Wegschrijven, gesorteerd zodat diffs rustig blijven
  const kaarten = Object.fromEntries(Object.keys(uit).sort().map((k) => [k, uit[k]]));
  await mkdir(path.dirname(UIT), { recursive: true });
  await writeFile(
    UIT,
    JSON.stringify({ gemaakt: new Date().toISOString(), tcgcsv: tp.versie, kaarten }, null, 1) + "\n"
  );

  const gewijzigd = Object.keys(kaarten).filter(
    (k) => vorige[k] && JSON.stringify(vorige[k].tp) !== JSON.stringify(kaarten[k].tp)
  );
  const lijn = "─".repeat(60);
  console.log(lijn);
  console.log(`Engelse kaarten: ${engels.length}`);
  for (const k of ["auto", "handmatig", "controleren", "geen"]) console.log(`  ${k.padEnd(12)} ${rapport[k].length}`);
  console.log(`  met Cardmarket ${Object.values(kaarten).filter((k) => k.cm).length}`);
  console.log(`  zonder plaatje ${Object.values(kaarten).filter((k) => !k.img.length).length}`);
  if (gewijzigd.length) console.log(`  gewijzigd t.o.v. vorige keer: ${gewijzigd.join(", ")}`);
  for (const k of ["controleren", "geen"]) {
    if (!rapport[k].length) continue;
    console.log(`${lijn}\n${k.toUpperCase()}\n${rapport[k].join("\n")}`);
  }
  if (rapport.cm.length) console.log(`${lijn}\nCARDMARKET GENEGEERD\n  ${rapport.cm.join("\n  ")}`);
  console.log(lijn);
  console.log(`Geschreven: ${path.relative(ROOT, UIT)}`);
  if (rapport.controleren.length || rapport.geen.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
