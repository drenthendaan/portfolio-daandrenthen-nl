"use client";

import { useEffect, useRef, useState } from "react";

// Oplopende pauzes als de server niet antwoordt
const INTERVAL = [30_000, 60_000, 120_000, 300_000];

/**
 * Pollt alleen de versiestempel, niet de hele lijst. Pas als die verandert haalt
 * useReis de zware data opnieuw op. Staat stil zolang het tabblad verborgen is.
 */
export function useLive(beginVersie) {
  const [versie, setVersie] = useState(beginVersie ?? null);
  const [verbinding, setVerbinding] = useState("ok");
  const bezig = useRef(false);

  useEffect(() => {
    let actief = true;
    let timer = null;
    let fouten = 0;

    const plan = () => {
      if (!actief) return;
      timer = setTimeout(vraag, INTERVAL[Math.min(fouten, INTERVAL.length - 1)]);
    };

    async function vraag() {
      if (!actief || bezig.current) return plan();
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return plan();

      bezig.current = true;
      try {
        const res = await fetch("/api/roadtrip/live", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!actief) return;
        fouten = 0;
        setVerbinding("ok");
        setVersie((vorige) => (data.versie && data.versie !== vorige ? data.versie : vorige));
      } catch {
        if (!actief) return;
        fouten += 1;
        setVerbinding("weg");
      } finally {
        bezig.current = false;
        plan();
      }
    }

    const meteen = () => {
      clearTimeout(timer);
      vraag();
    };

    const bijZichtbaar = () => {
      if (document.visibilityState === "visible") meteen();
    };

    plan();
    document.addEventListener("visibilitychange", bijZichtbaar);
    window.addEventListener("focus", meteen);
    window.addEventListener("online", meteen);

    return () => {
      actief = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", bijZichtbaar);
      window.removeEventListener("focus", meteen);
      window.removeEventListener("online", meteen);
    };
  }, []);

  return { versie, verbinding };
}
