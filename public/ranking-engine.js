import {createRound, challengePool, score} from './core.js?v=0.6.0';
export const THRESHOLDS = [500,600,700,800,900];
export const SEASON = 'v1';
export function nickname(value) {
 const name=String(value??'').trim().normalize('NFKC');
 if(!/^[\p{L}\p{N} _.-]{1,16}$/u.test(name))throw Error('暱稱請使用1至16個中英文字、數字、空格或 _ . -');
 return name;
}
function stage(state,categories,now){
 state.questions=createRound(challengePool(categories,state.level));state.index=0;state.answers=[];state.stageScore=0;state.phase='question';state.openedAt=now;state.questionToken=crypto.randomUUID();
}
export function begin(name,categories,now=Date.now()){
 const state={runId:crypto.randomUUID(),nickname:nickname(name),season:SEASON,level:0,total:0,passed:0,createdAt:now,revision:0};stage(state,categories,now);return state;
}
export function transition(original,action,categories,now=Date.now()){
 const s=structuredClone(original);
 if(now-s.createdAt>2*60*60*1000)throw Error('挑戰已逾時，請重新開始。');
 if(action.runId!==s.runId||action.revision!==s.revision)throw Error('挑戰狀態已更新，請重新整理排行榜後再開始。');
 if(action.action==='answer'){
  if(s.phase!=='question'||action.questionToken!==s.questionToken)throw Error('這題已作答或已過期。');
  const q=s.questions[s.index];if(!q.options.some(o=>o.id===action.selected))throw Error('請選擇本題選項。');
  const correct=action.selected===q.answer.id,points=score(now-s.openedAt,correct);
  s.answers.push({selected:action.selected,correct,points});s.stageScore+=points;s.phase='reveal';s.answeredAt=now;
  if(s.index===9){s.total+=s.stageScore;s.passed=s.level+(s.stageScore>=THRESHOLDS[s.level]?1:0);s.phase='result';}
 }else if(action.action==='next'){
  if(s.phase!=='reveal'||now-s.answeredAt<2800)throw Error('請等待答案揭曉後再換題。');
  s.index++;s.phase='question';s.openedAt=now;s.questionToken=crypto.randomUUID();
 }else if(action.action==='next-level'){
  if(s.phase!=='result'||s.passed!==s.level+1||s.level===4)throw Error('尚未通關，請從第一關重新挑戰。');
  s.level++;stage(s,categories,now);
 }else throw Error('不支援的操作。');
 s.revision++;return s;
}
export function snapshot(s){
 const q=s.questions[s.index],result=s.phase==='reveal'||s.phase==='result';
 return {runId:s.runId,revision:s.revision,level:s.level,index:s.index,phase:s.phase,questionToken:s.questionToken,stageScore:s.stageScore,total:s.total,passed:s.passed,nickname:s.nickname,
  question:{previewUrl:q.answer.previewUrl,options:q.options.map(o=>({id:o.id,title:o.title})),...(result?{answer:q.answer,result:s.answers[s.index]}:{})},
  ...(s.phase==='result'?{history:s.questions.map((q,i)=>({title:q.answer.title,artist:q.answer.artist,storeUrl:q.answer.storeUrl,...s.answers[i]}))}:{})};
}
