/* AERA · exportação: relatório técnico .docx e planilhas .xlsx montados no navegador (JSZip). */
window.AeraExport = (function () {
  "use strict";

  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const GRAFITE = "253946", CINZA = "6B7D88", CAMPO = "5F8A2E", BROTO = "8CC63F", PAPEL = "F7F9F4", LINHA = "D5DDCF", DESTAQUE = "EEF5E4";
  const EMU = 9525; // EMU por pixel (96 dpi)
  const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const REL_IMG = NS_R + "/image";
  const b64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

  function zipar(arquivos, mime) {
    if (!window.JSZip) return Promise.reject(new Error("A biblioteca de compactação não carregou. Verifique a conexão."));
    const z = new JSZip();
    Object.keys(arquivos).forEach((k) => z.file(k, arquivos[k], { createFolders: false }));
    return z.generateAsync({ type: "blob", mimeType: mime, compression: "DEFLATE" });
  }
  const rels = (lista) => XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    lista.map((r) => '<Relationship Id="' + r[0] + '" Type="' + r[1] + '" Target="' + r[2] + '"/>').join("") + "</Relationships>";

  // ================================================================== DOCX
  function run(texto, o) {
    o = o || {};
    const rpr = (o.fonteT ? '<w:rFonts w:ascii="Poppins" w:hAnsi="Poppins" w:cs="Arial"/>' : "") + (o.b ? "<w:b/>" : "") + (o.caps ? "<w:caps/>" : "") +
      (o.cor ? '<w:color w:val="' + o.cor + '"/>' : "") + (o.esp ? '<w:spacing w:val="' + o.esp + '"/>' : "") + (o.tam ? '<w:sz w:val="' + o.tam + '"/><w:szCs w:val="' + o.tam + '"/>' : "");
    return "<w:r>" + (rpr ? "<w:rPr>" + rpr + "</w:rPr>" : "") + '<w:t xml:space="preserve">' + esc(texto) + "</w:t></w:r>";
  }
  // Ordem do esquema em pPr: pStyle, keepNext, pageBreakBefore, pBdr, shd, spacing, ind, jc
  function par(conteudo, o) {
    o = o || {};
    const ppr = (o.estilo ? '<w:pStyle w:val="' + o.estilo + '"/>' : "") + (o.juntar ? "<w:keepNext/>" : "") + (o.quebra ? "<w:pageBreakBefore/>" : "") +
      (o.borda ? '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="' + o.borda + '"/></w:pBdr>' : "") +
      (o.fundo ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fundo + '"/>' : "") +
      (o.antes != null || o.depois != null ? '<w:spacing' + (o.antes != null ? ' w:before="' + o.antes + '"' : "") + (o.depois != null ? ' w:after="' + o.depois + '"' : "") + "/>" : "") +
      (o.alinhar ? '<w:jc w:val="' + o.alinhar + '"/>' : "");
    const corpo = Array.isArray(conteudo) ? conteudo.join("") : String(conteudo).startsWith("<w:") ? conteudo : run(conteudo, o);
    return "<w:p>" + (ppr ? "<w:pPr>" + ppr + "</w:pPr>" : "") + corpo + "</w:p>";
  }
  let idDesenho = 1;
  function imagem(rid, wpx, hpx, larguraCm) {
    const cx = Math.round(larguraCm * 360000), cy = Math.round(cx * hpx / wpx), id = idDesenho++;
    return "<w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">" +
      '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="Imagem ' + id + '"/>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="img' + id + '.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>";
  }
  const semBordas = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
  function celula(largura, conteudo, o) {
    o = o || {};
    return '<w:tc><w:tcPr><w:tcW w:w="' + largura + '" w:type="dxa"/>' + (o.span ? '<w:gridSpan w:val="' + o.span + '"/>' : "") +
      (o.bordaEsq ? '<w:tcBorders><w:left w:val="single" w:sz="24" w:color="' + o.bordaEsq + '"/></w:tcBorders>' : "") +
      (o.fundo ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fundo + '"/>' : "") + (o.vcentro ? '<w:vAlign w:val="center"/>' : "") + "</w:tcPr>" +
      (Array.isArray(conteudo) ? conteudo.join("") : conteudo) + "</w:tc>";
  }
  function tabelaXml(linhasXml, larguras, bordas, margem) {
    return '<w:tbl><w:tblPr><w:tblW w:w="' + larguras.reduce((a, b) => a + b, 0) + '" w:type="dxa"/>' + bordas + '<w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="' + (margem || 70) + '" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="' + (margem || 70) + '" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      "<w:tblGrid>" + larguras.map((l) => '<w:gridCol w:w="' + l + '"/>').join("") + "</w:tblGrid>" + linhasXml + "</w:tbl>";
  }
  // Tabela de dados: cabeçalho grafite, linhas alternadas, destaque opcional
  function tabela(linhas, larguras, o) {
    o = o || {};
    const bordas = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="' + LINHA + '"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="8" w:color="' + GRAFITE + '"/>' +
      '<w:right w:val="nil"/><w:insideH w:val="single" w:sz="4" w:color="' + LINHA + '"/><w:insideV w:val="nil"/></w:tblBorders>';
    const trs = linhas.map((cels, i) => {
      const cab = o.cabecalho && i === 0, dest = !cab && o.destacar && o.destacar(i);
      const fundo = cab ? GRAFITE : dest ? DESTAQUE : o.chave ? null : i % 2 === 0 ? PAPEL : null;
      return "<w:tr>" + (cab ? "<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>") + cels.map((c, j) => {
        const chave = o.chave && j === 0;
        const alinhar = o.numericas && o.numericas.includes(j) ? "right" : null;
        return celula(larguras[j], par(run(c, { b: cab || chave || dest, cor: cab ? "FFFFFF" : chave ? CINZA : null, tam: cab ? 16 : 18, caps: cab }), { alinhar, depois: 0 }),
          { fundo: chave ? PAPEL : fundo, bordaEsq: dest && j === 0 ? BROTO : null, vcentro: true });
      }).join("") + "</w:tr>";
    }).join("");
    return tabelaXml(trs, larguras, bordas) + par("", { depois: 160 });
  }
  // Cartões de indicadores: rótulo pequeno + valor grande
  function indicadores(itens, larguraTotal) {
    const w = Math.floor(larguraTotal / itens.length);
    const bordas = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/>' +
      '<w:insideV w:val="single" w:sz="18" w:color="FFFFFF"/></w:tblBorders>';
    const tr = "<w:tr>" + itens.map((it) => celula(w, [
      par(run(it[0], { b: true, caps: true, cor: CINZA, tam: 14, esp: 10 }), { depois: 40 }),
      par(run(it[1], { b: true, cor: it[3] || GRAFITE, tam: 30, fonteT: true }), { depois: 20 }),
      par(run(it[2] || " ", { cor: CINZA, tam: 15 }), { depois: 0 }),
    ], { fundo: PAPEL, bordaEsq: it[3] ? BROTO : null })).join("") + "</w:tr>";
    return tabelaXml(tr, itens.map(() => w), bordas, 140) + par("", { depois: 160 });
  }
  const secao = (n, t, quebra) => par([run(n + "  ", { cor: BROTO, b: true, fonteT: true, tam: 26 }), run(t, { b: true, fonteT: true, tam: 26 })], { estilo: "Heading1", quebra });
  const nota = (t) => par(run(t, { cor: CINZA, tam: 16 }), { depois: 120 });

  function docx(d) {
    idDesenho = 1;
    const LARG = 9638; // largura útil A4 com margens de 2 cm (twips)
    const logo = d.logoBase64;
    const c = [];

    // ---- Capa
    if (logo) c.push(par(imagem("rIdLogo", 560, 126, 6.2), { depois: 360 }));
    c.push(par(run("RELATÓRIO TÉCNICO", { b: true, cor: CAMPO, tam: 18, esp: 40 }), { depois: 60 }));
    c.push(par(run("Análise de talhão de café", { b: true, fonteT: true, tam: 48 }), { depois: 60 }));
    c.push(par(run(d.subtitulo, { cor: CINZA, tam: 24 }), { depois: 240, borda: BROTO }));
    c.push(tabela(d.ficha, [2600, LARG - 2600], { chave: true }));
    if (d.croqui) {
      c.push(par(imagem("rIdCroqui", d.croqui.w, d.croqui.h, 17), { alinhar: "center", depois: 60 }));
      c.push(nota("Figura 1. Delimitação do talhão com vértices numerados e medida de cada lado" + (d.croqui.satelite ? ", sobre imagem de satélite." : ".")));
    }
    c.push(indicadores(d.kpis, LARG));

    // ---- Corpo
    c.push(secao("01", "Resumo executivo", true));
    c.push(par(d.resumo, { depois: 200 }));

    c.push(secao("02", "Identificação e delimitação"));
    c.push(tabela(d.identificacao, [3200, LARG - 3200], { chave: true }));
    c.push(par(run("Vértices e lados", { b: true, tam: 20 }), { juntar: true, depois: 80 }));
    c.push(tabela([["Vértice", "Latitude", "Longitude", "Lado até o próximo (m)"]].concat(d.vertices.map((v, i) => [String(i + 1), v[0].toFixed(6), v[1].toFixed(6), v[2]])),
      [1400, 2700, 2700, LARG - 6800], { cabecalho: true, numericas: [1, 2, 3] }));
    c.push(nota("Coordenadas geográficas em graus decimais, datum WGS 84. Área e perímetro calculados de forma geodésica."));

    c.push(secao("03", "Aptidão climática"));
    c.push(par([run(d.apt.rotulo + ". ", { b: true, cor: CAMPO }), run(d.apt.texto)], { depois: 200 }));

    c.push(secao("04", "Cenários de plantio"));
    c.push(par(run("Lavoura adulta, média do ciclo bienal, em sacas de 60 kg de café beneficiado.", { cor: CINZA, tam: 18 })));
    if (d.grafico) {
      c.push(par(imagem("rIdGrafico", d.grafico.w, d.grafico.h, 17), { alinhar: "center", depois: 60 }));
      c.push(nota("Figura 2. Produtividade esperada (ponto), faixa de referência (barra clara) e produção estimada do talhão por cenário."));
    }
    const linhas = [["Cenário", "Espaçamento", "Plantas/ha", "sc/ha", "Faixa", "Sacas", "Mudas", "1ª colheita"]].concat(d.cenarios.map((s) => [
      s.nome + (s.melhor ? " ★" : s.bloq ? " *" : ""), s.espacamento, s.plantasTxt, s.medTxt, s.faixaCurta, s.totalTxt, s.mudasTxt, s.colheita]));
    c.push(tabela(linhas, [2050, 1250, 1000, 700, 950, 950, 1000, LARG - 7900], { cabecalho: true, numericas: [2, 3, 5, 6], destacar: (i) => i > 0 && d.cenarios[i - 1].melhor }));
    c.push(nota("★ Maior produção entre os cenários viáveis.   * Requer irrigação, indisponível para este talhão."));
    d.cenarios.forEach((s) => c.push(par([run(s.nome + ". ", { b: true }), run(s.obs + " Fontes: " + s.refs.map((r) => "[" + r + "]").join(" ") + ".")], { depois: 80 })));

    let n = 5;
    const num = () => String(n++).padStart(2, "0");
    if (d.colheita) {
      const k = d.colheita;
      c.push(secao(num(), "Máquinas, implementos e colheita"));
      c.push(tabela([["Máquinas e implementos", k.implementos], ["Declividade média", k.declive + "%"], ["Pessoas na colheita", String(k.equipe)]], [3200, LARG - 3200], { chave: true }));
      c.push(tabela([["Cenário", "Colheita indicada", "Tempo por ha", "Dias no talhão", "Custo vs. manual"]].concat(k.tabela.map((s) => [
        s.nome + (s.melhor ? " ★" : ""), s.sistema + (s.restricao ? ". " + s.restricao : ""), s.horasTxt, s.diasTxt, s.custo])),
      [2000, 3100, 1800, 1300, LARG - 8200], { cabecalho: true, numericas: [2, 3, 4], destacar: (i) => i > 0 && k.tabela[i - 1].melhor }));
      k.notas.forEach((t) => c.push(par(run("• " + t), { depois: 80 })));
      c.push(nota("Tempos de colheita: médias de estudos de campo [7][8][9], escalonadas pela produtividade do cenário; dias de 8 horas. Custos relativos à colheita manual [7][8][10]."));
    }

    c.push(secao(num(), "Recomendação"));
    c.push(par(d.recomendacao, { depois: 200 }));

    c.push(secao(num(), "Referências"));
    d.refs.forEach((r, i) => c.push(par(run("[" + (i + 1) + "] " + r, { tam: 17 }), { depois: 80 })));

    // ---- Assinatura
    c.push(par("", { depois: 600 }));
    c.push(par(run("______________________________________________", { cor: CINZA }), { alinhar: "center", depois: 40 }));
    c.push(par(run(d.assinatura[0] || "Responsável técnico", { b: true }), { alinhar: "center", depois: 20 }));
    c.push(par(run(d.assinatura[1] || "", { cor: CINZA, tam: 18 }), { alinhar: "center", depois: 360 }));
    c.push(par(run(d.aviso, { cor: CINZA, tam: 15 }), { fundo: PAPEL }));

    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="' + NS_R + '" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    const documento = XML + "<w:document " + ns + "><w:body>" + c.join("") +
      '<w:sectPr><w:headerReference w:type="default" r:id="rIdCab"/><w:footerReference w:type="default" r:id="rIdRod"/>' +
      '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="510" w:gutter="0"/><w:titlePg/></w:sectPr></w:body></w:document>';

    // Cabeçalho (páginas 2+): logo pequena + título; rodapé com paginação
    const cab = XML + "<w:hdr " + ns + ">" +
      tabelaXml("<w:tr>" + celula(4800, par(logo ? imagem("rIdLogoCab", 560, 126, 3.2) : run("AERA", { b: true }), { depois: 0 }), { vcentro: true }) +
        celula(LARG - 4800, par([run("Relatório técnico · ", { cor: CINZA, tam: 16 }), run(d.cabecalho, { b: true, tam: 16 })], { alinhar: "right", depois: 0 }), { vcentro: true }) + "</w:tr>",
        [4800, LARG - 4800], semBordas, 0) +
      par("", { borda: BROTO, depois: 0 }) + "</w:hdr>";
    const rod = XML + "<w:ftr " + ns + ">" + par([run("AERA · Agricultural Digital Engineering", { cor: CINZA, tam: 15 }), run("     Página ", { cor: CINZA, tam: 15 }),
      '<w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>', run(" de ", { cor: CINZA, tam: 15 }),
      '<w:fldSimple w:instr="NUMPAGES"><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>'], { alinhar: "right", depois: 0 }) + "</w:ftr>";

    const fonte = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';
    const estilos = XML + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' + fonte + '<w:color w:val="' + GRAFITE + '"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>' +
      "</w:styles>";
    const docRels = [["rIdEstilos", NS_R + "/styles", "styles.xml"], ["rIdCab", NS_R + "/header", "header1.xml"], ["rIdRod", NS_R + "/footer", "footer1.xml"]];
    const arquivos = {};
    if (logo) { docRels.push(["rIdLogo", REL_IMG, "media/logo.png"]); arquivos["word/media/logo.png"] = b64(logo); }
    if (d.croqui) { docRels.push(["rIdCroqui", REL_IMG, "media/croqui.png"]); arquivos["word/media/croqui.png"] = d.croqui.bytes; }
    if (d.grafico) { docRels.push(["rIdGrafico", REL_IMG, "media/grafico.png"]); arquivos["word/media/grafico.png"] = d.grafico.bytes; }
    Object.assign(arquivos, {
      "[Content_Types].xml": XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
        '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      "_rels/.rels": rels([["rId1", NS_R + "/officeDocument", "word/document.xml"], ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"]]),
      "docProps/core.xml": XML + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
        'xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + esc("Relatório técnico · " + d.cabecalho) + "</dc:title>" +
        "<dc:creator>" + esc(d.assinatura[0] || "AERA") + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().slice(0, 19) + "Z</dcterms:created></cp:coreProperties>",
      "word/_rels/document.xml.rels": rels(docRels),
      "word/_rels/header1.xml.rels": rels(logo ? [["rIdLogoCab", REL_IMG, "media/logo.png"]] : []),
      "word/document.xml": documento, "word/styles.xml": estilos, "word/header1.xml": cab, "word/footer1.xml": rod,
    });
    return zipar(arquivos, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  }

  // ================================================================== XLSX
  const colLetra = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  // Estilos (índices de cellXfs)
  const S = { titulo: 1, sub: 2, cab: 3, txt: 4, dec: 5, int: 6, coord: 7, chave: 8, dTxt: 9, dDec: 10, dInt: 11, secao: 12, nota: 13, dChave: 14 };
  const ESTILOS = XML + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.000000"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>' +
    '<fonts count="6"><font><sz val="10"/><color rgb="FF' + GRAFITE + '"/><name val="Arial"/></font>' +
    '<font><b/><sz val="18"/><color rgb="FF' + GRAFITE + '"/><name val="Arial"/></font>' +
    '<font><sz val="10"/><color rgb="FF' + CINZA + '"/><name val="Arial"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FF' + GRAFITE + '"/><name val="Arial"/></font>' +
    '<font><b/><sz val="12"/><color rgb="FF' + CAMPO + '"/><name val="Arial"/></font></fonts>' +
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF' + GRAFITE + '"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF' + DESTAQUE + '"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF' + PAPEL + '"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FF' + LINHA + '"/></bottom><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="medium"><color rgb="FF' + BROTO + '"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="15">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="165" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="3" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="5" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
    "</cellXfs>" + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  /**
   * aba: {nome, linhas: [[cel]], larguras, alturas: {linha: pt}, merges: ["A4:D4"], congelar: n linhas, filtro: "A6:H10", imagens: [{bytes,w,h,col,lin,larguraPx}]}
   * cel: string | número | {v, s}
   */
  function folha(a, relDesenho) {
    const cols = "<cols>" + a.larguras.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("") + "</cols>";
    const alt = a.alturas || {};
    const rows = a.linhas.map((cels, r) => '<row r="' + (r + 1) + '"' + (alt[r + 1] ? ' ht="' + alt[r + 1] + '" customHeight="1"' : "") + ">" + (cels || []).map((c, j) => {
      if (c == null || c === "") return "";
      const o = typeof c === "object" ? c : { v: c, s: typeof c === "number" ? S.dec : S.txt };
      const ref = colLetra(j) + (r + 1), s = o.s ? ' s="' + o.s + '"' : "";
      if (o.v == null || o.v === "") return '<c r="' + ref + '"' + s + "/>";
      return typeof o.v === "number" && isFinite(o.v)
        ? '<c r="' + ref + '"' + s + "><v>" + o.v + "</v></c>"
        : '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(o.v) + "</t></is></c>";
    }).join("") + "</row>").join("");
    const vista = a.congelar
      ? '<sheetView workbookViewId="0" showGridLines="0"><pane ySplit="' + a.congelar + '" topLeftCell="A' + (a.congelar + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView>'
      : '<sheetView workbookViewId="0" showGridLines="0"/>';
    return XML + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="' + NS_R + '">' +
      "<sheetViews>" + vista + "</sheetViews>" + cols + "<sheetData>" + rows + "</sheetData>" +
      (a.filtro ? '<autoFilter ref="' + a.filtro + '"/>' : "") +
      (a.merges && a.merges.length ? '<mergeCells count="' + a.merges.length + '">' + a.merges.map((m) => '<mergeCell ref="' + m + '"/>').join("") + "</mergeCells>" : "") +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="' + (a.paisagem ? "landscape" : "portrait") + '" fitToWidth="1" fitToHeight="0"/>' +
      (relDesenho ? '<drawing r:id="' + relDesenho + '"/>' : "") + "</worksheet>";
  }
  function desenho(imagens, baseMidia) {
    return XML + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' + NS_R + '">' +
      imagens.map((im, k) => {
        const larg = im.larguraPx || im.w, alt = Math.round(larg * im.h / im.w);
        return '<xdr:oneCellAnchor><xdr:from><xdr:col>' + im.col + "</xdr:col><xdr:colOff>" + (im.colOff || 0) * EMU + "</xdr:colOff><xdr:row>" + im.lin + "</xdr:row><xdr:rowOff>" + (im.linOff || 0) * EMU + "</xdr:rowOff></xdr:from>" +
          '<xdr:ext cx="' + larg * EMU + '" cy="' + alt * EMU + '"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (k + 2) + '" name="Imagem ' + (k + 1) + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
          '<xdr:blipFill><a:blip r:embed="rIdImg' + (k + 1) + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
          '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + larg * EMU + '" cy="' + alt * EMU + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';
      }).join("") + "</xdr:wsDr>";
  }
  function pacote(abas, titulo) {
    const arquivos = {}, tipos = [];
    let nMidia = 0, nDesenho = 0;
    abas.forEach((a, i) => {
      let rel = null;
      if (a.imagens && a.imagens.length) {
        nDesenho++; rel = "rIdDesenho";
        const r = [];
        a.imagens.forEach((im, k) => { nMidia++; arquivos["xl/media/image" + nMidia + ".png"] = im.bytes; r.push(["rIdImg" + (k + 1), REL_IMG, "../media/image" + nMidia + ".png"]); });
        arquivos["xl/drawings/drawing" + nDesenho + ".xml"] = desenho(a.imagens);
        arquivos["xl/drawings/_rels/drawing" + nDesenho + ".xml.rels"] = rels(r);
        arquivos["xl/worksheets/_rels/sheet" + (i + 1) + ".xml.rels"] = rels([["rIdDesenho", NS_R + "/drawing", "../drawings/drawing" + nDesenho + ".xml"]]);
        tipos.push('<Override PartName="/xl/drawings/drawing' + nDesenho + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
      }
      arquivos["xl/worksheets/sheet" + (i + 1) + ".xml"] = folha(a, rel);
    });
    const nomesDef = abas.map((a, i) => (a.filtro ? '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(a.nome) + "'!$" +
      a.filtro.replace(/([A-Z]+)(\d+):([A-Z]+)(\d+)/, "$1$$$2:$$$3$$$4") + "</definedName>" : "")).join("");
    Object.assign(arquivos, {
      "[Content_Types].xml": XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        abas.map((a, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
        tipos.join("") + "</Types>",
      "_rels/.rels": rels([["rId1", NS_R + "/officeDocument", "xl/workbook.xml"], ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"]]),
      "docProps/core.xml": XML + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
        'xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + esc(titulo) + "</dc:title><dc:creator>AERA</dc:creator>" +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().slice(0, 19) + "Z</dcterms:created></cp:coreProperties>",
      "xl/workbook.xml": XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="' + NS_R + '"><sheets>' +
        abas.map((a, i) => '<sheet name="' + esc(a.nome) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets>" +
        (nomesDef ? "<definedNames>" + nomesDef + "</definedNames>" : "") + "</workbook>",
      "xl/_rels/workbook.xml.rels": rels(abas.map((a, i) => ["rId" + (i + 1), NS_R + "/worksheet", "worksheets/sheet" + (i + 1) + ".xml"])
        .concat([["rIdEstilos", NS_R + "/styles", "styles.xml"]])),
      "xl/styles.xml": ESTILOS,
    });
    return zipar(arquivos, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  // Bloco padrão de topo: logo (linhas 1-3), título e subtítulo
  function topo(d, titulo, ncols) {
    const fim = colLetra(ncols - 1);
    return {
      linhas: [[], [], [], [{ v: titulo, s: S.titulo }], [{ v: d.subtitulo, s: S.sub }], []],
      merges: ["A4:" + fim + "4", "A5:" + fim + "5"],
      alturas: { 1: 18, 2: 18, 3: 18, 4: 30, 5: 18 },
      imagens: d.logoBase64 ? [{ bytes: b64(d.logoBase64), w: 560, h: 126, larguraPx: 220, col: 0, lin: 0, colOff: 2, linOff: 4 }] : [],
    };
  }
  const chaveValor = (lista) => lista.map((l) => [{ v: l[0], s: S.chave }, l[2] != null ? { v: l[1], s: l[2] } : { v: l[1], s: S.txt }]);

  function xlsx(d) {
    const t1 = topo(d, "Análise de talhão de café", 2);
    const resumo = Object.assign(t1, {
      nome: "Resumo", larguras: [34, 72],
      linhas: t1.linhas.concat([[{ v: "Identificação", s: S.secao }, { v: "", s: S.secao }]], chaveValor(d.fichaPlanilha),
        [[], [{ v: "Resultados", s: S.secao }, { v: "", s: S.secao }]], chaveValor(d.planilhaResumo),
        [[], [{ v: "Recomendação", s: S.secao }, { v: "", s: S.secao }], [{ v: d.recomendacao, s: S.nota }], [], [{ v: d.aviso, s: S.nota }]]),
    });
    const lr = resumo.linhas.length;
    resumo.merges = resumo.merges.concat(["A" + (lr - 2) + ":B" + (lr - 2), "A" + lr + ":B" + lr]);
    resumo.alturas[lr - 2] = 48; resumo.alturas[lr] = 30;

    const t2 = topo(d, "Cenários de plantio", 12);
    const cabC = ["Cenário", "Situação", "Entre linhas (m)", "Entre plantas (m)", "Plantas/ha", "Produtividade esperada (sc/ha)", "Faixa mínima (sc/ha)",
      "Faixa máxima (sc/ha)", "Produção do talhão (sacas)", "Mudas (+5% replantio)", "Primeira colheita", "Fontes"];
    const ini = t2.linhas.length + 1;
    const cen = Object.assign(t2, {
      nome: "Cenários", paisagem: true, larguras: [28, 17, 12, 12, 12, 16, 14, 14, 16, 16, 16, 10],
      linhas: t2.linhas.concat([cabC.map((h) => ({ v: h, s: S.cab }))], d.cenarios.map((s) => {
        const m = s.melhor;
        return [{ v: s.nome, s: m ? S.dChave : S.chave }, { v: m ? "Maior produção" : s.bloq ? "Requer irrigação" : "Viável", s: m ? S.dTxt : S.txt },
          { v: s.e[0], s: m ? S.dDec : S.dec }, { v: s.e[1], s: m ? S.dDec : S.dec }, { v: s.pl, s: m ? S.dInt : S.int }, { v: +s.med.toFixed(1), s: m ? S.dDec : S.dec },
          { v: +s.lo.toFixed(1), s: m ? S.dDec : S.dec }, { v: +s.hi.toFixed(1), s: m ? S.dDec : S.dec }, { v: Math.round(s.total), s: m ? S.dInt : S.int },
          { v: s.mudas, s: m ? S.dInt : S.int }, { v: s.colheita, s: m ? S.dTxt : S.txt }, { v: s.refs.map((r) => "[" + r + "]").join(" "), s: m ? S.dTxt : S.txt }];
      }), [[], [{ v: "Lavoura adulta, média do ciclo bienal, sacas de 60 kg beneficiadas. Faixas de protótipo a validar.", s: S.nota }]]),
      congelar: ini, filtro: "A" + ini + ":L" + (ini + d.cenarios.length),
    });
    cen.alturas[ini] = 32;
    cen.merges = cen.merges.concat(["A" + cen.linhas.length + ":L" + cen.linhas.length]);

    const abaColheita = d.colheita ? (() => {
      const k = d.colheita, t6 = topo(d, "Máquinas, implementos e colheita", 6), L0 = t6.linhas.length;
      const aba = Object.assign(t6, {
        nome: "Colheita", paisagem: true, larguras: [30, 34, 16, 18, 16, 18],
        linhas: t6.linhas.concat(chaveValor([["Máquinas e implementos", k.implementos], ["Declividade média (%)", k.declive, S.int], ["Pessoas na colheita", k.equipe, S.int]]), [[]],
          [["Cenário", "Colheita indicada", "Tempo por ha", "Unidade", "Dias no talhão", "Custo vs. manual"].map((h) => ({ v: h, s: S.cab }))],
          k.tabela.map((s) => { const m = s.melhor;
            return [{ v: s.nome, s: m ? S.dChave : S.chave }, { v: s.sistema + (s.restricao ? ". " + s.restricao : ""), s: m ? S.dTxt : S.txt }, { v: +s.horasHa.toFixed(1), s: m ? S.dDec : S.dec },
              { v: s.unid, s: m ? S.dTxt : S.txt }, { v: s.dias, s: m ? S.dInt : S.int }, { v: s.custo, s: m ? S.dTxt : S.txt }]; }),
          [[]], k.notas.map((t) => [{ v: t, s: S.nota }])),
      });
      for (let r = L0 + 1; r <= L0 + 3; r++) aba.merges.push("B" + r + ":F" + r);
      const cab = L0 + 5; aba.alturas[cab] = 30;
      for (let r = aba.linhas.length - k.notas.length + 1; r <= aba.linhas.length; r++) { aba.merges.push("A" + r + ":F" + r); aba.alturas[r] = 46; }
      return aba;
    })() : null;

    const t3 = topo(d, "Croqui e gráfico", 8);
    const img = Object.assign(t3, { nome: "Croqui", larguras: [12, 12, 12, 12, 12, 12, 12, 12], paisagem: true });
    if (d.croqui) img.imagens.push({ bytes: d.croqui.bytes, w: d.croqui.w, h: d.croqui.h, larguraPx: 760, col: 0, lin: 6 });
    if (d.grafico) img.imagens.push({ bytes: d.grafico.bytes, w: d.grafico.w, h: d.grafico.h, larguraPx: 760, col: 0, lin: 34 });

    const t4 = topo(d, "Vértices do talhão", 4);
    const vIni = t4.linhas.length + 1;
    const vert = Object.assign(t4, {
      nome: "Vértices", larguras: [12, 16, 16, 22], congelar: vIni,
      linhas: t4.linhas.concat([["Vértice", "Latitude", "Longitude", "Lado até o próximo (m)"].map((h) => ({ v: h, s: S.cab }))],
        d.vertices.map((v, i) => [{ v: i + 1, s: S.int }, { v: +v[0].toFixed(6), s: S.coord }, { v: +v[1].toFixed(6), s: S.coord }, { v: v[3], s: S.int }])),
    });

    const t5 = topo(d, "Referências", 2);
    const refs = Object.assign(t5, {
      nome: "Referências", larguras: [6, 120],
      linhas: t5.linhas.concat([[{ v: "Nº", s: S.cab }, { v: "Referência", s: S.cab }]], d.refs.map((r, i) => [{ v: i + 1, s: S.int }, { v: r, s: S.txt }])),
    });
    return pacote([resumo, cen].concat(abaColheita ? [abaColheita] : [], [img, vert, refs]), "Análise de talhão · " + d.cabecalho);
  }

  // Planilha de uma fazenda: cadastro, totais, talhões e mapa.
  function fazendaXlsx(d) {
    const t1 = topo(d, "Análise de fazenda", 2);
    const faz = Object.assign(t1, {
      nome: "Fazenda", larguras: [34, 64],
      linhas: t1.linhas.concat([[{ v: "Cadastro", s: S.secao }, { v: "", s: S.secao }]], chaveValor(d.cadastro),
        [[], [{ v: "Totais", s: S.secao }, { v: "", s: S.secao }]], chaveValor(d.totais), [[], [{ v: d.aviso, s: S.nota }]]),
    });
    faz.merges.push("A" + faz.linhas.length + ":B" + faz.linhas.length);
    const t2 = topo(d, "Talhões da fazenda", 12);
    const ini = t2.linhas.length + 1;
    const tal = Object.assign(t2, {
      nome: "Talhões", paisagem: true, larguras: [24, 11, 11, 15, 26, 14, 16, 11, 13, 13, 13, 12],
      linhas: t2.linhas.concat([["Talhão", "Espécie", "Área (ha)", "Aptidão climática", "Cenário de maior produção", "Produtividade (sc/ha)", "Produção estimada (sacas)",
        "Altitude (m)", "Temp. média (°C)", "Latitude", "Longitude", "Salvo em"].map((h) => ({ v: h, s: S.cab }))],
        d.talhoes.map((t) => [{ v: t.nome, s: S.chave }, { v: t.especie, s: S.txt }, { v: +t.area.toFixed(2), s: S.dec }, { v: t.apt, s: S.txt }, { v: t.cenario, s: S.txt },
          { v: +t.scha.toFixed(1), s: S.dec }, { v: Math.round(t.producao), s: S.int }, { v: t.alt, s: S.int }, { v: t.tmedia, s: S.dec },
          { v: +t.lat.toFixed(6), s: S.coord }, { v: +t.lng.toFixed(6), s: S.coord }, { v: t.data, s: S.txt }]),
        [[{ v: "Total", s: S.dChave }, { v: "", s: S.dTxt }, { v: +d.areaTotalTalhoes.toFixed(2), s: S.dDec }, { v: "", s: S.dTxt }, { v: "", s: S.dTxt }, { v: +d.mediaScha.toFixed(1), s: S.dDec },
          { v: Math.round(d.producaoTotal), s: S.dInt }, { v: "", s: S.dTxt }, { v: "", s: S.dTxt }, { v: "", s: S.dTxt }, { v: "", s: S.dTxt }, { v: "", s: S.dTxt }]]),
      congelar: ini, filtro: "A" + ini + ":L" + (ini + d.talhoes.length),
    });
    tal.alturas[ini] = 32;
    const abas = [faz, tal];
    if (d.mapa) {
      const t3 = topo(d, "Mapa dos talhões", 8);
      abas.push(Object.assign(t3, { nome: "Mapa", paisagem: true, larguras: [12, 12, 12, 12, 12, 12, 12, 12],
        imagens: t3.imagens.concat([{ bytes: d.mapa.bytes, w: d.mapa.w, h: d.mapa.h, larguraPx: 760, col: 0, lin: 6 }]) }));
    }
    return pacote(abas, "Análise de fazenda · " + d.cabecalho);
  }

  return { docx, xlsx, fazendaXlsx };
})();
