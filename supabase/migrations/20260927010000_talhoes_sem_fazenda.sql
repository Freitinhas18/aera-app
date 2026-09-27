-- Ao excluir uma fazenda, os talhões dela ficam sem fazenda (como no app), em vez de serem apagados juntos.
-- Um talhão sem fazenda fica visível só para quem o criou.
alter table public.talhoes drop constraint talhoes_fazenda_id_fkey;
alter table public.talhoes add constraint talhoes_fazenda_id_fkey
  foreign key (fazenda_id) references public.fazendas (id) on delete set null;
