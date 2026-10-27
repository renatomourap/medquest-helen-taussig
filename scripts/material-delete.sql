-- Storage is removed through its API under the admin session. Finalize the
-- linked catalog records atomically; never delete questions or study history.
CREATE OR REPLACE FUNCTION public.excluir_registro_material(p_material_id uuid,p_arquivo_path text,p_conteudo_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE removed uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores podem excluir arquivos.' USING ERRCODE='42501'; END IF;
 DELETE FROM public.materiais_medquest WHERE id=p_material_id AND arquivo_path=p_arquivo_path RETURNING id INTO removed;
 IF removed IS NULL THEN RAISE EXCEPTION 'Material alterado ou indisponível. Atualize a biblioteca.'; END IF;
 IF p_conteudo_id IS NOT NULL THEN DELETE FROM public.conteudos_oficiais WHERE id=p_conteudo_id; END IF;
 RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.excluir_registro_material(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.excluir_registro_material(uuid,text,uuid) TO authenticated;
