"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Het drie-puntjes-menu. Sluit bij Escape, bij een klik ernaast en zodra je een
 * actie kiest. Een actie met gevaar: true vraagt eerst om bevestiging.
 */
export default function Acties({ label = "Acties", items = [] }) {
  const [open, setOpen] = useState(false);
  const [bevestig, setBevestig] = useState(null);
  const vak = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;

    const buiten = (e) => {
      if (!vak.current?.contains(e.target)) {
        setOpen(false);
        setBevestig(null);
      }
    };
    const toets = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setBevestig(null);
      }
    };

    document.addEventListener("pointerdown", buiten);
    document.addEventListener("keydown", toets);
    return () => {
      document.removeEventListener("pointerdown", buiten);
      document.removeEventListener("keydown", toets);
    };
  }, [open]);

  const kies = (item) => {
    if (item.gevaar && bevestig !== item.naam) return setBevestig(item.naam);
    setOpen(false);
    setBevestig(null);
    item.doe();
  };

  return (
    <div className="acties" ref={vak}>
      <button
        type="button"
        className="actieknop"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setOpen((b) => !b);
          setBevestig(null);
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open ? (
        <div className="actiemenu" id={id} role="menu">
          {items.map((item, i) =>
            item.scheiding ? (
              <hr key={`lijn-${i}`} />
            ) : (
              <button
                key={item.naam}
                type="button"
                role="menuitem"
                className={item.gevaar ? "gevaarlijk" : undefined}
                onClick={() => kies(item)}
                disabled={item.uit}
              >
                {bevestig === item.naam ? "Zeker weten?" : item.naam}
                {item.nu ? <span className="nu">nu</span> : null}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
