import Link from "next/link";

export const metadata = {
  title: "Creative",
  description: "Kleine creatieve tooltjes.",
};

export default function CreativePage() {
  return (
    <main className="cr">
      <header className="cr-kop">
        <h1>Creative</h1>
        <p>Kleine tooltjes om mee te spelen.</p>
      </header>

      <ul className="cr-lijst">
        <li>
          <Link href="/creative/thailand-filter" className="cr-kaart">
            <span className="cr-staal" aria-hidden="true" />
            <span className="cr-tekst">
              <strong>Thailand-filter</strong>
              <span>Geef je foto's de look van analoge film: zachte zwarten, teal lucht en olijfgroen.</span>
            </span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
