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
      hsc.mvf.json            generated MVF v2 bundle for the science centre
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
```

Each venue has three files. **venue.json** holds the levels, spaces, connectors, assets and walk spines; it is the output the venue generators produced. **pack.js** holds the scenario beats, layers, KPIs, list tab and the venue-specific keys and metrics. **page.json** holds the header, footer and tab labels.

## Build

```
cd src/harbourline
python3 build.py                  # writes dist/airport.html, stadium.html, science.html, science-mappedin.html
python3 build.py --verify DIR     # also checks each page against DIR/<page>.html
```

The build has no dependencies beyond Python 3. The pages load three.js 0.128 (or Mappedin JS 6.27) and Google Fonts from CDNs at runtime. On 16 Oct 2026 all four rebuilt pages matched the published versions byte for byte. A headless run of the three.js twins stepped through every scenario with no page errors.

## Not recovered

These files never made it into a published page, so they are gone. Rebuild them when needed.

- **Venue generators** (gen_airport.py, gen_stadium.py, gen_science.py). Their output is venue.json, so edit that directly or write a new generator against it. The `brief` field in each venue.json is only a one-line summary, not the full brief.
- **MVF generator** (gen_mvf_hsc.mjs). Its output for the science centre is mappedin/hsc.mvf.json. Known issue to fix in any rewrite: the L3 and B1 cores sit in different places from G–L2, so the shafts don't stack.
- **DXF converters.** mvf_to_dxf.py wrote the science centre DXFs (layers WALLS, DOORS, ROOMS, OBJECTS and LABELS). The v2 converter wrote the airport and stadium DXFs from plan-hli.json and plan-hls.json, which are also lost. All the DXFs themselves survive in `harbourline/maker/`; only the plan files do not.
- **Maker automation helpers** (cal.py, nm.py, cn.py, hw.py, gen.py). The calibration notes and gotchas live in the Project doc `claude/mappedin-sdk-twin.md`.
- **Public-site build** (build_public.py). It produced the landing page, llms.txt, robots.txt and sitemap.xml.
- **Command centre parts** (part1.html, part2–4.js). The assembled page in ksa-portfolio/ is complete and is now the source.

## Maps in Mappedin Maker

| Venue | Map ID | Name in Maker |
|---|---|---|
| Backlot | 6acd8a857cba2d000c8c30c9 | (Ground Floor + Level 1) |
| Science centre | 6acf6081b62af7000c47fbb3 | Darling Harbour, Sydney, NSW |
| Stadium | 6acf7005c03851000c7d52e5 | Moore Park, Sydney, NSW |
| Airport | 6ad0687595c2f5000c8a4109 | Bridge Crescent, Mascot, NSW, 2020 |

Duplicates that can be deleted: 6acd86467cba2d000c8c30c8 (Backlot) and 6acf6dddc03851000c7d52e4 (stadium, rescaled by AI alignment).

All data in these twins is synthetic.
