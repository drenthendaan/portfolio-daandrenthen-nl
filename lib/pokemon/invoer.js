// Hulpjes voor items en verzamelingen: invoer controleren en de versie ophogen.
// De generieke helpers staan in lib/invoer.mjs en worden hier doorgegeven, zodat
// bestaande imports uit deze map blijven werken.
import { nieuweVersie as nieuweVersieVoor } from "@/lib/invoer.mjs";
import { ITEMS_VERSIE_KEY } from "./server";

export { Invoerfout, bedrag, tekst, slug, vrijeId } from "@/lib/invoer.mjs";

// Eén versie voor items, labels en verzamelingen: open pagina's halen alles opnieuw op
export const nieuweVersie = (redis) => nieuweVersieVoor(redis, ITEMS_VERSIE_KEY);

// Oudere items hadden alleen "pikachu: true/false". Een item met een TCGplayer-product maar
// zonder plaatje (TCGplayer had er bij het toevoegen nog geen) probeert alsnog dat van TCGplayer.
export function normaliseerItem(item) {
  const { pikachu, ...rest } = item;
  return {
    ...rest,
    verzameling: rest.verzameling !== undefined ? rest.verzameling : pikachu ? "pikachu" : null,
    thema: rest.thema ?? null,
    map: rest.map ?? null,
    notitie: rest.notitie ?? null,
    img: rest.img?.length ? rest.img : rest.tp?.product ? [`t:${rest.tp.product}`] : [],
  };
}
