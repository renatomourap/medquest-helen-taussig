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
