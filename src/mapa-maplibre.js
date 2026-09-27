/* AERA · mapa com MapLibre GL (WebGL). Satélite Esri + mapa de ruas vetorial OpenFreeMap, ambos sem chave. */
window.AeraMapa = (function () {
  "use strict";
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  const VAZIO = { type: "FeatureCollection", features: [] };
  const SATELITE = {
    version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      imagem: { type: "raster", tiles: [ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19, attribution: "Imagens © Esri, Maxar, Earthstar Geographics" },
      rotulos: { type: "raster", tiles: [ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19 },
    },
    layers: [
      { id: "fundo", type: "background", paint: { "background-color": "#eef1ea" } },
      { id: "imagem", type: "raster", source: "imagem" }, { id: "rotulos", type: "raster", source: "rotulos" },
    ],
  };
  const RUAS = "https://tiles.openfreemap.org/styles/liberty";

  // Círculo geodésico aproximado (para a precisão do GPS).
  function circulo(lat, lng, r) {
    const pts = [], kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110574;
    for (let i = 0; i <= 64; i++) { const a = i / 64 * 2 * Math.PI; pts.push([lng + r * Math.cos(a) / kx, lat + r * Math.sin(a) / ky]); }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [pts] }, properties: {} };
  }
  const anel = (ll) => ll.concat([ll[0]]);

  function criar(el, o) {
    if (!window.maplibregl) throw new Error("A biblioteca do mapa (MapLibre GL) não carregou.");
    o = o || {};
    const c = o.centro || [-18.9612, -47.0071];
    const m = new maplibregl.Map({ container: el, style: SATELITE, center: [c[1], c[0]], zoom: (o.zoom || 16) - 1, maxZoom: 19, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    if (o.rolagem === false) m.scrollZoom.disable();
    let erros = 0;
    m.on("error", () => { if (++erros >= 4 && o.onTiles) o.onTiles(false); });
    m.on("data", (e) => { if (e.dataType === "source" && e.tile && o.onTiles) { erros = 0; o.onTiles(true); } });
    if (o.onClick) m.on("click", (e) => { if (!e.originalEvent.target.closest(".maplibregl-marker")) o.onClick(e.lngLat.lat, e.lngLat.lng); });

    // Camadas próprias, recriadas a cada troca de estilo.
    const dados = { contorno: VAZIO, gps: VAZIO, talhoes: VAZIO };
    let callbacks = [], popup = null;
    function camadas() {
      if (m.getSource("contorno")) return;
      Object.keys(dados).forEach((k) => m.addSource(k, { type: "geojson", data: dados[k] }));
      m.addLayer({ id: "gps-area", type: "fill", source: "gps", paint: { "fill-color": "#8CC63F", "fill-opacity": 0.12 } });
      m.addLayer({ id: "talhoes-area", type: "fill", source: "talhoes", paint: { "fill-color": "#8CC63F", "fill-opacity": 0.25 } });
      m.addLayer({ id: "talhoes-linha", type: "line", source: "talhoes", paint: { "line-color": "#8CC63F", "line-width": 3 } });
      m.addLayer({ id: "contorno-area", type: "fill", source: "contorno", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#8CC63F", "fill-opacity": 0.18 } });
      m.addLayer({ id: "contorno-linha", type: "line", source: "contorno", paint: { "line-color": "#8CC63F", "line-width": 3 } });
    }
    const atualizar = (k, v) => { dados[k] = v; const s = m.getSource(k); if (s) s.setData(v); };
    m.on("style.load", camadas);
    m.on("click", "talhoes-area", (e) => { const f = e.features[0]; const cb = callbacks[f.properties.i]; if (cb) cb(); });
    m.on("mousemove", "talhoes-area", (e) => {
      m.getCanvas().style.cursor = "pointer";
      const f = e.features[0];
      if (!popup) popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      popup.setLngLat(e.lngLat).setHTML(f.properties.dica || "").addTo(m);
    });
    m.on("mouseleave", "talhoes-area", () => { m.getCanvas().style.cursor = ""; if (popup) popup.remove(); });

    let pino = null, marcadores = [], gpsMarca = null;
    const bolinha = (classe) => { const d = document.createElement("div"); d.className = classe; return d; };
    const limites = (pts) => {
      const b = new maplibregl.LngLatBounds();
      pts.forEach((p) => b.extend(Array.isArray(p) ? [p[1], p[0]] : [p.lng, p.lat]));
      return b;
    };
    return {
      redimensionar: () => m.resize(),
      ver: (lat, lng, z) => m.jumpTo({ center: [lng, lat], zoom: z != null ? z - 1 : m.getZoom() }),
      zoom: () => Math.round(m.getZoom()) + 1, // escala equivalente à do Leaflet/Google (blocos de 256 px)
      pino(lat, lng) {
        if (pino) pino.remove();
        pino = new maplibregl.Marker({ element: bolinha("ml-pino") }).setLngLat([lng, lat]).addTo(m);
      },
      contorno(pts, comMarcadores, onArrastar) {
        const ll = pts.map((p) => [p.lng, p.lat]);
        atualizar("contorno", ll.length >= 3 ? { type: "Feature", geometry: { type: "Polygon", coordinates: [anel(ll)] }, properties: {} }
          : ll.length === 2 ? { type: "Feature", geometry: { type: "LineString", coordinates: ll }, properties: {} } : VAZIO);
        if (!comMarcadores) return;
        marcadores.forEach((mk) => mk.remove());
        marcadores = ll.map((p, i) => {
          const mk = new maplibregl.Marker({ element: bolinha("vertice"), draggable: true }).setLngLat(p).addTo(m);
          mk.on("drag", () => { const q = mk.getLngLat(); onArrastar(i, q.lat, q.lng); });
          return mk;
        });
      },
      enquadrar(pts, pad) { if (pts.length) m.fitBounds(limites(pts), { padding: Math.round(60 + 200 * (pad != null ? pad : 0.4) / 2), duration: 0, maxZoom: 17.5 }); },
      camada(v) { m.setStyle(v === "sat" ? SATELITE : RUAS); },
      duploClique(sim) { sim ? m.doubleClickZoom.enable() : m.doubleClickZoom.disable(); },
      gps(pos) {
        if (!pos) { if (gpsMarca) { gpsMarca.remove(); gpsMarca = null; } atualizar("gps", VAZIO); return; }
        if (!gpsMarca) gpsMarca = new maplibregl.Marker({ element: bolinha("ml-gps") }).setLngLat([pos.lng, pos.lat]).addTo(m);
        else gpsMarca.setLngLat([pos.lng, pos.lat]);
        atualizar("gps", circulo(pos.lat, pos.lng, pos.prec));
      },
      poligonos(lista) {
        callbacks = lista.map((t) => t.onClick);
        atualizar("talhoes", { type: "FeatureCollection", features: lista.map((t, i) => ({
          type: "Feature", properties: { i, dica: t.dica || "" }, geometry: { type: "Polygon", coordinates: [anel(t.pts.map((p) => [p[1], p[0]]))] } })) });
        const todos = [].concat(...lista.map((t) => t.pts));
        if (todos.length) m.fitBounds(limites(todos), { padding: 40, duration: 0, maxZoom: 17 });
      },
      remover: () => m.remove(),
    };
  }
  return { nome: "MapLibre GL", criar };
})();
