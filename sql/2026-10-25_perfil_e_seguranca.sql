-- =====================================================================
-- MedQuest · Perfil do usuário + proteção das colunas sensíveis
-- Rodar em: Supabase > SQL Editor > New query > Run
-- É seguro rodar mais de uma vez, inclusive se uma versão anterior deste arquivo já foi rodada.
-- =====================================================================

-- 1. Colunas novas do perfil ------------------------------------------
alter table public.usuarios
  add column if not exists telefone text,
  add column if not exists foto_url text,
  add column if not exists username text;

alter table public.usuarios drop constraint if exists usuarios_perfil_formato;
alter table public.usuarios
  add constraint usuarios_perfil_formato check (
    (nome is null or char_length(nome) <= 120)
    and (telefone is null or char_length(telefone) <= 25)
    -- a foto só pode apontar para o bucket "avatars" deste projeto
    and (foto_url is null or foto_url like 'https://gatkawdbksgkxhclyrhi.supabase.co/storage/v1/object/public/avatars/%')
  );


-- 1b. Nome de usuário: único na plataforma, sem repetição ---------------
--     3 a 20 caracteres: letras minúsculas, números, ponto e sublinhado.
--     O índice único é quem garante a regra, mesmo que alguém tente burlar o site.
alter table public.usuarios drop constraint if exists usuarios_username_formato;
alter table public.usuarios
  add constraint usuarios_username_formato check (
    username is null or (
      username ~ '^[a-z0-9][a-z0-9_.]{2,19}$'
      and username not in ('admin', 'administrador', 'administrator', 'suporte', 'support',
                           'medquest', 'moderador', 'root', 'sistema', 'hellen', 'helen', 'taussig')
    )
  );

create unique index if not exists usuarios_username_unico
  on public.usuarios (username);

-- Consulta de disponibilidade (usada pelo aviso "Disponível / Já está em uso").
-- O usuário comum só enxerga a própria linha, então a consulta roda com privilégio do banco
-- e devolve apenas verdadeiro ou falso, sem expor nenhum dado.
create or replace function public.username_disponivel(p_username text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    p_username ~ '^[a-z0-9][a-z0-9_.]{2,19}$'
    and p_username not in ('admin', 'administrador', 'administrator', 'suporte', 'support',
                           'medquest', 'moderador', 'root', 'sistema', 'hellen', 'helen', 'taussig')
    and not exists (
      select 1 from public.usuarios
      where username = p_username and id is distinct from auth.uid()
    );
$$;

grant execute on function public.username_disponivel(text) to anon, authenticated;


-- 2. INSERT: o usuário só consegue se criar como PENDENTE e sem privilégios
--    (antes, qualquer pessoa com a chave pública podia se cadastrar com admin = true)
drop policy if exists usuario_insere_proprio on public.usuarios;
create policy usuario_insere_proprio on public.usuarios
  for insert
  with check (
    auth.uid() = id
    and aprovado = false
    and admin = false
    and aprovado_em is null
    and pagamento_validade is null
    and coalesce(pagamento_status, 'pendente') = 'pendente'
  );


-- 3. UPDATE: o usuário pode editar a própria linha ---------------------
drop policy if exists usuario_atualiza_proprio on public.usuarios;
create policy usuario_atualiza_proprio on public.usuarios
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- 4. Trava: só o administrador altera aprovação, admin e pagamento -----
--    Mesmo que o usuário envie esses campos, o banco devolve o valor antigo.
--    O e-mail da tabela sempre espelha o e-mail da conta de acesso.
create or replace function public.protege_campos_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- administrador, ou operação interna sem usuário logado (migrações etc.)
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  new.aprovado           := old.aprovado;
  new.admin              := old.admin;
  new.aprovado_em        := old.aprovado_em;
  new.pagamento_status   := old.pagamento_status;
  new.pagamento_validade := old.pagamento_validade;
  new.criado_em          := old.criado_em;
  new.id                 := old.id;
  new.email := coalesce((select u.email from auth.users u where u.id = old.id), old.email);
  return new;
end;
$$;

drop trigger if exists protege_campos_usuario on public.usuarios;
create trigger protege_campos_usuario
  before update on public.usuarios
  for each row execute function public.protege_campos_usuario();


-- 5. Fotos de perfil: bucket "avatars" (leitura pública, 2 MB, só imagem)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- cada usuário só grava/apaga dentro da própria pasta  (avatars/<id do usuário>/...)
drop policy if exists avatars_le_propria       on storage.objects;
drop policy if exists avatars_insere_propria   on storage.objects;
drop policy if exists avatars_atualiza_propria on storage.objects;
drop policy if exists avatars_apaga_propria    on storage.objects;

create policy avatars_le_propria on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_insere_propria on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_atualiza_propria on storage.objects
  for update to authenticated
  using      (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_apaga_propria on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- 6. Conferência (deve devolver: 3 colunas, 4 policies, 1 bucket, 1 trigger, 1 índice, 1 função)
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'usuarios'
       and column_name in ('telefone', 'foto_url', 'username'))             as colunas,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'usuarios'
       and policyname in ('usuario_insere_proprio', 'usuario_atualiza_proprio',
                          'usuario_le_proprio', 'admin_ve_todos'))          as policies_usuarios,
  (select count(*) from storage.buckets where id = 'avatars')               as bucket,
  (select count(*) from pg_trigger
     where tgname = 'protege_campos_usuario' and not tgisinternal)          as trigger_protecao,
  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'usuarios_username_unico') as indice_username,
  (select count(*) from pg_proc
     where proname = 'username_disponivel')                                 as funcao_username;
