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
  let active=false,filteredSession=null,openDropdown='';
  // Títulos conferidos nos oito cadernos PDF originais.
  const hpTitles={
  "antibioticos-i-beta-lactamicos": [
    "Parede celular: estrutura, função e alvos",
    "Mecanismo de ação dos β-lactâmicos",
    "Classes de antimicrobianos",
    "Mecanismos de resistência bacteriana",
    "Aplicações clínicas e uso racional"
  ],
  "antibioticos-ii-sintese-proteica": [
    "Ribossomo bacteriano",
    "Mecanismos por classe",
    "Bactericida e bacteriostático",
    "Resistência bacteriana",
    "Aplicações e limitações"
  ],
  "antibioticos-iii-sulfonamidas-e-quinolonas": [
    "Vias metabólicas",
    "Sulfonamidas e trimetoprima",
    "Quinolonas e fluoroquinolonas",
    "Resistência aos antimicrobianos",
    "Clínica, distribuição e segurança"
  ],
  "imunodeficiencias-primarias": [
    "Tipos e investigação das imunodeficiências",
    "Imunidade inata e fagócitos",
    "Disfunções de células NK, B e T",
    "Imunodeficiência combinada grave",
    "Bases genéticas e distúrbios multissistêmicos"
  ],
  "biofilmes-bacterianos": [
    "Fundamentos, superfícies e impacto clínico",
    "Adesão, microcolônias e ciclo de formação",
    "Matriz extracelular, EPS e DNA extracelular",
    "Tolerância antimicrobiana e recidiva",
    "Quorum sensing, AHL e estratégias de bloqueio"
  ],
  "staphylococcus-sp": [
    "Fisiologia e estrutura",
    "Patogênese e imunidade",
    "Epidemiologia",
    "Doenças clínicas",
    "Diagnóstico, terapia e controle"
  ],
  "artropodes-vetores-e-parasitas": [
    "Transmissão e ciclos vetoriais",
    "Capacidade vetorial e hematofagismo",
    "Moscas, miíases e terapia larval",
    "Pulgas, piolhos e percevejos",
    "Carrapatos e ácaros de importância médica"
  ],
  "hipersensibilidade": ["Fundamentos da hipersensibilidade e inflamação crônica","Hipersensibilidade tipos II, III e IV","Alergia: IgE, mastócitos e resposta Th2","Autoimunidade e doenças imunomediadas","Tratamento e imunomodulação"],
    "microbiota-humana": ["Conceitos, microbioma e métodos de estudo","Ecossistemas e distribuição da microbiota","Colonização, proteção e funções metabólicas","Disbiose e infecções oportunistas","Probióticos, prebióticos e intervenções"],
    "infeccao-hospitalar": ["Definição e manifestações das IRAS","Epidemiologia e vigilância hospitalar","Transmissão, biofilmes e resistência","Prevenção, controle e uso racional de dispositivos","Vulnerabilidade do hospedeiro e abordagem clínica"],
    "introducao-a-parasitologia": [
    "Parasitismo e expressão clínica",
    "Habitat, hospedeiros e especificidade",
    "Ecologia de populações parasitárias",
    "Classificação de protozoários",
    "Classificação de helmintos"
  ]
};
  const hpTitle=(topic,hp)=>{
    const i=Number(String(hp).match(/\d+/)?.[0]||0)-1;
    return hpTitles[topic]?.[i]||'';
  };
  const normalizeHP=q=>{
    const m=String(q.hotpoint||'').match(/(?:hot\s*point|hp)[\s.:#-]*0?([1-9]\d*)/i);
    return m?'Hot Point '+Number(m[1]):String(q.hotpoint||'').trim()||'Não definido';
  };
  // Classificação editorial das 140 questões locais legadas.
  // A dificuldade explícita do PDF/Supabase sempre tem precedência sobre essa classificação.
  const localGrades={
  "imunodeficiencias-primarias": {
    "intermediario": [
      1,
      3,
      4,
      8
    ],
    "dificil": [
      2,
      5,
      6,
      10
    ],
    "muito_dificil": [
      7,
      9
    ]
  },
  "hipersensibilidade": {
    "intermediario": [
      101,
      102,
      104,
      107,
      112,
      125
    ],
    "dificil": [
      103,
      105,
      106,
      108,
      110,
      113,
      115,
      117,
      119,
      122,
      123,
      126,
      128,
      130
    ],
    "muito_dificil": [
      109,
      111,
      114,
      116,
      118,
      120,
      121,
      124,
      127,
      129
    ]
  },
  "microbiota-humana": {
    "intermediario": [
      201,
      205,
      208,
      209,
      211,
      214,
      215,
      217,
      218,
      221,
      222,
      225,
      227,
      228,
      231,
      238,
      241,
      244,
      245,
      247
    ],
    "dificil": [
      202,
      204,
      206,
      207,
      212,
      213,
      216,
      219,
      220,
      223,
      226,
      229,
      232,
      233,
      237,
      239,
      242,
      243,
      246,
      248,
      249
    ],
    "muito_dificil": [
      203,
      210,
      224,
      230,
      234,
      235,
      236,
      240,
      250
    ]
  },
  "infeccao-hospitalar": {
    "intermediario": [
      301,
      302,
      306,
      308,
      311,
      314,
      321,
      322,
      331,
      332,
      333,
      336,
      338,
      341,
      346
    ],
    "dificil": [
      303,
      304,
      305,
      307,
      309,
      312,
      313,
      315,
      317,
      319,
      323,
      325,
      328,
      330,
      334,
      335,
      337,
      340,
      342,
      343,
      344,
      345,
      347
    ],
    "muito_dificil": [
      310,
      316,
      318,
      320,
      324,
      326,
      327,
      329,
      339,
      348,
      349,
      350
    ]
  }
};
  const gradeIndex=Object.fromEntries(Object.entries(localGrades).map(([topic,classes])=>[
    topic,Object.fromEntries(Object.entries(classes).flatMap(([grade,ids])=>ids.map(id=>[id,grade])))
  ]));
  for(const disc of BANCO.disciplinas||[]) for(const topic of disc.temas||[])
    for(const question of topic.questoes||[]){
      const level=gradeIndex[topic.id]?.[question.id];
      if(!question.nivel_dificuldade && level) question.nivel_dificuldade=level;
    }
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
      for(const q of t.questoes||[]){
        const hp=normalizeHP(q);
        rows.push({areaId:d.id,areaName:d.nome,
          temaId:t.id,temaName:t.nome,hotpoint:hp,hotpointKey:t.id+'|'+hp,
          hotpointTitle:hpTitle(t.id,hp),
          dificuldade:normalizeLevel(q),questao:q});
      }
    return rows;
  }
  function matches(row,skip){
    if(skip!=='area'&&filters.area&&row.areaId!==filters.area)return false;
    if(skip!=='assunto'&&filters.assunto&&row.temaId!==filters.assunto)return false;
    if(skip!=='hotpoint'&&filters.hotpoint&&row.hotpointKey!==filters.hotpoint)return false;
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
    if(field==='hotpoint'){
      const unique=new Map(prior.map(r=>[r.hotpointKey,r]));
      return [...unique.values()].sort((a,b)=>
        a.temaName.localeCompare(b.temaName,'pt-BR')||sortHP(a.hotpoint,b.hotpoint))
        .map(r=>[r.hotpointKey,
          (filters.assunto?'':r.temaName+' · ')+r.hotpoint+
          (r.hotpointTitle?' — '+r.hotpointTitle:''),
          true]);
    }
    const counts=Object.fromEntries(levels.map(([k])=>[k,prior.filter(r=>r.dificuldade===k).length]));
    return levels.map(([k,v])=>[k,v,counts[k]>0,counts[k]]);
  }
  function fieldMarkup(field,rows){
    const value=filters[field.key],opts=selectOptions(field.key,rows);
    const activeLabel=value?opts.find(([key])=>key===value)?.[1]||field.placeholder:field.placeholder;
    const open=openDropdown===field.key;
    const entries=[['',field.placeholder,true],...opts];
    const options=entries.filter(([, ,enabled])=>enabled).map(([key,label,,count])=>
      '<button type="button" class="mq-q-filter-option'+(value===key?' is-selected':'')+
      '" role="option" tabindex="'+(value===key?'0':'-1')+
      '" aria-selected="'+(value===key)+'" data-mq-choice="'+field.key+
      '" data-mq-value="'+E(key)+'"><span class="mq-q-option-tick" aria-hidden="true">'+
      (value===key?'✓':'')+'</span><span class="mq-q-option-label">'+E(label)+
      (count===undefined?'':' <small>('+count+')</small>')+'</span></button>').join('');
    return '<div class="mq-q-filter" data-mq-filter-wrap="'+field.key+'">'+
      '<span id="mq-q-label-'+field.key+'" class="mq-q-filter-label">'+
      '<span aria-hidden="true" class="mq-q-filter-icon">'+field.icon+'</span>'+field.label+'</span>'+
      '<button id="mq-q-filter-'+field.key+'" type="button" class="mq-q-filter-trigger'+
      (value?' has-value':'')+(open?' is-open':'')+
      '" aria-labelledby="mq-q-label-'+field.key+' mq-q-value-'+field.key+
      '" aria-haspopup="listbox" aria-expanded="'+open+
      '" aria-controls="mq-q-options-'+field.key+
      '" data-mq-trigger="'+field.key+'"><span id="mq-q-value-'+field.key+
      '" class="mq-q-trigger-text" title="'+E(activeLabel)+'">'+E(activeLabel)+
      '</span><span class="mq-q-filter-chevron" aria-hidden="true">⌄</span></button>'+
      (open?'<div id="mq-q-options-'+field.key+'" class="mq-q-filter-menu" role="listbox" aria-labelledby="mq-q-label-'+field.key+'">'+
        options+'</div>':'')+'</div>';
  }
  function chips(rows){
    const names={
      area:(BANCO.disciplinas||[]).find(d=>d.id===filters.area)?.nome||filters.area,
      assunto:rows.find(r=>r.temaId===filters.assunto)?.temaName||filters.assunto,
      hotpoint:rows.find(r=>r.hotpointKey===filters.hotpoint)?.hotpointTitle ?
        rows.find(r=>r.hotpointKey===filters.hotpoint).hotpoint+' — '+
        rows.find(r=>r.hotpointKey===filters.hotpoint).hotpointTitle : filters.hotpoint,
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
      const cards=(d.temas||[]).map(t=>{
        const qs=matched.filter(r=>r.areaId===d.id&&r.temaId===t.id);
        if(!qs.length)return '';
        return '<article class="mq-q-topic"><div><h3>'+E(t.nome)+'</h3>'+
          '<span>'+qs.length+' '+(qs.length===1?'questão encontrada':'questões encontradas')+
          '</span></div><button type="button" class="mq-q-open" data-d="'+E(d.id)+
          '" data-t="'+E(t.id)+'" aria-label="Praticar '+qs.length+' questões de '+E(t.nome)+'">'+
          'Praticar <span aria-hidden="true">›</span></button></article>';
      });
      const visible=cards.filter(Boolean);
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
    el.querySelectorAll('[data-mq-trigger]').forEach(button=>{
      button.addEventListener('click',()=>{
        const key=button.dataset.mqTrigger;
        openDropdown=openDropdown===key?'':key;
        render();
        if(openDropdown)focusSelected(key);
        else $('mq-q-filter-'+key)?.focus();
      });
      button.addEventListener('keydown',e=>{
        if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){
          e.preventDefault();openDropdown=button.dataset.mqTrigger;
          render();focusSelected(openDropdown,e.key==='ArrowUp');
        } else if(e.key==='Escape'&&openDropdown){
          e.preventDefault();openDropdown='';render();$('mq-q-filter-'+button.dataset.mqTrigger)?.focus();
        }
      });
    });
    el.querySelectorAll('[data-mq-choice]').forEach(button=>{
      button.addEventListener('click',()=>{
        const key=button.dataset.mqChoice;
        filters[key]=button.dataset.mqValue;
        openDropdown='';
        if(key==='area'){filters.assunto='';filters.hotpoint='';}
        if(key==='assunto')filters.hotpoint='';
        render();
        $('mq-q-filter-'+key)?.focus();
      });
      button.addEventListener('keydown',e=>{
        const key=button.dataset.mqChoice;
        const nodes=[...el.querySelectorAll('[data-mq-choice="'+key+'"]')];
        const index=nodes.indexOf(button);
        if(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Home'||e.key==='End'){
          e.preventDefault();
          const next=e.key==='Home'?0:e.key==='End'?nodes.length-1:
            (index+(e.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length;
          nodes.forEach((item,i)=>item.tabIndex=i===next?0:-1);
          nodes[next]?.focus();
        }
        if(e.key==='Escape'){
          e.preventDefault();openDropdown='';render();$('mq-q-filter-'+key)?.focus();
        }
      });
    });
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
  function focusSelected(key,reverse=false){
    const nodes=[...document.querySelectorAll('[data-mq-choice="'+key+'"]')];
    const selected=nodes.find(x=>x.getAttribute('aria-selected')==='true');
    const focus=reverse?nodes.at(-1):(selected||nodes[0]);
    if(focus){nodes.forEach(x=>x.tabIndex=x===focus?0:-1);focus.focus();}
  }
  document.addEventListener('pointerdown',e=>{
    if(!openDropdown||e.target.closest?.('[data-mq-filter-wrap]'))return;
    openDropdown='';if(active&&$('mq-questoes-gerais')?.style.display==='block')render();
  });
  function clearFilters(){for(const field of fields)filters[field.key]='';openDropdown='';render();}
  function applyQuestions(list){
    if(!list.length || typeof estadoAtual==='undefined')return;
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
