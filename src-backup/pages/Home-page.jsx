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
          content="Daan Drenthen is een UX Developer die design naadloos vertaalt naar code. Ontdek mijn projecten, cases en mijn creatieve oplossingen."
        />

        <link rel="canonical" href="https://daandrenthen.nl/" />

        <meta property="og:title" content="Portfolio Daan Drenthen" />
        <meta
          property="og:description"
          content="UX Developer gespecialiseerd in React en Design."
        />
        <meta property="og:url" content="https://daandrenthen.nl/" />
        <meta
          property="og:image"
          content="https://daandrenthen.nl/og-image.jpg"
        />
        <meta property="og:type" content="website" />
      </Helmet>

      <IntroDaan />
      <Cases />
    </>
  );
}

export default Home;
