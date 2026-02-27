import "@/styles/main.scss";
import "@/app/globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  metadataBase: new URL("https://daandrenthen.nl"),
  title: {
    default: "Daan Drenthen | UX Developer & Designer",
    template: "%s | Daan Drenthen",
  },
  description:
    "Daan Drenthen is een UX Developer die design naadloos vertaalt naar code. Ontdek mijn projecten, cases en creatieve oplossingen.",
  keywords: [
    "UX Developer",
    "Frontend Developer",
    "React Developer",
    "Web Developer",
    "UX Designer",
    "Daan Drenthen",
    "Portfolio",
    "Hardenberg",
    "Nederland",
    "Next.js",
    "Tailwind CSS",
  ],
  authors: [{ name: "Daan Drenthen", url: "https://daandrenthen.nl" }],
  creator: "Daan Drenthen",
  publisher: "Daan Drenthen",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Icons configuratie
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/logo-icon.svg", color: "#3a383e" },
    ],
  },
  // Manifest voor PWA
  manifest: "/manifest.json",
  // Open Graph
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: "https://daandrenthen.nl",
    siteName: "Daan Drenthen Portfolio",
    title: "Daan Drenthen | UX Developer & Designer",
    description:
      "UX Developer gespecialiseerd in React en Design. Bekijk mijn portfolio met projecten en cases.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Daan Drenthen - UX Developer Portfolio",
        type: "image/jpeg",
      },
    ],
  },
  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "Daan Drenthen | UX Developer & Designer",
    description:
      "UX Developer gespecialiseerd in React en Design. Bekijk mijn portfolio.",
    images: ["/og-image.jpg"],
    creator: "@daandrenthen",
    site: "@daandrenthen",
  },
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Verification (voeg hier je codes toe)
  verification: {
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
  // Canonical
  alternates: {
    canonical: "https://daandrenthen.nl",
    languages: {
      "nl-NL": "https://daandrenthen.nl",
    },
  },
  // Extra
  category: "portfolio",
  classification: "Portfolio Website",
};

// Viewport configuratie (apart van metadata in Next.js 14+)
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#3a383e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <head>
        {/* Preconnect voor snellere font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        
        {/* Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        
        {/* JSON-LD Structured Data - Person */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              "@id": "https://daandrenthen.nl/#person",
              name: "Daan Drenthen",
              url: "https://daandrenthen.nl",
              jobTitle: "UX Developer",
              description: "UX Developer die design naadloos vertaalt naar code",
              image: {
                "@type": "ImageObject",
                url: "https://daandrenthen.nl/DaanDrenthen.jpg",
                width: 400,
                height: 400,
              },
              sameAs: [
                "https://www.linkedin.com/in/daan-drenthen",
                "https://github.com/drenthendaan",
              ],
              worksFor: {
                "@type": "Organization",
                name: "Friday Digital Agency",
                url: "https://friday.nl",
              },
              alumniOf: [
                {
                  "@type": "EducationalOrganization",
                  name: "Windesheim Zwolle",
                },
                {
                  "@type": "EducationalOrganization",
                  name: "Alfa-college",
                },
              ],
              knowsAbout: [
                "UX Design",
                "Frontend Development",
                "React",
                "Next.js",
                "JavaScript",
                "TypeScript",
                "Tailwind CSS",
                "Web Development",
              ],
              email: "mailto:daandrenthenpr@gmail.com",
            }),
          }}
        />

        {/* JSON-LD Structured Data - Website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": "https://daandrenthen.nl/#website",
              url: "https://daandrenthen.nl",
              name: "Daan Drenthen Portfolio",
              description: "Portfolio van Daan Drenthen - UX Developer & Designer",
              publisher: {
                "@id": "https://daandrenthen.nl/#person",
              },
              inLanguage: "nl-NL",
            }),
          }}
        />

        {/* JSON-LD Structured Data - BreadcrumbList */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: "https://daandrenthen.nl",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Projecten",
                  item: "https://daandrenthen.nl/projects",
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: "Werk & CV",
                  item: "https://daandrenthen.nl/werk",
                },
              ],
            }),
          }}
        />
      </head>
      <body className="font-manrope bg-light">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
