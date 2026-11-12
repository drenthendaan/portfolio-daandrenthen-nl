"use client";

import { useEffect, useState } from "react";

/**
 * Wat er onder een opengeklapte dag staat: de notitie en de dingen die je daar
 * wilt doen. Bezienswaardigheden zijn geen stops op dagniveau — ze horen bij
 * de dag, niet ernaast.
 */
export default function Dagdetail({ dag, notitie, onNotitie, mag }) {
  const [tekst, setTekst] = useState(notitie ?? "");
  const [bewaard, setBewaard] = useState(false);

  // Komt er van elders een nieuwe notitie binnen, dan die tonen — tenzij je
  // zelf aan het typen bent (dan wijkt tekst af van wat er stond)
  useEffect(() => {
    setTekst(notitie ?? "");
  }, [notitie]);

  const opslaan = async () => {
    await onNotitie(tekst.trim() || null);
    setBewaard(true);
    setTimeout(() => setBewaard(false), 2000);
  };

  const gewijzigd = (tekst ?? "") !== (notitie ?? "");

  return (
    <div className="dagdetail">
      <h4>Notitie</h4>
      {mag ? (
        <>
          <textarea
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder="Bijvoorbeeld: receptie sluit om 20:00, brood halen onderweg."
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <button type="button" className="knop klein" onClick={opslaan} disabled={!gewijzigd}>
              Notitie opslaan
            </button>
            {bewaard ? <span className="verbinding">Opgeslagen</span> : null}
          </div>
        </>
      ) : (
        <p>{notitie || "Nog geen notitie."}</p>
      )}

      {dag.rest.length ? (
        <>
          <h4>Hier willen we heen</h4>
          <ul className="heenlijst">
            {dag.rest.map((stop) => (
              <li key={stop.id}>
                <span className="bol" />
                <span className="naam">
                  <strong>{stop.naam}</strong>
                  {stop.notitie ? ` · ${stop.notitie}` : ""}
                </span>
                {stop.prijs ? (
                  <span style={{ color: "var(--zacht)", fontVariantNumeric: "tabular-nums" }}>
                    € {(stop.prijs / 100).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
