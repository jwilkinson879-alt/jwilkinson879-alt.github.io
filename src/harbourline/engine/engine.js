(function(){
const LVI=Object.fromEntries(V.levels.map((l,i)=>[l.id,i]));
const SPC=Object.fromEntries(V.spaces.map(s=>[s.id,s]));
const G=buildGraph(V);
const VW=Object.assign({cx:160,cy:290,dist:240,lab:[-5,60]},V.view||{});
const GAP=11, K=0.25, CX=VW.cx, CY=VW.cy; // metres -> units
const W=(x,y,lv)=>[ (x-CX)*K, LVI[lv]*GAP, (y-CY)*K ];
/*@@PACK@@*/
const BEATS=P.beats;
let st, layer='all', floor='all', sel=null, timers=[], T=null;

// ---------------- state ----------------
function fresh(){
  const sp={};
  V.spaces.forEach((s,i)=>{ const base=(P.occBase||{})[s.lv]??.2;
    sp[s.id]={occ: s.cap? Math.min(.6, base*(.6+((i*37)%50)/60)) : 0, queue:null, status:'ok', temp:22.2+((i*13)%14)/10};
  });
  const ahu={}; V.assets.forEach(a=>{ ahu[a.id]={status:'ok',mode:'occupied',note:''}; });
  const o={beat:0,sp,asset:ahu,markers:[],feed:[],routes:[],ids:0,kw:0}; if(P.fresh) P.fresh(o); return o;
}
const later=(ms,fn)=>{ const t={fn,done:false}; t.id=setTimeout(()=>{ if(t.done) return; t.done=true; fn(); render(); },ms); timers.push(t); };
function flushTimers(){ timers.forEach(t=>{ clearTimeout(t.id); if(!t.done){ t.done=true; try{ t.fn(); }catch(e){} } }); timers=[]; }
const uid=()=>++st.ids;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const tint=Object.assign({seating:'--t-seat',field:'--t-field',medical:'--t-wash',merch:'--t-retail',members:'--t-lounge',suite:'--t-lounge',media:'--t-plant',gallery:'--t-lounge',exhibit:'--t-lounge'},P.tint||{},{gate:'--t-gate',retail:'--t-retail',fnb:'--t-fnb',washroom:'--t-wash',boh:'--t-boh',baggage:'--t-boh',plant:'--t-plant',ops:'--t-plant',office:'--t-plant',lounge:'--t-lounge',belt:'--t-boh',checkin:'--t-hall',security:'--t-hall',plaza:'--t-hall',border:'--t-hall',circulation:'--t-hall',landside:'--t-hall',transport:'--t-hall',apm:'--t-gate',service:'--t-hall'});
function occKey(s,v){ if(!s.cap) return 'idle'; if(v.queue!=null&&v.queue>=20) return 'crit'; if(v.queue!=null&&v.queue>=12) return 'warn'; return v.occ>=.85?'crit':v.occ>=.65?'warn':'ok'; }
function assetKeyFor(s){ const id=s.asset|| (s.kind==='object'&&s.cat==='belt'? s.id.replace('L1-',''):null) || (s.kind==='core'? s.id.slice(s.lv.length+1):null);
  if(id&&st.asset[id]){ const a=st.asset[id].status; return a==='fault'?'crit':a==='repair'?'warn':'ok'; } if(s.ahu&&st.asset[s.ahu]&&st.asset[s.ahu].status==='fault') return 'warn'; return null; }
function keyFor(s){ const v=st.sp[s.id]; const pk=P.key&&P.key(s,layer,v); if(pk) return pk;
  if(layer==='pax') return occKey(s,v);
  if(layer==='assets'){ const a=assetKeyFor(s); return a||'tint'; }
  if(layer==='energy'){ if(!s.ahu) return 'tint'; return st.asset[s.ahu]&&st.asset[s.ahu].mode==='setback'?'cool':'ok'; }
  if(layer!=='all') return 'tint';
  const ks=[occKey(s,v), assetKeyFor(s)||'ok', ...(P.extraKeys?P.extraKeys(s,v):[])];
  if(s.ahu&&st.asset[s.ahu]&&st.asset[s.ahu].mode==='setback') return 'cool';
  return ks.includes('crit')?'crit':ks.includes('warn')?'warn':ks.includes('acc')?'acc':'tint';
}
function colorFor(s){ const k=keyFor(s); if(k==='tint') return css(tint[s.cat]||'--t-hall'); return css({ok:'--c-ok',warn:'--c-warn',crit:'--c-crit',idle:'--c-idle',cool:'--c-cool',acc:'--c-acc'}[k]); }
function metric(s){ const v=st.sp[s.id]; const pm=P.metric&&P.metric(s,layer,v); if(pm!=null) return pm;
  if(layer==='assets'||layer==='energy'){ if(s.asset&&st.asset[s.asset]) return st.asset[s.asset].status==='ok'?(st.asset[s.asset].mode==='setback'?'setback':'running'):st.asset[s.asset].status; if(s.ahu) return `${s.ahu} · ${st.asset[s.ahu].mode}`; return ''; }
  if(v.queue!=null) return `queue ${v.queue} min`;
  return s.cap?`${Math.round(v.occ*100)}%`:'';
}

// ---------------- 3D scene ----------------
const stage=document.getElementById('stage'), overlay=document.getElementById('overlay'), tip=document.getElementById('tip');
function initThree(){
  if(!window.THREE){ stage.insertAdjacentHTML('beforeend','<div class="fallback">The 3D view needs WebGL and could not load here. The operations panels still work.</div>'); return; }
  const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
  stage.insertBefore(renderer.domElement,overlay);
  const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(38,1.6,1,2000);
  const controls=new THREE.OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08; controls.maxPolarAngle=1.4; controls.minDistance=12; controls.maxDistance=420;
  scene.add(new THREE.HemisphereLight(0xdfe9ff,0x223044,1.05)); const sun=new THREE.DirectionalLight(0xffffff,.5); sun.position.set(-60,140,80); scene.add(sun);
  const levels=V.levels.map((l,i)=>{const g=new THREE.Group(); g.position.y=i*GAP; scene.add(g); return g;});
  const H={room:1.3,hall:.18,corridor:.12,object:.55,core:2.2,track:.35,tier:1.8,field:.08};
  const meshes={}, pick=[];
  V.spaces.forEach(s=>{ const h=H[s.kind]||.5, w=Math.max(.4,s.w*K-.12), d=Math.max(.4,s.h*K-.12);
    const [x,,z]=W(s.x+s.w/2,s.y+s.h/2,s.lv);
    const mat=new THREE.MeshLambertMaterial({color:0xdddddd,transparent:s.kind==='room',opacity:s.kind==='room'?.9:1});
    let geo; if(s.shape==='ellipse'){ geo=new THREE.CylinderGeometry(.5,.5,h,64); geo.scale(w,1,d); } else geo=new THREE.BoxGeometry(w,h,d);
    const m=new THREE.Mesh(geo,mat); if(s.rot) m.rotation.y=-s.rot; m.position.set(x,h/2+(s.kind==='object'?.12:s.kind==='corridor'?.02:0),z); m.userData.id=s.id;
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry,20),new THREE.LineBasicMaterial({color:0x8899aa,transparent:true,opacity:s.kind==='hall'||s.kind==='corridor'||s.kind==='field'?.35:.7})); m.add(e);
    levels[LVI[s.lv]].add(m); meshes[s.id]={m,mat,edge:e.material,cur:new THREE.Color(0xdddddd),target:new THREE.Color(0xdddddd)}; pick.push(m); });
  // vertical cores as columns between stops
  const coreMat=new THREE.MeshLambertMaterial({color:0x99aabb,transparent:true,opacity:.35}); const vert=new THREE.Group(); scene.add(vert);
  V.connectors.forEach(c=>{ if(c.type==='apm'||c.type==='screen') return; const ys=c.stops.map(s=>LVI[s.lv]*GAP); const lo=Math.min(...ys), hi=Math.max(...ys); if(hi===lo) return;
    const s0=c.stops[0]; const [x,,z]=W(s0.x,s0.y,s0.lv); const col=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,hi-lo,8),coreMat); col.position.set(x,(hi+lo)/2+1,z); vert.add(col); });
  // people
  const MAXP=6000, pos=new Float32Array(MAXP*3); const pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const people=new THREE.Points(pg,new THREE.PointsMaterial({color:0x223344,size:.55,sizeAttenuation:true})); scene.add(people);
  const agents=[]; V.spaces.forEach(s=>{ if(!s.cap||s.kind==='object'||s.kind==='core'||s.kind==='track') return; const n=Math.min(70,Math.round(s.cap/14)); for(let k=0;k<n&&agents.length<MAXP;k++) agents.push({s:s.id,k,n,x:s.x+Math.random()*s.w,y:s.y+Math.random()*s.h,vx:0,vy:0}); });
  const grid=new THREE.GridHelper(260,52,new THREE.Color(css('--grid2')),new THREE.Color(css('--grid'))); grid.position.y=-2.5; scene.add(grid);
  const routeGroup=new THREE.Group(); scene.add(routeGroup);
  T={renderer,scene,camera,controls,levels,meshes,pick,vert,people,pg,pos,agents,routeGroup,fly:null,walkers:[]};
  applyTheme(); new ResizeObserver(resize).observe(stage); resize(); setView('overview',true);
  const ray=new THREE.Raycaster(), v2=new THREE.Vector2(); let down=null;
  const hit=(e)=>{const r=renderer.domElement.getBoundingClientRect(); v2.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(v2,camera);
    const h=ray.intersectObjects(pick.filter(o=>o.parent.visible),false)[0]; return h&&h.object.userData.id;};
  renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
  renderer.domElement.addEventListener('pointerup',e=>{ if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5) return; const id=hit(e); sel=id||null; renderDetail(); paint(); });
  renderer.domElement.addEventListener('pointermove',e=>{ if(e.buttons) {tip.hidden=true;return;} const id=hit(e); if(!id){tip.hidden=true;return;} const s=SPC[id]; const r=stage.getBoundingClientRect();
    tip.innerHTML=`<b>${s.name}</b><span>${s.lv} · ${V.levels[LVI[s.lv]].name}${metric(s)?' · '+metric(s):''}</span>`; tip.hidden=false;
    tip.style.left=Math.min(r.width-270,e.clientX-r.left+14)+'px'; tip.style.top=(e.clientY-r.top+14)+'px'; });
  renderer.domElement.addEventListener('pointerleave',()=>{tip.hidden=true});
  requestAnimationFrame(loop);
}
function applyTheme(){ if(!T) return; T.scene.background=new THREE.Color(css('--scene')); T.people.material.color.set(css('--people'));
  Object.values(T.meshes).forEach(m=>m.edge.color.set(css('--edge'))); drawRoutes(); paint(true); }
function resize(){ if(!T) return; const w=stage.clientWidth,h=stage.clientHeight; T.renderer.setSize(w,h,false); T.camera.aspect=w/h; T.camera.updateProjectionMatrix(); }
function paint(instant){ if(!T) return; V.spaces.forEach(s=>{ const m=T.meshes[s.id]; m.target.set(sel===s.id?css('--accent'):colorFor(s)); if(instant) m.cur.copy(m.target); });
  T.levels.forEach((g,i)=>{ g.visible= floor==='all' || V.levels[i].id===floor; }); T.vert.visible=floor==='all'; drawRoutes(); }
function flyTo(tx,ty,tz,dist,instant){ if(!T) return; const tgt=new THREE.Vector3(tx,ty,tz); const dir=new THREE.Vector3(-.55,.9,.95).normalize(); const pos=tgt.clone().add(dir.multiplyScalar(dist));
  if(instant){ T.camera.position.copy(pos); T.controls.target.copy(tgt); return; }
  T.fly={t0:performance.now(),dur:1200,fp:T.camera.position.clone(),ft:T.controls.target.clone(),tp:pos,tt:tgt}; }
function setView(v,instant){ if(v==='overview') flyTo(0,floor==='all'?GAP*(V.levels.length-1)/2:LVI[floor]*GAP,0,floor==='all'?VW.dist:VW.dist*.7,instant); }
function focusSpace(id,dist){ const s=SPC[id]; if(!s) return; if(floor!=='all'&&floor!==s.lv){ floor=s.lv; renderFloors(); paint(); } const [x,y,z]=W(s.x+s.w/2,s.y+s.h/2,s.lv); flyTo(x,y,z,dist||70); }
function routeNodesToPts(r){ return r.path.map(n=>{const nd=G.nodes[n]; const [x,y,z]=W(nd.x,nd.y,nd.lv); return new THREE.Vector3(x,y+.9,z);}); }
function drawRoutes(){ if(!T) return; while(T.routeGroup.children.length) T.routeGroup.remove(T.routeGroup.children[0]); T.walkers=[];
  st.routes.forEach(R=>{ const pts=R.pts.filter(p=> floor==='all' || Math.abs(p.y-.9-LVI[floor]*GAP)<.01); if(pts.length<2) return;
    const path=new THREE.CurvePath(); for(let i=0;i<pts.length-1;i++){ if(pts[i].distanceTo(pts[i+1])<.01) continue; path.add(new THREE.LineCurve3(pts[i],pts[i+1])); } if(!path.curves.length) return;
    const col=new THREE.Color(css(R.color||'--accent')); const mat=new THREE.MeshLambertMaterial({color:col,emissive:col,emissiveIntensity:.85});
    T.routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(path,Math.min(600,path.curves.length*12),.32,6,false),mat));
    const w=new THREE.Mesh(new THREE.SphereGeometry(.75,14,10),mat); T.routeGroup.add(w); T.walkers.push({w,path,speed:R.speed||14000}); }); }
let lastLab=0;
function loop(now){ requestAnimationFrame(loop);
  if(T.fly){const k=Math.min(1,(now-T.fly.t0)/T.fly.dur), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; T.camera.position.lerpVectors(T.fly.fp,T.fly.tp,e); T.controls.target.lerpVectors(T.fly.ft,T.fly.tt,e); if(k>=1) T.fly=null;}
  T.controls.update();
  for(const id in T.meshes){ const m=T.meshes[id]; m.cur.lerp(m.target,.08); m.mat.color.copy(m.cur); }
  const pos=T.pos; const ag=T.agents;
  for(let i=0;i<ag.length;i++){ const a=ag[i], s=SPC[a.s], v=st.sp[a.s]; const show=a.k<Math.round(v.occ*a.n)&&(floor==='all'||floor===s.lv);
    if(!show){pos[i*3+1]=-999;continue}
    a.vx=(a.vx+(Math.random()-.5)*.6)*.9; a.vy=(a.vy+(Math.random()-.5)*.6)*.9; a.x+=a.vx; a.y+=a.vy;
    if(a.x<s.x+1||a.x>s.x+s.w-1){a.vx*=-1;a.x=Math.max(s.x+1,Math.min(s.x+s.w-1,a.x));} if(a.y<s.y+1||a.y>s.y+s.h-1){a.vy*=-1;a.y=Math.max(s.y+1,Math.min(s.y+s.h-1,a.y));}
    let ax=a.x, ay=a.y; if(s.rot){ const cx=s.x+s.w/2, cy=s.y+s.h/2, c=Math.cos(s.rot), sn=Math.sin(s.rot), dx=ax-cx, dy=ay-cy; ax=cx+dx*c-dy*sn; ay=cy+dx*sn+dy*c; }
    const [x,y,z]=W(ax,ay,s.lv); pos[i*3]=x; pos[i*3+1]=y+.5; pos[i*3+2]=z; }
  T.pg.attributes.position.needsUpdate=true;
  T.walkers.forEach(w=>{ const u=(now/w.speed)%1; w.w.position.copy(w.path.getPointAt(u)); });
  T.renderer.render(T.scene,T.camera);
  if(now-lastLab>40){lastLab=now; placeLabels();}
}

// ---------------- overlays ----------------
const labelEls={}, pinEls={}, lvEls={}; let tmp=null;
function project(x,y,z){ tmp=tmp||new THREE.Vector3(); tmp.set(x,y,z).project(T.camera); return tmp.z<1?[(tmp.x+1)/2*stage.clientWidth,(1-tmp.y)/2*stage.clientHeight]:null; }
function placeLabels(){
  const camD=T.camera.position.distanceTo(T.controls.target);
  V.spaces.forEach(s=>{ let el=labelEls[s.id];
    const big=s.w*s.h>=1800||s.cat==='gate'||s.kind==='hall'||(P.bigLabel&&P.bigLabel(s));
    const want = (!(P.noLabel&&P.noLabel(s)) && floor===s.lv && (s.kind!=='object'||camD<(P.objLabelDist||80)) && s.kind!=='core' && s.kind!=='track' && (camD<110||big)) || (floor==='all' && sel===s.id);
    if(!want){ if(el) el.hidden=true; return; }
    if(!el){el=document.createElement('div');el.className='rl';overlay.appendChild(el);labelEls[s.id]=el;}
    const [x,y,z]=W(s.x+s.w/2,s.y+s.h/2,s.lv); const p=project(x,y+({room:1.6,hall:.5}[s.kind]||.8),z); if(!p){el.hidden=true;return;}
    el.hidden=false; el.style.left=p[0]+'px'; el.style.top=p[1]+'px'; const m=metric(s); const html=`<b>${s.name}</b>${m?`<span>${m}</span>`:''}`; if(el._h!==html){el.innerHTML=html;el._h=html;} });
  V.levels.forEach((l,i)=>{ let el=lvEls[l.id]; if(!el){el=document.createElement('div');el.className='lvtag';overlay.appendChild(el);lvEls[l.id]=el;el.textContent=l.id+' · '+l.name;}
    const show=floor==='all'||floor===l.id; const p=show&&project((VW.lab[0]-CX)*K,i*GAP,(VW.lab[1]-CY)*K); if(!p){el.hidden=true;return;} el.hidden=false; el.style.left=p[0]+'px'; el.style.top=p[1]+'px'; });
  const seen={};
  st.markers.forEach(m=>{ seen[m.id]=1; let el=pinEls[m.id];
    if(!el){el=document.createElement('div');el.className='pin';el.innerHTML='<div class="tag"><span class="g"></span><span class="t"></span></div><div class="stem"></div>';overlay.appendChild(el);pinEls[m.id]=el;}
    const s=SPC[m.target]; const show=s&&(floor==='all'||floor===s.lv)&&(layer==='all'||m.layer===layer||m.layer==='any'); const [x,y,z]=s?W(s.x+s.w/2,s.y+s.h/2,s.lv):[0,0,0]; const p=show&&project(x,y+2,z);
    if(!p){el.hidden=true;return;} el.hidden=false; el.style.left=p[0]+'px'; el.style.top=p[1]+'px';
    el.style.setProperty('--c',`var(--${{crit:'crit',warn:'warn',good:'good',info:'accent',cool:'cool'}[m.sev]})`); el.classList.toggle('live',!!m.live);
    el.querySelector('.g').textContent=m.glyph; el.querySelector('.t').textContent=m.label; });
  Object.keys(pinEls).forEach(id=>{ if(!seen[id]){ pinEls[id].remove(); delete pinEls[id]; } });
}

// ---------------- routing helpers ----------------
function planRoute(from,to,opts,color,label,speed){ const r=route(G,G.spaceNode[from],G.spaceNode[to],opts||{}); if(!r) return null;
  const R={id:uid(),from,to,label,color,speed,pts:T?routeNodesToPts(r):[],cost:r.cost,vias:r.vias,opts:opts||{}}; st.routes.push(R); drawRoutes(); return R; }
function viaNames(R){ return R.vias.map(v=>(V.connectors.find(c=>c.id===v)||{}).name||v).join(' → '); }
function showRouteBox(R,extra){ const b=document.getElementById('routebox'); if(!R){b.hidden=true;return;}
  b.hidden=false; b.innerHTML=`<b>${R.label}</b><span>${SPC[R.from].name} → ${SPC[R.to].name}</span><span>${Math.round(R.cost/60)} min${R.opts.accessible?' · step-free':''}${R.vias.length?' · via '+viaNames(R):''}</span>${extra||''}`; }

// ---------------- panels ----------------
function renderLegend(){
  const base={all:[['--c-warn','Needs a look'],['--c-crit','Act now'],['--c-cool','Energy setback'],['--accent','Route']],
    pax:[['--c-ok','Comfortable'],['--c-warn','Busy · queue 12+ min'],['--c-crit','Crowded · queue 20+ min']],
    assets:[['--c-ok','Running'],['--c-warn','Degraded / under repair'],['--c-crit','Fault']],
    energy:[['--c-ok','Occupied mode'],['--c-cool','Setback mode']]};
  const ly=P.layers.find(l=>l[0]===layer)||P.layers[0];
  const L=(P.legend&&P.legend[layer])||base[layer]||[];
  document.getElementById('legend').innerHTML=L.map(([c,t])=>`<span><i style="background:var(${c})"></i>${t}</span>`).join('');
  document.getElementById('maptitle').textContent=ly[2]+(floor==='all'?'':' · '+floor+' '+V.levels[LVI[floor]].name);
}
function renderFloors(){ const f=document.getElementById('floors');
  f.innerHTML=[['all','All levels'],...V.levels.slice().reverse().map(l=>[l.id,l.id+' '+l.name])].map(([id,n])=>`<button data-f="${id}" aria-pressed="${floor===id}">${n}</button>`).join('');
  f.querySelectorAll('button').forEach(b=>b.onclick=()=>{ floor=b.dataset.f; renderFloors(); renderLegend(); paint(); setView('overview'); }); }
function renderDetail(){ const d=document.getElementById('detail');
  if(!sel){ d.innerHTML='<span class="note">Hover for a quick read, click a space for its live state. Pick a level on the right to see every label.</span>'; return; }
  const s=SPC[sel], v=st.sp[sel], kv=(k,x)=>`<span class="kv">${k} <span>${x}</span></span>`;
  let h=`<b>${s.name}</b>`+kv('ID',s.id)+kv('Level',s.lv+' '+V.levels[LVI[s.lv]].name)+kv('Zone',s.zone)+kv('Side',s.side);
  if(s.cap) h+=kv('Occupancy',Math.round(v.occ*100)+'% of '+s.cap); if(v.queue!=null) h+=kv('Queue',v.queue+' min');
  if(s.ahu&&st.asset[s.ahu]) h+=kv('HVAC',s.ahu+' · '+st.asset[s.ahu].mode); if(P.detail) h+=P.detail(s,kv,v);
  if(s.asset&&st.asset[s.asset]) h+=kv('Asset',s.asset+' · '+st.asset[s.asset].status); d.innerHTML=h; }
const LV={act:'<span class="chip act">Act</span>',wait:'<span class="chip wait">Propose &amp; wait</span>',inform:'<span class="chip">Inform</span>'};
function renderFeed(){ const f=document.getElementById('feed'); f.textContent='';
  st.feed.slice().reverse().forEach(c=>{ const div=document.createElement('div'); div.className='card sev-'+c.sev;
    div.innerHTML=`<div class="top"><span class="who">${c.who}</span><span>${c.time} ${LV[c.level]||''}</span></div><h3>${c.title}</h3>${c.body?`<p>${c.body}</p>`:''}`;
    if(c.status){const s=document.createElement('div');s.className='status';s.textContent=c.status;div.appendChild(s);}
    else if(c.actions){const a=document.createElement('div');a.className='acts'; c.actions.forEach(([lab,fn,primary])=>{const b=document.createElement('button');b.className='btn'+(primary?' primary':'');b.textContent=lab;b.onclick=()=>{fn(c);render();};a.appendChild(b);}); div.appendChild(a);}
    if(c.focus){ div.style.cursor='pointer'; div.addEventListener('click',e=>{ if(e.target.tagName!=='BUTTON') focusSpace(c.focus); }); }
    f.appendChild(div); }); }
function renderList(){ document.getElementById('listhead').innerHTML=P.list.head.map(h=>`<th>${h}</th>`).join('');
  document.getElementById('list').innerHTML=P.list.rows();
  document.querySelectorAll('#list tr').forEach(tr=>tr.onclick=()=>{ if(!SPC[tr.dataset.s]) return; sel=tr.dataset.s; focusSpace(sel,60); renderDetail(); paint(); }); }
function renderAssets(){ const list=V.assets.filter(a=>a.kind!=='checkpoint');
  document.getElementById('assetlist').innerHTML=list.map(a=>{const s=st.asset[a.id]; const sp=SPC[a.space]; const ch=s.status==='fault'?'crit':s.status==='repair'?'wait':s.mode==='setback'?'cool':'act';
    return `<tr class="click" data-s="${a.space}"><td class="m">${a.id}</td><td>${sp?sp.lv+' '+(sp.zone||sp.name):''}</td><td><span class="chip ${ch}">${s.status==='ok'?(s.mode==='setback'?'Setback':'Running'):s.status==='fault'?'Fault':'Under repair'}</span></td></tr>`;}).join('');
  document.querySelectorAll('#assetlist tr').forEach(tr=>tr.onclick=()=>{ if(!SPC[tr.dataset.s]) return; sel=tr.dataset.s; focusSpace(sel,60); renderDetail(); paint(); }); }
function kw(){ let k=0; Object.entries(st.asset).forEach(([id,a])=>{ if(!id.startsWith('AHU')) return; k+= a.mode==='setback'?22:a.status==='fault'?40:68; }); return k+(P.kwExtra?P.kwExtra():0); }
function paxCount(){ let pax=0; V.spaces.forEach(s=>{ if(s.cap&&!['boh','plant','ops','office','media'].includes(s.cat)) pax+=st.sp[s.id].occ*s.cap; }); return Math.round(pax); }
function maxQueue(){ return Math.max(0,...Object.values(st.sp).map(v=>v.queue||0)); }
function alerts(){ return st.markers.filter(m=>m.sev==='crit'||m.sev==='warn').length; }
function renderTop(){ const b=BEATS[st.beat]; document.getElementById('clock').firstChild.nodeValue=b.t;
  document.getElementById('steps').innerHTML=BEATS.map((x,i)=>`<li class="${i<st.beat?'done':i===st.beat?'now':''}"><span class="t">${x.t}</span>${x.label}</li>`).join('');
  document.getElementById('next').disabled=st.beat>=BEATS.length-1;
  const K=document.getElementById('kpis'); if(K.children.length!==P.kpis.length) K.innerHTML=P.kpis.map(k=>`<div class="kpi"><div>${k[0]}</div><strong></strong></div>`).join('');
  P.kpis.forEach((k,i)=>{ K.children[i].querySelector('strong').textContent=k[1](); });
  document.querySelectorAll('#layers button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.l===layer)); }
function render(){ renderTop(); renderLegend(); renderDetail(); renderFeed(); renderList(); renderAssets(); paint(); }
function feed(c){ c.id=uid(); c.time=c.time||BEATS[st.beat].t; st.feed.push(c); return c; }
function marker(m){ m.id=uid(); m.beat=st.beat; st.markers.push(m); return m; }
function drop(id){ st.markers=st.markers.filter(m=>m.id!==id); }
function showTab(t){ ['feed','list','assets'].forEach(k=>{ document.getElementById('p-'+k).hidden=k!==t; document.getElementById('tab-'+k).setAttribute('aria-pressed',k===t); }); }
function clearRoutes(){ st.routes=[]; drawRoutes(); showRouteBox(null); }

// ---------------- scenarios ----------------
function start(){ timers.forEach(t=>clearTimeout(t.id)); timers=[]; st=fresh(); layer='all'; floor='all'; sel=null; showTab('feed'); renderFloors(); P.run[0](); render(); paint(true); setView('overview'); showRouteBox(null); }
document.getElementById('next').onclick=()=>{ if(st.beat<BEATS.length-1){ flushTimers(); st.beat++; st.markers=st.markers.filter(m=>m.sev==='crit'||m.sev==='warn'); P.run[st.beat](); render(); showTab('feed'); } };
document.getElementById('restart').onclick=start;
document.getElementById('layers').innerHTML=P.layers.map(l=>`<button data-l="${l[0]}" aria-pressed="false">${l[1]}</button>`).join('');
document.querySelectorAll('#layers button').forEach(b=>b.onclick=()=>{ layer=b.dataset.l; render(); });
['feed','list','assets'].forEach(k=>document.getElementById('tab-'+k).onclick=()=>showTab(k));
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme); }catch(e){}
new MutationObserver(applyTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
setInterval(()=>{ if(!st) return; let i=0; V.spaces.forEach(s=>{ i++; const v=st.sp[s.id]; if(!s.cap||v.occ<.05||v.occ>.8) return; const w=Math.sin(Date.now()/8000+i); v.occ=Math.min(.79,Math.max(.06,v.occ+w*.008)); }); renderTop(); },3000);
/*@@RENDERER@@*/
st=fresh();
try{ initThree(); }catch(e){ stage.insertAdjacentHTML('beforeend','<div class="fallback">The 3D view could not start in this browser. The operations panels still work.</div>'); }
start();
})();
