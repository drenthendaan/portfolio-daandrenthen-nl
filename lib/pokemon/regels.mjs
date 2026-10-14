// Pure rekenregels voor prijzen en totalen. Geen afhankelijkheden, zodat de server,
// de browser en `node --test` ze allemaal kunnen gebruiken. Bedragen zijn in centen.

export const VAST_DAG = "2026-10-05"; // datum van de vaste prijzen in de collectie-JSON

// Statussen compact als bits: wantslijst 1, betaald 2, onderweg 4, afgerond 8
const BIT = { w: 1, b: 2, o: 4, a: 8 };
export const naarBits = (v) =>
  (v?.w ? BIT.w : 0) | (v?.b ? BIT.b : 0) | (v?.o ? BIT.o : 0) | (v?.a ? BIT.a : 0);
export const vanBits = (n) => ({ w: !!(n & BIT.w), b: !!(n & BIT.b), o: !!(n & BIT.o), a: !!(n & BIT.a) });

export const cent = (n) => Math.round(n * 100);

export function amsterdamDatum(datum) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(datum);
}

// Prijs van één kaart. Volgorde: TCGplayer-marktprijs → laagste aanbod → vorige live prijs
// → vaste prijs van 5 okt → onbekend. `rijen` is undefined als de groep deze run niet is
// opgehaald; dan blijft de vorige prijs staan.
//   uitkomst: { e: euro-centen | null, t: "m" | "l" | "v" | "o", u?: dollar-centen, d?: datum, vraag?: true }
export function kaartPrijs({ koppeling, rijen, fx, dag, vorige, vast }) {
  if (koppeling && rijen) {
    const rij = rijen.find((r) => r.subTypeName === koppeling.sub);
    const [usd, t] =
      rij?.marketPrice > 0 ? [rij.marketPrice, "m"] : rij?.lowPrice > 0 ? [rij.lowPrice, "l"] : [];
    if (t) {
      const u = cent(usd);
      return { e: Math.round(u * fx), t, u, d: dag };
    }
  }
  if (vorige && (vorige.t === "m" || vorige.t === "l")) {
    const { cm, ...rest } = vorige;
    return rest;
  }
  if (vast?.eur != null) {
    const p = { e: cent(vast.eur), t: "v", d: VAST_DAG };
    if (vast.type === "asking") p.vraag = true;
    return p;
  }
  return { e: null, t: "o" };
}

// Startprijs per kaart uit de collectie-JSON, voordat er ooit live prijzen zijn opgehaald
export function vastePrijzen(kaarten) {
  return Object.fromEntries(
    kaarten.map((k) => [k.id, kaartPrijs({ vast: { eur: k.price_eur, type: k.price_type } })])
  );
}

// Variant van een TCGplayer-product voor een zelf toegevoegd item: de gewone versie met
// een marktprijs gaat voor, reverse holo en 1st Edition alleen als er niets anders is.
const BASIS_VARIANTEN = ["Normal", "Holofoil", "Unlimited Holofoil", "Unlimited"];
export function kiesVariant(rijen) {
  const subs = rijen.map((r) => r.subTypeName);
  const metMarkt = (s) => rijen.some((r) => r.subTypeName === s && r.marketPrice > 0);
  return (
    BASIS_VARIANTEN.find(metMarkt) ??
    BASIS_VARIANTEN.find((s) => subs.includes(s)) ??
    (subs.includes("Reverse Holofoil") ? "Reverse Holofoil" : null) ??
    subs.find((s) => /^1st Edition/.test(s)) ??
    subs[0] ??
    null
  );
}

// Prijs per stuk van een zelf toegevoegd item: de live prijs uit de verversing, anders
// de prijs van het moment van toevoegen, anders de zelf ingevulde waarde (t: "h").
export function itemPrijs(item, prijzen) {
  const live = prijzen?.[item.id];
  if (live?.t === "m" || live?.t === "l") return live;
  if (item.start?.t === "m" || item.start?.t === "l") return item.start;
  if (item.waarde != null) return { e: item.waarde, t: "h" };
  return { e: null, t: "o" };
}

// Totalen voor het overzicht. Een kaart of item heeft twee vinkjes die tellen: betaald (b)
// en afgerond (a). "betaald" telt wat betaald is maar nog niet afgerond.
//   kaarten: [{ id, list }], status: { id: {b, a} }, prijzen: { id: {e, t} },
//   items: [{ id, label, aantal, aankoop, status: {b, a}, ... }] (zelf toegevoegd)
// Kaarten uit de lijst tellen mee onder het label "kaarten".
export function totalen({ kaarten, status, prijzen, items = [] }) {
  const leeg = () => ({ cent: 0, n: 0, zonderPrijs: 0, perType: {} });
  const t = {
    bezit: leeg(),
    betaald: leeg(),
    binder: { bezit: 0, totaal: 0 },
    perLabel: {},
  };
  const label = (id) =>
    (t.perLabel[id] ??= { bezit: leeg(), betaald: leeg(), aankoop: 0, aankoopN: 0 });
  const tel = (bak, p, aantal = 1) => {
    bak.n += aantal;
    if (p?.e != null) {
      bak.cent += p.e * aantal;
      bak.perType[p.t] = (bak.perType[p.t] || 0) + aantal;
    } else bak.zonderPrijs += aantal;
  };
  const telStatus = (s, p, labelId, aantal) => {
    if (s.a) {
      tel(t.bezit, p, aantal);
      tel(label(labelId).bezit, p, aantal);
    } else if (s.b) {
      tel(t.betaald, p, aantal);
      tel(label(labelId).betaald, p, aantal);
    }
  };
  for (const k of kaarten) {
    const s = status[k.id] || {};
    telStatus(s, prijzen[k.id], "kaarten", 1);
    if (k.list === "EN") {
      t.binder.totaal++;
      if (s.a) t.binder.bezit++;
    }
  }
  for (const item of items) {
    const s = item.status || {};
    const aantal = item.aantal || 1;
    telStatus(s, itemPrijs(item, prijzen), item.label, aantal);
    if (item.aankoop != null && (s.a || s.b)) {
      label(item.label).aankoop += item.aankoop * aantal;
      label(item.label).aankoopN += aantal;
    }
  }
  return t;
}

// Bouwt per kaart een reeks prijzen over de dagen, met de vorige bekende waarde
// doorgetrokken over gaten. dagen: ["2026-10-05", ...], snapshots: { dag: { id: cent } }
export function bouwReeks(dagen, snapshots) {
  const kaarten = {};
  dagen.forEach((dag, i) => {
    for (const [id, waarde] of Object.entries(snapshots[dag] || {})) {
      if (!kaarten[id]) kaarten[id] = Array(dagen.length).fill(null);
      kaarten[id][i] = waarde;
    }
  });
  for (const rij of Object.values(kaarten)) {
    let laatst = null;
    for (let i = 0; i < rij.length; i++) {
      if (rij[i] == null) rij[i] = laatst;
      else laatst = rij[i];
    }
    // Vóór de eerste bekende waarde: terugvullen met die eerste waarde
    const eerste = rij.find((v) => v != null);
    for (let i = 0; i < rij.length && rij[i] == null; i++) rij[i] = eerste;
  }
  return kaarten;
}

// Waarde per dag van een groep kaarten (bijv. alles in bezit). Kaarten zonder reeks
// tellen mee met hun huidige prijs, zodat het laatste punt gelijk is aan het totaal.
// `aantal` geeft per id hoe vaak iets meetelt (items kun je meerdere keren hebben).
export function dagwaarden(ids, reeks, prijzen, aantal = {}) {
  const n = reeks.dagen.length;
  const uit = Array(n).fill(0);
  for (const id of ids) {
    const rij = reeks.kaarten[id];
    const nu = prijzen[id]?.e ?? 0;
    const x = aantal[id] ?? 1;
    for (let i = 0; i < n; i++) uit[i] += (rij?.[i] ?? nu) * x;
  }
  if (n) uit[n - 1] = ids.reduce((s, id) => s + (prijzen[id]?.e ?? 0) * (aantal[id] ?? 1), 0);
  return uit;
}

// Grootste stijgers en dalers over `periode` dagen, alleen tussen echte (live) prijzen.
export function bewegers({ ids, reeks, periode, minimum = 5, aantal = 5 }) {
  const n = reeks.dagen.length;
  if (n < 2) return { stijgers: [], dalers: [], vanaf: null };
  const doel = new Date(reeks.dagen[n - 1] + "T12:00:00Z");
  doel.setUTCDate(doel.getUTCDate() - periode);
  const doelDag = doel.toISOString().slice(0, 10);
  let i0 = reeks.dagen.findIndex((d) => d >= doelDag);
  if (i0 < 0 || i0 === n - 1) i0 = 0;
  const lijst = [];
  for (const id of ids) {
    const rij = reeks.kaarten[id];
    if (!rij || rij[i0] == null || rij[n - 1] == null) continue;
    const verschil = rij[n - 1] - rij[i0];
    if (Math.abs(verschil) < minimum) continue;
    lijst.push({ id, van: rij[i0], naar: rij[n - 1], verschil, procent: rij[i0] ? verschil / rij[i0] : null });
  }
  lijst.sort((x, y) => y.verschil - x.verschil);
  return {
    stijgers: lijst.filter((x) => x.verschil > 0).slice(0, aantal),
    dalers: lijst.filter((x) => x.verschil < 0).reverse().slice(0, aantal),
    vanaf: reeks.dagen[i0],
  };
}

// Euro-notatie: onder € 1.000 met centen, daarboven afgerond
export function euro(c, { altijdCenten = false } = {}) {
  if (c == null) return "?";
  const v = c / 100;
  return (
    "€ " +
    v.toLocaleString("nl-NL", {
      minimumFractionDigits: altijdCenten || Math.abs(v) < 1000 ? 2 : 0,
      maximumFractionDigits: altijdCenten || Math.abs(v) < 1000 ? 2 : 0,
    })
  );
}
