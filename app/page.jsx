import Naam from "@/components/Naam";

export const metadata = {
  title: "Daan Drenthen",
  description: "Daan Drenthen.",
  alternates: {
    canonical: "https://daandrenthen.nl",
  },
  openGraph: {
    title: "Daan Drenthen",
    description: "Daan Drenthen.",
    url: "https://daandrenthen.nl",
  },
};

export default function Home() {
  return (
    <main>
      <Naam />
    </main>
  );
}
