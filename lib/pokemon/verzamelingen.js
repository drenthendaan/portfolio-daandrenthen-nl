// Verzamelingen: de vaste Pikachu-verzameling en zelf aangemaakte (in het begin lege)
// verzamelingen. Per verzameling eigen thema's; bij Pikachu ook verborgen vaste kaarten.
import { CARD_IDS } from "@/lib/pikachu";
import { Invoerfout, nieuweVersie, slug, tekst, vrijeId } from "./invoer";
import { getRedis, ITEMS_KEY, VERZAMELINGEN_KEY } from "./server";
import { themasVoor } from "./themas.mjs";

export const PIKACHU = { id: "pikachu", naam: "Pikachu-verzameling", vast: true };

function opschonen(v) {
  return {
    ...v,
    themas: Array.isArray(v.themas) ? v.themas : [],
    verborgen: Array.isArray(v.verborgen) ? v.verborgen : [],
  };
}

// Pikachu altijd eerst, daarna de eigen verzamelingen op volgorde van aanmaken
export async function leesVerzamelingen(redis = getRedis({ alleenLezen: true })) {
  const hash = (await redis.hgetall(VERZAMELINGEN_KEY)) ?? {};
  const eigen = Object.values(hash)
    .filter((v) => v && typeof v === "object" && v.id !== PIKACHU.id)
    .map(opschonen)
    .sort((a, b) => String(a.gemaakt).localeCompare(String(b.gemaakt)));
  return [opschonen({ ...hash[PIKACHU.id], ...PIKACHU }), ...eigen];
}

async function bewaar(redis, verzameling) {
  await redis.hset(VERZAMELINGEN_KEY, { [verzameling.id]: verzameling });
}

export async function maakVerzameling(naam) {
  const redis = getRedis();
  const t = tekst(naam, "Naam", 60);
  const alle = await leesVerzamelingen(redis);
  if (alle.some((v) => v.naam.toLowerCase() === t.toLowerCase())) {
    throw new Invoerfout("Er is al een verzameling met die naam");
  }
  const id = vrijeId(slug(t, "verzameling"), (x) => x === PIKACHU.id || alle.some((v) => v.id === x));
  const verzameling = { id, naam: t, themas: [], verborgen: [], gemaakt: new Date().toISOString() };
  await bewaar(redis, verzameling);
  return { verzameling, versie: await nieuweVersie(redis) };
}

// Wijzigingen: { naam } | { nieuwThema } | { verwijderThema } | { verberg } | { toon }
export async function wijzigVerzameling(id, invoer) {
  const redis = getRedis();
  const alle = await leesVerzamelingen(redis);
  const oud = alle.find((v) => v.id === id);
  if (!oud) throw new Invoerfout("Verzameling bestaat niet");
  const v = { ...oud, themas: [...oud.themas], verborgen: [...oud.verborgen] };
  let thema = null;

  if ("naam" in invoer) {
    if (v.vast) throw new Invoerfout("De naam van deze verzameling ligt vast");
    const t = tekst(invoer.naam, "Naam", 60);
    if (alle.some((x) => x.id !== id && x.naam.toLowerCase() === t.toLowerCase())) {
      throw new Invoerfout("Er is al een verzameling met die naam");
    }
    v.naam = t;
  }
  if ("nieuwThema" in invoer) {
    const t = tekst(invoer.nieuwThema, "Themanaam", 40);
    const bestaand = themasVoor(v);
    if (bestaand.some((x) => x.naam.toLowerCase() === t.toLowerCase() || x.kort?.toLowerCase() === t.toLowerCase())) {
      throw new Invoerfout("Dat thema bestaat al");
    }
    thema = { id: vrijeId(slug(t, "thema"), (x) => bestaand.some((b) => b.id === x)), naam: t, kort: t };
    v.themas.push(thema);
  }
  if ("verwijderThema" in invoer) {
    const tid = String(invoer.verwijderThema);
    if (!v.themas.some((x) => x.id === tid)) throw new Invoerfout("Alleen eigen thema's kunnen weg");
    const items = Object.values((await redis.hgetall(ITEMS_KEY)) ?? {});
    if (items.some((i) => i?.verzameling === id && i.thema === tid)) {
      throw new Invoerfout("Er staan nog kaarten onder dit thema");
    }
    v.themas = v.themas.filter((x) => x.id !== tid);
  }
  if ("verberg" in invoer || "toon" in invoer) {
    if (id !== PIKACHU.id) throw new Invoerfout("Alleen vaste kaarten kunnen verborgen worden");
    const kaart = String(invoer.verberg ?? invoer.toon);
    if (!CARD_IDS.has(kaart)) throw new Invoerfout("Onbekende kaart");
    v.verborgen = v.verborgen.filter((x) => x !== kaart);
    if ("verberg" in invoer) v.verborgen.push(kaart);
  }

  const { vast, ...opslaan } = v; // "vast" is geen opgeslagen gegeven
  await bewaar(redis, opslaan);
  return { verzameling: v, thema, versie: await nieuweVersie(redis) };
}

// Weg met de verzameling; de items blijven bestaan, zonder verzameling, thema of mapcode
export async function verwijderVerzameling(id) {
  const redis = getRedis();
  if (id === PIKACHU.id) throw new Invoerfout("De Pikachu-verzameling kan niet weg");
  const alle = await leesVerzamelingen(redis);
  if (!alle.some((v) => v.id === id)) throw new Invoerfout("Verzameling bestaat niet");
  const items = Object.values((await redis.hgetall(ITEMS_KEY)) ?? {}).filter((i) => i?.verzameling === id);
  if (items.length) {
    const nu = new Date().toISOString();
    await redis.hset(
      ITEMS_KEY,
      Object.fromEntries(items.map((i) => [i.id, { ...i, verzameling: null, thema: null, map: null, bijgewerkt: nu }]))
    );
  }
  await redis.hdel(VERZAMELINGEN_KEY, id);
  return { ontkoppeld: items.length, versie: await nieuweVersie(redis) };
}
