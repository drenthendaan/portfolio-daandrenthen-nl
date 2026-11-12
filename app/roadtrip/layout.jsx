import "./roadtrip.css";

// Geldt voor /roadtrip en alles daaronder:
// - niet in Google (noindex, plus een X-Robots-Tag-header in next.config.js);
// - canonical uit de root-layout neutraliseren, anders wijst elke pagina hier
//   naar de homepagina.
export const metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: null },
  // Eigen icoon voor deze sectie, zodat een tabblad met een reis herkenbaar is
  // tussen de rest. De root-layout zet het portfolio-icoon; dit overschrijft dat.
  icons: {
    icon: [{ url: "/roadtrip-app/berg.svg", type: "image/svg+xml" }],
    // iOS kan geen SVG als homescreen-icoon; stond hier een .svg, dan sloeg het
    // die over en pakte het portfolio-icoon uit de hoofdlayout. Vandaar een PNG.
    apple: [{ url: "/roadtrip-app/berg-180.png", sizes: "180x180", type: "image/png" }],
  },
  // Zonder deze regel erft /roadtrip de manifest van het portfolio: op Android
  // kreeg je dan dat icoon én opende de snelkoppeling de homepagina.
  manifest: "/roadtrip-app/manifest.json",
};

export const viewport = {
  themeColor: "#f4f1ed",
  colorScheme: "light",
};

export default function RoadtripLayout({ children }) {
  return <div className="trip">{children}</div>;
}
