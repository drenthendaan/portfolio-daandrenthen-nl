import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import { projecten } from "../data/ProjectsData";

function Cases() {
  const sliderRef = useRef(null);
  const contentAnchorRef = useRef(null);
  const [paddingLeft, setPaddingLeft] = useState(24);
  const [scrollProgress, setScrollProgress] = useState(0);

  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const velocity = useRef(0);
  const rafId = useRef(null);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleScroll = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      const totalScrollable = scrollWidth - clientWidth;
      const progress = (scrollLeft / totalScrollable) * 100;
      setScrollProgress(progress);
    }
  };

  const scroll = (direction) => {
    if (sliderRef.current) {
      const scrollAmount = window.innerWidth > 768 ? 500 : sliderRef.current.clientWidth * 0.8;
      sliderRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, []);

  useLayoutEffect(() => {
    function alignSlider() {
      if (window.innerWidth < 768) {
        setPaddingLeft(24);
      } else if (contentAnchorRef.current) {
        const leftPosition = contentAnchorRef.current.getBoundingClientRect().left;
        setPaddingLeft(leftPosition);
      }
    }
    alignSlider();
    window.addEventListener("resize", alignSlider);
    return () => window.removeEventListener("resize", alignSlider);
  }, []);

  const handleMouseDown = (e) => {
    if (window.innerWidth < 768) return; 
    isDown.current = true;
    sliderRef.current.style.scrollSnapType = "none";
    startX.current = e.pageX - sliderRef.current.offsetLeft;
    scrollLeft.current = sliderRef.current.scrollLeft;
    cancelAnimationFrame(rafId.current);
  };

  const handleMouseMove = (e) => {
    if (!isDown.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.2; 
    const prevScrollLeft = sliderRef.current.scrollLeft;
    sliderRef.current.scrollLeft = scrollLeft.current - walk;
    velocity.current = sliderRef.current.scrollLeft - prevScrollLeft;
    handleScroll();
  };

  const applyMomentum = () => {
    if (Math.abs(velocity.current) > 0.5) {
      sliderRef.current.scrollLeft += velocity.current;
      velocity.current *= 0.85; 
      handleScroll();
      rafId.current = requestAnimationFrame(applyMomentum);
    } else {
      sliderRef.current.style.scrollSnapType = "x mandatory";
    }
  };

  const stopDragging = () => {
    if (!isDown.current) return;
    isDown.current = false;
    applyMomentum();
  };

  return (
    <div className="py-12 overflow-x-hidden w-full">
      {/* Custom Cursor */}
      <div
        className={`fixed pointer-events-none z-50 items-center justify-center rounded-full bg-[#5A7690] text-white text-[11px] font-bold uppercase tracking-[0.2em] transition-transform duration-200 ease-out hidden md:flex ${
          isHovering ? "scale-100 opacity-100" : "scale-0 opacity-0"
        }`}
        style={{
          width: "90px",
          height: "90px",
          left: mousePos.x - 45,
          top: mousePos.y - 45,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        Swipe
      </div>

      {/* HEADER SECTIE - NU MOOIER GEMAAKT */}
      <div className="container mx-auto px-6 mb-10">
        <div className="flex justify-between items-end gap-6">
          <div ref={contentAnchorRef} className="text-left">
            <div className="flex items-center gap-2 mb-2">
               <span className="w-6 h-[1px] bg-[#5A7690]"></span>
               <span className="text-[#5A7690] text-[10px] font-bold uppercase tracking-widest">Portfolio</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-gray-900 leading-none">
              Featured <span className="italic font-light text-gray-400">Cases</span>
            </h2>
            <p className="mt-4 text-gray-500 max-w-md text-sm md:text-base leading-relaxed">
              Een overzicht van mijn meest recente werk waar passie en precisie samenkomen.
            </p>
          </div>

          <div className="flex gap-2 md:gap-3 mb-2 shrink-0">
            <button 
              onClick={() => scroll("left")}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-900 hover:text-white active:scale-95 transition-all duration-300"
              aria-label="Vorige"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <button 
              onClick={() => scroll("right")}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-900 hover:text-white active:scale-95 transition-all duration-300"
              aria-label="Volgende"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14m-7-7 7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* SLIDER SECTIE - WEER ORIGINEEL */}
      <div
        className="relative w-full"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <div
          ref={sliderRef}
          onScroll={handleScroll}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => {
            setIsHovering(false);
            stopDragging();
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          className="flex overflow-x-auto pb-8 pr-10 hide-scrollbar snap-x snap-mandatory gap-6 md:gap-10 cursor-grab active:cursor-grabbing select-none touch-pan-x"
        >
          {projecten.map((project) => (
            <div
              key={project.id}
              className="min-w-[85%] sm:min-w-[60%] md:min-w-[45%] lg:min-w-[38%] max-w-[calc(100vw-48px)] snap-start snap-always shrink-0"
            >
              <div className="group h-full">
                <div className="relative overflow-hidden rounded-xl shadow-sm bg-gray-100">
                  <div className="absolute top-4 left-4 z-20 bg-[#5A7690] text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase shadow-md">
                    Case {project.id}
                  </div>
                  <img
                    className="w-full h-64 md:h-80 object-cover transition-transform duration-700 ease-in-out group-hover:scale-110 pointer-events-none"
                    src={project.image}
                    alt={project.title}
                  />
                </div>
                <h4 className="mb-2 mt-5 text-xl md:text-2xl font-semibold italic text-left">
                  {project.title}
                </h4>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed text-left">
                  {project.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Voortgangsbalk */}
        <div 
          className="mt-6 h-[2px] bg-gray-200 relative overflow-hidden transition-all duration-300"
          style={{ 
            width: `calc(100% - ${paddingLeft}px)`,
            marginRight: `${paddingLeft}px`
          }}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-[#5A7690] transition-transform duration-150 ease-out origin-left"
            style={{ 
              width: '100%',
              transform: `scaleX(${Math.max(0.02, scrollProgress / 100)})` 
            }}
          />
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .hide-scrollbar::-webkit-scrollbar { display: none; } 
            .hide-scrollbar { 
              -ms-overflow-style: none; 
              scrollbar-width: none; 
              -webkit-overflow-scrolling: touch;
              scroll-behavior: smooth;
            }
            .snap-always { scroll-snap-stop: always; }
          `,
        }}
      />
    </div>
  );
}

export default Cases;