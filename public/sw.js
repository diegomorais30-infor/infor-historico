// Service worker mínimo: não guarda páginas nem dados em cache (o sistema usa dados sempre atualizados e protegidos por login).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
