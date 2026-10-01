import {readFile,writeFile,mkdir} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const result=await read('supabase/functions/ranked-game/result.js');
const handler=(await read('supabase/functions/ranked-game/index.ts')).replace(/^import .*;\r?\n/gm,'');
await mkdir(new URL('../deployment/',import.meta.url),{recursive:true});
await writeFile(new URL('../deployment/ranked-game.ts',import.meta.url),'// Result-only endpoint. No song catalog required.\n'+result+'\n'+handler);
console.log('deployment/ranked-game.ts 已更新（僅記錄結果，不包含題庫）。');
