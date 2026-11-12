"use client";

import { useEffect, useState } from "react";
import { Plus } from "./iconen";

/**
 * De notitie onder een opengeklapte dag. De stops van die dag staan erboven als
 * eigen regels met hun eigen actiemenu, dus die herhalen we hier niet.
 * Het token wordt pas gevraagd als je daadwerkelijk opslaat.
 */
export default function Dagdetail({ notitie, onNotitie }) {
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

  return (
    <div className="dagdetail">
      {heeftNotitie || schrijven ? (
        <>
          <h4>Notitie</h4>
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
        <button type="button" className="knop stil klein" onClick={() => setSchrijven(true)}>
          <Plus size={14} />
          Notitie
        </button>
      )}
    </div>
  );
}
