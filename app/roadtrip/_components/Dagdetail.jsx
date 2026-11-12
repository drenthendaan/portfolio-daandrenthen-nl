"use client";

import { useEffect, useState } from "react";
import { Plus } from "./iconen";

/**
 * De notitie onder een opengeklapte dag. De stops van die dag staan erboven als
 * eigen regels met hun eigen actiemenu, dus die herhalen we hier niet.
 * Is er geen notitie en mag je niet bewerken, dan tonen we niets.
 */
export default function Dagdetail({ notitie, onNotitie, mag }) {
  const [tekst, setTekst] = useState(notitie ?? "");
  const [bewaard, setBewaard] = useState(false);
  const [schrijven, setSchrijven] = useState(false);

  useEffect(() => {
    setTekst(notitie ?? "");
  }, [notitie]);

  const opslaan = async () => {
    await onNotitie(tekst.trim() || null);
    setBewaard(true);
    setSchrijven(false);
    setTimeout(() => setBewaard(false), 2000);
  };

  const gewijzigd = (tekst ?? "") !== (notitie ?? "");
  const heeftNotitie = !!(notitie ?? "").trim();

  if (!heeftNotitie && !mag) return null;

  return (
    <div className="dagdetail">
      {heeftNotitie || schrijven ? (
        <>
          <h4>Notitie</h4>
          {mag ? (
            <>
              <textarea
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                placeholder="Bijvoorbeeld: receptie sluit om 20:00, brood halen onderweg."
                autoFocus={schrijven}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <button type="button" className="knop klein" onClick={opslaan} disabled={!gewijzigd}>
                  Opslaan
                </button>
                {bewaard ? <span className="verbinding">Opgeslagen</span> : null}
              </div>
            </>
          ) : (
            <p>{notitie}</p>
          )}
        </>
      ) : (
        <button type="button" className="knop stil klein" onClick={() => setSchrijven(true)}>
          <Plus size={14} />
          Notitie
        </button>
      )}
    </div>
  );
}
