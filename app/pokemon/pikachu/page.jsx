import collectie from "@/data/pikachu-collectie.json";
import { SEED } from "@/lib/pikachu";
import PikachuCollectie from "./PikachuCollectie";
import "./pikachu.css";

export const metadata = {
  title: "Pikachu-verzameling",
  description: "Daans Pikachu-verzameling: wantslijst, bestellingen en binder.",
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
  return <PikachuCollectie cards={CARDS} sections={collectie.sections} seed={SEED} />;
}
