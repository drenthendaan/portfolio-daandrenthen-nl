"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { heeftEigenSleutel, isOpenFreeMap, osmStijl, stijl } from "./kaartstijl";

/**
 * Het kaartje in het venster van een stop: waar je staat, en waar de dingen
 * liggen die je er wilt doen. Bewust veel minder dan de grote kaart — niets te
 * slepen, geen routelijn, geen zoom met het wiel. Alleen kijken.
 */
export default function StopKaart({ stop, activiteiten = [] }) {
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
    const zet = (lat, lon, klasse, label, nummer) => {
      const el = document.createElement("div");
      el.className = klasse;
      el.title = label;
      if (nummer) el.textContent = String(nummer);
      spelden.current.push(new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m));
    };

    zet(stop.lat, stop.lon, "stopspeld hier", stop.naam);
    activiteiten.forEach((a, i) => zet(a.lat, a.lon, "stopspeld uitje", `${i + 1}. ${a.naam}`, i + 1));

    // De uitsnede moet alles laten zien; met één punt valt er niets te passen
    if (activiteiten.length) {
      const grens = new maplibregl.LngLatBounds([stop.lon, stop.lat], [stop.lon, stop.lat]);
      activiteiten.forEach((a) => grens.extend([a.lon, a.lat]));
      m.fitBounds(grens, { padding: 44, maxZoom: 13, duration: 0 });
    } else {
      m.jumpTo({ center: [stop.lon, stop.lat], zoom: 12 });
    }
  }, [stop, activiteiten]);

  if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lon)) return null;

  return <div className="stopkaart" ref={vak} />;
}
