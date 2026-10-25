"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { binderVan, BINDERS, EIGEN_VAKJES, leesMapcode, mapPositie } from "@/lib/pokemon/binders.mjs";
import { itemPrijs, vanBits } from "@/lib/pokemon/regels.mjs";
import { japansThema, SECTIE_THEMA, themasVoor } from "@/lib/pokemon/themas.mjs";
import { JAPANS, PIKACHU } from "@/lib/pokemon/vast.mjs";
import { GeenToken } from "./api";
import BinderWeergave from "./BinderWeergave";
import ItemVenster from "./ItemVenster";
import KaartDetail, { datumNL } from "./KaartDetail";
import Kruimelpad from "./Kruimelpad";
import { useItems } from "./useItems";
import "./verzameling.css";

// Drie vinkjes per kaart: wantlist, betaald en afgerond. Onderweg (o) staat nog in de data
// van de Pikachu-kaarten, maar wordt niet getoond; bij wijzigen blijft hij ongemoeid.
const FIELDS = [
  ["w", "Wantlist"],
  ["b", "Betaald"],
  ["a", "Afgerond"],
];
const SHOW = [
  ["all", "alle kaarten"],
  ["w", "op wantlist"],
  ["niets", "nog niet betaald"],
  ["b", "betaald, nog niet binnen"],
  ["a", "afgerond"],
];
const LIVE_INTERVAL = 30_000;
// Zo lang telt een net opgeslagen vinkje boven de serverstand: een verversing die al onderweg
// was toen het opslaan klaar was, geeft nog de oude stand terug.
const BEVESTIGD_MS = 20_000;
const TOKEN = "pika-token";

const lsGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};
const lsJSON = (k) => {
  try {
    const v = JSON.parse(lsGet(k) || "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const eur = (n) => "€ " + Math.round(n).toLocaleString("nl-NL");
const priceText = (n) =>
  "€ " +
  (n < 10
    ? n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(n).toLocaleString("nl-NL"));
// Korte namen voor de tabbladen van de Pikachu-secties
const SHORT = {
  1: "Wizards",
  2: "EX",
  3: "DP & HGSS",
  4: "BW & XY",
  5: "Sun & Moon",
  6: "Sword & Shield",
  7: "Scarlet & Violet",
  8: "Mega & 30th",
  9: "Topstukken",
  JP: "Japans",
};
const pagesText = (p) => "pagina " + p[0] + (p[1] > p[0] ? "–" + p[1] : "");

function passes(v, show) {
  if (show === "w") return !!v.w;
  if (show === "niets") return !v.b && !v.a;
  if (show === "b") return v.b && !v.a;
  if (show === "a") return !!v.a;
  return true;
}

// Prijs (centen, per stuk) → [euro voor de tabel, soort]. De Cardmarket-trend is de standaard;
// al het andere krijgt in de tabel een label.
function prijsVoorTabel(p, aantal = 1) {
  if (!p || p.e == null) return [null, "unknown"];
  const soort = p.controle
    ? "controle"
    : p.t === "h"
      ? "eigen"
      : p.t === "m"
        ? "us"
        : p.t === "c"
          ? p.cm?.gok
            ? "schatting"
            : p.cm?.soort === "avg30"
              ? "avg30"
              : "market"
          : p.vraag
            ? "asking"
            : "vast";
  return [(p.e * aantal) / 100, soort];
}

function zelfdeStatus(a, b) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const x = a[k] || {};
    const y = b[k] || {};
    return !!x.w === !!y.w && !!x.b === !!y.b && !!x.o === !!y.o && !!x.a === !!y.a;
  });
}

// Lijst van een verzameling: de vaste kaarten (alleen bij Pikachu en Japanse Pikachu) plus zelf
// toegevoegde items, met thema's als tabbladen.
//   vasteKaarten: [id, naam, set, nummer, prijs, prijstype, notitie, sectie, mapcode, positie]
export default function Verzameling({
  verzameling: beginVerzameling,
  vasteKaarten = [],
  vasteSecties = [],
  seed = {},
  beginItems,
  beginPrijzen,
}) {
  const id = beginVerzameling.id;
  const heeftVast = vasteKaarten.length > 0;
  const LS = useMemo(
    () =>
      id === PIKACHU.id
        ? { status: "pika-status", pending: "pika-pending", cat: "pika-cat", order: "pika-order", weergave: "pika-weergave" }
        : {
            ...(heeftVast ? { status: `pk-${id}-status`, pending: `pk-${id}-pending` } : {}),
            cat: `pk-${id}-cat`,
            order: `pk-${id}-order`,
            weergave: `pk-${id}-weergave`,
          },
    [id, heeftVast]
  );
  const router = useRouter();

  const [itemsVersieLive, setItemsVersieLive] = useState(null);
  const items = useItems(beginItems, itemsVersieLive);
  const verzameling = items.verzamelingen.find((v) => v.id === id) ?? beginVerzameling;
  const [prijsData, setPrijsData] = useState(beginPrijzen);
  const prijzen = prijsData?.prijzen ?? null;

  const [status, setStatus] = useState(seed);
  const [cat, setCat] = useState(id === PIKACHU.id ? "wizards" : "ALL");
  const [order, setOrder] = useState("map");
  const [show, setShow] = useState("all");
  const [q, setQ] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [askToken, setAskToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [venster, setVenster] = useState(null); // { item } of { standaard }
  const [bewerken, setBewerken] = useState(false);
  const [weergave, setWeergave] = useState("lijst"); // "lijst" of "map"
  const [binderPagina, setBinderPagina] = useState(1);
  const [detailRij, setDetailRij] = useState(null); // kaart in het venster vanuit de map
  const [binderType, setBinderType] = useState(beginVerzameling.binder?.type ?? "");
  const [eigenBinder, setEigenBinder] = useState({
    naam: beginVerzameling.binder?.naam ?? "",
    vakjes: beginVerzameling.binder?.vakjes ?? 9,
    paginas: beginVerzameling.binder?.paginas ?? 40,
  });
  const [naamInvoer, setNaamInvoer] = useState(beginVerzameling.naam);
  const [themaInvoer, setThemaInvoer] = useState("");
  const [instelMelding, setInstelMelding] = useState("");

  const statusRef = useRef(seed);
  const pendingRef = useRef({});
  const bevestigdRef = useRef({}); // net opgeslagen: { id: { v, tot } }
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const importRef = useRef(null);
  const tabsRef = useRef(null);
  const prijsVersieRef = useRef(beginPrijzen?.versie ?? null);

  // ---------- Thema's en rijen ----------

  const themas = useMemo(() => {
    const lijst = themasVoor(verzameling);
    if (!heeftVast) return lijst;
    // Pikachu: namen en pagina's uit de secties van de collectie
    const sectie = Object.fromEntries(vasteSecties.map((s) => [SECTIE_THEMA[s.id], s]));
    return lijst.map((t) =>
      sectie[t.id]
        ? { ...t, naam: sectie[t.id].name, kort: SHORT[sectie[t.id].id] ?? t.kort, pages: sectie[t.id].pages }
        : t
    );
  }, [verzameling, heeftVast, vasteSecties]);
  const themaIndex = useMemo(() => Object.fromEntries(themas.map((t, i) => [t.id, i])), [themas]);
  const eigenThemaIds = useMemo(() => new Set((verzameling.themas ?? []).map((t) => t.id)), [verzameling.themas]);
  const verborgen = useMemo(() => new Set(verzameling.verborgen ?? []), [verzameling.verborgen]);

  // Eén rijformaat: [id, naam, set, nummer, prijs €, soort, notitie, thema, mapcode, positie,
  // isItem, plaatjes, TCGplayer-product]
  const vasteRijen = useMemo(
    () =>
      vasteKaarten.map((c) => {
        const [prijs, soort] = prijzen?.[c[0]] ? prijsVoorTabel(prijzen[c[0]]) : [c[4], c[5]];
        const thema = c[7] === "JP" ? japansThema(c[2]) : SECTIE_THEMA[c[7]];
        return [c[0], c[1], c[2], c[3], prijs, soort, c[6], thema, c[8], c[9], false, c[10] ?? [], c[11] ?? null];
      }),
    [vasteKaarten, prijzen]
  );
  const eigenItems = useMemo(() => items.items.filter((i) => i.verzameling === id), [items.items, id]);
  const itemRijen = useMemo(
    () =>
      eigenItems.map((i, n) => {
        const aantal = i.aantal || 1;
        const [prijs, soort] = prijsVoorTabel(itemPrijs(i, prijzen ?? {}), aantal);
        return [
          i.id,
          (aantal > 1 ? aantal + "× " : "") + i.naam,
          i.set ?? "",
          i.nummer ?? "",
          prijs,
          soort,
          null,
          i.thema ?? (i.label === "etb" ? "etb" : "overig"),
          i.map,
          mapPositie(i.map) ?? 100000 + n,
          true,
          i.img ?? [],
          i.tp?.product ?? null,
        ];
      }),
    [eigenItems, prijzen]
  );
  const alleRijen = useMemo(
    () => [...vasteRijen.filter((r) => !verborgen.has(r[0])), ...itemRijen],
    [vasteRijen, itemRijen, verborgen]
  );
  const verborgenRijen = vasteRijen.filter((r) => verborgen.has(r[0]));
  const rijenPerThema = useMemo(() => {
    const m = {};
    for (const r of alleRijen) (m[r[7]] ??= []).push(r);
    return m;
  }, [alleRijen]);

  const itemStatus = useMemo(
    () => Object.fromEntries(items.items.map((i) => [i.id, i.status || {}])),
    [items.items]
  );
  const statusVan = (rid) => (rid.startsWith("i") ? itemStatus[rid] || {} : status[rid] || {});

  // Tabbladen: thema's met kaarten, eigen thema's, en bij Pikachu ook altijd ETB's en Overig
  const metaVan = (t) => (t.pages ? pagesText(t.pages) : "");
  const cats = [
    {
      id: "ALL",
      short: "Alles",
      name: heeftVast ? "Hele verzameling" : verzameling.naam,
      meta: id === PIKACHU.id ? "in de binder" : "",
    },
    ...themas
      .filter(
        (t) =>
          rijenPerThema[t.id]?.length ||
          eigenThemaIds.has(t.id) ||
          (id === PIKACHU.id && (t.id === "etb" || t.id === "overig"))
      )
      .map((t) => ({ id: t.id, short: t.kort ?? t.naam, name: t.naam, meta: metaVan(t) })),
  ];
  const actief = cats.some((c) => c.id === cat) ? cat : "ALL";
  const rowsFor = (cid) => (cid === "ALL" ? alleRijen : rijenPerThema[cid] ?? []);

  // ---------- Vinkjes van de vaste kaarten (Pikachu) ----------

  const applyStatus = useCallback(
    (next) => {
      statusRef.current = next;
      setStatus(next);
      if (LS.status) lsSet(LS.status, JSON.stringify(next));
    },
    [LS]
  );

  const savePending = useCallback(() => {
    if (!LS.pending) return;
    lsSet(LS.pending, Object.keys(pendingRef.current).length ? JSON.stringify(pendingRef.current) : null);
  }, [LS]);

  const flush = useCallback(async () => {
    timerRef.current = null;
    if (busyRef.current) return;
    // Een kopie: wat tijdens het opslaan wordt aangevinkt, komt in pendingRef en gaat erna mee
    const patch = { ...pendingRef.current };
    if (!Object.keys(patch).length) return;
    const token = lsGet(TOKEN);
    if (!token) {
      setAskToken(true);
      setSaveMsg("Alleen op dit apparaat bewaard – voer je token in");
      return;
    }
    busyRef.current = true;
    setSaveMsg("Opslaan…");
    try {
      const res = await fetch("/api/pikachu", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-pikachu-token": token },
        body: JSON.stringify({ status: patch }),
      });
      if (res.status === 401) {
        lsSet(TOKEN, null);
        setAskToken(true);
        setSaveMsg("Token klopt niet – voer hem opnieuw in");
      } else if (!res.ok) {
        throw new Error(String(res.status));
      } else {
        // Alleen weghalen wat sinds het versturen niet opnieuw is gewijzigd
        const tot = Date.now() + BEVESTIGD_MS;
        for (const k of Object.keys(patch)) {
          bevestigdRef.current[k] = { v: patch[k], tot };
          if (pendingRef.current[k] === patch[k]) delete pendingRef.current[k];
        }
        savePending();
        setSaveMsg("Opgeslagen");
      }
    } catch {
      setSaveMsg("Niet opgeslagen – offline, wordt opnieuw geprobeerd");
      timerRef.current = setTimeout(flush, 10000);
    } finally {
      busyRef.current = false;
    }
    if (Object.keys(pendingRef.current).length && !timerRef.current && lsGet(TOKEN)) {
      timerRef.current = setTimeout(flush, 600);
    }
  }, [savePending]);

  const queue = useCallback(
    (changes) => {
      const next = { ...statusRef.current };
      for (const [k, v] of Object.entries(changes)) {
        next[k] = v;
        pendingRef.current[k] = v;
      }
      applyStatus(next);
      savePending();
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 600);
    },
    [applyStatus, savePending, flush]
  );

  // ---------- Live: vinkjes, prijzen en items ----------

  const vraagLive = useCallback(async () => {
    try {
      const res = await fetch("/api/pokemon/live", { cache: "no-store" });
      if (res.status === 503) {
        setSaveMsg("Bewaard op dit apparaat (geen database)");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (heeftVast) {
        // De serverstand is compleet: wat niet in de bits staat, staat uit. Net opgeslagen en
        // nog niet verstuurde vinkjes gaan voor.
        const server = Object.fromEntries(vasteKaarten.map((c) => [c[0], vanBits(data.status?.[c[0]] ?? 0)]));
        const nu = Date.now();
        const bevestigd = {};
        for (const [k, x] of Object.entries(bevestigdRef.current)) {
          if (x.tot > nu) bevestigd[k] = x.v;
          else delete bevestigdRef.current[k];
        }
        const next = { ...server, ...bevestigd, ...pendingRef.current };
        if (!zelfdeStatus(next, statusRef.current)) applyStatus(next);
      }
      if (data.itemsVersie) setItemsVersieLive(data.itemsVersie);
      if (data.versie && data.versie !== prijsVersieRef.current) {
        const pr = await fetch("/api/pokemon/prijzen", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
        if (pr?.versie) {
          prijsVersieRef.current = pr.versie;
          setPrijsData(pr);
        }
      }
      if (!Object.keys(pendingRef.current).length) {
        setSaveMsg((m) => (m.startsWith("Token") || m.startsWith("Voer") || m.startsWith("Alleen") ? m : "Opgeslagen"));
      }
    } catch {
      setSaveMsg("Offline – je ziet de stand van dit apparaat");
    }
  }, [heeftVast, vasteKaarten, applyStatus]);

  // Opstarten: eerst de lokale stand, dan de database
  useEffect(() => {
    const opgeslagen = lsGet(LS.cat);
    // Oude Pikachu-categorieën ("1", "JP", "L:etb") omzetten naar thema's
    if (opgeslagen) setCat(SECTIE_THEMA[opgeslagen] ?? (opgeslagen.startsWith("L:") ? opgeslagen.slice(2) : opgeslagen));
    const volgorde = lsGet(LS.order);
    if (volgorde === "map" || volgorde === "price") setOrder(volgorde);
    if (lsGet(LS.weergave) === "map") setWeergave("map");
    if (heeftVast) {
      pendingRef.current = lsJSON(LS.pending) ?? {};
      applyStatus({ ...seed, ...(lsJSON(LS.status) ?? {}), ...pendingRef.current });
    }
    vraagLive().then(() => {
      if (Object.keys(pendingRef.current).length) flush();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elke 30 s zolang de pagina zichtbaar is, en meteen bij terugkeren
  useEffect(() => {
    let timer;
    let bezig = true;
    const tik = async () => {
      if (document.visibilityState === "visible") await vraagLive();
      if (bezig) timer = setTimeout(tik, LIVE_INTERVAL);
    };
    timer = setTimeout(tik, LIVE_INTERVAL);
    const zichtbaar = () => {
      if (document.visibilityState === "visible") vraagLive();
    };
    const online = () => flush();
    document.addEventListener("visibilitychange", zichtbaar);
    window.addEventListener("focus", zichtbaar);
    window.addEventListener("online", online);
    return () => {
      bezig = false;
      clearTimeout(timer);
      clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", zichtbaar);
      window.removeEventListener("focus", zichtbaar);
      window.removeEventListener("online", online);
    };
  }, [vraagLive, flush]);

  useEffect(() => {
    tabsRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [actief]);

  // ---------- Acties ----------

  const toonFout = (e) => {
    if (e instanceof GeenToken) setAskToken(true);
    setSaveMsg(e.message);
  };
  // Eerste pagina in de map met een kaart uit dit thema
  const eerstePagina = (cid) =>
    rowsFor(cid)
      .map((r) => leesMapcode(r[8]))
      .filter(Boolean)
      .sort((a, b) => a.pagina - b.pagina || a.vakje - b.vakje)[0]?.pagina;
  const chooseCat = (cid) => {
    setCat(cid);
    lsSet(LS.cat, cid);
    if (weergave === "map") {
      const p = eerstePagina(cid);
      if (p) setBinderPagina(p);
    }
  };
  const kiesWeergave = (w) => {
    setWeergave(w);
    lsSet(LS.weergave, w);
    if (w === "map" && actief !== "ALL") {
      const p = eerstePagina(actief);
      if (p) setBinderPagina(p);
    }
  };

  // Vinkje wijzigen vanuit het kaartvenster in de map
  async function wijzigVanuitVenster(rid, veld, aan) {
    if (rid.startsWith("i")) return items.zetStatus(rid, veld, aan);
    if (!lsGet(TOKEN)) throw new GeenToken("Voer je token in om op te slaan");
    queue({ [rid]: { ...statusRef.current[rid], [veld]: aan } });
  }
  const chooseOrder = (v) => {
    setOrder(v);
    lsSet(LS.order, v);
  };
  const toggle = (rid, f, checked) => {
    if (rid.startsWith("i")) {
      items.zetStatus(rid, f, checked).catch(toonFout);
      return;
    }
    queue({ [rid]: { ...statusRef.current[rid], [f]: checked } });
  };

  const submitToken = (e) => {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    lsSet(TOKEN, t);
    setTokenInput("");
    setAskToken(false);
    setSaveMsg("");
    flush();
  };

  async function verwijderRij(r) {
    const [rid, naam, , , , , , , , , isItem] = r;
    try {
      if (isItem) {
        if (!window.confirm(`"${naam}" verwijderen?`)) return;
        await items.verwijder(rid);
      } else {
        if (!window.confirm(`"${naam}" uit de lijst halen? Je kunt hem terugzetten onder ‘Verborgen kaarten’.`)) return;
        await items.wijzigVerzameling(id, { verberg: rid });
      }
    } catch (e) {
      toonFout(e);
    }
  }

  async function instelling(actie, melding) {
    setInstelMelding("");
    try {
      await actie();
      if (melding) setInstelMelding(melding);
    } catch (e) {
      if (e instanceof GeenToken) setAskToken(true);
      setInstelMelding(e.message);
    }
  }

  const exportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ exported: new Date().toISOString(), status: statusRef.current }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${id}-status-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJSON = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      let incoming = data?.status ?? data;
      // Ook het volledige collectiebestand (cards[].status met lange sleutels)
      if (Array.isArray(data?.cards)) {
        incoming = Object.fromEntries(
          data.cards.map((c) => [
            c.id,
            { w: !!c.status?.wantlist, b: !!c.status?.paid, o: !!c.status?.shipped, a: !!c.status?.owned },
          ])
        );
      }
      const changes = {};
      for (const [k, v] of Object.entries(incoming || {})) {
        if (!(k in seed) || !v || typeof v !== "object") continue;
        changes[k] = { w: v.w === true, b: v.b === true, o: v.o === true, a: v.a === true };
      }
      const n = Object.keys(changes).length;
      if (!n) throw new Error("leeg");
      if (!window.confirm(`${n} kaarten importeren en de huidige vinkjes daarvan overschrijven?`)) return;
      queue(changes);
    } catch {
      setSaveMsg("Importeren lukte niet: geen geldig bestand");
    }
  };

  // ---------- Afgeleide gegevens ----------

  const all = rowsFor(actief);
  const nq = norm(q.trim());
  const mapOrder = order === "map";
  let list = all.filter(
    (c) => (!nq || norm(c[1] + " " + c[2] + " " + c[3]).includes(nq)) && passes(statusVan(c[0]), show)
  );
  list = mapOrder
    ? list
        .slice()
        .sort((x, y) =>
          actief === "ALL" ? (themaIndex[x[7]] ?? 999) - (themaIndex[y[7]] ?? 999) || x[9] - y[9] : x[9] - y[9]
        )
    : list.slice().sort((x, y) => (x[4] ?? Infinity) - (y[4] ?? Infinity));

  const prices = all.map((c) => c[4]).filter((p) => p !== null);
  const total = prices.reduce((a, b) => a + b, 0);
  const current = cats.find((c) => c.id === actief) ?? cats[0];
  // "36 kaarten", "2 items" of "426 kaarten en 2 items"
  const nItems = all.filter((c) => c[10]).length;
  const meervoud = (n, een, veel) => n + " " + (n === 1 ? een : veel);
  const aantalTekst =
    nItems && nItems < all.length
      ? meervoud(all.length - nItems, "kaart", "kaarten") + " en " + meervoud(nItems, "item", "items")
      : nItems
        ? meervoud(nItems, "item", "items")
        : meervoud(all.length, "kaart", "kaarten");
  const summary =
    aantalTekst +
    (prices.length < all.length ? " · " + prices.length + " met prijs" : "") +
    " · samen ± " +
    eur(total);
  const extra =
    id === JAPANS.id && actief === "ALL"
      ? "Elke promo is op Bulbapedia gecontroleerd; promo's met dezelfde tekening als een Engelse kaart staan er niet in."
      : actief === "topstukken"
        ? "Alle kaarten van € 200 en meer, achterin je binder."
        : !all.length && !heeftVast
          ? "Nog leeg. Voeg kaarten, ETB's of andere items toe met + Toevoegen."
          : null;

  const countOf = (f) => all.filter((c) => statusVan(c[0])[f]).length;
  const filtered = nq || show !== "all";
  const kolommen = bewerken ? 6 : 5;

  // Mapweergave: alles met een geldige plek in de binder, en wat erbuiten valt
  const binder = binderVan(verzameling);
  const plekken = [];
  const buitenMap = [];
  for (const r of alleRijen) {
    const plek = leesMapcode(r[8]);
    if (binder && plek && plek.vakje <= binder.vakjes) {
      plekken.push({ id: r[0], pagina: plek.pagina, vakje: plek.vakje, naam: r[1], img: r[11] ?? [], status: statusVan(r[0]), rij: r });
    } else buitenMap.push(r);
  }

  const rows = [];
  let curSec = null;
  let curPage = null;
  for (const c of list) {
    if (mapOrder && actief === "ALL") {
      if (c[7] !== curSec) {
        curSec = c[7];
        const t = themas.find((x) => x.id === c[7]);
        rows.push(
          <tr key={"s" + c[7]} className="sec">
            <td colSpan={kolommen}>
              {t?.naam ?? c[7]}
              {t && metaVan(t) && <small>{metaVan(t)}</small>}
            </td>
          </tr>
        );
      }
    } else if (mapOrder && c[8]) {
      const pg = c[8].split(".")[0];
      if (pg !== curPage) {
        curPage = pg;
        rows.push(
          <tr key={"p" + pg + c[0]} className="pg">
            <td colSpan={kolommen}>Pagina {pg}</td>
          </tr>
        );
      }
    }
    rows.push(
      <CardRow
        key={c[0]}
        card={c}
        v={statusVan(c[0])}
        onToggle={toggle}
        onEdit={(iid) => setVenster({ item: items.items.find((i) => i.id === iid) })}
        bewerken={bewerken}
        onWeg={verwijderRij}
      />
    );
  }

  return (
    <div className="wrap">
      <Kruimelpad
        stappen={[{ naam: "Home", href: "/" }, { naam: "Pokémon", href: "/pokemon" }, { naam: verzameling.naam }]}
      />
      <h1 className="visually-hidden">{verzameling.naam}</h1>

      <nav className="cats" role="tablist" aria-label="Kies een thema" ref={tabsRef}>
        {cats.map((c) => {
          const rs = rowsFor(c.id);
          const done = rs.filter((r) => statusVan(r[0]).a).length;
          const pct = rs.length ? Math.round((done / rs.length) * 100) : 0;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              id={"tab-" + c.id}
              aria-controls="pika-panel"
              aria-selected={c.id === actief}
              onClick={() => chooseCat(c.id)}
              title={c.meta ? c.name + " · " + c.meta : c.name}
              aria-label={`${c.name}${c.meta ? ", " + c.meta : ""}, ${done} van ${rs.length} afgerond`}
            >
              <span className="cn">
                {c.short}
                <span className="cm">
                  {done}/{rs.length}
                </span>
              </span>
              <span className="bar">
                <i style={{ width: pct + "%" }} />
              </span>
            </button>
          );
        })}
      </nav>

      <section id="pika-panel" role="tabpanel" aria-labelledby={"tab-" + actief}>
        <div className="head">
          <h2>
            {current.name} {current.meta && <small>{current.meta}</small>}
          </h2>
          <p className="summary">{summary}</p>
          {prijsData?.meta?.cardmarket?.dag && (
            <p className="extra">Prijs: Cardmarket trend, bijgewerkt op {datumNL(prijsData.meta.cardmarket.dag)}</p>
          )}
          {extra && <p className="extra">{extra}</p>}
        </div>
        {/* Zoeken en filters gelden voor de lijst, niet voor de map */}
        <div className="toolbar" hidden={weergave === "map"}>
          <div className="search">
            <label htmlFor="pika-q" className="visually-hidden">
              Zoeken
            </label>
            <input
              id="pika-q"
              type="search"
              placeholder="Zoek op naam, set of nummer"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <label htmlFor="pika-order" className="visually-hidden">
            Volgorde
          </label>
          <select id="pika-order" value={order} onChange={(e) => chooseOrder(e.target.value)}>
            <option value="price">goedkoop → duur</option>
            <option value="map">{binder ? "zoals in je map" : "per thema"}</option>
          </select>
          <label htmlFor="pika-show" className="visually-hidden">
            Toon
          </label>
          <select id="pika-show" value={show} onChange={(e) => setShow(e.target.value)}>
            {SHOW.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <dl className="track">
          <div>
            <dt>Wantlist</dt>
            <dd>{countOf("w")}</dd>
          </div>
          <div>
            <dt>Betaald</dt>
            <dd>{countOf("b")}</dd>
          </div>
          <div>
            <dt>Afgerond</dt>
            <dd>
              {countOf("a")}
              <small>/{all.length}</small>
            </dd>
          </div>
        </dl>

        {askToken && (
          <form className="token" onSubmit={submitToken}>
            <label htmlFor="pika-token">Token om op te slaan in de database (wordt op dit apparaat onthouden)</label>
            <div>
              <input
                id="pika-token"
                type="password"
                autoComplete="off"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <button type="submit">Opslaan</button>
            </div>
          </form>
        )}

        <div className="lijstacties">
          <button
            type="button"
            className="toevoegen"
            onClick={() =>
              setVenster({ standaard: { verzameling: id, thema: actief !== "ALL" ? actief : undefined } })
            }
          >
            + Toevoegen
          </button>
          {weergave === "lijst" && (
            <button
              type="button"
              className="bewerkknop"
              aria-pressed={bewerken}
              onClick={() => setBewerken((b) => !b)}
            >
              {bewerken ? "Klaar" : "Lijst bewerken"}
            </button>
          )}
          <div className="weergave" role="group" aria-label="Weergave">
            <button type="button" aria-pressed={weergave === "lijst"} onClick={() => kiesWeergave("lijst")}>
              Lijst
            </button>
            <button type="button" aria-pressed={weergave === "map"} onClick={() => kiesWeergave("map")}>
              Map
            </button>
          </div>
        </div>

        {weergave === "map" && (
          <>
            {saveMsg && (
              <p className="count">
                <span className="saved" role="status">
                  {saveMsg}
                </span>
              </p>
            )}
            {binder ? (
              <BinderWeergave
                binder={binder}
                plekken={plekken}
                pagina={binderPagina}
                onPagina={setBinderPagina}
                onOpen={(k) => setDetailRij(k.rij)}
              />
            ) : (
              <p className="geen-binder">
                Kies onderaan bij <b>Uitleg en instellingen</b> een binder, dan zie je hier je kaarten op
                hun plek. Een plek geef je een kaart met een mapcode, zoals 3.5.
              </p>
            )}
            {buitenMap.length > 0 && (
              <details className="buiten-map">
                <summary>Niet in de map ({buitenMap.length})</summary>
                <ul>
                  {buitenMap.map((r) => (
                    <li key={r[0]}>
                      <button type="button" onClick={() => setDetailRij(r)}>
                        {r[1]}
                      </button>
                      {r[2] ? ` · ${r[2]}` : ""}
                      {r[8] ? ` · mapcode ${r[8]} past niet in deze binder` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {weergave === "lijst" && (
        <>
        <p className="count">
          <span aria-live="polite">
            {(filtered ? list.length + " van " + all.length : aantalTekst) +
              (mapOrder ? (binder ? " · volgorde van je map" : " · per thema") : " · goedkoopste eerst") +
              (verborgen.size ? ` · ${verborgen.size} verborgen` : "")}
          </span>
          {saveMsg && (
            <span className="saved" role="status">
              {saveMsg}
            </span>
          )}
        </p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th className="p" scope="col">
                  Prijs
                </th>
                <th scope="col">Kaart</th>
                <th className="ck" scope="col">
                  Want&shy;list
                </th>
                <th className="ck" scope="col">
                  Betaald
                </th>
                <th className="ck" scope="col">
                  Afge&shy;rond
                </th>
                {bewerken && (
                  <th className="weg" scope="col">
                    <span className="visually-hidden">Verwijderen</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                rows
              ) : (
                <tr>
                  <td colSpan={kolommen} className="empty">
                    {nq
                      ? `Geen kaart gevonden voor ‘${q.trim()}’. Zoek op een setnaam of kaartnummer.`
                      : all.length
                        ? "Geen kaarten in deze selectie."
                        : "Nog niets in dit thema. Voeg iets toe met + Toevoegen."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        </>
        )}

        {weergave === "lijst" && bewerken && verborgenRijen.length > 0 && (
          <div className="verborgen">
            <h3>Verborgen kaarten ({verborgenRijen.length})</h3>
            <ul>
              {verborgenRijen.map((r) => (
                <li key={r[0]}>
                  <span>
                    <b>{r[1]}</b>
                    <small>
                      {r[2]}
                      {r[3] ? ", " + r[3] : ""}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() => instelling(() => items.wijzigVerzameling(id, { toon: r[0] }))}
                  >
                    Terugzetten
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="info">
          <summary>Uitleg en instellingen{heeftVast ? ", opslag en bronnen" : ""}</summary>
          <p className="legend">
            Prijzen zijn de Cardmarket-trendprijs (Europa), elke nacht om 04:00 bijgewerkt. Zonder trend
            telt het gemiddelde van 30 dagen (&lsquo;30-dagen gem.&rsquo;), nooit de laagste prijs. Varianten
            die Cardmarket niet apart heeft, volgen de TCGplayer-marktprijs (&lsquo;TCGplayer&rsquo;);
            Japanse promo&rsquo;s met meerdere versies de meest waarschijnlijke versie op Cardmarket
            (&lsquo;schatting&rsquo;). Alleen zonder enige bron blijft de prijs uit de lijst staan
            (&lsquo;vaste prijs&rsquo;). Springt een prijs meer dan 50% of wijkt hij meer dan 5× af van de
            prijs in je lijst, dan blijft de oude prijs eerst staan met &lsquo;controleren&rsquo;; blijft de
            nieuwe prijs drie dagen zo, dan wordt hij vanzelf overgenomen. Een ? betekent dat er geen
            prijs bekend is. Tik op een vakje om iets af te vinken, en op de naam van een
            toegevoegd item om het te bewerken. &ldquo;Map 1.7&rdquo; betekent pagina 1, vakje 7: vakjes
            1–3 zijn de bovenste rij, 4–6 de middelste en 7–9 de onderste.
          </p>

          <h3>Instellingen</h3>
          <form
            className="instelling"
            onSubmit={(e) => {
              e.preventDefault();
              const keuze =
                binderType === "" ? null : binderType === "eigen" ? { type: "eigen", ...eigenBinder } : { type: binderType };
              instelling(() => items.wijzigVerzameling(id, { binder: keuze }), "Binder opgeslagen.");
            }}
          >
            <label htmlFor="vz-binder">Binder</label>
            <div>
              <select id="vz-binder" className="keuze" value={binderType} onChange={(e) => setBinderType(e.target.value)}>
                <option value="">Geen binder</option>
                {BINDERS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.kort} ({b.vakjes * b.paginas} kaarten)
                  </option>
                ))}
                <option value="eigen">Eigen binder…</option>
              </select>
              <button type="submit">Opslaan</button>
            </div>
            {binderType === "eigen" && (
              <div className="binder-eigen">
                <input
                  aria-label="Naam van de binder"
                  placeholder="Naam"
                  maxLength={60}
                  value={eigenBinder.naam}
                  onChange={(e) => setEigenBinder((b) => ({ ...b, naam: e.target.value }))}
                />
                <select
                  aria-label="Vakjes per pagina"
                  className="keuze"
                  value={eigenBinder.vakjes}
                  onChange={(e) => setEigenBinder((b) => ({ ...b, vakjes: Number(e.target.value) }))}
                >
                  {EIGEN_VAKJES.map((n) => (
                    <option key={n} value={n}>
                      {n} vakjes
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Aantal pagina's"
                  type="number"
                  min="1"
                  max="200"
                  value={eigenBinder.paginas}
                  onChange={(e) => setEigenBinder((b) => ({ ...b, paginas: e.target.value }))}
                />
              </div>
            )}
          </form>
          {!verzameling.vast && (
            <form
              className="instelling"
              onSubmit={(e) => {
                e.preventDefault();
                instelling(() => items.wijzigVerzameling(id, { naam: naamInvoer }), "Naam opgeslagen.");
              }}
            >
              <label htmlFor="vz-naam">Naam van deze verzameling</label>
              <div>
                <input id="vz-naam" value={naamInvoer} maxLength={60} onChange={(e) => setNaamInvoer(e.target.value)} />
                <button type="submit">Opslaan</button>
              </div>
            </form>
          )}
          <form
            className="instelling"
            onSubmit={(e) => {
              e.preventDefault();
              if (!themaInvoer.trim()) return;
              instelling(async () => {
                await items.wijzigVerzameling(id, { nieuwThema: themaInvoer.trim() });
                setThemaInvoer("");
              }, "Thema toegevoegd.");
            }}
          >
            <label htmlFor="vz-thema">Eigen thema toevoegen</label>
            <div>
              <input
                id="vz-thema"
                value={themaInvoer}
                maxLength={40}
                placeholder="bijv. Favorieten"
                onChange={(e) => setThemaInvoer(e.target.value)}
              />
              <button type="submit">Toevoegen</button>
            </div>
          </form>
          {(verzameling.themas ?? []).length > 0 && (
            <ul className="eigen-themas">
              {verzameling.themas.map((t) => (
                <li key={t.id}>
                  {t.naam}
                  <button
                    type="button"
                    onClick={() =>
                      instelling(() => items.wijzigVerzameling(id, { verwijderThema: t.id }), "Thema weggehaald.")
                    }
                  >
                    Weghalen
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!verzameling.vast && (
            <div className="tools">
              <button
                type="button"
                className="gevaar"
                onClick={() => {
                  if (!window.confirm(`"${verzameling.naam}" verwijderen? De items blijven bestaan, zonder verzameling.`)) return;
                  instelling(async () => {
                    await items.verwijderVerzameling(id);
                    router.push("/pokemon");
                  });
                }}
              >
                Verzameling verwijderen
              </button>
            </div>
          )}
          {instelMelding && (
            <p className="saved" role="status">
              {instelMelding}
            </p>
          )}

          {heeftVast && (
            <>
              <h3>Opslag</h3>
              <p>
                Je vinkjes staan in de database, zodat telefoon en laptop gelijk blijven. Hier kun je
                een reservekopie maken of terugzetten.
              </p>
              <div className="tools">
                <button type="button" onClick={exportJSON}>
                  Exporteer JSON
                </button>
                <button type="button" onClick={() => importRef.current?.click()}>
                  Importeer JSON
                </button>
                <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importJSON} />
              </div>
              <h3>Waar de gegevens vandaan komen</h3>
              <ul>
                {id === PIKACHU.id && (
                  <li>
                    Engelse kaarten: <a href="https://github.com/PokemonTCG/pokemon-tcg-data">Pokémon TCG-database</a>,
                    gecontroleerd met <a href="https://github.com/tcgdex/cards-database">TCGdex</a> en{" "}
                    <a href="https://cardcodex.com/pokemon/card-list/pikachu/">Card Codex</a>
                  </li>
                )}
                <li>
                  Prijzen: de dagelijkse prijslijst van <a href="https://www.cardmarket.com/en/Pokemon">Cardmarket</a>{" "}
                  (gekoppeld via <a href="https://tcgdex.dev">TCGdex</a>); voor varianten TCGplayer via{" "}
                  <a href="https://tcgcsv.com">tcgcsv.com</a> met de wisselkoers van de ECB. Afbeeldingen via tcgcsv.com
                </li>
                {id === JAPANS.id && (
                  <>
                    <li>
                      Japanse kaarten: <a href="https://cardcodex.com/pokemon/card-list/pikachu/">Card Codex</a>,
                      gecontroleerd op dubbelen met{" "}
                      <a href="https://bulbapedia.bulbagarden.net/wiki/Pikachu_(TCG)">Bulbapedia</a>. Prijzen van
                      Cardmarket (ongegradeerd); zonder Cardmarket-prijs de vaste prijs van Card Codex of de PSA
                      10-prijs via{" "}
                      <a href="https://samuraiswordtokyo.com/blogs/news/mario-pikachu-card-guide">Samurai Sword Tokyo</a>
                    </li>
                    <li>
                      Pikachu Illustrator:{" "}
                      <a href="https://www.guinnessworldrecords.com/world-records/782465-most-expensive-trading-card-sold-at-auction-overall">
                        Guinness World Records
                      </a>
                    </li>
                  </>
                )}
              </ul>
            </>
          )}
        </details>
      </section>

      {detailRij &&
        (() => {
          const r = detailRij;
          const item = r[10] ? items.items.find((i) => i.id === r[0]) : null;
          const prijs = item
            ? itemPrijs(item, prijzen ?? {})
            : prijzen?.[r[0]] ?? (r[4] != null ? { e: Math.round(r[4] * 100), t: "v" } : null);
          return (
            <KaartDetail
              kaart={{ id: r[0], n: r[1], s: r[2], nr: r[3], img: r[11] ?? [], map: r[8], note: r[6], tp: r[12] }}
              prijs={prijs}
              reeks={prijsData?.reeks}
              status={statusVan(r[0])}
              onWijzig={wijzigVanuitVenster}
              onSluit={() => setDetailRij(null)}
            />
          );
        })()}
      {venster && (
        <ItemVenster
          item={venster.item ?? null}
          standaard={venster.standaard}
          labels={items.labels}
          verzamelingen={items.verzamelingen}
          prijzen={prijzen ?? {}}
          acties={items}
          onSluit={() => setVenster(null)}
        />
      )}
    </div>
  );
}

function CardRow({ card, v, onToggle, onEdit, bewerken, onWeg }) {
  const [id, name, set, number, price, ptype, note, , code, , isItem] = card;
  const setline = set + (number ? (set ? ", " : "") + number : "");
  return (
    <tr className={v.a ? "done" : undefined}>
      {ptype === "unknown" || price === null ? (
        <td className="p unk">?</td>
      ) : (
        <td className="p">
          {priceText(price)}
          {ptype === "controle" && <span className="tag controle">controleren</span>}
          {ptype === "avg30" && <span className="tag">30-dagen gem.</span>}
          {ptype === "asking" && <span className="tag">vraagprijs</span>}
          {ptype === "vast" && <span className="tag">vaste prijs</span>}
          {ptype === "us" && <span className="tag">TCGplayer</span>}
          {ptype === "schatting" && <span className="tag">schatting</span>}
          {ptype === "eigen" && <span className="tag">eigen waarde</span>}
        </td>
      )}
      <td>
        {isItem ? (
          <button type="button" className="name itemnaam" onClick={() => onEdit(id)}>
            {name}
          </button>
        ) : (
          <span className="name">{name}</span>
        )}
        {setline && <span className="set">{setline}</span>}
        {note && <span className="note">{note}</span>}
        {code && <span className="map">Map {code}</span>}
      </td>
      {FIELDS.map(([f, label]) => (
        <td key={f} className="ck">
          <input
            type="checkbox"
            checked={!!v[f]}
            onChange={(e) => onToggle(id, f, e.target.checked)}
            aria-label={`${label}: ${name}${setline ? ", " + setline : ""}`}
          />
        </td>
      ))}
      {bewerken && (
        <td className="weg">
          <button type="button" onClick={() => onWeg(card)} aria-label={`${isItem ? "Verwijder" : "Verberg"} ${name}`}>
            ×
          </button>
        </td>
      )}
    </tr>
  );
}
