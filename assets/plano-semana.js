
/* Plano da Semana — estudos particulares, com RLS por usuario no Supabase. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const days=['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
 const pad=v=>String(v).padStart(2,'0');
 const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const parseISO=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
 const monday=d=>{let x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);x.setDate(x.getDate()-((x.getDay()+6)%7));return iso(x)};
 const addDays=(str,offset)=>{let d=parseISO(str);d.setDate(d.getDate()+offset);return iso(d)};
 const human=s=>parseISO(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
 const percent=p=>p.meta>0?Math.round(Math.min(p.realizado,p.meta)/p.meta*100):0;
 const completed=p=>p.concluido===true || p.realizado>=p.meta;
 const daySort=p=>p.dia_semana===null||p.dia_semana===undefined?7:p.dia_semana;
 const sortEntries=(a,b)=>daySort(a)-daySort(b)||String(a.criado_em).localeCompare(String(b.criado_em));
 const area=id=>BANCO.disciplinas.find(d=>d.id===id)?.nome||'Estudo geral';
 const opts=selected=>'<option value="">Geral / livre</option>'+BANCO.disciplinas.map(d=>'<option value="'+escapeHTML(d.id)+'" '+(selected===d.id?'selected':'')+'>'+escapeHTML(d.nome)+'</option>').join('');
 let viewed=monday(new Date()), records=[],filter='todas',editing=null,loading=false,screenVersion=0,homeVersion=0;
 const saving=new Set();
 const weekRange=week=>human(week)+' — '+human(addDays(week,6));
 const currentUser=()=>usuarioAtual?.id||null;
 async function list(week){
   const id=currentUser();
   if(!id)throw Error('Entre na sua conta para acessar seu planejamento.');
   const response=await db.from('plano_semana').select('*').eq('usuario_id',id).eq('semana_inicio',week).order('criado_em',{ascending:true});
   if(response.error)throw response.error;
   return (response.data||[]).sort(sortEntries);
 }
 const warn=(s,fail=false)=>{
   const target=$('study-msg');
   if(target){target.textContent=s;target.style.color=fail?'#f38c93':'#71dbac';}
   const modal=$('weekly-modal-error');
   if(modal){modal.textContent=fail?s:'';modal.style.display=fail?'block':'none';}
 };
 function summary(rows){
   const done=rows.filter(completed).length;
   const rate=rows.length?Math.round(rows.reduce((n,p)=>n+percent(p),0)/rows.length):0;
   return {total:rows.length,done,rate,pending:rows.length-done};
 }
 async function open(){
   const token=++screenVersion;
   loading=true;
   $('study-content').innerHTML='<div class="weekly-loading">Carregando seu planejamento...</div>';
   try{
     const items=await list(viewed);
     if(token!==screenVersion)return;
     records=items;render();loading=false;
   }catch(e){loading=false;console.error('Plano da Semana:',e);warn(e.message||'Não foi possível abrir o planejamento.',true);$('study-content').innerHTML='<div class="weekly-empty">Não foi possível carregar as metas. Tente novamente.<button onclick="PlanoMedQuest.reload()">Recarregar</button></div>'}
 }
 function weekNav(){
   return '<div class="weekly-nav" aria-label="Navegação semanal">'+
     '<button type="button" onclick="PlanoMedQuest.move(-1)" title="Semana anterior" aria-label="Semana anterior">‹</button>'+
     '<span>'+escapeHTML(weekRange(viewed))+'</span>'+
     '<button type="button" onclick="PlanoMedQuest.move(1)" title="Próxima semana" aria-label="Próxima semana">›</button>'+
     '<button type="button" class="weekly-today" onclick="PlanoMedQuest.today()">Esta semana</button></div>';
 }
 function task(row,compact=false){
   const id=escapeHTML(row.id),done=completed(row),pct=percent(row);
   const status=done?'Concluída':(row.realizado>0?'Em andamento':'Pendente');
   const checkbox='<input class="weekly-checkbox" type="checkbox" aria-label="Concluir '+escapeHTML(row.titulo)+'" '+(done?'checked':'')+' onchange="PlanoMedQuest.toggle(\''+id+'\',this.checked)" />';
   const bar='<div class="weekly-meter" role="progressbar" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de '+escapeHTML(row.titulo)+'"><span style="width:'+pct+'%"></span></div>';
   if(compact) return '<div class="weekly-mini-task '+(done?'is-done':'')+'"><label class="weekly-mini-check">'+checkbox+'</label><div class="weekly-mini-info"><div class="weekly-mini-title">'+escapeHTML(row.titulo)+'</div><div class="weekly-mini-line">'+bar+'<span>'+Math.min(row.realizado,row.meta)+'/'+row.meta+'</span></div></div></div>';
   return '<article class="weekly-task '+(done?'is-done':'')+'">'+
     '<div class="weekly-task-top"><label class="weekly-task-check">'+checkbox+'<span class="weekly-task-title">'+escapeHTML(row.titulo)+'</span></label>'+
     '<span class="weekly-task-counter">'+Math.min(row.realizado,row.meta)+' / '+row.meta+'</span></div>'+
     '<div class="weekly-task-sub"><span class="weekly-area">'+escapeHTML(area(row.area_id))+'</span> · '+status+(row.observacoes?' · '+escapeHTML(row.observacoes):'')+'</div>'+
     bar+'<div class="weekly-task-actions"><div class="weekly-quantity">'+
     '<button type="button" onclick="PlanoMedQuest.change(\''+id+'\',-1)" title="Diminuir realizado" aria-label="Diminuir realizado">−</button>'+
     '<span>Realizado: '+Math.min(row.realizado,row.meta)+' / '+row.meta+'</span>'+
     '<button type="button" onclick="PlanoMedQuest.change(\''+id+'\',1)" title="Adicionar realizado" aria-label="Adicionar realizado">+</button></div>'+
     '<div class="weekly-modify"><button type="button" onclick="PlanoMedQuest.edit(\''+id+'\')">Editar</button><button type="button" class="weekly-delete" onclick="PlanoMedQuest.remove(\''+id+'\')">Excluir</button></div></div></article>';
 }
 function group(day){
   const rows=records.filter(p=>day===null ? p.dia_semana===null||p.dia_semana===undefined:p.dia_semana===day).filter(p=>filter==='todas'||(filter==='feitas'?completed(p):!completed(p)));
   const text=day===null?'Sem dia definido':days[day];
   const date=day===null?'A qualquer momento':human(addDays(viewed,day));
   return '<section class="weekly-day-card"><div class="weekly-day-head"><div><span class="weekly-day-label">'+text+'</span><span class="weekly-day-date">'+date+'</span></div>'+
     '<button type="button" class="weekly-day-add" onclick="PlanoMedQuest.newTask('+(day===null?'null':day)+')" aria-label="Adicionar atividade em '+text+'">+ <span>Atividade</span></button></div>'+
     '<div class="weekly-day-list">'+(rows.map(p=>task(p)).join('')||'<div class="weekly-day-empty">Nenhuma atividade '+(filter==='feitas'?'concluída':filter==='pendentes'?'pendente':'planejada')+'.</div>')+'</div></section>';
 }
 function render(){
   const s=summary(records),current=viewed===monday(new Date());
   let groups=days.map((_,d)=>group(d)).join('');
   if(records.some(p=>p.dia_semana===null||p.dia_semana===undefined))groups+=group(null);
   $('study-content').innerHTML=
     '<div class="weekly-planner"><div class="weekly-intro"><div><div class="weekly-eyebrow">SEU PLANEJAMENTO</div><h2>Uma semana de cada vez.</h2><p>Organize os estudos, defina metas e marque o que já realizou. Só você vê este plano.</p></div>'+weekNav()+'</div>'+
     '<div class="weekly-overview"><div class="weekly-metric"><span>Atividades planejadas</span><strong>'+s.total+'</strong></div>'+
     '<div class="weekly-metric"><span>Concluídas</span><strong>'+s.done+'<small> / '+s.total+'</small></strong></div>'+
     '<div class="weekly-metric weekly-metric-wide"><span>Progresso da semana</span><strong>'+s.rate+'%</strong><div class="weekly-meter"><span style="width:'+s.rate+'%"></span></div></div></div>'+
     '<div class="weekly-controls"><div class="weekly-tabs" role="group" aria-label="Filtrar tarefas">'+
      '<button type="button" class="'+(filter==='todas'?'active':'')+'" onclick="PlanoMedQuest.filter(\'todas\')">Todas</button>'+
      '<button type="button" class="'+(filter==='pendentes'?'active':'')+'" onclick="PlanoMedQuest.filter(\'pendentes\')">Pendentes</button>'+
      '<button type="button" class="'+(filter==='feitas'?'active':'')+'" onclick="PlanoMedQuest.filter(\'feitas\')">Concluídas</button></div>'+
      '<button type="button" class="weekly-create" onclick="PlanoMedQuest.newTask(null)">+ Nova atividade</button></div>'+
     (s.total===0?'<div class="weekly-empty"><div class="weekly-empty-icon">☷</div><strong>Sua semana começa aqui</strong><p>Escolha os assuntos e as metas que deseja cumprir. Você pode alterar tudo depois.</p><button type="button" onclick="PlanoMedQuest.newTask(null)">Criar primeira atividade</button></div>':'')+
     '<div class="weekly-days">'+groups+'</div><div id="weekly-editor-root"></div></div>';
 }
 function numericControl(id,value,min,label){
   const arrow=(direction,title,points)=>
     '<button type="button" aria-label="'+title+'" title="'+title+'" onclick="PlanoMedQuest.adjustNumber(\''+id+'\','+direction+')">'+
     '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="'+points+'"/></svg></button>';
   return '<div class="weekly-number-control">'+
     '<input id="'+id+'" type="number" inputmode="numeric" min="'+min+'" max="10000" step="1" aria-label="'+label+'" value="'+Number(value)+'">'+
     '<div class="weekly-number-stepper">'+
       arrow(1,'Aumentar '+label,'6 15 12 9 18 15')+
       arrow(-1,'Diminuir '+label,'6 9 12 15 18 9')+
     '</div></div>';
 }
 function editor(row,day){
   editing=row?.id||null;
   const chosenDay=row?.dia_semana??day;
   const options='<option value="">Qualquer dia da semana</option>'+days.map((d,i)=>'<option value="'+i+'" '+(chosenDay===i?'selected':'')+'>'+d+' ('+human(addDays(viewed,i))+')</option>').join('');
   $('weekly-editor-root').innerHTML='<div class="weekly-modal-backdrop" role="presentation" onclick="if(event.target===this)PlanoMedQuest.closeEditor()"><div class="weekly-modal" role="dialog" aria-modal="true" aria-labelledby="weekly-editor-title">'+
     '<div class="weekly-modal-head"><div><span>PLANEJAMENTO INDIVIDUAL</span><h3 id="weekly-editor-title">'+(row?'Editar atividade':'Nova atividade de estudo')+'</h3></div><button type="button" class="weekly-modal-x" onclick="PlanoMedQuest.closeEditor()" aria-label="Fechar">×</button></div>'+
     '<div class="weekly-modal-fields"><label>O que você pretende estudar?<input id="weekly-title" maxlength="180" placeholder="Ex.: Resolver 50 questões de Imunologia" value="'+escapeHTML(row?.titulo||'')+'"></label>'+
     '<div class="weekly-fields-pair"><label>Área de estudo<select id="weekly-area">'+opts(row?.area_id||'')+'</select></label><label>Dia da semana<select id="weekly-day">'+options+'</select></label></div>'+
     '<div class="weekly-fields-pair"><label>Meta de realização'+numericControl('weekly-target',row?.meta??1,1,'meta de realização')+'</label>'+
     '<label>Quanto já realizou?'+numericControl('weekly-realized',row?.realizado??0,0,'quantidade realizada')+'</label></div>'+
     '<label>Observações (opcional)<textarea id="weekly-notes" maxlength="500" rows="3" placeholder="Ex.: Revisar TLR, citocinas e interferons">'+escapeHTML(row?.observacoes||'')+'</textarea></label></div>'+
     '<div id="weekly-modal-error" role="alert" class="weekly-modal-error" style="display:none"></div>'+
     '<div class="weekly-modal-actions"><button type="button" onclick="PlanoMedQuest.closeEditor()">Cancelar</button><button type="button" id="weekly-save-btn" class="weekly-save" onclick="PlanoMedQuest.save()">Salvar atividade</button></div></div></div>';
   $('weekly-title')?.focus();
 }
 function adjustNumber(id,direction){
   if(id!=='weekly-target'&&id!=='weekly-realized')return;
   const el=$(id);if(!el)return;
   const min=Number(el.min)||0,max=10000;
   const current=el.value.trim()===''?min:Number(el.value);
   const next=Math.max(min,Math.min(max,Math.trunc(Number.isFinite(current)?current:min)+direction));
   el.value=String(next);
   el.dispatchEvent(new Event('input',{bubbles:true}));
 }
 function closeEditor(){const el=$('weekly-editor-root');if(el)el.innerHTML='';editing=null;}
 async function refreshHome(){
   const token=++homeVersion;
   if(!currentUser()||!$('study-home-plan'))return;
   try{const rows=await list(monday(new Date()));if(token!==homeVersion)return;renderHome(rows)}catch(e){console.warn('Plano semanal na página inicial',e);const el=$('study-home-plan');if(el)el.innerHTML='<p class="weekly-mini-error">Não foi possível carregar suas metas.</p>';}
 }
 function renderHome(input){
   const el=$('study-home-plan');if(!el)return;
   const rows=(input||[]).sort(sortEntries),s=summary(rows);
   const shown=rows.slice(0,5);
   el.classList.add('weekly-home-panel');
   el.innerHTML=rows.length
    ?'<div class="weekly-mini-summary">'+s.done+' de '+s.total+' concluídas <span>'+s.rate+'%</span></div>'+shown.map(r=>task(r,true)).join('')+
      (rows.length>5?'<button class="weekly-see-more" onclick="abrirEstudo(\'plano\')">Ver mais '+(rows.length-5)+' atividades →</button>':'')
    :'<div class="weekly-mini-empty"><p>Defina suas metas para começar a semana.</p><button type="button" onclick="abrirEstudo(\'plano\')">+ Planejar estudos</button></div>';
 }
 async function updateRow(id,changes){
   if(saving.has(id))return;
   const row=records.find(x=>x.id===id);
   const owner=currentUser();
   if(!owner)return;
   saving.add(id);
   try{
     const r=await db.from('plano_semana').update(changes).eq('id',id).eq('usuario_id',owner).select('id');
     if(r.error)throw r.error;
     if(!r.data?.length)throw Error('A atividade não foi encontrada ou não pode ser editada.');
     await Promise.all([open(),refreshHome()]);
   }catch(e){console.error(e);warn(e.message||'Não foi possível atualizar a meta.',true);await open();}
   finally{saving.delete(id);}
 }
 async function toggle(id,yes){
   let row=records.find(x=>x.id===id);
   if(!row){try{row=(await list(monday(new Date()))).find(x=>x.id===id)}catch(e){console.error(e)}}
   if(!row)return;
   if(saving.has(id))return;
   const changes={concluido:yes,realizado:yes?row.meta:Math.min(row.realizado,Math.max(0,row.meta-1))};
   const owner=currentUser();
   saving.add(id);
   try{
     const r=await db.from('plano_semana').update(changes).eq('id',id).eq('usuario_id',owner).select('id');
     if(r.error)throw r.error;
     if(!r.data?.length)throw Error('Não foi possível alterar esta meta.');
     if(modeVisible())await open();
     await refreshHome();
   }catch(e){console.error(e);warn(e.message||'Falha ao atualizar atividade.',true);if(modeVisible())await open();await refreshHome()}
   finally{saving.delete(id)}
 }
 function modeVisible(){return $('tela-estudo')?.style.display==='block' && $('study-title')?.textContent==='Plano da Semana'}
 async function save(){
   const title=$('weekly-title')?.value.trim()||'',meta=Number($('weekly-target')?.value),realizado=Number($('weekly-realized')?.value),chosen=$('weekly-day')?.value;
   if(!title)return warn('Informe o nome da atividade.',true);
   if(!Number.isInteger(meta)||meta<1||meta>10000||!Number.isInteger(realizado)||realizado<0||realizado>meta)return warn('Confira a meta e o valor realizado (de 0 até a meta).',true);
   const day=chosen===''?null:Number(chosen);
   if(day!==null && (!Number.isInteger(day)||day<0||day>6))return warn('Selecione um dia válido.',true);
   const row={titulo:title,area_id:$('weekly-area').value,meta,realizado,concluido:realizado>=meta,dia_semana:day,observacoes:$('weekly-notes').value.trim()};
   const button=$('weekly-save-btn');if(button){button.disabled=true;button.textContent='Salvando...'}
   try{
     const owner=currentUser();if(!owner)throw Error('Sessão encerrada. Entre novamente.');
     let q;
     if(editing)q=await db.from('plano_semana').update(row).eq('id',editing).eq('usuario_id',owner).select('id');
     else q=await db.from('plano_semana').insert({...row,usuario_id:owner,semana_inicio:viewed}).select('id');
     if(q.error)throw q.error;
     if(!q.data?.length)throw Error('O banco de dados não confirmou o salvamento.');
     closeEditor();
     await Promise.all([open(),refreshHome()]);
     warn('Atividade salva no seu planejamento.');
   }catch(e){console.error(e);warn(e.message||'Erro ao salvar atividade.',true)}
   finally{if(button&&document.contains(button)){button.disabled=false;button.textContent='Salvar atividade'}}
 }
 async function remove(id){
   const row=records.find(p=>p.id===id);if(!row)return;
   if(!confirm('Excluir a atividade "'+row.titulo+'"?'))return;
   try{
     const r=await db.from('plano_semana').delete().eq('id',id).eq('usuario_id',currentUser()).select('id');
     if(r.error)throw r.error;
     if(!r.data?.length)throw Error('Não foi possível excluir esta meta.');
     await Promise.all([open(),refreshHome()]);
     warn('Atividade excluída.');
   }catch(e){console.error(e);warn(e.message||'Erro ao excluir atividade.',true)}
 }
 function move(weeks){viewed=addDays(viewed,weeks*7);filter='todas';open()}
 function today(){viewed=monday(new Date());filter='todas';open()}
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('weekly-editor-root')?.firstChild)closeEditor()});
 window.PlanoMedQuest={
   open,reload:open,refreshHome,renderHome,
   move,today,
   filter:v=>{filter=v;render()},
   newTask:d=>editor(null,d),
   edit:id=>{let row=records.find(x=>x.id===id);if(row)editor(row,row.dia_semana)},
   closeEditor,save,remove,toggle,adjustNumber,
   change:(id,d)=>{const p=records.find(x=>x.id===id);if(p)updateRow(id,{realizado:Math.max(0,Math.min(p.meta,p.realizado+d)),concluido:Math.max(0,Math.min(p.meta,p.realizado+d))>=p.meta})}
 };
})();
