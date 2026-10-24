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

const koppeling = { product: 1, sub: "Normal" };

test("marktprijs gaat voor en wordt omgerekend", () => {
  const p = kaartPrijs({
    koppeling,
    rijen: [{ subTypeName: "Normal", marketPrice: 1.23, lowPrice: 0.5 }],
    fx: 0.9,
    dag: "2026-10-14",
  });
  assert.deepEqual(p, { e: 111, t: "m", u: 123, d: "2026-10-14" });
});

test("zonder marktprijs: laagste aanbod als vraagprijs", () => {
  const p = kaartPrijs({
    koppeling,
    rijen: [{ subTypeName: "Normal", marketPrice: null, lowPrice: 10 }],
    fx: 0.9,
    dag: "2026-10-14",
  });
  assert.equal(p.t, "l");
  assert.equal(p.e, 900);
});

test("alleen de gekozen variant telt", () => {
  const p = kaartPrijs({
    koppeling,
    rijen: [{ subTypeName: "Reverse Holofoil", marketPrice: 5 }],
    fx: 1,
    dag: "2026-10-14",
    vast: { eur: 0.3, type: "market" },
  });
  assert.equal(p.t, "v");
});

test("groep niet opgehaald: vorige live prijs blijft staan, zonder Cardmarket", () => {
  const vorige = { e: 200, t: "m", u: 220, d: "2026-10-13", cm: { t: 150 } };
  const p = kaartPrijs({ koppeling, rijen: undefined, fx: 0.9, dag: "2026-10-14", vorige });
  assert.deepEqual(p, { e: 200, t: "m", u: 220, d: "2026-10-13" });
});

test("Cardmarket-trend gaat voor, TCGplayer blijft erbij ter vergelijking", () => {
  const p = kaartPrijs({
    koppeling,
    rijen: [{ subTypeName: "Normal", marketPrice: 1.23 }],
    fx: 0.9,
    dag: "2026-10-24",
    cm: { t: 95, low: 40, a7: 100, a30: 90, d: "2026-10-25" },
  });
  assert.deepEqual(p, {
    e: 95,
    t: "c",
    d: "2026-10-25",
    cm: { low: 40, a7: 100, a30: 90 },
    us: { e: 111, t: "m", u: 123, d: "2026-10-24" },
  });
});

test("Cardmarket een dag weg: de vorige Cardmarket-prijs blijft, niet terug naar TCGplayer", () => {
  const vorige = { e: 95, t: "c", d: "2026-10-24", cm: { low: 40, a7: 100, a30: 90 }, us: { e: 100, t: "m", u: 110, d: "2026-10-23" } };
  const p = kaartPrijs({ koppeling, rijen: [{ subTypeName: "Normal", marketPrice: 2 }], fx: 0.9, dag: "2026-10-25", vorige, cm: null });
  assert.equal(p.t, "c");
  assert.equal(p.e, 95);
  assert.deepEqual(p.us, { e: 180, t: "m", u: 200, d: "2026-10-25" });
});

test("zonder Cardmarket: TCGplayer, ook de vorige TCGplayer-prijs uit een Cardmarket-record", () => {
  const p = kaartPrijs({ koppeling, rijen: [{ subTypeName: "Normal", marketPrice: 2 }], fx: 0.9, dag: "2026-10-25" });
  assert.deepEqual(p, { e: 180, t: "m", u: 200, d: "2026-10-25" });
  const zonderRijen = kaartPrijs({ koppeling, rijen: undefined, fx: 0.9, dag: "2026-10-25", vorige: p });
  assert.deepEqual(zonderRijen, p);
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
  assert.equal(itemPrijs(item, { i1: { e: 6000, t: "m" } }).e, 6000);
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

const live = (e, d = "2026-10-20", t = "m") => ({ e, t, d });
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

test("geen melding zonder nieuwe dag, tussen verschillende soorten of zonder live prijs", () => {
  const kandidaten = ["zelfdeDag", "soort", "vast", "nieuw", "weg"].map((id) => kandidaat(id));
  const vorige = {
    zelfdeDag: live(1000, "2026-10-20"),
    soort: live(1000, "2026-10-19", "l"),
    vast: { e: 1000, t: "v", d: "2026-10-05" },
    weg: live(1000, "2026-10-19"),
  };
  const prijzen = {
    zelfdeDag: live(2000),
    soort: live(2000),
    vast: live(2000),
    nieuw: live(2000),
    weg: { e: null, t: "o" },
  };
  assert.deepEqual(prijsMeldingen({ prijzen, vorige, kandidaten }), []);
});

test("meldingen ook tussen Cardmarket-prijzen, maar niet bij de overstap van TCGplayer naar Cardmarket", () => {
  const kandidaten = [kandidaat("x"), kandidaat("y")];
  const vorige = { x: live(1000, "2026-10-24", "c"), y: live(1000, "2026-10-24", "m") };
  const prijzen = { x: live(1300, "2026-10-25", "c"), y: live(1300, "2026-10-25", "c") };
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
