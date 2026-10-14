// Kaartgegevens voor de pagina's: de collectie-JSON plus koppeling en afbeeldingen.
import collectie from "@/data/pikachu-collectie.json";
import koppelingen from "@/data/pokemon/koppelingen.json";
import { vastePrijzen } from "./regels.mjs";

// Compact per kaart: id, lijst (EN/JP), naam, set, nummer, sectie, mapcode, positie, notitie,
// afbeeldingen en TCGplayer-product
export const KAARTEN = collectie.cards.map((c) => {
  const k = koppelingen.kaarten[c.id];
  return {
    id: c.id,
    list: c.list,
    n: c.name,
    s: c.set,
    nr: c.number,
    sec: c.section,
    map: c.binder?.code ?? null,
    pos: c.binder ? c.binder.page * 10 + c.binder.slot : 99999,
    note: c.note,
    img: k?.img ?? [],
    tp: k?.tp?.product ?? null,
  };
});

export const VASTE_PRIJZEN = vastePrijzen(collectie.cards);
