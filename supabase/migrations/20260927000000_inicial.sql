-- AERA · esquema inicial no Supabase (Postgres + PostGIS)
-- Usuários (perfis), fazendas, membros por fazenda, talhões com polígono e histórico de análises.
-- Acesso por Row Level Security: cada pessoa vê só as fazendas de que é membro.

create extension if not exists postgis with schema extensions;

-- ------------------------------------------------------------------ tabelas
create table public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome          text,
  funcao        text,
  registro      text,                 -- CREA/CFTA
  empresa       text,
  email         text,
  telefone      text,
  regiao        text,
  especie       text check (especie in ('arabica', 'conilon')),
  foto_url      text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.fazendas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) > 0),
  proprietario  text,
  telefone      text,
  municipio     text,
  uf            char(2),
  area_total_ha numeric(10, 2) check (area_total_ha >= 0),
  car           text,
  implementos   text[] not null default '{}',
  obs           text,
  criado_por    uuid not null default auth.uid() references public.perfis (id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.membros_fazenda (
  fazenda_id uuid not null references public.fazendas (id) on delete cascade,
  perfil_id  uuid not null references public.perfis (id) on delete cascade,
  papel      text not null default 'agronomo' check (papel in ('dono', 'agronomo', 'leitor')),
  criado_em  timestamptz not null default now(),
  primary key (fazenda_id, perfil_id)
);
create index on public.membros_fazenda (perfil_id);

create table public.talhoes (
  id              uuid primary key default gen_random_uuid(),
  fazenda_id      uuid references public.fazendas (id) on delete cascade,  -- nulo = talhão avulso do autor
  nome            text not null check (length(trim(nome)) > 0),
  especie         text not null check (especie in ('arabica', 'conilon')),
  contorno        extensions.geography(Polygon, 4326) not null,
  -- Área e perímetro calculados pelo próprio banco no elipsoide WGS 84 (conferência do cálculo do app).
  area_ha         numeric(12, 4) generated always as (round((extensions.st_area(contorno) / 10000)::numeric, 4)) stored,
  perimetro_m     numeric(12, 1) generated always as (round(extensions.st_perimeter(contorno)::numeric, 1)) stored,
  altitude_m      integer,
  temp_media      numeric(4, 1),
  declividade     numeric(5, 1),
  irrigacao       boolean not null default false,
  prod_atual      numeric(6, 1),
  implementos     text[] not null default '{}',
  equipe_colheita integer check (equipe_colheita > 0),
  municipio       text,
  uf              char(2),
  regiao          text,
  criado_por      uuid not null default auth.uid() references public.perfis (id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index on public.talhoes (fazenda_id);
create index on public.talhoes using gist (contorno);

create table public.analises (
  id             uuid primary key default gen_random_uuid(),
  talhao_id      uuid not null references public.talhoes (id) on delete cascade,
  parametros     jsonb not null default '{}',   -- entradas usadas no cálculo
  resultado      jsonb not null default '{}',   -- aptidão, cenários, colheita
  relatorio_path text,                          -- arquivo no Storage (quando houver)
  criado_por     uuid not null default auth.uid() references public.perfis (id),
  criado_em      timestamptz not null default now()
);
create index on public.analises (talhao_id, criado_em desc);

-- Talhões com o contorno em GeoJSON, pronto para o app desenhar no mapa.
create view public.talhoes_mapa with (security_invoker = true) as
  select t.*, extensions.st_asgeojson(t.contorno)::jsonb as contorno_geojson
  from public.talhoes t;

-- ------------------------------------------------------------------ funções e gatilhos
create function public.tocar_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger perfis_atualizado before update on public.perfis for each row execute function public.tocar_atualizado();
create trigger fazendas_atualizado before update on public.fazendas for each row execute function public.tocar_atualizado();
create trigger talhoes_atualizado before update on public.talhoes for each row execute function public.tocar_atualizado();

-- Cada conta nova ganha um perfil.
create function public.criar_perfil() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, email, nome) values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'full_name'));
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.criar_perfil();

-- Quem cria a fazenda vira dono dela.
create function public.dono_da_fazenda() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.membros_fazenda (fazenda_id, perfil_id, papel) values (new.id, new.criado_por, 'dono');
  return new;
end $$;
create trigger ao_criar_fazenda after insert on public.fazendas for each row execute function public.dono_da_fazenda();

-- Papel da pessoa logada numa fazenda (null se não for membro). security definer evita recursão nas políticas.
create function public.papel_na_fazenda(fid uuid) returns text language sql stable security definer set search_path = '' as $$
  select papel from public.membros_fazenda where fazenda_id = fid and perfil_id = auth.uid()
$$;
create function public.pode_ver_talhao(t public.talhoes) returns boolean language sql stable as $$
  select case when t.fazenda_id is null then t.criado_por = auth.uid() else public.papel_na_fazenda(t.fazenda_id) is not null end
$$;
create function public.pode_editar_talhao(fazenda uuid, autor uuid) returns boolean language sql stable as $$
  select case when fazenda is null then autor = auth.uid() else public.papel_na_fazenda(fazenda) in ('dono', 'agronomo') end
$$;

-- ------------------------------------------------------------------ permissões (RLS)
alter table public.perfis enable row level security;
alter table public.fazendas enable row level security;
alter table public.membros_fazenda enable row level security;
alter table public.talhoes enable row level security;
alter table public.analises enable row level security;

-- Perfis: o próprio e os colegas das mesmas fazendas.
create policy perfis_ver on public.perfis for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.membros_fazenda m where m.perfil_id = perfis.id and public.papel_na_fazenda(m.fazenda_id) is not null));
create policy perfis_editar on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Fazendas
create policy fazendas_ver on public.fazendas for select to authenticated using (public.papel_na_fazenda(id) is not null or criado_por = auth.uid());
create policy fazendas_criar on public.fazendas for insert to authenticated with check (criado_por = auth.uid());
create policy fazendas_editar on public.fazendas for update to authenticated using (public.papel_na_fazenda(id) in ('dono', 'agronomo'));
create policy fazendas_excluir on public.fazendas for delete to authenticated using (public.papel_na_fazenda(id) = 'dono');

-- Membros: todos os membros veem a equipe; só o dono convida ou remove.
create policy membros_ver on public.membros_fazenda for select to authenticated using (public.papel_na_fazenda(fazenda_id) is not null);
create policy membros_incluir on public.membros_fazenda for insert to authenticated with check (public.papel_na_fazenda(fazenda_id) = 'dono');
create policy membros_alterar on public.membros_fazenda for update to authenticated using (public.papel_na_fazenda(fazenda_id) = 'dono');
create policy membros_remover on public.membros_fazenda for delete to authenticated using (public.papel_na_fazenda(fazenda_id) = 'dono' or perfil_id = auth.uid());

-- Talhões
create policy talhoes_ver on public.talhoes for select to authenticated using (public.pode_ver_talhao(talhoes));
create policy talhoes_criar on public.talhoes for insert to authenticated with check (criado_por = auth.uid() and public.pode_editar_talhao(fazenda_id, criado_por));
create policy talhoes_editar on public.talhoes for update to authenticated
  using (public.pode_editar_talhao(fazenda_id, criado_por)) with check (public.pode_editar_talhao(fazenda_id, criado_por));
create policy talhoes_excluir on public.talhoes for delete to authenticated using (public.pode_editar_talhao(fazenda_id, criado_por));

-- Análises seguem o talhão.
create policy analises_ver on public.analises for select to authenticated using (
  exists (select 1 from public.talhoes t where t.id = talhao_id));  -- a RLS de talhoes já filtra
create policy analises_criar on public.analises for insert to authenticated with check (
  criado_por = auth.uid() and exists (select 1 from public.talhoes t where t.id = talhao_id and public.pode_editar_talhao(t.fazenda_id, t.criado_por)));
create policy analises_excluir on public.analises for delete to authenticated using (criado_por = auth.uid());

grant select on public.talhoes_mapa to authenticated;
