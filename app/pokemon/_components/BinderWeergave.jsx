"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { spreads } from "@/lib/pokemon/binders.mjs";
import KaartAfbeelding from "./KaartAfbeelding";

const Pijl = ({ richting }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d={richting === "links" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Breed scherm: twee pagina's naast elkaar zoals een opengeslagen map; smal: één pagina
function useBreed() {
  const [breed, setBreed] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 700px)");
    const zet = () => setBreed(mq.matches);
    zet();
    mq.addEventListener("change", zet);
    return () => mq.removeEventListener("change", zet);
  }, []);
  return breed;
}

// De binder met de kaarten op hun plek.
//   binder: { naam, vakjes, kolommen, paginas, kleur }
//   plekken: [{ id, pagina, vakje, naam, img, status: { b, a } }]
//   pagina / onPagina: welke pagina open staat (de ouder kan ernaar laten springen)
export default function BinderWeergave({ binder, plekken, pagina, onPagina, onOpen }) {
  const breed = useBreed();
  const veeg = useRef(null);

  const perPagina = useMemo(() => {
    const m = new Map();
    for (const p of plekken) {
      if (!m.has(p.pagina)) m.set(p.pagina, []);
      m.get(p.pagina).push(p);
    }
    return m;
  }, [plekken]);
  const aantal = Math.max(binder.paginas, ...plekken.map((p) => p.pagina), 1);
  const reeks = useMemo(() => (breed ? spreads(aantal) : Array.from({ length: aantal }, (_, i) => [i + 1])), [breed, aantal]);
  const index = Math.max(0, reeks.findIndex((s) => s.includes(pagina)));
  const zichtbaar = reeks[index];
  const ga = (i) => {
    const doel = reeks[Math.min(reeks.length - 1, Math.max(0, i))];
    onPagina(doel[0]);
  };

  // Hoeveel vakjes er gevuld zijn, en in bezit
  const gevuld = plekken.length;
  const inBezit = plekken.filter((p) => p.status.a).length;

  return (
    <div className="binderblok">
      <div className="binder-nav">
        <button type="button" onClick={() => ga(index - 1)} disabled={index === 0} aria-label="Vorige pagina">
          <Pijl richting="links" />
        </button>
        <label className="visually-hidden" htmlFor="binder-pagina">
          Ga naar pagina
        </label>
        <select id="binder-pagina" className="keuze" value={zichtbaar[0]} onChange={(e) => onPagina(Number(e.target.value))}>
          {reeks.map((s) => (
            <option key={s[0]} value={s[0]}>
              {s.length > 1 ? `Pagina ${s[0]}–${s[1]}` : `Pagina ${s[0]}`}
              {s.some((p) => perPagina.has(p)) ? "" : " (leeg)"}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => ga(index + 1)} disabled={index === reeks.length - 1} aria-label="Volgende pagina">
          <Pijl richting="rechts" />
        </button>
      </div>

      <div
        className={`binder${breed ? " open" : ""}`}
        style={{ "--binderkleur": binder.kleur, "--kolommen": binder.kolommen }}
        tabIndex={0}
        aria-label={`${binder.naam}, ${zichtbaar.length > 1 ? `pagina ${zichtbaar[0]} en ${zichtbaar[1]}` : `pagina ${zichtbaar[0]}`}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") ga(index - 1);
          if (e.key === "ArrowRight") ga(index + 1);
        }}
        onTouchStart={(e) => {
          veeg.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (veeg.current == null) return;
          const dx = e.changedTouches[0].clientX - veeg.current;
          veeg.current = null;
          if (Math.abs(dx) > 50) ga(index + (dx < 0 ? 1 : -1));
        }}
      >
        {/* Pagina 1 staat rechts als de map openligt */}
        {breed && zichtbaar.length === 1 && zichtbaar[0] === 1 && <div className="binder-pagina leeg-blad" aria-hidden="true" />}
        {zichtbaar.map((p) => (
          <BinderPagina
            key={p}
            nummer={p}
            binder={binder}
            kaarten={perPagina.get(p) ?? []}
            onOpen={onOpen}
          />
        ))}
        {breed && zichtbaar.length === 1 && zichtbaar[0] !== 1 && <div className="binder-pagina leeg-blad" aria-hidden="true" />}
      </div>

      <p className="binder-info">
        {binder.naam} · {gevuld} van {binder.vakjes * binder.paginas} vakjes gevuld · {inBezit} in bezit
      </p>
    </div>
  );
}

function BinderPagina({ nummer, binder, kaarten, onOpen }) {
  const vakjes = Array.from({ length: binder.vakjes }, (_, i) => kaarten.filter((k) => k.vakje === i + 1));
  return (
    <section className="binder-pagina" aria-label={`Pagina ${nummer}`}>
      <ol className="binder-vakjes">
        {vakjes.map((hier, i) => {
          const k = hier[0];
          if (!k) {
            return (
              <li key={i} className="vak leeg">
                <span className="vaknr">{i + 1}</span>
              </li>
            );
          }
          const stand = k.status.a ? "bezit" : k.status.b ? "betaald" : "nog";
          return (
            <li key={i} className={`vak ${stand}`}>
              <button
                type="button"
                onClick={() => onOpen(k)}
                aria-label={`Vakje ${nummer}.${i + 1}: ${k.naam}, ${stand === "bezit" ? "in bezit" : stand === "betaald" ? "betaald, nog niet binnen" : k.status.w ? "op je wantlist" : "nog niet"}`}
              >
                <KaartAfbeelding key={k.img.join()} img={k.img} />
                {stand === "betaald" && <span className="vaklabel">betaald</span>}
                {stand === "nog" && k.status.w && <span className="vaklabel want">wantlist</span>}
                {hier.length > 1 && <span className="vakdubbel">+{hier.length - 1}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="binder-paginanr">Pagina {nummer}</p>
    </section>
  );
}
