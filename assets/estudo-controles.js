/* Controles compartilhados do cronômetro, registro manual e histórico. */
(()=>{
'use strict';
let active=null,uid=0;
const button=(text,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.onclick=fn;return b};
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function closePopover(focus=true){if(!active)return;const a=active;active=null;a.panel.remove();a.trigger.setAttribute('aria-expanded','false');if(focus&&a.trigger.isConnected)a.trigger.focus()}
function popover(trigger,label){
 closePopover(false);
 const panel=document.createElement('div');panel.className='mq-control-popover';panel.id='mq-control-popup-'+(++uid);panel.setAttribute('aria-label',label);
 trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','true');
 (trigger.closest('.mq-study-dialog')||document.body).append(panel);active={panel,trigger};
 const rect=trigger.getBoundingClientRect(),width=Math.min(Math.max(rect.width,290),window.innerWidth-24);
 panel.style.width=width+'px';panel.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12))+'px';
 const below=window.innerHeight-rect.bottom-16,above=rect.top-16;
 panel.style.maxHeight=Math.min(360,Math.max(below,above,160))+'px';
 if(below>=Math.min(300,above))panel.style.top=(rect.bottom+6)+'px';else panel.style.bottom=(window.innerHeight-rect.top+6)+'px';
 return panel;
}
function notify(input){input.dispatchEvent(new Event('change',{bubbles:true}))}
function enhanceSelect(select){
 if(select.dataset.mqControl)return;select.dataset.mqControl='true';
 const title=select.getAttribute('aria-label')||select.closest('label')?.firstChild?.textContent.trim()||'Selecionar';
 const trigger=button('',()=>open());trigger.className='mq-control-trigger';trigger.setAttribute('aria-label',title);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 const wrap=document.createElement('span');wrap.className='mq-control';select.before(wrap);wrap.append(select,trigger);select.hidden=true;
 function sync(){trigger.textContent=select.selectedOptions[0]?.textContent||'Selecionar';trigger.disabled=select.disabled}
 function open(){
  if(active?.trigger===trigger){closePopover();return}
  const panel=popover(trigger,title);panel.role='listbox';
  let list=[];
  [...select.options].forEach((option,i)=>{
   const b=button(option.textContent,()=>{select.value=option.value;sync();closePopover();notify(select)},'mq-control-option');
   b.role='option';b.id=panel.id+'-'+i;b.setAttribute('aria-selected',String(option.selected));b.disabled=option.disabled;panel.append(b);if(!b.disabled)list.push(b);
  });
  (list.find(b=>b.getAttribute('aria-selected')==='true')||list[0])?.focus();
  let search='',last=0;
  panel.onkeydown=e=>{
   let index=list.indexOf(document.activeElement),next=index;
   if(e.key==='ArrowDown')next=(index+1)%list.length;else if(e.key==='ArrowUp')next=(index+list.length-1)%list.length;
   else if(e.key==='Home')next=0;else if(e.key==='End')next=list.length-1;
   else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){search=Date.now()-last>700?e.key:search+e.key;last=Date.now();next=list.findIndex(b=>b.textContent.toLocaleLowerCase('pt-BR').startsWith(search.toLocaleLowerCase('pt-BR')))}else return;
   e.preventDefault();list[next]?.focus();
  };
 }
 trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open()}};
 select.addEventListener('change',sync);sync();
}
function enhanceDate(input){
 const trigger=button('',()=>open());trigger.className='mq-control-trigger mq-date-trigger';trigger.setAttribute('aria-label','Escolher data');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
 input.type='hidden';input.after(trigger);
 function sync(){trigger.textContent=input.value?new Date(input.value+'T12:00:00').toLocaleDateString('pt-BR'):'Escolher data'}
 function open(){
  if(active?.trigger===trigger){closePopover();return}
  const panel=popover(trigger,'Escolher data do estudo');panel.role='dialog';panel.classList.add('mq-calendar');
  const base=new Date((input.value||dateKey(new Date()))+'T12:00:00');let month=base.getMonth(),year=base.getFullYear(),monthView=false;
  const today=dateKey(new Date());
  function choose(d){input.value=dateKey(d);sync();closePopover();notify(input)}
  function paint(focusDay){
   panel.replaceChildren();
   const head=document.createElement('div');head.className='mq-calendar-head';
   const back=button('‹',()=>{if(monthView)year--;else{month--;if(month<0){month=11;year--}}paint()});back.setAttribute('aria-label',monthView?'Ano anterior':'Mês anterior');
   const label=button(new Date(year,month,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),()=>{monthView=!monthView;paint()},'mq-calendar-title');
   const next=button('›',()=>{if(monthView)year++;else{month++;if(month>11){month=0;year++}}paint()});next.setAttribute('aria-label',monthView?'Próximo ano':'Próximo mês');
   next.disabled=monthView?year>=Number(today.slice(0,4)):year*12+month>=Number(today.slice(0,4))*12+Number(today.slice(5,7))-1;
   head.append(back,label,next);panel.append(head);
   if(monthView){
    const grid=document.createElement('div');grid.className='mq-calendar-months';
    for(let m=0;m<12;m++){const b=button(new Date(year,m,1).toLocaleDateString('pt-BR',{month:'short'}),()=>{month=m;monthView=false;paint()},'mq-calendar-month');b.disabled=dateKey(new Date(year,m,1))>today;grid.append(b)}panel.append(grid);
   }else{
    const grid=document.createElement('div');grid.className='mq-calendar-grid';grid.role='group';grid.setAttribute('aria-label',label.textContent);
    for(const name of ['D','S','T','Q','Q','S','S']){const span=document.createElement('span');span.textContent=name;span.className='mq-calendar-weekday';grid.append(span)}
    const first=new Date(year,month,1),offset=first.getDay(),count=new Date(year,month+1,0).getDate();
    for(let i=0;i<offset;i++)grid.append(document.createElement('span'));
    for(let day=1;day<=count;day++){
     const d=new Date(year,month,day,12),key=dateKey(d),b=button(day,()=>choose(d),'mq-calendar-day');b.dataset.date=key;b.setAttribute('aria-label',d.toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}));b.setAttribute('aria-pressed',String(key===input.value));
     if(key===today)b.setAttribute('aria-current','date');b.disabled=key>today;
     b.onkeydown=e=>{let move=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7})[e.key];if(move){e.preventDefault();const target=new Date(year,month,day+move,12);if(dateKey(target)>today)return;month=target.getMonth();year=target.getFullYear();paint(dateKey(target))}else if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();const target=new Date(year,month+(e.key==='PageUp'?-1:1),Math.min(day,28),12);if(dateKey(target)>today)return;month=target.getMonth();year=target.getFullYear();paint(dateKey(target))}};
     grid.append(b);
    }panel.append(grid);
   }
   const foot=document.createElement('div');foot.className='mq-calendar-foot';foot.append(button('Hoje',()=>choose(new Date())),button('Fechar',()=>closePopover()));panel.append(foot);
   (panel.querySelector('[data-date="'+(focusDay||input.value)+'"]')||head.querySelector('button'))?.focus();
  }paint();
 }input.addEventListener('change',sync);sync();
}
function enhanceTime(input){
 input.type='hidden';const trigger=button('',()=>open());trigger.className='mq-control-trigger';trigger.setAttribute('aria-label','Escolher horário de início');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');input.after(trigger);
 const sync=()=>{trigger.textContent=input.value||'Sem horário definido'};
 function open(){
  if(active?.trigger===trigger){closePopover();return}
  const panel=popover(trigger,'Horário de início');panel.role='dialog';panel.classList.add('mq-time-picker');
  const title=document.createElement('strong');title.textContent='Horário de início';panel.append(title);
  const cols=document.createElement('div');cols.className='mq-time-picker-cols';
  let values=(input.value||'08:00').split(':');
  ['Horas','Minutos'].forEach((name,index)=>{
   const col=document.createElement('div'),label=document.createElement('small'),list=document.createElement('div');label.textContent=name;list.className='mq-time-picker-list';list.role='listbox';list.setAttribute('aria-label',name);
   for(let n=0;n<(index?60:24);n++){
    const value=String(n).padStart(2,'0'),b=button(value,()=>{values[index]=value;[...list.children].forEach(el=>el.setAttribute('aria-selected',String(el===b)))},'mq-control-option');b.role='option';b.setAttribute('aria-selected',String(values[index]===value));list.append(b);
   }
   list.onkeydown=e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...list.children],i=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus()};
   col.append(label,list);cols.append(col);
  });panel.append(cols);
  const foot=document.createElement('div');foot.className='mq-calendar-foot';foot.append(button('Limpar',()=>{input.value='';sync();closePopover();notify(input)}),button('Aplicar horário',()=>{input.value=values.join(':');sync();closePopover();notify(input)},'mq-control-apply'));panel.append(foot);
  for(const selected of cols.querySelectorAll('[aria-selected="true"]'))selected.scrollIntoView({block:'center'});cols.querySelector('[aria-selected="true"]')?.focus();
 }input.addEventListener('change',sync);sync();
}
function enhance(root){
 root.querySelectorAll('select').forEach(enhanceSelect);
 root.querySelectorAll('input[type=date]').forEach(enhanceDate);
 root.querySelectorAll('input[type=time]').forEach(enhanceTime);
 root.querySelectorAll('input[type=number]').forEach(input=>{
  input.inputMode='numeric';const wrap=document.createElement('span');wrap.className='mq-number-control';input.before(wrap);wrap.append(input);
  const label=input.closest('label')?.firstChild?.textContent.trim()||'valor';
  const step=delta=>{const value=Math.max(Number(input.min||0),Math.min(Number(input.max||999),Number(input.value||0)+delta));input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))};
  const less=button('−',()=>step(-1)),more=button('+',()=>step(1));less.setAttribute('aria-label','Diminuir '+label.toLowerCase());more.setAttribute('aria-label','Aumentar '+label.toLowerCase());wrap.prepend(less);wrap.append(more);
 });
}
function bindModal(overlay,close){
 const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';
 function key(e){
  if(overlay.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(active){closePopover();return}close()}
  if(e.key==='Tab'){const controls=[...overlay.querySelectorAll('button,input,textarea,select,[tabindex="0"]')].filter(el=>!el.disabled&&!el.hidden&&el.offsetParent!==null);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
 }
 document.addEventListener('keydown',key,true);
 return ()=>{closePopover(false);document.removeEventListener('keydown',key,true);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus()};
}
function toast(message){
 let el=document.getElementById('mq-study-toast');if(!el){el=document.createElement('div');el.id='mq-study-toast';el.role='status';document.body.append(el)}el.textContent=message;el.hidden=false;clearTimeout(el._timer);el._timer=setTimeout(()=>el.hidden=true,4500);
}
async function confirmAction({title,message,confirm='Confirmar',danger=false}){
 return new Promise(resolve=>{
  closePopover(false);const overlay=document.createElement('div');overlay.className='mq-study-dialog mq-study-confirm';const card=document.createElement('section');card.className='mq-study-dialog-card';card.role='dialog';card.setAttribute('aria-modal','true');
  const id='mq-confirm-'+(++uid),h=document.createElement('h2'),p=document.createElement('p'),footer=document.createElement('footer');h.id=id;h.textContent=title;card.setAttribute('aria-labelledby',id);p.textContent=message;p.className='mq-study-description';
  let release;function end(result){release?.();overlay.remove();resolve(result)}
  const cancel=button('Cancelar',()=>end(false)),ok=button(confirm,()=>end(true),danger?'mq-study-danger':'mq-study-gold');footer.append(cancel,ok);card.append(h,p,footer);overlay.append(card);document.body.append(overlay);release=bindModal(overlay,()=>end(false));cancel.focus();
 });
}
document.addEventListener('pointerdown',e=>{if(active&&!active.panel.contains(e.target)&&!active.trigger.contains(e.target))closePopover(false)});
document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePopover()}else if(e.key==='Tab')closePopover()},true);
window.addEventListener('resize',()=>closePopover(false));
window.MedQuestStudyUI={enhance,closePopover,bindModal,toast,confirm:confirmAction};
})();
