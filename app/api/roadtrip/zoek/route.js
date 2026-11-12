import { fout, voerUit, queryParam } from "@/lib/roadtrip/api";
import { KORTSTE_TERM, zoekPlaatsen } from "@/lib/roadtrip/geocode";

export const dynamic = "force-dynamic";

// ?term=camping lido luzern
// Lezen mag iedereen met de link. De app praat met de zoekdienst, niet de
// browser: zo blijft het verkeer van één kant komen en kunnen we het cachen.
export async function GET(request) {
  const term = queryParam(request, "term");
  if (!term || term.trim().length < KORTSTE_TERM) {
    return fout(`Geef minstens ${KORTSTE_TERM} letters op`, 400);
  }
  return voerUit(() => zoekPlaatsen(term));
}
