# Venue ops twin source

Source for the operational digital twins: the Harbourline airport, stadium and science centre on a shared engine, the science centre on the Mappedin JS SDK, the Backlot studio-tour prototype, and the KSA portfolio command centre. It was recovered on 16 Oct 2026 from the published pages, after the original working files were lost between sessions.

## Layout

```
src/
  harbourline/
    build.py                  assembles the pages into dist/ (git-ignored)
    engine/
      page.html               shared page markup and styles, with {{placeholders}}
      graph.js                walk-network builder and router: step-free, one-way, avoid lists
      engine.js               3D twin engine; packs splice in at /*@@PACK@@*/
    venues/
      airport/   venue.json  pack.js  page.json
      stadium/   venue.json  pack.js  page.json
      science/   venue.json  pack.js  page.json
                 pack.mappedin.js  page.mappedin.json   (Mappedin SDK variant)
    mappedin/
      renderer.js             replaces the three.js view with Mappedin JS 6.27
      hsc.mvf.json            MVF v2 bundle for the science centre (the published one)
      hli.mvf.json            MVF v2 bundle for the airport (tools/gen_mvf.mjs)
      hls.mvf.json            MVF v2 bundle for the stadium (tools/gen_mvf.mjs)
    tools/
      gen_mvf.mjs             venue.json -> MVF v2 bundle for the Mappedin SDK
      validate_mvf.mjs        checks a bundle with Mappedin's own validator
      mvf_to_dxf.py           MVF -> one DXF per floor for Mappedin Maker (v1 or v2 layers)
      venue_check.mjs         structure, reachability, step-free and one-way checks on a venue.json
      maker/maker.py          Maker browser helpers: calibration, naming, connection, wall and door batches
    maker/
      airport/HLI-*.dxf       v2 floor plans uploaded to Maker (6 floors, metres)
      stadium/HLS-*.dxf       v2 floor plans uploaded to Maker (6 floors, metres)
      science/HSC-*.dxf       floor plans uploaded to Maker (5 floors, metres; WALLS/DOORS/ROOMS/OBJECTS/LABELS)
      README.txt              floor order and layers for each venue
  backlot/
    mappedin-demo-venue.html  Backlot twin on the Mappedin public demo venue
    mockup-3d.html            first three.js mock-up of the Backlot model
  ksa-portfolio/
    command-centre.html       KSA portfolio command centre: national map, six asset twins,
                              integration fabric and agent scenarios (single self-contained page)
  build_public.py             builds the public GitHub Pages site (landing page, pages, llms.txt, sitemap)
```

Each venue has three files. **venue.json** holds the levels, spaces, connectors, assets and walk spines, and is the source of truth for everything else: the twin page, the MVF bundle and the Maker DXFs are all derived from it. **pack.js** holds the scenario beats, layers, KPIs, list tab and the venue-specific keys and metrics. **page.json** holds the header, footer and tab labels.

## Build

```
cd src/harbourline
python3 build.py                  # writes dist/airport.html, stadium.html, science.html, science-mappedin.html
python3 build.py --verify DIR     # also checks each page against DIR/<page>.html
```

The build has no dependencies beyond Python 3. The pages load three.js 0.128 (or Mappedin JS 6.27) and Google Fonts from CDNs at runtime. On 16 Oct 2026 all four rebuilt pages matched the published versions byte for byte. A headless run of the three.js twins stepped through every scenario with no page errors.

## Tools

Requirements: Python 3 with `pip install ezdxf shapely` (DXF only) and Node 18+. `npm i @mappedin/mvf-v2` is needed only for validation.

**Check a venue** before it goes anywhere else. `node tools/venue_check.mjs venues/airport/venue.json` reports structural errors, spaces the router can't attach, spaces the public or staff can't reach from the main entry, one-way traps, destinations without step-free access, and connector stops placed far from a walkway. On 16 Oct the science centre, airport and stadium all passed, with 0 unreachable spaces and full step-free coverage. It flagged two small airport issues: asset APM points at a missing space T-APM, and the ESC-RAIL stop on T sits 14 m off the spine.

**Make an MVF for the Mappedin SDK.** Run `node tools/gen_mvf.mjs venues/airport/venue.json mappedin/hli.mvf.json` and then `node tools/validate_mvf.mjs mappedin/hli.mvf.json`.
- What the generator builds:
  - spaces from the venue rectangles, rotated rectangles and ellipses
  - walls around rooms and galleries, with 1.8 m door gaps wherever a walk spine crosses the boundary
  - exhibit objects
  - the walk-node graph from `engine/graph.js`, so SDK directions follow the same routes as the three.js twin
  - lift, escalator, stair and ramp connections
  - locations and category styles
- It places the bundle at the venue's Sydney site; `--origin lon,lat` moves it.
- Each connection gets its own spur node off the walkway. This keeps step-free routing working where a lift and an escalator land on the same spot, and stops turn-by-turn directions from announcing an escalator the route only walks past.
- `--legacy-stops` keeps the old layout and regenerates `hsc.mvf.json` exactly as published.
- Verified on 16 Oct:
  - All three bundles pass Mappedin's validator with 0 errors and integrity true.
  - In Mappedin JS 6.27 (headless) they render, and cross-floor directions resolve: rail platform to Gate A9 and Gate B12, station to Bay 315, and rideshare to Bay 108.
  - Step-free requests use only lifts and ramps.

**Make DXFs for Maker** with `python3 tools/mvf_to_dxf.py mappedin/hli.mvf.json maker-out/airport --prefix HLI --venue venues/airport/venue.json`.
- `--style v2` (the default) writes the layers below. Every floor shares one frame, so Maker can't rescale floors.
  - A-WALL: walls with real door gaps
  - A-DOOR: door leaf plus swing
  - A-WALL-EXT: exterior outline
  - A-TEXT: room labels
  - A-REF: frame corner marks
- Add `--wall-halls` to wall open halls such as check-in, reclaim and concourses, with a door wherever a walkway crosses them. Maker's AI then traces them as rooms, instead of you redrawing them by hand as on the airport.
- `--style v1` writes the science-centre layers (ROOMS, WALLS, DOORS, OBJECTS, LABELS). Run on hsc.mvf.json, it matches the saved HSC DXFs on every layer count and label.
- Upload one venue per Maker map. Run AI mapping with Walls and Doors ticked and Windows unticked.

**Drive Maker in the browser.** `python3 tools/maker/maker.py --help` lists the commands.
- `cal --fit` fits a venue-to-screen calibration from two or more points you click.
- `names` produces room-naming batches of six for the browser tool, using the `__nm` helper printed by `js`.
- `connections` lists every lift, escalator, stair and ramp with its Maker type, floor span and screen points.
- `walls` produces wall-tool click sequences.
- `doors` gives door-tool clicks at each generated gap.
- The module docstring keeps the Maker gotchas learned on the airport and stadium.

**Build the public site.** `python3 src/build_public.py --out site` writes the following:
- `index.html`, a landing page
- the five pages, with venue links rewritten to point at each other instead of the private artifacts
- description, canonical and social tags on every page, and a disclaimer on the KSA page
- `llms.txt`, `robots.txt`, `sitemap.xml` and `.nojekyll`

Building with `--out .` writes into the repo root, so the next push publishes it on GitHub Pages; enable Pages (main branch, root) in the repo settings first.

## Not recreated

The per-venue generators (gen_airport.py, gen_stadium.py, gen_science.py) were one-off layout scripts. Their job is done, and venue.json is now edited directly and checked with venue_check. For a new venue, write a venue.json (Claude can draft one from a brief) and run venue_check, gen_mvf and mvf_to_dxf on it. The plan-hli.json and plan-hls.json files behind the old v2 DXFs are also gone, but mvf_to_dxf now produces equivalent DXFs from the venue itself.

Known data issue: the science centre's L3 and B1 lift and stair cores sit in different places from G–L2 in venue.json, so the shafts don't stack. Fix it in venue.json, then regenerate.

## Maps in Mappedin Maker

| Venue | Map ID | Name in Maker |
|---|---|---|
| Backlot | 6acd8a857cba2d000c8c30c9 | (Ground Floor + Level 1) |
| Science centre | 6acf6081b62af7000c47fbb3 | Darling Harbour, Sydney, NSW |
| Stadium | 6acf7005c03851000c7d52e5 | Moore Park, Sydney, NSW |
| Airport | 6ad0687595c2f5000c8a4109 | Bridge Crescent, Mascot, NSW, 2020 |

Duplicates that can be deleted: 6acd86467cba2d000c8c30c8 (Backlot) and 6acf6dddc03851000c7d52e4 (stadium, rescaled by AI alignment).

All data in these twins is synthetic.
