/* AERA · mapa com Leaflet + imagens Esri (sem chave). Mesma interface nas três versões (window.AeraMapa). */
window.AeraMapa = (function () {
  "use strict";
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  const ESTILO = { color: "#8CC63F", weight: 3, fillColor: "#8CC63F", fillOpacity: 0.18 };

  function criar(el, o) {
    if (!window.L) throw new Error("A biblioteca do mapa (Leaflet) não carregou.");
    o = o || {};
    const m = L.map(el, { zoomControl: true, scrollWheelZoom: o.rolagem !== false }).setView(o.centro || [-18.9612, -47.0071], o.zoom || 16);
    const imagem = L.tileLayer(ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, maxNativeZoom: 19, attribution: "Imagens © Esri, Maxar, Earthstar Geographics" });
    const rotulos = L.tileLayer(ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "" });
    const ruas = L.tileLayer(ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Mapa © Esri, HERE, Garmin, OpenStreetMap" });
    const sat = L.layerGroup([imagem, rotulos]).addTo(m);
    let erros = 0;
    [imagem, ruas].forEach((l) => {
      l.on("tileerror", () => { if (++erros >= 4 && o.onTiles) o.onTiles(false); });
      l.on("tileload", () => { erros = 0; if (o.onTiles) o.onTiles(true); });
    });
    if (o.onClick) m.on("click", (e) => o.onClick(e.latlng.lat, e.latlng.lng));
    setTimeout(() => m.invalidateSize(), 50);

    let pino = null, poligono = null, marcadores = [], gpsMarca = null, gpsRaio = null, grupo = null;
    const limites = (pts) => L.latLngBounds(pts.map((p) => (Array.isArray(p) ? p : [p.lat, p.lng])));
    return {
      redimensionar: () => m.invalidateSize(),
      ver: (lat, lng, z) => m.setView([lat, lng], z != null ? z : m.getZoom()),
      zoom: () => m.getZoom(),
      pino(lat, lng) {
        if (pino) pino.remove();
        pino = L.circleMarker([lat, lng], { radius: 6, color: "#253946", weight: 2, fillColor: "#8CC63F", fillOpacity: 1 }).addTo(m);
      },
      contorno(pts, comMarcadores, onArrastar) {
        if (poligono) poligono.remove();
        const ll = pts.map((p) => [p.lat, p.lng]);
        poligono = ll.length >= 3 ? L.polygon(ll, ESTILO).addTo(m) : ll.length === 2 ? L.polyline(ll, ESTILO).addTo(m) : null;
        if (!comMarcadores) return;
        marcadores.forEach((mk) => mk.remove());
        marcadores = ll.map((p, i) => {
          const mk = L.marker(p, { draggable: true, keyboard: false, icon: L.divIcon({ className: "", html: '<div class="vertice"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(m);
          mk.on("drag", (e) => { const q = e.target.getLatLng(); onArrastar(i, q.lat, q.lng); });
          return mk;
        });
      },
      enquadrar(pts, pad) { if (pts.length) m.fitBounds(limites(pts).pad(pad != null ? pad : 0.4)); },
      camada(v) { if (v === "sat") { ruas.remove(); sat.addTo(m); } else { sat.remove(); ruas.addTo(m); } },
      duploClique(sim) { sim ? m.doubleClickZoom.enable() : m.doubleClickZoom.disable(); },
      gps(pos) {
        if (!pos) { if (gpsMarca) { gpsMarca.remove(); gpsRaio.remove(); gpsMarca = gpsRaio = null; } return; }
        const ll = [pos.lat, pos.lng];
        if (!gpsMarca) {
          gpsRaio = L.circle(ll, { radius: pos.prec, color: "#5F8A2E", weight: 1, fillColor: "#8CC63F", fillOpacity: 0.12 }).addTo(m);
          gpsMarca = L.circleMarker(ll, { radius: 8, color: "#ffffff", weight: 3, fillColor: "#253946", fillOpacity: 1 }).addTo(m);
        } else { gpsMarca.setLatLng(ll); gpsRaio.setLatLng(ll).setRadius(pos.prec); }
      },
      poligonos(lista) {
        if (grupo) grupo.remove();
        grupo = L.featureGroup().addTo(m);
        lista.forEach((t) => {
          const pg = L.polygon(t.pts, { color: "#8CC63F", weight: 3, fillColor: "#8CC63F", fillOpacity: 0.25 }).addTo(grupo);
          if (t.dica) pg.bindTooltip(t.dica, { sticky: true });
          if (t.onClick) pg.on("click", t.onClick);
        });
        if (lista.length) m.fitBounds(grupo.getBounds().pad(0.25), { animate: false });
      },
      remover: () => m.remove(),
    };
  }
  return { nome: "Leaflet + Esri", criar };
})();
