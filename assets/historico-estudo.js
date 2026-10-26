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
 const current=++version;
 element.innerHTML='<p class="mq-history-empty">Carregando histórico por dia…</p>';
 const date=new Date();date.setDate(date.getDate()-days-2);
 const from=dayKey(date);
 let r=await db.from('estudo_sessoes').select('*').eq('usuario_id',user()).gte('dia',from).order('dia',{ascending:false}).limit(1000);
 if(current!==version||!$('mq-study-history'))return;
 if(r.error){element.textContent='Não foi possível carregar as sessões: '+r.error.message;return}
 items=r.data||[];
 draw();
}
function draw(){
 const el=$('mq-study-history');if(!el)return;
 let start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);
 const cutoff=start.getTime();
 const rows=new Map();
 function add(date,entry){
  if(new Date(date+'T12:00:00').getTime()<cutoff)return;
  let list=rows.get(date)||[];list.push(entry);rows.set(date,list);
 }
 for(const item of items){
  if(area&&area!==item.area_id)continue;
  if(category&&category!==item.atividade)continue;
  for(const part of split(item))add(part.date,{session:item,seconds:part.seconds});
 }
 if((!area)&&(!category||category==='questoes')){
  for(const event of oldEvents){add(dayKey(event.registrado_em),{legacy:true,seconds:Number(event.segundos||0)})}
 }
 const dates=[...rows].sort((a,b)=>b[0].localeCompare(a[0]));
 let total=0;
 const elements=dates.map(([date,entries])=>{
  const bySession=new Map();let daySeconds=0;
  for(const v of entries){
   daySeconds+=v.seconds;
   const id=v.legacy?'legacy':v.session.id;
   if(!bySession.has(id))bySession.set(id,{...v,seconds:0});
   bySession.get(id).seconds+=v.seconds;
  }
  total+=daySeconds;
  const detail=[...bySession.values()].map(v=>{
   if(v.legacy)return '<div class="mq-history-line"><div><b>Prática de questões (registro anterior)</b><small>Contagem automática da versão antiga</small></div><strong>'+timeLabel(v.seconds)+'</strong></div>';
   const x=v.session;
   return '<div class="mq-history-line"><div><b>'+E(x.titulo)+'</b><small>'+E(categoryLabels[x.atividade]||(x.atividade==='anotacoes'?'Estudo anterior':x.atividade))+' · '+E(x.fonte==='manual'?'Registro manual':'Cronômetro')+
   (x.inicio_em?' · '+E(new Date(x.inicio_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})):'')+
   (x.assunto?' · '+E(x.assunto):'')+'</small></div><div class="mq-history-line-actions"><strong>'+timeLabel(v.seconds)+'</strong>'+
   '<button type="button" onclick="MedQuestStudyHistory.edit(\''+x.id+'\')">Editar</button><button type="button" onclick="MedQuestStudyHistory.remove(\''+x.id+'\')">Excluir</button></div></div>';
  }).join('');
  return '<details class="mq-history-day"><summary><span>'+E(prettyDay(date))+'</span><b>'+timeLabel(daySeconds)+'</b></summary>'+detail+'</details>';
 }).join('');
 el.innerHTML='<header class="mq-history-head"><div><h2>Histórico detalhado de estudos</h2><p>Consulte suas sessões por dia nos últimos '+days+' dias.</p></div>'+
 '<button type="button" onclick="MedQuestStudyTime.manual()">+ Registro manual</button></header>'+
 '<div class="mq-history-filters"><label>Tipo de atividade<select onchange="MedQuestStudyHistory.type(this.value)">'+
 '<option value="">Todas as atividades</option>'+
 Object.entries(categoryLabels).map(([k,v])=>'<option value="'+E(k)+'"'+(k===category?' selected':'')+'>'+E(v)+'</option>').join('')+
 '</select></label><div class="mq-history-summary"><strong>'+timeLabel(total)+'</strong><span>'+dates.length+' '+(dates.length===1?'dia estudado':'dias estudados')+'</span></div></div>'+
 (elements||'<p class="mq-history-empty">Nenhuma sessão neste período. Você pode iniciar o cronômetro ou adicionar um registro manual.</p>')+
 '<p class="mq-history-footnote">Registros antigos de questões e novas sessões aparecem separadamente. Sessões que atravessam meia-noite são distribuídas entre os dias; o registro é individual e privado.</p>';
}
async function remove(id){
 let item=items.find(x=>x.id===id);if(!item||!confirm('Excluir este registro de estudo?'))return;
 let r=await db.from('estudo_sessoes').delete().eq('id',id).eq('usuario_id',user()).select('id');
 if(r.error){alert('Falha ao excluir: '+r.error.message);return}
 window.MedQuestProgress?.reload?.();
}
window.MedQuestStudyHistory={read,type:x=>{category=x;draw()},edit:id=>{let x=items.find(s=>s.id===id);if(x)window.MedQuestStudyTime?.edit(x)},remove,split};
})();