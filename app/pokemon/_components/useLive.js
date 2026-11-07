"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Interval van het opvragen: 30 s, en langzamer bij fouten
const INTERVAL = [30_000, 60_000, 120_000, 300_000];

// Houdt de prijzen bij en meldt wanneer de items gewijzigd zijn (de itemsversie). Vraagt de stand
// op zolang het tabblad zichtbaar is, en direct opnieuw bij terugkeren.
export function useLive({ beginPrijzen }) {
  const [prijsData, setPrijsData] = useState(beginPrijzen);
  const [verbinding, setVerbinding] = useState("ok");
  const [puls, setPuls] = useState(0);
  const [itemsVersie, setItemsVersie] = useState(null);
  const versieRef = useRef(beginPrijzen?.versie ?? null);

  const haalPrijzen = useCallback(async () => {
    const res = await fetch("/api/pokemon/prijzen", { cache: "no-store" });
    const data = res.ok ? await res.json() : null;
    if (data?.versie && data.versie !== versieRef.current) {
      versieRef.current = data.versie;
      setPrijsData(data);
      setPuls((p) => p + 1);
    }
  }, []);

  useEffect(() => {
    let timer;
    let fouten = 0;
    let bezig = false;
    let actief = true;

    const vraag = async () => {
      clearTimeout(timer);
      if (bezig || document.visibilityState !== "visible") return;
      bezig = true;
      try {
        const res = await fetch("/api/pokemon/live", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        fouten = 0;
        setVerbinding("ok");
        if (data.itemsVersie) setItemsVersie(data.itemsVersie);
        if (data.versie && data.versie !== versieRef.current) await haalPrijzen();
      } catch {
        fouten++;
        setVerbinding("offline");
      } finally {
        bezig = false;
      }
      if (actief) timer = setTimeout(vraag, INTERVAL[Math.min(fouten, INTERVAL.length - 1)]);
    };
    const opnieuw = () => {
      if (document.visibilityState === "visible") vraag();
    };

    timer = setTimeout(vraag, INTERVAL[0]);
    document.addEventListener("visibilitychange", opnieuw);
    window.addEventListener("focus", opnieuw);
    window.addEventListener("online", opnieuw);
    return () => {
      actief = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", opnieuw);
      window.removeEventListener("focus", opnieuw);
      window.removeEventListener("online", opnieuw);
    };
  }, [haalPrijzen]);

  return { prijsData, verbinding, puls, haalPrijzen, itemsVersie };
}
