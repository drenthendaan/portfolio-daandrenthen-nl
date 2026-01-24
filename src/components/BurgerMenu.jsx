import { NavLink } from "react-router-dom";

function BurgerMenu({ isOpen, closeMenu }) {
  const linkClass = ({ isActive }) =>
    `text-5xl md:text-6xl tracking-tighter transition-all duration-300 ${
      isActive
        ? "font-bold italic"
        : "font-light opacity-50 hover:opacity-100 hover:italic"
    }`;

  return (
    <div
      className={`fixed inset-0 z-100 bg-white/95 backdrop-blur-md transition-all duration-700 ease-[cubic-bezier(0.85,0,0.15,1)] ${
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full"
      }`}
    >
      <div className="container mx-auto px-6 py-8 flex justify-end">
        <button
          onClick={closeMenu}
          className="group flex items-center space-x-2 text-xs uppercase tracking-[0.3em] font-black"
        >
          <span className="group-hover:mr-2 transition-all italic text-gray-400">
            Close
          </span>
          <span className="text-xl inline-block transition-transform group-hover:rotate-90">
            ✕
          </span>
        </button>
      </div>

      <div className="container mx-auto px-10 flex flex-col justify-center h-[75vh]">
        <nav className="flex flex-col space-y-6">
          <NavLink to="/" onClick={closeMenu} className={linkClass}>
            Home.
          </NavLink>
          <NavLink to="/werk" onClick={closeMenu} className={linkClass}>
            Werk.
          </NavLink>
          <NavLink to="/projects" onClick={closeMenu} className={linkClass}>
            Projecten.
          </NavLink>
        </nav>

        <div
          className={`mt-16 transition-all duration-1000 delay-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
        >
          <a
            className="text-sm uppercase tracking-widest border-b border-black pb-2 hover:bg-black hover:text-white transition-all px-2 py-1"
            href="mailto:daandrenthenpr@gmail.com"
          >
            Laten we praten →
          </a>
        </div>
      </div>

      <div className="absolute bottom-12 left-10 overflow-hidden">
        <p
          className={`text-[9px] uppercase tracking-[0.5em] text-gray-400 transition-transform duration-1000 delay-500 ${isOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          UX Developer & Designer — 2026
        </p>
      </div>
    </div>
  );
}

export default BurgerMenu;
