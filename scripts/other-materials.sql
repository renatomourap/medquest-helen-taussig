-- Extend categories without changing records, ownership, storage or RLS policies.
BEGIN;
ALTER TABLE public.materiais_medquest DROP CONSTRAINT materiais_medquest_tipo_check;
ALTER TABLE public.materiais_medquest ADD CONSTRAINT materiais_medquest_tipo_check
  CHECK (tipo IN ('resumo', 'questoes_pdf', 'artigo', 'resumo_aim'));
COMMIT;
