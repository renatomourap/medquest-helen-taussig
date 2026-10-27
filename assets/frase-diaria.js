/* Original study messages; one shared message per 24-hour Brasília calendar day. */
(()=>{
 const messages=[
  'Nunca desista de tentar descobrir o que é certo para o paciente.',
  'Estude os mecanismos de hoje para compreender o paciente de amanhã.',
  'Cada revisão é uma oportunidade de transformar dúvida em compreensão.',
  'Organize o caminho, respeite seu ritmo e continue aprendendo.',
  'Uma boa pergunta pode abrir o caminho para um grande aprendizado.',
  'Conhecimento cresce quando você conecta a teoria à prática.',
  'Aprender medicina também é aprender a observar, ouvir e perguntar.',
  'Revise seus erros com curiosidade: eles mostram onde aprofundar.',
  'A constância nos estudos se constrói uma sessão de cada vez.',
  'Por trás de cada assunto, lembre-se da pessoa que você vai cuidar.',
  'Faça uma pausa, recupere o foco e retome seu próximo passo.',
  'Compreender o porquê torna o aprendizado mais duradouro.',
  'Seu planejamento ganha valor quando cabe na sua rotina.',
  'Troque a pressa de terminar pela atenção de compreender.'
 ];
 function update(){const node=document.getElementById('mq-daily-message');if(!node)return;const day=Math.floor((Date.now()-3*3600000)/86400000);node.textContent='“'+messages[((day%messages.length)+messages.length)%messages.length]+'”'}
 update();setInterval(update,60000);document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);
})();
