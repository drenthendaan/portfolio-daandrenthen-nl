"use client";

import { useEffect, useRef, useState } from "react";
import { euro, itemPrijs } from "@/lib/pokemon/regels.mjs";
import { binderVan } from "@/lib/pokemon/binders.mjs";
import { themasVoor } from "@/lib/pokemon/themas.mjs";
import { bewaarToken, GeenToken, leesToken } from "./api";
import KaartAfbeelding from "./KaartAfbeelding";
import { datumKort } from "./KaartDetail";

const PRIJSSOORT = {
  m: "TCGplayer-marktprijs",
  l: "laagste aanbod op TCGplayer",
  h: "eigen waarde",
  o: "geen prijs bekend",
};
const NIEUW_LABEL = "__nieuw";
const NIEUW_THEMA = "__nieuw_thema";

// Centen → "60,50" voor in een invoerveld
const alsInvoer = (c) =>
  c == null ? "" : (c / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

// Toevoegen (item = null) of bewerken van een zelf toegevoegd item.
//   acties: { bewaar, verwijder, maakLabel, wijzigVerzameling } uit useItems
//   standaard: { label, verzameling, thema } voor een nieuw item
export default function ItemVenster({ item, labels, verzamelingen = [], standaard, fx, prijzen, acties, onSluit }) {
  const nieuw = !item;
  const ref = useRef(null);
  const terug = useRef(null);
  const zoekNr = useRef(0);

  const [zoekterm, setZoekterm] = useState("");
  const [resultaten, setResultaten] = useState([]);
  const [zoekt, setZoekt] = useState(false);
  const [gekozen, setGekozen] = useState(null);
  const [handmatig, setHandmatig] = useState(false);

  const [naam, setNaam] = useState(item?.naam ?? "");
  const [label, setLabel] = useState(item?.label ?? standaard?.label ?? "etb");
  const [labelVast, setLabelVast] = useState(!!item || !!standaard?.label);
  const [nieuwLabel, setNieuwLabel] = useState("");
  const [verzameling, setVerzameling] = useState(item?.verzameling ?? standaard?.verzameling ?? "");
  const [thema, setThema] = useState(item?.thema ?? standaard?.thema ?? "");
  const [themaVast, setThemaVast] = useState(!!(item?.thema || standaard?.thema));
  const [nieuwThema, setNieuwThema] = useState("");
  const [map, setMap] = useState(item?.map ?? "");
  const [aantal, setAantal] = useState(String(item?.aantal ?? 1));
  const [aankoop, setAankoop] = useState(alsInvoer(item?.aankoop));
  const [waarde, setWaarde] = useState(alsInvoer(item?.waarde));
  const [status, setStatus] = useState(item?.status ?? { b: false, a: true });

  const [heeftToken, setHeeftToken] = useState(true);
  const [token, setToken] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    terug.current = document.activeElement;
    setHeeftToken(!!leesToken());
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  // Zoeken in de TCGplayer-catalogus, 300 ms na het laatste toetsaanslag
  useEffect(() => {
    if (!nieuw || gekozen || handmatig) return;
    const q = zoekterm.trim();
    if (q.length < 2) {
      setResultaten([]);
      setZoekt(false);
      return;
    }
    setZoekt(true);
    const nr = ++zoekNr.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pokemon/zoek?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (nr === zoekNr.current) setResultaten(data.resultaten || []);
      } catch {
        if (nr === zoekNr.current) setResultaten([]);
      } finally {
        if (nr === zoekNr.current) setZoekt(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [zoekterm, nieuw, gekozen, handmatig]);

  const koers = fx?.koers ?? 0.88;
  const indicatie = (usd) => (usd ? "± " + euro(Math.round(usd * koers)) : "geen prijs");

  function kies(r) {
    setGekozen(r);
    setNaam(r.naam);
    if (!labelVast) setLabel(r.soort);
    if (!themaVast) setThema(r.thema ?? "");
  }

  // Thema's van de gekozen verzameling, met een voorstel als je zelf nog niets koos
  const gekozenVerzameling = verzamelingen.find((v) => v.id === verzameling) ?? null;
  const themaLijst = gekozenVerzameling ? themasVoor(gekozenVerzameling) : [];
  const binder = binderVan(gekozenVerzameling);
  const voorstel = gekozen?.thema ?? (label === "etb" ? "etb" : "overig");
  const themaWaarde =
    thema === NIEUW_THEMA || themaLijst.some((t) => t.id === thema) ? thema : themaLijst.some((t) => t.id === voorstel) ? voorstel : "overig";

  // De eerste wijziging op dit apparaat: bewaar de ingevulde token. Geeft false als er
  // nog geen token is, met een melding.
  function zorgVoorToken(actie) {
    if (heeftToken) return true;
    if (!token.trim()) {
      setFout(`Voer je token in om ${actie}.`);
      return false;
    }
    bewaarToken(token.trim());
    setHeeftToken(true);
    return true;
  }

  async function opslaan(e) {
    e.preventDefault();
    setFout("");
    if (!zorgVoorToken("op te slaan")) return;
    if (!naam.trim()) return setFout("Geef het item een naam.");
    if (label === NIEUW_LABEL && !nieuwLabel.trim()) return setFout("Geef het nieuwe label een naam.");
    if (verzameling && themaWaarde === NIEUW_THEMA && !nieuwThema.trim()) return setFout("Geef het nieuwe thema een naam.");
    setBezig(true);
    try {
      let labelId = label;
      if (label === NIEUW_LABEL) labelId = (await acties.maakLabel(nieuwLabel.trim())).id;
      let themaId = verzameling ? themaWaarde : null;
      if (themaId === NIEUW_THEMA) {
        themaId = (await acties.wijzigVerzameling(verzameling, { nieuwThema: nieuwThema.trim() })).thema.id;
      }
      const invoer = {
        naam: naam.trim(),
        label: labelId,
        verzameling: verzameling || null,
        thema: themaId,
        map: verzameling ? map.trim() : null,
        aantal: Number(aantal),
        aankoop,
        status,
      };
      if (nieuw && gekozen) invoer.product = gekozen.product;
      else if (!item?.tp) invoer.waarde = waarde;
      await acties.bewaar(invoer, item?.id);
      ref.current?.close();
    } catch (err) {
      if (err instanceof GeenToken) setHeeftToken(false);
      setFout(err.message);
    } finally {
      setBezig(false);
    }
  }

  async function verwijderen() {
    setFout("");
    if (!zorgVoorToken("te verwijderen")) return;
    if (!window.confirm(`"${item.naam}" verwijderen?`)) return;
    setBezig(true);
    try {
      await acties.verwijder(item.id);
      ref.current?.close();
    } catch (err) {
      if (err instanceof GeenToken) setHeeftToken(false);
      setFout(err.message);
      setBezig(false);
    }
  }

  // Huidige prijs van een bestaand item
  const prijs = item ? itemPrijs(item, prijzen) : null;
  const n = Number(aantal) || 1;
  const winst = prijs?.e != null && item?.aankoop != null ? (prijs.e - item.aankoop) * (item.aantal || 1) : null;
  const toonVelden = !nieuw || gekozen || handmatig;
  const product = gekozen ?? (item?.tp ? item : null);

  return (
    <dialog
      ref={ref}
      className="detail itemvenster"
      aria-labelledby="iv-titel"
      onClose={() => {
        onSluit();
        terug.current?.focus?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <form className="iv" onSubmit={opslaan} noValidate>
        <button type="button" className="sluit" onClick={() => ref.current.close()} aria-label="Sluiten">
          ×
        </button>
        <h2 id="iv-titel">{nieuw ? "Item toevoegen" : item.naam}</h2>

        {nieuw && !gekozen && !handmatig && (
          <div className="iv-zoek">
            <label htmlFor="iv-q">Zoek in TCGplayer</label>
            <input
              id="iv-q"
              type="search"
              autoComplete="off"
              placeholder="Bijv. prismatic etb of pikachu 151"
              value={zoekterm}
              onChange={(e) => setZoekterm(e.target.value)}
              autoFocus
            />
            {resultaten.length > 0 && (
              <ul className="iv-resultaten">
                {resultaten.map((r) => (
                  <li key={r.product}>
                    <button type="button" onClick={() => kies(r)}>
                      <span className="iv-mini">
                        <KaartAfbeelding key={r.img.join()} img={r.img} />
                      </span>
                      <span className="iv-tekst">
                        <b>{r.naam}</b>
                        <small>
                          {r.set}
                          {r.nummer ? ` · ${r.nummer}` : ""}
                        </small>
                      </span>
                      <span className="iv-prijs">{indicatie(r.usd)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="iv-hint" aria-live="polite">
              {zoekt
                ? "Zoeken…"
                : zoekterm.trim().length >= 2 && !resultaten.length
                  ? "Niets gevonden."
                  : ""}
            </p>
            <button type="button" className="iv-link" onClick={() => setHandmatig(true)}>
              Niet gevonden? Zelf invullen
            </button>
          </div>
        )}

        {product && (
          <div className="iv-product">
            <span className="iv-plaat">
              <KaartAfbeelding key={product.img.join()} img={product.img} groot alt="" />
            </span>
            <div>
              <b>{gekozen ? gekozen.naam : item.naam}</b>
              <small>
                {product.set}
                {product.nummer ? ` · ${product.nummer}` : ""}
              </small>
              {gekozen ? (
                <p>{indicatie(gekozen.usd)} per stuk (TCGplayer)</p>
              ) : (
                prijs && (
                  <p>
                    {euro(prijs.e)} per stuk · {PRIJSSOORT[prijs.t]}
                    {prijs.d ? ` (${datumKort(prijs.d)})` : ""}
                  </p>
                )
              )}
              {nieuw && (
                <button type="button" className="iv-link" onClick={() => setGekozen(null)}>
                  Ander product kiezen
                </button>
              )}
            </div>
          </div>
        )}

        {!nieuw && !item.tp && prijs && (
          <p className="iv-hint">
            {euro(prijs.e)} per stuk · {PRIJSSOORT[prijs.t]}
          </p>
        )}
        {winst != null && (
          <p className={`iv-winst ${winst >= 0 ? "op" : "neer"}`}>
            {winst >= 0 ? "▲" : "▼"} {euro(Math.abs(winst))} t.o.v. je aankoopprijs
          </p>
        )}

        {toonVelden && (
          <div className="iv-velden">
            <label>
              Naam
              <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={120} required />
            </label>
            {(handmatig || (item && !item.tp)) && (
              <label>
                Waarde per stuk (€)
                <input
                  inputMode="decimal"
                  placeholder="bijv. 49,95"
                  value={waarde}
                  onChange={(e) => setWaarde(e.target.value)}
                />
              </label>
            )}
            <label>
              Label
              <select
                className="keuze"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setLabelVast(true);
                  if (!themaVast && e.target.value === "etb") setThema("etb");
                }}
              >
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.naam}
                  </option>
                ))}
                <option value={NIEUW_LABEL}>+ Nieuw label…</option>
              </select>
            </label>
            {label === NIEUW_LABEL && (
              <label>
                Naam van het nieuwe label
                <input
                  value={nieuwLabel}
                  onChange={(e) => setNieuwLabel(e.target.value)}
                  maxLength={40}
                  placeholder="bijv. Booster boxes"
                />
              </label>
            )}
            <label>
              Verzameling
              <select
                className="keuze"
                value={verzameling}
                onChange={(e) => {
                  setVerzameling(e.target.value);
                  setMap("");
                }}
              >
                <option value="">Geen</option>
                {verzamelingen.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.naam}
                  </option>
                ))}
              </select>
            </label>
            {verzameling && (
              <div className="iv-rij iv-rij-thema">
                <label>
                  Thema
                  <select
                    className="keuze"
                    value={themaWaarde}
                    onChange={(e) => {
                      setThema(e.target.value);
                      setThemaVast(true);
                    }}
                  >
                    {themaLijst.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.kort ?? t.naam}
                      </option>
                    ))}
                    <option value={NIEUW_THEMA}>+ Nieuw thema…</option>
                  </select>
                </label>
                <label>
                  Mapcode
                  <input
                    inputMode="decimal"
                    placeholder="bijv. 3.5"
                    value={map}
                    onChange={(e) => setMap(e.target.value)}
                    maxLength={6}
                  />
                </label>
              </div>
            )}
            {verzameling && (
              <p className="iv-hint">
                {binder
                  ? `Mapcode: pagina 1–${binder.paginas}, vakje 1–${binder.vakjes} (${binder.kort}).`
                  : "Mapcode: pagina.vakje, bijv. 3.5. Kies bij de verzameling een binder om je kaarten in de map te zien."}
              </p>
            )}
            {verzameling && themaWaarde === NIEUW_THEMA && (
              <label>
                Naam van het nieuwe thema
                <input
                  value={nieuwThema}
                  onChange={(e) => setNieuwThema(e.target.value)}
                  maxLength={40}
                  placeholder="bijv. Favorieten"
                />
              </label>
            )}
            <div className="iv-rij">
              <label>
                Aantal
                <input
                  type="number"
                  min="1"
                  max="999"
                  inputMode="numeric"
                  value={aantal}
                  onChange={(e) => setAantal(e.target.value)}
                />
              </label>
              <label>
                Aankoopprijs per stuk (€)
                <input
                  inputMode="decimal"
                  placeholder="optioneel"
                  value={aankoop}
                  onChange={(e) => setAankoop(e.target.value)}
                />
              </label>
            </div>
            <ul className="statuschips" aria-label="Status">
              {[
                ["b", "Betaald"],
                ["a", "Afgerond"],
              ].map(([f, l]) => (
                <li key={f}>
                  <button
                    type="button"
                    aria-pressed={!!status[f]}
                    onClick={() => setStatus((s) => ({ ...s, [f]: !s[f] }))}
                  >
                    {l}
                  </button>
                </li>
              ))}
            </ul>
            {n > 1 && prijs?.e != null && (
              <p className="iv-hint">Samen {euro(prijs.e * n)}</p>
            )}
            {!heeftToken && (
              <label>
                Token (wordt op dit apparaat onthouden)
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </label>
            )}
            {fout && (
              <p className="iv-fout" role="alert">
                {fout}
              </p>
            )}
            <div className="iv-knoppen">
              <button type="submit" className="primair" disabled={bezig}>
                {bezig ? "Bezig…" : nieuw ? "Toevoegen" : "Opslaan"}
              </button>
              {!nieuw && (
                <button type="button" className="gevaar" onClick={verwijderen} disabled={bezig}>
                  Verwijderen
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </dialog>
  );
}
