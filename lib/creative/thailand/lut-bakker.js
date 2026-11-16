// Houdt de LUT bij met de kleur-sliders (Sterkte, Fade, Warmte). Tijdens het
// slepen bakt hij 33³ (een paar milliseconden), zodra je loslaat 65³ (scherp).
// Het bakken gebeurt in een worker; lukt die niet, dan gewoon hier.

import { bakLut, lookVoor } from "./look.mjs";

export const SNEL = 33;
export const SCHERP = 65;

export function maakLutBakker(opKlaar) {
  let werker = null;
  try {
    werker = new Worker(new URL("./lut-werker.js", import.meta.url), { type: "module" });
  } catch {
    werker = null;
  }

  let volgnummer = 0;
  let laatste = 0;
  let laatsteVerzoek = null;
  const wachtenden = new Map();

  const lever = (id, lut, N) => {
    // Een oudere bakbeurt die later binnenkomt, mag een nieuwere niet overschrijven
    if (id < laatste) return;
    laatste = id;
    opKlaar(lut, N);
    for (const [wachtId, klaar] of wachtenden) {
      if (wachtId <= id) {
        klaar();
        wachtenden.delete(wachtId);
      }
    }
  };

  if (werker) {
    werker.onmessage = ({ data }) => lever(data.id, data.lut, data.N);
    werker.onerror = () => {
      werker?.terminate();
      werker = null;
      // Wat nog onderweg was, alsnog hier bakken
      if (laatsteVerzoek) {
        const { id, schuifjes, N } = laatsteVerzoek;
        lever(id, bakLut(lookVoor(schuifjes), N), N);
      }
    };
  }

  return {
    // Geeft een belofte die klaar is zodra deze LUT (of een nieuwere) in gebruik is
    bak(schuifjes, N) {
      const id = ++volgnummer;
      laatsteVerzoek = { id, schuifjes, N };
      const klaar = new Promise((los) => wachtenden.set(id, los));
      if (werker) {
        werker.postMessage({ id, schuifjes, N });
      } else {
        lever(id, bakLut(lookVoor(schuifjes), N), N);
      }
      return klaar;
    },
    stop() {
      werker?.terminate();
      werker = null;
    },
  };
}
