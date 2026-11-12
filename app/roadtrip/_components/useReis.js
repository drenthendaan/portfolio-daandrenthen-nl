"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VERSIE_SLEUTEL, meldGewijzigd, schrijf } from "./api";

// Versies zijn ISO-tijden, dus later is ook alfabetisch groter
const nieuwer = (a, b) => !!a && (!b || a > b);

/**
 * De gegevens van één reis, met de drie herlaadtriggers: een nieuwe versie uit
 * useLive, het tabblad dat weer zichtbaar wordt, en een wijziging in een ander
 * tabblad. Herladen wordt uitgesteld zolang er nog iets wordt opgeslagen —
 * anders springt een net gezette waarde terug.
 */
export function useReis(begin, versieLive) {
  const [data, setData] = useState(
    begin ?? { reis: null, stops: [], dagen: {}, versie: null }
  );
  const versieRef = useRef(begin?.versie ?? null);
  const lopendRef = useRef(0);
  const ketenRef = useRef({});
  const slug = begin?.reis?.slug ?? null;

  const herlaad = useCallback(async () => {
    if (!slug || lopendRef.current) return;
    try {
      const res = await fetch(`/api/roadtrip/reizen?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const vers = await res.json();
      const ouder =
        versieRef.current && vers.versie !== versieRef.current && !nieuwer(vers.versie, versieRef.current);
      if (lopendRef.current || ouder) return;
      versieRef.current = vers.versie;
      setData(vers);
    } catch {
      /* offline: de volgende poll probeert het opnieuw */
    }
  }, [slug]);

  useEffect(() => {
    if (nieuwer(versieLive, versieRef.current)) herlaad();
  }, [versieLive, herlaad]);

  useEffect(() => {
    const bijOpslag = (e) => {
      if (e.key === VERSIE_SLEUTEL && e.newValue !== versieRef.current) herlaad();
    };
    const bijZichtbaar = () => {
      if (document.visibilityState === "visible") herlaad();
    };
    window.addEventListener("storage", bijOpslag);
    document.addEventListener("visibilitychange", bijZichtbaar);
    return () => {
      window.removeEventListener("storage", bijOpslag);
      document.removeEventListener("visibilitychange", bijZichtbaar);
    };
  }, [herlaad]);

  // Na een eigen wijziging: versie bijwerken, state patchen, andere tabbladen seinen
  const verwerk = useCallback((patch, versie) => {
    if (nieuwer(versie, versieRef.current)) versieRef.current = versie;
    setData((d) => ({ ...d, ...patch(d), versie: versieRef.current }));
    meldGewijzigd(versieRef.current);
  }, []);

  // Schrijfacties per stop achter elkaar: de server leest en schrijft het hele
  // record, dus parallelle PATCHes zouden elkaar overschrijven.
  const inDeRij = useCallback((id, actie) => {
    const vorige = ketenRef.current[id] ?? Promise.resolve();
    const volgende = vorige.catch(() => {}).then(actie);
    ketenRef.current[id] = volgende;
    return volgende;
  }, []);

  const metTeller = useCallback(async (actie) => {
    lopendRef.current += 1;
    try {
      return await actie();
    } finally {
      lopendRef.current -= 1;
    }
  }, []);

  const bewaarStop = useCallback(
    (velden) =>
      metTeller(() =>
        inDeRij(velden.id ?? "nieuw", async () => {
          const nieuw = !velden.id;
          const { stop, versie } = await schrijf("/api/roadtrip/stops", {
            method: nieuw ? "POST" : "PATCH",
            body: nieuw ? { reis: slug, ...velden } : velden,
          });
          verwerk(
            (d) => ({
              stops: nieuw
                ? [...d.stops, stop]
                : d.stops.map((s) => (s.id === stop.id ? stop : s)),
            }),
            versie
          );
          return stop;
        })
      ),
    [inDeRij, metTeller, slug, verwerk]
  );

  const verwijderStop = useCallback(
    (id) =>
      metTeller(() =>
        inDeRij(id, async () => {
          const { versie } = await schrijf(`/api/roadtrip/stops?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          verwerk((d) => ({ stops: d.stops.filter((s) => s.id !== id) }), versie);
        })
      ),
    [inDeRij, metTeller, verwerk]
  );

  const zetDagnotitie = useCallback(
    (dag, notitie) =>
      metTeller(() =>
        inDeRij(`dag-${dag}`, async () => {
          const antwoord = await schrijf("/api/roadtrip/dagen", {
            method: "PATCH",
            body: { reis: slug, dag, notitie },
          });
          verwerk(
            (d) => ({
              dagen: {
                ...d.dagen,
                [dag]: antwoord.notitie ? { notitie: antwoord.notitie } : undefined,
              },
            }),
            antwoord.versie
          );
        })
      ),
    [inDeRij, metTeller, slug, verwerk]
  );

  return { ...data, herlaad, bewaarStop, verwijderStop, zetDagnotitie };
}
