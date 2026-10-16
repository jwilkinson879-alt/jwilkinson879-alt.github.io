const P={
 title:'Airport on Mappedin',
 h1:'<b>HLI</b> Harbourline International · on Mappedin',
 sub:'live ops twin · Mappedin SDK 6.27 · generated MVF',
 listLabel:'Flights',
 foot:'The map is rendered by the Mappedin JS SDK from an MVF bundle generated straight from the venue brief: 6 floors, 259 spaces, 169 doors, 65 fixtures, 24 lifts, escalators and stairs, and a 521-node walk network with one-way security, immigration and customs and the APM to the satellite. No Maker drawing and no API key: room colours, labels, markers, step-free directions and paths are driven live by the same agent scenarios as the three.js twin. In production the same bundle would come from Maker or the Mappedin API.',
 beats:[{t:'05:30',label:'Morning briefing'},{t:'06:10',label:'Security queue surge'},{t:'09:40',label:'Gate change cascade'},
  {t:'13:20',label:'Baggage belt fault'},{t:'16:00',label:'Step-free assist'},{t:'23:30',label:'Overnight energy setback'}],
 occBase:{T:.25,L0:.3,L1:.2,L2:.3,L3:.25,L4:.1},
 layers:[['all','All','All layers'],['pax','Passengers','Passenger flow'],['flights','Flights','Flights & gates'],['assets','Assets','Assets & systems'],['energy','Energy','Energy & HVAC']],
 legend:{flights:[['--c-acc','Boarding / gate open'],['--c-ok','Scheduled'],['--c-warn','Delayed'],['--c-crit','Gate changed']]},
 fresh(o){ const sp=o.sp; sp['L2-SEC'].queue=9; sp['L2-ISL-A'].queue=6; sp['L2-ISL-B'].queue=8; sp['L2-ISL-C'].queue=5; sp['L2-ISL-D'].queue=4; sp['L1-IMM'].queue=7;
   o.fl=V.flights.map(f=>({...f})).sort((a,b)=>a.std.localeCompare(b.std)); o.lanesOpen=12; },
 key(s,layer){ if(layer!=='flights') return null; if(s.cat!=='gate') return 'tint'; const f=flightAt(s.gate); if(!f) return 'idle';
   return {Boarding:'acc','Gate changed':'crit',Delayed:'warn','Gate open':'acc',Departed:'idle',Closed:'idle'}[f.status]||'ok'; },
 extraKeys(s){ if(s.cat!=='gate') return []; const f=flightAt(s.gate); return f&&f.status==='Gate changed'?['crit']:f&&f.status==='Delayed'?['warn']:[]; },
 metric(s,layer,v){ if(s.cat!=='gate') return null; const f=flightAt(s.gate);
   if(layer==='flights') return f?`${f.flight} ${f.std} · ${f.status}`:'no flight';
   if(layer==='all'||layer==='pax'){ if(v.queue!=null) return null; return f?`${f.flight} · ${f.status}`:''; } return null; },
 detail(s,kv){ if(!s.gate) return ''; const f=flightAt(s.gate); return f?kv('Flight',`${f.flight} to ${f.dest} ${f.std} · ${f.status}`):''; },
 list:{ head:['Flight','To','STD','Gate','Status'],
   rows(){ const chip=s=>({Boarding:'acc','Gate open':'acc','Gate changed':'crit',Delayed:'wait','On time':'act'}[s]||'');
     return st.fl.map(f=>`<tr class="click" data-s="L2-GATE-${f.gate}"><td class="m">${f.flight}</td><td>${f.dest}</td><td class="m">${f.std}</td><td class="m">${f.gate}</td><td><span class="chip ${chip(f.status)}">${f.status}</span></td></tr>`).join(''); } },
 kpis:[['Pax in terminal',()=>paxCount().toLocaleString()],['Longest queue',()=>maxQueue()+' min'],['Open alerts',()=>alerts()],['HVAC load',()=>kw().toLocaleString()+' kW']],
 kwExtra(){ return (st.lanesOpen||12)*3; },
 run:[
 ()=>{ setFl('A3',{status:'Boarding'}); setFl('B2',{status:'Gate open'});
   feed({who:'Ops briefing agent',level:'act',sev:'info',title:'05:30 briefing: 31 departures before 10:00, peak at central security 06:00–07:00',
     body:'All 46 tracked assets running. Rail arrivals forecast +18% (event day). Reclaim R4 flagged for vibration last night. Pier A night setback ended 04:45.',focus:'L2-SEC'}); },
 ()=>{ layer='pax'; floor='L2'; renderFloors(); const S=st.sp['L2-SEC']; S.queue=28; S.occ=.95; st.sp['L2-CHECKIN'].occ=.88; ['L2-ISL-B','L2-ISL-C'].forEach(i=>st.sp[i].queue=16);
   const qm=marker({target:'L2-SEC',sev:'crit',glyph:'Q',label:'Security 28 min',layer:'any',live:true}); focusSpace('L2-SEC',95);
   feed({who:'Passenger flow agent',level:'wait',sev:'crit',title:'Open security lanes 13–18 and send families to lanes 19–20',
     body:'Queue passed 25 min and is growing ~2 min every 5 min. 1,240 passengers due through in the next hour. Six screeners are on break rotation in the staff area and can open lanes 13–18 within 8 min. Families and PRM passengers to the assisted lanes keep main lanes moving.',focus:'L2-SEC',
     actions:[['Approve',c=>{ c.status='Approved by terminal duty manager'; st.lanesOpen=18; drop(qm.id);
        const m2=marker({target:'L2-SEC',sev:'warn',glyph:'+',label:'Lanes 13–18 opening',layer:'any'});
        feed({who:'Passenger flow agent',level:'act',sev:'info',title:'Dispatched 6 screeners; FIDS and app message sent',body:'"Security is busy — follow staff to the assisted lanes if travelling with children."'});
        later(2200,()=>{S.queue=19;S.occ=.82;}); later(4800,()=>{S.queue=11;S.occ=.66;drop(m2.id); ['L2-ISL-B','L2-ISL-C'].forEach(i=>st.sp[i].queue=9);
          feed({who:'Passenger flow agent',level:'inform',sev:'good',title:'Security back to 11 min',body:'18 lanes open. Agent will propose closing lanes 13–18 when the queue stays under 8 min for 20 min.'});}); },true],
      ['Open 13–15 only',c=>{ c.status='Edited: lanes 13–15 opened'; st.lanesOpen=15; drop(qm.id); later(3000,()=>{S.queue=17;S.occ=.8;}); }]]}); },
 ()=>{ layer='flights'; floor='all'; renderFloors(); clearRoutes(); setFl('A3',{status:'Departed'});
   const f=setFl('A7',{status:'Delayed'}); const inbound='HL 482'; const dep=f.flight;
   const gm=marker({target:'L2-GATE-A7',sev:'warn',glyph:'!',label:`${inbound} late on stand A7`,layer:'any',live:true}); focusSpace('L2-GATE-A7',110);
   feed({who:'Gate & stand agent',level:'wait',sev:'warn',title:`Move ${dep} from A7 to B12 (satellite) — ${inbound} will block A7 until 10:55`,
     body:`${inbound} is 40 min late and needs A7 for its turnaround. B12 is free until 12:30 and has a contact stand. 214 passengers booked; median walk from the plaza to B12 is about 7 min via the APM. Cleaning team 3 and gate staff move with the flight.`,focus:'L2-GATE-B12',
     actions:[['Approve gate change',c=>{ c.status='Approved by stand planner'; drop(gm.id); f.gate='B12'; f.status='Gate changed';
        marker({target:'L2-GATE-A7',sev:'crit',glyph:'↷',label:`${dep} moved to B12`,layer:'any'});
        const R=planRoute('L2-PLAZA','L2-GATE-B12',{},'--accent',`Passenger route to B12 for ${dep}`); showRouteBox(R);
        planRoute('L2-GATE-A7','L2-GATE-B12',{staff:true},'--warn','Gate staff & cleaning re-route',20000);
        feed({who:'Gate & stand agent',level:'act',sev:'info',title:'FIDS, app and gate PA updated; 214 passengers notified',body:'Cleaning team 3 and two gate agents re-routed via APM. Boarding at B12 holds at 10:05 so walking passengers make it.',focus:'L2-GATE-B12'});
        later(5000,()=>{ f.status='Boarding'; feed({who:'Gate & stand agent',level:'inform',sev:'good',title:`${dep} boarding at B12`,body:'Gate change done with no missed passengers forecast.'}); }); },true],
      ['Keep A7, delay departure',c=>{ c.status='Rejected: departure held at A7 by +35 min'; f.status='Delayed'; }]]}); },
 ()=>{ layer='assets'; floor='L1'; renderFloors(); clearRoutes(); st.asset['R4'].status='fault'; st.sp['L1-RECLAIM'].occ=.8;
   const bm=marker({target:'L1-R4',sev:'crit',glyph:'!',label:'R4 belt jam',layer:'any',live:true}); focusSpace('L1-R4',75);
   feed({who:'Asset agent',level:'wait',sev:'crit',title:'Reclaim R4 jammed — move HL 360 bags to R6 and dispatch an engineer',
     body:'Motor current spiked at 13:17 after last night\'s vibration alert. HL 360 (186 bags) is in feed line R4 now. R6 is free until 14:05. Nearest qualified engineer is in the L0 engineering workshop, about 2 min away by the airside staff lift.',focus:'L1-R4',
     actions:[['Approve',c=>{ c.status='Approved by baggage duty manager'; st.asset['R4'].status='repair'; drop(bm.id);
        marker({target:'L1-R4',sev:'warn',glyph:'W',label:'WO-2207 · engineer en route',layer:'any'}); marker({target:'L1-R6',sev:'info',glyph:'→',label:'HL 360 now on R6',layer:'any'});
        const R=planRoute('L0-WORKSHOP','L1-R4',{staff:true},'--warn','Engineer dispatch (staff route)',9000); showRouteBox(R);
        feed({who:'Asset agent',level:'act',sev:'info',title:'Work order WO-2207 raised; reclaim screens show R6 for HL 360',body:'Passengers already at R4 get an app push. Root-cause note attached: repeat vibration on drive unit.'});
        later(6000,()=>{ st.asset['R4'].status='ok'; st.markers.filter(m=>m.target==='L1-R4').forEach(m=>drop(m.id)); feed({who:'Asset agent',level:'inform',sev:'good',title:'R4 back in service',body:'Drive belt re-tensioned. Agent scheduled a bearing replacement for 02:00 tonight.'}); }); },true],
      ['Engineer only',c=>{ c.status='Edited: engineer dispatched, bags stay on R4'; st.asset['R4'].status='repair'; drop(bm.id); planRoute('L0-WORKSHOP','L1-R4',{staff:true},'--warn','Engineer dispatch',9000); }]]}); },
 ()=>{ layer='all'; floor='all'; renderFloors(); clearRoutes(); setFl('B5',{status:'Gate open'});
   const pm=marker({target:'T-RAIL-CON',sev:'info',glyph:'♿',label:'Passenger needs assistance',layer:'any',live:true});
   const F=setFl('B5',{}); focusSpace('T-RAIL-CON',120);
   const Rs=route(G,G.spaceNode['T-RAIL-CON'],G.spaceNode['L2-GATE-B5'],{}); const Ra=route(G,G.spaceNode['T-RAIL-CON'],G.spaceNode['L2-GATE-B5'],{accessible:true});
   feed({who:'Assistance agent',level:'wait',sev:'info',title:`Step-free journey for a wheelchair user: rail station to Gate B5 (${F.flight}, ${F.std})`,
     body:`Booked via the airline app. The standard route uses escalators; the step-free route uses rail lifts, the APM lifts and satellite lifts — about ${Math.round((Ra.cost-Rs.cost)/60)} min longer. All lifts on the route are running. Proposes meeting the passenger at the rail concourse with an assistance agent and a fast-track pass at security.`,focus:'T-RAIL-CON',
     actions:[['Book assistance',c=>{ c.status='Booked: assistance agent Mei L. meets at rail concourse 15:52'; drop(pm.id);
        const R=planRoute('T-RAIL-CON','L2-GATE-B5',{accessible:true},'--accent','Step-free route (assisted)');
        showRouteBox(R,'<label><input type="checkbox" id="cmp"> Compare with standard route</label>');
        const cb=document.getElementById('cmp'); if(cb) cb.onchange=()=>{ st.routes=st.routes.filter(r=>r.label!=='Standard route (escalators)'); if(cb.checked) planRoute('T-RAIL-CON','L2-GATE-B5',{},'--warn','Standard route (escalators)',16000); drawRoutes(); };
        marker({target:'L2-SEC',sev:'info',glyph:'F',label:'Fast-track pass issued',layer:'any'});
        feed({who:'Assistance agent',level:'act',sev:'good',title:'Gate B5 notified; boarding priority set',body:'Agent watches every lift on the route and re-plans if one goes out of service.'}); },true],
      ['Show standard route',c=>{ planRoute('T-RAIL-CON','L2-GATE-B5',{},'--warn','Standard route (escalators)'); showRouteBox(st.routes[st.routes.length-1]); }]]}); },
 ()=>{ layer='energy'; floor='all'; renderFloors(); clearRoutes(); st.fl.forEach(f=>{ f.status = f.gate.startsWith('A')?'Closed':'Departed'; });
   V.spaces.forEach(s=>{ if(s.cap&&s.side!=='boh') st.sp[s.id].occ=Math.min(st.sp[s.id].occ,.06); st.sp[s.id].queue=null; });
   ['L2-ISL-A','L2-ISL-B','L2-ISL-C','L2-ISL-D','L2-SEC','L1-IMM'].forEach(i=>st.sp[i].queue=null);
   focusSpace('L2-PA-COR',150);
   feed({who:'Energy agent',level:'wait',sev:'cool',title:'Pier A is empty until 05:10 — set back AHU-PA1/PA2 and dim pier lighting to 20%',
     body:'Last departure from Pier A left at 23:05. Security has swept the pier. Setback holds 26°C/18°C with a pre-start at 04:30. Escalators on Pier A pause; lifts stay on. Estimated saving about 90 kW overnight, about 520 kWh by morning.',focus:'L4-AHU-PA1',
     actions:[['Approve setback',c=>{ c.status='Approved by duty facilities engineer'; ['AHU-PA1','AHU-PA2'].forEach(a=>st.asset[a].mode='setback');
        marker({target:'L2-PA-COR',sev:'cool',glyph:'☾',label:'Pier A setback 23:30–04:30',layer:'any'});
        feed({who:'Energy agent',level:'inform',sev:'cool',title:'Setback active; pre-start scheduled 04:30',body:'Agent will also propose setback for the satellite west wing after the 00:40 departure.'});
        later(3000,()=>{ feed({who:'Energy agent',level:'wait',sev:'cool',title:'Also set back AHU-S3 (satellite west) — gates B1–B8 empty',body:'Next use 06:15. Estimated saving 45 kW.',focus:'L4-AHU-S3',
          actions:[['Approve',c2=>{ c2.status='Approved'; st.asset['AHU-S3'].mode='setback'; },true],['Not tonight',c2=>{c2.status='Declined: cleaning crew working in B4–B6 until 01:30';}]]}); }); },true],
      ['Lighting only',c=>{ c.status='Edited: pier lighting dimmed, HVAC unchanged'; }]]}); }
]
};
function flightAt(g){ return st.fl.find(f=>f.gate===g); }
function setFl(gate,patch){ const f=st.fl.find(x=>x.gate===gate||x.flight===gate); if(f) Object.assign(f,patch); return f; }

