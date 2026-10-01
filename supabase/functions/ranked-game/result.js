export const SEASON='stage-v2';
export function validateResult(body){
 if(body?.action!=='submit')throw Error('請更新遊戲網頁後再提交成績。');
 const nickname=String(body.nickname??'').trim().normalize('NFKC');
 if(!/^[\p{L}\p{N}\p{M}\p{So}\p{Sk}\u200D _.-]{1,16}$/u.test(nickname))throw Error('暱稱格式錯誤。');
 const {passed,total}=body;
 if(!Number.isInteger(passed)||passed<1||passed>5||!Number.isInteger(total)||total<0||total>1000)throw Error('成績範圍錯誤。');
 const cumulative=body.cumulative??null;
 if(cumulative!==null&&(!Number.isInteger(cumulative)||cumulative<total||cumulative>(passed-1)*1000+total))throw Error('總得分範圍錯誤。');
 return {nickname,passed,total,cumulative};
}
