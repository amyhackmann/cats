// Puts a generated dailies.json back into index.html's DAILY_TABLE, in date order.
// Usage: node merge-dailies.js dailies.json
const fs=require('fs');
const file=process.argv[2]||'dailies.json';
const t=JSON.parse(fs.readFileSync(file,'utf8'));
const keys=Object.keys(t).sort();
const unsolved=keys.filter(k=>!t[k][3]);
const body=keys.map(k=>`'${k}':[${t[k][0]},${t[k][1]},${t[k][2]},'${t[k][3]}']`).join(',');
let s=fs.readFileSync('index.html','utf8');
const before=s.length;
s=s.replace(/const DAILY_TABLE=\{[\s\S]*?\};/,`const DAILY_TABLE={${body}};`);
if(s.length===before&&!s.includes(body)){console.error('DAILY_TABLE not replaced');process.exit(1);}
fs.writeFileSync('index.html',s);
console.log(`merged ${keys.length} days: ${keys[0]} to ${keys[keys.length-1]}`);
if(unsolved.length)console.log(`WARNING: ${unsolved.length} days have no proven clear:`,unsolved.slice(0,10));
