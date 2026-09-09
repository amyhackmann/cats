// Checks the fast sim against the proofs already recorded in index.html.
// For each sampled day it replays the exact solver loop and compares [first, wins].
const fs=require('fs');
const F=require('./fastsim.js');
const {t,setV}=F.loadGame('index.html');
const conv=F.makeConv(t.KEYS);

const table=JSON.parse(fs.readFileSync(process.argv[2]||'dailies-backup.json','utf8'));
const keys=Object.keys(table).sort().filter(k=>table[k][3]);
const SAMPLE=+(process.argv[3]||40);
const pick=[];
for(let i=0;i<SAMPLE;i++) pick.push(keys[Math.floor(i*(keys.length-1)/(SAMPLE-1))]);
// always include the three fallback days that ran to 17 wins
['2027-04-07','2027-08-26','2028-02-14'].forEach(k=>{if(!pick.includes(k))pick.push(k)});

const PLAYOUTS=80,MAXW=16;
function proveOne(k,variant,tail){
  setV(k,variant,tail);
  const d=t.buildDaily(k);
  const daily={b:conv.board(d.board),q:d.queue.map(conv.piece),mk:()=>t.mulberry(d.prSeed)};
  const rng=t.mulberry(t.hash(k+'|solver')());
  let wins=0,first=-1;
  for(let i=0;i<PLAYOUTS;i++){
    const r=F.playout(daily,rng,220);
    if(r.won){wins++;if(first<0)first=i;}
    if(wins>MAXW)break;
  }
  return [first,wins];
}

let ok=0,bad=[];
const t0=Date.now();
for(const k of pick){
  const rec=table[k];
  const [first,wins]=proveOne(k,rec[0],rec[3]);
  if(first===rec[1]&&wins===rec[2]) ok++;
  else bad.push(`${k}: recorded [${rec[1]},${rec[2]}] fast [${first},${wins}]`);
}
const secs=(Date.now()-t0)/1000;
console.log(`matched ${ok}/${pick.length} sampled days`);
bad.forEach(b=>console.log('  MISMATCH',b));
console.log(`verify pass took ${secs.toFixed(1)}s -> ${(secs/pick.length).toFixed(2)}s per 80-playout proof`);
