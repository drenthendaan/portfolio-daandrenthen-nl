"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/**
 * Drie lagen terugval, zodat de kaart het altijd doet:
 * 1. een eigen MapTiler-stijl als er een sleutel is;
 * 2. anders OpenFreeMap Positron — dezelfde rustige stijl, zonder sleutel;
 * 3. en als dat niet laadt, de gewone OpenStreetMap-tegels, ontkleurd zodat ze
 *    niet vechten met de route.
 *
 * CARTO's Positron viel af: die vraagt sinds kort een sleutel en levert anders
 * een tegel met "API KEY REQUIRED" erover, met gewoon status 200.
 */
function stijl() {
  if (MAPTILER) return `https://api.maptiler.com/maps/dataviz-light/style.json?key=${MAPTILER}`;
  return "https://tiles.openfreemap.org/styles/positron";
}

function osmStijl() {
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

const ROUTE = {
  casing: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.95 },
  lijn: { "line-color": "#ff4a14", "line-width": 3.2 },
};

export default function Kaart({ stops = [], midden, actief, onKiesStop }) {
  const vak = useRef(null);
  const kaart = useRef(null);
  const spelden = useRef([]);
  const gepast = useRef(false);
  // In een ref, zodat een nieuwe klikfunctie de kaart niet opnieuw laat tekenen
  const kiezen = useRef(onKiesStop);
  kiezen.current = onKiesStop;

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

    // Laadt de stijl niet, dan terugvallen op OpenStreetMap in plaats van een leeg vlak
    let teruggevallen = false;
    kaart.current.on("error", (e) => {
      const bron = e?.error?.url ?? "";
      if (teruggevallen || MAPTILER || !bron.includes("openfreemap")) return;
      teruggevallen = true;
      kaart.current?.getContainer()?.classList.add("osm");
      kaart.current?.setStyle(osmStijl());
    });

    // MapLibre onthoudt zijn afmetingen; bij een layoutwissel moet hij opnieuw meten
    const meet = new ResizeObserver(() => kaart.current?.resize());
    meet.observe(vak.current);

    return () => {
      meet.disconnect();
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

      const metPlek = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
      let nummer = 0;

      metPlek.forEach((stop) => {
        const slaapplek = stop.soort === "overnachting";
        if (slaapplek) nummer += 1;

        const el = document.createElement("button");
        el.type = "button";
        el.className = [
          "speld",
          slaapplek ? stop.status : "los",
          actief === stop.id ? "actief" : "",
        ]
          .filter(Boolean)
          .join(" ");
        el.textContent = slaapplek ? String(nummer) : "";
        el.setAttribute("aria-label", stop.naam);
        el.addEventListener("click", () => kiezen.current?.(stop.id));

        spelden.current.push(new maplibregl.Marker({ element: el }).setLngLat([stop.lon, stop.lat]).addTo(m));
      });

      // Routelijn langs de plekken waar je slaapt
      const lijn = metPlek.filter((s) => s.soort === "overnachting").map((s) => [s.lon, s.lat]);
      const data = { type: "Feature", geometry: { type: "LineString", coordinates: lijn } };
      const bron = m.getSource("route");

      if (bron) {
        bron.setData(data);
      } else if (lijn.length > 1) {
        m.addSource("route", { type: "geojson", data });
        m.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          paint: ROUTE.casing,
          layout: { "line-cap": "round", "line-join": "round" },
        });
        m.addLayer({
          id: "route-lijn",
          type: "line",
          source: "route",
          paint: ROUTE.lijn,
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }

      // Alleen de eerste keer inkaderen; daarna bepaalt de gebruiker het beeld.
      // De marge schaalt mee met het vak, anders zoomt een strook van 180px hoog
      // veel te ver uit.
      if (!gepast.current && metPlek.length > 1) {
        const grens = metPlek.reduce(
          (b, s) => b.extend([s.lon, s.lat]),
          new maplibregl.LngLatBounds([metPlek[0].lon, metPlek[0].lat], [metPlek[0].lon, metPlek[0].lat])
        );
        const vakje = m.getContainer();
        const marge = Math.max(
          20,
          Math.min(64, Math.floor(Math.min(vakje.clientWidth, vakje.clientHeight) / 5))
        );
        m.fitBounds(grens, { padding: marge, maxZoom: 9, duration: 0 });
        gepast.current = true;
      }
    };

    if (m.isStyleLoaded()) teken();
    else m.once("load", teken);
  }, [stops, actief]);

  // De kaart volgt de lijst: klik je een stop aan, dan schuift hij in beeld
  useEffect(() => {
    const m = kaart.current;
    if (!m || !actief) return;
    const stop = stops.find((s) => s.id === actief);
    if (!stop || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) return;
    m.easeTo({ center: [stop.lon, stop.lat], duration: 500 });
  }, [actief, stops]);

  return (
    <div className="kaartvak">
      <div ref={vak} className="kaart" />
    </div>
  );
}
