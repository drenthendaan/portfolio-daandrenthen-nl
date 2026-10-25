// Koppelt de Engelse kaarten uit data/pikachu-collectie.json aan een TCGplayer-product
// (catalogus en prijzen via tcgcsv.com) en, waar dat klopt, aan een TCGdex-kaart
// (Cardmarket-prijs). Schrijft data/pokemon/koppelingen.json.
//
//   npm run pokemon:koppel                       downloadt hooguit één keer per tcgcsv-versie
//   npm run pokemon:koppel -- --offline          gebruikt alleen wat al in de cache staat
//   npm run pokemon:koppel -- --tcgcsv-cache     TCGplayer uit de cache, TCGdex vers
//
// Cardmarket loopt via TCGdex: eerst op het TCGplayer-productnummer dat TCGdex kent, anders
// op set en kaartnummer (alleen voor kaarten zonder variant in de naam). Het resultaat is het
// Cardmarket-product (cm.id) waarvan de verversing de trendprijs uit de prijslijst haalt.
//
// Correcties staan in data/pokemon/koppelingen-handmatig.json:
//   { "<kaart-id>": { "product": 123 | null, "sub": "Holofoil", "dex": "xy12-35" | null,
//                     "akkoord": true, "notitie": "..." } }
// Het script eindigt met code 1 zolang er kaarten zijn die nog gecontroleerd moeten worden.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cardmarketPrijs, dexSetsVoorGroep, EIGEN_NUMMERING, kern, naamKern, nummer, opNaam, woorden } from "../../lib/pokemon/tcgdex.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE = path.join(ROOT, "scripts/pokemon/.cache");
const BRON = path.join(ROOT, "data/pikachu-collectie.json");
const UIT = path.join(ROOT, "data/pokemon/koppelingen.json");
const HANDMATIG = path.join(ROOT, "data/pokemon/koppelingen-handmatig.json");
const CATALOGUS = path.join(ROOT, "data/pokemon/catalogus.json");
const UA = "daandrenthen.nl-pokemon/1.0 (+https://daandrenthen.nl/pokemon)";
const OFFLINE = process.argv.includes("--offline");
const TCGCSV_CACHE = OFFLINE || process.argv.includes("--tcgcsv-cache");
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
  if (TCGCSV_CACHE) {
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
  const sets = await haal("https://api.tcgdex.net/v2/en/sets", `${map}/sets.json`);
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
  return { sets, kaarten: kaarten.filter(Boolean) };
}

// ---------- Namen en nummers ontleden ----------

export { nummer };
const NUMMERWOORD = /^[a-z]{0,5}\d+[a-z]?$/;

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

// ---------- Zoeklijst voor "item toevoegen" ----------

// Compacte catalogus van alle Engelse TCGplayer-producten (zonder Code Cards), voor de
// zoekfunctie op /pokemon. Per groep: [groupId, naam, uitgavedatum]. Per product:
// [productId, groepindex, naam, nummer, plaatje 0/1, marktprijs in dollarcent of null].
// Alleen de server leest dit bestand.
async function schrijfCatalogus(tp) {
  const groepIndex = new Map(tp.groepen.map((g, i) => [g.groupId, i]));
  const markt = (id) => {
    const r = (tp.prijzen.get(id) || []).find((x) => x.marketPrice > 0);
    return r ? Math.round(r.marketPrice * 100) : null;
  };
  const producten = tp.producten
    .filter((p) => !/^code card/i.test(p.name))
    .map((p) => [
      p.productId,
      groepIndex.get(p.groupId),
      p.name,
      p.extendedData?.find((e) => e.name === "Number")?.value ?? "",
      p.imageCount > 0 ? 1 : 0,
      markt(p.productId),
    ])
    .sort((a, b) => a[0] - b[0]);
  const data = {
    tcgcsv: tp.versie,
    groepen: tp.groepen.map((g) => [g.groupId, g.name, String(g.publishedOn || "").slice(0, 10)]),
    producten,
  };
  await writeFile(CATALOGUS, JSON.stringify(data) + "\n");
  console.error(`Zoeklijst: ${producten.length} producten → ${path.relative(ROOT, CATALOGUS)}`);
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
  const { sets: dexSets, kaarten: dex } = await laadTcgdex();

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
  // TCGdex-kaart per set en nummer, voor kaarten waarvan TCGdex het TCGplayer-product niet kent
  const dexOpSetNummer = new Map();
  for (const d of dex) {
    const sleutel = `${d.set?.id}|${nummer(d.localId)}`;
    if (!dexOpSetNummer.has(sleutel)) dexOpSetNummer.set(sleutel, []);
    dexOpSetNummer.get(sleutel).push(d);
  }

  const uit = {};
  const rapport = { auto: [], controleren: [], geen: [], handmatig: [], cm: [], viaNummer: [], dubbel: [] };
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

    // TCGdex / Cardmarket: de TCGdex-kaart bij precies dit TCGplayer-product, anders (alleen
    // zonder variant in de naam) de kaart met hetzelfde nummer in de bijbehorende TCGdex-set
    let dexKaart = null;
    let viaNummer = false;
    if ("dex" in h) dexKaart = h.dex ? dexOpId.get(h.dex) ?? null : null;
    else if (gekozen) {
      dexKaart = dexOpProduct.get(gekozen.productId) ?? null;
      const naam = naamKern(kaart.name);
      if (!dexKaart && !naam.variant) {
        const setIds = dexSetsVoorGroep(groepNaam.get(gekozen.groupId), dexSets);
        const zelfdeNaam = (d) => naamKern(d.name).basis === naam.basis;
        let opNummer = setIds.flatMap((id) => dexOpSetNummer.get(`${id}|${nr}`) || []).filter(zelfdeNaam);
        // Classic Collections nummeren anders en sommige kaarten hebben geen nummer: dan op naam,
        // als die in de set uniek is
        if (!opNummer.length && (!nr || setIds.some((id) => EIGEN_NUMMERING.has(id)))) {
          opNummer = opNaam(dex.filter((d) => setIds.includes(d.set?.id)), naam.basis);
        }
        if (opNummer.length === 1) {
          dexKaart = opNummer[0];
          viaNummer = true;
        }
      }
    }
    let cm = null;
    const holo = reverse.has(kaart.id);
    const cmPrijs = cardmarketPrijs(dexKaart?.pricing?.cardmarket, holo);
    const cmId = dexKaart?.pricing?.cardmarket?.idProduct ?? null;
    if (cmPrijs && cmId) {
      const trend = cmPrijs.t / 100;
      // Vergelijken met TCGplayer, of zonder TCGplayer-prijs met de prijs in de lijst: zonder
      // vergelijking kwam Pikachu ★ (lijst € 1.672) op het product van een gewone Pikachu (€ 2,70)
      const tpEur = prijsUsd ? prijsUsd * USD_EUR : kaart.price_eur > 0 ? kaart.price_eur : null;
      const r = tpEur ? trend / tpEur : null;
      if (r == null || (r >= 0.25 && r <= 4)) {
        cm = { id: cmId, holo };
        if (viaNummer) rapport.viaNummer.push(`  ${kaart.name} · ${kaart.set} ${kaart.number} → ${dexKaart.id} (Cardmarket ${euro(trend)}, TCGplayer ${euro(tpEur)})`);
      } else rapport.cm.push(`${kaart.name} · ${kaart.set} ${kaart.number}: Cardmarket ${euro(trend)} vs TCGplayer ${euro(tpEur)} → genegeerd`);
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

  // Verschillende kaartnummers op hetzelfde Cardmarket-product: minstens één is fout (TCGdex
  // geeft soms meerdere kaarten hetzelfde product). Corrigeren in cardmarket-extra.json (voorrang).
  const perCm = new Map();
  for (const [id, r] of Object.entries(uit)) {
    if (!r.cm) continue;
    if (!perCm.has(r.cm.id)) perCm.set(r.cm.id, []);
    perCm.get(r.cm.id).push(id);
  }
  const kaartOpId = new Map(engels.map((k) => [k.id, k]));
  for (const [cmId, ids] of perCm) {
    if (new Set(ids.map((id) => nummer(kaartOpId.get(id).number))).size < 2) continue;
    rapport.dubbel.push(`  Cardmarket ${cmId}: ` + ids.map((id) => `${kaartOpId.get(id).name} ${kaartOpId.get(id).set} ${kaartOpId.get(id).number}`).join(" | "));
  }

  // Wegschrijven, gesorteerd zodat diffs rustig blijven
  const kaarten = Object.fromEntries(Object.keys(uit).sort().map((k) => [k, uit[k]]));
  await mkdir(path.dirname(UIT), { recursive: true });
  await writeFile(
    UIT,
    JSON.stringify({ gemaakt: new Date().toISOString(), tcgcsv: tp.versie, kaarten }, null, 1) + "\n"
  );
  await schrijfCatalogus(tp);

  const gewijzigd = Object.keys(kaarten).filter(
    (k) => vorige[k] && JSON.stringify(vorige[k].tp) !== JSON.stringify(kaarten[k].tp)
  );
  const lijn = "─".repeat(60);
  console.log(lijn);
  console.log(`Engelse kaarten: ${engels.length}`);
  for (const k of ["auto", "handmatig", "controleren", "geen"]) console.log(`  ${k.padEnd(12)} ${rapport[k].length}`);
  console.log(`  met Cardmarket ${Object.values(kaarten).filter((k) => k.cm).length} (waarvan ${rapport.viaNummer.length} via set en nummer)`);
  console.log(`  zonder plaatje ${Object.values(kaarten).filter((k) => !k.img.length).length}`);
  if (gewijzigd.length) console.log(`  gewijzigd t.o.v. vorige keer: ${gewijzigd.join(", ")}`);
  for (const k of ["controleren", "geen"]) {
    if (!rapport[k].length) continue;
    console.log(`${lijn}\n${k.toUpperCase()}\n${rapport[k].join("\n")}`);
  }
  if (rapport.viaNummer.length) console.log(`${lijn}\nCARDMARKET VIA SET EN NUMMER\n${rapport.viaNummer.join("\n")}`);
  if (rapport.cm.length) console.log(`${lijn}\nCARDMARKET GENEGEERD\n  ${rapport.cm.join("\n  ")}`);
  if (rapport.dubbel.length) console.log(`${lijn}\nZELFDE CARDMARKET-PRODUCT BIJ VERSCHILLENDE NUMMERS (zie voorrang)\n${rapport.dubbel.join("\n")}`);
  console.log(lijn);
  console.log(`Geschreven: ${path.relative(ROOT, UIT)}`);
  if (rapport.controleren.length || rapport.geen.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
