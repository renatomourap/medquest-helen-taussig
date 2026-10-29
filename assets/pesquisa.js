/* Pesquisa autenticada: somente catálogo real e documentos acessíveis pela RLS. */
(() => {
 'use strict';
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=(item,q)=>norm(q).trim().split(/\s+/).every(word=>norm(item.search).includes(word));
 function summaries(pdfs,areaName,hotpointTitle){
  const groups=new Map();
  for(const m of pdfs){
   if(m.tipo!=='resumo')continue;
   const key=m.resumo_grupo_id||m.id;
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(m);
  }
  return [...groups.values()].map(files=>{
   const m=files.find(f=>f.resumo_versao==='expandido')||files[0];
   const hp=Array.from({length:5},(_,i)=>{const title=hotpointTitle(m.tema_id,'Hot Point '+(i+1));return title?'Hot Point '+(i+1)+' HP'+(i+1)+' '+title:''}).filter(Boolean).join(' ');
   const versions=[...new Set(files.map(f=>f.resumo_versao||'expandido'))].join(' e ');
   return {title:m.titulo,label:'Resumo · '+areaName(m.disciplina_id)+' · '+versions,
    search:[m.titulo,m.tema_nome,m.tema_id,areaName(m.disciplina_id),versions,hp].join(' '),
    open:()=>window.studyOpenSummarySubject(m.id)};
  });
 }
 window.MedQuestSearchModel={norm,matches,summaries};
 const trigger=document.querySelector('.topbar-search');
 if(!trigger)return;
 const modal=document.createElement('dialog');modal.className='mq-search-dialog';
 modal.innerHTML='<div class="mq-search-head"><label for="mq-search-input">Pesquisar no MedQuest</label><button type="button" aria-label="Fechar pesquisa">×</button></div><input id="mq-search-input" type="search" placeholder="Tema, assunto, Hot Point ou funcionalidade…" autocomplete="off"><p class="mq-search-status" role="status"></p><div class="mq-search-results"></div>';
 document.body.append(modal);
 const input=modal.querySelector('input'),status=modal.querySelector('[role=status]'),results=modal.querySelector('.mq-search-results');
 let items=[],generation=0,returnFocus;
 const allowed=()=>typeof usuarioAtual!=='undefined'&&usuarioAtual&&perfilAtual?.aprovado;
 function close(){generation++;items=[];results.replaceChildren();modal.close();returnFocus?.focus()}
 modal.querySelector('button').onclick=close;
 modal.addEventListener('cancel',e=>{e.preventDefault();close()});
 modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
 function paint(){
  results.replaceChildren();const query=input.value.trim();
  if(!query){status.textContent='Busque resumos por tema, assunto ou Hot Point, ou encontre uma funcionalidade.';return}
  const found=items.filter(x=>matches(x,query));
  status.textContent=found.length?`${found.length} resultado(s)${found.length>60?' — refine a pesquisa para ver mais':''}`:'Nenhum resultado encontrado.';
  for(const item of found.slice(0,60)){
   const b=document.createElement('button');b.type='button';b.className='mq-search-result';
   const title=document.createElement('strong'),meta=document.createElement('span');title.textContent=item.title;meta.textContent=item.label;b.append(title,meta);
   b.onclick=async()=>{if(!allowed()){close();return}close();try{await item.open()}catch(e){alert('Não foi possível abrir o resultado. Tente novamente.')}};results.append(b);
  }
 }
 input.oninput=paint;
 input.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus()}else if(e.key==='Enter'){e.preventDefault();results.querySelector('button')?.click()}};
 results.onkeydown=e=>{const buttons=[...results.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=i+(e.key==='ArrowDown'?1:-1);if(next<0)input.focus();else buttons[Math.min(next,buttons.length-1)]?.focus()}};
 async function open(){
  if(!allowed())return;
  returnFocus=document.activeElement;const request=++generation;items=[];input.value='';results.replaceChildren();status.textContent='Carregando conteúdos…';if(!modal.open)modal.showModal();input.focus();
  const sections=[
   ['Início','Página inicial, dashboard, explorar áreas','nav-inicio'],
   ['Perfil','Dados da conta, cadastro','nav-perfil'],
   ['Resumos','Biblioteca, PDFs, resumo expandido, resumo simplificado, ler, baixar','nav-resumo'],
   ['Questões','Banco de questões, filtros, praticar, resolver, gabarito comentado','nav-questoes'],
   ['Outros Materiais','Artigos, resumos gerais, AIM','nav-outros'],
   ['Plano da Semana','Planejamento semanal, tarefas, metas, organização','nav-plano'],
   ['Progresso','Estatísticas, acertos, desempenho, histórico diário, tempo de estudo','nav-progresso'],
   ['Cronômetro','Tempo de estudo, iniciar, pausar, registrar estudo manualmente','mq-top-timer']
  ];
  for(const [title,keywords,id] of sections)if(document.getElementById(id))items.push({title,label:'Funcionalidade da plataforma',search:title+' '+keywords,open:()=>document.getElementById(id)?.click()});
  let failed=false;
  try{
   const r=await db.from('materiais_medquest').select('id,titulo,tipo,disciplina_id,tema_nome,tema_id,resumo_versao,resumo_grupo_id').eq('tipo','resumo');
   if(request!==generation||!modal.open||!allowed())return;
   if(r.error)throw r.error;
   items.push(...summaries(r.data||[],id=>BANCO.disciplinas.find(d=>d.id===id)?.nome||'Geral',(topic,hp)=>window.MedQuestHotPoints?.titulo(topic,hp)||''));
  }catch(e){if(request!==generation||!modal.open||!allowed())return;failed=true;}

  paint();if(failed)status.textContent+=' Parte dos materiais não pôde ser carregada. Feche e abra a busca para tentar novamente.';
 }
 trigger.onclick=open;
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&allowed()){e.preventDefault();open()}});
})();
