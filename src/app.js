/* AERA · esqueleto do app (HTML + JS puro, MapLibre GL + satélite Esri para o mapa, Open-Meteo para clima). */
(function () {
  "use strict";

  // ---------- utilidades ----------
  const $ = (s) => document.querySelector(s);
  const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fmt = (n, d = 0) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const guardar = {
    ler(k, pad) { try { const v = localStorage.getItem("aera." + k); return v == null ? pad : JSON.parse(v); } catch (e) { return pad; } },
    gravar(k, v) { try { localStorage.setItem("aera." + k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } },
  };
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg; t.setAttribute("role", "status");
    document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
  }
  // ---------------------------------------------------------------- validação de campos
  const soDigitos = (v) => String(v || "").replace(/\D/g, "");
  // (34) 99999-0000 para celular, (34) 3831-0000 para fixo
  function formatarTel(v) {
    const d = soDigitos(v).slice(0, 11);
    if (!d) return "";
    if (d.length <= 2) return "(" + d;
    const r = d.slice(2), corte = d.length === 11 ? 5 : 4;
    return "(" + d.slice(0, 2) + ") " + (r.length > corte ? r.slice(0, corte) + "-" + r.slice(corte) : r);
  }
  function telValido(v) {
    const d = soDigitos(v);
    if (!/^[1-9]{2}/.test(d)) return false;              // DDD de 11 a 99, sem zero
    if (d.length === 11) return d[2] === "9";             // celular: 9 dígitos começando com 9
    return d.length === 10 && /[2-5]/.test(d[2]);         // fixo: 8 dígitos começando de 2 a 5
  }
  const emailValido = (v) => v.length <= 120 && /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(v);
  const temLetras = (v, min) => v.trim().length >= min && /[a-zà-ú]/i.test(v);

  // Mostra o erro embaixo do campo e marca o campo; some quando a pessoa corrige.
  // A mensagem fica no fim do .campo; fora de um .campo (ex.: linha da coordenada), logo depois da linha.
  function erroCampo(el, msg) {
    const campo = el.closest(".campo");
    let s = document.getElementById("erro-" + el.id);
    if (!s) {
      s = document.createElement("small"); s.className = "erro-campo"; s.id = "erro-" + el.id; s.setAttribute("role", "alert");
      if (campo) campo.appendChild(s); else el.parentElement.after(s);
    }
    s.textContent = msg; el.setAttribute("aria-invalid", "true");
    if (campo) campo.classList.add("com-erro");
  }
  function limparErro(el) {
    const s = document.getElementById("erro-" + el.id); if (s) s.remove();
    el.removeAttribute("aria-invalid");
    const campo = el.closest(".campo"); if (campo) campo.classList.remove("com-erro");
  }
  // Recebe [[elemento, mensagem ou ""], ...]; marca os erros e leva ao primeiro. Devolve true se está tudo certo.
  function validar(regras, form) {
    if (form) form.querySelectorAll("[aria-invalid]").forEach(limparErro);
    const erros = regras.filter(([el, msg]) => el && msg);
    erros.forEach(([el, msg]) => erroCampo(el, msg));
    if (erros.length) {
      const el = erros[0][0], det = el.closest("details"); if (det) det.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => el.focus && el.focus({ preventScroll: true }), 300);
      toast(erros.length === 1 ? erros[0][1] : "Confira os " + erros.length + " campos marcados");
    }
    return !erros.length;
  }
  const numero = (el, min, max, nome, un) => {
    const v = el.value.trim();
    if (v === "") return "Informe " + nome + ".";
    const n = +v.replace(",", ".");
    return Number.isFinite(n) && n >= min && n <= max ? "" : nome[0].toUpperCase() + nome.slice(1) + " deve ficar entre " + min + " e " + max + (un ? " " + un : "") + ".";
  };
  const regraTel = (el, obrigatorio) => !el.value.trim() ? (obrigatorio ? "Informe o telefone com DDD." : "") : telValido(el.value) ? "" : "Telefone inválido. Use DDD + número, ex.: (34) 99999-0000.";
  const regraEmail = (el, obrigatorio) => !el.value.trim() ? (obrigatorio ? "Informe o e-mail." : "") : emailValido(el.value.trim()) ? "" : "E-mail inválido. Ex.: nome@exemplo.com";

  // Máscaras e limites aplicados a todos os formulários.
  function iniciarValidacao() {
    document.querySelectorAll('input[type="tel"]').forEach((el) => {
      el.maxLength = 15; el.inputMode = "tel";
      el.addEventListener("input", () => { el.value = formatarTel(el.value); });
    });
    document.querySelectorAll('input[type="email"]').forEach((el) => {
      el.maxLength = 120;
      el.addEventListener("input", () => { if (/\s/.test(el.value)) el.value = el.value.replace(/\s/g, ""); });
      el.addEventListener("blur", () => { el.value = el.value.trim().toLowerCase(); });
    });
    document.querySelectorAll('input[type="text"]').forEach((el) => { if (el.maxLength < 0 || el.maxLength > 500) el.maxLength = 80; });
    const limites = { "p-registro": 30, "f-car": 60, "f-obs": 300, "t-nome": 60, "coord": 60 };
    Object.keys(limites).forEach((id) => { const el = document.getElementById(id); if (el) el.maxLength = limites[id]; });
    document.addEventListener("input", (e) => { if (e.target.hasAttribute && e.target.hasAttribute("aria-invalid")) limparErro(e.target); });
    document.addEventListener("change", (e) => { if (e.target.hasAttribute && e.target.hasAttribute("aria-invalid")) limparErro(e.target); });
  }

  async function buscarJSON(url, ms = 5000) {
    const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    finally { clearTimeout(id); }
  }

  // ---------- regiões cafeeiras (atalhos) ----------
  const REGIOES = [
    { nome: "Patrocínio · Cerrado Mineiro", lat: -18.944, lng: -46.993 },
    { nome: "Varginha · Sul de Minas", lat: -21.551, lng: -45.430 },
    { nome: "Franca · Alta Mogiana", lat: -20.539, lng: -47.401 },
    { nome: "Manhuaçu · Matas de Minas", lat: -20.258, lng: -42.034 },
    { nome: "Venda Nova do Imigrante · ES", lat: -20.339, lng: -41.135 },
    { nome: "Cacoal · Rondônia (conilon)", lat: -11.438, lng: -61.447 },
  ];

  // ---------- navegação por abas (#inicio / #talhao) ----------
  const TELAS = ["inicio", "talhao", "fazendas", "noticias", "perfil", "entrar", "resultado"];
  function rota() {
    const h = location.hash.replace("#", "");
    const tela = TELAS.includes(h) ? h : "inicio";
    TELAS.forEach((t) => { $("#tela-" + t).hidden = t !== tela; });
    document.body.classList.toggle("modo-entrar", tela === "entrar");
    const aba = tela === "resultado" ? "talhao" : tela; // o resultado pertence à aba Talhão
    document.querySelectorAll(".nav a").forEach((a) => {
      if (a.dataset.tela === aba) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (tela === "talhao") iniciarMapa();
    if (tela === "perfil") preencherFormPerfil();
    if (tela === "entrar") abrirEntrar();
    if (tela === "resultado") renderResultado();
    if (tela === "fazendas") renderFazendas();
    if (tela === "noticias" && !noticiasCarregadas) carregarNoticias();
    if (tela === "talhao" && estado.fazendaPre) { const f = estado.fazendaPre; estado.fazendaPre = null; setTimeout(() => novoTalhaoNaFazenda(f), 80); }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", rota);

  // ================================================================
  // INÍCIO: saudação + clima
  // ================================================================
  const ICONES = {
    sol: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="#E3A82B"/><g stroke="#E3A82B" stroke-width="3" stroke-linecap="round"><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5"/></g></svg>',
    parcial: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="17" r="7" fill="#E3A82B"/><path d="M15 38h20a7 7 0 0 0 0-14 10 10 0 0 0-19 3 5.5 5.5 0 0 0-1 11z" fill="#fff" stroke="#253946" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    nuvem: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 36h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3.5A6.3 6.3 0 0 0 13 36z" fill="#fff" stroke="#253946" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    chuva: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 30h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3.5A6.3 6.3 0 0 0 13 30z" fill="#fff" stroke="#253946" stroke-width="2.5" stroke-linejoin="round"/><g stroke="#5F8A2E" stroke-width="2.5" stroke-linecap="round"><path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5"/></g></svg>',
    trovoada: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 29h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3.5A6.3 6.3 0 0 0 13 29z" fill="#fff" stroke="#253946" stroke-width="2.5" stroke-linejoin="round"/><path d="M25 31l-5 8h6l-3 7" fill="none" stroke="#E3A82B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    neblina: '<svg viewBox="0 0 48 48" aria-hidden="true"><g stroke="#253946" stroke-width="2.5" stroke-linecap="round"><path d="M9 18h30M6 25h36M11 32h26"/></g></svg>',
  };
  function tempoWMO(c) {
    if (c === 0) return ["Céu limpo", "sol"];
    if (c <= 2) return ["Parcialmente nublado", "parcial"];
    if (c === 3) return ["Nublado", "nuvem"];
    if (c === 45 || c === 48) return ["Neblina", "neblina"];
    if (c >= 51 && c <= 57) return ["Garoa", "chuva"];
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return ["Chuva", "chuva"];
    if (c >= 95) return ["Trovoada", "trovoada"];
    return ["Instável", "nuvem"];
  }

  function climaExemplo(reg) {
    // Série fixa e plausível para a prévia offline. Marcada como "Exemplo" na tela.
    const hoje = new Date();
    const dias = [], base = [[29, 17, 0, 1, 9], [30, 18, 0, 2, 11], [28, 18, 6, 61, 14], [25, 17, 22, 63, 16], [26, 16, 3, 80, 12], [27, 14, 0, 1, 8], [28, 15, 0, 0, 7]];
    base.forEach((b, i) => { const d = new Date(hoje); d.setDate(d.getDate() + i); dias.push({ data: d, max: b[0], min: b[1], chuva: b[2], cod: b[3], vento: b[4] }); });
    return { fonte: "exemplo", agora: { t: 26, ur: 58, vento: 9, chuva: 0, cod: 1 }, dias, regiao: reg.nome };
  }

  async function climaReal(reg) {
    const u = "https://api.open-meteo.com/v1/forecast?latitude=" + reg.lat + "&longitude=" + reg.lng +
      "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7";
    const j = await buscarJSON(u);
    const d = j.daily;
    return {
      fonte: "vivo", regiao: reg.nome,
      agora: { t: j.current.temperature_2m, ur: j.current.relative_humidity_2m, vento: j.current.wind_speed_10m, chuva: d.precipitation_sum[0], cod: j.current.weather_code },
      dias: d.time.map((t, i) => ({ data: new Date(t + "T12:00:00"), max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], chuva: d.precipitation_sum[i], cod: d.weather_code[i], vento: d.wind_speed_10m_max[i] })),
    };
  }

  function janelasManejo(c) {
    const out = [];
    const dsem = (d) => d.data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    // Pulverização: vento máx < 12 km/h e chuva < 2 mm
    const boas = c.dias.filter((d) => d.vento < 12 && d.chuva < 2);
    out.push(boas.length
      ? { nivel: "ok", t: "Pulverização", p: "Vento abaixo de 12 km/h e sem chuva em " + boas.slice(0, 4).map(dsem).join(", ") + ".", e: boas.length + " dias bons" }
      : { nivel: "atencao", t: "Pulverização", p: "Nenhum dia com vento baixo e tempo seco na semana.", e: "Sem janela" });
    // Geada
    const minimo = Math.min(...c.dias.map((d) => d.min));
    out.push(minimo <= 3
      ? { nivel: "risco", t: "Risco de geada", p: "Mínima prevista de " + fmt(minimo, 0) + " °C. Avalie proteção das mudas e baixadas.", e: "Alto" }
      : minimo <= 6
        ? { nivel: "atencao", t: "Risco de geada", p: "Mínima de " + fmt(minimo, 0) + " °C. Acompanhe as baixadas.", e: "Moderado" }
        : { nivel: "ok", t: "Risco de geada", p: "Mínima da semana em " + fmt(minimo, 0) + " °C.", e: "Baixo" });
    // Balanço de chuva
    const soma = c.dias.reduce((s, d) => s + d.chuva, 0);
    const maxT = Math.max(...c.dias.map((d) => d.max));
    out.push(soma < 5 && maxT >= 30
      ? { nivel: "atencao", t: "Déficit hídrico", p: "Só " + fmt(soma, 0) + " mm previstos com máximas de " + fmt(maxT, 0) + " °C. Priorize irrigação.", e: "Atenção" }
      : { nivel: "ok", t: "Chuva na semana", p: fmt(soma, 0) + " mm previstos nos 7 dias.", e: fmt(soma, 0) + " mm" });
    // Adubação antes da chuva
    const idx = c.dias.findIndex((d) => d.chuva >= 10);
    out.push(idx > 0
      ? { nivel: "ok", t: "Adubação de cobertura", p: "Chuva de " + fmt(c.dias[idx].chuva, 0) + " mm prevista para " + dsem(c.dias[idx]) + ". Aplique até a véspera.", e: "Janela aberta" }
      : { nivel: "atencao", t: "Adubação de cobertura", p: idx === 0 ? "Chuva forte hoje. Evite aplicar para não perder adubo." : "Sem chuva de 10 mm ou mais na semana para incorporar o adubo.", e: "Aguardar" });
    return out;
  }

  function desenharClima(c) {
    const hoje = c.dias[0];
    const [desc, ic] = tempoWMO(c.agora.cod);
    $("#clima-fonte").className = "selo " + c.fonte;
    $("#clima-fonte").textContent = c.fonte === "vivo" ? "Open-Meteo · ao vivo" : "Dados de exemplo";
    $("#clima-icone").innerHTML = ICONES[ic];
    $("#clima-t").innerHTML = fmt(c.agora.t, 0) + "<sup>°C</sup>";
    $("#clima-desc").textContent = desc;
    $("#clima-ur").textContent = fmt(c.agora.ur, 0) + "%";
    $("#clima-vento").textContent = fmt(c.agora.vento, 0) + " km/h";
    $("#clima-chuva").textContent = fmt(hoje.chuva, 1) + " mm";
    $("#resumo-dia").textContent = "Máxima de " + fmt(hoje.max, 0) + " °C e mínima de " + fmt(hoje.min, 0) + " °C hoje em " + c.regiao.split(" · ")[0] + "." + (c.fonte === "exemplo" ? " (Previsão de exemplo, sem conexão com o serviço de clima.)" : "");
    $("#previsao").innerHTML = c.dias.map((d, i) => {
      const [dd, ii] = tempoWMO(d.cod);
      const rot = i === 0 ? "Hoje" : d.data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return '<div class="dia" title="' + dd + '"><span class="d">' + rot + "</span>" + ICONES[ii] +
        '<span class="mx num">' + fmt(d.max, 0) + '°</span><span class="mn num">' + fmt(d.min, 0) + '°</span><span class="chuva num">' + (d.chuva >= 0.5 ? fmt(d.chuva, 0) + " mm" : "") + "</span></div>";
    }).join("");
    $("#janelas").innerHTML = janelasManejo(c).map((j) =>
      '<div class="janela ' + j.nivel + '"><i></i><div><b>' + j.t + "</b><p>" + j.p + "</p></div><em>" + j.e + "</em></div>").join("");
  }

  async function carregarClima(reg) {
    $("#clima-fonte").textContent = "Carregando";
    let c;
    try { c = await climaReal(reg); } catch (e) { c = climaExemplo(reg); }
    desenharClima(c);
  }

  // ---------- perfil ----------
  function lerPerfil() {
    const p = guardar.ler("perfil", null);
    if (p) return p;
    const nome = guardar.ler("nome", ""); // versão anterior guardava só o nome
    return nome ? { nome } : {};
  }
  const primeiroNome = (n) => (n || "").trim().split(/\s+/)[0] || "";
  function iniciais(n) {
    const p = (n || "").trim().split(/\s+/).filter(Boolean);
    return p.length ? (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() : "";
  }
  const AVATAR_VAZIO = '<svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true"><circle cx="12" cy="9" r="4" fill="currentColor"/><path d="M4 21a8 8 0 0 1 16 0z" fill="currentColor"/></svg>';
  function pintarAvatares(p) {
    document.querySelectorAll("[data-avatar]").forEach((el) => {
      if (p.foto) { el.style.backgroundImage = "url(" + p.foto + ")"; el.innerHTML = ""; }
      else { el.style.backgroundImage = ""; el.innerHTML = iniciais(p.nome) || AVATAR_VAZIO; }
    });
  }
  function mostrarPerfil() {
    const p = lerPerfil();
    pintarAvatares(p);
    $("#mini-nome").textContent = p.nome || "Perfil não configurado";
    const reg = REGIOES[guardar.ler("regiao", 0)] || REGIOES[0];
    $("#mini-info").textContent = p.nome ? [p.funcao, p.empresa, reg.nome.split(" · ")[0]].filter(Boolean).join(" · ") : "Adicione sua foto, função e região.";
    saudar();
  }
  let fotoTemp = null;
  function preencherFormPerfil() {
    const p = lerPerfil();
    fotoTemp = p.foto || null;
    $("#p-nome").value = p.nome || "";
    if (p.funcao) $("#p-funcao").value = p.funcao;
    $("#p-registro").value = p.registro || "";
    $("#p-empresa").value = p.empresa || "";
    $("#p-email").value = p.email || "";
    $("#p-tel").value = p.tel || "";
    $("#p-regiao").value = String(guardar.ler("regiao", 0));
    $("#p-especie").value = p.especie || "arabica";
    const novo = !p.nome, u = logado() ? nuvem.usuario() : null;
    // Logado, o e-mail do perfil é o da conta.
    if (u) $("#p-email").value = u.email;
    $("#p-email").readOnly = !!u;
    // Passo 2 do cadastro: conta criada, dados ainda não preenchidos.
    const completar = !!u && novo;
    $("#conta").hidden = completar;
    $("#perfil-rotulo").textContent = completar ? "Passo 2 de 2" : novo ? "Primeiro acesso" : "Configurações";
    $("#perfil-rotulo").classList.toggle("primeiro-acesso", novo);
    $("#t-perfil2").textContent = completar ? "Complete seu cadastro" : novo ? "Vamos configurar seu perfil" : "Quem está usando o AERA";
    $("#perfil-intro").textContent = completar ? "Sua conta foi criada. Preencha seus dados: eles ficam guardados no seu perfil, no banco." :
      "Esses dados personalizam a saudação, o clima e os padrões da análise de talhão.";
    $("#perfil-msg").textContent = "";
    pintarAvatares(p);
  }
  function reduzirFoto(arquivo) {
    return new Promise((ok, erro) => {
      const leitor = new FileReader();
      leitor.onerror = erro;
      leitor.onload = () => {
        const img = new Image();
        img.onerror = erro;
        img.onload = () => {
          const lado = 256, c = document.createElement("canvas");
          c.width = c.height = lado;
          const m = Math.min(img.width, img.height);
          c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
          ok(c.toDataURL("image/jpeg", 0.85));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }
  function iniciarPerfil() {
    $("#p-regiao").innerHTML = REGIOES.map((r, i) => '<option value="' + i + '">' + r.nome + "</option>").join("");
    $("#foto").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        fotoTemp = await reduzirFoto(f);
        pintarAvatares(Object.assign({}, lerPerfil(), { nome: $("#p-nome").value, foto: fotoTemp }));
        $("#perfil-msg").textContent = "Foto carregada. Toque em Salvar perfil para guardar.";
      } catch (err) { toast("Não foi possível abrir essa imagem. Tente um JPG ou PNG."); }
      e.target.value = "";
    });
    $("#btn-sem-foto").addEventListener("click", () => {
      fotoTemp = null;
      pintarAvatares(Object.assign({}, lerPerfil(), { nome: $("#p-nome").value, foto: null }));
    });
    $("#p-nome").addEventListener("input", () => { if (!fotoTemp) pintarAvatares({ nome: $("#p-nome").value }); });
    $("#form-perfil").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = $("#p-nome").value.trim().replace(/\s+/g, " ");
      $("#perfil-msg").textContent = "";
      if (!validar([
        [$("#p-nome"), temLetras(nome, 3) ? "" : "Informe seu nome completo."],
        [$("#p-email"), regraEmail($("#p-email"), true)],
        [$("#p-tel"), regraTel($("#p-tel"), true)],
      ], $("#form-perfil"))) return;
      const p = { nome, funcao: $("#p-funcao").value, registro: $("#p-registro").value.trim(), empresa: $("#p-empresa").value.trim(),
        email: $("#p-email").value.trim().toLowerCase(), tel: formatarTel($("#p-tel").value), especie: $("#p-especie").value, foto: fotoTemp };
      guardar.gravar("perfil", p);
      let ondeFicou = "Perfil salvo neste aparelho";
      if (logado()) {
        $("#perfil-msg").textContent = "Salvando na sua conta…";
        try { await nuvem.salvarPerfil(p); ondeFicou = "Perfil salvo na sua conta"; }
        catch (err) { ondeFicou = "Perfil salvo no aparelho. A conta não respondeu: " + nuvem.traduzir(err); }
      }
      if (lerPerfil().foto !== p.foto && p.foto) toast("A foto não coube no armazenamento do navegador");
      const reg = +$("#p-regiao").value;
      if (reg !== guardar.ler("regiao", 0)) { guardar.gravar("regiao", reg); $("#regiao").value = String(reg); carregarClima(REGIOES[reg]); }
      if (!estado.mapa) definirEspecie(p.especie);
      mostrarPerfil();
      toast(ondeFicou);
      location.hash = "inicio";
    });
  }

  function saudar() {
    const h = new Date().getHours();
    const nome = primeiroNome(lerPerfil().nome);
    const sd = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
    $("#ola").innerHTML = sd + ', <span id="nome-exib"></span>';
    $("#nome-exib").textContent = nome || "agrônomo";
    const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    $("#hoje").textContent = hoje;
  }

  function iniciarInicio() {
    mostrarPerfil();
    const sel = $("#regiao");
    sel.innerHTML = REGIOES.map((r, i) => '<option value="' + i + '">' + r.nome + "</option>").join("");
    sel.value = String(guardar.ler("regiao", 0));
    sel.addEventListener("change", () => { guardar.gravar("regiao", +sel.value); carregarClima(REGIOES[+sel.value]); mostrarPerfil(); });
    $("#btn-local").addEventListener("click", () => {
      if (!navigator.geolocation) return toast("Localização indisponível. Escolha uma região na lista.");
      navigator.geolocation.getCurrentPosition(
        (p) => carregarClima({ nome: "Sua localização", lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4) }),
        () => toast("Não foi possível obter sua localização. Escolha uma região na lista."),
        { timeout: 6000 });
    });
    carregarClima(REGIOES[+sel.value] || REGIOES[0]);
    listarSalvos();
  }

  // ================================================================
  // TALHÃO: mapa, delimitação, área, produtividade e cenários
  // ================================================================
  const REFS = [
    "CONAB. Acompanhamento da safra brasileira de café. Brasília: Companhia Nacional de Abastecimento, boletins trimestrais (produtividade média por estado e espécie).",
    "PEREIRA, S. P.; BARTHOLO, G. F.; BALIZA, D. P.; SOBREIRA, F. M.; GUIMARÃES, R. J. Crescimento, produtividade e bienalidade do cafeeiro em função do espaçamento de cultivo. Pesquisa Agropecuária Brasileira, v. 46, n. 2, p. 152-160, 2011.",
    "CAMARGO, A. P. O clima e a cafeicultura no Brasil. Informe Agropecuário, Belo Horizonte, v. 11, n. 126, p. 13-26, 1985 (faixas térmicas de aptidão do arábica).",
    "MATIELLO, J. B.; SANTINATO, R.; ALMEIDA, S. R.; GARCIA, A. W. R. Cultura de café no Brasil: manual de recomendações. Varginha: Fundação Procafé, 2015.",
    "FERRÃO, R. G. et al. (ed.). Café Conilon. 2. ed. Vitória: Incaper, 2017.",
    "FERNANDES, A. L. T.; PARTELLI, F. L.; BONOMO, R.; GOLYNSKI, A. A moderna cafeicultura dos cerrados brasileiros. Pesquisa Agropecuária Tropical, v. 42, n. 2, p. 231-240, 2012.",
    "OLIVEIRA, E.; SILVA, F. M.; SALVADOR, N.; SOUZA, Z. M.; CHALFOUN, S. M.; FIGUEIREDO, C. A. P. Custos operacionais da colheita mecanizada do cafeeiro. Pesquisa Agropecuária Brasileira, v. 42, n. 6, p. 827-831, 2007.",
    "BARBOSA, J. A.; SALVADOR, N.; SILVA, F. M. Desempenho operacional de derriçadores mecânicos portáteis, em diferentes condições de lavouras cafeeiras. Revista Brasileira de Engenharia Agrícola e Ambiental, v. 9, n. 1, p. 129-132, 2005.",
    "SANTINATO, F.; SILVA, R. P.; SILVA, V. A.; SILVA, C. D.; TAVARES, T. O. Colheita mecanizada do café em elevadas declividades. Revista Caatinga, v. 29, n. 3, p. 685-691, 2016.",
    "SILVA, F. M.; SILVA, F. C.; SILVA, F. O.; SILVA, D. H. Viabilidade técnica e econômica da colheita mecanizada do café. Visão Agrícola, Piracicaba, n. 12, p. 98-101, 2013.",
    "CUNHA, J. P. B.; SILVA, F. M.; DIAS, R. E. B. A.; LISBOA, C.; MACHADO, T. A. Economic viability for different coffee harvest systems. Coffee Science, v. 11, n. 3, p. 416-425, 2016.",
    "JACTO. 6 passos para escolher a melhor colhedora de café (entrelinha mínima de 2,80 m, plantas de 1,20 a 4,50 m, declividade até 20%). Blog Jacto, consultado em set. 2026.",
  ];

  // Faixas de produtividade (sc/ha, lavoura adulta) = parâmetros de protótipo a validar.
  const CENARIOS = {
    arabica: [
      { id: "trad", nome: "Tradicional", e: [4.0, 1.0], faixa: [18, 28], med: 23, colheita: "30 a 36 meses", irrig: false, refs: [1, 4],
        obs: "Menor custo de implantação e manejo simples. Menos plantas por hectare limitam a produtividade." },
      { id: "semi", nome: "Semiadensado mecanizado", e: [3.5, 0.7], faixa: [25, 38], med: 31, colheita: "24 a 30 meses", irrig: false, refs: [2, 4],
        obs: "Padrão no Cerrado e no Sul de Minas. Equilibra produtividade com colheita mecanizada." },
      { id: "aden", nome: "Adensado", e: [2.5, 0.6], faixa: [30, 48], med: 38, colheita: "24 a 30 meses", irrig: false, refs: [2, 4],
        obs: "Mais sacas por hectare nas primeiras safras. Exige poda programada e colheita semimecanizada." },
      { id: "irri", nome: "Semiadensado irrigado", e: [3.5, 0.5], faixa: [40, 65], med: 50, colheita: "18 a 24 meses", irrig: true, refs: [6, 4],
        obs: "Gotejamento com fertirrigação reduz o déficit hídrico e a bienalidade. Maior investimento inicial." },
    ],
    conilon: [
      { id: "sem", nome: "Seminal tradicional", e: [3.0, 2.0], faixa: [20, 35], med: 27, colheita: "24 a 30 meses", irrig: false, refs: [5, 1],
        obs: "Lavoura de sementes, desuniforme. Referência de baixo investimento." },
      { id: "clon", nome: "Clonal sequeiro", e: [3.0, 1.0], faixa: [35, 55], med: 44, colheita: "18 a 24 meses", irrig: false, refs: [5],
        obs: "Variedades clonais recomendadas regionalmente, com poda programada de ciclo." },
      { id: "cloi", nome: "Clonal irrigado", e: [3.0, 1.0], faixa: [60, 90], med: 72, colheita: "18 a 24 meses", irrig: true, refs: [5, 1],
        obs: "Sistema predominante nas lavouras de alto rendimento do Espírito Santo e de Rondônia." },
      { id: "clai", nome: "Clonal adensado irrigado", e: [2.5, 0.8], faixa: [70, 110], med: 85, colheita: "18 a 24 meses", irrig: true, refs: [5],
        obs: "Maior população de hastes por hectare. Exige manejo fino de nutrição e poda." },
    ],
  };

  // Aptidão térmica simplificada (temperatura média anual).
  function aptidao(esp, t) {
    const f = esp === "arabica"
      ? (t >= 18 && t <= 22 ? [1, "Apta", "ok", "Faixa de 18 a 22 °C para arábica"]
        : t > 22 && t <= 23 ? [0.85, "Restrita", "atencao", "Calor acima do ideal para arábica"]
          : t >= 17 && t < 18 ? [0.85, "Restrita", "atencao", "Frio e risco de geada"]
            : [0.6, "Inapta", "risco", t > 23 ? "Muito quente para arábica" : "Muito frio para arábica"])
      : (t >= 22 && t <= 26 ? [1, "Apta", "ok", "Faixa de 22 a 26 °C para conilon"]
        : (t >= 21 && t < 22) || (t > 26 && t <= 27) ? [0.85, "Restrita", "atencao", "Fora da faixa ideal do conilon"]
          : [0.6, "Inapta", "risco", t < 21 ? "Frio demais para conilon" : "Quente demais para conilon"]);
    return { fator: f[0], rotulo: f[1], nivel: f[2], motivo: f[3] };
  }
  const tempPorAltitude = (alt, lat) => +(28.3 - 0.006 * alt - 0.3 * Math.max(0, Math.abs(lat) - 15)).toFixed(1);

  // Área e perímetro no elipsoide WGS 84: projeção plana local com os raios de curvatura
  // (meridiano e vertical primeira) no centro do talhão. Para talhões de até alguns km o
  // resultado difere menos de 0,01% do cálculo geodésico exato (conferido com pyproj.Geod).
  // A fórmula esférica anterior (raio equatorial) superestimava a área em cerca de 0,5%.
  function medirPoligono(lista) {
    const pts = lista.map((q) => (Array.isArray(q) ? { lat: q[0], lng: q[1] } : q));
    const a = 6378137, e2 = 0.00669437999014, d = Math.PI / 180, n = pts.length;
    const la0 = pts.reduce((s, p) => s + p.lat, 0) / n, lo0 = pts.reduce((s, p) => s + p.lng, 0) / n;
    const sen = Math.sin(la0 * d), w = 1 - e2 * sen * sen;
    const kx = d * a / Math.sqrt(w) * Math.cos(la0 * d), ky = d * a * (1 - e2) / Math.pow(w, 1.5);
    const xy = pts.map((p) => [(p.lng - lo0) * kx, (p.lat - la0) * ky]);
    let dupla = 0; const lados = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % n];
      dupla += x1 * y2 - x2 * y1; lados.push(Math.hypot(x2 - x1, y2 - y1));
    }
    return { area: n >= 3 ? Math.abs(dupla) / 2 : 0, perim: lados.reduce((s, x) => s + x, 0), lados };
  }
  const areaGeo = (pts) => medirPoligono(pts).area;

  // Lê vértices colados: "lat, lng" por linha (ponto ou vírgula decimal, separados por vírgula, ; ou tab),
  // GeoJSON (Polygon/Feature) ou <coordinates> de KML do Google Earth (lng,lat[,alt]).
  function lerCoordenadas(txt) {
    txt = String(txt || "").trim(); let pts = [];
    const valido = (p) => p.length === 2 && p.every((x) => isFinite(x)) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
    try {
      if (txt[0] === "{") {
        const j = JSON.parse(txt), g = j.type === "FeatureCollection" ? j.features[0].geometry : j.geometry || j;
        const anel = g.type === "MultiPolygon" ? g.coordinates[0][0] : g.coordinates[0];
        pts = anel.map((c) => [+c[1], +c[0]]);
      } else if (/<coordinates>/i.test(txt)) {
        pts = txt.split(/<coordinates>/i)[1].split(/<\/coordinates>/i)[0].trim().split(/\s+/).map((t) => { const c = t.split(","); return [+c[1], +c[0]]; });
      } else {
        pts = txt.split(/\n+/).map((l) => {
          l = l.trim(); if (!l) return null;
          let c;
          if (/[\t;]/.test(l)) c = l.split(/[\t;]+/).map((x) => x.trim().replace(",", "."));
          else { const v = l.split(","); c = v.length === 4 ? [v[0] + "." + v[1], v[2] + "." + v[3]] : v.length === 2 ? v : l.split(/\s+/); }
          return c.slice(0, 2).map((x) => parseFloat(String(x).trim()));
        }).filter(Boolean);
      }
    } catch (e) { pts = []; }
    pts = pts.filter(valido);
    if (pts.length > 3) { const a = pts[0], b = pts[pts.length - 1]; if (a[0] === b[0] && a[1] === b[1]) pts.pop(); }
    return pts;
  }

  // ---------- município e UF pela coordenada ----------
  const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
  // Referência offline: principais municípios cafeeiros (usada só quando não há internet).
  const CIDADES_CAFE = [
    ["Patrocínio", "MG", -18.944, -46.993, "Cerrado Mineiro"], ["Araguari", "MG", -18.647, -48.187, "Cerrado Mineiro"],
    ["Monte Carmelo", "MG", -18.725, -47.499, "Cerrado Mineiro"], ["Coromandel", "MG", -18.473, -47.2, "Cerrado Mineiro"],
    ["Carmo do Paranaíba", "MG", -19.001, -46.316, "Cerrado Mineiro"], ["Campos Altos", "MG", -19.696, -46.172, "Cerrado Mineiro"],
    ["Três Pontas", "MG", -21.367, -45.512, "Sul de Minas"], ["Varginha", "MG", -21.551, -45.43, "Sul de Minas"],
    ["Machado", "MG", -21.675, -45.919, "Sul de Minas"], ["Guaxupé", "MG", -21.305, -46.712, "Sul de Minas"],
    ["Boa Esperança", "MG", -21.09, -45.566, "Sul de Minas"], ["Lavras", "MG", -21.245, -45.0, "Sul de Minas"],
    ["Manhuaçu", "MG", -20.258, -42.028, "Matas de Minas"], ["Caratinga", "MG", -19.79, -42.139, "Matas de Minas"],
    ["Franca", "SP", -20.539, -47.401, "Alta Mogiana"], ["Garça", "SP", -22.212, -49.656, "Centro-Oeste Paulista"],
    ["Luís Eduardo Magalhães", "BA", -12.096, -45.786, "Oeste da Bahia"], ["Vitória da Conquista", "BA", -14.866, -40.839, "Planalto da Bahia"],
    ["Linhares", "ES", -19.391, -40.072, "Norte do Espírito Santo"], ["São Gabriel da Palha", "ES", -19.017, -40.537, "Norte do Espírito Santo"],
    ["Venda Nova do Imigrante", "ES", -20.339, -41.135, "Montanhas do Espírito Santo"], ["Cacoal", "RO", -11.438, -61.447, "Matas de Rondônia"],
    ["Londrina", "PR", -23.31, -51.163, "Norte do Paraná"],
  ];
  const semAcento = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cacheIBGE = {};
  async function regiaoIBGE(mun, uf) {
    try {
      if (!cacheIBGE[uf]) cacheIBGE[uf] = await buscarJSON("https://servicodados.ibge.gov.br/api/v1/localidades/estados/" + uf + "/municipios", 8000);
      const m = cacheIBGE[uf].find((x) => semAcento(x.nome).toLowerCase() === semAcento(mun).toLowerCase());
      const ri = m && m["regiao-imediata"] && m["regiao-imediata"]["regiao-intermediaria"];
      return ri ? ri.nome : m && m.microrregiao ? m.microrregiao.mesorregiao.nome : "";
    } catch (e) { return ""; }
  }
  async function buscarMunicipio(lat, lng) {
    try {
      const j = await buscarJSON("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + lat + "&longitude=" + lng + "&localityLanguage=pt", 6000);
      const adm = ((j.localityInfo && j.localityInfo.administrative) || []).find((x) => x.adminLevel === 8);
      const mun = (adm && adm.name) || j.city || j.locality;
      if (mun) return { municipio: mun, uf: String(j.principalSubdivisionCode || "").replace(/^BR-/, ""), fonte: "BigDataCloud" };
    } catch (e) { /* tenta o próximo serviço */ }
    try {
      // Nominatim: 1 consulta por clique em “Localizar”, dentro da política de uso do OpenStreetMap.
      const j = await buscarJSON("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=pt-BR&lat=" + lat + "&lon=" + lng, 6000);
      const a = j.address || {}, mun = a.city || a.town || a.village || a.municipality || a.county;
      if (mun) return { municipio: mun, uf: String(a["ISO3166-2-lvl4"] || "").replace(/^BR-/, ""), fonte: "OpenStreetMap (Nominatim)" };
    } catch (e) { /* sem conexão */ }
    let perto = null, dmin = 40000;
    CIDADES_CAFE.forEach((c) => { const dd = window.AeraImagens.distancia([lat, lng], [c[2], c[3]]); if (dd < dmin) { dmin = dd; perto = c; } });
    return perto ? { municipio: perto[0], uf: perto[1], regiao: perto[4], offline: true,
      fonte: "sem conexão, município cafeeiro mais próximo (" + fmt(dmin / 1000, 0) + " km). Confira" } : null;
  }
  let seqLocal = 0;
  async function preencherLocal(lat, lng) {
    const seq = ++seqLocal;
    $("#local-fonte").textContent = "Buscando município…";
    const r = await buscarMunicipio(lat, lng);
    if (seq !== seqLocal) return;
    if (!r) { estado.regiao = ""; $("#local-fonte").textContent = "Município não encontrado. Informe manualmente."; return; }
    if (!r.regiao && r.uf) r.regiao = await regiaoIBGE(r.municipio, r.uf);
    if (seq !== seqLocal) return;
    $("#t-mun").value = r.municipio; $("#t-uf").value = UFS.includes(r.uf) ? r.uf : "";
    estado.regiao = r.regiao || "";
    $("#local-fonte").textContent = (r.regiao ? r.regiao + " · " : "") + r.fonte;
    resumoAuto();
  }
  function resumoAuto() {
    const d = $("#declive").value;
    $("#auto-resumo").textContent = [localTalhao() || "Município?", fmt(+$("#altitude").value || 0, 0) + " m", fmt(+$("#tmedia").value || 0, 1) + " °C", "declive " + (d || "?") + "%"].join(" · ");
  }
  const localTalhao = () => [$("#t-mun").value.trim(), $("#t-uf").value].filter(Boolean).join("/");

  // ---------- nome dos arquivos exportados ----------
  const limparNome = (x) => semAcento(x).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  function dataArquivo() { const x = new Date(); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  // Ex.: AERA_Relatorio_Fazenda-Santa-Clara_Talhao-3_Jose-Almeida_2026-09-26.docx
  const nomeArquivo = (tipo, partes, ext) => ["AERA", tipo].concat(partes.map(limparNome).filter(Boolean), dataArquivo()).join("_") + "." + ext;

  // ---------- máquinas e implementos: efeito na colheita ----------
  const IMPLEMENTOS = [
    ["derri", "Derriçadora portátil"], ["auto", "Colhedora automotriz"], ["trac", "Colhedora tracionada"], ["recol", "Recolhedora (café do chão)"],
    ["trator", "Trator cafeeiro"], ["pulv", "Pulverizador / atomizador"], ["adub", "Adubadora"],
  ];
  const nomeImpl = (id) => (IMPLEMENTOS.find((x) => x[0] === id) || [id, id])[1];
  const implMarcados = () => IMPLEMENTOS.filter((x) => $("#impl-" + x[0]).checked).map((x) => x[0]);
  const marcarImplementos = (lista) => { IMPLEMENTOS.forEach((x) => { $("#impl-" + x[0]).checked = lista.includes(x[0]); }); $("#impl-nenhum").checked = !lista.length; };
  const textoImplementos = (lista) => (lista && lista.length ? lista.map(nomeImpl).join(", ") : "Nenhum (colheita manual)");

  // Parâmetros de estudos de campo; os números entre colchetes são as referências.
  const COLHEITA = {
    hhManual: 376,      // homem-hora/ha na colheita manual, para 30.555 L/ha de café da roça [7]
    cargaRef: 64,       // ≈ 30.555 L ÷ 480 L de café da roça por saca beneficiada (conversão aproximada)
    derriFator: 3.51,   // derriçadora portátil: rendimento 251% maior que a manual [8]
    hMaq: 4,            // 3,14 a 4,77 h de colhedora por hectare, em duas passadas [7]
    entrelinhaMin: 2.8, // entrelinha mínima para colhedoras [12]
    decliveMax: 20,     // declividade máxima indicada pelos fabricantes [12]
    extraDeclive: 1.216,// acima de 20% a colheita mecanizada leva 21,6% mais tempo [9]
    plantaManual: 89,   // % colhido na planta: manual 27.075 de 30.555 L [7]
    plantaMec: 72,      // colhedora: 19.856 a 24.021 de 30.555 L (65% a 79%) [7]
    janela: 120,        // dias usuais de colheita (maio a agosto)
  };
  function colheitaCenario(c, areaHa, declive, equipe, tem) {
    const hhMan = COLHEITA.hhManual * c.med / COLHEITA.cargaRef;
    const mecOk = c.e[0] >= COLHEITA.entrelinhaMin, colhedora = tem.includes("auto") || tem.includes("trac");
    if (colhedora && mecOk && declive <= 30) {
      const h = COLHEITA.hMaq * (declive > COLHEITA.decliveMax ? COLHEITA.extraDeclive : 1);
      return { sis: "mec", rotulo: "Mecanizada (colhedora)", horasHa: h, unid: "h de máquina/ha", dias: h * areaHa / 8, custo: "−56% a −62%", planta: COLHEITA.plantaMec, mecOk, refs: [7, 10] };
    }
    const motivo = !colhedora ? "" : !mecOk ? "Entrelinha de " + fmt(c.e[0], 1) + " m: abaixo dos 2,8 m da colhedora" : "Declividade acima de 30%: sem colhedora";
    if (tem.includes("derri")) {
      const h = hhMan / COLHEITA.derriFator;
      return { sis: "semi", rotulo: "Semimecanizada (derriçadora)", horasHa: h, unid: "homem-hora/ha", dias: h * areaHa / (8 * equipe), custo: "−28% a −41%", planta: null, mecOk, motivo, refs: [8, 10] };
    }
    return { sis: "manual", rotulo: "Manual", horasHa: hhMan, unid: "homem-hora/ha", dias: hhMan * areaHa / (8 * equipe), custo: "referência", planta: COLHEITA.plantaManual, mecOk, motivo, refs: [7] };
  }
  const refsTxt = (r) => r.map((x) => "[" + x + "]").join("");
  const diasTxt = (d) => (d < 1 ? "menos de 1 dia" : fmt(Math.ceil(d)) + (Math.ceil(d) === 1 ? " dia" : " dias"));
  function notasColheita(u) {
    const tem = u.impl, c = u.melhor.col, n = [];
    const colhedora = tem.includes("auto") || tem.includes("trac");
    n.push("As máquinas não mudam o potencial produtivo do cenário: mudam quanto da produção é colhido no tempo certo, com que perdas e a que custo.");
    n.push("No cenário " + u.melhor.nome.toLowerCase() + ", a colheita indicada com as máquinas informadas é " + c.rotulo.toLowerCase() + ": cerca de " +
      fmt(c.horasHa, c.horasHa < 20 ? 1 : 0) + " " + c.unid + ", ou " + diasTxt(c.dias) + " de trabalho no talhão " + (c.sis === "mec" ? "com uma colhedora" : "com " + u.equipe + " pessoas") +
      (c.sis === "manual" ? " " + refsTxt(c.refs) + "." : ". Custo em relação à colheita manual: " + c.custo + " " + refsTxt(c.refs) + "."));
    if (c.dias > COLHEITA.janela) n.push("Esse tempo passa da janela usual de colheita (cerca de " + COLHEITA.janela + " dias). Frutos passam do ponto e caem, o que reduz a produção colhida e a qualidade. Vale reforçar a equipe ou mecanizar.");
    if (c.sis === "mec") n.push("Em duas passadas a colhedora retirou de 65% a 79% do café, contra 89% na colheita manual; o restante fica no chão ou na planta e exige repasse e recolhimento [7]." +
      (tem.includes("recol") ? " A recolhedora informada permite recuperar esse café do chão." : " Sem recolhedora, esse café depende de varrição manual."));
    if (u.declive > COLHEITA.decliveMax) n.push("Declividade de " + fmt(u.declive, 0) + "%: acima de 20% os fabricantes não indicam as colhedoras convencionais [12] e a colheita mecanizada leva 21,6% mais tempo [9].");
    if (colhedora) {
      const inc = u.lista.filter((s) => !s.col.mecOk).map((s) => s.nome.toLowerCase());
      if (inc.length) n.push("Com colhedora, " + (inc.length > 1 ? "os cenários " : "o cenário ") + inc.join(" e ") + " (entrelinha abaixo de 2,8 m) " + (inc.length > 1 ? "ficam restritos" : "fica restrito") + " à derriçadora ou à colheita manual [12].");
      const mec = u.lista.filter((s) => !s.bloq && s.col.sis === "mec");
      if (!mec.includes(u.melhor) && mec.length) { const alt = mec.reduce((a, b) => (b.med > a.med ? b : a)); n.push("O cenário de maior produção compatível com a colhedora é o " + alt.nome.toLowerCase() + " (" + fmt(alt.med, 0) + " sc/ha)."); }
    } else n.push("Sem colhedora, preferir entrelinhas a partir de 2,8 m deixa a lavoura pronta para mecanizar depois [12]. A colheita mecanizada custa de 56% a 62% menos que a manual [7][10].");
    const falta = ["trator", "pulv", "adub"].filter((x) => !tem.includes(x));
    n.push(falta.length ? (falta.length > 1 ? "Faltam " : "Falta ") + falta.map((x) => nomeImpl(x).toLowerCase()).join(", ").replace(/, ([^,]*)$/, " e $1") + " para os tratos mecanizados. As produtividades dos cenários supõem adubação e controle fitossanitário na época certa [4]; sem essas máquinas, planeje serviço terceirizado ou equipe para não atrasar os tratos."
      : "Trator cafeeiro, pulverizador e adubadora permitem fazer adubação e controle fitossanitário na época certa, condição assumida nas produtividades dos cenários [4].");
    return n;
  }
  function renderColheita(u) {
    $("#colheita").innerHTML = '<h3>Colheita com as máquinas marcadas</h3><div class="tabela-caixa"><table class="tabela"><thead><tr><th>Cenário</th><th>Colheita indicada</th><th class="n">Tempo por ha</th><th class="n">Dias no talhão</th><th class="n">Custo vs. manual</th></tr></thead><tbody>' +
      u.lista.map((s) => "<tr" + (s === u.melhor ? ' class="destaque"' : "") + "><td><b>" + s.nome + "</b>" + (s.col.motivo ? '<br><small class="mudo">' + s.col.motivo + "</small>" : "") + "</td><td>" + s.col.rotulo +
        '</td><td class="n">' + fmt(s.col.horasHa, s.col.horasHa < 20 ? 1 : 0) + " " + s.col.unid + '</td><td class="n">' + (u.ok ? diasTxt(s.col.dias) : "--") + '</td><td class="n">' + s.col.custo + "</td></tr>").join("") +
      "</tbody></table></div>";
  }

  const estado = {
    especie: "arabica", pts: [], desenhando: false, centro: null, tempManual: false,
    mapa: null, mapaIniciado: false,
  };
  const PADRAO_PTS = [[-18.9598, -47.0092], [-18.9601, -47.0051], [-18.9627, -47.0047], [-18.9630, -47.0089]];

  // O mapa vem de window.AeraMapa (src/mapa.js, MapLibre GL).
  // A área é calculada pelo próprio AERA (medirPoligono), então funciona mesmo se o mapa falhar.
  function iniciarMapa() {
    if (estado.mapaIniciado) { if (estado.mapa) setTimeout(() => estado.mapa.redimensionar(), 50); return; }
    estado.mapaIniciado = true;
    try {
      if (!window.AeraMapa) throw new Error("A biblioteca do mapa não carregou.");
      estado.mapa = window.AeraMapa.criar($("#mapa"), {
        centro: [-18.9612, -47.0071], zoom: 16,
        onClick: (lat, lng) => { if (estado.desenhando) { estado.pts.push({ lat, lng }); redesenhar(true); } },
        onTiles: (ok) => { $("#aviso-mapa").hidden = ok; },
        onPronto: () => calcular(),
      });
      $("#mapa-api").textContent = window.AeraMapa.nome;
    } catch (e) {
      estado.mapa = null;
      $("#aviso-mapa").hidden = false;
      $("#aviso-mapa").innerHTML = "<b>O mapa não carregou.</b> " + esc(e.message) + " A área continua funcionando: use “Colar coordenadas dos vértices” no passo 2.";
    }
    // Abre em estado de trabalho: talhão de exemplo já delimitado.
    const pend = estado.carregarDepois;
    if (pend) { estado.carregarDepois = null; carregarTalhao(pend); }
    else { irPara(-18.9612, -47.0071, false); preencherLocal(-18.9612, -47.0071); estado.pts = PADRAO_PTS.map((p) => ({ lat: p[0], lng: p[1] })); redesenhar(true); }
  }

  function irPara(lat, lng, buscar) {
    estado.centro = { lat, lng };
    if (estado.mapa) { estado.mapa.pino(lat, lng); estado.mapa.ver(lat, lng, Math.max(estado.mapa.zoom(), 16)); }
    $("#lk-gmaps").href = "https://www.google.com/maps?q=" + lat + "," + lng + "&t=k&z=17";
    if (buscar) { dadosDoLocal(lat, lng); preencherLocal(lat, lng); }
  }

  async function dadosDoLocal(lat, lng) {
    $("#alt-fonte").textContent = "Buscando…"; $("#tm-fonte").textContent = "Buscando…";
    let alt = null;
    try {
      const j = await buscarJSON("https://api.open-meteo.com/v1/elevation?latitude=" + lat + "&longitude=" + lng);
      alt = Math.round(j.elevation[0]); $("#altitude").value = alt; $("#alt-fonte").textContent = "Open-Meteo (modelo de elevação)";
    } catch (e) { $("#alt-fonte").textContent = "Sem conexão: informe manualmente"; }
    try {
      const ano = new Date().getFullYear() - 1;
      const j = await buscarJSON("https://archive-api.open-meteo.com/v1/archive?latitude=" + lat + "&longitude=" + lng +
        "&start_date=" + ano + "-01-01&end_date=" + ano + "-12-31&daily=temperature_2m_mean&timezone=auto", 8000);
      const v = j.daily.temperature_2m_mean.filter((x) => x != null);
      $("#tmedia").value = (v.reduce((s, x) => s + x, 0) / v.length).toFixed(1);
      $("#tm-fonte").textContent = "Média de " + ano + " (Open-Meteo)"; estado.tempManual = true;
    } catch (e) {
      estado.tempManual = false;
      $("#tmedia").value = tempPorAltitude(+$("#altitude").value, lat);
      $("#tm-fonte").textContent = "Estimada pela altitude";
    }
    calcular();
  }

  function redesenhar(recriarMarcadores) {
    if (estado.mapa) estado.mapa.contorno(estado.pts, recriarMarcadores, (i, lat, lng) => { estado.pts[i] = { lat, lng }; redesenhar(false); });
    $("#b-local").classList.toggle("feito", estado.pts.length >= 3);
    calcular();
    if (estado.pts.length >= 3 && !estado.decManual) { clearTimeout(estado.tDeclive); estado.tDeclive = setTimeout(estimarDeclive, 1200); }
  }

  // Declividade média estimada: maior desnível entre vértices ÷ distância entre eles (modelo de elevação ~90 m).
  async function estimarDeclive() {
    const pts = estado.pts.slice(0, 90).map((p) => [p.lat, p.lng]); if (pts.length < 3) return;
    try {
      const j = await buscarJSON("https://api.open-meteo.com/v1/elevation?latitude=" + pts.map((p) => p[0].toFixed(5)).join(",") + "&longitude=" + pts.map((p) => p[1].toFixed(5)).join(","));
      const h = j.elevation; let i0 = 0, i1 = 0;
      h.forEach((v, i) => { if (v < h[i0]) i0 = i; if (v > h[i1]) i1 = i; });
      const dist = window.AeraImagens.distancia(pts[i0], pts[i1]);
      if (estado.decManual || !dist) return;
      $("#declive").value = Math.round((h[i1] - h[i0]) / dist * 100);
      $("#dec-fonte").textContent = "Estimada pelo modelo de elevação (Open-Meteo). Confira em campo";
      calcular();
    } catch (e) { if (!estado.decManual) $("#dec-fonte").textContent = "Sem conexão: informe a declividade"; }
  }

  // No celular o mapa fica abaixo do formulário: ao começar a desenhar, leva a tela até ele.
  const irAoMapa = () => { if (estado.desenhando && window.innerWidth <= 900) $(".mapa-caixa").scrollIntoView({ behavior: "smooth", block: "center" }); };
  function alternarDesenho(forcar) {
    estado.desenhando = forcar != null ? forcar : !estado.desenhando;
    const b = $("#btn-desenhar");
    b.textContent = estado.desenhando ? "Concluir contorno" : "Desenhar contorno";
    b.classList.toggle("ativo", estado.desenhando);
    $(".mapa-caixa").classList.toggle("mapa-desenhando", estado.desenhando);
    if (estado.mapa) estado.mapa.duploClique(!estado.desenhando);
    $("#dica").hidden = !estado.desenhando;
    $("#dica").textContent = "Toque no mapa em cada canto do talhão. Depois, “Concluir contorno”.";
  }

  function calcular() {
    const esp = estado.especie;
    const alt = +$("#altitude").value || 0;
    if (!estado.tempManual && estado.centro) $("#tmedia").value = tempPorAltitude(alt, estado.centro.lat);
    const t = +$("#tmedia").value;
    const irrig = $("#irrig").value === "sim";
    const atual = +$("#prod-atual").value || 0;
    const apt = aptidao(esp, t);
    const ok = estado.pts.length >= 3;
    if (ok && $("#coord").hasAttribute("aria-invalid")) limparErro($("#coord"));
    const med = ok ? medirPoligono(estado.pts) : { area: 0, perim: 0 };
    const areaHa = med.area / 10000, perim = med.perim;

    $("#m-area").innerHTML = ok ? fmt(areaHa, 2) + " <small>ha</small>" : "--";
    $("#m-area2").textContent = ok ? "≈ " + fmt(areaHa / 4.84, 2) + " alqueires mineiros" : "Delimite o talhão";
    $("#mapa-area").hidden = !ok;
    $("#mapa-area").innerHTML = ok ? "<b>" + fmt(areaHa, 2) + " ha</b> · " + fmt(perim, 0) + " m" : "";
    $("#m-perim").innerHTML = ok ? fmt(perim, 0) + " <small>m</small>" : "--";
    $("#m-vert").textContent = ok ? estado.pts.length + " vértices" : " ";
    $("#m-apt").innerHTML = '<span class="chip ' + apt.nivel + '">' + apt.rotulo + "</span>";
    $("#m-apt2").textContent = apt.motivo + " · " + fmt(t, 1) + " °C";
    ["#btn-docx", "#btn-xlsx"].forEach((id) => { $(id).disabled = !ok; });

    const lista = CENARIOS[esp].map((c) => {
      const pl = Math.round(10000 / (c.e[0] * c.e[1]));
      const med = c.med * apt.fator, lo = c.faixa[0] * apt.fator, hi = c.faixa[1] * apt.fator;
      return Object.assign({}, c, { pl, med, lo, hi, bloq: c.irrig && !irrig, total: med * areaHa, mudas: Math.ceil(pl * areaHa * 1.05) });
    });
    const declive = Math.max(0, +$("#declive").value || 0), equipe = Math.max(1, Math.round(+$("#equipe").value || 1)), impl = implMarcados();
    lista.forEach((c) => { c.col = colheitaCenario(c, ok ? areaHa : 1, declive, equipe, impl); });
    const viaveis = lista.filter((c) => !c.bloq);
    const melhor = viaveis.reduce((a, b) => (b.med > a.med ? b : a), viaveis[0]);

    $("#m-prod").innerHTML = ok ? fmt(melhor.total, 0) + " <small>sc</small>" : fmt(melhor.med, 0) + " <small>sc/ha</small>";
    $("#m-prod2").textContent = "Cenário " + melhor.nome.toLowerCase() + (ok ? " · " + fmt(melhor.med, 0) + " sc/ha" : "");

    estado.ultimo = { ok, esp, areaHa, perim, apt, t, alt, irrig, atual, lista, melhor, declive, equipe, impl };
    renderColheita(estado.ultimo);
    $("#b-lavoura").classList.add("feito");
    resumoAuto();
  }

  // ================================================================
  // RESULTADO DO TALHÃO: página interativa com tudo o que a análise calculou
  // ================================================================
  // Abre o talhão salvo no formulário (que recalcula tudo) e mostra o resultado.
  function abrirResultadoDe(t) {
    location.hash = "talhao";
    setTimeout(() => { carregarTalhao(t); estado.res = null; setTimeout(() => { location.hash = "resultado"; }, 150); }, 80);
  }

  // Contorno em SVG: projeção plana local, com medidas dos lados, norte e escala.
  function croquiSvg(pts, areaHa, lados) {
    const W = 360, H = 260, M = 34;
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length, lng0 = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
    const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110574;
    const xy = pts.map((p) => [(p.lng - lng0) * kx, (lat0 - p.lat) * ky]);
    const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const esc = Math.min((W - 2 * M) / (maxx - minx || 1), (H - 2 * M) / (maxy - miny || 1));
    const ox = (W - (maxx - minx) * esc) / 2, oy = (H - (maxy - miny) * esc) / 2;
    const P = xy.map((p) => [ox + (p[0] - minx) * esc, oy + (p[1] - miny) * esc]);
    const cx = P.reduce((a, p) => a + p[0], 0) / P.length, cy = P.reduce((a, p) => a + p[1], 0) / P.length;
    let medidas = "";
    if (lados && P.length <= 10) P.forEach((p, i) => {
      const q = P[(i + 1) % P.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
      medidas += '<text class="rc-lado" x="' + (mx + dx / d * 14).toFixed(1) + '" y="' + (my + dy / d * 14 + 4).toFixed(1) + '" text-anchor="middle">' + fmt(lados[i], 0) + " m</text>";
    });
    // barra de escala com valor redondo
    const alvo = (W * 0.28) / esc, base = Math.pow(10, Math.floor(Math.log10(alvo)));
    const passo = [1, 2, 5, 10].map((m) => m * base).filter((v) => v <= alvo).pop() || base;
    const bw = passo * esc;
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Contorno do talhão com ' + fmt(areaHa, 2) + ' hectares">' +
      '<polygon class="rc-forma" points="' + P.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + '"/>' +
      P.map((p) => '<circle class="rc-vert" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4"/>').join("") + medidas +
      '<text class="rc-area" x="' + cx.toFixed(1) + '" y="' + (cy + 6).toFixed(1) + '" text-anchor="middle">' + fmt(areaHa, 2) + " ha</text>" +
      '<g class="rc-norte" transform="translate(' + (W - 22) + ',26)"><path d="M0,-14 L6,6 L0,2 L-6,6 Z"/><text y="20" text-anchor="middle">N</text></g>' +
      '<g class="rc-escala" transform="translate(14,' + (H - 16) + ')"><path d="M0,0 H' + bw.toFixed(1) + '"/><path d="M0,-4 V4 M' + bw.toFixed(1) + ',-4 V4"/><text x="' + (bw + 6).toFixed(1) + '" y="4">' + fmt(passo, 0) + " m</text></g></svg>";
  }

  // Régua com faixa ideal e marcador do valor do talhão.
  function regua(o) {
    const pos = (v) => (Math.min(o.max, Math.max(o.min, v)) - o.min) / (o.max - o.min) * 100;
    return '<div class="regua" role="img" aria-label="' + o.rotulo + '">' +
      (o.faixas || []).map((f) => '<span class="rg-f ' + (f.cls || "") + '" style="left:' + pos(f.de) + "%;width:" + (pos(f.ate) - pos(f.de)) + '%"></span>').join("") +
      (o.marcas || []).map((m) => '<span class="rg-m" style="left:' + pos(m.v) + '%"><i>' + m.rot + "</i></span>").join("") +
      '<span class="rg-v" style="left:' + pos(o.valor) + '%"></span></div>' +
      '<div class="regua-esc"><span>' + o.minTxt + "</span><span>" + o.maxTxt + "</span></div>";
  }

  function dadosResultado() {
    const u = estado.ultimo;
    if (!u || !u.ok) return null;
    const fid = $("#t-fazenda").value, f = lerFazendas().find((x) => x.id === fid);
    const salvo = estado.talhaoId ? lerTalhoes().find((x) => x.id === estado.talhaoId) : null;
    return { u, nome: $("#t-nome").value.trim() || "Talhão sem nome", fazenda: f ? f.nome : "", prop: f ? f.proprietario : "",
      mun: $("#t-mun").value.trim(), uf: $("#t-uf").value, salvo, med: medirPoligono(estado.pts) };
  }

  function renderResultado() {
    const d = dadosResultado();
    $("#r-vazio").hidden = !!d; $("#r-conteudo").hidden = !d;
    ["#r-docx", "#r-xlsx"].forEach((id) => { $(id).disabled = !d; });
    if (!d) { $("#t-res").textContent = "Resultado do talhão"; $("#r-sub").textContent = ""; return; }
    const u = d.u;
    if (!estado.res) estado.res = { unid: "ha", sel: u.lista.indexOf(u.melhor), equipe: u.equipe };
    $("#t-res").textContent = d.nome;
    $("#r-sub").textContent = [d.fazenda, d.prop && "Proprietário: " + d.prop, d.mun && d.mun + (d.uf ? "/" + d.uf : ""),
      u.esp === "arabica" ? "Arábica" : "Conilon", d.salvo ? "Salvo em " + new Date(d.salvo.data).toLocaleDateString("pt-BR") : "Ainda não salvo"].filter(Boolean).join(" · ");

    // números principais
    const m = u.melhor, dif = u.atual ? (m.med - u.atual) / u.atual * 100 : null;
    $("#r-herois").innerHTML =
      '<div class="metrica"><span class="rotulo">Área</span><b class="num">' + fmt(u.areaHa, 2) + ' <small>ha</small></b><p>≈ ' + fmt(u.areaHa / 4.84, 2) + " alqueires mineiros · " + fmt(u.perim, 0) + " m de perímetro</p></div>" +
      '<div class="metrica"><span class="rotulo">Aptidão climática</span><b><span class="chip ' + u.apt.nivel + '">' + u.apt.rotulo + "</span></b><p>" + u.apt.motivo + " · " + fmt(u.t, 1) + " °C</p></div>" +
      '<div class="metrica"><span class="rotulo">Melhor cenário</span><b class="num">' + fmt(m.med, 0) + ' <small>sc/ha</small></b><p>' + m.nome + " · faixa de " + fmt(m.lo, 0) + " a " + fmt(m.hi, 0) + " sc/ha</p></div>" +
      '<div class="metrica res-destaque"><span class="rotulo">Produção estimada</span><b class="num">' + fmt(m.total, 0) + ' <small>sacas</small></b><p>' +
      (dif != null ? (dif >= 0 ? "+" : "") + fmt(dif, 0) + "% sobre a produção atual (" + fmt(u.atual, 0) + " sc/ha)" : "No talhão inteiro, por safra") + "</p></div>";

    $("#r-croqui").innerHTML = croquiSvg(estado.pts, u.areaHa, d.med.lados);

    // condições do talhão
    const ideal = u.esp === "arabica" ? [18, 22] : [22, 26];
    const tem = u.impl.length ? u.impl.map(nomeImpl).join(", ") : "Nenhuma (colheita manual)";
    $("#r-cond").innerHTML =
      '<div class="cond"><div class="cond-cab"><span>Temperatura média</span><b>' + fmt(u.t, 1) + " °C</b></div>" +
      regua({ min: 14, max: 30, valor: u.t, minTxt: "14 °C", maxTxt: "30 °C", rotulo: "Temperatura " + fmt(u.t, 1) + " °C; ideal de " + ideal[0] + " a " + ideal[1] + " °C",
        faixas: [{ de: ideal[0], ate: ideal[1], cls: "ideal" }] }) +
      '<small class="mudo">Faixa ideal para ' + (u.esp === "arabica" ? "arábica" : "conilon") + ": " + ideal[0] + " a " + ideal[1] + " °C</small></div>" +
      '<div class="cond"><div class="cond-cab"><span>Declividade</span><b>' + fmt(u.declive, 0) + "%</b></div>" +
      regua({ min: 0, max: 40, valor: u.declive, minTxt: "0%", maxTxt: "40%", rotulo: "Declividade " + fmt(u.declive, 0) + "%",
        faixas: [{ de: 0, ate: COLHEITA.decliveMax, cls: "ideal" }, { de: COLHEITA.decliveMax, ate: 30, cls: "meio" }],
        marcas: [{ v: COLHEITA.decliveMax, rot: COLHEITA.decliveMax + "%" }, { v: 30, rot: "30%" }] }) +
      '<small class="mudo">Até ' + COLHEITA.decliveMax + "% a colhedora trabalha normalmente; de " + COLHEITA.decliveMax + "% a 30% fica mais lenta; acima de 30% não é indicada.</small></div>" +
      '<dl class="cond-lista"><dt>Altitude</dt><dd>' + fmt(u.alt, 0) + " m</dd><dt>Irrigação</dt><dd>" + (u.irrig ? "Sim" : "Não") + "</dd>" +
      "<dt>Produção atual</dt><dd>" + (u.atual ? fmt(u.atual, 0) + " sc/ha" : "Lavoura nova ou sem produção") + "</dd>" +
      "<dt>Máquinas</dt><dd>" + tem + "</dd></dl>";

    document.querySelectorAll("#r-unid button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === estado.res.unid)));
    $("#r-equipe").value = estado.res.equipe; $("#r-equipe-v").textContent = estado.res.equipe;
    pintarCenarios(); pintarColheitaSim();
    $("#r-notas").innerHTML = notasColheita(u).map((n) => "<li>" + n.replace(/\[(\d+)\]/g, '<a href="#ref-$1" data-ref="$1">[$1]</a>') + "</li>").join("");
  }

  // Gráfico de barras horizontais: produtividade (mediana) com a faixa esperada e a produção atual.
  function pintarCenarios() {
    const u = estado.ultimo, r = estado.res, k = r.unid === "talhao" ? u.areaHa : 1, un = r.unid === "talhao" ? "sacas" : "sc/ha";
    const max = Math.max(...u.lista.map((c) => c.hi * k), u.atual * k) * 1.06;
    const pct = (v) => (v / max * 100).toFixed(2) + "%";
    $("#r-grafico").innerHTML = u.lista.map((c, i) =>
      '<button type="button" class="rg-linha' + (i === r.sel ? " sel" : "") + (c.bloq ? " bloq" : "") + '" data-i="' + i + '" aria-pressed="' + (i === r.sel) + '">' +
      '<span class="rg-nome"><b>' + c.nome + "</b><small>" + fmt(c.e[0], 1) + " × " + fmt(c.e[1], 1) + " m" +
      (c === u.melhor ? " · maior produção" : c.bloq ? " · requer irrigação" : "") + "</small></span>" +
      '<span class="rg-trilho"><span class="rg-faixa" style="left:' + pct(c.lo * k) + ";width:" + pct((c.hi - c.lo) * k) + '"></span>' +
      '<span class="rg-barra" style="width:' + pct(c.med * k) + '"></span>' +
      (u.atual ? '<span class="rg-atual" style="left:' + pct(u.atual * k) + '"></span>' : "") + "</span>" +
      '<span class="rg-valor">' + fmt(c.med * k, 0) + " <small>" + un + "</small></span></button>").join("");
    $("#r-legenda").innerHTML = '<span><i class="lg-barra"></i>Produtividade esperada</span><span><i class="lg-faixa"></i>Faixa possível</span>' +
      (u.atual ? '<span><i class="lg-atual"></i>Produção atual: ' + fmt(u.atual * k, 0) + " " + un + "</span>" : "");
    pintarDetalhe();
  }

  function pintarDetalhe() {
    const u = estado.ultimo, c = u.lista[estado.res.sel], a = u.areaHa;
    const col = colheitaCenario(c, a, u.declive, estado.res.equipe, u.impl);
    const dif = u.atual ? c.med - u.atual : null;
    $("#r-detalhe").innerHTML = '<div class="rd-cab"><h3>' + c.nome + "</h3>" +
      (c === u.melhor ? '<span class="chip">Maior produção</span>' : "") + (c.bloq ? '<span class="chip atencao">Requer irrigação</span>' : "") + "</div>" +
      (c.bloq ? '<p class="rd-aviso">Este cenário depende de irrigação, e o talhão está marcado sem irrigação. Os números abaixo valem só se a área for irrigada.</p>' : "") +
      '<dl class="rd-grade">' +
      "<div><dt>Espaçamento</dt><dd>" + fmt(c.e[0], 1) + " × " + fmt(c.e[1], 1) + " m</dd></div>" +
      "<div><dt>Plantas por hectare</dt><dd>" + fmt(c.pl) + "</dd></div>" +
      "<div><dt>Mudas para o talhão</dt><dd>" + fmt(c.mudas) + " <small>(com 5% de replantio)</small></dd></div>" +
      "<div><dt>Produtividade esperada</dt><dd>" + fmt(c.med, 0) + " sc/ha <small>(" + fmt(c.lo, 0) + " a " + fmt(c.hi, 0) + ")</small></dd></div>" +
      "<div><dt>Produção no talhão</dt><dd>" + fmt(c.total, 0) + " sacas <small>(" + fmt(c.lo * a, 0) + " a " + fmt(c.hi * a, 0) + ")</small></dd></div>" +
      "<div><dt>Comparado ao atual</dt><dd>" + (dif == null ? "Sem produção atual para comparar"
        : (dif >= 0 ? "+" : "") + fmt(dif, 0) + " sc/ha <small>(" + (dif >= 0 ? "+" : "") + fmt(dif / u.atual * 100, 0) + "%, " + (dif >= 0 ? "+" : "") + fmt(dif * a, 0) + " sacas)</small>") + "</dd></div>" +
      "<div><dt>Colheita indicada</dt><dd>" + col.rotulo + (col.motivo ? "<small>" + col.motivo + "</small>" : "") + "</dd></div>" +
      "<div><dt>Tempo de colheita</dt><dd>" + diasTxt(col.dias) + " <small>(" + (col.sis === "mec" ? "uma colhedora" : estado.res.equipe + " pessoas") + ")</small></dd></div>" +
      "<div><dt>Custo vs. colheita manual</dt><dd>" + col.custo + "</dd></div></dl>";
  }

  // Dias de colheita por cenário com a equipe escolhida, comparados à janela de colheita.
  function pintarColheitaSim() {
    const u = estado.ultimo, eq = estado.res.equipe;
    const lista = u.lista.map((c) => Object.assign({}, c, { col: colheitaCenario(c, u.areaHa, u.declive, eq, u.impl) }));
    const max = Math.max(COLHEITA.janela * 1.25, ...lista.map((c) => c.col.dias));
    const pct = (v) => (Math.min(v, max) / max * 100).toFixed(2) + "%";
    $("#r-dias").innerHTML = lista.map((c, i) => {
      const fora = c.col.dias > COLHEITA.janela;
      return '<div class="rdias' + (i === estado.res.sel ? " sel" : "") + '"><span class="rdias-nome">' + c.nome + "<small>" + c.col.rotulo + "</small></span>" +
        '<span class="rdias-trilho"><span class="rdias-barra' + (fora ? " fora" : "") + '" style="width:' + pct(c.col.dias) + '"></span>' +
        '<span class="rdias-janela" style="left:' + pct(COLHEITA.janela) + '"></span></span>' +
        '<span class="rdias-valor"><b>' + diasTxt(c.col.dias) + '</b><span class="chip ' + (fora ? "risco" : "") + '">' + (fora ? "Passa da janela" : "Dentro da janela") + "</span></span></div>";
    }).join("") + '<p class="mudo res-ajuda"><i class="lg-janela"></i>Janela usual de colheita: cerca de ' + COLHEITA.janela + " dias (maio a agosto)." +
      (lista.some((c) => c.col.sis === "mec") ? " Na colheita com colhedora, o tempo depende da máquina, não da equipe." : "") + "</p>";
    renderColheita(Object.assign({}, u, { lista, melhor: lista[u.lista.indexOf(u.melhor)], equipe: eq }));
  }

  function iniciarResultado() {
    $("#r-grafico").addEventListener("click", (e) => {
      const b = e.target.closest(".rg-linha"); if (!b) return;
      estado.res.sel = +b.dataset.i; pintarCenarios(); pintarColheitaSim();
    });
    $("#r-unid").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      estado.res.unid = b.dataset.v;
      document.querySelectorAll("#r-unid button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      pintarCenarios();
    });
    $("#r-equipe").addEventListener("input", () => {
      estado.res.equipe = +$("#r-equipe").value; $("#r-equipe-v").textContent = estado.res.equipe;
      pintarDetalhe(); pintarColheitaSim();
    });
    // dica ao passar o mouse sobre as barras
    const dica = $("#r-dica");
    $("#r-grafico").addEventListener("mousemove", (e) => {
      const b = e.target.closest(".rg-linha"); if (!b) { dica.hidden = true; return; }
      const u = estado.ultimo, c = u.lista[+b.dataset.i];
      dica.innerHTML = "<b>" + c.nome + "</b><br>Esperado: " + fmt(c.med, 0) + " sc/ha<br>Faixa: " + fmt(c.lo, 0) + " a " + fmt(c.hi, 0) + " sc/ha<br>No talhão: " + fmt(c.total, 0) + " sacas";
      dica.hidden = false;
      const x = Math.min(e.clientX + 14, window.innerWidth - dica.offsetWidth - 8), y = e.clientY + 14;
      dica.style.left = x + "px"; dica.style.top = y + "px";
    });
    $("#r-grafico").addEventListener("mouseleave", () => { dica.hidden = true; });
    $("#r-docx").addEventListener("click", () => exportar("docx"));
    $("#r-xlsx").addEventListener("click", () => exportar("xlsx"));
  }

  // ---------- localização em tempo real (GPS do aparelho) ----------
  const gps = { watch: null, pos: null, primeiro: true };
  function gpsTexto(msg, classe) {
    $("#gps-txt").textContent = msg;
    $("#gps-ponto").className = "gps-ponto" + (classe ? " " + classe : "");
  }
  function gpsParar(esconder) {
    if (gps.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(gps.watch);
    gps.watch = null;
    if (estado.mapa) estado.mapa.gps(null);
    if (esconder) $("#gps").hidden = true;
    $("#btn-gps").classList.remove("ativo");
  }
  function gpsIniciar() {
    $("#gps").hidden = false;
    $("#btn-gps-usar").disabled = true; $("#btn-gps-vertice").disabled = true;
    if (!navigator.geolocation) return gpsTexto("Este navegador não oferece localização.", "erro");
    gpsParar(false);
    gps.primeiro = true;
    $("#btn-gps").classList.add("ativo");
    gpsTexto("Buscando sinal de GPS…");
    gps.watch = navigator.geolocation.watchPosition((p) => {
      const lat = p.coords.latitude, lng = p.coords.longitude, prec = Math.round(p.coords.accuracy);
      gps.pos = { lat, lng, prec };
      const hora = new Date(p.timestamp || Date.now()).toLocaleTimeString("pt-BR");
      gpsTexto(lat.toFixed(6) + ", " + lng.toFixed(6) + " · ±" + prec + " m · " + hora, "vivo");
      $("#btn-gps-usar").disabled = false; $("#btn-gps-vertice").disabled = false;
      if (!estado.mapa) return;
      estado.mapa.gps({ lat, lng, prec });
      if (gps.primeiro) { estado.mapa.ver(lat, lng, 18); gps.primeiro = false; }
    }, (e) => {
      const msg = e.code === 1
        ? "Permissão de localização negada. Libere a localização para este site no navegador. Dentro da prévia do Claude o GPS é sempre bloqueado; abra o app pelo navegador do celular."
        : e.code === 3 ? "O GPS demorou a responder. Vá para céu aberto e tente de novo." : "Não foi possível obter a posição. Verifique se o GPS do aparelho está ligado.";
      gpsTexto(msg, "erro");
      gpsParar(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }

  // ---------- relatório e planilha ----------
  async function salvarArquivo(nome, blob) {
    let dl = null;
    try { dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename: nome, data: blob }); toast(nome + " salvo"); }
      catch (e) {
        if (e && e.code === "declined") return;
        toast(e && e.code === "rate_limited" ? "Já há um download aguardando confirmação" : "Não foi possível baixar o arquivo nesta visualização");
      }
      return;
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const logoB64 = () => ($(".marca img").getAttribute("src") || "").split("base64,")[1] || null;
  const agora = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  function responsavel() {
    const p = lerPerfil();
    return [p.nome || "", [p.funcao, p.registro].filter(Boolean).join(" · ")];
  }

  async function dadosExportacao() {
    const u = estado.ultimo;
    const especieTxt = u.esp === "arabica" ? "Arábica (Coffea arabica)" : "Conilon (Coffea canephora)";
    const c = estado.centro || { lat: estado.pts[0].lat, lng: estado.pts[0].lng };
    const nomeT = $("#t-nome").value.trim() || "Talhão sem nome";
    const faz = lerFazendas().find((x) => x.id === $("#t-fazenda").value) || null;
    const [resp, respInfo] = responsavel();
    const pts = estado.pts.map((q) => [q.lat, q.lng]);
    const lados = medirPoligono(pts).lados;
    const cen = u.lista.map((s) => Object.assign({}, s, {
      melhor: s === u.melhor, espacamento: fmt(s.e[0], 1) + " × " + fmt(s.e[1], 1) + " m", plantasTxt: fmt(s.pl), medTxt: fmt(s.med, 0),
      faixaCurta: fmt(s.lo, 0) + "–" + fmt(s.hi, 0), totalTxt: fmt(s.total, 0), mudasTxt: fmt(s.mudas),
    }));
    const subtitulo = nomeT + (faz ? " · " + faz.nome : "");
    const local = localTalhao() || (faz ? localFaz(faz) : "");
    const localTxt = (local || "Não informado") + (estado.regiao ? " · " + estado.regiao : "");
    const notas = notasColheita(u), mc = u.melhor.col;
    const infoCroqui = { titulo: nomeT, subtitulo: fmt(u.areaHa, 2) + " ha · perímetro " + fmt(u.perim, 0) + " m" + (faz ? " · " + faz.nome : ""),
      rodape: "Centro " + c.lat.toFixed(5) + ", " + c.lng.toFixed(5) + " · WGS 84" };
    let croqui = null, grafico = null;
    try { croqui = await window.AeraImagens.croqui([{ nome: nomeT, pts }], infoCroqui); } catch (e) { croqui = null; }
    try { grafico = await window.AeraImagens.graficoCenarios(cen); } catch (e) { grafico = null; }
    const ganho = u.atual ? " Em relação à produtividade atual informada (" + fmt(u.atual, 0) + " sc/ha), a diferença estimada é de " +
      (u.melhor.med - u.atual >= 0 ? "+" : "") + fmt(u.melhor.med - u.atual, 0) + " sc/ha." : "";
    return {
      geradoEm: agora(), logoBase64: logoB64(), subtitulo, cabecalho: subtitulo,
      ficha: [["Fazenda", faz ? faz.nome : "Não vinculada"], ["Proprietário", faz && faz.proprietario ? faz.proprietario : "Não informado"],
        ["Município/UF", localTxt], ["Talhão", nomeT], ["Espécie", especieTxt], ["Máquinas e implementos", textoImplementos(u.impl)],
        ["Responsável técnico", [resp, respInfo].filter(Boolean).join(" · ") || "Não informado"], ["Data da análise", agora()]],
      kpis: [["Área", fmt(u.areaHa, 2) + " ha", "≈ " + fmt(u.areaHa / 4.84, 2) + " alqueires"], ["Aptidão climática", u.apt.rotulo, fmt(u.t, 1) + " °C · " + fmt(u.alt, 0) + " m"],
        ["Cenário recomendado", u.melhor.nome, fmt(u.melhor.med, 0) + " sc/ha", "5F8A2E"], ["Produção estimada", fmt(u.melhor.total, 0) + " sc", "por safra, média bienal"]],
      resumo: "O talhão " + nomeT + (faz ? ", da " + faz.nome + (faz.proprietario ? " (proprietário: " + faz.proprietario + ")" : "") : "") + ", tem " + fmt(u.areaHa, 2) +
        " ha delimitados em " + pts.length + " vértices e está em área de aptidão climática " + u.apt.rotulo.toLowerCase() + " para café " + (u.esp === "arabica" ? "arábica" : "conilon") +
        ". Entre os cenários " + (u.irrig ? "avaliados" : "viáveis sem irrigação") + ", o " + u.melhor.nome.toLowerCase() + " apresenta a maior produção estimada: " +
        fmt(u.melhor.total, 0) + " sacas por safra (" + fmt(u.melhor.med, 0) + " sc/ha), com " + fmt(u.melhor.mudas) + " mudas para a implantação." + ganho,
      identificacao: [
        ["Coordenada de referência", c.lat.toFixed(6) + ", " + c.lng.toFixed(6)], ["Área", fmt(u.areaHa, 2) + " ha (≈ " + fmt(u.areaHa / 4.84, 2) + " alqueires mineiros)"],
        ["Perímetro", fmt(u.perim, 0) + " m"], ["Altitude", fmt(u.alt, 0) + " m (" + $("#alt-fonte").textContent + ")"],
        ["Temperatura média anual", fmt(u.t, 1) + " °C (" + $("#tm-fonte").textContent + ")"], ["Declividade média", fmt(u.declive, 0) + "% (" + $("#dec-fonte").textContent + ")"],
        ["Irrigação disponível", u.irrig ? "Sim" : "Não (sequeiro)"],
        ["Produtividade atual informada", u.atual ? fmt(u.atual, 0) + " sc/ha" : "Não informada"],
      ],
      fichaPlanilha: [["Fazenda", faz ? faz.nome : "Não vinculada"], ["Proprietário", faz && faz.proprietario ? faz.proprietario : ""], ["Município/UF", localTxt],
        ["Talhão", nomeT], ["Espécie", especieTxt], ["Máquinas e implementos", textoImplementos(u.impl)], ["Responsável técnico", [resp, respInfo].filter(Boolean).join(" · ")], ["Data da análise", agora()]],
      planilhaResumo: [
        ["Latitude de referência", +c.lat.toFixed(6), 7], ["Longitude de referência", +c.lng.toFixed(6), 7],
        ["Área (ha)", +u.areaHa.toFixed(4), 5], ["Área (alqueires mineiros)", +(u.areaHa / 4.84).toFixed(4), 5], ["Perímetro (m)", Math.round(u.perim), 6],
        ["Vértices", pts.length, 6], ["Altitude (m)", u.alt, 6], ["Temperatura média anual (°C)", u.t, 5], ["Declividade média (%)", u.declive, 6],
        ["Aptidão climática", u.apt.rotulo + " (" + u.apt.motivo + ")"], ["Irrigação disponível", u.irrig ? "Sim" : "Não"],
        ["Produtividade atual (sc/ha)", u.atual || "Não informada", u.atual ? 5 : null],
        ["Cenário de maior produção", u.melhor.nome], ["Produtividade esperada (sc/ha)", +u.melhor.med.toFixed(1), 5], ["Produção estimada (sacas)", Math.round(u.melhor.total), 6],
        ["Mudas para implantação", u.melhor.mudas, 6],
        ["Colheita indicada", mc.rotulo], ["Tempo de colheita no talhão (dias)", Math.max(1, Math.ceil(mc.dias)), 6],
      ],
      colheita: {
        tabela: u.lista.map((s) => ({ nome: s.nome, melhor: s === u.melhor, sistema: s.col.rotulo, horasHa: s.col.horasHa, unid: s.col.unid,
          horasTxt: fmt(s.col.horasHa, s.col.horasHa < 20 ? 1 : 0) + " " + s.col.unid, dias: Math.max(1, Math.ceil(s.col.dias)), diasTxt: diasTxt(s.col.dias),
          custo: s.col.custo, restricao: s.col.motivo || "", refs: s.col.refs })),
        implementos: textoImplementos(u.impl), declive: u.declive, equipe: u.equipe, notas,
      },
      arquivo: [faz ? faz.nome : "Sem-fazenda", nomeT, faz && faz.proprietario ? faz.proprietario : "Sem-proprietario"],
      apt: { rotulo: u.apt.rotulo, texto: u.apt.motivo + ". Temperatura média anual de " + fmt(u.t, 1) + " °C a " + fmt(u.alt, 0) +
        " m de altitude. Fator aplicado às produtividades de referência: " + fmt(u.apt.fator, 2) + " (critério simplificado a partir de Camargo, 1985 [3])." },
      recomendacao: "Adotar o cenário " + u.melhor.nome.toLowerCase() + " (" + fmt(u.melhor.e[0], 1) + " × " + fmt(u.melhor.e[1], 1) + " m, " + fmt(u.melhor.pl) +
        " plantas/ha), com expectativa de " + fmt(u.melhor.lo, 0) + " a " + fmt(u.melhor.hi, 0) + " sc/ha na lavoura adulta e primeira colheita em " + u.melhor.colheita + ". " + u.melhor.obs +
        " Colheita indicada com as máquinas informadas: " + mc.rotulo.toLowerCase() + ", cerca de " + diasTxt(mc.dias) + " no talhão." +
        " Antes da implantação, confirmar a análise de solo, a disponibilidade de mudas da cultivar escolhida e o custo de implantação por hectare.",
      assinatura: [resp || "Responsável técnico", respInfo], cenarios: cen, croqui, grafico,
      vertices: pts.map((q, i) => [q[0], q[1], fmt(lados[i], 1), Math.round(lados[i])]), refs: REFS,
      aviso: "Estimativas geradas pelo protótipo AERA a partir de parâmetros de referência da literatura. Devem ser validadas por engenheiro agrônomo antes de qualquer recomendação de campo.",
    };
  }
  async function exportar(tipo) {
    if (!estado.ultimo || !estado.ultimo.ok) return toast("Delimite o talhão antes de gerar o arquivo");
    const btn = $(tipo === "docx" ? "#btn-docx" : "#btn-xlsx"), rotulo = btn.textContent;
    btn.disabled = true; btn.textContent = "Gerando…";
    try {
      const d = await dadosExportacao();
      const blob = await window.AeraExport[tipo](d);
      await salvarArquivo(nomeArquivo(tipo === "docx" ? "Relatorio" : "Planilha", d.arquivo, tipo), blob);
    } catch (e) { toast(e && e.message ? e.message : "Não foi possível gerar o arquivo"); }
    finally { btn.disabled = false; btn.textContent = rotulo; }
  }

  function listarSalvos() {
    const s = lerTalhoes();
    $("#n-salvos").textContent = s.length ? s.length + (s.length > 1 ? " talhões" : " talhão") : "";
    $("#salvos").innerHTML = s.length
      ? s.slice().reverse().map((t) => '<button class="salvo" type="button" data-id="' + t.id + '"><span><b>' + t.nome + "</b><br><small>" + (t.especie === "arabica" ? "Arábica" : "Conilon") + " · " + (nomeFazenda(t.fazendaId) || "sem fazenda") + '</small></span><span class="num">' + fmt(t.area, 2) + " ha</span></button>").join("")
      : '<p class="vazio">Nenhum talhão salvo ainda. Delimite um talhão e toque em “Salvar talhão”.</p>';
  }

  function carregarTalhao(t) {
    if (!estado.mapaIniciado) { estado.carregarDepois = t; location.hash = "talhao"; return; }
    definirEspecie(t.especie);
    estado.pts = t.pts.map((p) => ({ lat: p[0], lng: p[1] }));
    const c = t.centro || { lat: t.pts[0][0], lng: t.pts[0][1] };
    $("#coord").value = c.lat.toFixed(5) + ", " + c.lng.toFixed(5);
    irPara(c.lat, c.lng, false);
    if (t.alt != null) $("#altitude").value = t.alt;
    if (t.tmedia != null) { $("#tmedia").value = t.tmedia; estado.tempManual = true; }
    estado.talhaoId = t.id;
    $("#t-nome").value = t.nome || "";
    preencherSelectFazendas(t.fazendaId || "");
    if (t.irrig != null) definirIrrig(t.irrig ? "sim" : "nao");
    $("#prod-atual").value = t.prodAtual != null ? t.prodAtual : "";
    marcarImplementos(t.implementos || ["derri"]);
    if (t.declive != null) { $("#declive").value = t.declive; estado.decManual = true; $("#dec-fonte").textContent = "Salvo com o talhão"; } else estado.decManual = false;
    if (t.equipe) $("#equipe").value = t.equipe;
    if (t.municipio) { $("#t-mun").value = t.municipio; $("#t-uf").value = t.uf || ""; estado.regiao = t.regiao || ""; seqLocal++;
      $("#local-fonte").textContent = (t.regiao ? "Região: " + t.regiao + " · " : "") + "Salvo com o talhão"; }
    else preencherLocal(c.lat, c.lng);
    $("#t-salvo-msg").textContent = "Editando talhão salvo. Salvar atualiza o registro.";
    $("#btn-ver-resultado").hidden = false;
    atualizarRotuloTalhao();
    alternarDesenho(false); redesenhar(true);
    if (estado.mapa) estado.mapa.enquadrar(estado.pts, 0.4);
  }

  function definirIrrig(v) {
    $("#irrig").value = v;
    document.querySelectorAll("#seg-irrig button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  }
  function definirEspecie(v) {
    estado.especie = v;
    document.querySelectorAll("#seg-especie button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  }

  function iniciarTalhao() {
    $("#refs").innerHTML = REFS.map((r, i) => '<li id="ref-' + (i + 1) + '">' + r + "</li>").join("");
    $("#tela-resultado").addEventListener("click", (e) => {
      const a = e.target.closest("a[data-ref]"); if (!a) return;
      e.preventDefault(); $("#referencias").open = true; const li = $("#ref-" + a.dataset.ref);
      li.scrollIntoView({ behavior: "smooth", block: "center" }); li.style.background = "#eef5e4"; setTimeout(() => (li.style.background = ""), 1600);
    });
    $("#btn-ir").addEventListener("click", () => {
      const m = $("#coord").value.replace(/;/g, ",").split(",").map((s) => parseFloat(s.trim()));
      if (m.length !== 2 || m.some(isNaN) || Math.abs(m[0]) > 90 || Math.abs(m[1]) > 180) {
        $("#coord-msg").textContent = "Coordenada inválida. Use o formato “-18.9612, -47.0071” (latitude, longitude)."; return;
      }
      $("#coord-msg").textContent = "Coordenada localizada. Agora delimite o talhão ao redor do ponto.";
      novoTalhao(); estado.pts = []; redesenhar(true); irPara(m[0], m[1], true); alternarDesenho(true); irAoMapa();
    });
    $("#coord").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btn-ir").click(); });
    $("#btn-desenhar").addEventListener("click", () => {
      alternarDesenho(); irAoMapa();
      if (!estado.desenhando && estado.pts.length >= 3 && estado.mapa) estado.mapa.enquadrar(estado.pts, 0.4);
    });
    $("#btn-gps").addEventListener("click", gpsIniciar);
    $("#btn-gps-parar").addEventListener("click", () => gpsParar(true));
    $("#btn-gps-usar").addEventListener("click", () => {
      if (!gps.pos) return;
      const { lat, lng } = gps.pos;
      $("#coord").value = lat.toFixed(6) + ", " + lng.toFixed(6);
      $("#coord-msg").textContent = "Ponto do GPS (±" + gps.pos.prec + " m). Agora delimite o talhão.";
      gpsParar(true);
      novoTalhao(); estado.pts = []; redesenhar(true); irPara(lat, lng, true); alternarDesenho(true); irAoMapa();
    });
    $("#btn-gps-vertice").addEventListener("click", () => {
      if (!gps.pos) return;
      if (!estado.centro) irPara(gps.pos.lat, gps.pos.lng, true);
      estado.pts.push({ lat: gps.pos.lat, lng: gps.pos.lng }); redesenhar(true);
      toast("Vértice " + estado.pts.length + " marcado (±" + gps.pos.prec + " m)");
    });
    $("#implementos").innerHTML = IMPLEMENTOS.map((x) => '<label class="impl"><input type="checkbox" id="impl-' + x[0] + '"' + (x[0] === "derri" ? " checked" : "") + "><span>" + x[1] + "</span></label>").join("");
    $("#implementos").insertAdjacentHTML("beforeend", '<label class="impl impl-nenhum"><input type="checkbox" id="impl-nenhum"><span>Nenhuma (colheita manual)</span></label>');
    // "Nenhuma" e as máquinas se excluem.
    $("#implementos").addEventListener("change", (e) => {
      if (e.target.id === "impl-nenhum" && e.target.checked) IMPLEMENTOS.forEach((x) => { $("#impl-" + x[0]).checked = false; });
      else if (e.target.checked) $("#impl-nenhum").checked = false;
      calcular();
    });
    $("#btn-ver-resultado").addEventListener("click", () => { location.hash = "resultado"; });
    iniciarResultado();
    $("#declive").addEventListener("input", () => { estado.decManual = true; $("#dec-fonte").textContent = "Informada manualmente"; calcular(); });
    $("#equipe").addEventListener("input", calcular);
    const opUF = '<option value="">—</option>' + UFS.map((u) => "<option>" + u + "</option>").join("");
    $("#t-uf").innerHTML = opUF; $("#f-uf").innerHTML = opUF;
    ["#t-mun", "#t-uf"].forEach((id) => $(id).addEventListener("input", () => { seqLocal++; estado.regiao = ""; $("#local-fonte").textContent = "Informado manualmente"; }));
    $("#btn-colar").addEventListener("click", () => {
      const pts = lerCoordenadas($("#colar-pts").value);
      if (pts.length < 3) { $("#colar-msg").textContent = "Encontrei " + pts.length + " ponto(s) válido(s). São necessários pelo menos 3 (latitude, longitude por linha)."; return; }
      novoTalhao(); alternarDesenho(false);
      estado.pts = pts.map((p) => ({ lat: p[0], lng: p[1] }));
      const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
      $("#coord").value = c[0].toFixed(6) + ", " + c[1].toFixed(6);
      irPara(c[0], c[1], true); redesenhar(true);
      if (estado.mapa) estado.mapa.enquadrar(estado.pts, 0.4);
      $("#colar-msg").textContent = pts.length + " vértices carregados: " + fmt(estado.ultimo.areaHa, 2) + " ha.";
    });
    $("#btn-docx").addEventListener("click", () => exportar("docx"));
    $("#btn-xlsx").addEventListener("click", () => exportar("xlsx"));
    $("#btn-desfazer").addEventListener("click", () => { estado.pts.pop(); redesenhar(true); });
    $("#btn-limpar").addEventListener("click", () => { novoTalhao(); estado.pts = []; redesenhar(true); alternarDesenho(true); irAoMapa(); });
    $("#seg-especie").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; definirEspecie(b.dataset.v); calcular(); });
    $("#seg-camada").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || !estado.mapa) return;
      document.querySelectorAll("#seg-camada button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      estado.mapa.camada(b.dataset.v);
    });
    $("#altitude").addEventListener("input", calcular);
    $("#tmedia").addEventListener("input", () => { estado.tempManual = true; $("#tm-fonte").textContent = "Informada manualmente"; calcular(); });
    $("#seg-irrig").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; definirIrrig(b.dataset.v); calcular(); });
    $("#prod-atual").addEventListener("input", calcular);
    $("#form-talhao").addEventListener("submit", (e) => e.preventDefault()); // Enter num campo não salva sem querer
    $("#btn-salvar2").addEventListener("click", salvarTalhao);
    ["#altitude", "#t-mun", "#t-uf"].forEach((id) => $(id).addEventListener("change", resumoAuto));
    $("#t-fazenda").addEventListener("change", mostrarFazendaDoTalhao);
    $("#salvos").addEventListener("click", (e) => {
      const b = e.target.closest(".salvo"); if (!b) return;
      const t = guardar.ler("talhoes", []).find((x) => String(x.id) === b.dataset.id);
      if (t) { location.hash = "talhao"; setTimeout(() => carregarTalhao(t), 80); }
    });
  }

  // ================================================================
  // FAZENDAS: cadastro, talhões vinculados, análise por fazenda
  // ================================================================
  const lerFazendas = () => guardar.ler("fazendas", []);
  // A área é sempre recalculada a partir dos vértices (corrige talhões salvos com a fórmula antiga).
  const lerTalhoes = () => guardar.ler("talhoes", []).map((t) => (t.pts && t.pts.length >= 3 ? Object.assign(t, { area: areaGeo(t.pts) / 10000 }) : t));
  const nomeFazenda = (id) => { const f = lerFazendas().find((x) => x.id === id); return f ? f.nome : ""; };
  const localFaz = (f) => [f.municipio, f.uf].filter(Boolean).join("/");

  // Resultado resumido de um talhão (usado na análise da fazenda).
  function resultadoTalhao(t) {
    if (t.resultado) return Object.assign({}, t.resultado, { producao: t.resultado.scha * t.area });
    const apt = aptidao(t.especie, t.tmedia != null ? t.tmedia : 21);
    const viaveis = CENARIOS[t.especie].filter((c) => !c.irrig || t.irrig);
    const m = viaveis.reduce((a, b) => (b.med > a.med ? b : a), viaveis[0]);
    return { apt: apt.rotulo, cenario: m.nome, scha: m.med * apt.fator, producao: m.med * apt.fator * t.area };
  }

  function preencherSelectFazendas(sel) {
    const fs = lerFazendas();
    $("#t-fazenda").innerHTML = '<option value="" disabled>Escolha a fazenda</option>' +
      fs.map((f) => '<option value="' + f.id + '">' + esc(f.nome) + "</option>").join("") +
      '<option value="__nova">+ Cadastrar nova fazenda</option>';
    $("#t-fazenda").value = sel != null ? sel : "";
    if ($("#t-fazenda").value !== sel) $("#t-fazenda").value = "";
    mostrarFazendaDoTalhao();
  }
  function mostrarFazendaDoTalhao() {
    const v = $("#t-fazenda").value;
    $("#nova-faz").hidden = v !== "__nova";
    const f = lerFazendas().find((x) => x.id === v);
    $("#t-prop").textContent = v === "__nova" ? "A fazenda será criada ao salvar o talhão."
      : f ? "Proprietário: " + (f.proprietario || "não informado") + (localFaz(f) ? " · " + localFaz(f) : "") : "";
  }
  // Começa um talhão novo. O nome só é apagado se a tela mostrava um talhão já salvo;
  // o que a pessoa acabou de digitar (nome, fazenda) continua ao desenhar ou colar o contorno.
  function novoTalhao() {
    if (estado.talhaoId) $("#t-nome").value = "";
    $("#btn-ver-resultado").hidden = true;
    estado.talhaoId = null; estado.decManual = false;
    $("#t-salvo-msg").textContent = "";
    atualizarRotuloTalhao();
  }
  function atualizarRotuloTalhao() {
    const fn = nomeFazenda($("#t-fazenda").value);
    const nome = $("#t-nome").value.trim();
    $("#talhao-rotulo").textContent = estado.talhaoId && nome ? "Talhão salvo · " + nome + (fn ? " · " + fn : "") : "Café · análise de talhão";
  }
  function novoTalhaoNaFazenda(fid) {
    novoTalhao();
    preencherSelectFazendas(fid);
    const fz = lerFazendas().find((x) => x.id === fid);
    if (fz && fz.implementos) marcarImplementos(fz.implementos);
    const t = lerTalhoes().find((x) => x.fazendaId === fid);
    if (t && estado.mapa) estado.mapa.ver(t.centro ? t.centro.lat : t.pts[0][0], t.centro ? t.centro.lng : t.pts[0][1], 16);
    estado.pts = []; redesenhar(true); alternarDesenho(true);
    $("#t-nome").focus();
  }

  // Todos os campos do formulário do talhão são obrigatórios.
  function validarTalhao() {
    const u = estado.ultimo, fid = $("#t-fazenda").value, nova = fid === "__nova";
    const impl = implMarcados().length || $("#impl-nenhum").checked;
    const ok = validar([
      [$("#t-nome"), temLetras($("#t-nome").value, 2) || /\d/.test($("#t-nome").value) ? "" : "Dê um nome ao talhão."],
      [$("#t-fazenda"), fid ? "" : "Escolha a fazenda do talhão (ou cadastre uma nova)."],
      [nova && $("#nf-nome"), temLetras($("#nf-nome").value, 2) ? "" : "Informe o nome da nova fazenda."],
      [nova && $("#nf-prop"), temLetras($("#nf-prop").value, 3) ? "" : "Informe o proprietário da nova fazenda."],
      [$("#coord"), u && u.ok ? "" : "Desenhe o contorno do talhão no mapa (pelo menos 3 pontos) ou cole as coordenadas."],
      [$("#t-mun"), temLetras($("#t-mun").value, 2) ? "" : "Informe o município."],
      [$("#t-uf"), $("#t-uf").value ? "" : "Escolha a UF."],
      [$("#altitude"), numero($("#altitude"), 0, 3000, "a altitude", "m")],
      [$("#tmedia"), numero($("#tmedia"), 5, 35, "a temperatura média", "°C")],
      [$("#declive"), numero($("#declive"), 0, 100, "a declividade", "%")],
      [$("#impl-nenhum"), impl ? "" : "Marque as máquinas da fazenda ou “Nenhuma (colheita manual)”."],
      [$("#prod-atual"), numero($("#prod-atual"), 0, 200, "a produção atual (0 se ainda não produz)", "sc/ha")],
      [$("#equipe"), numero($("#equipe"), 1, 500, "o número de pessoas na colheita")],
    ], $("#form-talhao"));
    if (!ok) $("#t-salvo-msg").textContent = "Faltam dados: veja os campos marcados em vermelho.";
    return ok;
  }

  function salvarTalhao() {
    if (!validarTalhao()) return;
    const u = estado.ultimo;
    let fid = $("#t-fazenda").value;
    const fs = lerFazendas();
    if (fid === "__nova") {
      const nome = $("#nf-nome").value.trim().replace(/\s+/g, " ");
      const f = { id: "f" + Date.now(), nome, proprietario: $("#nf-prop").value.trim(), municipio: $("#t-mun").value.trim(), uf: $("#t-uf").value, criado: new Date().toISOString() };
      fs.push(f); guardar.gravar("fazendas", fs); fid = f.id;
      $("#nf-nome").value = ""; $("#nf-prop").value = "";
    }
    const ts = lerTalhoes();
    const reg = {
      id: estado.talhaoId || Date.now(), nome: $("#t-nome").value.trim().replace(/\s+/g, " "), fazendaId: fid,
      especie: estado.especie, area: u.areaHa, pts: estado.pts.map((p) => [p.lat, p.lng]), centro: estado.centro,
      alt: u.alt, tmedia: u.t, irrig: u.irrig, prodAtual: +$("#prod-atual").value, data: new Date().toISOString(),
      municipio: $("#t-mun").value.trim(), uf: $("#t-uf").value, regiao: estado.regiao || "", implementos: u.impl, declive: u.declive, equipe: u.equipe,
      resultado: { apt: u.apt.rotulo, cenario: u.melhor.nome, scha: u.melhor.med, producao: u.melhor.total },
    };
    const i = ts.findIndex((x) => x.id === reg.id);
    if (i >= 0) ts[i] = reg; else ts.push(reg);
    // A fazenda herda município/UF do talhão quando ainda não tem, e guarda as máquinas informadas.
    const fz = lerFazendas(), f = fz.find((x) => x.id === fid);
    if (f) { if (!f.municipio && reg.municipio) { f.municipio = reg.municipio; f.uf = f.uf || reg.uf; } f.implementos = reg.implementos; if (logado()) f.pendente = true; guardar.gravar("fazendas", fz); }
    if (logado()) reg.pendente = true;
    guardar.gravar("talhoes", ts);
    estado.talhaoId = reg.id;
    $("#t-nome").value = reg.nome;
    preencherSelectFazendas(fid || "");
    listarSalvos();
    const fn = nomeFazenda(fid);
    atualizarRotuloTalhao();
    const feito = (i >= 0 ? "Atualizado" : "Salvo") + (fn ? " em " + fn : "");
    toast(reg.nome + (i >= 0 ? " atualizado" : " salvo"));
    $("#btn-ver-resultado").hidden = false;
    estado.res = null; // novo cálculo: o resultado volta a destacar o melhor cenário
    if (!logado()) { $("#t-salvo-msg").textContent = feito + " neste aparelho."; return; }
    $("#t-salvo-msg").textContent = feito + ". Enviando…";
    sincronizar(true).then((ok) => { $("#t-salvo-msg").textContent = feito + (ok ? " na sua conta." : " no aparelho. Envia quando houver conexão."); atualizarRotuloTalhao(); });
  }

  function totaisDe(ts) {
    return ts.reduce((a, t) => { const r = resultadoTalhao(t); a.area += t.area; a.prod += r.producao; return a; }, { area: 0, prod: 0 });
  }
  function tile(rotulo, valor, sub) {
    return '<div class="metrica"><span class="rotulo">' + rotulo + '</span><b class="num">' + valor + "</b><p>" + (sub || "&nbsp;") + "</p></div>";
  }

  function listaTalhoesCard(ts) {
    if (!ts.length) return '<p class="mudo" style="font-size:13px">Nenhum talhão salvo nesta fazenda.</p>';
    return '<div class="talhoes-card">' + ts.map((t) => { const r = resultadoTalhao(t);
      return '<button type="button" class="talhao-item" data-acao="abrir-talhao" data-id="' + t.id + '"><span><b>' + esc(t.nome) + "</b><small>" +
        (t.especie === "arabica" ? "Arábica" : "Conilon") + " · " + fmt(t.area, 2) + " ha · " + fmt(r.producao, 0) + ' sc</small></span><span class="talhao-abrir">Abrir análise ›</span></button>'; }).join("") + "</div>";
  }

  function renderFazendas() {
    const fs = lerFazendas(), ts = lerTalhoes();
    const tot = totaisDe(ts);
    $("#faz-totais").innerHTML = tile("Fazendas", fmt(fs.length)) + tile("Talhões salvos", fmt(ts.length)) +
      tile("Área mapeada", fmt(tot.area, 1) + " <small>ha</small>") + tile("Produção estimada", fmt(tot.prod, 0) + " <small>sc</small>", "Cenário de maior produção em cada talhão");
    const sel = estado.fazendaSel;
    if (sel && (sel === "__sem" || fs.some((f) => f.id === sel))) return renderFazendaDetalhe(sel);
    estado.fazendaSel = null;
    const orfaos = ts.filter((t) => !t.fazendaId || !fs.some((f) => f.id === t.fazendaId));
    if (!fs.length && !orfaos.length) {
      $("#faz-conteudo").innerHTML = '<p class="vazio">Nenhuma fazenda cadastrada. Toque em “Nova fazenda” ou salve um talhão escolhendo “Cadastrar nova fazenda”.</p>';
      return;
    }
    const cards = fs.map((f) => {
      const tf = ts.filter((t) => t.fazendaId === f.id), tt = totaisDe(tf);
      const pct = f.areaTotal ? Math.min(100, tt.area / f.areaTotal * 100) : null;
      return '<article class="fazenda"><header><h3>' + esc(f.nome) + "</h3><p>" + esc([f.proprietario || "Proprietário não informado", localFaz(f)].filter(Boolean).join(" · ")) + "</p></header>" +
        "<dl><div><dt>Talhões</dt><dd>" + tf.length + "</dd></div><div><dt>Área mapeada</dt><dd>" + fmt(tt.area, 1) + " ha</dd></div><div><dt>Produção</dt><dd>" + fmt(tt.prod, 0) + " sc</dd></div></dl>" +
        (pct != null ? '<div class="mapeado"><span>' + fmt(pct, 0) + "% de " + fmt(f.areaTotal, 1) + ' ha mapeados em talhões</span><div class="barra"><span style="width:' + pct + '%"></span></div></div>' : "") +
        listaTalhoesCard(tf) +
        '<div class="linha"><button class="btn pri peq" type="button" data-acao="ver" data-id="' + f.id + '">Ver análise da fazenda</button><button class="btn peq" type="button" data-acao="editar" data-id="' + f.id + '">Editar</button></div></article>';
    });
    if (orfaos.length) {
      const tt = totaisDe(orfaos);
      cards.push('<article class="fazenda"><header><h3>Talhões sem fazenda</h3><p>Vincule-os a uma fazenda ao abrir e salvar de novo.</p></header>' +
        "<dl><div><dt>Talhões</dt><dd>" + orfaos.length + "</dd></div><div><dt>Área</dt><dd>" + fmt(tt.area, 1) + " ha</dd></div><div><dt>Produção</dt><dd>" + fmt(tt.prod, 0) + " sc</dd></div></dl>" +
        listaTalhoesCard(orfaos) + '<div class="linha"><button class="btn peq" type="button" data-acao="ver" data-id="__sem">Ver análise</button></div></article>');
    }
    $("#faz-conteudo").innerHTML = '<div class="fazendas">' + cards.join("") + "</div>";
  }

  function renderFazendaDetalhe(id) {
    const fs = lerFazendas(), todos = lerTalhoes();
    const f = id === "__sem" ? { id, nome: "Talhões sem fazenda" } : fs.find((x) => x.id === id);
    const ts = id === "__sem" ? todos.filter((t) => !t.fazendaId || !fs.some((x) => x.id === t.fazendaId)) : todos.filter((t) => t.fazendaId === id);
    const tt = totaisDe(ts);
    const media = tt.area ? tt.prod / tt.area : 0;
    const linhas = ts.map((t) => Object.assign({ t }, resultadoTalhao(t)));
    const maxProd = Math.max(1, ...linhas.map((l) => l.producao));
    const melhor = linhas.reduce((a, b) => (!a || b.producao > a.producao ? b : a), null);
    const arabica = ts.filter((t) => t.especie === "arabica").reduce((a, t) => a + t.area, 0);
    const info = id === "__sem" ? "" : [f.proprietario ? "Proprietário: " + f.proprietario : "Proprietário não informado", localFaz(f), f.telefone, f.car ? "CAR " + f.car : "", f.implementos && f.implementos.length ? "Máquinas: " + textoImplementos(f.implementos) : ""].filter(Boolean).join(" · ");
    $("#faz-conteudo").innerHTML =
      '<section class="bloco"><div class="bloco-cab"><div><button class="btn peq" type="button" data-acao="voltar">← Todas as fazendas</button></div>' +
      '<div class="linha">' + (id !== "__sem" ? '<button class="btn acao peq" type="button" data-acao="novo-talhao" data-id="' + id + '">Novo talhão nesta fazenda</button>' +
        '<button class="btn pri peq" type="button" data-acao="xlsx" data-id="' + id + '"' + (ts.length ? "" : " disabled") + ">Baixar planilha (.xlsx)</button>" +
        '<button class="btn peq" type="button" data-acao="editar" data-id="' + id + '">Editar</button>' +
        '<button class="btn peq perigo" type="button" data-acao="excluir" data-id="' + id + '">Excluir fazenda</button>' : "") + "</div></div>" +
      "<div><h2>" + esc(f.nome) + '</h2><p class="mudo">' + esc(info) + (f.obs ? " · " + esc(f.obs) : "") + "</p></div>" +
      '<div class="metricas">' +
        tile("Área cadastrada", f.areaTotal ? fmt(f.areaTotal, 1) + " <small>ha</small>" : "--", f.areaTotal ? "Área total da propriedade" : "Informe em Editar") +
        tile("Área em talhões", fmt(tt.area, 1) + " <small>ha</small>", f.areaTotal ? fmt(Math.min(100, tt.area / f.areaTotal * 100), 0) + "% da área cadastrada" : ts.length + " talhões") +
        tile("Produção estimada", fmt(tt.prod, 0) + " <small>sc</small>", "Soma dos cenários de maior produção") +
        tile("Produtividade média", fmt(media, 0) + " <small>sc/ha</small>", tt.area ? "Arábica " + fmt(arabica / tt.area * 100, 0) + "% · Conilon " + fmt(100 - arabica / tt.area * 100, 0) + "%" : "&nbsp;") +
      "</div>" +
      (ts.length
        ? '<h3>Mapa dos talhões</h3><p class="mudo" style="font-size:13px">Toque em um talhão no mapa ou na tabela para abrir a análise completa.</p><div id="mapa-faz" class="mapa-faz" role="application" aria-label="Mapa dos talhões da fazenda"></div>' +
          '<h3>Talhões</h3><div class="tabela-caixa"><table class="tabela"><thead><tr><th>Talhão</th><th>Espécie</th><th class="n">Área (ha)</th><th>Aptidão</th><th>Cenário de maior produção</th><th class="n">sc/ha</th><th class="n">Sacas</th><th></th></tr></thead><tbody>' +
          linhas.map((l) => '<tr class="clicavel" data-acao="abrir-talhao" data-id="' + l.t.id + '"><td><b>' + esc(l.t.nome) + "</b></td><td>" + (l.t.especie === "arabica" ? "Arábica" : "Conilon") + '</td><td class="n">' + fmt(l.t.area, 2) + "</td><td>" + l.apt + "</td><td>" + l.cenario +
            '</td><td class="n">' + fmt(l.scha, 0) + '</td><td class="n">' + fmt(l.producao, 0) + '</td><td class="n"><div class="linha" style="justify-content:flex-end;flex-wrap:nowrap">' +
            '<button class="btn pri peq" type="button" data-acao="resultado-talhao" data-id="' + l.t.id + '">Ver resultado</button><button class="btn peq" type="button" data-acao="abrir-talhao" data-id="' + l.t.id + '">Editar</button><button class="btn peq perigo" type="button" data-acao="excluir-talhao" data-id="' + l.t.id + '">Excluir</button></div></td></tr>').join("") +
          "</tbody></table></div>" +
          '<h3>Produção estimada por talhão</h3><div class="janelas">' +
          linhas.map((l) => '<div class="barra-h"><span>' + esc(l.t.nome) + '</span><div class="trilho"><span class="' + (l === melhor ? "melhor" : "") + '" style="width:' + (l.producao / maxProd * 100) + '%"></span></div><b class="num">' + fmt(l.producao, 0) + " sc</b></div>").join("") + "</div>"
        : '<p class="vazio">Nenhum talhão nesta fazenda ainda. Toque em “Novo talhão nesta fazenda” para delimitar o primeiro.</p>') +
      "</section>";
    clearTimeout(estado.timerMapaFaz);
    if (ts.length) estado.timerMapaFaz = setTimeout(() => mapaFazenda(ts), 30);
  }

  let mapaFaz = null;
  function mapaFazenda(ts) {
    if (mapaFaz) { mapaFaz.remover(); mapaFaz = null; }
    const el = $("#mapa-faz"); if (!el || !window.AeraMapa) return;
    try { mapaFaz = window.AeraMapa.criar(el, { rolagem: false, centro: ts[0].pts[0], zoom: 15 }); } catch (e) { return; }
    mapaFaz.poligonos(ts.map((t) => {
      const r = resultadoTalhao(t);
      return { pts: t.pts, dica: "<b>" + esc(t.nome) + "</b><br>" + fmt(t.area, 2) + " ha · " + fmt(r.producao, 0) + " sc",
        onClick: () => { location.hash = "talhao"; setTimeout(() => carregarTalhao(t), 80); } };
    }));
  }

  function abrirFormFazenda(id) {
    const f = id ? lerFazendas().find((x) => x.id === id) : {};
    estado.fazEditando = id || null;
    $("#form-faz-t").textContent = id ? "Editar " + f.nome : "Nova fazenda";
    $("#f-nome").value = f.nome || ""; $("#f-prop").value = f.proprietario || ""; $("#f-tel").value = f.telefone || "";
    const tl = id ? lerTalhoes().find((t) => t.fazendaId === id && t.municipio) : null;
    $("#f-mun").value = f.municipio || (tl ? tl.municipio : ""); $("#f-uf").value = f.uf || (tl ? tl.uf : ""); $("#f-area").value = f.areaTotal || "";
    $("#f-msg").textContent = !f.municipio && tl ? "Município preenchido pela localização do talhão " + tl.nome + "." : "";
    $("#f-car").value = f.car || ""; $("#f-obs").value = f.obs || "";
    $("#form-faz").hidden = false; $("#f-nome").focus();
    $("#form-faz").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function backupJSON() {
    return JSON.stringify({ app: "AERA", versao: 1, exportadoEm: new Date().toISOString(), perfil: lerPerfil(), regiao: guardar.ler("regiao", 0), fazendas: lerFazendas(), talhoes: lerTalhoes() }, null, 2);
  }

  async function planilhaFazenda(id, botao) {
    const f = lerFazendas().find((x) => x.id === id); if (!f) return;
    const ts = lerTalhoes().filter((t) => t.fazendaId === id), tt = totaisDe(ts);
    const [resp, respInfo] = responsavel();
    if (botao) { botao.disabled = true; botao.textContent = "Gerando…"; }
    try {
      let mapa = null;
      if (ts.length) {
        try { mapa = await window.AeraImagens.croqui(ts.map((t) => ({ nome: t.nome, pts: t.pts })),
          { titulo: f.nome, subtitulo: ts.length + " talhões · " + fmt(tt.area, 1) + " ha mapeados", rodape: "AERA · WGS 84" }); } catch (e) { mapa = null; }
      }
      const d = {
        logoBase64: logoB64(), subtitulo: f.nome + (f.proprietario ? " · " + f.proprietario : "") + " · gerado em " + agora(), cabecalho: f.nome, mapa,
        cadastro: [["Fazenda", f.nome], ["Proprietário", f.proprietario || ""], ["Telefone", f.telefone || ""], ["Município/UF", localFaz(f)],
          ["Área total cadastrada (ha)", f.areaTotal || "", f.areaTotal ? 5 : null], ["CAR", f.car || ""], ["Máquinas e implementos", textoImplementos(f.implementos)], ["Observações", f.obs || ""],
          ["Responsável técnico", [resp, respInfo].filter(Boolean).join(" · ")], ["Data", agora()]],
        totais: [["Talhões", ts.length, 6], ["Área em talhões (ha)", +tt.area.toFixed(2), 5],
          ["Área mapeada (% da cadastrada)", f.areaTotal ? +(tt.area / f.areaTotal * 100).toFixed(1) : "Informe a área total", f.areaTotal ? 5 : null],
          ["Produção estimada (sacas)", Math.round(tt.prod), 6], ["Produtividade média (sc/ha)", tt.area ? +(tt.prod / tt.area).toFixed(1) : 0, 5]],
        talhoes: ts.map((t) => { const r = resultadoTalhao(t); const c = t.centro || { lat: t.pts[0][0], lng: t.pts[0][1] };
          return { nome: t.nome, especie: t.especie === "arabica" ? "Arábica" : "Conilon", area: t.area, apt: r.apt, cenario: r.cenario, scha: r.scha, producao: r.producao,
            alt: t.alt || 0, tmedia: t.tmedia || 0, lat: c.lat, lng: c.lng, data: new Date(t.data).toLocaleDateString("pt-BR") }; }),
        areaTotalTalhoes: tt.area, producaoTotal: tt.prod, mediaScha: tt.area ? tt.prod / tt.area : 0,
        aviso: "Estimativas do protótipo AERA a partir de parâmetros de referência; validar com engenheiro agrônomo.",
      };
      const blob = await window.AeraExport.fazendaXlsx(d);
      await salvarArquivo(nomeArquivo("Fazenda", [f.nome, ts.length + (ts.length === 1 ? "-talhao" : "-talhoes"), f.proprietario || "Sem-proprietario"], "xlsx"), blob);
    } catch (e) { toast(e && e.message ? e.message : "Não foi possível gerar a planilha"); }
    finally { if (botao && botao.isConnected) { botao.disabled = false; botao.textContent = "Baixar planilha (.xlsx)"; } }
  }

  function iniciarFazendas() {
    preencherSelectFazendas("");
    $("#btn-nova-faz").addEventListener("click", () => abrirFormFazenda(null));
    $("#btn-faz-cancelar").addEventListener("click", () => { $("#form-faz").hidden = true; });
    $("#form-faz").addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = $("#f-nome").value.trim().replace(/\s+/g, " ");
      $("#f-msg").textContent = "";
      const area = $("#f-area").value.trim();
      if (!validar([
        [$("#f-nome"), temLetras(nome, 2) ? "" : "Informe o nome da fazenda."],
        [$("#f-prop"), temLetras($("#f-prop").value, 3) ? "" : "Informe o nome do proprietário."],
        [$("#f-tel"), regraTel($("#f-tel"), false)],
        [$("#f-mun"), temLetras($("#f-mun").value, 2) ? "" : "Informe o município."],
        [$("#f-uf"), $("#f-uf").value ? "" : "Escolha a UF."],
        [$("#f-area"), area === "" ? "" : numero($("#f-area"), 0.1, 100000, "a área total", "ha")],
      ], $("#form-faz"))) return;
      const fs = lerFazendas();
      const dados = { nome, proprietario: $("#f-prop").value.trim(), telefone: formatarTel($("#f-tel").value), municipio: $("#f-mun").value.trim(),
        uf: $("#f-uf").value, areaTotal: +$("#f-area").value || null, car: $("#f-car").value.trim(), obs: $("#f-obs").value.trim() };
      const i = fs.findIndex((x) => x.id === estado.fazEditando);
      if (i >= 0) fs[i] = Object.assign(fs[i], dados, logado() ? { pendente: true } : {});
      else fs.push(Object.assign({ id: "f" + Date.now(), criado: new Date().toISOString() }, dados));
      guardar.gravar("fazendas", fs);
      sincronizar();
      $("#form-faz").hidden = true;
      preencherSelectFazendas($("#t-fazenda").value);
      renderFazendas(); listarSalvos();
      toast(nome + " salva");
    });
    $("#faz-conteudo").addEventListener("click", (e) => {
      const b = e.target.closest("[data-acao]"); if (!b) return;
      const id = b.dataset.id, acao = b.dataset.acao;
      if (acao === "ver") { estado.fazendaSel = id; renderFazendas(); window.scrollTo(0, 0); }
      else if (acao === "voltar") { estado.fazendaSel = null; renderFazendas(); }
      else if (acao === "editar") abrirFormFazenda(id);
      else if (acao === "novo-talhao") { estado.fazendaPre = id; location.hash = "talhao"; }
      else if (acao === "xlsx") planilhaFazenda(id, b);
      else if (acao === "resultado-talhao") { const t = lerTalhoes().find((x) => String(x.id) === id); if (t) abrirResultadoDe(t); }
      else if (acao === "abrir-talhao") { const t = lerTalhoes().find((x) => String(x.id) === id); if (t) { location.hash = "talhao"; setTimeout(() => carregarTalhao(t), 80); } }
      else if (acao === "excluir" || acao === "excluir-talhao") {
        if (!b.classList.contains("confirmar")) { b.classList.add("confirmar"); b.textContent = "Confirmar exclusão"; setTimeout(() => { if (b.isConnected) { b.classList.remove("confirmar"); b.textContent = acao === "excluir" ? "Excluir fazenda" : "Excluir"; } }, 4000); return; }
        if (acao === "excluir") {
          guardar.gravar("fazendas", lerFazendas().filter((x) => x.id !== id));
          guardar.gravar("talhoes", lerTalhoes().map((t) => (t.fazendaId === id ? Object.assign(t, { fazendaId: null }) : t)));
          excluirNaNuvem("fazendas", id);
          estado.fazendaSel = null; toast("Fazenda excluída. Os talhões ficaram sem fazenda.");
        } else {
          guardar.gravar("talhoes", lerTalhoes().filter((t) => String(t.id) !== id));
          excluirNaNuvem("talhoes", id);
          if (String(estado.talhaoId) === id) novoTalhao();
          toast("Talhão excluído");
        }
        preencherSelectFazendas($("#t-fazenda").value); renderFazendas(); listarSalvos();
      }
    });
    $("#btn-backup").addEventListener("click", () => {
      salvarArquivo("AERA-backup-" + new Date().toISOString().slice(0, 10) + ".json", new Blob([backupJSON()], { type: "application/json" }));
    });
    $("#arq-backup").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result);
          if (d.app !== "AERA" || !Array.isArray(d.fazendas) || !Array.isArray(d.talhoes)) throw new Error("formato");
          const mesclar = (atual, novos) => { const m = new Map(atual.map((x) => [String(x.id), x])); novos.forEach((x) => m.set(String(x.id), x)); return [...m.values()]; };
          guardar.gravar("fazendas", mesclar(lerFazendas(), d.fazendas));
          guardar.gravar("talhoes", mesclar(lerTalhoes(), d.talhoes));
          if (d.perfil && d.perfil.nome && !lerPerfil().nome) guardar.gravar("perfil", d.perfil);
          preencherSelectFazendas(""); renderFazendas(); listarSalvos(); mostrarPerfil();
          toast("Backup importado: " + d.fazendas.length + " fazendas e " + d.talhoes.length + " talhões");
        } catch (err) { toast("Arquivo inválido. Use um backup exportado pelo AERA."); }
      };
      r.readAsText(f); e.target.value = "";
    });
  }

  // ================================================================
  // NOTÍCIAS (página de teste): Google Notícias via rss2json + Crossref
  // ================================================================
  let noticiasCarregadas = false, temaAtual = "clima";
  const TEMAS = {
    clima: "café lavoura clima chuva OR geada OR seca",
    plantio: "café plantio OR adubação OR poda cafeicultura",
    mercado: "café arábica saca preço",
  };
  const REFS_TITULOS = ["Acompanhamento da safra brasileira de café (Conab)", "Crescimento, produtividade e bienalidade do cafeeiro em função do espaçamento de cultivo",
    "O clima e a cafeicultura no Brasil", "Cultura de café no Brasil: manual de recomendações", "Café Conilon (Incaper)", "A moderna cafeicultura dos cerrados brasileiros",
    "Custos operacionais da colheita mecanizada do cafeeiro", "Desempenho operacional de derriçadores mecânicos portáteis", "Colheita mecanizada do café em elevadas declividades",
    "Viabilidade técnica e econômica da colheita mecanizada do café", "Economic viability for different coffee harvest systems", "Como escolher a colhedora de café (Jacto)"];
  const semTags = (x) => String(x || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const dataCurta = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }); };

  async function carregarNoticiasTema(tema) {
    const rss = "https://news.google.com/rss/search?q=" + encodeURIComponent(TEMAS[tema] + " when:30d") + "&hl=pt-BR&gl=BR&ceid=BR:pt-419";
    $("#not-fonte").className = "selo"; $("#not-fonte").textContent = "Carregando";
    try {
      const j = await buscarJSON("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rss), 8000);
      if (j.status !== "ok" || !j.items || !j.items.length) throw new Error("vazio");
      $("#lista-not").innerHTML = j.items.slice(0, 10).map((it) => {
        const t = semTags(it.title), k = t.lastIndexOf(" - ");
        const titulo = k > 0 ? t.slice(0, k) : t, fonte = k > 0 ? t.slice(k + 3) : "Google Notícias";
        return '<a class="item-not" href="' + esc(it.link) + '" target="_blank" rel="noopener"><b>' + esc(titulo) + "</b><small>" + esc(fonte) + " · " + dataCurta((it.pubDate || "").replace(" ", "T")) + "</small></a>";
      }).join("");
      $("#not-fonte").className = "selo vivo"; $("#not-fonte").textContent = "Google Notícias · ao vivo";
    } catch (e) {
      $("#not-fonte").className = "selo exemplo"; $("#not-fonte").textContent = "Sem conexão";
      $("#lista-not").innerHTML = '<p class="aviso-lista">Não foi possível buscar notícias nesta visualização. A prévia dentro do Claude bloqueia sites externos; abrindo o app pelo navegador, as manchetes do Google Notícias aparecem aqui. Abaixo, o formato de cada item.</p>' +
        ["Manchete da notícia sobre " + ({ clima: "o clima nas regiões produtoras", plantio: "plantio e manejo do cafezal", mercado: "o mercado do café" })[tema], "Segunda manchete do tema", "Terceira manchete do tema"]
          .map((t) => '<div class="item-not exemplo"><b>' + t + "</b><small>Exemplo de layout · nome do veículo · data</small></div>").join("");
    }
  }

  async function carregarArtigos() {
    const ano = new Date().getFullYear() - 1;
    $("#art-fonte").className = "selo"; $("#art-fonte").textContent = "Carregando";
    try {
      const u = "https://api.crossref.org/works?query=" + encodeURIComponent("coffee Coffea arabica canephora climate planting yield") +
        "&filter=from-pub-date:" + ano + "-01-01,type:journal-article&sort=published&order=desc&rows=10&select=title,container-title,published,URL,author";
      const j = await buscarJSON(u, 9000);
      const itens = (j.message && j.message.items || []).filter((x) => x.title && x.title[0] && /coffe|café|cafe/i.test(x.title[0]));
      if (!itens.length) throw new Error("vazio");
      $("#lista-art").innerHTML = itens.slice(0, 8).map((x) => {
        const autores = (x.author || []).slice(0, 2).map((a) => a.family).filter(Boolean).join(", ") + ((x.author || []).length > 2 ? " et al." : "");
        const dp = x.published && x.published["date-parts"] && x.published["date-parts"][0];
        return '<a class="item-not" href="' + esc(x.URL) + '" target="_blank" rel="noopener"><b>' + esc(semTags(x.title[0])) + "</b><small>" +
          esc([autores, semTags((x["container-title"] || [])[0]), dp ? dp[0] : ""].filter(Boolean).join(" · ")) + "</small></a>";
      }).join("");
      $("#art-fonte").className = "selo vivo"; $("#art-fonte").textContent = "Crossref · ao vivo";
    } catch (e) {
      $("#art-fonte").className = "selo exemplo"; $("#art-fonte").textContent = "Base offline";
      $("#lista-art").innerHTML = '<p class="aviso-lista">Sem acesso à busca de artigos nesta visualização. Mostrando as referências usadas nos cenários do AERA.</p>' +
        REFS.map((r, i) => '<div class="item-not"><b>' + esc(REFS_TITULOS[i]) + "</b><small>" + esc(r) + "</small></div>").join("");
    }
  }

  function carregarNoticias() {
    noticiasCarregadas = true;
    carregarNoticiasTema(temaAtual);
    carregarArtigos();
  }
  function iniciarNoticias() {
    $("#seg-tema").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      temaAtual = b.dataset.v;
      document.querySelectorAll("#seg-tema button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      carregarNoticiasTema(temaAtual);
    });
    $("#btn-not-atualizar").addEventListener("click", carregarNoticias);
  }


  // ================================================================
  // CONTA E NUVEM (Supabase): o app grava no aparelho e sincroniza com a conta
  // ================================================================
  const nuvem = window.AeraNuvem || null;
  const logado = () => !!(nuvem && nuvem.usuario());
  let sincronizando = null;

  // Envia o que está pendente, baixa tudo da conta e atualiza a tela. Devolve true se chegou ao banco.
  async function sincronizar(silencioso) {
    if (!logado()) return false;
    if (sincronizando) return sincronizando;
    $("#conta-sinc").textContent = "Sincronizando…";
    sincronizando = (async () => {
      try {
        const troca = await nuvem.enviarPendentes(lerFazendas(), lerTalhoes(), guardar.ler("exclusoes", []));
        guardar.gravar("exclusoes", []);
        const d = await nuvem.baixarTudo();
        guardar.gravar("fazendas", d.fazendas); guardar.gravar("talhoes", d.talhoes);
        // Ids locais viram ids do banco: atualiza o que estiver aberto na tela.
        if (estado.talhaoId != null && troca[estado.talhaoId]) estado.talhaoId = troca[estado.talhaoId];
        if (estado.fazendaSel && troca[estado.fazendaSel]) estado.fazendaSel = troca[estado.fazendaSel];
        const sel = $("#t-fazenda").value; preencherSelectFazendas(troca[sel] || sel);
        listarSalvos(); if (location.hash === "#fazendas") renderFazendas();
        guardar.gravar("sinc", new Date().toISOString());
        pintarConta();
        return true;
      } catch (e) {
        pintarConta("Não sincronizou: " + nuvem.traduzir(e));
        if (!silencioso) toast(nuvem.traduzir(e));
        return false;
      } finally { sincronizando = null; }
    })();
    return sincronizando;
  }
  function excluirNaNuvem(tabela, id) {
    if (!logado() || !nuvem.ehUuid(id)) return;
    guardar.gravar("exclusoes", guardar.ler("exclusoes", []).concat([{ tabela, id }]));
    sincronizar();
  }

  function pintarConta(msg) {
    const u = nuvem && nuvem.usuario();
    $("#conta-sem").hidden = !!u; $("#conta-dentro").hidden = !u;
    $("#conta-chip").textContent = u ? "Conectado" : "Sem conta";
    $("#conta-chip").className = "chip" + (u ? "" : " atencao");
    $("#aviso-nuvem").hidden = !!u || !nuvem;
    if (u) {
      $("#conta-email").textContent = u.email;
      const t = guardar.ler("sinc", null);
      $("#conta-sinc").textContent = t ? "Sincronizado em " + new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Ainda não sincronizado";
    }
    $("#conta-msg").textContent = msg || "";
  }

  // Ao entrar: traz o perfil do banco (ou envia o do aparelho), sincroniza e,
  // se o cadastro ainda não tem nome, abre o passo 2 (completar cadastro).
  async function aoEntrar(vindoDaTelaEntrar) {
    pintarConta("Conectado. Sincronizando…");
    try {
      const r = await nuvem.lerPerfil(), p = lerPerfil();
      if (r && r.nome) {
        guardar.gravar("perfil", Object.assign({}, p, { nome: r.nome, funcao: r.funcao || p.funcao, registro: r.registro || "", empresa: r.empresa || "",
          email: r.email || "", tel: r.telefone || "", especie: r.especie || p.especie || "arabica" }));
        mostrarPerfil();
      } else if (p.nome) await nuvem.salvarPerfil(p);
    } catch (e) { /* o perfil não impede a sincronização */ }
    const ok = await sincronizar(true);
    pintarConta(ok ? "Fazendas e talhões guardados na sua conta." : "");
    if (!lerPerfil().nome) location.hash = "perfil";
    else if (vindoDaTelaEntrar) location.hash = "inicio";
  }

  // ---------- tela Entrar / Criar conta (passo 1) ----------
  let modoConta = "criar";
  function msgEntrar(txt, erro) { $("#entrar-msg").textContent = txt || ""; $("#entrar-msg").classList.toggle("erro", !!erro); }
  function definirModoConta(m) {
    modoConta = m;
    const criar = m === "criar";
    $("#seg-conta").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === m)));
    $("#t-entrar").textContent = criar ? "Crie sua conta" : "Entre na sua conta";
    $("#entrar-passo").hidden = !criar;
    $("#campo-senha2").hidden = !criar;
    $("#btn-conta").textContent = criar ? "Criar conta" : "Entrar";
    $("#c-senha").setAttribute("autocomplete", criar ? "new-password" : "current-password");
    msgEntrar("");
  }
  function abrirEntrar() {
    if (logado()) { location.hash = "perfil"; return; }
    $("#conta-fora").hidden = false; $("#entrar-confirmar").hidden = true;
    const pend = guardar.ler("emailPendente", "");
    if (pend) { $("#c-email").value = pend; definirModoConta("entrar"); }
  }

  function iniciarConta() {
    if (!nuvem || !nuvem.disponivel()) { $("#conta").hidden = true; return; }
    const ocupado = (sim) => { $("#btn-conta").disabled = sim; };
    $("#seg-conta").addEventListener("click", (e) => { const b = e.target.closest("button[data-modo]"); if (b) definirModoConta(b.dataset.modo); });
    $("#conta-fora").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#c-email").value.trim().toLowerCase(), senha = $("#c-senha").value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msgEntrar("Informe um e-mail válido.", true); return $("#c-email").focus(); }
      if (senha.length < 6) { msgEntrar("A senha precisa ter pelo menos 6 caracteres.", true); return $("#c-senha").focus(); }
      if (modoConta === "criar" && senha !== $("#c-senha2").value) { msgEntrar("As duas senhas não são iguais.", true); return $("#c-senha2").focus(); }
      ocupado(true); msgEntrar(modoConta === "criar" ? "Criando a conta…" : "Entrando…");
      try {
        if (modoConta === "criar") {
          const r = await nuvem.criarConta(email, senha);
          $("#c-senha").value = $("#c-senha2").value = "";
          if (r.confirmar) {
            guardar.gravar("emailPendente", email);
            $("#entrar-email").textContent = email;
            $("#conta-fora").hidden = true; $("#entrar-confirmar").hidden = false;
            return;
          }
        } else {
          await nuvem.entrar(email, senha);
          $("#c-senha").value = "";
        }
        guardar.gravar("emailPendente", ""); guardar.gravar("semConta", false);
        msgEntrar("");
        await aoEntrar(true);
      } catch (err) { msgEntrar(nuvem.traduzir(err), true); }
      finally { ocupado(false); }
    });
    $("#btn-ja-confirmei").addEventListener("click", () => {
      $("#entrar-confirmar").hidden = true; $("#conta-fora").hidden = false;
      definirModoConta("entrar"); $("#c-senha").focus();
    });
    $("#lk-sem-conta").addEventListener("click", () => guardar.gravar("semConta", true));
    $("#btn-sinc").addEventListener("click", async () => { if (await sincronizar()) pintarConta("Tudo sincronizado."); });
    $("#btn-sair").addEventListener("click", async () => {
      await nuvem.sair();
      // Os dados da conta saem deste aparelho; o que era só local continua.
      guardar.gravar("fazendas", lerFazendas().filter((f) => !f.nuvem));
      guardar.gravar("talhoes", lerTalhoes().filter((t) => !t.nuvem));
      guardar.gravar("sinc", null);
      preencherSelectFazendas(""); listarSalvos(); renderFazendas(); preencherFormPerfil();
      pintarConta("Você saiu da conta.");
    });
    pintarConta();
    nuvem.iniciar(() => { pintarConta(); }).then((u) => { pintarConta(); if (u) sincronizar(true); });
    window.addEventListener("online", () => sincronizar(true));
  }

  // ---------- tela de entrada ----------
  function abrirApp() {
    const splash = $("#splash");
    const semMovimento = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => {
      splash.classList.add("saindo");
      setTimeout(() => splash.remove(), 600);
      // Primeiro acesso: criar conta (passo 1) e depois completar o cadastro (passo 2).
      if (!lerPerfil().nome && !logado() && nuvem && nuvem.disponivel() && !guardar.ler("semConta", false)) location.hash = "entrar";
      else if (!lerPerfil().nome && location.hash !== "#perfil") location.hash = "perfil";
    }, semMovimento ? 700 : 2100);
  }

  iniciarPerfil();
  iniciarInicio();
  iniciarTalhao();
  iniciarFazendas();
  iniciarNoticias();
  iniciarConta();
  iniciarValidacao();
  definirEspecie(lerPerfil().especie || "arabica");
  rota();
  abrirApp();
})();
