// Pushmeldingen (Web Push) naar de apparaten waarop ze aanstaan. Op de iPhone werkt dat vanuit
// de app op het beginscherm (iOS 16.4+). Het sleutelpaar (VAPID) komt uit de env
// (VAPID_PUBLIC_KEY en VAPID_PRIVATE_KEY) of wordt één keer gemaakt en in Redis bewaard.
import { createHash } from "node:crypto";
import webpush from "web-push";
import { Invoerfout } from "./invoer";
import { getRedis, SLEUTEL } from "./server";

const ONDERWERP = process.env.VAPID_SUBJECT || "https://daandrenthen.nl";
const MAX_APPARATEN = 20;

export async function vapidSleutels(redis) {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = process.env;
  if (publicKey && privateKey) return { publicKey, privateKey };
  let s = await redis.get(SLEUTEL.vapid);
  if (!s?.publicKey || !s?.privateKey) {
    // NX: als twee verzoeken tegelijk beginnen, wint er één en gebruiken ze allebei dat paar
    await redis.set(SLEUTEL.vapid, webpush.generateVAPIDKeys(), s ? {} : { nx: true });
    s = await redis.get(SLEUTEL.vapid);
  }
  return { publicKey: s.publicKey, privateKey: s.privateKey };
}

const idVan = (endpoint) => createHash("sha256").update(String(endpoint ?? "")).digest("hex").slice(0, 24);

// Een PushSubscription zoals de browser hem geeft (subscription.toJSON())
function schoon(abonnement) {
  const endpoint = String(abonnement?.endpoint ?? "");
  const { p256dh, auth } = abonnement?.keys ?? {};
  let url = null;
  try {
    url = new URL(endpoint);
  } catch {}
  if (!url || url.protocol !== "https:" || endpoint.length > 1000) throw new Invoerfout("Ongeldig pushadres");
  const b64 = /^[A-Za-z0-9_-]+={0,2}$/;
  if (!b64.test(p256dh ?? "") || !b64.test(auth ?? "") || p256dh.length > 200 || auth.length > 100) {
    throw new Invoerfout("Ongeldige pushsleutels");
  }
  return { endpoint, keys: { p256dh, auth } };
}

export async function bewaarAbonnement(abonnement, apparaat) {
  const sub = schoon(abonnement);
  const redis = getRedis();
  const id = idVan(sub.endpoint);
  const alle = (await redis.hgetall(SLEUTEL.push)) ?? {};
  if (!alle[id] && Object.keys(alle).length >= MAX_APPARATEN) throw new Invoerfout("Te veel apparaten aangemeld");
  await redis.hset(SLEUTEL.push, {
    [id]: {
      ...sub,
      apparaat: String(apparaat ?? "").slice(0, 40),
      gemaakt: alle[id]?.gemaakt ?? new Date().toISOString(),
    },
  });
  return { ok: true };
}

export async function verwijderAbonnement(endpoint) {
  await getRedis().hdel(SLEUTEL.push, idVan(endpoint));
  return { ok: true };
}

// Eén bericht naar alle aangemelde apparaten (of alleen naar `alleen`). Aanmeldingen die de
// pushdienst niet meer kent (404/410), worden opgeruimd.
//   bericht: { titel, tekst, url, tag, aantal } (zie public/pokemon-app/sw.js)
export async function verstuurPush(redis, bericht, { alleen } = {}) {
  const lijst = Object.entries((await redis.hgetall(SLEUTEL.push)) ?? {}).filter(([id]) => !alleen || id === alleen);
  if (!lijst.length) return { verstuurd: 0, mislukt: 0 };
  const { publicKey, privateKey } = await vapidSleutels(redis);
  const opties = {
    vapidDetails: { subject: ONDERWERP, publicKey, privateKey },
    TTL: 24 * 3600,
    urgency: "normal",
    timeout: 10_000,
  };
  const weg = [];
  const fouten = [];
  let verstuurd = 0;
  await Promise.all(
    lijst.map(async ([id, sub]) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(bericht), opties);
        verstuurd++;
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) weg.push(id);
        fouten.push(`${e?.statusCode ?? "geen verbinding"}${e?.body ? ` ${String(e.body).slice(0, 120)}` : ""}`);
      }
    })
  );
  if (weg.length) await redis.hdel(SLEUTEL.push, ...weg);
  return { verstuurd, mislukt: fouten.length, opgeruimd: weg.length, fouten };
}

export async function stuurTestmelding(endpoint) {
  const redis = getRedis();
  const id = idVan(endpoint);
  if (!(await redis.hexists(SLEUTEL.push, id))) {
    throw new Invoerfout("Dit apparaat is niet aangemeld. Zet pushmeldingen opnieuw aan.");
  }
  const uitkomst = await verstuurPush(
    redis,
    {
      titel: "Testmelding",
      tekst: "Pushmeldingen werken. Bij grote prijswijzigingen krijg je hier een melding.",
      url: "/pokemon#meldingen",
      tag: "test",
    },
    { alleen: id }
  );
  if (!uitkomst.verstuurd) {
    throw new Invoerfout(`Versturen lukte niet (${uitkomst.fouten?.[0] ?? "onbekend"})`);
  }
  return { ok: true };
}
