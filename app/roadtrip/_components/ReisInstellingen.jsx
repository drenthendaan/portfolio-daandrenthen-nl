"use client";

import { useState } from "react";
import { meldGewijzigd, schrijf } from "./api";

const uitReis = (reis) => ({
  naam: reis.naam ?? "",
  vervoer: reis.vervoer ?? "camper",
  status: reis.status ?? "idee",
  van: reis.van ?? "",
  tot: reis.tot ?? "",
  lengte: reis.voertuig?.lengte ?? "",
  hoogte: reis.voertuig?.hoogte ?? "",
  gewicht: reis.voertuig?.gewicht ?? "",
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
          status: v.status,
          van: v.van || null,
          tot: v.tot || null,
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
    <form
      onSubmit={bewaar}
      style={{
        margin: "0 0 18px",
        padding: 18,
        background: "var(--papier)",
        border: "1px solid var(--rand)",
        borderRadius: 12,
      }}
    >
      <div className="velden">
        <div>
          <label htmlFor="ri-naam">Naam</label>
          <input id="ri-naam" type="text" value={v.naam} onChange={zet("naam")} />
          <p className="uitleg" style={{ margin: "6px 0 0", fontSize: 12 }}>
            Het adres blijft <strong>/roadtrip/{reis.slug}</strong>, ook als je de naam wijzigt.
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
          <label htmlFor="ri-status">Status</label>
          <select id="ri-status" value={v.status} onChange={zet("status")}>
            <option value="idee">Idee</option>
            <option value="gepland">Gepland</option>
            <option value="geweest">Geweest</option>
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18, alignItems: "center" }}>
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
