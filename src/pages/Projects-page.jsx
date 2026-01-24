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
      </Helmet>

      <Projects />
    </>
  );
}