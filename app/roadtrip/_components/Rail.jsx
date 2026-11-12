import Link from "next/link";
import { Plus, Route } from "./iconen";

// De smalle balk links. Op een telefoon wordt het vanzelf een strook bovenin,
// omdat .raam een flex-wrap-rij is.
export default function Rail({ hier = "trips", opNieuw }) {
  return (
    <nav className="rail" aria-label="Roadtrip-menu">
      <Link href="/roadtrip" aria-current={hier === "trips" ? "page" : undefined}>
        <Route />
        <span>Trips</span>
      </Link>
      {opNieuw ? (
        <button
          type="button"
          onClick={opNieuw}
          style={{
            width: 52,
            height: 52,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            borderRadius: 8,
            border: 0,
            background: "none",
            font: "inherit",
            fontSize: 9,
            fontWeight: 600,
            color: "var(--zacht)",
            cursor: "pointer",
          }}
        >
          <Plus />
          <span>Nieuw</span>
        </button>
      ) : null}
    </nav>
  );
}
