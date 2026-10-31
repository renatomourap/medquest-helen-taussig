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
      if(boundary<0){const m=/\.\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ])/.exec(rest);if(m)boundary=m.index+1;}
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
  function statement(value){const p=split(value);return (p.text?'<p>'+escape(p.text).replace(/\n\s*\n/g,'</p><p>')+'</p>':'')+(p.command?'<p class="mq-question-command">'+escape(p.command)+'</p>':'');}
  function commentSections(value,objective){
    const lines=String(value||'').replace(/\r/g,'').replace(/\s+(?=[A-D]\)\s*(?:in)?correta\b)/gi,'\n').replace(/\s*·\s*(?=Objetivo(?: de aprendizagem)?\s*:)/gi,'\n').split('\n');
    const sections=[];let current=null;
    const heading=/^\s*(?:[•×✓✔–—-]\s*)?([A-D])\s*(?:[).:·–—-]\s*|\s+(?=(?:incorreta|correta|inadequada)\b))/i;
    const objectiveLabel=/^\s*Objetivo(?: de aprendizagem)?\s*[:.]/i;
    function add(type,text,letter){current={type,text:[text],letter};sections.push(current);}
    for(const raw of lines){
      const line=raw.trim();
      if(!line){if(current?.type==='plain')current=null;continue;}
      const alt=heading.exec(line);
      if(objectiveLabel.test(line)){add('objective',line);}
      else if(alt){const body=line.slice(alt[0].length).replace(/^(?:(?:incorreta|correta|inadequada)\b\s*[:.–—-]?\s*)+/i,'');add('alternative',body,alt[1].toUpperCase());}
      else if(/^(?:Questão\s*\d|Resposta\b|Gabarito\s*:|Origem\s*:|Fonte\s*:|Base\s*:|HP\s*\d)/i.test(line)){add('plain',line);}
      else if(current){current.text.push(line);}
      else add('plain',line);
    }
    if(objective&&!sections.some(s=>s.type==='objective'))sections.unshift({type:'objective',text:['Objetivo de aprendizagem: '+objective]});
    return sections;
  }
  function commentary(html,objective,correct){
    // Normalize legacy HTML and plain PDF imports into the same readable sections.
    const decode=document.createElement('div');
    decode.innerHTML=String(html||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li)>/gi,'\n');
    const sections=commentSections(decode.textContent,objective);
    const badge=letter=>'<span class="mq-answer-badge '+(letter===correct?'mq-answer-correct':'mq-answer-incorrect')+'">'+letter+') '+(letter===correct?'CORRETA':'INCORRETA')+'</span>';
    return sections.map(section=>{
      const text=escape(section.text.join(' '));
      if(section.type==='objective')return '<p><strong class="mq-learning-objective">'+text+'</strong></p>';
      if(section.type==='alternative')return '<div class="mq-comment-alternative">'+badge(section.letter)+'<p>'+text+'</p></div>';
      return '<p>'+text.replace(/((?:Resposta(?: correta)?|Gabarito)\s*:\s*)([A-D])\b/i,(_,label,letter)=>label+badge(letter.toUpperCase()))+'</p>';
    }).join('');
  }
  window.MedQuestQuestionPresentation={split,statement,commentary,commentSections};
})();
