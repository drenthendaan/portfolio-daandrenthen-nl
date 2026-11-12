"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/**
 * Met een MapTiler-sleutel krijg je vectortegels in een eigen stijl. Zonder
 * sleutel vallen we terug op OpenStreetMap-tegels, zodat de kaart ook zonder
 * account werkt. De warme tint komt van een CSS-filter over de tegellaag, zodat
 * hij bij de rest van de sectie past.
 */
function stijl() {
  if (MAPTILER) {
    return `https://api.maptiler.com/maps/landscape/style.json?key=${MAPTILER}`;
  }
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

export default function Kaart({ stops = [], midden, actief, onKiesStop }) {
  const vak = useRef(null);
  const kaart = useRef(null);
  const spelden = useRef([]);

  // Kaart één keer opzetten
  useEffect(() => {
    if (!vak.current || kaart.current) return;

    kaart.current = new maplibregl.Map({
      container: vak.current,
      style: stijl(),
      center: [midden?.lon ?? 9.1, midden?.lat ?? 46.5],
      zoom: midden?.zoom ?? 5,
      attributionControl: { compact: true },
    });
    kaart.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    kaart.current.scrollZoom.disable(); // anders scroll je de pagina niet meer voorbij de kaart

    return () => {
      kaart.current?.remove();
      kaart.current = null;
    };
    // midden alleen bij het opzetten; daarna bepaalt de gebruiker het beeld
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spelden en route opnieuw tekenen als de stops veranderen
  useEffect(() => {
    const m = kaart.current;
    if (!m) return;

    const teken = () => {
      spelden.current.forEach((s) => s.remove());
      spelden.current = [];

      const metPlek = stops.filter(
        (s) => Number.isFinite(s.lat) && Number.isFinite(s.lon)
      );

      metPlek.forEach((stop, i) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `speld${stop.soort === "overnachting" ? "" : " los"}${
          actief === stop.id ? " actief" : ""
        }`;
        el.textContent = stop.soort === "overnachting" ? String(i + 1) : "";
        el.setAttribute("aria-label", stop.naam);
        el.addEventListener("click", () => onKiesStop?.(stop.id));

        const speld = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lon, stop.lat])
          .addTo(m);
        spelden.current.push(speld);
      });

      // Routelijn langs de overnachtingen
      const lijn = metPlek
        .filter((s) => s.soort === "overnachting")
        .map((s) => [s.lon, s.lat]);

      const bron = m.getSource("route");
      const data = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: lijn },
      };

      if (bron) {
        bron.setData(data);
      } else if (lijn.length > 1) {
        m.addSource("route", { type: "geojson", data });
        m.addLayer({
          id: "route-wit",
          type: "line",
          source: "route",
          paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        m.addLayer({
          id: "route-lijn",
          type: "line",
          source: "route",
          paint: { "line-color": "#b4552f", "line-width": 3.4 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }

      // Alles in beeld
      if (metPlek.length > 1) {
        const grens = metPlek.reduce(
          (b, s) => b.extend([s.lon, s.lat]),
          new maplibregl.LngLatBounds([metPlek[0].lon, metPlek[0].lat], [metPlek[0].lon, metPlek[0].lat])
        );
        m.fitBounds(grens, { padding: 56, maxZoom: 9, duration: 0 });
      }
    };

    if (m.isStyleLoaded()) teken();
    else m.once("load", teken);
  }, [stops, actief, onKiesStop]);

  return (
    <div className="kaartvak">
      <div ref={vak} className="kaart" />
      {!MAPTILER ? (
        <p className="kaartnoot">
          Kaart van OpenStreetMap. Met een MapTiler-sleutel krijg je een eigen stijl.
        </p>
      ) : null}
    </div>
  );
}
