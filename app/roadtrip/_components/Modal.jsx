"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Alles waar je met Tab naartoe kunt. Binnen een venster blijft de focus hier,
// zodat je niet per ongeluk in de pagina erachter belandt.
// Vensters kunnen op elkaar komen: mis je het token, dan verschijnt dat venster
// boven het formulier waar je mee bezig was. Alleen het bovenste luistert naar
// Escape en houdt de focus vast, anders vechten ze erom.
const stapel = [];

const FOCUSBAAR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Eén venster voor alles wat je aanpast. Het hangt in een portal aan de body,
 * zodat geen enkele kaart of overflow het kan afknippen.
 *
 * Sluit met Escape, met de kruisknop en door naast het venster te klikken.
 */
export default function Modal({ titel, onSluit, children, breed = false }) {
  const [gemonteerd, setGemonteerd] = useState(false);
  const paneel = useRef(null);
  // Waar de focus stond voordat het venster openging, zodat hij daar terugkomt
  const vorigeFocus = useRef(null);
  const id = useId();

  useEffect(() => setGemonteerd(true), []);

  useEffect(() => {
    if (!gemonteerd) return;

    const ik = {};
    stapel.push(ik);
    vorigeFocus.current = document.activeElement;

    // De pagina erachter mag niet meescrollen
    const vorigeOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Heeft een veld zichzelf al de focus gegeven met autoFocus, laat die staan.
    // Zo niet: het eerste veld in de inhoud, en anders het paneel zelf — de
    // kruisknop is de laatste keus, daar wil je zelden beginnen.
    if (!paneel.current?.contains(document.activeElement)) {
      const inhoud = paneel.current?.querySelector(".modaalinhoud");
      const eerste = inhoud?.querySelector(FOCUSBAAR) ?? paneel.current?.querySelector(FOCUSBAAR);
      (eerste ?? paneel.current)?.focus();
    }

    const toets = (e) => {
      if (stapel[stapel.length - 1] !== ik) return;

      if (e.key === "Escape") {
        e.stopPropagation();
        onSluit?.();
        return;
      }
      if (e.key !== "Tab") return;

      const bij = [
        ...(paneel.current?.querySelectorAll(FOCUSBAAR) ?? []),
      ].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!bij.length) return;

      const eerste = bij[0];
      const laatste = bij[bij.length - 1];

      // Aan het eind van de rij weer vooraan beginnen, en andersom
      if (e.shiftKey && document.activeElement === eerste) {
        e.preventDefault();
        laatste.focus();
      } else if (!e.shiftKey && document.activeElement === laatste) {
        e.preventDefault();
        eerste.focus();
      }
    };

    document.addEventListener("keydown", toets, true);
    return () => {
      const plek = stapel.indexOf(ik);
      if (plek !== -1) stapel.splice(plek, 1);
      document.removeEventListener("keydown", toets, true);
      document.body.style.overflow = vorigeOverflow;

      // Terug naar waar je vandaan kwam, als dat element er nog is. Een frame
      // later, want gaat er meteen een ander venster open — van kijken naar
      // aanpassen — dan zou dit de focus wegtrekken bij het veld dat hem net
      // gekregen had. Staat er dan een venster op de stapel, dan springen we
      // niet terug.
      const terug = vorigeFocus.current;
      requestAnimationFrame(() => {
        if (!stapel.length && terug?.isConnected) terug.focus();
      });
    };
  }, [gemonteerd, onSluit]);

  if (!gemonteerd) return null;

  return createPortal(
    <div
      className="trip modaalgrond"
      // Alleen een klik op de achtergrond zelf sluit; een klik die in het
      // paneel begon en buiten eindigt (slepen in een veld) niet.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onSluit?.();
      }}
    >
      <div
        className={`modaal${breed ? " breed" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titel`}
        tabIndex={-1}
        ref={paneel}
      >
        <div className="modaalkop">
          <h2 id={`${id}-titel`}>{titel}</h2>
          <button
            type="button"
            className="modaalsluit"
            onClick={onSluit}
            aria-label="Sluiten"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>

        <div className="modaalinhoud">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
