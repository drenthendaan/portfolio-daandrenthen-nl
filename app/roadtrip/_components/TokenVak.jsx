"use client";

import { useState } from "react";
import { bewaarToken } from "./api";

/**
 * Verschijnt pas als een schrijfactie op een GeenToken-fout stuitte. De actie die
 * mislukte staat geparkeerd bij de aanroeper en loopt door zodra het token klopt.
 */
export default function TokenVak({ onOpgeslagen }) {
  const [waarde, setWaarde] = useState("");

  const verstuur = (e) => {
    e.preventDefault();
    const t = waarde.trim();
    if (!t) return;
    bewaarToken(t);
    setWaarde("");
    onOpgeslagen?.();
  };

  return (
    <form className="tokenvak" onSubmit={verstuur}>
      <label htmlFor="trip-token">
        Token om te mogen bewerken — wordt op dit apparaat onthouden
      </label>
      <div className="rij">
        <input
          id="trip-token"
          type="password"
          autoComplete="off"
          value={waarde}
          onChange={(e) => setWaarde(e.target.value)}
        />
        <button type="submit" className="knop">
          Opslaan
        </button>
      </div>
    </form>
  );
}
