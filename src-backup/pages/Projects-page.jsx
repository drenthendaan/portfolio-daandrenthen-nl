import { Helmet } from "react-helmet-async";
import Projects from "../components/Projects";

export default function ProjectsPage() {
  return (
    <>
      <Helmet>
        <title>Mijn Werk & Projecten - Daan Drenthen | UX Developer</title>
        <meta
          name="description"
          content="Bekijk een overzicht van mijn recente cases en projecten. Zie hoe ik als UX Developer bij o.a. Friday Digital Agency design en techniek combineer."
        />

        <link rel="canonical" href="https://daandrenthen.nl/projects" />

        <meta
          property="og:title"
          content="Mijn Werk & Projecten - Daan Drenthen"
        />
        <meta property="og:url" content="https://daandrenthen.nl/projects" />
        <meta
          property="og:image"
          content="https://daandrenthen.nl/og-image.jpg"
        />
      </Helmet>

      <Projects />
    </>
  );
}
