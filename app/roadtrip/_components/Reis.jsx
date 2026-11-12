"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  groepeerDagen,
  pastVoertuig,
  toon,
  totalen,
} from "@/lib/roadtrip/regels.mjs";
import { GeenToken, heeftToken, meldGewijzigd, schrijf } from "./api";
import { useLive } from "./useLive";
import { useReis } from "./useReis";
import TokenVak from "./TokenVak";
import Dagdetail from "./Dagdetail";
import StopFormulier from "./StopFormulier";
import StopRegel from "./StopRegel";
import ReisInstellingen from "./ReisInstellingen";
import Acties from "./Acties";
import {
  Omlaag,
  PijlTerug,
  Plus,
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

const REISSTATUS = [
  ["idee", "Idee"],
  ["gepland", "Gepland"],
  ["geweest", "Geweest"],
];

const TABS = [
  { id: "dagen", naam: "Dagen" },
  { id: "praktisch", naam: "Praktisch" },
];

const datumVanDag = (van, nr, opties = {}) => {
  if (!van || !nr) return null;
  const d = new Date(`${van}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (nr - 1));
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: opties.kort ? undefined : "long",
    timeZone: "UTC",
  });
};

// "Dag 4 t/m 6 · wo 7 t/m vr 9 juli" als je blijft staan, anders gewoon "Dag 1"
const dagTitel = (dag, van) => {
  const meer = dag.tot > dag.nr;
  const nummers = meer ? `Dag ${dag.nr} t/m ${dag.tot}` : `Dag ${dag.nr}`;
  const start = datumVanDag(van, dag.nr, { kort: meer });
  if (!start) return nummers;
  const eind = meer ? datumVanDag(van, dag.tot) : null;
  return eind ? `${nummers} · ${start} t/m ${eind}` : `${nummers} · ${start}`;
};

export default function Reis({ begin, etappes = {} }) {
  const router = useRouter();
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
  const [openStop, setOpenStop] = useState(null);
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

  const wijzigReis = async (velden) => {
    const { versie } = await schrijf("/api/roadtrip/reizen", {
      method: "PATCH",
      body: { slug: reis.slug, ...velden },
    });
    meldGewijzigd(versie);
    await reisData.herlaad();
    return true;
  };

  const verwijderReis = () =>
    metToken(async () => {
      const { versie } = await schrijf(
        `/api/roadtrip/reizen?slug=${encodeURIComponent(reis.slug)}`,
        { method: "DELETE" }
      );
      meldGewijzigd(versie);
      router.push("/roadtrip");
      return true;
    });

  const { dagen } = groepeerDagen(stops);
  const telling = totalen(stops);

  // Nummers lopen door over de overnachtingen heen: een pin op de kaart is een
  // plek waar je echt staat, geen los idee.
  const nummers = new Map();
  let teller = 0;
  for (const dag of dagen) {
    for (const stop of dag.stops) {
      if (stop.soort === "overnachting") nummers.set(stop.id, ++teller);
    }
  }

  return (
    <div className="raam">
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
            <h1>{reis.naam}</h1>

            <Acties
              label="Acties voor deze reis"
              items={[
                {
                  naam: instellingen ? "Sluiten" : "Aanpassen",
                  doe: () => setInstellingen((b) => !b),
                },
                { scheiding: true },
                ...REISSTATUS.map(([id, naam]) => ({
                  naam,
                  nu: reis.status === id,
                  uit: reis.status === id,
                  doe: () => metToken(() => wijzigReis({ status: id })),
                })),
                { scheiding: true },
                { naam: "Stop toevoegen", doe: () => setToevoegen(true) },
                { naam: "Reis verwijderen", gevaar: true, doe: () => verwijderReis() },
              ]}
            />
          </div>

          <p className="kerncijfers">
            {telling.nachten} {telling.nachten === 1 ? "nacht" : "nachten"} ·{" "}
            {euro(telling.kosten) ?? "€ 0"} ·{" "}
            <span className={telling.geboekt === telling.overnachtingen ? "af" : undefined}>
              {telling.geboekt} van {telling.overnachtingen} geboekt
            </span>
          </p>

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

            {!mag && !vraagToken ? (
              <p className="kijkmodus">
                Je kijkt mee. Om te bewerken heb je het token nodig.{" "}
                <button type="button" className="alsLink" onClick={() => setVraagToken(true)}>
                  Token invoeren
                </button>
              </p>
            ) : null}

            {melding ? <p className="melding">{melding}</p> : null}
            {vraagToken ? <TokenVak onOpgeslagen={naToken} /> : null}

            {instellingen ? (
              <ReisInstellingen
                reis={reis}
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
                {dagen.length === 0 ? (
                  <p className="leeg">Nog geen dagen ingepland.</p>
                ) : null}

                {dagen.map((dag) => {
                  const uit = open === dag.nr;
                  const titel = dagTitel(dag, reis.van);
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
                          {dag.tot > dag.nr ? `–${dag.tot}` : ""}
                        </span>
                        <span className="waar">
                          {dag.overnachting ? dag.overnachting.naam : `${dag.stops.length} stops`}
                        </span>
                        {rit ? (
                          <span className="rit">{rit.km.toLocaleString("nl-NL")} km</span>
                        ) : null}
                        <Omlaag />
                      </button>

                      {uit ? (
                        <>
                          <p className="dagregel">
                            {titel}
                            {rit
                              ? ` · ${rit.km.toLocaleString("nl-NL")} km rijden, ${Math.floor(
                                  rit.minuten / 60
                                )}u${String(rit.minuten % 60).padStart(2, "0")}${
                                  rit.schatting ? " (schatting)" : ""
                                }`
                              : " · blijven staan"}
                          </p>
                          {dag.stops.map((stop) => (
                            <StopRegel
                              key={stop.id}
                              stop={stop}
                              nummer={nummers.get(stop.id)}
                              voertuig={reis.voertuig}
                              mag={mag}
                              open={openStop === stop.id}
                              bewerken={bewerkStop === stop.id}
                              onToggle={setOpenStop}
                              onBewerk={setBewerkStop}
                              onBewaar={(velden) => metToken(() => bewaarStop(velden))}
                              onWeg={(id) => metToken(() => verwijderStop(id))}
                            />
                          ))}

                          <Dagdetail
                            dag={dag}
                            notitie={notities?.[dag.nr]?.notitie ?? ""}
                            onNotitie={(tekst) => metToken(() => zetDagnotitie(dag.nr, tekst))}
                          />
                        </>
                      ) : null}
                    </div>
                  );
                })}

                <div style={{ marginTop: 18 }}>
                  {toevoegen ? (
                    <StopFormulier
                      onBewaar={(velden) => metToken(() => bewaarStop(velden))}
                      onSluit={() => setToevoegen(false)}
                    />
                  ) : (
                    <button type="button" className="knop stil" onClick={() => setToevoegen(true)}>
                      <Plus />
                      Stop toevoegen
                    </button>
                  )}
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
