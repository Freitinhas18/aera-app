/* AERA · mapa com Google Maps JavaScript API (precisa de chave). Mesma interface das outras versões. */
window.AeraMapa = (function () {
  "use strict";
  const CHAVE = "aera.gmapsKey";
  const ler = () => { try { return localStorage.getItem(CHAVE) || ""; } catch (e) { return ""; } };
  const gravar = (v) => { try { v ? localStorage.setItem(CHAVE, v) : localStorage.removeItem(CHAVE); } catch (e) { /* sem armazenamento */ } };
  let carregando = null;
  const ouvintes = [];

  function carregar(chave) {
    if (window.google && google.maps && google.maps.Map) return Promise.resolve();
    if (carregando) return carregando;
    carregando = new Promise((ok, falha) => {
      window.__aeraGoogleOk = ok;
      window.gm_authFailure = () => ouvintes.forEach((f) => f("A chave foi recusada pelo Google. Confira se a Maps JavaScript API está ativada e se este endereço está liberado na chave."));
      const s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?libraries=geometry&loading=async&language=pt-BR&region=BR&callback=__aeraGoogleOk" + (chave ? "&key=" + encodeURIComponent(chave) : "");
      s.async = true;
      s.onerror = () => { carregando = null; falha(new Error("Não foi possível baixar o Google Maps. Verifique a conexão.")); };
      document.head.appendChild(s);
    });
    return carregando;
  }

  // Tela para colar a chave quando ela ainda não foi informada.
  function pedirChave(el, erro) {
    return new Promise((ok) => {
      el.innerHTML = '<div class="gchave"><b>Google Maps</b><p>Cole sua chave da <i>Maps JavaScript API</i>. Ela fica salva só neste navegador.</p>' +
        (erro ? '<p class="gchave-erro">' + erro + "</p>" : "") +
        '<input type="text" placeholder="AIza…" autocomplete="off" spellcheck="false" value="' + ler().replace(/"/g, "") + '">' +
        '<div class="linha"><button type="button" class="btn pri peq" data-g="usar">Carregar mapa</button><button type="button" class="btn peq" data-g="sem">Usar sem chave (modo de teste)</button></div>' +
        '<small>Crie a chave em console.cloud.google.com, em APIs e serviços, Credenciais. Sem chave o Google mostra o mapa escurecido com a marca “for development purposes only”, mas a delimitação e a área funcionam.</small></div>';
      el.querySelector("[data-g=usar]").onclick = () => { const v = el.querySelector("input").value.trim(); if (!v) return el.querySelector("input").focus(); gravar(v); ok(v); };
      el.querySelector("[data-g=sem]").onclick = () => { gravar("sem"); ok("sem"); };
    });
  }

  function criar(el, o) {
    o = o || {};
    const fila = [];
    let g = null; // objetos do Google, criados quando a API carregar
    const quando = (fn) => (g ? fn() : fila.push(fn));
    const estado = { zoom: o.zoom || 16 };

    (async function iniciar(erro) {
      let chave = ler();
      if (!chave || erro) chave = await pedirChave(el, erro);
      try { await carregar(chave === "sem" ? "" : chave); } catch (e) { carregando = null; return iniciar(e.message); }
      el.innerHTML = "";
      const c = o.centro || [-18.9612, -47.0071];
      const mapa = new google.maps.Map(el, {
        center: { lat: c[0], lng: c[1] }, zoom: estado.zoom, mapTypeId: "hybrid", tilt: 0, streetViewControl: false, fullscreenControl: false,
        mapTypeControl: false, clickableIcons: false, gestureHandling: o.rolagem === false ? "cooperative" : "greedy",
      });
      ouvintes.push((msg) => { gravar(""); if (o.onTiles) o.onTiles(false); el.insertAdjacentHTML("beforeend", '<div class="gchave-aviso">' + msg + ' <button type="button" class="btn peq">Trocar chave</button></div>');
        el.querySelector(".gchave-aviso button").onclick = () => location.reload(); });
      if (o.onClick) mapa.addListener("click", (e) => o.onClick(e.latLng.lat(), e.latLng.lng()));
      mapa.addListener("tilesloaded", () => o.onTiles && o.onTiles(true));
      g = { mapa, pino: null, forma: null, marcas: [], gpsMarca: null, gpsRaio: null, talhoes: [], info: new google.maps.InfoWindow({ disableAutoPan: true }) };
      fila.splice(0).forEach((fn) => fn());
      if (o.onPronto) o.onPronto();
    })();

    const ESTILO = { strokeColor: "#8CC63F", strokeWeight: 3, fillColor: "#8CC63F", fillOpacity: 0.18, clickable: false };
    const pos = (p) => (Array.isArray(p) ? { lat: p[0], lng: p[1] } : { lat: p.lat, lng: p.lng });
    const limites = (pts) => { const b = new google.maps.LatLngBounds(); pts.forEach((p) => b.extend(pos(p))); return b; };
    const circulo = (cor, borda, r) => ({ path: google.maps.SymbolPath.CIRCLE, scale: r, fillColor: cor, fillOpacity: 1, strokeColor: borda, strokeWeight: 3 });
    return {
      redimensionar: () => quando(() => google.maps.event.trigger(g.mapa, "resize")),
      ver: (lat, lng, z) => { if (z != null) estado.zoom = z; quando(() => { g.mapa.setCenter({ lat, lng }); if (z != null) g.mapa.setZoom(z); }); },
      zoom: () => (g ? g.mapa.getZoom() : estado.zoom),
      pino: (lat, lng) => quando(() => {
        if (g.pino) g.pino.setMap(null);
        g.pino = new google.maps.Marker({ map: g.mapa, position: { lat, lng }, icon: circulo("#8CC63F", "#253946", 6), clickable: false });
      }),
      contorno: (pts, comMarcadores, onArrastar) => quando(() => {
        if (g.forma) g.forma.setMap(null);
        const ll = pts.map(pos);
        g.forma = ll.length >= 3 ? new google.maps.Polygon(Object.assign({ map: g.mapa, paths: ll }, ESTILO))
          : ll.length === 2 ? new google.maps.Polyline({ map: g.mapa, path: ll, strokeColor: "#8CC63F", strokeWeight: 3, clickable: false }) : null;
        if (!comMarcadores) return;
        g.marcas.forEach((mk) => mk.setMap(null));
        g.marcas = ll.map((p, i) => {
          const mk = new google.maps.Marker({ map: g.mapa, position: p, draggable: true, icon: circulo("#ffffff", "#5F8A2E", 7) });
          mk.addListener("drag", (e) => onArrastar(i, e.latLng.lat(), e.latLng.lng()));
          return mk;
        });
      }),
      enquadrar: (pts, pad) => quando(() => { if (pts.length) g.mapa.fitBounds(limites(pts), Math.round(40 + 120 * (pad != null ? pad : 0.4))); }),
      camada: (v) => quando(() => g.mapa.setMapTypeId(v === "sat" ? "hybrid" : "roadmap")),
      duploClique: (sim) => quando(() => g.mapa.setOptions({ disableDoubleClickZoom: !sim })),
      gps: (p) => quando(() => {
        if (!p) { if (g.gpsMarca) { g.gpsMarca.setMap(null); g.gpsRaio.setMap(null); g.gpsMarca = g.gpsRaio = null; } return; }
        const c = { lat: p.lat, lng: p.lng };
        if (!g.gpsMarca) {
          g.gpsRaio = new google.maps.Circle({ map: g.mapa, center: c, radius: p.prec, strokeColor: "#5F8A2E", strokeWeight: 1, fillColor: "#8CC63F", fillOpacity: 0.12, clickable: false });
          g.gpsMarca = new google.maps.Marker({ map: g.mapa, position: c, icon: circulo("#253946", "#ffffff", 8), clickable: false });
        } else { g.gpsMarca.setPosition(c); g.gpsRaio.setCenter(c); g.gpsRaio.setRadius(p.prec); }
      }),
      poligonos: (lista) => quando(() => {
        g.talhoes.forEach((x) => x.setMap(null));
        g.talhoes = lista.map((t) => {
          const pg = new google.maps.Polygon({ map: g.mapa, paths: t.pts.map(pos), strokeColor: "#8CC63F", strokeWeight: 3, fillColor: "#8CC63F", fillOpacity: 0.25 });
          if (t.dica) {
            pg.addListener("mouseover", (e) => { g.info.setContent(t.dica); g.info.setPosition(e.latLng); g.info.open({ map: g.mapa }); });
            pg.addListener("mouseout", () => g.info.close());
          }
          if (t.onClick) pg.addListener("click", t.onClick);
          return pg;
        });
        const todos = [].concat(...lista.map((t) => t.pts));
        if (todos.length) g.mapa.fitBounds(limites(todos), 40);
      }),
      remover: () => { if (g) google.maps.event.clearInstanceListeners(g.mapa); el.innerHTML = ""; },
      // Área calculada pela própria API do Google (esfera de raio 6.378.137 m), para conferência.
      areaApi: (pts) => (g && google.maps.geometry && pts.length >= 3 ? google.maps.geometry.spherical.computeArea(pts.map(pos)) : null),
    };
  }
  return { nome: "Google Maps", criar, trocarChave: () => { gravar(""); location.reload(); } };
})();
