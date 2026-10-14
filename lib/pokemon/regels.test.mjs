import test from "node:test";
import assert from "node:assert/strict";
import {
  amsterdamDatum,
  bewegers,
  bouwReeks,
  dagwaarden,
  euro,
  itemPrijs,
  kiesVariant,
  kaartPrijs,
  naarBits,
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
