// Confirms the merged index.html is self-consistent: for a sample of days it reads
// DAILY_TABLE straight out of the file, then reproduces the recorded proof using the
// GAME's own playout/simResolve (not the fast rewrite). Also checks the in-game solver
// would find the win within its own try budget.
const fs=require('fs');
const F=require('./fastsim.js');

const html=fs.readFileSync('index.html','utf8');
const m=html.match(/const DAILY_TABLE=(\{[\s\S]*?\});/);
const table=eval('('+m[1]+')');
const keys=Object.keys(table).sort();

const {t,setV}=F.loadGame('index.html');   // loads with DAILY_TABLE stubbed out
const SAMPLE=+(process.argv[2]||14);
const pick=[];
for(let i=0;i<SAMPLE;i++)pick.push(keys[Math.floor(i*(keys.length-1)/(SAMPLE-1))]);
['2028-01-10','2028-01-18','2027-04-07','2027-08-26','2028-02-14']
  .forEach(k=>{if(!pick.includes(k))pick.push(k)});

let ok=0,bad=[];
for(const k of pick){
  const rec=table[k];
  setV(k,rec[0],rec[3]);
  const daily=t.buildDaily(k);
  const rng=t.mulberry(t.hash(k+'|solver')());
  let wins=0,first=-1;
  for(let i=0;i<80;i++){
    const r=t.playout(daily,rng,220);          // the game's own playout
    if(r.won){wins++;if(first<0)first=i;}
    if(wins>16)break;
  }
  const solverBudget=Math.max(220,rec[1]+1);   // what solveDaily() would allow
  if(first===rec[1]&&wins===rec[2]&&first>=0&&first<solverBudget)ok++;
  else bad.push(`${k}: table [${rec[1]},${rec[2]}] vs game [${first},${wins}]`);
}
console.log(`game-code replay: ${ok}/${pick.length} days reproduce their recorded proof`);
bad.forEach(b=>console.log('  MISMATCH',b));
