"use client";

import { useState } from "react";

const leeg = {
  naam: "",
  soort: "overnachting",
  status: "gepland",
  dag: "1",
  nachten: "",
  prijs: "",
  adres: "",
  notitie: "",
  lat: "",
  lon: "",
  maxLengte: "",
  maxHoogte: "",
};

// Een bestaande stop omzetten naar formuliervelden; centen terug naar euro's
const uitStop = (stop) =>
  !stop
    ? leeg
    : {
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
      };

/**
 * Eén formulier voor nieuw en bewerken. Bij bewerken staat er een
 * verwijderknop bij, die eerst om bevestiging vraagt.
 */
export default function StopFormulier({ stop, onBewaar, onVerwijder, onSluit }) {
  const [v, setV] = useState(() => uitStop(stop));
  const [bezig, setBezig] = useState(false);
  const [zekerWeten, setZekerWeten] = useState(false);
  const bewerken = !!stop;

  const zet = (veld) => (e) => setV((oud) => ({ ...oud, [veld]: e.target.value }));

  const verstuur = async (e) => {
    e.preventDefault();
    if (!v.naam.trim() || bezig) return;
    setBezig(true);

    const velden = {
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
    };

    const gelukt = await onBewaar(bewerken ? { id: stop.id, ...velden } : velden);
    setBezig(false);
    if (gelukt) onSluit?.();
  };

  const weg = async () => {
    if (!zekerWeten) return setZekerWeten(true);
    setBezig(true);
    await onVerwijder(stop.id);
    setBezig(false);
    onSluit?.();
  };

  return (
    <form
      onSubmit={verstuur}
      style={{
        padding: 18,
        background: "var(--papier)",
        border: "1px solid var(--rand)",
        borderRadius: 12,
      }}
    >
      <div className="velden">
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="sf-naam">Naam</label>
          <input id="sf-naam" type="text" value={v.naam} onChange={zet("naam")} autoFocus />
        </div>
        <div>
          <label htmlFor="sf-soort">Soort</label>
          <select id="sf-soort" value={v.soort} onChange={zet("soort")}>
            <option value="overnachting">Overnachting</option>
            <option value="bezienswaardigheid">Bezienswaardigheid</option>
            <option value="servicepunt">Servicepunt</option>
          </select>
        </div>
        <div>
          <label htmlFor="sf-dag">Dag</label>
          <input id="sf-dag" type="number" min="1" required value={v.dag} onChange={zet("dag")} />
        </div>
        <div>
          <label htmlFor="sf-status">Status</label>
          <select id="sf-status" value={v.status} onChange={zet("status")}>
            <option value="idee">Idee</option>
            <option value="gepland">Gepland</option>
            <option value="geboekt">Geboekt</option>
          </select>
        </div>
        {v.soort === "overnachting" ? (
          <div>
            <label htmlFor="sf-nachten">Nachten</label>
            <input id="sf-nachten" type="number" min="1" value={v.nachten} onChange={zet("nachten")} />
          </div>
        ) : null}
        <div>
          <label htmlFor="sf-prijs">Prijs</label>
          <input id="sf-prijs" type="text" placeholder="46" value={v.prijs} onChange={zet("prijs")} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="sf-adres">Adres</label>
          <input id="sf-adres" type="text" value={v.adres} onChange={zet("adres")} />
        </div>
        <div>
          <label htmlFor="sf-lat">Breedtegraad</label>
          <input id="sf-lat" type="text" placeholder="47.0502" value={v.lat} onChange={zet("lat")} />
        </div>
        <div>
          <label htmlFor="sf-lon">Lengtegraad</label>
          <input id="sf-lon" type="text" placeholder="8.3093" value={v.lon} onChange={zet("lon")} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="sf-notitie">Notitie</label>
          <input id="sf-notitie" type="text" value={v.notitie} onChange={zet("notitie")} />
        </div>
      </div>

      {v.soort === "overnachting" ? (
        <div style={{ marginTop: 14 }}>
          <p className="uitleg" style={{ margin: "0 0 8px" }}>
            Maxima van deze plek, in centimeters. Laat leeg als je het niet weet.
          </p>
          <div className="velden">
            <div>
              <label htmlFor="sf-maxl">Max lengte</label>
              <input id="sf-maxl" type="number" value={v.maxLengte} onChange={zet("maxLengte")} />
            </div>
            <div>
              <label htmlFor="sf-maxh">Max hoogte</label>
              <input id="sf-maxh" type="number" value={v.maxHoogte} onChange={zet("maxHoogte")} />
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18, alignItems: "center" }}>
        <button type="submit" className="knop" disabled={bezig}>
          {bezig ? "Bezig…" : bewerken ? "Opslaan" : "Toevoegen"}
        </button>
        <button type="button" className="knop stil" onClick={onSluit}>
          Annuleren
        </button>
        {bewerken ? (
          <button
            type="button"
            className="knop gevaar"
            onClick={weg}
            disabled={bezig}
            style={{ marginLeft: "auto" }}
          >
            {zekerWeten ? "Zeker weten? Klik nogmaals" : "Verwijderen"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
