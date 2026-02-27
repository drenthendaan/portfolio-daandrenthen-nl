"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import BurgerMenu from "./BurgerMenu";
import ContactForm from "./ContactForm";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pathname = usePathname();

  const linkClass = (href) =>
    pathname === href
      ? "border border-black menuitems-active px-4 py-2 rounded-[35px] transition-all duration-300"
      : "border border-transparent px-4 py-2 rounded-[35px] transition-all duration-300 hover:bg-gray-100";

  return (
    <header className="container mx-auto">
      <nav className="grid grid-cols-12 items-center" aria-label="Hoofdnavigatie">
        <Link href="/" className="col-span-9 md:col-span-3 flex items-center space-x-4">
          <Image 
            src="/DrentFigma.svg" 
            alt="Daan Drenthen logo - Terug naar homepage" 
            width={40} 
            height={40}
            priority
          />
          <div>
            <p className="font-medium leading-none">Daan Drenthen</p>
            <p className="opacity-25 text-[10px] mt-1 uppercase tracking-wider">
              Ux developer
            </p>
          </div>
        </Link>

        <div className="hidden md:inline-flex col-span-6 items-center justify-center menuitems place-self-center space-x-1" role="navigation">
          <Link href="/" className={linkClass("/")} aria-current={pathname === "/" ? "page" : undefined}>
            Home
          </Link>

          <Link href="/werk" className={linkClass("/werk")} aria-current={pathname === "/werk" ? "page" : undefined}>
            Werk
          </Link>

          <Link href="/projects" className={linkClass("/projects")} aria-current={pathname === "/projects" ? "page" : undefined}>
            Projecten
          </Link>
        </div>

        <div className="col-span-3 flex items-center justify-end">
          <button
            onClick={() => setIsOpen(true)}
            className="md:hidden flex flex-col justify-center items-end space-y-1.5 p-2 group"
            aria-label="Open navigatiemenu"
            aria-expanded={isOpen}
          >
            <span className="block w-8 h-0.5 bg-black" aria-hidden="true"></span>
            <span className="block w-5 h-0.5 bg-black transition-all group-hover:w-8" aria-hidden="true"></span>
            <span className="block w-8 h-0.5 bg-black" aria-hidden="true"></span>
          </button>

          <div className="hidden md:block">
            <button
              className="btn btn-dark cursor-pointer"
              onClick={() => setIsModalOpen(true)}
              aria-label="Open contactformulier"
            >
              Contacteer mij →
            </button>
          </div>
        </div>
      </nav>

      <BurgerMenu isOpen={isOpen} closeMenu={() => setIsOpen(false)} />
      <ContactForm isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </header>
  );
}

export default Navbar;
