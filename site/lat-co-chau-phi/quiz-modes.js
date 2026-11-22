/* Classroom quiz modes: multiple choice, true/false+explanation, matching, short answer, 5 keywords */
window.ClassroomQuizModes=(()=>{
 let answerRoot=null,selectedLeft='',pairs={},tf={},chosen='',shortText='';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normal=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const label=x=>String(x||'');
 const qtype=q=>q.KIEU_CAU||'TRAC_NGHIEM';
 function render(q,root,onChange){
  answerRoot=root;selectedLeft='';pairs={};tf={};chosen='';shortText='';
  const type=qtype(q);
  root.className='answers mode-'+type.toLowerCase();
  if(type==='NOI_COT'){
   const left=q.MATCH_LEFT||[],right=q.MATCH_RIGHT||[];
   root.innerHTML='<div class="modeLead">Nhấn 1 mục ở cột A rồi nhấn phương án tương ứng ở cột B để nối.</div><div class="matchArea" id="matchArea"><div class="matchColumn" id="matchLeft"><h4>CỘT A – ĐỐI TƯỢNG</h4>'+left.map(x=>'<button class="matchItem" data-match-left="'+esc(x.id)+'"><span class="matchBadge">'+esc(x.id)+'</span><span>'+esc(x.text)+'</span></button>').join('')+'</div><svg class="matchLines" id="matchLines" aria-hidden="true"></svg><div class="matchColumn" id="matchRight"><h4>CỘT B – ĐẶC ĐIỂM</h4>'+right.map(x=>'<button class="matchItem" data-match-right="'+esc(x.id)+'"><span class="matchBadge">'+esc(x.id)+'</span><span>'+esc(x.text)+'</span></button>').join('')+'</div></div><div class="matchTools"><span id="matchCounter">Đã nối 0/'+left.length+' cặp</span><button id="clearMatches" class="outline">↺ Xóa các đường nối</button></div>';
   root.querySelectorAll('[data-match-left]').forEach(b=>b.onclick=()=>{selectedLeft=b.dataset.matchLeft;updateMatchUI(q);onChange()});
   root.querySelectorAll('[data-match-right]').forEach(b=>b.onclick=()=>{if(!selectedLeft)return;for(const k of Object.keys(pairs))if(pairs[k]===b.dataset.matchRight)delete pairs[k];pairs[selectedLeft]=b.dataset.matchRight;selectedLeft='';updateMatchUI(q);onChange()});
   root.querySelector('#clearMatches').onclick=()=>{pairs={};selectedLeft='';updateMatchUI(q);onChange()};
   updateMatchUI(q);
  }else if(type==='DUNG_SAI'){
   const statements=q.STATEMENTS||[];
   root.innerHTML='<div class="modeLead">Đánh dấu Đúng hoặc Sai cho từng nhận định, sau đó chọn Xác nhận.</div><div class="tfRows">'+statements.map((t,i)=>'<div class="tfRow"><div class="tfStatement"><strong>'+(i+1)+'.</strong> '+esc(t)+'</div><div class="tfChoice"><button data-tf="'+i+'" data-tfv="D">ĐÚNG</button><button data-tf="'+i+'" data-tfv="S">SAI</button></div></div>').join('')+'</div>';
   root.querySelectorAll('[data-tf]').forEach(b=>b.onclick=()=>{tf[b.dataset.tf]=b.dataset.tfv;root.querySelectorAll('[data-tf="'+b.dataset.tf+'"]').forEach(n=>n.classList.toggle('selected',tf[b.dataset.tf]===n.dataset.tfv));onChange()});
  }else if(type==='TU_KHOA_5'){
   const kw=q.KEYWORDS||[];
   root.innerHTML='<div class="modeLead">Chọn 1 từ khóa phù hợp để điền vào chỗ trống. Có đúng 5 từ lựa chọn.</div><div class="keywordGrid">'+kw.map((k,i)=>'<button class="keywordOption" data-keyword="'+i+'"><em>'+'ABCDE'[i]+'.</em> '+esc(k)+'</button>').join('')+'</div>';
   root.querySelectorAll('[data-keyword]').forEach(b=>b.onclick=()=>{chosen='ABCDE'[Number(b.dataset.keyword)];root.querySelectorAll('[data-keyword]').forEach(n=>n.classList.toggle('selected',n===b));onChange()});
  }else if(type==='TRA_LOI_NGAN'){
   const suggestions=Array.isArray(q.KEYWORDS)&&q.KEYWORDS.length===5?q.KEYWORDS:[];
   root.innerHTML='<div class="modeLead">Nhập câu trả lời ngắn. Có thể chọn gợi ý từ khóa nếu giáo viên cung cấp.</div><input id="shortInput" type="text" class="shortInput" maxlength="200" autocomplete="off" placeholder="Nhập câu trả lời của tổ..." aria-label="Trả lời ngắn"/>'+(suggestions.length?'<div class="keywordGrid">'+suggestions.map((k,i)=>'<button class="keywordOption" data-shortword="'+i+'">'+esc(k)+'</button>').join('')+'</div>':'');
   root.querySelector('#shortInput').oninput=e=>{shortText=e.target.value;onChange()};
   root.querySelectorAll('[data-shortword]').forEach(b=>b.onclick=()=>{shortText=suggestions[Number(b.dataset.shortword)];root.querySelector('#shortInput').value=shortText;onChange()});
  }else{
   const letters=['A','B','C','D'].filter(k=>q[k]&&String(q[k]).trim());
   root.innerHTML=letters.map(k=>'<button class="option" data-opt="'+k+'"><em>'+k+'.</em>'+esc(q[k])+'</button>').join('');
   const isMulti=type==='NHIEU_DAP_AN';let picks=new Set();
   root.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>{if(isMulti){if(picks.has(b.dataset.opt))picks.delete(b.dataset.opt);else picks.add(b.dataset.opt);chosen=[...picks].sort().join('|')}else{chosen=b.dataset.opt}root.querySelectorAll('[data-opt]').forEach(n=>n.classList.toggle('selected',chosen.split('|').includes(n.dataset.opt)));onChange()});
  }
 }
 function updateMatchUI(q){
  if(!answerRoot)return;let ar=answerRoot.querySelector('#matchArea'),svg=answerRoot.querySelector('#matchLines');if(!ar||!svg)return;
  answerRoot.querySelectorAll('[data-match-left]').forEach(n=>n.classList.toggle('selected',n.dataset.matchLeft===selectedLeft));
  answerRoot.querySelectorAll('[data-match-right]').forEach(n=>n.classList.toggle('used',Object.values(pairs).includes(n.dataset.matchRight)));
  answerRoot.querySelector('#matchCounter').textContent='Đã nối '+Object.keys(pairs).length+'/'+(q.MATCH_LEFT||[]).length+' cặp';
  let box=ar.getBoundingClientRect(),w=box.width,h=box.height;svg.setAttribute('viewBox','0 0 '+Math.max(1,w)+' '+Math.max(1,h));
  const lines=[];
  for(let [left,right] of Object.entries(pairs)){
   const a=answerRoot.querySelector('[data-match-left="'+left+'"]'),b=answerRoot.querySelector('[data-match-right="'+right+'"]');
   if(!a||!b)continue;const arct=a.getBoundingClientRect(),brct=b.getBoundingClientRect(),y1=arct.top-box.top+arct.height/2,y2=brct.top-box.top+brct.height/2;
   const x1=arct.right-box.left+3,x2=brct.left-box.left-3;lines.push('<path d="M '+x1+' '+y1+' C '+(x1+35)+' '+y1+', '+(x2-35)+' '+y2+', '+x2+' '+y2+'" fill="none" stroke="#f0ca77" stroke-width="4" stroke-linecap="round"/>')
  }
  svg.innerHTML=lines.join('');
 }
 function isComplete(q){
  switch(qtype(q)){
   case 'NOI_COT':return Object.keys(pairs).length===(q.MATCH_LEFT||[]).length;
   case 'DUNG_SAI':return Object.keys(tf).length===(q.STATEMENTS||[]).length;
   case 'TRA_LOI_NGAN':return !!normal(shortText);
   case 'TU_KHOA_5':return !!chosen;
   default:return !!chosen
  }
 }
 function evaluate(q){
  let type=qtype(q);
  if(type==='NOI_COT'){
   const expected=q.MATCH_ANSWERS||{},correct=Object.keys(expected).filter(k=>pairs[k]===expected[k]).length,total=Object.keys(expected).length;
   return{ok:total>0&&correct===total,correct,total,explanation:'Các cặp đúng: '+Object.entries(expected).map(([a,b])=>a+'–'+b).join(', ')};
  }
  if(type==='DUNG_SAI'){
   const ans=(q.TRUE_FALSE||[]).map(x=>String(x).toUpperCase()),correct=ans.filter((x,i)=>tf[i]===x).length,total=ans.length;
   return{ok:total>0&&correct===total,correct,total,explanation:q.GIAI_THICH||'Đáp án: '+ans.map(x=>x==='D'?'Đúng':'Sai').join(' – ')};
  }
  if(type==='TRA_LOI_NGAN'){const answer=q.CORRECT_TEXT||q.DAP_AN||'';return{ok:normal(shortText)===normal(answer),explanation:'Đáp án: '+answer+'. '+(q.GIAI_THICH||'')}}
  if(type==='TU_KHOA_5'){return{ok:chosen===q.DAP_AN,explanation:'Từ khóa đúng: '+(q.CORRECT_TEXT||q.KEYWORDS['ABCDE'.indexOf(q.DAP_AN)]||'')+'. '+(q.GIAI_THICH||'')}}
  const correct=String(q.DAP_AN||'').split('|').map(x=>x.trim().toUpperCase()).sort().join('|');
  return{ok:chosen===correct,explanation:q.GIAI_THICH||'Đáp án đúng: '+correct}
 }
 function feedback(q,result){
  if(result.ok)return '<strong>✅ Chính xác!</strong> '+esc(result.explanation||'');
  if(result.total)return '<strong>Chưa hoàn toàn đúng ('+result.correct+'/'+result.total+').</strong> '+esc(result.explanation);
  return '<strong>Chưa đúng.</strong> '+esc(result.explanation)
 }
 return{render,evaluate,isComplete,feedback,redrawMatch:()=>answerRoot&&updateMatchUI({MATCH_LEFT:[...answerRoot.querySelectorAll('[data-match-left]')]})}
})();