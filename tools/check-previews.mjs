import { readFile, writeFile } from 'node:fs/promises';
const catalog = JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url)));
const rows = catalog.categories.flatMap(c=>c.songs.map(s=>({...s,category:c.name})));
const results = [];
async function worker() { while(rows.length) { const song = rows.shift(); try { const r = await fetch(song.previewUrl,{method:'HEAD',signal:AbortSignal.timeout(20000)}); results.push({id:song.id,category:song.category,status:r.status,contentType:r.headers.get('content-type'),ok:r.ok}); } catch(e) {results.push({id:song.id,category:song.category,ok:false,error:e.message});} } }
await Promise.all(Array.from({length:4},worker));
const report = {checkedAt:new Date().toISOString(),method:'HEAD only; no audio downloaded',total:results.length,passed:results.filter(r=>r.ok).length,results};
await writeFile(new URL('../preview-check.json',import.meta.url),JSON.stringify(report,null,2));
console.log(`${report.passed}/${report.total} Apple 試聽網址回應成功（僅 HEAD）`);
if(report.passed !== report.total) process.exitCode = 1;
