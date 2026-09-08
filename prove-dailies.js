// Usage: node prove-dailies.js <start-date> <days> <out.json>
//   Run from the repo root, next to index.html. Safe to stop and restart: it skips
//   days already present in <out.json> and rewrites the file after every day.
//   Seed <out.json> with the current table first:  node dump-dailies.js
//   When it finishes:                              node merge-dailies.js dailies.json
//   Roughly 8 seconds per day on one core, so a full run to 2030 takes a few hours.
// For each day: pick a seed variant, PLANT a solution by choosing the last 10 pieces from ordinary
// small single-colour shapes, then check the greedy bot wins 1-16 of 80 (solvable but not easy).
// Stores [variant, first-winning-playout, wins, tail] so the in-game solver reproduces the proof.
const fs=require('fs');
const src=fs.readFileSync('index.html','utf8');
let js=src.split('<script>')[1].split('</script>')[0];
js=js.replace(/const DAILY_TABLE=\{[^;]*\};/,"const DAILY_TABLE={};window.__setV=(k,v,tail)=>{DAILY_TABLE[k]=[v,-1,0,tail||''];};")
     .replace("reset('daily',dayKey());\nloadHistory();","window.__t={buildDaily,playout,mulberry,hash,shiftDay,simFits,simApply,simResolve,simStep,KEYS,TAILSHAPES,tailPiece};");
const made={};
function el(id){return {id,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},dataset:{},appendChild(){},addEventListener(){},removeEventListener(){},setAttribute(){},firstChild:null,getBoundingClientRect:()=>({left:0,top:0,width:375,height:375}),offsetHeight:60,offsetWidth:375,clientWidth:384,innerHTML:'',textContent:'',value:'',querySelector(){return el('q')},querySelectorAll(){return []}};}
global.document={getElementById:id=>made[id]||(made[id]=el(id)),createElement:()=>el('n'),querySelector:()=>el('q'),querySelectorAll:()=>[],documentElement:{style:{setProperty(){}}},body:{classList:{add(){},remove(){},toggle(){}},style:{}},addEventListener(){}};
global.window={addEventListener(){},innerWidth:390,innerHeight:780,storage:{get:async()=>{throw 0},set:async()=>{}}};
global.requestAnimationFrame=f=>0;global.cancelAnimationFrame=()=>{};global.performance=require('perf_hooks').performance;
global.setInterval=()=>0;global.setTimeout=()=>0;global.clearInterval=()=>{};global.navigator={};
new Function(js)();
const t=window.__t,N=10,DECK=30,TAIL=10;
const cnt=b=>{let n=0;for(const v of b)if(v)n++;return n;};
const TAILSET=[];t.TAILSHAPES.forEach((_,sh)=>t.KEYS.forEach((_,ci)=>TAILSET.push({p:t.tailPiece(sh,ci),code:''+sh+ci})));
function ev(b,p,r,c){const b2=b.slice();t.simApply(b2,p,r,c);const cl=t.simResolve(b2);return{after:cnt(b2),cl};}
function bestFor(st,pieces,rng,temp){
  let best=null;const before=cnt(st.board);
  for(const x of pieces)for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    if(!t.simFits(st.board,x.p,r,c))continue;
    const e=ev(st.board,x.p,r,c);
    const sc=(before-e.after)*60+e.cl*6-e.after*2+(e.after===0?5000:0)+rng()*temp;
    if(!best||sc>best.sc)best={sc,x,r,c};
  }
  return best;
}
function design(base,rng){
  const st={board:base.board.slice(),queue:base.queue.slice(0,DECK-TAIL),tray:[],charge:0,used:0,placed:0,PR:t.mulberry(base.prSeed)};
  st.tray=[st.queue.shift(),st.queue.shift(),st.queue.shift()];
  while(st.tray.some(Boolean)){
    const m=bestFor(st,st.tray.map((p,si)=>p?{p,si}:null).filter(Boolean),rng,220);
    if(!m)return null;t.simStep(st,m.x.si,m.r,m.c);
    if(cnt(st.board)===0)return null;                     // emptied before the tail: not a tail puzzle, reroll
  }
  let code='';
  for(let i=0;i<TAIL;i++){
    const m=bestFor(st,TAILSET,rng,60);if(!m)return null;
    code+=m.x.code;st.tray=[m.x.p,null,null];t.simStep(st,0,m.r,m.c);
    if(cnt(st.board)===0){while(code.length<TAIL*2)code+=TAILSET[Math.floor(rng()*TAILSET.length)].code;return code;}
  }
  return null;
}
const START=process.argv[2]||'2026-09-01',DAYS=+(process.argv[3]||120),OUT=process.argv[4]||'variants2.json';
const table=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT,'utf8')):{};
const PLAYOUTS=80,MINW=1,MAXW=16,MAXVAR=6;
let k=START;
for(let d=0;d<DAYS;d++,k=t.shiftDay(k,1)){
  if(table[k])continue;
  let chosen=null,fallback=null;
  for(let v=0;v<MAXVAR&&!chosen;v++){
    window.__setV(k,v,'');
    const base=t.buildDaily(k),drng=t.mulberry(t.hash(k+'|design|'+v)());
    let code=null;for(let a=0;a<30&&!code;a++)code=design(base,drng);
    if(!code)continue;
    window.__setV(k,v,code);
    const daily=t.buildDaily(k),rng=t.mulberry(t.hash(k+'|solver')());
    let wins=0,first=-1;
    for(let i=0;i<PLAYOUTS;i++){const r=t.playout(daily,rng,220);if(r.won){wins++;if(first<0)first=i;}if(wins>MAXW)break;}
    if(wins>=MINW&&!fallback)fallback={v,first,wins,code};
    if(wins>=MINW&&wins<=MAXW)chosen={v,first,wins,code};
  }
  const pick=chosen||fallback;
  table[k]=pick?[pick.v,pick.first,pick.wins,pick.code]:[0,-1,0,''];
  fs.writeFileSync(OUT,JSON.stringify(table));
  fs.appendFileSync('precompute2.log',`${k} -> ${JSON.stringify(table[k])}${chosen?'':(pick?' (fallback)':' (UNSOLVED)')}\n`);
}
