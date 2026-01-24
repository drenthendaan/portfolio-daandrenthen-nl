import { Helmet } from "react-helmet-async";
import IntroDaan from "../components/IntroDaan";
import Cases from "../components/Cases";

function Home() {
  return (
    <>
      <Helmet>
        <title>Portfolio Daan Drenthen | UX Design & Development</title>
        <meta
          name="description"
          content="Daan Drenthen is een UX Developer die design naadloos vertaalt naar code. Ontdek mijn projecten, cases en mijn creatieve oplossingen gebouwd met de nieuwste webtechnologieën."
        />
        <link rel="canonical" href="https://daandrenthen.nl/" />
      </Helmet>

      <IntroDaan />
      <Cases />
    </>
  );
}

export default Home;