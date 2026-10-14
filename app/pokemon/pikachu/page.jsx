import { Bricolage_Grotesque } from "next/font/google";
import collectie from "@/data/pikachu-collectie.json";
import { SEED } from "@/lib/pikachu";
import PikachuCollectie from "./PikachuCollectie";
import "./pikachu.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata = {
  title: "Pikachu-verzameling",
  description: "Daans Pikachu-verzameling: wantslijst, bestellingen en binder.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: null },
};

// Alleen wat de pagina nodig heeft: [id, naam, set, nummer, prijs, prijstype, notitie, sectie, mapcode, positie]
const CARDS = collectie.cards.map((c) => [
  c.id,
  c.name,
  c.set,
  c.number,
  c.price_eur,
  c.price_type,
  c.note,
  c.section,
  c.binder?.code ?? null,
  c.binder ? c.binder.page * 10 + c.binder.slot : 99999,
]);

export default function PikachuPage() {
  return (
    <div className={`pika ${bricolage.variable}`}>
      <PikachuCollectie
        cards={CARDS}
        sections={collectie.sections}
        seed={SEED}
      />
    </div>
  );
}
