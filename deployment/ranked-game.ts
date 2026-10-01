// Result-only endpoint. No song catalog required.
export const SEASON='v1';
export function validateResult(body){
 if(body?.action!=='submit')throw Error('請更新遊戲網頁後再提交成績。');
 const nickname=String(body.nickname??'').trim().normalize('NFKC');
 if(!/^[\p{L}\p{N} _.-]{1,16}$/u.test(nickname))throw Error('暱稱格式錯誤。');
 const {passed,total}=body;
 if(!Number.isInteger(passed)||passed<0||passed>5||!Number.isInteger(total)||total<0||total>5000)throw Error('成績範圍錯誤。');
 const min=[0,500,1100,1800,2600,3500][passed];
 const max=passed===5?5000:(passed+1)*1000;
 if(total<min||total>max)throw Error('關數與累積分數不符。');
 return {nickname,passed,total};
}

const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed=(Deno.env.get('ALLOWED_ORIGINS')??'').split(',').map(s=>s.trim()).filter(Boolean);
async function db(path:string,method='GET',body?:unknown){
 const r=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok){const error=await r.text();if(error.includes('NICKNAME_TAKEN'))throw Error('這個暱稱已被使用，請換一個暱稱。');throw Error('資料庫暫時無法處理，請稍後再試。');}return r.status===204?null:r.json();
}
Deno.serve(async request=>{
 const origin=request.headers.get('Origin')??'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!allowed.includes(origin))return reply({error:'來源未開放。'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(request.method==='GET'){
   const rows=await db(`ranked_best?season=eq.${SEASON}&select=nickname,passed,total,achieved_at&order=passed.desc,total.desc,achieved_at.asc,user_id.asc&limit=50`);
   return reply({rows});
  }
  if(request.method!=='POST')return reply({error:'操作不支援。'},405);
  const raw=await request.text();if(raw.length>2048)return reply({error:'要求過大。'},413);
  const body=JSON.parse(raw),authorization=request.headers.get('Authorization')??'';
  if(!authorization.startsWith('Bearer '))return reply({error:'請重新登入排名挑戰。'},401);
  const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:secret,Authorization:authorization}});
  if(!auth.ok)return reply({error:'玩家登入已失效，請重新開始排名挑戰。'},401);
  const user=await auth.json();if(!user.id)return reply({error:'登入無效。'},401);
  if(body.action==='claim-name'){
   const checked=validateResult({action:'submit',nickname:body.nickname,passed:0,total:0});
   await db('rpc/claim_ranked_name','POST',{p_user:user.id,p_nickname:checked.nickname});
   return reply({claimed:true});
  }
  const result=validateResult(body);
  await db('rpc/submit_ranked_result','POST',{p_user:user.id,p_nickname:result.nickname,p_passed:result.passed,p_total:result.total});
  return reply({saved:true});
 }catch(error){return reply({error:error instanceof SyntaxError?'要求格式錯誤。':(error instanceof Error?error.message:'連線失敗。')},400);}
});
