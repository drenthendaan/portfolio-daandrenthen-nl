"use client";

import { useEffect, useMemo, useState } from "react";
import dynamicImport from "next/dynamic";
import { VINKJES, afstandSleutel, euro, pastVoertuig, toon, uitjeKleur } from "@/lib/roadtrip/regels.mjs";
// Puur rekenwerk zonder serverafhankelijkheden, dus de browser mag dit ook lezen
import { MAX_ACTIVITEITEN } from "@/lib/roadtrip/velden.mjs";
import { Kruis, Openen, Potlood, VINKICOON, Waarschuwing } from "./iconen";
import Acties from "./Acties";
import Modal from "./Modal";
import PlaatsZoeker from "./PlaatsZoeker";

// Of de plek al afgerekend is; dat is het enige wat een stop nog "staat"
const BETAALDNAAM = { ja: "Betaald", nee: "Niet betaald" };

// "1u05" — zelfde notatie als bij de rit naar een dag toe
const rijtijd = (minuten) =>
  `${Math.floor(minuten / 60)}u${String(minuten % 60).padStart(2, "0")}`;

// MapLibre heeft window nodig, dus net als de grote kaart alleen in de browser
const StopKaart = dynamicImport(() => import("./StopKaart"), {
  ssr: false,
  loading: () => <div className="stopkaart" aria-hidden="true" />,
});

const uitStop = (stop) => ({
  naam: stop?.naam ?? "",
  dag: stop?.dag ?? "",
  nachten: stop?.nachten ?? "",
  prijs: stop?.prijs ? String(stop.prijs / 100).replace(".", ",") : "",
  aanbetaald: stop?.aanbetaald ? String(stop.aanbetaald / 100).replace(".", ",") : "",
  ...Object.fromEntries(VINKJES.map(({ veld }) => [veld, !!stop?.[veld]])),
  adres: stop?.adres ?? "",
  link: stop?.link ?? "",
  // Geen invulvelden meer, maar de zoeker zet ze wel: zo blijft de plek op de kaart
  lat: stop?.lat ?? "",
  lon: stop?.lon ?? "",
  activiteiten: stop?.activiteiten ?? [],
});

/**
 * Eén dag is één plek. De regel toont waar je staat en hoe ver het rijden is;
 * aanklikken opent een venster met de gegevens en de notitie. Aanpassen gebeurt
 * ook in een venster — er klapt niets meer uit in de lijst zelf.
 */
export default function DagKaart({
  dag,
  titel,
  rit,
  notitie,
  voertuig,
  afstanden,
  open,
  bewerken,
  onToggle,
  onBewerk,
  onBewaar,
  onWeg,
  onNotitie,
}) {
  const stop = dag.anker;
  const [v, setV] = useState(() => uitStop(stop));
  const [tekst, setTekst] = useState(notitie ?? "");
  const [bezig, setBezig] = useState(false);
  const [zekerWeten, setZekerWeten] = useState(false);
  const [bewaard, setBewaard] = useState(false);
  // De notitie staat vast, net als de rest; pas na het potloodje mag je typen
  const [notitieOpen, setNotitieOpen] = useState(false);

  useEffect(() => {
    if (bewerken) setV(uitStop(stop));
  }, [bewerken, stop]);

  useEffect(() => {
    setTekst(notitie ?? "");
    setNotitieOpen(false);
  }, [notitie]);

  if (!stop) return null;

  const zet = (veld) => (e) => setV((oud) => ({ ...oud, [veld]: e.target.value }));
  const vink = (veld) => (e) => setV((oud) => ({ ...oud, [veld]: e.target.checked }));

  // Het naamveld is ook de zoeker: een gekozen resultaat vult naam, adres en plek
  const kiesPlek = (plek) =>
    setV((oud) => ({
      ...oud,
      naam: plek.naam,
      adres: plek.adres ?? oud.adres,
      lat: String(plek.lat),
      lon: String(plek.lon),
    }));
  const opKaart = v.lat !== "" && v.lon !== "";
  const uitslag = pastVoertuig(stop.max, voertuig);
  const uitjes = stop.activiteiten ?? [];
  // De weg naar elk uitje, in dezelfde volgorde. Vastgehouden, want anders
  // zou het kaartje bij elke render zijn spelden opnieuw neerzetten.
  const uitjeLijnen = useMemo(
    () => uitjes.map((a) => afstanden?.[afstandSleutel(stop.id, a)]?.lijn ?? null),
    [uitjes, afstanden, stop.id]
  );
  const notitieGewijzigd = (tekst ?? "") !== (notitie ?? "");

  // Wat de plek heeft, met icoontjes. Alleen in het venster: de lijst blijft rustig.
  const voorzieningen = VINKJES.filter((x) => x.soort === "voorziening" && stop[x.veld]);

  const regels = [
    stop.nachten ? ["Nachten", `${stop.nachten} ${stop.nachten === 1 ? "nacht" : "nachten"}`] : null,
    stop.prijs ? ["Prijs", euro(stop.prijs)] : null,
    // Is de plek helemaal betaald, dan zegt een aanbetaling niets meer
    stop.aanbetaald && !stop.betaald ? ["Aanbetaald", euro(stop.aanbetaald)] : null,
    stop.prijs && stop.aanbetaald && !stop.betaald
      ? ["Nog te betalen", euro(Math.max(0, stop.prijs - stop.aanbetaald))]
      : null,
    ["Aangevraagd", <span className={`jaNee ${stop.aangevraagd ? "ja" : "nee"}`}>{stop.aangevraagd ? "Ja" : "Nee"}</span>],
    ["Bevestigd", <span className={`jaNee ${stop.bevestigd ? "ja" : "nee"}`}>{stop.bevestigd ? "Ja" : "Nee"}</span>],
    ["Betaald", <span className={`jaNee ${stop.betaald ? "ja" : "nee"}`}>{stop.betaald ? "Ja" : "Nee"}</span>],
    voorzieningen.length
      ? [
          "Voorzieningen",
          <span className="kenmerklijst">
            {voorzieningen.map(({ veld, naam }) => {
              const Icoon = VINKICOON[veld];
              return (
                <span key={veld} className={`kenmerk ${veld}`}>
                  <Icoon size={15} />
                  {naam}
                </span>
              );
            })}
          </span>,
        ]
      : null,
    stop.adres ? ["Adres", stop.adres] : null,
    stop.link
      ? [
          "Website",
          <a href={stop.link} target="_blank" rel="noopener noreferrer">
            {new URL(stop.link).hostname.replace(/^www\./, "")}
          </a>,
        ]
      : null,
    stop.lat != null && stop.lon != null
      ? ["Op de kaart", `${Number(stop.lat).toFixed(4)}, ${Number(stop.lon).toFixed(4)}`]
      : null,
    stop.max?.lengte ? ["Max lengte", toon(stop.max.lengte, "cm")] : null,
    stop.max?.hoogte ? ["Max hoogte", toon(stop.max.hoogte, "cm")] : null,
  ].filter(Boolean);

  // Een gekozen plek wordt een activiteit; zonder coördinaten heeft het geen zin,
  // want dan valt er niets te tekenen en geen afstand te berekenen.
  const voegUitjeToe = (plek) => {
    if (!Number.isFinite(plek?.lat) || !Number.isFinite(plek?.lon)) return;
    setV((oud) =>
      oud.activiteiten.length >= MAX_ACTIVITEITEN
        ? oud
        : {
            ...oud,
            activiteiten: [
              ...oud.activiteiten,
              { naam: plek.naam, lat: plek.lat, lon: plek.lon, adres: plek.adres ?? null, link: null },
            ],
          }
    );
  };

  const haalUitjeWeg = (i) =>
    setV((oud) => ({ ...oud, activiteiten: oud.activiteiten.filter((_, j) => j !== i) }));

  const bewaarStop = async (e) => {
    e.preventDefault();
    if (!v.naam.trim() || bezig) return;
    setBezig(true);
    const gelukt = await onBewaar({
      id: stop.id,
      naam: v.naam,
      dag: v.dag === "" ? null : Number(v.dag),
      nachten: v.nachten !== "" ? Number(v.nachten) : null,
      prijs: v.prijs === "" ? null : v.prijs,
      aanbetaald: v.aanbetaald === "" ? null : v.aanbetaald,
      ...Object.fromEntries(VINKJES.map(({ veld }) => [veld, v[veld]])),
      adres: v.adres || null,
      link: v.link.trim() || null,
      lat: v.lat === "" ? null : Number(v.lat),
      lon: v.lon === "" ? null : Number(v.lon),
      activiteiten: v.activiteiten,
    });
    setBezig(false);
    if (gelukt) onBewerk(null);
  };

  const bewaarNotitie = async () => {
    await onNotitie(tekst.trim() || null);
    setNotitieOpen(false);
    setBewaard(true);
    setTimeout(() => setBewaard(false), 2000);
  };

  // Annuleren zet terug wat er stond, zodat je niets kwijt bent wat al bewaard was
  const stopNotitie = () => {
    setTekst(notitie ?? "");
    setNotitieOpen(false);
  };

  // Het puntjesmenu vraagt zelf al "Zeker weten?", dus daar mag het direct.
  const wegDirect = async () => {
    setBezig(true);
    await onWeg(stop.id);
    setBezig(false);
  };

  // De knop in het formulier staat alleen, en vraagt het dus zelf.
  const weg = () => (zekerWeten ? wegDirect() : setZekerWeten(true));

  return (
    <div className="dag">
      <div className="dagbalk">
        <button
          type="button"
          className="dagtoggle"
          aria-haspopup="dialog"
          onClick={() => onToggle(dag.nr)}
        >
          <span className="nr">
            Nacht {dag.nr}
            {dag.tot > dag.nr ? `–${dag.tot}` : ""}
          </span>
          <span className="waar">{stop.naam}</span>
          {rit ? <span className="rit">{rit.km.toLocaleString("nl-NL")} km</span> : null}
          {/* De kleur alleen zegt een voorleesprogramma niets, dus het woord staat erbij */}
          {/* Groen zodra de plek bevestigd is; betalen kan later nog */}
          <span className={`bol ${stop.bevestigd ? "bevestigd" : "open"}`} aria-hidden="true" />
          <span className="verborgen">{stop.bevestigd ? "Bevestigd" : "Nog niet bevestigd"}</span>
          {/* Een kader met een pijl eruit: deze regel opent een venster */}
          <Openen size={15} />
        </button>
      </div>

      {!uitslag.past ? (
        <p className="past-niet">
          <Waarschuwing /> Past niet
          {uitslag.problemen.map((p) => (
            <span key={p.veld}>{p.tekst}</span>
          ))}
        </p>
      ) : null}

      {bewerken ? (
        <Modal titel={`Dag ${dag.nr} aanpassen`} onSluit={() => onBewerk(null)} breed>
          <form className="dagvelden" onSubmit={bewaarStop}>
            <div className="velden">
              <div style={{ gridColumn: "1 / -1" }}>
                <PlaatsZoeker
                  id={`n-${stop.id}`}
                  label="Waar sta je"
                  placeholder="Zoek een camping, stad of adres"
                  geenTreffers="Niets gevonden. De naam die je typte blijft gewoon staan."
                  value={v.naam}
                  onChange={(naam) => setV((oud) => ({ ...oud, naam }))}
                  onKies={kiesPlek}
                  autoFocus
                />
                <p className="plekstand">
                  {opKaart
                    ? "Staat op de kaart. Kies een ander zoekresultaat om hem te verplaatsen."
                    : "Nog niet op de kaart: kies een zoekresultaat."}
                </p>
              </div>
              <div>
                <label htmlFor={`d-${stop.id}`}>Dag</label>
                <input id={`d-${stop.id}`} type="number" min="1" value={v.dag} onChange={zet("dag")} />
              </div>
              <div>
                <label htmlFor={`na-${stop.id}`}>Nachten</label>
                <input id={`na-${stop.id}`} type="number" min="1" value={v.nachten} onChange={zet("nachten")} />
              </div>
              <div>
                <label htmlFor={`p-${stop.id}`}>Prijs</label>
                <input id={`p-${stop.id}`} type="text" value={v.prijs} onChange={zet("prijs")} />
              </div>
              <div>
                <label htmlFor={`ab-${stop.id}`}>Aanbetaald</label>
                <input id={`ab-${stop.id}`} type="text" value={v.aanbetaald} onChange={zet("aanbetaald")} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor={`a-${stop.id}`}>Adres</label>
                <input id={`a-${stop.id}`} type="text" value={v.adres} onChange={zet("adres")} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor={`li-${stop.id}`}>Website</label>
                <input
                  id={`li-${stop.id}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://www.camping-…"
                  value={v.link}
                  onChange={zet("link")}
                />
              </div>
              <div className="vinkjes" style={{ gridColumn: "1 / -1" }}>
                {VINKJES.map(({ veld, naam }) => (
                  <label key={veld} className="vinkje">
                    <input type="checkbox" checked={v[veld]} onChange={vink(veld)} />
                    {naam}
                  </label>
                ))}
              </div>
            </div>

            <div className="uitjes">
              <h4>Activiteiten</h4>
              <p className="uitleg" style={{ margin: "0 0 10px" }}>
                Wat je hier wilt doen. Kies een plek uit de lijst — de afstand vanaf deze
                stop rekent hij daarna zelf uit.
              </p>

              {v.activiteiten.length ? (
                <ul className="uitjelijst">
                  {v.activiteiten.map((a, i) => (
                    <li key={`${a.lat},${a.lon},${i}`}>
                      <span className="nr" style={{ background: uitjeKleur(i) }}>
                        {i + 1}
                      </span>
                      <span className="wat">
                        <strong>{a.naam}</strong>
                        {a.adres ? <span className="waar">{a.adres}</span> : null}
                      </span>
                      <button
                        type="button"
                        className="weg"
                        onClick={() => haalUitjeWeg(i)}
                        aria-label={`${a.naam} verwijderen`}
                      >
                        <Kruis />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {v.activiteiten.length < MAX_ACTIVITEITEN ? (
                <PlaatsZoeker
                  id={`u-${stop.id}`}
                  label="Activiteit erbij"
                  placeholder="Watervallen, museum, restaurant…"
                  geenTreffers="Niets gevonden. Probeer een andere naam."
                  onKies={voegUitjeToe}
                />
              ) : (
                <p className="uitleg" style={{ margin: 0 }}>
                  Vol — hoogstens {MAX_ACTIVITEITEN} activiteiten per stop.
                </p>
              )}
            </div>

            <div className="modaalknoppen">
              <button type="submit" className="knop" disabled={bezig}>
                {bezig ? "Bezig…" : "Opslaan"}
              </button>
              <button type="button" className="knop stil" onClick={() => onBewerk(null)}>
                Annuleren
              </button>
              <button type="button" className="knop gevaar" onClick={weg} disabled={bezig}>
                {zekerWeten ? "Zeker weten?" : "Verwijderen"}
              </button>
            </div>
          </form>
        </Modal>
      ) : open ? (
        <Modal
          titel={`Nacht ${dag.nr} · ${stop.naam}`}
          onSluit={() => onToggle(null)}
          acties={
            <Acties
              label={`Acties voor dag ${dag.nr}`}
              items={[
                // Bewerken staat al als knop onderin, dus hier alleen de rest
                ...Object.entries(BETAALDNAAM).map(([id, naam]) => ({
                  naam,
                  nu: stop.betaald === (id === "ja"),
                  uit: stop.betaald === (id === "ja"),
                  doe: () => onBewaar({ id: stop.id, betaald: id === "ja" }),
                })),
                { scheiding: true },
                { naam: "Dag verwijderen", gevaar: true, doe: wegDirect },
              ]}
            />
          }
        >
          <div className="daginhoud">
            <p className="dagregel">
              {titel}
              {rit
                ? ` · ${rit.km.toLocaleString("nl-NL")} km rijden, ${Math.floor(rit.minuten / 60)}u${String(
                    rit.minuten % 60
                  ).padStart(2, "0")}${rit.schatting ? " (schatting)" : ""}`
                : " · geen rit"}
            </p>

            <dl className="gegevens">
              {regels.map(([naam, waarde]) => (
                <div key={naam}>
                  <dt>{naam}</dt>
                  <dd>{waarde}</dd>
                </div>
              ))}
            </dl>

            {uitjes.length ? (
              <div className="uitjes">
                <h4>Activiteiten</h4>
                <StopKaart stop={stop} activiteiten={uitjes} lijnen={uitjeLijnen} />
                <ol className="uitjelijst afstand">
                  {uitjes.map((a, i) => {
                    const heen = afstanden?.[afstandSleutel(stop.id, a)];
                    return (
                      <li key={`${a.lat},${a.lon},${i}`}>
                        <span className="nr" style={{ background: uitjeKleur(i) }}>
                          {i + 1}
                        </span>
                        <span className="wat">
                          <strong>{a.naam}</strong>
                          {a.adres ? <span className="waar">{a.adres}</span> : null}
                        </span>
                        <span className="ver">
                          {heen
                            ? `${heen.km.toLocaleString("nl-NL")} km · ${rijtijd(heen.minuten)}${
                                heen.schatting ? " (schatting)" : ""
                              }`
                            : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}

            {!uitslag.past ? (
              <p className="past-niet">
                <Waarschuwing /> Past niet
                {uitslag.problemen.map((p) => (
                  <span key={p.veld}>{p.tekst}</span>
                ))}
              </p>
            ) : null}

            <div className="notitiekop">
              <h4>Notitie</h4>
              {!notitieOpen ? (
                <button
                  type="button"
                  className="potlood"
                  onClick={() => setNotitieOpen(true)}
                  aria-label="Notitie aanpassen"
                >
                  <Potlood />
                </button>
              ) : null}
              {bewaard ? <span className="verbinding">Opgeslagen</span> : null}
            </div>

            {notitieOpen ? (
              <>
                <textarea
                  autoFocus
                  value={tekst}
                  onChange={(e) => setTekst(e.target.value)}
                  placeholder="Wat je hier wilt doen, hoe laat de receptie sluit, waar je brood haalt."
                />
                <div className="modaalknoppen">
                  <button type="button" className="knop" onClick={bewaarNotitie} disabled={!notitieGewijzigd}>
                    Notitie opslaan
                  </button>
                  <button type="button" className="knop stil" onClick={stopNotitie}>
                    Annuleren
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={`notitietekst${notitie?.trim() ? "" : " leegje"}`}>
                  {notitie?.trim() ? notitie : "Nog niets opgeschreven."}
                </p>
                <div className="modaalknoppen">
                  {/* Van kijken naar aanpassen, zonder eerst het venster te sluiten */}
                  <button type="button" className="knop stil" onClick={() => onBewerk(dag.nr)}>
                    Dag aanpassen
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
