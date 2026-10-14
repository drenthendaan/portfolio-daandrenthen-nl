"use client";

// Schrijven naar de API met de token die op dit apparaat bewaard is ("pika-token").

export class GeenToken extends Error {}

export function leesToken() {
  try {
    return localStorage.getItem("pika-token");
  } catch {
    return null;
  }
}

export function bewaarToken(token) {
  try {
    if (token) localStorage.setItem("pika-token", token);
    else localStorage.removeItem("pika-token");
  } catch {}
}

export async function schrijf(url, { method = "POST", body } = {}) {
  const token = leesToken();
  if (!token) throw new GeenToken("Voer je token in om op te slaan");
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-pikachu-token": token },
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

// Laat andere tabbladen in deze browser weten dat de items veranderd zijn
export function meldItemsGewijzigd(versie) {
  try {
    localStorage.setItem("pk-items-versie", versie || new Date().toISOString());
  } catch {}
}
