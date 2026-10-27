/* Admin-only metadata editing. The server RPC checks admin status and RLS;
   original PDF bytes and stable topic IDs are never changed by this editor. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const admin=()=>typeof perfilAtual!=='undefined'&&perfilAtual?.admin===true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let release=null,busy=false,version=0;
function close(){if(busy)return;version++;release?.();release=null;$('mq-material-editor')?.remove()}
async function open({id,officialId=null,onSaved}={}){
 if(!admin()||busy)return;
 close();const request=++version;
 try{
  const result=await db.from('materiais_medquest').select('id,tipo,titulo,disciplina_id,tema_id,tema_nome').eq('id',id).single();
  if(result.error)throw result.error;
  if(request!==version||!admin())return;
  const item=result.data;if(!item)throw Error('Material não encontrado.');
  if(!officialId&&item.tipo==='resumo'){
   const linked=await db.from('conteudos_oficiais').select('id,titulo,assunto').eq('area_id',item.disciplina_id);if(linked.error)throw linked.error;
   const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   officialId=linked.data?.find(d=>norm(d.assunto)===norm(item.tema_id)||norm(d.titulo)===norm(item.titulo))?.id||null;
   if(request!==version||!admin())return;
  }
  const areas=typeof BANCO==='undefined'?[]:BANCO.disciplinas.map(d=>[d.id,d.nome]);
  areas.push(['geral','Geral / interdisciplinar']);
  if(!areas.some(a=>a[0]===item.disciplina_id))areas.push([item.disciplina_id,item.disciplina_id]);
  const topic=item.tema_nome||(typeof BANCO==='undefined'?null:BANCO.disciplinas.find(d=>d.id===item.disciplina_id)?.temas.find(t=>t.id===item.tema_id)?.nome)||item.tema_id;
  const overlay=document.createElement('div');overlay.id='mq-material-editor';overlay.className='mq-study-dialog';
  overlay.innerHTML='<section class="mq-study-dialog-card" role="dialog" aria-modal="true" aria-labelledby="mq-material-title"><header><h2 id="mq-material-title">Editar identificação do material</h2><button type="button" data-close aria-label="Fechar">×</button></header><form id="mq-material-form"><label>Título<input name="titulo" required minlength="2" maxlength="160" value="'+esc(item.titulo)+'"></label><label>Disciplina<select name="disciplina_id">'+areas.map(([value,label])=>'<option value="'+esc(value)+'"'+(value===item.disciplina_id?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label><label>Assunto<input name="tema_nome" required minlength="2" maxlength="160" value="'+esc(topic)+'"></label><p>Edite os nomes apresentados na biblioteca. O arquivo PDF original e os vínculos das questões serão preservados.</p><p id="mq-material-error" role="alert"></p><footer><button type="button" data-close>Cancelar</button><button class="mq-study-gold" type="submit">Salvar alterações</button></footer></form></section>';
  document.body.append(overlay);overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  release=window.MedQuestStudyUI?.bindModal(overlay,close)||null;
  const form=$('mq-material-form');form.elements.titulo.focus();
  form.onsubmit=async event=>{
   event.preventDefault();if(busy||!admin())return;
   const titulo=form.elements.titulo.value.trim(),disciplina=form.elements.disciplina_id.value,assunto=form.elements.tema_nome.value.trim();
   if(titulo.length<2||assunto.length<2){$('mq-material-error').textContent='Preencha título e assunto com pelo menos dois caracteres.';return}
   busy=true;const buttons=overlay.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);$('mq-material-error').textContent='';
   try{
    const saved=await db.rpc('editar_metadados_material',{p_material_id:id,p_titulo:titulo,p_disciplina_id:disciplina,p_tema_nome:assunto,p_conteudo_id:officialId});
    if(saved.error)throw saved.error;
    if(!saved.data)throw Error('O banco não confirmou a alteração.');
    busy=false;close();window.MedQuestStudyUI?.toast('Identificação do material atualizada.');await onSaved?.();
   }catch(error){busy=false;buttons.forEach(b=>b.disabled=false);const box=$('mq-material-error');if(box)box.textContent=error.message||'Não foi possível salvar.';}
  };
 }catch(error){if(request===version)alert(error.message||'Não foi possível abrir a edição.');}
}
window.MedQuestMaterialEditor={open,close};
})();
