"use client";

import { useEffect, useState } from "react";
import { pastVoertuig } from "@/lib/roadtrip/regels.mjs";
import { Omlaag, Waarschuwing } from "./iconen";
import Acties from "./Acties";

const STATUSNAAM = { idee: "Idee", gepland: "Gepland", geboekt: "Geboekt" };

const euro = (centen) =>
  centen === null || centen === undefined
    ? null
    : `€ ${(centen / 100).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;

const uitStop = (stop) => ({
  naam: stop.naam ?? "",
  soort: stop.soort ?? "overnachting",
  status: stop.status ?? "gepland",
  dag: stop.dag ?? "",
  nachten: stop.nachten ?? "",
  prijs: stop.prijs ? String(stop.prijs / 100).replace(".", ",") : "",
  adres: stop.adres ?? "",
  notitie: stop.notitie ?? "",
  lat: stop.lat ?? "",
  lon: stop.lon ?? "",
  maxLengte: stop.max?.lengte ?? "",
  maxHoogte: stop.max?.hoogte ?? "",
});

/**
 * Eén stop in de lijst. Dicht: speld, naam, prijs. Open: alle velden meteen
 * bewerkbaar — geen apart formulier en geen menu, want wat je wilt doen staat
 * er al. Alleen lezen als je geen token hebt.
 */
export default function StopRegel({ stop, nummer, voertuig, mag, open, onToggle, onBewaar, onWeg }) {
  const [v, setV] = useState(() => uitStop(stop));
  const [bezig, setBezig] = useState(false);
  const [zekerWeten, setZekerWeten] = useState(false);

  // Wijzigt de stop elders (ander tabblad), dan die waarden overnemen zolang
  // je dit veld niet zelf openstaan hebt
  useEffect(() => {
    if (!open) setV(uitStop(stop));
  }, [stop, open]);

  const zet = (veld) => (e) => setV((oud) => ({ ...oud, [veld]: e.target.value }));
  const uitslag = pastVoertuig(stop.max, voertuig);

  const sub = [
    stop.nachten ? `${stop.nachten} ${stop.nachten === 1 ? "nacht" : "nachten"}` : null,
    stop.adres,
  ]
    .filter(Boolean)
    .join(" · ");

  const bewaar = async (e) => {
    e.preventDefault();
    if (!v.naam.trim() || bezig) return;
    setBezig(true);
    const gelukt = await onBewaar({
      id: stop.id,
      naam: v.naam,
      soort: v.soort,
      status: v.status,
      dag: v.dag === "" ? null : Number(v.dag),
      nachten: v.soort === "overnachting" && v.nachten !== "" ? Number(v.nachten) : null,
      prijs: v.prijs === "" ? null : v.prijs,
      adres: v.adres || null,
      notitie: v.notitie || null,
      lat: v.lat === "" ? null : Number(v.lat),
      lon: v.lon === "" ? null : Number(v.lon),
      max:
        v.maxLengte !== "" || v.maxHoogte !== ""
          ? { lengte: v.maxLengte || null, hoogte: v.maxHoogte || null, gewicht: null }
          : null,
    });
    setBezig(false);
    if (gelukt) onToggle(null);
  };

  const weg = async () => {
    if (!zekerWeten) return setZekerWeten(true);
    setBezig(true);
    await onWeg(stop.id);
    setBezig(false);
  };

  return (
    <div className={`stop${open ? " open" : ""}`}>
      <div className="stopbalk">
        <button
          type="button"
          className="stoptoggle"
          aria-expanded={open}
          onClick={() => onToggle(open ? null : stop.id)}
        >
          <span
            className={`pin ${stop.status}${stop.soort === "overnachting" ? "" : " stip"}`}
            title={STATUSNAAM[stop.status] ?? stop.status}
          >
            {nummer ?? ""}
          </span>
          <span className="naam">
            {stop.naam}
            {sub ? <small>{sub}</small> : null}
          </span>
          {stop.prijs ? <span className="prijs">{euro(stop.prijs)}</span> : null}
          <Omlaag />
        </button>

        {mag ? (
          <Acties
            label={`Acties voor ${stop.naam}`}
            items={[
              { naam: open ? "Sluiten" : "Bewerken", doe: () => onToggle(open ? null : stop.id) },
              { scheiding: true },
              ...Object.entries(STATUSNAAM).map(([id, naam]) => ({
                naam,
                nu: stop.status === id,
                uit: stop.status === id,
                doe: () => onBewaar({ id: stop.id, status: id }),
              })),
              { scheiding: true },
              stop.dag
                ? { naam: "Terug naar de lijst", doe: () => onBewaar({ id: stop.id, dag: null }) }
                : { naam: "Aan een dag koppelen", doe: () => onToggle(stop.id) },
              { naam: "Verwijderen", gevaar: true, doe: () => onWeg(stop.id) },
            ]}
          />
        ) : null}
      </div>

      {!uitslag.past && !open ? (
        <p className="past-niet">
          <Waarschuwing /> Past niet
          {uitslag.problemen.map((p) => (
            <span key={p.veld}>{p.tekst}</span>
          ))}
        </p>
      ) : null}

      {open ? (
        mag ? (
          <form className="stopvelden" onSubmit={bewaar}>
            <div className="velden">
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor={`n-${stop.id}`}>Naam</label>
                <input id={`n-${stop.id}`} type="text" value={v.naam} onChange={zet("naam")} />
              </div>
              <div>
                <label htmlFor={`so-${stop.id}`}>Soort</label>
                <select id={`so-${stop.id}`} value={v.soort} onChange={zet("soort")}>
                  <option value="overnachting">Overnachting</option>
                  <option value="bezienswaardigheid">Bezienswaardigheid</option>
                  <option value="servicepunt">Servicepunt</option>
                </select>
              </div>
              <div>
                <label htmlFor={`st-${stop.id}`}>Status</label>
                <select id={`st-${stop.id}`} value={v.status} onChange={zet("status")}>
                  <option value="idee">Idee</option>
                  <option value="gepland">Gepland</option>
                  <option value="geboekt">Geboekt</option>
                </select>
              </div>
              <div>
                <label htmlFor={`d-${stop.id}`}>Dag</label>
                <input
                  id={`d-${stop.id}`}
                  type="number"
                  min="1"
                  placeholder="geen"
                  value={v.dag}
                  onChange={zet("dag")}
                />
              </div>
              {v.soort === "overnachting" ? (
                <div>
                  <label htmlFor={`na-${stop.id}`}>Nachten</label>
                  <input id={`na-${stop.id}`} type="number" min="1" value={v.nachten} onChange={zet("nachten")} />
                </div>
              ) : null}
              <div>
                <label htmlFor={`p-${stop.id}`}>Prijs</label>
                <input id={`p-${stop.id}`} type="text" value={v.prijs} onChange={zet("prijs")} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor={`a-${stop.id}`}>Adres</label>
                <input id={`a-${stop.id}`} type="text" value={v.adres} onChange={zet("adres")} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor={`no-${stop.id}`}>Notitie</label>
                <input id={`no-${stop.id}`} type="text" value={v.notitie} onChange={zet("notitie")} />
              </div>
              <div>
                <label htmlFor={`la-${stop.id}`}>Breedtegraad</label>
                <input id={`la-${stop.id}`} type="text" value={v.lat} onChange={zet("lat")} />
              </div>
              <div>
                <label htmlFor={`lo-${stop.id}`}>Lengtegraad</label>
                <input id={`lo-${stop.id}`} type="text" value={v.lon} onChange={zet("lon")} />
              </div>
              {v.soort === "overnachting" ? (
                <>
                  <div>
                    <label htmlFor={`ml-${stop.id}`}>Max lengte</label>
                    <input id={`ml-${stop.id}`} type="number" value={v.maxLengte} onChange={zet("maxLengte")} />
                  </div>
                  <div>
                    <label htmlFor={`mh-${stop.id}`}>Max hoogte</label>
                    <input id={`mh-${stop.id}`} type="number" value={v.maxHoogte} onChange={zet("maxHoogte")} />
                  </div>
                </>
              ) : null}
            </div>

            {!uitslag.past ? (
              <p className="past-niet">
                <Waarschuwing /> Past niet
                {uitslag.problemen.map((p) => (
                  <span key={p.veld}>{p.tekst}</span>
                ))}
              </p>
            ) : null}

            <div className="stopknoppen">
              <button type="submit" className="knop klein" disabled={bezig}>
                {bezig ? "Bezig…" : "Opslaan"}
              </button>
              <button type="button" className="knop stil klein" onClick={() => onToggle(null)}>
                Sluiten
              </button>
              <button type="button" className="knop gevaar klein" onClick={weg} disabled={bezig}>
                {zekerWeten ? "Zeker weten?" : "Verwijderen"}
              </button>
            </div>
          </form>
        ) : (
          <div className="stopvelden">
            <p className="sub">
              {[stop.adres, stop.notitie, STATUSNAAM[stop.status]].filter(Boolean).join(" · ")}
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}
