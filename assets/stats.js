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

  function home() {
    bump("visit").then(function () {
      return fetch(cfg.url + "/rest/v1/songs?select=slug,title,visits,plays", { headers: H });
    }).then(function (r) { return r.json(); }).then(function (rows) {
      var tv = 0, tp = 0;
      rows.forEach(function (r) {
        tv += r.visits; tp += r.plays;
        setAll('[data-plays-for="' + r.slug + '"]', r.plays);
      });
      setAll("[data-total-visits]", tv);
      setAll("[data-total-plays]", tp);
      var titles = window.WSE_TITLES || {};
      var top = rows.filter(function (r) { return titles[r.slug] && r.plays > 0; })
        .sort(function (a, b) { return b.plays - a.plays; }).slice(0, 5);
      if (!top.length) return;
      var ol = document.querySelector("[data-board]");
      ol.innerHTML = top.map(function (r, i) {
        var t = titles[r.slug].replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
        return '<li><a href="./' + r.slug + '/"><span class="rank">' + (i + 1) + '</span>' +
          '<span class="bt">' + t + '<small>Worst Song Ever #' + r.slug + '</small></span>' +
          '<span class="bp"><b>' + fmt(r.plays) + '</b> plays</span></a></li>';
      }).join("");
      ol.closest(".board").hidden = false;
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
    var btn = document.querySelector("[data-share]");
    if (btn) btn.addEventListener("click", function () {
      var data = { title: document.title, url: location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      navigator.clipboard.writeText(location.href).then(function () {
        btn.textContent = "Link copied!";
        setTimeout(function () { btn.textContent = "Share this crime"; }, 1800);
      });
    });
  }

  if (!cfg.url) return;
  if (slug === "home") home(); else song();
})();
