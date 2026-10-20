// Binders en mapcodes. Pure functies, bruikbaar op de server, in de browser en in tests.
// Een mapcode is "pagina.vakje", bijv. 3.5 = pagina 3, vakje 5 (vakjes van links naar
// rechts, van boven naar beneden). "Pagina's" zijn zijden: 20 vellen = 40 pagina's.

const vaultX = (vakjes, kolommen, kleur, kleurnaam) => ({
  id: `vaultx-${vakjes}-${kleurnaam}`,
  naam: `Vault X ${vakjes}-Pocket Exo-Tec Zip Binder – ${kleurnaam}`,
  kort: `Vault X ${vakjes}-pocket ${kleurnaam}`,
  vakjes,
  kolommen,
  paginas: 40,
  kleur,
});

export const BINDERS = [
  vaultX(9, 3, "#16181d", "zwart"),
  vaultX(9, 3, "#1f3f8f", "blauw"),
  vaultX(9, 3, "#a3192b", "rood"),
  vaultX(9, 3, "#1f6b47", "groen"),
  vaultX(9, 3, "#5b2a86", "paars"),
  vaultX(4, 2, "#16181d", "zwart"),
  vaultX(12, 4, "#16181d", "zwart"),
];

export const STANDAARD_PIKACHU_BINDER = { type: "vaultx-9-zwart" };
const KOLOMMEN = { 4: 2, 9: 3, 12: 4, 16: 4 };
export const EIGEN_VAKJES = Object.keys(KOLOMMEN).map(Number);

// Opgeslagen keuze ({ type } of { type: "eigen", naam, vakjes, paginas }) → volledige binder
export function binderVan(verzameling) {
  const keuze = verzameling?.binder;
  if (!keuze) return null;
  if (keuze.type === "eigen") {
    return {
      id: "eigen",
      naam: keuze.naam || "Eigen binder",
      kort: keuze.naam || "Eigen binder",
      vakjes: keuze.vakjes,
      kolommen: KOLOMMEN[keuze.vakjes] ?? 3,
      paginas: keuze.paginas,
      kleur: "#2b3343",
    };
  }
  return BINDERS.find((b) => b.id === keuze.type) ?? null;
}

// Controle van een binderkeuze uit een formulier; geeft { binder } of { fout }
export function schoonBinder(invoer) {
  if (invoer == null || invoer === "" || invoer.type === "") return { binder: null };
  if (typeof invoer !== "object") return { fout: "Binder klopt niet" };
  if (invoer.type === "eigen") {
    const vakjes = Number(invoer.vakjes);
    const paginas = Number(invoer.paginas);
    const naam = String(invoer.naam ?? "").trim().slice(0, 60);
    if (!EIGEN_VAKJES.includes(vakjes)) return { fout: `Vakjes per pagina: ${EIGEN_VAKJES.join(", ")}` };
    if (!Number.isInteger(paginas) || paginas < 1 || paginas > 200) return { fout: "Aantal pagina's: 1 tot 200" };
    return { binder: { type: "eigen", naam: naam || "Eigen binder", vakjes, paginas } };
  }
  if (!BINDERS.some((b) => b.id === invoer.type)) return { fout: "Onbekende binder" };
  return { binder: { type: invoer.type } };
}

// "3.5" → { pagina: 3, vakje: 5 }; ongeldig → null
export function leesMapcode(code) {
  const m = /^(\d{1,3})\.(\d{1,2})$/.exec(String(code ?? "").trim());
  if (!m) return null;
  const pagina = Number(m[1]);
  const vakje = Number(m[2]);
  return pagina >= 1 && vakje >= 1 ? { pagina, vakje } : null;
}

// Past de code in de binder? Zonder binder: hooguit 16 vakjes per pagina
export function geldigeMapcode(code, binder) {
  const p = leesMapcode(code);
  if (!p) return false;
  if (p.vakje > (binder?.vakjes ?? 16)) return false;
  return !(binder?.paginas && p.pagina > binder.paginas);
}

// Sorteersleutel voor "zoals in je map": pagina * 100 + vakje
export function mapPositie(code) {
  const p = leesMapcode(code);
  return p ? p.pagina * 100 + p.vakje : null;
}

// Opengeslagen map: pagina 1 rechts, daarna 2|3, 4|5, …
export function spreads(aantalPaginas) {
  const uit = [[1]];
  for (let p = 2; p <= aantalPaginas; p += 2) uit.push(p + 1 <= aantalPaginas ? [p, p + 1] : [p]);
  return uit;
}
