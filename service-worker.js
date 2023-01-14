// A service worker
// `self` is an instance of ServiceWorkerGlobalScope

// Cache some urls
const CACHE_NAME = "burrow-cache-v1";
const addResourcesToCache = async (resources) => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(resources);
  console.log("Cached resources");
};
// Cache a single request/response
const addResponseToCache = async (request, response) => {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
};

// Install: The first stage in the worker's lifecycle
self.addEventListener("install", (event) => {
  // Updates to the worker take effect immediately
  self.skipWaiting();

  event.waitUntil(async () => {
    console.log("Install event");
    // Cache resources
    await addResourcesToCache([
      "/index.html",
      "/assets/burrow.png",
      "/assets/car_closed.png",
      "/assets/car_half.png",
      "/assets/car_open.png",
    ]);
    console.log("Install event complete");
  });
});

// Activate: The second stage in the worker lifecycle
self.addEventListener("activate", (event) => {
  event.waitUntil(async () => {
    console.log("Activate event");

    // Claim all pages, making updates instant
    await clients.claim();

    // Delete old caches
    const allCaches = await caches.keys();
    await Promise.all(
      allCaches
        .filter((cacheName) => cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    );

    console.log("Activate event complete");
  });
});

// Make a request and add the response to the cache
const getThenCache = async (request) => {
  const cacheRequest = request.clone();
  const cacheResponse = await fetch(cacheRequest);
  const cloneResponse = cacheResponse.clone();
  await addResponseToCache(cacheRequest, cacheResponse);
  console.log("Added updated response to cache", request.url);
  return cloneResponse;
};

// SWR-style get if the item is in cache, otherwise just do a regular fetch
const getWithCache = async ({ request }) => {
  // Try to get from the cache (and SWR if it is)
  const responseFromCache = await caches.match(request);
  if (responseFromCache) {
    console.log("Intercepting! (from cache)", request.url);
    // Send of an async request for a newer item, but don't wait for the
    // response - just return the cached version.
    // This means that the first load will return stale items, but on reload
    // we should see new content.
    getThenCache(request);

    return responseFromCache;
  }

  // Special case for if we're getting the root path "/", which doesn't seem to
  // get cached. This will cache it.
  const url = new URL(request.url);
  if (url.pathname === "/") {
    return await getThenCache(request);
  }

  // Fall back to getting from network
  console.log("Intercepting! (passthrough)", request.url);
  return await fetch(request);
};

// Fetch: This event is called whenever the page requests something
self.addEventListener("fetch", (event) => {
  event.respondWith(getWithCache(event));
});
