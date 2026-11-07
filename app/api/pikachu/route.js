import { Invoerfout, wijzigItem } from "@/lib/pokemon/items";
import { tokenOk } from "@/lib/pokemon/server";

export const dynamic = "force-dynamic";

// Het oude opslagpunt voor de vinkjes van de Pikachu-kaarten. Die kaarten zijn nu gewone items;
// dit blijft alleen bestaan voor een pagina die nog open stond van vóór de omzetting.
//   PUT { status: { id: { w, b, o, a } } }
export async function PUT(request) {
  if (!tokenOk(request.headers.get("x-pikachu-token"))) {
    return Response.json({ error: "Ongeldige token" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geen geldige JSON" }, { status: 400 });
  }
  const status = body?.status;
  if (!status || typeof status !== "object") return Response.json({ error: "Ongeldige statussen" }, { status: 400 });
  try {
    for (const [id, v] of Object.entries(status)) {
      await wijzigItem(id, { status: { w: v?.w === true, b: v?.b === true, a: v?.a === true } });
    }
    return Response.json({ ok: true, saved: Object.keys(status).length, updatedAt: new Date().toISOString() });
  } catch (e) {
    if (e instanceof Invoerfout) return Response.json({ error: e.message }, { status: 400 });
    return Response.json({ error: "Database niet bereikbaar" }, { status: 502 });
  }
}
