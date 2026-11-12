import "@/styles/main.scss";
import "@/app/globals.css";

export const metadata = {
  metadataBase: new URL("https://daandrenthen.nl"),
  title: {
    default: "Daan Drenthen",
    template: "%s | Daan Drenthen",
  },
  description: "Daan Drenthen.",
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
    other: [{ rel: "mask-icon", url: "/logo-icon.svg", color: "#3a383e" }],
  },
  // Manifest voor PWA
  manifest: "/manifest.json",
  // Open Graph
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: "https://daandrenthen.nl",
    siteName: "Daan Drenthen",
    title: "Daan Drenthen",
    description: "Daan Drenthen.",
  },
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Canonical
  alternates: {
    canonical: "https://daandrenthen.nl",
    languages: {
      "nl-NL": "https://daandrenthen.nl",
    },
  },
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
              sameAs: [
                "https://www.linkedin.com/in/daan-drenthen",
                "https://github.com/drenthendaan",
              ],
            }),
          }}
        />
      </head>
      <body className="font-manrope bg-light">{children}</body>
    </html>
  );
}
