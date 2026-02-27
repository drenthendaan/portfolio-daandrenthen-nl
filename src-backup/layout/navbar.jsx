import { useState } from "react";
import { NavLink } from "react-router-dom";
import DrentLogo from "../assets/DrentFigma.svg";
import BurgerMenu from "../components/BurgerMenu.jsx";
import ContactForm from "../components/ContactForm";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    isActive
      ? "border border-black menuitems-active px-4 py-2 rounded-[35px] transition-all duration-300"
      : "border border-transparent px-4 py-2 rounded-[35px] transition-all duration-300 hover:bg-gray-100";

  return (
    <div className="container mx-auto">
      <nav className="grid grid-cols-12 items-center">
        <div className="col-span-9 md:col-span-3 flex items-center space-x-4">
          <img src={DrentLogo} alt="Drent Logo" />
          <div>
            <p className="font-medium leading-none">Daan Drenthen</p>
            <p className="opacity-25 text-[10px] mt-1 uppercase tracking-wider">
              Ux developer
            </p>
          </div>
        </div>

        <div className="hidden md:inline-flex col-span-6 items-center justify-center menuitems place-self-center space-x-1">
          <NavLink to="/" className={linkClass}>
            Home
          </NavLink>

          <NavLink to="/werk" className={linkClass}>
            Werk
          </NavLink>

          <NavLink to="/projects" className={linkClass}>
            Projecten
          </NavLink>
        </div>

        <div className="col-span-3 flex items-center justify-end">
          <button
            onClick={() => setIsOpen(true)}
            className="md:hidden flex flex-col justify-center items-end space-y-1.5 p-2 group"
          >
            <span className="block w-8 h-0.5 bg-black"></span>
            <span className="block w-5 h-0.5 bg-black transition-all group-hover:w-8"></span>
            <span className="block w-8 h-0.5 bg-black"></span>
          </button>

          <div className="hidden md:block">
            <button
              className="btn btn-dark cursor-pointer"
              onClick={() => setIsModalOpen(true)}
            >
              Contacteer mij →
            </button>
          </div>
        </div>
      </nav>

      <BurgerMenu isOpen={isOpen} closeMenu={() => setIsOpen(false)} />
      <ContactForm isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default Navbar;
