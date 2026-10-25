// Zoeken in de TCGplayer-catalogus (data/pokemon/catalogus.json, gemaakt door het
// koppelscript). Alleen op de server: het bestand is 1,6 MB.
import catalogus from "@/data/pokemon/catalogus.json";
import { themaVoorProduct } from "./themas.mjs";

const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Afkortingen die mensen typen
const SYNONIEMEN = [[/\betb\b/g, "elite trainer box"]];

let index = null;
let opId = null;
function laad() {
  if (index) return;
  index = catalogus.producten.map(([product, g, naam, nummer, plaatje, usd]) => {
    const [groep, set, uitgave] = catalogus.groepen[g];
    return { product, groep, naam, set, uitgave, nummer, plaatje, usd, naamN: norm(naam), zoek: norm(`${naam} ${set} ${nummer}`) };
  });
  opId = new Map(index.map((p) => [p.product, p]));
}

// Voorstel voor het label op basis van het product
export const soortVan = (p) => (/elite trainer box/i.test(p.naam) ? "etb" : p.nummer ? "kaarten" : "overig");

const naarResultaat = (p) => ({
  product: p.product,
  groep: p.groep,
  naam: p.naam,
  set: p.set,
  nummer: p.nummer || null,
  // Altijd het TCGplayer-plaatje proberen: de catalogus weet alleen of er bij het maken al een was.
  // Bestaat het (nog) niet, dan toont de pagina het bliksemicoontje.
  img: [`t:${p.product}`],
  soort: soortVan(p),
  uitgave: p.uitgave || null,
  thema: themaVoorProduct(p),
});

export function zoek(vraag, limiet = 20) {
  laad();
  let q = norm(vraag);
  for (const [patroon, vervanging] of SYNONIEMEN) q = q.replace(patroon, vervanging);
  const woorden = q.split(" ").filter(Boolean);
  if (!woorden.length) return [];
  const treffers = [];
  for (const p of index) {
    if (!woorden.every((w) => p.zoek.includes(w))) continue;
    let s = 0;
    if (p.naamN === q) s += 6;
    else if (p.naamN.startsWith(q)) s += 4;
    else if (p.naamN.includes(q)) s += 2;
    // Dozen vol producten alleen bovenaan als je erom vraagt
    if (/\bcase\b/.test(p.naamN) && !woorden.includes("case")) s -= 3;
    if (p.usd) s += 1;
    if (p.plaatje) s += 0.5;
    s -= p.naam.length / 200;
    treffers.push([s, p]);
  }
  treffers.sort((a, b) => b[0] - a[0]);
  return treffers.slice(0, limiet).map(([, p]) => naarResultaat(p));
}

export function productOpId(id) {
  laad();
  const p = opId.get(id);
  return p ? naarResultaat(p) : null;
}
