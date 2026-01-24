import { Helmet } from "react-helmet-async";
import CV from "../components/Cv.jsx";

export default function Work() {
  return (
    <>
      <Helmet>
        <title>CV & Werkervaring — Daan Drenthen | UX Developer</title>
        <meta
          name="description"
          content="Bekijk het volledige CV van Daan Drenthen. Een overzicht van mijn ervaring als UX Developer bij o.a. Friday Digital Agency, mijn technische skills en opleidingen."
        />
      </Helmet>
      
      <CV />
    </>
  );
}