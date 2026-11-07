// Eenmalige omzetting: de kaarten uit de oorspronkelijke Pikachu-lijst (data/pikachu-collectie.json)
// worden gewone items, met dezelfde id (dus dezelfde prijsgeschiedenis), hun vinkjes, mapplek,
// notitie, plaatjes en Cardmarket-product. Daarna is er maar één soort kaart.
//
// Zolang de omzetting niet gedaan is, toont leesItems de kaarten alvast als items (zonder iets te
// schrijven); de eerste wijziging of verversing zet ze echt in de database.
import collectie from "@/data/pikachu-collectie.json";
import cardmarket from "@/data/pokemon/cardmarket.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { kaartPrijs } from "./regels.mjs";
import { ITEMS_KEY, leesStatus } from "./server";
import { SECTIE_THEMA } from "./themas.mjs";
import { PIKACHU } from "./vast.mjs";

export const OMGEZET_KEY = "pokemon:items:vast-omgezet";
const BEGIN = Date.parse("2026-10-14T00:00:00Z"); // de startstand van de lijst

// status: { id: { w, b, o, a } } (de vinkjes van de lijst, zoals ze in de database staan)
export function vasteKaartenAlsItems(status = {}) {
  return collectie.cards.map((c, n) => {
    const k = koppelingen.kaarten[c.id];
    const s = status[c.id] ?? {};
    const vast = c.price_eur > 0 ? kaartPrijs({ vast: { eur: c.price_eur, type: c.price_type } }) : null;
    const gemaakt = new Date(BEGIN + n * 1000).toISOString();
    return {
      id: c.id,
      naam: c.name,
      label: "kaarten",
      verzameling: PIKACHU.id,
      thema: SECTIE_THEMA[c.section] ?? "overig",
      map: c.binder?.code ?? null,
      aantal: 1,
      aankoop: null,
      waarde: null,
      notitie: c.note || null,
      status: { w: !!s.w, b: !!s.b, a: !!s.a },
      tp: k?.tp ? { product: k.tp.product, groep: k.tp.groep } : null,
      cm: cardmarket.kaarten[c.id]?.cm ?? null,
      set: c.set,
      nummer: c.number || null,
      img: k?.img ?? [],
      // De vaste prijs uit de lijst (5 okt): geldt zolang Cardmarket geen prijs heeft
      start: vast,
      gemaakt,
      bijgewerkt: gemaakt,
    };
  });
}

export const isOmgezet = async (redis) => !!(await redis.get(OMGEZET_KEY));

// Zet de kaarten in de database als dat nog niet gebeurd is. Kaarten die er al als item staan,
// blijven zoals ze zijn. Geeft true als er iets geschreven is.
export async function zorgVoorOmzetting(redis) {
  if (await isOmgezet(redis)) return false;
  const [status, bestaand] = await Promise.all([leesStatus(redis), redis.hkeys(ITEMS_KEY)]);
  const al = new Set(bestaand ?? []);
  const nieuw = vasteKaartenAlsItems(status ?? {}).filter((i) => !al.has(i.id));
  if (nieuw.length) await redis.hset(ITEMS_KEY, Object.fromEntries(nieuw.map((i) => [i.id, i])));
  await redis.set(OMGEZET_KEY, new Date().toISOString());
  return nieuw.length > 0;
}
