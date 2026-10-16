const P={
 title:'Harbourline Stadium Twin',
 h1:'<b>HLS</b> Harbourline Stadium',
 sub:'86,400-seat oval · 6 levels · 429 spaces',
 listLabel:'Gates',
 foot:'Generated from a structured venue brief on the same engine as Harbourline International: 429 spaces, 72 seating bays across three tiers, 8 entry gates with one-way ticket scans and separate exits, 41 vertical and gate connectors, 38 tracked assets and a step-free-aware walk network linked to the rail station, shuttle interchange and rideshare rank. Only the venue brief and this scenario pack differ from the airport.',
 beats:[{t:'16:30',label:'Gates-open briefing'},{t:'18:20',label:'Ingress surge at the station gates'},{t:'19:55',label:'Main break: food, drink & toilets'},
  {t:'21:50',label:'Full-time egress to transport'},{t:'23:40',label:'Post-event energy & cleaning'}],
 occBase:{T:.3,G:.3,L1:.2,L2:.15,L3:.12,L4:.15},
 layers:[['all','All','All layers'],['pax','Crowd','Crowd & queues'],['gates','Gates','Gates & ingress'],['assets','Assets','Assets & systems'],['energy','Energy','Energy, HVAC & lighting']],
 legend:{energy:[['--c-ok','Occupied mode'],['--c-cool','Setback / lights dimmed'],['--c-warn','Floodlights at match level']],gates:[['--c-ok','Flowing'],['--c-warn','Queue 12+ min'],['--c-crit','Queue 20+ min'],['--c-idle','Closed']]},
 noLabel:s=>(s.cat==='plaza'&&(+s.id.slice(-2))%6!==1)||(s.kind==='corridor'),
 bigLabel:s=>s.cat==='gate'||(s.cat==='seating'&&(+s.id.slice(-2))%3===0),
 fresh(o){ o.gates={}; for(let g=1;g<=8;g++){ o.gates[g]={lanes:g===1||g===8?10:8,max:16,status:'Open'}; o.sp['L1-GATE'+g].queue=g===1||g===8?6:2; }
   o.flood='warmup'; seat(o,.05); },
 key(s,layer,v){ if(layer==='energy'&&s.asset&&s.asset.startsWith('FL-')) return st.flood==='match'?'warn':st.flood==='warmup'?'ok':'cool';
   if(layer!=='gates') return null;
   if(s.cat==='gate'){ const g=st.gates[s.gate]; if(g.status==='Closed') return 'idle'; return v.queue>=20?'crit':v.queue>=12?'warn':'ok'; }
   if(s.cat==='plaza') return occKey(s,v); return 'tint'; },
 metric(s,layer,v){ if(s.cat==='gate'){ const g=st.gates[s.gate]; return `${g.lanes}/${g.max} lanes · ${v.queue||0} min`; }
   if(s.asset&&s.asset.startsWith('FL-')&&(layer==='energy'||layer==='assets')) return {match:'match 100%',warmup:'warm-up 50%',cleaning:'cleaning 20%',off:'off'}[st.flood];
   return null; },
 detail(s,kv){ if(s.cat!=='gate') return ''; const g=st.gates[s.gate]; return kv('Lanes',`${g.lanes} of ${g.max} open`)+kv('Status',g.status); },
 list:{ head:['Gate','Side','Lanes','Queue','Status'],
   rows(){ return Object.entries(st.gates).map(([g,x])=>{ const s=SPC['L1-GATE'+g], q=st.sp['L1-GATE'+g].queue||0; const ch=x.status==='Closed'?'':q>=20?'crit':q>=12?'wait':'act';
     return `<tr class="click" data-s="L1-GATE${g}"><td class="m">Gate ${g}</td><td>${s.zone.replace(' plaza','')}</td><td class="m">${x.lanes}/${x.max}</td><td class="m">${q} min</td><td><span class="chip ${ch}">${x.status}</span></td></tr>`; }).join(''); } },
 kpis:[['Fans in seats',()=>{ let n=0; V.spaces.forEach(x=>{ if(x.cat==='seating') n+=st.sp[x.id].occ*x.cap; }); return Math.round(n).toLocaleString(); }],['Longest queue',()=>maxQueue()+' min'],['Open alerts',()=>alerts()],['Power load',()=>kw().toLocaleString()+' kW']],
 kwExtra(){ return {match:1400,warmup:700,cleaning:280,off:0}[st.flood]||0; },
 run:[
 // 0 — briefing
 ()=>{ feed({who:'Event ops agent',level:'act',sev:'info',title:'Gates open 16:30 · Season final, 82,400 tickets scanned-in forecast, first bounce 19:30',
     body:'61% of ticket holders are booked on rail, so Gates 1 and 8 (station side) will peak 18:15–19:00. Shuttle interchange expects 14,000. 38 tracked assets running; one scanner on Gate 8 lane 6 flagged as intermittent. Floodlights at warm-up 50%. 14°C, clear, light westerly.',focus:'L1-GATE8'});
   marker({target:'L1-GATE8',sev:'info',glyph:'i',label:'Gate 8 lane 6 scanner flaky',layer:'any'});
   setOcc(s=>s.lv==='T',.35); setOcc(s=>s.cat==='plaza',.3); },
 // 1 — ingress surge
 ()=>{ layer='gates'; floor='L1'; renderFloors(); clearRoutes();
   seat(st,.45); setOcc(s=>s.lv==='T',.75); setOcc(s=>s.cat==='plaza',.45); setOcc(s=>s.cat==='plaza'&&s.zone==='West plaza',.93);
   setQ({1:24,8:19,2:4,7:5,3:2,4:1,5:1,6:3});
   const m1=marker({target:'L1-GATE1',sev:'crit',glyph:'Q',label:'Gate 1 · 24 min',layer:'any',live:true}); const m8=marker({target:'L1-GATE8',sev:'warn',glyph:'Q',label:'Gate 8 · 19 min',layer:'any',live:true});
   focusSpace('L1-GATE1',120);
   const a=route(G,G.spaceNode['T-STN-CON'],G.spaceNode['L1-B118'],{}), b=route(G,G.spaceNode['T-STN-CON'],G.spaceNode['L1-B118'],{avoid:new Set(['GATE1-IN','GATE8-IN'])});
   feed({who:'Crowd flow agent',level:'wait',sev:'crit',title:'Station gates over 20 min — open reserve lanes and send north and south stands to Gates 2 and 7',
     body:`Trains are landing 1,900 people every 4 min and Gates 1 and 8 scan about 1,500. Gates 2 and 7 are under 5 min. For a north-stand fan, Gate 2 is only ${Math.round(b.cost-a.cost)} s more walking than Gate 1 and skips ~20 min of queue. Plan: move 12 stewards from the quiet east gates (4 and 5) to open 6 reserve lanes at Gates 1 and 8, push an app and SMS nudge to bays 113–124 and 313–324 (Gate 2) and 101–106 / 301–306 (Gate 7), and switch plaza and station signage.`,focus:'L1-GATE1',
     actions:[['Approve',c=>{ c.status='Approved by venue operations manager'; drop(m1.id); drop(m8.id);
        st.gates[1].lanes=13; st.gates[8].lanes=13; st.gates[4].lanes=5; st.gates[5].lanes=5;
        const R=planRoute('T-STN-CON','L1-B118',{avoid:new Set(['GATE1-IN','GATE8-IN'])},'--accent','North stand fans → Gate 2'); showRouteBox(R,'<label><input type="checkbox" id="cmp"> Compare with the Gate 1 route</label>');
        const cb=document.getElementById('cmp'); if(cb) cb.onchange=()=>{ st.routes=st.routes.filter(r=>r.label!=='Current route via Gate 1'); if(cb.checked) planRoute('T-STN-CON','L1-B118',{},'--warn','Current route via Gate 1',16000); drawRoutes(); };
        planRoute('L1-GATE5','L1-GATE8',{},'--warn','Steward redeploy (east → west)',22000);
        feed({who:'Crowd flow agent',level:'act',sev:'info',title:'12 stewards dispatched; 31,000 ticket holders nudged; signage switched',body:'"Heading to the north or south stands? Gate 2 / Gate 7 is quicker right now — follow the green signs."'});
        later(2500,()=>setQ({1:15,8:12,2:9,7:8})); later(5000,()=>{ setQ({1:9,8:8,2:8,7:7,4:2,5:2}); setOcc(s=>s.cat==='plaza'&&s.zone==='West plaza',.62);
          feed({who:'Crowd flow agent',level:'inform',sev:'good',title:'Station gates down to 9 min; west plaza back under 2 people/m²',body:'Agent will propose returning stewards to Gates 4 and 5 when the shuttle wave lands at 18:50.'}); }); },true],
      ['Signage only',c=>{ c.status='Edited: signage and app nudge only, no lane changes'; drop(m1.id); later(3000,()=>setQ({1:19,8:16,2:8,7:8})); }]]}); },
 // 2 — main break
 ()=>{ layer='pax'; floor='L3'; renderFloors(); clearRoutes(); st.flood='match'; setQ({1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0});
   seat(st,.62); setOcc(s=>s.lv==='T'||s.cat==='plaza',.05); setOcc(s=>s.lv==='L3'&&s.cat==='circulation',.7);
   const Q={K17:15,K18:12,K19:14,K20:11,K21:3,K22:2,K23:4,K05:3,K07:4,K09:6,K11:5,K13:7,K15:6};
   Object.entries(Q).forEach(([k,q])=>{ st.sp['L3-'+k].queue=q; st.sp['L3-'+k].occ=q>10?.95:.5; });
   ['L3-CON-17','L3-CON-18','L3-CON-19','L3-CON-20'].forEach(i=>st.sp[i].occ=.93);
   const qm=marker({target:'L3-K19',sev:'crit',glyph:'Q',label:'North F&B 14–15 min',layer:'any',live:true}); const tm=marker({target:'L3-K18',sev:'warn',glyph:'WC',label:'Toilets 12 min',layer:'any'});
   focusSpace('L3-K18',95);
   feed({who:'Concessions agent',level:'wait',sev:'crit',title:'Main break: upper north concourse jammed — nudge bays 316–321 north-east, open a pop-up bar, restock Grandstand Grill',
     body:'Kiosks K17 and K19 are at 14–15 min and K19 sells out of pies in about 6 min at this rate. North-east kiosks K21–K23 are 2–4 min away, about 40 m along the concourse. Plan: mobile-order push and screen message to bays 316–321, open pop-up bar PB-3 at the north escalators, send a runner with 240 pies from the central kitchen via the catering goods lift, and a cleaning crew to the K18 toilets.',focus:'L3-K19',
     actions:[['Approve',c=>{ c.status='Approved by F&B duty manager'; drop(qm.id);
        const R=planRoute('G-KITCHEN','L3-K19',{staff:true},'--warn','Restock runner (catering goods lift)',11000); showRouteBox(R);
        planRoute('G-CLEAN','L3-K18',{staff:true},'--cool','Cleaning crew to K18 toilets',14000);
        feed({who:'Concessions agent',level:'act',sev:'info',title:'Mobile-order push sent to 8,900 phones in bays 316–321; PB-3 opening',body:'Big-screen panel: "Quicker food north-east at Boundary Burgers and Harbour Coffee →". Runner ETA about 2½ min.'});
        later(2500,()=>{ ['K17','K19'].forEach(k=>st.sp['L3-'+k].queue=9); ['K21','K23'].forEach(k=>st.sp['L3-'+k].queue=6); });
        later(5000,()=>{ ['K17','K19'].forEach(k=>{st.sp['L3-'+k].queue=6; st.sp['L3-'+k].occ=.6;}); st.sp['L3-K18'].queue=5; st.sp['L3-K20'].queue=5; drop(tm.id);
          ['L3-CON-17','L3-CON-18','L3-CON-19','L3-CON-20'].forEach(i=>st.sp[i].occ=.7);
          feed({who:'Concessions agent',level:'inform',sev:'good',title:'North concourse queues down to 5–6 min; pies restocked',body:'Saved an estimated 410 lost sales. Agent logged K19 for a second oven before the next final.'}); }); },true],
      ['Nudge only',c=>{ c.status='Edited: app and screen nudge only'; drop(qm.id); later(3000,()=>{ ['K17','K19'].forEach(k=>st.sp['L3-'+k].queue=11); }); }]]}); },
 // 3 — egress
 ()=>{ layer='all'; floor='all'; renderFloors(); clearRoutes();
   Object.values(st.sp).forEach(v=>v.queue=null); for(let g=1;g<=8;g++){ st.gates[g].status='Exit only'; st.gates[g].lanes=st.gates[g].max; }
   seat(st,.86); setOcc(s=>s.cat==='plaza',.35); setOcc(s=>s.cat==='plaza'&&s.zone==='West plaza',.88); setOcc(s=>s.lv==='T'&&s.zone==='Rail',.9);
   const dm=marker({target:'L1-PLZ-13',sev:'crit',glyph:'!',label:'West plaza density rising',layer:'any',live:true}); const sm=marker({target:'T-STN-CON',sev:'warn',glyph:'R',label:'Station at 90%',layer:'any',live:true});
   focusSpace('L1-PLZ-13',170);
   feed({who:'Transport agent',level:'wait',sev:'crit',title:'Full time: stagger the release — hold the upper north tier 10 min, send the east stands to the shuttles',
     body:'82,000 leaving. The station clears about 14,000 per 15 min and its platforms are already at 90%; if every stand walks west at once the west plaza passes 3 people/m² in about 6 min. Plan: release lower and south bays to the station now, hold bays 313–324 for 10 min with the replay and presentation on the big screens, direct bays 101–106 and 119–124 (east) out Gates 4 and 5 to the 40 shuttles, and use the station overflow pens. Step-free fans keep the station lifts.',focus:'L1-PLZ-13',
     actions:[['Approve staggered release',c=>{ c.status='Approved by venue controller (event control room)'; drop(dm.id);
        const R=planRoute('L3-B318','T-STN-CON',{},'--accent','Upper north → station (released 22:00)'); showRouteBox(R,'<label><input type="checkbox" id="cmp"> Show the step-free route from bay 305</label>');
        planRoute('L1-B103','T-BAY3',{},'--warn','East stands → shuttle bay 3',16000);
        const cb=document.getElementById('cmp'); if(cb) cb.onchange=()=>{ st.routes=st.routes.filter(r=>r.label!=='Step-free: bay 305 → station lifts'); if(cb.checked){ const A=planRoute('L3-B305','T-STN-CON',{accessible:true},'--cool','Step-free: bay 305 → station lifts',18000); showRouteBox(A); } drawRoutes(); };
        marker({target:'L3-B318',sev:'info',glyph:'⏸',label:'Bays 313–324 held 10 min',layer:'any'});
        feed({who:'Transport agent',level:'act',sev:'info',title:'Big-screen hold running; shuttles called forward; station told to run 3 extra services',body:'PA and app: "East stands: shuttles at Gates 4 and 5 — no wait." Agent watches plaza density every 30 s and will release the upper north early if it drops under 1.5 people/m².'});
        later(3000,()=>{ setOcc(s=>s.cat==='plaza'&&s.zone==='West plaza',.68); seat(st,.5); });
        later(6000,()=>{ setOcc(s=>s.cat==='plaza'&&s.zone==='West plaza',.5); setOcc(s=>s.lv==='T'&&s.zone==='Rail',.7); drop(sm.id); seat(st,.2);
          feed({who:'Transport agent',level:'inform',sev:'good',title:'West plaza peaked at 2.1 people/m², under the 2.5 limit; upper north released 22:00',body:'Forecast: venue clear by 22:35, station back to normal by 22:50.'}); }); },true],
      ['Release everyone now',c=>{ c.status='Rejected: all stands released at once'; drop(dm.id); marker({target:'L1-PLZ-13',sev:'crit',glyph:'!',label:'West plaza 3.1 people/m²',layer:'any',live:true});
        setOcc(s=>s.cat==='plaza'&&s.zone==='West plaza',.97); feed({who:'Transport agent',level:'inform',sev:'crit',title:'West plaza now 3.1 people/m² — stewards closing the Gate 1 exit lanes to meter the flow',body:'Agent recommends re-routing the north stands out Gate 2 and 3.'}); }]]}); },
 // 4 — post-event
 ()=>{ layer='energy'; floor='all'; renderFloors(); clearRoutes(); st.flood='match';
   V.spaces.forEach(s=>{ if(s.cap&&s.side!=='boh') st.sp[s.id].occ=Math.min(st.sp[s.id].occ,.03); }); setOcc(s=>s.lv==='L1'&&s.cat==='seating',.06);
   for(let g=1;g<=8;g++) st.gates[g].status='Closed';
   focusSpace('L4-FL-W',190);
   feed({who:'Energy agent',level:'wait',sev:'cool',title:'Venue clear — cut floodlights to cleaning level and set back upper and members air handling',
     body:'Last turnstile exit 22:41. 60 cleaners are working the lower bowl until about 01:30. Floodlights are still at match level (1,400 kW). Plan: floodlights to 20% (cleaning), set back AHU-U1–U4 (upper concourse) and AHU-M1/M2 (members) to 27°C/16°C until 07:00, keep the ground concourse and event level running for cleaning and the kitchen. Saves about 1,350 kW now, about 3.4 MWh by morning.',focus:'L4-FL-W',
     actions:[['Approve',c=>{ c.status='Approved by duty facilities engineer'; st.flood='cleaning'; ['AHU-U1','AHU-U2','AHU-U3','AHU-U4','AHU-M1','AHU-M2'].forEach(a=>st.asset[a].mode='setback');
        marker({target:'L4-FL-W',sev:'cool',glyph:'☾',label:'Floodlights 20% · cleaning',layer:'any'});
        const R=planRoute('G-CLEAN','L1-B113',{staff:true},'--cool','Cleaning crew 4 → lower west bays',16000); showRouteBox(R);
        feed({who:'Facilities agent',level:'act',sev:'info',title:'Cleaning plan issued: lower bowl by quadrant, west first (most litter, per gate-scan heatmap)',body:'Crews 1–6 assigned. Toilets on L3 cleaned first thing tomorrow while setback runs.'});
        later(3500,()=>{ feed({who:'Energy agent',level:'wait',sev:'cool',title:'East and south lower bowl done — switch floodlights off and use concourse lighting?',body:'West and north crews need about 40 more min; work lights on the ground concourse cover them. Saves another 280 kW.',focus:'L4-FL-E',
          actions:[['Approve',c2=>{ c2.status='Approved'; st.flood='off'; },true],['Keep 20% until 01:30',c2=>{ c2.status='Declined: ground staff need the field lit for pitch covers'; }]]}); }); },true],
      ['Lights only',c=>{ c.status='Edited: floodlights to 20%, HVAC unchanged'; st.flood='cleaning'; }]]}); }
 ]
};
function seat(o,v){ V.spaces.forEach(s=>{ if(s.cat==='seating') o.sp[s.id].occ=Math.min(.98,v*(.85+((s.cap+s.id.length*7)%30)/100)); }); }
function setOcc(pred,v){ V.spaces.forEach(s=>{ if(s.cap&&pred(s)) st.sp[s.id].occ=v; }); }
function setQ(m){ Object.entries(m).forEach(([g,q])=>{ st.sp['L1-GATE'+g].queue=q; }); }

