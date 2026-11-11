// Service worker som bara visar notiser. Android (Chrome) kräver det: där går det inte att
// skapa en notis direkt från sidan. Den cachar ingenting.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Tryck på notisen: hoppa tillbaka till fliken med Party
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const tab = list.find(c => "focus" in c);
    return tab ? tab.focus() : self.clients.openWindow("/");
  }));
});
