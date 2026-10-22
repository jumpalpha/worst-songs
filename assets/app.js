/* Worst Song Ever as a home-screen app: service worker, install buttons, a gentle nudge, lock-screen controls. */
(function () {
  var PATH = window.WSE_PATH || "";
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var ua = navigator.userAgent || "";
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var installed = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var deferred = null;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register(PATH + "/sw.js").catch(function () {}); });
  }

  if (installed) {
    document.documentElement.classList.add("is-app");
    store.set("wse-installed", "1");
  }

  // Android / desktop Chrome hand us a real install prompt.
  window.addEventListener("beforeinstallprompt", function (ev) {
    ev.preventDefault();
    deferred = ev;
    document.documentElement.classList.add("can-install");
  });
  window.addEventListener("appinstalled", function () {
    store.set("wse-installed", "1");
    document.documentElement.classList.add("is-app");
    msg("Installed. Look for the yellow WORST SONG icon on your home screen.");
  });

  function msg(t) { document.querySelectorAll("[data-install-msg]").forEach(function (el) { el.textContent = t; }); }

  function install() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (c) {
        if (c && c.outcome === "accepted") msg("Installing… check your home screen.");
        deferred = null;
      });
      return true;
    }
    return false;
  }

  // Buttons marked data-install: prompt if we can, otherwise send them to the how-to page.
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-install]");
    if (!b) return;
    if (install()) { ev.preventDefault(); return; }
    if (b.tagName === "BUTTON") {
      var steps = document.getElementById(isIOS ? "ios" : "android");
      if (steps) { steps.open = true; steps.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
  });

  // On /app/: open the right instructions for this phone.
  var how = document.getElementById(isIOS ? "ios" : "android");
  if (how && document.body.classList.contains("apppage")) how.open = true;

  // Nudge: after someone finishes a song (twice), offer the app once a week. Never inside the app.
  var player = document.getElementById("player");
  if (player && !installed && document.body.dataset.slug) {
    player.addEventListener("ended", function () {
      var n = +(store.get("wse-finished") || 0) + 1;
      store.set("wse-finished", String(n));
      var last = +(store.get("wse-nudged") || 0);
      if (n < 2 || store.get("wse-installed") || Date.now() - last < 7 * 864e5) return;
      store.set("wse-nudged", String(Date.now()));
      setTimeout(nudge, 8000);  // after the up-next countdown, so it never covers it
    });
  }

  function nudge() {
    if (document.querySelector(".appnudge")) return;
    var d = document.createElement("div");
    d.className = "appnudge";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", "Get the app");
    d.innerHTML = '<img src="' + PATH + '/assets/app/icon-192.png" alt="" width="48" height="48">' +
      '<div class="nt"><b>You made it to the end. Twice.</b><small>Put Worst Song Ever on your home screen. Free, no app store, 2 taps.</small></div>' +
      '<a class="go" href="' + PATH + '/app/" data-install>Get it</a><button type="button" class="x" aria-label="Not now">&times;</button>';
    document.body.appendChild(d);
    d.querySelector(".x").onclick = function () { d.remove(); };
    d.querySelector(".go").addEventListener("click", function () { setTimeout(function () { d.remove(); }, 300); });
  }

  // Lock-screen and headphone controls: title, cover art, previous/next song.
  if (player && "mediaSession" in navigator && window.WSE_ORDER) {
    var setMeta = function () {
      var n = +document.body.dataset.slug, h = document.querySelector(".song h1"), img = document.querySelector(".hero .cover");
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: h ? h.textContent : document.title,
          artist: "Worst Song Ever #" + n,
          album: "Worst Song Ever",
          artwork: img ? [{ src: img.src, sizes: "720x720", type: "image/jpeg" }] : []
        });
      } catch (e) {}
    };
    var clickGo = function (which) {
      var links = document.querySelectorAll(".songnav a[data-go]");
      var a = links[which === "prev" ? 0 : links.length - 1];
      if (a) a.click();
    };
    try {
      navigator.mediaSession.setActionHandler("previoustrack", function () { clickGo("prev"); });
      navigator.mediaSession.setActionHandler("nexttrack", function () { clickGo("next"); });
    } catch (e) {}
    player.addEventListener("play", setMeta);
    var prev = window.WSE_newSong;
    window.WSE_newSong = function () { if (prev) prev(); setMeta(); };
  }
})();
