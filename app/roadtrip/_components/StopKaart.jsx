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
 * dan de grote kaart: het wiel scrollt hier het venster, dus zoomen gaat met
 * de knoppen.
 */
export default function StopKaart({ stop, activiteiten = [], lijnen = [] }) {
  const vak = useRef(null);
  const kaart = useRef(null);
  const spelden = useRef([]);
  // Waar het kaartje voor het laatst op is ingepast, zodat het dat niet opnieuw
  // doet bij elke verandering die de uitsnede niet raakt
  const uitsnede = useRef(null);
  // Het venster schuift open, dus het kaartje begint zonder breedte. Inpassen
  // lukt dan niet; de ResizeObserver roept dit alsnog aan zodra het ruimte heeft.
  const pasIn = useRef(() => {});

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

    // Het wiel is hier bezet door het venster, dus zonder knoppen kun je niet
    // dichterbij kijken welke weg een uitje neemt. Rechtsboven, weg van de
    // bronvermelding die rechtsonder zit.
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

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

    const meet = new ResizeObserver(() => {
      m.resize();
      pasIn.current();
    });
    meet.observe(vak.current);

    return () => {
      meet.disconnect();
      spelden.current.forEach((s) => s.remove());
      spelden.current = [];
      m.remove();
      kaart.current = null;
      // De markering overleeft deze opruiming, de kaart niet. Zonder deze regel
      // denkt een volgende kaart dat hij al ingepast is en blijft hij staan waar
      // hij geopend werd.
      uitsnede.current = null;
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

    // De uitsnede moet alles laten zien, maar alleen als er echt iets anders te
    // zien valt. Anders springt het kaartje terug zodra de afstanden binnenkomen
    // en is de zoom die je zelf koos meteen weer weg.
    const afdruk = JSON.stringify([
      stop.lat,
      stop.lon,
      ...activiteiten.map((a) => [a.lat, a.lon]),
    ]);

    const probeerInTePassen = () => {
      if (uitsnede.current === afdruk) return;
      // Een kaartje van twee pixels breed levert een uitsnede op waar niets in
      // past. Dan niets doen en de afdruk niet onthouden, zodat de
      // ResizeObserver het overdoet zodra het venster openstaat.
      if (m.getContainer().clientWidth < 50) return;

      // MapLibre rekent met de maat die het zelf voor het laatst opnam, en die
      // loopt achter zolang het venster nog openschuift. Zonder dit past hij in
      // een kaartje dat er niet meer is, en valt alles buiten beeld.
      m.resize();

      // Met één punt valt er niets te passen
      if (activiteiten.length) {
        const grens = new maplibregl.LngLatBounds([stop.lon, stop.lat], [stop.lon, stop.lat]);
        activiteiten.forEach((a) => grens.extend([a.lon, a.lat]));
        m.fitBounds(grens, { padding: 44, maxZoom: 13, duration: 0 });
      } else {
        m.jumpTo({ center: [stop.lon, stop.lat], zoom: 12 });
      }
      uitsnede.current = afdruk;
    };

    probeerInTePassen();
    pasIn.current = probeerInTePassen;

    return () => {
      m.off("styledata", tekenWegen);
      m.off("style.load", tekenWegen);
    };
  }, [stop, activiteiten, lijnen]);

  if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lon)) return null;

  return <div className="stopkaart" ref={vak} />;
}
