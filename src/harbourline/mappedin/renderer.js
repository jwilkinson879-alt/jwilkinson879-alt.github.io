const SDK_URL='https://cdn.jsdelivr.net/npm/@mappedin/mappedin-js@6.27.0/+esm';
/*@@MVF@@*/
// ================= Mappedin SDK renderer (replaces the three.js view) =================
// The venue is hydrated from an MVF generated from the same venue brief; no Maker step and no API key.
const MI={mv:null,md:null,sp:{},ob:{},fl:{},ready:false,cur:'@@MIFLOOR@@',markers:{},labels:[],pathTok:0,hover:null,mouse:[0,0]};
function initThree(){ const host=document.createElement('div'); host.id='mimap'; host.style.cssText='position:absolute;inset:0'; stage.insertBefore(host,overlay);
  stage.addEventListener('mousemove',e=>{ const r=stage.getBoundingClientRect(); MI.mouse=[e.clientX-r.left,e.clientY-r.top]; if(MI.hover) placeTip(); });
  stage.addEventListener('mouseleave',()=>{ MI.hover=null; tip.hidden=true; });
  (async()=>{ try{
    const SDK=await import(SDK_URL); const md=await SDK.hydrateMapData(MVF);
    const mv=await SDK.show3dMap(host,md,{outdoorView:{enabled:false},initialFloor:'f_@@MIFLOOR@@',shadingAndOutlines:true,wallTopColor:'#9FB0C6',pitch:52,bearing:-18,
      style:{backgroundColor:css('--scene')||'#070D18',backgroundAlpha:1}});
    md.getByType('space').forEach(s=>MI.sp[s.externalId]=s); md.getByType('object').forEach(o=>MI.ob[o.externalId]=o); md.getByType('floor').forEach(f=>MI.fl[f.externalId]=f);
    MI.md=md; MI.mv=mv; MI.ready=true;
    Object.values(MI.sp).forEach(s=>{ try{ mv.updateState(s,{interactive:true}); }catch(e){} }); Object.values(MI.ob).forEach(o=>{ try{ mv.updateState(o,{interactive:true}); }catch(e){} });
    mv.on('click',e=>{ const t=(e.objects&&e.objects[0])||(e.spaces&&e.spaces[0]); sel=t?t.externalId:null; renderDetail(); paint(); });
    mv.on('hover',e=>{ const t=(e.objects&&e.objects[0])||(e.spaces&&e.spaces[0]); MI.hover=t?t.externalId:null; if(MI.hover) placeTip(); else tip.hidden=true; });
    mv.on('floor-change',e=>{ const f=e.floor&&e.floor.externalId; if(f&&f!==MI.cur){ MI.cur=f; if(floor!=='all') floor=f; renderFloors(); renderLegend(); syncOverlays(); } });
    const loading=document.getElementById('miload'); if(loading) loading.remove();
    renderFloors(); paint(true); setView('overview',true);
  }catch(err){ stage.insertAdjacentHTML('beforeend',`<div class="fallback">The Mappedin map could not start here (${String(err&&err.message||err).slice(0,120)}). The operations panels still work.</div>`); } })();
  return true; }
function placeTip(){ const s=SPC[MI.hover]; if(!s){ tip.hidden=true; return; } const m=metric(s);
  tip.innerHTML=`<b>${s.name}</b><span>${s.lv} · ${V.levels[LVI[s.lv]].name}${m?' · '+m:''}</span>`; tip.hidden=false;
  tip.style.left=Math.min(stage.clientWidth-270,MI.mouse[0]+14)+'px'; tip.style.top=(MI.mouse[1]+14)+'px'; }
function curLv(){ return floor==='all'?MI.cur:floor; }
function renderFloors(){ const f=document.getElementById('floors'); const cur=curLv();
  f.innerHTML=V.levels.slice().reverse().map(l=>`<button data-f="${l.id}" aria-pressed="${cur===l.id}">${l.id} ${l.name}</button>`).join('');
  f.querySelectorAll('button').forEach(b=>b.onclick=()=>{ floor=b.dataset.f; renderFloors(); renderLegend(); paint(); setView('overview'); });
  if(MI.ready&&cur!==MI.cur&&MI.fl[cur]){ MI.cur=cur; MI.mv.setFloor(MI.fl[cur].id); } }
function targetOf(id){ return MI.ob[id]||MI.sp[id]; }
function paint(){ if(!MI.ready) return; const mv=MI.mv;
  V.spaces.forEach(s=>{ const t=targetOf(s.id); if(!t) return; let col=sel===s.id?css('--accent'):colorFor(s); try{ mv.updateState(t,{color:col}); }catch(e){} });
  syncOverlays(); }
function syncOverlays(){ if(!MI.ready) return; syncLabels(); syncMarkers(); drawRoutes(); }
function syncLabels(){ const mv=MI.mv; try{ mv.Labels.removeAll(); }catch(e){} const lv=curLv();
  V.spaces.forEach(s=>{ if(s.lv!==lv) return; const t=targetOf(s.id); if(!t) return; const k=keyFor(s); const big=s.kind==='hall'||s.cat==='gallery'||(s.cap>=60&&s.kind!=='corridor')||(P.bigLabel&&P.bigLabel(s));
    const hot=k==='crit'||k==='warn'; if(!(big||hot||sel===s.id)||s.kind==='core') return; const m=metric(s);
    try{ mv.Labels.add(t, s.name+(m?' · '+m:''), {appearance:{text:{foregroundColor:'#E6EDF5',backgroundColor:'#0B1220'},marker:{foregroundColor:{active:hot?(k==='crit'?'#FF6B4A':'#F5B841'):'#3DDC97',inactive:'#5C6B82'}}}}); }catch(e){ try{ mv.Labels.add(t,s.name); }catch(_){} } }); }
function syncMarkers(){ const mv=MI.mv; const want={}; st.markers.forEach(m=>{ const s=SPC[m.target]; if(!s) return; want[m.id]=m; });
  Object.keys(MI.markers).forEach(id=>{ if(!want[id]){ try{ mv.Markers.remove(MI.markers[id]); }catch(e){} delete MI.markers[id]; } });
  Object.values(want).forEach(m=>{ if(MI.markers[m.id]) return; const t=targetOf(m.target); if(!t) return; const c={crit:'#FF6B4A',warn:'#F5B841',good:'#3DDC97',info:'#3DDC97',cool:'#6EA8FF'}[m.sev]||'#3DDC97';
    const html=`<div class="mipin${m.live?' live':''}" style="--c:${c}"><span class="g">${m.glyph}</span><span class="t">${m.label}</span></div>`;
    try{ MI.markers[m.id]=mv.Markers.add(t,html,{rank:'always-visible'}); }catch(e){ try{ MI.markers[m.id]=mv.Markers.add(t,html); }catch(_){} } }); }
async function drawRoutes(){ if(!MI.ready) return; const tok=++MI.pathTok; const mv=MI.mv; try{ mv.Paths.removeAll(); }catch(e){}
  for(const R of st.routes){ const a=MI.sp[R.from]||MI.ob[R.from], b=MI.sp[R.to]||MI.ob[R.to]; if(!a||!b) continue;
    let d=null; try{ d=await mv.getDirections(a,b,{accessible:!!(R.opts&&R.opts.accessible)}); }catch(e){} if(tok!==MI.pathTok) return; if(!d) continue;
    R.mi=Math.round(d.distance); try{ mv.Paths.add(d.coordinates,{color:css(R.color)||R.color||'#3DDC97',width:1.2}); }catch(e){} } }
function flyTo(){}
function setView(v,instant){ if(!MI.ready) return; const lv=curLv(); const sp=V.spaces.filter(s=>s.lv===lv&&MI.sp[s.id]).map(s=>MI.sp[s.id]);
  try{ MI.mv.Camera.focusOn(sp,{pitch:48,bearing:-18,duration:instant?0:900,screenOffsets:{top:40,bottom:20,left:20,right:200}}); }catch(e){} }
function focusSpace(id){ const s=SPC[id]; if(!s) return; if(curLv()!==s.lv){ floor=s.lv; renderFloors(); paint(); }
  if(!MI.ready) return; const t=targetOf(id); if(!t) return;
  // frame the target with its neighbours (centres within 45 m on the same floor) so the context stays in view
  const cx=s.x+s.w/2, cy=s.y+s.h/2;
  const near=V.spaces.filter(o=>o.lv===s.lv&&MI.sp[o.id]&&o.kind!=='core'&&Math.hypot(o.x+o.w/2-cx,o.y+o.h/2-cy)<45).map(o=>MI.sp[o.id]);
  try{ MI.mv.Camera.focusOn(near.length>1?[t,...near]:t,{pitch:50,duration:900,screenOffsets:{top:60,bottom:40,left:60,right:200}}); }catch(e){} }
function applyTheme(){} function resize(){}

