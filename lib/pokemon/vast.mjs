// De vaste verzamelingen: de kaarten uit de Pikachu-JSON (data/pikachu-collectie.json). De Engelse
// kaarten (lijst "EN") vormen de Pikachu-verzameling met de binder, de Japanse promo's (lijst "JP")
// een eigen verzameling. Pure gegevens, voor de server, de browser en `node --test`.

export const PIKACHU = { id: "pikachu", naam: "Pikachu-verzameling", vast: true };
export const JAPANS = { id: "japanse-pikachu", naam: "Japanse Pikachu", vast: true };
export const VASTE_VERZAMELINGEN = [PIKACHU, JAPANS];
export const VASTE_IDS = new Set(VASTE_VERZAMELINGEN.map((v) => v.id));

// Bij welke vaste verzameling een kaart uit de JSON hoort (list: "EN" of "JP")
export const vasteVerzamelingVan = (list) => (list === "JP" ? JAPANS.id : PIKACHU.id);
