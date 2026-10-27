-- A display label independent of the stable topic ID used by questions.
ALTER TABLE public.materiais_medquest ADD COLUMN IF NOT EXISTS tema_nome text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.editar_metadados_material(
 p_material_id uuid,p_titulo text,p_disciplina_id text,p_tema_nome text,p_conteudo_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE changed integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores podem editar materiais.' USING ERRCODE='42501'; END IF;
 IF p_titulo IS NULL OR length(trim(p_titulo)) NOT BETWEEN 2 AND 160
 OR p_disciplina_id IS NULL OR length(trim(p_disciplina_id)) NOT BETWEEN 2 AND 80
 OR p_tema_nome IS NULL OR length(trim(p_tema_nome)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Preencha título, disciplina e assunto válidos.'; END IF;
 UPDATE public.materiais_medquest SET titulo=trim(p_titulo),disciplina_id=trim(p_disciplina_id),tema_nome=trim(p_tema_nome) WHERE id=p_material_id;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'Material indisponível ou sem permissão.'; END IF;
 IF p_conteudo_id IS NOT NULL THEN
  UPDATE public.conteudos_oficiais SET titulo=trim(p_titulo),area_id=trim(p_disciplina_id),assunto=trim(p_tema_nome),atualizado_em=now() WHERE id=p_conteudo_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Não foi possível atualizar a identificação do resumo.'; END IF;
 END IF;
 RETURN p_material_id;
END;
$$;
REVOKE ALL ON FUNCTION public.editar_metadados_material(uuid,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.editar_metadados_material(uuid,text,text,text,uuid) TO authenticated;
UPDATE public.materiais_medquest SET tema_nome='Protozoários cavitários: Entamoebas' WHERE disciplina_id='parasitologia' AND tema_id='protozoarios-cavitarios-entamoebas';
