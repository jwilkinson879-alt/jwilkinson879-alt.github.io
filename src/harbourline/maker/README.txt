Harbourline floor plans for Mappedin Maker (DXF, metres)

Upload one venue per Maker map ("New Map" > "Upload floor plans"), DXF files only (PNGs are previews).
v2: every floor in a venue shares identical drawing extents (small red corner marks on layer A-REF), so Maker cannot rescale floors during alignment.

AIRPORT - Harbourline International (6 floors). Order top to bottom:
  HLI-L4 Plant & Ops / HLI-L3 Mezzanine / HLI-L2 Departures / HLI-L1 Arrivals / HLI-L0 Baggage & BOH  -- ground line --  HLI-T Transport
STADIUM - Harbourline Stadium (6 floors). Order top to bottom:
  HLS-L4 Roof, control & plant / HLS-L3 Upper concourse / HLS-L2 Members & corporate / HLS-L1 Ground concourse / HLS-G Event level  -- ground line --  HLS-T Transport

Layers: A-WALL (room walls with real door gaps), A-WALL-EXT (exterior), A-DOOR (door leaf + swing), A-TEXT (room names; cores prefixed LIFT/ESC/STAIR).
Corridors and open halls have no outline on purpose, so Maker keeps them as one walkable space.

SCIENCE CENTRE - Harbourline Science Centre (5 floors), folder science/. Order top to bottom:
  HSC-L3 Learning, roof & plant / HSC-L2 Galleries & planetarium / HSC-L1 Galleries & touring hall / HSC-G Entry & discovery -- ground line -- HSC-B1 Collections & BOH
  Written from hsc.mvf.json by mvf_to_dxf.py (metres). Layers: WALLS, DOORS, ROOMS, OBJECTS, LABELS.
  Known issue: the L3 and B1 cores sit in different places from G-L2, so the shafts don't stack.
