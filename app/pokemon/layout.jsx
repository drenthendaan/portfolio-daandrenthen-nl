import { Bricolage_Grotesque } from "next/font/google";
import "./pokemon.css";
import "./_components/onderdelen.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

// Niet in Google: geldt voor /pokemon en alles daaronder
export const metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: null },
};

export default function PokemonLayout({ children }) {
  return <div className={`pika ${bricolage.variable}`}>{children}</div>;
}
