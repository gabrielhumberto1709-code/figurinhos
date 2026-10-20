# Graph Report - figurinhos  (2026-10-20)

## Corpus Check
- 72 files · ~187,857 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .woff2 14, (none) 3, .csv 3)

## Summary
- 1530 nodes · 5073 edges · 62 communities (55 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 81 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `04d83c34`
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
- vistaDo
- fc27.js
- jornal.js
- render
- pick
- calendario.js
- motor/leilao.js
- worker.js
- campinho.js
- js/app.js (script module principal)
- humanos
- esc
- aovivo.js
- carreira.js
- europa.js
- Grid
- copa.js
- sulamericanos.js
- urlRosto
- escalacao
- ref_node_fs
- coletiva.js
- extrair-treineiros.js
- clamp
- package.json
- Base
- rng
- novoJogador
- sons.js
- rivais.js
- graphify-out/graph.json
- 0001_inicial.sql
- Ícone 512
- 0003_ligas.sql
- App icon 192px (ball on striped pitch)
- P
- Código de face de 11 caracteres (medido em foto)
- 0005_chat.sql
- tabela2026.js
- 0002_limites.sql
- sw.js
- Pendência: Base por liga no servidor
- correio.js
- motor/gala.js

## God Nodes (most connected - your core abstractions)
1. `rng()` - 77 edges
2. `clamp()` - 62 edges
3. `ehHumano()` - 47 edges
4. `virarTemporada()` - 44 edges
5. `pendentes()` - 41 edges
6. `fmtDinheiro()` - 39 edges
7. `lancar()` - 37 edges
8. `correio()` - 35 edges
9. `Lg()` - 34 edges
10. `mercadoDoTecnico()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `semana()` --calls--> `avancar()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mundo.js
- `proposta()` --calls--> `precoPedido()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mercado.js
- `proposta()` --calls--> `salarioPedido()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mercado.js
- `ate()` --calls--> `avancar()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mundo.js
- `valorDe()` --calls--> `rng()`  [EXTRACTED]
  tools/vida.js → public/js/motor/util.js

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

## Communities (62 total, 7 thin omitted)

### Community 0 - "pixel.js"
Cohesion: 0.07
Nodes (31): ACC, ALIAS, BANDEIRAS, BARBAS, CABELOS, cache, cor(), CORTES (+23 more)

### Community 1 - "js/mercado.js"
Cohesion: 0.05
Nodes (84): abaBuscar(), abaHistorico(), abaListas(), abaOlheiros(), abaPre(), abaPropostas(), ABAS, abrirFiltros() (+76 more)

### Community 2 - "financas.js"
Cohesion: 0.05
Nodes (88): viradaDM(), amortizar(), balanco(), bilEst(), bilheteriaLiga(), caixaComVerba(), caixaReal(), COM_DIV (+80 more)

### Community 3 - "liga.js"
Cohesion: 0.05
Nodes (100): abrir(), abrirCaminho(), abrirJogo(), aceitarOferta(), acoes, admBan(), admDinheiro(), assumir() (+92 more)

### Community 4 - "mundo.js"
Cohesion: 0.08
Nodes (59): comecarJogo(), dataLiga2(), tabelaSerieA2026(), supDevida(), mandoDe(), bilheteria(), acessoEQueda(), amistosoSimulado() (+51 more)

### Community 5 - "app.js"
Cohesion: 0.05
Nodes (46): acoes, app, ATALHOS, bonusPatro(), botaoTema(), CARGO_TXT, COLA, demitidoHtml() (+38 more)

### Community 6 - "continental.js"
Cohesion: 0.06
Nodes (53): posicaoNoJogo(), dataCont(), agregadoCont(), ativa(), avancarCont(), caches, campanhaCont(), chavesPre() (+45 more)

### Community 7 - "motor.test.js"
Cohesion: 0.11
Nodes (21): premiado(), efeito(), responder(), alternarLista(), elencoAguenta(), LIMITE_ELENCO, multaRescisao(), observar() (+13 more)

### Community 8 - "motor/mercado.js"
Cohesion: 0.07
Nodes (51): abrirLeilao(), aceitarContraproposta(), ALVO, anosIA(), arred(), bloqueioProposta(), BR, chamarDeVolta() (+43 more)

### Community 9 - "elenco.js"
Cohesion: 0.09
Nodes (43): ABAS, acoes, bancoHtml(), bandeira(), barraCond(), boneco(), carinha(), chip() (+35 more)

### Community 10 - "partida.js"
Cohesion: 0.12
Nodes (34): editarVaga(), moverVaga(), CAL, condDe(), criarPartida(), ESTILOS, fatorMoral(), forca() (+26 more)

### Community 11 - "regionais.js"
Cohesion: 0.09
Nodes (42): clubesCont(), concluirReg(), dataSupDe(), iniciarReg(), agendar(), agregadoReg(), ativo(), avancarReg() (+34 more)

### Community 12 - "torneios.js"
Cohesion: 0.18
Nodes (21): dataRodada(), F_MATA, PREMIO_SUP, TORNEIOS, ABAS, acoes, brasileirao(), chips() (+13 more)

### Community 13 - "imprensa.js"
Cohesion: 0.10
Nodes (34): pilares(), chave(), confronto(), pl(), resumoConfronto(), sequencia(), textoConfronto(), abrirColetiva() (+26 more)

### Community 14 - "ehHumano"
Cohesion: 0.22
Nodes (27): ehHumano(), abrirLeilaoCompra(), concorrentes(), ehLivre(), emAcordo(), fatorContrato(), listasIA(), mauPagador() (+19 more)

### Community 15 - "js/leilao.js"
Cohesion: 0.18
Nodes (26): abertura(), acoes, aoMostrar(), aplicar(), B(), bater(), cena(), darLance() (+18 more)

### Community 16 - "build-dados.js"
Cohesion: 0.09
Nodes (21): add(), CORTES_CLAROS, CORTES_ESCUROS, CRAQUES, ctx, DIV, HAIR_MAP, LOOKS (+13 more)

### Community 17 - "vistaDo"
Cohesion: 0.15
Nodes (32): migrar(), enviar(), vistaDo(), nome(), aceitarRecebida(), agora(), barrarSaida(), caixaDe() (+24 more)

### Community 18 - "fc27.js"
Cohesion: 0.05
Nodes (46): Base oficial EA FC 27 (mikedpad/ea-fc-player-stats), tools/fc27-nao-casados.csv, ../referencia/fc27/players.csv, alvo, ambiguos, candidatos(), canon(), casou (+38 more)

### Community 19 - "jornal.js"
Cohesion: 0.19
Nodes (19): acoes, autor(), bola(), boneco(), capa(), cartao(), CATS, convocacao() (+11 more)

### Community 20 - "render"
Cohesion: 0.18
Nodes (17): api(), aviso(), carregarBase(), chaveLocal(), compacta(), concluirAoVivo(), descarregar(), descompacta() (+9 more)

### Community 21 - "pick"
Cohesion: 0.23
Nodes (17): alfinetadas(), aposentadorias(), banca(), cronica(), jogoMeu(), JORNAIS, matematicos(), nomeJ() (+9 more)

### Community 22 - "calendario.js"
Cohesion: 0.12
Nodes (24): janelaInfo(), alternado(), CONT_DATAS, COPA_DATAS, COPAS_REG, dataAmistoso(), dataLiga(), datasRegionais() (+16 more)

### Community 23 - "motor/leilao.js"
Cohesion: 0.18
Nodes (25): emQualCont(), abrirLeilaoVenda(), agendar(), ativos(), comecarLeilao(), comprimir(), desistirLeilao(), DUAS (+17 more)

### Community 24 - "worker.js"
Cohesion: 0.12
Nodes (17): aleatorio(), corpo(), criarSessao(), enc, erro(), espera(), fetch(), hashPin() (+9 more)

### Community 25 - "campinho.js"
Cohesion: 0.16
Nodes (24): alvos(), alvosPen(), atualizar(), bola(), chute(), cobranca(), desenhar(), dist() (+16 more)

### Community 26 - "js/app.js (script module principal)"
Cohesion: 0.10
Nodes (19): nav#abas (navegação entre seções, oculta no início), css/app.css (folha de estilos principal), js/app.js (script module principal), div#aviso (região de status acessível), dialog#ficha (ficha do jogador), Shell HTML do app (public/index.html), css/fontes.css (fontes), manifest.webmanifest (PWA) (+11 more)

### Community 27 - "humanos"
Cohesion: 0.32
Nodes (17): tituloDeCopa(), torcidaAposJogo(), registrarConfronto(), posJogo(), humanos(), agregado2(), aposJogo(), cartoesDoTime() (+9 more)

### Community 28 - "esc"
Cohesion: 0.23
Nodes (17): abrirFicha(), album(), bandeira(), cargoHtml(), cartaMsg(), clube(), desenhaTopo(), dmFicha() (+9 more)

### Community 29 - "aovivo.js"
Cohesion: 0.11
Nodes (36): acoes, APLICA, claro(), comecar(), cores(), dist(), encerrar(), escalacoesHtml() (+28 more)

### Community 30 - "carreira.js"
Cohesion: 0.22
Nodes (14): aposRodada(), cargo(), demissoesIA(), demitir(), DIVS, nomeTecnico(), ofertasPraQuemSai(), pedirDemissao() (+6 more)

### Community 31 - "europa.js"
Cohesion: 0.11
Nodes (16): LIGA_PAIS, tierDe(), acha(), corrigidas, d, DADOS, desceu, donos (+8 more)

### Community 32 - "Grid"
Cohesion: 0.26
Nodes (17): boneco(), button(), crest(), crestMask(), flag(), Grid, hex2rgb(), leiloeiro() (+9 more)

### Community 33 - "copa.js"
Cohesion: 0.16
Nodes (20): dataCopa(), fimDoAno(), agregadoIda(), avancarFase(), campanha(), copaAtiva(), copaDevida(), dataCopa() (+12 more)

### Community 34 - "sulamericanos.js"
Cohesion: 0.14
Nodes (11): Clubes de fora (não jogáveis), catExt(), P, APELIDO, conta, d, DADOS, daLiga (+3 more)

### Community 35 - "urlRosto"
Cohesion: 0.22
Nodes (12): acoes, lista(), premio(), rosto(), selecao(), tela(), fimDeTemporada(), kitDe() (+4 more)

### Community 36 - "escalacao"
Cohesion: 0.26
Nodes (14): aoMudar(), aplicarLimite(), capitaoDe(), definirCapitao(), escalacao(), escalacaoLivre(), escalar(), estrangeiro() (+6 more)

### Community 37 - "ref_node_fs"
Cohesion: 0.13
Nodes (9): CAPA, d, jogadores, d, DADOS, novos, CERTO, d (+1 more)

### Community 38 - "coletiva.js"
Cohesion: 0.22
Nodes (11): acoes, cena(), claro(), MARCAS, pendente(), setas(), tela(), chaveDe() (+3 more)

### Community 39 - "extrair-treineiros.js"
Cohesion: 0.15
Nodes (11): npm run dados, public/data/album.json, public/data/brasil.json, ../referencia/treineiros-1.38.10 (pasta de referência), Base do Treineiros 1.38.10, dados, [html, saida], looks (+3 more)

### Community 40 - "clamp"
Cohesion: 0.12
Nodes (39): conversaHtml(), prelecaoHtml(), afastar(), EVENTOS, eventosAposRodada(), mexe(), valorElenco(), passaDoTeto() (+31 more)

### Community 41 - "package.json"
Cohesion: 0.18
Nodes (10): devDependencies, wrangler, name, private, scripts, dados, pages, test (+2 more)

### Community 42 - "Base"
Cohesion: 0.24
Nodes (5): carregarAlbum(), Base, clubeParaReputacao(), estica(), jogador()

### Community 43 - "rng"
Cohesion: 0.13
Nodes (15): arbitroDo(), NOMES, quadro(), SOBRENOMES, evolucao(), longevo(), taticaIA(), rng() (+7 more)

### Community 44 - "novoJogador"
Cohesion: 0.36
Nodes (9): atributos(), clamp(), kitGerado(), novoJogador(), peleDe(), pick(), potencial(), rng() (+1 more)

### Community 45 - "sons.js"
Cohesion: 0.39
Nodes (7): ac(), alternarSom(), apito(), ligado, pancada(), SOM, torcida()

### Community 46 - "rivais.js"
Cohesion: 0.67
Nodes (3): mapa(), PARES, rivaisDe()

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

### Community 53 - "Código de face de 11 caracteres (medido em foto)"
Cohesion: 0.50
Nodes (4): Campos do código de face (pele, cabelo, corte, barba, rosto, sobrancelha, nariz, boca, íris, acessório, luzes), Código de face de 11 caracteres (medido em foto), Índice na lista da Série A de brasil.json, Jogadores achados pela busca (saíram do clube ou sem foto no elenco)

### Community 60 - "correio.js"
Cohesion: 0.17
Nodes (20): desfalques(), cartasDeInicio(), correio(), lista(), naoLidas(), opiniao(), opiniaoGigante(), REMETENTES (+12 more)

### Community 61 - "motor/gala.js"
Cohesion: 0.28
Nodes (8): arquivarGala(), cache, fmtN(), gala(), media(), moralDosPremiados(), PREMIOS, SETOR

## Ambiguous Edges - Review These
- `Possible collectible sticker/coin token (identity unclear)` → `Orange pixel-art ball/token with dark outline`  [AMBIGUOUS]
  public/img/icone-512.png · relation: conceptually_related_to

## Knowledge Gaps
- **25 isolated node(s):** `wrangler`, `tools/fc27-nao-casados.csv`, `Base oficial EA FC 27 (mikedpad/ea-fc-player-stats)`, `nav#abas (navegação entre seções, oculta no início)`, `div#aviso (região de status acessível)` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 406 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `clamp()` connect `clamp` to `js/mercado.js`, `financas.js`, `mundo.js`, `continental.js`, `motor.test.js`, `motor/mercado.js`, `elenco.js`, `partida.js`, `rng`, `imprensa.js`, `ehHumano`, `vistaDo`, `motor/leilao.js`, `campinho.js`, `humanos`, `aovivo.js`, `carreira.js`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `wrangler`, `tools/fc27-nao-casados.csv`, `Base oficial EA FC 27 (mikedpad/ea-fc-player-stats)` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pixel.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07226890756302522 - nodes in this community are weakly interconnected._
- **Why does `ehLivre()` connect `ehHumano` to `motor/mercado.js`, `vistaDo`, `clamp`, `build-dados.js`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `js/mercado.js` be split into smaller, more focused modules?**
  _Cohesion score 0.050724637681159424 - nodes in this community are weakly interconnected._
- **Why does `rng()` connect `rng` to `js/mercado.js`, `financas.js`, `liga.js`, `mundo.js`, `continental.js`, `motor.test.js`, `motor/mercado.js`, `elenco.js`, `partida.js`, `regionais.js`, `imprensa.js`, `ehHumano`, `vistaDo`, `pick`, `calendario.js`, `motor/leilao.js`, `humanos`, `esc`, `carreira.js`, `copa.js`, `coletiva.js`, `clamp`, `Base`, `correio.js`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Possible collectible sticker/coin token (identity unclear)` and `Orange pixel-art ball/token with dark outline`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._