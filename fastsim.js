// fastsim.js — typed-array reimplementation of the game's simulation, semantics-identical
// to index.html's simFits/simApply/simResolve/simStep/playout, including the exact order
// and count of rng() calls, so proofs generated here reproduce in-game.
const fs = require('fs');

function loadGame(htmlPath) {
  const src = fs.readFileSync(htmlPath, 'utf8');
  let js = src.split('<script>')[1].split('</script>')[0];
  js = js.replace(/const DAILY_TABLE=\{[^;]*\};/,
        "const DAILY_TABLE={};window.__setV=(k,v,tail)=>{DAILY_TABLE[k]=[v,-1,0,tail||''];};")
         .replace("reset('daily',dayKey());\nloadHistory();",
        "window.__t={buildDaily,playout,mulberry,hash,shiftDay,simFits,simApply,simResolve,simStep,KEYS,TAILSHAPES,tailPiece};");
  const made = {};
  function el(id){return {id,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},dataset:{},appendChild(){},addEventListener(){},removeEventListener(){},setAttribute(){},firstChild:null,getBoundingClientRect:()=>({left:0,top:0,width:375,height:375}),offsetHeight:60,offsetWidth:375,clientWidth:384,innerHTML:'',textContent:'',value:'',querySelector(){return el('q')},querySelectorAll(){return []}};}
  global.document={getElementById:id=>made[id]||(made[id]=el(id)),createElement:()=>el('n'),querySelector:()=>el('q'),querySelectorAll:()=>[],documentElement:{style:{setProperty(){}}},body:{classList:{add(){},remove(){},toggle(){}},style:{}},addEventListener(){}};
  global.window={addEventListener(){},innerWidth:390,innerHeight:780,storage:{get:async()=>{throw 0},set:async()=>{}}};
  global.requestAnimationFrame=()=>0;global.cancelAnimationFrame=()=>{};
  global.performance=require('perf_hooks').performance;
  global.setInterval=()=>0;global.setTimeout=()=>0;global.clearInterval=()=>{};global.navigator={};
  new Function(js)();
  return { t: global.window.__t, setV: global.window.__setV };
}

const N = 10, CELLS = 100, DECK_SIZE = 30, TAIL = 10, CHARGE_NEED = 30;

// ---- scratch state (module-level, reused) ----
const scratch = new Int8Array(CELLS);
const markG = new Int32Array(CELLS);
const seenG = new Int32Array(CELLS);
const stack = new Int32Array(CELLS);
const comp  = new Int32Array(CELLS);
let gen = 0, gen2 = 0;

function count(b){let n=0;for(let i=0;i<CELLS;i++)if(b[i])n++;return n;}

// mirrors simResolve: full rows+cols from one snapshot, then same-colour groups >= 3
function resolve(b){
  let killed = 0;
  gen++;
  for(let r=0;r<N;r++){
    const base=r*N; let full=1;
    for(let c=0;c<N;c++) if(!b[base+c]){full=0;break;}
    if(full) for(let c=0;c<N;c++){const i=base+c; if(markG[i]!==gen){markG[i]=gen;killed++;}}
  }
  for(let c=0;c<N;c++){
    let full=1;
    for(let r=0;r<N;r++) if(!b[r*N+c]){full=0;break;}
    if(full) for(let r=0;r<N;r++){const i=r*N+c; if(markG[i]!==gen){markG[i]=gen;killed++;}}
  }
  if(killed) for(let i=0;i<CELLS;i++) if(markG[i]===gen) b[i]=0;

  gen2++;
  let grouped = 0;
  for(let i=0;i<CELLS;i++){
    const col=b[i];
    if(!col||seenG[i]===gen2) continue;
    let sp=0,cn=0;
    stack[sp++]=i; seenG[i]=gen2;
    while(sp){
      const j=stack[--sp]; comp[cn++]=j;
      const r=(j/N)|0, c=j%N;
      if(r>0){const k=j-N; if(b[k]===col&&seenG[k]!==gen2){seenG[k]=gen2;stack[sp++]=k;}}
      if(r<N-1){const k=j+N; if(b[k]===col&&seenG[k]!==gen2){seenG[k]=gen2;stack[sp++]=k;}}
      if(c>0){const k=j-1; if(b[k]===col&&seenG[k]!==gen2){seenG[k]=gen2;stack[sp++]=k;}}
      if(c<N-1){const k=j+1; if(b[k]===col&&seenG[k]!==gen2){seenG[k]=gen2;stack[sp++]=k;}}
    }
    if(cn>=3){ for(let x=0;x<cn;x++) b[comp[x]]=0; grouped+=cn; }
  }
  return killed+grouped;
}

// Evaluates a candidate placement into `scratch` and returns the number of cells
// cleared. A placement can only clear something if it completes a row/column it
// touches, or joins a same-colour group of 3+. When neither holds, the full
// resolve is provably a no-op, so we skip it. Identical results either way.
const touchedR=new Int8Array(N), touchedC=new Int8Array(N);
let lastAfter=0;                                   // cells left after the last evalInto
function evalInto(b,p,r0,c0,before){
  scratch.set(b);
  apply(scratch,p,r0,c0);
  if(p.special){const cl=resolve(scratch);lastAfter=count(scratch);return cl;}
  const o=p.off,cn=p.n;
  for(let i=0;i<N;i++){touchedR[i]=0;touchedC[i]=0;}
  for(let i=0;i<cn;i++){touchedR[r0+o[i*2]]=1;touchedC[c0+o[i*2+1]]=1;}
  for(let r=0;r<N;r++){
    if(!touchedR[r])continue;
    let full=1,base=r*N;
    for(let c=0;c<N;c++)if(!scratch[base+c]){full=0;break;}
    if(full){const cl=resolve(scratch);lastAfter=count(scratch);return cl;}
  }
  for(let c=0;c<N;c++){
    if(!touchedC[c])continue;
    let full=1;
    for(let r=0;r<N;r++)if(!scratch[r*N+c]){full=0;break;}
    if(full){const cl=resolve(scratch);lastAfter=count(scratch);return cl;}
  }
  // only the placed cells changed, so only their components can newly reach 3
  gen2++;
  for(let i=0;i<cn;i++){
    const start=(r0+o[i*2])*N+(c0+o[i*2+1]);
    if(seenG[start]===gen2)continue;
    const col=scratch[start];
    let sp=0,size=0;
    stack[sp++]=start;seenG[start]=gen2;
    while(sp){
      const j=stack[--sp];size++;
      if(size>=3){const cl=resolve(scratch);lastAfter=count(scratch);return cl;}
      const r=(j/N)|0,c=j%N;
      if(r>0){const k=j-N;if(scratch[k]===col&&seenG[k]!==gen2){seenG[k]=gen2;stack[sp++]=k;}}
      if(r<N-1){const k=j+N;if(scratch[k]===col&&seenG[k]!==gen2){seenG[k]=gen2;stack[sp++]=k;}}
      if(c>0){const k=j-1;if(scratch[k]===col&&seenG[k]!==gen2){seenG[k]=gen2;stack[sp++]=k;}}
      if(c<N-1){const k=j+1;if(scratch[k]===col&&seenG[k]!==gen2){seenG[k]=gen2;stack[sp++]=k;}}
    }
  }
  lastAfter=before+p.n;                            // nothing cleared
  return 0;
}

function fits(b,p,r0,c0){
  if(p.special) return true;                       // callers only pass in-bounds r0,c0
  const o=p.off, cn=p.n;
  for(let i=0;i<cn;i++){
    const r=r0+o[i*2], c=c0+o[i*2+1];
    if(r<0||c<0||r>=N||c>=N) return false;
    if(b[r*N+c]) return false;
  }
  return true;
}

function apply(b,p,r0,c0){
  if(p.special===1){                                // bomb: 3x3
    for(let a=-1;a<=1;a++)for(let d=-1;d<=1;d++){
      const r=r0+a,c=c0+d; if(r>=0&&c>=0&&r<N&&c<N) b[r*N+c]=0;
    }
    return;
  }
  if(p.special===2){                                // bolt: full row + full column
    for(let i=0;i<N;i++){ b[r0*N+i]=0; b[i*N+c0]=0; }
    return;
  }
  const o=p.off, cl=p.cols, cn=p.n;
  for(let i=0;i<cn;i++) b[(r0+o[i*2])*N + (c0+o[i*2+1])] = cl[i];
}

const powerPiece = kind => ({special:kind, n:1, off:null, cols:null});

// ---- conversion from the game's object pieces to the fast form ----
function makeConv(KEYS){
  const ci = {}; KEYS.forEach((k,i)=>ci[k]=i+1);
  return {
    piece(p){
      if(p.special) return powerPiece(p.special==='bomb'?1:2);
      const n=p.cells.length, off=new Int8Array(n*2), cols=new Int8Array(n);
      for(let i=0;i<n;i++){ off[i*2]=p.cells[i][0]; off[i*2+1]=p.cells[i][1]; cols[i]=ci[p.colors[i]]; }
      return {special:0,n,off,cols};
    },
    board(arr){
      const b=new Int8Array(CELLS);
      for(let i=0;i<CELLS;i++) b[i]=arr[i]?ci[arr[i].c]:0;
      return b;
    }
  };
}

function step(st,si,r0,c0){
  const p=st.tray[si];
  if(!p.special) st.placed+=p.n;
  apply(st.b,p,r0,c0);
  st.tray[si]=null; st.used++;
  st.charge+=resolve(st.b);
  if(st.charge>=CHARGE_NEED){ st.charge-=CHARGE_NEED; st.queue.unshift(powerPiece(st.PR()<0.5?1:2)); }
  if(!st.tray[0]&&!st.tray[1]&&!st.tray[2])
    st.tray=[st.queue.shift()||null,st.queue.shift()||null,st.queue.shift()||null];
}

// mirrors playout(): same greedy score, same rng() call order (si outer, then r, then c)
function playout(daily,rng,temp){
  const st={b:Int8Array.from(daily.b),queue:daily.q.slice(),tray:null,charge:0,used:0,placed:0,PR:daily.mk()};
  st.tray=[st.queue.shift()||null,st.queue.shift()||null,st.queue.shift()||null];
  while(true){
    if(!st.tray[0]&&!st.tray[1]&&!st.tray[2]) break;
    const before=count(st.b);
    let bestSc=0,bsi=-1,br=0,bc=0,have=false;
    for(let si=0;si<3;si++){
      const p=st.tray[si]; if(!p) continue;
      for(let r=0;r<N;r++)for(let c=0;c<N;c++){
        if(!fits(st.b,p,r,c)) continue;
        const cl=evalInto(st.b,p,r,c,before), after=lastAfter;
        const sc=(before-after)*60+cl*6-after*2+(after===0?5000:0)+rng()*temp;
        if(!have||sc>bestSc){ have=true;bestSc=sc;bsi=si;br=r;bc=c; }
      }
    }
    if(!have) break;
    step(st,bsi,br,bc);
    if(count(st.b)===0) return {won:true,used:st.used};
  }
  return {won:false,used:st.used,left:count(st.b)};
}

module.exports = { loadGame, makeConv, playout, resolve, fits, apply, count, step, evalInto,
                   after:()=>lastAfter,
                   powerPiece, N, CELLS, DECK_SIZE, TAIL, CHARGE_NEED, scratch };
