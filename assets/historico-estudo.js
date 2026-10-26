/* MedQuest: day-by-day study history, shared by Progresso 7/15/30-day filter. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;',"'":'&#39;'}[c]));
const user=()=>typeof usuarioAtual==='undefined'?null:usuarioAtual?.id||null;
const categoryLabels={questoes:'Questões',pdf:'Leitura de PDF',resumos:'Resumos',outros:'Outros estudos'};
const dayKey=date=>{let d=new Date(date);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const timeLabel=s=>{let h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?h+'h '+m+'min':m+'min'};
const prettyDay=date=>new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
let days=15,area='',category='',items=[],oldEvents=[],version=0;
function split(session){
 const segments=Array.isArray(session.segmentos)?session.segmentos:[];
 if(!segments.length)return [{date:session.dia,seconds:session.segundos}];
 const denom=segments.reduce((sum,p)=>sum+Math.max(0,(Date.parse(p.fim)-Date.parse(p.inicio))/1000),0);
 if(!denom)return [{date:session.dia,seconds:session.segundos}];
 const buckets=new Map();
 for(const p of segments){
  let start=Date.parse(p.inicio),end=Date.parse(p.fim);
  if(!Number.isFinite(start)||!Number.isFinite(end))continue;
  while(start<end){
   let at=new Date(start),next=new Date(at.getFullYear(),at.getMonth(),at.getDate()+1).getTime(),edge=Math.min(end,next);
   buckets.set(dayKey(at),(buckets.get(dayKey(at))||0)+(edge-start)/1000);start=edge;
  }
 }
 return [...buckets].map(([date,seconds])=>({date,seconds:seconds*session.segundos/denom}));
}
async function read(range,selectedArea='',legacy=[]){
 days=[7,15,30].includes(range)?range:15;area=selectedArea||'';oldEvents=legacy||[];
 const element=$('mq-study-history');if(!element||!user())return;
 const current=++version;loadedUser=user();
 element.innerHTML='<div class="mq-history-empty" role="status">Carregando suas sessões de estudo…</div>';
 const date=new Date();date.setDate(date.getDate()-days-2);const from=dayKey(date);
 try{
  let records=[];
  for(let offset=0;offset<15000;offset+=1000){
   const r=await db.from('estudo_sessoes').select('*').eq('usuario_id',loadedUser).gte('dia',from).order('dia',{ascending:false}).range(offset,offset+999);
   if(current!==version||user()!==loadedUser||!$('mq-study-history'))return;
   if(r.error)throw r.error;records.push(...(r.data||[]));if((r.data||[]).length<1000)break;
  }
  items=records;draw();
 }catch(e){if(current!==version)return;element.innerHTML='<div class="mq-history-empty"><strong>Não foi possível carregar o histórico.</strong><p>Seus registros continuam salvos. Tente novamente.</p><button type="button" onclick="MedQuestStudyHistory.retry()">Tentar novamente</button></div>'}
}
let loadedUser='',expanded=new Set();
const areaLabel=id=>(typeof BANCO==='undefined'?[]:BANCO.disciplinas).find(d=>d.id===id)?.nome||'Geral / livre';
function draw(){
 const el=$('mq-study-history');if(!el||user()!==loadedUser)return;
 const begin=new Date();begin.setHours(0,0,0,0);begin.setDate(begin.getDate()-days+1);
 const firstDay=dayKey(begin),lastDay=dayKey(new Date()),rows=new Map();
 function add(date,entry){if(!date||date<firstDay||date>lastDay)return;const list=rows.get(date)||[];list.push(entry);rows.set(date,list)}
 for(const item of items){
  if(area&&area!==item.area_id)continue;if(category&&category!==item.atividade)continue;
  for(const part of split(item))add(part.date,{session:item,seconds:part.seconds});
 }
 if(!area&&(!category||category==='questoes'))for(const event of oldEvents)add(dayKey(event.registrado_em),{legacy:true,seconds:Number(event.segundos||0)});
 const dates=[...rows].sort((a,b)=>b[0].localeCompare(a[0]));let total=0,sessionCount=new Set();
 const content=dates.map(([date,entries],index)=>{
  const grouped=new Map();let seconds=0;
  for(const entry of entries){seconds+=entry.seconds;const id=entry.legacy?'legacy':entry.session.id;if(!entry.legacy)sessionCount.add(id);if(!grouped.has(id))grouped.set(id,{...entry,seconds:0});grouped.get(id).seconds+=entry.seconds}
  total+=seconds;
  const detail=[...grouped.values()].sort((a,b)=>(b.session?.inicio_em||'').localeCompare(a.session?.inicio_em||'')).map(v=>{
   if(v.legacy)return '<article class="mq-history-line"><span class="mq-history-activity-icon" aria-hidden="true">◷</span><div><b>Prática de questões</b><small>Contagem automática da versão anterior</small></div><strong>'+timeLabel(v.seconds)+'</strong></article>';
   const x=v.session,activity=categoryLabels[x.atividade]||'Estudo anterior';
   return '<article class="mq-history-line"><span class="mq-history-activity-icon" aria-hidden="true">'+(x.atividade==='pdf'?'▤':x.atividade==='questoes'?'✓':'◷')+'</span><div class="mq-history-session-info"><b>'+E(x.titulo)+'</b><small>'+E(activity)+' · '+E(areaLabel(x.area_id))+(x.assunto?' · '+E(x.assunto):'')+'</small><div class="mq-history-session-tags"><span>'+E(x.fonte==='manual'?'Registro manual':'Cronômetro')+'</span>'+(x.inicio_em?'<span>'+E(new Date(x.inicio_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))+'</span>':'')+'</div>'+(x.observacoes?'<p class="mq-history-observation">'+E(x.observacoes)+'</p>':'')+'</div><div class="mq-history-line-actions"><strong>'+timeLabel(v.seconds)+'</strong><div><button type="button" aria-label="Editar '+E(x.titulo)+'" onclick="MedQuestStudyHistory.edit(\''+x.id+'\')">Editar</button><button type="button" aria-label="Excluir '+E(x.titulo)+'" onclick="MedQuestStudyHistory.remove(\''+x.id+'\')">Excluir</button></div></div></article>';
  }).join('');
  const d=new Date(date+'T12:00:00'),today=date===lastDay;
  return '<details class="mq-history-day" data-day="'+date+'"'+(expanded.has(date)||(!expanded.size&&index===0)?' open':'')+'><summary><span class="mq-history-date"><b>'+d.getDate().toString().padStart(2,'0')+'</b><span><strong>'+E(today?'Hoje':d.toLocaleDateString('pt-BR',{weekday:'long'}))+'</strong><small>'+E(d.toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}))+'</small></span></span><span class="mq-history-day-total"><b>'+timeLabel(seconds)+'</b><small>'+grouped.size+' '+(grouped.size===1?'registro':'registros')+'</small></span><span class="mq-history-chevron" aria-hidden="true">⌄</span></summary>'+detail+'</details>';
 }).join('');
 const areas=(typeof BANCO==='undefined'?[]:BANCO.disciplinas).map(d=>[d.id,d.nome]).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
 const options=(values,selected)=>values.map(([k,v])=>'<option value="'+E(k)+'"'+(k===selected?' selected':'')+'>'+E(v)+'</option>').join('');
 el.innerHTML='<header class="mq-history-head"><div><small class="mq-history-eyebrow">SUA ROTINA, DIA A DIA</small><h2 tabindex="-1" id="mq-history-title">Histórico diário</h2><p>Veja o que você estudou e o tempo dedicado a cada atividade.</p></div><button type="button" onclick="MedQuestStudyTime.manual()">+ Registrar estudo</button></header>'+
 '<div class="mq-history-overview"><article><span>Tempo estudado</span><strong>'+timeLabel(total)+'</strong><small>Nos últimos '+days+' dias</small></article><article><span>Dias de estudo</span><strong>'+dates.length+'</strong><small>'+days+' dias no período</small></article><article><span>Sessões registradas</span><strong>'+sessionCount.size+'</strong><small>Cronômetro e registros manuais</small></article></div>'+
 '<div class="mq-history-filterbar"><div class="mq-history-periods" role="group" aria-label="Período do histórico">'+[7,15,30].map(n=>'<button type="button" aria-pressed="'+(days===n)+'" onclick="MedQuestStudyHistory.period('+n+')">'+n+' dias</button>').join('')+'</div><div class="mq-history-filterfields"><label>Área<select aria-label="Área do histórico" onchange="MedQuestStudyHistory.area(this.value)">'+options([['','Todas as áreas'],...areas],area)+'</select></label><label>Atividade<select aria-label="Atividade do histórico" onchange="MedQuestStudyHistory.type(this.value)">'+options([['','Todas as atividades'],...Object.entries(categoryLabels)],category)+'</select></label></div></div>'+
 '<div class="mq-history-timeline">'+(content||'<div class="mq-history-empty"><span class="mq-history-empty-icon" aria-hidden="true">◷</span><strong>'+((area||category)?'Nenhum estudo com esses filtros':'Seu histórico começa na próxima sessão')+'</strong><p>'+((area||category)?'Tente outra área ou atividade para encontrar seus registros.':'Inicie o cronômetro ou registre um estudo que você já concluiu.')+'</p><button type="button" onclick="'+((area||category)?'MedQuestStudyHistory.reset()':'MedQuestStudyTime.manual()')+'">'+((area||category)?'Limpar filtros':'+ Registrar estudo')+'</button></div>')+'</div><p class="mq-history-footnote">Seu histórico é individual. Estudos que atravessam a meia-noite têm o tempo distribuído entre os dias.</p>';
 el.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)expanded.add(d.dataset.day);else expanded.delete(d.dataset.day)}));
 window.MedQuestStudyUI.enhance(el);
}
async function remove(id){
 const item=items.find(x=>x.id===id);if(!item||user()!==loadedUser)return;
 const accepted=await window.MedQuestStudyUI.confirm({title:'Excluir registro de estudo?',message:'A sessão “'+item.titulo+'” será removida do seu histórico. Essa ação não altera suas respostas às questões.',confirm:'Excluir registro',danger:true});if(!accepted)return;
 try{const r=await db.from('estudo_sessoes').delete().eq('id',id).eq('usuario_id',user()).select('id');if(r.error)throw r.error;if(!r.data?.length)throw Error('O registro não foi removido.');items=items.filter(x=>x.id!==id);draw();window.MedQuestStudyUI.toast('Registro excluído.');window.MedQuestProgress?.reload?.()}
 catch(e){window.MedQuestStudyUI.toast('Não foi possível excluir o registro. Tente novamente.')}
}
window.MedQuestStudyHistory={read,split,type:x=>{category=x;draw()},area:x=>{area=x;draw()},period:n=>{if(window.MedQuestProgress)window.MedQuestProgress.range(n);else read(n,area,oldEvents)},reset:()=>{area='';category='';draw()},retry:()=>read(days,area,oldEvents),focus:()=>{$('mq-study-history')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});$('mq-history-title')?.focus({preventScroll:true})},edit:id=>{const x=items.find(s=>s.id===id);if(x&&user()===loadedUser)window.MedQuestStudyTime?.edit(x)},remove};
})();
