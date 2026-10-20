import test from "node:test";
import assert from "node:assert/strict";
import { binderVan, BINDERS, geldigeMapcode, leesMapcode, mapPositie, schoonBinder, spreads } from "./binders.mjs";

test("Vault X 9-pocket zwart: 40 pagina's van 3×3", () => {
  const b = binderVan({ binder: { type: "vaultx-9-zwart" } });
  assert.equal(b.vakjes, 9);
  assert.equal(b.kolommen, 3);
  assert.equal(b.paginas, 40);
  assert.equal(b.vakjes * b.paginas, 360);
  assert.ok(BINDERS.some((x) => x.id === "vaultx-12-zwart" && x.kolommen === 4));
  assert.equal(binderVan({}), null);
});

test("eigen binder en controle", () => {
  assert.deepEqual(schoonBinder({ type: "eigen", naam: "Grote map", vakjes: "12", paginas: "60" }).binder, {
    type: "eigen",
    naam: "Grote map",
    vakjes: 12,
    paginas: 60,
  });
  assert.equal(binderVan({ binder: { type: "eigen", vakjes: 4, paginas: 10 } }).kolommen, 2);
  assert.ok(schoonBinder({ type: "eigen", vakjes: 7, paginas: 10 }).fout);
  assert.ok(schoonBinder({ type: "bestaat-niet" }).fout);
  assert.equal(schoonBinder(null).binder, null);
});

test("mapcodes", () => {
  const negen = binderVan({ binder: { type: "vaultx-9-zwart" } });
  const twaalf = binderVan({ binder: { type: "vaultx-12-zwart" } });
  assert.deepEqual(leesMapcode("11.7"), { pagina: 11, vakje: 7 });
  assert.ok(geldigeMapcode("3.5", negen));
  assert.ok(!geldigeMapcode("3.10", negen));
  assert.ok(geldigeMapcode("3.10", twaalf));
  assert.ok(!geldigeMapcode("41.1", negen));
  assert.ok(!geldigeMapcode("3.0"));
  assert.ok(!geldigeMapcode("3"));
  assert.ok(geldigeMapcode("120.9"));
  assert.equal(mapPositie("11.7"), 1107);
  assert.ok(mapPositie("3.10") > mapPositie("3.9"));
  assert.equal(mapPositie("x"), null);
});

test("opengeslagen pagina's", () => {
  assert.deepEqual(spreads(5), [[1], [2, 3], [4, 5]]);
  assert.deepEqual(spreads(4), [[1], [2, 3], [4]]);
  assert.equal(spreads(40).length, 21);
});
