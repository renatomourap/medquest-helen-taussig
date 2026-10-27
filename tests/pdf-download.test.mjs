import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { pdfFilename, attachmentUrl } from '../assets/pdf-reader.mjs';

test('the attachment URL preserves the signed token and original Unicode filename', () => {
  const name = '8 - Antibióticos II - Resumo.pdf';
  const url = new URL(attachmentUrl('https://storage.example/object/sign/private/file.pdf?token=unchanged', name));
  assert.equal(url.searchParams.get('token'), 'unchanged');
  assert.equal(url.searchParams.get('download'), name);
  assert.equal(pdfFilename({ descricao: 'PDF original — ' + name }), name);
  assert.equal(pdfFilename({ titulo: 'Hipersensibilidade' }), 'Hipersensibilidade.pdf');
  assert.equal(pdfFilename({ titulo: 'A/B' }), 'A_B.pdf');
});

async function fixture({ user = { id: 'student' }, blocked = false, error = null } = {}) {
  const events = [], feedback = { textContent: '', style: {}, replaceChildren() { this.textContent = ''; }, append(el) { this.link = el; } };
  const child = { closed: false, opener: {}, document: { title: '', body: {} }, location: { replace(url) { events.push('navigate'); child.url = url; } }, close() { this.closed = true; } };
  let complete;
  const signing = new Promise(resolve => { complete = resolve; });
  const context = {
    console, BANCO: { disciplinas: [] }, usuarioAtual: user,
    document: { getElementById() { return feedback; }, createElement() { return {}; } },
    db: { storage: { from(bucket) { assert.equal(bucket, 'materiais_medquest'); return { async createSignedUrl(path, expiry, options) {
      events.push('sign'); assert.equal(path, 'private/original.pdf'); assert.equal(expiry, 300);
      assert.equal(options.download, 'Original.pdf'); await signing;
      return error ? { error: { message: error } } : { data: { signedUrl: 'https://storage.example/original.pdf?token=valid&download=Original.pdf' } };
    } }; } } },
    window: { open() { events.push('open'); return blocked ? null : child; } }
  };
  context.window.window = context.window;
  const source = (await readFile(new URL('../assets/estudo-modulos.js', import.meta.url), 'utf8'))
    .replace(/\}\)\(\);\s*$/, "window.setFixturePdfs=items=>{officialPdfs=items};})();");
  vm.runInNewContext(source, context);
  context.window.setFixturePdfs([{ id: 'pdf', titulo: 'Resumo', descricao: 'PDF original — Original.pdf', arquivo_path: 'private/original.pdf' }]);
  return { ...context, child, events, feedback, complete };
}

test('Safari popup is created synchronously inside the tap, before signing', async () => {
  const f = await fixture(); f.window.studyOfficialDownload('pdf');
  assert.deepEqual(f.events, ['open', 'sign']); assert.equal(f.child.opener, null);
  f.complete(); await new Promise(setImmediate);
  assert.deepEqual(f.events, ['open', 'sign', 'navigate']);
  assert.match(f.child.url, /download=Original.pdf/);
});

test('a blocked popup produces a real link requiring a fresh user tap', async () => {
  const f = await fixture({ blocked: true }); f.window.studyOfficialDownload('pdf');
  f.complete(); await new Promise(setImmediate);
  assert.match(f.feedback.link.href, /token=valid/);
  assert.equal(f.feedback.link.download, 'Original.pdf');
});

test('anonymous users never get a URL or a popup', async () => {
  const f = await fixture({ user: null }); f.window.studyOfficialDownload('pdf');
  assert.deepEqual(f.events, []); assert.match(f.feedback.textContent, /login/);
});

test('RLS/signing errors close the waiting tab and show the failure', async () => {
  const f = await fixture({ error: 'Acesso negado' }); f.window.studyOfficialDownload('pdf');
  f.complete(); await new Promise(setImmediate);
  assert.equal(f.child.closed, true); assert.equal(f.child.url, undefined);
  assert.match(f.feedback.textContent, /Acesso negado/);
});
