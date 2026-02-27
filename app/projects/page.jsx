import Projects from "@/components/Projects";

export const metadata = {
  title: "Mijn Werk & Projecten",
  description:
    "Bekijk een overzicht van mijn recente cases en projecten. Zie hoe ik als UX Developer bij o.a. Friday Digital Agency design en techniek combineer.",
  alternates: {
    canonical: "https://daandrenthen.nl/projects",
  },
  openGraph: {
    title: "Mijn Werk & Projecten - Daan Drenthen",
    description:
      "Bekijk een overzicht van mijn recente cases en projecten als UX Developer.",
    url: "https://daandrenthen.nl/projects",
  },
};

export default function ProjectsPage() {
  return <Projects />;
}
