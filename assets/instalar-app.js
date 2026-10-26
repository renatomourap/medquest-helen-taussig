/* Installable MedQuest, online-only. Installation is always initiated by the user. */
(()=>{
'use strict';
let deferred=null,installed=false,dialog=null;
const display=window.matchMedia('(display-mode: standalone)');
const standalone=()=>installed||display.matches||window.navigator.standalone===true;
function refresh(){document.querySelectorAll('[data-mq-install]').forEach(b=>b.hidden=standalone())}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;refresh()});
window.addEventListener('appinstalled',()=>{installed=true;deferred=null;close();refresh()});
display.addEventListener?.('change',refresh);
function close(){if(!dialog)return;const origin=dialog._origin;dialog.remove();dialog=null;origin?.focus()}
async function install(){
 if(standalone())return;
 if(deferred){const prompt=deferred;deferred=null;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')close();}catch{guide()}return}
 guide();
}
function guide(){
 if(dialog){dialog.querySelector('button').focus();return}
 const origin=document.activeElement;
 dialog=document.createElement('div');dialog.className='mq-install-overlay';dialog._origin=origin;
 const card=document.createElement('section');card.className='mq-install-card';card.role='dialog';card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','mq-install-title');
 const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),android=/Android/i.test(navigator.userAgent);
 const steps=apple?['Abra este endereço no Safari.','Toque em Compartilhar e em “Adicionar à Tela de Início”.','Mantenha “Abrir como App” ativado, se aparecer, e toque em Adicionar.']:android?['Abra este endereço no Chrome ou no navegador Samsung Internet.','No menu ⋮, escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.','Confirme a instalação e abra pelo ícone MedQuest.']:['Abra o MedQuest no Chrome, Edge ou Safari.','No Chrome ou Edge, use o ícone de instalação na barra de endereço ou a opção de instalar no menu. No Safari do Mac, escolha Arquivo → Adicionar ao Dock.','Abra o MedQuest pelo ícone criado no seu dispositivo.'];
 const head=document.createElement('header'),title=document.createElement('h2'),exit=document.createElement('button');title.id='mq-install-title';title.textContent='MedQuest no seu dispositivo';exit.type='button';exit.textContent='×';exit.setAttribute('aria-label','Fechar instruções de instalação');exit.onclick=close;head.append(title,exit);
 const image=document.createElement('img');image.src='/assets/icons/medquest-192.png';image.alt='';image.width=64;image.height=64;
 const description=document.createElement('p');description.textContent='Acesse pelo ícone da tela inicial, em uma janela própria.';
 const list=document.createElement('ol');for(const text of steps){const li=document.createElement('li');li.textContent=text;list.append(li)}
 const note=document.createElement('p');note.className='mq-install-note';note.textContent='Conexão com a internet necessária. A instalação mantém o mesmo MedQuest e a mesma conta.';
 const done=document.createElement('button');done.type='button';done.className='mq-install-done';done.textContent='Entendi';done.onclick=close;
 card.append(head,image,description,list,note,done);dialog.append(card);document.body.append(dialog);exit.focus();
 dialog.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){if(e.shiftKey&&document.activeElement===exit){e.preventDefault();done.focus()}else if(!e.shiftKey&&document.activeElement===done){e.preventDefault();exit.focus()}}};
 dialog.onclick=e=>{if(e.target===dialog)close()};
}
function mount(){
 const nav=document.querySelector('.sidebar-nav');
 if(nav){const b=document.createElement('button');b.type='button';b.dataset.mqInstall='';b.className='mq-install-nav';b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg><span>Instalar aplicativo</span>';b.onclick=install;nav.append(b)}
 const landing=document.getElementById('tela-login');
 if(landing){const b=document.createElement('button');b.type='button';b.dataset.mqInstall='';b.className='mq-install-public';b.textContent='↓ Instalar MedQuest';b.onclick=install;landing.append(b)}
 refresh();
 if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(e=>console.warn('Não foi possível registrar o aplicativo:',e.message));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
