/* Online-only: no question, PDF, auth response or user data is stored in Cache API. */
'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#091421"><title>MedQuest — Conexão necessária</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#091421;color:#e9eef5;font:16px/1.7 system-ui}main{max-width:400px;padding:32px;text-align:center}h1{color:#edca80;font-size:26px}p{color:#adbdcf}a{display:inline-block;background:#edca80;color:#091421;border-radius:10px;padding:12px 24px;text-decoration:none;font-weight:700}</style><main><h1>Conecte-se para estudar</h1><p>O MedQuest precisa de internet para acessar sua conta, questões, resumos e progresso.</p><a href="/">Tentar novamente</a></main></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
