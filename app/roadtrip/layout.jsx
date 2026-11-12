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
};

export const viewport = {
  themeColor: "#f3f4f3",
  colorScheme: "light",
};

export default function RoadtripLayout({ children }) {
  return <div className="trip">{children}</div>;
}
