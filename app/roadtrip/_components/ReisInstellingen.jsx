"use client";

import { useState } from "react";
import { meldGewijzigd, schrijf } from "./api";
import PlaatsZoeker from "./PlaatsZoeker";

const uitReis = (reis) => ({
  naam: reis.naam ?? "",
  vervoer: reis.vervoer ?? "camper",
  van: reis.van ?? "",
  tot: reis.tot ?? "",
  lengte: reis.voertuig?.lengte ?? "",
  hoogte: reis.voertuig?.hoogte ?? "",
  gewicht: reis.voertuig?.gewicht ?? "",
  afbeelding: reis.afbeelding ?? "",
  start: reis.start ?? null,
});

/**
 * De reis zelf aanpassen of weggooien. Verwijderen neemt alle stops en
 * dagnotities mee, dus dat vraagt om een bevestiging met de naam erbij.
 */
export default function ReisInstellingen({ reis, onBijgewerkt, onFout, onSluit }) {
  const [v, setV] = useState(() => uitReis(reis));
  const [bezig, setBezig] = useState(false);

  const zet = (veld) => (e) => setV((oud) => ({ ...oud, [veld]: e.target.value }));

  const bewaar = async (e) => {
    e.preventDefault();
    if (bezig) return;
    setBezig(true);
    try {
      const { reis: bijgewerkt, versie } = await schrijf("/api/roadtrip/reizen", {
        method: "PATCH",
        body: {
          slug: reis.slug,
          naam: v.naam,
          vervoer: v.vervoer,
          van: v.van || null,
          tot: v.tot || null,
          afbeelding: v.afbeelding.trim() || null,
          start: v.start,
          voertuig:
            v.vervoer === "camper" && (v.lengte || v.hoogte || v.gewicht)
              ? { lengte: v.lengte || null, hoogte: v.hoogte || null, gewicht: v.gewicht || null }
              : null,
        },
      });
      meldGewijzigd(versie);
      onBijgewerkt(bijgewerkt);
      onSluit?.();
    } catch (e) {
      onFout(e);
    } finally {
      setBezig(false);
    }
  };

  return (
    <form onSubmit={bewaar}>
      <div className="velden">
        <div>
          <label htmlFor="ri-naam">Naam</label>
          <input id="ri-naam" type="text" value={v.naam} onChange={zet("naam")} />
          <p className="uitleg" style={{ margin: "6px 0 0", fontSize: 12 }}>
            Het adres blijft <strong>/roadtrip/{reis.slug}</strong>, ook als je de naam wijzigt.
          </p>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ri-afbeelding">Foto</label>
          <input
            id="ri-afbeelding"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={v.afbeelding}
            onChange={zet("afbeelding")}
          />
          <p className="uitleg" style={{ margin: "6px 0 0", fontSize: 12 }}>
            Komt op het overzicht te staan, in plaats van het routeschetsje. Laat leeg voor
            het schetsje.
          </p>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          {v.start ? (
            <>
              <span className="veldnaam">Startplek</span>
              <div className="gekozenPlek">
                <span>
                  <strong>{v.start.naam}</strong>
                  <small>
                    {v.start.lat.toFixed(4)}, {v.start.lon.toFixed(4)}
                  </small>
                </span>
                <button
                  type="button"
                  className="alsLink"
                  onClick={() => setV((oud) => ({ ...oud, start: null }))}
                >
                  Weghalen
                </button>
              </div>
            </>
          ) : (
            <PlaatsZoeker
              id="ri-start"
              label="Startplek"
              placeholder="Thuis, een stad of adres"
              geenTreffers="Niets gevonden. Probeer een plaatsnaam of een volledig adres."
              onKies={(p) =>
                setV((oud) => ({ ...oud, start: { naam: p.naam, lat: p.lat, lon: p.lon } }))
              }
            />
          )}
          <p className="uitleg" style={{ margin: "6px 0 0", fontSize: 12 }}>
            Waar je vertrekt. De route op de kaart begint hier, en de rit naar dag 1 wordt
            vanaf hier berekend.
          </p>
        </div>
        <div>
          <label htmlFor="ri-vervoer">Waarmee</label>
          <select id="ri-vervoer" value={v.vervoer} onChange={zet("vervoer")}>
            <option value="camper">Camper</option>
            <option value="auto">Auto</option>
            <option value="motor">Motor</option>
            <option value="vlucht">Vlucht</option>
          </select>
        </div>
        <div>
          <label htmlFor="ri-van">Van</label>
          <input id="ri-van" type="date" value={v.van} onChange={zet("van")} />
        </div>
        <div>
          <label htmlFor="ri-tot">Tot</label>
          <input id="ri-tot" type="date" value={v.tot} onChange={zet("tot")} />
        </div>
      </div>

      {v.vervoer === "camper" ? (
        <div style={{ marginTop: 14 }}>
          <p className="uitleg" style={{ margin: "0 0 8px" }}>
            Afmetingen van de camper, in centimeters en kilo&apos;s.
          </p>
          <div className="velden">
            <div>
              <label htmlFor="ri-lengte">Lengte</label>
              <input id="ri-lengte" type="number" value={v.lengte} onChange={zet("lengte")} />
            </div>
            <div>
              <label htmlFor="ri-hoogte">Hoogte</label>
              <input id="ri-hoogte" type="number" value={v.hoogte} onChange={zet("hoogte")} />
            </div>
            <div>
              <label htmlFor="ri-gewicht">Gewicht</label>
              <input id="ri-gewicht" type="number" value={v.gewicht} onChange={zet("gewicht")} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="modaalknoppen">
        <button type="submit" className="knop" disabled={bezig}>
          {bezig ? "Bezig…" : "Opslaan"}
        </button>
        <button type="button" className="knop stil" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </form>
  );
}
