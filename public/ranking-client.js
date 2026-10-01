import {rankingConfig} from './ranking-config.js?v=0.6.0';
export function rankingConfigured(config=rankingConfig){return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url)&&!!config.publishableKey;}
export class RankingClient {
 constructor(config=rankingConfig,storage){if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}this.config=config;this.storage=storage;this.session=null;this.key='guess-song-player:'+config.url;}
 async request(path,{method='GET',body,token}={}){
  const headers={apikey:this.config.publishableKey,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
  let response;try{response=await fetch(this.config.url.replace(/\/$/,'')+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),cache:'no-store'});}catch{throw Error('排行榜連線失敗，請確認網路後再試。');}
  const data=await response.json();if(!response.ok)throw Error(data.error_description||data.msg||data.error||'排行榜暫時無法使用。');return data;
 }
 async authenticate(){
  if(!this.session){try{this.session=JSON.parse(this.storage?.getItem(this.key)||'null');}catch{}}
  if(this.session?.access_token&&this.session.expires_at>Date.now()/1000+60)return this.session.access_token;
  const data=this.session?.refresh_token?await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token}}):await this.request('/auth/v1/signup',{method:'POST',body:{data:{}}});
  if(!data.access_token)throw Error('排名登入尚未開放，請聯絡遊戲管理者。');
  this.session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at||Date.now()/1000+data.expires_in};try{this.storage?.setItem(this.key,JSON.stringify(this.session));}catch{}
  return data.access_token;
 }
 async submit({nickname,passed,total}){
  const token=await this.authenticate();return this.request('/functions/v1/ranked-game',{method:'POST',token,body:{action:'submit',nickname,passed,total}});
 }
 async board(){return (await this.request('/functions/v1/ranked-game')).rows;}
}

