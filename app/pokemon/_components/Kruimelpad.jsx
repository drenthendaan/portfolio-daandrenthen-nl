import Link from "next/link";

// Kruimelpad bovenaan de Pokémon-pagina's: Home › Pokémon › …
// stappen: [{ naam, href? }]; de laatste stap is de huidige pagina
export default function Kruimelpad({ stappen }) {
  return (
    <nav className="kruimelpad" aria-label="Kruimelpad">
      <ol>
        {stappen.map((s, i) => {
          const laatste = i === stappen.length - 1;
          return (
            <li key={s.naam}>
              {laatste || !s.href ? (
                <span aria-current={laatste ? "page" : undefined}>{s.naam}</span>
              ) : (
                <Link href={s.href}>{s.naam}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
