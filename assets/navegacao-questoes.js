/* Compact navigation. Responses remain owned by the existing question session. */
(()=>{
'use strict';
const hp=q=>{const raw=String(q.hotpoint||'').trim();const n=raw.match(/(?:hot\s*point|hp)[\s.:#-]*0?(\d+)/i);return n?'Hot Point '+Number(n[1]):raw||'Sem Hot Point'};
function groups(session,areas=[],title=()=> ''){
 const result=new Map();
 (session.questoes||[]).forEach((q,index)=>{
  const area=q.__mqAreaId||session.disciplinaId,topic=q.__mqTemaId||session.temaId,point=hp(q),key=JSON.stringify([area,topic,point]);
  const topicName=q.__mqTemaNome||areas.find(d=>d.id===area)?.temas?.find(t=>t.id===topic)?.nome||topic||'Questões';
  if(!result.has(key))result.set(key,{key,point,topicName,label:(session.filtrada?topicName+' · ':'')+point+(title(topic,point)?' — '+title(topic,point):''),indices:[]});
  result.get(key).indices.push(index);
 });
 return [...result.values()].sort((a,b)=>a.topicName.localeCompare(b.topicName,'pt-BR')||Number(a.point.match(/\d+/)?.[0]||999)-Number(b.point.match(/\d+/)?.[0]||999)||a.point.localeCompare(b.point,'pt-BR'));
}
function status(session,index){
 if(session.carregandoRespostas||session.erroRespostas)return 'unknown';
 const answer=session.respostas?.[index];return answer?(answer.acertou?'correct':'incorrect'):'pending';
}
function preview(session){const total=session.questoes?.length||0,start=Math.max(0,Math.min((session.questaoIndex||0)-2,total-5));return Array.from({length:Math.min(5,total)},(_,i)=>start+i)}
function nextPending(session){
 if(session.carregandoRespostas||session.erroRespostas)return -1;
 const total=session.questoes?.length||0;
 for(let step=1;step<=total;step++){const i=((session.questaoIndex||0)+step)%total;if(!session.respostas?.[i])return i}
 return -1;
}
window.MedQuestQuestionNavModel={groups,status,preview,nextPending};
const host=document.getElementById('miniaturas');if(!host)return;
const $=id=>document.getElementById(id),session=()=>typeof estadoAtual==='undefined'?null:estadoAtual;
const icon=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({left:'<path d="m15 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>'})[kind]+'</svg>';
host.className='mq-question-nav';
host.innerHTML='<div class="mq-question-step"><button type="button" id="mq-question-prev">'+icon('left')+'<span>Anterior</span></button><strong id="mq-question-position" aria-live="polite"></strong><button type="button" id="mq-question-next"><span>Próxima</span>'+icon('right')+'</button></div><div id="mq-question-preview" class="mq-question-preview" aria-label="Questões próximas"></div><button type="button" id="mq-question-map-trigger" class="mq-question-map-trigger" aria-haspopup="dialog" aria-controls="mq-question-map" aria-expanded="false"><span>Questões</span>'+icon('grid')+'</button>';
const trigger=$('mq-question-map-trigger'),panel=document.createElement('section');
panel.id='mq-question-map';panel.className='mq-question-map';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','mq-question-map-title');
panel.innerHTML='<header><h2 id="mq-question-map-title">Navegar pelas questões</h2><button type="button" id="mq-question-map-close" aria-label="Fechar mapa das questões">'+icon('close')+'</button></header><div id="mq-question-map-filter"><select id="mq-question-map-group" aria-label="Selecionar assunto e Hot Point"></select></div><p id="mq-question-map-status" class="mq-question-map-status" role="status"></p><div id="mq-question-map-grid" class="mq-question-map-grid" aria-label="Questões do Hot Point selecionado"></div><div class="mq-question-map-legend"><span class="is-current">Atual</span><span class="is-correct">Correta</span><span class="is-incorrect">Incorreta</span><span class="is-pending">Pendente</span></div><footer><button type="button" id="mq-question-map-pending">Ir para próxima pendente '+icon('right')+'</button></footer>';
document.body.append(panel);
let selectedGroup='',owner=null;
const label={correct:'respondida corretamente',incorrect:'respondida incorretamente',pending:'não respondida',unknown:'resposta ainda não recuperada'};
function questionButton(s,index){
 const b=document.createElement('button'),state=status(s,index),current=index===s.questaoIndex;
 b.type='button';b.className='mq-question-number is-'+state+(current?' is-current':'');b.textContent=index+1;b.dataset.questionIndex=String(index);
 b.setAttribute('aria-label','Questão '+(index+1)+', '+label[state]+(current?', atual':''));if(current)b.setAttribute('aria-current','step');
 b.onclick=()=>jump(index);return b;
}
function close(refocus=false){
 if(panel.hidden)return;
 window.MedQuestStudyUI?.closePopover(false);panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(refocus)trigger.focus({preventScroll:true});
}
function jump(index){
 const s=session();if(!s||owner!==s||index<0||index>=s.questoes.length)return;
 close();window.renderQuestao(index);
 const question=$('q-numero');if(question){question.tabIndex=-1;question.focus({preventScroll:true});question.closest('.questao-box')?.scrollIntoView({block:'nearest',behavior:'smooth'})}
}
function position(){
 if(panel.hidden)return;
 const rect=trigger.getBoundingClientRect(),width=Math.min(390,window.innerWidth-24),top=Math.max(8,rect.bottom+7);
 panel.style.width=width+'px';panel.style.left=Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12))+'px';
 panel.style.top=Math.min(top,Math.max(8,window.innerHeight-180))+'px';panel.style.maxHeight=Math.max(120,window.innerHeight-parseFloat(panel.style.top)-12)+'px';
}
const list=s=>groups(s,typeof BANCO==='undefined'?[]:BANCO.disciplinas,(topic,point)=>window.MedQuestHotPoints?.titulo(topic,point)||'');
function paintMap(){
 const s=session();if(!s||owner!==s){close();return}
 const group=list(s).find(g=>g.key===selectedGroup),grid=$('mq-question-map-grid');grid.replaceChildren();
 for(const index of group?.indices||[])grid.append(questionButton(s,index));
 $('mq-question-map-status').textContent=s.carregandoRespostas?'Recuperando respostas salvas…':s.erroRespostas?'Não foi possível recuperar as respostas salvas.':(group?.indices.length||0)+' questões neste grupo';
 const pending=$('mq-question-map-pending');pending.disabled=nextPending(s)<0;pending.setAttribute('title',pending.disabled?'Não há pendências disponíveis na sessão':'Abrir a próxima questão não respondida da sessão');
 position();
}
function open(){
 const s=session();if(!s?.questoes?.length)return;if(!panel.hidden){close(true);return}
 owner=s;const items=list(s),select=$('mq-question-map-group');select.replaceChildren();
 selectedGroup=items.find(g=>g.indices.includes(s.questaoIndex))?.key||items[0]?.key||'';
 for(const item of items){const option=document.createElement('option');option.value=item.key;option.textContent=item.label;select.append(option)}
 select.value=selectedGroup;select.onchange=()=>{selectedGroup=select.value;paintMap()};
 window.MedQuestStudyUI?.enhance($('mq-question-map-filter'));select.dispatchEvent(new Event('change',{bubbles:true}));
 panel.hidden=false;trigger.setAttribute('aria-expanded','true');paintMap();$('mq-question-map-close').focus({preventScroll:true});
}
function refresh(){
 const s=session(),total=s?.questoes?.length||0;if(!total)return;
 if(owner!==s){close();owner=s}
 $('mq-question-position').textContent='Questão '+(s.questaoIndex+1)+' de '+total;
 $('mq-question-prev').disabled=s.questaoIndex===0;$('mq-question-next').disabled=s.questaoIndex===total-1;
 const pills=$('mq-question-preview');pills.replaceChildren();for(const i of preview(s))pills.append(questionButton(s,i));
 if(!panel.hidden)paintMap();
}
function reset(){close();owner=session();refresh()}
$('mq-question-prev').onclick=()=>window.navegarQuestao(-1);$('mq-question-next').onclick=()=>window.navegarQuestao(1);trigger.onclick=open;
$('mq-question-map-close').onclick=()=>close(true);$('mq-question-map-pending').onclick=()=>{const s=session();if(!s||owner!==s)return;const i=nextPending(s);if(i>=0)jump(i)};
panel.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();close(true);return}
 const buttons=[...$('mq-question-map-grid').querySelectorAll('button')],current=buttons.indexOf(document.activeElement);if(current<0)return;
 const columns=window.innerWidth<=540?5:10,delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[e.key];
 const target=e.key==='Home'?0:e.key==='End'?buttons.length-1:delta===undefined?null:Math.max(0,Math.min(buttons.length-1,current+delta));
 if(target!==null){e.preventDefault();buttons[target]?.focus()}
});
const outside=e=>{if(!panel.hidden&&!panel.contains(e.target)&&!host.contains(e.target)&&!e.target.closest?.('.mq-control-popover'))close()};
document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
for(const name of ['mostrarTela','esconderApp']){const original=window[name];if(typeof original==='function')window[name]=function(...args){close();return original.apply(this,args)}}
window.MedQuestQuestionNav={refresh,reset,open,close};
})();
