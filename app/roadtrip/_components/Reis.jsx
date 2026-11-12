"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import {
  aantalDagen,
  groepeerDagen,
  pastVoertuig,
  toon,
  totalen,
} from "@/lib/roadtrip/regels.mjs";
import { GeenToken, heeftToken } from "./api";
import { useLive } from "./useLive";
import { useReis } from "./useReis";
import Rail from "./Rail";
import TokenVak from "./TokenVak";
import Dagdetail from "./Dagdetail";
import StopFormulier from "./StopFormulier";
import ReisInstellingen from "./ReisInstellingen";
import {
  Greep,
  Omlaag,
  PijlTerug,
  Rijden,
  VERVOERICOON,
  Waarschuwing,
} from "./iconen";

// MapLibre heeft window nodig, dus alleen in de browser laden
const Kaart = dynamicImport(() => import("./Kaart"), {
  ssr: false,
  loading: () => <div className="kaartvak" aria-hidden="true" />,
});

const euro = (centen) =>
  centen === null || centen === undefined
    ? null
    : `€ ${(centen / 100).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;

const TABS = [
  { id: "dagen", naam: "Dagen" },
  { id: "route", naam: "Route" },
  { id: "praktisch", naam: "Praktisch" },
  { id: "ideeen", naam: "Ideeën" },
];

const datumVanDag = (van, nr) => {
  if (!van || !nr) return null;
  const d = new Date(`${van}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (nr - 1));
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
};

function Stop({ stop, voertuig, nummer, onBewerk }) {
  const uitslag = pastVoertuig(stop.max, voertuig);
  const sub = [
    stop.soort === "overnachting" ? "Overnachting" : stop.soort === "servicepunt" ? "Servicepunt" : "Bezienswaardigheid",
    stop.nachten ? `${stop.nachten} ${stop.nachten === 1 ? "nacht" : "nachten"}` : null,
    stop.adres,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="stop">
      <span className={`pin${stop.soort === "overnachting" ? "" : " leeg"}`}>{nummer ?? "·"}</span>
      <div className="body">
        <div className="regel">
          <h3>
            {onBewerk ? (
              <button type="button" className="alsLink" onClick={() => onBewerk(stop)}>
                {stop.naam}
              </button>
            ) : (
              stop.naam
            )}
          </h3>
          {stop.prijs ? <span className="prijs">{euro(stop.prijs)}</span> : null}
        </div>
        {sub ? <p className="sub">{sub}</p> : null}
        <span className={`stand ${stop.status}`}>
          <span className="bol" />
          {stop.status === "geboekt" ? "Geboekt" : stop.status === "gepland" ? "Gepland" : "Idee"}
        </span>
        {!uitslag.past ? (
          <p className="past-niet">
            <Waarschuwing /> Past niet
            {uitslag.problemen.map((p) => (
              <span key={p.veld}>{p.tekst}</span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function Reis({ begin, etappes = {} }) {
  const { versie: versieLive, verbinding } = useLive(begin?.versie);
  const reisData = useReis(begin, versieLive);
  const { reis, stops, dagen: notities, bewaarStop, verwijderStop, zetDagnotitie } = reisData;

  const [tab, setTab] = useState("dagen");
  const [open, setOpen] = useState(null);
  const [melding, setMelding] = useState(null);
  const [vraagToken, setVraagToken] = useState(false);
  const [mag, setMag] = useState(false);
  const [toevoegen, setToevoegen] = useState(false);
  const [actief, setActief] = useState(null);
  const [bewerkStop, setBewerkStop] = useState(null);
  const [instellingen, setInstellingen] = useState(false);
  const wachtend = useRef(null);

  // De kaart wil de stops in reisvolgorde, zodat de lijn klopt
  const opVolgorde = useMemo(() => {
    const { dagen: perDag, ideeen: los } = groepeerDagen(stops);
    return [...perDag.flatMap((d) => d.stops), ...los];
  }, [stops]);

  useEffect(() => setMag(heeftToken()), []);

  const metToken = useCallback(async (actie) => {
    try {
      setMelding(null);
      return await actie();
    } catch (e) {
      if (e instanceof GeenToken) {
        wachtend.current = actie;
        setVraagToken(true);
      }
      setMelding(e.message);
      return null;
    }
  }, []);

  const naToken = () => {
    setVraagToken(false);
    setMag(true);
    const actie = wachtend.current;
    wachtend.current = null;
    if (actie) metToken(actie);
  };

  if (!reis) return null;

  const Icoon = VERVOERICOON[reis.vervoer] ?? VERVOERICOON.camper;
  const { dagen, ideeen } = groepeerDagen(stops);
  const telling = totalen(stops);
  const duur = aantalDagen(reis.van, reis.tot);

  // Nummers lopen door over de overnachtingen heen: een pin op de kaart is een
  // plek waar je echt staat, geen los idee.
  const nummers = new Map();
  let teller = 0;
  for (const dag of dagen) {
    for (const stop of dag.stops) {
      if (stop.soort === "overnachting") nummers.set(stop.id, ++teller);
    }
  }

  const meta = [
    reis.van && reis.tot
      ? `${new Date(`${reis.van}T00:00:00Z`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", timeZone: "UTC" })} – ${new Date(`${reis.tot}T00:00:00Z`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`
      : "nog geen datums",
    duur ? `${duur} dagen` : null,
    `${stops.length} stops`,
    reis.gebied,
  ].filter(Boolean);

  return (
    <div className="raam">
      <Rail hier="reis" />

      <div className="inhoud" style={{ display: "flex", flexDirection: "column" }}>
        <header className="reiskop">
          <Link className="terug" href="/roadtrip">
            <PijlTerug />
            Alle roadtrips
          </Link>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
              marginTop: 10,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
                <h1>{reis.naam}</h1>
                <span className="label">
                  <Icoon size={13} />
                  {reis.vervoer}
                </span>
              </div>
              <p className="meta" style={{ margin: "7px 0 0", fontSize: 14, color: "var(--zacht)" }}>
                {meta.join(" · ")}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
            <dl className="cijfers">
              <div>
                <dt>Nachten</dt>
                <dd>{telling.nachten}</dd>
              </div>
              <div>
                <dt>Plekken</dt>
                <dd>{euro(telling.kosten) ?? "—"}</dd>
              </div>
              <div>
                <dt>Geboekt</dt>
                <dd style={{ color: "var(--diep-tekst)" }}>
                  {telling.geboekt} / {telling.overnachtingen}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="knop stil klein"
              onClick={() => setInstellingen((b) => !b)}
            >
              {instellingen ? "Sluiten" : "Aanpassen"}
            </button>
            </div>
          </div>

          <div className="tabs" role="tablist" aria-label="Weergave">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.naam}
                {t.id === "ideeen" && ideeen.length ? ` · ${ideeen.length}` : ""}
              </button>
            ))}
          </div>
        </header>

        <div className="werkvlak">
          <section className="lijst">
            {verbinding === "weg" ? (
              <p className="verbinding weg" style={{ marginBottom: 12 }}>
                Geen verbinding met de server — je ziet de laatst opgehaalde stand.
              </p>
            ) : null}

            {melding ? <p className="melding">{melding}</p> : null}
            {vraagToken ? <TokenVak onOpgeslagen={naToken} /> : null}

            {instellingen ? (
              <ReisInstellingen
                reis={reis}
                aantalStops={stops.length}
                onBijgewerkt={() => reisData.herlaad()}
                onFout={(e) => {
                  if (e instanceof GeenToken) setVraagToken(true);
                  setMelding(e.message);
                }}
                onSluit={() => setInstellingen(false)}
              />
            ) : null}

            {tab === "dagen" ? (
              <>
                <p className="uitleg">
                  Elke dag toont waar je heen rijdt en waar je staat. Klik een dag open
                  voor notities en wat je daar wilt doen.
                </p>

                {dagen.length === 0 ? (
                  <p className="leeg">Nog geen dagen ingepland.</p>
                ) : null}

                {dagen.map((dag) => {
                  const uit = open === dag.nr;
                  const datum = datumVanDag(reis.van, dag.nr);
                  const rit = etappes[dag.nr];
                  return (
                    <div className="dag" key={dag.nr}>
                      <button
                        type="button"
                        className="dagbalk"
                        aria-expanded={uit}
                        onClick={() => setOpen(uit ? null : dag.nr)}
                      >
                        <span className="nr">
                          Dag {dag.nr}
                          {datum ? ` · ${datum}` : ""}
                        </span>
                        <span className="rit">
                          {rit ? (
                            <>
                              <Rijden />{" "}
                              <strong>{rit.km.toLocaleString("nl-NL")} km</strong>
                              {" · "}
                              {Math.floor(rit.minuten / 60)}u
                              {String(rit.minuten % 60).padStart(2, "0")}
                              {rit.schatting ? " (schatting)" : ""}
                            </>
                          ) : dag.overnachting ? (
                            "Blijven staan"
                          ) : (
                            `${dag.stops.length} stops`
                          )}
                        </span>
                        <Omlaag />
                      </button>

                      {dag.stops
                        .filter((s) => s.soort === "overnachting")
                        .map((stop) => (
                          <Stop
                            key={stop.id}
                            stop={stop}
                            voertuig={reis.voertuig}
                            nummer={nummers.get(stop.id)}
                            onBewerk={mag ? setBewerkStop : null}
                          />
                        ))}

                      {uit ? (
                        <Dagdetail
                          dag={dag}
                          notitie={notities?.[dag.nr]?.notitie ?? ""}
                          onNotitie={(tekst) => metToken(() => zetDagnotitie(dag.nr, tekst))}
                          mag={mag}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </>
            ) : null}

            {tab === "route" ? (
              <>
                <p className="uitleg">
                  Alle plekken waar je staat, op volgorde. Handig om de etappes te verdelen.
                </p>
                <div className="tabel">
                  {dagen
                    .flatMap((d) => d.stops.filter((s) => s.soort === "overnachting").map((s) => ({ s, d })))
                    .map(({ s, d }) => (
                      <div className="rij" key={s.id}>
                        <span>
                          <strong style={{ fontWeight: 700 }}>{nummers.get(s.id)}.</strong> {s.naam}
                        </span>
                        <strong>Dag {d.nr}</strong>
                      </div>
                    ))}
                  {!dagen.length ? <div className="rij">Nog niets ingepland</div> : null}
                </div>
              </>
            ) : null}

            {tab === "praktisch" ? (
              <>
                <h2 className="groepkop" style={{ marginTop: 0 }}>
                  Kosten
                </h2>
                <div className="tabel">
                  <div className="rij">
                    <span>Plekken · {telling.nachten} nachten</span>
                    <strong>{euro(telling.kosten) ?? "€ 0"}</strong>
                  </div>
                  <div className="rij">
                    <span>Nog niet geboekt</span>
                    <strong>{telling.overnachtingen - telling.geboekt}</strong>
                  </div>
                </div>

                {reis.voertuig ? (
                  <>
                    <h2 className="groepkop">Camper</h2>
                    <div className="tabel">
                      <div className="rij">
                        <span>Lengte</span>
                        <strong>{toon(reis.voertuig.lengte, "cm") || "—"}</strong>
                      </div>
                      <div className="rij">
                        <span>Hoogte</span>
                        <strong>{toon(reis.voertuig.hoogte, "cm") || "—"}</strong>
                      </div>
                      <div className="rij">
                        <span>Gewicht</span>
                        <strong>{toon(reis.voertuig.gewicht, "kg") || "—"}</strong>
                      </div>
                    </div>
                    <p className="uitleg" style={{ marginTop: 10 }}>
                      Vul bij een plek de maxima in; plekken die niet passen krijgen een
                      waarschuwing in de lijst.
                    </p>
                  </>
                ) : null}
              </>
            ) : null}

            {tab === "ideeen" ? (
              <>
                <p className="uitleg">
                  Dingen die jullie willen zien, nog niet aan een dag gekoppeld. Zet er een
                  dagnummer bij zodra de route vaststaat.
                </p>
                {ideeen.length === 0 ? <p className="leeg">Nog geen ideeën.</p> : null}
                <ul className="kaartlijst">
                  {ideeen.map((idee) => (
                    <li key={idee.id}>
                      <Greep />
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <h3>
                          {mag ? (
                            <button type="button" className="alsLink" onClick={() => setBewerkStop(idee)}>
                              {idee.naam}
                            </button>
                          ) : (
                            idee.naam
                          )}
                        </h3>
                        {idee.notitie ? <p>{idee.notitie}</p> : null}
                      </div>
                      {idee.prijs ? <span className="prijs">{euro(idee.prijs)}</span> : null}
                      <label htmlFor={`dag-${idee.id}`} style={{ margin: 0, fontSize: 11 }}>
                        Dag
                      </label>
                      <input
                        id={`dag-${idee.id}`}
                        type="number"
                        min="1"
                        placeholder="—"
                        style={{ width: 72, height: 36 }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const waarde = e.currentTarget.value.trim();
                          if (!waarde) return;
                          metToken(() => bewaarStop({ id: idee.id, dag: Number(waarde) }));
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div style={{ marginTop: 18 }}>
              {toevoegen || bewerkStop ? (
                <StopFormulier
                  key={bewerkStop?.id ?? "nieuw"}
                  stop={bewerkStop}
                  onBewaar={(velden) => metToken(() => bewaarStop(velden))}
                  onVerwijder={(id) => metToken(() => verwijderStop(id))}
                  onSluit={() => {
                    setToevoegen(false);
                    setBewerkStop(null);
                  }}
                />
              ) : (
                <button type="button" className="knop stil" onClick={() => setToevoegen(true)}>
                  <Rijden />
                  Stop toevoegen
                </button>
              )}
            </div>
          </section>

          <Kaart
            stops={opVolgorde}
            midden={reis.midden}
            actief={actief}
            onKiesStop={(id) => {
              setActief(id);
              const stop = stops.find((s) => s.id === id);
              if (stop?.dag) {
                setTab("dagen");
                setOpen(stop.dag);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
