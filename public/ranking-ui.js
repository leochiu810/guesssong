const thresholds=[500,600,700,800,900];
export const highestScore=state=>state.stageScore;
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const button=(text,action,className='primary')=>{const b=el('button',text,className);b.type='button';b.onclick=action;return b;};
export function createRankedUI({root,client,onExit,onBoard,getVolume,onVolume}){
 let state,audio,timer,advance,epoch=0,busy=false,started=0;
 function stop(){clearInterval(timer);clearTimeout(advance);if(audio){audio.onplaying=audio.onerror=audio.onended=null;audio.pause();}}
 function cancel(){epoch++;stop();audio=null;state=null;busy=false;}
 function fail(message){stop();root.replaceChildren(el('h2','排名挑戰暫停'),el('p',message),el('p','已完成關卡的最佳紀錄仍會保留。','fine'),button('回首頁',()=>{cancel();onExit();}));}
 async function send(action,extra={}){
  if(busy)return;busy=true;const token=epoch;
  try{const next=await client.command(action,state,extra);if(token!==epoch)return;state=next;busy=false;render();if(action==='start'||action==='next-level'){const note=el('p','正在更新關卡紀錄…','fine');root.append(note);client.save().then(()=>{if(token===epoch)note.remove();}).catch(()=>{if(token===epoch)note.textContent='關卡紀錄暫未儲存，完成本關後會再次儲存。';});}}
  catch(error){if(token!==epoch)return;busy=false;fail(error.message);}
 }
 function play(status,unlock){
  const token=epoch;audio.play().then(()=>{if(token===epoch)unlock.hidden=true;}).catch(()=>{if(token===epoch){unlock.hidden=false;status.textContent='請點播放歌曲啟用音訊；計時仍持續。';}});
 }
 function render(){
  stop();root.replaceChildren();
  if(state.phase==='result'){
   const passed=state.stageScore>=thresholds[state.level];
   root.append(el('h2',`第 ${state.level+1} 關${passed?'通過':'挑戰失敗'}`),el('p',`本關 ${state.stageScore} / 1,000 分`,'ranked-score'),el('p',`本次挑戰：第 ${state.level+1} 關 · 最高得分 ${state.stageScore} 分`));
   const saving=el('p','正在儲存成績…','fine'),token=epoch;
   const retry=button('重試儲存',save,'text-button');retry.hidden=true;root.append(saving,retry);
   async function save(){retry.hidden=true;saving.textContent='正在儲存成績…';try{await client.save();if(token!==epoch)return;saving.textContent='成績已送達，排行榜會保留你的最佳紀錄。';}catch(error){if(token!==epoch)return;saving.textContent='成績尚未儲存：'+error.message+' 請在離開或開始下一關前重試。';retry.hidden=false;}}
   save();
   if(passed&&state.level<4)root.append(button('挑戰下一關 →',()=>send('next-level')));
   else if(!passed)root.append(el('p','挑戰失敗，須回到第一關重新開始。'),button('從第一關重新挑戰 →',()=>start(state.nickname)));
   else root.append(el('p','恭喜！五關全部通過！'));
   root.append(button('查看排行榜',()=>{cancel();onBoard();},'text-button'),button('回首頁',()=>{cancel();onExit();},'text-button'));
   const history=el('div');for(const row of state.history){const line=el('div',undefined,'history-row'),link=el('a',row.title);link.href=row.storeUrl;link.target='_blank';link.rel='noopener noreferrer';line.append(link,el('span',`${row.correct?'✓':'×'} ${row.points} 分`));history.append(line);}root.append(history);return;
  }
  const top=el('div',undefined,'topline');top.append(el('h2',`排名挑戰 · 第 ${state.level+1} 關`),button('結束本局',()=>{cancel();onExit();},'text-button'));root.append(top);
  const stats=el('div',undefined,'stats'),clock=el('span','0.0 秒');stats.append(el('span',`第 ${state.index+1} / 10 題`),clock,el('strong',`最高得分 ${highestScore(state)} 分`,'ranked-score'));root.append(stats);
  root.append(el('p',`本關 ${state.stageScore} 分 · 通關需要 ${thresholds[state.level]} 分`,'pass-target'));
  const status=el('p',state.phase==='question'?'正在連接 Apple 試聽…':'答案已揭曉','fine');root.append(status);
  const unlock=button('播放歌曲',()=>play(status,unlock),'text-button');unlock.hidden=true;root.append(unlock);
  const volume=el('div',undefined,'volume-control'),label=el('label','音量'),slider=el('input'),output=el('output',Math.round(getVolume()*100)+'%');slider.type='range';slider.id='ranked-volume';slider.min='0';slider.max='100';slider.value=String(getVolume()*100);label.htmlFor=slider.id;
  slider.oninput=()=>{const value=Number(slider.value)/100;onVolume(value);output.textContent=value===0?'靜音':Math.round(value*100)+'%';if(audio){audio.volume=value;audio.muted=value===0;}};volume.append(label,slider,output);root.append(volume);
  const options=el('div',undefined,'options');for(const option of state.question.options){const b=button(option.title,()=>{if(busy||state.phase!=='question')return;stop();for(const child of options.children)child.disabled=true;status.textContent='正在核對答案…';send('answer',{selected:option.id});},'');b.disabled=state.phase!=='question';if(state.phase==='reveal'){if(option.id===state.question.answer.id)b.className='right';else if(option.id===state.question.result.selected)b.className='wrong';}options.append(b);}root.append(options);
  if(state.phase==='question'){
   started=performance.now();timer=setInterval(()=>clock.textContent=((performance.now()-started)/1000).toFixed(1)+' 秒',100);
   audio??=new Audio();audio.volume=getVolume();audio.muted=getVolume()===0;audio.src=state.question.previewUrl;
   audio.onplaying=()=>status.textContent='';audio.onended=()=>status.textContent='試聽已結束，請作答。';audio.onerror=()=>fail('Apple 試聽載入失敗，本關不列入排名。請確認網路後重新挑戰。');play(status,unlock);
  }else{
   const points=el('p',undefined,'question-score');points.append(el('span','本題'),el('strong',String(state.question.result.points)),el('span','分'));root.append(points,el('p',state.question.answer.title));
   const token=epoch;advance=setTimeout(()=>{if(token===epoch)send('next');},2800);
  }
  const source=el('div',undefined,'source');source.append(el('span','試聽 provided courtesy of iTunes'));if(state.phase==='reveal'){const link=el('a','在 Apple 查看本題歌曲 ↗');link.href=state.question.answer.storeUrl;link.target='_blank';link.rel='noopener noreferrer';source.append(link);}root.append(source);
 }
 function start(name){cancel();root.replaceChildren(el('h2','正在開始排名挑戰…'));audio=new Audio();send('start',{nickname:name});}
 return {start,cancel};
}
export function bestByNickname(rows){
 const compare=(a,b)=>b.passed-a.passed||b.total-a.total||String(a.achieved_at||'').localeCompare(String(b.achieved_at||''));
 const best=new Map();
 for(const row of Array.isArray(rows)?rows:[]){const key=String(row.nickname).normalize('NFKC').trim().toLowerCase();const previous=best.get(key);if(!previous||compare(row,previous)<0)best.set(key,row);}
 return [...best.values()].sort(compare);
}
export function renderBoard(root,rows){
 root.replaceChildren();const entries=bestByNickname(rows);
 const table=el('table');table.className='ranking-table';table.setAttribute('aria-label','排行榜成績');const head=el('thead'),heading=el('tr');for(const title of ['名次','暱稱','關卡','最高得分']){const th=el('th',title);th.scope='col';heading.append(th);}head.append(heading);table.append(head);
 const body=el('tbody');entries.forEach((row,i)=>{const tr=el('tr');for(const value of [i+1,row.nickname,row.passed+' / 5',row.total])tr.append(el('td',String(value)));body.append(tr);});
 if(!entries.length){const tr=el('tr'),td=el('td','尚無成績，來挑戰第一筆紀錄！','ranking-empty');td.colSpan=4;tr.append(td);body.append(tr);}
 table.append(body);const frame=el('div',undefined,'ranking-table-frame');frame.append(table);root.append(frame);
}

