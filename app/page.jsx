import IntroDaan from "@/components/IntroDaan";
import Cases from "@/components/Cases";

export const metadata = {
  title: "Portfolio Daan Drenthen | UX Design & Development",
  description:
    "Daan Drenthen is een UX Developer die design naadloos vertaalt naar code. Ontdek mijn projecten, cases en mijn creatieve oplossingen.",
  alternates: {
    canonical: "https://daandrenthen.nl",
  },
  openGraph: {
    title: "Portfolio Daan Drenthen | UX Design & Development",
    description:
      "UX Developer gespecialiseerd in React en Design. Bekijk mijn portfolio.",
    url: "https://daandrenthen.nl",
  },
};

export default function Home() {
  return (
    <>
      <IntroDaan />
      <Cases />
    </>
  );
}
