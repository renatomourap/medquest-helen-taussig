/* Pesquisa autenticada: somente catálogo real e documentos acessíveis pela RLS. */
(() => {
 'use strict';
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=(item,q)=>norm(q).trim().split(/\s+/).every(word=>norm(item.search).includes(word));
 window.MedQuestSearchModel={norm,matches};
 const trigger=document.querySelector('.topbar-search');
 if(!trigger)return;
 const modal=document.createElement('dialog');modal.className='mq-search-dialog';
 modal.innerHTML='<div class="mq-search-head"><label for="mq-search-input">Pesquisar no MedQuest</label><button type="button" aria-label="Fechar pesquisa">×</button></div><input id="mq-search-input" type="search" placeholder="Assunto, trecho da questão ou material…" autocomplete="off"><p class="mq-search-status" role="status"></p><div class="mq-search-results"></div>';
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
  if(!query){status.textContent='Digite para buscar assuntos, questões, PDFs e suas anotações.';return}
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
  for(const d of BANCO.disciplinas||[])for(const t of d.temas||[]){
   if(!t.questoes?.length)continue;
   items.push({title:t.nome,label:'Assunto · '+d.nome,search:t.nome+' '+d.nome,open:()=>iniciarTema(d.id,t.id)});
   t.questoes.forEach((q,index)=>items.push({title:q.enunciado,label:'Questão · '+d.nome+' · '+t.nome,search:[d.nome,t.nome,q.enunciado,q.hotpoint,...(q.alternativas||[]).map(a=>a.texto)].join(' '),open:async()=>{await iniciarTema(d.id,t.id);renderQuestao(index)}}));
  }
  const loaded=await Promise.allSettled([
   db.from('materiais_medquest').select('id,titulo,tipo,disciplina_id,tema_nome,tema_id,resumo_versao'),
   db.from('estudo_documentos').select('id,titulo,assunto,area_id').eq('usuario_id',usuarioAtual.id).eq('tipo','anotacao')
  ]);
  if(request!==generation||!modal.open||!allowed())return;
  let failed=false;
  loaded.forEach((r,n)=>{if(r.status!=='fulfilled'||r.value.error){failed=true;return}for(const m of r.value.data||[]){
   const area=BANCO.disciplinas.find(d=>d.id===(m.disciplina_id||m.area_id))?.nome||'Geral';
   const type=n?'Anotação':m.tipo==='resumo'?'Resumo '+(m.resumo_versao||'expandido'):'Material';
   items.push({title:m.titulo,label:type+' · '+area,search:[m.titulo,m.tema_nome,m.tema_id,m.assunto,area,type].join(' '),open:()=>{if(n)return studyOpenNote(m.id);if(m.tipo==='resumo'){window.studyPendingDocument=m.id;return abrirEstudo('resumo')}return window.MedQuestOpenMaterial(m.id,m.tipo)}});
  }});
  paint();if(failed)status.textContent+=' Parte dos materiais não pôde ser carregada. Feche e abra a busca para tentar novamente.';
 }
 trigger.onclick=open;
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&allowed()){e.preventDefault();open()}});
})();
