// Service worker van de Pokémon-app: alleen pushmeldingen, geen offline-cache.
// Geregistreerd met scope /pokemon (zie de header Service-Worker-Allowed in next.config.js).
// Berichten: { titel, tekst, url, tag, aantal } (zie lib/pokemon/push.js)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let bericht = {};
  try {
    bericht = event.data ? event.data.json() : {};
  } catch {
    bericht = { tekst: event.data ? event.data.text() : "" };
  }
  const klaar = [
    // Op de iPhone moet elke push een melding tonen, anders trekt iOS de toestemming in
    self.registration.showNotification(bericht.titel || "Pokémon", {
      body: bericht.tekst || "",
      icon: "/pokemon-app/icon-192.png",
      tag: bericht.tag || "pokemon",
      data: { url: bericht.url || "/pokemon#meldingen" },
    }),
  ];
  if (bericht.aantal && self.navigator.setAppBadge) {
    klaar.push(self.navigator.setAppBadge(bericht.aantal).catch(() => {}));
  }
  event.waitUntil(Promise.all(klaar));
});

// Tik op de melding: een open /pokemon naar voren halen en de meldingen laten zien, anders openen
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/pokemon#meldingen", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const vensters = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = vensters.find((c) => new URL(c.url).pathname === "/pokemon");
      if (open) {
        open.postMessage({ soort: "meldingen" });
        return open.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
