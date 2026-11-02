/* Original summaries and forthcoming lecture materials, grouped by subject. */
(()=>{
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const admin=()=>typeof perfilAtual!=='undefined'&&perfilAtual?.admin===true;
const types=[['expandido','Resumo expandido'],['simplificado','Resumo simplificado']];
const icon=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(kind==='simplificado'?'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>':'<path d="M12 5v15M12 5C8 3 4 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-6-1-10 1Z"/>')+'</svg>';
// Fixed cohort: only the twelve subjects submitted in the latest batch.
// Never select by upload date or list position: future uploads must not change scope.
const materialTopics={
 microbiologia:[/\bstreptococcus\b.*\benterococcus\b/,/\bbastonetes-gram-positivos\b/,/\bbastonetes-gram-negativos\b/,/\bneisseria\b/,/\benterobacteriaceae\b/,/\bmicobacterias\b/,/\bmycoplasma\b.*\bchlamydia\b/,/\btreponema\b.*\bleptospira\b/],
 farmacologia:[/\bantimicobacterianos\b/],
 parasitologia:[/\bentamoebas?\b/,/\bgiardia\b.*\btrichomonas\b/,/\btoxoplasma\b/]
};
const hasMaterialSections=g=>(materialTopics[g.area]||[]).some(pattern=>[g.topicId,g.topic,g.title].some(value=>pattern.test(norm(value))));
function model(pdfs,texts,canEdit=false,topicLinks=[]){
 const groups=new Map(),accounted=new Set();
 for(const p of pdfs.filter(p=>!p.tipo||p.tipo==='resumo')){
  const key=p.resumo_grupo_id||p.id;
  if(!groups.has(key))groups.set(key,{key,files:{}});
  groups.get(key).files[p.resumo_versao||'expandido']=p;
 }
 for(const g of groups.values()){
  const p=g.files.expandido||g.files.simplificado;
  const links=texts.filter(d=>d.area_id===p.disciplina_id&&(norm(d.assunto)===norm(p.tema_id)||norm(d.titulo)===norm(p.titulo)));
  links.forEach(d=>accounted.add(d.id));
  Object.assign(g,{area:p.disciplina_id,title:p.titulo,topicId:p.tema_id,topic:p.tema_nome||links[0]?.assunto||p.tema_id,officialId:links[0]?.id||null});
 }
 for(const d of texts)if(!accounted.has(d.id)&&(d.publicado||canEdit))groups.set('official:'+d.id,{key:'official:'+d.id,groupId:d.id,area:d.area_id,title:d.titulo,topicId:d.assunto,topic:d.assunto,officialId:d.id,files:{}});
 const extra=pdfs.filter(p=>['slide','capitulo'].includes(p.tipo));
 for(const link of topicLinks){const p=extra.find(p=>p.id===link.material_id);if(p)extra.push({...p,disciplina_id:link.disciplina_id,tema_id:link.tema_id,tema_nome:link.tema_nome,resumo_grupo_id:link.resumo_grupo_id})}
 for(const p of extra){
  let g=[...groups.values()].find(g=>g.area===p.disciplina_id&&norm(g.topicId)===norm(p.tema_id));
  if(!g){const key=p.resumo_grupo_id||p.id;g={key,area:p.disciplina_id,title:p.tema_nome||p.tema_id,topicId:p.tema_id,topic:p.tema_nome||p.tema_id,files:{}};groups.set(key,g)}
  g.materials||=[];if(!g.materials.some(file=>file.id===p.id))g.materials.push(p);
 }
 return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
}
function lectureMaterials(g,canEdit){
 const slides='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5m-4 0h8M7 8h10M7 11h6"/></svg>';
 return [['slide','Slides da aula',slides],['capitulo','Capítulos de referência',icon('expandido')]].map(([kind,label,symbol])=>{
  const files=(g.materials||[]).filter(p=>p.tipo===kind).sort((a,b)=>a.titulo.localeCompare(b.titulo,'pt-BR'));
  if(!files.length)return '';
  const add=canEdit?'<button class="mq-summary-publish" onclick="MedQuestSummaryVersions.pick(\''+g.key+'\',\''+kind+'\')">Adicionar PDF</button>':'';
  const rows=files.map(p=>'<section class="mq-summary-version mq-lecture-file"><div class="mq-summary-version-label"><h3>'+escape(p.titulo)+'</h3></div><div class="mq-summary-version-actions"><button class="study-pdf-read" onclick="studyOfficialPdf(\''+p.id+'\')">'+icon('expandido')+'Ler material</button><button class="study-pdf-download" onclick="studyOfficialDownload(\''+p.id+'\')">↓ Baixar PDF</button>'+(canEdit?'<details class="mq-summary-manage"><summary>Gerenciar</summary><div><button onclick="MedQuestSummaryVersions.pick(\''+g.key+'\',\''+kind+'\',\''+p.id+'\')">Substituir PDF</button><button onclick="studyEditPdfMetadata(\''+p.id+'\')">Editar identificação</button><button class="mq-material-delete" onclick="studyDeletePdf(\''+p.id+'\')">Excluir arquivo</button></div></details>':'')+'</div></section>').join('');
  return '<section class="mq-lecture-group" aria-label="'+label+'"><div class="mq-lecture-placeholder"><span class="mq-summary-version-icon">'+symbol+'</span><strong>'+label+'</strong>'+add+'</div><div class="mq-lecture-files">'+rows+'</div></section>';
 }).join('')+(canEdit&&hasMaterialSections(g)?'<div class="mq-summary-version-actions">'+[['slide','Adicionar slide'],['capitulo','Adicionar capítulo']].filter(([kind])=>!(g.materials||[]).some(p=>p.tipo===kind)).map(([kind,label])=>'<button class="mq-summary-publish" onclick="MedQuestSummaryVersions.pick(\''+g.key+'\',\''+kind+'\')">'+label+'</button>').join('')+'</div>':'');
}
let groups=[],refresh=()=>{},feedback=()=>{},pendingOpen=null;
const pending=new Set();
function render({pdfs,texts,topicLinks=[],chosen='',query='',canEdit=false,areaName=id=>id,onChanged=()=>{},onFeedback=()=>{},openKeys=[]}){
 groups=model(pdfs,texts,canEdit,topicLinks);refresh=onChanged;feedback=onFeedback;
 const forcedOpen=pendingOpen;pendingOpen=null;
 const visible=groups.filter(g=>(!chosen||g.area===chosen)&&(!query||norm(g.title+' '+g.topic).includes(norm(query))));
 return visible.map(g=>'<details class="mq-summary-topic" data-summary-key="'+escape(g.key)+'"'+(openKeys.includes(g.key)||forcedOpen===g.key?' open':'')+'><summary><span class="mq-summary-topic-icon">'+icon('expandido')+'</span><span class="mq-summary-heading"><strong>'+escape(g.title)+'</strong><small>'+escape(areaName(g.area))+' · '+escape(g.topic)+'</small></span><svg class="mq-summary-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="mq-summary-versions">'+types.map(([kind,label])=>{
  const p=g.files[kind];
  const actions=p?'<button class="study-pdf-read" onclick="studyOfficialPdf(\''+p.id+'\')">'+icon('expandido')+'Ler resumo</button><button class="study-pdf-download" onclick="studyOfficialDownload(\''+p.id+'\')">↓ Baixar PDF</button>':'<button disabled>Ler resumo</button><button disabled>Baixar PDF</button>';
  const manage=!canEdit?'':p?'<details class="mq-summary-manage"><summary>Gerenciar</summary><div><button onclick="MedQuestSummaryVersions.pick(\''+g.key+'\',\''+kind+'\')">Substituir PDF</button><button onclick="studyEditPdfMetadata(\''+p.id+'\')">Editar identificação</button><button class="mq-material-delete" onclick="studyDeletePdf(\''+p.id+'\')">Excluir arquivo</button></div></details>':'<button class="mq-summary-publish" onclick="MedQuestSummaryVersions.pick(\''+g.key+'\',\''+kind+'\')">Publicar PDF</button>';
  return '<section class="mq-summary-version" aria-label="'+escape(label)+'"><span class="mq-summary-version-icon">'+icon(kind)+'</span><div class="mq-summary-version-label"><h3>'+label+'</h3>'+(p?'':'<small class="mq-version-empty">Ainda não disponível</small>')+'</div><div class="mq-summary-version-actions">'+actions+manage+'</div></section>';
 }).join('')+(hasMaterialSections(g)||(g.materials||[]).length?lectureMaterials(g,canEdit):'')+'</div></details>').join('')||'<p class="study-empty">Nenhum resumo disponível com esses filtros.</p>';
}
async function upload(group,kind,file,existing){
 if(!admin())throw Error('Somente administradores podem publicar PDFs.');
 if(!types.some(t=>t[0]===kind)&&!['slide','capitulo'].includes(kind))throw Error('Versão inválida.');
 if(!file||file.size<1||file.size>36700160||!(file.type==='application/pdf'||/\.pdf$/i.test(file.name)))throw Error('Selecione um PDF válido de até 35 MB.');
 const path=group.area+'/'+norm(group.topicId)+'/'+kind+'/'+crypto.randomUUID()+'.pdf';
 let uploaded=false,committed=false;
 try{
  const stored=await db.storage.from('materiais_medquest').upload(path,file,{contentType:'application/pdf',upsert:false});if(stored.error)throw stored.error;uploaded=true;
  const details={descricao:'PDF original — '+file.name,arquivo_path:path};
  const saved=existing?await db.from('materiais_medquest').update(details).eq('id',existing.id).eq('arquivo_path',existing.arquivo_path).select('id'):
   await db.from('materiais_medquest').insert({...details,tipo:['slide','capitulo'].includes(kind)?kind:'resumo',titulo:['slide','capitulo'].includes(kind)?file.name.replace(/\.pdf$/i,''):group.title,disciplina_id:group.area,tema_id:group.topicId,tema_nome:group.topic,resumo_versao:['slide','capitulo'].includes(kind)?'expandido':kind,resumo_grupo_id:group.groupId||group.key}).select('id');
  if(saved.error)throw saved.error;if(!saved.data?.length)throw Error('O banco não confirmou a publicação. Atualize a biblioteca.');committed=true;
  if(existing){const removed=await db.storage.from('materiais_medquest').remove([existing.arquivo_path]);if(removed.error)return 'Nova versão publicada. O arquivo anterior não pôde ser removido do armazenamento.';}
  return existing?'PDF substituído.':'PDF publicado.';
 }catch(error){if(uploaded&&!committed)await db.storage.from('materiais_medquest').remove([path]);throw error;}
}
function pick(key,kind,id=null){
 if(!admin()||pending.has(key+'|'+kind))return;
 const group=groups.find(g=>g.key===key);if(!group)return;
 const picker=document.createElement('input');picker.type='file';picker.accept='.pdf,application/pdf';picker.hidden=true;document.body.append(picker);
 picker.addEventListener('cancel',()=>picker.remove(),{once:true});
 picker.onchange=async()=>{
  const file=picker.files?.[0];picker.remove();if(!file)return;
  const action=key+'|'+kind;if(pending.has(action))return;pending.add(action);
  try{
   const existing=id?(group.materials||[]).find(p=>p.id===id):group.files[kind];
   if(existing&&!await window.MedQuestStudyUI.confirm({title:'Substituir PDF?',message:'Substituir somente o '+(types.find(t=>t[0]===kind)?.[1]||'material').toLowerCase()+' de “'+group.title+'” pelo arquivo “'+file.name+'”? Os demais arquivos serão preservados.',confirm:'Substituir PDF'}))return;
   feedback('Publicando '+file.name+'…');const message=await upload(group,kind,file,existing);pendingOpen=group.groupId||key;await refresh();feedback(message);window.MedQuestStudyUI.toast(message);
  }catch(error){feedback('Não foi possível publicar: '+error.message,true)}finally{pending.delete(action)}
 };
 picker.click();
}
window.MedQuestSummaryVersions={model,render,pick,upload,hasMaterialSections};
})();
