"use client";

import { useEffect, useState } from "react";
import { euro, pastVoertuig, toon } from "@/lib/roadtrip/regels.mjs";
import { Omlaag, Waarschuwing } from "./iconen";
import Acties from "./Acties";

const STATUSNAAM = { idee: "Idee", gepland: "Gepland", geboekt: "Geboekt" };

const uitStop = (stop) => ({
  naam: stop?.naam ?? "",
  status: stop?.status ?? "gepland",
  dag: stop?.dag ?? "",
  nachten: stop?.nachten ?? "",
  prijs: stop?.prijs ? String(stop.prijs / 100).replace(".", ",") : "",
  adres: stop?.adres ?? "",
  lat: stop?.lat ?? "",
  lon: stop?.lon ?? "",
  maxLengte: stop?.max?.lengte ?? "",
  maxHoogte: stop?.max?.hoogte ?? "",
});

/**
 * Eén dag is één plek. Het kaartje toont dicht waar je staat en hoe ver het
 * rijden is; open staan de gegevens en de notitie. Bewerken via het menu.
 */
export default function DagKaart({
  dag,
  titel,
  rit,
  notitie,
  voertuig,
  open,
  bewerken,
  onToggle,
  onBewerk,
  onBewaar,
  onWeg,
  onNotitie,
}) {
  const stop = dag.anker;
  const [v, setV] = useState(() => uitStop(stop));
  const [tekst, setTekst] = useState(notitie ?? "");
  const [bezig, setBezig] = useState(false);
  const [zekerWeten, setZekerWeten] = useState(false);
  const [bewaard, setBewaard] = useState(false);

  useEffect(() => {
    if (bewerken) setV(uitStop(stop));
  }, [bewerken, stop]);

  useEffect(() => {
    setTekst(notitie ?? "");
  }, [notitie]);

  if (!stop) return null;

  const zet = (veld) => (e) => setV((oud) => ({ ...oud, [veld]: e.target.value }));
  const uitslag = pastVoertuig(stop.max, voertuig);
  const notitieGewijzigd = (tekst ?? "") !== (notitie ?? "");

  const regels = [
    ["Status", STATUSNAAM[stop.status] ?? stop.status],
    stop.nachten ? ["Nachten", `${stop.nachten} ${stop.nachten === 1 ? "nacht" : "nachten"}`] : null,
    stop.prijs ? ["Prijs", euro(stop.prijs)] : null,
    stop.adres ? ["Adres", stop.adres] : null,
    stop.lat != null && stop.lon != null
      ? ["Op de kaart", `${Number(stop.lat).toFixed(4)}, ${Number(stop.lon).toFixed(4)}`]
      : null,
    stop.max?.lengte ? ["Max lengte", toon(stop.max.lengte, "cm")] : null,
    stop.max?.hoogte ? ["Max hoogte", toon(stop.max.hoogte, "cm")] : null,
  ].filter(Boolean);

  const bewaarStop = async (e) => {
    e.preventDefault();
    if (!v.naam.trim() || bezig) return;
    setBezig(true);
    const gelukt = await onBewaar({
      id: stop.id,
      naam: v.naam,
      status: v.status,
      dag: v.dag === "" ? null : Number(v.dag),
      nachten: v.nachten !== "" ? Number(v.nachten) : null,
      prijs: v.prijs === "" ? null : v.prijs,
      adres: v.adres || null,
      lat: v.lat === "" ? null : Number(v.lat),
      lon: v.lon === "" ? null : Number(v.lon),
      max:
        v.maxLengte !== "" || v.maxHoogte !== ""
          ? { lengte: v.maxLengte || null, hoogte: v.maxHoogte || null, gewicht: null }
          : null,
    });
    setBezig(false);
    if (gelukt) onBewerk(null);
  };

  const bewaarNotitie = async () => {
    await onNotitie(tekst.trim() || null);
    setBewaard(true);
    setTimeout(() => setBewaard(false), 2000);
  };

  // Het puntjesmenu vraagt zelf al "Zeker weten?", dus daar mag het direct.
  const wegDirect = async () => {
    setBezig(true);
    await onWeg(stop.id);
    setBezig(false);
  };

  // De knop in het formulier staat alleen, en vraagt het dus zelf.
  const weg = () => (zekerWeten ? wegDirect() : setZekerWeten(true));

  return (
    <div className={`dag${open || bewerken ? " open" : ""}`}>
      <div className="dagbalk">
        <button
          type="button"
          className="dagtoggle"
          aria-expanded={open}
          onClick={() => onToggle(open ? null : dag.nr)}
        >
          <span className="nr">
            Dag {dag.nr}
            {dag.tot > dag.nr ? `–${dag.tot}` : ""}
          </span>
          <span className="waar">{stop.naam}</span>
          {rit ? <span className="rit">{rit.km.toLocaleString("nl-NL")} km</span> : null}
          <span className={`bol ${stop.status}`} title={STATUSNAAM[stop.status]} />
          <Omlaag />
        </button>

        <Acties
          label={`Acties voor dag ${dag.nr}`}
          items={[
            { naam: bewerken ? "Sluiten" : "Bewerken", doe: () => onBewerk(bewerken ? null : dag.nr) },
            { scheiding: true },
            ...Object.entries(STATUSNAAM).map(([id, naam]) => ({
              naam,
              nu: stop.status === id,
              uit: stop.status === id,
              doe: () => onBewaar({ id: stop.id, status: id }),
            })),
            { scheiding: true },
            { naam: "Dag verwijderen", gevaar: true, doe: wegDirect },
          ]}
        />
      </div>

      {!uitslag.past && !open && !bewerken ? (
        <p className="past-niet">
          <Waarschuwing /> Past niet
          {uitslag.problemen.map((p) => (
            <span key={p.veld}>{p.tekst}</span>
          ))}
        </p>
      ) : null}

      {bewerken ? (
        <form className="dagvelden" onSubmit={bewaarStop}>
          <div className="velden">
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor={`n-${stop.id}`}>Waar sta je</label>
              <input id={`n-${stop.id}`} type="text" value={v.naam} onChange={zet("naam")} autoFocus />
            </div>
            <div>
              <label htmlFor={`d-${stop.id}`}>Dag</label>
              <input id={`d-${stop.id}`} type="number" min="1" value={v.dag} onChange={zet("dag")} />
            </div>
            <div>
              <label htmlFor={`na-${stop.id}`}>Nachten</label>
              <input id={`na-${stop.id}`} type="number" min="1" value={v.nachten} onChange={zet("nachten")} />
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
              <label htmlFor={`p-${stop.id}`}>Prijs</label>
              <input id={`p-${stop.id}`} type="text" value={v.prijs} onChange={zet("prijs")} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor={`a-${stop.id}`}>Adres</label>
              <input id={`a-${stop.id}`} type="text" value={v.adres} onChange={zet("adres")} />
            </div>
            <div>
              <label htmlFor={`la-${stop.id}`}>Breedtegraad</label>
              <input id={`la-${stop.id}`} type="text" value={v.lat} onChange={zet("lat")} />
            </div>
            <div>
              <label htmlFor={`lo-${stop.id}`}>Lengtegraad</label>
              <input id={`lo-${stop.id}`} type="text" value={v.lon} onChange={zet("lon")} />
            </div>
            <div>
              <label htmlFor={`ml-${stop.id}`}>Max lengte</label>
              <input id={`ml-${stop.id}`} type="number" value={v.maxLengte} onChange={zet("maxLengte")} />
            </div>
            <div>
              <label htmlFor={`mh-${stop.id}`}>Max hoogte</label>
              <input id={`mh-${stop.id}`} type="number" value={v.maxHoogte} onChange={zet("maxHoogte")} />
            </div>
          </div>

          <div className="stopknoppen">
            <button type="submit" className="knop klein" disabled={bezig}>
              {bezig ? "Bezig…" : "Opslaan"}
            </button>
            <button type="button" className="knop stil klein" onClick={() => onBewerk(null)}>
              Annuleren
            </button>
            <button type="button" className="knop gevaar klein" onClick={weg} disabled={bezig}>
              {zekerWeten ? "Zeker weten?" : "Verwijderen"}
            </button>
          </div>
        </form>
      ) : open ? (
        <div className="daginhoud">
          <p className="dagregel">
            {titel}
            {rit
              ? ` · ${rit.km.toLocaleString("nl-NL")} km rijden, ${Math.floor(rit.minuten / 60)}u${String(
                  rit.minuten % 60
                ).padStart(2, "0")}${rit.schatting ? " (schatting)" : ""}`
              : " · geen rit"}
          </p>

          <dl className="gegevens">
            {regels.map(([naam, waarde]) => (
              <div key={naam}>
                <dt>{naam}</dt>
                <dd>{waarde}</dd>
              </div>
            ))}
          </dl>

          {!uitslag.past ? (
            <p className="past-niet">
              <Waarschuwing /> Past niet
              {uitslag.problemen.map((p) => (
                <span key={p.veld}>{p.tekst}</span>
              ))}
            </p>
          ) : null}

          <h4>Notitie</h4>
          <textarea
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder="Wat je hier wilt doen, hoe laat de receptie sluit, waar je brood haalt."
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="knop klein"
              onClick={bewaarNotitie}
              disabled={!notitieGewijzigd}
            >
              Notitie opslaan
            </button>
            {bewaard ? <span className="verbinding">Opgeslagen</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
