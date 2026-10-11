(function(root){
  'use strict';
  const KEYWORDS=['단컷','냔생복','방셀','배너','노래','움짤','공겜'];
  const isTask=item=>KEYWORDS.some(word=>String(item).normalize('NFC').includes(word));
  function datesOf(dates,count){
    if(dates===undefined)return undefined;
    if(!Array.isArray(dates)||dates.length>20000)throw Error('날짜 내역을 확인해 주세요.');
    const map=new Map();let total=0;
    for(const d of dates){
      if(!d||typeof d.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||!Number.isSafeInteger(d.count)||d.count<=0)throw Error('올바르지 않은 당첨 날짜입니다.');
      total+=d.count;map.set(d.date,(map.get(d.date)||0)+d.count);
    }
    if(total>count)throw Error('날짜별 횟수가 전체 당첨 횟수를 넘습니다.');
    return [...map].sort(([a],[b])=>b.localeCompare(a)).map(([date,count])=>({date,count}));
  }
  function dateText(r){const dates=r.dates||[],unknown=r.count-dates.reduce((n,d)=>n+d.count,0);return [...dates.map(d=>d.date+' · '+d.count+'회'),...(unknown>0?['날짜 미확인 · '+unknown+'회']:[])].join('\n');}
  function normalize(rows){
    if(!Array.isArray(rows)||rows.length>20000)throw Error('통계 형식을 확인해 주세요.');
    const map=new Map();
    for(const r of rows){
      if(!r||typeof r.user!=='string'||typeof r.item!=='string'||typeof r.id!=='string'||!r.user.trim()||!r.item.trim()||r.user.length>200||r.id.length>200||r.item.length>500||!Number.isSafeInteger(r.count)||r.count<0||r.count>10000000)throw Error('올바르지 않은 통계 행입니다.');
      const value={user:r.user.trim(),id:r.id.trim(),item:r.item.trim(),count:r.count};
      if(r.dates!==undefined)value.dates=datesOf(r.dates,r.count);
      const key=keyOf(value);const old=map.get(key);if(old){old.count+=value.count;if(old.dates||value.dates)old.dates=datesOf([...(old.dates||[]),...(value.dates||[])],old.count);}else map.set(key,value);
    }
    return [...map.values()];
  }
  function keyOf(r){return JSON.stringify([r.id||r.user,r.item]);}
  function mergeSnapshot(previous,incoming){
    const rows=normalize(incoming).filter(r=>isTask(r.item));
    const next=new Map(rows.map(r=>[keyOf(r),r]));
    for(const old of previous.rows){if(!isTask(old.item))continue;if((next.get(keyOf(old))?.count||0)<old.count)throw Error('이전보다 당첨 횟수가 줄었습니다. 같은 조회 기간인지 확인하거나 새 목록으로 연결해 주세요.');}
    const prior=new Map(previous.rows.map(r=>[keyOf(r),r]));
    const done={};for(const r of rows){const key=keyOf(r);if(r.dates===undefined&&prior.get(key)?.dates)r.dates=datesOf(prior.get(key).dates,r.count);done[key]=Math.min(r.count,Math.max(0,previous.done[key]||0));}
    return {...previous,rows,done};
  }
  function summary(rows,done={}){const users=new Set(),items=new Map();let total=0,completed=0;for(const r of rows){users.add(r.id||r.user);total+=r.count;completed+=Math.min(r.count,Math.max(0,Number(done[keyOf(r)])||0));items.set(r.item,(items.get(r.item)||0)+r.count);}return {total,completed,users:users.size,items:[...items].sort((a,b)=>b[1]-a[1])};}
  function csv(rows,done={}){const cell=x=>'"'+String(/^[=+@\-\t\r]/.test(String(x))?"'"+x:x).replaceAll('"','""')+'"';return '\ufeff'+[['시청자','아이디','당첨 항목','횟수','완료','남음','당첨일 (위플랩 기록)'],...rows.map(r=>{let n=Math.min(r.count,Math.max(0,Number(done[keyOf(r)])||0));return [r.user,r.id,r.item,r.count,n,r.count-n,dateText(r)];})].map(r=>r.map(cell).join(',')).join('\r\n');}
  const api={normalize,keyOf,summary,csv,dateText,KEYWORDS,isTask,mergeSnapshot,taskRows:rows=>normalize(rows).filter(r=>isTask(r.item))};if(typeof module!=='undefined')module.exports=api;else root.RouletteCore=api;
})(typeof window==='undefined'?globalThis:window);
