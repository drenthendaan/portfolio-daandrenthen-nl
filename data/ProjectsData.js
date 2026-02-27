// Placeholder functie
const generatePlaceholder = (text) => `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23F3F4F6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-weight='bold' font-size='24' fill='%239CA3AF'%3E${text}%3C/text%3E%3C/svg%3E`;

export const projecten = [
  {
      id: "01",
      slug: "belthen-mobility",
      title: "Belthen Mobility",
      subtitle: "High-end chauffeursdiensten in een modern jasje.",
      category: "Web Development",
      year: "2026",
      client: "Belthen Exclusive Mobility.",
      url: "https://www.belthen-exclusivemobility.nl", 

      challenge: "Hoe zet je een luxe chauffeursdienst neer die niet alleen 'dik' oogt, maar ook echt klanten binnenhaalt? De uitdaging was om die chique balans te vinden tussen zakelijke discretie en een website waar je direct een rit wilt boeken.",
      solution: "Na het maken van het design, heb ik de website gebouwd met React en Tailwind CSS. Door gebruik te maken van Framer Motion heb ik vloeiende animaties toegevoegd die de gebruikerservaring verbeteren zonder af te leiden van de inhoud. De site is volledig responsive, zodat klanten zowel op desktop als mobiel gemakkelijk een rit kunnen boeken.",
      description: "Het eindresultaat? Een minimalistisch design dat razendsnel is en technisch staat als een huis. Dankzij de sterke basis wordt Belthen nu makkelijk gevonden, zowel zakelijk als privé.",

      services: ["UX/UI Design", "Frontend Development", "Responsive Design"],
      stack: ["React", "Tailwind CSS", "Framer Motion"],
      
      image: "/cases-portfolio-belthen.jpeg",
      gallery: [
        "/mockup-belthen.jpg",
        "/responsive-belthen.jpg",
      ]
  },
  {
    id: "02",
    slug: "project-two",
    title: "Project Two",
    subtitle: "Coming Soon",
    category: "Design",
    year: "2025",
    image: generatePlaceholder("Coming Soon"),
  },
  {
    id: "03",
    slug: "project-three",
    title: "Project Three",
    subtitle: "Coming Soon",
    category: "Concept",
    year: "2025",
    image: generatePlaceholder("Coming Soon"),
  },
];
