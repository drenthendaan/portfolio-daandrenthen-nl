"use client";

import { useState } from "react";

// Afbeeldingen uit de koppeling: "t:<productId>" (TCGplayer-CDN) of "d:<pad>" (TCGdex).
// Gewone <img>: next/image zou op Hobby snel buiten het gratis quotum vallen.
export function afbeeldingen(img, groot) {
  return (img || [])
    .map((s) =>
      s.startsWith("t:")
        ? `https://tcgplayer-cdn.tcgplayer.com/product/${s.slice(2)}_${groot ? 400 : 200}w.jpg`
        : s.startsWith("d:")
          ? `https://assets.tcgdex.net/${s.slice(2)}/${groot ? "high" : "low"}.webp`
          : null
    )
    .filter(Boolean);
}

export default function KaartAfbeelding({ img, groot = false, alt = "" }) {
  const lijst = afbeeldingen(img, groot);
  const [i, setI] = useState(0);
  if (i >= lijst.length) {
    return (
      <span className="kaart-leeg" role={alt ? "img" : undefined} aria-label={alt || undefined}>
        ⚡
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={lijst[i]}
      alt={alt}
      width={groot ? 400 : 200}
      height={groot ? 558 : 279}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setI(i + 1)}
    />
  );
}
