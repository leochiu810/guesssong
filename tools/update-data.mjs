import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {titleKey} from '../public/core.js';
export function makeCatalog(selection, metadata) {
 const languages=[['mandarin','中文','TW'],['english','英文','TW'],['japanese','日文','JP'],['korean','韓文','TW']];
 const categories=languages.map(([code,name,country])=>({code,name,country,artists:[],songs:[]}));
 for(const artist of selection.artists){
  const category=categories.find(c=>c.code===artist.language);
  if(!category||artist.songs.length>artist.targetCount||!artist.songs.length)throw Error(`歌手設定錯誤：${artist.name}`);
  category.artists.push(artist.name);
  const seen=new Set();
  for(const item of artist.songs){
   const track=metadata[item.appleId];
   const safe=(value,audio)=>{try{const u=new URL(value);return u.protocol==='https:'&&(audio?/\.(mzstatic|itunes\.apple)\.com$/.test(u.hostname):['music.apple.com','itunes.apple.com'].includes(u.hostname));}catch{return false;}};
   if(!track||track.kind!=='song'||track.artistId!==item.appleArtistId||titleKey(track.trackName)!==titleKey(item.appleTitle)||!safe(track.previewUrl,true)||!safe(track.trackViewUrl,false))throw Error(`歌曲資料不符或無試聽：${artist.name} / ${item.title}`);
   if(seen.has(titleKey(track.trackName)))throw Error(`重複歌名：${artist.name} / ${item.title}`);seen.add(titleKey(track.trackName));
   category.songs.push({id:track.trackId,title:track.trackName,artist:track.artistName,catalogArtist:artist.name,language:category.code,previewUrl:track.previewUrl,storeUrl:track.trackViewUrl,spotifyRank:item.sourceRank??item.rank??null,spotifyTitle:item.title,spotifySource:artist.sourceUrl,spotifyCheckedAt:artist.checkedAt||selection.checkedAt,selectionType:item.selectionType,selectionNote:item.selectionType==='representative'?'代表作補選':undefined});
  }
 }
 for(const c of categories)if(new Set(c.songs.map(s=>titleKey(s.title))).size<10)throw Error(`${c.name}不足十個歌名`);
 return {generatedAt:new Date().toISOString(),source:'Apple iTunes Search API',selectionSource:'Spotify Top tracks + selected representative songs',selectionCheckedAt:selection.checkedAt,classification:selection.basis,categories};
}
async function main(){
 const selection=JSON.parse(await readFile(new URL('./spotify-selection.json',import.meta.url)));const metadata={};
 const groups=new Map();for(const a of selection.artists)for(const s of a.songs){if(!groups.has(s.appleCountry))groups.set(s.appleCountry,new Set());groups.get(s.appleCountry).add(s.appleId);}
 for(const [country,values] of groups){const ids=[...values];for(let i=0;i<ids.length;i+=100){
  const response=await fetch('https://itunes.apple.com/lookup?'+new URLSearchParams({country,id:ids.slice(i,i+100).join(',')}),{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Apple HTTP ${response.status}，保留原題庫。`);
  for(const row of (await response.json()).results)if(row.trackId)metadata[row.trackId]=row;
  console.log(`${country}: ${Math.min(i+100,ids.length)}/${ids.length}`);await new Promise(r=>setTimeout(r,3500));
 }}
 const catalog=makeCatalog(selection,metadata),destination=fileURLToPath(new URL('../public/data/catalog.json',import.meta.url));
 await writeFile(destination+'.tmp',JSON.stringify(catalog,null,2));await rename(destination+'.tmp',destination);
 console.log(`已更新 ${catalog.categories.reduce((n,c)=>n+c.songs.length,0)} 筆；未下載音訊。Spotify 選曲需人工重新核對。`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
