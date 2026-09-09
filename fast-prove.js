// Usage: node fast-prove.js <start-date> <days> <out.json>
// Same policy as prove-dailies.js (plant a tail, then require the greedy bot to win
// 1-16 of 80 playouts) but on the verified fast sim. Resumable: skips days already
// in <out.json> and rewrites after every day.
// Difference: if all 6 normal variants fail, the day escalates to MAXVAR_HARD variants
// instead of being written out as UNSOLVED.
const fs=require('fs');
const F=require('./fastsim.js');
const {t,setV}=F.loadGame('index.html');
const conv=F.makeConv(t.KEYS);
const N=F.N,DECK=F.DECK_SIZE,TAIL=F.TAIL;

const TAILSET=[];
t.TAILSHAPES.forEach((_,sh)=>t.KEYS.forEach((_,ci)=>
  TAILSET.push({p:conv.piece(t.tailPiece(sh,ci)),code:''+sh+ci})));

function bestFor(st,pieces,rng,temp){
  const before=F.count(st.b);
  let bestSc=0,best=null;
  for(const x of pieces){
    const p=x.p;
    for(let r=0;r<N;r++)for(let c=0;c<N;c++){
      if(!F.fits(st.b,p,r,c))continue;
      const cl=F.evalInto(st.b,p,r,c,before),after=F.after();
      const sc=(before-after)*60+cl*6-after*2+(after===0?5000:0)+rng()*temp;
      if(!best||sc>bestSc){bestSc=sc;best={x,r,c};}
    }
  }
  return best;
}

function design(base,rng){
  const st={b:Int8Array.from(base.b),queue:base.q.slice(0,DECK-TAIL),
            tray:null,charge:0,used:0,placed:0,PR:base.mk()};
  st.tray=[st.queue.shift()||null,st.queue.shift()||null,st.queue.shift()||null];
  while(st.tray[0]||st.tray[1]||st.tray[2]){
    const opts=[];
    for(let si=0;si<3;si++) if(st.tray[si]) opts.push({p:st.tray[si],si});
    const m=bestFor(st,opts,rng,220);
    if(!m)return null;
    F.step(st,m.x.si,m.r,m.c);
    if(F.count(st.b)===0)return null;         // emptied before the tail: reroll
  }
  let code='';
  for(let i=0;i<TAIL;i++){
    const m=bestFor(st,TAILSET,rng,60);
    if(!m)return null;
    code+=m.x.code;
    st.tray=[m.x.p,null,null];
    F.step(st,0,m.r,m.c);
    if(F.count(st.b)===0){
      while(code.length<TAIL*2)code+=TAILSET[Math.floor(rng()*TAILSET.length)].code;
      return code;
    }
  }
  return null;
}

const PLAYOUTS=80,MINW=1,MAXW=16,MAXVAR=6,MAXVAR_HARD=40,ATTEMPTS=30;

function tryVariant(k,v){
  setV(k,v,'');
  const b0=t.buildDaily(k);
  const base={b:conv.board(b0.board),q:b0.queue.map(conv.piece),mk:()=>t.mulberry(b0.prSeed)};
  const drng=t.mulberry(t.hash(k+'|design|'+v)());
  let code=null;
  for(let a=0;a<ATTEMPTS&&!code;a++)code=design(base,drng);
  if(!code)return null;
  setV(k,v,code);
  const d=t.buildDaily(k);
  const daily={b:conv.board(d.board),q:d.queue.map(conv.piece),mk:()=>t.mulberry(d.prSeed)};
  const rng=t.mulberry(t.hash(k+'|solver')());
  let wins=0,first=-1;
  for(let i=0;i<PLAYOUTS;i++){
    const r=F.playout(daily,rng,220);
    if(r.won){wins++;if(first<0)first=i;}
    if(wins>MAXW)break;
  }
  return {v,first,wins,code};
}

function proveDay(k){
  let chosen=null,fallback=null;
  for(let v=0;v<MAXVAR&&!chosen;v++){
    const r=tryVariant(k,v); if(!r)continue;
    if(r.wins>=MINW&&!fallback)fallback=r;
    if(r.wins>=MINW&&r.wins<=MAXW)chosen=r;
  }
  if(chosen)return{pick:chosen,note:''};
  for(let v=MAXVAR;v<MAXVAR_HARD&&!chosen;v++){          // escalation for stubborn days
    const r=tryVariant(k,v); if(!r)continue;
    if(r.wins>=MINW&&!fallback)fallback=r;
    if(r.wins>=MINW&&r.wins<=MAXW)chosen=r;
  }
  if(chosen)return{pick:chosen,note:' (escalated)'};
  return{pick:fallback,note:fallback?' (fallback)':' (UNSOLVED)'};
}

const START=process.argv[2],DAYS=+process.argv[3],OUT=process.argv[4]||'dailies.json';
const table=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT,'utf8')):{};
const only=process.argv[5]?process.argv[5].split(','):null;   // optional explicit day list
const t0=Date.now();
let done=0;
let k=START;
const days=only||[];
if(!only)for(let d=0;d<DAYS;d++,k=t.shiftDay(k,1))days.push(k);
for(const day of days){
  if(table[day])continue;
  const{pick,note}=proveDay(day);
  table[day]=pick?[pick.v,pick.first,pick.wins,pick.code]:[0,-1,0,''];
  fs.writeFileSync(OUT,JSON.stringify(table));
  fs.appendFileSync('fast-prove.log',`${day} -> ${JSON.stringify(table[day])}${note}\n`);
  done++;
  if(done%50===0){
    const el=(Date.now()-t0)/1000;
    fs.appendFileSync('fast-prove.log',`  [${done} days, ${el.toFixed(0)}s, ${(el/done).toFixed(2)}s/day]\n`);
  }
}
const el=(Date.now()-t0)/1000;
console.log(`done: ${done} new days in ${el.toFixed(0)}s (${done?(el/done).toFixed(2):0}s/day)`);
