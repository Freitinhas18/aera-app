# AERA Campo

App web para agrônomos e consultores de café (AERA · Agricultural Digital Engineering).

- **Início:** saudação, clima atual e previsão de 7 dias (Open-Meteo), janelas de manejo.
- **Talhão:** formulário em 3 blocos (talhão, localização e contorno, lavoura). Delimitação no mapa, por GPS ou colando coordenadas; área e perímetro no elipsoide WGS 84; município/UF, altitude, temperatura e declividade preenchidos pela coordenada; aptidão climática; 4 cenários de plantio; colheita conforme as máquinas da fazenda.
- **Fazendas:** cadastro, talhões por fazenda com mapa e planilha da fazenda.
- **Notícias:** clima e cafeicultura (teste).
- **Exportação:** relatório .docx e planilha .xlsx gerados no navegador, nomeados `AERA_<Tipo>_<fazenda>_<talhão>_<proprietário>_<AAAA-MM-DD>`.

## Como rodar
```
python3 build.py
```
Gera em `dist/` um arquivo único que abre direto no navegador, sem servidor:
- `index.html` / `aera-leaflet.html`: Leaflet + imagens Esri (padrão)
- `aera-maplibre.html`: MapLibre GL + Esri / OpenFreeMap
- `aera-google.html`: Google Maps (pede a chave da Maps JavaScript API)

As bibliotecas ficam embutidas (pasta `vendor/`), então o mapa e a exportação não dependem de CDN.

## Estrutura
- `src/index.template.html` telas · `src/app.css` marca (manual v1.0) · `src/app.js` lógica
- `src/mapa-*.js` o mapa de cada versão, com a mesma interface (`window.AeraMapa`)
- `src/export.js` .docx/.xlsx · `src/imagens.js` croqui e gráfico
- `supabase/` banco (Postgres + PostGIS) com permissões por fazenda; ver `supabase/README.md`
- `exemplos/` relatório e planilhas de exemplo

## Estado atual
- Fazendas e talhões ainda ficam no navegador (localStorage, com backup .json). A ligação com o Supabase é o próximo passo.
- Faixas de produtividade por cenário e parâmetros de colheita são de protótipo, montados a partir das referências do app; validar com agrônomo.
