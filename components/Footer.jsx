"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ContactForm from "./ContactForm";

const formatTime = (date) => {
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

function Footer() {
  const [currentTime, setCurrentTime] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setCurrentTime(formatTime(new Date()));
    const timerId = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  return (
    <>
      <div className="container mx-auto px-4">
        <hr className="text-gray-500 my-5" aria-hidden="true" />
        <footer className="grid grid-cols-1 md:grid-cols-12 gap-4" role="contentinfo">
          <div className="col-span-12 md:col-span-3 text-sm text-gray-500 flex items-center justify-center md:justify-start">
            {currentTime && <span>{currentTime}</span>}
          </div>
          <nav className="col-span-12 md:col-span-6 flex items-center justify-center space-x-6 md:space-x-15 my-4 md:my-0" aria-label="Footer navigatie">
            <Link href="/">Home</Link>
            <Link href="/werk">Werk</Link>
            <Link href="/projects">Projecten</Link>
          </nav>
          <div className="col-span-12 md:col-span-3 flex items-center justify-center md:justify-end">
            <button
              className="btn btn-dark cursor-pointer"
              onClick={() => setIsModalOpen(true)}
              aria-label="Open contactformulier"
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

      <ContactForm isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

export default Footer;
