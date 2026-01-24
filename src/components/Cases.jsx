import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import { projecten } from "../data/ProjectsData";

function Cases() {
  const sliderRef = useRef(null);
  const contentAnchorRef = useRef(null);
  const [paddingLeft, setPaddingLeft] = useState(24);

  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const velocity = useRef(0);
  const rafId = useRef(null);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

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

  // Desktop Drag Logic
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
  };

  const applyMomentum = () => {
    if (Math.abs(velocity.current) > 0.5) {
      sliderRef.current.scrollLeft += velocity.current;
      velocity.current *= 0.85; 
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

      <div className="container mx-auto px-6">
        <div ref={contentAnchorRef} className="text-left md:text-center">
          <h2 className="text-3xl md:text-5xl font-bold italic tracking-tighter mb-3 text-gray-900 inline-block">
            Cases
          </h2>
          <div className="w-12 h-1 bg-black mb-4 md:mx-auto"></div>
          <p className="text-gray-500 max-w-md md:mx-auto text-sm md:text-base leading-relaxed">
            Een overzicht van mijn meest recente werk
          </p>
        </div>
      </div>

      <div
        className="relative w-full mt-8"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <div
          ref={sliderRef}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => {
            setIsHovering(false);
            stopDragging();
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          /* Op mobiel laten we de browser het werk doen voor maximale smoothness */
          className="flex overflow-x-auto pb-10 pr-10 hide-scrollbar snap-x snap-mandatory gap-6 md:gap-10 cursor-grab active:cursor-grabbing select-none touch-pan-x"
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
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .hide-scrollbar::-webkit-scrollbar { display: none; } 
            .hide-scrollbar { 
              -ms-overflow-style: none; 
              scrollbar-width: none; 
              -webkit-overflow-scrolling: touch; /* Voor momentum op iOS */
              scroll-behavior: smooth; /* Voor soepele snaps */
            }
            .snap-always { scroll-snap-stop: always; }
          `,
        }}
      />
    </div>
  );
}

export default Cases;