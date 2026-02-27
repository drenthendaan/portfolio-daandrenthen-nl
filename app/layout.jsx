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
  ],
  authors: [{ name: "Daan Drenthen" }],
  creator: "Daan Drenthen",
  publisher: "Daan Drenthen",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
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
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Daan Drenthen | UX Developer & Designer",
    description:
      "UX Developer gespecialiseerd in React en Design. Bekijk mijn portfolio.",
    images: ["/og-image.jpg"],
    creator: "@daandrenthen",
  },
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
  verification: {
    // google: "your-google-verification-code",
  },
  alternates: {
    canonical: "https://daandrenthen.nl",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo-icon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/logo-icon.png" />
        <link rel="apple-touch-icon" href="/logo-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "Daan Drenthen",
              url: "https://daandrenthen.nl",
              jobTitle: "UX Developer",
              image: "https://daandrenthen.nl/og-image.jpg",
              sameAs: [
                "https://www.linkedin.com/in/daan-drenthen",
                "https://github.com/drenthendaan",
              ],
              worksFor: {
                "@type": "Organization",
                name: "Friday Digital Agency",
              },
              knowsAbout: [
                "UX Design",
                "Frontend Development",
                "React",
                "JavaScript",
                "Web Development",
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
