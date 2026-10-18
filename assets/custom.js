/* Custom songs: genre filter, sorting, and the "item mix" rating (1-10 shown as silly items). */
(function () {
  var cfg = window.WSE || {};
  var H = { apikey: cfg.key, "Content-Type": "application/json" };
  var MIN_VOTES = 3;

  // [emoji, singular, plural]
  var ITEMS = [
    ["🪱","earthworm","earthworms"],["🦗","praying mantis","praying mantises"],["🐌","snail","snails"],
    ["🦔","hedgehog","hedgehogs"],["🐸","frog","frogs"],["🦆","duck","ducks"],["🦙","llama","llamas"],
    ["🐐","goat","goats"],["🦫","beaver","beavers"],["🦦","otter","otters"],["🐿️","squirrel","squirrels"],
    ["🦩","flamingo","flamingos"],["🐧","penguin","penguins"],["🦥","sloth","sloths"],["🐢","turtle","turtles"],
    ["🦀","crab","crabs"],["🐙","octopus","octopuses"],["🦑","squid","squids"],["🐝","bee","bees"],
    ["🦋","butterfly","butterflies"],["🐞","ladybug","ladybugs"],["🦖","T-rex","T-rexes"],
    ["🦕","brontosaurus","brontosauruses"],["🐉","dragon","dragons"],["🦄","unicorn","unicorns"],
    ["☄️","meteor","meteors"],["🪐","Saturn","Saturns"],["🌋","volcano","volcanoes"],["🌪️","tornado","tornadoes"],
    ["🌈","rainbow","rainbows"],["⚡","lightning bolt","lightning bolts"],["🌵","cactus","cacti"],
    ["🍄","mushroom","mushrooms"],["🥔","Idaho potato","Idaho potatoes"],["🌮","taco","tacos"],
    ["🥓","bacon strip","bacon strips"],["🧀","cheese wheel","cheese wheels"],["🍩","donut","donuts"],
    ["🥨","pretzel","pretzels"],["🌶️","chili pepper","chili peppers"],["🍕","pizza slice","pizza slices"],
    ["🥒","pickle","pickles"],["🧇","waffle","waffles"],["🎺","trumpet","trumpets"],["🪕","banjo","banjos"],
    ["🪗","accordion","accordions"],["🎳","bowling pin","bowling pins"],["🧦","sock","socks"],
    ["🛼","roller skate","roller skates"],["🧲","magnet","magnets"],["🚜","tractor","tractors"],
    ["🪩","disco ball","disco balls"],["🥾","hiking boot","hiking boots"]
  ];

  // Small seeded random generator so each song + score always gets the same mix.
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5; var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Turn a 1-10 score into 2-4 different items whose counts add up to the score.
  function mix(slug, score) {
    score = Math.max(1, Math.min(10, Math.round(score)));
    var rnd = seeded(slug + ":" + score);
    var kinds = Math.min(score, 2 + Math.floor(rnd() * 3));
    var pool = ITEMS.slice(), picks = [];
    for (var i = 0; i < kinds; i++) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    var counts = picks.map(function () { return 1; }), left = score - kinds;
    while (left-- > 0) counts[Math.floor(rnd() * kinds)]++;
    return picks.map(function (p, i) { return { n: counts[i], item: p }; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  function mixShort(m) {
    return m.map(function (x) { return x.n + " " + x.item[0]; }).join(" · ");
  }
  function mixWords(m) {
    return m.map(function (x) { return x.n + " " + (x.n === 1 ? x.item[1] : x.item[2]); }).join(", ");
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  function stats() {
    if (!cfg.url) return Promise.resolve({});
    return fetch(cfg.url + "/rest/v1/rpc/custom_stats", { method: "POST", headers: H, body: "{}" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { var o = {}; rows.forEach(function (r) { o[r.slug] = r; }); return o; })
      .catch(function () { return {}; });
  }

  function badgeHTML(slug, row) {
    if (!row || row.n < MIN_VOTES) return '<span class="mix none">Not rated yet</span>';
    var m = mix(slug, row.avg_score);
    return '<span class="mix" title="' + esc(mixWords(m)) + " (" + row.avg_score + '/10)">' + esc(mixShort(m)) + "</span>";
  }

  // ---------- List page (/custom/) ----------
  function listPage(grid) {
    var cards = [].slice.call(grid.querySelectorAll(".card"));
    var filterBtns = [].slice.call(document.querySelectorAll("[data-genre-filter]"));
    var sortSel = document.querySelector("[data-sort]");
    var data = {};

    function apply() {
      var g = (document.querySelector("[data-genre-filter].on") || {}).dataset;
      var genre = g ? g.genreFilter : "all";
      var by = sortSel ? sortSel.value : "new";
      cards.forEach(function (c) {
        c.hidden = !(genre === "all" || (c.dataset.genres || "").split("|").indexOf(genre) > -1);
      });
      cards.slice().sort(function (a, b) {
        var ra = data[a.dataset.cslug] || {}, rb = data[b.dataset.cslug] || {};
        if (by === "plays") return (rb.plays || 0) - (ra.plays || 0);
        if (by === "rated") {
          var sa = ra.n >= MIN_VOTES ? +ra.avg_score : -1, sb = rb.n >= MIN_VOTES ? +rb.avg_score : -1;
          if (sb !== sa) return sb - sa;
        }
        return (b.dataset.added || "").localeCompare(a.dataset.added || "");
      }).forEach(function (c) { grid.appendChild(c); });
    }

    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filterBtns.forEach(function (b) { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("on"); btn.setAttribute("aria-pressed", "true");
        apply();
      });
    });
    if (sortSel) sortSel.addEventListener("change", apply);

    stats().then(function (d) {
      data = d;
      cards.forEach(function (c) {
        var row = d[c.dataset.cslug];
        var el = c.querySelector("[data-mix]");
        if (el) el.innerHTML = badgeHTML(c.dataset.cslug, row);
        var p = c.querySelector("[data-cplays]");
        if (p && row) p.textContent = Number(row.plays || 0).toLocaleString();
      });
      apply();
    });
  }

  // ---------- Song page (/custom/<slug>/) ----------
  function voterId() {
    try {
      var id = localStorage.getItem("wse_voter");
      if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : fallbackUUID()); localStorage.setItem("wse_voter", id); }
      return id;
    } catch (e) { return fallbackUUID(); }
  }
  function fallbackUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  function songPage(box) {
    var slug = box.dataset.rate;
    var cur = box.querySelector("[data-current]");
    var range = box.querySelector("input[type=range]");
    var num = box.querySelector("[data-num]");
    var preview = box.querySelector("[data-preview]");
    var btn = box.querySelector("button");
    var msg = box.querySelector("[data-msg]");
    var key = "wse_rated_" + slug;

    function showCurrent(row) {
      if (!row || row.n < MIN_VOTES) {
        var left = MIN_VOTES - ((row && row.n) || 0);
        cur.innerHTML = '<span class="mix none">Not rated yet.</span> ' + left + " more rating" + (left === 1 ? "" : "s") + " to reveal its score.";
        return;
      }
      var m = mix(slug, row.avg_score);
      cur.innerHTML = '<span class="mix big">' + esc(mixShort(m)) + "</span><br>That's " + esc(mixWords(m)) +
        ". <small>(" + row.avg_score + "/10 from " + row.n + " ratings)</small>";
    }
    function showPreview() {
      var v = +range.value;
      num.textContent = v;
      preview.textContent = mixWords(mix(slug, v));
    }

    try { var prev = localStorage.getItem(key); if (prev) { range.value = prev; msg.textContent = "You rated this " + prev + ". You can change it."; } } catch (e) {}
    range.addEventListener("input", showPreview);
    showPreview();
    stats().then(function (d) { showCurrent(d[slug]); });

    btn.addEventListener("click", function () {
      btn.disabled = true;
      fetch(cfg.url + "/rest/v1/rpc/rate", {
        method: "POST", headers: H,
        body: JSON.stringify({ p_slug: slug, p_voter: voterId(), p_score: +range.value })
      }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (rows) {
          try { localStorage.setItem(key, range.value); } catch (e) {}
          msg.textContent = "Thanks! You rated it " + range.value + ".";
          showCurrent(rows && rows[0]);
        })
        .catch(function () { msg.textContent = "Couldn't save that rating. Please try again."; })
        .then(function () { btn.disabled = false; });
    });
  }

  var grid = document.querySelector("[data-custom-grid]");
  if (grid) listPage(grid);
  var box = document.querySelector("[data-rate]");
  if (box) songPage(box);
})();
