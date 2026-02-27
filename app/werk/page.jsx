import CV from "@/components/Cv";

export const metadata = {
  title: "CV & Werkervaring",
  description:
    "Bekijk het volledige CV van Daan Drenthen. Een overzicht van mijn ervaring als UX Developer bij o.a. Friday Digital Agency, skills en opleidingen.",
  alternates: {
    canonical: "https://daandrenthen.nl/werk",
  },
  openGraph: {
    title: "CV & Werkervaring — Daan Drenthen",
    description:
      "Bekijk het volledige CV van Daan Drenthen. Ervaring, skills en opleidingen.",
    url: "https://daandrenthen.nl/werk",
  },
};

export default function WerkPage() {
  return <CV />;
}
