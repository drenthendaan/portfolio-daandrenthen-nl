// Kleine opmaakhulpjes voor datums en prijzen op de Pokémon-pagina's.

export const datumKort = (d) =>
  d
    ? new Date(d.length === 10 ? d + "T12:00:00Z" : d).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Amsterdam",
      })
    : "";

// "2026-10-25" → "25-10-2026"
export const datumNL = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("-") : "");

// Welke prijs het is: "Cardmarket-trend", "vaste prijs uit de lijst", ...
export function prijsBron(p) {
  if (!p) return "";
  if (p.t === "c") return p.s === "avg30" ? "Cardmarket, gemiddelde van 30 dagen" : "Cardmarket-trend";
  if (p.t === "m") return "TCGplayer-marktprijs";
  if (p.t === "v") return p.vraag ? "vaste prijs uit de lijst (vraagprijs)" : "vaste prijs uit de lijst";
  if (p.t === "h") return "eigen waarde";
  return "";
}
