ALTER TABLE public.materiais_medquest
 ADD COLUMN IF NOT EXISTS resumo_versao text NOT NULL DEFAULT 'expandido' CHECK (resumo_versao IN ('expandido','simplificado')),
 ADD COLUMN IF NOT EXISTS resumo_grupo_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS materiais_resumo_grupo_versao_unique ON public.materiais_medquest(resumo_grupo_id,resumo_versao) WHERE tipo='resumo';
CREATE OR REPLACE FUNCTION public.editar_metadados_material(p_material_id uuid,p_titulo text,p_disciplina_id text,p_tema_nome text,p_conteudo_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE target public.materiais_medquest%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores podem editar materiais.' USING ERRCODE='42501'; END IF;
 IF p_titulo IS NULL OR length(trim(p_titulo)) NOT BETWEEN 2 AND 160 OR p_disciplina_id IS NULL OR length(trim(p_disciplina_id)) NOT BETWEEN 2 AND 80 OR p_tema_nome IS NULL OR length(trim(p_tema_nome)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Preencha título, disciplina e assunto válidos.'; END IF;
 SELECT * INTO target FROM public.materiais_medquest WHERE id=p_material_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Material indisponível ou sem permissão.'; END IF;
 UPDATE public.materiais_medquest SET titulo=trim(p_titulo),disciplina_id=trim(p_disciplina_id),tema_nome=trim(p_tema_nome)
 WHERE id=p_material_id OR (target.tipo='resumo' AND tipo='resumo' AND resumo_grupo_id=target.resumo_grupo_id);
 IF p_conteudo_id IS NOT NULL THEN
  UPDATE public.conteudos_oficiais SET titulo=trim(p_titulo),area_id=trim(p_disciplina_id),assunto=trim(p_tema_nome),atualizado_em=now() WHERE id=p_conteudo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível atualizar a identificação do resumo.'; END IF;
 END IF;
 RETURN p_material_id;
END; $$;
REVOKE ALL ON FUNCTION public.editar_metadados_material(uuid,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.editar_metadados_material(uuid,text,text,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.excluir_registro_material(p_material_id uuid,p_arquivo_path text,p_conteudo_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE removed public.materiais_medquest%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores podem excluir arquivos.' USING ERRCODE='42501'; END IF;
 DELETE FROM public.materiais_medquest WHERE id=p_material_id AND arquivo_path=p_arquivo_path RETURNING * INTO removed;
 IF NOT FOUND THEN RAISE EXCEPTION 'Material alterado ou indisponível. Atualize a biblioteca.'; END IF;
 IF p_conteudo_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.materiais_medquest WHERE tipo='resumo' AND resumo_grupo_id=removed.resumo_grupo_id) THEN DELETE FROM public.conteudos_oficiais WHERE id=p_conteudo_id; END IF;
 RETURN removed.id;
END; $$;
REVOKE ALL ON FUNCTION public.excluir_registro_material(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.excluir_registro_material(uuid,text,uuid) TO authenticated;
