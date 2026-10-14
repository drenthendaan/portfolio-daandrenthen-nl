"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { meldItemsGewijzigd, schrijf } from "./api";

// Zelf toegevoegde items, labels en verzamelingen. Haalt ze opnieuw op als de itemsversie verandert
// (via /api/pokemon/live), als het tabblad weer zichtbaar wordt, of als een ander
// tabblad in deze browser iets heeft gewijzigd.
export function useItems(begin, itemsVersieLive) {
  const [data, setData] = useState(begin ?? { items: [], labels: [], verzamelingen: [], versie: null });
  const versieRef = useRef(begin?.versie ?? null);

  const herlaad = useCallback(async () => {
    try {
      const res = await fetch("/api/pokemon/items", { cache: "no-store" });
      if (!res.ok) return;
      const nieuw = await res.json();
      versieRef.current = nieuw.versie;
      setData(nieuw);
    } catch {}
  }, []);

  useEffect(() => {
    if (itemsVersieLive && itemsVersieLive !== versieRef.current) herlaad();
  }, [itemsVersieLive, herlaad]);

  useEffect(() => {
    const opslag = (e) => {
      if (e.key === "pk-items-versie" && e.newValue !== versieRef.current) herlaad();
    };
    const zichtbaar = () => {
      if (document.visibilityState === "visible") herlaad();
    };
    window.addEventListener("storage", opslag);
    document.addEventListener("visibilitychange", zichtbaar);
    return () => {
      window.removeEventListener("storage", opslag);
      document.removeEventListener("visibilitychange", zichtbaar);
    };
  }, [herlaad]);

  // Na een eigen wijziging: lokaal bijwerken en andere tabbladen seintje geven
  const verwerk = useCallback((volgende, versie) => {
    versieRef.current = versie;
    setData((d) => ({ ...d, ...volgende(d), versie }));
    meldItemsGewijzigd(versie);
  }, []);

  const bewaar = useCallback(
    async (invoer, id) => {
      const res = id
        ? await schrijf("/api/pokemon/items", { method: "PATCH", body: { id, ...invoer } })
        : await schrijf("/api/pokemon/items", { method: "POST", body: invoer });
      verwerk(
        (d) => ({
          items: id ? d.items.map((i) => (i.id === id ? res.item : i)) : [...d.items, res.item],
        }),
        res.versie
      );
      return res.item;
    },
    [verwerk]
  );

  const verwijder = useCallback(
    async (id) => {
      const res = await schrijf(`/api/pokemon/items?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      verwerk((d) => ({ items: d.items.filter((i) => i.id !== id) }), res.versie);
    },
    [verwerk]
  );

  const maakLabel = useCallback(
    async (naam) => {
      const res = await schrijf("/api/pokemon/labels", { body: { naam } });
      verwerk((d) => ({ labels: [...d.labels, res.label] }), res.versie);
      return res.label;
    },
    [verwerk]
  );

  // Vinkje op een item zetten, met de wijziging meteen zichtbaar
  const zetStatus = useCallback(
    async (id, veld, aan) => {
      const oud = data.items.find((i) => i.id === id);
      if (!oud) return;
      const status = { ...oud.status, [veld]: aan };
      setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, status } : i)) }));
      try {
        await bewaar({ status }, id);
      } catch (e) {
        setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? oud : i)) }));
        throw e;
      }
    },
    [data.items, bewaar]
  );

  const maakVerzameling = useCallback(
    async (naam) => {
      const res = await schrijf("/api/pokemon/verzamelingen", { body: { naam } });
      verwerk((d) => ({ verzamelingen: [...(d.verzamelingen ?? []), res.verzameling] }), res.versie);
      return res.verzameling;
    },
    [verwerk]
  );

  // { naam } | { nieuwThema } | { verwijderThema } | { verberg } | { toon }
  const wijzigVerzameling = useCallback(
    async (id, invoer) => {
      const res = await schrijf("/api/pokemon/verzamelingen", { method: "PATCH", body: { id, ...invoer } });
      verwerk(
        (d) => ({ verzamelingen: (d.verzamelingen ?? []).map((v) => (v.id === id ? res.verzameling : v)) }),
        res.versie
      );
      return res;
    },
    [verwerk]
  );

  const verwijderVerzameling = useCallback(
    async (id) => {
      const res = await schrijf(`/api/pokemon/verzamelingen?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      verwerk(
        (d) => ({
          verzamelingen: (d.verzamelingen ?? []).filter((v) => v.id !== id),
          items: d.items.map((i) => (i.verzameling === id ? { ...i, verzameling: null, thema: null, map: null } : i)),
        }),
        res.versie
      );
    },
    [verwerk]
  );

  return {
    ...data,
    verzamelingen: data.verzamelingen ?? [],
    herlaad,
    bewaar,
    verwijder,
    maakLabel,
    zetStatus,
    maakVerzameling,
    wijzigVerzameling,
    verwijderVerzameling,
  };
}
