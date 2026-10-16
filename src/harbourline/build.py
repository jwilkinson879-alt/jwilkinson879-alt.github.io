#!/usr/bin/env python3
"""Assemble the Harbourline twin pages from the shared engine and per-venue files.

    python3 build.py                 # writes dist/<page>.html
    python3 build.py --verify DIR    # also diffs each page against DIR/<page>.html

Each page = engine/page.html markup (filled from venues/<v>/page*.json)
          + const V = <venue.json>  + engine/graph.js
          + engine/engine.js with the venue's scenario pack spliced in at /*@@PACK@@*/
          + (Mappedin page only) mappedin/renderer.js at /*@@RENDERER@@*/ with the MVF bundle.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
HEAD = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n')

PAGES = {
    # page name: (venue folder, page meta file, pack file, renderer?)
    'airport': ('airport', 'page.json', 'pack.js', False),
    'stadium': ('stadium', 'page.json', 'pack.js', False),
    'science': ('science', 'page.json', 'pack.js', False),
    'science-mappedin': ('science', 'page.mappedin.json', 'pack.mappedin.js', True),
}


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8', newline='') as f:
        return f.read()


def strip1(s):  # drop the single trailing newline each source file ends with
    return s[:-1] if s.endswith('\n') else s


def build(name):
    venue, meta_file, pack_file, mappedin = PAGES[name]
    meta = json.loads(read('venues', venue, meta_file))
    markup = strip1(read('engine', 'page.html'))
    for key in ('title', 'brand', 'nav', 'list_tab', 'hint', 'footer_note'):
        markup = markup.replace('{{%s}}' % key, meta[key])
    for key in ('extra_css', 'stage_pre', 'scripts'):
        val = '\n'.join(meta[key])
        token = '{{%s}}' % key
        # an empty block removes its placeholder line entirely
        markup = markup.replace(token, val) if val else markup.replace(token + '\n', '')
    V = json.loads(read('venues', venue, 'venue.json'))
    js = strip1(read('engine', 'engine.js'))
    js = js.replace('/*@@PACK@@*/', strip1(read('venues', venue, pack_file)))
    if mappedin:
        r = strip1(read('mappedin', 'renderer.js'))
        r = r.replace('/*@@MVF@@*/', 'const MVF=' + strip1(read('mappedin', 'hsc.mvf.json')) + ';')
        js = js.replace('/*@@RENDERER@@*/', r)
    else:
        js = js.replace('/*@@RENDERER@@*/\n', '')
    body = '\n'.join([
        markup,
        'const V = ' + json.dumps(V, separators=(',', ':')) + ';',
        strip1(read('engine', 'graph.js')),
        js,
        '</script>',
        '',
        '</body></html>',
    ])
    return body


def main():
    out = os.path.join(ROOT, 'dist')
    os.makedirs(out, exist_ok=True)
    ref = sys.argv[sys.argv.index('--verify') + 1] if '--verify' in sys.argv else None
    ok = True
    for name in PAGES:
        body = build(name)
        with open(os.path.join(out, name + '.html'), 'w', encoding='utf-8', newline='') as f:
            f.write(HEAD + body)
        msg = f'{name}.html  {len(HEAD + body):,} bytes'
        if ref:
            with open(os.path.join(ref, name + '.html'), encoding='utf-8', newline='') as f:
                want = f.read()
            same = want == body
            ok &= same
            msg += '  matches published page' if same else '  DIFFERS from published page'
        print(msg)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
