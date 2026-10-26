/* Feedback calculado somente a partir das respostas do bloco atual. */
(()=>{
'use strict';
function build(session,disciplines){
 const groups=new Map();let answered=0,correct=0;
 session.questoes.forEach((q,index)=>{
  const answer=session.respostas[index];if(!answer||!q.alternativas.some(a=>a.letra===answer.marcada))return;
  answered++;const right=answer.marcada===q.correta;if(right)correct++;
  const area=q.__mqAreaId||session.disciplinaId,topic=q.__mqTemaId||session.temaId;
  const discipline=disciplines.find(d=>d.id===area),subject=discipline?.temas.find(t=>t.id===topic);
  const hpNumber=String(q.hotpoint||'').match(/(?:hot\s*point|hp)\s*(\d+)/i)?.[1];
  const hp=hpNumber?'Hot Point '+Number(hpNumber):String(q.hotpoint||'').trim();
  const key=JSON.stringify([area,topic,hp]);
  if(!groups.has(key))groups.set(key,{area,topic,areaName:q.__mqAreaNome||discipline?.nome||area,topicName:q.__mqTemaNome||subject?.nome||topic,hotpoint:hp,title:q.__mqHotpointTitulo||window.MedQuestHotPoints?.titulo(topic,hp)||hp||'Conteúdo do assunto',answered:0,errors:[]});
  const group=groups.get(key);group.answered++;if(!right)group.errors.push(index);
 });
 return {answered,correct,errors:answered-correct,pending:session.questoes.length-answered,groups:[...groups.values()].filter(g=>g.errors.length).sort((a,b)=>b.errors.length-a.errors.length||b.errors.length/b.answered-a.errors.length/a.answered||a.title.localeCompare(b.title,'pt-BR'))};
}
function render(session,disciplines){
 const root=document.getElementById('resultado-feedback');if(!root)return;
 root.replaceChildren();const data=build(session,disciplines);
 const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
 const header=make('header');header.append(make('small','SEU PRÓXIMO PASSO'),make('h2',data.errors?'O que aprofundar agora':data.answered?'Bom trabalho neste bloco':'Seu bloco ainda não tem respostas'));
 root.append(header);
 if(data.pending)root.append(make('p',data.pending+' '+(data.pending===1?'questão não respondida. Ela não entra':'questões não respondidas. Elas não entram')+' na lista de erros.','mq-feedback-pending'));
 if(!data.answered){root.append(make('p','Responda às questões para receber uma orientação de revisão baseada no seu desempenho.'));return}
 if(!data.errors){root.append(make('p','Você acertou todas as questões respondidas deste bloco. Continue praticando outros conteúdos para ampliar sua revisão.'));return}
 root.append(make('p','Priorize os tópicos abaixo. Releia o resumo do assunto e os comentários das questões indicadas antes de tentar novamente.'));
 const review=index=>{if(estadoAtual!==session)return;renderQuestao(index);mostrarTela('questao');window.scrollTo({top:0,behavior:'auto'})};
 const list=make('div',undefined,'mq-feedback-topics');
 for(const group of data.groups){
  const card=make('article',undefined,'mq-feedback-topic');
  card.append(make('small',group.areaName+' · '+group.topicName),make('h3',group.title));
  card.append(make('p',(group.title!==group.hotpoint&&group.hotpoint?group.hotpoint+' · ':'')+group.errors.length+' '+(group.errors.length===1?'erro':'erros')+' em '+group.answered+' '+(group.answered===1?'questão respondida':'questões respondidas'),'mq-feedback-count'));
  const links=make('div',undefined,'mq-feedback-questions');
  for(const index of group.errors){const b=make('button','Rever questão '+(index+1));b.type='button';b.onclick=()=>review(index);links.append(b)}
  card.append(links);list.append(card);
 }
 root.append(list,make('p','Orientação baseada nas respostas deste bloco. Os temas estão ordenados pela quantidade de erros, sem contar questões em branco.','mq-feedback-note'));
}
window.MedQuestFeedback={build,render};
})();
