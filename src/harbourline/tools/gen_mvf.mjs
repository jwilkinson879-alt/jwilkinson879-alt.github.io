#!/usr/bin/env node
// Venue brief (venue.json) -> Mappedin MVF v2 bundle, ready for hydrateMapData() + show3dMap().
//
//   node tools/gen_mvf.mjs venues/airport/venue.json mappedin/hli.mvf.json [--origin lon,lat] [--legacy-stops]
//
// What goes in, and where it comes from:
//   floors       one per level; footprint = bounding box of the level's spaces; elevation counted from the ground level
//   spaces       every space except exhibit-style objects; rectangles, rotated rectangles (rot, radians) and ellipses
//   walls        rooms (and galleries) get a wall ring with 1.8 m door gaps wherever a walk spine crosses the
//                boundary; a room no spine enters gets one door at the point nearest its destination node
//   objects      kind:'object' spaces become object obstructions
//   nodes        the walk network from engine/graph.js, so SDK directions match the three.js twin's router;
//                weights are metres (walk cost x 1.3), staff-only links weigh 900 so public routes avoid them
//   connections  connectors whose stops span floors (lift, esc, stairs); same-floor connectors (gates, screening,
//                APM, staff doors) become directed node links, so one-way checkpoints stay one-way
//   locations    one per space, object and connection, named from the brief
//   styles       colour and height per space category
// Plan units are metres with x east and y south, placed on the globe with a local equirectangular projection.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { buildGraph } = require(path.join(here, '..', 'engine', 'graph.js'));

// Default geographic origins (top-left corner of the plan), matching the Maker copies of each venue.
const ORIGINS = {
  HSC: [151.2015, -33.8675],      // Darling Harbour, Sydney
  HLS: [151.2215, -33.8880],      // Moore Park, Sydney
  HLI: [151.1720, -33.9330],      // Mascot, Sydney
};

const STYLE = {   // group -> [colour, height]; key order is the order styles are written
  'Galleries': ['#B8C9EA', 0.2], 'Exhibitions': ['#D4C2EE', 0.2], 'Retail': ['#EAD5B7', 0.2],
  'Food & drink': ['#F0C9A8', 0.2], 'Washrooms': ['#C9E2D6', 0.2], 'Visitor services': ['#D8E6F2', 0.2],
  'Offices': ['#D9DEE6', 0.2], 'Back of house': ['#CDD3DC', 0.2], 'Plant': ['#BCC4CF', 0.2],
  'Operations': ['#C5D0E0', 0.2], 'Gates': ['#BFD7EA', 0.2], 'Security & border': ['#E6C9C9', 0.2],
  'Check-in': ['#D2E3F0', 0.2], 'Baggage': ['#D6D0C4', 0.2], 'Transport': ['#C8D5C8', 0.15],
  'Lounges & suites': ['#DCCFE8', 0.2], 'Seating': ['#C4CFE0', 0.4], 'Field': ['#B9D9B4', 0.05],
  'Public halls': ['#EEF2F7', 0.15], 'Hallways': ['#F4F6F9', 0.1], 'Cores': ['#9FB0C6', 3],
  'Walls': ['#6E7D93', 3.2], 'Exhibits': ['#7F93B0', 1.3], 'Fixtures': ['#8F9CB0', 1.1],
};
function styleGroup(s, walled) {
  if (s.kind === 'core') return 'Cores';
  if (s.kind === 'corridor' || s.cat === 'circulation') return 'Hallways';
  if (s.kind === 'tier' || s.cat === 'seating') return 'Seating';
  if (s.kind === 'field' || s.cat === 'field') return 'Field';
  if (s.kind === 'track') return 'Transport';
  const c = s.cat;
  if (c === 'gallery') return 'Galleries';
  if (c === 'exhibit') return 'Exhibitions';
  if (c === 'retail' || c === 'merch') return 'Retail';
  if (c === 'fnb') return 'Food & drink';
  if (c === 'washroom' || c === 'medical') return 'Washrooms';
  if (c === 'office') return 'Offices';
  if (c === 'boh') return 'Back of house';
  if (c === 'plant') return 'Plant';
  if (c === 'ops' || c === 'media') return 'Operations';
  if (c === 'gate') return 'Gates';
  if (c === 'security' || c === 'border') return 'Security & border';
  if (c === 'checkin') return 'Check-in';
  if (c === 'baggage' || c === 'belt') return 'Baggage';
  if (c === 'transport' || c === 'apm') return 'Transport';
  if (c === 'lounge' || c === 'suite' || c === 'members') return 'Lounges & suites';
  if (c === 'plaza' || c === 'landside') return 'Public halls';
  return walled ? 'Visitor services' : 'Public halls';
}
const CONN_TYPE = { lift: 'elevator', esc: 'escalator', stairs: 'stairs', ramp: 'ramp' };
const DOOR_W = 1.8, STAFF_WEIGHT = 900, WALK = 1.3;
const r1 = v => Math.round(v * 10) / 10;
const r8 = v => Math.round(v * 1e8) / 1e8;

// ---------------- geometry in plan metres ----------------
function outline(s) {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  let pts;
  if (s.shape === 'ellipse') {
    pts = [];
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; pts.push([cx + Math.cos(a) * s.w / 2, cy + Math.sin(a) * s.h / 2]); }
  } else {
    pts = [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]];
  }
  if (s.rot) {
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    pts = pts.map(([x, y]) => { const dx = x - cx, dy = y - cy; return [cx + dx * c - dy * sn, cy + dx * sn + dy * c]; });
  }
  return pts;   // open ring, clockwise in plan (y south)
}
function segX(p, q, a, b) {   // intersection of segment p-q with a-b -> {t (along p-q), u (along a-b)} or null
  const d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = b[0] - a[0], d2y = b[1] - a[1];
  const den = d1x * d2y - d1y * d2x; if (Math.abs(den) < 1e-9) return null;
  const t = ((a[0] - p[0]) * d2y - (a[1] - p[1]) * d2x) / den, u = ((a[0] - p[0]) * d1y - (a[1] - p[1]) * d1x) / den;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? { t, u } : null;
}
function nearestOnRing(ring, pt) {
  let best = null;
  ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; const dx = q[0] - p[0], dy = q[1] - p[1], L2 = dx * dx + dy * dy;
    let t = L2 ? ((pt[0] - p[0]) * dx + (pt[1] - p[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(pt[0] - p[0] - t * dx, pt[1] - p[1] - t * dy); if (!best || d < best.d) best = { i, t, d }; });
  return best;
}

const isWalled = s => s.shape !== 'ellipse' && s.cat !== 'circulation' && (s.kind === 'room' || (s.kind === 'hall' && s.cat === 'gallery'));

export function generate(V, opts = {}) {
  const [LON0, LAT0] = opts.origin || ORIGINS[V.id] || [151.2, -33.87];
  const KX = 1 / (111320 * Math.cos(LAT0 * Math.PI / 180)), KY = 1 / 111320;
  const ll = ([x, y]) => [r8(LON0 + x * KX), r8(LAT0 - y * KY)];
  const G = buildGraph(V);
  const ground = V.levels.reduce((b, l) => Math.abs(l.elev) < Math.abs(b.elev) ? l : b, V.levels[0]);
  const gi = V.levels.indexOf(ground);
  const F = lv => 'f_' + lv;

  // ---- nodes (walk network) ----
  const nodeFeat = G.nodes.map(n => ({ type: 'Feature', geometry: { type: 'Point', coordinates: ll([n.x, n.y]) },
    properties: { id: 'n_' + n.id, externalId: 'g' + n.id, floor: F(n.lv), map: F(n.lv), space: [], neighbors: [] } }));
  G.adj.forEach((edges, u) => edges.forEach(e => nodeFeat[u].properties.neighbors.push({ id: 'n_' + e.to, weight: e.staff ? STAFF_WEIGHT : r1(e.cost * WALK), _via: e.type ? e.via : null })));
  const spinesOn = lv => V.spines.filter(s => s.lv === lv).flatMap(s => s.pts.slice(0, -1).map((p, i) => [p, s.pts[i + 1]]));
  const crossings = s => { const ring = outline(s), out = [];
    for (const [a, b] of spinesOn(s.lv)) ring.forEach((p, i) => { const x = segX(p, ring[(i + 1) % ring.length], a, b); if (x) out.push({ i, t: x.t }); });
    return out; };
  const dest = {}, doorAt = {};
  for (const s of V.spaces) {
    if (s.kind === 'object' || s.kind === 'core' || s.kind === 'track') continue;
    const gn = G.spaceNode[s.id];
    if (gn != null && !(isWalled(s) && !crossings(s).length)) { dest[s.id] = 'n_' + gn; continue; }
    // a walled room no spine enters, or a space with no spine on its level and side: hang a node at its centre
    // and tie it to the corridor node (or the nearest node on the level), so routes finish inside the room
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2; let best = null;
    if (gn != null) best = { n: G.nodes[gn], d: Math.hypot(G.nodes[gn].x - cx, G.nodes[gn].y - cy) };
    else for (const n of G.nodes) if (n.lv === s.lv) { const d = Math.hypot(n.x - cx, n.y - cy); if (!best || d < best.d) best = { n, d }; }
    if (!best) continue;
    const id = nodeFeat.length, w = r1(best.d);
    nodeFeat.push({ type: 'Feature', geometry: { type: 'Point', coordinates: ll([cx, cy]) },
      properties: { id: 'n_' + id, externalId: 'x' + id, floor: F(s.lv), map: F(s.lv), space: ['s_' + s.id], neighbors: [{ id: 'n_' + best.n.id, weight: w }] } });
    nodeFeat[best.n.id].properties.neighbors.push({ id: 'n_' + id, weight: w });
    dest[s.id] = 'n_' + id; doorAt[s.id] = [best.n.x, best.n.y];
  }

  // ---- spaces, walls, doors, objects ----
  const space = {}, obstruction = {}, entrance = {}, styles = {}, locations = [];
  const fc = () => ({ type: 'FeatureCollection', features: [] });
  V.levels.forEach(l => { space[F(l.id)] = fc(); obstruction[F(l.id)] = fc(); entrance[F(l.id)] = fc(); });
  const addStyle = (group, key, id) => { const [color, height] = STYLE[group];
    const st = styles[group] || (styles[group] = key === 'lineStrings' ? { lineStrings: [], color, height, altitude: 0, width: 0.25, opacity: 1 } : { polygons: [], color, height, altitude: 0, opacity: 1 });
    st[key].push(id); };
  const bbox = {};
  const grow = (lv, pts) => { const b = bbox[lv] || (bbox[lv] = [Infinity, Infinity, -Infinity, -Infinity]);
    for (const [x, y] of pts) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); } };

  for (const s of V.spaces) {
    const ring = outline(s); grow(s.lv, ring);
    const poly = [[...ring, ring[0]].map(ll)];
    const loc = { obstructions: [], entrances: [], connections: [], annotations: [], areas: [], categories: [], links: [], pictures: [], social: [], openingHoursSpecification: [],
      id: 'loc_' + s.id, name: s.name, externalId: s.id, spaces: [], description: '' };
    if (s.kind === 'object') {
      obstruction[F(s.lv)].features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly }, properties: { id: 'o_' + s.id, externalId: s.id, kind: 'object', entrances: [] } });
      addStyle(s.cat === 'exhibit' ? 'Exhibits' : 'Fixtures', 'polygons', 'o_' + s.id);
      loc.obstructions.push({ floor: F(s.lv), id: 'o_' + s.id }); loc.description = s.cat === 'exhibit' ? 'Interactive exhibit' : (s.zone || '');
      locations.push(loc); continue;
    }
    const walled = isWalled(s);
    const kind = (s.kind === 'corridor' || (s.kind === 'hall' && !walled) || s.cat === 'circulation') ? 'hallway' : 'room';
    const cxy = s.shape === 'ellipse' || !s.rot ? [s.x + s.w / 2, s.y + s.h / 2] : ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
    space[F(s.lv)].features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly },
      properties: { id: 's_' + s.id, externalId: s.id, kind, destinationNodes: dest[s.id] ? [dest[s.id]] : [], center: ll(cxy) } });
    addStyle(styleGroup(s, walled), 'polygons', 's_' + s.id);
    if (s.kind !== 'core') { loc.spaces.push({ floor: F(s.lv), id: 's_' + s.id }); loc.description = s.zone || ''; locations.push(loc); }
    if (!walled) continue;

    // door gaps: where walk spines cross the boundary, else nearest the destination node
    const gaps = crossings(s);   // {i (edge), t}
    if (!gaps.length && doorAt[s.id]) { const nb = nearestOnRing(ring, doorAt[s.id]); gaps.push({ i: nb.i, t: nb.t }); }
    const doors = [];
    for (const g of gaps.sort((a, b) => a.i - b.i || a.t - b.t)) {
      const p = ring[g.i], q = ring[(g.i + 1) % ring.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const half = Math.min(DOOR_W, L * 0.6) / 2 / L, mid = Math.max(half, Math.min(1 - half, g.t));
      const d = { i: g.i, t0: mid - half, t1: mid + half };
      if (doors.some(o => o.i === d.i && Math.abs((o.t0 + o.t1) / 2 - mid) * L < DOOR_W + 0.2)) continue;
      doors.push(d);
    }
    const at = (i, t) => { const p = ring[i], q = ring[(i + 1) % ring.length]; return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
    const eids = doors.map((d, k) => { const id = `e_${s.id}_d${k}`;
      entrance[F(s.lv)].features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [ll(at(d.i, d.t0)), ll(at(d.i, d.t1))] }, properties: { id, externalId: id } });
      return id; });
    const chains = [];
    if (!doors.length) chains.push([...ring, ring[0]]);
    else doors.forEach((d, k) => { const nx = doors[(k + 1) % doors.length]; const c = [at(d.i, d.t1)];
      let i = d.i; const sameEdgeAhead = nx.i === d.i && nx.t0 > d.t1 && doors.length > 1;
      if (!sameEdgeAhead) { do { i = (i + 1) % ring.length; c.push(ring[i]); } while (i !== nx.i); }
      c.push(at(nx.i, nx.t0)); chains.push(c); });
    chains.forEach((c, k) => { const id = `o_${s.id}_w${k}`;
      obstruction[F(s.lv)].features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c.map(ll) }, properties: { id, externalId: id, kind: 'wall', entrances: eids } });
      addStyle('Walls', 'lineStrings', id); });
  }

  // ---- floors ----
  const floorFeat = [], mapList = [];
  V.levels.forEach((l, i) => { const b = bbox[l.id] || [0, 0, 1, 1];
    const props = { id: F(l.id), name: `${l.id} · ${l.name}`, shortName: l.id, elevation: i - gi, externalId: l.id, maxHeight: 6 };
    floorFeat.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]].map(ll)] }, properties: props });
    mapList.push({ ...props });
    const id = 'o_ext_' + l.id;
    obstruction[F(l.id)].features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]].map(ll) },
      properties: { id, externalId: id, kind: 'exterior-wall', entrances: [] } });
    addStyle('Walls', 'lineStrings', id); });

  // ---- connections (stops on more than one floor) ----
  const connections = [];
  for (const c of V.connectors) {
    const pairs = G.connEdges.filter(e => e[2] === c.id); if (!pairs.length) continue;
    const ns = []; pairs.forEach(([a, b]) => { if (!ns.includes(a)) ns.push(a); if (!ns.includes(b)) ns.push(b); });
    if (new Set(ns.map(n => G.nodes[n].lv)).size < 2) continue;
    connections.push({ id: 'c_' + c.id, externalId: c.id, type: /ramp/i.test(c.name || '') ? 'ramp' : (CONN_TYPE[c.type] || 'unknown'), accessible: !!c.acc, nodes: ns.map(n => 'n_' + n), details: { name: c.name || c.id } });
    locations.push({ obstructions: [], entrances: [], connections: ['c_' + c.id], annotations: [], areas: [], categories: [], links: [], pictures: [], social: [], openingHoursSpecification: [],
      id: 'loc_c_' + c.id, name: c.name || c.id, externalId: c.id, spaces: [], description: c.staff ? 'Staff only' : '' });
  }

  // Every connection gets its own stop nodes: a 1 m spur off the walkway carrying that connection's cross-floor
  // links. Two reasons: Mappedin skips the nodes of inaccessible connections in step-free routing, so a lift that
  // shares a landing node with an escalator would vanish; and a walk that passes over a connection's landing
  // would otherwise be narrated as "take the escalator". opts.legacyStops keeps landings on the walkway (only
  // splitting shared ones), which reproduces the original science-centre bundle exactly.
  const owner = {};
  for (const c of connections) {
    const M = {};
    for (const n of c.nodes) {
      if (!owner[n] && opts.legacyStops) { owner[n] = c.id; M[n] = n; continue; }
      const src = nodeFeat[+n.slice(2)], id = 'n_' + nodeFeat.length;
      nodeFeat.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [...src.geometry.coordinates] },
        properties: { id, externalId: 'x' + id.slice(2), floor: src.properties.floor, map: src.properties.map, space: [], neighbors: [{ id: n, weight: 1 }] } });
      src.properties.neighbors.push({ id, weight: 1 }); owner[id] = c.id; M[n] = id;
    }
    for (const n of c.nodes) {
      const u = nodeFeat[+n.slice(2)].properties, mine = u.neighbors.filter(e => e._via === c.externalId);
      if (M[n] === n) { mine.forEach(e => { e.id = M[e.id] || e.id; }); continue; }
      u.neighbors = u.neighbors.filter(e => e._via !== c.externalId);
      nodeFeat[+M[n].slice(2)].properties.neighbors.push(...mine.map(e => ({ id: M[e.id] || e.id, weight: e.weight })));
    }
    c.nodes = c.nodes.map(n => M[n]);
  }
  nodeFeat.forEach(f => f.properties.neighbors.forEach(e => { delete e._via; }));

  const all = Object.values(bbox).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const fs_ = { id: 'fs_' + V.id.toLowerCase(), externalId: V.id, name: V.name, maps: V.levels.map(l => F(l.id)), floors: V.levels.map(l => F(l.id)), defaultFloor: F(ground.id) };
  return {
    'manifest.geojson': { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: ll([(all[0] + all[2]) / 2, (all[1] + all[3]) / 2]) },
      properties: { name: V.name, version: '2.0.0', time: opts.time || new Date().toISOString(), language: 'en-GB', folder_struct: [] } }] },
    'floor.geojson': { type: 'FeatureCollection', features: floorFeat },
    space, obstruction, entrance,
    'connection.json': connections,
    'location.json': locations,
    'map.geojson': mapList,
    'mapstack.geojson': [fs_],
    'floorstack.json': [{ ...fs_ }],
    'node.geojson': { type: 'FeatureCollection', features: nodeFeat },
    'styles.json': Object.fromEntries(Object.keys(STYLE).filter(k => styles[k]).map(k => [k, styles[k]])),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [inp, out] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!inp || !out) { console.error('usage: node tools/gen_mvf.mjs <venue.json> <out.mvf.json> [--origin lon,lat] [--legacy-stops]'); process.exit(2); }
  const oi = process.argv.indexOf('--origin');
  const V = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const mvf = generate(V, { origin: oi > 0 ? process.argv[oi + 1].split(',').map(Number) : undefined, legacyStops: process.argv.includes('--legacy-stops') });
  fs.writeFileSync(out, JSON.stringify(mvf) + '\n');
  const n = k => Object.values(mvf[k]).reduce((a, c) => a + c.features.length, 0);
  console.log(`${V.id}: ${mvf['floor.geojson'].features.length} floors, ${n('space')} spaces, ${n('entrance')} doors, ` +
    `${n('obstruction')} obstructions, ${mvf['node.geojson'].features.length} nodes, ${mvf['connection.json'].length} connections, ${mvf['location.json'].length} locations -> ${out}`);
}
