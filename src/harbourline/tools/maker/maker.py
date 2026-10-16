#!/usr/bin/env python3
"""Helpers for driving Mappedin Maker in a browser: venue -> screen calibration and ready-made click batches.

Replaces the old cal.py / nm.py / cn.py / hw.py / gen.py. Everything prints JSON (or JS) for the browser
automation tool to replay; nothing here touches the browser itself.

    python3 maker.py cal  --fit "x1,y1,sx1,sy1" "x2,y2,sx2,sy2"           # fit a calibration from 2+ clicked points
    python3 maker.py names venues/stadium/venue.json --level L2 --cal 2.055,230.5,-99.5 [--batch 6] [--only ID ...]
    python3 maker.py connections venues/airport/venue.json --cal 1.148,465.2,130.2
    python3 maker.py walls venues/airport/venue.json --cal ... --spaces L1-IMM L1-RECLAIM
    python3 maker.py doors mappedin/hli.mvf.json venues/airport/venue.json --level L1 --cal ...
    python3 maker.py js                                                   # the window.__nm naming helper

A calibration is k,ox,oy with screen = (ox + k*x, oy + k*y) for plan metres (x east, y south). It changes with
the viewport size, zoom and pan, so refit it at the start of each session from two points you can see on screen
(two far-apart room corners). The PRESETS are the ones measured in earlier sessions, for reference only.

Maker gotchas learned the hard way
  - Wall and door tools need a hover before each click; clicks closer than 0.5 s apart register as a double-click.
  - A wall segment commits only when the next point is clicked. To close a polygon click p0..pn, p0, p1, then
    Escape. Escape also switches back to the select tool, so pick the wall tool again before the next polygon.
  - Wall snapping radius is about 25 px: zoom until features are 30+ px apart. Closing a loop ends the chain.
  - The rectangle tool makes Objects, not rooms. The door tool drops a 0.91 m door with one click on a wall.
  - Typing while the canvas has focus fires shortcuts (rectangle, connection, floor switch). Name rooms with the
    __nm helper, which types into the location field directly. Recover from stray shortcuts with toolbar Undo
    until the toast reads "Bulk Location Creation", then Redo once.
  - If a click lands on an already-named merged space, the next name attaches to the whole corridor: use
    Location > Detach (chain icon), then rename. Re-define __nm after any reload (Preview > Back to Editor reloads).
  - Connection nodes share one XY across every floor they span; dragging one moves it on all floors.
  - One-way doors and "During navigation" door rules need Pro; preview ignores them on the free plan.
  - Warnings > "Rooms have no location" > Show on Map highlights unnamed rooms (purple).
"""
import argparse, json, math, sys

PRESETS = {   # name: (k, ox, oy, note)
    'airport-1298x924':        (1.148, 448 + 15 * 1.148, 113 + 15 * 1.148, 'airport, default zoom after setup'),
    'airport-L2-main':         (2.533, 257, 1, 'airport L2 main block zoom'),
    'airport-L2-satellite':    (2.533, 257, -879, 'airport L2 after panning to the satellite'),
    'stadium-1283x633':        (1.647, 298 + 8 * 1.647, 38.5 - 30.9 * 1.647, 'stadium, recentred'),
    'stadium-1298x924':        (1.252, 388 + 8 * 1.252, 251 - 30.9 * 1.252, 'stadium'),
    'stadium-1568x778-zoom1':  (1.865, 396 + 8 * 1.865, 73 - 30.9 * 1.865, 'stadium L3, one scroll step in'),
    'stadium-L1-recentred':    (1.8, 285, -33, 'stadium L1 recentred (1283x633)'),
    'stadium-L1-5ticks':       (3.2, 137, -417, 'stadium L1 after 5 scroll ticks at (500,420)'),
    'stadium-L2':              (2.055, 641.5 - 200 * 2.055, 311.5 - 200 * 2.055, 'stadium L2 recentred'),
}
MAKER_TYPE = {'lift': 'Elevator', 'esc': 'Escalator', 'stairs': 'Stairway', 'ramp': 'Stairway'}
BLUR = (950, 650)   # a point outside the building, used to drop selection before each room click


def parse_cal(s):
    if s in PRESETS: return PRESETS[s][:3]
    k, ox, oy = (float(v) for v in s.split(','))
    return k, ox, oy


def to_screen(cal, x, y):
    k, ox, oy = cal
    return [round(ox + k * x, 1), round(oy + k * y, 1)]


def fit(pairs):
    """Least-squares k, ox, oy from [(x, y, sx, sy), ...] (uniform scale, no rotation)."""
    n = len(pairs)
    if n < 2: raise SystemExit('need at least two points')
    mx = sum(p[0] for p in pairs) / n; my = sum(p[1] for p in pairs) / n
    msx = sum(p[2] for p in pairs) / n; msy = sum(p[3] for p in pairs) / n
    num = sum((p[0] - mx) * (p[2] - msx) + (p[1] - my) * (p[3] - msy) for p in pairs)
    den = sum((p[0] - mx) ** 2 + (p[1] - my) ** 2 for p in pairs)
    k = num / den
    ox, oy = msx - k * mx, msy - k * my
    resid = max(math.hypot(ox + k * p[0] - p[2], oy + k * p[1] - p[3]) for p in pairs)
    return round(k, 4), round(ox, 2), round(oy, 2), round(resid, 2)


def centre(s):
    return s['x'] + s['w'] / 2, s['y'] + s['h'] / 2   # rotation is about the centre, so the centre never moves


def corners(s):
    cx, cy = centre(s)
    pts = [(s['x'], s['y']), (s['x'] + s['w'], s['y']), (s['x'] + s['w'], s['y'] + s['h']), (s['x'], s['y'] + s['h'])]
    r = s.get('rot') or 0
    c, sn = math.cos(r), math.sin(r)
    return [(cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c) for x, y in pts]


NM_JS = r"""// Paste once per page load. Usage after clicking a room: __nm('Gate A1')
// Clicks "Add Location" only if the button exists (so a missed room click types nothing into the canvas),
// fills the "Attach or create location" field through the native value setter, then presses Enter.
window.__nm = function (name) {
  const btn = [...document.querySelectorAll('button')].find(b => /add location/i.test(b.textContent || ''));
  if (!btn) return 'no Add Location button (room not selected?)';
  btn.click();
  return new Promise(resolve => setTimeout(() => {
    const input = [...document.querySelectorAll('input')].find(i => /attach or create location/i.test(i.placeholder || i.getAttribute('aria-label') || ''));
    if (!input) return resolve('no location input');
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {   // Enter too soon after typing saves nothing
      for (const t of ['keydown', 'keypress', 'keyup'])
        input.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      resolve('ok: ' + name);
    }, 600);
  }, 700));
};
// Guard for connections: before ticking floors in Floor Span, the span text must read "<floor> - <same floor>",
// so an existing connection is never edited by mistake.
window.__spanIsFresh = function () {
  const el = [...document.querySelectorAll('*')].find(e => /floor span/i.test(e.textContent || '') && e.children.length < 6);
  const txt = el ? el.textContent : ''; const m = txt.match(/([A-Z0-9]+)\s*-\s*([A-Z0-9]+)/);
  return !!(m && m[1] === m[2]);
};"""


def load(p):
    with open(p, encoding='utf-8') as f: return json.load(f)


def cmd_names(a):
    V = load(a.venue); cal = parse_cal(a.cal)
    rooms = [s for s in V['spaces'] if s['lv'] == a.level and s['kind'] not in ('object', 'corridor', 'track')
             and (not a.only or s['id'] in a.only)]
    if not a.include_cores: rooms = [s for s in rooms if s['kind'] != 'core']
    items = []
    for s in rooms:
        sx, sy = to_screen(cal, *centre(s))
        items.append({'id': s['id'], 'name': s['name'], 'steps': [
            {'action': 'left_click', 'coordinate': list(BLUR)}, {'action': 'wait', 'duration': 0.8},
            {'action': 'left_click', 'coordinate': [sx, sy]}, {'action': 'wait', 'duration': 1.3},
            {'action': 'javascript_exec', 'code': f"__nm({json.dumps(s['name'])})"}, {'action': 'wait', 'duration': 1.2}]})
    batches = [items[i:i + a.batch] for i in range(0, len(items), a.batch)]
    print(json.dumps({'level': a.level, 'rooms': len(items), 'batches': batches}, ensure_ascii=False, indent=1))


def cmd_connections(a):
    V = load(a.venue); cal = parse_cal(a.cal); order = [l['id'] for l in V['levels']]
    out = []
    for c in V['connectors']:
        lvls = sorted({st['lv'] for st in c['stops']}, key=order.index)
        if len(lvls) < 2: continue   # same-floor gates and screens are doors in Maker, not connections
        mt = 'Stairway' if 'ramp' in (c.get('name') or '').lower() else MAKER_TYPE.get(c['type'], 'Stairway')
        stops = [{'lv': st['lv'], 'plan': [st['x'], st['y']], 'screen': to_screen(cal, st['x'], st['y'])} for st in c['stops']]
        spread = max(math.dist(stops[0]['plan'], s['plan']) for s in stops)
        out.append({'id': c['id'], 'name': c.get('name', c['id']), 'maker_type': mt, 'floors': lvls,
                    'span': f"{lvls[0]} - {lvls[-1]}", 'staff_only': bool(c.get('staff')), 'stops': stops,
                    'note': (f'stops spread {spread:.1f} m apart; Maker uses one XY on every floor, so place it '
                             'where all floors have walkable space and check each floor') if spread > 3 else ''})
    print(json.dumps(out, ensure_ascii=False, indent=1))


def cmd_walls(a):
    V = load(a.venue); cal = parse_cal(a.cal); S = {s['id']: s for s in V['spaces']}
    out = []
    for sid in a.spaces:
        s = S[sid]; pts = [to_screen(cal, x, y) for x, y in corners(s)]
        clicks = pts + [pts[0], pts[1]]   # p0..pn, p0, p1, then Escape commits the last segment
        out.append({'id': sid, 'name': s['name'], 'lv': s['lv'],
                    'steps': [{'action': 'left_click', 'coordinate': [0, 0], 'note': 'select the wall tool'}] +
                             [x for p in clicks for x in ({'action': 'mouse_move', 'coordinate': p}, {'action': 'wait', 'duration': 0.3},
                                                          {'action': 'left_click', 'coordinate': p}, {'action': 'wait', 'duration': 0.6})] +
                             [{'action': 'key', 'text': 'Escape'}]})
    print(json.dumps(out, ensure_ascii=False, indent=1))


def cmd_doors(a):
    """Door positions from a generated MVF (the gaps gen_mvf cut into each wall), as screen clicks for the door tool."""
    m = load(a.mvf); V = load(a.venue); cal = parse_cal(a.cal)
    feats = m['entrance'].get('f_' + a.level, {}).get('features', [])
    # MVF lon/lat -> plan metres, calibrated on one unrotated rectangle of the venue
    spaces = {f['properties']['externalId']: f for fl in m['space'].values() for f in fl['features']}
    ref = next(s for s in V['spaces'] if not s.get('rot') and s.get('shape') != 'ellipse' and s['id'] in spaces)
    (lo0, la0), (lo1, la1) = spaces[ref['id']]['geometry']['coordinates'][0][0], spaces[ref['id']]['geometry']['coordinates'][0][2]
    sx_ = (lo1 - lo0) / ref['w']; sy_ = (la0 - la1) / ref['h']
    plan = lambda p: ((p[0] - lo0) / sx_ + ref['x'], (la0 - p[1]) / sy_ + ref['y'])
    out = []
    for f in feats:
        (x0, y0), (x1, y1) = (plan(p) for p in f['geometry']['coordinates'])
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        out.append({'id': f['properties']['id'], 'plan': [round(mx, 2), round(my, 2)], 'screen': to_screen(cal, mx, my)})
    print(json.dumps({'level': a.level, 'doors': out}, indent=1))


def main():
    ap = argparse.ArgumentParser(description='Mappedin Maker browser helpers'); sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('cal'); p.add_argument('--fit', nargs='+', help='x,y,sx,sy pairs'); p.add_argument('--list', action='store_true')
    p = sub.add_parser('names'); p.add_argument('venue'); p.add_argument('--level', required=True); p.add_argument('--cal', required=True)
    p.add_argument('--batch', type=int, default=6, help='rooms per browser batch (6-7 max or the batch times out)')
    p.add_argument('--only', nargs='*'); p.add_argument('--include-cores', action='store_true')
    p = sub.add_parser('connections'); p.add_argument('venue'); p.add_argument('--cal', required=True)
    p = sub.add_parser('walls'); p.add_argument('venue'); p.add_argument('--cal', required=True); p.add_argument('--spaces', nargs='+', required=True)
    p = sub.add_parser('doors'); p.add_argument('mvf'); p.add_argument('venue'); p.add_argument('--level', required=True); p.add_argument('--cal', required=True)
    sub.add_parser('js')
    a = ap.parse_args()
    if a.cmd == 'cal':
        if a.list or not a.fit:
            for k, v in PRESETS.items(): print(f'{k:24} k={v[0]} ox={round(v[1], 2)} oy={round(v[2], 2)}  ({v[3]})')
        if a.fit:
            k, ox, oy, r = fit([tuple(float(v) for v in s.split(',')) for s in a.fit])
            print(f'--cal {k},{ox},{oy}   (worst residual {r} px)')
    elif a.cmd == 'js': print(NM_JS)
    else: {'names': cmd_names, 'connections': cmd_connections, 'walls': cmd_walls, 'doors': cmd_doors}[a.cmd](a)


if __name__ == '__main__':
    main()
