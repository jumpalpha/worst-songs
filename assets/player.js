/* Song-to-song playback for Worst Song Ever pages.
   Keeps ONE <audio> element and swaps songs in place, so the next song can start with sound
   (phone browsers block sound on a freshly loaded page). Falls back to normal links if anything fails. */
(function () {
  var ORDER = window.WSE_ORDER || [], PATH = window.WSE_PATH || "";
  var player = document.getElementById("player");
  if (!player || !ORDER.length || !window.fetch || !window.DOMParser) return;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var COUNT = 6, timer = null, busy = false;

  function cur() { return +document.body.dataset.slug; }
  function idx(n) { for (var i = 0; i < ORDER.length; i++) if (ORDER[i][0] === n) return i; return -1; }
  function after(n) { return ORDER[(idx(n) + 1) % ORDER.length]; }
  function autoOn() { return store.get("wse-auto") !== "off"; }

  // Remember the auto-play choice; keep every checkbox in sync after swaps.
  document.addEventListener("change", function (ev) {
    if (ev.target.matches && ev.target.matches("[data-auto]")) {
      store.set("wse-auto", ev.target.checked ? "on" : "off");
      if (!ev.target.checked) cancelUpNext();
    }
  });
  function syncAuto() { document.querySelectorAll("[data-auto]").forEach(function (c) { c.checked = autoOn(); }); }

  function box() { return document.querySelector("[data-upnext]"); }
  function cancelUpNext() { clearInterval(timer); timer = null; var b = box(); if (b) { b.hidden = true; b.innerHTML = ""; } }

  function showUpNext() {
    var nx = after(cur()), b = box();
    if (!b || !nx) return;
    var left = COUNT;
    b.innerHTML = '<span class="ut">Up next: #' + nx[0] + ' ' + esc(nx[1]) + '<small>Starting in <b data-left>' + left + '</b>…</small></span>' +
      '<button type="button" class="go">Play now</button><button type="button" class="stop">Cancel</button>';
    b.hidden = false;
    b.querySelector(".go").onclick = function () { cancelUpNext(); go(nx[0], true); };
    b.querySelector(".stop").onclick = cancelUpNext;
    clearInterval(timer);
    timer = setInterval(function () {
      left -= 1;
      var l = b.querySelector("[data-left]"); if (l) l.textContent = left;
      if (left <= 0) { cancelUpNext(); go(nx[0], true); }
    }, 1000);
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  // Load song n into this page. play=true starts it (works because the same audio element was already started by the visitor).
  function go(n, play, fromHistory) {
    if (busy) return;
    busy = true;
    var url = PATH + "/" + n + "/";
    fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var newMain = doc.querySelector("main.wrap"), newPlayer = doc.getElementById("player");
      if (!newMain || !newPlayer) throw new Error("bad page");
      var src = newPlayer.getAttribute("src");
      newPlayer.replaceWith(player);              // keep our (already unlocked) audio element
      document.querySelector("main.wrap").replaceWith(newMain);
      document.title = doc.title;
      document.body.dataset.slug = String(n);
      player.src = src;
      if (!fromHistory) history.pushState({ n: n }, "", url);
      syncAuto();
      if (window.WSE_newSong) window.WSE_newSong();
      var top = player.closest(".hero") || newMain;
      if (top.getBoundingClientRect().top < 0) top.scrollIntoView({ behavior: "smooth", block: "start" });
      if (play) player.play().catch(function () {});
    }).catch(function () {
      location.href = url;                        // plain navigation as a fallback
    }).then(function () { busy = false; });
  }

  // Prev/next links: swap in place; keep playing if it was playing.
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[data-go]");
    if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
    ev.preventDefault();
    cancelUpNext();
    go(+a.dataset.go, !player.paused);
  });

  player.addEventListener("ended", function () { if (autoOn()) showUpNext(); });
  player.addEventListener("play", cancelUpNext);

  window.addEventListener("popstate", function () {
    var m = location.pathname.match(/\/(\d+)\/?$/);
    if (m && +m[1] !== cur()) { cancelUpNext(); go(+m[1], false, true); }
  });
  history.replaceState({ n: cur() }, "", location.href);

  syncAuto();
  // "Play them all" from the home page: turn auto-play on and try to start (a tap on Play works if the browser blocks it).
  if (/[?&]playall=1/.test(location.search)) {
    store.set("wse-auto", "on"); syncAuto();
    history.replaceState({ n: cur() }, "", location.pathname);
    player.play().catch(function () {});
  }
})();
