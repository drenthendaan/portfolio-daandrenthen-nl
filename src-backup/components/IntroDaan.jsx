import DaanDrenthen from "../assets/DaanDrenthen.jpg";
import { useState, useCallback, useEffect, useRef } from "react";

export default function IntroDaan() {
  const emailAddress = "daandrenthenpr@gmail.com";
  const [isHovered, setIsHovered] = useState(false);
  const [copyMessage, setCopyMessage] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard
      .writeText(emailAddress)
      .then(() => {
        setCopyMessage("Email gekopieerd");
        setTimeout(() => setCopyMessage(null), 2000);
      })
      .catch((err) => {
        console.error("Kopiëren mislukt:", err);
      });
  }, [emailAddress]);

  let displayText;
  if (copyMessage) {
    displayText = copyMessage;
  } else if (isHovered) {
    displayText = "Kopieer email";
  } else {
    displayText = emailAddress;
  }

  const tooltipText = isHovered ? "Klik om te kopiëren" : "Stuur een mail";

  let iconName;
  if (copyMessage) {
    iconName = "check_circle";
  } else if (isHovered) {
    iconName = "content_copy";
  } else {
    iconName = "mail";
  }

  return (
    <div
      id="over-ons"
      ref={sectionRef}
      className="container mx-auto px-6 md:px-4 relative overflow-hidden"
    >
      <div
        className={`grid grid-cols-1 md:grid-cols-12 items-start md:items-end gap-y-8 md:gap-0 transition-all duration-1000 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <div className="col-span-1 md:col-span-2 relative z-10">
          <img
            src={DaanDrenthen}
            className="rounded-2xl w-40 h-40 md:w-full md:h-auto shadow-sm object-cover"
            alt="Daan Drenthen"
          />
        </div>

        <div className="col-span-1 md:col-span-4 md:ml-8 relative z-10 text-left">
          <h3 className="font-bold text-2xl md:text-xl mb-1 text-gray-900">
            Daan Drenthen
          </h3>
          <p className="text-base text-gray-400 font-medium">UX Developer</p>
          <p className="mt-4 text-gray-600 text-base leading-relaxed max-w-sm">
            Momenteel werkzaam bij{" "}
            <span className="text-black font-semibold">
              Friday Digital Agency
            </span>
            . Eerder actief bij Datamotive en Pixel Express.
          </p>
        </div>

        <div className="col-span-1 md:col-span-6 text-left md:text-right relative z-10 flex flex-col items-start md:items-end justify-end h-full md:mt-0">
          <p className="mb-3 text-gray-400 text-sm">
            Laten we wat leuks maken!
          </p>

          <div className="inline-block relative w-auto">
            {" "}
            <p
              className={`py-3 md:py-1 px-4 md:px-3 border border-black inline-flex justify-between items-center rounded-2xl cursor-pointer transition-all duration-300 w-72 hover:bg-black hover:text-white group`} // w-full verwijderd, w-72 is nu de standaard
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={copyToClipboard}
              title={tooltipText}
            >
              <span className="font-medium text-sm truncate mr-2">
                {displayText}
              </span>

              <span className="material-symbols-outlined text-base transition-transform group-hover:rotate-12 flex-shrink-0">
                {iconName}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
