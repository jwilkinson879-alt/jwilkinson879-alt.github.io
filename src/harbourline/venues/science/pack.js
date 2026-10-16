const P={
 title:'Harbourline Science Centre Twin',
 h1:'<b>HSC</b> Harbourline Science Centre',
 sub:'science centre · 5 levels · 162 spaces',
 listLabel:'Sessions',
 foot:'Generated from a structured venue brief on the same engine as Harbourline International and Harbourline Stadium: 162 spaces, 61 interactive exhibits, a free atrium with one-way ticket gates, a timed-entry touring hall, a planetarium, climate-controlled loan galleries and collection store, 13 connectors and 75 tracked assets. Only the venue brief and this scenario pack differ.',
 beats:[{t:'09:30',label:'Opening briefing'},{t:'10:15',label:'Schools + step-free visitor'},{t:'11:40',label:'Climate excursion'},
  {t:'14:00',label:'Timed-entry crush'},{t:'22:40',label:'Energy setback'},{t:'01:12',label:'Motion alarm'}],
 occBase:{B1:.3,G:.2,L1:.15,L2:.15,L3:.1},
 layers:[['all','All','All layers'],['pax','Visitors','Visitors & queues'],['climate','Climate','Gallery climate (RH)'],['assets','Exhibits','Exhibits & assets'],['energy','Energy','Energy & HVAC']],
 legend:{climate:[['--c-ok','Within 50 ± 5% RH'],['--c-warn','5–8% off target'],['--c-crit','More than 8% off'],['--t-hall','Not climate-controlled']],
   assets:[['--c-ok','Running'],['--c-warn','Under repair / standby'],['--c-crit','Fault']]},
 objLabelDist:45,
 bigLabel:s=>s.cat==='gallery'||s.kind==='hall',
 fresh(o){ V.spaces.forEach((s,i)=>{ if(s.clim){ o.sp[s.id].rh=49+(i%4)*.5; o.sp[s.id].temp=20.8+(i%3)*.2; } });
   o.sess=[['Mars: The Red Frontier','10:00',148,150,'L1-MARS-INTRO','Scanning'],['Mars: The Red Frontier','11:00',150,150,'L1-MARS-INTRO','Sold out'],
     ['Mars: The Red Frontier','12:00',139,150,'L1-MARS-INTRO','On sale'],['Mars: The Red Frontier','13:00',150,150,'L1-MARS-INTRO','Sold out'],
     ['Mars: The Red Frontier','14:00',150,150,'L1-MARS-INTRO','Sold out'],['Mars: The Red Frontier','15:00',96,150,'L1-MARS-INTRO','On sale'],
     ['Planetarium · Tour of the Night Sky','10:30',122,180,'L2-PLANET','On sale'],['Planetarium · Mars from Orbit','12:00',171,180,'L2-PLANET','On sale'],
     ['Planetarium · Mars from Orbit','14:30',52,180,'L2-PLANET','On sale'],
     ["St Mary's Primary (Yr 5) · 60",'10:15',60,60,'L3-LEARN-1','Expected'],['Bayside Primary (Yr 4) · 55','10:15',55,55,'L3-LEARN-2','Expected'],
     ['Harbour High (Yr 9) · 58','10:20',58,58,'L3-LEARN-3','Expected'],['Northport College (Yr 10) · 57','10:20',57,57,'L3-LEARN-4','Expected']]
     .map(([name,time,booked,cap,space,status])=>({name,time,booked,cap,space,status}));
   o.asset['EX09'].status='repair'; o.sp['G-TIX'].queue=3; o.eventKw=0; },
 key(s,layer,v){
   if(layer==='climate'){ if(!s.clim) return 'tint'; const d=Math.abs(v.rh-s.clim.rh); return d>8?'crit':d>5?'warn':'ok'; }
   if(layer==='assets'&&s.asset&&st.asset[s.asset]&&st.asset[s.asset].mode==='standby') return 'cool';
   return null; },
 extraKeys(s,v){ if(!s.clim) return []; const d=Math.abs(v.rh-s.clim.rh); return d>8?['crit']:d>5?['warn']:[]; },
 metric(s,layer,v){ if(layer==='climate') return s.clim?`${v.temp.toFixed(1)}°C · ${Math.round(v.rh)}% RH`:'';
   if(s.clim&&layer==='all'&&Math.abs(v.rh-s.clim.rh)>5) return `${Math.round(v.rh)}% RH`; return null; },
 detail(s,kv,v){ return s.clim?kv('Climate',`${v.temp.toFixed(1)}°C · ${Math.round(v.rh)}% RH (target ${s.clim.t}°C · ${s.clim.rh} ± 5%)`):''; },
 list:{ head:['Session','Time','Booked','Status'],
   rows(){ return st.sess.map(x=>{ const ch={Scanning:'acc','Sold out':'',['On sale']:'act',Expected:'',Arrived:'act','Walk-ups paused':'wait','Re-timed':'cool','Over capacity':'crit',Done:''}[x.status]??'';
     return `<tr class="click" data-s="${x.space}"><td>${x.name}</td><td class="m">${x.time}</td><td class="m">${x.booked}/${x.cap}</td><td><span class="chip ${ch}">${x.status}</span></td></tr>`; }).join(''); } },
 kpis:[['Visitors in building',()=>paxCount().toLocaleString()],['Longest queue',()=>maxQueue()+' min'],
   ['Worst gallery RH',()=>{ let w=50; V.spaces.forEach(s=>{ if(s.clim&&Math.abs(st.sp[s.id].rh-50)>Math.abs(w-50)) w=st.sp[s.id].rh; }); return Math.round(w)+'%'; }],
   ['Power load',()=>kw().toLocaleString()+' kW']],
 kwExtra(){ let k=st.eventKw||0; V.assets.forEach(a=>{ if(a.kind==='exhibit'){ const x=st.asset[a.id]; if(x.status==='ok'&&x.mode!=='standby') k+=1.4; } }); return Math.round(k); },
 run:[
 // 0 — briefing
 ()=>{ setOcc(s=>s.lv!=='B1',.12); setOcc(s=>s.id==='G-ATRIUM'||s.id==='G-ENTRY',.35);
   feed({who:'Ops briefing agent',level:'act',sev:'info',title:'09:30 briefing: 3,900 booked, Mars week 2, four school groups at 10:15–10:20',
     body:'Mars timed slots are sold out at 11:00, 13:00 and 14:00. 230 students arrive by coach at the school entrance. Lift B is booked for maintenance 10:00–13:00. Flight simulator pods are under repair. Earth & Origins at 50% RH with lender loans on display; forecast 31°C and humid this afternoon, so the agent will watch that gallery closely.',focus:'G-ATRIUM'});
   marker({target:'L2-EX09',sev:'info',glyph:'W',label:'Flight sim pods · repair',layer:'any'}); },
 // 1 — schools + step-free
 ()=>{ layer='pax'; floor='G'; renderFloors(); clearRoutes(); st.asset['LIFT-B'].status='repair';
   setOcc(s=>s.lv!=='B1',.3); st.sp['G-SCHOOL'].occ=.97; st.sp['G-SCHOOL'].queue=18; st.sp['G-LUNCH'].occ=.7; st.sp['G-ATRIUM'].occ=.55; st.sp['G-TIX'].queue=6;
   st.sess.slice(9).forEach(x=>x.status='Arrived');
   const qm=marker({target:'G-SCHOOL',sev:'crit',glyph:'Q',label:'School check-in 18 min',layer:'any',live:true});
   const lm=marker({target:'G-LIFT-B',sev:'warn',glyph:'L',label:'Lift B out until 13:00',layer:'any'});
   const am=marker({target:'G-ENTRY',sev:'info',glyph:'♿',label:'Wheelchair user · planetarium 10:30',layer:'any',live:true});
   focusSpace('G-SCHOOL',95);
   const Ra=route(G,G.spaceNode['G-ENTRY'],G.spaceNode['L2-PLANET'],{accessible:true,avoid:new Set(['LIFT-B'])});
   feed({who:'Learning & access agent',level:'wait',sev:'crit',title:'Four schools at once — split the groups, and route the 10:30 wheelchair user via Lift A',
     body:`All four coaches arrived within 6 minutes and one check-in lane is running. Plan: open the second lane; send St Mary's and Bayside (primary) straight to Tinker Lab and Water & Waves; send Harbour High and Northport College up to learning studios 3 and 4, then the 11:00 planetarium preview. Separately, a wheelchair user and companion booked the 10:30 planetarium show. Lift B is out, so the step-free route uses Lift A (about ${Math.round(Ra.cost/60)} min). An educator will meet them at the ticket desk.`,focus:'G-SCHOOL',
     actions:[['Approve',c=>{ c.status='Approved by visitor services lead'; drop(qm.id); drop(am.id);
        const R=planRoute('G-ENTRY','L2-PLANET',{accessible:true,avoid:new Set(['LIFT-B'])},'--accent','Step-free route (Lift B out)');
        showRouteBox(R,'<label><input type="checkbox" id="cmp"> Compare with the standard route</label>');
        const cb=document.getElementById('cmp'); if(cb) cb.onchange=()=>{ st.routes=st.routes.filter(r=>r.label!=='Standard route (escalators)'); if(cb.checked) planRoute('G-ENTRY','L2-PLANET',{},'--warn','Standard route (escalators)',16000); drawRoutes(); };
        planRoute('G-SCHOOL','L3-LEARN-3',{},'--warn','Harbour High → learning studio 3',20000);
        feed({who:'Learning & access agent',level:'act',sev:'info',title:'Second school lane open; teachers sent itineraries; educator Priya R. meeting the visitor at tickets',body:'Planetarium crew told to hold the wheelchair bay and companion seat. The agent re-plans step-free routes if another lift goes down.'});
        later(2500,()=>{ st.sp['G-SCHOOL'].queue=9; st.sp['G-SCHOOL'].occ=.7; st.sp['G-TINKER'].occ=.8; st.sp['G-WAVES'].occ=.6; });
        later(5000,()=>{ st.sp['G-SCHOOL'].queue=2; st.sp['G-SCHOOL'].occ=.25; st.sp['L3-LEARN-3'].occ=.9; st.sp['L3-LEARN-4'].occ=.9; drop(lm.id);
          feed({who:'Learning & access agent',level:'inform',sev:'good',title:'All 230 students checked in by 10:31; visitor seated at 10:27',body:'Lift B maintenance is still on schedule to finish at 13:00.'}); }); },true],
      ['Second lane only',c=>{ c.status='Edited: second lane opened; groups follow their original itineraries'; drop(qm.id); later(3000,()=>{ st.sp['G-SCHOOL'].queue=11; }); }]]}); },
 // 2 — climate excursion
 ()=>{ layer='climate'; floor='L2'; renderFloors(); clearRoutes(); st.asset['LIFT-B'].status='repair';
   setOcc(s=>s.lv==='L2'||s.lv==='L1',.5); st.sp['L2-ORIGINS'].occ=.97;
   ['L2-ORIGINS','L2-CASE1','L2-CASE2','L2-CASE3'].forEach((id,i)=>{ st.sp[id].rh=61-i*.5; st.sp[id].temp=23.4; }); st.asset['AHU-EO'].status='fault';
   const cm=marker({target:'L2-CASE1',sev:'crit',glyph:'%',label:'61% RH · pyrite loan case',layer:'any',live:true});
   focusSpace('L2-ORIGINS',75);
   feed({who:'Collections care agent',level:'wait',sev:'crit',title:'Earth & Origins at 61% RH and rising — lender loans need 45–55%',
     body:'RH has climbed 2% every 15 min since 10:50. AHU-EO trend logs show its humidifier valve stuck at 40% open. 160 visitors are in a 31°C humid day, which adds load. The pyrite specimens in loan case 1 are at risk above 55%. Plan: force AHU-EO into dehumidify with full recirculation, cap the gallery at 60 visitors with a timed hold at the door, page loans conservator Dr Hana Ito, send the HVAC engineer from the B1 workshop to the AHU-EO plant room, and start an excursion log for the lender report.',focus:'L2-CASE1',
     actions:[['Approve',c=>{ c.status='Approved by head of collections'; st.asset['AHU-EO'].status='repair';
        const R=planRoute('B1-WORKSHOP','L3-AHU-EO',{staff:true},'--warn','HVAC engineer → AHU-EO plant room',10000); showRouteBox(R);
        planRoute('B1-CONS','L2-ORIGINS',{staff:true},'--cool','Loans conservator → Earth & Origins',16000);
        marker({target:'L2-ORIGINS',sev:'warn',glyph:'60',label:'Gallery capped at 60',layer:'any'});
        feed({who:'Collections care agent',level:'act',sev:'info',title:'Dehumidify forced; gallery capped; conservator paged; excursion log EX-0412 opened',body:'Door staff are holding visitors in Climate Futures with a live ice-core demo.'});
        later(2500,()=>{ ['L2-ORIGINS','L2-CASE1','L2-CASE2','L2-CASE3'].forEach(id=>{ st.sp[id].rh=56; st.sp[id].temp=22.4; }); st.sp['L2-ORIGINS'].occ=.4; });
        later(5500,()=>{ ['L2-ORIGINS','L2-CASE1','L2-CASE2','L2-CASE3'].forEach(id=>{ st.sp[id].rh=51.5; st.sp[id].temp=21.4; }); st.asset['AHU-EO'].status='ok'; drop(cm.id);
          st.markers.filter(m=>m.target==='L2-ORIGINS').forEach(m=>drop(m.id));
          feed({who:'Collections care agent',level:'inform',sev:'good',title:'Back to 51% RH by 12:25; valve replaced; lender report drafted',body:'Peak 61% for 38 min. Case 1 microclimate peaked at 54% thanks to its silica buffer, so no object damage expected. The agent now alerts at 53% when the forecast is humid.'}); }); },true],
      ['Cap gallery only',c=>{ c.status='Edited: gallery capped; HVAC left on automatic'; st.sp['L2-ORIGINS'].occ=.4; later(3000,()=>{ ['L2-ORIGINS','L2-CASE1'].forEach(id=>st.sp[id].rh=59); }); }]]}); },
 // 3 — blockbuster crush
 ()=>{ layer='pax'; floor='L1'; renderFloors(); clearRoutes(); st.asset['LIFT-B'].status='ok';
   setOcc(s=>s.lv!=='B1',.5); ['L1-MARS-ROVER','L1-MARS-INTRO','L1-MARS-HAB','L1-MARS-METEOR'].forEach(i=>st.sp[i].occ=.96); st.sp['L1-COR-W'].occ=.98; st.sp['L1-COR-W'].queue=26;
   st.sess.forEach(x=>{ if(x.time<'14:00') x.status='Done'; }); const s14=st.sess.find(x=>x.name.startsWith('Mars')&&x.time==='14:00'); s14.status='Over capacity'; s14.booked=212;
   const mq=marker({target:'L1-COR-W',sev:'crit',glyph:'Q',label:'Mars queue 26 min',layer:'any',live:true}); const hm=marker({target:'L1-MARS-INTRO',sev:'warn',glyph:'!',label:'Touring hall 96% of 450',layer:'any'});
   focusSpace('L1-COR-W',85);
   feed({who:'Ticketing agent',level:'wait',sev:'crit',title:'Mars 14:00: 212 at the door for 150 places — pause walk-ups and offer a re-time with the 14:30 planetarium show',
     body:'Late 13:00 holders plus 46 walk-up sales have built a 26-min queue along the west walk, and the touring hall is at 96% of its 450 safe capacity. The 14:30 planetarium "Mars from Orbit" has 128 free seats and the 15:00 Mars slot has 54. Plan: pause Mars walk-up sales until 15:00, offer the 62 unscanned 14:00 holders a free move to 15:00 with planetarium seats at 14:30, open the second scan lane, and run a live "Mars Live" demo in Light & Sound for the queue.',focus:'L1-COR-W',
     actions:[['Approve',c=>{ c.status='Approved by front of house manager'; drop(mq.id);
        const s15=st.sess.find(x=>x.name.startsWith('Mars')&&x.time==='15:00'); s15.booked=150; s15.status='Sold out'; s14.status='Walk-ups paused'; s14.booked=150;
        const p=st.sess.find(x=>x.time==='14:30'); p.booked=114; p.status='Re-timed';
        const R=planRoute('L1-COR-W','L2-PLANET',{},'--accent','Re-timed visitors → planetarium 14:30'); showRouteBox(R);
        feed({who:'Ticketing agent',level:'act',sev:'info',title:'62 offers sent; walk-ups paused; lane 2 open; Mars Live demo starting',body:'"Swap to Mars at 15:00 and get free seats for Mars from Orbit in the planetarium at 14:30?" 41 accepted in the first 4 minutes.'});
        later(2500,()=>{ st.sp['L1-COR-W'].queue=14; st.sp['L1-COR-W'].occ=.75; st.sp['L2-PLANET'].occ=.6; });
        later(5000,()=>{ st.sp['L1-COR-W'].queue=6; st.sp['L1-COR-W'].occ=.5; ['L1-MARS-ROVER','L1-MARS-INTRO','L1-MARS-HAB'].forEach(i=>st.sp[i].occ=.8); drop(hm.id);
          feed({who:'Ticketing agent',level:'inform',sev:'good',title:'Queue down to 6 min; touring hall at 81%',body:'Agent proposes capping walk-up Mars sales at 20 per slot for the rest of the run, and is drafting the change for the commercial team.'}); }); },true],
      ['Second lane only',c=>{ c.status='Edited: second scan lane only'; drop(mq.id); later(3000,()=>{ st.sp['L1-COR-W'].queue=17; }); }]]}); },
 // 4 — energy setback
 ()=>{ layer='energy'; floor='all'; renderFloors(); clearRoutes(); st.sess.forEach(x=>x.status='Done');
   V.spaces.forEach(s=>{ if(s.cap&&s.side!=='boh') { st.sp[s.id].occ=0; st.sp[s.id].queue=null; } }); st.sp['L3-SKY'].occ=.75; st.sp['L3-TERRACE'].occ=.2; st.eventKw=60;
   focusSpace('L3-SKY',150);
   feed({who:'Energy agent',level:'wait',sev:'cool',title:'Closed to the public: set back 7 air handlers and put 60 interactives on standby — but keep conservation control on',
     body:'Last visitor out 17:41, galleries swept 18:05. Only the Skyline Room event (160 guests, until 23:30) is running. Plan: set back AHU-B1, G1, G2, T, L1, L2 and PL to 27°C/16°C until 08:00, with pre-start at 07:00. AHU-EO (Earth & Origins loans) and AHU-CS (collection store) stay on conservation control at 21°C/50% RH; they are never set back. AHU-L3 stays on until the event ends. Exhibits go to standby. Saves about 390 kW, about 3.3 MWh by morning.',focus:'L3-AHU-EO',
     actions:[['Approve setback',c=>{ c.status='Approved by duty facilities engineer'; ['AHU-B1','AHU-G1','AHU-G2','AHU-T','AHU-L1','AHU-L2','AHU-PL'].forEach(a=>st.asset[a].mode='setback');
        V.assets.forEach(a=>{ if(a.kind==='exhibit') st.asset[a.id].mode='standby'; });
        marker({target:'L2-ORIGINS',sev:'info',glyph:'C',label:'Conservation control held',layer:'any'});
        feed({who:'Energy agent',level:'inform',sev:'cool',title:'Setback active; conservation AHUs untouched',body:'Earth & Origins 21.0°C · 50% RH. Agent will propose AHU-L3 setback when the Skyline Room clears.'});
        later(3000,()=>{ feed({who:'Energy agent',level:'wait',sev:'cool',title:'Skyline Room clear at 23:34 — set back AHU-L3 too?',body:'Caterers are out; security has swept the roof. Saves another 46 kW.',focus:'L3-SKY',
          actions:[['Approve',c2=>{ c2.status='Approved'; st.asset['AHU-L3'].mode='setback'; st.eventKw=0; st.sp['L3-SKY'].occ=0; st.sp['L3-TERRACE'].occ=0; },true],['Not yet',c2=>{ c2.status='Declined: event crew packing down until 00:30'; }]]}); }); },true],
      ['Exhibits standby only',c=>{ c.status='Edited: exhibits to standby, HVAC unchanged'; V.assets.forEach(a=>{ if(a.kind==='exhibit') st.asset[a.id].mode='standby'; }); }]]}); },
 // 5 — motion alarm
 ()=>{ layer='all'; floor='L2'; renderFloors(); clearRoutes(); st.eventKw=0; st.asset['AHU-L3'].mode='setback'; st.sp['L3-SKY'].occ=0; st.sp['L3-TERRACE'].occ=0; st.sp['L3-SEC'].occ=.5; V.spaces.forEach(s=>{ if(s.side!=='boh') st.sp[s.id].occ=0; });
   const am=marker({target:'L2-EX10',sev:'crit',glyph:'!',label:'PIR alarm · Space & Flight',layer:'any',live:true}); focusSpace('L2-FLIGHT',80);
   feed({who:'Security agent',level:'wait',sev:'crit',title:'01:12 motion alarm in Space & Flight near the Apollo replica — send a guard; police not needed yet',
     body:'CCTV camera L2-07 shows a small moving shape at head height, no person-sized heat signature. No staff badge has been used on L2 since 00:41, and the cleaning contractor signed off at 00:30. All doors and windows on L2 are closed. Most likely cause: something drifting in the air flow. Plan: send guard 2 from the security control room via the plant door and Lift A, turn L2 lights to 50% for the camera, and keep the police on standby.',focus:'L2-EX10',
     actions:[['Send guard',c=>{ c.status='Approved by night security supervisor'; const R=planRoute('L3-SEC','L2-FLIGHT',{staff:true},'--warn','Guard 2 → Space & Flight',9000); showRouteBox(R);
        later(4000,()=>{ drop(am.id); marker({target:'L2-EX10',sev:'good',glyph:'✓',label:'All clear · stray balloon',layer:'any'});
          feed({who:'Security agent',level:'inform',sev:'good',title:'All clear at 01:19: a helium balloon from the Skyline Room event drifted down the atrium void',body:'Guard 2 removed it. Agent added "balloons removed" to the event close-out checklist and set L2 lighting back to night mode.'}); }); },true],
      ['Send guard and call police',c=>{ c.status='Approved: guard sent, police called'; planRoute('L3-SEC','L2-FLIGHT',{staff:true},'--warn','Guard 2 → Space & Flight',9000); }]]}); }
 ]
};
function setOcc(pred,v){ V.spaces.forEach(s=>{ if(s.cap&&pred(s)) st.sp[s.id].occ=v; }); }

