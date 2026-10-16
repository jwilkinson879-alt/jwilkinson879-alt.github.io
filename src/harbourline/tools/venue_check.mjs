#!/usr/bin/env node
// Sanity-check a venue brief before it goes into a twin, an MVF or Maker.
//
//   node tools/venue_check.mjs venues/airport/venue.json [--entry SPACE-ID] [--json]
//
// Checks
//   structure     required fields, unique ids, every space/spine/connector on a known level
//   attachment    every destination space reaches a walk spine on its level and side (else the router skips it)
//   reachability  from the public entry (largest public space on the ground level, or --entry): spaces the
//                 public can't get to, spaces staff can't get to either, and one-way traps (in but no way back)
//   step-free     destinations reachable on foot but not without stairs and escalators
//   connectors    stops that land far from any spine (the router snaps them to the nearest point)
// Exit code 1 if anything is broken; warnings alone exit 0.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildGraph, route } = require(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'engine', 'graph.js'));

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('usage: node tools/venue_check.mjs <venue.json> [--entry SPACE-ID] [--json]'); process.exit(2); }
const V = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [], warnings = [], info = {};
const err = m => errors.push(m), warn = m => warnings.push(m);

// ---- structure ----
for (const k of ['id', 'name', 'levels', 'spaces', 'spines', 'connectors']) if (!(k in V)) err(`missing top-level field "${k}"`);
const LV = new Set((V.levels || []).map(l => l.id));
const ids = new Map();
for (const s of V.spaces || []) {
  for (const k of ['id', 'name', 'lv', 'x', 'y', 'w', 'h', 'kind']) if (s[k] === undefined) err(`space ${s.id || '?'} missing "${k}"`);
  if (ids.has(s.id)) err(`duplicate space id ${s.id}`); ids.set(s.id, s);
  if (!LV.has(s.lv)) err(`space ${s.id} on unknown level ${s.lv}`);
  if (s.w <= 0 || s.h <= 0) err(`space ${s.id} has non-positive size`);
}
(V.spines || []).forEach((sp, i) => { if (!LV.has(sp.lv)) err(`spine ${i} on unknown level ${sp.lv}`); if (!sp.pts || sp.pts.length < 2) err(`spine ${i} needs 2+ points`); });
const cids = new Set();
for (const c of V.connectors || []) {
  if (cids.has(c.id)) err(`duplicate connector id ${c.id}`); cids.add(c.id);
  (c.stops || []).forEach((st, i) => { if (!LV.has(st.lv)) err(`connector ${c.id} stop ${i} on unknown level ${st.lv}`); });
  if ((c.stops || []).length < 2) err(`connector ${c.id} needs 2+ stops`);
}
for (const a of V.assets || []) if (a.space && !ids.has(a.space)) warn(`asset ${a.id} points at unknown space ${a.space}`);
if (errors.length) report();

// ---- graph ----
const G = buildGraph(V);
info.nodes = G.nodes.length; info.connectorLinks = G.connEdges.length;
const dests = V.spaces.filter(s => !['object', 'core', 'track'].includes(s.kind));
const unattached = dests.filter(s => G.spaceNode[s.id] == null);
unattached.forEach(s => err(`${s.id} (${s.name}) has no walk spine on ${s.lv}/${s.side}`));

// connector stops far from a spine
const segs = V.spines.flatMap(sp => sp.pts.slice(0, -1).map((p, i) => ({ lv: sp.lv, side: sp.side, a: p, b: sp.pts[i + 1] })));
const dist = (sg, x, y) => { const dx = sg.b[0] - sg.a[0], dy = sg.b[1] - sg.a[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - sg.a[0]) * dx + (y - sg.a[1]) * dy) / L2)); return Math.hypot(x - sg.a[0] - t * dx, y - sg.a[1] - t * dy); };
for (const c of V.connectors) c.stops.forEach((st, i) => {
  const d = Math.min(...segs.filter(sg => sg.lv === st.lv && sg.side === st.side).map(sg => dist(sg, st.x, st.y)), Infinity);
  if (d === Infinity) err(`connector ${c.id} stop ${i} has no spine on ${st.lv}/${st.side}`);
  else if (d > 12) warn(`connector ${c.id} stop ${i} is ${d.toFixed(1)} m from the nearest spine on ${st.lv}/${st.side}`);
});

// ---- reachability ----
const ground = V.levels.reduce((b, l) => Math.abs(l.elev) < Math.abs(b.elev) ? l : b, V.levels[0]);
const PUBLIC = ['pub', 'land', 'out'];
const ei = args.indexOf('--entry');
const entry = ei > 0 ? ids.get(args[ei + 1])
  : dests.filter(s => G.spaceNode[s.id] != null && PUBLIC.includes(s.side)).sort((a, b) => (b.lv === ground.id) - (a.lv === ground.id) || (b.cap || 0) - (a.cap || 0))[0];
if (!entry) err('no public entry space found (pass --entry SPACE-ID)');
else {
  info.entry = `${entry.id} (${entry.name})`;
  const from = G.spaceNode[entry.id];
  const sweep = (opts, back) => {   // Dijkstra over the whole graph from/to the entry
    const N = G.nodes.length, d = new Float64Array(N).fill(Infinity); d[from] = 0; const q = [[0, from]];
    const rev = back ? G.adj.map(() => []) : null;
    if (back) G.adj.forEach((es, u) => es.forEach(e => rev[e.to].push({ ...e, to: u })));
    while (q.length) { q.sort((a, b) => a[0] - b[0]); const [du, u] = q.shift(); if (du > d[u]) continue;
      for (const e of (back ? rev : G.adj)[u]) { if (opts.accessible && e.type && !e.acc) continue; if (e.staff && !opts.staff) continue;
        const nd = du + e.cost; if (nd < d[e.to]) { d[e.to] = nd; q.push([nd, e.to]); } } }
    return d; };
  const pub = sweep({}), staff = sweep({ staff: true }), acc = sweep({ accessible: true }), back = sweep({ staff: true }, true);
  const att = dests.filter(s => G.spaceNode[s.id] != null);
  const noStaff = att.filter(s => staff[G.spaceNode[s.id]] === Infinity);
  const staffOnly = att.filter(s => staff[G.spaceNode[s.id]] < Infinity && pub[G.spaceNode[s.id]] === Infinity);
  const noStepFree = att.filter(s => pub[G.spaceNode[s.id]] < Infinity && acc[G.spaceNode[s.id]] === Infinity && !['boh', 'plant', 'ops'].includes(s.cat));
  const traps = att.filter(s => staff[G.spaceNode[s.id]] < Infinity && back[G.spaceNode[s.id]] === Infinity);
  noStaff.forEach(s => err(`${s.id} (${s.name}) is unreachable from ${entry.id}, even for staff`));
  traps.forEach(s => err(`${s.id} (${s.name}) can be entered but has no way back to ${entry.id} (one-way trap)`));
  noStepFree.forEach(s => warn(`${s.id} (${s.name}) has no step-free route from ${entry.id}`));
  info.destinations = att.length; info.unreachable = noStaff.length; info.staffOnly = staffOnly.length;
  info.noStepFree = noStepFree.length; info.oneWayTraps = traps.length;
  const sample = att.filter(s => s.lv !== entry.lv && pub[G.spaceNode[s.id]] < Infinity).sort((a, b) => (b.cap || 0) - (a.cap || 0))[0];
  if (sample) { const r = route(G, from, G.spaceNode[sample.id], { accessible: true }); info.sampleRoute = r ? `${entry.id} -> ${sample.id} step-free via ${r.vias.join(', ') || 'walkways'}` : `${entry.id} -> ${sample.id}: no step-free route`; }
}
report();

function report() {
  const counts = V.spaces ? Object.fromEntries(Object.entries(V.spaces.reduce((o, s) => (o[s.kind] = (o[s.kind] || 0) + 1, o), {})).sort()) : {};
  const out = { venue: `${V.id} ${V.name}`, levels: (V.levels || []).length, spaces: (V.spaces || []).length, kinds: counts, connectors: (V.connectors || []).length, assets: (V.assets || []).length, ...info, errors, warnings };
  if (args.includes('--json')) console.log(JSON.stringify(out, null, 1));
  else {
    console.log(`${out.venue}: ${out.levels} levels, ${out.spaces} spaces, ${out.connectors} connectors, ${out.assets} assets, ${info.nodes ?? '?'} walk nodes`);
    if (info.entry) console.log(`  from ${info.entry}: ${info.destinations} destinations, ${info.unreachable} unreachable, ${info.staffOnly} staff-only, ${info.noStepFree} without step-free access, ${info.oneWayTraps} one-way traps`);
    if (info.sampleRoute) console.log(`  ${info.sampleRoute}`);
    errors.forEach(e => console.log('  ERROR   ' + e));
    warnings.slice(0, 40).forEach(w => console.log('  warning ' + w));
    if (warnings.length > 40) console.log(`  ... ${warnings.length - 40} more warnings (use --json)`);
    console.log(errors.length ? `  ${errors.length} error(s)` : '  OK');
  }
  process.exit(errors.length ? 1 : 0);
}
