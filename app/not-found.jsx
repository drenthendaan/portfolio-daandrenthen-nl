import Link from "next/link";

export const metadata = {
  title: "Pagina niet gevonden",
  description: "De pagina die je zoekt bestaat niet.",
};

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-6 px-5 text-center">
      <h1 className="m-0 font-manrope font-extrabold text-dark text-[clamp(2.5rem,9vw,6rem)] leading-none tracking-[-0.035em]">
        404
      </h1>
      <Link
        href="/"
        className="border-b border-dark pb-1 text-sm uppercase tracking-widest text-dark transition-colors hover:text-primary"
      >
        Terug naar home
      </Link>
    </main>
  );
}
