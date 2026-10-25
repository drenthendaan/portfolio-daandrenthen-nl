import test from "node:test";
import assert from "node:assert/strict";
import {
  amsterdamDatum,
  bewegers,
  bewaakPrijs,
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

const cmRij = { t: 95, soort: "trend", a7: 100, a30: 90, d: "2026-10-25", id: 12 };

test("de prijs is de Cardmarket-trend uit de prijslijst van vannacht", () => {
  assert.deepEqual(kaartPrijs({ cm: cmRij, product: 12, vast: { eur: 3 } }), {
    e: 95,
    t: "c",
    d: "2026-10-25",
    cm: { soort: "trend", a7: 100, a30: 90, id: 12 },
  });
});

test("Cardmarket: de trend, zonder trend het gemiddelde van 30 dagen, nooit de laagste prijs", () => {
  assert.deepEqual(cardmarketPrijs({ trend: 4982.99, avg30: 2871.35, avg7: 3000, low: 1500 }), {
    t: 498299,
    soort: "trend",
    a7: 300000,
    a30: 287135,
  });
  assert.equal(cardmarketPrijs({ trend: 0, avg30: 31.07, low: 2 }).soort, "avg30");
  assert.equal(cardmarketPrijs({ trend: null, avg30: null, low: 2 }), null);
  assert.equal(cardmarketPrijs({ "trend-holo": 12, trend: 3 }, true).t, 1200);
});

test("product een nacht niet in de lijst: de vorige prijs van hetzelfde product blijft", () => {
  const vorige = { e: 95, t: "c", d: "2026-10-24", cm: { id: 12, soort: "trend" } };
  assert.equal(kaartPrijs({ cm: null, product: 12, vorige, vast: { eur: 3 } }), vorige);
});

test("de prijs van een ander of weggehaald product blijft niet hangen", () => {
  const fout = { e: 2861, t: "c", d: "2026-10-24", cm: { id: 99, soort: "trend" } };
  const lijst = { e: 300, t: "v", d: "2026-10-05" };
  assert.deepEqual(kaartPrijs({ cm: null, product: 12, vorige: fout, vast: { eur: 3 } }), lijst);
  assert.deepEqual(kaartPrijs({ cm: null, product: null, vorige: fout, vast: { eur: 3 } }), lijst);
  // Oude gegevens zonder productnummer
  const oud = { e: 2861, t: "c", d: "2026-10-24", cm: { a7: 3000 } };
  assert.deepEqual(kaartPrijs({ cm: null, product: 12, vorige: oud, vast: { eur: 3 } }), lijst);
});

test("zonder Cardmarket-prijs: TCGplayer, en de vorige TCGplayer-prijs als die niet is opgehaald", () => {
  const tcg = { e: 180, t: "m", u: 200, d: "2026-10-25" };
  assert.equal(kaartPrijs({ cm: null, product: null, vast: { eur: 3 }, tcg }), tcg);
  // Cardmarket gaat voor
  assert.equal(kaartPrijs({ cm: cmRij, product: 12, vast: { eur: 3 }, tcg }).t, "c");
  const vorige = { e: 200, t: "m", u: 220, d: "2026-10-24" };
  assert.equal(kaartPrijs({ cm: null, product: null, vorige, vast: { eur: 3 }, tcg: undefined }), vorige);
  // Opgehaald maar zonder marktprijs (nooit het laagste aanbod): de lijst
  assert.deepEqual(kaartPrijs({ cm: null, product: null, vorige, vast: { eur: 3 }, tcg: null }), { e: 300, t: "v", d: "2026-10-05" });
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

test("totalen: in bezit, betaald (nog niet binnen) en binder", () => {
  const kaarten = [
    { id: "a", list: "EN" },
    { id: "b", list: "EN" },
    { id: "c", list: "EN" },
    { id: "d", list: "JP" },
    { id: "e", list: "EN" },
  ];
  const status = {
    a: { b: true, a: true },
    b: { b: true },
    c: { w: true, o: true }, // oude vinkjes tellen niet meer mee
    d: { b: true },
    e: { a: true }, // gekregen: afgerond zonder betaald
  };
  const prijzen = {
    a: { e: 100, t: "m" },
    b: { e: 50, t: "l" },
    c: { e: 7, t: "m" },
    d: { e: null, t: "o" },
    e: { e: 25, t: "v" },
  };
  const t = totalen({ kaarten, status, prijzen });
  assert.equal(t.bezit.cent, 125);
  assert.equal(t.bezit.n, 2);
  assert.deepEqual(t.bezit.perType, { m: 1, v: 1 });
  assert.equal(t.betaald.n, 2);
  assert.equal(t.betaald.cent, 50);
  assert.equal(t.betaald.zonderPrijs, 1);
  assert.deepEqual(t.binder, { bezit: 2, totaal: 4 });
});

test("items: live prijs, dan prijs bij toevoegen, dan eigen waarde", () => {
  const item = { id: "i1", start: { e: 5000, t: "m", u: 5600, d: "2026-10-14" }, waarde: 4000 };
  assert.equal(itemPrijs(item, { i1: { e: 6000, t: "c", d: "2026-10-25" } }).e, 6000);
  assert.equal(itemPrijs(item, {}).e, 5000);
  assert.deepEqual(itemPrijs({ id: "i2", waarde: 4000 }, {}), { e: 4000, t: "h" });
  assert.deepEqual(itemPrijs({ id: "i3" }, {}), { e: null, t: "o" });
});

test("items tellen mee met aantal, per label en met aankoopprijs", () => {
  const items = [
    { id: "i1", label: "etb", aantal: 2, aankoop: 5000, waarde: 6000, status: { b: true, a: true } },
    { id: "i2", label: "etb", aantal: 1, waarde: 7000, status: { b: true } },
    { id: "i3", label: "overig", aantal: 1, waarde: 100, status: {} },
  ];
  const t = totalen({ kaarten: [{ id: "k", list: "EN" }], status: { k: { a: true } }, prijzen: { k: { e: 10, t: "m" } }, items });
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

const live = (e, d = "2026-10-20", id = 1) => ({ e, t: "c", d, cm: { id, soort: "trend" } });
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

test("geen melding zonder nieuwe dag, bij een ander product of zonder live prijs", () => {
  const kandidaten = ["zelfdeDag", "product", "vast", "nieuw", "weg"].map((id) => kandidaat(id));
  const vorige = {
    zelfdeDag: live(1000, "2026-10-20"),
    product: live(1000, "2026-10-19", 2), // nieuwe koppeling: geen marktbeweging
    vast: { e: 1000, t: "v", d: "2026-10-05" },
    weg: live(1000, "2026-10-19"),
  };
  const prijzen = {
    zelfdeDag: live(2000),
    product: live(2000),
    vast: live(2000),
    nieuw: live(2000),
    weg: { e: null, t: "o" },
  };
  assert.deepEqual(prijsMeldingen({ prijzen, vorige, kandidaten }), []);
});

test("geen melding bij de overstap van TCGplayer of van oude gegevens zonder productnummer", () => {
  const kandidaten = [kandidaat("x"), kandidaat("y"), kandidaat("z")];
  const vorige = {
    x: live(1000, "2026-10-24"),
    y: { e: 1000, t: "m", u: 1100, d: "2026-10-24" },
    z: { e: 1000, t: "c", d: "2026-10-24", cm: { a7: 1000 } },
  };
  const prijzen = { x: live(1300, "2026-10-25"), y: live(1300, "2026-10-25"), z: live(1300, "2026-10-25") };
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

test("kandidaten: verborgen Pikachu-kaarten en losse items alleen als je ze hebt", () => {
  const kaarten = [
    { id: "k1", n: "Pikachu", s: "Base", nr: "58", img: ["t:1", "d:a", "d:b"] },
    { id: "k2", n: "Pikachu ex", s: "SV", nr: "1", img: [] },
    { id: "k3", n: "Verborgen", s: "X", nr: "2", img: [] },
    { id: "k4", n: "Verborgen maar binnen", s: "X", nr: "3", img: [] },
  ];
  const status = { k1: { a: true }, k4: { a: true } };
  const verzamelingen = [{ id: "pikachu", verborgen: ["k3", "k4"] }, { id: "eevee", verborgen: [] }];
  const items = [
    { id: "i1", naam: "ETB", status: { b: true }, verzameling: null, aantal: 2 },
    { id: "i2", naam: "Eevee", status: {}, verzameling: "eevee" },
    { id: "i3", naam: "Los", status: {}, verzameling: null },
    { id: "i4", naam: "Weg", status: {}, verzameling: "bestaat-niet" },
  ];
  const uit = meldingKandidaten({ kaarten, status, items, verzamelingen });
  assert.deepEqual(
    uit.map((k) => [k.id, k.stand]),
    [["k1", "bezit"], ["k2", "nog"], ["k4", "bezit"], ["i1", "betaald"], ["i2", "nog"]]
  );
  assert.deepEqual(uit[0], { id: "k1", soort: "kaart", naam: "Pikachu", set: "Base", nr: "58", img: ["t:1", "d:a"], stand: "bezit" });
  assert.equal(uit[3].aantal, 2);
});

test("kandidaten: verborgen kaarten in Japanse Pikachu tellen ook niet als 'nog kopen'", () => {
  const kaarten = [
    { id: "j1", n: "Pikachu", s: "SM-P promo", nr: "227", img: [] },
    { id: "j2", n: "Pikachu", s: "XY-P promo", nr: "050", img: [] },
  ];
  const verzamelingen = [{ id: "pikachu", verborgen: [] }, { id: "japanse-pikachu", verborgen: ["j2"] }];
  const uit = meldingKandidaten({ kaarten, status: {}, verzamelingen });
  assert.deepEqual(uit.map((k) => k.id), ["j1"]);
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

const cmPrijs = (e, d, id = 1) => ({ e, t: "c", d, cm: { id, soort: "trend" } });

test("controle: een gewone wijziging gaat gewoon door", () => {
  const p = bewaakPrijs({ nieuw: cmPrijs(1300, "2026-10-26"), vorige: cmPrijs(1000, "2026-10-25"), lijst: 1100 });
  assert.equal(p.e, 1300);
  assert.equal(p.controle, undefined);
});

test("controle: een sprong van meer dan 50% houdt de oude prijs vast, drie dagen dezelfde sprong is echt", () => {
  const dag1 = bewaakPrijs({ nieuw: cmPrijs(2000, "2026-10-26"), vorige: cmPrijs(1000, "2026-10-25"), lijst: null });
  assert.equal(dag1.e, 1000);
  assert.deepEqual(dag1.controle.reden, ["sprong"]);
  assert.equal(dag1.controle.e, 2000);
  // Zonder nieuwe gegevens (dezelfde prijslijst nog een keer) blijft alles staan
  assert.equal(bewaakPrijs({ nieuw: cmPrijs(2000, "2026-10-26"), vorige: dag1, lijst: null }), dag1);
  const dag2 = bewaakPrijs({ nieuw: cmPrijs(2100, "2026-10-27"), vorige: dag1, lijst: null });
  assert.equal(dag2.e, 1000);
  assert.equal(dag2.controle.keer, 2);
  assert.equal(dag2.controle.sinds, "2026-10-26");
  const dag3 = bewaakPrijs({ nieuw: cmPrijs(2050, "2026-10-28"), vorige: dag2, lijst: null });
  assert.equal(dag3.e, 2050);
  assert.equal(dag3.controle, undefined);
});

test("controle: meer dan 5x afwijking van de lijst blijft staan, met de lijstprijs als het moet", () => {
  // Fout product: € 2,70 voor een kaart die in de lijst € 1.672 kost
  const fout = bewaakPrijs({ nieuw: cmPrijs(270, "2026-10-25", 277048), vorige: null, lijst: 167200 });
  assert.deepEqual(fout, { e: 167200, t: "v", d: "2026-10-05", controle: { ...cmPrijs(270, "2026-10-25", 277048), reden: ["lijst"], keer: 1, sinds: "2026-10-25" } });
  // Ook na drie dagen: dit moet iemand nakijken
  let p = fout;
  for (const d of ["2026-10-26", "2026-10-27", "2026-10-28"]) p = bewaakPrijs({ nieuw: cmPrijs(270, d, 277048), vorige: p, lijst: 167200 });
  assert.equal(p.e, 167200);
  assert.ok(p.controle);
});

test("controle: een afwijking van de lijst lost zichzelf op als het 30-daags gemiddelde hem bevestigt", () => {
  // Lost Origin 052: Cardmarket € 0,16 (gemiddelde € 0,18), lijst € 1,01
  const cm = (e, d, a30) => ({ e, t: "c", d, cm: { id: 674062, soort: "trend", a30 } });
  let p = bewaakPrijs({ nieuw: cm(16, "2026-10-25", 18), vorige: null, lijst: 101 });
  assert.equal(p.e, 101);
  p = bewaakPrijs({ nieuw: cm(16, "2026-10-26", 18), vorige: p, lijst: 101 });
  assert.equal(p.e, 101);
  p = bewaakPrijs({ nieuw: cm(17, "2026-10-27", 18), vorige: p, lijst: 101 });
  assert.equal(p.e, 17);
  assert.equal(p.controle, undefined);
  // XY84: één verkoop van € 14.950 trekt de trend omhoog, het gemiddelde niet: blijft staan
  let q = null;
  for (const d of ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]) {
    q = bewaakPrijs({ nieuw: { e: 221990, t: "c", d, cm: { id: 289809, soort: "trend", a30: 41498 } }, vorige: q, lijst: 7800 });
  }
  assert.equal(q.e, 7800);
  assert.ok(q.controle);
});

test("controle: een nieuwe koppeling telt niet als sprong", () => {
  // Pikachu Gold Star: van het verkeerde product (€ 2,70) naar het goede (€ 4.983)
  const p = bewaakPrijs({ nieuw: cmPrijs(498299, "2026-10-26", 277074), vorige: cmPrijs(270, "2026-10-25", 277048), lijst: 167200 });
  assert.equal(p.e, 498299);
  assert.equal(p.controle, undefined);
});
