// Service worker som bara sköter notiser. Den cachar ingenting.
// - Android (Chrome) kräver den för att visa notiser från sidan.
// - Push från servern (push-server.js) landar här, även när spelet ligger i bakgrunden
//   eller telefonen är låst. Så fungerar notiser på iPhone (Party på hemskärmen).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Push från servern: { title, body, tag }. iPhone kräver att varje push visar en notis.
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || "Party", {
    body: d.body || "", tag: d.tag || "party", icon: "/assets/apple-touch-icon.png"
  }));
});

// Tryck på notisen: hoppa tillbaka till fliken med Party
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const tab = list.find(c => "focus" in c);
    return tab ? tab.focus() : self.clients.openWindow("/");
  }));
});
