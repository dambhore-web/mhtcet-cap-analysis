// Registers the service worker (vite.config.ts: injectRegister false, so this file replaces the
// plugin's one-line registerSW.js) and reloads the page once when a new version takes over.
//
// The service worker updates itself (registerType autoUpdate: skipWaiting, clientsClaim, old caches
// removed). A returning visitor's first page after a deploy can come from the old cache while the
// new worker installs and deletes it: the old page's script files are then gone from the cache and
// from the server, and the page stays blank (seen on getmecollege.com, 2026-10-04). Reloading when
// the new worker takes control loads the new version instead. This is a plain file loaded before
// the app's bundle, so it runs even when that bundle is the one that fails.
(function () {
  if (!("serviceWorker" in navigator)) return;
  // Only an update replaces a controller; the first install takes control of an uncontrolled page
  var updating = !!navigator.serviceWorker.controller;
  var KEY = "gmc-sw-reloaded-at";
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!updating) return;
    // at most once a minute, in case a worker keeps replacing itself
    try {
      var last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last < 60000) return;
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch (e) {
      /* storage blocked: reload anyway, the controller only changes once per update */
    }
    window.location.reload();
  });
  function register() {
    // no sw.js under `vite` (dev): nothing to register there
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
  }
  // after the page has loaded, so the worker's downloads don't compete with the page's own
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
})();
