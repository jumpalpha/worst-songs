(function () {
  var cfg = window.WSE || {};
  var H = { apikey: cfg.key, "Content-Type": "application/json" };
  var slug = document.body.dataset.slug;
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var setAll = function (sel, v) {
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = fmt(v); });
  };

  function bump(kind) {
    return fetch(cfg.url + "/rest/v1/rpc/bump", {
      method: "POST", headers: H, body: JSON.stringify({ p_slug: slug, p_kind: kind })
    }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var row = rows && rows[0];
        if (row) { setAll("[data-visits]", row.visits); setAll("[data-plays]", row.plays); }
      }).catch(function () {});
  }

  // ---------- Home: three swappable chart lists ----------
  var DAY = 864e5;
  var BOARDS = {
    ever:   { name: "Most Played Ever", val: function (r) { return r.plays; }, show: function (r) { return fmt(r.plays) + " plays"; } },
    week:   { name: "Hot This Week", val: function (r) { return r.plays_7d; }, show: function (r) { return fmt(r.plays_7d) + " this week"; },
              empty: "No plays logged this week yet. Be the first." },
    daily:  { name: "Plays Per Day", val: function (r) { return r.plays / Math.max(1, (Date.now() - Date.parse(r.added)) / DAY); },
              show: function (r) { return this.val(r).toFixed(1) + " / day"; }, note: "since it hit the site" },
    today:  { name: "Trending Today", val: function (r) { return r.plays_24h; }, show: function (r) { return fmt(r.plays_24h) + " today"; },
              empty: "Nothing played in the last 24 hours. Fix that." },
    visited:{ name: "Most Visited", val: function (r) { return r.visits; }, show: function (r) { return fmt(r.visits) + " visits"; } },
    replay: { name: "Most Replayed", val: function (r) { return r.visits >= 3 ? r.plays / r.visits : 0; },
              show: function (r) { return (r.plays / r.visits).toFixed(1) + " plays / visit"; }, note: "3+ visits" },
    newest: { name: "Fresh Off the Press", val: function (r) { return +r.slug + 1; }, show: function (r) { return fmt(r.plays) + " plays"; }, all: true },
    lonely: { name: "Needs Some Love", val: function (r) { return -r.plays; }, show: function (r) { return fmt(r.plays) + " plays"; }, all: true }
  };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function drawBoard(el, key, rows) {
    var b = BOARDS[key], titles = window.WSE_TITLES || {};
    var opts = Object.keys(BOARDS).map(function (k) {
      return '<option value="' + k + '"' + (k === key ? " selected" : "") + ">" + BOARDS[k].name + "</option>";
    }).join("");
    var top = rows.filter(function (r) { return titles[r.slug] && (b.all || b.val(r) > 0); })
      .sort(function (x, y) { return b.val(y) - b.val(x) || y.plays - x.plays; }).slice(0, 5);
    var list = top.length ? "<ol>" + top.map(function (r, i) {
      return '<li><a href="./' + r.slug + '/"><span class="rank">' + (i + 1) + '</span>' +
        '<span class="bt">' + esc(titles[r.slug]) + '<small>#' + r.slug + '</small></span>' +
        '<span class="bp">' + b.show(r) + '</span></a></li>';
    }).join("") + "</ol>" : '<p class="bempty">' + (b.empty || "No plays yet.") + "</p>";
    el.innerHTML = '<label class="bhead"><span class="sr">Choose chart</span><select aria-label="Choose chart">' + opts + "</select></label>" +
      (b.note ? '<p class="bnote">' + b.note + "</p>" : "") + list;
    el.querySelector("select").addEventListener("change", function (ev) {
      store.set("wse-board-" + el.dataset.slot, ev.target.value);
      drawBoard(el, ev.target.value, rows);
    });
  }

  function home() {
    bump("visit").then(function () {
      return fetch(cfg.url + "/rest/v1/rpc/leaderboards", { method: "POST", headers: H, body: "{}" });
    }).then(function (r) { return r.json(); }).then(function (rows) {
      var tv = 0, tp = 0;
      rows.forEach(function (r) {
        tv += r.visits; tp += r.plays;
        setAll('[data-plays-for="' + r.slug + '"]', r.plays);
      });
      setAll("[data-total-visits]", tv);
      setAll("[data-total-plays]", tp);
      var boards = document.querySelectorAll("[data-board]");
      if (!boards.length) return;
      boards.forEach(function (el, i) {
        el.dataset.slot = i;
        var saved = store.get("wse-board-" + i);
        drawBoard(el, BOARDS[saved] ? saved : el.dataset.board, rows);
      });
      document.querySelector(".boards").hidden = false;
    }).catch(function () {});
  }

  function song() {
    bump("visit");
    var player = document.getElementById("player");
    var counted = false;
    if (player) player.addEventListener("play", function () {
      if (counted) return;
      counted = true;
      bump("play");
    });
    if (player) player.addEventListener("ended", function () { counted = false; });
    share();
  }

  function share() {
    var btn = document.querySelector("[data-share]");
    if (btn) btn.addEventListener("click", function () {
      var data = { title: document.title, url: location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      navigator.clipboard.writeText(location.href).then(function () {
        var label = btn.textContent;
        btn.textContent = "Link copied!";
        setTimeout(function () { btn.textContent = label; }, 1800);
      });
    });
  }

  if (!cfg.url) return;
  if (!slug) { share(); return; }  // hidden friend songs: no counters
  if (slug === "home") home(); else song();
})();
