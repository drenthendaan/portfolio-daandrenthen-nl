"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { REISSTATUSSEN, aantalDagen, euro, miniRoute, totalen } from "@/lib/roadtrip/regels.mjs";
import { GeenToken, heeftToken, meldGewijzigd, schrijf } from "./_components/api";
import { useLive } from "./_components/useLive";
import Modal from "./_components/Modal";
import TokenVak from "./_components/TokenVak";
import { Pijl, Plus } from "./_components/iconen";

const GROEPEN = [
  { status: "gepland", titel: "Gepland" },
  { status: "idee", titel: "Ideeën" },
  { status: "geweest", titel: "Geweest" },
];

const datumkort = (d) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", timeZone: "UTC" }) : null;

function Schets({ stops, status }) {
  const punten = miniRoute(stops);
  const kleur = status === "geweest" ? "var(--diep)" : status === "idee" ? "var(--idee)" : "var(--accent)";

  return (
    <svg
      viewBox="0 0 132 86"
      width="132"
      height="86"
      style={{ flex: "0 0 auto", borderRadius: 6, background: "#e9ebec" }}
      aria-hidden="true"
    >
      <rect width="132" height="86" fill="#e9ebec" />
      <path d="M0 0h132v30c-24 10-40-6-66 2S30 48 0 38z" fill="#dfe4de" />
      <path d="M0 62c22-6 34 8 56 2s40-18 62-10v32H0z" fill="#d4dde2" />
      {punten ? (
        <>
          <polyline
            points={punten.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke={kleur}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={status === "idee" ? "1 5" : undefined}
          />
          {punten.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#ffffff"
              stroke={kleur}
              strokeWidth="2"
            />
          ))}
        </>
      ) : null}
    </svg>
  );
}

function Reisrij({ reis, stops }) {
  // Loopt het adres dood, dan vallen we terug op het routeschetsje
  const [fotoStuk, setFotoStuk] = useState(false);
  const foto = useRef(null);

  // De server rendert het plaatje mee, dus de browser begint er al aan voordat
  // React er is. Mislukt het in dat gaatje, dan komt onError nooit meer langs —
  // daarom hier zelf nog even kijken of er werkelijk iets geladen is.
  useEffect(() => {
    const el = foto.current;
    if (el?.complete && el.naturalWidth === 0) setFotoStuk(true);
  }, [reis.afbeelding]);

  const telling = totalen(stops);
  const dagen = aantalDagen(reis.van, reis.tot);
  const plaatsen = stops
    .map((s) => s.naam)
    .slice(0, 5)
    .join(" · ");

  const meta = [
    reis.van && reis.tot ? `${datumkort(reis.van)} – ${datumkort(reis.tot)}` : "nog geen datums",
    dagen ? `${dagen} dagen` : null,
    stops.length ? `${stops.length} stops` : null,
    telling.kosten ? `${euro(telling.kosten)} aan plekken` : null,
  ].filter(Boolean);

  return (
    <Link className="reisrij" href={`/roadtrip/${reis.slug}`}>
      {reis.afbeelding && !fotoStuk ? (
        // Het adres komt van buiten, dus het kan doodlopen. Dan het schetsje weer.
        <img
          className="reisfoto"
          ref={foto}
          src={reis.afbeelding}
          alt=""
          width={132}
          height={86}
          loading="lazy"
          onError={() => setFotoStuk(true)}
        />
      ) : (
        <Schets stops={stops} status={reis.status} />
      )}
      <div className="tekst">
        <h3>{reis.naam}</h3>
        <p className="meta">{meta.join(" · ")}</p>
        {plaatsen ? <p className="plaatsen">{plaatsen}</p> : null}
      </div>
      <div className="rechts">
        {telling.plekken ? (
          <span className={`stand ${telling.betaald === telling.plekken ? "betaald" : "open"}`}>
            <span className="bol" />
            {telling.betaald} van {telling.plekken} betaald
          </span>
        ) : (
          <span className="stand idee">
            <span className="bol" />
            Nog leeg
          </span>
        )}
        <Pijl />
      </div>
    </Link>
  );
}

function NieuweReis({ onGemaakt, onFout, onSluit }) {
  const [naam, setNaam] = useState("");
  const [vervoer, setVervoer] = useState("camper");
  const [van, setVan] = useState("");
  const [tot, setTot] = useState("");
  const [lengte, setLengte] = useState("");
  const [hoogte, setHoogte] = useState("");
  const [gewicht, setGewicht] = useState("");
  const [bezig, setBezig] = useState(false);

  const verstuur = async (e) => {
    e.preventDefault();
    if (!naam.trim() || bezig) return;
    setBezig(true);
    try {
      const body = {
        naam,
        vervoer,
        status: "idee",
        van: van || null,
        tot: tot || null,
        voertuig:
          vervoer === "camper" && (lengte || hoogte || gewicht)
            ? { lengte: lengte || null, hoogte: hoogte || null, gewicht: gewicht || null }
            : null,
      };
      const { reis, versie } = await schrijf("/api/roadtrip/reizen", { body });
      meldGewijzigd(versie);
      onGemaakt(reis);
    } catch (e) {
      onFout(e);
    } finally {
      setBezig(false);
    }
  };

  return (
    <form onSubmit={verstuur}>
      <div className="velden">
        <div>
          <label htmlFor="nr-naam">Naam</label>
          <input
            id="nr-naam"
            type="text"
            required
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="nr-vervoer">Waarmee</label>
          <select id="nr-vervoer" value={vervoer} onChange={(e) => setVervoer(e.target.value)}>
            <option value="camper">Camper</option>
            <option value="auto">Auto</option>
            <option value="motor">Motor</option>
            <option value="vlucht">Vlucht</option>
          </select>
        </div>
        <div>
          <label htmlFor="nr-van">Van</label>
          <input id="nr-van" type="date" value={van} onChange={(e) => setVan(e.target.value)} />
        </div>
        <div>
          <label htmlFor="nr-tot">Tot</label>
          <input id="nr-tot" type="date" value={tot} onChange={(e) => setTot(e.target.value)} />
        </div>
      </div>

      {vervoer === "camper" ? (
        <div style={{ marginTop: 16 }}>
          <p className="uitleg" style={{ margin: "0 0 8px" }}>
            Afmetingen van de camper, in centimeters en kilo&apos;s. We waarschuwen bij
            plekken die niet passen.
          </p>
          <div className="velden">
            <div>
              <label htmlFor="nr-lengte">Lengte (cm)</label>
              <input id="nr-lengte" type="number" value={lengte} onChange={(e) => setLengte(e.target.value)} />
            </div>
            <div>
              <label htmlFor="nr-hoogte">Hoogte (cm)</label>
              <input id="nr-hoogte" type="number" value={hoogte} onChange={(e) => setHoogte(e.target.value)} />
            </div>
            <div>
              <label htmlFor="nr-gewicht">Gewicht (kg)</label>
              <input id="nr-gewicht" type="number" value={gewicht} onChange={(e) => setGewicht(e.target.value)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="modaalknoppen">
        <button type="submit" className="knop" disabled={bezig || !naam.trim()}>
          {bezig ? "Bezig…" : "Aanmaken"}
        </button>
        <button type="button" className="knop stil" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

export default function Overzicht({ begin }) {
  const router = useRouter();
  const [data, setData] = useState(begin);
  const [formulier, setFormulier] = useState(false);
  const [melding, setMelding] = useState(null);
  const [vraagToken, setVraagToken] = useState(false);
  const [mag, setMag] = useState(false);
  const wachtend = useRef(null);
  const { versie, verbinding } = useLive(begin?.versie);
  const versieRef = useRef(begin?.versie ?? null);

  // Nooit tijdens render: dat geeft een hydration mismatch
  useEffect(() => setMag(heeftToken()), []);

  const herlaad = useCallback(async () => {
    try {
      const res = await fetch("/api/roadtrip/reizen", { cache: "no-store" });
      if (!res.ok) return;
      const vers = await res.json();
      versieRef.current = vers.versie;
      setData(vers);
    } catch {
      /* volgende poll probeert het opnieuw */
    }
  }, []);

  useEffect(() => {
    if (versie && versie !== versieRef.current) herlaad();
  }, [versie, herlaad]);

  const toonFout = (e) => {
    if (e instanceof GeenToken) setVraagToken(true);
    setMelding(e.message);
  };

  const naTokenOpslag = () => {
    setVraagToken(false);
    setMag(true);
    setMelding(null);
    const actie = wachtend.current;
    wachtend.current = null;
    actie?.();
  };

  const reizen = data?.reizen ?? [];

  // Op reisvolgorde, anders loopt het routeschetsje kriskras: stops zonder dag
  // (de ideeënlijst) komen achteraan.
  const stopsVan = (slug) =>
    (data?.stops ?? [])
      .filter((s) => s.reis === slug)
      .sort(
        (a, b) =>
          (a.dag ?? Number.MAX_SAFE_INTEGER) - (b.dag ?? Number.MAX_SAFE_INTEGER) ||
          (a.volgorde ?? 0) - (b.volgorde ?? 0)
      );

  return (
    <div className="raam">
      <div className="inhoud">
        <div className="blad">
          <div className="midden">
            <header className="kop">
              <div>
                <h1>Roadtrips</h1>
                <p className="onderkop">
                  {reizen.length === 0
                    ? "Nog geen reizen"
                    : `${reizen.length} ${reizen.length === 1 ? "reis" : "reizen"}`}
                  {verbinding === "weg" ? " · geen verbinding" : ""}
                </p>
              </div>
              <button type="button" className="knop" onClick={() => setFormulier(true)}>
                <Plus />
                Nieuwe roadtrip
              </button>
            </header>

            {formulier ? (
              <Modal titel="Nieuwe roadtrip" onSluit={() => setFormulier(false)} breed>
                <NieuweReis
                  onGemaakt={(reis) => {
                    setFormulier(false);
                    router.push(`/roadtrip/${reis.slug}`);
                  }}
                  onFout={(e) => {
                    if (e instanceof GeenToken) wachtend.current = null;
                    toonFout(e);
                  }}
                  onSluit={() => setFormulier(false)}
                />
              </Modal>
            ) : null}

            {melding ? <p className="melding">{melding}</p> : null}
            {vraagToken ? (
              <Modal titel="Token invoeren" onSluit={() => setVraagToken(false)}>
                <TokenVak onOpgeslagen={naTokenOpslag} />
              </Modal>
            ) : null}

            {reizen.length === 0 ? (
              <p className="leeg">
                Begin met een nieuwe roadtrip. Je kunt datums later invullen.
              </p>
            ) : null}

            {GROEPEN.map(({ status, titel }) => {
              const groep = reizen.filter((r) => r.status === status);
              if (!groep.length) return null;
              return (
                <section key={status}>
                  <h2 className="groepkop">{titel}</h2>
                  {groep.map((reis) => (
                    <Reisrij key={reis.slug} reis={reis} stops={stopsVan(reis.slug)} />
                  ))}
                </section>
              );
            })}

            {reizen.some((r) => !REISSTATUSSEN.includes(r.status)) ? (
              <p className="uitleg" style={{ marginTop: 20 }}>
                Eén of meer reizen hebben een onbekende status en staan hierboven niet.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
