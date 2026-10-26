
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
  $('study-msg').textContent='';$('study-content').innerHTML='<p>Carregando…</p>';
  if(kind==='resumo'||kind==='anotacao')readDocs();else if(kind==='plano')readPlan();else readProgress();
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
 window.studyNew=()=>editor(null);window.studyEdit=id=>editor(docs.find(d=>d.id===id));
 window.studyCancel=()=>{$('study-editor').innerHTML=''};
 window.studySave=async()=>{
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
 async function readPlan(){try{plan=await fetch('plano_semana',t=>t.select('*').eq('usuario_id',usuarioAtual.id).eq('semana_inicio',monday()).order('criado_em'));paintPlan()}catch(e){error(e)}}
 function paintPlan(){
  $('study-content').innerHTML='<div class="study-toolbar"><span>Semana de '+monday().split('-').reverse().join('/')+'</span><button onclick="studyPlanNew()">+ Nova meta</button></div><div id="study-list"></div><div id="study-editor"></div>';
  $('study-list').innerHTML=plan.map(p=>'<article class="study-row"><div><label><input type="checkbox" '+(p.concluido?'checked':'')+' onchange="studyDone(\''+p.id+'\',this.checked)"> <b>'+E(p.titulo)+'</b></label><p>'+E(area(p.area_id))+' · '+p.realizado+'/'+p.meta+'</p></div><div><button onclick="studyPlanEdit(\''+p.id+'\')">Editar</button><button onclick="studyPlanDelete(\''+p.id+'\')">Excluir</button></div></article>').join('')||'<p class="study-empty">Você ainda não criou metas para esta semana.</p>';
 }
 function planEditor(p){
  selected=p?.id||null;
  $('study-editor').innerHTML='<div class="study-form"><h3>Meta semanal</h3><label>Atividade<input id="st-title" maxlength="180" value="'+E(p?.titulo||'')+'"></label><label>Área<select id="st-area">'+opts(p?.area_id||'')+'</select></label><label>Meta<input id="st-meta" type="number" min="1" max="10000" value="'+(p?.meta||1)+'"></label><label>Realizado<input id="st-done" type="number" min="0" max="10000" value="'+(p?.realizado||0)+'"></label><div><button onclick="studyPlanSave()">Salvar</button><button onclick="studyCancel()">Cancelar</button></div></div>';
 }
 window.studyPlanNew=()=>planEditor(null);window.studyPlanEdit=id=>planEditor(plan.find(x=>x.id===id));
 window.studyPlanSave=async()=>{
  let titulo=$('st-title').value.trim(),meta=Number($('st-meta').value),realizado=Number($('st-done').value);
  if(!titulo||!Number.isInteger(meta)||meta<1||meta>10000||!Number.isInteger(realizado)||realizado<0||realizado>10000)return error(Error('Confira o título e os valores.'));
  let data={titulo,area_id:$('st-area').value,meta,realizado,concluido:realizado>=meta};
  try{if(selected)await fetch('plano_semana',t=>t.update(data).eq('id',selected).eq('usuario_id',usuarioAtual.id));else await fetch('plano_semana',t=>t.insert({...data,usuario_id:usuarioAtual.id,semana_inicio:monday()}));await readPlan();home();note('Meta salva.')}catch(e){error(e)}
 };
 window.studyDone=async(id,v)=>{let p=plan.find(x=>x.id===id);if(!p)return;try{await fetch('plano_semana',t=>t.update({concluido:v,realizado:v?p.meta:0}).eq('id',id).eq('usuario_id',usuarioAtual.id));await readPlan();home()}catch(e){error(e)}};
 window.studyPlanDelete=async id=>{if(!confirm('Excluir meta?'))return;try{await fetch('plano_semana',t=>t.delete().eq('id',id).eq('usuario_id',usuarioAtual.id));await readPlan();home()}catch(e){error(e)}};
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
   const results=await Promise.all([fetch('estudo_documentos',t=>t.select('*').eq('usuario_id',usuarioAtual.id).eq('tipo','anotacao').order('atualizado_em',{ascending:false}).limit(4)),fetch('plano_semana',t=>t.select('*').eq('usuario_id',usuarioAtual.id).eq('semana_inicio',monday())),fetch('ultima_atividade',t=>t.select('*').eq('usuario_id',usuarioAtual.id).maybeSingle())]);
   let [notes,goals,record]=results;last=record;
   $('study-home-notes').innerHTML=notes.map(n=>'<button class="study-home-link" onclick="studyOpenNote(\''+n.id+'\')">'+E(n.titulo)+'</button>').join('')||'<p>Nenhuma anotação ainda.</p>';
   $('study-home-plan').innerHTML=goals.map(p=>'<p>'+(p.concluido?'✓':'○')+' '+E(p.titulo)+' <small>'+p.realizado+'/'+p.meta+'</small></p>').join('')||'<p>Você ainda não criou metas para esta semana.</p>';
   $('study-home-last').textContent=record? (record.tipo==='questoes'?'Questões':record.tipo==='resumo'?'Resumo':'Anotações')+' · '+E(area(record.area_id)):'Retome questões, anotações ou resumos.';
  }catch(e){console.warn('Dashboard pessoal',e)}
 }
 window.abrirEstudo=show;
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
 window.studyPractice=()=>{let d=BANCO.disciplinas.find(x=>x.temas.length);if(d)abrirDisciplina(d.id)};
 window.studyArea=id=>{let d=BANCO.disciplinas.find(x=>x.id===id);if(d?.temas.length)abrirDisciplina(id);else {filter=id;show('resumo')}};
 let hide=window.esconderApp;window.esconderApp=function(){hide();$('tela-estudo').style.display='none'};
 let screen=window.mostrarTela;window.mostrarTela=function(n){screen(n);$('tela-estudo').style.display='none'};
 let dash=window.irParaDashboard;window.irParaDashboard=function(){dash();home()};
 let start=window.iniciarTema;window.iniciarTema=function(a,t){start(a,t);activity({tipo:'questoes',area_id:a,tema_id:t})};
 let render=window.renderQuestao;window.renderQuestao=function(i){render(i);if(estadoAtual?.disciplinaId)activity({tipo:'questoes',area_id:estadoAtual.disciplinaId,tema_id:estadoAtual.temaId,questao_index:i})};
})();
