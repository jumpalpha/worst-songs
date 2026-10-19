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
  // Spread a score across the crowd's favorite items (weighted by how many people picked each).
  function crowdMix(score, top) {
    score = Math.max(1, Math.min(10, Math.round(score)));
    var picks = (top || []).filter(function (t) { return ITEMS[t.i]; }).slice(0, Math.min(3, score));
    if (!picks.length) return null;
    var tot = picks.reduce(function (a, t) { return a + t.votes; }, 0);
    var out = picks.map(function (t) { return { n: 1, item: ITEMS[t.i], w: t.votes / tot }; });
    for (var left = score - out.length; left > 0; left--) {
      var best = out[0];
      out.forEach(function (o) { if (o.w * score - o.n > best.w * score - best.n) best = o; });
      best.n++;
    }
    return out.sort(function (a, b) { return b.n - a.n; });
  }

  function mix(slug, score, top) {
    var crowd = crowdMix(score, top);
    if (crowd) return crowd;
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
    var m = mix(slug, row.avg_score, row.top_items);
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

  function pileHTML(m) {
    return m.map(function (x) {
      return '<span class="pg">' + new Array(x.n + 1).join('<span class="pe">' + x.item[0] + "</span>") + "</span>";
    }).join("");
  }

  function songPage(box) {
    var slug = box.dataset.rate;
    var cur = box.querySelector("[data-current]");
    var range = box.querySelector("input[type=range]");
    var num = box.querySelector("[data-num]");
    var preview = box.querySelector("[data-preview]");
    var pile = box.querySelector("[data-pile]");
    var chips = box.querySelector("[data-chips]");
    var mine = box.querySelector("[data-mine]");
    var shuffleBtn = box.querySelector("[data-shuffle]");
    var btn = box.querySelector("[data-submit]");
    var msg = box.querySelector("[data-msg]");
    var key = "wse_rated_" + slug, ikey = "wse_items_" + slug;
    var picked = [];   // [{i, n}]
    var page = 0, PER = 12;
    var order = ITEMS.map(function (_, i) { return i; });
    var rnd = seeded(slug + ":chips");
    for (var k = order.length - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)); var t = order[k]; order[k] = order[j]; order[j] = t; }

    function score() { return +range.value; }
    function total() { return picked.reduce(function (a, p) { return a + p.n; }, 0); }

    // Re-split the score across picked items, keeping their current proportions.
    function respread() {
      var s = score();
      while (picked.length > s) picked.pop();
      if (!picked.length) return;
      var t = total() || picked.length;
      var base = picked.map(function (p) { return Math.max(1, Math.floor(p.n / t * s)); });
      var sum = base.reduce(function (a, b) { return a + b; }, 0), i = 0;
      while (sum < s) { base[i++ % base.length]++; sum++; }
      while (sum > s) { var m = base.indexOf(Math.max.apply(null, base)); base[m]--; sum--; }
      picked.forEach(function (p, k) { p.n = base[k]; });
    }

    function currentMix() {
      if (picked.length) return picked.map(function (p) { return { n: p.n, item: ITEMS[p.i] }; })
        .sort(function (a, b) { return b.n - a.n; });
      return mix(slug, score());
    }

    function drawChips() {
      var show = order.slice(page * PER, page * PER + PER);
      if (show.length < PER) show = show.concat(order.slice(0, PER - show.length));
      chips.innerHTML = show.map(function (i) {
        var on = picked.some(function (p) { return p.i === i; });
        return '<button type="button" class="ichip' + (on ? " on" : "") + '" data-i="' + i + '" aria-pressed="' + on + '">' +
          '<span class="ie">' + ITEMS[i][0] + "</span>" + esc(ITEMS[i][1]) + "</button>";
      }).join("");
    }

    function drawMine() {
      if (!picked.length) {
        mine.innerHTML = '<p class="mhint">Tap up to 3 items below to build your own pile. Skip it and we\'ll pick for you.</p>';
        return;
      }
      mine.innerHTML = picked.map(function (p, k) {
        var it = ITEMS[p.i];
        return '<div class="mrow"><span class="ie">' + it[0] + '</span><span class="mname">' + esc(p.n === 1 ? it[1] : it[2]) + "</span>" +
          '<button type="button" class="step" data-step="-1" data-k="' + k + '" aria-label="Fewer ' + esc(it[2]) + '">&minus;</button>' +
          '<b class="mn">' + p.n + "</b>" +
          '<button type="button" class="step" data-step="1" data-k="' + k + '" aria-label="More ' + esc(it[2]) + '">+</button>' +
          '<button type="button" class="mx" data-drop="' + k + '" aria-label="Remove ' + esc(it[1]) + '">&times;</button></div>';
      }).join("");
    }

    function draw() {
      num.textContent = score();
      var m = currentMix();
      pile.innerHTML = pileHTML(m);
      preview.textContent = mixWords(m);
      drawMine();
      drawChips();
    }

    range.addEventListener("input", function () { respread(); draw(); });

    chips.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-i]"); if (!b) return;
      var i = +b.dataset.i, at = -1;
      picked.forEach(function (p, k) { if (p.i === i) at = k; });
      if (at > -1) picked.splice(at, 1);
      else if (picked.length >= 3) { msg.textContent = "3 items max. Remove one first."; return; }
      else if (picked.length >= score()) { msg.textContent = "Bump the score up to fit another item."; return; }
      else { picked.push({ i: i, n: 1 }); picked.forEach(function (p) { p.n = 1; }); }  // new pick: split evenly
      msg.textContent = "";
      respread(); draw();
    });

    // Steppers change that item's count, and the score follows along.
    mine.addEventListener("click", function (ev) {
      var st = ev.target.closest("[data-step]"), dr = ev.target.closest("[data-drop]");
      if (dr) { picked.splice(+dr.dataset.drop, 1); respread(); draw(); return; }
      if (!st) return;
      var p = picked[+st.dataset.k], d = +st.dataset.step;
      if (d > 0 && total() >= 10) { msg.textContent = "10 is the max. Take one away from another item first."; return; }
      if (d < 0 && p.n <= 1) return;
      p.n += d; msg.textContent = "";
      range.value = total();
      draw();
    });

    shuffleBtn.addEventListener("click", function () { page = (page + 1) % Math.ceil(order.length / PER); drawChips(); });

    function showCurrent(row) {
      if (!row || row.n < MIN_VOTES) {
        var left = MIN_VOTES - ((row && row.n) || 0);
        cur.innerHTML = '<span class="mix none">Not rated yet.</span> ' + left + " more rating" + (left === 1 ? "" : "s") + " to reveal its score.";
        return;
      }
      var m = mix(slug, row.avg_score, row.top_items);
      var fav = (row.top_items || []).filter(function (t) { return ITEMS[t.i]; }).map(function (t) {
        return ITEMS[t.i][0] + " " + t.votes;
      }).join(" · ");
      cur.innerHTML = '<div class="pile big">' + pileHTML(m) + "</div>That's " + esc(mixWords(m)) +
        ". <small>(" + row.avg_score + "/10 from " + row.n + " ratings)</small>" +
        (fav ? '<br><small>Crowd favorite picks: ' + fav + "</small>" : "");
    }

    try {
      var prev = localStorage.getItem(key), pi = JSON.parse(localStorage.getItem(ikey) || "null");
      if (prev) { range.value = prev; msg.textContent = "You rated this " + prev + ". You can change it."; }
      if (pi && pi.length) picked = pi.filter(function (p) { return ITEMS[p.i]; });
    } catch (e) {}
    draw();
    stats().then(function (d) { showCurrent(d[slug]); });

    btn.addEventListener("click", function () {
      btn.disabled = true;
      var items = picked.map(function (p) { return { i: p.i, n: p.n }; });
      fetch(cfg.url + "/rest/v1/rpc/rate", {
        method: "POST", headers: H,
        body: JSON.stringify({ p_slug: slug, p_voter: voterId(), p_score: score(), p_items: items.length ? items : null })
      }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (rows) {
          try { localStorage.setItem(key, score()); localStorage.setItem(ikey, JSON.stringify(items)); } catch (e) {}
          msg.textContent = "Thanks! You gave it " + mixWords(currentMix()) + " (" + score() + "/10).";
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
