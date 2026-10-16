#!/usr/bin/env python3
"""MVF bundle -> one DXF per floor (metres) for uploading into Mappedin Maker.

    python3 tools/mvf_to_dxf.py mappedin/hli.mvf.json maker/airport --prefix HLI            # v2 layers (default)
    python3 tools/mvf_to_dxf.py mappedin/hsc.mvf.json maker/science --prefix HSC --style v1

Maker can't import MVF, so floors go in as CAD. Every floor of a venue is drawn in one shared frame (the venue's
bounding box plus a margin, marked on layer A-REF in v2) so Maker's alignment step can't rescale floors.
Plan x runs east and plan y south; DXF y is flipped so the drawing reads the right way up.

Styles
  v2 (default; airport and stadium uploads): A-WALL room walls with real door gaps, A-WALL-EXT exterior outline
     (union of every space on the floor), A-DOOR door leaf + 90 degree swing, A-TEXT room names (cores prefixed
     LIFT/ESC/STAIR; pass --venue for the core categories), A-REF corner marks. Corridors and open halls get no outline, so Maker keeps them as one
     walkable space. Run Maker's AI mapping with Walls and Doors ticked and Windows unticked.
  v1 (science centre upload): ROOMS every space outline, WALLS walls + exterior, DOORS a line across each gap,
     OBJECTS exhibit footprints, LABELS room names.

Needs: pip install ezdxf shapely   (shapely only for the v2 exterior outline; without it the floor box is used)
"""
import argparse, json, math, os, re, sys

import ezdxf

try:
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
except ImportError:      # pragma: no cover
    Polygon = None

PREFIX = {'elevator': 'LIFT', 'escalator': 'ESC', 'stairs': 'STAIR', 'ramp': 'STAIR'}


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('mvf'); ap.add_argument('outdir')
    ap.add_argument('--prefix', help='file prefix, e.g. HLI (default: floor stack externalId)')
    ap.add_argument('--style', choices=['v1', 'v2'], default='v2')
    ap.add_argument('--margin', type=float, default=15.0, help='frame margin in metres (v2)')
    ap.add_argument('--venue', help='venue.json: core labels, plus doors wherever a walk spine crosses a wall (recommended)')
    ap.add_argument('--wall-halls', action='store_true', help='v2: also wall open halls (check-in, reclaim, concourses) with doors at every spine crossing, so Maker AI picks them up as rooms')
    a = ap.parse_args()

    m = load(a.mvf)
    stack = m['floorstack.json'][0]
    prefix = a.prefix or stack['externalId']
    floors = {f['properties']['id']: f['properties'] for f in m['floor.geojson']['features']}

    # metres from lon/lat, using the bundle's own top-left as origin (shared by every floor)
    lons = [p[0] for f in m['floor.geojson']['features'] for p in f['geometry']['coordinates'][0]]
    lats = [p[1] for f in m['floor.geojson']['features'] for p in f['geometry']['coordinates'][0]]
    lon0, lat0 = min(lons), max(lats)
    kx = 1 / (111320 * math.cos(math.radians(lat0))); ky = 1 / 111320
    def xy(p):   # -> DXF coords (x east, y north = -plan y), rounded to the millimetre
        return (round((p[0] - lon0) / kx, 3), round(-(lat0 - p[1]) / ky, 3))

    V = load(a.venue) if a.venue else None
    venue = {s['id']: s for s in V['spaces']} if V else {}
    conn_type = {}
    for c in m['connection.json']:
        conn_type[c['externalId']] = c['type']
    core_prefix = lambda sid: {'lift': 'LIFT', 'esc': 'ESC', 'stairs': 'STAIR'}.get((venue.get(sid) or {}).get('cat'))

    # shared frame (v2)
    allx, ally = [], []
    for fid in floors:
        for f in m['space'].get(fid, {}).get('features', []):
            for p in f['geometry']['coordinates'][0]:
                x, y = xy(p); allx.append(x); ally.append(y)
    fx0, fx1, fy0, fy1 = min(allx) - a.margin, max(allx) + a.margin, min(ally) - a.margin, max(ally) + a.margin

    os.makedirs(a.outdir, exist_ok=True)
    loc_name = {l['externalId']: l['name'] for l in m['location.json']}
    centers = {}
    for fid, fc in m['space'].items():
        for f in fc['features']:
            centers[f['properties']['id']] = xy(f['properties']['center'])

    # plan metres -> DXF coords (needed for spine crossings); calibrated on one unrotated rectangle
    off = None
    if V:
        for s in V['spaces']:
            if not s.get('rot') and s.get('shape') != 'ellipse' and ('s_' + s['id']) in centers:
                c = centers['s_' + s['id']]; off = (c[0] - (s['x'] + s['w'] / 2), c[1] + (s['y'] + s['h'] / 2)); break
    plan2dxf = (lambda x, y: (x + off[0], -y + off[1])) if off else None
    def crossings(ring, lv):
        if not plan2dxf: return []
        out = []
        for sp in V['spines']:
            if sp['lv'] != lv: continue
            pts = [plan2dxf(*pt) for pt in sp['pts']]
            for a_, b_ in zip(pts, pts[1:]):
                for i, p in enumerate(ring):
                    q = ring[(i + 1) % len(ring)]
                    d1x, d1y, d2x, d2y = q[0] - p[0], q[1] - p[1], b_[0] - a_[0], b_[1] - a_[1]
                    den = d1x * d2y - d1y * d2x
                    if abs(den) < 1e-9: continue
                    tt = ((a_[0] - p[0]) * d2y - (a_[1] - p[1]) * d2x) / den; uu = ((a_[0] - p[0]) * d1y - (a_[1] - p[1]) * d1x) / den
                    if 0 <= tt <= 1 and 0 <= uu <= 1: out.append((i, tt))
        return out

    for fid in stack['floors']:
        fl = floors[fid]
        doc = ezdxf.new('R2010', setup=True); doc.units = ezdxf.units.M
        doc.header['$INSUNITS'] = 6; doc.header['$MEASUREMENT'] = 1
        L = (dict(WALL='A-WALL', EXT='A-WALL-EXT', DOOR='A-DOOR', TEXT='A-TEXT', REF='A-REF') if a.style == 'v2'
             else dict(ROOM='ROOMS', WALL='WALLS', EXT='WALLS', DOOR='DOORS', OBJ='OBJECTS', TEXT='LABELS'))
        colors = {'A-WALL': 7, 'A-WALL-EXT': 7, 'A-DOOR': 3, 'A-TEXT': 8, 'A-REF': 1, 'ROOMS': 8, 'WALLS': 7, 'DOORS': 3, 'OBJECTS': 5, 'LABELS': 2}
        for name in set(L.values()):
            doc.layers.add(name, color=colors.get(name, 7))
        msp = doc.modelspace()
        spaces = m['space'].get(fid, {}).get('features', [])
        obst = m['obstruction'].get(fid, {}).get('features', [])
        ents = {e['properties']['id']: e for e in m['entrance'].get(fid, {}).get('features', [])}
        walled = {w['properties']['id'].rsplit('_w', 1)[0][2:] for w in obst if w['properties']['kind'] == 'wall'}
        w_width = 0.2 if a.style == 'v2' else 0.25

        # walls (and exterior)
        for o in obst:
            k = o['properties']['kind']
            if k == 'wall':
                msp.add_lwpolyline([xy(p) for p in o['geometry']['coordinates']], dxfattribs={'layer': L['WALL'], 'const_width': w_width})
            elif k == 'exterior-wall' and a.style == 'v1':
                msp.add_lwpolyline([xy(p) for p in o['geometry']['coordinates']], dxfattribs={'layer': L['EXT'], 'const_width': w_width})
            elif k == 'object' and a.style == 'v1':
                msp.add_lwpolyline([xy(p) for p in o['geometry']['coordinates'][0]], close=True, dxfattribs={'layer': L['OBJ']})
        if a.style == 'v2':
            rings = []
            if Polygon is not None:
                shape = unary_union([Polygon([xy(p) for p in s['geometry']['coordinates'][0]]).buffer(0.05, join_style=2) for s in spaces]).buffer(-0.05, join_style=2)
                parts = getattr(shape, 'geoms', [shape])
                rings = [list(p.exterior.simplify(0.05).coords) for p in parts if not p.is_empty]
            else:
                b = [xy(p) for p in [q for s in spaces for q in s['geometry']['coordinates'][0]]]
                xs, ys = [p[0] for p in b], [p[1] for p in b]
                rings = [[(min(xs), min(ys)), (max(xs), min(ys)), (max(xs), max(ys)), (min(xs), max(ys))]]
            for r in rings:
                msp.add_lwpolyline([(round(x, 3), round(y, 3)) for x, y in r], close=True, dxfattribs={'layer': L['EXT'], 'const_width': 0.3})
            for cx, cy in [(fx0, fy0), (fx1, fy0), (fx1, fy1), (fx0, fy1)]:   # frame corner crosses
                msp.add_line((cx - 1, cy), (cx + 1, cy), dxfattribs={'layer': L['REF']})
                msp.add_line((cx, cy - 1), (cx, cy + 1), dxfattribs={'layer': L['REF']})

        # v2: Maker only makes a room where it finds walls, so every room-kind space without walls in the MVF
        # (seating bays, gate lounges, cores, domes) gets a wall ring here, with one door facing its walk node
        if a.style == 'v2':
            nodes_here = [(n['properties']['id'], xy(n['geometry']['coordinates'])) for n in m['node.geojson']['features'] if n['properties']['floor'] == fid]
            node_xy = dict(nodes_here)
            for s in spaces:
                sid = s['properties']['externalId']
                hall = a.wall_halls and venue.get(sid, {}).get('kind') == 'hall'
                if sid in walled or not (s['properties']['kind'] == 'room' or hall): continue
                ring = [xy(p) for p in s['geometry']['coordinates'][0]][:-1]
                gaps = crossings(ring, fl['externalId'])
                if not gaps:
                    dn = s['properties']['destinationNodes']; c = centers['s_' + sid]
                    tgt = node_xy.get(dn[0]) if dn else (min(nodes_here, key=lambda n: math.hypot(n[1][0] - c[0], n[1][1] - c[1]))[1] if nodes_here else None)
                    if tgt is None:
                        msp.add_lwpolyline(ring, close=True, dxfattribs={'layer': L['WALL'], 'const_width': w_width}); walled.add(sid); continue
                    best = None
                    for i, p in enumerate(ring):
                        q = ring[(i + 1) % len(ring)]; dx, dy = q[0] - p[0], q[1] - p[1]; L2 = dx * dx + dy * dy or 1
                        tt = max(0, min(1, ((tgt[0] - p[0]) * dx + (tgt[1] - p[1]) * dy) / L2))
                        d = math.hypot(tgt[0] - p[0] - tt * dx, tgt[1] - p[1] - tt * dy)
                        if best is None or d < best[0]: best = (d, i, tt)
                    gaps = [(best[1], best[2])]
                doors = []
                for i, tt in sorted(gaps):
                    p, q = ring[i], ring[(i + 1) % len(ring)]; ln = math.hypot(q[0] - p[0], q[1] - p[1]) or 1
                    half = min(1.8, ln * 0.6) / 2 / ln; tt = max(half, min(1 - half, tt))
                    if any(j == i and abs((u0 + u1) / 2 - tt) * ln < 2.0 for j, u0, u1 in doors): continue
                    doors.append((i, tt - half, tt + half))
                at = lambda i, u: (round(ring[i][0] + (ring[(i + 1) % len(ring)][0] - ring[i][0]) * u, 3), round(ring[i][1] + (ring[(i + 1) % len(ring)][1] - ring[i][1]) * u, 3))
                for k, (i, u0, u1) in enumerate(doors):
                    j, v0, v1 = doors[(k + 1) % len(doors)]
                    chain = [at(i, u1)]
                    if not (j == i and v0 > u1 and len(doors) > 1):
                        e = i
                        while True:
                            e = (e + 1) % len(ring); chain.append(ring[e])
                            if e == j: break
                    chain.append(at(j, v0))
                    msp.add_lwpolyline(chain, dxfattribs={'layer': L['WALL'], 'const_width': w_width})
                    ents[f"e_{sid}_x{k}"] = {'_xy': (at(i, u0), at(i, u1))}
                walled.add(sid)

        # room outlines (v1 only: every space)
        if a.style == 'v1':
            for s in spaces:
                msp.add_lwpolyline([xy(p) for p in s['geometry']['coordinates'][0]], close=True, dxfattribs={'layer': L['ROOM']})

        # doors
        for eid, e in ents.items():
            p0, p1 = e['_xy'] if '_xy' in e else (xy(p) for p in e['geometry']['coordinates'])
            if a.style == 'v1':
                msp.add_line(p0, p1, dxfattribs={'layer': L['DOOR']}); continue
            sid = 's_' + re.sub(r'_[dx]\d+$', '', eid[2:])
            c = centers.get(sid, p0)
            dx, dy = p1[0] - p0[0], p1[1] - p0[1]; w = math.hypot(dx, dy) or 1
            nx, ny = -dy / w, dx / w                      # a normal to the opening
            if (c[0] - p0[0]) * nx + (c[1] - p0[1]) * ny < 0: nx, ny = -nx, -ny   # point it into the room
            leaf = (round(p0[0] + nx * w, 3), round(p0[1] + ny * w, 3))
            msp.add_line(p0, leaf, dxfattribs={'layer': L['DOOR']})
            a_leaf = math.degrees(math.atan2(ny, nx)); a_open = math.degrees(math.atan2(dy, dx))
            # DXF arcs run counter-clockwise; sweep the quarter circle between the open leaf and the opening
            start, end = (a_leaf, a_open) if abs((a_open - a_leaf) % 360 - 90) < 1 else (a_open, a_leaf)
            msp.add_arc(p0, w, start % 360, end % 360, dxfattribs={'layer': L['DOOR']})

        # labels
        for s in spaces:
            sid = s['properties']['externalId']; name = loc_name.get(sid) or (venue.get(sid) or {}).get('name')
            is_core = not s['properties']['destinationNodes'] and (venue.get(sid, {}).get('kind') == 'core' if venue else sid not in loc_name)
            is_room = s['properties']['kind'] == 'room' and not is_core
            if a.style == 'v1':
                if not is_room or not name: continue
                text, h = name, 0.9
            else:
                if is_core:
                    nm = (venue.get(sid) or {}).get('name') or sid
                    text, h = f"{core_prefix(sid) or 'CORE'} · {nm}", 1.6
                elif (is_room or sid in walled) and name:
                    text, h = name, 1.6
                else:
                    continue
            cx, cy = centers['s_' + sid]
            t = msp.add_text(text, dxfattribs={'layer': L['TEXT'], 'height': h})
            t.set_placement((cx, cy), align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)

        out = os.path.join(a.outdir, f"{prefix}-{fl['externalId']}.dxf")
        doc.saveas(out)
        counts = {}
        for e in msp:
            counts[e.dxf.layer] = counts.get(e.dxf.layer, 0) + 1
        print(os.path.basename(out), ' '.join(f'{k}:{v}' for k, v in sorted(counts.items())))


if __name__ == '__main__':
    main()
