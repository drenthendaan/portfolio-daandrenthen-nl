import Link from "next/link";

export const metadata = {
  title: "Pagina niet gevonden",
  description: "De pagina die je zoekt bestaat niet.",
};

export default function NotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <h2 className="text-3xl font-light mb-4 tracking-tight">
        Pagina niet gevonden
      </h2>
      <p className="text-gray-500 mb-8">
        De pagina die je zoekt bestaat niet of is verplaatst.
      </p>
      <Link
        href="/"
        className="text-sm uppercase tracking-widest border-b border-black pb-1 hover:text-gray-600 transition-colors"
      >
        Terug naar home
      </Link>
    </div>
  );
}
