import { test } from "node:test";
import assert from "node:assert/strict";
import { Invoerfout } from "../invoer.mjs";
import { maakBeurtrij, normaliseerTerm, uitNominatim, uitOrs, zoekMet } from "./geocode.mjs";

// Een hash die zich gedraagt als Upstash: objecten gaan er heel in en heel uit
function nepRedis() {
  const vakken = new Map();
  return {
    vakken,
    async hget(hash, veld) {
      return vakken.get(`${hash}/${veld}`) ?? null;
    },
    async hset(hash, paar) {
      for (const [veld, waarde] of Object.entries(paar)) vakken.set(`${hash}/${veld}`, waarde);
    },
  };
}

// Telt hoe vaak de zoekdienst echt gebeld is
function nepDienst(antwoord) {
  const dienst = async (term) => {
    dienst.beurten.push(term);
    return typeof antwoord === "function" ? antwoord(term) : antwoord;
  };
  dienst.beurten = [];
  return dienst;
}

const HASH = "roadtrip:geocode";
const LIDO = { naam: "Camping Lido", adres: "Camping Lido, Luzern", lat: 47.05026, lon: 8.33814 };

test("normaliseerTerm maakt van elke schrijfwijze dezelfde sleutel", () => {
  assert.equal(normaliseerTerm("  Camping   Lido Luzern "), "camping lido luzern");
  assert.equal(normaliseerTerm("CAMPING LIDO LUZERN"), "camping lido luzern");
  assert.equal(normaliseerTerm(null), "");
});

test("een eindeloze zoekterm is een invoerfout, geen cacheregel", () => {
  assert.throws(() => normaliseerTerm("x".repeat(121)), Invoerfout);
  assert.equal(normaliseerTerm("x".repeat(120)).length, 120);
});

test("uitNominatim haalt naam, adres en coördinaten eruit", () => {
  const treffers = uitNominatim([
    {
      name: "Camping Lido Luzern",
      display_name: "Camping Lido Luzern, Lidostrasse 19, Luzern, Schweiz",
      lat: "47.0502644",
      lon: "8.3381410",
    },
  ]);
  assert.deepEqual(treffers, [
    {
      naam: "Camping Lido Luzern",
      adres: "Camping Lido Luzern, Lidostrasse 19, Luzern, Schweiz",
      lat: 47.05026,
      lon: 8.33814,
    },
  ]);
});

test("zonder eigen naam wordt het eerste deel van het adres de naam", () => {
  const treffers = uitNominatim([{ display_name: "Lidostrasse 19, Luzern", lat: "47", lon: "8" }]);
  assert.equal(treffers[0].naam, "Lidostrasse 19");
  assert.equal(treffers[0].adres, "Lidostrasse 19, Luzern");
});

test("uitNominatim slaat over wat geen bruikbare plek is", () => {
  const treffers = uitNominatim([
    { name: "Zonder plek", display_name: "Zonder plek", lat: "niks", lon: "8.3" },
    { name: "", display_name: "", lat: "47", lon: "8" },
    { name: "Goed", display_name: "Goed, Luzern", lat: "47", lon: "8" },
  ]);
  assert.equal(treffers.length, 1);
  assert.equal(treffers[0].naam, "Goed");
});

test("uitOrs leest coordinates als [lon, lat], niet andersom", () => {
  const treffers = uitOrs({
    features: [
      {
        geometry: { coordinates: [8.33814, 47.05026] },
        properties: { name: "Camping Lido", label: "Camping Lido, Luzern, Zwitserland" },
      },
    ],
  });
  assert.deepEqual(treffers, [
    { naam: "Camping Lido", adres: "Camping Lido, Luzern, Zwitserland", lat: 47.05026, lon: 8.33814 },
  ]);
});

test("een antwoord dat nergens op lijkt is geen lege lijst, maar null", () => {
  // null betekent "de dienst deed het niet" en hoort dus niet de cache in
  assert.equal(uitNominatim(null), null);
  assert.equal(uitNominatim({ fout: "boem" }), null);
  assert.equal(uitOrs(null), null);
  assert.equal(uitOrs({ features: "geen lijst" }), null);
});

test("dezelfde zoekterm belt de dienst maar één keer", async () => {
  const redis = nepRedis();
  const dienst = nepDienst([LIDO]);

  const eerste = await zoekMet({ term: "Camping Lido Luzern", redis, hash: HASH, haalOp: dienst });
  const tweede = await zoekMet({ term: "Camping Lido Luzern", redis, hash: HASH, haalOp: dienst });

  assert.deepEqual(eerste, { treffers: [LIDO], uitCache: false });
  assert.deepEqual(tweede, { treffers: [LIDO], uitCache: true });
  assert.equal(dienst.beurten.length, 1, "de tweede keer hoort uit de cache te komen");
});

test("een andere schrijfwijze is dezelfde vraag, dus ook uit de cache", async () => {
  const redis = nepRedis();
  const dienst = nepDienst([LIDO]);

  await zoekMet({ term: "Camping Lido Luzern", redis, hash: HASH, haalOp: dienst });
  const tweede = await zoekMet({ term: "  camping   LIDO luzern ", redis, hash: HASH, haalOp: dienst });

  assert.equal(tweede.uitCache, true);
  assert.equal(dienst.beurten.length, 1);
  assert.ok(redis.vakken.has(`${HASH}/camping lido luzern`));
});

test("niets gevonden is een antwoord, en gaat dus wel de cache in", async () => {
  const redis = nepRedis();
  const dienst = nepDienst([]);

  const uitslag = await zoekMet({ term: "qqqzzz", redis, hash: HASH, haalOp: dienst });
  await zoekMet({ term: "qqqzzz", redis, hash: HASH, haalOp: dienst });

  assert.deepEqual(uitslag, { treffers: [], uitCache: false });
  assert.equal(uitslag.dienstWeg, undefined);
  assert.equal(dienst.beurten.length, 1);
});

test("een dienst die niet antwoordt geeft dienstWeg en blijft buiten de cache", async () => {
  const redis = nepRedis();
  const stuk = nepDienst(() => {
    throw new Error("geen netwerk");
  });

  const uitslag = await zoekMet({ term: "camping lido", redis, hash: HASH, haalOp: stuk });
  assert.deepEqual(uitslag, { treffers: [], uitCache: false, dienstWeg: true });
  assert.equal(redis.vakken.size, 0, "een storing hoort niet te blijven hangen");

  // En zodra de dienst weer antwoordt, wordt er gewoon opnieuw gevraagd
  const dienst = nepDienst([LIDO]);
  const later = await zoekMet({ term: "camping lido", redis, hash: HASH, haalOp: dienst });
  assert.deepEqual(later.treffers, [LIDO]);
});

test("een te korte zoekterm belt de dienst niet", async () => {
  const dienst = nepDienst([LIDO]);
  const uitslag = await zoekMet({ term: "lu", redis: nepRedis(), hash: HASH, haalOp: dienst });

  assert.deepEqual(uitslag, { treffers: [], uitCache: false });
  assert.equal(dienst.beurten.length, 0);
});

test("zonder database werkt zoeken gewoon, alleen zonder cache", async () => {
  const dienst = nepDienst([LIDO]);

  const eerste = await zoekMet({ term: "camping lido", redis: null, hash: HASH, haalOp: dienst });
  await zoekMet({ term: "camping lido", redis: null, hash: HASH, haalOp: dienst });

  assert.deepEqual(eerste.treffers, [LIDO]);
  assert.equal(dienst.beurten.length, 2);
});

test("een cache die stuk is houdt het zoeken niet tegen", async () => {
  const stukkeCache = {
    async hget() {
      throw new Error("database weg");
    },
    async hset() {
      throw new Error("database weg");
    },
  };
  const dienst = nepDienst([LIDO]);

  const uitslag = await zoekMet({ term: "camping lido", redis: stukkeCache, hash: HASH, haalOp: dienst });
  assert.deepEqual(uitslag.treffers, [LIDO]);
});

test("de dienst krijgt de genormaliseerde term, niet wat er precies getypt is", async () => {
  const dienst = nepDienst([LIDO]);
  await zoekMet({ term: "  Camping   Lido  ", redis: null, hash: HASH, haalOp: dienst });
  assert.deepEqual(dienst.beurten, ["camping lido"]);
});

// ---- De wachtrij naar Nominatim -------------------------------------------
// Korte pauzes, anders duurt de test een eeuwigheid; het gedrag is hetzelfde.

test("verzoeken die tegelijk binnenkomen vertrekken netjes na elkaar", async () => {
  const opZijnBeurt = maakBeurtrij(60);
  const begin = Date.now();
  const vertrek = [];

  await Promise.all([1, 2, 3, 4].map(() => opZijnBeurt(() => vertrek.push(Date.now() - begin))));

  assert.equal(vertrek.length, 4);
  const gaten = vertrek.slice(1).map((t, i) => t - vertrek[i]);
  for (const gat of gaten) {
    assert.ok(gat >= 55, `twee verzoeken vertrokken ${gat}ms na elkaar — dat is binnen dezelfde pauze`);
  }
});

test("één mislukt verzoek breekt de wachtrij niet", async () => {
  const opZijnBeurt = maakBeurtrij(20);
  const gelukt = [];

  await assert.rejects(() => opZijnBeurt(() => Promise.reject(new Error("dienst weg"))));
  await opZijnBeurt(() => gelukt.push("daarna"));

  assert.deepEqual(gelukt, ["daarna"], "na een mislukking moet de volgende gewoon aan de beurt komen");
});

test("de wachtrij houdt de volgorde aan waarin er gevraagd is", async () => {
  const opZijnBeurt = maakBeurtrij(10);
  const volgorde = [];

  await Promise.all(["a", "b", "c"].map((naam) => opZijnBeurt(() => volgorde.push(naam))));

  assert.deepEqual(volgorde, ["a", "b", "c"]);
});
