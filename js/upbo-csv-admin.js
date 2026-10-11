/* Load after upbo-admin.js. Uses the existing authenticated Supabase client. */
document.addEventListener('DOMContentLoaded',()=>{
  const host=document.getElementById('tab-assign');if(!host)return;
  const box=document.createElement('section');box.className='bg-white rounded-2xl shadow-sm border border-point/20 p-6 mb-6';
  box.innerHTML='<h2 class="font-semibold mb-3">📥 업보노트 CSV로 숙제 등록</h2><p class="text-sm mb-3">업보노트 → CSV 내보내기 파일을 선택하세요. 선택한 시즌에 남음 수량을 등록합니다. 날짜는 전체 당첨 기록으로 메모에 남깁니다.</p><input type="file" accept=".csv,text/csv" aria-label="숙제 CSV 파일"><label class="block text-sm my-3"><input type="checkbox"> 기존 숙제 수량도 CSV의 남음 수량으로 교체 (더하지 않음)</label><p data-status role="status" class="text-sm my-3"></p><div data-preview style="overflow:auto;max-height:460px"></div><button type="button" data-save disabled class="px-6 py-2 rounded-xl bg-accent text-white text-sm font-semibold mt-3">위 미리보기대로 등록</button>';
  host.prepend(box);
  const input=box.querySelector('input[type=file]'),replace=box.querySelector('input[type=checkbox]'),status=box.querySelector('[data-status]'),preview=box.querySelector('[data-preview]'),save=box.querySelector('[data-save]'),season=document.getElementById('seasonSelect');
  let rows=[],mapping={},planned=[],busy=false;
  const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
  function render(){
    planned=UpboCsv.plan(rows,allMembers,allTaskTypes,allTasks,season.value,mapping,replace.checked);
    preview.replaceChildren();const table=document.createElement('table');table.style.cssText='width:100%;font-size:13px;text-align:left;border-collapse:collapse;min-width:700px';
    const header=document.createElement('tr');for(const h of ['시청자 / 아이디','CSV 항목 → 숙제 항목','남음','기존 → 등록','상태'])header.append(text('th',h));table.append(header);
    for(const p of planned){const tr=document.createElement('tr');tr.append(text('td',p.user+' / '+p.id));const cell=text('td',p.item+' → '),select=document.createElement('select');select.setAttribute('aria-label',p.id+' '+p.item+' 연결할 숙제');select.add(new Option('항목 선택',''));for(const t of allTaskTypes.filter(t=>t.is_active))select.add(new Option(t.name,String(t.id)));select.value=p.type?String(p.type.id):'';select.disabled=busy;select.onchange=()=>{mapping[p.item]=select.value;render();};cell.append(select);tr.append(cell,text('td',String(p.quantity)),text('td',(p.existing?.quantity??0)+' → '+(p.action==='skip'?'유지':p.quantity)),text('td',p.reason||(p.action==='insert'?'새 등록':'수량 교체')));for(const td of tr.children)td.style.cssText='padding:10px 6px;border-bottom:1px solid #eee';table.append(tr);}
    preview.append(table);const ready=planned.filter(p=>p.action!=='skip');status.textContent='시즌: '+(season.selectedOptions[0]?.textContent||'미선택')+' · 등록 '+ready.length+'건 / 제외 '+(planned.length-ready.length)+'건. 미등록 시청자는 시청자 관리에서 추가한 뒤 다시 선택하세요.';save.disabled=busy||!season.value||!ready.length;
  }
  input.onchange=async()=>{if(busy)return;rows=[];mapping={};save.disabled=true;try{const f=input.files[0];if(!f)return;if(f.size>2000000)throw Error('2MB 이하 CSV를 선택해 주세요.');rows=UpboCsv.parse(await f.text());render();}catch(e){preview.replaceChildren();status.textContent=e.message;}};
  replace.onchange=render;season.addEventListener('change',()=>{if(rows.length&&!busy)render();});
  save.onclick=async()=>{
    if(busy||!season.value)return;
    const selectedSeason=season.value,selectedReplace=replace.checked;
    const ready=planned.filter(p=>p.action!=='skip');if(!ready.length)return;
    busy=true;save.disabled=true;input.disabled=replace.disabled=season.disabled=true;box.querySelectorAll('select').forEach(e=>e.disabled=true);
    const sb=initSupabase();let count=0;
    try{
      // Recheck the current database before writing; no stale preview overwrites.
      const fresh=await sb.from('upbo_tasks').select('*').eq('season_id',selectedSeason);if(fresh.error)throw fresh.error;
      const latest=UpboCsv.plan(rows,allMembers,allTaskTypes,fresh.data||[],selectedSeason,mapping,selectedReplace);
      for(const p of ready){const q=latest.find(x=>x.line===p.line);if(!q||q.action!==p.action||String(q.existing?.id||'')!==String(p.existing?.id||'')||q.existing?.quantity!==p.existing?.quantity||q.existing?.memo!==p.existing?.memo)throw Error('미리보기 이후 숙제가 변경됐습니다. 새로 불러온 내용으로 다시 확인해 주세요.');}
      for(const p of ready){
        let result;
        if(p.action==='update'){
          // Existing memos and preparation state remain intact.
          result=await sb.from('upbo_tasks').update({quantity:p.quantity}).eq('id',p.existing.id).eq('quantity',p.existing.quantity).select('id');
          if(!result.error&&!result.data?.length)throw Error('다른 창에서 수량이 변경되었습니다. 다시 확인해 주세요.');
        }else{
          const memo=('업보노트 CSV · '+p.item+(p.dates?'\n전체 당첨 기록 (완료 포함):\n'+p.dates:'')).slice(0,6000);
          result=await sb.from('upbo_tasks').insert({member_id:p.member.id,task_type_id:p.type.id,quantity:p.quantity,memo,is_prepared:false,season_id:selectedSeason});
        }
        if(result.error)throw result.error;count++;
      }
      rows=[];input.value='';preview.replaceChildren();status.textContent=count+'건 등록 완료';
    }catch(e){status.textContent=count+'건 저장됨 · 이후 중단: '+e.message+' 새로고침한 뒤 CSV를 다시 확인하세요.';rows=[];preview.replaceChildren();input.value='';}
    finally{busy=false;input.disabled=replace.disabled=season.disabled=false;save.disabled=true;try{await loadAdminData();handleMemberSelect();}catch(e){status.textContent+=' 목록 새로고침 실패: '+e.message;}}
  };
});
