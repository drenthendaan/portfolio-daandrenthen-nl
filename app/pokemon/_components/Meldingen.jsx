"use client";

import { useEffect, useRef, useState } from "react";
import { dagErvoor, euro, STAND_LABEL, STANDAARD_DREMPEL } from "@/lib/pokemon/regels.mjs";
import { bewaarToken, GeenToken, leesToken, schrijf } from "./api";
import KaartAfbeelding from "./KaartAfbeelding";
import { datumKort } from "./KaartDetail";

const SW = "/pokemon-app/sw.js";
const SCOPE = "/pokemon";
const FILTERS = [
  ["alles", "Alles"],
  ["bezit", "In je vault"],
  ["betaald", "Onderweg"],
  ["nog", "Nog kopen"],
];

const pct = (p) => `${Math.round(Math.abs(p))}%`;
const procentTekst = (p) => String(p).replace(".", ",");
const euroInvoer = (c) => (c / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// iPadOS doet zich voor als Mac, maar heeft een touchscreen
const isIOS = () =>
  !/Android/.test(navigator.userAgent) &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const losseApp = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

function apparaatNaam() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (isIOS()) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  return /Windows/.test(ua) ? "Windows" : "Browser";
}

// Publieke sleutel van de server (base64url) ↔ bytes
function naarBytes(b64) {
  const s = (b64 + "===".slice((b64.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
const vanBytes = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Service worker aanmelden en wachten tot hij actief is
async function registratie() {
  await navigator.serviceWorker.register(SW, { scope: SCOPE });
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, nee) =>
      setTimeout(() => nee(new Error("De service worker start niet. Herlaad de pagina en probeer het opnieuw.")), 10_000)
    ),
  ]);
}

function uitleg(e) {
  if (e instanceof GeenToken) return e.message;
  if (e?.name === "NotAllowedError") return "Geen toestemming voor meldingen.";
  if (e?.name === "AbortError" || e?.name === "NotSupportedError") {
    return "Deze browser kan zich niet aanmelden voor pushmeldingen.";
  }
  return e?.message || "Dat lukte niet.";
}

// Venster met de prijsmeldingen, de pushmeldingen van dit apparaat en de drempel.
//   meldingen: [{ sleutel, id, soort, naam, set, nr, img, stand, van, naar, vanDag, dag, verschil, procent, tijd }]
//   standVan(m): de stand van nu (de melding zelf bewaart de stand van toen)
//   nieuwVanaf: tijd van de laatst gelezen melding vóór het openen; nieuwere krijgen een stip
export default function Meldingen({ meldingen, drempel = STANDAARD_DREMPEL, nieuwVanaf, standVan, onOpen, onDrempel, onSluit }) {
  const ref = useRef(null);
  const terug = useRef(null);
  const wachtend = useRef(null); // actie die op de token wacht
  const [filter, setFilter] = useState("alles");
  const [push, setPush] = useState("laden");
  const [sleutel, setSleutel] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const [fout, setFout] = useState("");
  const [vraagToken, setVraagToken] = useState(false);
  const [token, setToken] = useState("");
  const [procent, setProcent] = useState(procentTekst(drempel.procent));
  const [minimum, setMinimum] = useState(euroInvoer(drempel.minimum));

  useEffect(() => {
    terug.current = document.activeElement;
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  // Drempel van de server (bijv. na opnieuw ophalen) in het formulier
  useEffect(() => {
    setProcent(procentTekst(drempel.procent));
    setMinimum(euroInvoer(drempel.minimum));
  }, [drempel.procent, drempel.minimum]);

  // Kan dit apparaat pushmeldingen krijgen, en staan ze aan?
  useEffect(() => {
    let weg = false;
    const zet = (s) => !weg && setPush(s);
    (async () => {
      if (isIOS() && !losseApp()) return zet("beginscherm");
      if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) {
        return zet(isIOS() ? "ios-oud" : "kan-niet");
      }
      if (Notification.permission === "denied") return zet("geblokkeerd");
      try {
        const reg = await navigator.serviceWorker.register(SW, { scope: SCOPE });
        const sub = await reg.pushManager.getSubscription();
        zet(sub && Notification.permission === "granted" ? "aan" : "uit");
      } catch {
        return zet("kan-niet");
      }
      // Alvast ophalen, zodat een tik op Aanzetten meteen om toestemming kan vragen
      haalSleutel().catch(() => {});
    })();
    return () => {
      weg = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function haalSleutel() {
    const res = await fetch("/api/pokemon/push", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!data.sleutel) throw new Error(data.error || "Geen pushsleutel van de server");
    setSleutel(data.sleutel);
    return data.sleutel;
  }

  // Zonder token eerst het tokenveld; na opslaan gaat de actie verder
  function metToken(actie) {
    setFout("");
    setMelding("");
    if (!leesToken()) {
      wachtend.current = actie;
      setVraagToken(true);
      return;
    }
    actie();
  }
  function mislukt(e, actie) {
    if (e instanceof GeenToken) {
      wachtend.current = actie;
      setVraagToken(true);
    }
    setFout(uitleg(e));
  }
  function tokenOpslaan(e) {
    e.preventDefault();
    if (!token.trim()) return;
    bewaarToken(token.trim());
    setToken("");
    setVraagToken(false);
    setFout("");
    const actie = wachtend.current;
    wachtend.current = null;
    actie?.();
  }

  async function zetAan() {
    setBezig(true);
    try {
      // Eerst de toestemming: Safari vraagt die alleen direct na een tik
      if (Notification.permission !== "granted") {
        const keuze = await Notification.requestPermission();
        if (keuze !== "granted") {
          setPush(keuze === "denied" ? "geblokkeerd" : "uit");
          return;
        }
      }
      const reg = await registratie();
      const publiek = sleutel ?? (await haalSleutel());
      let sub = await reg.pushManager.getSubscription();
      const oud = sub?.options?.applicationServerKey;
      if (sub && oud && vanBytes(oud) !== publiek) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: naarBytes(publiek) });
      await schrijf("/api/pokemon/push", { body: { abonnement: sub.toJSON(), apparaat: apparaatNaam() } });
      setPush("aan");
      setMelding("Pushmeldingen staan aan op dit apparaat.");
    } catch (e) {
      mislukt(e, zetAan);
    } finally {
      setBezig(false);
    }
  }

  async function test() {
    setBezig(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SCOPE);
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setPush("uit");
        throw new Error("Dit apparaat is niet aangemeld. Zet pushmeldingen opnieuw aan.");
      }
      await schrijf("/api/pokemon/push?test=1", { body: { endpoint: sub.endpoint } });
      setMelding("Testmelding verstuurd. Die kan een paar seconden onderweg zijn.");
    } catch (e) {
      mislukt(e, test);
    } finally {
      setBezig(false);
    }
  }

  async function zetUit() {
    setBezig(true);
    setFout("");
    setMelding("");
    try {
      const reg = await navigator.serviceWorker.getRegistration(SCOPE);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // Lukt afmelden op de server niet (bijv. geen token), dan ruimt die hem bij de volgende melding op
        await schrijf("/api/pokemon/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setPush("uit");
      setMelding("Pushmeldingen staan uit op dit apparaat.");
    } catch (e) {
      setFout(uitleg(e));
    } finally {
      setBezig(false);
    }
  }

  function bewaarDrempel(e) {
    e.preventDefault();
    const actie = async () => {
      setBezig(true);
      try {
        const res = await schrijf("/api/pokemon/meldingen", { method: "PATCH", body: { procent, minimum } });
        onDrempel(res.drempel);
        setProcent(procentTekst(res.drempel.procent));
        setMinimum(euroInvoer(res.drempel.minimum));
        setMelding("Drempel opgeslagen. Die geldt vanaf de volgende prijsupdate.");
      } catch (err) {
        mislukt(err, actie);
      } finally {
        setBezig(false);
      }
    };
    metToken(actie);
  }

  // Per prijsdag, nieuwste eerst (zo staan ze ook opgeslagen)
  const lijst = meldingen.map((m) => ({ ...m, nu: standVan(m) }));
  const telling = { alles: lijst.length };
  for (const m of lijst) telling[m.nu] = (telling[m.nu] || 0) + 1;
  const zichtbaar = filter === "alles" ? lijst : lijst.filter((m) => m.nu === filter);
  const perDag = [];
  for (const m of zichtbaar) {
    const laatste = perDag.at(-1);
    if (laatste?.[0] === m.dag) laatste[1].push(m);
    else perDag.push([m.dag, [m]]);
  }

  return (
    <dialog
      ref={ref}
      className="detail itemvenster meldingvenster"
      aria-labelledby="mv-titel"
      onClose={() => {
        onSluit();
        terug.current?.focus?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <div className="iv mv">
        <button type="button" className="sluit" onClick={() => ref.current.close()} aria-label="Sluiten">
          ×
        </button>
        <h2 id="mv-titel">Prijsmeldingen</h2>
        <p className="iv-hint">
          Bij ≥ {procentTekst(drempel.procent)}% én ≥ {euro(drempel.minimum)} verschil met de prijs van 24 uur
          eerder, voor wat je hebt en wat je nog wilt kopen. Na elke prijsupdate (elke nacht).
        </p>

        <section className="mv-instellingen" aria-labelledby="mv-push">
          <h3 id="mv-push">Pushmeldingen op dit apparaat</h3>
          {push === "laden" && <p className="iv-hint">Even kijken…</p>}
          {push === "beginscherm" && (
            <p className="iv-hint">
              Op de iPhone werken pushmeldingen alleen vanuit de app op je beginscherm. Tik in Safari op Deel en kies
              &quot;Zet op beginscherm&quot;. Open Pokémon daarna vanaf je beginscherm en zet ze hier aan.
            </p>
          )}
          {push === "ios-oud" && <p className="iv-hint">Pushmeldingen hebben iOS 16.4 of nieuwer nodig.</p>}
          {push === "kan-niet" && <p className="iv-hint">Deze browser kan geen pushmeldingen ontvangen.</p>}
          {push === "geblokkeerd" && (
            <p className="iv-hint">
              Meldingen zijn geblokkeerd. Zet ze aan in de instellingen (op de iPhone: Instellingen › Meldingen ›
              Pokémon) en kom dan hier terug.
            </p>
          )}
          {push === "uit" && (
            <div className="iv-knoppen">
              <button type="button" className="primair" disabled={bezig} onClick={() => metToken(zetAan)}>
                {bezig ? "Bezig…" : "Pushmeldingen aanzetten"}
              </button>
            </div>
          )}
          {push === "aan" && (
            <>
              <p className="iv-hint">Staan aan. Na een prijsupdate met grote wijzigingen krijg je één melding.</p>
              <div className="iv-knoppen">
                <button type="button" className="tweede" disabled={bezig} onClick={() => metToken(test)}>
                  Testmelding
                </button>
                <button type="button" className="gevaar" disabled={bezig} onClick={zetUit}>
                  Uitzetten
                </button>
              </div>
            </>
          )}

          <details className="mv-drempel">
            <summary>Drempel aanpassen</summary>
            <form onSubmit={bewaarDrempel} noValidate>
              <div className="iv-rij">
                <label>
                  Vanaf (%)
                  <input inputMode="decimal" value={procent} onChange={(e) => setProcent(e.target.value)} />
                </label>
                <label>
                  En minstens (€)
                  <input inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
                </label>
              </div>
              <div className="iv-knoppen">
                <button type="submit" className="primair" disabled={bezig}>
                  Opslaan
                </button>
              </div>
            </form>
            <p className="iv-hint">Geldt voor alle apparaten.</p>
          </details>
        </section>

        {vraagToken && (
          <form className="detail-token" onSubmit={tokenOpslaan}>
            <label htmlFor="mv-token">Token (wordt op dit apparaat onthouden)</label>
            <div>
              <input
                id="mv-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoFocus
              />
              <button type="submit">Opslaan</button>
            </div>
          </form>
        )}
        {fout && (
          <p className="iv-fout" role="alert">
            {fout}
          </p>
        )}
        {melding && (
          <p className="detail-melding" role="status">
            {melding}
          </p>
        )}

        {lijst.length > 0 && (
          <div className="seg" role="tablist" aria-label="Welke meldingen">
            {FILTERS.filter(([id]) => id === "alles" || id === filter || telling[id]).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
                {label} <span>{telling[id] ?? 0}</span>
              </button>
            ))}
          </div>
        )}
        {!lijst.length ? (
          <p className="leeg">
            Nog geen meldingen. Na de volgende prijsupdate zie je hier wat flink is gestegen of gedaald.
          </p>
        ) : !zichtbaar.length ? (
          <p className="leeg">Geen meldingen in deze groep.</p>
        ) : (
          perDag.map(([dag, rijen]) => (
            <section key={dag} className="mv-dag" aria-labelledby={`mv-dag-${dag}`}>
              <h3 id={`mv-dag-${dag}`}>Prijzen van {datumKort(dag)}</h3>
              <ul className="mv-lijst">
                {rijen.map((m) => (
                  <Rij key={m.sleutel} m={m} nieuw={!nieuwVanaf || m.tijd > nieuwVanaf} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </dialog>
  );
}

function Rij({ m, nieuw, onOpen }) {
  const op = m.verschil > 0;
  const sinds = m.vanDag && m.vanDag !== dagErvoor(m.dag) ? `sinds ${datumKort(m.vanDag)}` : null;
  const product = m.soort === "item" && !/^\d/.test(m.nr || "");
  return (
    <li>
      <button
        type="button"
        className="mv-rij"
        onClick={() => onOpen(m)}
        aria-label={`${m.naam}, ${STAND_LABEL[m.nu]}: ${op ? "gestegen" : "gedaald"} met ${pct(m.procent)}, van ${euro(m.van)} naar ${euro(m.naar)}${sinds ? `, ${sinds}` : ""}${nieuw ? ", nieuw" : ""}`}
      >
        <span className={`mv-plaat${product ? " product" : ""}`}>
          <KaartAfbeelding key={(m.img ?? []).join()} img={m.img ?? []} />
        </span>
        <span className="mv-tekst">
          <b>
            {nieuw && <i className="mv-nieuw" />}
            {m.naam}
          </b>
          {(m.set || m.nr) && <small>{[m.set, m.nr].filter(Boolean).join(" · ")}</small>}
          <span className={`stand ${m.nu}`}>{STAND_LABEL[m.nu]}</span>
        </span>
        <span className={`mv-prijs ${op ? "op" : "neer"}`}>
          <b>
            {op ? "▲" : "▼"} {pct(m.procent)}
          </b>
          <small>
            {euro(m.van)} → {euro(m.naar)}
          </small>
          {sinds && <small>{sinds}</small>}
        </span>
      </button>
    </li>
  );
}
