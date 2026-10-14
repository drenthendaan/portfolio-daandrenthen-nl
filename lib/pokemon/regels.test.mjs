import test from "node:test";
import assert from "node:assert/strict";
import {
  amsterdamDatum,
  bewegers,
  bouwReeks,
  dagwaarden,
  euro,
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

test("totalen: bezit, onderweg, wantslijst, besteld en nog te gaan", () => {
  const kaarten = [
    { id: "a", list: "EN" },
    { id: "b", list: "EN" },
    { id: "c", list: "EN" },
    { id: "d", list: "JP" },
  ];
  const status = {
    a: { w: true, b: true, o: true, a: true },
    b: { w: true, b: true, o: true, a: false },
    c: { w: true },
    d: { w: true },
  };
  const prijzen = { a: { e: 100, t: "m" }, b: { e: 50, t: "l" }, c: { e: null, t: "o" }, d: { e: 9999, t: "v" } };
  const t = totalen({ kaarten, status, prijzen, kosten: { cent: 300, ids: new Set(["a", "b"]) } });
  assert.equal(t.bezit.cent, 100);
  assert.equal(t.bezit.n, 1);
  assert.equal(t.onderweg.cent, 50);
  assert.equal(t.wantslijst.n, 2);
  assert.equal(t.wantslijst.zonderPrijs, 1);
  assert.equal(t.besteld.cent, 150);
  assert.deepEqual(t.binder, { bezit: 1, totaal: 3 });
  assert.equal(t.nogTeGaan.cent, 50); // JP telt niet mee
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
