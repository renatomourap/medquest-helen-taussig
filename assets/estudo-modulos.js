
(() => {
 const $=id=>document.getElementById(id), E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const monday=()=>{let d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const opts=v=>'<option value="">Todas as áreas</option>'+BANCO.disciplinas.map(a=>'<option value="'+E(a.id)+'" '+(v===a.id?'selected':'')+'>'+E(a.nome)+'</option>').join('');
 const area=id=>BANCO.disciplinas.find(d=>d.id===id)?.nome||'Geral';
 let mode='',docs=[],plan=[],progress=[],selected=null,last=null,filter='',view='geral';
 const fetch=async(table,handler)=>{if(!usuarioAtual)throw Error('Faça login para continuar');let r=await handler(db.from(table));if(r.error)throw r.error;return r.data};
 const error=e=>{console.error(e);$('study-msg').textContent=e.message||'Falha ao acessar o banco de dados';$('study-msg').style.color='#f08a8a'};
 const note=s=>{$('study-msg').textContent=s;$('study-msg').style.color='#5fd39a'};
 const show=kind=>{
  mode=kind;esconderApp();$('tela-estudo').style.display='block';fecharSidebar();setNavActive(({resumo:'nav-resumo',anotacao:'nav-notas',plano:'nav-plano',progresso:'nav-progresso'})[kind]);
  $('study-title').textContent=({resumo:'Resumos',anotacao:'Anotações',plano:'Plano da Semana',progresso:'Meu progresso'})[kind];
  const subtitle=$('study-subtitle');if(subtitle)subtitle.textContent=({resumo:'Consulte os materiais oficiais publicados pela administração.',anotacao:'Registre e organize seus aprendizados pessoais.',plano:'Organize o que estudar em cada dia, suas metas e revisões.',progresso:'Acompanhe seus resultados nos exercícios.'})[kind];
  $('study-msg').textContent='';$('study-content').innerHTML='<p>Carregando…</p>';
  if(kind==='resumo')readOfficial();else if(kind==='anotacao')readDocs();else if(kind==='plano')window.PlanoMedQuest.open();else window.MedQuestProgress.open();
 };
 const docCard=d=>'<article class="study-row"><div><b>'+E(d.titulo)+'</b><p>'+E(area(d.area_id))+' · '+E(d.assunto)+'</p></div><div><button onclick="studyEdit(\''+d.id+'\')">Abrir</button><button onclick="studyDelete(\''+d.id+'\')">Excluir</button></div></article>';
 async function readDocs(){try{docs=await fetch('estudo_documentos',t=>t.select('*').eq('usuario_id',usuarioAtual.id).eq('tipo',mode).order('atualizado_em',{ascending:false}));paintDocs();if(window.studyPendingDocument){const id=window.studyPendingDocument;window.studyPendingDocument=null;const found=docs.find(d=>d.id===id);if(found)editor(found)}}catch(e){error(e)}}
 function paintDocs(){
  $('study-content').innerHTML='<div class="study-toolbar"><button onclick="studyNew()">+ Novo</button><select id="study-filter" onchange="studyDocsFilter()">'+opts(filter)+'</select></div><div id="study-list"></div><div id="study-editor"></div>';
  window.studyDocsFilter=()=>{$('study-list').innerHTML=(docs.filter(x=>!$('study-filter').value||x.area_id===$('study-filter').value).map(docCard).join('')||'<p class="study-empty">Nenhum documento salvo. Crie seu primeiro material.</p>')};
  studyDocsFilter();
 }
 function editor(doc){
  selected=doc?.id||null;
  $('study-editor').innerHTML='<div class="study-form"><h3>'+ (doc?'Editar material':'Novo material') +'</h3><label>Título<input id="st-title" maxlength="160" value="'+E(doc?.titulo||'')+'"></label><label>Área<select id="st-area">'+opts(doc?.area_id||'')+'</select></label><label>Assunto<input id="st-topic" value="'+E(doc?.assunto||'')+'"></label><label>Conteúdo<textarea rows="12" id="st-body">'+E(doc?.conteudo||'')+'</textarea></label><div><button onclick="studySave()">Salvar</button><button onclick="studyCancel()">Cancelar</button></div></div>';
  $('study-editor').scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 window.studyNew=()=>{if(mode!=='anotacao')return error(Error('Somente a administração publica resumos.'));editor(null)};window.studyEdit=id=>{if(mode!=='anotacao')return;const doc=docs.find(d=>d.id===id);if(doc)editor(doc)};
 window.studyCancel=()=>{$('study-editor').innerHTML=''};
 window.studySave=async()=>{
  if(mode!=='anotacao')return error(Error('Estudantes só podem salvar anotações privadas.'));
  const titulo=$('st-title').value.trim();if(!titulo)return error(Error('Informe um título.'));
  const data={titulo,area_id:$('st-area').value,assunto:$('st-topic').value.trim(),conteudo:$('st-body').value,tipo:mode,atualizado_em:new Date().toISOString()};
  try{
   let id=selected;
   if(id)await fetch('estudo_documentos',t=>t.update(data).eq('id',id).eq('usuario_id',usuarioAtual.id));
   else{let r=await fetch('estudo_documentos',t=>t.insert({...data,usuario_id:usuarioAtual.id}).select('id'));id=r[0].id}
   await activity({tipo:mode,referencia_id:id,area_id:data.area_id});await readDocs();note('Salvo com sucesso.');
  }catch(e){error(e)}
 };
 window.studyDelete=async id=>{if(!confirm('Excluir este documento?'))return;try{await fetch('estudo_documentos',t=>t.delete().eq('id',id).eq('usuario_id',usuarioAtual.id));await readDocs();note('Excluído.')}catch(e){error(e)}};


 // O resumo completo e fiel é o PDF ORIGINAL, não a transcrição textual.
 // Metadados antigos da tabela conteudos_oficiais servem apenas para classificar assuntos.
 let officialTexts=[],officialPdfs=[],officialEditing=null;
 const isEditor=()=>perfilAtual?.admin===true;
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const pdfFor=d=>officialPdfs.filter(p=>p.disciplina_id===d.area_id &&
   (norm(p.tema_id)===norm(d.assunto) || norm(p.titulo)===norm(d.titulo)))
   .sort((a,b)=>Number(a.resumo_versao==='simplificado')-Number(b.resumo_versao==='simplificado'))[0];
 const fileTopic=file=>{
   const n=norm(file.name.replace(/\.pdf$/i,''));
   const map={'1':'microbiota-humana','2':'infeccao-hospitalar','3':'biofilmes-bacterianos',
     '4':'staphylococcus-sp','5':'disturbios-de-hipersensibilidade',
     '6':'imunodeficiencias-primarias','7':'antibioticos-i-beta-lactamicos',
     '8':'antibioticos-ii-sintese-proteica','9':'antibioticos-iii-sulfonamidas-e-quinolonas'};
   const prefix=n.match(/^([1-9])-/)?.[1];
   if(prefix&&map[prefix]){
     const matched=officialTexts.find(d=>norm(d.assunto)===map[prefix]);
     if(matched)return matched;
   }
   return officialTexts.find(d=>{
     const topic=norm(d.assunto),title=norm(d.titulo);
     return (topic.length>6&&n.includes(topic))||(title.length>6&&n.includes(title));
   });
 };
 async function readOfficial(){
   try{
     const results=await Promise.all([
       fetch('conteudos_oficiais',t=>t.select('*').order('atualizado_em',{ascending:false})),
       fetch('materiais_medquest',t=>t.select('id,tipo,titulo,descricao,disciplina_id,tema_id,tema_nome,resumo_versao,resumo_grupo_id,arquivo_path').eq('tipo','resumo').order('criado_em',{ascending:false}))
     ]);
     officialTexts=results[0]||[];
     officialPdfs=results[1]||[];
     paintOfficial();
     if(window.studyPendingDocument){
       const id=window.studyPendingDocument;window.studyPendingDocument=null;
       if(officialTexts.some(x=>x.id===id))window.studyOfficialOpen(id);
     }
   }catch(e){error(e)}
 }
 const feedback=(message,fail=false)=>{
   const box=$('study-pdf-feedback');if(!box)return;
   box.textContent=message;box.style.color=fail?'#f5a0a0':'#86dbb8';
 };
 function paintOfficial(){
   const selectedArea=$('study-official-filter')?.value??filter;
   const searchValue=$('study-summary-search')?.value||'';
   let retainedOpen=Array.from(document.querySelectorAll?.('.mq-summary-topic[open]')||[]).map(el=>el.dataset.summaryKey);
   $('study-content').innerHTML=
     '<div class="study-toolbar study-pdf-toolbar"><div><p>Leia o documento original, com capa, imagens, tabelas e diagramação preservadas.</p>'+
     '<small>Arquivos originais disponíveis somente para contas aprovadas.</small></div>'+
     (isEditor()?'<button onclick="studyOfficialBatch()">Publicar PDFs originais</button>'+
       '<input id="study-pdf-upload" type="file" accept=".pdf,application/pdf" multiple hidden>':'')+
     '<input type="search" id="study-summary-search" value="'+E(searchValue)+'" placeholder="Pesquisar assunto" aria-label="Pesquisar assunto">'+
     '<select id="study-official-filter" aria-label="Filtrar por disciplina" onchange="studyOfficialFilter()">'+opts(selectedArea)+'</select></div>'+
     '<p id="study-pdf-feedback" role="status" aria-live="polite"></p>'+
     '<div id="study-list" class="mq-summary-list"></div><div id="study-editor"></div>';
   const picker=$('study-pdf-upload');
   if(picker)picker.onchange=ev=>window.studyOfficialBatchFiles(Array.from(ev.target.files||[]));
   const search=$('study-summary-search');if(search)search.oninput=()=>window.studyOfficialFilter();
   window.studyOfficialFilter=()=>{
     const chosen=$('study-official-filter')?.value||'';
     const opened=Array.from(document.querySelectorAll?.('.mq-summary-topic[open]')||[]).map(el=>el.dataset.summaryKey);
     $('study-list').innerHTML=window.MedQuestSummaryVersions.render({pdfs:officialPdfs,texts:officialTexts,chosen,query:$('study-summary-search')?.value||'',canEdit:isEditor(),areaName:area,onChanged:readOfficial,onFeedback:feedback,openKeys:[...retainedOpen,...opened]});retainedOpen=[];
   };
   studyOfficialFilter();
 }
 window.studyDeletePdf=id=>{if(!isEditor())return;const linked=officialTexts.find(d=>pdfFor(d)?.id===id);window.MedQuestMaterialEditor.remove({id,officialId:linked?.id||null,onSaved:readOfficial})};
 window.studyEditPdfMetadata=id=>{if(!isEditor())return;const linked=officialTexts.find(d=>pdfFor(d)?.id===id);window.MedQuestMaterialEditor.open({id,officialId:linked?.id||null,onSaved:readOfficial})};
 async function pdfViewer(doc,url){
   const {openPdfReader}=await import('./pdf-reader.mjs?v=safari-pages-1');
   await openPdfReader({doc,url,area:area(doc.disciplina_id)});
 }
 function originalPdfName(doc){
   const original=String(doc.descricao||'').match(/^PDF original\s*[—–-]\s*(.+\.pdf)$/i)?.[1];
   return (original||doc.titulo+'.pdf').replace(/[\u0000-\u001f/\\]/g,'_');
 }
 window.studyOfficialDownload=id=>{
   const doc=officialPdfs.find(x=>x.id===id);
   if(!doc||!usuarioAtual)return feedback('Faça login para baixar este material.',true);
   // Reserve the browsing context inside the tap; Safari blocks popups after await.
   const target=window.open('about:blank','_blank');
   if(target){target.opener=null;target.document.title='Baixar PDF — MedQuest';target.document.body.textContent='Preparando o PDF original…';}
   (async()=>{
     try{
       feedback('Preparando o PDF original…');
       const result=await db.storage.from('materiais_medquest').createSignedUrl(doc.arquivo_path,300,{download:originalPdfName(doc)});
       if(result.error)throw result.error;
       if(!result.data?.signedUrl)throw Error('Arquivo indisponível.');
       if(target&&!target.closed){target.location.replace(result.data.signedUrl);feedback('PDF original enviado para download.');}
       else{
         const box=$('study-pdf-feedback');if(!box)return;
         box.replaceChildren();const link=document.createElement('a');link.href=result.data.signedUrl;
         link.target='_blank';link.rel='noopener noreferrer';link.download=originalPdfName(doc);
         link.textContent='Toque aqui para baixar o PDF original';box.append(link);
       }
     }catch(e){if(target&&!target.closed)target.close();feedback('Erro ao baixar documento: '+e.message,true);}
   })();
 };
 window.studyOfficialOpen=id=>{
   const doc=officialTexts.find(x=>x.id===id);if(!doc)return;
   const pdf=pdfFor(doc);
   if(pdf)window.studyOfficialPdf(pdf.id);
   else feedback('Este resumo ainda não possui o PDF original publicado. A transcrição sem figuras não será usada como substituta.',true);
 };
 window.studyOfficialPdf=async id=>{
   const doc=officialPdfs.find(x=>x.id===id);if(!doc)return;
   try{
     feedback('Abrindo o PDF original…');
     const result=await db.storage.from('materiais_medquest').createSignedUrl(doc.arquivo_path,7200);
     if(result.error)throw result.error;
     if(!result.data?.signedUrl)throw Error('Arquivo indisponível.');
     feedback('');await pdfViewer(doc,result.data.signedUrl);
     activity({tipo:'resumo',area_id:doc.disciplina_id});
   }catch(e){feedback('Erro ao abrir documento: '+e.message,true)}
 };
 async function publishPdf(file,doc){
   if(!isEditor())throw Error('Apenas administradores podem publicar resumos.');
   const existing=pdfFor(doc);if(existing&&(existing.resumo_versao||'expandido')==='expandido')return false;
   if(!file||file.size<1||file.size>36700160||
     !(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')))
     throw Error('Arquivo inválido ou maior que 35 MB: '+(file?.name||''));
   const path=doc.area_id+'/'+norm(doc.assunto)+'/'+crypto.randomUUID()+'.pdf';
   const upload=await db.storage.from('materiais_medquest').upload(path,file,{contentType:'application/pdf',upsert:false});
   if(upload.error)throw upload.error;
   const save=await db.from('materiais_medquest').insert({tipo:'resumo',
     disciplina_id:doc.area_id,tema_id:doc.assunto,titulo:doc.titulo,resumo_versao:'expandido',resumo_grupo_id:existing?.resumo_grupo_id||crypto.randomUUID(),
     descricao:'PDF original — '+file.name,arquivo_path:path});
   if(save.error){
     await db.storage.from('materiais_medquest').remove([path]);
     throw save.error;
   }
   officialPdfs.push({id:'temp-'+crypto.randomUUID(),disciplina_id:doc.area_id,tema_id:doc.assunto,
     titulo:doc.titulo,arquivo_path:path});
   return true;
 }
 window.studyOfficialAttach=id=>{
   if(!isEditor())return;
   const doc=officialTexts.find(d=>d.id===id);if(!doc)return;
   const picker=document.createElement('input');picker.type='file';picker.accept='.pdf,application/pdf';
   picker.hidden=true;document.body.append(picker);
   picker.onchange=async()=>{
     const file=picker.files?.[0];picker.remove();if(!file)return;
     try{feedback('Publicando '+file.name+'…');await publishPdf(file,doc);
       await readOfficial();feedback('PDF original publicado: '+doc.titulo)}
     catch(e){feedback('Falha na publicação: '+e.message,true)}
   };
   picker.click();
 };
 window.studyOfficialBatch=()=>{if(isEditor())$('study-pdf-upload')?.click()};
 window.studyOfficialBatchFiles=async files=>{
   if(!isEditor()||!files.length)return;
   const chosen=files.map(file=>({file,doc:fileTopic(file)}));
   const unknown=chosen.filter(x=>!x.doc).map(x=>x.file.name);
   if(unknown.length){
     feedback('Não foi possível identificar: '+unknown.join(', ')+'. Publique estes arquivos individualmente.',true);
     return;
   }
   if(!confirm('Publicar '+chosen.length+' PDFs originais no MedQuest?'))return;
   let saved=0,skipped=0;const fails=[];
   for(let i=0;i<chosen.length;i++){
     const {file,doc}=chosen[i];
     try{
       feedback('Publicando '+(i+1)+'/'+chosen.length+': '+file.name);
       if(await publishPdf(file,doc))saved++;else skipped++;
     }catch(e){fails.push(file.name+': '+e.message)}
   }
   await readOfficial();
   feedback(saved+' arquivo(s) original(is) publicado(s), '+skipped+' já existente(s).'+
     (fails.length?' Erros: '+fails.join(' | '):''),!!fails.length);
 };
 const editOfficial=d=>{
   if(!isEditor())return error(Error('Apenas administradores podem publicar materiais oficiais.'));
   officialEditing=d?.id||null;
   $('study-editor').innerHTML='<div class="study-form"><h3>'+ (d?'Editar':'Novo')+' resumo oficial</h3>'+
     '<label>Título<input id="off-title" maxlength="160" value="'+E(d?.titulo||'')+'"></label>'+
     '<label>Área<select id="off-area">'+opts(d?.area_id||'')+'</select></label>'+
     '<label>Assunto<input id="off-topic" value="'+E(d?.assunto||'')+'"></label>'+
     '<label>Conteúdo revisado<textarea id="off-body" rows="15">'+E(d?.conteudo||'')+'</textarea></label>'+
     '<label><input type="checkbox" id="off-publicado" '+(d?.publicado?'checked':'')+'> Publicar para os alunos (após revisão)</label>'+
     '<div><button onclick="studyOfficialSave()">Salvar</button><button onclick="studyCancel()">Cancelar</button></div></div>';
   $('study-editor').scrollIntoView({block:'nearest',behavior:'smooth'});
 };
 window.studyOfficialNew=()=>editOfficial(null);
 window.studyOfficialEdit=id=>editOfficial(officialTexts.find(x=>x.id===id));
 window.studyOfficialSave=async()=>{
   if(!isEditor())return error(Error('Somente administradores podem salvar conteúdo oficial.'));
   const titulo=$('off-title')?.value.trim(),conteudo=$('off-body')?.value||'';
   if(!titulo)return error(Error('Informe um título.'));
   try{
     const data={tipo:'resumo',titulo,conteudo,area_id:$('off-area').value,assunto:$('off-topic').value.trim(),publicado:$('off-publicado').checked,atualizado_em:new Date().toISOString()};
     if(officialEditing)await fetch('conteudos_oficiais',t=>t.update(data).eq('id',officialEditing));
     else await fetch('conteudos_oficiais',t=>t.insert({...data,autor_id:usuarioAtual.id}));
     await readOfficial();note('Resumo oficial salvo.');
   }catch(e){error(e)}
 };
 window.studyOfficialDelete=async id=>{
   if(!isEditor())return error(Error('Somente administradores podem excluir conteúdo oficial.'));
   if(!confirm('Excluir definitivamente este resumo oficial?'))return;
   try{await fetch('conteudos_oficiais',t=>t.delete().eq('id',id));await readOfficial();note('Resumo excluído.')}catch(e){error(e)}
 };

 // O plano semanal usa o módulo visual dedicado assets/plano-semana.js.
 async function readProgress(){try{progress=await fetch('progresso',t=>t.select('*').eq('usuario_id',usuarioAtual.id).order('respondido_em',{ascending:false}));paintProgress()}catch(e){error(e)}}
 function paintProgress(){
  const rows=progress.filter(x=>!filter||x.disciplina_id===filter),hits=rows.filter(x=>x.acertou).length;
  $('study-content').innerHTML='<div class="study-toolbar"><select onchange="studyProgressFilter(this.value)">'+opts(filter)+'</select><div><button onclick="studyProgressMode(\'geral\')">Geral</button><button onclick="studyProgressMode(\'assunto\')">Por assunto</button></div></div><div id="study-list"></div>';
  if(view==='geral'){
   $('study-list').innerHTML='<div class="study-stats"><article><strong>'+rows.length+'</strong>Questões registradas</article><article><strong>'+(rows.length?Math.round(hits/rows.length*100):0)+'%</strong>Taxa de acerto</article><article><strong>'+new Set(rows.map(x=>x.disciplina_id+'|'+x.tema_id)).size+'</strong>Assuntos praticados</article></div><p class="study-empty">Estatísticas baseadas nas respostas salvas; respostas refeitas podem substituir as anteriores.</p>';
  }else{
   const keys=[...new Set(rows.map(x=>x.disciplina_id+'|'+x.tema_id))];
   $('study-list').innerHTML=keys.map(k=>{let [a,t]=k.split('|'),r=rows.filter(x=>x.disciplina_id===a&&x.tema_id===t),hits=r.filter(x=>x.acertou).length,n=BANCO.disciplinas.find(x=>x.id===a)?.temas.find(x=>x.id===t)?.nome||t;return '<article class="study-row"><div><b>'+E(n)+'</b><p>'+E(area(a))+' · '+r.length+' questões</p></div><strong>'+Math.round(100*hits/r.length)+'%</strong></article>'}).join('')||'<p class="study-empty">Nenhuma questão respondida para o filtro.</p>';
  }
 }
 window.studyProgressFilter=v=>{filter=v;paintProgress()};window.studyProgressMode=v=>{view=v;paintProgress()};
 async function activity(obj){if(!usuarioAtual)return;try{await fetch('ultima_atividade',t=>t.upsert({usuario_id:usuarioAtual.id,tipo:obj.tipo,referencia_id:obj.referencia_id||null,area_id:obj.area_id||'',tema_id:obj.tema_id||'',questao_index:obj.questao_index||0,atualizado_em:new Date().toISOString()},{onConflict:'usuario_id'}));last=obj}catch(e){console.warn('Histórico de navegação',e)}}
 async function home(){
  if(!usuarioAtual)return;
  try{
   const [goals,record]=await Promise.all([
    fetch('plano_semana',t=>t.select('*').eq('usuario_id',usuarioAtual.id).eq('semana_inicio',monday())),
    fetch('ultima_atividade',t=>t.select('*').eq('usuario_id',usuarioAtual.id).maybeSingle())
   ]);
   last=record;
   window.PlanoMedQuest.renderHome(goals);
   const lastText=$('study-home-last');
   if(lastText)lastText.textContent=record
    ? (record.tipo==='questoes'?'Questões':record.tipo==='resumo'?'Resumo':'Atividade anterior')+' · '+E(area(record.area_id))
    : 'Retome questões e resumos.';
  }catch(e){console.warn('Dashboard pessoal',e)}
 }
 // A barra lateral abre todos os resumos. Pelo Explorar por área,
 // a lista já chega filtrada pela disciplina selecionada.
 window.abrirEstudo=kind=>{ if(kind==='resumo')filter='';show(kind) };
 window.abrirEstudoArea=id=>{
  filter=id;
  show('resumo');
  $('study-title').textContent='Resumos · '+area(id);
  const subtitle=$('study-subtitle');
  if(subtitle)subtitle.textContent='Materiais oficiais de '+area(id);
 };
 window.studyOpenNote=id=>{window.studyPendingDocument=id;show('anotacao')};
 window.studyContinue=async()=>{
  if(!last)try{last=await fetch('ultima_atividade',t=>t.select('*').eq('usuario_id',usuarioAtual.id).maybeSingle())}catch(e){error(e)}
  if(last?.tipo==='resumo'||last?.tipo==='anotacao'){window.studyPendingDocument=last.referencia_id||null;show(last.tipo);return}
  if(last?.tipo==='questoes'){
   const d=BANCO.disciplinas.find(x=>x.id===last.area_id),t=d?.temas.find(x=>x.id===last.tema_id);
   if(t?.questoes.length){iniciarTema(d.id,t.id);renderQuestao(Math.min(last.questao_index||0,t.questoes.length-1));return}
  }
  show(last?.tipo==='resumo'?'resumo':last?.tipo==='anotacao'?'anotacao':'progresso');
 };
 window.studyPractice=()=>abrirQuestoesGerais();
 window.studyArea=id=>abrirModalidade(id);
 let hide=window.esconderApp;window.esconderApp=function(){hide();$('tela-estudo').style.display='none'};
 let screen=window.mostrarTela;window.mostrarTela=function(n){screen(n);$('tela-estudo').style.display='none'};
 let dash=window.irParaDashboard;window.irParaDashboard=function(){dash();home()};
 let start=window.iniciarTema;window.iniciarTema=function(a,t,opcoes){const pending=start(a,t,opcoes);activity({tipo:'questoes',area_id:a,tema_id:t});return pending};
 let render=window.renderQuestao;window.renderQuestao=function(i){render(i);if(estadoAtual?.disciplinaId)activity({tipo:'questoes',area_id:estadoAtual.disciplinaId,tema_id:estadoAtual.temaId,questao_index:i})};
})();
