"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dagwaarden, euro, totalen } from "@/lib/pokemon/regels.mjs";
import KaartAfbeelding from "./_components/KaartAfbeelding";
import KaartDetail, { datumKort } from "./_components/KaartDetail";
import Telwaarde from "./_components/Telwaarde";
import { useLive } from "./_components/useLive";

const tijdstip = (iso) =>
  new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });

const PRIJSSOORT = { l: "vraagprijs", v: "vaste prijs" };

export default function Overzicht({ kaarten, beginBits, beginPrijzen, vastePrijzen }) {
  const { status, prijsData, verbinding, puls, haalPrijzen } = useLive({ beginBits, beginPrijzen });
  const prijzen = prijsData?.prijzen ?? vastePrijzen;
  const meta = prijsData?.meta ?? null;
  const reeks = prijsData?.reeks ?? null;

  const [tab, setTab] = useState("bezit");
  const [sortering, setSortering] = useState("waarde");
  const [detail, setDetail] = useState(null);
  const [heeftToken, setHeeftToken] = useState(false);
  const [melding, setMelding] = useState("");

  useEffect(() => {
    try {
      setHeeftToken(!!localStorage.getItem("pika-token"));
      const s = localStorage.getItem("pk-sortering");
      if (s === "waarde" || s === "map") setSortering(s);
    } catch {}
  }, []);

  const t = useMemo(() => totalen({ kaarten, status, prijzen }), [kaarten, status, prijzen]);

  // Verschil met de vorige meting, voor de kaarten die je nu hebt
  const verschil = useMemo(() => {
    if (!reeks || reeks.dagen.length < 2) return null;
    const ids = kaarten.filter((k) => status[k.id]?.a).map((k) => k.id);
    const w = dagwaarden(ids, reeks, prijzen);
    const n = w.length;
    const vorigeDag = reeks.dagen[n - 2];
    return {
      cent: w[n - 1] - w[n - 2],
      sinds: datumKort(vorigeDag) + (reeks.geschat?.includes(vorigeDag) ? " (geschat)" : ""),
    };
  }, [reeks, kaarten, status, prijzen]);

  const lijst = useMemo(() => {
    const gekozen = kaarten.filter((k) =>
      tab === "bezit" ? status[k.id]?.a : status[k.id]?.o && !status[k.id]?.a
    );
    return gekozen.sort((x, y) =>
      sortering === "map" ? x.pos - y.pos : (prijzen[y.id]?.e ?? -1) - (prijzen[x.id]?.e ?? -1)
    );
  }, [kaarten, status, prijzen, tab, sortering]);

  const afgerond = t.bezit.n;
  const detailKaart = detail ? kaarten.find((k) => k.id === detail) : null;

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
      <section className="hero" aria-labelledby="pk-titel">
        <div className="hero-kop">
          <h1 id="pk-titel">Mijn Pokémon-kaarten</h1>
          <span key={puls} className={`live ${verbinding}`}>
            {verbinding === "ok" ? "live" : "offline"}
          </span>
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
          {afgerond} {afgerond === 1 ? "kaart" : "kaarten"} in bezit
          {meta?.dag ? ` · prijzen van ${datumKort(meta.dag)}` : " · vaste prijzen van 5 okt"}
          {t.bezit.perType.v ? ` · ${t.bezit.perType.v} met vaste prijs` : ""}
        </p>
      </section>

      <section className="kaarten" aria-labelledby="pk-kaarten">
        <div className="sectiekop">
          <h2 id="pk-kaarten">Mijn kaarten</h2>
          <div className="seg" role="tablist" aria-label="Welke kaarten">
            {[
              ["bezit", "In bezit", t.bezit.n],
              ["onderweg", "Onderweg", t.onderweg.n],
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
        </div>

        {lijst.length ? (
          <ul className="galerij">
            {lijst.map((k) => {
              const p = prijzen[k.id];
              return (
                <li key={k.id}>
                  <button
                    type="button"
                    className="kaartje"
                    onClick={() => setDetail(k.id)}
                    aria-label={`${k.n}, ${k.s}${k.nr ? " " + k.nr : ""}, ${euro(p?.e)}`}
                  >
                    <span className="kaartje-plaat">
                      <KaartAfbeelding key={k.img.join()} img={k.img} />
                    </span>
                    <span className="kaartje-naam">{k.n}</span>
                    <span className="kaartje-set">{k.s}</span>
                    <span className="kaartje-prijs">
                      {euro(p?.e)}
                      {PRIJSSOORT[p?.t] && <small> {PRIJSSOORT[p.t]}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="leeg">
            {tab === "bezit" ? "Nog geen kaarten afgerond." : "Er is niets onderweg."}
          </p>
        )}
      </section>

      <Link href="/pokemon/pikachu" className="linkkaart">
        <span className="lk-titel">⚡ Pikachu-verzameling</span>
        <span className="lk-sub">
          {afgerond}/{kaarten.length} afgerond · in je map {t.binder.bezit}/{t.binder.totaal}
        </span>
        <span className="lk-balk" aria-hidden="true">
          <i style={{ width: `${Math.round((afgerond / kaarten.length) * 100)}%` }} />
        </span>
        <span className="lk-pijl" aria-hidden="true">
          →
        </span>
      </Link>

      <details className="info">
        <summary>Hoe worden prijzen berekend?</summary>
        <p>
          Per kaart de TCGplayer-marktprijs van precies jouw variant (zoals Cosmos Holo of een
          stempelversie), omgerekend naar euro met de dagkoers van de ECB. Is er geen recente
          verkoop, dan telt het laagste aanbod als vraagprijs. Zonder koppeling of prijs blijft de
          vaste prijs van 5 oktober staan. Cardmarket-prijzen zie je per kaart als extra informatie.
          De prijzen worden elke avond ververst.
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

      {detailKaart && (
        <KaartDetail
          kaart={detailKaart}
          prijs={prijzen[detailKaart.id]}
          fx={meta?.fx}
          reeks={reeks}
          status={status[detailKaart.id]}
          onSluit={() => setDetail(null)}
        />
      )}
    </div>
  );
}
