import { fout, voerUit, queryParam } from "@/lib/roadtrip/api";
import { etappe } from "@/lib/roadtrip/ors";

export const dynamic = "force-dynamic";

// ?van=49.7596,6.6439&naar=47.0502,8.3093&vervoer=camper
// Lezen mag iedereen met de link; de sleutel van de routedienst blijft hier.
function punt(waarde) {
  const delen = String(waarde ?? "").split(",");
  if (delen.length !== 2) return null;
  const lat = Number(delen[0]);
  const lon = Number(delen[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export async function GET(request) {
  const van = punt(queryParam(request, "van"));
  const naar = punt(queryParam(request, "naar"));
  if (!van || !naar) return fout("Geef van en naar op als lat,lon", 400);

  const vervoer = queryParam(request, "vervoer") ?? "camper";
  return voerUit(async () => ({ etappe: await etappe(van, naar, vervoer) }));
}
