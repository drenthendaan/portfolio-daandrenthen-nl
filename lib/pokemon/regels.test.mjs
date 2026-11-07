import test from "node:test";
import assert from "node:assert/strict";
import {
  amsterdamDatum,
  bewegers,
  bouwReeks,
  dagErvoor,
  dagwaarden,
  euro,
  itemPrijs,
  kiesVariant,
  kaartPrijs,
  meldingKandidaten,
  meldingStand,
  naarBits,
  prijsMeldingen,
  pushBericht,
  totalen,
  vanBits,
} from "./regels.mjs";
import { cardmarketPrijs } from "./tcgdex.mjs";

test("de Cardmarket-trend, en de vorige prijs als de lijst niet is opgehaald", () => {
  const cm = { e: 180, t: "c", d: "2026-11-01", s: "trend" };
  assert.equal(kaartPrijs({ vast: { eur: 3 }, live: cm }), cm);
  const vorige = { e: 200, t: "c", d: "2026-10-31", s: "trend" };
  assert.equal(kaartPrijs({ vorige, vast: { eur: 3 }, live: undefined }), vorige);
  // Opgehaald maar zonder prijs (nooit het laagste aanbod): de lijst
  assert.deepEqual(kaartPrijs({ vorige, vast: { eur: 3 }, live: null }), { e: 300, t: "v", d: "2026-10-05" });
  // Eigen items zonder Cardmarket-product houden de TCGplayer-marktprijs
  const tcg = { e: 90, t: "m", u: 100, d: "2026-11-01" };
  assert.equal(kaartPrijs({ live: tcg }), tcg);
});

test("Cardmarket: trend, zonder trend of bij een kapotte trend het 30-daags gemiddelde", () => {
  assert.deepEqual(cardmarketPrijs({ trend: 1.5, avg30: 1.2, avg7: 1.4 }), { t: 150, soort: "trend", a7: 140, a30: 120 });
  assert.equal(cardmarketPrijs({ avg30: 1.2 }).soort, "avg30");
  // Base Set-Pikachu: trend € 0,02 bij een gemiddelde van € 17,14
  assert.deepEqual(cardmarketPrijs({ trend: 0.02, avg30: 17.14 }), { t: 1714, soort: "avg30", a7: null, a30: 1714 });
  assert.equal(cardmarketPrijs({ trend: 9, "trend-holo": 2, "avg30-holo": 2.1 }, true).t, 200);
  assert.equal(cardmarketPrijs({ low: 0.5 }), null);
});

test("terugval op vaste prijs en onbekend", () => {
  assert.deepEqual(kaartPrijs({ vast: { eur: 2.5, type: "asking" } }), {
    e: 250,
    t: "v",
    d: "2026-10-05",
    vraag: true,
  });
  assert.deepEqual(kaartPrijs({ vast: { eur: null, type: "unknown" } }), { e: null, t: "o" });
});

test("bits heen en terug", () => {
  const v = { w: true, b: false, o: true, a: true };
  assert.equal(naarBits(v), 13);
  assert.deepEqual(vanBits(13), v);
  assert.equal(naarBits({}), 0);
});

test("totalen: in bezit en betaald (nog niet binnen)", () => {
  const items = [
    { id: "a", label: "kaarten", status: { b: true, a: true }, start: { e: 100, t: "c", d: "2026-10-14" } },
    { id: "b", label: "kaarten", status: { b: true }, waarde: 50 },
    { id: "c", label: "kaarten", status: { w: true, o: true } }, // oude vinkjes tellen niet mee
    { id: "d", label: "kaarten", status: { b: true } },
    { id: "e", label: "kaarten", status: { a: true }, start: { e: 25, t: "v", d: "2026-10-05" } }, // gekregen
  ];
  const t = totalen({ prijzen: {}, items });
  assert.equal(t.bezit.cent, 125);
  assert.equal(t.bezit.n, 2);
  assert.deepEqual(t.bezit.perType, { c: 1, v: 1 });
  assert.equal(t.betaald.n, 2);
  assert.equal(t.betaald.cent, 50);
  assert.equal(t.betaald.zonderPrijs, 1);
});

test("items: live prijs, dan prijs bij toevoegen, dan eigen waarde", () => {
  const item = { id: "i1", start: { e: 5000, t: "m", u: 5600, d: "2026-10-14" }, waarde: 4000 };
  assert.equal(itemPrijs(item, { i1: { e: 6000, t: "m", d: "2026-10-25" } }).e, 6000);
  assert.equal(itemPrijs(item, {}).e, 5000);
  assert.deepEqual(itemPrijs({ id: "i2", waarde: 4000 }, {}), { e: 4000, t: "h" });
  assert.deepEqual(itemPrijs({ id: "i3" }, {}), { e: null, t: "o" });
  // Kaart uit de oorspronkelijke lijst: de vaste prijs tot er een Cardmarket-prijs is
  const vast = { id: "ka1", start: { e: 25, t: "v", d: "2026-10-05" } };
  assert.equal(itemPrijs(vast, {}).t, "v");
  assert.equal(itemPrijs(vast, { ka1: { e: 30, t: "c", d: "2026-11-07" } }).e, 30);
});

test("items tellen mee met aantal, per label en met aankoopprijs", () => {
  const items = [
    { id: "i1", label: "etb", aantal: 2, aankoop: 5000, waarde: 6000, status: { b: true, a: true } },
    { id: "i2", label: "etb", aantal: 1, waarde: 7000, status: { b: true } },
    { id: "i3", label: "overig", aantal: 1, waarde: 100, status: {} },
  ];
  const t = totalen({
    prijzen: { k: { e: 10, t: "c" } },
    items: [...items, { id: "k", label: "kaarten", aantal: 1, status: { a: true } }],
  });
  assert.equal(t.bezit.cent, 10 + 12000);
  assert.equal(t.bezit.n, 3);
  assert.equal(t.betaald.cent, 7000);
  assert.equal(t.perLabel.etb.bezit.n, 2);
  assert.equal(t.perLabel.etb.aankoop, 10000);
  assert.equal(t.perLabel.kaarten.bezit.cent, 10);
  assert.equal(t.perLabel.overig, undefined); // niet betaald en niet in bezit
});

test("variant kiezen voor een item", () => {
  assert.equal(kiesVariant([{ subTypeName: "Normal", marketPrice: 120.9 }]), "Normal");
  assert.equal(
    kiesVariant([
      { subTypeName: "Reverse Holofoil", marketPrice: 3 },
      { subTypeName: "Holofoil", marketPrice: 2 },
    ]),
    "Holofoil"
  );
  assert.equal(kiesVariant([{ subTypeName: "Reverse Holofoil", marketPrice: 3 }]), "Reverse Holofoil");
  assert.equal(kiesVariant([]), null);
});

test("reeks trekt waarden door en vult terug", () => {
  const dagen = ["d1", "d2", "d3", "d4"];
  const r = bouwReeks(dagen, { d2: { x: 10 }, d4: { x: 30, y: 5 } });
  assert.deepEqual(r.x, [10, 10, 10, 30]);
  assert.deepEqual(r.y, [5, 5, 5, 5]);
});

test("dagwaarden: laatste punt is altijd het huidige totaal", () => {
  const reeks = { dagen: ["d1", "d2"], kaarten: { x: [10, 20] } };
  const prijzen = { x: { e: 25 }, z: { e: 7 } };
  assert.deepEqual(dagwaarden(["x", "z"], reeks, prijzen), [17, 32]);
});

test("bewegers over een periode", () => {
  const reeks = {
    dagen: ["2026-10-05", "2026-10-13", "2026-10-14"],
    kaarten: { up: [100, 150, 200], down: [100, 90, 40], stil: [100, 100, 102] },
  };
  const b = bewegers({ ids: ["up", "down", "stil"], reeks, periode: 7 });
  assert.equal(b.vanaf, "2026-10-13");
  assert.deepEqual(b.stijgers.map((x) => x.id), ["up"]);
  assert.deepEqual(b.dalers.map((x) => x.id), ["down"]);
  assert.equal(b.dalers[0].verschil, -50);
});

test("datum in Amsterdam en euro-notatie", () => {
  assert.equal(amsterdamDatum(new Date("2026-10-13T22:30:00Z")), "2026-10-14");
  assert.equal(euro(1182), "€ 11,82");
  assert.equal(euro(3256000), "€ 32.560");
  assert.equal(euro(null), "?");
});

// ---------- Prijsmeldingen ----------

const live = (e, d = "2026-10-20") => ({ e, t: "m", d });
const kandidaat = (id, stand = "bezit") => ({ id, soort: "kaart", naam: id, stand });

test("melding bij ≥ 10 % én ≥ € 1, ook bij een daling", () => {
  const vorige = { a: live(1000, "2026-10-19"), b: live(1000, "2026-10-19"), c: live(500, "2026-10-19"), d: live(10000, "2026-10-19") };
  const prijzen = { a: live(1100), b: live(850), c: live(560), d: live(10500) };
  const uit = prijsMeldingen({ prijzen, vorige, kandidaten: ["a", "b", "c", "d"].map((id) => kandidaat(id)) });
  // c: +12 % maar maar € 0,60; d: + € 5 maar maar 5 %
  assert.deepEqual(uit.map((m) => m.id), ["b", "a"]);
  assert.deepEqual(uit[0], {
    ...kandidaat("b"),
    van: 1000,
    naar: 850,
    vanDag: "2026-10-19",
    dag: "2026-10-20",
    verschil: -150,
    procent: -15,
  });
  assert.equal(uit[1].procent, 10);
});

test("geen melding zonder nieuwe dag of zonder live prijs", () => {
  const kandidaten = ["zelfdeDag", "vast", "nieuw", "weg"].map((id) => kandidaat(id));
  const vorige = {
    zelfdeDag: live(1000, "2026-10-20"),
    vast: { e: 1000, t: "v", d: "2026-10-05" },
    weg: live(1000, "2026-10-19"),
  };
  const prijzen = { zelfdeDag: live(2000), vast: live(2000), nieuw: live(2000), weg: { e: null, t: "o" } };
  assert.deepEqual(prijsMeldingen({ prijzen, vorige, kandidaten }), []);
});

test("geen melding bij de overstap van een oude Cardmarket-prijs", () => {
  const kandidaten = [kandidaat("x"), kandidaat("y")];
  const vorige = { x: live(1000, "2026-10-24"), y: { e: 1000, t: "c", d: "2026-10-24", cm: { id: 1 } } };
  const prijzen = { x: live(1300, "2026-10-25"), y: live(1300, "2026-10-25") };
  assert.deepEqual(prijsMeldingen({ prijzen, vorige, kandidaten }).map((m) => m.id), ["x"]);
});

test("uitschieters in de verkoopdata tellen niet", () => {
  const kandidaten = [kandidaat("x"), kandidaat("y")];
  const vorige = { x: live(6699, "2026-10-19"), y: live(22, "2026-10-19") };
  const prijzen = { x: live(22), y: live(6664) };
  assert.deepEqual(prijsMeldingen({ prijzen, vorige, kandidaten }), []);
});

test("eigen drempel en een langere periode na een gat", () => {
  const vorige = { x: live(1000, "2026-10-17") };
  const prijzen = { x: live(1060) };
  const kandidaten = [kandidaat("x")];
  assert.equal(prijsMeldingen({ prijzen, vorige, kandidaten }).length, 0);
  const [m] = prijsMeldingen({ prijzen, vorige, kandidaten, drempel: { procent: 5, minimum: 50 } });
  assert.equal(m.vanDag, "2026-10-17");
  assert.notEqual(m.vanDag, dagErvoor(m.dag));
  assert.equal(dagErvoor("2026-11-01"), "2026-10-31");
});

test("stand: in je vault, gekocht en onderweg, nog kopen", () => {
  assert.equal(meldingStand({ a: true, b: true }, true), "bezit");
  assert.equal(meldingStand({ b: true }, false), "betaald");
  assert.equal(meldingStand({}, true), "nog");
  assert.equal(meldingStand(undefined, false), null);
});

test("kandidaten: items in een verzameling, en losse items alleen als je ze hebt", () => {
  const verzamelingen = [{ id: "pikachu" }, { id: "eevee" }];
  const items = [
    { id: "k1", naam: "Pikachu", set: "Base", nummer: "58", img: ["t:1", "d:a", "d:b"], status: { a: true }, verzameling: "pikachu" },
    { id: "k2", naam: "Pikachu ex", status: {}, verzameling: "pikachu" },
    { id: "i1", naam: "ETB", status: { b: true }, verzameling: null, aantal: 2 },
    { id: "i2", naam: "Eevee", status: {}, verzameling: "eevee" },
    { id: "i3", naam: "Los", status: {}, verzameling: null },
    { id: "i4", naam: "Weg", status: {}, verzameling: "bestaat-niet" },
  ];
  const uit = meldingKandidaten({ items, verzamelingen });
  assert.deepEqual(
    uit.map((k) => [k.id, k.stand]),
    [["k1", "bezit"], ["k2", "nog"], ["i1", "betaald"], ["i2", "nog"]]
  );
  assert.deepEqual(uit[0], { id: "k1", soort: "item", naam: "Pikachu", set: "Base", nr: "58", img: ["t:1", "d:a"], stand: "bezit", aantal: 1 });
  assert.equal(uit[2].aantal, 2);
});

test("pushbericht: één wijziging of een lijstje", () => {
  const m = (naam, verschil, stand) => ({ naam, van: 1000, naar: 1000 + verschil, verschil, procent: verschil / 10, stand, dag: "2026-10-20" });
  const een = pushBericht([m("Pikachu ex", 123, "bezit")]);
  assert.equal(een.titel, "Pikachu ex ▲ 12%");
  assert.equal(een.tekst, "€ 10,00 → € 11,23 · in je vault");
  assert.equal(een.url, "/pokemon#meldingen");
  assert.equal(een.tag, "prijzen-2026-10-20");
  const veel = pushBericht([
    m("A", -200, "nog"),
    m("B", 150, "betaald"),
    m("C", 110, "bezit"),
    m("D", 100, "bezit"),
    m("E", 100, "nog"),
  ]);
  assert.equal(veel.titel, "5 grote prijswijzigingen");
  assert.equal(veel.tekst.split("\n")[0], "▼ 20% A · nog kopen");
  assert.equal(veel.tekst.split("\n")[1], "▲ 15% B · gekocht, onderweg");
  assert.equal(veel.tekst.split("\n").at(-1), "en nog 1");
  assert.equal(veel.aantal, 5);
});

// ---------- Controle op foute prijzen ----------
