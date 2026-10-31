// Presentation only: never changes question objects, IDs or saved answers.
(function(){
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function split(value,knownObjective=''){
    let text=String(value||'').replace(/\r/g,'').trim(),objective='',command='';
    const label=/^Objetivo(?: de aprendizagem)?\s*[:.\-–]?\s*/i;
    if(label.test(text)){
      const rest=text.replace(label,'');
      // Exact source metadata wins; never search for a later clinical opening.
      const escaped=String(knownObjective||'').trim().split(/\s+/).map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
      const sourceMatch=escaped?new RegExp('^'+escaped+'(?=\\s|$)','i').exec(rest):null;
      let boundary=sourceMatch?sourceMatch[0].length:-1;
      if(boundary<0){
        // Explicit paragraph or clinical label delimiters preserve multiline objectives.
        boundary=rest.search(/\n\s*\n|\n\s*(?:Enunciado(?: clínico)?|Caso clínico)\s*:/i);
      }
      if(boundary<0){
        // Conservative fallback: the FIRST sentence, not a sentence selected by its first word.
        const first=/\.\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ])/.exec(rest);
        if(first)boundary=first.index+1;
      }
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
      else{const m=/(?:^|[.!]\s+)((?:Qual|Quais|Que [^?]*|Em qual|Como|Considerando|Com base|Diante)[^?]*\?)\s*$/i.exec(text);if(m&&m.index>0){command=m[1].trim();text=text.slice(0,m.index+(/^[.!]/.test(m[0])?1:0)).trim();}}
    }
    if(!command){const boundaries=[...text.matchAll(/[.!]\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ])/g)];const last=boundaries.at(-1);if(last){command=text.slice(last.index+1).trim();text=text.slice(0,last.index+1).trim();}}
    return {text,objective,command};
  }
  function statement(value,knownObjective=''){const p=split(value,knownObjective);return (p.text?'<p>'+escape(p.text).replace(/\n\s*\n/g,'</p><p>')+'</p>':'')+(p.command?'<p class="mq-question-command">'+escape(p.command)+'</p>':'');}
  function commentSections(value,objective){
    const lines=String(value||'').replace(/\r/g,'').replace(/[^\S\n]*\bObjetivo de aprendizagem\b\s*[:.·–—-]?\s*/gi,'\nObjetivo de aprendizagem: ').replace(/[^\S\n]*\bObjetivo\s*[:.]\s*/gi,'\nObjetivo: ').replace(/\s+(?=[A-D]\)\s*(?:in)?correta\b)/gi,'\n').replace(/\s*·\s*(?=Objetivo(?: de aprendizagem)?\s*:)/gi,'\n').split('\n');
    const sections=[];let current=null;
    const heading=/^\s*(?:[•×✓✔–—-]\s*)?([A-D])\s*(?:[):·–—-]\s*|\.\s*(?=(?:incorreta|correta|inadequada|distrator)\b)|\s+(?=(?:incorreta|correta|inadequada|distrator)\b))/i;
    const objectiveLabel=/^\s*Objetivo(?: de aprendizagem)?\s*[:.]/i;
    function add(type,text,letter){current={type,text:[text],letter};sections.push(current);}
    for(const raw of lines){
      const line=raw.trim();
      if(!line){if(current?.type!=='alternative')current=null;continue;}
      const alt=heading.exec(line);
      if(objectiveLabel.test(line)){add('objective',line);}
      else if(alt){const body=line.slice(alt[0].length).replace(/^(?:(?:incorreta|correta|inadequada|distrator)\b\s*[:.–—-]?\s*)+/i,'');add('alternative',body,alt[1].toUpperCase());}
      else if(/^(?:Questão\s*\d|Resposta(?: correta)?\s*:|Gabarito\s*:|Origem\s*:|Referências?\b|Fonte\s*:|Base\s*:|HP\s*\d)/i.test(line)){add('plain',line);}
      else if(current){current.text.push(line);}
      else add('plain',line);
    }
    if(objective&&!sections.some(s=>s.type==='objective'))sections.unshift({type:'objective',text:['Objetivo de aprendizagem: '+objective]});
    return sections;
  }
  function feedbackModel(sections,correct){
    const unique=items=>[...new Set(items.map(s=>s.trim()).filter(Boolean))];
    const objectives=[],general=[],summaries=[],alternatives={A:[],B:[],C:[],D:[]};
    const metadata=/^(?:Questão\s*\d|HP\s*\d|Hot Point\s*\d|Fonte\b|Base\s*:|Origem\b|Referências?\b|Nível\b|(?:MUITO\s+)?DIF[ÍI]CIL\b|INTERMEDI[ÁA]RI[AO]\b|F[ÁA]CIL\b)/i;
    for(const section of sections){
      let text=section.text.join(' ').trim();
      if(section.type==='objective'){
        // An imported paragraph may have the answer summary attached to the objective.
        const parts=text.split(/\s+Resposta(?: correta)?\s*:\s*[A-D]\s*[|:–—-]?\s*/i);
        objectives.push(parts[0].replace(/^Objetivo(?: de aprendizagem)?\s*[:.]?\s*/i,''));
        if(parts[1])summaries.push(parts[1]);
      }else if(section.type==='alternative')alternatives[section.letter]?.push(text);
      else{
        const answer=/^(?:Resposta(?: correta)?|Gabarito)\s*:\s*[A-D]\b\s*[|:–—-]?\s*([\s\S]*)$/i.exec(text);
        if(answer){if(answer[1]&&!metadata.test(answer[1]))summaries.push(answer[1]);}
        else if(!metadata.test(text))general.push(text);
      }
    }
    const body=unique(alternatives[correct]||[]);
    // Older questions have one general explanation and comments only for the wrong options.
    const correctText=unique([...general,...(body.length?body:summaries)]);
    const ordered=[correct,...['A','B','C','D'].filter(letter=>letter!==correct)];
    return {objective:unique(objectives).join(' '),alternatives:ordered.map(letter=>({letter,correct:letter===correct,text:letter===correct?correctText.join(' '):unique(alternatives[letter]||[]).join(' ')}))};
  }
  function commentary(html,objective,correct,context={}){
    const decode=document.createElement('div');
    decode.innerHTML=String(html||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li)>/gi,'\n');
    const model=feedbackModel(commentSections(decode.textContent,objective),correct);
    const number=String(context.number||1).padStart(2,'0');
    const hotpoint=String(context.hotpoint||'').replace(/^HP\s*/i,'Hot Point ');
    const header='<p class="mq-feedback-meta">Questão '+escape(number)+(hotpoint?' · '+escape(hotpoint):'')+'</p>';
    const learning='<p><strong class="mq-learning-objective">'+(model.objective?'Objetivo de aprendizagem: '+escape(model.objective):'Objetivo de aprendizagem não informado neste material.')+'</strong></p>';
    return header+learning+model.alternatives.map(item=>'<div class="mq-comment-alternative"><span class="mq-answer-badge '+(item.correct?'mq-answer-correct':'mq-answer-incorrect')+'">'+item.letter+') '+(item.correct?'CORRETA':'INCORRETA')+'</span><p>'+escape(item.text||'Justificativa não informada neste material.')+'</p></div>').join('');
  }
  function question(q){
    const decode=document.createElement('div');
    decode.innerHTML=String(q.comentario||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li)>/gi,'\n');
    const sourceObjective=feedbackModel(commentSections(decode.textContent),q.correta).objective;
    const parts=split(q.enunciado,sourceObjective);
    return {...parts,html:statement(q.enunciado,sourceObjective)};
  }
  window.MedQuestQuestionPresentation={split,statement,commentary,commentSections,feedbackModel,question};
})();
