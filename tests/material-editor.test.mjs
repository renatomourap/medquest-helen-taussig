import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/material-editor.js',import.meta.url),'utf8');
function fixture(isAdmin=true,rpcError=null){
 const elements=new Map(),buttons=[{},{}],requests=[],item={id:'pdf',tipo:'resumo',titulo:'Original',disciplina_id:'parasitologia',tema_id:'stable-topic',tema_nome:'Assunto original'};
 const form={elements:{titulo:{value:'Título corrigido',focus(){}},disciplina_id:{value:'parasitologia'},tema_nome:{value:'Assunto corrigido'}}};elements.set('mq-material-form',form);elements.set('mq-material-error',{textContent:''});
 const context={perfilAtual:{admin:isAdmin},BANCO:{disciplinas:[{id:'parasitologia',nome:'Parasitologia',temas:[]}]},alert(){},document:{getElementById:id=>elements.get(id),createElement:()=>({querySelectorAll:()=>buttons,remove(){elements.delete('mq-material-editor')}}),body:{append(el){elements.set(el.id,el)}}},window:{MedQuestStudyUI:{bindModal(){return ()=>{}},toast(){}}},db:{from(table){requests.push(table);const q={select(){return q},eq(){return q},single:async()=>({data:item}),then(resolve){resolve({data:[{id:'official',titulo:'Original',assunto:'stable-topic'}]})}};return q},rpc:async(name,args)=>{requests.push({name,args});return rpcError?{error:{message:rpcError}}:{data:'pdf'}}}};
 vm.runInNewContext(source,context);return {context,requests,elements,form,api:context.window.MedQuestMaterialEditor};
}
test('student cannot open the metadata editor or initiate any database operation',async()=>{const f=fixture(false);await f.api.open({id:'pdf'});assert.equal(f.requests.length,0);assert.equal(f.elements.has('mq-material-editor'),false)});
test('admin save updates human labels and linked summary without changing canonical topic or file path',async()=>{const f=fixture();let refreshed=0;await f.api.open({id:'pdf',onSaved:()=>refreshed++});await f.form.onsubmit({preventDefault(){}});const rpc=f.requests.find(r=>typeof r==='object');assert.equal(rpc.name,'editar_metadados_material');assert.equal(rpc.args.p_tema_nome,'Assunto corrigido');assert.equal(rpc.args.p_conteudo_id,'official');assert.equal('arquivo_path' in rpc.args,false);assert.equal('tema_id' in rpc.args,false);assert.equal(refreshed,1);assert.equal(f.elements.has('mq-material-editor'),false)});
test('server permission errors remain visible and do not claim a successful edit',async()=>{const f=fixture(true,'Acesso negado');let refreshed=0;await f.api.open({id:'pdf',onSaved:()=>refreshed++});await f.form.onsubmit({preventDefault(){}});assert.equal(f.elements.get('mq-material-error').textContent,'Acesso negado');assert.equal(refreshed,0);assert.equal(f.elements.has('mq-material-editor'),true)});
test('summary cards use the human subject label and expose editing only to admins',async()=>{
 const module=await readFile(new URL('../assets/estudo-modulos.js',import.meta.url),'utf8');
 for(const admin of [false,true]){
  const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',style:{}});return nodes.get(id)};
  const context={console,perfilAtual:{admin},BANCO:{disciplinas:[{id:'parasitologia',nome:'Parasitologia'}]},window:{},document:{getElementById:get}};
  context.window=context;
  const instrumented=module.replace(/\}\)\(\);\s*$/, "window.paintFixture=items=>{officialPdfs=items;officialTexts=[];paintOfficial()};})();");
  vm.runInNewContext(instrumented,context);
  context.window.paintFixture([{id:'pdf',titulo:'Protozoários cavitários: Entamoebas',disciplina_id:'parasitologia',tema_id:'protozoarios-cavitarios-entamoebas',tema_nome:'Protozoários cavitários: Entamoebas'}]);
  const html=get('study-list').innerHTML;assert.match(html,/Parasitologia · Protozoários cavitários: Entamoebas/);assert.equal(html.includes(' · protozoarios-cavitarios-entamoebas'),false);assert.equal(html.includes('Editar identificação'),admin);
 }
});
