"use client";

// Standaard staat alles op de Thailand-look. Sterkte, Fade en Warmte zitten in
// de kleur (de LUT), Grain en Glow in de shader.
export const STANDAARD = Object.freeze({ sterkte: 100, grain: 40, glow: 35, fade: 0, warmte: 0 });

const REGELS = [
  { sleutel: "sterkte", label: "Sterkte", min: 0, max: 100, toon: (v) => `${v}%` },
  { sleutel: "grain", label: "Grain", min: 0, max: 100, toon: (v) => `${v}` },
  { sleutel: "glow", label: "Glow", min: 0, max: 100, toon: (v) => `${v}` },
  { sleutel: "fade", label: "Fade", min: -100, max: 100, toon: (v) => (v > 0 ? `+${v}` : `${v}`) },
  { sleutel: "warmte", label: "Warmte", min: -100, max: 100, toon: (v) => (v > 0 ? `+${v}` : `${v}`) },
];

export default function Schuifjes({ waarden, opWijzig }) {
  const afwijkend = REGELS.some(({ sleutel }) => waarden[sleutel] !== STANDAARD[sleutel]);

  return (
    <section className="tf-schuifjes" aria-label="Instellingen">
      <div className="tf-paneel-kop">
        <h2>Instellingen</h2>
        <button type="button" className="tekstknop" onClick={() => opWijzig({ ...STANDAARD })} disabled={!afwijkend}>
          Standaard
        </button>
      </div>
      {REGELS.map(({ sleutel, label, min, max, toon }) => (
        <label key={sleutel} className="tf-schuif">
          <span className="tf-schuif-kop">
            {label}
            <output>{toon(waarden[sleutel])}</output>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={waarden[sleutel]}
            aria-label={label}
            aria-valuetext={toon(waarden[sleutel])}
            onChange={(e) => opWijzig({ ...waarden, [sleutel]: Number(e.target.value) })}
            // Dubbelklik zet alleen deze slider terug
            onDoubleClick={() => opWijzig({ ...waarden, [sleutel]: STANDAARD[sleutel] })}
          />
        </label>
      ))}
    </section>
  );
}
