// Eén set lijniconen, zodat ze overal dezelfde dikte en maat hebben.
// Decoratief, dus aria-hidden; de betekenis staat altijd in de tekst ernaast.

const basis = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  "aria-hidden": "true",
  viewBox: "0 0 24 24",
};

export const Camper = ({ size = 16 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="M3 16V8.5A1.5 1.5 0 0 1 4.5 7h9A1.5 1.5 0 0 1 15 8.5V11h2.6a2 2 0 0 1 1.7 1l1.4 2.4a2 2 0 0 1 .3 1V16" />
    <circle cx="7.5" cy="16.5" r="1.8" />
    <circle cx="16.5" cy="16.5" r="1.8" />
    <path d="M9.3 16.5h5.4M3 16h1.7M21 16h-2.7" />
  </svg>
);

export const Auto = ({ size = 16 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="M5 17V9.2a1.2 1.2 0 0 1 .8-1.1l5.4-2a2.2 2.2 0 0 1 1.6 0l5.4 2a1.2 1.2 0 0 1 .8 1.1V17" />
    <circle cx="8" cy="17" r="2" />
    <circle cx="16" cy="17" r="2" />
    <path d="M10 17h4" />
  </svg>
);

export const Motor = ({ size = 16 }) => (
  <svg {...basis} width={size} height={size}>
    <circle cx="5.5" cy="16.5" r="3.2" />
    <circle cx="18.5" cy="16.5" r="3.2" />
    <path d="M5.5 16.5 9 10h5l2.5 6.5M9 10 7.5 7H5m9 3h3.5" />
  </svg>
);

export const Vlucht = ({ size = 16 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="M21 15.5 13.5 11V5.2a1.7 1.7 0 0 0-3.4 0V11L2.6 15.5v2l7.5-2.3V19l-2.3 1.6V22l3.9-1 3.9 1v-1.4L13.3 19v-3.8l7.7 2.3z" />
  </svg>
);

export const VERVOERICOON = { camper: Camper, auto: Auto, motor: Motor, vlucht: Vlucht };

export const Pijl = ({ size = 18 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const PijlTerug = ({ size = 15 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const Omlaag = ({ size = 16 }) => (
  <svg {...basis} width={size} height={size} strokeWidth="2">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const Rijden = ({ size = 15 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="M12 4v16M7 15l5 5 5-5" />
  </svg>
);

export const Plus = ({ size = 16 }) => (
  <svg {...basis} width={size} height={size} strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Kaartspeld = ({ size = 19 }) => (
  <svg {...basis} width={size} height={size}>
    <circle cx="12" cy="10" r="2.6" />
    <path d="M12 21s6.5-6 6.5-10.6A6.5 6.5 0 0 0 5.5 10.4C5.5 15 12 21 12 21z" />
  </svg>
);

export const Route = ({ size = 19 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </svg>
);

export const Waarschuwing = ({ size = 15 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="M12 9v4M12 17h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);

export const Greep = ({ size = 16 }) => (
  <svg {...basis} width={size} height={size}>
    <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
  </svg>
);

export const Zoek = ({ size = 16 }) => (
  <svg {...basis} width={size} height={size}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l4.5 4.5" strokeLinecap="round" />
  </svg>
);
