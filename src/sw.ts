/// <reference lib="webworker" />

export {};

interface PrecacheEntry {
  url: string;
  revision?: string | null;
}

declare global {
  interface WorkerGlobalScope {
    __WB_MANIFEST: ReadonlyArray<string | PrecacheEntry>;
  }
}

const scope = self as ServiceWorkerGlobalScope & typeof globalThis;
const manifest = scope.__WB_MANIFEST;
const CACHE_PREFIX = 'intervale-shell-';

function manifestValue(entry: string | PrecacheEntry): string {
  return typeof entry === 'string'
    ? entry
    : entry.url + '@' + (entry.revision ?? '');
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16);
}

const CACHE_NAME =
  CACHE_PREFIX + fnv1a(manifest.map(manifestValue).sort().join('|'));
const scopeUrl = new URL(scope.registration.scope);
const precacheUrls = manifest.map((entry) =>
  new URL(typeof entry === 'string' ? entry : entry.url, scopeUrl).toString(),
);
const indexUrl = new URL('index.html', scopeUrl).toString();

scope.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(precacheUrls)),
  );
});

scope.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await scope.clients.claim();
    })(),
  );
});

scope.addEventListener('message', (event) => {
  if (
    event.data !== null &&
    typeof event.data === 'object' &&
    (event.data as { type?: unknown }).type === 'SKIP_WAITING'
  ) {
    event.waitUntil(scope.skipWaiting());
  }
});

scope.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== scope.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(indexUrl)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request)) ?? fetch(request);
    })(),
  );
});
