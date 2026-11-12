"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Vergroten, Verkleinen } from "./iconen";

const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/**
 * Drie lagen terugval, zodat de kaart het altijd doet:
 * 1. een eigen MapTiler-stijl als er een sleutel is;
 * 2. anders OpenFreeMap Positron — dezelfde rustige stijl, zonder sleutel;
 * 3. en als dat niet laadt, de gewone OpenStreetMap-tegels, ontkleurd zodat ze
 *    niet vechten met de route.
 */
function stijl() {
  // streets-v2 in plaats van dataviz-light: die laatste is net zo grijs als
  // positron was. Niet nagelopen tegen een echte sleutel — die is er hier niet.
  if (MAPTILER) return `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER}`;
  // Liberty in plaats van positron: groen voor natuur, blauw voor water. Dat
  // positron bewust grijs is, was juist het probleem.
  return "https://tiles.openfreemap.org/styles/liberty";
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

// Alleen plekken met coördinaten kunnen op de kaart; alleen plekken met een dag
// horen in de route — een idee zonder dag is een losse stip.
const metPlek = (stops) => stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
const inRoute = (s) => s.dag !== null && s.dag !== undefined;

export default function Kaart({ stops = [], start, midden, actief, mag, onKiesStop, onVerplaats }) {
  // Schermvullend is een eigen stand, geen echte fullscreen: die kan een iPhone
  // niet voor een gewoon element, en dan zou de knop daar niets doen.
  const [groot, setGroot] = useState(false);
  const vak = useRef(null);
  const kaart = useRef(null);
  // id → { speld, el, stop }: spelden worden bijgewerkt, niet opnieuw gebouwd
  const spelden = useRef(new Map());
  // De startplek is geen stop: eigen speld, niet te slepen (dat gaat via Aanpassen)
  const startSpeld = useRef(null);
  const gepast = useRef(false);
  const callbacks = useRef({ onKiesStop, onVerplaats });
  callbacks.current = { onKiesStop, onVerplaats };

  // ---- Kaart opzetten ----
  useEffect(() => {
    if (!vak.current || kaart.current) return;

    const m = new maplibregl.Map({
      container: vak.current,
      style: stijl(),
      center: [midden?.lon ?? 9.1, midden?.lat ?? 46.5],
      zoom: midden?.zoom ?? 5,
      attributionControl: { compact: true },
    });
    kaart.current = m;

    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    // De bronvermelding moet erbij — de kaartdata komt van OpenStreetMap en dat
    // is ODbL, dus naamsvermelding is een voorwaarde. Maar hij hoeft niet als
    // strook over de kaart te liggen: ingeklapt is het een ⓘ-knopje, en wie
    // erop klikt ziet de volledige vermelding.
    //
    // MapLibre vult hem pas als de stijl binnen is en klapt hem dan open, dus
    // dit moet aan styledata hangen en niet aan het opzetten van de kaart. Na
    // de OSM-terugval gebeurt hetzelfde nog een keer. Klapt de bezoeker hem
    // zelf open, dan blijven we eraf.
    let doorBezoeker = false;
    const klapVermeldingIn = () => {
      const vak = m.getContainer().querySelector(".maplibregl-ctrl-attrib");
      if (!vak || doorBezoeker) return;

      const knop = vak.querySelector(".maplibregl-ctrl-attrib-button");
      if (knop && !knop.dataset.gekoppeld) {
        knop.dataset.gekoppeld = "1";
        knop.addEventListener("click", () => {
          doorBezoeker = true;
        });
      }

      vak.classList.remove("maplibregl-compact-show");
      vak.setAttribute("aria-expanded", "false");
    };
    m.on("styledata", klapVermeldingIn);
    m.scrollZoom.disable(); // anders scroll je de pagina niet meer voorbij de kaart

    let teruggevallen = false;
    m.on("error", (e) => {
      const bron = e?.error?.url ?? "";
      if (teruggevallen || MAPTILER || !bron.includes("openfreemap")) return;
      teruggevallen = true;
      m.getContainer().classList.add("osm");
      m.setStyle(osmStijl());
    });

    const meet = new ResizeObserver(() => m.resize());
    meet.observe(vak.current);
    const huidigeSpelden = spelden.current;

    return () => {
      meet.disconnect();
      huidigeSpelden.forEach(({ speld }) => speld.remove());
      huidigeSpelden.clear();
      startSpeld.current?.remove();
      startSpeld.current = null;
      m.remove();
      kaart.current = null;
      // Een volgende kaart moet zichzelf opnieuw op de route richten
      gepast.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Spelden bijwerken ----
  useEffect(() => {
    const m = kaart.current;
    if (!m) return;

    // De route loopt langs de spelden zoals ze nú staan, zodat de lijn meebuigt
    // terwijl je sleept in plaats van pas na het opslaan te verspringen.
    const vertrek = Number.isFinite(start?.lat) && Number.isFinite(start?.lon) ? start : null;

    const routeData = () => {
      const punten = metPlek(stops)
        .filter(inRoute)
        .map((s) => {
          const bestaand = spelden.current.get(s.id);
          if (!bestaand) return [s.lon, s.lat];
          const { lng, lat } = bestaand.speld.getLngLat();
          return [lng, lat];
        });
      if (vertrek && punten.length) punten.unshift([vertrek.lon, vertrek.lat]);
      return { type: "Feature", geometry: { type: "LineString", coordinates: punten } };
    };

    // Alleen de lijn hangt van de stijl af; spelden zijn gewone HTML-elementen
    // en worden altijd geplaatst, ook als de tegels traag of stuk zijn.
    // Niet wachten op isStyleLoaded(): dat is pas waar als élke tegel binnen is,
    // en dat duurde merkbaar lang voordat de lijn verscheen. Een bron en een laag
    // mogen al zodra de stijl zelf staat. Lukt het nog niet, dan vangt de catch
    // het op en probeert de volgende styledata het opnieuw. Elke stap kijkt eerst
    // of hij al gedaan is, zodat een halve poging zichzelf later afmaakt.
    const tekenRoute = () => {
      const data = routeData();
      try {
        const bron = m.getSource("route");
        if (bron && m.getLayer("route-lijn")) return bron.setData(data);
        if (data.geometry.coordinates.length < 2) return;

        if (!bron) m.addSource("route", { type: "geojson", data });
        else bron.setData(data);

        if (!m.getLayer("route-casing")) {
          m.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.95 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        }
        if (!m.getLayer("route-lijn")) {
          m.addLayer({
            id: "route-lijn",
            type: "line",
            source: "route",
            paint: { "line-color": "#ff4a14", "line-width": 3.2 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        }
      } catch {
        // Stijl nog niet zover; de volgende styledata probeert het opnieuw
      }
    };

    const teken = () => {
      const lijst = metPlek(stops);
      const gezien = new Set();

      lijst.forEach((stop) => {
        gezien.add(stop.id);
        // Het nummer op de speld is het dagnummer, zodat kaart en lijst
        // dezelfde taal spreken: speld 4 hoort bij "Dag 4–6".
        const label = inRoute(stop) ? String(stop.dag) : "";
        const bestaand = spelden.current.get(stop.id);

        if (bestaand) {
          // Alleen bijwerken wat veranderd is, zodat de speld niet knippert
          const { speld, el } = bestaand;
          if (!el.classList.contains("sleept")) {
            const huidig = speld.getLngLat();
            if (huidig.lng !== stop.lon || huidig.lat !== stop.lat) {
              speld.setLngLat([stop.lon, stop.lat]);
            }
          }
          el.textContent = label;
          el.dataset.betaald = stop.betaald ? "ja" : "nee";
          el.classList.toggle("los", !inRoute(stop));
          el.title = stop.naam;
          bestaand.stop = stop;
          return;
        }

        // MapLibre zet zijn eigen transform op het element dat het krijgt, dus
        // dat moet een wikkel zijn: alleen zo houden hover, slepen en de
        // actieve speld hun eigen schaalanimatie.
        const wikkel = document.createElement("div");
        wikkel.className = "speldvak";

        const el = document.createElement("button");
        el.type = "button";
        el.className = `speld${inRoute(stop) ? "" : " los"}`;
        el.textContent = label;
        el.dataset.betaald = stop.betaald ? "ja" : "nee";
        el.title = stop.naam;
        wikkel.appendChild(el);

        const speld = new maplibregl.Marker({ element: wikkel, draggable: !!mag })
          .setLngLat([stop.lon, stop.lat])
          .addTo(m);

        const gegevens = { speld, el, stop };

        // Een klik telt alleen als je niet gesleept hebt
        let gesleept = false;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (gesleept) {
            gesleept = false;
            return;
          }
          callbacks.current.onKiesStop?.(gegevens.stop.id);
        });

        speld.on("dragstart", () => {
          gesleept = true;
          el.classList.add("sleept");
          m.getContainer().classList.add("sleepend");
        });

        // De lijn buigt mee zolang je sleept
        speld.on("drag", () => tekenRoute());

        speld.on("dragend", async () => {
          el.classList.remove("sleept");
          m.getContainer().classList.remove("sleepend");
          const vorige = { lon: gegevens.stop.lon, lat: gegevens.stop.lat };
          const { lng, lat } = speld.getLngLat();
          el.classList.add("bezig");
          const gelukt = await callbacks.current.onVerplaats?.(gegevens.stop.id, {
            lat: Number(lat.toFixed(5)),
            lon: Number(lng.toFixed(5)),
          });
          el.classList.remove("bezig");
          // Niet opgeslagen? Dan hoort de speld terug op zijn oude plek
          if (!gelukt && Number.isFinite(vorige.lat) && Number.isFinite(vorige.lon)) {
            speld.setLngLat([vorige.lon, vorige.lat]);
            el.classList.add("terug");
            setTimeout(() => el.classList.remove("terug"), 400);
          }
          tekenRoute();
        });

        spelden.current.set(stop.id, gegevens);
      });

      // Stops die weg zijn, hun speld ook
      spelden.current.forEach(({ speld }, id) => {
        if (gezien.has(id)) return;
        speld.remove();
        spelden.current.delete(id);
      });

      // De startplek: bijwerken als hij er is, weghalen als hij weg is
      if (vertrek) {
        if (!startSpeld.current) {
          const wikkel = document.createElement("div");
          wikkel.className = "speldvak";
          const el = document.createElement("span");
          el.className = "speld start";
          wikkel.appendChild(el);
          // Eerst een plek, dan pas op de kaart: addTo() rekent meteen met de positie
          startSpeld.current = new maplibregl.Marker({ element: wikkel })
            .setLngLat([vertrek.lon, vertrek.lat])
            .addTo(m);
        } else {
          startSpeld.current.setLngLat([vertrek.lon, vertrek.lat]);
        }
        const el = startSpeld.current.getElement().firstChild;
        el.title = `Start: ${vertrek.naam}`;
        el.setAttribute("aria-label", `Start: ${vertrek.naam}`);
      } else if (startSpeld.current) {
        startSpeld.current.remove();
        startSpeld.current = null;
      }

      tekenRoute();

      // Alleen de eerste keer inkaderen; daarna blijft jouw beeld staan
      const route = lijst.filter(inRoute);
      if (vertrek) route.unshift(vertrek);
      // Eén plek valt niet in te kaderen, maar hoort wel in beeld te staan
      if (!gepast.current && route.length === 1) {
        m.jumpTo({ center: [route[0].lon, route[0].lat], zoom: 9 });
        gepast.current = true;
      } else if (!gepast.current && route.length > 1) {
        const grens = route.reduce(
          (b, s) => b.extend([s.lon, s.lat]),
          new maplibregl.LngLatBounds([route[0].lon, route[0].lat], [route[0].lon, route[0].lat])
        );
        const vakje = m.getContainer();
        const marge = Math.max(
          28,
          Math.min(72, Math.floor(Math.min(vakje.clientWidth, vakje.clientHeight) / 5))
        );
        m.fitBounds(grens, { padding: marge, maxZoom: 9, duration: 0 });
        gepast.current = true;
      }
    };

    teken();

    // style.load is het vroegste moment waarop er een laag bij mag; styledata
    // blijft het daarna proberen, ook na een setStyle (de OSM-terugval), waarna
    // alle lagen weg zijn.
    const bijStijl = () => tekenRoute();
    m.on("style.load", bijStijl);
    m.on("styledata", bijStijl);
    return () => {
      m.off("style.load", bijStijl);
      m.off("styledata", bijStijl);
    };
  }, [stops, start, mag]);

  // ---- De kaart op het hele scherm ----
  // De ResizeObserver ziet het vak ook wel veranderen, maar pas een slag later;
  // tot dan hangt het canvas op zijn oude maat in beeld. Dit moet dus vóór het
  // tekenen gebeuren: useLayoutEffect draait nadat de klasse op het vak staat en
  // nog voordat er iets op het scherm komt, en resize() meet dan de nieuwe maat.
  // (Alleen de browser draait dit; de kaart laadt sowieso niet op de server.)
  useLayoutEffect(() => {
    kaart.current?.resize();
  }, [groot]);

  useEffect(() => {
    if (!groot) return;

    // De pagina erachter hoort niet mee te schuiven
    const vorigeOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const toets = (e) => {
      if (e.key === "Escape") setGroot(false);
    };
    document.addEventListener("keydown", toets);

    return () => {
      document.removeEventListener("keydown", toets);
      document.body.style.overflow = vorigeOverflow;
    };
  }, [groot]);

  // ---- Mag je bewerken? Dan pas kun je slepen ----
  useEffect(() => {
    spelden.current.forEach(({ speld }) => speld.setDraggable(!!mag));
    kaart.current?.getContainer().classList.toggle("kijk", !mag);
  }, [mag]);

  // ---- Welke speld actief is, is alleen een klasse ----
  useEffect(() => {
    spelden.current.forEach(({ el }, id) => {
      el.classList.toggle("actief", id === actief);
    });

    const m = kaart.current;
    if (!m || !actief) return;
    const gegevens = spelden.current.get(actief);
    if (!gegevens) return;
    const { lng, lat } = gegevens.speld.getLngLat();
    m.easeTo({ center: [lng, lat], duration: 450 });
  }, [actief]);

  return (
    <div className={`kaartvak${groot ? " groot" : ""}`}>
      <div ref={vak} className="kaart" />

      <button
        type="button"
        className="kaartgroot"
        onClick={() => setGroot((b) => !b)}
        aria-pressed={groot}
        aria-label={groot ? "Kaart verkleinen" : "Kaart op het hele scherm"}
        title={groot ? "Kaart verkleinen" : "Kaart op het hele scherm"}
      >
        {groot ? <Verkleinen /> : <Vergroten />}
      </button>
    </div>
  );
}
