import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

function element(){const classes=new Set();return {hidden:false,style:{},dataset:{},textContent:'',children:[],classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){if(on===undefined)on=!classes.has(x);on?classes.add(x):classes.delete(x)}},setAttribute(){},querySelector(){return null},replaceChildren(){this.children=[]},append(x){this.children.push(x)},focus(){},addEventListener(){}}}
const tick=()=>new Promise(setImmediate);
test('dismiss keeps counting, survives updates, reappears on leaving questions and can be reopened',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 get('tela-questao').style.display='block';get('mq-time-dock');
 const values=new Map(),now={value:Date.now()};class Clock extends Date{constructor(...args){super(...(args.length?args:[now.value]))}static now(){return now.value}}
 const context={console,requestAnimationFrame(){},Date:Clock,crypto:{randomUUID:()=> 'session'},usuarioAtual:{id:'student'},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},document:{getElementById:get,querySelector:()=>null},window:{addEventListener(){}},MutationObserver:class{observe(){}},setInterval(){}};
 vm.runInNewContext(await readFile(new URL('../assets/tempo-estudo.js',import.meta.url),'utf8'),context);
 const timer=context.window.MedQuestStudyTime;
 timer.refresh();assert.equal(get('mq-time-end').hidden,true);assert.equal(get('mq-time-label').hidden,true);
 timer.start({atividade:'questoes',titulo:'Prática'});assert.equal(get('mq-time-end').hidden,false);timer.pause();assert.equal(get('mq-time-end').hidden,false);timer.resume();timer.dismiss();assert.equal(get('mq-time-dock').hidden,true);
 now.value+=45000;timer.refresh();assert.equal(timer.seconds()>=45,true);assert.equal(get('mq-time-dock').hidden,true);
 const saved=JSON.parse(values.get('mq_timer_student'));assert.ok(saved.running);assert.equal(saved.segments.length,0);
 get('tela-questao').style.display='none';timer.refresh();assert.equal(get('mq-time-dock').hidden,false);
 get('tela-questao').style.display='block';timer.refresh();assert.equal(get('mq-time-dock').hidden,false);
 timer.dismiss();timer.toggle();assert.equal(get('mq-time-dock').hidden,false);assert.equal(timer.seconds()>=45,true);
 get('tela-questao').style.display='none';timer.refresh();timer.dismiss();timer.refresh();assert.equal(get('mq-time-dock').hidden,true);
 now.value+=15000;timer.refresh();assert.equal(timer.seconds()>=60,true);assert.equal(get('mq-time-dock').hidden,true);
 get('tela-estudo').style.display='block';timer.refresh();assert.equal(get('mq-time-dock').hidden,false);
 timer.dismiss();timer.refresh();assert.equal(get('mq-time-dock').hidden,true);timer.toggle();assert.equal(get('mq-time-dock').hidden,false);
});

async function noticeFixture(){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 const values=new Map(),rows={materiais_medquest:[{id:'pdf1'}],questoes_medquest:[{id:1,disciplina_id:'imuno',tema_id:'a'}]},queries=[];
 const context={console,Date,Set,JSON,usuarioAtual:{id:'student'},BANCO:{disciplinas:[{id:'imuno',temas:[{id:'a',questoes:[{id:1}]}]}]},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},document:{visibilityState:'visible',getElementById:get,createElement:element,addEventListener(){}},window:{addEventListener(){},MedQuestStudyUI:{toast(){}}},setInterval(){},navigator:{},db:{from(table){queries.push(table);let offset=0,end=999;const q={select(){return q},order(){return q},range(a,b){offset=a;end=b;return q},eq(){return q},then(resolve){resolve({data:rows[table].slice(offset,end+1)})}};return q}}};
 vm.runInNewContext(await readFile(new URL('../assets/notificacoes.js',import.meta.url),'utf8'),context);
 return {context,get,values,rows,queries,prefs:()=>JSON.parse(values.get('mq_content_notices_v1_student'))};
}
test('opt-in starts from actual baseline, detects new records once and counts remote/bundled questions once',async()=>{
 const f=await noticeFixture();assert.equal(f.queries.length,0);
 // Mount event handlers require the real mounting branch; evaluate a test-only handle
 // to the same private functions without altering their implementations.
 let source=await readFile(new URL('../assets/notificacoes.js',import.meta.url),'utf8');
 source=source.replace('window.MedQuestNotices={check:()=>check(true)};', 'window.MedQuestNotices={check:()=>check(true),choose,sync};');
 vm.runInNewContext(source,f.context);const api=f.context.window.MedQuestNotices;
 await api.choose('resumos',true);await api.choose('questoes',true);assert.equal(f.prefs().events.length,0);
 f.rows.materiais_medquest.push({id:'pdf2'});f.rows.questoes_medquest.push({id:2,disciplina_id:'imuno',tema_id:'a'});
 f.context.BANCO.disciplinas[0].temas[0].questoes.push({id:2});
 await api.check();assert.equal(f.prefs().events.length,1);assert.match(f.prefs().events[0].text,/1 novo\(s\) questão/);
 await api.check();assert.equal(f.prefs().events.length,1);
 await api.choose('resumos',false);await api.choose('questoes',false);const before=f.queries.length;await api.check();assert.equal(f.queries.length,before);
 f.context.usuarioAtual=null;api.sync();assert.equal(f.get('mq-notices').hidden,true);assert.equal(f.get('mq-notice-panel').hidden,true);
});
