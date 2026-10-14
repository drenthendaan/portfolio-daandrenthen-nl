"use client";

import { useEffect, useRef, useState } from "react";
import { bewaarToken, GeenToken, leesToken } from "./api";

// Venster om een nieuwe, lege verzameling aan te maken. Na aanmaken: onKlaar(verzameling)
export default function NieuweVerzameling({ maak, onKlaar, onSluit }) {
  const ref = useRef(null);
  const terug = useRef(null);
  const [naam, setNaam] = useState("");
  const [heeftToken, setHeeftToken] = useState(true);
  const [token, setToken] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    terug.current = document.activeElement;
    setHeeftToken(!!leesToken());
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  async function aanmaken(e) {
    e.preventDefault();
    setFout("");
    if (!naam.trim()) return setFout("Geef de verzameling een naam.");
    if (!heeftToken) {
      if (!token.trim()) return setFout("Voer je token in om aan te maken.");
      bewaarToken(token.trim());
      setHeeftToken(true);
    }
    setBezig(true);
    try {
      const verzameling = await maak(naam.trim());
      onKlaar(verzameling);
    } catch (err) {
      if (err instanceof GeenToken) setHeeftToken(false);
      setFout(err.message);
      setBezig(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="detail itemvenster"
      aria-labelledby="nv-titel"
      onClose={() => {
        onSluit();
        terug.current?.focus?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <form className="iv" onSubmit={aanmaken} noValidate>
        <button type="button" className="sluit" onClick={() => ref.current.close()} aria-label="Sluiten">
          ×
        </button>
        <h2 id="nv-titel">Nieuwe verzameling</h2>
        <p className="iv-hint">
          Begint leeg. Daarna voeg je kaarten, ETB&apos;s en andere items toe en geef je ze een thema.
        </p>
        <label>
          Naam
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            maxLength={60}
            placeholder="bijv. Eevee-verzameling"
            autoFocus
          />
        </label>
        {!heeftToken && (
          <label>
            Token (wordt op dit apparaat onthouden)
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
        )}
        {fout && (
          <p className="iv-fout" role="alert">
            {fout}
          </p>
        )}
        <div className="iv-knoppen">
          <button type="submit" className="primair" disabled={bezig}>
            {bezig ? "Bezig…" : "Aanmaken"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
