/* MedQuest — catálogo de questões com quatro filtros reais e combináveis. */
(() => {
  'use strict';
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const fields=[
    {key:'area',label:'Área',placeholder:'Todas as áreas',icon:'◈'},
    {key:'assunto',label:'Assunto',placeholder:'Todos os assuntos',icon:'▤'},
    {key:'hotpoint',label:'Hot Point',placeholder:'Todos os Hot Points',icon:'◎'},
    {key:'dificuldade',label:'Nível de Dificuldade',placeholder:'Todos os níveis',icon:'▥'}
  ];
  const levels=[['facil','Fácil'],['intermediario','Intermediário'],['dificil','Difícil'],
    ['muito_dificil','Muito difícil'],['nao_classificada','Não classificada']];
  const filters={area:'',assunto:'',hotpoint:'',dificuldade:''};
  let active=false,filteredSession=null;
  const normalizeHP=q=>{
    const m=String(q.hotpoint||'').match(/(?:hot\s*point|hp)[\s.:#-]*0?([1-9]\d*)/i);
    return m?'Hot Point '+Number(m[1]):String(q.hotpoint||'').trim()||'Não definido';
  };
  const normalizeLevel=q=>{
    const raw=q.nivel_dificuldade ?? q.dificuldade ?? q.nivel;
    if(!raw)return 'nao_classificada';
    const word=String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[\s-]+/g,'_');
    const equivalent={
      facil:'facil',easy:'facil',intermediario:'intermediario',medio:'intermediario',
      medium:'intermediario',dificil:'dificil',hard:'dificil',
      muito_dificil:'muito_dificil',muito_dificil_: 'muito_dificil',very_hard:'muito_dificil'
    };
    return equivalent[word]||'nao_classificada';
  };
  function flatten(){
    const rows=[];
    for(const d of BANCO.disciplinas||[])for(const t of d.temas||[])
      for(const q of t.questoes||[])rows.push({areaId:d.id,areaName:d.nome,
        temaId:t.id,temaName:t.nome,hotpoint:normalizeHP(q),
        dificuldade:normalizeLevel(q),questao:q});
    return rows;
  }
  function matches(row,skip){
    if(skip!=='area'&&filters.area&&row.areaId!==filters.area)return false;
    if(skip!=='assunto'&&filters.assunto&&row.temaId!==filters.assunto)return false;
    if(skip!=='hotpoint'&&filters.hotpoint&&row.hotpoint!==filters.hotpoint)return false;
    if(skip!=='dificuldade'&&filters.dificuldade&&row.dificuldade!==filters.dificuldade)return false;
    return true;
  }
  const sortHP=(a,b)=>{
    const x=Number(String(a).match(/\d+/)?.[0]||999);
    const y=Number(String(b).match(/\d+/)?.[0]||999);
    return x-y||a.localeCompare(b,'pt-BR');
  };
  function selectOptions(field,rows){
    const prior=rows.filter(r=>matches(r,field));
    if(field==='area'){
      const opts=(BANCO.disciplinas||[]).map(d=>[d.id,d.nome]);
      return opts.map(([k,v])=>[k,v,prior.some(r=>r.areaId===k)]);
    }
    if(field==='assunto'){
      const ids=new Map(prior.map(r=>[r.temaId,r.temaName]));
      return [...ids.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'))
        .map(([k,v])=>[k,v,true]);
    }
    if(field==='hotpoint')return [...new Set(prior.map(r=>r.hotpoint))].sort(sortHP)
      .map(v=>[v,v,true]);
    const counts=Object.fromEntries(levels.map(([k])=>[k,prior.filter(r=>r.dificuldade===k).length]));
    return levels.map(([k,v])=>[k,v,counts[k]>0,counts[k]]);
  }
  function fieldMarkup(field,rows){
    const value=filters[field.key],opts=selectOptions(field.key,rows);
    return '<label class="mq-q-filter" for="mq-q-filter-'+field.key+'">'+
      '<span class="mq-q-filter-label"><span aria-hidden="true" class="mq-q-filter-icon">'+field.icon+
      '</span>'+field.label+'</span><span class="mq-q-filter-selectwrap">'+
      '<select id="mq-q-filter-'+field.key+'" data-mq-filter="'+field.key+'">'+
      '<option value="">'+field.placeholder+'</option>'+
      opts.map(([k,name,enabled,n])=>'<option value="'+E(k)+'"'+(value===k?' selected':'')+
        (!enabled?' disabled':'')+'>'+E(name)+
        (n!==undefined?' ('+n+')':'')+'</option>').join('')+
      '</select><span class="mq-q-chevron" aria-hidden="true">⌄</span></span></label>';
  }
  function chips(rows){
    const names={
      area:(BANCO.disciplinas||[]).find(d=>d.id===filters.area)?.nome||filters.area,
      assunto:rows.find(r=>r.temaId===filters.assunto)?.temaName||filters.assunto,
      hotpoint:filters.hotpoint,
      dificuldade:levels.find(([k])=>k===filters.dificuldade)?.[1]||filters.dificuldade
    };
    return fields.filter(f=>filters[f.key]).map(f=>'<button type="button" class="mq-q-chip" data-mq-remove="'+f.key+
      '" aria-label="Remover filtro '+E(f.label)+'">'+E(f.label)+': <strong>'+E(names[f.key])+'</strong> <span aria-hidden="true">×</span></button>').join('');
  }
  function render(){
    const el=$('mq-questoes-gerais');if(!el)return;
    const rows=flatten(),matched=rows.filter(r=>matches(r));
    const topics=new Set(matched.map(r=>r.areaId+'|'+r.temaId)).size;
    const incomplete=rows.filter(r=>r.dificuldade==='nao_classificada').length;
    const filtersOn=fields.some(f=>!!filters[f.key]);
    const header='<div class="mq-q-head"><div><span class="mq-q-eyebrow">BANCO DE QUESTÕES · MEDQUEST</span>'+
      '<h1>Encontre exatamente o que estudar</h1>'+
      '<p>Combine os filtros para praticar apenas os assuntos e mecanismos desejados.</p></div>'+
      '<div class="mq-q-summary"><b>'+matched.length+'</b><small>questões</small>'+
      '<b>'+topics+'</b><small>assuntos</small></div></div>';
    const bar='<section class="mq-q-filter-panel" aria-label="Filtros do banco de questões">'+
      '<div class="mq-q-filter-heading"><span><span class="mq-q-filter-heading-mark" aria-hidden="true">☷</span>'+
      ' Refine sua prática</span><span class="mq-q-filter-count">'+matched.length+
      ' de '+rows.length+' questões</span></div>'+
      '<div class="mq-q-filters">'+fields.map(f=>fieldMarkup(f,rows)).join('')+'</div>'+
      '<div class="mq-q-filter-foot"><div class="mq-q-chips">'+chips(rows)+
      (!filtersOn?'<span class="mq-q-filter-tip">Selecione um ou mais filtros para personalizar sua lista.</span>':'')+
      '</div><button class="mq-q-clear" type="button" id="mq-q-clear"'+(!filtersOn?' disabled':'')+
      '>↺ Limpar filtros</button></div>'+
      (incomplete?'<p class="mq-q-grade-note">A classificação de dificuldade ainda não foi atribuída a '+
        incomplete+' '+(incomplete===1?'questão':'questões')+'. Essas questões permanecem acessíveis em “Não classificada”.</p>':'')+
      '</section>';
    const groups=(BANCO.disciplinas||[]).map(d=>{
      const topics=(d.temas||[]).map(t=>{
        const qs=matched.filter(r=>r.areaId===d.id&&r.temaId===t.id);
        if(!qs.length)return '';
        return '<article class="mq-q-topic"><div><h3>'+E(t.nome)+'</h3>'+
          '<span>'+qs.length+' '+(qs.length===1?'questão encontrada':'questões encontradas')+
          '</span></div><button type="button" class="mq-q-open" data-d="'+E(d.id)+
          '" data-t="'+E(t.id)+'" aria-label="Praticar '+qs.length+' questões de '+E(t.nome)+'">'+
          'Praticar <span aria-hidden="true">›</span></button></article>';
      }).join('');
      const visible=topics.filter(Boolean);
      if(!visible.length)return '';
      const dCount=matched.filter(r=>r.areaId===d.id).length;
      return '<section class="mq-q-area"><div class="mq-q-area-head"><div><h2>'+E(d.nome)+'</h2>'+
        '<span>'+visible.length+' '+(visible.length===1?'assunto':'assuntos')+' · '+dCount+
        ' '+(dCount===1?'questão':'questões')+'</span></div></div>'+
        '<div class="mq-q-topics">'+visible.join('')+'</div></section>';
    }).filter(Boolean).join('');
    el.innerHTML=header+bar+'<div class="mq-q-results-head"><h2>Assuntos disponíveis</h2>'+
      '<span>'+topics+' '+(topics===1?'resultado':'resultados')+'</span></div>'+
      (groups?'<div class="mq-q-groups">'+groups+'</div>':
        '<div class="mq-q-no-results"><div class="mq-q-no-results-icon" aria-hidden="true">⌕</div>'+
        '<h3>Nenhuma questão corresponde aos filtros</h3><p>Tente outra combinação de área, assunto, Hot Point ou dificuldade.</p>'+
        '<button type="button" id="mq-q-reset-empty">Limpar filtros</button></div>');
    el.querySelectorAll('[data-mq-filter]').forEach(sel=>sel.addEventListener('change',e=>{
      const key=e.currentTarget.dataset.mqFilter;
      filters[key]=e.currentTarget.value;
      if(key==='area'){filters.assunto='';filters.hotpoint='';}
      if(key==='assunto')filters.hotpoint='';
      render();
    }));
    el.querySelector('#mq-q-clear')?.addEventListener('click',()=>clearFilters());
    el.querySelector('#mq-q-reset-empty')?.addEventListener('click',()=>clearFilters());
    el.querySelectorAll('[data-mq-remove]').forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.mqRemove;filters[key]='';
      if(key==='area'){filters.assunto='';filters.hotpoint='';}
      if(key==='assunto')filters.hotpoint='';
      render();
    }));
    el.querySelectorAll('.mq-q-open').forEach(btn=>btn.addEventListener('click',()=>{
      const did=btn.dataset.d,tid=btn.dataset.t;
      const selected=matched.filter(r=>r.areaId===did&&r.temaId===tid).map(r=>r.questao);
      if(!selected.length)return;
      window.__mqFromCatalog=true;
      iniciarTema(did,tid);
      const all=BANCO.disciplinas.find(d=>d.id===did)?.temas.find(t=>t.id===tid)?.questoes||[];
      if(selected.length<all.length){
        filteredSession={did,tid,questions:selected};
        applyQuestions(selected);
      }
    }));
  }
  function clearFilters(){for(const field of fields)filters[field.key]='';render();}
  function applyQuestions(list){
    if(!list.length || !window.estadoAtual)return;
    estadoAtual.questoes=list;
    estadoAtual.questaoIndex=0;estadoAtual.respostas={};
    renderMiniaturas();renderQuestao(0);
  }
  // Reiniciar preserva o conjunto filtrado; iniciar outro tema reinicia normalmente.
  const nativeStart=window.iniciarTema;
  window.iniciarTema=function(...args){filteredSession=null;return nativeStart.apply(this,args);};
  const nativeRestart=window.reiniciarTema;
  window.reiniciarTema=function(...args){
    const keep=filteredSession;
    const result=nativeRestart.apply(this,args);
    if(keep&&estadoAtual.disciplinaId===keep.did&&estadoAtual.temaId===keep.tid){
      filteredSession=keep;applyQuestions(keep.questions);
    }
    return result;
  };
  async function open(){
    esconderApp();
    const el=$('mq-questoes-gerais');if(!el)return;
    el.style.display='block';active=true;
    setNavActive('nav-questoes');fecharSidebar();render();window.scrollTo(0,0);
    try{
      if(typeof carregarBancoRemoto==='function'){
        await carregarBancoRemoto();
        if(active&&el.style.display==='block')render();
      }
    }catch(e){console.warn('Atualização do catálogo de questões:',e);}
  }
  window.abrirQuestoesGerais=open;
  window.mqDesativarCatalogo=()=>{active=false;const el=$('mq-questoes-gerais');if(el)el.style.display='none';};
})();
