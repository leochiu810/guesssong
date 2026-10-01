import {begin,transition,snapshot} from './ranking-engine.js?v=0.6.0';

// All questions and timing stay in this browser. Only completed results leave it.
export class LocalRankedGame {
 constructor(client,getCategories,now=()=>performance.now()){this.client=client;this.getCategories=getCategories;this.now=now;this.state=null;this.pending=null;}
 async command(action,view,extra={}){
  if(action==='start'){this.state=begin(extra.nickname,this.getCategories(),this.now());this.pending=null;}
  else {this.state=transition(this.state,{action,runId:view.runId,revision:view.revision,questionToken:view.questionToken,...extra},this.getCategories(),this.now());}
  if(this.state.phase==='result')this.pending={nickname:this.state.nickname,passed:this.state.passed,total:this.state.total};
  return snapshot(this.state);
 }
 async save(){const result=this.pending;if(!result)throw Error('尚無完成的關卡成績。');return this.client.submit(result);}
}
