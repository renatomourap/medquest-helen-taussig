import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../assets/resumos-versoes.js',import.meta.url),'utf8');
const base={id:'expanded',resumo_grupo_id:'group',resumo_versao:'expandido',tipo:'resumo',titulo:'Entamoebas',disciplina_id:'parasitologia',tema_id:'entamoebas',tema_nome:'Entamoebas',arquivo_path:'private/original.pdf'};
const simple={...base,id:'simple',resumo_versao:'simplificado',arquivo_path:'private/simple.pdf'};
const text={id:'legacy',titulo:'Entamoebas',area_id:'parasitologia',assunto:'Entamoebas',publicado:true};
function fixture({admin=true,saveError=false,conflict=false}={}){
 const events=[],ctx={perfilAtual:{admin},crypto:{randomUUID:()=> 'new-file'},window:{},console};ctx.window=ctx;
 ctx.db={storage:{from(){return {upload:async(path,file,options)=>{events.push({action:'upload',path,file,options});return {}},remove:async paths=>{events.push({action:'remove',paths:Array.from(paths)});return {}}}}},from(){
  const request={update(data){events.push({action:'update',data});return request},insert(data){events.push({action:'insert',data});return request},eq(key,value){events.push({action:'eq',key,value});return request},select:async()=>saveError?{error:Error('Database refused')}:{data:conflict?[]:[{id:'saved'}]}};return request;
 }};
 vm.runInNewContext(source,ctx);return {api:ctx.MedQuestSummaryVersions,events};
}
test('two original PDF versions and legacy metadata produce exactly one subject',()=>{const {api}=fixture();const model=api.model([base,simple],[text]);assert.equal(model.length,1);assert.equal(model[0].files.expandido.id,'expanded');assert.equal(model[0].files.simplificado.id,'simple');assert.equal(model[0].officialId,'legacy')});
test('student gets separate file actions and no administration; unavailable version has no functional action',()=>{const {api}=fixture();const html=api.render({pdfs:[base],texts:[text],canEdit:false});assert.equal((html.match(/class="mq-summary-topic"/g)||[]).length,1);assert.equal((html.match(/class="mq-summary-version"/g)||[]).length,2);assert.match(html,/studyOfficialPdf\('expanded'\)/);assert.match(html,/studyOfficialDownload\('expanded'\)/);assert.match(html,/Ainda não disponível/);assert.equal(html.includes('Gerenciar'),false);assert.equal(html.includes('Publicar PDF'),false);assert.equal(html.includes("studyOfficialPdf('simple')"),false)});
test('admin has publish for missing version and replacement, editing and deletion for the published one',()=>{const {api}=fixture();const html=api.render({pdfs:[base],texts:[text],canEdit:true});for(const label of ['Substituir PDF','Editar identificação','Excluir arquivo','Publicar PDF'])assert.ok(html.includes(label))});
test('accent-insensitive search and discipline filters do not create duplicate topics',()=>{const {api}=fixture();const args={pdfs:[base,simple],texts:[text],chosen:'parasitologia',query:'entamoebas'};assert.match(api.render(args),/Entamoebas/);assert.match(api.render({...args,chosen:'imunologia'}),/Nenhum resumo/)});
test('publishing simplified PDF sends the original file object and preserves the group and canonical topic',async()=>{const {api,events}=fixture();const group=api.model([base],[text])[0],file={size:1024,type:'application/pdf',name:'Original simplificado.pdf'};await api.upload(group,'simplificado',file);assert.equal(events[0].file,file);assert.equal(events[0].options.upsert,false);const insert=events.find(e=>e.action==='insert').data;assert.equal(insert.resumo_versao,'simplificado');assert.equal(insert.resumo_grupo_id,'group');assert.equal(insert.tema_id,'entamoebas');assert.equal(events.some(e=>e.action==='remove'),false)});
test('replacement updates only the selected file and removes the old bytes only after the new path is confirmed',async()=>{const {api,events}=fixture();await api.upload(api.model([base,simple],[text])[0],'simplificado',{size:10,type:'application/pdf',name:'New.pdf'},simple);assert.equal(events.find(e=>e.action==='eq'&&e.key==='id').value,'simple');assert.deepEqual(events.at(-1).paths,['private/simple.pdf']);assert.equal(events.some(e=>e.paths?.includes('private/original.pdf')),false)});
for(const mode of ['saveError','conflict'])test('failed replacement preserves both existing originals: '+mode,async()=>{const {api,events}=fixture({[mode]:true});await assert.rejects(api.upload(api.model([base,simple],[text])[0],'simplificado',{size:10,type:'application/pdf',name:'New.pdf'},simple));const removed=events.find(e=>e.action==='remove').paths;assert.equal(removed.length,1);assert.match(removed[0],/new-file.pdf/);assert.equal(removed.includes(simple.arquivo_path),false)});
test('students and invalid files cannot initiate an upload',async()=>{const f=fixture({admin:false});await assert.rejects(f.api.upload({},'simplificado',{size:10,type:'application/pdf'}));assert.equal(f.events.length,0);const a=fixture();await assert.rejects(a.api.upload({},'simplificado',{size:10,type:'text/plain',name:'bad.txt'}));assert.equal(a.events.length,0)});

test('all subjects retain summary versions and empty lecture categories stay hidden',()=>{
 const {api}=fixture();
 const cohort={microbiologia:['Streptococcus e Enterococcus','Bastonetes Gram-positivos','Bastonetes Gram-negativos','Neisseria sp.','Enterobacteriaceae','Micobactérias','Mycoplasma e Chlamydia','Treponema e Leptospira'],farmacologia:['Antimicobacterianos'],parasitologia:['Protozoários cavitários: Entamoebas','Giardia e Trichomonas','Toxoplasma gondii e Toxoplasmose']};
 let count=0;
 for(const [area,titles] of Object.entries(cohort))for(const title of titles){
  const html=api.render({pdfs:[{...base,titulo:title,tema_id:title,tema_nome:title,disciplina_id:area}],texts:[]});
  assert.doesNotMatch(html,/Materiais da aula|Slides da aula|Capítulos de referência|mq-material-section-title/);assert.match(html,/Resumo expandido/);assert.match(html,/Resumo simplificado/);count++;
 }
 assert.equal(count,12);
 for(const [area,title] of [['microbiologia','Biofilmes Bacterianos'],['microbiologia','Microbiota Humana'],['microbiologia','Staphylococcus sp.'],['farmacologia','Antibióticos I — Beta-lactâmicos'],['imunologia','Distúrbios de Hipersensibilidade'],['parasitologia','Introdução à Parasitologia'],['parasitologia','Artrópodes, Vetores e Parasitas'],['microbiologia','Novo assunto']]){
  const html=api.render({pdfs:[{...base,titulo:title,tema_id:title,tema_nome:title,disciplina_id:area}],texts:[],canEdit:true});
  assert.doesNotMatch(html,/Materiais da aula|Slides da aula|Capítulos de referência/,title);
  assert.match(html,/mq-summary-topic/,title);assert.match(html,/Resumo expandido/,title);assert.match(html,/Resumo simplificado/,title);
  assert.equal((html.match(/class="mq-summary-version"/g)||[]).length,2);
  assert.match(html,/studyOfficialPdf\('expanded'\)/);assert.match(html,/studyOfficialDownload\('expanded'\)/);assert.match(html,/studyEditPdfMetadata/);
 }
});

test('lecture files keep both summaries and multiple references under one subject, with independent original file actions',()=>{
 const {api}=fixture();const pdfs=[base,simple,{...base,id:'slide',tipo:'slide',titulo:'Slides da aula'},{...base,id:'murray',tipo:'capitulo',titulo:'Murray — Capítulo 19'},{...base,id:'levinson',tipo:'capitulo',titulo:'Levinson — Capítulo 15'}];
 const original=JSON.stringify(pdfs),model=api.model(pdfs,[text]);assert.equal(model.length,1);assert.equal(model[0].files.expandido.id,'expanded');assert.equal(model[0].files.simplificado.id,'simple');assert.equal(model[0].materials.length,3);
 const html=api.render({pdfs,texts:[text],canEdit:false});assert.equal((html.match(/class="mq-summary-topic"/g)||[]).length,1);
 for(const id of ['expanded','simple','slide','murray','levinson']){assert.ok(html.includes("studyOfficialPdf('"+id+"')"));assert.ok(html.includes("studyOfficialDownload('"+id+"')"));}
 assert.doesNotMatch(html,/Em breve|Gerenciar|Adicionar PDF/);assert.equal(JSON.stringify(pdfs),original);
 const admin=api.render({pdfs,texts:[text],canEdit:true});assert.match(admin,/Adicionar PDF/);for(const id of ['slide','murray','levinson'])assert.ok(admin.includes("studyDeletePdf('"+id+"')"));
});
test('lecture publication accepts multiple chapters without replacing a summary version; student cannot publish',async()=>{
 const {api,events}=fixture();const g=api.model([base,simple],[text])[0],file={size:100,type:'application/pdf',name:'Capítulo 19.pdf'};
 await api.upload(g,'capitulo',file);const saved=events.find(e=>e.action==='insert').data;assert.equal(saved.tipo,'capitulo');assert.equal(saved.titulo,'Capítulo 19');assert.equal(saved.resumo_grupo_id,'group');assert.equal(events.some(e=>e.action==='update'||e.action==='remove'),false);
 const student=fixture({admin:false});await assert.rejects(student.api.upload(g,'slide',file));assert.equal(student.events.length,0);
});

 test('Micobacteria hides only redundant headings and slide slot; other subjects keep current layout',()=>{
 const {api}=fixture();const pdfs=[{...base,disciplina_id:'microbiologia',tema_id:'micobacterias',titulo:'Micobactérias',tema_nome:'Micobactérias'}, {...simple,disciplina_id:'microbiologia',tema_id:'micobacterias',titulo:'Micobactérias',tema_nome:'Micobactérias'}];
 for(const canEdit of [false,true]){const html=api.render({pdfs,texts:[],canEdit});assert.doesNotMatch(html,/Slides da aula|Materiais da aula|class="mq-material-section-title"/);assert.match(html,/Resumo expandido/);assert.match(html,/Resumo simplificado/);assert.doesNotMatch(html,/Capítulos de referência/);assert.match(html,/studyOfficialPdf\('expanded'\)/);}
 const other=api.render({pdfs:[base,simple],texts:[]});assert.doesNotMatch(other,/Materiais da aula|Slides da aula|>Resumos<\/h3>/);
 });

test('Treponema and Leptospira has no slide slot; summaries and reference chapters remain',()=>{
 const {api}=fixture();const pdfs=[{...base,disciplina_id:'microbiologia',tema_id:'treponema-sp-e-leptospira-sp',titulo:'Treponema sp. e Leptospira sp.',tema_nome:'Treponema sp. e Leptospira sp.'}];
 for(const canEdit of [false,true]){const html=api.render({pdfs,texts:[],canEdit});assert.doesNotMatch(html,/Slides da aula/);for(const label of ['Resumo expandido','Resumo simplificado'])assert.ok(html.includes(label));assert.match(html,/studyOfficialPdf\('expanded'\)/);}
});

test('one reference PDF is shared across subjects without changing file identity or duplicating cards',()=>{
 const {api}=fixture();const first={...base,id:'first-summary',resumo_grupo_id:'first'},second={...base,id:'second-summary',resumo_grupo_id:'second',tema_id:'giardia-e-trichomonas',titulo:'Giardia e Trichomonas',tema_nome:'Giardia e Trichomonas'};
 const chapter={...base,id:'shared-rey',tipo:'capitulo',titulo:'Rey — Capítulos 11 e 12',resumo_grupo_id:'first'},links=[{material_id:'shared-rey',disciplina_id:'parasitologia',tema_id:second.tema_id,tema_nome:second.tema_nome,resumo_grupo_id:'second'}];
 const pdfs=[first,second,chapter],before=JSON.stringify(pdfs),model=api.model(pdfs,[],false,[...links,...links]);assert.equal(model.length,2);for(const g of model){assert.equal(g.materials.length,1);assert.equal(g.materials[0].id,'shared-rey');assert.equal(g.materials[0].arquivo_path,chapter.arquivo_path);}
 const html=api.render({pdfs,texts:[],topicLinks:links});assert.equal((html.match(/studyOfficialPdf\('shared-rey'\)/g)||[]).length,2);assert.equal((html.match(/studyOfficialDownload\('shared-rey'\)/g)||[]).length,2);assert.equal(JSON.stringify(pdfs),before);
 const missing=api.model([first,second],[],false,links);assert.ok(missing.every(g=>!g.materials));
});

test('all topics show only populated lecture categories, without redundant section headings; admin can add missing files',()=>{
 const {api}=fixture();for(const canEdit of [false,true])for(const kinds of [[],['slide'],['capitulo'],['slide','capitulo']]){
 const pdfs=[base,simple,...kinds.map(kind=>({...base,id:kind,tipo:kind,titulo:'Arquivo '+kind}))];const html=api.render({pdfs,texts:[],canEdit});assert.doesNotMatch(html,/Materiais da aula|>Resumos<\/h3>|Em breve|mq-material-section-title/);
 for(const [kind,label] of [['slide','Slides da aula'],['capitulo','Capítulos de referência']]){assert.equal(html.includes(label),kinds.includes(kind));if(kinds.includes(kind)){assert.ok(html.includes("studyOfficialPdf('"+kind+"')"));assert.ok(html.includes("studyOfficialDownload('"+kind+"')"));}else if(canEdit){assert.ok(html.includes(kind==='slide'?'Adicionar slide':'Adicionar capítulo'));}}
 assert.match(html,/Resumo expandido/);assert.match(html,/Resumo simplificado/);
 }
});

test('slides and references stay inside their own category container with all original actions',()=>{
 const {api}=fixture();const pdfs=[base,simple,{...base,id:'giardia-slide',tipo:'slide',titulo:'Giardia'},{...base,id:'trichomonas-slide',tipo:'slide',titulo:'Trichomonas'},{...base,id:'rey30',tipo:'capitulo',titulo:'Rey — Capítulo 30'},{...base,id:'rey11',tipo:'capitulo',titulo:'Rey — Capítulos 11 e 12'}];
 for(const canEdit of [false,true]){const html=api.render({pdfs,texts:[],canEdit});assert.equal((html.match(/class="mq-lecture-group"/g)||[]).length,2);const slides=html.indexOf('aria-label="Slides da aula"'),chapters=html.indexOf('aria-label="Capítulos de referência"');for(const id of ['giardia-slide','trichomonas-slide']){const pos=html.indexOf("studyOfficialPdf('"+id+"')");assert.ok(pos>slides&&pos<chapters);}for(const id of ['rey30','rey11'])assert.ok(html.indexOf("studyOfficialPdf('"+id+"')")>chapters);for(const p of pdfs)assert.ok(html.includes("studyOfficialDownload('"+p.id+"')"));assert.equal((html.match(/class="mq-summary-topic"/g)||[]).length,1);}
});
