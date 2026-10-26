// Biblioteca integrada ao MedQuest. RLS do Supabase restringe toda gravação ao administrador.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const areas={imunologia:"Imunologia",microbiologia:"Microbiologia",patologia:"Patologia",farmacologia:"Farmacologia",parasitologia:"Parasitologia"};
const admin=()=>typeof perfilAtual!=="undefined" && perfilAtual?.admin===true;
const slug=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,95);
const names=()=>Object.entries(areas).map(([id,label])=>[id,label]);
const section=document.createElement("section");
section.id="tela-biblioteca";section.className="mq-library";section.style.display="none";
section.innerHTML=`
<div class="mq-library-head"><div><small>ACERVO ACADÊMICO</small><h1>Biblioteca MedQuest</h1><p>Resumos e cadernos de questões do MDA II.</p></div><button type="button" id="mq-back">← Voltar ao início</button></div>
<div class="mq-library-tabs">
<button type="button" class="active" data-mq-tab="resumo">Resumos em PDF</button>
<button type="button" data-mq-tab="questoes_pdf">Cadernos de questões</button>
<button type="button" data-mq-tab="admin" id="mq-admin-tab" hidden>Gerenciar conteúdo</button>
</div>
<div id="mq-list-panel">
<div class="mq-library-filter"><select id="mq-filter-area"><option value="">Todas as disciplinas</option></select><input id="mq-filter-text" placeholder="Pesquisar materiais..."></div>
<p id="mq-count"></p><div id="mq-list" class="mq-library-grid"></div><p id="mq-empty" class="mq-msg" hidden>Nenhum material publicado nesta categoria.</p>
</div>
<div id="mq-editor" hidden>
<div class="mq-library-box"><h2>Publicar PDF</h2><p>Somente administradores. Arquivo privado para alunos aprovados (até 35 MB).</p>
<form id="mq-pdf-form" class="mq-library-form">
<label>Tipo<select id="mq-pdf-type"><option value="resumo">Resumo</option><option value="questoes_pdf">Caderno de questões</option></select></label>
<label>Disciplina<select id="mq-pdf-area"></select></label><label>Assunto<input id="mq-pdf-topic" maxlength="160" required></label>
<label>Título<input id="mq-pdf-title" maxlength="160" required></label>
<label class="wide">Arquivo PDF<input type="file" id="mq-pdf-file" accept=".pdf,application/pdf" required></label>
<div class="wide"><button type="submit">Publicar PDF</button></div></form><p id="mq-pdf-status" role="status"></p></div>
<div class="mq-library-box"><h2>Cadastrar questão interativa</h2><p>Com quatro alternativas, resposta correta e explicação.</p>
<form id="mq-q-form" class="mq-library-form">
<label>Disciplina<select id="mq-q-area"></select></label><label>Assunto<input id="mq-q-topic" maxlength="160" required></label>
<label class="wide">Enunciado<textarea id="mq-q-text" rows="4" required></textarea></label>
<label class="wide">Alternativa A<input id="mq-q-a" required></label><label class="wide">Alternativa B<input id="mq-q-b" required></label>
<label class="wide">Alternativa C<input id="mq-q-c" required></label><label class="wide">Alternativa D<input id="mq-q-d" required></label>
<label>Gabarito<select id="mq-q-key"><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
<label>Hot Point<input id="mq-q-hp" value="Hot Point 1" maxlength="80"></label>
<label>Nível de dificuldade<select id="mq-q-level">
<option value="">Não classificada</option><option value="facil">Fácil</option>
<option value="intermediario">Intermediário</option><option value="dificil">Difícil</option>
<option value="muito_dificil">Muito difícil</option></select></label>
<label class="wide">Gabarito comentado<textarea id="mq-q-comment" rows="5" required></textarea></label>
<div class="wide"><button type="submit">Cadastrar questão</button></div></form><p id="mq-q-status" role="status"></p></div>
<div class="mq-library-box"><h2>Importar questões por JSON</h2><p>Arquivo com lista de questões ou um objeto contendo "questoes". As questões já cadastradas não são substituídas.</p>
<form id="mq-json-form" class="mq-library-form">
<label>Disciplina<select id="mq-json-area"></select></label><label>Assunto<input id="mq-json-topic" maxlength="160" required></label>
<label class="wide">Arquivo JSON<input id="mq-json-file" type="file" accept=".json,application/json" required></label>
<div class="wide"><button type="submit">Validar e importar</button></div></form><p id="mq-json-status" role="status"></p></div>
</div>`;
const root=$("main-content");if(!root)return;
root.append(section);
for(const id of ["mq-filter-area","mq-pdf-area","mq-q-area","mq-json-area"]){
 for(const [value,label] of names())$(id).add(new Option(label,value));
}
let list=[],kind="resumo";
function status(id,message,failed=false){const node=$(id);node.textContent=message;node.style.color=failed?"#f08a8a":"#65d2a1"}
async function fetchList(){
 const r=await db.from("materiais_medquest").select("id,tipo,disciplina_id,tema_id,titulo,descricao,arquivo_path,criado_em").order("criado_em",{ascending:false});
 if(r.error)throw r.error;
 list=r.data||[];render();
}
function render(){
 const q=$("mq-filter-text").value.trim().toLowerCase(),a=$("mq-filter-area").value,container=$("mq-list");container.replaceChildren();
 const filtered=list.filter(x=>x.tipo===kind&&(!a||x.disciplina_id===a)&&(!q||[x.titulo,x.tema_id,x.descricao||""].join(" ").toLowerCase().includes(q)));
 $("mq-count").textContent=filtered.length+" materiais encontrados";$("mq-empty").hidden=filtered.length!==0;
 for(const item of filtered){
  const card=document.createElement("article");card.className="mq-library-card";
  const k=document.createElement("small");k.textContent=(areas[item.disciplina_id]||item.disciplina_id)+" · "+item.tema_id;
  const h=document.createElement("h3");h.textContent=item.titulo;
  const p=document.createElement("p");p.textContent=item.descricao||"Material acadêmico em PDF";
  const controls=document.createElement("div");controls.className="mq-actions";
  const open=document.createElement("button");open.textContent="Abrir PDF";open.onclick=()=>openPDF(item.arquivo_path);controls.append(open);
  if(admin()){const del=document.createElement("button");del.className="outline";del.textContent="Excluir";del.onclick=()=>removePDF(item);controls.append(del)}
  card.append(k,h,p,controls);container.append(card);
 }
}
async function openPDF(path){
 const w=window.open("about:blank","_blank");
 const r=await db.storage.from("materiais_medquest").createSignedUrl(path,120);
 if(r.error||!r.data?.signedUrl){if(w)w.close();alert("Não foi possível abrir o PDF: "+(r.error?.message||"indisponível"));return}
 if(w)w.location.replace(r.data.signedUrl);else window.location.href=r.data.signedUrl;
}
async function removePDF(item){
 if(!admin()||!confirm("Excluir este arquivo permanentemente?"))return;
 const r=await db.from("materiais_medquest").delete().eq("id",item.id);
 if(r.error){alert(r.error.message);return}
 const d=await db.storage.from("materiais_medquest").remove([item.arquivo_path]);
 if(d.error)alert("Registro excluído, mas o arquivo não foi removido: "+d.error.message);
 await fetchList();
}
function tab(name){
 if(name==="admin"&&!admin())return;
 document.querySelectorAll("[data-mq-tab]").forEach(b=>b.classList.toggle("active",b.dataset.mqTab===name));
 $("mq-list-panel").hidden=name==="admin";$("mq-editor").hidden=name!=="admin";
 if(name!=="admin"){kind=name;render()}
}
async function show(requested="resumo"){
 if(typeof usuarioAtual==="undefined"||!usuarioAtual||!perfilAtual?.aprovado)return;
 esconderApp();section.style.display="block";fecharSidebar();setNavActive(requested==="admin"?null:"nav-resumo");
 $("mq-admin-tab").hidden=!admin();tab(requested==="admin"&&admin()?"admin":requested==="questoes_pdf"?"questoes_pdf":"resumo");
 try{await fetchList()}catch(e){$("mq-count").textContent="Falha ao carregar biblioteca: "+e.message}
}
function valid(q,n){
 let alts=q.alternativas;
 if(alts&&!Array.isArray(alts)&&typeof alts==="object")alts=Object.entries(alts).map(([letra,texto])=>({letra,texto}));
 if(!Array.isArray(alts))throw Error("Questão "+n+": alternativas ausentes");
 alts=alts.map((a,i)=>typeof a==="string"?{letra:"ABCD"[i],texto:a}:{letra:String(a.letra||"").toUpperCase(),texto:String(a.texto||"").trim()});
 const text=String(q.enunciado||"").trim(),key=String(q.correta||"").toUpperCase();
 if(text.length<10||alts.length!==4||alts.some((a,i)=>a.letra!=="ABCD"[i]||!a.texto)||!["A","B","C","D"].includes(key)||String(q.comentario||"").trim().length<3)
 throw Error("Questão "+n+": enunciado, A–D, correta ou comentário inválido");
 const grade=String(q.nivel_dificuldade||"").trim().toLowerCase();
 if(grade&&!["facil","intermediario","dificil","muito_dificil"].includes(grade))
   throw Error("Questão "+n+": nível de dificuldade inválido");
 return {enunciado:text,alternativas:alts,correta:key,comentario:String(q.comentario).trim(),
   hotpoint:String(q.hotpoint||"Hot Point").slice(0,80),nivel_dificuldade:grade||null};
}
async function saveQuestions(input,disc,topic){
 if(!admin())throw Error("Cadastro exclusivo do administrador");
 const id=slug(topic);if(!areas[disc]||!id)throw Error("Área ou assunto inválido");
 const qs=input.map((q,i)=>valid(q,i+1)).filter((q,i,a)=>a.findIndex(x=>x.enunciado===q.enunciado)===i);
 let existing=[],offset=0;
 while(true){
  const r=await db.from("questoes_medquest").select("enunciado,ordem").eq("disciplina_id",disc).eq("tema_id",id).range(offset,offset+999);
  if(r.error)throw r.error;existing.push(...(r.data||[]));
  if((r.data||[]).length<1000)break;offset+=1000;
 }
 const seen=new Set(existing.map(q=>q.enunciado));
 const fresh=qs.filter(q=>!seen.has(q.enunciado));
 let ord=Math.max(0,...existing.map(q=>q.ordem||0))+1;
 for(let i=0;i<fresh.length;i+=40){
  const records=fresh.slice(i,i+40).map(q=>({...q,disciplina_id:disc,tema_id:id,tema_nome:topic,ordem:ord++}));
  const r=await db.from("questoes_medquest").insert(records);if(r.error)throw r.error;
 }
 return {added:fresh.length,skipped:input.length-fresh.length};
}
$("mq-back").onclick=()=>irParaDashboard();
$("mq-filter-area").onchange=render;$("mq-filter-text").oninput=render;
document.querySelectorAll("[data-mq-tab]").forEach(btn=>btn.onclick=()=>tab(btn.dataset.mqTab));
$("mq-pdf-form").onsubmit=async e=>{
 e.preventDefault();if(!admin())return;
 const f=$("mq-pdf-file").files[0],disc=$("mq-pdf-area").value,topic=$("mq-pdf-topic").value.trim(),title=$("mq-pdf-title").value.trim();
 if(!f||!topic||!title||f.size>36700160||!(f.type==="application/pdf"||f.name.toLowerCase().endsWith(".pdf")))
 return status("mq-pdf-status","Selecione um PDF válido de até 35 MB",true);
 const btn=e.submitter;btn.disabled=true;btn.textContent="Publicando...";
 const path=disc+"/"+slug(topic)+"/"+crypto.randomUUID()+".pdf";
 try{
  const upload=await db.storage.from("materiais_medquest").upload(path,f,{contentType:"application/pdf",upsert:false});
  if(upload.error)throw upload.error;
  const save=await db.from("materiais_medquest").insert({tipo:$("mq-pdf-type").value,disciplina_id:disc,tema_id:topic,titulo:title,arquivo_path:path});
  if(save.error){await db.storage.from("materiais_medquest").remove([path]);throw save.error}
  e.target.reset();status("mq-pdf-status","PDF publicado com sucesso");await fetchList();
 }catch(error){status("mq-pdf-status",error.message,true)}
 finally{btn.disabled=false;btn.textContent="Publicar PDF"}
};
$("mq-q-form").onsubmit=async e=>{
 e.preventDefault();if(!admin())return;
 const btn=e.submitter;btn.disabled=true;
 try{
  const q={enunciado:$("mq-q-text").value,alternativas:"ABCD".split("").map(c=>({letra:c,texto:$("mq-q-"+c.toLowerCase()).value})),
    correta:$("mq-q-key").value,comentario:$("mq-q-comment").value,hotpoint:$("mq-q-hp").value,nivel_dificuldade:$("mq-q-level").value};
  const res=await saveQuestions([q],$("mq-q-area").value,$("mq-q-topic").value.trim());
  status("mq-q-status",res.added+" questão cadastrada, "+res.skipped+" repetida");
  if(res.added)for(const id of ["mq-q-text","mq-q-a","mq-q-b","mq-q-c","mq-q-d","mq-q-comment"])$(id).value="";
 }catch(error){status("mq-q-status",error.message,true)}finally{btn.disabled=false}
};
$("mq-json-form").onsubmit=async e=>{
 e.preventDefault();if(!admin())return;
 const file=$("mq-json-file").files[0],disc=$("mq-json-area").value,topic=$("mq-json-topic").value.trim(),btn=e.submitter;
 if(!file||!topic)return status("mq-json-status","Selecione JSON e assunto",true);
 btn.disabled=true;btn.textContent="Validando...";
 try{
  if(file.size>5242880)throw Error("JSON maior que 5 MB");
  const parsed=JSON.parse(await file.text()),qs=Array.isArray(parsed)?parsed:parsed.questoes;
  if(!Array.isArray(qs)||qs.length<1||qs.length>1000)throw Error("JSON deve conter 1 a 1000 questões");
  qs.forEach((q,i)=>valid(q,i+1));
  if(!confirm("Importar "+qs.length+" questões para "+areas[disc]+" / "+topic+"?"))return;
  btn.textContent="Importando...";const r=await saveQuestions(qs,disc,topic);
  status("mq-json-status",r.added+" importadas, "+r.skipped+" duplicatas ignoradas");e.target.reset();
 }catch(error){status("mq-json-status",error.message,true)}
 finally{btn.disabled=false;btn.textContent="Validar e importar"}
};

// Envio administrativo em lote: preenche automaticamente disciplina e assunto
// a partir dos títulos dos resumos MDA II, mantendo todos os PDFs originais.
const bulkPanel=document.createElement("div");
bulkPanel.className="mq-library-box";
bulkPanel.innerHTML='<h2>Publicar vários resumos de uma vez</h2>'+
 '<p>Selecione os PDFs finais. Confira a disciplina e o assunto de cada arquivo antes de publicar. '+
 'Tamanho máximo por PDF: 35 MB. A publicação é exclusiva do administrador.</p>'+
 '<input type="file" id="mq-bulk-files" accept=".pdf,application/pdf" multiple aria-label="Selecionar resumos em PDF">'+
 '<div id="mq-bulk-rows" class="mq-bulk-rows"></div>'+
 '<div style="margin-top:16px"><button type="button" id="mq-bulk-send" disabled>Publicar os resumos</button></div>'+
 '<p id="mq-bulk-status" role="status" aria-live="polite"></p>';
$("mq-editor").append(bulkPanel);
const summaryTypes=[
 ["microbiota","microbiologia","Microbiota Humana"],
 ["infeccao-hospitalar","microbiologia","Infecção Hospitalar"],
 ["biofilme","microbiologia","Biofilmes Bacterianos"],
 ["staphylococcus","microbiologia","Staphylococcus sp."],
 ["hipersensibilidade","imunologia","Distúrbios de Hipersensibilidade"],
 ["imunodeficiencias","imunologia","Imunodeficiências Primárias"],
 ["antibiotico-i-","farmacologia","Antibióticos I — Beta-lactâmicos"],
 ["antibioticos-i-","farmacologia","Antibióticos I — Beta-lactâmicos"],
 ["antibiotico-ii-","farmacologia","Antibióticos II — Síntese Proteica"],
 ["anibioticos-ii-","farmacologia","Antibióticos II — Síntese Proteica"],
 ["antibioticos-ii-","farmacologia","Antibióticos II — Síntese Proteica"],
 ["antibiotico-iii-","farmacologia","Antibióticos III — Sulfonamidas e Quinolonas"],
 ["antibioticos-iii-","farmacologia","Antibióticos III — Sulfonamidas e Quinolonas"],
 ["sulfonamidas","farmacologia","Antibióticos III — Sulfonamidas e Quinolonas"],
 ["quinolonas","farmacologia","Antibióticos III — Sulfonamidas e Quinolonas"],
 ["beta-lactamicos","farmacologia","Antibióticos I — Beta-lactâmicos"],
 ["b-lactamicos","farmacologia","Antibióticos I — Beta-lactâmicos"],
 ["sintese-proteicas","farmacologia","Antibióticos II — Síntese Proteica"],
 ["sintese-proteica","farmacologia","Antibióticos II — Síntese Proteica"]
];
let queuedSummaries=[];
const autoSummary=(filename)=>{
 const clean=slug(filename);
 const match=summaryTypes.find(([key])=>clean.includes(key));
 return match?{area:match[1],topic:match[2]}:{area:"microbiologia",topic:filename.replace(/\.pdf$/i,"").trim()};
};
const createBulkField=(title,value)=>{
 const label=document.createElement("label");label.textContent=title;
 const field=document.createElement("input");field.value=value;field.required=true;field.maxLength=160;
 label.append(field);return {label,input:field};
};
$("mq-bulk-files").onchange=e=>{
 queuedSummaries=[];const container=$("mq-bulk-rows");container.replaceChildren();
 const files=Array.from(e.target.files||[]);
 $("mq-bulk-send").disabled=!files.length;
 if(!files.length){status("mq-bulk-status","");return}
 for(const f of files){
  const preset=autoSummary(f.name),row=document.createElement("div");row.className="mq-bulk-row";
  const fileName=document.createElement("div");fileName.className="mq-bulk-filename";
  fileName.textContent=f.name+" · "+(f.size/1048576).toFixed(1)+" MB";
  const d=document.createElement("label");d.textContent="Disciplina";
  const area=document.createElement("select");
  for(const [key,name] of names())area.add(new Option(name,key));
  area.value=preset.area;d.append(area);
  const topic=createBulkField("Assunto",preset.topic);
  const title=createBulkField("Título","Resumo — "+preset.topic);
  row.append(fileName,d,topic.label,title.label);container.append(row);
  queuedSummaries.push({file:f,area,topic:topic.input,title:title.input});
 }
 $("mq-bulk-send").textContent="Publicar "+files.length+(files.length===1?" resumo":" resumos");
 status("mq-bulk-status","Confira as informações e publique usando a conta de administrador.");
};
$("mq-bulk-send").onclick=async e=>{
 if(!admin())return status("mq-bulk-status","Publicação exclusiva do administrador.",true);
 if(!queuedSummaries.length)return;
 const candidates=queuedSummaries.map(item=>({
  file:item.file,disc:item.area.value,topic:item.topic.value.trim(),title:item.title.value.trim()
 }));
 if(candidates.some(x=>!x.topic||!x.title||!areas[x.disc]||
       x.file.size>36700160||x.file.size===0||
       !(x.file.type==="application/pdf"||x.file.name.toLowerCase().endsWith(".pdf"))))
  return status("mq-bulk-status","Revise os campos e confirme que cada PDF tem até 35 MB.",true);
 if(!confirm("Publicar "+candidates.length+" resumos oficiais no MedQuest?"))return;
 const btn=e.currentTarget;btn.disabled=true;
 let imported=0,skipped=0;const failed=[];
 try{
  await fetchList();
  const present=new Set(list.filter(x=>x.tipo==="resumo")
    .map(x=>x.disciplina_id+"|"+slug(x.tema_id)));
  for(let index=0;index<candidates.length;index++){
   const x=candidates[index],identifier=x.disc+"|"+slug(x.topic);
   if(present.has(identifier)){skipped++;continue}
   btn.textContent="Publicando "+(index+1)+" de "+candidates.length+"...";
   status("mq-bulk-status","Enviando: "+x.file.name+" ("+(index+1)+"/"+candidates.length+")");
   const path=x.disc+"/"+slug(x.topic)+"/"+crypto.randomUUID()+".pdf";
   try{
    const upload=await db.storage.from("materiais_medquest").upload(path,x.file,{
      contentType:"application/pdf",upsert:false
    });
    if(upload.error)throw upload.error;
    const saved=await db.from("materiais_medquest").insert({
      tipo:"resumo",disciplina_id:x.disc,tema_id:x.topic,
      titulo:x.title,arquivo_path:path
    });
    if(saved.error){
      await db.storage.from("materiais_medquest").remove([path]);
      throw saved.error;
    }
    present.add(identifier);imported++;
   }catch(error){failed.push(x.file.name+": "+error.message)}
  }
  const count=imported+" publicados, "+skipped+" já existentes";
  status("mq-bulk-status",failed.length?count+"; "+failed.length+" falharam. "+failed.join(" | "):count,
    failed.length>0);
  await fetchList();
 }catch(error){status("mq-bulk-status","Falha: "+error.message,true)}
 finally{btn.disabled=false;btn.textContent="Publicar "+queuedSummaries.length+" resumos"}
};

const oldHide=window.esconderApp;
window.esconderApp=function(){oldHide();section.style.display="none"};
const oldScreen=window.mostrarTela;
window.mostrarTela=function(name){oldScreen(name);section.style.display="none"};
window.abrirBiblioteca=show;
})();