/* Optional, per-account notices. Reads use the student's existing RLS session.
   No push subscription is created: background delivery is not advertised. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const owner=()=>typeof usuarioAtual!=='undefined'?usuarioAtual?.id:null;
const storageKey=id=>'mq_content_notices_v1_'+id;
const blank=()=>({resumos:false,questoes:false,system:false,seen:null,events:[]});
let currentOwner=null,prefs=blank(),loading=false,lastCheck=0,problem='';
function save(){if(!currentOwner)return;try{localStorage.setItem(storageKey(currentOwner),JSON.stringify(prefs))}catch{problem='Não foi possível salvar a preferência neste navegador.'}}
function read(id){try{return {...blank(),...JSON.parse(localStorage.getItem(storageKey(id))||'null')}}catch{return blank()}}
async function ids(table,filter){
 const found=[];
 for(let offset=0;;offset+=1000){
  let q=db.from(table).select(table==='questoes_medquest'?'id,disciplina_id,tema_id':'id').order('id').range(offset,offset+999);
  if(filter)q=q.eq('tipo',filter);
  const r=await q;if(r.error)throw r.error;
  found.push(...(r.data||[]).map(x=>table==='questoes_medquest'?JSON.stringify([x.disciplina_id,x.tema_id,String(x.id)]):String(x.id)));
  if((r.data||[]).length<1000)return found;
 }
}
async function snapshot(){
 const [resumos,questoes]=await Promise.all([ids('materiais_medquest','resumo'),ids('questoes_medquest')]);
 // Include bundled questions as well as records published through the admin panel.
 const bundled=typeof BANCO==='undefined'?[]:BANCO.disciplinas.flatMap(d=>d.temas.flatMap(t=>t.questoes.map(q=>JSON.stringify([d.id,t.id,String(q.id)]))));
 return {resumos,questoes:[...new Set([...questoes,...bundled])]};
}
function additions(previous,next){return Object.fromEntries(['resumos','questoes'].map(k=>{const seen=new Set(previous?.[k]||[]);return [k,previous?next[k].filter(id=>!seen.has(id)).length:0]}))}
function render(){
 const badge=$('mq-notice-badge');if(badge){badge.hidden=!prefs.events.length;badge.textContent=String(prefs.events.length)}
 const status=$('mq-notice-status');if(status)status.textContent=problem||(loading?'Conferindo materiais…':prefs.resumos||prefs.questoes?'Avisos ativados neste navegador.':'Escolha os materiais sobre os quais quer receber avisos.');
 for(const kind of ['resumos','questoes']){const input=$('mq-notice-'+kind);if(input)input.checked=Boolean(prefs[kind])}
 const sys=$('mq-notice-system');if(sys)sys.textContent=prefs.system?'Desativar avisos do sistema':'Permitir avisos do sistema';
 const list=$('mq-notice-events');if(!list)return;list.replaceChildren();
 for(const event of prefs.events){const li=document.createElement('li');li.textContent=event.text+' · '+new Date(event.at).toLocaleDateString('pt-BR');list.append(li)}
 if(!prefs.events.length){const li=document.createElement('li');li.textContent='Nenhuma novidade desde a ativação.';list.append(li)}
}
async function check(force=false){
 if(!currentOwner||owner()!==currentOwner||loading||(!prefs.resumos&&!prefs.questoes)||(!force&&Date.now()-lastCheck<60000))return;
 loading=true;render();const account=currentOwner;
 try{
  const next=await snapshot();if(owner()!==account||currentOwner!==account)return;
  const delta=additions(prefs.seen,next),parts=[];
  for(const [kind,label] of [['resumos','resumo(s) em PDF'],['questoes','questão(ões)']])if(prefs[kind]&&delta[kind])parts.push(delta[kind]+' novo(s) '+label);
  if(parts.length){
   const text='Novos materiais disponíveis: '+parts.join(' e ')+'.';
   prefs.events.unshift({text,at:new Date().toISOString()});prefs.events=prefs.events.slice(0,20);
   window.MedQuestStudyUI?.toast(text);
   if(prefs.system&&'Notification' in window&&Notification.permission==='granted'){
    const registration=await navigator.serviceWorker?.getRegistration();
    if(owner()!==account)return;
    if(registration)try{await registration.showNotification('MedQuest — Novos materiais',{body:text,icon:'/assets/icons/medquest-192.png',tag:'medquest-content'})}catch{/* The in-app notice remains available if the OS refuses delivery. */}
   }
  }
  prefs.seen=next;problem='';lastCheck=Date.now();save();
 }catch{if(owner()===account)problem='Não foi possível conferir novidades. Tente novamente.'}
 finally{loading=false;render()}
}
async function choose(kind,enabled){
 if(loading){render();return}
 // Baseline first; existing materials never become invented "new" alerts.
 const account=currentOwner;const previously=prefs[kind];prefs[kind]=enabled;
 if(enabled){
  loading=true;render();
  try{const next=await snapshot();if(owner()!==account)return;prefs.seen={...(prefs.seen||next),[kind]:next[kind]};problem=''}
  catch{prefs[kind]=previously;problem='Não foi possível ativar os avisos. Tente novamente.'}
  finally{loading=false}
 }
 save();render();
}
async function system(){
 if(prefs.system){prefs.system=false;save();render();return}
 if(!('Notification' in window)){problem='Este navegador não permite avisos do sistema. Os avisos no sino continuam disponíveis.';render();return}
 const account=currentOwner;
 try{const permission=await Notification.requestPermission();if(owner()!==account)return;prefs.system=permission==='granted';problem=prefs.system?'': 'Permissão não concedida. Os avisos no sino continuam disponíveis.';save()}
 catch{problem='Avisos do sistema indisponíveis. Use o sino da plataforma.'}
 render();
}
function toggle(){const panel=$('mq-notice-panel');panel.hidden=!panel.hidden;$('mq-notice-button').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){render();check(true);$('mq-notice-resumos').focus()}}
function mount(){
 if($('mq-notices'))return;
 const parent=document.querySelector('.topbar-right');if(!parent)return;
 const root=document.createElement('div');root.id='mq-notices';
 root.innerHTML='<button type="button" id="mq-notice-button" class="topbar-notif" aria-label="Notificações de novos materiais" aria-expanded="false" aria-controls="mq-notice-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span id="mq-notice-badge" hidden></span></button><section id="mq-notice-panel" aria-label="Preferências de notificações" hidden><header><h2>Novos materiais</h2><button type="button" id="mq-notice-close" aria-label="Fechar notificações">×</button></header><p>Receber avisos quando forem adicionados:</p><label><input type="checkbox" id="mq-notice-resumos"> Resumos em PDF</label><label><input type="checkbox" id="mq-notice-questoes"> Questões</label><p id="mq-notice-status" role="status"></p><button type="button" id="mq-notice-system">Permitir avisos do sistema</button><small>Preferências por conta, neste navegador. Confira as novidades no sino ao acessar o MedQuest. Avisos do sistema funcionam com a plataforma aberta e permissão do navegador; não são enviados com o aplicativo fechado.</small><ul id="mq-notice-events"></ul><button type="button" id="mq-notice-clear">Marcar como lidas</button></section>';
 parent.prepend(root);$('mq-notice-button').onclick=toggle;$('mq-notice-close').onclick=()=>{toggle();$('mq-notice-button').focus()};
 for(const kind of ['resumos','questoes'])$('mq-notice-'+kind).onchange=e=>choose(kind,e.target.checked);
 $('mq-notice-system').onclick=system;
 $('mq-notice-clear').onclick=()=>{prefs.events=[];save();render()};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mq-notice-panel').hidden){toggle();$('mq-notice-button').focus()}});
 document.addEventListener('click',e=>{if(!root.contains(e.target)){$('mq-notice-panel').hidden=true;$('mq-notice-button').setAttribute('aria-expanded','false')}});
}
function sync(){
 mount();const account=owner();if(account!==currentOwner){currentOwner=account;prefs=account?read(account):blank();problem='';lastCheck=0;const panel=$('mq-notice-panel');if(panel)panel.hidden=true;render()}
 const root=$('mq-notices');if(root)root.hidden=!account;
 if(document.visibilityState!=='hidden')check();
}
window.MedQuestNotices={check:()=>check(true)};
document.addEventListener('visibilitychange',sync);window.addEventListener('focus',sync);sync();setInterval(sync,3000);
})();
