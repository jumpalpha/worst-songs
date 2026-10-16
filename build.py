#!/usr/bin/env python3
"""Builds the Worst Song Ever site from data/songs.json + data/lyrics/<n>.txt.

Adding a song:
  1. songs/<n>/audio.mp3 and songs/<n>/cover.jpg
  2. data/lyrics/<n>.txt   ([Section] lines become headers)
  3. an entry in data/songs.json: {"n": 37, "title": "...", "duration": 200.0, "hook_url": ""}
  4. python3 build.py, then commit and push.
  5. Add its counter row in Supabase once:
       insert into public.songs (slug, title) values ('37', 'Title');
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


CSSV, JSV = ver("assets/style.css"), ver("assets/stats.js")


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


def head(title, desc, url, image):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
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
</head>
"""


def song_page(s, prev_s, next_s):
    n = s["n"]
    full = f"Worst Song Ever #{n} - {s['title']}"
    lyr = open(os.path.join(ROOT, "data", "lyrics", f"{n}.txt"), encoding="utf-8").read()
    nav = []
    if next_s:
        nav.append(f'<a href="{PATH}/{next_s["n"]}/">&larr; #{next_s["n"]}</a>')
    nav.append(f'<a href="{PATH}/">All songs</a>')
    if prev_s:
        nav.append(f'<a href="{PATH}/{prev_s["n"]}/">#{prev_s["n"]} &rarr;</a>')
    return head(full, f"Listen to {full}. It's terrible. Rate it 1-10.",
                f"{BASE}/{n}/", f"{BASE}/songs/{n}/cover.jpg") + f"""<body class="song" data-slug="{n}">
<header class="bar"><a class="brand" href="{PATH}/">WORST SONG EVER</a></header>
<main class="wrap">
  <section class="hero">
    <img class="cover" src="{PATH}/songs/{n}/cover.jpg" alt="" width="720" height="720">
    <div class="meta">
      <div class="badge">WORST SONG EVER <b>#{n}</b></div>
      <h1>{e(s['title'])}</h1>
      <audio id="player" controls preload="metadata" src="{PATH}/songs/{n}/audio.mp3"></audio>
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
  </section>
  <section class="board" hidden>
    <h2>Most Played <span>(the worst of the worst)</span></h2>
    <ol data-board></ol>
  </section>
  <section>
    <h2>Every Song</h2>
    <div class="grid">
{cards}
    </div>
  </section>
</main>
<footer class="foot">Made on purpose. &copy; Worst Song Ever</footer>
<script>window.WSE_TITLES={json.dumps(titles, ensure_ascii=False)};</script>
</body>
</html>
"""


def write(rel, text):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(text)


write("index.html", index_page())
for i, s in enumerate(songs):
    nxt = songs[i - 1] if i > 0 else None          # newer
    prv = songs[i + 1] if i + 1 < len(songs) else None  # older
    write(f"{s['n']}/index.html", song_page(s, prv, nxt))
print(f"built {len(songs)} song pages")
