import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home-page.jsx";
import Work from "./pages/Work-page.jsx";
import Projects from "./pages/Projects-page.jsx";
import Navbar from "./layout/navbar.jsx";
import Footer from "./layout/Footer.jsx";

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/werk" element={<Work />} />
        <Route path="/projects" element={<Projects />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
