#!/usr/bin/env python3
"""Commit as: git -c user.name="Worst Song" -c user.email="hello@worstsong.com" commit ...
(never a personal name/email; the repo is public)

Builds the Worst Song Ever site from data/songs.json + data/lyrics/<n>.txt.

Adding a song:
  1. songs/<n>/audio.mp3 and songs/<n>/cover.jpg
  2. data/lyrics/<n>.txt   ([Section] lines become headers)
  3. an entry in data/songs.json: {"n": 37, "title": "...", "duration": 200.0, "hook_url": ""}
  4. python3 build.py, then commit and push.
  5. Add its counter row in Supabase once:
       insert into public.songs (slug, title) values ('37', 'Title');

Friend songs (hidden at /friend-songs/, reachable only via the footer (c) on the home page, noindex).
NEVER put last names on friend-song pages: first name (or nickname) only.
  1. friend-songs/<slug>/audio.mp3 and (optional) friend-songs/<slug>/cover.jpg
  2. (optional) data/friend-lyrics/<slug>.txt
  3. an entry in data/friend-songs.json:
       {"slug": "jake-birthday", "title": "...", "for": "Jake", "duration": 180.0, "note": ""}
  4. python3 build.py, then commit and push.
  Friend songs have no counters, so nothing goes in Supabase.

Custom songs (public at /custom/, paid orders whose customer chose "Yes, post it").
First names only. Never number them or put them in data/songs.json.
  1. custom/<slug>/audio.mp3 and (optional) custom/<slug>/cover.jpg
  2. (optional) data/custom-lyrics/<slug>.txt
  3. an entry in data/custom-songs.json:
       {"slug": "jen-birthday-2026", "title": "...", "for": "Jen", "occasion": "Birthday",
        "genre": "Pop, 80s", "duration": 180.0, "added": "2026-10-18", "note": ""}
  4. python3 build.py, then commit and push.
  5. Add its counter row in Supabase once (prefix "c-"):
       insert into public.songs (slug, title) values ('c-jen-birthday-2026', 'Title');
     Visitors rate custom songs 1-10 and can pick up to 3 items (public.rate_v2 / public.custom_stats_v2); the score shows
     as a mix of silly items (assets/custom.js).
"""
import html, json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))
BASE = SITE["base_url"].rstrip("/")
PATH = SITE["base_path"].rstrip("/")  # "/worst-songs" on github.io, "" on a custom domain
songs = json.load(open(os.path.join(ROOT, "data", "songs.json"), encoding="utf-8"))
songs.sort(key=lambda s: s["n"], reverse=True)
e = html.escape


def ver(rel):
    import hashlib
    return hashlib.md5(open(os.path.join(ROOT, rel), "rb").read()).hexdigest()[:8]


CSSV, JSV, CJSV = ver("assets/style.css"), ver("assets/stats.js"), ver("assets/custom.js")
PJSV = ver("assets/player.js")


def mmss(sec):
    sec = int(round(sec))
    return f"{sec // 60}:{sec % 60:02d}"


def lyrics_html(txt):
    out, para = [], []

    def flush():
        if para:
            out.append("<p>" + "<br>".join(para) + "</p>")
            para.clear()

    for raw in txt.splitlines():
        line = raw.strip()
        if not line:
            flush()
            continue
        m = re.fullmatch(r"\[(.+)\]", line)
        if m:
            flush()
            label = m.group(1)
            name, _, note = label.partition(" - ")
            out.append(f'<h3>{e(name)}{f" <span>{e(note)}</span>" if note else ""}</h3>')
            continue
        if re.fullmatch(r"\((.+)\)", line) and not out and not para:
            out.append(f'<p class="note">{e(line[1:-1])}</p>')
            continue
        para.append(e(line))
    flush()
    return "\n".join(out)


def yt_embed(url):
    m = re.search(r"(?:youtu\.be/|v=|shorts/)([\w-]{11})", url or "")
    if m:
        return (f'<div class="hook"><iframe src="https://www.youtube-nocookie.com/embed/{m.group(1)}" '
                'title="Hook video" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>')
    if url:
        return f'<p class="hooklink"><a href="{e(url)}" target="_blank" rel="noopener">Watch the Hook video &rarr;</a></p>'
    return ""


def head(title, desc, url, image, hidden=False, extra=""):
    robots = '<meta name="robots" content="noindex, nofollow, noarchive">\n' if hidden else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{robots}<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:type" content="music.song">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{PATH}/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{PATH}/assets/style.css?v={CSSV}">
<script>window.WSE={{url:"{SITE['supabase_url']}",key:"{SITE['supabase_key']}"}};</script>
<script src="{PATH}/assets/stats.js?v={JSV}" defer></script>
{extra}</head>
"""


def song_page(s, prev_s, next_s):
    n = s["n"]
    full = f"Worst Song Ever #{n} - {s['title']}"
    lyr = open(os.path.join(ROOT, "data", "lyrics", f"{n}.txt"), encoding="utf-8").read()
    order = json.dumps([[x["n"], x["title"]] for x in sorted(songs, key=lambda x: x["n"])], ensure_ascii=False)
    nav = (f'<a href="{PATH}/{prev_s["n"]}/" data-go="{prev_s["n"]}">&larr; #{prev_s["n"]} {e(prev_s["title"])}</a>'
           f'<a href="{PATH}/">All songs</a>'
           f'<a href="{PATH}/{next_s["n"]}/" data-go="{next_s["n"]}">#{next_s["n"]} {e(next_s["title"])} &rarr;</a>')
    songnav = (f'<div class="songnav"><a class="sn" href="{PATH}/{prev_s["n"]}/" data-go="{prev_s["n"]}" aria-label="Previous song, number {prev_s["n"]}">&#9664; #{prev_s["n"]}</a>'
               f'<label class="auto"><input type="checkbox" data-auto checked> Auto-play next</label>'
               f'<a class="sn" href="{PATH}/{next_s["n"]}/" data-go="{next_s["n"]}" aria-label="Next song, number {next_s["n"]}">#{next_s["n"]} &#9654;</a></div>'
               f'<div class="upnext" data-upnext hidden></div>')
    return head(full, f"Listen to {full}. It's terrible. Rate it 1-10.",
                f"{BASE}/{n}/", f"{BASE}/songs/{n}/cover.jpg",
                extra=f'<script>window.WSE_ORDER={order};window.WSE_PATH="{PATH}";</script>\n<script src="{PATH}/assets/player.js?v={PJSV}" defer></script>\n') + f"""<body class="song" data-slug="{n}">
<header class="bar"><a class="brand" href="{PATH}/">WORST SONG EVER</a></header>
<main class="wrap">
  <section class="hero">
    <img class="cover" src="{PATH}/songs/{n}/cover.jpg" alt="" width="720" height="720">
    <div class="meta">
      <div class="badge">WORST SONG EVER <b>#{n}</b></div>
      <h1>{e(s['title'])}</h1>
      <audio id="player" controls preload="metadata" src="{PATH}/songs/{n}/audio.mp3"></audio>
      {songnav}
      <div class="counts"><span>&#127911; <b data-plays>&ndash;</b> plays</span><span>&#128064; <b data-visits>&ndash;</b> visits</span><span>{mmss(s['duration'])}</span></div>
      <button class="share" type="button" data-share>Share this crime</button>
    </div>
  </section>
  {yt_embed(s.get('hook_url'))}
  <section class="lyrics">
    <h2>Lyrics</h2>
    {lyrics_html(lyr)}
  </section>
  <nav class="pager">{''.join(nav)}</nav>
</main>
<footer class="foot">Made on purpose. &copy; Worst Song Ever</footer>
</body>
</html>
"""


def index_page():
    cards = "\n".join(
        f"""<a class="card" href="{PATH}/{s['n']}/" data-card="{s['n']}">
  <img src="{PATH}/songs/{s['n']}/cover.jpg" alt="" loading="lazy" width="720" height="720">
  <div class="cardtext"><span class="num">#{s['n']}</span><span class="t">{e(s['title'])}</span>
  <span class="c">&#127911; <b data-plays-for="{s['n']}">&ndash;</b> &middot; {mmss(s['duration'])}</span></div>
</a>""" for s in songs)
    titles = {str(s["n"]): s["title"] for s in songs}
    return head("Worst Song Ever", "Intentionally terrible songs, genuinely well made. Pick one. Regret it.",
                f"{BASE}/", f"{BASE}/songs/{songs[0]['n']}/cover.jpg") + f"""<body class="home" data-slug="home">
<header class="bar"><a class="brand" href="{PATH}/">WORST SONG EVER</a></header>
<main class="wrap">
  <section class="intro">
    <h1>WORST SONG<br>EVER</h1>
    <p>Intentionally terrible songs. Genuinely catchy. You've been warned.</p>
    <div class="counts big"><span>&#128064; <b data-total-visits>&ndash;</b> visits</span><span>&#127911; <b data-total-plays>&ndash;</b> plays</span><span>{len(songs)} songs</span></div>
    <div class="reqrow"><a class="reqbtn playall" href="{PATH}/{min(s['n'] for s in songs)}/?playall=1">&#9654; Play them all, in order</a><a class="reqbtn" href="{PATH}/custom/">&#127925; Hear custom songs &rarr;</a></div>
  </section>
  <section class="boards" hidden>
    <h2>The Charts <span>(the worst of the worst)</span></h2>
    <div class="boardrow">
      <div class="board" data-board="ever"></div>
      <div class="board" data-board="week"></div>
      <div class="board" data-board="daily"></div>
    </div>
  </section>
  <section>
    <h2>Every Song</h2>
    <div class="grid">
{cards}
    </div>
  </section>
</main>
<footer class="foot">Made on purpose. <a class="sneak" href="{PATH}/friend-songs/" rel="nofollow" aria-label="Worst Song Ever">&copy;</a> Worst Song Ever</footer>
<script>window.WSE_TITLES={json.dumps(titles, ensure_ascii=False)};</script>
</body>
</html>
"""


def write(rel, text):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(text)


FRIEND_PATH = f"{PATH}/friend-songs"
friends = json.load(open(os.path.join(ROOT, "data", "friend-songs.json"), encoding="utf-8"))


def friend_cover(f):
    if os.path.exists(os.path.join(ROOT, "friend-songs", f["slug"], "cover.jpg")):
        return f"{FRIEND_PATH}/{f['slug']}/cover.jpg"
    return f"{PATH}/assets/brand/logo.png"


def friend_page(f):
    lp = os.path.join(ROOT, "data", "friend-lyrics", f"{f['slug']}.txt")
    lyr = lyrics_html(open(lp, encoding="utf-8").read()) if os.path.exists(lp) else ""
    who = f'<div class="badge">A SONG FOR <b>{e(f["for"])}</b></div>' if f.get("for") else '<div class="badge">FRIEND SONG</div>'
    note = f'<p class="fnote">{e(f["note"])}</p>' if f.get("note") else ""
    dur = f'<div class="counts"><span>{mmss(f["duration"])}</span></div>' if f.get("duration") else ""
    return head(f["title"], "A song made for a friend.", f"{BASE}/friend-songs/{f['slug']}/",
                BASE + friend_cover(f)[len(PATH):], hidden=True) + f"""<body class="song" data-slug="">
<header class="bar"><a class="brand" href="{FRIEND_PATH}/">FRIEND SONGS</a></header>
<main class="wrap">
  <section class="hero">
    <img class="cover" src="{friend_cover(f)}" alt="" width="720" height="720">
    <div class="meta">
      {who}
      <h1>{e(f['title'])}</h1>
      <audio id="player" controls preload="metadata" src="{FRIEND_PATH}/{f['slug']}/audio.mp3"></audio>
      {dur}
      {note}
      <button class="share" type="button" data-share>Share this song</button>
    </div>
  </section>
  {yt_embed(f.get('hook_url'))}
  {f'<section class="lyrics"><h2>Lyrics</h2>{lyr}</section>' if lyr else ''}
  <nav class="pager"><a href="{FRIEND_PATH}/">All friend songs</a><a href="{PATH}/">Worst Song Ever</a></nav>
</main>
<footer class="foot">Made on purpose. &copy; Worst Song Ever</footer>
</body>
</html>
"""


def friend_index():
    cards = "\n".join(
        f"""<a class="card" href="{FRIEND_PATH}/{f['slug']}/">
  <img src="{friend_cover(f)}" alt="" loading="lazy" width="720" height="720">
  <div class="cardtext"><span class="num">{e('For ' + f['for']) if f.get('for') else 'Friend song'}</span><span class="t">{e(f['title'])}</span></div>
</a>""" for f in friends)
    body = f'<div class="grid">\n{cards}\n    </div>' if friends else '<p class="empty">No friend songs yet. Check back soon.</p>'
    return head("Friend Songs", "Songs made for friends.", f"{BASE}/friend-songs/",
                f"{BASE}/assets/brand/logo.png", hidden=True) + f"""<body class="home" data-slug="">
<header class="bar"><a class="brand" href="{FRIEND_PATH}/">FRIEND SONGS</a></header>
<main class="wrap">
  <section class="intro">
    <h1>FRIEND<br>SONGS</h1>
    <p>Made for the people who asked for it.</p>
  </section>
  <section>
    {body}
  </section>
</main>
<footer class="foot">Made on purpose. &copy; Worst Song Ever</footer>
</body>
</html>
"""


CUSTOM_PATH = f"{PATH}/custom"
cpath = os.path.join(ROOT, "data", "custom-songs.json")
customs = json.load(open(cpath, encoding="utf-8")) if os.path.exists(cpath) else []
customs.sort(key=lambda c: c.get("added", ""), reverse=True)


def custom_cover(c):
    if os.path.exists(os.path.join(ROOT, "custom", c["slug"], "cover.jpg")):
        return f"{CUSTOM_PATH}/{c['slug']}/cover.jpg"
    return f"{PATH}/assets/brand/logo.png"


def custom_genres(c):
    return [g.strip() for g in (c.get("genre") or "").split(",") if g.strip()]


def custom_label(c):
    occ = (c.get("occasion") or "").strip()
    occ = "" if occ.lower() in ("", "other", "just because") else occ.upper() + " "
    return f"A {occ}SONG FOR"


CUSTOM_JS = f'<script src="{PATH}/assets/custom.js?v={CJSV}" defer></script>\n'


def custom_page(c):
    lp = os.path.join(ROOT, "data", "custom-lyrics", f"{c['slug']}.txt")
    lyr = lyrics_html(open(lp, encoding="utf-8").read()) if os.path.exists(lp) else ""
    who = f'<div class="badge">{e(custom_label(c))} <b>{e(c["for"])}</b></div>'
    note = f'<p class="fnote">{e(c["note"])}</p>' if c.get("note") else ""
    tags = "".join(f'<span class="gtag">{e(g)}</span>' for g in custom_genres(c))
    dur = f'<span>{mmss(c["duration"])}</span>' if c.get("duration") else ""
    return head(c["title"], f"A custom song made for {c['for']}.", f"{BASE}/custom/{c['slug']}/",
                BASE + custom_cover(c)[len(PATH):], extra=CUSTOM_JS) + f"""<body class="song" data-slug="c-{c['slug']}">
<header class="bar"><a class="brand" href="{CUSTOM_PATH}/">CUSTOM SONGS</a></header>
<main class="wrap">
  <section class="hero">
    <img class="cover" src="{custom_cover(c)}" alt="Cover art for {e(c['title'])}" width="720" height="720">
    <div class="meta">
      {who}
      <h1>{e(c['title'])}</h1>
      <div class="gtags">{tags}</div>
      <audio id="player" controls preload="metadata" src="{CUSTOM_PATH}/{c['slug']}/audio.mp3"></audio>
      <div class="counts"><span>&#127911; <b data-plays>&ndash;</b> plays</span>{dur}</div>
      {note}
      <button class="share" type="button" data-share>Share this song</button>
    </div>
  </section>
  <section class="rate" data-rate="c-{c['slug']}">
    <h2>Song Score</h2>
    <p class="cur" data-current>Loading&hellip;</p>
    <h3 class="rstep">1. Your score</h3>
    <label class="rlabel" for="rate-range">How stuck in your head is it? <b data-num>5</b>/10</label>
    <input id="rate-range" type="range" min="1" max="10" step="1" value="5">
    <h3 class="rstep">2. Pick your pile <span>(optional)</span></h3>
    <div class="mine" data-mine></div>
    <div class="ichips" data-chips role="group" aria-label="Pick up to 3 items"></div>
    <button type="button" class="shuf" data-shuffle>&#128256; Show other items</button>
    <div class="pile" data-pile aria-hidden="true"></div>
    <p class="preview">That's <span data-preview></span>.</p>
    <button type="button" class="reqbtn" data-submit>Rate it</button>
    <p class="rmsg" data-msg aria-live="polite"></p>
  </section>
  {f'<section class="lyrics"><h2>Lyrics</h2>{lyr}</section>' if lyr else ''}
  <section class="ctaband"><h2>Want one like this?</h2><a class="reqbtn" href="{PATH}/request/">Request your song <b>$5</b> &rarr;</a></section>
  <nav class="pager"><a href="{CUSTOM_PATH}/">All custom songs</a><a href="{PATH}/">Worst Song Ever</a></nav>
</main>
<footer class="foot">Made on purpose. &copy; Worst Song Ever</footer>
</body>
</html>
"""


def custom_index():
    cards = "\n".join(
        f"""<a class="card" href="{CUSTOM_PATH}/{c['slug']}/" data-cslug="c-{c['slug']}" data-added="{e(c.get('added', ''))}" data-genres="{e('|'.join(custom_genres(c)))}">
  <img src="{custom_cover(c)}" alt="" loading="lazy" width="720" height="720">
  <div class="cardtext"><span class="num">{e('For ' + c['for'])}</span><span class="t">{e(c['title'])}</span>
  <span class="c" data-mix><span class="mix none">&nbsp;</span></span>
  <span class="c">{" &middot; ".join(e(g) for g in custom_genres(c))}{" &middot; " if custom_genres(c) else ""}&#127911; <b data-cplays>&ndash;</b></span></div>
</a>""" for c in customs)
    genres = sorted({g for c in customs for g in custom_genres(c)}, key=str.lower)
    chips = '<button type="button" class="chipf on" data-genre-filter="all" aria-pressed="true">All</button>' + "".join(
        f'<button type="button" class="chipf" data-genre-filter="{e(g)}" aria-pressed="false">{e(g)}</button>' for g in genres)
    tools = f"""<div class="ctools">
      <div class="chipsf" role="group" aria-label="Filter by genre">{chips}</div>
      <label class="sortl">Sort <select data-sort><option value="new">Newest</option><option value="plays">Most played</option><option value="rated">Top rated</option></select></label>
    </div>""" if customs else ""
    body = (f'{tools}\n    <div class="grid" data-custom-grid>\n{cards}\n    </div>' if customs
            else '<p class="empty">The first custom songs are being written right now. Yours could be next.</p>')
    return head("Custom Songs", "Custom songs made to order for birthdays, weddings, anniversaries and just because.",
                f"{BASE}/custom/", f"{BASE}/assets/brand/logo.png", extra=CUSTOM_JS) + f"""<body class="home" data-slug="">
<header class="bar"><a class="brand" href="{PATH}/">WORST SONG EVER</a></header>
<main class="wrap">
  <section class="intro">
    <h1>CUSTOM<br>SONGS</h1>
    <p>Made to order for birthdays, weddings, anniversaries, and just because.</p>
    <a class="reqbtn" href="{PATH}/request/">Want your own song? <b>$5</b> &rarr;</a>
  </section>
  <section>
    {body}
    <p class="scorehelp">Song scores are out of 10, shown as a pile of random stuff that adds up to the score. A 9 might be 3 earthworms, 5 praying mantises and 1 meteor.</p>
  </section>
</main>
<footer class="foot">Made on purpose. &copy; Worst Song Ever</footer>
</body>
</html>
"""


write("index.html", index_page())
write("custom/index.html", custom_index())
for c in customs:
    write(f"custom/{c['slug']}/index.html", custom_page(c))
write("friend-songs/index.html", friend_index())
for f in friends:
    write(f"friend-songs/{f['slug']}/index.html", friend_page(f))
asc = sorted(songs, key=lambda x: x["n"])
for i, s in enumerate(asc):
    prv = asc[i - 1]                    # lower number (wraps to the newest)
    nxt = asc[(i + 1) % len(asc)]       # higher number (wraps to #0)
    write(f"{s['n']}/index.html", song_page(s, prv, nxt))
print(f"built {len(songs)} song pages, {len(customs)} custom song pages, {len(friends)} friend song pages")
