// Render the original PDF bytes instead of Safari's single-page iframe preview.
const vendor = new URL('./vendor/pdfjs-6.4.299/', import.meta.url);
let closeCurrent;

export function pdfFilename(doc) {
  const original = String(doc.descricao || '').match(/^PDF original\s*[—–-]\s*(.+\.pdf)$/i)?.[1];
  return (original || `${doc.titulo || 'Resumo'}.pdf`).replace(/[\u0000-\u001f/\\]/g, '_');
}

export function attachmentUrl(url, filename) {
  const result = new URL(url);
  result.searchParams.set('download', filename);
  return result.href;
}

export async function openPdfReader({ doc, url, area }) {
  closeCurrent?.();
  const focusBefore = document.activeElement;
  const dialog = document.createElement('section');
  dialog.id = 'study-pdf-dialog';
  dialog.className = 'study-pdf-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'PDF original: ' + doc.titulo);
  const head = document.createElement('header');
  head.className = 'study-pdf-dialog-head';
  const heading = document.createElement('div');
  heading.className = 'study-pdf-dialog-title';
  const title = document.createElement('strong'); title.textContent = doc.titulo;
  const subtitle = document.createElement('small'); subtitle.textContent = area + ' · PDF original';
  heading.append(title, subtitle);
  const actions = document.createElement('div'); actions.className = 'study-pdf-dialog-actions';
  function button(text, run, label = text) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = text;
    el.setAttribute('aria-label', label); el.onclick = run; return el;
  }
  function link(text, href) {
    const el = document.createElement('a'); el.textContent = text; el.href = href;
    el.target = '_blank'; el.rel = 'noopener noreferrer'; return el;
  }
  const save = link('↓ Baixar PDF', attachmentUrl(url, pdfFilename(doc)));
  save.download = pdfFilename(doc);
  const external = link('Abrir original', url);
  const timer = button('◷ Cronômetro', () => window.MedQuestStudyTime?.openStart({
    atividade: 'pdf', titulo: doc.titulo, area_id: doc.disciplina_id, assunto: doc.tema_id
  }));
  const full = button('Tela cheia', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await dialog.requestFullscreen(); }
    catch { status.textContent = 'Use o leitor nesta tela; a tela cheia não está disponível neste navegador.'; }
  });
  full.hidden = !document.fullscreenEnabled;
  const exit = button('← Biblioteca', () => close(), 'Voltar à biblioteca');
  actions.append(save, external, timer, full, exit); head.append(heading, actions);
  const nav = document.createElement('nav'); nav.className = 'study-pdf-navigation';
  nav.setAttribute('aria-label', 'Navegação do PDF');
  const prev = button('‹', () => go(current - 1), 'Página anterior');
  const next = button('›', () => go(current + 1), 'Próxima página');
  const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.value = '1';
  input.inputMode = 'numeric'; input.setAttribute('aria-label', 'Página do PDF');
  const total = document.createElement('span'); total.textContent = '/ …';
  const label = document.createElement('label'); label.textContent = 'Página '; label.append(input, total);
  const less = button('−', () => changeZoom(zoom - .25), 'Diminuir zoom');
  const more = button('+', () => changeZoom(zoom + .25), 'Aumentar zoom');
  const zoomValue = document.createElement('output'); zoomValue.textContent = '100%';
  const fit = button('Ajustar largura', () => changeZoom(1));
  nav.append(prev, label, next, less, zoomValue, more, fit);
  const status = document.createElement('p'); status.className = 'study-pdf-reader-status';
  status.setAttribute('role', 'status'); status.textContent = 'Carregando o PDF original…';
  const scroll = document.createElement('div'); scroll.className = 'study-pdf-pages';
  scroll.tabIndex = 0; scroll.setAttribute('aria-label', 'Páginas do PDF, rolagem vertical');
  dialog.append(head, nav, status, scroll); document.body.append(dialog);
  const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  exit.focus();
  window.MedQuestStudyTime?.setContext({ atividade: 'pdf', titulo: doc.titulo, area_id: doc.disciplina_id, assunto: doc.tema_id });
  let closed = false, pdf, loading, activeRender, current = 1, zoom = 1, generation = 0;
  let frame = 0, resizeTimer, working = false, lastWidth = 0;
  const sheets = [], queue = [], ready = new Map();

  function dispose(sheet) {
    const canvas = sheet.querySelector('canvas');
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    ready.delete(Number(sheet.dataset.page));
    sheet.replaceChildren();
  }
  function close() {
    if (closed) return;
    closed = true; generation++; activeRender?.cancel();
    cancelAnimationFrame(frame); clearTimeout(resizeTimer); resizeObserver?.disconnect();
    document.removeEventListener('keydown', keys); scroll.removeEventListener('scroll', schedule);
    sheets.forEach(dispose); loading?.destroy(); dialog.remove();
    document.body.style.overflow = oldOverflow; focusBefore?.focus();
    if (closeCurrent === close) closeCurrent = null;
  }
  closeCurrent = close;
  function keys(event) {
    if (event.key === 'Escape') { close(); return; }
    if (event.key !== 'Tab') return;
    const all = [...dialog.querySelectorAll('button,a,input,[tabindex="0"]')].filter(el => !el.disabled && !el.hidden);
    if (event.shiftKey && document.activeElement === all[0]) { event.preventDefault(); all.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === all.at(-1)) { event.preventDefault(); all[0]?.focus(); }
  }
  document.addEventListener('keydown', keys);
  function go(n) {
    if (!pdf) return;
    current = Math.max(1, Math.min(pdf.numPages, Number(n) || 1));
    sheets[current - 1].scrollIntoView({ block: 'start', inline: 'nearest' });
    input.value = current; schedule();
  }
  input.onchange = () => go(input.value);
  function changeZoom(value) {
    zoom = Math.max(.5, Math.min(3, value)); zoomValue.textContent = Math.round(zoom * 100) + '%';
    less.disabled = zoom === .5; more.disabled = zoom === 3; layout(true);
  }
  function schedule() {
    if (!closed && !frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
  }
  function measure() {
    if (!pdf || closed || !sheets.length) return;
    const root = scroll.getBoundingClientRect(), marker = root.top + Math.min(160, root.height * .2);
    let best = Infinity;
    const visible = [];
    sheets.forEach(sheet => {
      const box = sheet.getBoundingClientRect(), n = Number(sheet.dataset.page);
      const distance = box.top <= marker && box.bottom > marker ? 0 : Math.min(Math.abs(box.top - marker), Math.abs(box.bottom - marker));
      if (distance < best) { best = distance; current = n; }
      if (box.bottom > root.top - 200 && box.top < root.bottom + 200) visible.push(n);
    });
    input.value = current; prev.disabled = current === 1; next.disabled = current === pdf.numPages;
    // Keep only nearby canvases: a long document must not exhaust iOS canvas memory.
    for (const [n, sheet] of ready) if (Math.abs(n - current) > 1 && !visible.includes(n)) dispose(sheet);
    queue.length = 0;
    visible.sort((a, b) => Math.abs(a - current) - Math.abs(b - current));
    visible.slice(0, 4).forEach(n => { if (!ready.has(n)) queue.push(n); });
    pump();
  }
  async function pump() {
    if (working || closed) return;
    working = true;
    while (queue.length && !closed) {
      const n = queue.shift(), sheet = sheets[n - 1], gen = generation;
      if (ready.has(n)) continue;
      let page, canvas;
      try {
        page = await pdf.getPage(n);
        if (closed || gen !== generation) continue;
        const width = Number(sheet.dataset.width), base = page.getViewport({ scale: 1 });
        const css = page.getViewport({ scale: width / base.width });
        // Bound both surface area and dimensions, including landscape/zoomed iPhones.
        const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2500000 / (css.width * css.height)), 4096 / Math.max(css.width, css.height));
        const viewport = page.getViewport({ scale: width / base.width * ratio });
        canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Página ' + n + ' de ' + pdf.numPages);
        activeRender = page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport });
        await activeRender.promise;
        if (closed || gen !== generation) { canvas.width = 0; canvas.height = 0; continue; }
        sheet.replaceChildren(canvas); ready.set(n, sheet);
        while (ready.size > 4) {
          const farthest = [...ready.keys()].sort((a, b) => Math.abs(b - current) - Math.abs(a - current))[0];
          dispose(ready.get(farthest));
        }
      } catch (err) {
        if (canvas && !canvas.isConnected) { canvas.width = 0; canvas.height = 0; }
        if (!closed && gen === generation && err.name !== 'RenderingCancelledException') {
          const retry = button('Tentar carregar a página ' + n, () => { queue.push(n); pump(); });
          sheet.replaceChildren(retry); status.textContent = 'Uma página não carregou. Tente novamente ou use Baixar PDF / Abrir original.';
        }
      } finally { activeRender = null; page?.cleanup(); }
    }
    working = false;
  }
  function layout(force = false) {
    if (!pdf || closed) return;
    const width = Math.max(180, scroll.clientWidth - 24);
    if (!force && Math.abs(width - lastWidth) < 2) return;
    lastWidth = width; generation++; activeRender?.cancel(); queue.length = 0;
    sheets.forEach(sheet => {
      dispose(sheet); sheet.style.width = width * zoom + 'px';
      sheet.style.height = width * zoom * Number(sheet.dataset.ratio) + 'px';
      sheet.dataset.width = width * zoom;
    });
    go(current); schedule();
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    clearTimeout(resizeTimer); resizeTimer = setTimeout(() => layout(), 160);
  }) : null;
  resizeObserver?.observe(scroll); scroll.addEventListener('scroll', schedule, { passive: true });
  try {
    const pdfjs = await import('./vendor/pdfjs-6.4.299/pdf.min.mjs');
    if (closed) return;
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', vendor).href;
    loading = pdfjs.getDocument({ url, cMapUrl: new URL('cmaps/', vendor).href, cMapPacked: true,
      standardFontDataUrl: new URL('standard_fonts/', vendor).href, wasmUrl: new URL('wasm/', vendor).href,
      iccUrl: new URL('iccs/', vendor).href, isEvalSupported: false, isImageDecoderSupported: false });
    pdf = await loading.promise;
    if (closed) return;
    total.textContent = '/ ' + pdf.numPages; input.max = pdf.numPages;
    const first = await pdf.getPage(1), base = first.getViewport({ scale: 1 }); first.cleanup();
    for (let n = 1; n <= pdf.numPages; n++) {
      const sheet = document.createElement('section'); sheet.className = 'study-pdf-page';
      sheet.dataset.page = n; sheet.dataset.ratio = base.height / base.width;
      sheet.setAttribute('aria-label', 'Página ' + n + ' de ' + pdf.numPages);
      sheets.push(sheet); scroll.append(sheet);
    }
    // Keep the true dimensions of mixed-size pages without eagerly rasterizing any page.
    for (let n = 2; n <= pdf.numPages && !closed; n++) {
      const page = await pdf.getPage(n), view = page.getViewport({ scale: 1 });
      sheets[n - 1].dataset.ratio = view.height / view.width; page.cleanup();
    }
    layout(true); status.textContent = pdf.numPages + ' páginas · PDF original · role para continuar a leitura';
  } catch {
    if (!closed) status.textContent = 'O leitor não carregou. Use Abrir original ou Baixar PDF para acessar o documento completo.';
  }
}
