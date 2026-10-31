import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('search ignores accents and case, requires every term and treats markup as literal text',()=>{
 const context={window:{},document:{querySelector:()=>null}};vm.runInNewContext(readFileSync('assets/pesquisa.js','utf8'),context);
 const {matches}=context.window.MedQuestSearchModel;
 assert.equal(matches({search:'Parasitologia Protozoários cavitários Entamoebas'},'PROTOZOARIOS parasitologia'),true);
 assert.equal(matches({search:'Microbiologia Biofilmes'},'biofilmes imunologia'),false);
 assert.equal(matches({search:'<img src=x>'},'<img'),true);
});
test('general search groups PDF versions, indexes named Hot Points and never returns question files',()=>{
 const context={window:{studyOpenSummarySubject:id=>opened.push(id)},document:{querySelector:()=>null}},opened=[];
 vm.runInNewContext(readFileSync('assets/pesquisa.js','utf8'),context);
 const {summaries,matches}=context.window.MedQuestSearchModel;
 const base={id:'expanded',tipo:'resumo',titulo:'Entamoebas',tema_id:'entamoebas',tema_nome:'Protozoários cavitários',disciplina_id:'parasitologia',resumo_grupo_id:'group',resumo_versao:'expandido'};
 const items=summaries([base,{...base,id:'simple',resumo_versao:'simplificado'},{...base,tipo:'questoes_pdf',id:'questions',resumo_grupo_id:'question-group'}],()=> 'Parasitologia',(_,hp)=>hp==='Hot Point 2'?'Ciclo biológico':'');
 assert.equal(items.length,1);assert.equal(matches(items[0],'ciclo biologico'),true);assert.equal(matches(items[0],'HP2'),true);assert.equal(matches(items[0],'Hot Point 5'),false);assert.match(items[0].label,/expandido e simplificado/);
 items[0].open();assert.deepEqual(opened,['expanded']);
 const source=readFileSync('assets/pesquisa.js','utf8');assert.equal(source.includes('q.enunciado'),false);assert.equal(source.includes('iniciarTema('),false);assert.equal(source.includes("from('estudo_documentos')"),false);
});
function catalogFixture(){
 let html='',nodes={},selected;
 const node=(extra={})=>({events:{},addEventListener(name,fn){this.events[name]=fn},focus(){},setSelectionRange(){},...extra});
 const el={style:{},get innerHTML(){return html},set innerHTML(value){html=value;nodes={};nodes['#mq-q-search']=node({value:value.match(/id="mq-q-search"[^>]*value="([^"]*)"/)?.[1]||'',selectionStart:0});for(const id of ['mq-q-apply','mq-q-clear','mq-q-reset-empty'])nodes['#'+id]=node();},querySelector(sel){return nodes[sel]||null},querySelectorAll(){return []}};
 const ctx={console,BANCO:{disciplinas:[{id:'imunologia',nome:'Imunologia',temas:[{id:'imunodeficiencias-primarias',nome:'Imunodeficiências Primárias',questoes:[{id:1,hotpoint:'Hot Point 1',enunciado:'Criança com pneumonias recorrentes',alternativas:[{texto:'Deficiência de BTK'}]},{id:2,hotpoint:'Hot Point 2',enunciado:'Adulto com infecção viral',alternativas:[]}]}]}]},document:{addEventListener(){},getElementById:id=>id==='mq-questoes-gerais'?el:null},esconderApp(){},setNavActive(){},fecharSidebar(){},scrollTo(){},iniciarTema(){},reiniciarTema(){},iniciarQuestoesFiltradas:rows=>selected=rows};ctx.window=ctx;
 vm.runInNewContext(readFileSync('assets/catalogo-questoes.js','utf8'),ctx);
 return {ctx,el,get nodes(){return nodes},get selected(){return selected}};
}
test('question search filters actual questions and starts only the matching selection; clear restores the catalog',async()=>{
 const f=catalogFixture();await f.ctx.abrirQuestoesGerais();
 const input=f.nodes['#mq-q-search'];input.value='pneumonias BTK';input.selectionStart=input.value.length;input.oninput({isComposing:false});
 assert.match(f.el.innerHTML,/1 de 2 questões/);assert.match(f.el.innerHTML,/value="pneumonias BTK"/);
 f.nodes['#mq-q-apply'].events.click();assert.equal(f.selected.length,1);assert.equal(f.selected[0].questao.id,1);assert.equal(f.selected[0].temaId,'imunodeficiencias-primarias');
 f.nodes['#mq-q-clear'].events.click();assert.match(f.el.innerHTML,/2 de 2 questões/);assert.equal(f.nodes['#mq-q-search'].value,'');
 const search=f.nodes['#mq-q-search'];search.value='nada corresponde';search.oninput({isComposing:false});assert.match(f.el.innerHTML,/Nenhuma questão corresponde/);assert.match(f.el.innerHTML,/id="mq-q-apply"[^>]* disabled/);
});
test('question search matches named Hot Points and ignores accents without mutating questions',()=>{
 const f=catalogFixture(),matches=f.ctx.MedQuestQuestionSearch.matches;
 const row={areaName:'Imunologia',temaName:'Deficiências',hotpoint:'Hot Point 1',hotpointTitle:'Investigação de imunodeficiências',questao:{id:7,enunciado:'Caso clínico',alternativas:[{texto:'Linfócitos B'}]}};
 const before=JSON.stringify(row);assert.equal(matches(row,'investigacao linfocitos'),true);assert.equal(matches(row,'parasita'),false);assert.equal(JSON.stringify(row),before);
});
test('Hot Point filter titles include the organism or subject and distinguish repeated headings',()=>{
 const f=catalogFixture(),title=f.ctx.MedQuestHotPoints.titulo;
 assert.equal(title('staphylococcus-sp','Hot Point 1'),'Fisiologia e estrutura — Staphylococcus sp.');
 assert.equal(title('micobacterias','Hot Point 1'),'Fisiologia e estrutura — Micobactérias');
 assert.notEqual(title('staphylococcus-sp','Hot Point 1'),title('micobacterias','Hot Point 1'));
 for(let n=1;n<=5;n++)assert.match(title('toxoplasma-gondii-e-toxoplasmose','Hot Point '+n),/Toxoplasma gondii e toxoplasmose/);
});
