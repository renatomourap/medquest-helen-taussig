import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx={window:{}};vm.runInNewContext(readFileSync('assets/apresentacao-questoes.js','utf8'),ctx);
const model=ctx.window.MedQuestQuestionPresentation;
test('inline objective preserves organism abbreviation and moves only objective out of statement',()=>{
 const input='Objetivo de aprendizagem. Interpretar fatores de H. influenzae. Uma criança apresenta pneumonia. Pergunta. Que mecanismo explica o cultivo?';
 const p=model.split(input);assert.equal(p.objective,'Interpretar fatores de H. influenzae.');assert.equal(p.text,'Uma criança apresenta pneumonia.');assert.equal(p.command,'Que mecanismo explica o cultivo?');assert(!model.statement(input).includes('Objetivo'));assert.match(model.statement(input),/class="mq-question-command"/);
});
test('PDF learning objective and clinical labels are separated without losing content',()=>{
 const p=model.split('OBJETIVO DE APRENDIZAGEM\n\nIdentificar o agente.\n\nENUNCIADO CLÍNICO\n\nUma criança apresenta febre.\n\nPERGUNTA INTEGRADORA\n\nQual agente explica o quadro?');
 assert.equal(p.objective,'Identificar o agente.');assert.equal(p.text,'Uma criança apresenta febre.');assert.equal(p.command,'Qual agente explica o quadro?');
});
test('unlabelled objective requires a separate paragraph and action verb',()=>{
 assert.equal(model.split('Interpretar o mecanismo.\n\nUm paciente tem febre.\n\nQual mecanismo explica o quadro?').objective,'Interpretar o mecanismo.');assert.equal(model.split('Um paciente procura atendimento.').objective,'');
});
test('statement escapes markup and does not mutate source question',()=>{
 const q={enunciado:'Paciente apresenta <img src=x> e febre.'};const before=JSON.stringify(q);assert.match(model.statement(q.enunciado),/&lt;img src=x&gt;/);assert.equal(JSON.stringify(q),before);
});
test('legacy plain comments keep objective separate from every alternative explanation',()=>{
 const sections=model.commentSections('Objetivo: Interpretar a deficiência\noxidativa e sua consequência.\nResposta correta: A\nA) CORRETA — Catalase.\nB) Inadequada — Coagulase.\nC) Inadequada — LPS.\nD) Inadequada — Esporos.');
 assert.equal(sections[0].type,'objective');assert.equal(sections[0].text.join(' '),'Objetivo: Interpretar a deficiência oxidativa e sua consequência.');assert.equal(sections.filter(s=>s.type==='alternative').length,4);
});
test('legacy middle dots, cross marks and inline headings all receive alternative sections',()=>{
 for(const value of ['A · INCORRETA. Texto.\nB · CORRETA. Texto.','× A) Texto.\nB) Correta: Texto.','Contexto. A) Incorreta Texto. B) Correta Texto.'])assert.equal(model.commentSections(value).filter(s=>s.type==='alternative').length,2);
 const sections=model.commentSections('Origem: HP 1 · Objetivo: Identificar a girase.\nA) Correta: Texto.');assert.equal(sections.filter(s=>s.type==='objective').length,1);
});
test('legacy objectives before different clinical openings and implicit commands stay complete',()=>{
 const p=model.split('Objetivo de aprendizagem. Relacionar transmissão de H. influenzae com doença. No mesmo ambulatório, uma criança tem febre. A equipe quer definir a conduta.');assert.equal(p.objective,'Relacionar transmissão de H. influenzae com doença.');assert.equal(p.command,'A equipe quer definir a conduta.');assert.equal(p.text,'No mesmo ambulatório, uma criança tem febre.');
});
test('approved layout recognizes uppercase unpunctuated learning objective on the same metadata line',()=>{
 const value='HP 02 · INTERMEDIÁRIA · fonte: pp. 8 OBJETIVO DE APRENDIZAGEM Distinguir acilação de pbps a partir do mecanismo e de suas implicações farmacológicas.';
 const sections=model.commentSections(value);
 assert.equal(sections.length,2);assert.equal(sections[0].type,'plain');assert.equal(sections[0].text[0],'HP 02 · INTERMEDIÁRIA · fonte: pp. 8');assert.equal(sections[1].type,'objective');assert.equal(sections[1].text[0],'Objetivo de aprendizagem: Distinguir acilação de pbps a partir do mecanismo e de suas implicações farmacológicas.');
});
test('uppercase learning objective heading on its own line includes the complete wrapped objective only',()=>{
 const sections=model.commentSections('HP 02 · DIFÍCIL · fonte: p. 8\nOBJETIVO DE APRENDIZAGEM\nDistinguir acilação de pbps a partir do mecanismo\ne de suas implicações farmacológicas.\nA) Correta: Explicação.\nB) Incorreta: Outra explicação.');
 const objective=sections.filter(s=>s.type==='objective');assert.equal(objective.length,1);assert.equal(objective[0].text.join(' '),'Objetivo de aprendizagem: Distinguir acilação de pbps a partir do mecanismo e de suas implicações farmacológicas.');assert.equal(sections.filter(s=>s.type==='alternative').length,2);
});
test('objective after a difficulty label gets its own bold section',()=>{
 const sections=model.commentSections('DIFÍCIL Objetivo: Diferenciar Neisseria mucosa.\n\nReferência da questão: Resumo Expandido, p. 18.\nA) INCORRETA\nExplicação.');assert.equal(sections[0].type,'plain');assert.equal(sections[0].text[0],'DIFÍCIL');assert.equal(sections[1].type,'objective');
});
test('approved feedback order is objective, correct explanation, then wrong alternatives with no duplicated answer',()=>{
 const sections=model.commentSections('Questão 001 · Resposta: D\nFonte: Resumo Expandido, p. 3\nObjetivo: Interpretar o cultivo.\nResposta: D | Resumo repetido.\nA) INCORRETA\nExplicação A.\nB) INCORRETA\nExplicação B.\nC) INCORRETA\nExplicação C.\nD) CORRETA\nExplicação D.');
 const result=model.feedbackModel(sections,'D');assert.equal(result.objective,'Interpretar o cultivo.');assert.equal(result.alternatives.map(a=>a.letter).join(''),'DABC');assert.equal(result.alternatives[0].text,'Explicação D.');assert(!JSON.stringify(result).includes('Resumo Expandido'));assert(!JSON.stringify(result).includes('Resumo repetido'));
});
test('general explanation supplies correct feedback in legacy comments without a correct-item section',()=>{
 const result=model.feedbackModel(model.commentSections('Resposta: B\n\nExplicação real do mecanismo.\n\nObjetivo: Explicar o mecanismo.\nA) Incorreta: A.\nC) Incorreta: C.\nD) Incorreta: D.'),'B');assert.equal(result.alternatives[0].text,'Explicação real do mecanismo.');assert.equal(result.alternatives.length,4);
});
test('species abbreviations and prose beginning with Resposta remain in their original alternative',()=>{
 const result=model.feedbackModel(model.commentSections('A) CORRETA\nB. cereus é móvel.\nB DISTRATOR\nC. diphtheriae não forma esporos.\nC) INCORRETA\nResposta prévia não demonstra deficiência.\nD) INCORRETA\nOutro mecanismo.'),'A');assert.equal(result.alternatives[0].text,'B. cereus é móvel.');assert.equal(result.alternatives[1].text,'C. diphtheriae não forma esporos.');assert.equal(result.alternatives[2].text,'Resposta prévia não demonstra deficiência.');
});
