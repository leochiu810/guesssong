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
