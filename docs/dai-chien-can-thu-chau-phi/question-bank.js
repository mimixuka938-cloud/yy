(function bankModule(){
"use strict";
const KEY="chauphi_custom_bank_v3",MODE="chauphi_bank_mode_v3";
let custom=[],mode="builtin";
const s=v=>String(v??"").trim();
const canon=v=>s(v).replace(/[đĐ]/g,"d").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const types={mc:"mc",tracnghiem:"mc",choice:"mc",tf:"tf",dungsai:"tf",truefalse:"tf",fill:"fill",dienkhuyet:"fill",dientu:"fill",match:"match",noicot:"match",ghepcap:"match",ghepnoi:"match"};
function norm(input){
const items=Array.isArray(input)?input:input?.questions;
if(!Array.isArray(items)||!items.length||items.length>500)throw Error("Cần 1–500 câu hỏi hợp lệ.");
const seen=new Set();
return items.map((a,i)=>{
const n=i+1,type=types[canon(a.type??a.loai??a.dang)],question=s(a.question??a.cau_hoi??a.cauHoi),answer=a.answer??a.dap_an;
if(!type||!question)throw Error("Dòng "+n+": thiếu loại hoặc nội dung câu hỏi.");
if(question.length>700)throw Error("Dòng "+n+": câu hỏi quá dài.");
if(seen.has(type+canon(question)))throw Error("Dòng "+n+": câu hỏi trùng.");seen.add(type+canon(question));
const diff=canon(a.difficulty??a.do_kho);
const q={id:"GV"+String(n).padStart(3,"0"),type,question,difficulty:diff==="vandung"?"vận dụng":diff==="trungbinh"?"trung bình":"dễ",explanation:s(a.explanation??a.giai_thich).slice(0,900)||"Giáo viên giải thích kiến thức theo SGK."};
if(type==="mc"||type==="fill"){
let opt=a.options;
if(typeof opt==="string")opt=opt.split("|");
if(!Array.isArray(opt))opt=[a.A??a.a,a.B??a.b,a.C??a.c,a.D??a.d];
q.options=opt.map(s).filter(Boolean);
}
if(type==="mc"){
if(q.options.length<2||q.options.length>6)throw Error("Dòng "+n+": trắc nghiệm cần 2–6 đáp án.");
const aStr=s(answer);
let idx=typeof answer==="number"?answer:/^[A-F]$/i.test(aStr)?aStr.toUpperCase().charCodeAt(0)-65:/^[1-6]$/.test(aStr)?Number(aStr)-1:aStr==="0"?0:q.options.findIndex(o=>canon(o)===canon(aStr));
if(idx<0||idx>=q.options.length)throw Error("Dòng "+n+": đáp án cần A, B, C, D hoặc nội dung phương án đúng.");
q.answer=idx;
}else if(type==="tf"){
const v=canon(answer);if(["dung","true","1"].includes(v))q.answer=true;else if(["sai","false","0"].includes(v))q.answer=false;else throw Error("Dòng "+n+": phải điền Đúng hoặc Sai.");
}else if(type==="fill"){
q.answer=s(answer);if(!q.answer)throw Error("Dòng "+n+": thiếu đáp án điền khuyết.");
if(q.options.length<2)q.options=[];else if(!q.options.some(o=>canon(o)===canon(q.answer)))q.options.unshift(q.answer);
}else{
let ps=a.pairs??a.cap_noi??a.A??a.a;
ps=Array.isArray(ps)?ps.map(p=>Array.isArray(p)?p:[p.left??p.a,p.right??p.b]):s(ps).split(/\s*\|\s*|\s*;\s*/).filter(Boolean).map(p=>p.split(/\s*(?:=>|->|::|→)\s*/));
q.pairs=ps.map(p=>p.map(s));
if(q.pairs.length<2||q.pairs.length>6||q.pairs.some(p=>p.length!==2||!p[0]||!p[1]))throw Error("Dòng "+n+": nối cột cần 2–6 cặp, cách nhau bằng |, mỗi cặp dùng dấu =>.");
}
return q;
});
}
function splitCSV(text){
const raw=String(text).replace(/^\uFEFF/,""),line=raw.split(/\r?\n/)[0]||"";
const sep=line.includes("\t")?"\t":line.split(";").length>line.split(",").length?";":",";
let q=false,cell="",row=[],out=[];
for(let i=0;i<raw.length;i++){
const c=raw[i];
if(c==='"'){if(q&&raw[i+1]==='"'){cell+='"';i++;}else q=!q;}
else if(c===sep&&!q){row.push(cell);cell="";}
else if((c==="\n"||c==="\r")&&!q){if(c==="\r"&&raw[i+1]==="\n")i++;row.push(cell);if(row.some(s))out.push(row);row=[];cell="";}
else cell+=c;
}
row.push(cell);if(row.some(s))out.push(row);
if(q)throw Error("CSV có dấu ngoặc kép chưa đóng.");return out;
}
function rowsToBank(rows){
if(rows.length<2)throw Error("File phải có hàng tiêu đề và nội dung.");
const h=rows[0].map(canon),pos=(...names)=>names.map(x=>h.indexOf(canon(x))).find(x=>x>=0)??-1;
const val=(row,...names)=>{const n=pos(...names);return n<0?"":s(row[n]);};
if(pos("loai","type")<0||pos("cau_hoi","question")<0)throw Error("Thiếu cột loai hoặc cau_hoi. Hãy tải tệp mẫu.");
return norm(rows.slice(1).map(r=>({
type:val(r,"loai","type"),question:val(r,"cau_hoi","question"),
A:val(r,"A"),B:val(r,"B"),C:val(r,"C"),D:val(r,"D"),
answer:val(r,"dap_an","answer"),explanation:val(r,"giai_thich","explanation"),
difficulty:val(r,"do_kho","difficulty"),pairs:val(r,"cap_noi","pairs")
})));
}
async function readXlsx(buffer){
if(typeof DOMParser!=="function"||typeof DecompressionStream!=="function")throw Error("Trình duyệt không hỗ trợ XLSX; hãy lưu Excel thành CSV UTF-8.");
const v=new DataView(buffer),bytes=new Uint8Array(buffer),decode=new TextDecoder();
let end=-1;for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65558);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
if(end<0)throw Error("Excel XLSX không hợp lệ.");
let p=v.getUint32(end+16,true),entries={};
for(let i=0;i<v.getUint16(end+10,true);i++){
if(v.getUint32(p,true)!==0x02014b50)throw Error("Excel bị lỗi.");
const nl=v.getUint16(p+28,true),ex=v.getUint16(p+30,true),co=v.getUint16(p+32,true);
const name=decode.decode(bytes.slice(p+46,p+46+nl));
entries[name]={method:v.getUint16(p+10,true),size:v.getUint32(p+20,true),offset:v.getUint32(p+42,true)};
p+=46+nl+ex+co;
}
async function read(name){
const e=entries[name];if(!e)return"";
const k=e.offset,at=k+30+v.getUint16(k+26,true)+v.getUint16(k+28,true),part=bytes.slice(at,at+e.size);
if(e.method===0)return decode.decode(part);
if(e.method!==8)throw Error("Định dạng nén XLSX chưa hỗ trợ.");
try{return decode.decode(await new Response(new Blob([part]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());}catch(err){throw Error("Không giải nén được Excel; hãy lưu thành CSV UTF-8.");}
}
const xml=x=>{const doc=new DOMParser().parseFromString(x,"text/xml");if(doc.getElementsByTagName("parsererror").length)throw Error("Dữ liệu Excel không hợp lệ.");return doc;};
const sharedXml=await read("xl/sharedStrings.xml"),shared=sharedXml?Array.from(xml(sharedXml).getElementsByTagName("si")).map(x=>x.textContent):[];
const file=Object.keys(entries).filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort()[0];if(!file)throw Error("Excel không có sheet hợp lệ.");
const result=[];
for(const row of Array.from(xml(await read(file)).getElementsByTagName("row"))){
const columns=[];
for(const cell of Array.from(row.getElementsByTagName("c"))){
let n=0;for(const char of (cell.getAttribute("r")||"A").match(/^[A-Z]+/)[0])n=n*26+char.charCodeAt(0)-64;n--;
const value=cell.getElementsByTagName("v")[0]?.textContent??"";
columns[n]=cell.getAttribute("t")==="s"?shared[Number(value)]??"":cell.getAttribute("t")==="inlineStr"?cell.getElementsByTagName("is")[0]?.textContent??"":value;
}if(columns.some(s))result.push(columns);
}
return result;
}
async function parseFile(file){
if(!file)throw Error("Chưa chọn tệp.");
if(file.size>5*1024*1024)throw Error("File quá lớn (tối đa 5 MB).");
const name=(file.name||"").toLowerCase();
if(name.endsWith(".csv")||name.endsWith(".tsv"))return rowsToBank(splitCSV(await file.text()));
if(name.endsWith(".xlsx"))return rowsToBank(await readXlsx(await file.arrayBuffer()));
if(name.endsWith(".json")){let obj;try{obj=JSON.parse(await file.text());}catch(e){throw Error("File JSON sai định dạng.");}return norm(obj);}
throw Error("Chỉ hỗ trợ .xlsx, .csv, .tsv hoặc .json. Chưa hỗ trợ .docx.");
}
function store(list){
const value=norm(list);
try{localStorage.setItem(KEY,JSON.stringify(value));localStorage.setItem(MODE,"uploaded");}catch(e){throw Error("Không thể lưu bộ câu hỏi; bộ nhớ trình duyệt có thể đã đầy.");}
custom=value;mode="uploaded";return value;
}
function setMode(v){if(v!=="builtin"&&v!=="uploaded"||v==="uploaded"&&!custom.length)throw Error("Chưa có bộ câu hỏi tải lên.");
mode=v;try{localStorage.setItem(MODE,v);}catch(e){}
}
function clear(){custom=[];mode="builtin";try{localStorage.removeItem(KEY);localStorage.setItem(MODE,"builtin");}catch(e){}}
const active=builtin=>mode==="uploaded"&&custom.length?custom:builtin;
const info=builtin=>{const list=active(builtin);return{mode,count:list.length,uploaded:custom.length,counts:Object.fromEntries(["mc","tf","fill","match"].map(t=>[t,list.filter(q=>q.type===t).length]))};};
function toCSV(questions){
const rows=[["loai","cau_hoi","A","B","C","D","dap_an","giai_thich","do_kho","cap_noi"]];
for(const q of questions){
const opts=q.options||[],ans=q.type==="mc"?String.fromCharCode(65+q.answer):q.type==="tf"?(q.answer?"Đúng":"Sai"):q.type==="fill"?q.answer:"";
rows.push([q.type,q.question,...[0,1,2,3].map(i=>opts[i]||""),ans,q.explanation||"",q.difficulty||"dễ",q.type==="match"?q.pairs.map(p=>p.join("=>")).join(" | "):""]);
}
return "\uFEFF"+rows.map(row=>row.map(v=>'"'+s(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
}
function saveFile(name,content,mime){
const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function template(){
const questions=[
{type:"mc",question:"Hoang mạc Sahara ở đâu?",options:["Bắc Phi","Đông Phi","Trung Phi","Nam Phi"],answer:0,explanation:"Sahara nằm ở Bắc Phi."},
{type:"tf",question:"Xích đạo đi qua châu Phi.",answer:true},
{type:"fill",question:"Sông ________ chảy qua Ai Cập.",options:["Nile","Congo","Niger","Zambezi"],answer:"Nile"},
{type:"match",question:"Ghép địa danh với vị trí.",pairs:[["Sahara","Bắc Phi"],["Kalahari","Nam Phi"]]}
];saveFile("MAU_CAU_HOI_CHAU_PHI.csv",toCSV(questions),"text/csv;charset=utf-8");
}
function exportActive(builtin,format){
const list=active(builtin);
if(format==="csv")saveFile("Cau_hoi_dang_dung.csv",toCSV(list),"text/csv;charset=utf-8");
else saveFile("Cau_hoi_dang_dung.json",JSON.stringify({questions:list},null,2),"application/json;charset=utf-8");
}
try{const stored=localStorage.getItem(KEY);if(stored)custom=norm(JSON.parse(stored));if(custom.length&&localStorage.getItem(MODE)==="uploaded")mode="uploaded";}catch(e){custom=[];mode="builtin";}
window.QuestionBankManager={parseFile,parseCSV:x=>rowsToBank(splitCSV(x)),parseJSON:norm,store,setMode,clear,active,info,template,exportActive,toCSV};
})();
