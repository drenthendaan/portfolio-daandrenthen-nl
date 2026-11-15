"use client";

import { useEffect, useRef, useState } from "react";
import { Kaartspeld, Zoek } from "./iconen";

// Wachten tot je even niet typt scheelt een hoop verzoeken aan de zoekdienst
const RUST = 450;
const KORTSTE = 3;

/**
 * Zoek een plek op naam en laat naam, adres en coördinaten invullen.
 *
 * Met onChange is dit meteen het naamveld: wat je typt is de naam, en kies je
 * een zoekresultaat, dan komen naam, adres en plek op de kaart daaruit. Zonder
 * onChange is het een los zoekveld dat na het kiezen weer leeg wordt.
 */
export default function PlaatsZoeker({
  id,
  onKies,
  onChange,
  value,
  autoFocus = false,
  label = "Zoek een plek",
  placeholder = "Camping, stad of adres",
  geenTreffers = "Niets gevonden.",
}) {
  const naamveld = typeof onChange === "function";
  const [term, setTerm] = useState(value ?? "");
  // Alleen wat je zelf typt wordt gezocht; een ingevulde naam bij het openen niet
  const [zoekterm, setZoekterm] = useState("");
  const [treffers, setTreffers] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);
  const [gemarkeerd, setGemarkeerd] = useState(-1);

  const vak = useRef(null);
  // Een trager antwoord op een oudere term mag een nieuwer antwoord niet overschrijven
  const beurt = useRef(0);

  // Zoeken zodra je even stil bent
  useEffect(() => {
    const schoon = zoekterm.trim();
    if (schoon.length < KORTSTE) {
      setTreffers(null);
      setMelding(null);
      setBezig(false);
      return;
    }

    const mijnBeurt = ++beurt.current;
    setBezig(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/roadtrip/zoek?term=${encodeURIComponent(schoon)}`);
        const data = await res.json();
        if (mijnBeurt !== beurt.current) return; // er is alweer verder getypt
        if (!res.ok) throw new Error(data?.error ?? "Zoeken lukte niet");
        setTreffers(data.treffers ?? []);
        setGemarkeerd(-1);
        setMelding(
          data.dienstWeg
            ? "De zoekdienst antwoordt even niet — vul de coördinaten zolang zelf in."
            : null
        );
      } catch (e) {
        if (mijnBeurt !== beurt.current) return;
        setTreffers([]);
        setMelding(e.message);
      } finally {
        if (mijnBeurt === beurt.current) setBezig(false);
      }
    }, RUST);

    return () => clearTimeout(timer);
  }, [zoekterm]);

  // Klik ernaast sluit de lijst
  useEffect(() => {
    if (!treffers) return;
    const buiten = (e) => {
      if (!vak.current?.contains(e.target)) setTreffers(null);
    };
    document.addEventListener("pointerdown", buiten);
    return () => document.removeEventListener("pointerdown", buiten);
  }, [treffers]);

  const sluit = () => {
    beurt.current += 1; // een lopend antwoord mag de lijst niet heropenen
    setTreffers(null);
    setGemarkeerd(-1);
    setBezig(false);
  };

  const kies = (plek) => {
    onKies(plek);
    setTerm(naamveld ? plek.naam : "");
    setZoekterm("");
    sluit();
  };

  const typ = (e) => {
    setTerm(e.target.value);
    setZoekterm(e.target.value);
    if (naamveld) onChange(e.target.value);
  };

  const bijToets = (e) => {
    if (e.key === "Escape") return sluit();

    // Staat er een lijst open of wordt er nog gezocht, dan kiest Enter een plek en
    // verstuurt hij het formulier niet: anders sla je een halve stop op. Als
    // naamveld mag Enter daarna gewoon opslaan.
    if (e.key === "Enter") {
      if (treffers?.length) {
        e.preventDefault();
        kies(treffers[gemarkeerd >= 0 ? gemarkeerd : 0]);
      } else if (!naamveld || bezig) {
        e.preventDefault();
      }
      return;
    }

    if (!treffers?.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setGemarkeerd((i) => (i + 1) % treffers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setGemarkeerd((i) => (i <= 0 ? treffers.length - 1 : i - 1));
    }
  };

  const open = !!treffers;

  return (
    <div className="zoeker" ref={vak}>
      <label htmlFor={id}>{label}</label>
      <div className="zoekveld">
        <Zoek />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={`${id}-lijst`}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={term}
          autoFocus={autoFocus}
          onChange={typ}
          onKeyDown={bijToets}
        />
        {bezig ? <span className="zoekstand">Zoeken…</span> : null}
      </div>

      {open ? (
        <div className="treffers" id={`${id}-lijst`} role="listbox" aria-label="Gevonden plekken">
          {treffers.length === 0 ? (
            <p className="geenTreffers">{geenTreffers}</p>
          ) : (
            treffers.map((plek, i) => (
              <button
                key={`${plek.lat},${plek.lon}`}
                type="button"
                role="option"
                aria-selected={i === gemarkeerd}
                className={i === gemarkeerd ? "aangewezen" : undefined}
                onMouseEnter={() => setGemarkeerd(i)}
                onClick={() => kies(plek)}
              >
                <Kaartspeld size={15} />
                <span>
                  <strong>{plek.naam}</strong>
                  {plek.adres ? <small>{plek.adres}</small> : null}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {melding ? <p className="zoekmelding">{melding}</p> : null}
    </div>
  );
}
