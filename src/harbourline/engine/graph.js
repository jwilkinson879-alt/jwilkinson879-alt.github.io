// Walk-network builder + router for venue templates. Pure functions, used by the twin page and by tests.
function buildGraph(V){
  const nodes=[], adj=[]; const key=new Map();
  const addNode=(lv,side,x,y)=>{const k=lv+'|'+side+'|'+Math.round(x*2)/2+'|'+Math.round(y*2)/2; if(key.has(k)) return key.get(k);
    const id=nodes.length; nodes.push({id,lv,side,x,y}); adj.push([]); key.set(k,id); return id;};
  const addEdge=(a,b,cost,via)=>{ if(a===b) return; adj[a].push({to:b,cost,via}); adj[b].push({to:a,cost,via}); };
  // segments
  const segs=[]; V.spines.forEach((s,si)=>{ for(let i=0;i<s.pts.length-1;i++){ const [x1,y1]=s.pts[i],[x2,y2]=s.pts[i+1]; if(x1===x2&&y1===y2) continue; segs.push({lv:s.lv,side:s.side,x1,y1,x2,y2,att:[]}); } });
  const proj=(sg,x,y)=>{const dx=sg.x2-sg.x1,dy=sg.y2-sg.y1,L2=dx*dx+dy*dy; let t=((x-sg.x1)*dx+(y-sg.y1)*dy)/L2; t=Math.max(0,Math.min(1,t));
    const px=sg.x1+t*dx,py=sg.y1+t*dy; return {t,px,py,d:Math.hypot(x-px,y-py)};};
  const nearest=(lv,side,x,y)=>{let best=null; for(const sg of segs){ if(sg.lv!==lv||sg.side!==side) continue; const p=proj(sg,x,y); if(!best||p.d<best.p.d) best={sg,p}; } return best;};
  // spine endpoints attach onto other segments (T-junctions)
  for(const s of V.spines){ for(const pt of s.pts){ for(const sg of segs){ if(sg.lv!==s.lv||sg.side!==s.side) continue; const p=proj(sg,pt[0],pt[1]); if(p.d<0.75) sg.att.push({t:p.t,x:p.px,y:p.py}); } } }
  // destinations
  const spaceNode={};
  const pending=[];
  for(const sp of V.spaces){ if(sp.kind==='track'||sp.kind==='core') continue; const cx=sp.x+sp.w/2, cy=sp.y+sp.h/2; const n=nearest(sp.lv,sp.side,cx,cy); if(!n) continue;
    n.sg.att.push({t:n.p.t,x:n.p.px,y:n.p.py}); pending.push([sp.id,n.sg.lv,n.sg.side,n.p.px,n.p.py,cx,cy]); }
  const connStops=[];
  for(const c of V.connectors){ const ids=[]; for(const st of c.stops){ const n=nearest(st.lv,st.side,st.x,st.y); if(!n){ids.push(null);continue;} n.sg.att.push({t:n.p.t,x:n.p.px,y:n.p.py}); ids.push([n.sg.lv,n.sg.side,n.p.px,n.p.py,st]); } connStops.push([c,ids]); }
  // build segment chains
  const WALK=1.3;
  for(const sg of segs){ const pts=[{t:0,x:sg.x1,y:sg.y1},{t:1,x:sg.x2,y:sg.y2},...sg.att].sort((a,b)=>a.t-b.t); let prev=null;
    for(const p of pts){ const id=addNode(sg.lv,sg.side,p.x,p.y); if(prev!==null&&prev!==id){ const a=nodes[prev],b=nodes[id]; addEdge(prev,id,Math.hypot(a.x-b.x,a.y-b.y)/WALK,'walk'); } prev=id; } }
  for(const [sid,lv,side,px,py,cx,cy] of pending){ const a=addNode(lv,side,px,py); spaceNode[sid]=a; }
  // connectors
  const LV=Object.fromEntries(V.levels.map(l=>[l.id,l.elev]));
  const connEdges=[];
  for(const [c,ids] of connStops){ const ns=ids.map(v=>v?addNode(v[0],v[1],v[2],v[3]):null);
    for(let i=0;i<ns.length-1;i++){ if(ns[i]==null||ns[i+1]==null) continue; const dh=Math.abs(LV[nodes[ns[i]].lv]-LV[nodes[ns[i+1]].lv]);
      const cost = c.cost!=null?c.cost : c.type==='screen'?60 : c.type==='apm'?150 : c.type==='lift'?35+dh*1.5 : c.type==='esc'?12+dh*2.5 : 15+dh*3;
      const E={cost,via:c.id,type:c.type,acc:c.acc,staff:!!c.staff}; adj[ns[i]].push({to:ns[i+1],...E}); if(!c.oneway) adj[ns[i+1]].push({to:ns[i],...E}); connEdges.push([ns[i],ns[i+1],c.id]); } }
  return {nodes,adj,spaceNode,connEdges};
}
function route(G,from,to,opts={}){ // from/to node ids; opts.accessible excludes esc/stairs; opts.avoid = set of connector ids
  const N=G.nodes.length, dist=new Float64Array(N).fill(Infinity), prev=new Int32Array(N).fill(-1), pv=new Array(N); dist[from]=0;
  const heap=[[0,from]]; const push=(e)=>{heap.push(e); let i=heap.length-1; while(i>0){const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p;}};
  const pop=()=>{const top=heap[0], last=heap.pop(); if(heap.length){heap[0]=last; let i=0; for(;;){let l=2*i+1,r=l+1,m=i; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m;}} return top;};
  while(heap.length){ const [d,u]=pop(); if(d>dist[u]) continue; if(u===to) break;
    for(const e of G.adj[u]){ if(opts.accessible&&e.type&&!e.acc) continue; if(e.staff&&!opts.staff) continue; if(opts.avoid&&opts.avoid.has(e.via)) continue;
      const nd=d+e.cost; if(nd<dist[e.to]){dist[e.to]=nd; prev[e.to]=u; pv[e.to]=e; push([nd,e.to]);} } }
  if(dist[to]===Infinity) return null; const path=[]; const vias=[]; for(let v=to; v!==-1; v=prev[v]){ path.push(v); if(pv[v]&&pv[v].type) vias.push(pv[v].via); }
  return {path:path.reverse(), cost:dist[to], vias:[...new Set(vias.reverse())]};
}
if(typeof module!=='undefined') module.exports={buildGraph,route};

