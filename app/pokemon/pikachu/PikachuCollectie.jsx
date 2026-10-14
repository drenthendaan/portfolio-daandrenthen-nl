"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const FIELDS = [
  ["w", "Wantslijst", "Op wantslijst"],
  ["b", "Betaald", "Betaald"],
  ["o", "Onderweg", "Onderweg"],
  ["a", "Afgerond", "Afgerond"],
];
const SHOW = [
  ["all", "alle kaarten"],
  ["notw", "nog niet op wantslijst"],
  ["w", "op wantslijst, nog niet betaald"],
  ["b", "betaald, nog niet onderweg"],
  ["o", "onderweg, nog niet binnen"],
  ["a", "afgerond"],
];

const LS = {
  status: "pika-status",
  pending: "pika-pending",
  token: "pika-token",
  cat: "pika-cat",
  order: "pika-order",
};
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
    ? n.toLocaleString("nl-NL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : Math.round(n).toLocaleString("nl-NL"));
// Korte namen voor de categorieknoppen; de volledige naam staat erboven bij de gekozen categorie
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
const pagesText = (s) =>
  s.pages
    ? "pagina " + s.pages[0] + (s.pages[1] > s.pages[0] ? "–" + s.pages[1] : "")
    : "niet in de binder";

function passes(v, show) {
  if (show === "notw") return !v.w;
  if (show === "w") return v.w && !v.b;
  if (show === "b") return v.b && !v.o && !v.a;
  if (show === "o") return v.o && !v.a;
  if (show === "a") return !!v.a;
  return true;
}

export default function PikachuCollectie({ cards, sections, seed }) {
  const [status, setStatus] = useState(seed);
  const [cat, setCat] = useState("1");
  const [order, setOrder] = useState("map");
  const [show, setShow] = useState("all");
  const [q, setQ] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [askToken, setAskToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const statusRef = useRef(seed);
  const pendingRef = useRef({});
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const importRef = useRef(null);
  const tabsRef = useRef(null);

  const sectionById = useMemo(
    () => Object.fromEntries(sections.map((s) => [s.id, s])),
    [sections],
  );
  const cats = useMemo(
    () => [
      {
        id: "ALL",
        short: "Alles",
        name: "Hele verzameling",
        meta: "binder + Japanse promo's",
      },
      ...sections.map((s) => ({
        id: s.id,
        short: SHORT[s.id] ?? s.name,
        name: s.name,
        meta: pagesText(s),
      })),
    ],
    [sections],
  );
  const rowsFor = useCallback(
    (id) => (id === "ALL" ? cards : cards.filter((c) => c[7] === id)),
    [cards],
  );

  const applyStatus = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
    lsSet(LS.status, JSON.stringify(next));
  }, []);

  const savePending = () =>
    lsSet(
      LS.pending,
      Object.keys(pendingRef.current).length
        ? JSON.stringify(pendingRef.current)
        : null,
    );

  const flush = useCallback(async () => {
    timerRef.current = null;
    if (busyRef.current) return;
    const patch = pendingRef.current;
    if (!Object.keys(patch).length) return;
    const token = lsGet(LS.token);
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
        headers: {
          "Content-Type": "application/json",
          "x-pikachu-token": token,
        },
        body: JSON.stringify({ status: patch }),
      });
      if (res.status === 401) {
        lsSet(LS.token, null);
        setAskToken(true);
        setSaveMsg("Token klopt niet – voer hem opnieuw in");
      } else if (!res.ok) {
        throw new Error(String(res.status));
      } else {
        // Alleen weghalen wat sinds het versturen niet opnieuw is gewijzigd
        for (const id of Object.keys(patch)) {
          if (pendingRef.current[id] === patch[id])
            delete pendingRef.current[id];
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
    if (
      Object.keys(pendingRef.current).length &&
      !timerRef.current &&
      lsGet(LS.token)
    ) {
      timerRef.current = setTimeout(flush, 600);
    }
  }, []);

  const queue = useCallback(
    (changes) => {
      const next = { ...statusRef.current };
      for (const [id, v] of Object.entries(changes)) {
        next[id] = v;
        pendingRef.current[id] = v;
      }
      applyStatus(next);
      savePending();
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 600);
    },
    [applyStatus, flush],
  );

  const fetchRemote = useCallback(async () => {
    try {
      const res = await fetch("/api/pikachu", { cache: "no-store" });
      if (res.status === 503) {
        setSaveMsg("Bewaard op dit apparaat (geen database)");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      // Nog niet verstuurde wijzigingen gaan voor
      applyStatus({ ...seed, ...data.status, ...pendingRef.current });
      if (!Object.keys(pendingRef.current).length) setSaveMsg("Opgeslagen");
    } catch {
      setSaveMsg("Offline – je ziet de stand van dit apparaat");
    }
  }, [applyStatus, seed]);

  // Opstarten: eerst de lokale stand, dan de database
  useEffect(() => {
    const savedCat = lsGet(LS.cat);
    if (
      savedCat &&
      (savedCat === "ALL" || sections.some((s) => s.id === savedCat))
    ) {
      setCat(savedCat);
    }
    const savedOrder = lsGet(LS.order);
    if (savedOrder === "map" || savedOrder === "price") setOrder(savedOrder);

    const local = lsJSON(LS.status);
    pendingRef.current = lsJSON(LS.pending) ?? {};
    applyStatus({ ...seed, ...(local ?? {}), ...pendingRef.current });
    fetchRemote().then(() => {
      if (Object.keys(pendingRef.current).length) flush();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchRemote();
    };
    const onOnline = () => flush();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      clearTimeout(timerRef.current);
    };
  }, [applyStatus, fetchRemote, flush, seed, sections]);

  useEffect(() => {
    tabsRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [cat]);

  const chooseCat = (id) => {
    setCat(id);
    lsSet(LS.cat, id);
  };
  const chooseOrder = (v) => {
    setOrder(v);
    lsSet(LS.order, v);
  };
  const toggle = (id, f, checked) =>
    queue({ [id]: { ...statusRef.current[id], [f]: checked } });

  const submitToken = (e) => {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    lsSet(LS.token, t);
    setTokenInput("");
    setAskToken(false);
    flush();
  };

  const exportJSON = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { exported: new Date().toISOString(), status: statusRef.current },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pikachu-status-${new Date().toISOString().slice(0, 10)}.json`;
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
            {
              w: !!c.status?.wantlist,
              b: !!c.status?.paid,
              o: !!c.status?.shipped,
              a: !!c.status?.owned,
            },
          ]),
        );
      }
      const changes = {};
      for (const [id, v] of Object.entries(incoming || {})) {
        if (!(id in seed) || !v || typeof v !== "object") continue;
        changes[id] = {
          w: v.w === true,
          b: v.b === true,
          o: v.o === true,
          a: v.a === true,
        };
      }
      const n = Object.keys(changes).length;
      if (!n) throw new Error("leeg");
      if (
        !window.confirm(
          `${n} kaarten importeren en de huidige vinkjes daarvan overschrijven?`,
        )
      )
        return;
      queue(changes);
    } catch {
      setSaveMsg("Importeren lukte niet: geen geldig bestand");
    }
  };

  // Afgeleide gegevens
  const all = rowsFor(cat);
  const nq = norm(q.trim());
  const mapOrder = cat !== "JP" && order === "map";
  let list = all.filter(
    (c) =>
      (!nq || norm(c[1] + " " + c[2] + " " + c[3]).includes(nq)) &&
      passes(status[c[0]] || {}, show),
  );
  list = mapOrder
    ? list.slice().sort((x, y) => x[9] - y[9])
    : list.slice().sort((x, y) => (x[4] ?? Infinity) - (y[4] ?? Infinity));

  const prices = all.map((c) => c[4]).filter((p) => p !== null);
  const total = prices.reduce((a, b) => a + b, 0);
  const current = cats.find((c) => c.id === cat) ?? cats[0];
  const summary =
    all.length +
    " kaarten" +
    (prices.length < all.length ? " · " + prices.length + " met prijs" : "") +
    " · samen ± " +
    eur(total);
  const extra =
    cat === "JP"
      ? "Elke promo is op Bulbapedia gecontroleerd; promo's met dezelfde tekening als een Engelse kaart staan er niet in. Ze passen niet meer in je binder."
      : cat === "9"
        ? "Alle kaarten van € 200 en meer, achterin je binder."
        : null;

  const countOf = (f) => all.filter((c) => status[c[0]]?.[f]).length;
  const filtered = nq || show !== "all";

  const rows = [];
  let curSec = null;
  let curPage = null;
  for (const c of list) {
    if (mapOrder && cat === "ALL") {
      if (c[7] !== curSec) {
        curSec = c[7];
        const S = sectionById[c[7]];
        rows.push(
          <tr key={"s" + c[7]} className="sec">
            <td colSpan={6}>
              {S.name}
              <small>{pagesText(S)}</small>
            </td>
          </tr>,
        );
      }
    } else if (mapOrder && c[8]) {
      const pg = c[8].split(".")[0];
      if (pg !== curPage) {
        curPage = pg;
        rows.push(
          <tr key={"p" + pg} className="pg">
            <td colSpan={6}>Pagina {pg}</td>
          </tr>,
        );
      }
    }
    rows.push(
      <CardRow key={c[0]} card={c} v={status[c[0]] || {}} onToggle={toggle} />,
    );
  }

  return (
    <div className="wrap">
      <h1 className="visually-hidden">Pikachu-verzameling</h1>

      <nav
        className="cats"
        role="tablist"
        aria-label="Kies een onderdeel van je binder"
        ref={tabsRef}
      >
        {cats.map((c) => {
          const rs = rowsFor(c.id);
          const done = rs.filter((r) => status[r[0]]?.a).length;
          const pct = rs.length ? Math.round((done / rs.length) * 100) : 0;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              id={"tab-" + c.id}
              aria-controls="pika-panel"
              aria-selected={c.id === cat}
              onClick={() => chooseCat(c.id)}
              title={c.name + " · " + c.meta}
              aria-label={`${c.name}, ${c.meta}, ${done} van ${rs.length} afgerond`}
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

      <section id="pika-panel" role="tabpanel" aria-labelledby={"tab-" + cat}>
        <div className="head">
          <h2>
            {current.name} <small>{current.meta}</small>
          </h2>
          <p className="summary">{summary}</p>
          {extra && <p className="extra">{extra}</p>}
        </div>
        <div className="toolbar">
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
          {cat !== "JP" && (
            <>
              <label htmlFor="pika-order" className="visually-hidden">
                Volgorde
              </label>
              <select
                id="pika-order"
                value={order}
                onChange={(e) => chooseOrder(e.target.value)}
              >
                <option value="price">goedkoop → duur</option>
                <option value="map">zoals in je map</option>
              </select>
            </>
          )}
          <label htmlFor="pika-show" className="visually-hidden">
            Toon
          </label>
          <select
            id="pika-show"
            value={show}
            onChange={(e) => setShow(e.target.value)}
          >
            {SHOW.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <dl className="track">
          <div>
            <dt>Wantslijst</dt>
            <dd>{countOf("w")}</dd>
          </div>
          <div>
            <dt>Betaald</dt>
            <dd>{countOf("b")}</dd>
          </div>
          <div>
            <dt>Onderweg</dt>
            <dd>{countOf("o")}</dd>
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
            <label htmlFor="pika-token">
              Token om op te slaan in de database (wordt op dit apparaat
              onthouden)
            </label>
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

        <p className="count">
          <span aria-live="polite">
            {(filtered
              ? list.length + " van " + all.length
              : all.length + " kaarten") +
              (mapOrder ? " · volgorde van je map" : " · goedkoopste eerst")}
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
                  Wants&shy;lijst
                </th>
                <th className="ck" scope="col">
                  Betaald
                </th>
                <th className="ck" scope="col">
                  Onder&shy;weg
                </th>
                <th className="ck" scope="col">
                  Afge&shy;rond
                </th>
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                rows
              ) : (
                <tr>
                  <td colSpan={6} className="empty">
                    {nq
                      ? `Geen kaart gevonden voor ‘${q.trim()}’. Zoek op een setnaam of kaartnummer.`
                      : "Geen kaarten in deze selectie."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <details className="info">
          <summary>Uitleg, opslag en bronnen</summary>
          <p className="legend">
            Bij een prijs met &lsquo;vraagprijs&rsquo; is er alleen een
            aanbieding, geen recente verkoop. Een ? betekent dat er geen losse
            prijs bekend is. Oude 1st Edition- en reverse-holoversies kunnen
            duurder zijn. Tik op een vakje om een kaart af te vinken. &ldquo;Map
            1.7&rdquo; betekent pagina 1, vakje 7 in je binder: vakjes 1–3 zijn
            de bovenste rij, 4–6 de middelste en 7–9 de onderste.
          </p>
          <h3>Opslag</h3>
          <p>
            Je vinkjes staan in de database, zodat telefoon en laptop gelijk
            blijven. Hier kun je een reservekopie maken of terugzetten.
          </p>
          <div className="tools">
            <button type="button" onClick={exportJSON}>
              Exporteer JSON
            </button>
            <button type="button" onClick={() => importRef.current?.click()}>
              Importeer JSON
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={importJSON}
            />
          </div>
          <h3>Waar de gegevens vandaan komen</h3>
          <ul>
            <li>
              Engelse kaarten:{" "}
              <a href="https://github.com/PokemonTCG/pokemon-tcg-data">
                Pokémon TCG-database
              </a>
              , gecontroleerd met{" "}
              <a href="https://github.com/tcgdex/cards-database">TCGdex</a> en{" "}
              <a href="https://cardcodex.com/pokemon/card-list/pikachu/">
                Card Codex
              </a>
            </li>
            <li>
              Engelse prijzen:{" "}
              <a href="https://github.com/cristian-bravo/tcgplayer-pokemon-prices">
                TCGplayer-export
              </a>{" "}
              van 5 oktober 2026
            </li>
            <li>
              Japanse kaarten en prijzen:{" "}
              <a href="https://cardcodex.com/pokemon/card-list/pikachu/">
                Card Codex
              </a>
              , gecontroleerd op dubbelen met{" "}
              <a href="https://bulbapedia.bulbagarden.net/wiki/Pikachu_(TCG)">
                Bulbapedia
              </a>
              , PSA 10-prijzen via{" "}
              <a href="https://samuraiswordtokyo.com/blogs/news/mario-pikachu-card-guide">
                Samurai Sword Tokyo
              </a>
            </li>
            <li>
              Pikachu Illustrator:{" "}
              <a href="https://www.guinnessworldrecords.com/world-records/782465-most-expensive-trading-card-sold-at-auction-overall">
                Guinness World Records
              </a>
            </li>
            <li>
              Wisselkoers $1 = € 0,88:{" "}
              <a href="https://rekenmachinepro.nl/valuta/dollar-naar-euro/">
                RekenmachinePro
              </a>
            </li>
          </ul>
        </details>
      </section>
    </div>
  );
}

function CardRow({ card, v, onToggle }) {
  const [id, name, set, number, price, ptype, note, , code] = card;
  const setline = set + (number ? ", " + number : "");
  return (
    <tr className={v.a ? "done" : undefined}>
      {ptype === "unknown" || price === null ? (
        <td className="p unk">?</td>
      ) : (
        <td className="p">
          {priceText(price)}
          {ptype === "asking" && <span className="tag">vraagprijs</span>}
        </td>
      )}
      <td>
        <span className="name">{name}</span>
        <span className="set">{setline}</span>
        {note && <span className="note">{note}</span>}
        {code && <span className="map">Map {code}</span>}
      </td>
      {FIELDS.map(([f, label]) => (
        <td key={f} className="ck">
          <input
            type="checkbox"
            checked={!!v[f]}
            onChange={(e) => onToggle(id, f, e.target.checked)}
            aria-label={`${label}: ${name}, ${setline}`}
          />
        </td>
      ))}
    </tr>
  );
}
