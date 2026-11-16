"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { schrijfCube } from "@/lib/creative/thailand/cube.mjs";
import { decodeer, isHeic, leesExif, maakMiniatuur, maakVoorbeeld } from "@/lib/creative/thailand/inlezen.js";
import { bakLut, lookVoor } from "@/lib/creative/thailand/look.mjs";
import { SCHERP, SNEL, maakLutBakker } from "@/lib/creative/thailand/lut-bakker.js";
import { bestandsnaam, bewaar, download, metExif, naarJpeg } from "@/lib/creative/thailand/opslaan.js";
import Schuifjes, { STANDAARD } from "./Schuifjes";
import Voorbeeld from "./Voorbeeld";

// Zoveel verkleinde voorbeelden blijven in het geheugen; de rest lees ik opnieuw in
const MAX_VOORBEELDEN = 8;
// Pixels die oudere iPhones (iOS 17 en eerder) nog in één canvas aankunnen
const VEILIG_CANVAS = 16_000_000;

let teller = 0;
const nieuwId = () => `f${Date.now().toString(36)}${(teller++).toString(36)}`;

export default function Filter() {
  const [fotos, setFotos] = useState([]);
  const [actiefId, setActiefId] = useState(null);
  const [schuifjes, setSchuifjes] = useState(STANDAARD);
  const [renderer, setRenderer] = useState(null);
  const [fotoHandle, setFotoHandle] = useState(null);
  const [lutVersie, setLutVersie] = useState(0);
  const [tekenTeller, setTekenTeller] = useState(0);
  const [bezig, setBezig] = useState(null);
  const [melding, setMelding] = useState(null);
  const [nogBewaren, setNogBewaren] = useState(null);
  const [slepen, setSlepen] = useState(false);
  const [accept, setAccept] = useState("image/*");
  const [opTelefoon, setOpTelefoon] = useState(false);

  const rendererRef = useRef(null);
  const bakkerRef = useRef(null);
  const handleRef = useRef(null);
  const voorbeelden = useRef(new Map());
  const invoerRef = useRef(null);

  const kleur = useMemo(
    () => ({ sterkte: schuifjes.sterkte / 100, fade: schuifjes.fade / 100, warmte: schuifjes.warmte / 100 }),
    [schuifjes.sterkte, schuifjes.fade, schuifjes.warmte],
  );
  const effecten = useMemo(() => ({ grain: schuifjes.grain / 100, glow: schuifjes.glow / 100 }), [schuifjes.grain, schuifjes.glow]);

  const actief = fotos.find((f) => f.id === actiefId) ?? null;
  const klaar = fotos.filter((f) => f.status === "klaar");

  useEffect(() => {
    // Safari zet bij een gemengde accept-lijst alles om naar het eerste type;
    // andere browsers kennen HEIC niet als image/* en hebben de extensies nodig
    const safari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
    if (!safari) setAccept("image/*,.heic,.heif");
    setOpTelefoon(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const werkBij = useCallback(
    (id, wijziging) => setFotos((lijst) => lijst.map((f) => (f.id === id ? { ...f, ...wijziging } : f))),
    [],
  );

  const bewaarVoorbeeld = useCallback((id, voorbeeld) => {
    const cache = voorbeelden.current;
    cache.delete(id);
    cache.set(id, voorbeeld);
    while (cache.size > MAX_VOORBEELDEN) cache.delete(cache.keys().next().value);
  }, []);

  // Verkleind beeld uit het geheugen, of opnieuw inlezen
  const voorbeeldVan = useCallback(
    async (foto) => {
      const bekend = voorbeelden.current.get(foto.id);
      if (bekend) {
        bewaarVoorbeeld(foto.id, bekend);
        return bekend;
      }
      const gedecodeerd = await decodeer(foto.bestand);
      try {
        const voorbeeld = {
          beeld: maakVoorbeeld(gedecodeerd),
          p3: gedecodeerd.p3,
          breedte: gedecodeerd.breedte,
          hoogte: gedecodeerd.hoogte,
        };
        bewaarVoorbeeld(foto.id, voorbeeld);
        return voorbeeld;
      } finally {
        gedecodeerd.sluit();
      }
    },
    [bewaarVoorbeeld],
  );

  const voegToe = useCallback(
    async (lijst) => {
      const bestanden = [...lijst].filter((b) => b.type.startsWith("image/") || isHeic(b));
      if (!bestanden.length) {
        setMelding({ tekst: "Daar zat geen foto bij die ik kan openen.", fout: true });
        return;
      }
      setMelding(null);
      const nieuw = bestanden.map((bestand) => ({
        id: nieuwId(),
        naam: bestand.name,
        bestand,
        status: "laden",
        // Vaste ruis per foto: het grain in het voorbeeld en in de export is hetzelfde
        zaad: 1 + Math.floor(Math.random() * 999_999),
      }));
      setFotos((oud) => [...oud, ...nieuw]);
      setActiefId((huidig) => huidig ?? nieuw[0].id);

      // Eén voor één: een stapel van 24 MP-foto's tegelijk past niet in een telefoon
      for (const foto of nieuw) {
        try {
          const gedecodeerd = await decodeer(foto.bestand);
          try {
            bewaarVoorbeeld(foto.id, {
              beeld: maakVoorbeeld(gedecodeerd),
              p3: gedecodeerd.p3,
              breedte: gedecodeerd.breedte,
              hoogte: gedecodeerd.hoogte,
            });
            werkBij(foto.id, { status: "klaar", miniatuur: await maakMiniatuur(gedecodeerd) });
          } finally {
            gedecodeerd.sluit();
          }
        } catch (fout) {
          werkBij(foto.id, { status: "fout", fout: fout?.message || "Deze foto kon ik niet openen." });
        }
      }
    },
    [bewaarVoorbeeld, werkBij],
  );

  // De actieve foto in de renderer zetten
  const actiefKlaar = actief?.status === "klaar";
  useEffect(() => {
    if (!renderer || !actief || !actiefKlaar) return undefined;
    let gestopt = false;
    voorbeeldVan(actief)
      .then((v) => {
        if (gestopt || renderer.verloren) return;
        const handle = renderer.laadFoto(v.beeld, {
          p3: v.p3,
          volledigeBreedte: v.breedte,
          volledigeHoogte: v.hoogte,
          zaad: actief.zaad,
        });
        if (handleRef.current) renderer.verwijderFoto(handleRef.current);
        handleRef.current = handle;
        setFotoHandle(handle);
      })
      .catch((fout) => werkBij(actief.id, { status: "fout", fout: fout?.message }));
    return () => {
      gestopt = true;
    };
    // Alleen opnieuw laden als de foto zelf wisselt, niet bij elke wijziging in de lijst
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, actief?.id, actiefKlaar, voorbeeldVan, werkBij]);

  // Geen foto's meer: voorbeeld opruimen
  useEffect(() => {
    if (fotos.length || !handleRef.current) return;
    rendererRef.current?.verwijderFoto(handleRef.current);
    handleRef.current = null;
    setFotoHandle(null);
  }, [fotos.length]);

  // Kleur-sliders → LUT (in een worker). Tijdens schuiven 33³, daarna 65³.
  useEffect(() => {
    const bakker = maakLutBakker((lut, N) => {
      const r = rendererRef.current;
      if (!r || r.verloren) return;
      r.zetLut(lut, N);
      setLutVersie((v) => v + 1);
    });
    bakkerRef.current = bakker;
    return () => {
      bakker.stop();
      bakkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!renderer) return undefined;
    bakkerRef.current?.bak(kleur, SNEL);
    const scherp = setTimeout(() => bakkerRef.current?.bak(kleur, SCHERP), 250);
    return () => clearTimeout(scherp);
  }, [renderer, kleur]);

  // Bestanden boven de hele pagina laten vallen
  useEffect(() => {
    let diepte = 0;
    const metBestanden = (e) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const binnen = (e) => {
      if (!metBestanden(e)) return;
      e.preventDefault();
      diepte++;
      setSlepen(true);
    };
    const boven = (e) => {
      if (!metBestanden(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const buiten = (e) => {
      if (!metBestanden(e)) return;
      diepte = Math.max(0, diepte - 1);
      if (!diepte) setSlepen(false);
    };
    const los = (e) => {
      if (!metBestanden(e)) return;
      e.preventDefault();
      diepte = 0;
      setSlepen(false);
      voegToe(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", binnen);
    window.addEventListener("dragover", boven);
    window.addEventListener("dragleave", buiten);
    window.addEventListener("drop", los);
    return () => {
      window.removeEventListener("dragenter", binnen);
      window.removeEventListener("dragover", boven);
      window.removeEventListener("dragleave", buiten);
      window.removeEventListener("drop", los);
    };
  }, [voegToe]);

  const kies = () => invoerRef.current?.click();

  const verwijder = (id) => {
    const weg = fotos.find((f) => f.id === id);
    if (weg?.miniatuur) URL.revokeObjectURL(weg.miniatuur);
    voorbeelden.current.delete(id);
    const rest = fotos.filter((f) => f.id !== id);
    setFotos((lijst) => lijst.filter((f) => f.id !== id));
    if (actiefId === id) setActiefId(rest[0]?.id ?? null);
  };

  const bewaarResultaat = useCallback(async (bestanden) => {
    try {
      const uitkomst = await bewaar(bestanden);
      setNogBewaren(null);
      if (uitkomst === "gedownload") {
        setMelding({
          tekst:
            bestanden.length > 1
              ? `Je ${bestanden.length} foto's staan in je downloads, samen in een zip.`
              : `${bestanden[0].name} staat in je downloads.`,
        });
      } else if (uitkomst === "gedeeld") {
        setMelding({ tekst: "Bewaard." });
      }
    } catch (fout) {
      // Het maken duurde te lang: de browser wil voor het deelmenu een nieuwe tik
      if (fout?.name === "NotAllowedError") setNogBewaren(bestanden);
      else setMelding({ tekst: "Bewaren lukte niet. Probeer het nog eens.", fout: true });
    }
  }, []);

  const exporteer = useCallback(
    async (lijst) => {
      const r = rendererRef.current;
      if (!r || !lijst.length) return;
      setMelding(null);
      setNogBewaren(null);
      const resultaten = [];
      let verkleind = false;
      try {
        setBezig({ tekst: "Kleur klaarzetten…", voortgang: 0 });
        // De export krijgt altijd de scherpe 65³-LUT met de huidige sliders
        await bakkerRef.current?.bak(kleur, SCHERP);
        for (let i = 0; i < lijst.length; i++) {
          const foto = lijst[i];
          const voortgang = (deel) =>
            setBezig({
              tekst: lijst.length > 1 ? `Foto ${i + 1} van ${lijst.length}…` : "Je foto wordt gemaakt…",
              voortgang: (i + deel) / lijst.length,
            });
          voortgang(0);
          const v = await voorbeeldVan(foto);
          const eigen = foto.id === actiefId && handleRef.current;
          const handle =
            eigen ||
            r.laadFoto(v.beeld, { p3: v.p3, volledigeBreedte: v.breedte, volledigeHoogte: v.hoogte, zaad: foto.zaad });
          const gedecodeerd = await decodeer(foto.bestand);
          try {
            if (Math.max(gedecodeerd.breedte, gedecodeerd.hoogte) > r.maxTextuur) {
              throw new Error(`${foto.naam} is te groot voor dit apparaat.`);
            }
            const opties = { opVoortgang: (d) => voortgang(d * 0.9) };
            let jpeg;
            try {
              jpeg = await naarJpeg(await r.exporteer(handle, gedecodeerd, effecten, opties));
            } catch (fout) {
              if (r.verloren) throw fout;
              // Te groot canvas op een oudere iPhone: dan iets kleiner
              const schaal = Math.min(1, Math.sqrt(VEILIG_CANVAS / (gedecodeerd.breedte * gedecodeerd.hoogte)));
              jpeg = await naarJpeg(await r.exporteer(handle, gedecodeerd, effecten, { ...opties, schaal }));
              verkleind = true;
            }
            jpeg = await metExif(jpeg, await leesExif(foto.bestand));
            resultaten.push(new File([jpeg], bestandsnaam(foto.naam), { type: "image/jpeg" }));
          } finally {
            gedecodeerd.sluit();
            if (!eigen) r.verwijderFoto(handle);
          }
        }
      } catch (fout) {
        setMelding({ tekst: fout?.message || "Er ging iets mis bij het maken van je foto.", fout: true });
        return;
      } finally {
        setBezig(null);
        setTekenTeller((t) => t + 1);
      }
      await bewaarResultaat(resultaten);
      if (verkleind) {
        setMelding({ tekst: "Je apparaat kon de volle grootte niet aan, dus de foto is iets kleiner bewaard." });
      }
    },
    [actiefId, effecten, kleur, voorbeeldVan, bewaarResultaat],
  );

  const downloadCube = () => {
    const lut = bakLut(lookVoor(kleur), 33);
    download(new File([schrijfCube(lut, 33, "Thailand")], "thailand.cube", { type: "text/plain" }));
  };

  // Alleen tijdens ontwikkelen: handvatten om in de console te testen
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    window.__thailand = {
      rendererRef,
      handleRef,
      voorbeelden,
      fotos,
      kleur,
      effecten,
      exporteer,
      decodeer,
      naarJpeg,
      metExif,
      leesExif,
    };
  });

  return (
    <main className="tf">
      <header className="tf-kop">
        <p className="tf-kruimel">
          <Link href="/creative">Creative</Link> / Thailand-filter
        </p>
        <h1>Thailand-filter</h1>
        <p>
          Geef je foto's de look van analoge film uit Thailand: zachte, groen getinte zwarten, een teal lucht en
          olijfgroen. Sleep ze erin, schuif wat bij en bewaar.
        </p>
      </header>

      <input
        ref={invoerRef}
        className="tf-verborgen"
        type="file"
        multiple
        accept={accept}
        onChange={(e) => {
          voegToe(e.target.files);
          e.target.value = "";
        }}
      />

      {fotos.length === 0 ? (
        <button type="button" className="tf-drop" onClick={kies}>
          <span className="tf-drop-titel">{opTelefoon ? "Tik om je foto's te kiezen" : "Sleep je foto's hierheen"}</span>
          <span className="knop">Kies foto's</span>
          <span className="tf-drop-klein">JPG, HEIC of PNG · meerdere tegelijk · ze blijven op je apparaat</span>
        </button>
      ) : (
        <div className="tf-werkblad">
          <section>
            <Voorbeeld
              rendererRef={rendererRef}
              foto={fotoHandle}
              effecten={effecten}
              lutVersie={lutVersie}
              tekenTeller={tekenTeller}
              fotoFout={actief?.status === "fout" ? actief.fout : null}
              opRenderer={setRenderer}
            />
            <div className="tf-strook" aria-label="Je foto's">
              {fotos.map((f) => (
                <div key={f.id} className="tf-mini">
                  <button
                    type="button"
                    className={`tf-mini-knop ${f.status}`}
                    style={f.miniatuur ? { backgroundImage: `url(${f.miniatuur})` } : undefined}
                    aria-current={f.id === actiefId}
                    aria-label={f.naam}
                    title={f.status === "fout" ? f.fout : f.naam}
                    onClick={() => setActiefId(f.id)}
                  >
                    {f.status === "fout" ? "!" : null}
                  </button>
                  <button type="button" className="tf-mini-weg" aria-label={`${f.naam} weghalen`} onClick={() => verwijder(f.id)}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="tf-mini-erbij" onClick={kies} aria-label="Foto's toevoegen">
                +
              </button>
            </div>
          </section>

          <aside className="tf-paneel">
            <Schuifjes waarden={schuifjes} opWijzig={setSchuifjes} />

            <div className="tf-acties">
              {bezig ? (
                <div className="tf-voortgang" role="status">
                  <span>{bezig.tekst}</span>
                  <span className="tf-balk">
                    <span style={{ width: `${Math.round(bezig.voortgang * 100)}%` }} />
                  </span>
                </div>
              ) : nogBewaren ? (
                <button type="button" className="knop breed" onClick={() => bewaarResultaat(nogBewaren)}>
                  {nogBewaren.length > 1 ? `Bewaar ${nogBewaren.length} foto's` : "Bewaar foto"}
                </button>
              ) : (
                <>
                  <button type="button" className="knop breed" disabled={!actiefKlaar || !fotoHandle} onClick={() => exporteer([actief])}>
                    {opTelefoon ? "Bewaar foto" : "Download foto"}
                  </button>
                  {klaar.length > 1 && (
                    <button type="button" className="knop licht breed" onClick={() => exporteer(klaar)}>
                      {opTelefoon ? `Alle ${klaar.length} bewaren` : `Alle ${klaar.length} downloaden`}
                    </button>
                  )}
                </>
              )}
              {melding && (
                <p className={`tf-melding${melding.fout ? " fout" : ""}`} role="status">
                  {melding.tekst}
                </p>
              )}
            </div>

            <p className="tf-klein">
              Op volle resolutie en met je opnamedatum; je locatie gaat er niet in mee. Wil je dezelfde kleur in
              Lightroom, CapCut of DaVinci?{" "}
              <button type="button" className="tekstknop" onClick={downloadCube}>
                Download de .cube
              </button>
            </p>
          </aside>
        </div>
      )}

      <footer className="tf-voet">
        <p>Alles gebeurt in je browser: er wordt niets geüpload.</p>
        <p>HEIC in Chrome en Firefox via heic-to (libheif, LGPL-3.0).</p>
      </footer>

      {slepen && <div className="tf-sleeplaag">Laat los om toe te voegen</div>}
    </main>
  );
}
