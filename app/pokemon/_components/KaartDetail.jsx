"use client";

import { useEffect, useRef, useState } from "react";
import { euro } from "@/lib/pokemon/regels.mjs";
import { bewaarToken, GeenToken } from "./api";
import KaartAfbeelding from "./KaartAfbeelding";

const VELDEN = [
  ["w", "Wantlist"],
  ["b", "Betaald"],
  ["a", "Afgerond"],
];
const LABEL = {
  c: "Cardmarket-trendprijs (Europa)",
  m: "TCGplayer-marktprijs (VS, omgerekend)",
  l: "Laagste aanbod op TCGplayer (VS, omgerekend)",
  v: "Vaste prijs van 5 okt",
};

export const datumKort = (d) =>
  d
    ? new Date(d.length === 10 ? d + "T12:00:00Z" : d).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Amsterdam",
      })
    : "";

const dollar = (c) =>
  "$ " + (c / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Detailvenster van één kaart. Met `onWijzig` (async) zijn de vinkjes te wijzigen; zonder
// token op dit apparaat vraagt het venster erom en probeert het daarna opnieuw.
export default function KaartDetail({ kaart, prijs, fx, reeks, status, onSluit, onWijzig }) {
  const ref = useRef(null);
  const terug = useRef(null); // knop die het venster opende; krijgt na sluiten de focus terug
  const wachtend = useRef(null); // klik die op de token wacht
  const [vraagToken, setVraagToken] = useState(false);
  const [token, setToken] = useState("");
  const [melding, setMelding] = useState("");
  const [bezig, setBezig] = useState(false);

  async function wijzig(veld, aan) {
    setMelding("");
    setBezig(true);
    try {
      await onWijzig(kaart.id, veld, aan);
      setMelding("Opgeslagen");
    } catch (e) {
      if (e instanceof GeenToken) {
        setVraagToken(true);
        wachtend.current = [veld, aan];
      }
      setMelding(e.message);
    } finally {
      setBezig(false);
    }
  }

  async function tokenOpslaan(e) {
    e.preventDefault();
    if (!token.trim()) return;
    bewaarToken(token.trim());
    setToken("");
    setVraagToken(false);
    const klik = wachtend.current;
    wachtend.current = null;
    if (klik) await wijzig(...klik);
  }
  useEffect(() => {
    terug.current = document.activeElement;
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const rij = reeks?.kaarten?.[kaart.id];
  const eersteDag = rij ? reeks.dagen[0] : null;
  const verschil = rij && prijs?.e != null && rij[0] != null ? prijs.e - rij[0] : null;
  const setregel = kaart.s + (kaart.nr ? `, ${kaart.nr}` : "");

  return (
    <dialog
      ref={ref}
      className="detail"
      aria-labelledby="detail-titel"
      onClose={() => {
        onSluit();
        terug.current?.focus?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <div className="detail-binnen">
        <button type="button" className="sluit" onClick={() => ref.current.close()} aria-label="Sluiten">
          ×
        </button>
        <div className="detail-plaat">
          <KaartAfbeelding key={kaart.img.join()} img={kaart.img} groot alt={`${kaart.n}, ${setregel}`} />
        </div>
        <div className="detail-tekst">
          <h2 id="detail-titel">{kaart.n}</h2>
          <p className="detail-set">{setregel}</p>
          {kaart.map && <span className="mapcode">Map {kaart.map}</span>}
          {kaart.note && <p className="detail-noot">{kaart.note}</p>}

          <div className="detail-prijs">
            {!prijs || prijs.e == null ? (
              <p className="dp-hoofd">
                Geen prijs bekend
              </p>
            ) : (
              <>
                <p className="dp-hoofd">{euro(prijs.e)}</p>
                <p className="dp-label">
                  {LABEL[prijs.t]}
                  {prijs.t === "v" && prijs.vraag ? " (vraagprijs)" : ""}
                </p>
                {prijs.t === "c" && (
                  <p className="dp-uitleg">
                    Prijs van {datumKort(prijs.d)}
                    {prijs.cm?.low != null && ` · vanaf ${euro(prijs.cm.low)}`}
                    {prijs.cm?.a7 != null && ` · gem. 7 dagen ${euro(prijs.cm.a7)}`}
                    {prijs.cm?.a30 != null && ` · 30 dagen ${euro(prijs.cm.a30)}`}
                  </p>
                )}
                {(prijs.t === "m" || prijs.t === "l") && prijs.u != null && fx && (
                  <p className="dp-uitleg">
                    {dollar(prijs.u)} × {fx.koers.toLocaleString("nl-NL", { maximumFractionDigits: 4 })} (ECB) ·
                    prijs van {datumKort(prijs.d)} · geen Cardmarket-prijs voor deze kaart of variant
                  </p>
                )}
              </>
            )}
            {prijs?.t === "c" && prijs.us && (
              <p className="dp-cm">
                TCGplayer (VS) <b>{euro(prijs.us.e)}</b>
                {prijs.us.u != null && ` · ${dollar(prijs.us.u)}`}
                {prijs.us.t === "l" ? " (laagste aanbod)" : ""}
              </p>
            )}
            {verschil != null && eersteDag && (
              <p className={`dp-verloop ${verschil > 0 ? "op" : verschil < 0 ? "neer" : ""}`}>
                {verschil > 0 ? "▲" : verschil < 0 ? "▼" : "="} {euro(Math.abs(verschil))} sinds{" "}
                {datumKort(eersteDag)}
                {reeks.geschat?.includes(eersteDag) ? " (geschat)" : ""}
              </p>
            )}
          </div>

          <ul className="statuschips" aria-label="Status">
            {VELDEN.map(([f, label]) => (
              <li key={f}>
                {onWijzig ? (
                  <button
                    type="button"
                    aria-pressed={!!status?.[f]}
                    disabled={bezig}
                    onClick={() => wijzig(f, !status?.[f])}
                  >
                    {status?.[f] ? "✓ " : ""}
                    {label}
                  </button>
                ) : (
                  <span className={status?.[f] ? "aan" : undefined}>
                    {status?.[f] ? "✓ " : ""}
                    {label}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {vraagToken && (
            <form className="detail-token" onSubmit={tokenOpslaan}>
              <label htmlFor="detail-token">Token (wordt op dit apparaat onthouden)</label>
              <div>
                <input
                  id="detail-token"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button type="submit">Opslaan</button>
              </div>
            </form>
          )}
          {melding && (
            <p className="detail-melding" role="status">
              {melding}
            </p>
          )}

          {kaart.tp && (
            <a
              className="extern"
              href={`https://www.tcgplayer.com/product/${kaart.tp}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Bekijk op TCGplayer ↗
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}
