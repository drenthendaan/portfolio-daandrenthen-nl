// De vaste verzameling: de Pikachu-kaarten uit de JSON (data/pikachu-collectie.json), met de binder.
// Pure gegevens, voor de server, de browser en `node --test`.

export const PIKACHU = { id: "pikachu", naam: "Pikachu-verzameling", vast: true };
export const VASTE_VERZAMELINGEN = [PIKACHU];
export const VASTE_IDS = new Set(VASTE_VERZAMELINGEN.map((v) => v.id));

// Bij welke vaste verzameling een kaart uit de JSON hoort
export const vasteVerzamelingVan = () => PIKACHU.id;
