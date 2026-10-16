#!/usr/bin/env python3
"""Build the public site (GitHub Pages) from src/: landing page, every twin, llms.txt, robots.txt, sitemap.xml.

    python3 src/build_public.py --out site          # build into ./site and look at it
    python3 src/build_public.py --out .             # build into the repo root = publish on the next push

Pages: the airport, stadium and science centre twins (each in three.js and on the Mappedin SDK) and the KSA portfolio
command centre.
Venue-switcher links that point at private claude.ai artifacts are rewritten to the public pages, each page
gets a description, canonical URL and social tags, and the command centre gets a public disclaimer.
Nothing here needs a network connection.
"""
import argparse, datetime, html, json, os, re, sys

SRC = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SRC, 'harbourline'))
import build as twins   # noqa: E402  (src/harbourline/build.py)

BASE = 'https://jwilkinson879-alt.github.io/'
AUTHOR = 'Josh Wilkinson'
ARTIFACT_LINKS = {   # private artifact URL -> public page
    'https://claude.ai/artifact/Kbqtt3PLAnaWaWJe5nsXzt': 'airport.html',
    'https://claude.ai/artifact/F8k9ZcPV8fg2LYbrscgWM2': 'stadium.html',
    'https://claude.ai/artifact/4CRqCWZEHirN4QJ6doNMuB': 'science-centre.html',
    'https://claude.ai/artifact/XAnofiUwECKgYXNboSvbjL': 'science-centre-mappedin.html',
    'https://claude.ai/artifact/8Lyg1Q2CxSbErxAsfmFAr7': 'airport-mappedin.html',
    'https://claude.ai/artifact/5RhgLazLcRBo5JSRrKJWBb': 'stadium-mappedin.html',
}
PAGES = [   # (file, source, title, description, stats)
    ('airport.html', ('twin', 'airport'), 'Harbourline International · airport ops twin',
     'Interactive 3D operations twin of a hub airport with a satellite concourse: security surges, gate changes, baggage faults and step-free journeys, with AI agents that propose and people who approve.',
     '6 levels · 324 spaces · 28 gates · one-way security and border'),
    ('stadium.html', ('twin', 'stadium'), 'Harbourline Stadium · stadium ops twin',
     'Interactive 3D operations twin of an 86,400-seat oval stadium: ingress surges, concessions peaks, staggered egress to rail and shuttles, and post-event setback.',
     '6 levels · 429 spaces · 72 seating bays · 8 gates'),
    ('science-centre.html', ('twin', 'science'), 'Harbourline Science Centre · museum ops twin',
     'Interactive 3D operations twin of a science centre: school groups, timed-entry crush, a conservation climate excursion and after-hours setback that protects the collection.',
     '5 levels · 162 spaces · 61 exhibits · RH climate layer'),
    ('science-centre-mappedin.html', ('twin', 'science-mappedin'), 'Harbourline Science Centre on the Mappedin SDK',
     'The same science-centre scenarios running on the Mappedin JS SDK, from an MVF bundle generated straight from the venue brief: live room states, labels, markers and step-free directions.',
     'Mappedin JS 6.27 · generated MVF · no API key'),
    ('airport-mappedin.html', ('twin', 'airport-mappedin'), 'Harbourline International on the Mappedin SDK',
     'The airport scenarios on the Mappedin JS SDK, from a generated MVF bundle: security and border one-way flows, the APM to the satellite, and step-free directions from rail to gate.',
     'Mappedin JS 6.27 · 6 floors · 259 spaces · 24 connections'),
    ('stadium-mappedin.html', ('twin', 'stadium-mappedin'), 'Harbourline Stadium on the Mappedin SDK',
     'The stadium event day on the Mappedin JS SDK, from a generated MVF bundle: gate queues, bay loading and step-free routes from rail, shuttle and rideshare.',
     'Mappedin JS 6.27 · 6 floors · 425 spaces · 25 connections'),
    ('ksa-portfolio.html', ('file', 'ksa-portfolio/command-centre.html'), 'KSA Portfolio · command centre concept',
     'End-state concept for a national real-estate portfolio command centre: one view across commercial, retail and residential assets with integrated CMMS, security and IT/OT, six asset twins and agent-led scenarios.',
     '17 sites · 3 regions · 6 asset twins · integration fabric'),
]
KSA_DISCLAIMER = ('Independent concept built on synthetic data. Site names are generic and every incident, reading, '
                  'site figure and contract value is illustrative; it does not describe any real operator.')


def head_tags(fname, title, desc):
    url = BASE + ('' if fname == 'index.html' else fname)
    e = lambda s: html.escape(s, quote=True)
    return (f'<meta name="description" content="{e(desc)}">\n<meta name="author" content="{AUTHOR}">\n'
            f'<link rel="canonical" href="{url}">\n<meta property="og:type" content="website">\n'
            f'<meta property="og:title" content="{e(title)}">\n<meta property="og:description" content="{e(desc)}">\n'
            f'<meta property="og:url" content="{url}">\n<meta name="twitter:card" content="summary">\n')


def page(fname, src, title, desc):
    kind, ref = src
    if kind == 'twin':
        body = twins.HEAD + twins.build(ref)
    else:
        with open(os.path.join(SRC, ref), encoding='utf-8') as f: body = f.read()
    for old, new in ARTIFACT_LINKS.items():
        body = body.replace(f'href="{old}" target="_blank" rel="noopener"', f'href="{new}"').replace(f'href="{old}"', f'href="{new}"')
    # head tags go straight after the viewport meta
    body = re.sub(r'(<meta name="viewport"[^>]*>\n?)', lambda m: m.group(1) + ('' if m.group(1).endswith('\n') else '\n') + head_tags(fname, title, desc), body, count=1)
    if fname == 'ksa-portfolio.html':
        body = body.replace('<span class="ver">Private portfolio piece · not for distribution</span>', '<span class="ver">Illustrative concept · synthetic data</span>')
        body = body.replace('<footer class="credit">', f'<footer class="credit">\n    <p class="note"><b>Disclaimer.</b> {html.escape(KSA_DISCLAIMER)}</p>', 1)
    leftovers = re.findall(r'https://claude\.ai/artifact/\w+', body)
    if leftovers: print(f'  note: {fname} still links to private artifacts: {sorted(set(leftovers))}')
    return body


INDEX = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Venue ops twins · Josh Wilkinson</title>
{head}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{{color-scheme:dark;--bg:#0B1220;--surface:#111A2B;--raise:#16213A;--ink:#E6EDF5;--muted:#8696AD;--faint:#5C6B82;--line:#1F2C44;--line2:#2A3A58;--accent:#3DDC97;
--display:"Inter Tight","Segoe UI",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--display);padding:0 16px 40px;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1120px;margin:0 auto}} header{{display:flex;gap:16px;align-items:center;padding:22px 0 18px;border-bottom:1px solid var(--line)}}
.mark{{display:grid;place-items:center;width:44px;height:44px;border:1.5px solid var(--accent);color:var(--accent);font:700 16px var(--mono);text-decoration:none;border-radius:3px;position:relative;flex:none}}
.mark::after{{content:"";position:absolute;right:-1.5px;bottom:-1.5px;width:10px;height:10px;background:var(--accent)}}
.eyebrow{{font:500 11px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}}
h1{{font:650 30px/1.1 var(--display);letter-spacing:-.015em;margin:2px 0 0}}
.lede{{color:var(--muted);max-width:78ch;margin:22px 0 26px;font-size:16px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}}
a.card{{display:grid;gap:8px;background:var(--surface);border:1px solid var(--line);border-top:2px solid var(--accent);border-radius:3px;padding:16px 18px 18px;color:inherit;text-decoration:none}}
a.card:hover{{border-color:var(--line2);background:var(--raise)}} a.card:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
.card h2{{margin:0;font:600 18px/1.25 var(--display)}} .card p{{margin:0;color:var(--muted);font-size:14px}}
.card .stats{{font:500 11.5px var(--mono);letter-spacing:.04em;color:var(--accent)}}
.how{{margin-top:30px;border-top:1px solid var(--line);padding-top:20px;color:var(--muted);font-size:14px;max-width:90ch}}
.how b{{color:var(--ink)}} footer{{margin-top:28px;font:500 12px var(--mono);color:var(--faint)}} footer a{{color:var(--accent);text-decoration:none}}
</style></head><body><div class="wrap">
<header><a class="mark" href="https://joshwilkinson.uk" aria-label="Josh Wilkinson">JW</a>
<div><div class="eyebrow">Operational digital twins · synthetic data</div><h1>Venue ops twins</h1></div></header>
<p class="lede">Interactive operations twins for an airport, a stadium, a science centre and a national real-estate portfolio. Each one is generated from a structured venue brief, runs on a shared engine with a step-free-aware walk network, and plays out real operating days where AI agents propose and people approve.</p>
<div class="grid">
{cards}
</div>
<div class="how"><b>How they're built.</b> A venue brief becomes a venue file of levels, spaces, connectors and assets. A walk-network router works out step-free routes, one-way checkpoints and staff-only lifts, and a scenario pack scripts the day's events. The same venue file also generates a Mappedin MVF bundle for the Mappedin SDK and DXF floor plans for Mappedin Maker.</div>
<footer>Designed &amp; prompted by {author} · <a href="https://joshwilkinson.uk">joshwilkinson.uk</a> · built {date}</footer>
</div></body></html>
"""


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True); a = ap.parse_args()
    out = os.path.abspath(a.out); os.makedirs(out, exist_ok=True)
    today = datetime.date.today().isoformat()
    written = []
    for fname, src, title, desc, stats in PAGES:
        body = page(fname, src, title, desc)
        with open(os.path.join(out, fname), 'w', encoding='utf-8', newline='') as f: f.write(body)
        written.append(fname)
    cards = '\n'.join(f'<a class="card" href="{f}"><h2>{html.escape(t)}</h2><p>{html.escape(d)}</p><div class="stats">{html.escape(s)}</div></a>'
                      for f, _, t, d, s in PAGES)
    idx_desc = 'Interactive 3D operations digital twins of an airport, a stadium, a science centre and a real-estate portfolio, with AI agents and human approval.'
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(INDEX.format(head=head_tags('index.html', 'Venue ops twins · Josh Wilkinson', idx_desc), cards=cards, author=AUTHOR, date=today))
    written.insert(0, 'index.html')
    llms = [f'# Venue ops twins by {AUTHOR}', '', f'> {idx_desc} All data is synthetic.', '', '## Pages', '']
    llms += [f'- [{t}]({BASE}{f}): {d}' for f, _, t, d, _ in PAGES]
    llms += ['', '## About', '', f'- Author: {AUTHOR}, CRE and workplace technology executive (https://joshwilkinson.uk)',
             '- Built from structured venue briefs on a shared twin engine; the science centre also runs on the Mappedin JS SDK from a generated MVF bundle.']
    with open(os.path.join(out, 'llms.txt'), 'w', encoding='utf-8') as f: f.write('\n'.join(llms) + '\n')
    with open(os.path.join(out, 'robots.txt'), 'w', encoding='utf-8') as f: f.write(f'User-agent: *\nAllow: /\nSitemap: {BASE}sitemap.xml\n')
    urls = ''.join(f'  <url><loc>{BASE}{"" if p == "index.html" else p}</loc><lastmod>{today}</lastmod></url>\n' for p in written)
    with open(os.path.join(out, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
    with open(os.path.join(out, '.nojekyll'), 'w') as f: f.write('')
    for p in written + ['llms.txt', 'robots.txt', 'sitemap.xml']:
        print(f'{p:32} {os.path.getsize(os.path.join(out, p)):>9,} bytes')
    print(f'-> {out}')


if __name__ == '__main__':
    main()
