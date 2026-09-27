-- Só para testar localmente: imita o que o Supabase já tem (schema auth, auth.uid(), papéis).
create schema if not exists auth;
create schema if not exists extensions;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth, extensions to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
