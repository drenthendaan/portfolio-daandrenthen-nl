import { Bricolage_Grotesque } from "next/font/google";
import "./pokemon.css";
import "./_components/onderdelen.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

// Geldt voor /pokemon en alles daaronder:
// - niet in Google (noindex, plus een X-Robots-Tag-header in next.config.js);
// - eigen manifest en pokéball-iconen, zodat "Zet op beginscherm" op de iPhone /pokemon
//   opent in plaats van de homepagina (het portfoliomanifest heeft start_url "/").
export const metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: null },
  manifest: "/pokemon-app/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pokemon-app/pokebal.svg", type: "image/svg+xml" },
      { url: "/pokemon-app/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/pokemon-app/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/pokemon-app/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Pokémon",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171d29" },
  ],
  colorScheme: "light dark",
};

export default function PokemonLayout({ children }) {
  return <div className={`pika ${bricolage.variable}`}>{children}</div>;
}
