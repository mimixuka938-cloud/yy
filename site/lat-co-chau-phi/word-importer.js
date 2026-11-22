/* DOCX question + teacher answer importer. No server uploads; files stay in browser. */
window.WordQuizImporter=(()=>{
 const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const by=n=>n?.localName||'';
 const children=(n,tag)=>Array.from(n?.children||[]).filter(x=>by(x)===tag);
 const descendants=(n,tag)=>Array.from(n?.getElementsByTagName('*')||[]).filter(x=>by(x)===tag);
 const txt=n=>descendants(n,'t').map(x=>x.textContent).join('').replace(/\u00a0/g,' ').trim();
 function zipEntries(buf){
  const v=new DataView(buf),bytes=new Uint8Array(buf);
  let end=-1;for(let p=buf.byteLength-22;p>=Math.max(0,buf.byteLength-65558);p--){if(v.getUint32(p,true)===0x06054b50){end=p;break}}
  if(end<0)throw Error('Word không có cấu trúc DOCX hợp lệ.');
  let cd=v.getUint32(end+16,true),num=v.getUint16(end+10,true),files={};
  const decoder=new TextDecoder();
  for(let i=0;i<num;i++){
   if(v.getUint32(cd,true)!==0x02014b50)throw Error('Danh mục ZIP trong Word bị lỗi.');
   let met=v.getUint16(cd+10,true),sz=v.getUint32(cd+20,true),nl=v.getUint16(cd+28,true),el=v.getUint16(cd+30,true),cl=v.getUint16(cd+32,true),off=v.getUint32(cd+42,true);
   const filename=decoder.decode(bytes.slice(cd+46,cd+46+nl));files[filename]={met,sz,off};cd+=46+nl+el+cl;
  }
  return async name=>{
   let f=files[name];if(!f)throw Error('Word thiếu thành phần '+name);
   let offset=f.off,begin=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true),data=bytes.slice(begin,begin+f.sz);
   if(f.met===0)return new TextDecoder().decode(data);
   if(f.met!==8)throw Error('Định dạng nén trong Word chưa hỗ trợ.');
   try{
    let ds=new DecompressionStream('deflate-raw');
    let result=await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
    return new TextDecoder().decode(result)
   }catch(e){
    if(!window.JSZip)throw Error('Trình duyệt không đọc được DOCX nén. Hãy mở bằng Chrome mới và thử lại.');
    let z=await window.JSZip.loadAsync(buf);return await z.file(name).async('string')
   }
  };
 }
 function parseTable(t){
  return children(t,'tr').map(tr=>children(tr,'tc').map(tc=>txt(tc))).filter(row=>row.some(Boolean))
 }
 function parseElements(xml){
  const d=new DOMParser().parseFromString(xml,'application/xml');
  if(descendants(d,'parsererror').length)throw Error('Nội dung XML của Word không hợp lệ.');
  const body=descendants(d,'body')[0];if(!body)throw Error('Không tìm thấy văn bản trong Word.');
  let root=body,top=children(body,'tbl')[0];
  if(top){
   let rows=children(top,'tr'),cells=rows.length===1?children(rows[0],'tc'):[];
   if(cells.length===2){
    const first=txt(cells[0]),second=txt(cells[1]);
    if(first.length>100&&second.startsWith(first.slice(0,Math.min(80,first.length))))root=cells[0];
   }
  }
  return Array.from(root.children).flatMap(node=>{
   if(by(node)==='p')return txt(node)?[{kind:'p',text:txt(node)}]:[];
   if(by(node)==='tbl')return[{kind:'table',rows:parseTable(node)}];
   return[];
  })
 }
 async function parseWord(file){
  if(!file?.name?.toLowerCase().endsWith('.docx'))throw Error('Chỉ hỗ trợ Word .docx (không phải .doc).');
  const buf=await file.arrayBuffer(),entry=zipEntries(buf),xml=await entry('word/document.xml');
  const elems=parseElements(xml),full=elems.flatMap(e=>e.kind==='p'?[e.text]:e.rows.flat()).join('\n');
  return{elems,full,filename:file.name,kind:/^ĐÁP\s*ÁN\s*GIÁO\s*VIÊN/i.test(full.slice(0,160))?'answer':'questions'}
 }
 const norm=s=>String(s||'').normalize('NFC').trim();
 const noAccent=s=>norm(s).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const headRe=/^Câu\s*(\d+)\s*[.:\-–]\s*(.*)$/i;
 function sections(elems){
  let out=[],current=null;for(const el of elems){
   let m=el.kind==='p'?el.text.match(headRe):null;
   if(m){current={id:Number(m[1]),heading:m[2],els:[]};out.push(current);continue}
   if(current)current.els.push(el)
  }return out
 }
 function getAnswerData(doc){
  const secs=sections(doc.elems),data={};
  for(let i=0;i<secs.length;i++){
   let sec=secs[i],table=sec.els.find(e=>e.kind==='table')?.rows||[];
   if(sec.id===1&&table.length>=2){
    data[1]={};
    table[0].forEach((left,j)=>{const id=Number(left);if(id)data[1][id]=norm(table[1][j]).toUpperCase()})
   }else{
    let ans={};
    for(const row of table)for(let j=0;j+1<row.length;j+=2){const k=Number(row[j]),v=norm(row[j+1]);if(k&&v)ans[k]=v}
    data[sec.id]=ans
   }
  }
  return data
 }
 function groups(elems){return sections(elems)}
 function wbank(sec){
  const a=sec.els.filter(e=>e.kind==='p').map(e=>e.text).find(t=>/^Từ khóa\s*:/i.test(t));
  return a?a.replace(/^Từ khóa\s*:/i,'').split('|').map(norm).filter(Boolean):[]
 }
 function hash(str){let h=2166136261;for(let c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
 function shuffleSeed(arr,seed){let a=arr.slice(),x=(hash(seed)||1);for(let i=a.length-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;let j=(x>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
 function makeFive(pool,correct,code){
  const others=[...new Map(pool.filter(x=>noAccent(x)!==noAccent(correct)).map(x=>[noAccent(x),x])).values()];
  if(others.length<4)throw Error('Câu '+code+': cần ít nhất 4 từ khóa nhiễu khác nhau.');
  const five=shuffleSeed([correct,...shuffleSeed(others,code+'bad').slice(0,4)],code+'good');
  return {values:five,correctIndex:five.findIndex(x=>noAccent(x)===noAccent(correct))}
 }
 function parseClassWorksheet(questionDoc,answerDoc){
  const ss=groups(questionDoc.elems),answers=getAnswerData(answerDoc),results=[],audit={matching:0,keyword2:0,keyword3:0};
  if(ss.length<3||!answers[1]||!answers[2]||!answers[3])throw Error('Hai file Word không đúng cặp phiếu và đáp án Bài 11.');
  const first=ss.find(s=>s.id===1),table=first?.els.find(e=>e.kind==='table')?.rows||[];
  const left=[],right=[];
  for(const row of table.slice(1)){let a=row[0]||'',b=row[1]||'',ma=a.match(/^\s*(\d+)\s*[.:\-]\s*(.+)$/),mb=b.match(/^\s*([A-H])\s*[.:\-]\s*(.+)$/i);
   if(ma)left.push({id:ma[1],text:ma[2]});if(mb)right.push({id:mb[1].toUpperCase(),text:mb[2]})
  }
  if(left.length!==6||right.length!==8)throw Error('Câu 1 phải có 6 mục cột A và 8 phương án cột B, hiện nhận '+left.length+'/'+right.length+'.');
  let matchAns={};for(const l of left){let v=answers[1][Number(l.id)];if(!right.some(r=>r.id===v))throw Error('Câu nối cột thiếu đáp án cho '+l.id);matchAns[l.id]=v}
  results.push({MA_CAU:'WORD-11-01',VONG:'1',MUC_DO:'3',KIEU_CAU:'NOI_COT',NOI_DUNG:'Câu 1. '+first.heading,MATCH_LEFT:left,MATCH_RIGHT:right,MATCH_ANSWERS:matchAns,THOI_GIAN_GIAY:'150',DAP_AN:'GHÉP CỘT',DIEM:'0',GIAI_THICH:'Nối 6 mục cột A với cột B; có 2 phương án nhiễu.'});
  audit.matching=6;
  for(const num of [2,3]){
   const sec=ss.find(s=>s.id===num);if(!sec)throw Error('Thiếu câu '+num+' trong phiếu học sinh.');
   const pool=wbank(sec);if(pool.length<5)throw Error('Câu '+num+' không đủ ngân hàng từ khóa.');
   let contexts=new Map();
   for(const e of sec.els){
    if(e.kind!=='p')continue;
    if(/^Từ khóa\s*:|^\d+\.\s*Khai thác/i.test(e.text))continue;
    const re=/\((\d+)\)\s*_{2,}/g;
    let m;while((m=re.exec(e.text))){const id=Number(m[1]);if(!contexts.has(id))contexts.set(id,e.text)}
   }
   const answer=answers[num],n=num===2?11:6;
   for(let id=1;id<=n;id++){
    let correct=answer[id],source=contexts.get(id);
    if(!correct||!source)throw Error('Câu '+num+' thiếu ngữ cảnh/đáp án ô ('+id+').');
    const cleaned=source.replace(/\((\d+)\)\s*_{2,}/g,(whole,k)=>Number(k)===id?'〔 ? 〕':'[ ... ]').replace(/^[–-]\s*/,'');
    const five=makeFive(pool,correct,'C'+num+'-'+id),code='WORD-11-'+num+'-'+String(id).padStart(2,'0');
    const item={MA_CAU:code,VONG:String(num===2?2:3),MUC_DO:'2',KIEU_CAU:'TU_KHOA_5',NOI_DUNG:'Câu '+num+' – ô ('+id+'/'+n+'). '+cleaned,KEYWORDS:five.values,DAP_AN:'ABCDE'[five.correctIndex],CORRECT_TEXT:correct,THOI_GIAN_GIAY:'40',DIEM:'0',GIAI_THICH:'Từ khóa đúng: '+correct+'.',WORD_SECTION:num,WORD_SLOT:id};
    results.push(item)
   }
   audit['keyword'+num]=n;
  }
  if(results.length!==18||audit.matching!==6||audit.keyword2!==11||audit.keyword3!==6)throw Error('Đối chiếu Word Bài 11 chưa đạt số lượng 6 + 11 + 6.');
  return{questions:results,audit,source:'word-paired',title:'Bài 11 – Khai thác, sử dụng và bảo vệ thiên nhiên ở châu Phi'}
 }
 function parseTemplate(doc){
  const ss=sections(doc.elems),questions=[];
  for(const sec of ss){
   const heading=sec.heading,paras=sec.els.filter(x=>x.kind==='p').map(x=>x.text);
   const type=/NỐI CỘT/i.test(heading)?'NOI_COT':/ĐÚNG\s*\/\s*SAI/i.test(heading)?'DUNG_SAI':/TỪ KHÓA|CHỌN TỪ/i.test(heading)?'TU_KHOA_5':/TRẢ LỜI NGẮN/i.test(heading)?'TRA_LOI_NGAN':'TRAC_NGHIEM';
   const answerLine=paras.find(x=>/^Đáp\s*án\s*:/i.test(x))||'';
   const answer=answerLine.replace(/^Đáp\s*án\s*:/i,'').trim();
   const explanation=(paras.find(x=>/^Giải\s*thích\s*:/i.test(x))||'').replace(/^Giải\s*thích\s*:/i,'').trim();
   let item={MA_CAU:'WORD-T-'+sec.id,VONG:'1',MUC_DO:'2',KIEU_CAU:type,NOI_DUNG:paras.find(p=>/^Nội\s*dung\s*:/i.test(p))?.replace(/^Nội\s*dung\s*:/i,'').trim()||heading,THOI_GIAN_GIAY:type==='NOI_COT'?'150':'40',DIEM:'0',DAP_AN:answer,GIAI_THICH:explanation};
   if(type==='TRAC_NGHIEM'){
    for(const line of paras){let m=line.match(/^([A-D])\s*[.:\-]\s*(.+)$/);if(m)item[m[1]]=m[2]}
    if(!/^[A-D]$/i.test(answer)||!item[answer.toUpperCase()])continue;
   }else if(type==='TU_KHOA_5'){
    const line=paras.find(p=>/^Từ khóa\s*:/i.test(p));item.KEYWORDS=line?.replace(/^Từ khóa\s*:/i,'').split('|').map(norm).filter(Boolean)||[];
    if(item.KEYWORDS.length!==5)continue;
    item.CORRECT_TEXT=item.KEYWORDS['ABCDE'.indexOf(answer.toUpperCase())];
   }else if(type==='DUNG_SAI'){
    let statements=paras.filter(p=>/^\d+[.:\-]\s+/.test(p)).map(p=>p.replace(/^\d+[.:\-]\s+/,''));
    item.STATEMENTS=statements;item.TRUE_FALSE=answer.toUpperCase().split(/[|;, ]+/).filter(Boolean).map(a=>a==='Đ' || a==='D' || a==='TRUE'?'D':'S');
    if(!statements.length||statements.length!==item.TRUE_FALSE.length)continue
   }else if(type==='NOI_COT'){
    const table=sec.els.find(x=>x.kind==='table')?.rows||[],left=[],right=[];
    for(const row of table.slice(1)){let a=(row[0]||'').match(/^\s*(\d+)\s*[.:\-]\s*(.+)$/),b=(row[1]||'').match(/^\s*([A-Z])\s*[.:\-]\s*(.+)$/i);if(a)left.push({id:a[1],text:a[2]});if(b)right.push({id:b[1].toUpperCase(),text:b[2]})}
    item.MATCH_LEFT=left;item.MATCH_RIGHT=right;item.MATCH_ANSWERS={};
    for(const part of answer.split(/[;,|]+/)){let m=part.match(/(\d+)\s*[-–:=]\s*([A-Z])/i);if(m)item.MATCH_ANSWERS[m[1]]=m[2].toUpperCase()}
    if(!left.length||left.some(x=>!item.MATCH_ANSWERS[x.id]))continue;
   }else if(type==='TRA_LOI_NGAN'){item.CORRECT_TEXT=answer;if(!answer)continue}
   questions.push(item)
  }
  if(!questions.length)throw Error('Word chưa có câu hỏi/đáp án theo mẫu. Hãy dùng mẫu Word hỗ trợ hoặc tải kèm file đáp án Bài 11.');
  return{questions,audit:{templateQuestions:questions.length},source:'word-template',title:doc.filename}
 }
 async function parseFiles(files){
  const docs=await Promise.all(files.map(parseWord)),qd=docs.find(x=>x.kind==='questions'),ad=docs.find(x=>x.kind==='answer');
  if(qd&&ad)return parseClassWorksheet(qd,ad);
  if(qd)return parseTemplate(qd);
  throw Error('Cần tải phiếu câu hỏi Word; tệp hiện tại chỉ chứa đáp án giáo viên.')
 }
 return{parseWord,parseFiles,parseClassWorksheet,parseTemplate}
})();
