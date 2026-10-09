/* OpsBoard offline copy (service worker). Built by build.mjs --site.

   The page, its icons, the map library and the PDF maker are kept on the device, so the board opens and works
   with no internet. Everything a tablet does is saved on it and goes to the other tablets when it's back online
   (that part is the page's own sync; nothing here touches the squad's data). The relay, live ED status and the
   aerial imagery are never cached: they need the network, and the page says so when it's offline. */
const VERSION = '@VERSION';
const SHELL = 'opsboard-' + VERSION;
const KEEP = 'opsboard-libs';   // libraries and fonts, kept across versions
const FILES = ['./', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', 'logo.svg'];
const LIBS = /*@LIBS*/[];
const LIB_HOSTS = /^https:\/\/(cdnjs\.cloudflare\.com\/ajax\/libs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(FILES);
    const libs = await caches.open(KEEP);
    await Promise.all(LIBS.map(u => libs.match(u).then(m => m || libs.add(u)).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('opsboard-') && k !== SHELL && k !== KEEP) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* Opening the app: the network first, so a new version arrives, but never wait more than a few seconds on a weak
   signal; then the copy kept here. */
async function page(req) {
  const cache = await caches.open(SHELL);
  const net = fetch(req).then(res => { if (res.ok) cache.put('./', res.clone()); return res; });
  const kept = () => cache.match('./');
  net.catch(() => {});
  try {
    return await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
  } catch (e) {
    return (await kept()) || net;
  }
}
async function file(req) {
  const cache = await caches.open(SHELL);
  return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
}
async function lib(req) {
  const cache = await caches.open(KEEP);
  const hit = await cache.match(req.url);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req.url, res.clone()); return res; });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { if (/\/(index\.html)?$/.test(url.pathname)) e.respondWith(page(req)); }   // the app only; owner.html is always live
    else if (FILES.some(f => url.pathname.endsWith('/' + f.replace('./', '')) && f !== './')) e.respondWith(file(req));
    return;
  }
  if (LIB_HOSTS.test(req.url)) e.respondWith(lib(req));
});
