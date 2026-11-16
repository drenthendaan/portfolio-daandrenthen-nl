"use client";

import { useEffect, useRef, useState } from "react";
import { Renderer } from "@/lib/creative/thailand/renderer.js";

// Het voorbeeld rendert nooit groter dan dit; de export doet de volle foto
const MAX_ZIJDE = 2048;

export default function Voorbeeld({ rendererRef, foto, effecten, lutVersie, tekenTeller, fotoFout, opRenderer }) {
  const podiumRef = useRef(null);
  const canvasRef = useRef(null);
  const sleept = useRef(false);
  const [maat, setMaat] = useState(null);
  const [vergelijk, setVergelijk] = useState(false);
  const [splitsing, setSplitsing] = useState(0.5);
  const [origineel, setOrigineel] = useState(false);
  const [fout, setFout] = useState(null);

  const verhouding = foto ? foto.volledigeBreedte / foto.volledigeHoogte : null;

  // Eén renderer per canvas
  useEffect(() => {
    let renderer;
    try {
      renderer = new Renderer(canvasRef.current, {
        opVerlies: () => setFout("De grafische kaart viel even weg. Herlaad de pagina om verder te gaan."),
      });
    } catch (e) {
      setFout(e.message);
      return undefined;
    }
    rendererRef.current = renderer;
    opRenderer(renderer);
    return () => {
      rendererRef.current = null;
      opRenderer(null);
      renderer.vernietig();
    };
  }, [rendererRef, opRenderer]);

  // Canvas zo groot als past: volle breedte, hooguit ~70% van de schermhoogte
  useEffect(() => {
    const podium = podiumRef.current;
    if (!podium || !verhouding) return undefined;
    const meet = () => {
      const ruimteB = podium.clientWidth;
      const ruimteH = Math.min(window.innerHeight * 0.72, 960);
      let cssB = ruimteB;
      let cssH = cssB / verhouding;
      if (cssH > ruimteH) {
        cssH = ruimteH;
        cssB = cssH * verhouding;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      let b = Math.round(cssB * dpr);
      let h = Math.round(cssH * dpr);
      const grootste = Math.max(b, h);
      if (grootste > MAX_ZIJDE) {
        b = Math.round((b * MAX_ZIJDE) / grootste);
        h = Math.round((h * MAX_ZIJDE) / grootste);
      }
      const nieuw = { cssB: Math.round(cssB), cssH: Math.round(cssH), b, h };
      setMaat((oud) => (oud && oud.cssB === nieuw.cssB && oud.cssH === nieuw.cssH && oud.b === nieuw.b ? oud : nieuw));
    };
    meet();
    const waarnemer = new ResizeObserver(meet);
    waarnemer.observe(podium);
    window.addEventListener("resize", meet);
    return () => {
      waarnemer.disconnect();
      window.removeEventListener("resize", meet);
    };
  }, [verhouding]);

  // Tekenen bij elke wijziging; requestAnimationFrame bundelt snelle sliders
  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !maat || !foto) return undefined;
    if (canvas.width !== maat.b) canvas.width = maat.b;
    if (canvas.height !== maat.h) canvas.height = maat.h;
    const frame = requestAnimationFrame(() =>
      renderer.tekenVoorbeeld(foto, effecten, { splitsing: vergelijk ? splitsing : -1, origineel }),
    );
    return () => cancelAnimationFrame(frame);
  }, [rendererRef, foto, effecten, lutVersie, tekenTeller, maat, vergelijk, splitsing, origineel]);

  const naarSplitsing = (e) => {
    const vak = canvasRef.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - vak.left) / vak.width));
  };

  const omlaag = (e) => {
    if (!foto || e.target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    sleept.current = true;
    if (vergelijk) setSplitsing(naarSplitsing(e));
    else setOrigineel(true);
  };

  const beweeg = (e) => {
    if (sleept.current && vergelijk) setSplitsing(naarSplitsing(e));
  };

  const omhoog = () => {
    sleept.current = false;
    setOrigineel(false);
  };

  const zichtbaar = Boolean(foto && maat && !fout);
  const links = maat ? `calc(50% - ${maat.cssB / 2}px)` : "0px";

  return (
    <div>
      <div
        className="tf-podium"
        ref={podiumRef}
        onPointerDown={omlaag}
        onPointerMove={beweeg}
        onPointerUp={omhoog}
        onPointerCancel={omhoog}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Voorbeeld van je foto met het Thailand-filter"
          style={zichtbaar ? { width: maat.cssB, height: maat.cssH } : { width: 0, height: 0 }}
        />
        {(fout || fotoFout) && <p className="tf-podium-melding">{fout || fotoFout}</p>}
        {!fout && !fotoFout && !zichtbaar && <p className="tf-podium-melding">Foto laden…</p>}

        {zichtbaar && vergelijk && (
          <>
            <div className="tf-splitsing" style={{ left: `calc(${links} + ${splitsing * maat.cssB}px)` }} />
            <span className="tf-label" style={{ left: `calc(${links} + 12px)` }}>
              Voor
            </span>
            <span className="tf-label" style={{ right: `calc(${links} + 12px)` }}>
              Na
            </span>
          </>
        )}
        {zichtbaar && origineel && !vergelijk && (
          <span className="tf-label" style={{ left: `calc(${links} + 12px)` }}>
            Origineel
          </span>
        )}
        {zichtbaar && (
          <div className="tf-podium-knoppen">
            <button
              type="button"
              className="tf-podium-knop"
              aria-pressed={vergelijk}
              onClick={() => {
                setVergelijk((v) => !v);
                setSplitsing(0.5);
              }}
            >
              Voor/na
            </button>
          </div>
        )}
      </div>
      {zichtbaar && (
        <p className="tf-hint">
          {vergelijk ? "Sleep over de foto om voor en na te vergelijken." : "Houd de foto ingedrukt om het origineel te zien."}
        </p>
      )}
    </div>
  );
}
