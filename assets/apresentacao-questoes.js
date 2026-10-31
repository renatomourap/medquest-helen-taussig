// Presentation only: never changes question objects, IDs or saved answers.
(function(){
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function split(value){
    let text=String(value||'').replace(/\r/g,'').trim(),objective='',command='';
    const label=/^Objetivo(?: de aprendizagem)?\s*[:.\-–]?\s*/i;
    if(label.test(text)){
      const rest=text.replace(label,'');
      let boundary=rest.search(/\n\s*\n|\n\s*(?:Enunciado(?: clínico)?|Caso clínico)\s*:/i);
      if(boundary<0){const m=/\.\s+(?=(?:Uma? |Paciente |Durante |Na avaliação |Em um|Em uma))/i.exec(rest);if(m)boundary=m.index+1;}
      if(boundary>=0){objective=rest.slice(0,boundary).trim();text=rest.slice(boundary).trim();}
    }else{
      // Some source PDFs use an unlabelled objective in a separate first paragraph.
      const m=/^((?:Interpretar|Explicar|Correlacionar|Identificar|Selecionar|Analisar|Diferenciar|Reconhecer|Integrar|Relacionar|Distinguir)\b[\s\S]*?)\n\s*\n([\s\S]+)$/i.exec(text);
      if(m){objective=m[1].trim();text=m[2].trim();}
    }
    text=text.replace(/^(?:Enunciado(?: clínico)?|Caso clínico)\s*:?\s*/i,'');
    const marker=/(?:^|\s)(?:Pergunta(?: integradora)?|Comando)\s*(?:[:.]|\n)\s*([\s\S]+)$/i.exec(text);
    if(marker){command=marker[1].trim();text=text.slice(0,marker.index).trim();}
    else{
      const paragraphs=text.split(/\n\s*\n/);
      if(paragraphs.length>1&&/\?\s*$/.test(paragraphs.at(-1))){command=paragraphs.pop().trim();text=paragraphs.join('\n\n').trim();}
      else{const m=/(?:^|[.!]\s+)((?:Qual|Quais|Que mecanismo|Como|Considerando|Com base|Diante)[^?]*\?)\s*$/i.exec(text);if(m&&m.index>0){command=m[1].trim();text=text.slice(0,m.index+(/^[.!]/.test(m[0])?1:0)).trim();}}
    }
    return {text,objective,command};
  }
  function statement(value){const p=split(value);return (p.text?'<p>'+escape(p.text).replace(/\n\s*\n/g,'</p><p>')+'</p>':'')+(p.command?'<p class="mq-question-command">'+escape(p.command)+'</p>':'');}
  function commentary(html,objective){
    const box=document.createElement('div');box.innerHTML=String(html||'');
    const walker=document.createTreeWalker(box,4),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    let foundObjective=false;
    for(const node of nodes){
      const text=node.nodeValue;
      if(/^\s*Objetivo(?: de aprendizagem)?\s*[:.]/i.test(text)){
        foundObjective=true;const strong=document.createElement('strong');strong.className='mq-learning-objective';strong.textContent=text.trim();node.replaceWith(strong);continue;
      }
      const regex=/(^|\n|•\s*)([A-D])\s*(?:\)|[.:])?\s+(INCORRETA|CORRETA)\b\s*:?/gi;let m,last=0;const fragment=document.createDocumentFragment();
      while((m=regex.exec(text))){fragment.append(document.createTextNode(text.slice(last,m.index)+m[1]));const badge=document.createElement('span');badge.className='mq-answer-badge '+(m[3].toUpperCase()==='CORRETA'?'mq-answer-correct':'mq-answer-incorrect');badge.textContent=m[2].toUpperCase()+') '+m[3].toUpperCase();fragment.append(badge);last=regex.lastIndex;}
      if(last){fragment.append(document.createTextNode(text.slice(last)));node.replaceWith(fragment);}
    }
    if(objective&&!foundObjective){const p=document.createElement('p'),strong=document.createElement('strong');strong.className='mq-learning-objective';strong.textContent='Objetivo de aprendizagem: '+objective;p.append(strong);box.prepend(p);}
    return box.innerHTML;
  }
  window.MedQuestQuestionPresentation={split,statement,commentary};
})();
