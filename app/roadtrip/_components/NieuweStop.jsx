"use client";

import { useState } from "react";

export default function NieuweStop({ onBewaar, onSluit }) {
  const [naam, setNaam] = useState("");
  const [soort, setSoort] = useState("overnachting");
  const [dag, setDag] = useState("");
  const [nachten, setNachten] = useState("");
  const [prijs, setPrijs] = useState("");
  const [status, setStatus] = useState("gepland");
  const [maxLengte, setMaxLengte] = useState("");
  const [maxHoogte, setMaxHoogte] = useState("");
  const [bezig, setBezig] = useState(false);

  const verstuur = async (e) => {
    e.preventDefault();
    if (!naam.trim() || bezig) return;
    setBezig(true);
    const gelukt = await onBewaar({
      naam,
      soort,
      status,
      dag: dag ? Number(dag) : null,
      nachten: soort === "overnachting" && nachten ? Number(nachten) : null,
      prijs: prijs || null,
      max:
        maxLengte || maxHoogte
          ? { lengte: maxLengte || null, hoogte: maxHoogte || null, gewicht: null }
          : null,
    });
    setBezig(false);
    if (gelukt) {
      setNaam("");
      setPrijs("");
      setMaxLengte("");
      setMaxHoogte("");
      onSluit?.();
    }
  };

  return (
    <form
      onSubmit={verstuur}
      style={{
        padding: 18,
        background: "var(--papier)",
        border: "1px solid var(--lijn)",
        borderRadius: 12,
      }}
    >
      <div className="velden">
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ns-naam">Naam</label>
          <input id="ns-naam" type="text" value={naam} onChange={(e) => setNaam(e.target.value)} autoFocus />
        </div>
        <div>
          <label htmlFor="ns-soort">Soort</label>
          <select id="ns-soort" value={soort} onChange={(e) => setSoort(e.target.value)}>
            <option value="overnachting">Overnachting</option>
            <option value="bezienswaardigheid">Bezienswaardigheid</option>
            <option value="servicepunt">Servicepunt</option>
          </select>
        </div>
        <div>
          <label htmlFor="ns-dag">Dag</label>
          <input
            id="ns-dag"
            type="number"
            min="1"
            placeholder="leeg = idee"
            value={dag}
            onChange={(e) => setDag(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ns-status">Status</label>
          <select id="ns-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="idee">Idee</option>
            <option value="gepland">Gepland</option>
            <option value="geboekt">Geboekt</option>
          </select>
        </div>
        {soort === "overnachting" ? (
          <div>
            <label htmlFor="ns-nachten">Nachten</label>
            <input id="ns-nachten" type="number" min="1" value={nachten} onChange={(e) => setNachten(e.target.value)} />
          </div>
        ) : null}
        <div>
          <label htmlFor="ns-prijs">Prijs</label>
          <input id="ns-prijs" type="text" placeholder="46" value={prijs} onChange={(e) => setPrijs(e.target.value)} />
        </div>
      </div>

      {soort === "overnachting" ? (
        <div style={{ marginTop: 14 }}>
          <p className="uitleg" style={{ margin: "0 0 8px" }}>
            Maxima van deze plek, in centimeters. Laat leeg als je het niet weet.
          </p>
          <div className="velden">
            <div>
              <label htmlFor="ns-maxl">Max lengte</label>
              <input id="ns-maxl" type="number" value={maxLengte} onChange={(e) => setMaxLengte(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ns-maxh">Max hoogte</label>
              <input id="ns-maxh" type="number" value={maxHoogte} onChange={(e) => setMaxHoogte(e.target.value)} />
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button type="submit" className="knop" disabled={bezig}>
          {bezig ? "Bezig…" : "Toevoegen"}
        </button>
        <button type="button" className="knop stil" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </form>
  );
}
