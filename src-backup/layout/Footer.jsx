import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import ContactForm from "../components/ContactForm";

const formatTime = (date) => {
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

function Footer() {
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  return (
    <>
      <div className="container mx-auto px-4">
        <hr className="text-gray-500 my-5" />
        <footer className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3 text-sm text-gray-500 flex items-center justify-center md:justify-start">
            <h5>{currentTime}</h5>
          </div>
          <div className="col-span-12 md:col-span-6 flex items-center justify-center space-x-6 md:space-x-15 my-4 md:my-0">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/work">Werk</NavLink>
            <NavLink to="/projects">Projecten</NavLink>
          </div>
          <div className="col-span-12 md:col-span-3 flex items-center justify-center md:justify-end">
            <button
              className="btn btn-dark cursor-pointer"
              onClick={() => setIsModalOpen(true)}
            >
              Contacteer mij →
            </button>
          </div>
        </footer>

        <div className="text-center mt-8 pb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
            © 2026 DaanDrenthen.nl — Alle rechten voorbehouden
          </p>
        </div>
      </div>

      {/* Hier roepen we het nieuwe component aan */}
      <ContactForm isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

export default Footer;
