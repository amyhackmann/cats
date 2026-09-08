// Writes the DAILY_TABLE currently in index.html out to dailies.json so
// prove-dailies.js can resume from it instead of regenerating proven days.
const fs=require('fs');
const m=fs.readFileSync('index.html','utf8').match(/const DAILY_TABLE=(\{[\s\S]*?\});/);
if(!m){console.error('DAILY_TABLE not found in index.html');process.exit(1);}
const t=eval('('+m[1]+')'),k=Object.keys(t).sort();
fs.writeFileSync('dailies.json',JSON.stringify(t));
console.log(`dailies.json written: ${k.length} days, ${k[0]} to ${k[k.length-1]}`);
