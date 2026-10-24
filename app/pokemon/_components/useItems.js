"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { meldItemsGewijzigd, schrijf } from "./api";

// Versies zijn ISO-tijden, dus een latere versie is ook alfabetisch groter
const nieuwer = (a, b) => !!a && (!b || a > b);

// Zelf toegevoegde items, labels en verzamelingen. Haalt ze opnieuw op als de itemsversie verandert
// (via /api/pokemon/live), als het tabblad weer zichtbaar wordt, of als een ander
// tabblad in deze browser iets heeft gewijzigd.
export function useItems(begin, itemsVersieLive) {
  const [data, setData] = useState(begin ?? { items: [], labels: [], verzamelingen: [], versie: null });
  const versieRef = useRef(begin?.versie ?? null);
  const lopendRef = useRef(0); // vinkjes die nog worden opgeslagen
  const volgRef = useRef({}); // per item het nummer van de laatste vinkjeswijziging
  const ketenRef = useRef({}); // per item de laatste opslag: de server leest en schrijft het hele item

  // Een antwoord dat ouder is dan wat we al hebben, of dat binnenkomt terwijl er nog een vinkje
  // wordt opgeslagen, telt niet: anders springt een net gezet vinkje terug
  const herlaad = useCallback(async () => {
    if (lopendRef.current) return;
    try {
      const res = await fetch("/api/pokemon/items", { cache: "no-store" });
      if (!res.ok) return;
      const nieuw = await res.json();
      const ouder = versieRef.current && nieuw.versie !== versieRef.current && !nieuwer(nieuw.versie, versieRef.current);
      if (lopendRef.current || ouder) return;
      versieRef.current = nieuw.versie;
      setData(nieuw);
    } catch {}
  }, []);

  useEffect(() => {
    if (nieuwer(itemsVersieLive, versieRef.current)) herlaad();
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
    if (nieuwer(versie, versieRef.current)) versieRef.current = versie;
    setData((d) => ({ ...d, ...volgende(d), versie: versieRef.current }));
    meldItemsGewijzigd(versieRef.current);
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

  // Vinkje op een item zetten, met de wijziging meteen zichtbaar. Alleen dit ene vinkje gaat naar
  // de server, en per item na elkaar, zodat snel gezette vinkjes elkaar niet overschrijven.
  const zetStatus = useCallback(
    async (id, veld, aan) => {
      const oud = data.items.find((i) => i.id === id);
      if (!oud) return;
      const zet = (f) => setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? f(i) : i)) }));
      const nr = (volgRef.current[id] = (volgRef.current[id] ?? 0) + 1);
      zet((i) => ({ ...i, status: { ...i.status, [veld]: aan } }));
      lopendRef.current++;
      try {
        const deze = (ketenRef.current[id] ?? Promise.resolve())
          .catch(() => {})
          .then(() => schrijf("/api/pokemon/items", { method: "PATCH", body: { id, status: { [veld]: aan } } }));
        ketenRef.current[id] = deze;
        const res = await deze;
        // Een antwoord op een eerder vinkje mag een nieuwer vinkje niet terugzetten
        if (volgRef.current[id] === nr) verwerk((d) => ({ items: d.items.map((i) => (i.id === id ? res.item : i)) }), res.versie);
      } catch (e) {
        if (volgRef.current[id] === nr) zet((i) => ({ ...i, status: { ...i.status, [veld]: !!oud.status?.[veld] } }));
        throw e;
      } finally {
        lopendRef.current--;
      }
    },
    [data.items, verwerk]
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
