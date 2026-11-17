"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { uitjeKleur } from "@/lib/roadtrip/regels.mjs";
import { heeftEigenSleutel, isOpenFreeMap, osmStijl, stijl } from "./kaartstijl";

/**
 * Het kaartje in het venster van een stop: waar je staat, waar de dingen liggen
 * die je er wilt doen, en de weg ernaartoe. Elke activiteit heeft zijn eigen
 * kleur, die terugkomt op de speld en in de lijst eronder. Bewust veel minder
 * dan de grote kaart — niets te slepen, geen zoom met het wiel. Alleen kijken.
 */
export default function StopKaart({ stop, activiteiten = [], lijnen = [] }) {
  const vak = useRef(null);
  const kaart = useRef(null);
  const spelden = useRef([]);

  useEffect(() => {
    if (!vak.current || kaart.current) return;
    if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lon)) return;

    const m = new maplibregl.Map({
      container: vak.current,
      style: stijl(),
      center: [stop.lon, stop.lat],
      zoom: 11,
      attributionControl: { compact: true },
      // Het kaartje zit in een venster dat zelf schuift; met zoom op het wiel
      // scroll je de inhoud niet meer voorbij.
      scrollZoom: false,
    });
    kaart.current = m;

    let teruggevallen = false;
    m.on("error", (e) => {
      const bron = e?.error?.url ?? "";
      if (teruggevallen || heeftEigenSleutel() || !isOpenFreeMap(bron)) return;
      teruggevallen = true;
      m.setStyle(osmStijl());
    });

    // Zelfde ingreep als op de grote kaart: de bronvermelding hoeft niet als
    // strook over een kaartje van 180 pixels hoog te liggen.
    const klapVermeldingIn = () => {
      const vermelding = m.getContainer().querySelector(".maplibregl-ctrl-attrib");
      vermelding?.classList.remove("maplibregl-compact-show");
      vermelding?.setAttribute("aria-expanded", "false");
    };
    m.on("styledata", klapVermeldingIn);

    const meet = new ResizeObserver(() => m.resize());
    meet.observe(vak.current);

    return () => {
      meet.disconnect();
      spelden.current.forEach((s) => s.remove());
      spelden.current = [];
      m.remove();
      kaart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Spelden en uitsnede ----
  useEffect(() => {
    const m = kaart.current;
    if (!m) return;

    spelden.current.forEach((s) => s.remove());
    spelden.current = [];

    // Het nummer staat op de speld én in de lijst eronder; zonder dat kun je de
    // twee niet aan elkaar knopen en zegt het kaartje weinig.
    const zet = (lat, lon, klasse, label, nummer, kleur) => {
      const el = document.createElement("div");
      el.className = klasse;
      el.title = label;
      if (nummer) el.textContent = String(nummer);
      if (kleur) el.style.background = kleur;
      spelden.current.push(new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m));
    };

    zet(stop.lat, stop.lon, "stopspeld hier", stop.naam);
    activiteiten.forEach((a, i) =>
      zet(a.lat, a.lon, "stopspeld uitje", `${i + 1}. ${a.naam}`, i + 1, uitjeKleur(i))
    );

    // De weg naar elk uitje, in de kleur van zijn speld. Kent de server de weg
    // nog niet, dan een rechte verbinding: beter een streep die klopt over de
    // richting dan een kaartje waarop niets de twee punten verbindt.
    const wegen = {
      type: "FeatureCollection",
      features: activiteiten.map((a, i) => {
        const weg = lijnen[i];
        const punten =
          Array.isArray(weg) && weg.length > 1 ? weg : [[stop.lon, stop.lat], [a.lon, a.lat]];
        return {
          type: "Feature",
          properties: { kleur: uitjeKleur(i) },
          geometry: { type: "LineString", coordinates: punten },
        };
      }),
    };

    // Niet wachten op isStyleLoaded(): dat is pas waar als élke tegel binnen is,
    // en dan zie je de lijnen seconden later pas. Elke stap kijkt of hij al
    // gedaan is, zodat een halve poging zich bij de volgende styledata afmaakt.
    const tekenWegen = () => {
      try {
        const bron = m.getSource("uitjes");
        if (bron) bron.setData(wegen);
        else m.addSource("uitjes", { type: "geojson", data: wegen });
        if (!wegen.features.length) return;

        if (!m.getLayer("uitjes-rand")) {
          m.addLayer({
            id: "uitjes-rand",
            type: "line",
            source: "uitjes",
            paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.9 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        }
        if (!m.getLayer("uitjes-lijn")) {
          m.addLayer({
            id: "uitjes-lijn",
            type: "line",
            source: "uitjes",
            paint: { "line-color": ["get", "kleur"], "line-width": 2.6 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        }
      } catch {
        // Stijl nog niet zover; de volgende styledata probeert het opnieuw
      }
    };

    tekenWegen();
    m.on("styledata", tekenWegen);
    m.on("style.load", tekenWegen);

    // De uitsnede moet alles laten zien; met één punt valt er niets te passen
    if (activiteiten.length) {
      const grens = new maplibregl.LngLatBounds([stop.lon, stop.lat], [stop.lon, stop.lat]);
      activiteiten.forEach((a) => grens.extend([a.lon, a.lat]));
      m.fitBounds(grens, { padding: 44, maxZoom: 13, duration: 0 });
    } else {
      m.jumpTo({ center: [stop.lon, stop.lat], zoom: 12 });
    }

    return () => {
      m.off("styledata", tekenWegen);
      m.off("style.load", tekenWegen);
    };
  }, [stop, activiteiten, lijnen]);

  if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lon)) return null;

  return <div className="stopkaart" ref={vak} />;
}
