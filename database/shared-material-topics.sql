-- One private original PDF may be referenced from additional subjects.
BEGIN;
CREATE TABLE public.material_temas_medquest (
 material_id uuid NOT NULL REFERENCES public.materiais_medquest(id) ON DELETE CASCADE,
 disciplina_id text NOT NULL CHECK(length(trim(disciplina_id)) BETWEEN 2 AND 80),
 tema_id text NOT NULL CHECK(length(trim(tema_id)) BETWEEN 2 AND 160),
 tema_nome text NOT NULL CHECK(length(trim(tema_nome)) BETWEEN 2 AND 160),
 resumo_grupo_id uuid NOT NULL,
 PRIMARY KEY(material_id,disciplina_id,tema_id)
);
ALTER TABLE public.material_temas_medquest ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_temas_medquest TO authenticated;
CREATE POLICY "Approved students read material topics" ON public.material_temas_medquest FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.usuarios u WHERE u.id=(SELECT auth.uid()) AND u.aprovado=true));
CREATE POLICY "Admins insert material topics" ON public.material_temas_medquest FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admins update material topics" ON public.material_temas_medquest FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admins delete material topics" ON public.material_temas_medquest FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
COMMIT;
