
/* Catalogo de questoes: conteudo oficial de todas as areas. Sem publicacao pelo aluno. */
(() => {
  'use strict';
  const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=x=>document.getElementById(x);
  let active=false;
  function catalog(){
    const disciplines=BANCO.disciplinas||[];
    const total=disciplines.reduce((a,d)=>a+d.temas.reduce((sum,t)=>sum+t.questoes.length,0),0);
    const topics=disciplines.reduce((a,d)=>a+d.temas.length,0);
    const header='<div class="mq-q-head"><div><span class="mq-q-eyebrow">BANCO DE QUESTÕES</span><h1>Explore todos os temas</h1>'+
      '<p>Questões oficiais organizadas por área de estudo. Escolha um tema para começar.</p></div>'+
      '<div class="mq-q-summary"><b>'+topics+'</b><small>temas</small><b>'+total+'</b><small>questões</small></div></div>';
    const groups=disciplines.map(d=>{
      const list=d.temas||[],available=list.reduce((acc,t)=>acc+(t.questoes?.length||0),0);
      const entries=list.map(t=>{
        const count=t.questoes?.length||0;
        const inactive=count===0;
        const button=inactive
          ?'<span class="mq-q-no-questions">Sem questões cadastradas</span>'
          :'<button type="button" class="mq-q-open" data-d="'+E(d.id)+'" data-t="'+E(t.id)+'" aria-label="Iniciar questões de '+E(t.nome)+'">Praticar <span aria-hidden="true">›</span></button>';
        return '<article class="mq-q-topic '+(inactive?'mq-q-inactive':'')+'">'+
          '<div><h3>'+E(t.nome)+'</h3><span>'+count+' '+(count===1?'questão':'questões')+'</span></div>'+
          button+'</article>';
      }).join('');
      return '<section class="mq-q-area"><div class="mq-q-area-head"><div><h2>'+E(d.nome)+'</h2>'+
        '<span>'+list.length+' '+(list.length===1?'tema':'temas')+' · '+available+' '+(available===1?'questão':'questões')+'</span></div></div>'+
        '<div class="mq-q-topics">'+(entries||'<p class="mq-q-empty">Ainda não há temas cadastrados nesta área.</p>')+'</div></section>';
    }).join('');
    id('mq-questoes-gerais').innerHTML=header+'<div class="mq-q-groups">'+groups+'</div>';
    id('mq-questoes-gerais').querySelectorAll('.mq-q-open').forEach(button=>{
      button.addEventListener('click',()=>iniciarTema(button.dataset.d,button.dataset.t));
    });
  }
  async function open(){
    esconderApp();
    const el=id('mq-questoes-gerais');
    if(!el)return;
    el.style.display='block';
    active=true;
    setNavActive('nav-questoes');
    fecharSidebar();
    catalog();
    window.scrollTo(0,0);
    try{
      if(typeof carregarBancoRemoto==='function'){
        await carregarBancoRemoto();
        if(active && el.style.display==='block')catalog();
      }
    }catch(error){console.warn('Atualização do catálogo de questões:',error);}
  }
  window.abrirQuestoesGerais=open;
  window.mqDesativarCatalogo=()=>{active=false;const el=id('mq-questoes-gerais');if(el)el.style.display='none'};
})();
