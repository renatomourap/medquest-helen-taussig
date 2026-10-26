/* Dashboard: disponibilidade e progresso derivados do acervo real e do usuário atual. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
const descriptions={imunologia:'Mecanismos de defesa e resposta imune.',patologia:'Bases das doenças e alterações teciduais.',farmacologia:'Mecanismos de ação e aplicações dos fármacos.',microbiologia:'Microrganismos e sua relação com o hospedeiro.',parasitologia:'Parasitas, vetores e doenças parasitárias.'};
const colors={imunologia:'#4d96f8',patologia:'#b77af5',farmacologia:'#f16a80',microbiologia:'#3ec6ad',parasitologia:'#ca8bfa'};
const paths={imunologia:'M4 3l8 8 8-8M4 8l5 5v8h6v-8l5-5M9 13l3 3 3-3',farmacologia:'M6 18a5 5 0 0 1 0-7l5-5a5 5 0 0 1 7 7l-5 5a5 5 0 0 1-7 0Zm3-10 7 7',microbiologia:'M9 3h5v9H9zM8 21h12M5 17a7 7 0 0 0 13-5M13 16v5M7 12h8',patologia:'M12 3a8 8 0 0 0-5 14l-2 4m7-18a8 8 0 0 1 5 14l2 4M8 11h.01M16 11h.01M10 16l2 5 2-5',parasitologia:'M12 3c-7 0-9 9-4 13l-2 5m6-18c7 0 9 9 4 13l2 5M9 10h.01M15 10h.01M12 14v7'};
function model(disciplines,progress){
 const available=new Map(),areas=disciplines.map(d=>({id:d.id,name:d.nome,total:0,answered:0,correct:0}));
 for(const d of disciplines)for(const t of d.temas)for(const q of t.questoes){const key=JSON.stringify([d.id,t.id,String(q.id)]);if(!available.has(key)){available.set(key,{q,area:d.id,topic:t.id});areas.find(a=>a.id===d.id).total++}}
 const seen=new Set(),answers=[];
 for(const r of progress){const key=JSON.stringify([r.disciplina_id,r.tema_id,String(r.questao_id)]),entry=available.get(key);if(!entry||seen.has(key)||!entry.q.alternativas.some(a=>a.letra===r.resposta))continue;seen.add(key);const right=r.resposta===entry.q.correta,area=areas.find(a=>a.id===entry.area);area.answered++;if(right)area.correct++;answers.push({...r,acertou:right})}
 const total=available.size,answered=answers.length,correct=answers.filter(r=>r.acertou).length;
 return {areas,answers,total,answered,correct,coverage:total?Math.round(answered/total*100):0};
}
let generation=0,state=null,mode='geral',subject='';
function cards(materials){
 const grid=$('dash-disc-grid');if(!grid)return;grid.replaceChildren();grid.classList.add('mq-area-grid');
 for(const d of [...BANCO.disciplinas].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))){
  const qCount=new Set(d.temas.flatMap(t=>t.questoes.map(q=>t.id+'|'+q.id))).size;
  const pdfs=materials?materials.filter(m=>m.disciplina_id===d.id):null;
  const pCount=pdfs?new Set(pdfs.map(p=>p.arquivo_path)).size:null;
  const card=make('button',undefined,'mq-area-card');card.type='button';card.style.setProperty('--mq-area',colors[d.id]||'#d9b76f');
  if(['imunologia','patologia','farmacologia','microbiologia','parasitologia'].includes(d.id))card.style.backgroundImage='url(assets/disciplinas/'+d.id+'.png)';
  const body=make('span',undefined,'mq-area-card-body'),icon=make('span',undefined,'mq-area-symbol');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="'+(paths[d.id]||paths.imunologia)+'"/></svg>';
  body.append(icon,make('strong',d.nome),make('span',descriptions[d.id]||'Questões e resumos da disciplina.','mq-area-description'));
  const badges=make('span',undefined,'mq-area-badges');badges.append(make('span',qCount+' '+(qCount===1?'questão':'questões')),make('span',pCount===null?'Resumos: consultando':pCount+' '+(pCount===1?'resumo':'resumos')));body.append(badges);
  if(materials===false){badges.lastChild.textContent='Resumos: indisponíveis'}
  if(pCount===0&&qCount===0){body.append(make('small','Nenhum material publicado'));card.disabled=true}
  const arrow=make('span','›','mq-area-arrow');arrow.setAttribute('aria-hidden','true');card.append(body,arrow);card.onclick=()=>abrirModalidade(d.id);grid.append(card);
 }
}
function drawProgress(data){
 const root=$('dash-progress');root.replaceChildren();root.classList.add('mq-progress-overview');
 const overall=make('div',undefined,'mq-coverage-summary'),ring=make('div',undefined,'mq-coverage-ring');ring.style.setProperty('--coverage',data.coverage+'%');ring.setAttribute('role','img');ring.setAttribute('aria-label',data.coverage+'% das questões respondidas');ring.append(make('strong',data.coverage+'%'));
 const label=make('div');label.append(make('h3','Progresso geral'),make('p',data.answered+' de '+data.total+' questões respondidas'),make('small','Cobertura do banco disponível'));overall.append(ring,label);
 const bars=make('div',undefined,'mq-area-progress');
 for(const area of data.areas.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))){const pct=area.total?Math.round(area.answered/area.total*100):0,row=make('div',undefined,'mq-area-progress-row');row.style.setProperty('--mq-area',colors[area.id]||'#d9b76f');const name=make('span',area.name);const track=make('span',undefined,'mq-area-progress-track'),fill=make('span');fill.style.width=pct+'%';track.append(fill);const value=make('span',area.total?pct+'%':'Sem questões');row.title=area.answered+' de '+area.total+' questões respondidas';row.append(name,track,value);bars.append(row)}root.append(overall,bars);
}
const timeLabel=s=>{const minutes=Math.floor(s/60);return minutes>=60?Math.floor(minutes/60)+'h '+String(minutes%60).padStart(2,'0')+'min':minutes+'min'};
function stats(){
 const root=$('stats-row');if(!root||!state)return;root.replaceChildren();root.classList.add('mq-dashboard-stats');
 const choices=make('div',undefined,'mq-stat-modes');choices.setAttribute('role','group');choices.setAttribute('aria-label','Exibição das estatísticas');
 for(const [value,label] of [['geral','Geral'],['assunto','Por assunto']]){const b=make('button',label);b.type='button';b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>{mode=value;stats()};choices.append(b)}root.append(choices);
 const topics=BANCO.disciplinas.flatMap(d=>d.temas.map(t=>({area:d.id,id:t.id,name:t.nome,areaName:d.nome}))).filter(t=>BANCO.disciplinas.find(d=>d.id===t.area).temas.find(x=>x.id===t.id).questoes.length).sort((a,b)=>a.areaName.localeCompare(b.areaName,'pt-BR')||a.name.localeCompare(b.name,'pt-BR'));
 let selected=null;
 if(mode==='assunto'){
  if(!topics.some(t=>JSON.stringify([t.area,t.id])===subject))subject=topics[0]?JSON.stringify([topics[0].area,topics[0].id]):'';
  selected=topics.find(t=>JSON.stringify([t.area,t.id])===subject);
  const label=make('label','Assunto'),select=make('select');select.setAttribute('aria-label','Assunto das estatísticas');
  for(const t of topics){const opt=make('option',t.areaName+' · '+t.name);opt.value=JSON.stringify([t.area,t.id]);opt.selected=opt.value===subject;select.append(opt)}
  select.onchange=()=>{subject=select.value;stats()};label.append(select);root.append(label);window.MedQuestStudyUI?.enhance(label);
 }
 const data=state.progress===null?null:model(BANCO.disciplinas,state.progress);
 const rows=data?data.answers.filter(r=>mode==='geral'||(selected&&r.disciplina_id===selected.area&&r.tema_id===selected.id)):null;
 const count=rows?.length,correct=rows?.filter(r=>r.acertou).length;
 let seconds=null;
 if(state.sessions!==null&&state.legacy!==null){seconds=state.sessions.filter(s=>mode==='geral'||(selected&&s.area_id===selected.area&&[normalize(selected.id),normalize(selected.name)].includes(normalize(s.assunto)))).reduce((sum,s)=>sum+Math.max(0,Number(s.segundos)||0),0);if(mode==='geral')seconds+=state.legacy.reduce((sum,s)=>sum+Math.max(0,Number(s.segundos)||0),0)}
 const metrics=make('div',undefined,'mq-stat-metrics');for(const [value,title] of [[rows?String(count):'—','Questões respondidas'],[rows?(count?Math.round(correct/count*100)+'%':'—'):'—','Taxa de acerto'],[seconds===null?'—':timeLabel(seconds),'Tempo registrado']]){const item=make('div');item.append(make('strong',value),make('span',title));metrics.append(item)}root.append(metrics,make('p',mode==='geral'?'Todo o histórico · últimas respostas por questão.':'Últimas respostas e tempo identificado neste assunto.','mq-stat-explainer'));
 if(state.progress===null||seconds===null)root.append(make('p','Alguns dados não puderam ser carregados.','mq-dashboard-data-error'));
}
async function readAll(table,fields,userId){let all=[];for(let offset=0;;offset+=1000){const r=await db.from(table).select(fields).eq('usuario_id',userId).order('id',{ascending:true}).range(offset,offset+999);if(r.error)throw r.error;all.push(...(r.data||[]));if((r.data||[]).length<1000)break}return all}
async function render(){
 const userId=usuarioAtual?.id;if(!userId)return;const version=++generation;
 cards(null);$('dash-progress').replaceChildren(make('p','Carregando seu progresso…','mq-dashboard-loading'));$('stats-row').replaceChildren(make('p','Carregando estatísticas…','mq-dashboard-loading'));
 const results=await Promise.allSettled([db.from('materiais_medquest').select('disciplina_id,tema_id,arquivo_path').eq('tipo','resumo'),readAll('progresso','questao_id,disciplina_id,tema_id,resposta,acertou',userId),readAll('estudo_sessoes','area_id,assunto,segundos',userId),readAll('tempo_estudo_eventos','segundos',userId)]);
 if(version!==generation||usuarioAtual?.id!==userId)return;
 const material=results[0].status==='fulfilled'&&!results[0].value.error?results[0].value.data||[]:false;
 cards(material);
 state={progress:results[1].status==='fulfilled'?results[1].value:null,sessions:results[2].status==='fulfilled'?results[2].value:null,legacy:results[3].status==='fulfilled'?results[3].value:null};
 if(state.progress!==null)drawProgress(model(BANCO.disciplinas,state.progress));else{const root=$('dash-progress');root.replaceChildren(make('p','Não foi possível carregar seu progresso. Seus registros continuam salvos.'));const retry=make('button','Tentar novamente');retry.type='button';retry.onclick=render;root.append(retry)}stats();
}
window.MedQuestDashboard={render,model};
if(typeof usuarioAtual!=='undefined'&&usuarioAtual&&$('tela-dashboard')?.style.display!=='none')render();
})();
