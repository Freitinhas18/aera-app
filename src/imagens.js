/* AERA · imagens para relatórios: croqui do talhão/fazenda e gráfico de cenários (canvas → PNG). */
window.AeraImagens = (function () {
  "use strict";

  const COR = { grafite: "#253946", grafite3: "#6b7d88", campo: "#5F8A2E", broto: "#8CC63F", papel: "#F7F9F4", linha: "#cfd8c8", branco: "#ffffff" };
  const FONTE_T = '"Poppins", Arial, sans-serif', FONTE = "Arial, sans-serif";
  const fmt = (n, d = 0) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/";

  // Web Mercator: coordenada → pixel do "mundo" no zoom 0 (256 px).
  function merc(lat, lng) {
    const s = Math.sin(lat * Math.PI / 180);
    return { x: 256 * (lng + 180) / 360, y: 256 * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) };
  }
  // Distância no elipsoide WGS 84 (plano local no ponto médio), a mesma base do cálculo de área do app.
  function distancia(a, b) {
    const d = Math.PI / 180, e2 = 0.00669437999014, sen = Math.sin((a[0] + b[0]) / 2 * d), w = 1 - e2 * sen * sen;
    const dx = (b[1] - a[1]) * d * 6378137 / Math.sqrt(w) * Math.cos((a[0] + b[0]) / 2 * d);
    const dy = (b[0] - a[0]) * d * 6378137 * (1 - e2) / Math.pow(w, 1.5);
    return Math.hypot(dx, dy);
  }
  const bonito = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };

  function carregarTile(z, x, y, ms) {
    return new Promise((ok) => {
      const img = new Image(), t = setTimeout(() => ok(null), ms);
      img.crossOrigin = "anonymous";
      img.onload = () => { clearTimeout(t); ok(img); };
      img.onerror = () => { clearTimeout(t); ok(null); };
      img.src = TILE + z + "/" + y + "/" + x;
    });
  }

  function paraPNG(canvas) {
    return new Promise((ok, erro) => {
      try {
        canvas.toBlob((b) => {
          if (!b) return erro(new Error("png"));
          b.arrayBuffer().then((buf) => ok({ bytes: new Uint8Array(buf), w: canvas.width, h: canvas.height }), erro);
        }, "image/png");
      } catch (e) { erro(e); }
    });
  }

  function rotuloCaixa(ctx, txt, x, y, o) {
    o = o || {};
    ctx.font = (o.peso || "700") + " " + (o.tam || 22) + "px " + FONTE;
    const w = ctx.measureText(txt).width + 16, h = (o.tam || 22) + 12;
    ctx.fillStyle = o.fundo || "rgba(255,255,255,.92)";
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 6); ctx.fill();
    ctx.fillStyle = o.cor || COR.grafite; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(txt, x, y);
  }

  /**
   * Croqui de um ou mais polígonos. poligonos: [{nome, pts: [[lat,lng],...], destaque}]
   * info: {titulo, subtitulo, rodape}. Tenta o satélite Esri; sem acesso, desenha sobre grade.
   */
  async function croqui(poligonos, info, satelite) {
    const W = 1600, H = 1100, M = 110;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const todos = poligonos.flatMap((p) => p.pts);
    const pm = todos.map((p) => merc(p[0], p[1]));
    const minX = Math.min(...pm.map((p) => p.x)), maxX = Math.max(...pm.map((p) => p.x));
    const minY = Math.min(...pm.map((p) => p.y)), maxY = Math.max(...pm.map((p) => p.y));
    const escala0 = Math.min((W - 2 * M) / Math.max(maxX - minX, 1e-9), (H - 2 * M - 60) / Math.max(maxY - minY, 1e-9));
    const z = Math.max(1, Math.min(19, Math.floor(Math.log2(escala0))));
    const s = escala0 / Math.pow(2, z) * 0.92; // fator entre pixel do tile e pixel do canvas
    const cx = (minX + maxX) / 2 * Math.pow(2, z), cy = (minY + maxY) / 2 * Math.pow(2, z);
    const ox = cx - W / 2 / s, oy = cy - (H / 2 + 20) / s; // origem da vista em pixels de mundo no zoom z
    const px = (lat, lng) => { const m = merc(lat, lng); return [(m.x * Math.pow(2, z) - ox) * s, (m.y * Math.pow(2, z) - oy) * s]; };
    const latC = todos.reduce((a, p) => a + p[0], 0) / todos.length;
    const mpp = 156543.03392 * Math.cos(latC * Math.PI / 180) / Math.pow(2, z) / s; // metros por pixel do canvas

    // Fundo: satélite (quando o navegador permite) ou grade métrica
    let comSatelite = false;
    if (satelite !== false) {
      const x0 = Math.floor(ox / 256), x1 = Math.floor((ox + W / s) / 256), y0 = Math.floor(oy / 256), y1 = Math.floor((oy + H / s) / 256);
      const pedidos = [];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) pedidos.push(carregarTile(z, x, y, 6000).then((img) => ({ x, y, img })));
      const tiles = pedidos.length <= 80 ? await Promise.all(pedidos) : [];
      if (tiles.length && tiles.every((t) => t.img)) {
        tiles.forEach((t) => ctx.drawImage(t.img, (t.x * 256 - ox) * s, (t.y * 256 - oy) * s, 256 * s + 1, 256 * s + 1));
        try { ctx.getImageData(0, 0, 1, 1); comSatelite = true; } catch (e) { comSatelite = false; }
        if (comSatelite) { ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, 0, W, H); }
      }
    }
    if (!comSatelite) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COR.papel; ctx.fillRect(0, 0, W, H);
      const passo = bonito(120 * mpp) / mpp;
      ctx.strokeStyle = "#e3e9dd"; ctx.lineWidth = 1;
      for (let x = ((-ox * s) % passo + passo) % passo; x < W; x += passo) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = ((-oy * s) % passo + passo) % passo; y < H; y += passo) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }

    // Polígonos
    const unico = poligonos.length === 1;
    poligonos.forEach((pol, k) => {
      const pts = pol.pts.map((p) => px(p[0], p[1]));
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
      ctx.fillStyle = pol.destaque === false ? "rgba(255,255,255,.25)" : "rgba(140,198,63,.30)"; ctx.fill();
      ctx.lineJoin = "round";
      ctx.strokeStyle = COR.grafite; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = COR.broto; ctx.lineWidth = 5; ctx.stroke();
      if (unico) {
        // medidas de cada lado
        pol.pts.forEach((a, i) => {
          const b = pol.pts[(i + 1) % pol.pts.length], pa = pts[i], pb = pts[(i + 1) % pts.length];
          rotuloCaixa(ctx, fmt(distancia(a, b), 0) + " m", (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, { tam: 20, peso: "700" });
        });
        pts.forEach((p, i) => {
          ctx.beginPath(); ctx.arc(p[0], p[1], 17, 0, Math.PI * 2);
          ctx.fillStyle = COR.grafite; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COR.branco; ctx.stroke();
          ctx.fillStyle = COR.branco; ctx.font = "700 18px " + FONTE; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(i + 1), p[0], p[1] + 1);
        });
      } else {
        const cxp = pts.reduce((a, p) => a + p[0], 0) / pts.length, cyp = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        rotuloCaixa(ctx, pol.nome, cxp, cyp, { tam: 20 });
      }
    });

    // Moldura de título
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.roundRect(28, 28, 640, 108, 10); ctx.fill();
    ctx.fillStyle = COR.broto; ctx.fillRect(28, 28, 8, 108);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = COR.grafite; ctx.font = "600 34px " + FONTE_T; ctx.fillText(info.titulo, 56, 76, 590);
    ctx.fillStyle = COR.grafite3; ctx.font = "400 22px " + FONTE; ctx.fillText(info.subtitulo, 56, 114, 590);

    // Norte
    const nx = W - 80, ny = 96;
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.arc(nx, ny, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COR.grafite; ctx.beginPath(); ctx.moveTo(nx, ny - 36); ctx.lineTo(nx + 16, ny + 18); ctx.lineTo(nx, ny + 8); ctx.lineTo(nx - 16, ny + 18); ctx.closePath(); ctx.fill();
    ctx.font = "700 20px " + FONTE; ctx.textAlign = "center"; ctx.fillText("N", nx, ny + 42);

    // Escala
    const metros = bonito(260 * mpp), largura = metros / mpp;
    const ex = 40, ey = H - 70;
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.roundRect(ex - 12, ey - 40, largura + 110, 64, 8); ctx.fill();
    ctx.fillStyle = COR.grafite; ctx.fillRect(ex, ey, largura / 2, 10); ctx.fillStyle = COR.branco; ctx.fillRect(ex + largura / 2, ey, largura / 2, 10);
    ctx.strokeStyle = COR.grafite; ctx.lineWidth = 2; ctx.strokeRect(ex, ey, largura, 10);
    ctx.fillStyle = COR.grafite; ctx.font = "700 18px " + FONTE; ctx.textAlign = "left";
    ctx.fillText("0", ex - 4, ey - 10); ctx.textAlign = "center"; ctx.fillText(fmt(metros) + " m", ex + largura, ey - 10);

    // Rodapé
    ctx.textAlign = "right"; ctx.font = "400 18px " + FONTE;
    const rod = info.rodape + (comSatelite ? " · Imagem: Esri World Imagery" : "");
    const wr = ctx.measureText(rod).width;
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.roundRect(W - wr - 44, H - 52, wr + 24, 32, 6); ctx.fill();
    ctx.fillStyle = COR.grafite; ctx.fillText(rod, W - 32, H - 30);

    try { return Object.assign(await paraPNG(c), { satelite: comSatelite }); }
    catch (e) { if (comSatelite) return croqui(poligonos, info, false); throw e; }
  }

  /** Gráfico horizontal dos cenários: faixa (min-máx), valor esperado e produção do talhão. */
  function graficoCenarios(cenarios) {
    const W = 1600, linhaH = 120, topo = 70, H = topo + cenarios.length * linhaH + 70;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = COR.branco; ctx.fillRect(0, 0, W, H);
    const bruto = Math.max(...cenarios.map((s) => s.hi)) * 1.05, passo = bonito(bruto / 5), max = Math.ceil(bruto / passo) * passo;
    const x0 = 470, x1 = W - 250;
    const sx = (v) => x0 + (x1 - x0) * v / max;
    ctx.font = "700 20px " + FONTE; ctx.fillStyle = COR.grafite3; ctx.textAlign = "left"; ctx.fillText("PRODUTIVIDADE (SC/HA)", x0, 40);
    ctx.textAlign = "right"; ctx.fillText("PRODUÇÃO DO TALHÃO", W - 30, 40);
    for (let v = 0; v <= max + 1e-9; v += passo) {
      ctx.strokeStyle = "#e6ebe2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx(v), topo); ctx.lineTo(sx(v), H - 60); ctx.stroke();
      ctx.fillStyle = COR.grafite3; ctx.font = "400 18px " + FONTE; ctx.textAlign = "center"; ctx.fillText(fmt(v), sx(v), H - 32);
    }
    cenarios.forEach((s, i) => {
      const y = topo + i * linhaH + linhaH / 2;
      const cor = s.melhor ? COR.campo : s.bloq ? "#a9b4ba" : COR.grafite;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = s.bloq ? COR.grafite3 : COR.grafite; ctx.font = "700 24px " + FONTE; ctx.fillText(s.nome, 30, y - 14, 420);
      ctx.fillStyle = COR.grafite3; ctx.font = "400 19px " + FONTE;
      ctx.fillText(s.espacamento + " · " + fmt(s.pl) + " pl/ha" + (s.bloq ? " · requer irrigação" : ""), 30, y + 18, 420);
      ctx.fillStyle = s.melhor ? "rgba(140,198,63,.35)" : "#e6ebe2";
      ctx.beginPath(); ctx.roundRect(sx(s.lo), y - 14, sx(s.hi) - sx(s.lo), 28, 14); ctx.fill();
      ctx.fillStyle = cor; ctx.beginPath(); ctx.roundRect(x0, y - 5, sx(s.med) - x0, 10, 5); ctx.fill();
      ctx.beginPath(); ctx.arc(sx(s.med), y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COR.grafite; ctx.font = "700 20px " + FONTE; ctx.textAlign = "left"; ctx.fillText(fmt(s.med) + " sc/ha", sx(s.hi) + 12, y);
      ctx.textAlign = "right"; ctx.font = "700 26px " + FONTE; ctx.fillStyle = cor; ctx.fillText(fmt(s.total) + " sc", W - 30, y);
      ctx.textBaseline = "alphabetic";
    });
    return paraPNG(c);
  }

  return { croqui, graficoCenarios, distancia };
})();
