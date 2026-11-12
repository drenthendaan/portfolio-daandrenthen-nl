"use client";

// De enige schrijfweg naar /api/roadtrip. Het token wordt op dit apparaat bewaard;
// lezen mag iedereen met de link, schrijven alleen met token.
const TOKEN = "trip-token";
const VERSIE = "trip-versie";

export class GeenToken extends Error {}

const lees = (sleutel) => {
  try {
    return localStorage.getItem(sleutel);
  } catch {
    return null;
  }
};

const zet = (sleutel, waarde) => {
  try {
    if (waarde === null) localStorage.removeItem(sleutel);
    else localStorage.setItem(sleutel, waarde);
  } catch {
    /* privémodus: dan onthouden we het gewoon niet */
  }
};

export const leesToken = () => lees(TOKEN);
export const bewaarToken = (t) => zet(TOKEN, t);
export const heeftToken = () => !!lees(TOKEN);

export async function schrijf(url, { method = "POST", body } = {}) {
  const token = leesToken();
  if (!token) throw new GeenToken("Voer je token in om op te slaan");

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-roadtrip-token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    bewaarToken(null);
    throw new GeenToken("Token klopt niet, voer hem opnieuw in");
  }
  if (!res.ok) throw new Error(data.error || `Opslaan lukte niet (${res.status})`);
  return data;
}

// Seintje aan andere tabbladen in deze browser; het tabblad dat schrijft krijgt
// zijn eigen storage-event niet, en dat is precies de bedoeling.
export function meldGewijzigd(versie) {
  if (versie) zet(VERSIE, versie);
}

export const VERSIE_SLEUTEL = VERSIE;
