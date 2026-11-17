// De kaartstijl, gedeeld door de grote kaart en het kaartje bij een stop.
// Stond eerst alleen in Kaart.jsx; met twee kaarten zouden dat twee kopieën
// worden die uit elkaar gaan lopen zodra er één verandert.
const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/**
 * Drie lagen terugval, zodat de kaart het altijd doet:
 * 1. een eigen MapTiler-stijl als er een sleutel is;
 * 2. anders OpenFreeMap Liberty — groen voor natuur, blauw voor water;
 * 3. en als dat niet laadt, de gewone OpenStreetMap-tegels.
 */
export function stijl() {
  if (MAPTILER) return `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER}`;
  return "https://tiles.openfreemap.org/styles/liberty";
}

export function osmStijl() {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

// Of de terugval nodig is, hangt af van wélke bron faalt
export const isOpenFreeMap = (url) => String(url ?? "").includes("openfreemap");
export const heeftEigenSleutel = () => !!MAPTILER;
