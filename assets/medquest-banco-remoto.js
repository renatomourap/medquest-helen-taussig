// MedQuest — complemento do banco acadêmico via Supabase.
// Somente usuários aprovados podem ler. O banco de dados restringe
// INSERT/UPDATE/DELETE ao administrador, independentemente do front-end.
let bancoRemotoCarregado = false;
function codificarComentarioRemoto(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
    .replace(/\r?\n/g, "<br>");
}
async function carregarBancoRemoto() {
  if (bancoRemotoCarregado || typeof db === "undefined" || typeof BANCO === "undefined") return;
  let todas = [];
  for (let offset = 0; ; offset += 1000) {
    const resultado = await db.from("questoes_medquest")
      .select("id,disciplina_id,tema_id,tema_nome,ordem,hotpoint,nivel_dificuldade,enunciado,alternativas,correta,comentario")
      .order("id", { ascending: true }).range(offset, offset + 999);
    if (resultado.error) {
      console.warn("Banco de questões adicional indisponível:", resultado.error.message);
      return;
    }
    const page = resultado.data || [];
    todas = todas.concat(page);
    if (page.length < 1000) break;
  }
  for (const item of todas) {
    const disciplina = BANCO.disciplinas.find(d => d.id === item.disciplina_id);
    if (!disciplina) continue;
    let tema = disciplina.temas.find(t => t.id === item.tema_id);
    if (!tema) {
      tema = { id: item.tema_id, nome: item.tema_nome || item.tema_id, questoes: [] };
      disciplina.temas.push(tema);
    }
    if (tema.questoes.some(q => q.id === item.id || q.enunciado === item.enunciado)) continue;
    const alts = Array.isArray(item.alternativas) ? item.alternativas : [];
    if (alts.length !== 4) continue;
    tema.questoes.push({
      id: item.id,
      hotpoint: item.hotpoint || "Hot Point",
      nivel_dificuldade: item.nivel_dificuldade || null,
      enunciado: item.enunciado,
      alternativas: alts.map(a => ({ letra: String(a.letra), texto: String(a.texto) })),
      correta: item.correta,
      comentario: codificarComentarioRemoto(item.comentario)
    });
  }
  bancoRemotoCarregado = true;
}
