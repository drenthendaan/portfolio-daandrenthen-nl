"use client";

import { useEffect, useRef, useState } from "react";

// Bedrag dat soepel naar een nieuwe waarde optelt. De server rendert meteen de eindwaarde;
// alleen wijzigingen daarna worden geanimeerd (niet bij "minder beweging").
export default function Telwaarde({ cent, format }) {
  const [getoond, setGetoond] = useState(cent);
  const huidig = useRef(cent);
  const frame = useRef(0);

  useEffect(() => {
    const van = huidig.current;
    if (van === cent) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      huidig.current = cent;
      setGetoond(cent);
      return;
    }
    const start = performance.now();
    const stap = (nu) => {
      const x = Math.min(1, (nu - start) / 900);
      const v = Math.round(van + (cent - van) * (1 - Math.pow(1 - x, 3)));
      huidig.current = v;
      setGetoond(v);
      if (x < 1) frame.current = requestAnimationFrame(stap);
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(frame.current);
  }, [cent]);

  return (
    <>
      <span aria-hidden="true">{format(getoond)}</span>
      <span className="visually-hidden" aria-live="polite">
        {format(cent)}
      </span>
    </>
  );
}
