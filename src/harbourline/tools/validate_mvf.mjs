#!/usr/bin/env node
// Validate an MVF bundle with Mappedin's own checker (schema + referential integrity).
//
//   npm i @mappedin/mvf-v2            # once, anywhere on the module path
//   node tools/validate_mvf.mjs mappedin/hli.mvf.json [more.mvf.json ...]
import fs from 'node:fs';

let mvf;
try { mvf = await import('@mappedin/mvf-v2'); }
catch { console.error('Install the validator first: npm i @mappedin/mvf-v2'); process.exit(2); }
let bad = 0;
for (const file of process.argv.slice(2)) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = mvf.getMvfValidationErrors(m);
  let integrity = false, why = '';
  try { integrity = mvf.verifyMvfIntegrity(m); } catch (e) { why = e.message; }
  console.log(`${file}: ${errors.length} schema errors, integrity ${integrity}${why ? ' (' + why + ')' : ''}`);
  errors.slice(0, 10).forEach(e => console.log('   ' + e));
  bad += errors.length || !integrity ? 1 : 0;
}
process.exit(bad ? 1 : 0);
