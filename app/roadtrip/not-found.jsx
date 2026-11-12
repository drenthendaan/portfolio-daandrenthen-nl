import Link from "next/link";
import { PijlTerug } from "./_components/iconen";

export const metadata = {
  title: "Niet gevonden",
};

export default function RoadtripNietGevonden() {
  return (
    <div className="blad">
      <div className="midden">
        <h1>Deze reis bestaat niet</h1>
        <p className="onderkop">
          Misschien is hij verwijderd, of klopt het adres niet helemaal.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link className="terug" href="/roadtrip">
            <PijlTerug />
            Alle roadtrips
          </Link>
        </p>
      </div>
    </div>
  );
}
