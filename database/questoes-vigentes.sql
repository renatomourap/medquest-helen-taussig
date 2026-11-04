-- Retirada de lotes substituidos sem apagar o historico de respostas.
-- Aplicado em 2026-11-04. As politicas existentes continuam responsaveis
-- pela aprovacao do aluno e pelas permissoes de escrita do administrador.
begin;
alter table public.questoes_medquest
  add column if not exists retirada_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'questoes_medquest'
      and policyname = 'Somente questoes vigentes na biblioteca'
  ) then
    create policy "Somente questoes vigentes na biblioteca"
      on public.questoes_medquest as restrictive
      for select to authenticated using (retirada_em is null);
  end if;
end $$;

-- Copias dos lotes anteriores e comprovacoes de importacao ficam fora da API.
create schema if not exists medquest_archive;
revoke all on schema medquest_archive from public, anon, authenticated;
commit;
