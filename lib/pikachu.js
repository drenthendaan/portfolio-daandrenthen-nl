import collectie from "@/data/pikachu-collectie.json";

export const FIELDS = ["w", "b", "o", "a"];

// Startstand (14 okt 2026) uit de JSON, in korte sleutels: { id: { w, b, o, a } }
export const SEED = Object.fromEntries(
  collectie.cards.map((c) => [
    c.id,
    {
      w: c.status.wantlist,
      b: c.status.paid,
      o: c.status.shipped,
      a: c.status.owned,
    },
  ])
);

export const CARD_IDS = new Set(collectie.cards.map((c) => c.id));

// Accepteert { id: { w, b, o, a } } en geeft een schone kopie terug, of null als iets niet klopt.
export function cleanStatus(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out = {};
  for (const [id, v] of Object.entries(input)) {
    if (!CARD_IDS.has(id) || !v || typeof v !== "object") return null;
    const row = {};
    for (const f of FIELDS) {
      if (v[f] !== undefined && typeof v[f] !== "boolean") return null;
      row[f] = v[f] === true;
    }
    out[id] = row;
  }
  return out;
}
