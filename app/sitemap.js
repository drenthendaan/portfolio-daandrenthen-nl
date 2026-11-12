export default function sitemap() {
  const baseUrl = "https://daandrenthen.nl";

  // Alleen de homepagina; /pokemon is noindex en hoort niet in de sitemap.
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
