/* One subject, two independently managed original PDFs. No PDF conversion. */
(()=>{
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const admin=()=>typeof perfilAtual!=='undefined'&&perfilAtual?.admin===true;
const types=[['expandido','Resumo expandido'],['simplificado','Resumo simplificado']];
const icon=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(kind==='simplificado'?'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>':'<path d="M12 5v15M12 5C8 3 4 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-6-1-10 1Z"/>')+'</svg>';
function model(pdfs,texts,canEdit=false){
 const groups=new Map(),accounted=new Set();
 for(const p of pdfs){
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
 return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
}
let groups=[],refresh=()=>{},feedback=()=>{},pendingOpen=null;
const pending=new Set();
function render({pdfs,texts,chosen='',query='',canEdit=false,areaName=id=>id,onChanged=()=>{},onFeedback=()=>{},openKeys=[]}){
 groups=model(pdfs,texts,canEdit);refresh=onChanged;feedback=onFeedback;
 const forcedOpen=pendingOpen;pendingOpen=null;
 const visible=groups.filter(g=>(!chosen||g.area===chosen)&&(!query||norm(g.title+' '+g.topic).includes(norm(query))));
 return visible.map(g=>'<details class="mq-summary-topic" data-summary-key="'+escape(g.key)+'"'+(openKeys.includes(g.key)||forcedOpen===g.key?' open':'')+'><summary><span class="mq-summary-topic-icon">'+icon('expandido')+'</span><span class="mq-summary-heading"><strong>'+escape(g.title)+'</strong><small>'+escape(areaName(g.area))+' · '+escape(g.topic)+'</small></span><svg class="mq-summary-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="mq-summary-versions">'+types.map(([kind,label])=>{
  const p=g.files[kind];
  const actions=p?'<button class="study-pdf-read" onclick="studyOfficialPdf(\''+p.id+'\')">'+icon('expandido')+'Ler resumo</button><button class="study-pdf-download" onclick="studyOfficialDownload(\''+p.id+'\')">↓ Baixar PDF</button>':'<button disabled>Ler resumo</button><button disabled>Baixar PDF</button>';
  const manage=!canEdit?'':p?'<details class="mq-summary-manage"><summary>Gerenciar</summary><div><button onclick="MedQuestSummaryVersions.pick(\''+g.key+'\',\''+kind+'\')">Substituir PDF</button><button onclick="studyEditPdfMetadata(\''+p.id+'\')">Editar identificação</button><button class="mq-material-delete" onclick="studyDeletePdf(\''+p.id+'\')">Excluir arquivo</button></div></details>':'<button class="mq-summary-publish" onclick="MedQuestSummaryVersions.pick(\''+g.key+'\',\''+kind+'\')">Publicar PDF</button>';
  return '<section class="mq-summary-version" aria-label="'+escape(label)+'"><span class="mq-summary-version-icon">'+icon(kind)+'</span><div class="mq-summary-version-label"><h3>'+label+'</h3><small class="'+(p?'mq-version-ready':'mq-version-empty')+'">'+(p?'PDF original disponível':'Ainda não disponível')+'</small></div><div class="mq-summary-version-actions">'+actions+manage+'</div></section>';
 }).join('')+'</div></details>').join('')||'<p class="study-empty">Nenhum resumo disponível com esses filtros.</p>';
}
async function upload(group,kind,file,existing){
 if(!admin())throw Error('Somente administradores podem publicar PDFs.');
 if(!types.some(t=>t[0]===kind))throw Error('Versão inválida.');
 if(!file||file.size<1||file.size>36700160||!(file.type==='application/pdf'||/\.pdf$/i.test(file.name)))throw Error('Selecione um PDF válido de até 35 MB.');
 const path=group.area+'/'+norm(group.topicId)+'/'+kind+'/'+crypto.randomUUID()+'.pdf';
 let uploaded=false,committed=false;
 try{
  const stored=await db.storage.from('materiais_medquest').upload(path,file,{contentType:'application/pdf',upsert:false});if(stored.error)throw stored.error;uploaded=true;
  const details={descricao:'PDF original — '+file.name,arquivo_path:path};
  const saved=existing?await db.from('materiais_medquest').update(details).eq('id',existing.id).eq('arquivo_path',existing.arquivo_path).select('id'):
   await db.from('materiais_medquest').insert({...details,tipo:'resumo',titulo:group.title,disciplina_id:group.area,tema_id:group.topicId,tema_nome:group.topic,resumo_versao:kind,resumo_grupo_id:group.groupId||group.key}).select('id');
  if(saved.error)throw saved.error;if(!saved.data?.length)throw Error('O banco não confirmou a publicação. Atualize a biblioteca.');committed=true;
  if(existing){const removed=await db.storage.from('materiais_medquest').remove([existing.arquivo_path]);if(removed.error)return 'Nova versão publicada. O arquivo anterior não pôde ser removido do armazenamento.';}
  return existing?'PDF substituído.':'PDF publicado.';
 }catch(error){if(uploaded&&!committed)await db.storage.from('materiais_medquest').remove([path]);throw error;}
}
function pick(key,kind){
 if(!admin()||pending.has(key+'|'+kind))return;
 const group=groups.find(g=>g.key===key);if(!group)return;
 const picker=document.createElement('input');picker.type='file';picker.accept='.pdf,application/pdf';picker.hidden=true;document.body.append(picker);
 picker.addEventListener('cancel',()=>picker.remove(),{once:true});
 picker.onchange=async()=>{
  const file=picker.files?.[0];picker.remove();if(!file)return;
  const action=key+'|'+kind;if(pending.has(action))return;pending.add(action);
  try{
   const existing=group.files[kind];
   if(existing&&!await window.MedQuestStudyUI.confirm({title:'Substituir PDF?',message:'Substituir somente o '+types.find(t=>t[0]===kind)[1].toLowerCase()+' de “'+group.title+'” pelo arquivo “'+file.name+'”? A outra versão será preservada.',confirm:'Substituir PDF'}))return;
   feedback('Publicando '+file.name+'…');const message=await upload(group,kind,file,existing);pendingOpen=group.groupId||key;await refresh();feedback(message);window.MedQuestStudyUI.toast(message);
  }catch(error){feedback('Não foi possível publicar: '+error.message,true)}finally{pending.delete(action)}
 };
 picker.click();
}
window.MedQuestSummaryVersions={model,render,pick,upload};
})();
