import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

function element(){return {style:{},dataset:{},value:'',hidden:false,children:[],textContent:'',classList:{toggle(){}},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},add(){},addEventListener(){},querySelector(){return null}}}
test('Other Materials separates articles and AIM summaries from existing summaries and keeps student controls read-only',async()=>{
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 const tabs=['resumo','questoes_pdf','artigo','resumo_aim','admin'].map(type=>{const e=element();e.dataset.mqTab=type;return e});
 const records=[{id:'old',tipo:'resumo',titulo:'Microbiota',disciplina_id:'microbiologia',tema_id:'Microbiota'},{id:'article',tipo:'artigo',titulo:'Artigo de estudo',disciplina_id:'geral',tema_id:'AIM'},{id:'aim',tipo:'resumo_aim',titulo:'Revisão geral AIM',disciplina_id:'geral',tema_id:'AIM II'}];
 let active;
 const context={console,Option:function(){},usuarioAtual:{id:'student'},perfilAtual:{aprovado:true,admin:false},document:{getElementById:get,createElement:element,querySelectorAll:()=>tabs,addEventListener(){}},window:{esconderApp(){},mostrarTela(){}},esconderApp(){},fecharSidebar(){},setNavActive:id=>{active=id},db:{from(){return {select(){return this},order:async()=>({data:records})}}}};
 vm.runInNewContext(await readFile(new URL('../assets/medquest-acervo.js',import.meta.url),'utf8'),context);
 await context.window.abrirBiblioteca('outros');assert.equal(active,'nav-outros');assert.equal(get('mq-library-title').textContent,'Outros Materiais');
 assert.deepEqual(tabs.filter(t=>!t.hidden).map(t=>t.dataset.mqTab),['artigo','resumo_aim']);
 assert.equal(get('mq-list').children.length,1);assert.equal(get('mq-list').children[0].children[1].textContent,'Artigo de estudo');
 const buttons=get('mq-list').children[0].children[3].children;assert.deepEqual(buttons.map(b=>b.textContent),['Ler PDF','Baixar PDF']);
 tabs.find(t=>t.dataset.mqTab==='resumo_aim').onclick();assert.equal(get('mq-list').children[0].children[1].textContent,'Revisão geral AIM');
 await context.window.abrirBiblioteca('resumo');assert.equal(active,'nav-resumo');assert.equal(get('mq-list').children[0].children[1].textContent,'Microbiota');
});

test('daily message stays stable for a Brasília day and changes at midnight',async()=>{
 let now=Date.parse('2026-10-27T02:59:00Z'),refresh;const node={textContent:''};
 const context={Date:{now:()=>now},document:{getElementById:()=>node,addEventListener(){}},window:{addEventListener(){}},setInterval:fn=>{refresh=fn}};
 vm.runInNewContext(await readFile(new URL('../assets/frase-diaria.js',import.meta.url),'utf8'),context);
 const first=node.textContent;refresh();assert.equal(node.textContent,first);
 now=Date.parse('2026-10-27T03:00:00Z');refresh();assert.notEqual(node.textContent,first);
 const second=node.textContent;now+=23*3600000;refresh();assert.equal(node.textContent,second);
});
