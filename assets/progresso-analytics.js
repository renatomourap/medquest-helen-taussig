/* MedQuest | painel de progresso — métricas pessoais sem dados fictícios. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{let d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate())};
const add=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const key=d=>[d.getFullYear(),('0'+(d.getMonth()+1)).slice(-2),('0'+d.getDate()).slice(-2)].join('-');
const areaName=id=>BANCO.disciplinas.find(x=>x.id===id)?.nome||'Outra área';
const topicName=(a,t)=>BANCO.disciplinas.find(x=>x.id===a)?.temas.find(x=>x.id===t)?.nome||t||'Assunto';
const fnum=n=>Number(n).toLocaleString('pt-BR');
const icons={
 questions:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 book:'<path d="M12 6c-2-2-6-3-9-2v16c4-1 7 0 9 2 2-2 5-3 9-2V4c-3-1-7 0-9 2Z"/><path d="M12 6v16"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3"/>',
 flame:'<path d="M12 22c-4.5 0-8-3.5-8-8 0-3 2-5 3-7 1 3 3 4 4 4-1-4 2-7 4-9 0 4 5 6 5 12 0 4.5-3.5 8-8 8Z"/>',
 chart:'<path d="M5 20v-5M11 20V8M17 20V3" stroke-width="3"/>',
 idea:'<path d="M9 18h6M10 21h4M8 15a7 7 0 1 1 8 0l-1 3H9l-1-3Z"/>'
};
const icon=n=>'<svg viewBox="0 0 24 24" class="mp-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(icons[n]||icons.book)+'</svg>';
let range=15,mode='geral',area='',metric='taxa',history=[],sessions=[],loadedUser='',request=0;
async function readTable(table,columns,dateColumn,start,user){
 let all=[];
 for(let offset=0;offset<15000;offset+=1000){
  const r=await db.from(table).select(columns).eq('usuario_id',user).gte(dateColumn,start).order(dateColumn,{ascending:false}).range(offset,offset+999);
  if(r.error)throw r.error;
  let items=r.data||[];
  all=all.concat(items);
  if(items.length<1000)break;
 }
 return all;
}
async function open(){
 const user=usuarioAtual?.id,token=++request;
 if(!user)return;
 if(loadedUser===user){render();return;}
 $('study-content').innerHTML='<div class="mp-empty">Carregando seu histórico de estudos…</div>';
 const earliest=add(today(),-60).toISOString();
 const results=await Promise.allSettled([
  readTable('historico_respostas','disciplina_id,tema_id,acertou,respondido_em','respondido_em',earliest,user),
  readTable('tempo_estudo_eventos','segundos,registrado_em','registrado_em',earliest,user)
 ]);
 if(token!==request)return;
 if(results[0].status==='rejected'){
  console.error('Falha no histórico de respostas:',results[0].reason);
  $('study-content').innerHTML='<div class="mp-empty">Não foi possível carregar o histórico. <button onclick="MedQuestProgress.reload()">Tentar novamente</button></div>';
  return;
 }
 history=results[0].value||[];
 sessions=results[1].status==='fulfilled'?results[1].value||[]:[];
 if(results[1].status==='rejected')console.warn('Contagem de tempo indisponível:',results[1].reason);
 loadedUser=user;
 render();
}
const start=n=>add(today(),1-n).getTime();
const filterRows=(n,previous=false)=>{
 const from=start(n)-(previous?n*86400000:0),to=previous?start(n):Infinity;
 return history.filter(x=>{let t=new Date(x.respondido_em).getTime();return t>=from&&t<to&&(!area||x.disciplina_id===area)});
};
const sum=rows=>({n:rows.length,good:rows.filter(x=>x.acertou===true).length,topics:new Set(rows.map(x=>x.disciplina_id+'|'+x.tema_id)).size});
const pct=s=>s.n?Math.round(100*s.good/s.n):null;
const pp=n=>n===null?'—':n+'%';
const secFor=(n,prev=false)=>{
 const from=start(n)-(prev?n*86400000:0),to=prev?start(n):Infinity;
 return sessions.filter(x=>{let t=new Date(x.registrado_em).getTime();return t>=from&&t<to}).reduce((v,x)=>v+Number(x.segundos||0),0);
};
const humanTime=n=>n<60?'0min':n>=3600?Math.floor(n/3600)+'h '+Math.floor((n%3600)/60)+'min':Math.floor(n/60)+'min';
const streak=rows=>{
 const dates=new Set(rows.map(x=>key(new Date(x.respondido_em))));
 let d=today();
 if(!dates.has(key(d)))d=add(d,-1);
 let count=0;
 while(count<=range&&dates.has(key(d))){count++;d=add(d,-1);}
 return count;
};
const compare=(value,old,type)=>{
 if(old===null||old===undefined||old===0)return 'Sem referência anterior';
 if(value===null)return 'Sem dados no período';
 if(value===old)return 'Estável em relação ao período anterior';
 if(type==='pp')return (value-old>0?'+':'')+(value-old)+' p.p. vs. período anterior';
 return (value-old>0?'+':'')+Math.round((value-old)/old*100)+'% vs. período anterior';
};
const cl=(v,p)=>p===null||v===null||p===undefined?'mp-muted':v>p?'mp-up':v<p?'mp-down':'mp-muted';
const card=(ico,title,val,detail,status)=>'<article class="mp-stat"><div class="mp-stat-head"><span class="mp-icon-bubble">'+icon(ico)+'</span><span>'+esc(title)+'</span></div><strong>'+esc(val)+'</strong><small class="'+(status||'mp-muted')+'">'+esc(detail)+'</small></article>';
const grouped=rows=>{
 const result=new Map();
 for(const row of rows){
  const k=row.disciplina_id+'|'+row.tema_id;
  const all=result.get(k)||[];
  all.push(row);result.set(k,all);
 }
 return result;
};
function areas(rows){
 return BANCO.disciplinas.map(d=>{const ss=sum(rows.filter(x=>x.disciplina_id===d.id));return {id:d.id,name:d.nome,count:ss.n,rate:pct(ss)}}).filter(d=>d.count);
}
function bars(rows){
 let arr;
 if(mode==='assunto'){
  arr=[...grouped(rows)].map(([k,list])=>{const names=k.split('|');return {name:topicName(names[0],names[1]),sub:areaName(names[0]),count:list.length,rate:pct(sum(list))}}).sort((a,b)=>b.count-a.count).slice(0,15);
 }else arr=areas(rows);
 if(!arr.length)return '<div class="mp-empty-light">Responda questões para visualizar seu desempenho.</div>';
 return arr.map(a=>'<div class="mp-bar-row"><div class="mp-bar-name">'+esc(a.name)+(a.sub?'<small>'+esc(a.sub)+'</small>':'')+'</div><div class="mp-bar-track"><span style="width:'+a.rate+'%"></span></div><b>'+a.rate+'%</b><small>'+a.count+' questões</small></div>').join('');
}
const insight=(theme,title,main,sub,ico)=>'<div class="mp-insight '+theme+'"><span class="mp-insight-symbol">'+icon(ico)+'</span><div><small>'+esc(title)+'</small><b>'+esc(main)+'</b></div><span class="mp-insight-detail">'+esc(sub)+'</span></div>';
function insights(current,previous){
 const eligible=areas(current).filter(a=>a.count>=3).sort((a,b)=>b.rate-a.rate);
 let blocks='';
 if(eligible.length>=2){
  blocks+=insight('mp-insight-green','Melhor desempenho',eligible[0].name,eligible[0].rate+'% · '+eligible[0].count+' questões','chart');
  const lowest=eligible[eligible.length-1];
  blocks+=insight('mp-insight-red','Área para revisar',lowest.name,lowest.rate+'% · '+lowest.count+' questões','target');
 }else blocks+=insight('mp-insight-neutral','Continue praticando','Explore novas áreas','Com ao menos 3 respostas em duas áreas, teremos comparações.','book');
 const c=pct(sum(current)),p=pct(sum(previous));
 if(c!==null&&p!==null)blocks+=insight(c>=p?'mp-insight-green':'mp-insight-red','Evolução recente',c>=p?'Seu desempenho está evoluindo':'Oportunidade de revisão',compare(c,p,'pp'),'chart');
 else blocks+=insight('mp-insight-blue','Evolução recente','Aguardando histórico','Mais resultados permitirão comparar os períodos.','chart');
 return blocks;
}
function lineChart(rows){
 const days=[];
 for(let i=range-1;i>=0;i--){
  const day=add(today(),-i),dayRows=rows.filter(x=>key(new Date(x.respondido_em))===key(day)),s=sum(dayRows);
  days.push({date:day,n:s.n,value:metric==='taxa'?pct(s):s.n});
 }
 const W=640,H=220,L=42,R=15,T=16,B=33,w=W-L-R,h=H-T-B;
 const maximum=metric==='taxa'?100:Math.max(4,Math.ceil(Math.max(...days.map(d=>d.n))/4)*4);
 const y=n=>T+h-n/maximum*h;
 let result='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Evolução dos últimos '+range+' dias" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="mpGoldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8ba63" stop-opacity=".30"/><stop offset="100%" stop-color="#e8ba63" stop-opacity="0"/></linearGradient></defs>';
 for(const frac of [0,.25,.5,.75,1]){
  const yy=y(frac*maximum),val=Math.round(frac*maximum);
  result+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'" stroke="#293748" stroke-dasharray="3 3"/><text x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end" fill="#99a8b8" font-size="11">'+val+(metric==='taxa'?'%':'')+'</text>';
 }
 let interval=range===7?1:range===15?3:5;
 for(let i=0;i<days.length;i++)if(i%interval===0||i===days.length-1){
  let x=L+w*i/(range-1),d=days[i].date;
  result+='<text x="'+x+'" y="'+(H-8)+'" fill="#899bab" font-size="10" text-anchor="middle">'+d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+'</text>';
 }
 const points=days.map((d,i)=>({d,i})).filter(p=>p.d.n).map(p=>({x:L+w*p.i/(range-1),y:y(p.d.value),value:p.d.value,n:p.d.n,date:p.d.date}));
 if(points.length){
  let path=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
  const first=points[0],last=points[points.length-1];
  if(points.length>1)result+='<path d="M'+first.x+' '+(T+h)+' '+path.replace(/^M/,'L')+' L'+last.x+' '+(T+h)+' Z" fill="url(#mpGoldFill)"/>';
  result+='<path d="'+path+'" stroke="#f1c466" stroke-width="2.7" fill="none" stroke-linejoin="round"/>';
  for(const p of points){
   result+='<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#eec571" stroke="#0a1621" stroke-width="1.5"><title>'+p.date.toLocaleDateString('pt-BR')+' — '+Math.round(p.value)+(metric==='taxa'?'%':' questões')+' ('+p.n+' respostas)</title></circle>';
  }
 }else result+='<text x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" fill="#8c9bab" font-size="13">Nenhuma questão respondida neste período</text>';
 return result+'</svg>';
}
function render(){
 const el=$('study-content');if(!el)return;
 const rows=filterRows(range),prior=filterRows(range,true),s=sum(rows),p=sum(prior),pNow=pct(s),pOld=pct(p),seconds=secFor(range);
 const series=[
  card('questions','Questões respondidas',fnum(s.n),compare(s.n,p.n),cl(s.n,p.n)),
  card('target','Taxa de acerto',pp(pNow),compare(pNow,pOld,'pp'),cl(pNow,pOld)),
  card('book','Assuntos praticados',fnum(s.topics),s.topics?'Conteúdos diferentes':'Nenhum assunto praticado','mp-muted'),
  card('clock','Tempo de estudo',humanTime(seconds),seconds?'Tempo registrado nas questões':'Medição iniciada a partir de agora','mp-muted'),
  card('flame','Sequência de estudos',streak(rows)+' '+(streak(rows)===1?'dia':'dias'),'Dias consecutivos de questões','mp-muted')
 ].join('');
 const dPct=pNow??0,wrong=s.n-s.good;
 const options='<option value="">Todas as áreas</option>'+BANCO.disciplinas.map(d=>'<option value="'+esc(d.id)+'"'+(area===d.id?' selected':'')+'>'+esc(d.nome)+'</option>').join('');
 const header=(ico,title,sub)=>'<div class="mp-title">'+icon(ico)+'<div><h2>'+esc(title)+'</h2><p>'+esc(sub)+'</p></div></div>';
 el.innerHTML='<div class="mp-dashboard">'+
  '<div class="mp-toolbar"><select class="mp-area-filter" aria-label="Filtrar área" onchange="MedQuestProgress.area(this.value)">'+options+'</select>'+
   '<div class="mp-periods" role="group" aria-label="Período">'+[7,15,30].map(n=>'<button type="button" aria-pressed="'+(range===n)+'" class="'+(range===n?'selected':'')+'" onclick="MedQuestProgress.range('+n+')">Últimos '+n+' dias</button>').join('')+'</div>'+
   '<div class="mp-view-modes" role="group" aria-label="Exibição"><button type="button" class="'+(mode==='geral'?'selected':'')+'" onclick="MedQuestProgress.mode(\'geral\')">Geral</button><button type="button" class="'+(mode==='assunto'?'selected':'')+'" onclick="MedQuestProgress.mode(\'assunto\')">Por assunto</button></div></div>'+
  '<div class="mp-stat-grid">'+series+'</div>'+
  '<div class="mp-panels"><section class="mp-panel mp-panel-line"><div class="mp-panel-head">'+header('chart','Evolução da '+(metric==='taxa'?'taxa de acerto':'quantidade de questões'),'Acompanhe sua performance ao longo do tempo.')+
  '<select class="mp-chart-selector" aria-label="Métrica do gráfico" onchange="MedQuestProgress.chart(this.value)"><option value="taxa"'+(metric==='taxa'?' selected':'')+'>Taxa de acerto</option><option value="quantidade"'+(metric==='quantidade'?' selected':'')+'>Questões por dia</option></select></div>'+
  '<div class="mp-line-plot">'+lineChart(rows)+'</div><p class="mp-data-note">Dias sem respostas não são considerados como zero de acerto.</p></section>'+
  '<section class="mp-panel mp-panel-distribution"><div class="mp-panel-head">'+header('target','Distribuição de resultados',s.n+' questões respondidas.')+'</div>'+
  '<div class="mp-distribution-body"><div class="mp-donut" style="--mp-good:'+dPct+'%"><div class="mp-donut-label"><b>'+pp(pNow)+'</b><span>de acerto</span></div></div>'+
  '<div class="mp-legend"><div><i class="mp-legend-dot correct"></i><span>Corretas<small>'+s.good+' ('+dPct+'%)</small></span></div>'+
  '<div><i class="mp-legend-dot wrong"></i><span>Incorretas<small>'+wrong+' ('+(s.n?100-dPct:0)+'%)</small></span></div></div></div></section>'+
  '<section class="mp-panel mp-panel-areas"><div class="mp-panel-head">'+header('book','Desempenho por '+(mode==='geral'?'área':'assunto'),'Sua taxa de acerto em cada conteúdo.')+'</div><div class="mp-bars">'+bars(rows)+'</div></section>'+
  '<section class="mp-panel mp-panel-insights"><div class="mp-panel-head">'+header('idea','Insights do seu desempenho','Análises baseadas no desempenho recente.')+'</div><div class="mp-insights">'+insights(rows,prior)+'</div></section></div>'+
  '<p class="mp-disclaimer">Resultados reais das tentativas registradas. O histórico anterior à atualização contém a última resposta salva por questão. O tempo de estudo contabiliza apenas os minutos ativos em questões após a atualização.</p></div>';
}
const configure=(what,value)=>{
 if(what==='range')range=[7,15,30].includes(value)?value:15;
 if(what==='area')area=value;
 if(what==='mode')mode=value==='assunto'?'assunto':'geral';
 if(what==='chart')metric=value==='quantidade'?'quantidade':'taxa';
 render();
};
window.MedQuestProgress={open,reload:()=>{loadedUser='';open()},range:v=>configure('range',v),area:v=>configure('area',v),mode:v=>configure('mode',v),chart:v=>configure('chart',v)};
let lastUserAction=Date.now();
['pointerdown','keydown','wheel','touchstart'].forEach(name=>document.addEventListener(name,()=>{lastUserAction=Date.now()},{passive:true}));
setInterval(async()=>{
 if(!usuarioAtual?.id||document.visibilityState!=='visible'||!document.hasFocus()||$('tela-questao')?.style.display!=='block'||Date.now()-lastUserAction>240000)return;
 try{let r=await db.from('tempo_estudo_eventos').insert({usuario_id:usuarioAtual.id,origem:'questoes',segundos:60});if(r.error)console.warn('Tempo de estudo:',r.error.message)}
 catch(e){console.warn('Registro de tempo:',e)}
},60000);
})();
