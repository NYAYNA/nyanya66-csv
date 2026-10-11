(function(root){
  'use strict';
  function parse(text){
    if(typeof text!=='string'||text.length>2000000)throw Error('2MB 이하 CSV를 선택해 주세요.');
    text=text.replace(/^\uFEFF/,'');
    const rows=[];let row=[],value='',quoted=false,closed=false;
    const field=()=>{row.push(value);value='';closed=false;};
    const line=()=>{field();if(row.some(v=>v.trim()))rows.push(row);row=[];if(rows.length>5001)throw Error('최대 5,000행까지 등록할 수 있습니다.');};
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
      if(c===','){field();continue;}
      if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue;}
      if(closed)throw Error('닫는 따옴표 뒤에 잘못된 문자가 있습니다.');
      if(c==='"'){if(value)throw Error('CSV 따옴표 형식을 확인해 주세요.');quoted=true;}else value+=c;
    }
    if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');
    if(value||row.length||closed)line();
    if(rows.length<2)throw Error('등록할 CSV 내역이 없습니다.');
    const header=rows.shift().map(v=>v.trim());
    for(const h of ['시청자','아이디','당첨 항목','횟수','완료','남음'])if(header.filter(v=>v===h).length!==1)throw Error('업보노트의 CSV 내보내기 파일을 선택해 주세요. 누락/중복 열: '+h);
    const unescape=v=>v.replace(/^'(?=[=+@\-\t\r])/,'');
    const result=rows.map((cells,index)=>{
      if(cells.length!==header.length)throw Error((index+2)+'행의 열 개수가 다릅니다.');
      const get=h=>unescape(cells[header.indexOf(h)]||'').trim();
      const num=h=>{const value=get(h);if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw Error((index+2)+'행의 '+h+' 수량이 올바르지 않습니다.');return Number(value);};
      const total=num('횟수'),done=num('완료'),quantity=num('남음');
      if(done+quantity!==total||quantity>999)throw Error((index+2)+'행의 수량 합계 또는 최대 999개 제한을 확인해 주세요.');
      const user=get('시청자'),id=get('아이디'),item=get('당첨 항목');
      if(!user||!id||!item||user.length>200||id.length>200||item.length>500)throw Error((index+2)+'행의 시청자, 아이디, 항목을 확인해 주세요.');
      const dates=get('당첨일 (위플랩 기록)');if(dates.length>5000)throw Error('날짜 내역이 너무 깁니다.');
      return {line:index+2,user,id,item,total,done,quantity,dates};
    });
    const seen=new Set();for(const r of result){const key=JSON.stringify([r.id,r.item]);if(seen.has(key))throw Error('같은 아이디·항목이 중복된 CSV입니다: '+r.id+' / '+r.item);seen.add(key);}
    return result;
  }
  function plan(rows,members,types,tasks,season,mapping={},replace=false){
    const used=new Set();
    const planned=rows.map(r=>{
      const ms=members.filter(m=>m.user_id===r.id),member=ms.length===1?ms[0]:null;
      const candidates=types.filter(t=>t.is_active&&(Object.hasOwn(mapping,r.item)?String(t.id)===String(mapping[r.item]):t.name===r.item));
      const type=candidates.length===1?candidates[0]:null;
      const existing=member&&type?tasks.filter(t=>String(t.member_id)===String(member.id)&&String(t.task_type_id)===String(type.id)&&String(t.season_id||'')===String(season||'')):[];
      let reason=!r.quantity?'완료된 항목 제외':!member?'시청자 아이디 미등록 또는 중복':!type?'숙제 항목 선택 필요':existing.length>1?'기존 숙제 중복 확인 필요':existing.length&&!replace?'기존 숙제 있음 · 제외':existing[0]?.quantity===r.quantity?'같은 수량 · 제외':'';
      const key=member&&type?JSON.stringify([member.id,type.id]):null;
      if(key&&r.quantity){if(used.has(key))reason='여러 CSV 항목이 같은 숙제로 연결됨';used.add(key);}
      return {...r,member,type,existing:existing[0],reason,action:reason?'skip':existing.length?'update':'insert'};
    });
    for(const p of planned){if(p.member&&p.type&&p.quantity&&planned.filter(q=>q.quantity&&q.member?.id===p.member.id&&q.type?.id===p.type.id).length>1){p.reason='여러 CSV 항목이 같은 숙제로 연결됨';p.action='skip';}}
    return planned;
  }
  const api={parse,plan};if(typeof module!=='undefined')module.exports=api;else root.UpboCsv=api;
})(typeof window==='undefined'?globalThis:window);
