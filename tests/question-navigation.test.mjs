import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('assets/navegacao-questoes.js','utf8');
function model(){const ctx={window:{},document:{getElementById:()=>null}};vm.runInNewContext(source,ctx);return ctx.window.MedQuestQuestionNavModel}
const questions=()=>Array.from({length:100},(_,i)=>({id:i+1,hotpoint:'Hot Point '+(Math.floor(i/2)%5+1)}));
const session=()=>({disciplinaId:'microbiologia',temaId:'bastonetes',questoes:questions(),questaoIndex:0,respostas:{}});
test('100 questions occupy only five preview positions, including the end of the block',()=>{const api=model(),s=session();assert.deepEqual(Array.from(api.preview(s)),[0,1,2,3,4]);s.questaoIndex=50;assert.deepEqual(Array.from(api.preview(s)),[48,49,50,51,52]);s.questaoIndex=99;assert.deepEqual(Array.from(api.preview(s)),[95,96,97,98,99]);s.questoes=s.questoes.slice(0,3);s.questaoIndex=0;assert.deepEqual(Array.from(api.preview(s)),[0,1,2])});
test('map pages use ten consecutive question indices, with a short final page and bounded arrows',()=>{
 const api=model(),s=session();let p=api.page(s);assert.deepEqual(Array.from(p.indices),[0,1,2,3,4,5,6,7,8,9]);assert.equal(p.count,10);
 p=api.page(s,1);assert.equal(p.start,11);assert.equal(p.end,20);assert.equal(p.index,1);
 s.questoes=s.questoes.slice(0,23);p=api.page(s,99);assert.equal(p.start,21);assert.equal(p.end,23);assert.deepEqual(Array.from(p.indices),[20,21,22]);assert.equal(api.page(s,-3).index,0);
 s.questaoIndex=17;assert.equal(api.page(s).index,1);
 s.questoes=[];p=api.page(s);assert.equal(p.count,0);assert.equal(p.start,0);assert.equal(p.end,0);assert.equal(p.indices.length,0);
});
test('filtered topics and Hot Points do not split or reorder navigation pages',()=>{
 const api=model(),s={...session(),filtrada:true,questoes:questions().slice(0,12).map((q,i)=>({...q,__mqTemaId:i%2?'one':'two'}))};
 assert.deepEqual(Array.from(api.page(s,0).indices),[0,1,2,3,4,5,6,7,8,9]);assert.deepEqual(Array.from(api.page(s,1).indices),[10,11]);
});
test('colors derive from actual saved answers; recovery and errors never imply unanswered status',()=>{const api=model(),s=session();s.respostas={1:{acertou:true},2:{acertou:false}};assert.equal(api.status(s,0),'pending');assert.equal(api.status(s,1),'correct');assert.equal(api.status(s,2),'incorrect');s.carregandoRespostas=true;assert.equal(api.status(s,1),'unknown');assert.equal(api.nextPending(s),-1);s.carregandoRespostas=false;s.erroRespostas=true;assert.equal(api.status(s,0),'unknown');assert.equal(api.nextPending(s),-1)});
test('next pending wraps, returns current only when necessary, and disables when complete',()=>{const api=model(),s={...session(),questoes:questions().slice(0,3),questaoIndex:2,respostas:{2:{acertou:true}}};assert.equal(api.nextPending(s),0);s.respostas[0]={acertou:false};assert.equal(api.nextPending(s),1);s.respostas[1]={acertou:true};assert.equal(api.nextPending(s),-1);delete s.respostas[2];assert.equal(api.nextPending(s),2)});
test('navigation model never changes questions, answers, or current index',()=>{const api=model(),s=session(),before=JSON.stringify(s);api.page(s);api.preview(s);api.status(s,0);api.nextPending(s);assert.equal(JSON.stringify(s),before)});
function fixture(){
 const nodes=new Map(),documentEvents={},windowEvents={};let ctx;
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.events={};this.hidden=false;this.value='';}
  set innerHTML(value){this.children=[];for(const match of value.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const child=new Element(match[1]);child.id=match[2];child.parent=this;this.children.push(child);nodes.set(child.id,child)}}
  append(...children){children.forEach(child=>{child.parent=this;this.children.push(child);if(child.id)nodes.set(child.id,child)})}
  replaceChildren(...children){this.children=[];this.append(...children)}
  setAttribute(k,v){this.attributes[k]=v}
  getAttribute(k){return this.attributes[k]}
  addEventListener(k,fn){this.events[k]=fn}
  dispatchEvent(event){this['on'+event.type]?.(event);this.events[event.type]?.(event)}
  querySelectorAll(tag){return this.children.filter(child=>child.tagName===tag)}
  contains(target){return this===target||this.children.some(child=>child.contains(target))}
  closest(){return null}
  focus(){ctx.document.activeElement=this}
  getBoundingClientRect(){return {left:600,right:700,bottom:150,width:100}}
 }
 const host=new Element();host.id='miniaturas';nodes.set(host.id,host);const state=session();state.respostas={1:{acertou:true},10:{acertou:false}};
 ctx={estadoAtual:state,BANCO:{disciplinas:[]},Event:class{constructor(type){this.type=type}},document:{activeElement:null,body:new Element('body'),getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag),addEventListener:(name,fn)=>documentEvents[name]=fn},innerWidth:1024,innerHeight:768,addEventListener:(name,fn)=>windowEvents[name]=fn,mostrarTela(){},esconderApp(){},renderQuestao(index){ctx.estadoAtual.questaoIndex=index;ctx.MedQuestQuestionNav.refresh()},navegarQuestao(delta){ctx.renderQuestao(ctx.estadoAtual.questaoIndex+delta)}};ctx.window=ctx;
 vm.runInNewContext(source,ctx);ctx.MedQuestQuestionNav.reset();return {ctx,nodes,documentEvents,api:ctx.MedQuestQuestionNav};
}
test('map arrows change only the ten displayed numbers and selecting a number opens its question',()=>{
 const f=fixture(),map=f.nodes.get('mq-question-map'),grid=f.nodes.get('mq-question-map-grid'),before=JSON.stringify(f.ctx.estadoAtual.respostas);
 assert.equal(map.hidden,true);assert.equal(f.nodes.get('mq-question-preview').children.length,5);
 f.nodes.get('mq-question-map-trigger').onclick();assert.equal(map.hidden,false);assert.equal(grid.children.length,10);assert.match(f.nodes.get('mq-question-map-range').textContent,/1–10 de 100/);
 assert.equal(f.nodes.get('mq-question-map-prev').disabled,true);assert.match(grid.children[1].className,/is-correct/);
 f.nodes.get('mq-question-map-next').onclick();assert.equal(f.ctx.estadoAtual.questaoIndex,0);assert.equal(map.hidden,false);assert.match(f.nodes.get('mq-question-map-range').textContent,/11–20 de 100/);assert.match(grid.children[0].className,/is-incorrect/);
 grid.children[0].onclick();assert.equal(f.ctx.estadoAtual.questaoIndex,10);assert.equal(map.hidden,true);assert.equal(JSON.stringify(f.ctx.estadoAtual.respostas),before);
 f.api.open();assert.match(f.nodes.get('mq-question-map-range').textContent,/11–20 de 100/);
});
test('last map page disables forward navigation and previous arrow returns to preceding numbers',()=>{
 const f=fixture();f.ctx.estadoAtual.questoes=f.ctx.estadoAtual.questoes.slice(0,23);f.ctx.estadoAtual.questaoIndex=22;f.api.open();const grid=f.nodes.get('mq-question-map-grid');
 assert.equal(grid.children.length,3);assert.match(f.nodes.get('mq-question-map-range').textContent,/21–23 de 23/);assert.equal(f.nodes.get('mq-question-map-next').disabled,true);
 f.nodes.get('mq-question-map-next').onclick();assert.equal(grid.children.length,3);
 f.nodes.get('mq-question-map-prev').onclick();assert.equal(grid.children.length,10);assert.match(f.nodes.get('mq-question-map-range').textContent,/11–20 de 23/);assert.equal(f.ctx.estadoAtual.questaoIndex,22);
});
test('pending action uses real session responses and leaving the question screen closes the floating map',()=>{
 const f=fixture();f.api.open();f.nodes.get('mq-question-map-pending').onclick();assert.equal(f.ctx.estadoAtual.questaoIndex,2);assert.equal(f.nodes.get('mq-question-map').hidden,true);
 f.api.open();f.ctx.mostrarTela('dashboard');assert.equal(f.nodes.get('mq-question-map').hidden,true);
 f.ctx.estadoAtual.carregandoRespostas=true;f.api.open();assert.equal(f.nodes.get('mq-question-map-pending').disabled,true);assert.match(f.nodes.get('mq-question-map-status').textContent,/Recuperando/);
});
