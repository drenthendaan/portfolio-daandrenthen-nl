"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dagwaarden, euro, itemPrijs, meldingStand, totalen } from "@/lib/pokemon/regels.mjs";
import { schrijf } from "./_components/api";
import ItemVenster from "./_components/ItemVenster";
import KaartAfbeelding from "./_components/KaartAfbeelding";
import KaartDetail, { datumKort } from "./_components/KaartDetail";
import Kruimelpad from "./_components/Kruimelpad";
import Meldingen from "./_components/Meldingen";
import NieuweVerzameling from "./_components/NieuweVerzameling";
import Telwaarde from "./_components/Telwaarde";
import { useItems } from "./_components/useItems";
import { useLive } from "./_components/useLive";

const tijdstip = (iso) =>
  new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });

const PRIJSSOORT = { l: "vraagprijs", v: "vaste prijs", h: "eigen waarde" };

// Kop per label; eigen labels heten zoals je ze noemt
const sectieTitel = (l) =>
  ({ kaarten: "Mijn kaarten", etb: "Mijn ETB's", overig: "Overig" })[l.id] ?? l.naam;
const telwoord = (l, n) =>
  l.id === "kaarten" ? (n === 1 ? "kaart" : "kaarten") : l.id === "etb" ? (n === 1 ? "ETB" : "ETB's") : `× ${l.naam.toLowerCase()}`;

const BelIcoon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
    <path
      d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9M10 20.5a2.2 2.2 0 0 0 4 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Overzicht({ kaarten, beginBits, beginPrijzen, vastePrijzen, beginItems, beginMeldingen }) {
  const live = useLive({ beginBits, beginPrijzen });
  const { status, prijsData, verbinding, puls, haalPrijzen } = live;
  const items = useItems(beginItems, live.itemsVersie);
  const prijzen = prijsData?.prijzen ?? vastePrijzen;
  const meta = prijsData?.meta ?? null;
  const reeks = prijsData?.reeks ?? null;

  const [tab, setTab] = useState("bezit");
  const [sortering, setSortering] = useState("waarde");
  const [detail, setDetail] = useState(null);
  const [venster, setVenster] = useState(null); // { item } of { standaard }
  const [nieuweVerzameling, setNieuweVerzameling] = useState(false);
  const router = useRouter();
  const [heeftToken, setHeeftToken] = useState(false);
  const [melding, setMelding] = useState("");

  // Prijsmeldingen. "Gelezen" is per apparaat: de tijd van de nieuwste melding die je zag
  // (undefined zolang dat nog niet uit localStorage is gelezen).
  const [meldingData, setMeldingData] = useState(beginMeldingen ?? { meldingen: [], drempel: null });
  const [meldingenOpen, setMeldingenOpen] = useState(false);
  const [gelezen, setGelezen] = useState(undefined);
  const [nieuwVanaf, setNieuwVanaf] = useState(null);
  const meldingen = meldingData.meldingen ?? [];
  const nieuwste = meldingen[0]?.tijd ?? null;
  const ongelezen = gelezen === undefined ? 0 : meldingen.filter((m) => !gelezen || m.tijd > gelezen).length;

  const haalMeldingen = useCallback(async () => {
    try {
      const res = await fetch("/api/pokemon/meldingen", { cache: "no-store" });
      if (res.ok) setMeldingData(await res.json());
    } catch {}
  }, []);

  // Nieuwe prijzen binnen: dan zijn er misschien ook nieuwe meldingen
  const prijsVersie = prijsData?.versie ?? null;
  const vorigeVersie = useRef(prijsVersie);
  useEffect(() => {
    if (prijsVersie === vorigeVersie.current) return;
    vorigeVersie.current = prijsVersie;
    haalMeldingen();
  }, [prijsVersie, haalMeldingen]);

  const openMeldingen = useCallback(() => {
    setMeldingenOpen(true);
    haalMeldingen();
  }, [haalMeldingen]);

  // Openen via een tik op een pushmelding: /pokemon#meldingen, of een bericht van de service worker
  useEffect(() => {
    try {
      setGelezen(localStorage.getItem("pk-meldingen-gelezen"));
    } catch {
      setGelezen(null);
    }
    const viaHash = () => {
      if (window.location.hash !== "#meldingen") return;
      openMeldingen();
      history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    viaHash();
    const sw = navigator.serviceWorker;
    const bericht = (e) => {
      if (e.data?.soort === "meldingen") openMeldingen();
    };
    sw?.addEventListener("message", bericht);
    window.addEventListener("hashchange", viaHash);
    return () => {
      sw?.removeEventListener("message", bericht);
      window.removeEventListener("hashchange", viaHash);
    };
  }, [openMeldingen]);

  // Bij openen alles gelezen; wat nieuw was, houdt in het venster een stip
  useEffect(() => {
    if (!meldingenOpen || gelezen === undefined) return;
    setNieuwVanaf((v) => (v === null ? gelezen ?? "" : v));
    if (nieuwste && nieuwste !== gelezen) {
      setGelezen(nieuwste);
      try {
        localStorage.setItem("pk-meldingen-gelezen", nieuwste);
      } catch {}
    }
  }, [meldingenOpen, nieuwste, gelezen]);

  // Aantal ongelezen meldingen op het app-icoon (beginscherm, als meldingen aanstaan)
  useEffect(() => {
    if (gelezen === undefined) return;
    try {
      const p = ongelezen ? navigator.setAppBadge?.(ongelezen) : navigator.clearAppBadge?.();
      p?.catch?.(() => {});
    } catch {}
  }, [ongelezen, gelezen]);

  useEffect(() => {
    try {
      setHeeftToken(!!localStorage.getItem("pika-token"));
      const s = localStorage.getItem("pk-sortering");
      if (s === "waarde" || s === "map") setSortering(s);
    } catch {}
  }, []);

  const t = useMemo(
    () => totalen({ kaarten, status, prijzen, items: items.items }),
    [kaarten, status, prijzen, items.items]
  );
  const itemPrijzen = useMemo(
    () => Object.fromEntries(items.items.map((i) => [i.id, itemPrijs(i, prijzen)])),
    [items.items, prijzen]
  );

  // Verschil met de vorige meting, voor alles wat je nu hebt
  const verschil = useMemo(() => {
    if (!reeks || reeks.dagen.length < 2) return null;
    const bezitItems = items.items.filter((i) => i.status?.a);
    const ids = [...kaarten.filter((k) => status[k.id]?.a).map((k) => k.id), ...bezitItems.map((i) => i.id)];
    const aantal = Object.fromEntries(bezitItems.map((i) => [i.id, i.aantal || 1]));
    const w = dagwaarden(ids, reeks, { ...prijzen, ...itemPrijzen }, aantal);
    const n = w.length;
    const vorigeDag = reeks.dagen[n - 2];
    return {
      cent: w[n - 1] - w[n - 2],
      sinds: datumKort(vorigeDag) + (reeks.geschat?.includes(vorigeDag) ? " (geschat)" : ""),
    };
  }, [reeks, kaarten, status, prijzen, items.items, itemPrijzen]);

  // Eén lijst voor de galerij: kaarten uit de verzameling en zelf toegevoegde items
  const tegels = useMemo(
    () => [
      ...kaarten.map((k) => ({
        id: k.id,
        soort: "kaart",
        label: "kaarten",
        naam: k.n,
        set: k.s,
        nummer: k.nr,
        img: k.img,
        prijs: prijzen[k.id],
        aantal: 1,
        pos: k.pos,
        status: status[k.id] || {},
      })),
      ...items.items.map((i, n) => ({
        id: i.id,
        soort: "item",
        label: i.label,
        naam: i.naam,
        set: i.set,
        nummer: i.nummer,
        img: i.img,
        prijs: itemPrijzen[i.id],
        aantal: i.aantal || 1,
        pos: 100000 + n,
        status: i.status || {},
      })),
    ],
    [kaarten, prijzen, status, items.items, itemPrijzen]
  );

  const sorteer = (lijst) =>
    lijst.sort((x, y) =>
      sortering === "map"
        ? x.pos - y.pos
        : (y.prijs?.e ?? -1) * y.aantal - (x.prijs?.e ?? -1) * x.aantal
    );

  const kaartLijst = useMemo(
    () =>
      sorteer(
        tegels.filter(
          (x) => x.label === "kaarten" && (tab === "bezit" ? x.status.a : x.status.b && !x.status.a)
        )
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tegels, tab, sortering]
  );

  // Blokken voor de andere labels: ETB's altijd, de rest zodra er iets onder staat
  const blokken = items.labels
    .filter((l) => l.id !== "kaarten")
    .map((l) => ({ label: l, lijst: sorteer(tegels.filter((x) => x.label === l.id)) }))
    .filter((b) => b.label.id === "etb" || b.lijst.length);

  const kaartenBezit = t.perLabel.kaarten?.bezit.n ?? 0;
  const bezitTekst = [
    `${kaartenBezit} ${kaartenBezit === 1 ? "kaart" : "kaarten"}`,
    ...items.labels
      .filter((l) => l.id !== "kaarten" && t.perLabel[l.id]?.bezit.n)
      .map((l) => `${t.perLabel[l.id].bezit.n} ${telwoord(l, t.perLabel[l.id].bezit.n)}`),
  ].join(" · ");
  // Per verzameling: voortgang en waarde van wat je hebt. Pikachu = vaste kaarten (zonder
  // verborgen) plus items; eigen verzamelingen bestaan alleen uit items.
  const verzamelingen = items.verzamelingen.map((v) => {
    const verborgen = new Set(v.verborgen ?? []);
    const vast = v.id === "pikachu" ? kaarten.filter((k) => !verborgen.has(k.id)) : [];
    const eigen = items.items.filter((i) => i.verzameling === v.id);
    let afgerond = 0;
    let cent = 0;
    for (const k of vast) {
      if (status[k.id]?.a) {
        afgerond++;
        cent += prijzen[k.id]?.e ?? 0;
      }
    }
    for (const i of eigen) {
      if (i.status?.a) {
        afgerond++;
        cent += (itemPrijzen[i.id]?.e ?? 0) * (i.aantal || 1);
      }
    }
    return { ...v, totaal: vast.length + eigen.length, afgerond, cent };
  });
  const detailKaart = detail ? kaarten.find((k) => k.id === detail) : null;

  // De stand van nu (koop je iets na de melding, dan staat er "In je vault")
  const verborgenPikachu = useMemo(
    () => new Set(items.verzamelingen.find((v) => v.id === "pikachu")?.verborgen ?? []),
    [items.verzamelingen]
  );
  const standVan = useCallback(
    (m) => {
      if (m.soort === "kaart") return meldingStand(status[m.id], !verborgenPikachu.has(m.id)) ?? m.stand;
      const item = items.items.find((i) => i.id === m.id);
      return (item && meldingStand(item.status, !!item.verzameling)) ?? m.stand;
    },
    [status, items.items, verborgenPikachu]
  );
  function openMelding(m) {
    if (m.soort === "kaart") {
      if (kaarten.some((k) => k.id === m.id)) setDetail(m.id);
      return;
    }
    const item = items.items.find((i) => i.id === m.id);
    if (item) setVenster({ item });
  }

  // Vinkje van een Pikachu-kaart wijzigen vanuit het detailvenster: meteen tonen, dan
  // opslaan; bij een fout (bijv. geen token) terugzetten en de fout doorgeven.
  async function wijzigKaart(id, veld, aan) {
    const oud = status[id] || {};
    const nieuw = { w: !!oud.w, b: !!oud.b, o: !!oud.o, a: !!oud.a, [veld]: aan };
    live.zetLokaal(id, nieuw);
    try {
      await schrijf("/api/pikachu", { method: "PUT", body: { status: { [id]: nieuw } } });
      live.klaarLokaal(id, 20_000);
      // De Pikachu-pagina in deze browser houdt een eigen kopie bij
      try {
        const lokaal = JSON.parse(localStorage.getItem("pika-status") || "null");
        if (lokaal && typeof lokaal === "object") {
          lokaal[id] = nieuw;
          localStorage.setItem("pika-status", JSON.stringify(lokaal));
        }
      } catch {}
    } catch (e) {
      live.zetLokaal(id, oud);
      live.klaarLokaal(id);
      throw e;
    }
  }

  function openTegel(x) {
    if (x.soort === "kaart") setDetail(x.id);
    else setVenster({ item: items.items.find((i) => i.id === x.id) });
  }

  async function nuVerversen() {
    let token = null;
    try {
      token = localStorage.getItem("pika-token");
    } catch {}
    if (!token) return;
    setMelding("Bezig met verversen…");
    try {
      const res = await fetch("/api/pokemon/ververs", {
        method: "POST",
        headers: { "x-pikachu-token": token },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        try {
          localStorage.removeItem("pika-token");
        } catch {}
        setHeeftToken(false);
        setMelding("Token klopt niet.");
      } else if (res.status === 429) {
        setMelding(`Net al ververst. Probeer het over ${Math.ceil((data.wachtSeconden || 60) / 60)} min opnieuw.`);
      } else if (data.overgeslagen) {
        setMelding("Er zijn nog geen nieuwere prijzen.");
      } else if (data.ok) {
        setMelding(`Ververst: ${data.tellingen?.m ?? 0} marktprijzen.`);
        await haalPrijzen();
      } else {
        setMelding(`Verversen lukte niet (${data.status || res.status}).`);
      }
    } catch {
      setMelding("Verversen lukte niet: geen verbinding.");
    }
  }

  return (
    <div className="wrap overzicht">
      <Kruimelpad stappen={[{ naam: "Home", href: "/" }, { naam: "Pokémon" }]} />
      <section className="hero" aria-labelledby="pk-titel">
        <div className="hero-kop">
          <h1 id="pk-titel">Mijn Pokémon-verzameling</h1>
          <div className="hero-acties">
            <button
              type="button"
              className="bel"
              onClick={openMeldingen}
              aria-haspopup="dialog"
              aria-label={`Prijsmeldingen${ongelezen ? `, ${ongelezen} nieuw` : ""}`}
            >
              <BelIcoon />
              {ongelezen > 0 && (
                <span className="bel-teller" aria-hidden="true">
                  {ongelezen > 9 ? "9+" : ongelezen}
                </span>
              )}
            </button>
            <span key={puls} className={`live ${verbinding}`}>
              {verbinding === "ok" ? "live" : "offline"}
            </span>
          </div>
        </div>
        <p className="totaal">
          <Telwaarde cent={t.bezit.cent} format={euro} />
        </p>
        {verschil && (
          <p className={`delta ${verschil.cent > 0 ? "op" : verschil.cent < 0 ? "neer" : ""}`}>
            {verschil.cent > 0 ? "▲" : verschil.cent < 0 ? "▼" : "="} {euro(Math.abs(verschil.cent))} sinds{" "}
            {verschil.sinds}
          </p>
        )}
        <p className="hero-sub">
          {bezitTekst} in bezit
          {meta?.dag ? ` · prijzen van ${datumKort(meta.dag)}` : " · vaste prijzen van 5 okt"}
        </p>
      </section>

      <section className="kaarten" aria-labelledby="pk-kaarten">
        <div className="sectiekop">
          <h2 id="pk-kaarten">Mijn kaarten</h2>
          <div className="seg" role="tablist" aria-label="Welke kaarten">
            {[
              ["bezit", "In bezit", t.perLabel.kaarten?.bezit.n ?? 0],
              ["betaald", "Betaald", t.perLabel.kaarten?.betaald.n ?? 0],
            ].map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label} <span>{n}</span>
              </button>
            ))}
          </div>
          <label htmlFor="pk-sort" className="visually-hidden">
            Sorteren
          </label>
          <select
            id="pk-sort"
            className="keuze"
            value={sortering}
            onChange={(e) => {
              setSortering(e.target.value);
              try {
                localStorage.setItem("pk-sortering", e.target.value);
              } catch {}
            }}
          >
            <option value="waarde">duurste eerst</option>
            <option value="map">zoals in je map</option>
          </select>
          {/* Eén knop voor alles: het label kies je in het venster */}
          <button
            type="button"
            className="toevoegen"
            onClick={() => setVenster({ standaard: {} })}
            aria-label="Item toevoegen"
          >
            + Toevoegen
          </button>
        </div>
        <Galerij
          lijst={kaartLijst}
          onOpen={openTegel}
          leeg={tab === "bezit" ? "Nog geen kaarten afgerond." : "Alles wat je betaald hebt, is binnen."}
        />
      </section>

      {blokken.map(({ label, lijst }) => {
        const tot = t.perLabel[label.id];
        return (
          <section className="kaarten" key={label.id} aria-labelledby={`pk-${label.id}`}>
            <div className="sectiekop">
              <h2 id={`pk-${label.id}`}>{sectieTitel(label)}</h2>
              {tot?.bezit.n ? <span className="sectie-som">{euro(tot.bezit.cent)}</span> : null}
            </div>
            <Galerij
              lijst={lijst}
              onOpen={openTegel}
              leeg={
                label.id === "etb"
                  ? "Nog geen ETB's. Voeg er een toe met + Toevoegen bij Mijn kaarten."
                  : "Nog niets onder dit label."
              }
            />
          </section>
        );
      })}

      <section className="kaarten verzamelingen" aria-labelledby="pk-verzamelingen">
        <div className="sectiekop">
          <h2 id="pk-verzamelingen">Verzamelingen</h2>
          <button type="button" className="toevoegen" onClick={() => setNieuweVerzameling(true)}>
            + Nieuwe verzameling
          </button>
        </div>
        <ul className="verzamellijst">
          {verzamelingen.map((v) => (
            <li key={v.id}>
              <Link href={`/pokemon/${v.id}`} className="linkkaart">
                <span className="lk-titel">
                  {v.id === "pikachu" ? "⚡ " : ""}
                  {v.naam}
                </span>
                <span className="lk-sub">
                  {v.totaal ? `${v.afgerond}/${v.totaal} afgerond · ${euro(v.cent)} in bezit` : "Nog leeg"}
                </span>
                <span className="lk-balk" aria-hidden="true">
                  <i style={{ width: `${v.totaal ? Math.round((v.afgerond / v.totaal) * 100) : 0}%` }} />
                </span>
                <span className="lk-pijl" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <details className="info">
        <summary>Hoe worden prijzen berekend?</summary>
        <p>
          Per kaart de TCGplayer-marktprijs van precies jouw variant (zoals Cosmos Holo of een
          stempelversie), omgerekend naar euro met de dagkoers van de ECB. Is er geen recente
          verkoop, dan telt het laagste aanbod als vraagprijs. Zonder koppeling of prijs blijft de
          vaste prijs van 5 oktober staan. Cardmarket-prijzen zie je per kaart als extra informatie.
          Items die je zelf toevoegt en aan een TCGplayer-product koppelt, volgen dezelfde prijs;
          anders telt de waarde die je zelf invult. De prijzen worden elke avond ververst. Gaat iets
          wat je hebt of nog wilt kopen flink omhoog of omlaag, dan zie je dat bij het belletje
          bovenaan, en als je dat aanzet ook als pushmelding.
        </p>
        {meta && (
          <ul>
            <li>
              Laatst ververst: {tijdstip(meta.tijd)} ({meta.status === "ok" ? "gelukt" : meta.status})
            </li>
            <li>
              {meta.tellingen.m} marktprijs · {meta.tellingen.l} vraagprijs · {meta.tellingen.v} vaste
              prijs · {meta.tellingen.o} onbekend · {meta.tellingen.cardmarket} met Cardmarket
            </li>
            <li>
              Koers: $ 1 = € {meta.fx.koers.toLocaleString("nl-NL", { maximumFractionDigits: 4 })} (
              {meta.fx.bron === "ecb" ? `ECB, ${datumKort(meta.fx.datum)}` : "vaste koers"})
            </li>
          </ul>
        )}
        <h3>Bronnen</h3>
        <ul>
          <li>
            TCGplayer-prijzen en afbeeldingen via <a href="https://tcgcsv.com">tcgcsv.com</a>
          </li>
          <li>
            Cardmarket-prijzen via <a href="https://tcgdex.dev">TCGdex</a>
          </li>
          <li>
            Wisselkoers van de ECB via <a href="https://frankfurter.dev">Frankfurter</a>
          </li>
        </ul>
        {heeftToken && (
          <div className="tools">
            <button type="button" onClick={nuVerversen}>
              Nu verversen
            </button>
            {melding && (
              <span className="saved" role="status">
                {melding}
              </span>
            )}
          </div>
        )}
      </details>

      {meldingenOpen && (
        <Meldingen
          meldingen={meldingen}
          drempel={meldingData.drempel ?? undefined}
          nieuwVanaf={nieuwVanaf}
          standVan={standVan}
          onOpen={openMelding}
          onDrempel={(drempel) => setMeldingData((d) => ({ ...d, drempel }))}
          onSluit={() => {
            setMeldingenOpen(false);
            setNieuwVanaf(null);
          }}
        />
      )}
      {detailKaart && (
        <KaartDetail
          kaart={detailKaart}
          prijs={prijzen[detailKaart.id]}
          fx={meta?.fx}
          reeks={reeks}
          status={status[detailKaart.id]}
          onWijzig={wijzigKaart}
          onSluit={() => setDetail(null)}
        />
      )}
      {venster && (
        <ItemVenster
          item={venster.item ?? null}
          standaard={venster.standaard}
          labels={items.labels}
          verzamelingen={items.verzamelingen}
          fx={meta?.fx}
          prijzen={prijzen}
          acties={items}
          onSluit={() => setVenster(null)}
        />
      )}
      {nieuweVerzameling && (
        <NieuweVerzameling
          maak={items.maakVerzameling}
          onKlaar={(v) => router.push(`/pokemon/${v.id}`)}
          onSluit={() => setNieuweVerzameling(false)}
        />
      )}
    </div>
  );
}

function Galerij({ lijst, onOpen, leeg }) {
  if (!lijst.length) return <p className="leeg">{leeg}</p>;
  return (
    <ul className="galerij">
      {lijst.map((x) => {
        const p = x.prijs;
        const totaal = p?.e != null ? p.e * x.aantal : null;
        return (
          <li key={x.id}>
            <button
              type="button"
              className="kaartje"
              onClick={() => onOpen(x)}
              aria-label={`${x.aantal > 1 ? x.aantal + "× " : ""}${x.naam}${x.set ? ", " + x.set : ""}${x.nummer ? " " + x.nummer : ""}, ${euro(totaal)}`}
            >
              <span className={`kaartje-plaat${x.soort === "item" && !/^\d/.test(x.nummer || "") ? " product" : ""}`}>
                <KaartAfbeelding key={x.img.join()} img={x.img} />
                {x.aantal > 1 && <span className="kaartje-aantal">{x.aantal}×</span>}
                {!x.status.a && (
                  <span className="kaartje-status">{x.status.b ? "betaald" : "nog niet betaald"}</span>
                )}
              </span>
              <span className="kaartje-naam">{x.naam}</span>
              {x.set && <span className="kaartje-set">{x.set}</span>}
              <span className="kaartje-prijs">
                {euro(totaal)}
                {PRIJSSOORT[p?.t] && <small> {PRIJSSOORT[p.t]}</small>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
