// PDF.js renders the original bytes; the stored PDF is never rewritten.
import * as pdfjs from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.mjs';
let closeCurrent;
export async function openPdfReader({doc,url,area,download}){
 closeCurrent?.();
 const origin=document.activeElement,dialog=document.createElement('div');
 dialog.id='study-pdf-dialog';dialog.className='study-pdf-dialog';dialog.role='dialog';
 dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','PDF original: '+doc.titulo);
 const header=document.createElement('header');header.className='study-pdf-dialog-head';
 const heading=document.createElement('div');heading.className='study-pdf-dialog-title';
 const title=document.createElement('strong');title.textContent=doc.titulo;
 const meta=document.createElement('small');meta.textContent=area+' · PDF original';heading.append(title,meta);
 const actions=document.createElement('div');actions.className='study-pdf-dialog-actions';
 function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b}
 const save=button('↓ Baixar PDF',async()=>{save.disabled=true;try{await download()}finally{save.disabled=false}});
 const timer=button('◷ Cronômetro',()=>window.MedQuestStudyTime?.openStart({atividade:'pdf',titulo:doc.titulo,area_id:doc.disciplina_id,assunto:doc.tema_id}));
 const fullscreen=button('Tela cheia',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await dialog.requestFullscreen()}catch{status.textContent='Tela cheia indisponível neste navegador.'}});
 fullscreen.hidden=!document.fullscreenEnabled;
 const exit=button('← Voltar à biblioteca',()=>close());actions.append(timer,save,fullscreen,exit);header.append(heading,actions);
 const toolbar=document.createElement('div');toolbar.className='study-pdf-navigation';
 const pageInput=document.createElement('input');pageInput.type='number';pageInput.min=1;pageInput.value=1;pageInput.setAttribute('aria-label','Página');
 const total=document.createElement('span');total.textContent='/ …';
 const pageLabel=document.createElement('label');pageLabel.textContent='Página ';pageLabel.append(pageInput,total);
 const prev=button('‹',()=>go(Number(pageInput.value)-1));prev.setAttribute('aria-label','Página anterior');
 const next=button('›',()=>go(Number(pageInput.value)+1));next.setAttribute('aria-label','Próxima página');
 const zoomLabel=document.createElement('output');zoomLabel.textContent='100%';zoomLabel.setAttribute('aria-label','Zoom');
 const zoomOut=button('−',()=>zoomTo(zoom-.25));zoomOut.setAttribute('aria-label','Diminuir zoom');
 const zoomIn=button('+',()=>zoomTo(zoom+.25));zoomIn.setAttribute('aria-label','Aumentar zoom');
 const fit=button('Ajustar largura',()=>zoomTo(1));toolbar.append(prev,pageLabel,next,zoomOut,zoomLabel,zoomIn,fit);
 const status=document.createElement('p');status.className='study-pdf-reader-status';status.role='status';status.textContent='Carregando PDF original…';
 const scroll=document.createElement('div');scroll.className='study-pdf-pages';scroll.tabIndex=0;scroll.setAttribute('aria-label','Páginas do PDF, rolagem vertical');
 dialog.append(header,toolbar,status,scroll);document.body.append(dialog);
 const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';exit.focus();
 window.MedQuestStudyTime?.setContext({atividade:'pdf',titulo:doc.titulo,area_id:doc.disciplina_id,assunto:doc.tema_id});
 let pdf,task,closed=false,zoom=1,generation=0,observer,currentObserver,resizeTimer;
 const sheets=[],rendering=new Map();
 function close(){if(closed)return;closed=true;observer?.disconnect();currentObserver?.disconnect();resizeObserver.disconnect();clearTimeout(resizeTimer);task?.destroy();dialog.remove();document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',keys);origin?.focus();if(closeCurrent===close)closeCurrent=null}
 closeCurrent=close;
 function go(n){if(!pdf)return;n=Math.max(1,Math.min(pdf.numPages,n));sheets[n-1].scrollIntoView({block:'start'});pageInput.value=n}
 pageInput.onchange=()=>go(Number(pageInput.value)||1);
 function keys(e){if(e.key==='Escape'){close();return}if(e.key==='Tab'){const controls=[...dialog.querySelectorAll('button,input,[tabindex="0"]')].filter(el=>!el.disabled&&!el.hidden);if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus()}}}
 document.addEventListener('keydown',keys);
 function zoomTo(value){zoom=Math.max(.5,Math.min(3,value));zoomLabel.textContent=Math.round(zoom*100)+'%';zoomOut.disabled=zoom===.5;zoomIn.disabled=zoom===3;layout()}
 async function render(sheet){
  const key=generation+':'+sheet.dataset.page;if(rendering.has(key)||sheet.querySelector('canvas'))return;
  const gen=generation;rendering.set(key,true);
  try{
   const page=await pdf.getPage(Number(sheet.dataset.page));if(closed||gen!==generation)return;
   const scale=Number(sheet.dataset.width)/page.getViewport({scale:1}).width;
   const ratio=Math.min(window.devicePixelRatio||1,2),viewport=page.getViewport({scale:scale*ratio});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   canvas.setAttribute('aria-label','Página '+sheet.dataset.page);canvas.role='img';
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   if(!closed&&gen===generation)sheet.replaceChildren(canvas);
  }catch(e){if(!closed&&gen===generation){sheet.textContent='Não foi possível renderizar esta página. Use Baixar PDF para acessar o original.';status.textContent='Falha na renderização: '+e.message}}
  finally{rendering.delete(key)}
 }
 function layout(){
  if(!pdf||closed)return;generation++;observer?.disconnect();
  const width=Math.max(180,scroll.clientWidth-32)*zoom;
  sheets.forEach(sheet=>{sheet.replaceChildren();sheet.style.width=width+'px';sheet.style.height=(width*Number(sheet.dataset.ratio))+'px';sheet.dataset.width=width});
  observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)render(entry.target)}),{root:scroll,rootMargin:'600px 0px'});
  sheets.forEach(sheet=>observer.observe(sheet));
 }
 const resizeObserver=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(layout,150)});resizeObserver.observe(scroll);
 try{
  const base='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/';
  task=pdfjs.getDocument({url,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',iccUrl:base+'iccs/',isEvalSupported:false});
  pdf=await task.promise;if(closed)return;
  total.textContent='/ '+pdf.numPages;pageInput.max=pdf.numPages;
  for(let n=1;n<=pdf.numPages;n++){
   const page=await pdf.getPage(n);if(closed)return;const viewport=page.getViewport({scale:1});
   const sheet=document.createElement('section');sheet.className='study-pdf-page';sheet.dataset.page=n;sheet.dataset.ratio=viewport.height/viewport.width;
   sheet.setAttribute('aria-label','Página '+n+' de '+pdf.numPages);sheets.push(sheet);scroll.append(sheet);
  }
  currentObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){pageInput.value=entry.target.dataset.page;prev.disabled=Number(pageInput.value)===1;next.disabled=Number(pageInput.value)===pdf.numPages}},{root:scroll,rootMargin:'-10% 0px -70% 0px',threshold:0});
  sheets.forEach(sheet=>currentObserver.observe(sheet));layout();status.textContent=pdf.numPages+' páginas · documento original';
 }catch(e){if(!closed)status.textContent='Não foi possível abrir o PDF: '+e.message+'. Tente novamente ou baixe o original.'}
}
