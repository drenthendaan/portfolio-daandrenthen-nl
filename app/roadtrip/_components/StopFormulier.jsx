"use client";

import { useState } from "react";
import { VINKJES } from "@/lib/roadtrip/regels.mjs";
import PlaatsZoeker from "./PlaatsZoeker";

const leeg = {
  naam: "",
  dag: "1",
  nachten: "",
  prijs: "",
  ...Object.fromEntries(VINKJES.map(({ veld }) => [veld, false])),
  adres: "",
  link: "",
  lat: "",
  lon: "",
};

// Een bestaande stop omzetten naar formuliervelden; centen terug naar euro's
const uitStop = (stop) =>
  !stop
    ? leeg
    : {
        naam: stop.naam ?? "",
        dag: stop.dag ?? "",
        nachten: stop.nachten ?? "",
        prijs: stop.prijs ? String(stop.prijs / 100).replace(".", ",") : "",
        ...Object.fromEntries(VINKJES.map(({ veld }) => [veld, !!stop[veld]])),
        adres: stop.adres ?? "",
        link: stop.link ?? "",
        lat: stop.lat ?? "",
        lon: stop.lon ?? "",
      };

/**
 * Eén formulier voor nieuw en bewerken. Bij bewerken staat er een
 * verwijderknop bij, die eerst om bevestiging vraagt.
 */
export default function StopFormulier({ stop, volgendeDag = 1, onBewaar, onVerwijder, onSluit }) {
  // Een nieuwe stop krijgt de eerste vrije dag: op een dag die al een plek heeft
  // zou hij onder die plek verdwijnen, want een dag toont alleen zijn eerste stop.
  const [v, setV] = useState(() => (stop ? uitStop(stop) : { ...leeg, dag: String(volgendeDag) }));
  const [bezig, setBezig] = useState(false);
  const [zekerWeten, setZekerWeten] = useState(false);
  const bewerken = !!stop;

  const zet = (veld) => (e) => setV((oud) => ({ ...oud, [veld]: e.target.value }));
  const vink = (veld) => (e) => setV((oud) => ({ ...oud, [veld]: e.target.checked }));

  // Het naamveld is ook de zoeker: een gekozen resultaat vult naam, adres en plek
  const kiesPlek = (plek) =>
    setV((oud) => ({
      ...oud,
      naam: plek.naam,
      adres: plek.adres ?? oud.adres,
      lat: String(plek.lat),
      lon: String(plek.lon),
    }));

  const verstuur = async (e) => {
    e.preventDefault();
    if (!v.naam.trim() || bezig) return;
    setBezig(true);

    const velden = {
      naam: v.naam,
      soort: "overnachting",
      dag: v.dag === "" ? null : Number(v.dag),
      nachten: v.nachten !== "" ? Number(v.nachten) : null,
      prijs: v.prijs === "" ? null : v.prijs,
      ...Object.fromEntries(VINKJES.map(({ veld }) => [veld, v[veld]])),
      adres: v.adres || null,
      link: v.link.trim() || null,
      lat: v.lat === "" ? null : Number(v.lat),
      lon: v.lon === "" ? null : Number(v.lon),
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
    <form onSubmit={verstuur}>
      <div className="velden">
        <div style={{ gridColumn: "1 / -1" }}>
          <PlaatsZoeker
            id="sf-naam"
            label="Waar sta je"
            placeholder="Zoek een camping, stad of adres"
            geenTreffers="Niets gevonden. De naam die je typte blijft gewoon staan."
            value={v.naam}
            onChange={(naam) => setV((oud) => ({ ...oud, naam }))}
            onKies={kiesPlek}
            autoFocus
          />
          <p className="plekstand">
            {v.lat !== "" && v.lon !== ""
              ? "Staat op de kaart."
              : "Nog niet op de kaart: kies een zoekresultaat."}
          </p>
        </div>
        <div>
          <label htmlFor="sf-dag">Dag</label>
          <input id="sf-dag" type="number" min="1" required value={v.dag} onChange={zet("dag")} />
        </div>
                  <div>
            <label htmlFor="sf-nachten">Nachten</label>
            <input id="sf-nachten" type="number" min="1" value={v.nachten} onChange={zet("nachten")} />
          </div>
        <div>
          <label htmlFor="sf-prijs">Prijs</label>
          <input id="sf-prijs" type="text" placeholder="46" value={v.prijs} onChange={zet("prijs")} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="sf-adres">Adres</label>
          <input id="sf-adres" type="text" value={v.adres} onChange={zet("adres")} />
        </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="sf-link">Website</label>
                <input
                  id="sf-link"
                  type="url"
                  inputMode="url"
                  placeholder="https://www.camping-…"
                  value={v.link}
                  onChange={zet("link")}
                />
              </div>
        <div className="vinkjes" style={{ gridColumn: "1 / -1" }}>
          {VINKJES.map(({ veld, naam }) => (
            <label key={veld} className="vinkje">
              <input type="checkbox" checked={v[veld]} onChange={vink(veld)} />
              {naam}
            </label>
          ))}
        </div>
      </div>

      <div className="modaalknoppen">
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
