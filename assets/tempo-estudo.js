/* MedQuest: single opt-in timer with pause, resume, manual entries and persistence. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types=[['questoes','Questões'],['pdf','Leitura de PDF'],['resumos','Resumos'],['outros','Outros estudos']];
const activityName=s=>types.find(x=>x[0]===s)?.[1]||'Outros estudos';
const localDay=date=>{const d=new Date(date);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const user=()=>typeof usuarioAtual==='undefined'?null:usuarioAtual?.id||null;
const key=()=> 'mq_timer_'+user();
const fmt=secs=>[Math.floor(secs/3600),Math.floor(secs%3600/60),Math.floor(secs%60)].map(x=>String(x).padStart(2,'0')).join(':');
const options=(items,current)=>items.map(pair=>'<option value="'+esc(pair[0])+'"'+(pair[0]===current?' selected':'')+'>'+esc(pair[1])+'</option>').join('');
const areas=selected=>options([['','Geral / livre'],...(typeof BANCO!=='undefined'?BANCO.disciplinas:[]).map(d=>[d.id,d.nome]).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'))],selected||'');
let releaseDialog=null,dialogSaving=false;
let state=null, busy=false, context={atividade:'outros',titulo:'Sessão de estudo',area_id:'',assunto:''},editRecord=null;
const load=()=>{try{let s=localStorage.getItem(key()),x=s?JSON.parse(s):null;return x?.owner===user()?x:null}catch(e){return null}};
const persist=()=>{try{if(state)localStorage.setItem(key(),JSON.stringify(state));else localStorage.removeItem(key())}catch(e){console.warn('Não foi possível manter cronômetro neste navegador.',e)}};
function elapsed(){
 if(!state)return 0;
 return (state.segments||[]).reduce((v,s)=>v+Math.max(0,(Date.parse(s.end)-Date.parse(s.start))/1000),0)+(state.running?Math.max(0,(Date.now()-Date.parse(state.running))/1000):0);
}
function toggleDock(){
 const dock=$('mq-time-dock');if(!dock)return;
 const expanded=dock.classList.toggle('mq-dock-open');
 const top=$('mq-top-timer');if(top)top.setAttribute('aria-expanded',String(expanded));
 const quiz=document.querySelector('.mq-question-timer');
 if(quiz)quiz.setAttribute('aria-expanded',String(expanded));
}
function update(){
 const dock=$('mq-time-dock');if(!dock)return;
 if(!user()){dock.hidden=true;state=null;return}
 if(!state||state.owner!==user())state=load();
 // Sem estudo ativo, a barra superior é suficiente: não cobrir o dashboard.
 dock.hidden=!state;
 if(!state)dock.classList.remove('mq-dock-open');
 const running=Boolean(state?.running),paused=Boolean(state&&!running);
 $('mq-time-clock').textContent=fmt(Math.max(0,elapsed()));
 $('mq-time-state').textContent=running?'Contando':paused?'Pausado':'Pronto para estudar';
 $('mq-time-label').textContent=state?activityName(state.atividade)+' · '+state.titulo:'Questões, PDFs ou estudo livre';
 const start=$('mq-time-play');start.textContent=running?'Pausar':paused?'Continuar':'Iniciar';
 start.onclick=running?pause:paused?resume:()=>dialog('start',context);
 $('mq-time-end').disabled=!state;
 const top=$('mq-top-timer');if(top)top.textContent=state?'◷ '+fmt(elapsed()):'◷ Cronômetro';
 const quiz=document.querySelector('.mq-question-timer');
 if(quiz)quiz.textContent=state?'◷ '+fmt(elapsed()):'◷ Cronômetro';
}
function attach(){
 if($('mq-time-dock'))return;
 const root=$('app-layout');if(!root)return;
 const top=document.createElement('button');top.id='mq-top-timer';top.type='button';top.className='mq-top-timer';top.textContent='◷ Cronômetro';
 top.setAttribute('aria-controls','mq-time-dock');top.setAttribute('aria-expanded','false');
 top.onclick=()=>{if(!state)dialog('start',context);else toggleDock()};
 document.querySelector('.topbar-right')?.prepend(top);
 const dock=document.createElement('aside');dock.id='mq-time-dock';dock.className='mq-time-dock';dock.hidden=true;dock.setAttribute('aria-label','Cronômetro de estudos');
 dock.innerHTML='<div class="mq-time-head"><div><small id="mq-time-state">Pronto</small><strong id="mq-time-clock">00:00:00</strong><span id="mq-time-label">Seu estudo</span></div><button type="button" onclick="MedQuestStudyTime.toggle()" aria-label="Expandir ou recolher controles">⌄</button></div>'+
 '<div class="mq-time-controls"><button type="button" id="mq-time-play">Iniciar</button><button type="button" id="mq-time-end" onclick="MedQuestStudyTime.finish()">Encerrar</button><button type="button" onclick="MedQuestStudyTime.manual()">+ Manual</button></div>';
 root.append(dock);
 const header=document.querySelector('.questao-header');
 if(header){
  const btn=document.createElement('button');
  btn.className='mq-question-timer';btn.type='button';btn.textContent='◷ Cronômetro';
  btn.setAttribute('aria-controls','mq-time-dock');btn.setAttribute('aria-expanded','false');
  btn.onclick=()=>{
   if(state){toggleDock();return}
   dialog('start',{atividade:'questoes',area_id:estadoAtual?.disciplinaId||'',assunto:$('q-tema')?.textContent||'',titulo:'Questões · '+($('q-tema')?.textContent||'Prática')});
  };
  header.append(btn);
 }
 state=load();update();
}
function error(msg){const el=$('mq-time-error');if(el)el.textContent=msg}
function closeDialog(){if(dialogSaving)return;releaseDialog?.();releaseDialog=null;let el=$('mq-study-dialog');if(el){el.hidden=true;el.replaceChildren()}}
function dialog(mode='start',initial={}){
 if(!user())return alert('Entre na sua conta para registrar o estudo.');
 if(mode==='start'&&state)return alert('Uma sessão já está em andamento ou pausada. Encerre-a antes de iniciar outra.');
 releaseDialog?.();releaseDialog=null;
 editRecord=mode==='edit'?initial:null;
 const editingId=editRecord?.id||null;
 const item=editRecord||initial||{};
 let overlay=$('mq-study-dialog');if(!overlay){overlay=document.createElement('div');overlay.id='mq-study-dialog';overlay.className='mq-study-dialog';document.body.append(overlay)}
 overlay.hidden=false;
 const manual=mode!=='start';
 overlay.innerHTML='<div class="mq-study-dialog-card" role="dialog" aria-modal="true" aria-labelledby="mq-study-modal-title">'+
 '<header><div><small>SEU TEMPO DE ESTUDO</small><h2 id="mq-study-modal-title">'+(mode==='edit'?'Editar tempo registrado':manual?'Registrar estudo manualmente':'Iniciar cronômetro')+'</h2></div><button type="button" onclick="MedQuestStudyTime.close()" aria-label="Fechar">×</button></header>'+
 '<p class="mq-study-intro">'+(manual?'Adicione uma sessão que você já concluiu. O tempo ficará salvo no seu histórico.':'Escolha o que vai estudar e comece quando estiver pronto.')+'</p>'+
 '<form id="mq-study-session-form" novalidate><div class="mq-study-cols"><label>Tipo de atividade<select name="atividade">'+options(types,item.atividade||'outros')+'</select></label><label>Área<select name="area_id">'+areas(item.area_id||'')+'</select></label></div>'+
 '<label>Descrição do estudo<input name="titulo" required maxlength="160" value="'+esc(item.titulo||'')+'" placeholder="Ex.: Revisão de hipersensibilidade"></label><label>Assunto (opcional)<input name="assunto" maxlength="160" value="'+esc(item.assunto||'')+'"></label>'+
 (manual?'<div class="mq-study-cols"><label>Data<input name="dia" type="date" required value="'+esc(item.dia||localDay(new Date()))+'"></label>'+
 '<label>Início (opcional)<input name="hora" type="time" value="'+esc(item.inicio_em?new Date(item.inicio_em).toTimeString().slice(0,5):'')+'"></label></div>'+
 '<div class="mq-study-cols"><label>Horas<input name="horas" type="number" min="0" max="24" value="'+Math.floor((item.segundos||0)/3600)+'"></label>'+
 '<label>Minutos<input name="minutos" type="number" min="0" max="59" value="'+Math.floor((item.segundos||0)%3600/60)+'"></label></div>'+
 '<div id="mq-study-duration" class="mq-study-duration" role="status"></div>'+
 '<label>Observações (opcional)<textarea name="observacoes" maxlength="600" rows="3">'+esc(item.observacoes||'')+'</textarea></label>':
 '<p class="mq-study-description">O tempo só começa quando você clicar em Iniciar. Não é necessário clicar na questão ou no PDF para continuar contando.</p>')+
 '<p id="mq-time-error" role="alert" class="mq-study-error"></p><footer><button type="button" onclick="MedQuestStudyTime.close()">Cancelar</button><button class="mq-study-gold" type="submit">'+(manual?'Salvar tempo':'Iniciar estudo')+'</button></footer></form></div>';
 const formElement=$('mq-study-session-form');
 window.MedQuestStudyUI.enhance(formElement);
 const duration=()=>{const h=Number(formElement.elements.horas?.value||0),m=Number(formElement.elements.minutos?.value||0),box=$('mq-study-duration');if(box)box.textContent='Duração total: '+h+'h '+String(m).padStart(2,'0')+'min'};
 formElement.addEventListener('input',duration);duration();
 releaseDialog=window.MedQuestStudyUI.bindModal(overlay,closeDialog);
 formElement.querySelector('.mq-control-trigger')?.focus();
 formElement.onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,values=Object.fromEntries(new FormData(form).entries());
  const common={atividade:values.atividade,area_id:values.area_id||'',titulo:values.titulo?.trim()||'',assunto:values.assunto?.trim()||''};
  error('');form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  if(!common.titulo){form.elements.titulo.setAttribute('aria-invalid','true');form.elements.titulo.focus();return error('Descreva o que você estudou para identificar esta sessão.');}
  if(!types.some(x=>x[0]===common.atividade))return error('Atividade inválida.');
  let button=form.querySelector('button[type=submit]'),label=button.textContent;button.disabled=true;button.textContent=manual?'Salvando…':'Iniciando…';dialogSaving=true;
  try{if(!manual)start(common);else await manualSave(values,common,editingId);dialogSaving=false;closeDialog();window.MedQuestStudyUI.toast(manual?(editingId?'Registro atualizado.':'Estudo adicionado ao histórico.'):'Cronômetro iniciado. Bons estudos!')}
  catch(ex){error(ex.message||'Falha ao registrar o estudo.')}finally{dialogSaving=false;button.disabled=false;button.textContent=label}
 };
}
function start(common){
 if(state)throw Error('Termine a sessão atual antes de iniciar outra.');
 const iso=new Date().toISOString();
 state={id:crypto.randomUUID(),owner:user(),...common,first:iso,running:iso,segments:[]};
 persist();update();
}
function pause(){
 if(!state?.running)return;
 const end=new Date().toISOString();if(Date.parse(end)>Date.parse(state.running))state.segments.push({start:state.running,end});
 state.running=null;persist();update();
}
function resume(){if(state&&!state.running){state.running=new Date().toISOString();persist();update()}}
function clear(){state=null;persist();update()}
async function finish(){
 if(!state||busy)return;
 if(state.running)pause();
 let seconds=Math.round(elapsed());
 if(seconds<1)return alert('Inicie e use o cronômetro antes de salvar.');
 if(seconds>14400){
  const input=prompt('Sessão prolongada: quantos minutos foram realmente estudados? Confirme antes de salvar.',String(Math.min(1440,Math.round(seconds/60))));
  if(input===null)return;
  const mins=Number(input);if(!Number.isInteger(mins)||mins<1||mins>1440)return alert('Informe um valor entre 1 e 1440 minutos.');
  seconds=mins*60;
 }
 seconds=Math.min(86400,seconds);
 const item=state,first=item.segments[0]?.start||item.first,last=item.segments.at(-1)?.end||new Date().toISOString();
 busy=true;
 try{
  const data={id:item.id,usuario_id:user(),fonte:'cronometro',atividade:item.atividade,area_id:item.area_id,titulo:item.titulo,assunto:item.assunto,
   dia:localDay(first),segundos:seconds,inicio_em:first,fim_em:last,segmentos:item.segments.map(s=>({inicio:s.start,fim:s.end}))};
  const r=await db.from('estudo_sessoes').upsert(data,{onConflict:'id'}).select('id');
  if(r.error)throw r.error;
  clear();if($('tela-estudo')?.style.display==='block'&&$('study-title')?.textContent==='Meu progresso')window.MedQuestProgress?.reload?.();alert('Sessão salva no histórico de estudos.');
 }catch(ex){console.error(ex);alert('Falha ao salvar sessão: '+ex.message+'. Ela continua pausada para uma nova tentativa.')}
 finally{busy=false}
}
async function manualSave(values,common,editingId=null){
 const h=Number(values.horas),m=Number(values.minutos),secs=h*3600+m*60,day=String(values.dia||'');
 if(!Number.isInteger(h)||!Number.isInteger(m)||h<0||h>24||m<0||m>59||secs<60||secs>86400)throw Error('Informe uma duração válida de 1 minuto a 24 horas.');
 const date=new Date(day+'T12:00:00');if(!/^\d{4}-\d\d-\d\d$/.test(day)||Number.isNaN(date.getTime())||localDay(date)!==day)throw Error('Informe uma data válida.');
 if(day>localDay(new Date()))throw Error('Não é possível registrar um estudo em uma data futura.');
 let first=null,last=null,segments=[];
 if(values.hora){const when=new Date(day+'T'+values.hora+':00');if(Number.isNaN(when.getTime()))throw Error('Horário inválido.');
  first=when.toISOString();last=new Date(when.getTime()+secs*1000).toISOString();segments=[{inicio:first,fim:last}];
 }
 const obj={usuario_id:user(),fonte:'manual',...common,dia:day,segundos:secs,inicio_em:first,fim_em:last,segmentos:segments,observacoes:String(values.observacoes||'').trim()};
 const r=editingId?await db.from('estudo_sessoes').update(obj).eq('id',editingId).eq('usuario_id',user()).select('id'):
 await db.from('estudo_sessoes').insert(obj).select('id');
 if(r.error)throw r.error;if(!r.data?.length)throw Error('Banco não confirmou a gravação.');
 if($('tela-estudo')?.style.display==='block'&&$('study-title')?.textContent==='Meu progresso')window.MedQuestProgress?.reload?.();
}
const logout=window.fazerLogout;
if(typeof logout==='function')window.fazerLogout=async(...a)=>{pause();return await logout(...a)};
window.MedQuestStudyTime={openStart:obj=>dialog('start',obj||context),manual:()=>dialog('manual',{atividade:'outros',titulo:'',area_id:'',assunto:''}),
 edit:item=>dialog('edit',item),close:closeDialog,start,pause,resume,finish,
 toggle:toggleDock,setContext:x=>{context={...context,...x};update()},
 seconds:elapsed,refresh:update};
window.addEventListener('storage',event=>{if(event.key===key()){state=load();update()}});

attach();setInterval(update,1000);
})();