# Banco do AERA no Supabase

- `migrations/20260927000000_inicial.sql`: tabelas `perfis`, `fazendas`, `membros_fazenda`, `talhoes` (polígono em PostGIS, área e perímetro calculados pelo banco) e `analises`, com permissões por fazenda (dono, agrônomo, leitor).
- Para aplicar: no painel do Supabase, SQL Editor, cole e rode o arquivo. Ou, com a CLI, `supabase db push`.
- `testes/`: roda localmente num Postgres com PostGIS (`stub-supabase.sql` imita o schema `auth`; `rls.sql` testa quem vê e edita o quê).

Conferência: o talhão de exemplo dá 14,0300 ha e 1.523,1 m no PostGIS, igual ao cálculo do app.
