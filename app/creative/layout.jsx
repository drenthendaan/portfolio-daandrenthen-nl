import "./creative.css";

// Geldt voor /creative en alles daaronder:
// - alleen via de link, niet in Google (noindex, plus een X-Robots-Tag-header in
//   next.config.js) en niet in de sitemap;
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
  themeColor: "#f1efe8",
  colorScheme: "light",
};

export default function CreativeLayout({ children }) {
  return <div className="creatief">{children}</div>;
}
