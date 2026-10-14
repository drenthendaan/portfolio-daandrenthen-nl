"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { naarBits, vanBits } from "@/lib/pokemon/regels.mjs";

// Interval van het opvragen: 30 s, en langzamer bij fouten
const INTERVAL = [30_000, 60_000, 120_000, 300_000];

function lsJSON(sleutel) {
  try {
    const v = JSON.parse(localStorage.getItem(sleutel) || "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

// { id: {w,b,o,a} } → { id: bits } (alleen kaarten met iets aan)
function bitsVan(statusObject) {
  const uit = {};
  for (const [id, v] of Object.entries(statusObject || {})) {
    const b = naarBits(v);
    if (b) uit[id] = b;
  }
  return uit;
}

function zelfde(a, b) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

// Houdt de vinkjes en prijzen bij. Vraagt de stand op zolang het tabblad zichtbaar is,
// direct opnieuw bij terugkeren, en volgt wijzigingen uit andere tabbladen in dezelfde
// browser via het storage-event (de Pikachu-pagina schrijft "pika-status").
export function useLive({ beginBits, beginPrijzen }) {
  const [bits, setBits] = useState(beginBits);
  const [prijsData, setPrijsData] = useState(beginPrijzen);
  const [verbinding, setVerbinding] = useState("ok");
  const [puls, setPuls] = useState(0);
  const [itemsVersie, setItemsVersie] = useState(null);
  const bitsRef = useRef(beginBits);
  const serverRef = useRef(beginBits);
  const versieRef = useRef(beginPrijzen?.versie ?? null);

  const zet = useCallback((volgende) => {
    if (zelfde(volgende, bitsRef.current)) return;
    bitsRef.current = volgende;
    setBits(volgende);
    setPuls((p) => p + 1);
  }, []);

  // Serverstand, met nog niet verstuurde wijzigingen van dit apparaat erover
  const pasToe = useCallback(
    (server) => {
      serverRef.current = server;
      const volgende = { ...server };
      for (const [id, v] of Object.entries(lsJSON("pika-pending") ?? {})) {
        const b = naarBits(v);
        if (b) volgende[id] = b;
        else delete volgende[id];
      }
      zet(volgende);
    },
    [zet]
  );

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
        pasToe(data.status || {});
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
    const opslag = (e) => {
      if (e.key === "pika-status") {
        const lokaal = lsJSON("pika-status");
        if (lokaal) zet(bitsVan(lokaal));
      } else if (e.key === "pika-pending") {
        pasToe(serverRef.current);
      }
    };

    pasToe(serverRef.current);
    timer = setTimeout(vraag, INTERVAL[0]);
    document.addEventListener("visibilitychange", opnieuw);
    window.addEventListener("focus", opnieuw);
    window.addEventListener("online", opnieuw);
    window.addEventListener("storage", opslag);
    return () => {
      actief = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", opnieuw);
      window.removeEventListener("focus", opnieuw);
      window.removeEventListener("online", opnieuw);
      window.removeEventListener("storage", opslag);
    };
  }, [pasToe, zet, haalPrijzen]);

  const status = useMemo(
    () => Object.fromEntries(Object.entries(bits).map(([id, b]) => [id, vanBits(b)])),
    [bits]
  );
  return { status, prijsData, verbinding, puls, haalPrijzen, itemsVersie };
}
