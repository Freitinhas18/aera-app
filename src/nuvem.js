/* AERA · nuvem (Supabase): conta do usuário e cópia de fazendas, talhões e perfil no banco.
   O app continua gravando no navegador primeiro (funciona sem sinal no campo); esta camada envia e baixa. */
window.AeraNuvem = (function () {
  "use strict";
  // Chave pública (publishable): feita para ficar no app. As permissões ficam no banco (RLS).
  const PADRAO = { url: "https://ffdzfkiyngindiqzlcek.supabase.co", chave: "sb_publishable_f0ljjrfk2TIujnbz_hICng_Z2RMtjY2" };
  const cfg = Object.assign({}, PADRAO, window.AERA_SUPABASE || {});
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ehUuid = (id) => UUID.test(String(id || ""));
  let sb = null, usuario = null;

  function cliente() {
    if (!sb && window.supabase && window.supabase.createClient)
      sb = window.supabase.createClient(cfg.url, cfg.chave, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "aera.sessao" } });
    return sb;
  }
  const ok = (r) => { if (r.error) throw new Error(traduzir(r.error)); return r.data; };
  function traduzir(e) {
    const m = (e && (e.message || e.msg || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(m)) return "Confirme o e-mail pelo link que o Supabase enviou e tente de novo.";
    if (/User already registered/i.test(m)) return "Já existe uma conta com esse e-mail. Use “Entrar”.";
    if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
    if (/row-level security|permission denied/i.test(m)) return "Sem permissão para essa fazenda.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sem conexão com o servidor.";
    return m;
  }

  // ---------------------------------------------------------------- conta
  async function iniciar(aoMudar) {
    const c = cliente(); if (!c) return null;
    try { usuario = ((await c.auth.getSession()).data.session || {}).user || null; } catch (e) { usuario = null; }
    c.auth.onAuthStateChange((_ev, s) => { const antes = usuario && usuario.id; usuario = (s && s.user) || null; if ((usuario && usuario.id) !== antes && aoMudar) aoMudar(usuario); });
    return usuario;
  }
  async function entrar(email, senha) { usuario = ok(await cliente().auth.signInWithPassword({ email, password: senha })).user; return usuario; }
  async function criarConta(email, senha, nome) {
    const d = ok(await cliente().auth.signUp({ email, password: senha, options: { data: { nome } } }));
    usuario = d.session ? d.user : null;
    return { usuario, confirmar: !d.session };
  }
  async function sair() { if (cliente()) await cliente().auth.signOut(); usuario = null; }

  // ---------------------------------------------------------------- conversões app ⇄ banco
  const nulo = (v) => (v === "" || v == null || Number.isNaN(v) ? null : v);
  const fazParaBanco = (f) => ({ nome: f.nome, proprietario: nulo(f.proprietario), telefone: nulo(f.telefone), municipio: nulo(f.municipio),
    uf: nulo(f.uf), area_total_ha: nulo(f.areaTotal), car: nulo(f.car), implementos: f.implementos || [], obs: nulo(f.obs) });
  const fazDoBanco = (r) => ({ id: r.id, nome: r.nome, proprietario: r.proprietario || "", telefone: r.telefone || "", municipio: r.municipio || "",
    uf: r.uf || "", areaTotal: r.area_total_ha != null ? +r.area_total_ha : null, car: r.car || "", implementos: r.implementos || [], obs: r.obs || "",
    criado: r.criado_em, nuvem: true });
  function wkt(pts) {
    const anel = pts.concat([pts[0]]).map((p) => (+p[1]).toFixed(7) + " " + (+p[0]).toFixed(7)).join(",");
    return "SRID=4326;POLYGON((" + anel + "))";
  }
  const talParaBanco = (t, fazendaId) => ({ nome: t.nome, fazenda_id: fazendaId || null, especie: t.especie, contorno: wkt(t.pts),
    altitude_m: nulo(t.alt != null ? Math.round(t.alt) : null), temp_media: nulo(t.tmedia), declividade: nulo(t.declive), irrigacao: !!t.irrig,
    prod_atual: nulo(t.prodAtual), implementos: t.implementos || [], equipe_colheita: nulo(t.equipe), municipio: nulo(t.municipio), uf: nulo(t.uf), regiao: nulo(t.regiao) });
  function talDoBanco(r, analise) {
    const anel = r.contorno_geojson.coordinates[0].map((c) => [c[1], c[0]]);
    anel.pop(); // o GeoJSON repete o primeiro vértice no fim
    const n = anel.length, centro = { lat: anel.reduce((s, p) => s + p[0], 0) / n, lng: anel.reduce((s, p) => s + p[1], 0) / n };
    return { id: r.id, nome: r.nome, fazendaId: r.fazenda_id, especie: r.especie, pts: anel, centro, area: +r.area_ha,
      alt: r.altitude_m, tmedia: r.temp_media != null ? +r.temp_media : null, declive: r.declividade != null ? +r.declividade : null, irrig: r.irrigacao,
      prodAtual: r.prod_atual != null ? +r.prod_atual : null, implementos: r.implementos || [], equipe: r.equipe_colheita,
      municipio: r.municipio || "", uf: r.uf || "", regiao: r.regiao || "", data: r.atualizado_em, resultado: analise ? analise.resultado : null, nuvem: true };
  }

  // ---------------------------------------------------------------- dados
  async function salvarFazenda(f) {
    const c = cliente(), linha = fazParaBanco(f);
    const r = ehUuid(f.id) ? ok(await c.from("fazendas").update(linha).eq("id", f.id).select().single())
      : ok(await c.from("fazendas").insert(linha).select().single());
    return fazDoBanco(r);
  }
  async function salvarTalhao(t, fazendaId) {
    const c = cliente(), linha = talParaBanco(t, fazendaId);
    const r = ehUuid(t.id) ? ok(await c.from("talhoes").update(linha).eq("id", t.id).select("id").single())
      : ok(await c.from("talhoes").insert(linha).select("id").single());
    // Cada salvamento guarda também o resultado da análise (histórico).
    if (t.resultado) ok(await c.from("analises").insert({ talhao_id: r.id, parametros: { area_ha: t.area, alt: t.alt, tmedia: t.tmedia, irrig: t.irrig, implementos: t.implementos }, resultado: t.resultado }));
    return r.id;
  }
  async function excluir(tabela, id) {
    if (!ehUuid(id)) return;
    const apagados = ok(await cliente().from(tabela).delete().eq("id", id).select("id"));
    if (!apagados.length) throw new Error(tabela === "fazendas" ? "Só o dono pode excluir a fazenda." : "Sem permissão para excluir.");
  }
  async function baixarTudo() {
    const c = cliente();
    const [fs, ts, an] = await Promise.all([
      c.from("fazendas").select("*").order("nome"),
      c.from("talhoes_mapa").select("*").order("criado_em"),
      c.from("analises").select("talhao_id, resultado, criado_em").order("criado_em", { ascending: false }),
    ]).then((rs) => rs.map(ok));
    const ultima = {};
    an.forEach((a) => { if (!ultima[a.talhao_id]) ultima[a.talhao_id] = a; });
    return { fazendas: fs.map(fazDoBanco), talhoes: ts.map((r) => talDoBanco(r, ultima[r.id])) };
  }
  async function salvarPerfil(p) {
    if (!usuario) return;
    ok(await cliente().from("perfis").update({ nome: nulo(p.nome), funcao: nulo(p.funcao), registro: nulo(p.registro), empresa: nulo(p.empresa),
      email: nulo(p.email) || usuario.email, telefone: nulo(p.tel), especie: nulo(p.especie) }).eq("id", usuario.id));
  }
  async function lerPerfil() {
    if (!usuario) return null;
    return ok(await cliente().from("perfis").select("*").eq("id", usuario.id).maybeSingle());
  }

  // Envia o que está só no navegador (ids locais ou marcado como pendente) e aplica exclusões feitas sem conexão.
  // Devolve o mapa id antigo → id novo para o app atualizar o que estiver aberto.
  async function enviarPendentes(fazendas, talhoes, exclusoes) {
    const troca = {};
    for (const x of exclusoes) { try { await excluir(x.tabela, x.id); } catch (e) { /* já apagado ou sem permissão */ } }
    for (const f of fazendas) if (!ehUuid(f.id) || f.pendente) { const n = await salvarFazenda(f); troca[f.id] = n.id; }
    for (const t of talhoes) if (!ehUuid(t.id) || t.pendente) {
      const faz = t.fazendaId ? troca[t.fazendaId] || (ehUuid(t.fazendaId) ? t.fazendaId : null) : null;
      troca[t.id] = await salvarTalhao(t, faz);
    }
    return troca;
  }

  return {
    disponivel: () => !!cliente(), usuario: () => usuario, ehUuid,
    iniciar, entrar, criarConta, sair, salvarFazenda, salvarTalhao, excluir, baixarTudo, salvarPerfil, lerPerfil, enviarPendentes, traduzir,
  };
})();
