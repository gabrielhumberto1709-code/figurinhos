# Graph Report - figurinhos  (2026-10-13)

## Corpus Check
- 71 files · ~182,069 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: .woff2 14, (none) 3, .css 2)

## Summary
- 1485 nodes · 4969 edges · 63 communities (58 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0311fa83`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- pixel.js
- js/mercado.js
- financas.js
- liga.js
- mundo.js
- app.js
- continental.js
- motor.test.js
- motor/mercado.js
- elenco.js
- partida.js
- regionais.js
- torneios.js
- imprensa.js
- ehHumano
- js/leilao.js
- build-dados.js
- mercadoDoTecnico
- fc27.js
- jornal.js
- precoPedido
- temporada.js
- calendario.js
- motor/leilao.js
- worker.js
- campinho.js
- js/app.js (script module principal)
- lancar
- esc
- rng
- carreira.js
- europa.js
- Grid
- copa.js
- sulamericanos.js
- urlRosto
- util.js
- ref_node_fs
- S
- extrair-treineiros.js
- vestiario.js
- package.json
- Base
- vida.js
- humanos.js
- filtrar
- patrocinio.js
- graphify-out/graph.json
- 0001_inicial.sql
- Ícone 512
- 0003_ligas.sql
- App icon 192px (ball on striped pitch)
- selecao.js
- Código de face de 11 caracteres (medido em foto)
- 0005_chat.sql
- aplicarSave
- 0002_limites.sql
- sw.js
- Pendência: Base por liga no servidor
- blocoFicha
- motor/gala.js
- clamp

## God Nodes (most connected - your core abstractions)
1. `rng()` - 77 edges
2. `clamp()` - 60 edges
3. `ehHumano()` - 47 edges
4. `virarTemporada()` - 44 edges
5. `pendentes()` - 41 edges
6. `fmtDinheiro()` - 39 edges
7. `lancar()` - 37 edges
8. `correio()` - 35 edges
9. `Lg()` - 34 edges
10. `mercadoDoTecnico()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `valorDe()` --calls--> `rng()`  [EXTRACTED]
  tools/vida.js → public/js/motor/util.js
- `proposta()` --calls--> `precoPedido()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mercado.js
- `ate()` --calls--> `avancar()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mundo.js
- `semana()` --calls--> `avancar()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mundo.js
- `js/app.js (script module principal)` --references--> `public/js/motor/ (ES modules puros)`  [INFERRED]
  public/index.html → README.md

## Import Cycles
- 3-file cycle: `public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/vestiario.js -> public/js/motor/financas.js`
- 3-file cycle: `public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/vestiario.js -> public/js/motor/financas.js`
- 3-file cycle: `public/js/motor/jornais.js -> public/js/motor/mundo.js -> public/js/motor/noticias.js -> public/js/motor/jornais.js`
- 3-file cycle: `public/js/motor/carreira.js -> public/js/motor/correio.js -> public/js/motor/temporada.js -> public/js/motor/carreira.js`
- 3-file cycle: `public/js/motor/carreira.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/carreira.js`
- 3-file cycle: `public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/financas.js`
- 3-file cycle: `public/js/motor/gala.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/gala.js`
- 3-file cycle: `public/js/motor/mercado.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/mercado.js`
- 3-file cycle: `public/js/motor/eventos.js -> public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/eventos.js`
- 4-file cycle: `public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/mundo.js -> public/js/motor/vestiario.js -> public/js/motor/financas.js`
- 4-file cycle: `public/js/motor/eventos.js -> public/js/motor/vestiario.js -> public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/eventos.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/correio.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/financas.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/correio.js -> public/js/motor/temporada.js -> public/js/motor/gala.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/gala.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/gala.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/mercado.js -> public/js/motor/gala.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/correio.js -> public/js/motor/mercado.js -> public/js/motor/gala.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/eventos.js -> public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/mundo.js -> public/js/motor/eventos.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/gala.js -> public/js/motor/carreira.js`

## Hyperedges (group relationships)
- **Pipeline de geral e atributos EA FC 27** — readme_ea_fc27_base, readme_fc27_players_csv, tools_fc27, readme_fc27_nao_casados_csv, readme_fc27_potencial [EXTRACTED 1.00]
- **Pipeline de faces da Série A (código, campos, índice e dados)** — tools_faces_serie_a_codigo_face, tools_faces_serie_a_campos_11_posicoes, tools_faces_serie_a_indice_serie_a [INFERRED 0.65]
- **Fluxo do modo online (motor, DO, API e limites)** — readme_durable_object, readme_motor, readme_api_saves, readme_limites_table, readme_modo_online_decision [INFERRED 0.75]
- **Pipeline de dados do Treineiros** — readme_treineiros_base, readme_referencia_treineiros, tools_extrair_treineiros, readme_npm_run_dados, readme_public_data_brasil_json, readme_public_data_album_json [INFERRED 0.85]

## Communities (63 total, 5 thin omitted)

### Community 0 - "pixel.js"
Cohesion: 0.07
Nodes (31): ACC, ALIAS, BANDEIRAS, BARBAS, CABELOS, cache, cor(), CORTES (+23 more)

### Community 1 - "js/mercado.js"
Cohesion: 0.11
Nodes (17): ABAS, acoes, ddmm(), faixaJanela(), FAIXAS, filtroPadrao(), filtrosAtivos(), filtroSetor() (+9 more)

### Community 2 - "financas.js"
Cohesion: 0.06
Nodes (54): dividaTag(), reais(), clubesCont(), amortizar(), balanco(), bilEst(), caixaReal(), COM_DIV (+46 more)

### Community 3 - "liga.js"
Cohesion: 0.06
Nodes (89): abrir(), abrirCaminho(), abrirJogo(), aceitarOferta(), acoes, admBan(), admDinheiro(), assumir() (+81 more)

### Community 4 - "mundo.js"
Cohesion: 0.07
Nodes (58): comecarJogo(), arbitroDo(), pontosCorridos(), deFora(), fragilidade(), bonusFase(), registrarForma(), agregado2() (+50 more)

### Community 5 - "app.js"
Cohesion: 0.06
Nodes (46): acoes, api(), app, ATALHOS, aviso(), botaoTema(), CARGO_TXT, carregarBase() (+38 more)

### Community 6 - "continental.js"
Cohesion: 0.08
Nodes (45): dataCont(), agregadoCont(), ativa(), avancarCont(), caches, chavesPre(), compDe(), CONMEBOL (+37 more)

### Community 7 - "motor.test.js"
Cohesion: 0.09
Nodes (38): diasRestantes(), garantirFinancas(), orcamento(), passaDoTeto(), registroBloqueado(), salarioDia(), premiado(), comecarLeilao() (+30 more)

### Community 8 - "motor/mercado.js"
Cohesion: 0.08
Nodes (37): abrirLeilao(), acompanharPromessas(), agora(), ALVO, anosIA(), BR, chamarDeVolta(), chegouNaJanela() (+29 more)

### Community 9 - "elenco.js"
Cohesion: 0.07
Nodes (59): desfalques(), ABAS, acoes, aoMudar(), bancoHtml(), bandeira(), barraCond(), boneco() (+51 more)

### Community 10 - "partida.js"
Cohesion: 0.05
Nodes (77): acoes, APLICA, claro(), comecar(), cores(), dist(), encerrar(), escalacoesHtml() (+69 more)

### Community 11 - "regionais.js"
Cohesion: 0.09
Nodes (40): posicaoNoJogo(), supDevida(), dataSupDe(), iniciarReg(), pendentes(), temporadaAcabou(), agendar(), agregadoReg() (+32 more)

### Community 12 - "torneios.js"
Cohesion: 0.16
Nodes (22): F_MATA, PREMIO_SUP, TORNEIOS, classificacao(), tabelaQuad(), ABAS, acoes, brasileirao() (+14 more)

### Community 13 - "imprensa.js"
Cohesion: 0.08
Nodes (41): acoes, cena(), claro(), MARCAS, pendente(), setas(), tela(), chave() (+33 more)

### Community 14 - "ehHumano"
Cohesion: 0.15
Nodes (29): ehHumano(), alfinetadas(), aposentadorias(), matematicos(), ehLivre(), emAcordo(), mauPagador(), montarElencos() (+21 more)

### Community 15 - "js/leilao.js"
Cohesion: 0.18
Nodes (26): abertura(), acoes, aoMostrar(), aplicar(), B(), bater(), cena(), darLance() (+18 more)

### Community 16 - "build-dados.js"
Cohesion: 0.09
Nodes (28): atributos(), clamp(), CORTES_CLAROS, CORTES_ESCUROS, CRAQUES, ctx, DIV, HAIR_MAP (+20 more)

### Community 17 - "mercadoDoTecnico"
Cohesion: 0.18
Nodes (24): emQualCont(), enviar(), faseDe(), mesas(), vistaDo(), nome(), aceitarRecebida(), barrarSaida() (+16 more)

### Community 18 - "fc27.js"
Cohesion: 0.08
Nodes (25): Base oficial EA FC 27 (mikedpad/ea-fc-player-stats), tools/fc27-nao-casados.csv, ../referencia/fc27/players.csv, alvo, ambiguos, candidatos(), casou, chave() (+17 more)

### Community 19 - "jornal.js"
Cohesion: 0.15
Nodes (26): acoes, autor(), bola(), boneco(), capa(), cartao(), CATS, convocacao() (+18 more)

### Community 20 - "precoPedido"
Cohesion: 0.25
Nodes (15): arred(), F_IDADE_EXT(), fatorContrato(), fazerProposta(), hoje(), limpaCl(), listasIA(), mesesDeContrato() (+7 more)

### Community 21 - "temporada.js"
Cohesion: 0.16
Nodes (22): campanhaCont(), viradaDM(), cotaTV(), folhaDia(), responder(), acessoEQueda(), caixaFora(), caixaIAInicial() (+14 more)

### Community 22 - "calendario.js"
Cohesion: 0.12
Nodes (28): janelaInfo(), CONT_DATAS, COPA_DATAS, COPAS_REG, dataAmistoso(), dataLiga(), dataLiga2(), dataRodada() (+20 more)

### Community 23 - "motor/leilao.js"
Cohesion: 0.16
Nodes (29): migrar(), opiniaoGigante(), abrirLeilaoCompra(), abrirLeilaoVenda(), agendar(), ativos(), comprimir(), concorrentes() (+21 more)

### Community 24 - "worker.js"
Cohesion: 0.12
Nodes (17): aleatorio(), corpo(), criarSessao(), enc, erro(), espera(), fetch(), hashPin() (+9 more)

### Community 25 - "campinho.js"
Cohesion: 0.19
Nodes (20): alvos(), atualizar(), bola(), chute(), desenhar(), dist(), encerrar(), etiqueta() (+12 more)

### Community 26 - "js/app.js (script module principal)"
Cohesion: 0.10
Nodes (19): nav#abas (navegação entre seções, oculta no início), css/app.css (folha de estilos principal), js/app.js (script module principal), div#aviso (região de status acessível), dialog#ficha (ficha do jogador), Shell HTML do app (public/index.html), css/fontes.css (fontes), manifest.webmanifest (PWA) (+11 more)

### Community 27 - "lancar"
Cohesion: 0.27
Nodes (26): tituloDeCopa(), torcidaAposJogo(), registrarConfronto(), correio(), posJogo(), bilheteria(), bilheteriaLiga(), lancar() (+18 more)

### Community 28 - "esc"
Cohesion: 0.20
Nodes (20): abrirFicha(), album(), bandeira(), cargoHtml(), cartaMsg(), clube(), demitidoHtml(), desenhaTopo() (+12 more)

### Community 29 - "rng"
Cohesion: 0.17
Nodes (13): NOMES, quadro(), RIGOR, SOBRENOMES, demissoesIA(), nomeTecnico(), tecnicoDe(), elencoFora() (+5 more)

### Community 30 - "carreira.js"
Cohesion: 0.18
Nodes (21): aceitarOferta(), aposRodada(), cargo(), demitir(), DIVS, garantirCarreira(), ofertasPraQuemSai(), pedirDemissao() (+13 more)

### Community 31 - "europa.js"
Cohesion: 0.11
Nodes (16): LIGA_PAIS, tierDe(), acha(), corrigidas, d, DADOS, desceu, donos (+8 more)

### Community 32 - "Grid"
Cohesion: 0.26
Nodes (17): boneco(), button(), crest(), crestMask(), flag(), Grid, hex2rgb(), leiloeiro() (+9 more)

### Community 33 - "copa.js"
Cohesion: 0.15
Nodes (22): dataCopa(), fimDoAno(), agregadoIda(), avancarFase(), campanha(), copaAtiva(), copaDevida(), dataCopa() (+14 more)

### Community 34 - "sulamericanos.js"
Cohesion: 0.12
Nodes (13): Clubes de fora (não jogáveis), add(), catExt(), numerar(), P, APELIDO, conta, d (+5 more)

### Community 35 - "urlRosto"
Cohesion: 0.20
Nodes (13): acoes, lista(), premio(), rosto(), selecao(), tela(), feito2(), fimDeTemporada() (+5 more)

### Community 36 - "util.js"
Cohesion: 0.12
Nodes (16): ATT, ATT_NOME, CARTAS, CONT, CONT_DE, CONTINENTES, decimais(), PERFIL (+8 more)

### Community 37 - "ref_node_fs"
Cohesion: 0.13
Nodes (9): CAPA, d, jogadores, d, DADOS, novos, CERTO, d (+1 more)

### Community 38 - "S"
Cohesion: 0.28
Nodes (17): abaBuscar(), abaHistorico(), abaListas(), abaOlheiros(), abaPre(), abaPropostas(), acoesRecebida(), B() (+9 more)

### Community 39 - "extrair-treineiros.js"
Cohesion: 0.15
Nodes (11): npm run dados, public/data/album.json, public/data/brasil.json, ../referencia/treineiros-1.38.10 (pasta de referência), Base do Treineiros 1.38.10, dados, [html, saida], looks (+3 more)

### Community 40 - "vestiario.js"
Cohesion: 0.21
Nodes (20): conversaHtml(), prelecaoHtml(), capitaoDe(), previa(), proximoEvento(), chaveJogo(), conversar(), CONVERSAS (+12 more)

### Community 41 - "package.json"
Cohesion: 0.18
Nodes (10): devDependencies, wrangler, name, private, scripts, dados, pages, test (+2 more)

### Community 42 - "Base"
Cohesion: 0.33
Nodes (4): carregarAlbum(), Base, estica(), jogador()

### Community 43 - "vida.js"
Cohesion: 0.20
Nodes (7): C, d, DADOS, MIN, R, sobra, valorDe()

### Community 44 - "humanos.js"
Cohesion: 0.25
Nodes (8): afastar(), EVENTOS, eventosAposRodada(), mexe(), valorElenco(), cache, MESA, sufixo()

### Community 45 - "filtrar"
Cohesion: 0.18
Nodes (17): abrirFiltros(), aoDigitar(), atualizarContagem(), enviar(), faixa(), filtrar(), filtro(), fmtPasso() (+9 more)

### Community 46 - "patrocinio.js"
Cohesion: 0.18
Nodes (14): bonusPatro(), telaPatrocinio(), cotaRestante(), patrocinio(), receitaPrevista(), assinarPatrocinio(), checarClausula(), EMPRESAS (+6 more)

### Community 47 - "graphify-out/graph.json"
Cohesion: 0.33
Nodes (5): graphify-out/graph.json, Instalação do graphify (uv / pip), graphify query / explain / path / affected, Início de toda sessão: graphify, graphify update .

### Community 48 - "0001_inicial.sql"
Cohesion: 0.40
Nodes (5): mural, saves, sessoes, sessoes_usuario, usuarios

### Community 49 - "Ícone 512"
Cohesion: 0.50
Nodes (5): Figurinhos App Icon (icone-512), Possible collectible sticker/coin token (identity unclear), Figurinhos football-manager game, Orange pixel-art ball/token with dark outline, Striped green pitch background

### Community 50 - "0003_ligas.sql"
Cohesion: 0.67
Nodes (3): ligas, mesas, mesas_usuario

### Community 51 - "App icon 192px (ball on striped pitch)"
Cohesion: 0.50
Nodes (4): App icon 192px (ball on striped pitch), Yellow-orange pixel-art football, Home-screen (PWA) icon purpose, Striped green pitch background

### Community 52 - "selecao.js"
Cohesion: 0.20
Nodes (10): LIGA, FASES, NEUTRA, BR, convocar(), dataFifa(), DATAS_FIFA, ESTRUTURA (+2 more)

### Community 53 - "Código de face de 11 caracteres (medido em foto)"
Cohesion: 0.50
Nodes (4): Campos do código de face (pele, cabelo, corte, barba, rosto, sobrancelha, nariz, boca, íris, acessório, luzes), Código de face de 11 caracteres (medido em foto), Índice na lista da Série A de brasil.json, Jogadores achados pela busca (saíram do clube ou sem foto no elenco)

### Community 55 - "aplicarSave"
Cohesion: 0.29
Nodes (12): cumprirAcordos(), efetivar(), emprestar(), exercerOpcao(), liberar(), marcarChegada(), mexerCaixa(), prometerTitular() (+4 more)

### Community 60 - "blocoFicha"
Cohesion: 0.29
Nodes (11): anosSelect(), blocoFicha(), campoDinheiro(), euro(), formEmprestimo(), potencialTxt(), txt(), barradoMedo() (+3 more)

### Community 61 - "motor/gala.js"
Cohesion: 0.28
Nodes (8): arquivarGala(), cache, fmtN(), gala(), media(), moralDosPremiados(), PREMIOS, SETOR

### Community 62 - "clamp"
Cohesion: 0.36
Nodes (7): pedirVerba(), trabalhoDoOlheiro(), notaTemporada(), PESO(), revisarPotencial(), clamp(), estrelas()

## Ambiguous Edges - Review These
- `Possible collectible sticker/coin token (identity unclear)` → `Orange pixel-art ball/token with dark outline`  [AMBIGUOUS]
  public/img/icone-512.png · relation: conceptually_related_to

## Knowledge Gaps
- **25 isolated node(s):** `wrangler`, `tools/fc27-nao-casados.csv`, `Base oficial EA FC 27 (mikedpad/ea-fc-player-stats)`, `nav#abas (navegação entre seções, oculta no início)`, `div#aviso (região de status acessível)` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 389 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ehLivre()` connect `ehHumano` to `motor.test.js`, `motor/mercado.js`, `build-dados.js`, `precoPedido`, `aplicarSave`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `wrangler`, `tools/fc27-nao-casados.csv`, `Base oficial EA FC 27 (mikedpad/ea-fc-player-stats)` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pixel.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07226890756302522 - nodes in this community are weakly interconnected._
- **Why does `clamp()` connect `clamp` to `financas.js`, `continental.js`, `motor.test.js`, `motor/mercado.js`, `elenco.js`, `partida.js`, `imprensa.js`, `ehHumano`, `mercadoDoTecnico`, `precoPedido`, `temporada.js`, `calendario.js`, `motor/leilao.js`, `campinho.js`, `lancar`, `rng`, `carreira.js`, `util.js`, `vestiario.js`, `vida.js`, `humanos.js`, `selecao.js`, `aplicarSave`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `js/mercado.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10952380952380952 - nodes in this community are weakly interconnected._
- **Why does `rng()` connect `rng` to `financas.js`, `mundo.js`, `app.js`, `continental.js`, `motor.test.js`, `motor/mercado.js`, `elenco.js`, `partida.js`, `regionais.js`, `imprensa.js`, `ehHumano`, `jornal.js`, `precoPedido`, `temporada.js`, `calendario.js`, `motor/leilao.js`, `lancar`, `carreira.js`, `copa.js`, `util.js`, `vestiario.js`, `vida.js`, `humanos.js`, `patrocinio.js`, `clamp`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Possible collectible sticker/coin token (identity unclear)` and `Orange pixel-art ball/token with dark outline`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._