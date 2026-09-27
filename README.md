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
Gera `dist/index.html`, um arquivo único que abre direto no navegador, sem servidor.

Mapa: MapLibre GL (WebGL) com a imagem de satélite Esri World Imagery, sem chave e sem custo; mapa de ruas vetorial do OpenFreeMap.

No ar: https://freitinhas18.github.io/aera-app/ (cada push na `main` publica de novo, via `.github/workflows/pages.yml`).

As bibliotecas ficam embutidas (pasta `vendor/`), então o mapa e a exportação não dependem de CDN.

## Estrutura
- `src/index.template.html` telas · `src/app.css` marca (manual v1.0) · `src/app.js` lógica
- `src/mapa.js` o mapa (`window.AeraMapa`); o resto do app só usa essa interface, então trocar de biblioteca mexe só nesse arquivo
- `src/nuvem.js` conta e sincronização com o Supabase
- `src/export.js` .docx/.xlsx · `src/imagens.js` croqui e gráfico
- `supabase/` banco (Postgres + PostGIS) com permissões por fazenda; ver `supabase/README.md`
- `exemplos/` relatório e planilhas de exemplo

## Estado atual
- Conta de usuário (e-mail e senha) no Supabase, na aba Perfil. Logado, fazendas, talhões, análises e perfil vão para o banco; sem conta ou sem sinal, tudo fica no navegador e é enviado quando a conexão volta (`src/nuvem.js`).
- Ao entrar pela primeira vez, o que já estava salvo no aparelho é enviado para a conta.
- Faixas de produtividade por cenário e parâmetros de colheita são de protótipo, montados a partir das referências do app; validar com agrônomo.
