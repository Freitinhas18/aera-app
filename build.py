"""Gera o app AERA em arquivo único, em três versões de mapa:
   dist/aera-leaflet.html (Leaflet + Esri, também copiado para dist/index.html),
   dist/aera-maplibre.html (MapLibre GL + Esri/OpenFreeMap) e dist/aera-google.html (Google Maps, precisa de chave).
   Cada uma também sai sem cabeçalho (dist/artifact-*.html) para a prévia publicada."""
import base64, pathlib
raiz = pathlib.Path(__file__).parent
src, vendor, dist = raiz / "src", raiz / "vendor", raiz / "dist"
ler = lambda p: p.read_text(encoding="utf-8")
logo = "data:image/png;base64," + base64.b64encode((src / "logo-aera.png").read_bytes()).decode()
script = lambda js: "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>"

VERSOES = {
    "leaflet": {"titulo": "AERA Campo", "css": ler(src / "leaflet.css"), "lib": script(ler(vendor / "leaflet.js")), "js": ler(src / "mapa-leaflet.js")},
    "maplibre": {"titulo": "AERA MapLibre", "css": ler(vendor / "maplibre-gl.css"), "lib": script(ler(vendor / "maplibre-gl.js")), "js": ler(src / "mapa-maplibre.js")},
    "google": {"titulo": "AERA Google Maps", "css": "", "lib": "", "js": ler(src / "mapa-google.js")},
}
dist.mkdir(exist_ok=True)
for nome, v in VERSOES.items():
    corpo = ler(src / "index.template.html").replace("<title>AERA Campo</title>", "<title>" + v["titulo"] + "</title>")
    for k, val in {"{{MAPA_CSS}}": v["css"], "{{APP_CSS}}": ler(src / "app.css"), "{{MAPA_LIB}}": v["lib"],
                   "{{JSZIP}}": ler(vendor / "jszip.min.js").replace("</script", "<\\/script"), "{{MAPA_JS}}": v["js"],
                   "{{SUPABASE_JS}}": (ler(vendor / "supabase.js") + "\n" + ler(src / "nuvem.js")).replace("</script", "<\\/script"),
                   "{{IMAGENS_JS}}": ler(src / "imagens.js"), "{{EXPORT_JS}}": ler(src / "export.js"),
                   "{{APP_JS}}": ler(src / "app.js"), "{{LOGO}}": logo}.items():
        corpo = corpo.replace(k, val)
    (dist / ("artifact-" + nome + ".html")).write_text(corpo, encoding="utf-8")
    cab, _, resto = corpo.partition("<header")
    completo = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                + cab + "</head>\n<body>\n<header" + resto + "\n</body>\n</html>\n")
    (dist / ("aera-" + nome + ".html")).write_text(completo, encoding="utf-8")
    if nome == "leaflet":
        (dist / "index.html").write_text(completo, encoding="utf-8")
        (dist / "artifact.html").write_text(corpo, encoding="utf-8")
    print(nome, len(completo))
