export const SEASON='stage-v2';
export function validateResult(body){
 if(body?.action!=='submit')throw Error('請更新遊戲網頁後再提交成績。');
 const nickname=String(body.nickname??'').trim().normalize('NFKC');
 if(!/^[\p{L}\p{N} _.-]{1,16}$/u.test(nickname))throw Error('暱稱格式錯誤。');
 const {passed,total}=body;
 if(!Number.isInteger(passed)||passed<1||passed>5||!Number.isInteger(total)||total<0||total>1000)throw Error('成績範圍錯誤。');
 return {nickname,passed,total};
}
