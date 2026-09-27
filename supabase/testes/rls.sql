-- Testes de permissão: Ana (dona), Beto (agrônomo convidado), Caio (de fora).
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@x.com', '{"nome":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@x.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'caio@x.com', '{}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.fazendas (nome, proprietario) values ('Fazenda Santa Clara', 'José Almeida');
insert into public.membros_fazenda (fazenda_id, perfil_id, papel)
  select id, '00000000-0000-0000-0000-00000000000b', 'agronomo' from public.fazendas;
insert into public.talhoes (fazenda_id, nome, especie, contorno)
  select id, 'Talhão 1', 'arabica', 'SRID=4326;POLYGON((-47.0092 -18.9598,-47.0051 -18.9601,-47.0047 -18.9627,-47.0089 -18.9630,-47.0092 -18.9598))' from public.fazendas;
select 'ana vê' as caso, nome, area_ha, perimetro_m from public.talhoes;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
update public.talhoes set prod_atual = 30;
select 'beto vê e edita' as caso, count(*), max(prod_atual) from public.talhoes;
insert into public.analises (talhao_id, resultado) select id, '{"cenario":"Adensado"}' from public.talhoes;
with x as (delete from public.fazendas returning 1) select 'beto não exclui fazenda' as caso, count(*) from x;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select 'caio não vê talhões' as caso, count(*) from public.talhoes;
select 'caio não vê fazendas' as caso, count(*) from public.fazendas;
with x as (update public.talhoes set nome = 'x' returning 1) select 'caio não edita' as caso, count(*) from x;
select 'caio vê só o próprio perfil' as caso, count(*) from public.perfis;
insert into public.talhoes (nome, especie, contorno) values ('Avulso do Caio', 'conilon', 'SRID=4326;POLYGON((-40.07 -19.39,-40.06 -19.39,-40.06 -19.40,-40.07 -19.39))');
select 'caio vê o avulso dele' as caso, count(*) from public.talhoes_mapa;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select 'ana vê colegas' as caso, count(*) from public.perfis;
select 'ana não vê avulso do caio' as caso, count(*) from public.talhoes;
with x as (delete from public.fazendas returning 1) select 'ana exclui a fazenda' as caso, count(*) from x;
select 'talhão foi junto' as caso, count(*) from public.talhoes;
