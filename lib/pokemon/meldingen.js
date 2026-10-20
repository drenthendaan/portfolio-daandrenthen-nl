// Prijsmeldingen: na elke verversing de grote prijswijzigingen van wat je hebt en van wat je
// nog wilt kopen uit je verzamelingen. De laatste 200 staan in Redis (per omgeving, net als de
// prijzen); per verversing gaat er hooguit één pushmelding uit.
import { bedrag, Invoerfout, normaliseerItem } from "./invoer";
import { KAARTEN } from "./kaarten";
import { verstuurPush } from "./push";
import { meldingKandidaten, prijsMeldingen, pushBericht } from "./regels.mjs";
import { getRedis, ITEMS_KEY, leesDrempel, leesStatus, MELDINGEN_INSTELLINGEN_KEY, SLEUTEL } from "./server";
import { leesVerzamelingen } from "./verzamelingen";

const BEWAREN = 200;

// prijzen: de nieuwe prijzen van deze run, vorige: wat er daarvoor stond
export async function verwerkPrijsMeldingen({ redis, prijzen, vorige }) {
  const [status, itemHash, verzamelingen, drempel] = await Promise.all([
    leesStatus(redis),
    redis.hgetall(ITEMS_KEY),
    leesVerzamelingen(redis),
    leesDrempel(redis),
  ]);
  const items = Object.values(itemHash ?? {})
    .filter((i) => i && typeof i === "object")
    .map(normaliseerItem);
  const kandidaten = meldingKandidaten({ kaarten: KAARTEN, status, items, verzamelingen });
  const gevonden = prijsMeldingen({ prijzen, vorige, kandidaten, drempel });
  if (!gevonden.length) return { aantal: 0 };

  // Nieuwste eerst; dezelfde kaart op dezelfde dag maar één keer
  const tijd = new Date().toISOString();
  const nieuw = gevonden.map((m) => ({ ...m, sleutel: `${m.dag}:${m.id}`, tijd }));
  const dubbel = new Set(nieuw.map((m) => m.sleutel));
  const oud = await redis.get(SLEUTEL.meldingen);
  const lijst = [...nieuw, ...(Array.isArray(oud) ? oud : []).filter((m) => !dubbel.has(m.sleutel))];
  await redis.set(SLEUTEL.meldingen, lijst.slice(0, BEWAREN));

  let push;
  try {
    push = await verstuurPush(redis, pushBericht(nieuw));
  } catch (e) {
    push = { fout: String(e?.message || e).slice(0, 200) };
  }
  return { aantal: nieuw.length, push };
}

// Nieuwe drempel: { procent: 1–100, minimum: bedrag in euro (leeg = € 0) }
export async function zetDrempel(invoer) {
  const procent = Number(String(invoer?.procent ?? "").replace(",", "."));
  if (!Number.isFinite(procent) || procent < 1 || procent > 100) {
    throw new Invoerfout("Kies een percentage tussen 1 en 100");
  }
  const minimum = bedrag(invoer?.minimum, "Minimumbedrag") ?? 0;
  if (minimum > 100_000) throw new Invoerfout("Minimumbedrag is te hoog");
  const drempel = { procent: Math.round(procent * 10) / 10, minimum };
  await getRedis().set(MELDINGEN_INSTELLINGEN_KEY, drempel);
  return { drempel };
}
