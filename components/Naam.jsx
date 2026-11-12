"use client";

import { useEffect, useRef } from "react";
import "./naam.css";

const NAAM = "Daan Drenthen";
const LINKEDIN = "https://www.linkedin.com/in/daan-drenthen";
const STRAAL = 240; // hoe ver de aanwijzer doorwerkt, in pixels
const RUST = 2600; // na zoveel ms stilte neemt de golf het weer over

// Zachte overgang: 0 blijft 0, 1 blijft 1, maar zonder knik aan de randen
const soepel = (t) => t * t * (3 - 2 * t);

export default function Naam() {
  const schermRef = useRef(null);

  useEffect(() => {
    const scherm = schermRef.current;
    if (!scherm) return;

    const letters = Array.from(scherm.querySelectorAll(".naam-letter"));
    if (!letters.length) return;

    const minderBeweging = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (minderBeweging.matches) return;

    let posities = [];
    let schermVak = scherm.getBoundingClientRect();
    const meet = () => {
      schermVak = scherm.getBoundingClientRect();
      posities = letters.map((el) => {
        const r = el.getBoundingClientRect();
        return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    };
    meet();
    // Na het laden van het lettertype staan de letters ergens anders
    if (document.fonts?.ready) document.fonts.ready.then(meet).catch(() => {});

    const huidig = new Map(letters.map((el) => [el, 0]));
    let muisX = null;
    let muisY = null;
    let laatsteBeweging = 0;
    let raf = 0;

    const beweeg = (e) => {
      muisX = e.clientX;
      muisY = e.clientY;
      laatsteBeweging = performance.now();
      scherm.dataset.actief = "ja";
      scherm.style.setProperty("--mx", `${muisX - schermVak.left}px`);
      scherm.style.setProperty("--my", `${muisY - schermVak.top}px`);
    };

    const verlaat = () => {
      muisX = null;
      muisY = null;
      scherm.dataset.actief = "nee";
    };

    // Zonder aanwijzer: een trage golf die van links naar rechts door de naam loopt
    const golf = (i, t) => {
      const f = Math.sin(t / 1600 - i * 0.38);
      return f > 0 ? f ** 2.2 * 0.85 : 0;
    };

    const stap = (t) => {
      const stil = muisX === null || t - laatsteBeweging > RUST;
      if (stil && scherm.dataset.actief === "ja" && t - laatsteBeweging > RUST) {
        scherm.dataset.actief = "nee";
      }

      posities.forEach(({ el, x, y }, i) => {
        let doel;
        if (stil) {
          doel = golf(i, t);
        } else {
          const d = Math.hypot(muisX - x, muisY - y);
          doel = d >= STRAAL ? 0 : soepel(1 - d / STRAAL);
        }
        const nu = huidig.get(el) ?? 0;
        const volgend = nu + (doel - nu) * 0.12;
        huidig.set(el, volgend);
        el.style.setProperty("--k", volgend.toFixed(3));
      });

      raf = requestAnimationFrame(stap);
    };
    raf = requestAnimationFrame(stap);

    // Buiten beeld hoeft er niets te rekenen
    const zichtbaarheid = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === "visible") raf = requestAnimationFrame(stap);
    };

    window.addEventListener("pointermove", beweeg, { passive: true });
    window.addEventListener("pointerleave", verlaat);
    window.addEventListener("resize", meet);
    window.addEventListener("scroll", meet, { passive: true });
    document.addEventListener("visibilitychange", zichtbaarheid);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", beweeg);
      window.removeEventListener("pointerleave", verlaat);
      window.removeEventListener("resize", meet);
      window.removeEventListener("scroll", meet);
      document.removeEventListener("visibilitychange", zichtbaarheid);
    };
  }, []);

  // Per woord een blok, zodat de regel tussen de woorden breekt en niet midden in een woord
  const woorden = NAAM.split(" ");
  let teller = 0;

  return (
    <div className="naam-scherm" ref={schermRef} data-actief="nee">
      <h1 className="naam">
        {woorden.map((woord, w) => (
          <span key={woord} className="naam-woord">
            {Array.from(woord).map((teken, i) => (
              <span
                key={`${woord}-${i}`}
                className="naam-letter"
                style={{ "--i": teller++ }}
              >
                <span className="naam-letter-in">{teken}</span>
              </span>
            ))}
            {w < woorden.length - 1 && <span className="naam-spatie" />}
          </span>
        ))}
      </h1>

      <a
        className="naam-link"
        href={LINKEDIN}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
        </svg>
        <span>LinkedIn</span>
      </a>
    </div>
  );
}
