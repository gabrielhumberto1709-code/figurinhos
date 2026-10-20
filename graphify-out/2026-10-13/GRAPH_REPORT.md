# Graph Report - figurinhos  (2026-10-13)

## Corpus Check
- 75 files · ~181,934 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: .woff2 14, (none) 3, .css 2)

## Summary
- 1483 nodes · 4966 edges · 60 communities (54 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.83)
- Token cost: 90,646 input · 0 output

## Community Hubs (Navigation)
- Pixel Art e Leilão (tela)
- Tela do Mercado
- Finanças e Patrocínio
- Liga Online (sync)
- Rodadas do Mundo
- App Shell e Saves
- Copas Continentais
- Testes, Forma e Vestiário
- Regras de Mercado
- Elenco e Escalação
- Motor da Partida
- Regionais e Estaduais
- Tela de Torneios
- Imprensa e Confrontos
- Mercado por Técnico e Notícias
- Partida Ao Vivo
- Build de Dados
- Transferências
- Importação FC 27
- Jornais
- Preço e Vontade
- Virada de Temporada
- Calendário e Janelas
- Motor do Leilão
- Worker (backend)
- Campinho Animado
- Docs e Página HTML
- Conclusão de Rodadas
- Componentes de UI
- Árbitros e Demissões
- Carreira e Cargo
- Ligas Europeias
- Mundo Multi-Técnico
- Copa do Brasil
- Sul-Americanos
- Gala de Prêmios
- Departamento Médico
- Dados de Ligas e Álbum
- Coletiva de Imprensa
- Base do Treineiros
- Preleção e Vestiário
- Config do Projeto
- Base de Jogadores
- Vida e Valor
- Eventos Aleatórios
- Sons
- Correio
- Graphify (CLAUDE.md)
- Banco: Contas e Saves
- Ícone 512
- Banco: Ligas
- Ícone 192
- Rivalidades
- Código de Rosto
- Banco: Chat
- Posições em Campo
- Banco: Limites
- Service Worker
- Pendências do Online

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
- `ate()` --calls--> `avancar()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mundo.js
- `semana()` --calls--> `avancar()`  [EXTRACTED]
  test/motor.test.js → public/js/motor/mundo.js
- `js/app.js (script module principal)` --references--> `public/js/motor/ (ES modules puros)`  [INFERRED]
  public/index.html → README.md
- `iniciarCont()` --indirect_call--> `dataRodada()`  [INFERRED]
  public/js/motor/mundo.js → public/js/motor/calendario.js

## Import Cycles
- 3-file cycle: `public/js/motor/jornais.js -> public/js/motor/mundo.js -> public/js/motor/noticias.js -> public/js/motor/jornais.js`
- 3-file cycle: `public/js/motor/eventos.js -> public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/eventos.js`
- 3-file cycle: `public/js/motor/carreira.js -> public/js/motor/correio.js -> public/js/motor/temporada.js -> public/js/motor/carreira.js`
- 3-file cycle: `public/js/motor/carreira.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/carreira.js`
- 3-file cycle: `public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/financas.js`
- 3-file cycle: `public/js/motor/gala.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/gala.js`
- 3-file cycle: `public/js/motor/mercado.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/mercado.js`
- 3-file cycle: `public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/vestiario.js -> public/js/motor/financas.js`
- 3-file cycle: `public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/vestiario.js -> public/js/motor/financas.js`
- 4-file cycle: `public/js/motor/eventos.js -> public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/mundo.js -> public/js/motor/eventos.js`
- 4-file cycle: `public/js/motor/eventos.js -> public/js/motor/vestiario.js -> public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/eventos.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/correio.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/financas.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/financas.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/correio.js -> public/js/motor/temporada.js -> public/js/motor/gala.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/gala.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/gala.js -> public/js/motor/mundo.js -> public/js/motor/temporada.js -> public/js/motor/mercado.js -> public/js/motor/gala.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/gala.js -> public/js/motor/carreira.js`
- 4-file cycle: `public/js/motor/financas.js -> public/js/motor/mercado.js -> public/js/motor/mundo.js -> public/js/motor/vestiario.js -> public/js/motor/financas.js`
- 4-file cycle: `public/js/motor/carreira.js -> public/js/motor/correio.js -> public/js/motor/mercado.js -> public/js/motor/gala.js -> public/js/motor/carreira.js`

## Hyperedges (group relationships)
- **Pipeline de faces da Série A (código, campos, índice e dados)** — tools_faces_serie_a_codigo_face, tools_faces_serie_a_campos_11_posicoes, tools_faces_serie_a_indice_serie_a [INFERRED 0.65]
- **Pipeline de dados do Treineiros** — readme_treineiros_base, readme_referencia_treineiros, tools_extrair_treineiros, readme_npm_run_dados, readme_public_data_brasil_json, readme_public_data_album_json [INFERRED 0.85]
- **Pipeline de geral e atributos EA FC 27** — readme_ea_fc27_base, readme_fc27_players_csv, tools_fc27, readme_fc27_nao_casados_csv, readme_fc27_potencial [EXTRACTED 1.00]
- **Fluxo do modo online (motor, DO, API e limites)** — readme_durable_object, readme_motor, readme_api_saves, readme_limites_table, readme_modo_online_decision [INFERRED 0.75]

## Communities (60 total, 6 thin omitted)

### Community 0 - "Pixel Art e Leilão (tela)"
Cohesion: 0.05
Nodes (80): abertura(), acoes, aoMostrar(), aplicar(), B(), bater(), cena(), darLance() (+72 more)

### Community 1 - "Tela do Mercado"
Cohesion: 0.06
Nodes (80): desfalques(), abaBuscar(), abaHistorico(), abaListas(), abaOlheiros(), abaPre(), abaPropostas(), ABAS (+72 more)

### Community 2 - "Finanças e Patrocínio"
Cohesion: 0.05
Nodes (78): bonusPatro(), dividaTag(), reais(), telaPatrocinio(), amortizar(), balanco(), bilEst(), bilheteriaLiga() (+70 more)

### Community 3 - "Liga Online (sync)"
Cohesion: 0.07
Nodes (73): abrir(), abrirCaminho(), abrirJogo(), aceitarOferta(), acoes, admBan(), admDinheiro(), assumir() (+65 more)

### Community 4 - "Rodadas do Mundo"
Cohesion: 0.07
Nodes (66): comecarJogo(), dataLiga(), dataLiga2(), pontosCorridos(), deFora(), fragilidade(), bonusFase(), registrarForma() (+58 more)

### Community 5 - "App Shell e Saves"
Cohesion: 0.06
Nodes (49): acoes, api(), app, ATALHOS, aviso(), botaoTema(), CARGO_TXT, carregarBase() (+41 more)

### Community 6 - "Copas Continentais"
Cohesion: 0.07
Nodes (46): dataCont(), agregadoCont(), ativa(), avancarCont(), caches, chavesPre(), compDe(), CONMEBOL (+38 more)

### Community 7 - "Testes, Forma e Vestiário"
Cohesion: 0.08
Nodes (40): LIGA, opiniaoGigante(), salarioBase(), salarioDia(), faseDe(), FASES, NEUTRA, premiado() (+32 more)

### Community 8 - "Regras de Mercado"
Cohesion: 0.08
Nodes (41): orcamento(), passaDoTeto(), registroBloqueado(), abrirLeilao(), aceitarContraproposta(), alternarLista(), ALVO, bloqueioProposta() (+33 more)

### Community 9 - "Elenco e Escalação"
Cohesion: 0.11
Nodes (39): ABAS, acoes, aoMudar(), bancoHtml(), bandeira(), barraCond(), boneco(), carinha() (+31 more)

### Community 10 - "Motor da Partida"
Cohesion: 0.12
Nodes (39): pular(), retomar(), aplicarLimite(), editarVaga(), escalacaoLivre(), acabou(), bancoAuto(), CAL (+31 more)

### Community 11 - "Regionais e Estaduais"
Cohesion: 0.09
Nodes (31): posicaoNoJogo(), clubesCont(), agendar(), agregadoReg(), ativo(), avancarReg(), campanha(), COPAS_REG (+23 more)

### Community 12 - "Tela de Torneios"
Cohesion: 0.15
Nodes (32): dataRodada(), F_MATA, PREMIO_SUP, TORNEIOS, dataCopa(), mandoDe(), dataSupDe(), iniciarCopa() (+24 more)

### Community 13 - "Imprensa e Confrontos"
Cohesion: 0.09
Nodes (33): chave(), confronto(), pl(), resumoConfronto(), sequencia(), textoConfronto(), F_FIN, FASES (+25 more)

### Community 14 - "Mercado por Técnico e Notícias"
Cohesion: 0.13
Nodes (32): ehHumano(), alfinetadas(), aposentadorias(), matematicos(), contratoNoFim(), emAcordo(), mercadoDoTecnico(), montarElencos() (+24 more)

### Community 15 - "Partida Ao Vivo"
Cohesion: 0.12
Nodes (29): acoes, APLICA, claro(), comecar(), cores(), dist(), encerrar(), escalacoesHtml() (+21 more)

### Community 16 - "Build de Dados"
Cohesion: 0.09
Nodes (28): atributos(), clamp(), CORTES_CLAROS, CORTES_ESCUROS, CRAQUES, ctx, DIV, HAIR_MAP (+20 more)

### Community 17 - "Transferências"
Cohesion: 0.16
Nodes (30): enviar(), vistaDo(), nome(), aceitarRecebida(), agora(), caixaDe(), cumprirAcordos(), efetivar() (+22 more)

### Community 18 - "Importação FC 27"
Cohesion: 0.08
Nodes (25): Base oficial EA FC 27 (mikedpad/ea-fc-player-stats), tools/fc27-nao-casados.csv, ../referencia/fc27/players.csv, alvo, ambiguos, candidatos(), casou, chave() (+17 more)

### Community 19 - "Jornais"
Cohesion: 0.15
Nodes (25): acoes, autor(), bola(), boneco(), capa(), cartao(), CATS, convocacao() (+17 more)

### Community 20 - "Preço e Vontade"
Cohesion: 0.17
Nodes (28): abrirLeilaoCompra(), concorrentes(), anosIA(), arred(), clausula(), ehLivre(), F_IDADE_EXT(), fatorContrato() (+20 more)

### Community 21 - "Virada de Temporada"
Cohesion: 0.14
Nodes (24): campanhaCont(), viradaDM(), arquivarGala(), moralDosPremiados(), garantirMercado(), caixaFora(), caixaIAInicial(), notaTemporada() (+16 more)

### Community 22 - "Calendário e Janelas"
Cohesion: 0.12
Nodes (24): janelaInfo(), CONT_DATAS, COPA_DATAS, COPAS_REG, dataAmistoso(), dataCopa(), datasRegionais(), dataSup() (+16 more)

### Community 23 - "Motor do Leilão"
Cohesion: 0.19
Nodes (24): emQualCont(), abrirLeilaoVenda(), agendar(), ativos(), comprimir(), desistirLeilao(), DUAS, encerrarPendente() (+16 more)

### Community 24 - "Worker (backend)"
Cohesion: 0.12
Nodes (17): aleatorio(), corpo(), criarSessao(), enc, erro(), espera(), fetch(), hashPin() (+9 more)

### Community 25 - "Campinho Animado"
Cohesion: 0.19
Nodes (20): alvos(), atualizar(), bola(), chute(), desenhar(), dist(), encerrar(), etiqueta() (+12 more)

### Community 26 - "Docs e Página HTML"
Cohesion: 0.10
Nodes (19): nav#abas (navegação entre seções, oculta no início), css/app.css (folha de estilos principal), js/app.js (script module principal), div#aviso (região de status acessível), dialog#ficha (ficha do jogador), Shell HTML do app (public/index.html), css/fontes.css (fontes), manifest.webmanifest (PWA) (+11 more)

### Community 27 - "Conclusão de Rodadas"
Cohesion: 0.34
Nodes (21): tituloDeCopa(), torcidaAposJogo(), registrarConfronto(), correio(), posJogo(), bilheteria(), humanos(), aposJogo() (+13 more)

### Community 28 - "Componentes de UI"
Cohesion: 0.20
Nodes (20): abrirFicha(), album(), bandeira(), cargoHtml(), cartaMsg(), clube(), demitidoHtml(), desenhaTopo() (+12 more)

### Community 29 - "Árbitros e Demissões"
Cohesion: 0.18
Nodes (17): arbitroDo(), NOMES, quadro(), RIGOR, SOBRENOMES, demissoesIA(), demitir(), nomeTecnico() (+9 more)

### Community 30 - "Carreira e Cargo"
Cohesion: 0.20
Nodes (19): aceitarOferta(), aposRodada(), cargo(), DIVS, garantirCarreira(), pedirDemissao(), pilares(), PRIMEIROS (+11 more)

### Community 31 - "Ligas Europeias"
Cohesion: 0.11
Nodes (16): LIGA_PAIS, tierDe(), acha(), corrigidas, d, DADOS, desceu, donos (+8 more)

### Community 32 - "Mundo Multi-Técnico"
Cohesion: 0.18
Nodes (16): cache, MESA, mesas(), mundoDe(), separar(), vista(), chaveDe(), clubeLivre() (+8 more)

### Community 33 - "Copa do Brasil"
Cohesion: 0.20
Nodes (16): agregadoIda(), avancarFase(), campanha(), copaAtiva(), copaDevida(), decidir(), ETAPAS, F_FINAL (+8 more)

### Community 34 - "Sul-Americanos"
Cohesion: 0.12
Nodes (13): Clubes de fora (não jogáveis), add(), catExt(), numerar(), P, APELIDO, conta, d (+5 more)

### Community 35 - "Gala de Prêmios"
Cohesion: 0.22
Nodes (11): acoes, lista(), premio(), rosto(), selecao(), tela(), cache, fmtN() (+3 more)

### Community 36 - "Departamento Médico"
Cohesion: 0.15
Nodes (14): agora(), CATEGORIA, COMP_DE, COMP_NOME, FRAG, garantir(), indisponiveis(), indisponivel() (+6 more)

### Community 37 - "Dados de Ligas e Álbum"
Cohesion: 0.13
Nodes (9): CAPA, d, jogadores, d, DADOS, novos, CERTO, d (+1 more)

### Community 38 - "Coletiva de Imprensa"
Cohesion: 0.21
Nodes (12): acoes, cena(), claro(), MARCAS, pendente(), setas(), tela(), chaveDe() (+4 more)

### Community 39 - "Base do Treineiros"
Cohesion: 0.15
Nodes (11): npm run dados, public/data/album.json, public/data/brasil.json, ../referencia/treineiros-1.38.10 (pasta de referência), Base do Treineiros 1.38.10, dados, [html, saida], looks (+3 more)

### Community 40 - "Preleção e Vestiário"
Cohesion: 0.30
Nodes (11): prelecaoHtml(), proximoEvento(), chaveJogo(), CONVERSAS, efeitoPrelecao(), fazerPrelecao(), mexe(), prelecaoFeita() (+3 more)

### Community 41 - "Config do Projeto"
Cohesion: 0.18
Nodes (10): devDependencies, wrangler, name, private, scripts, dados, pages, test (+2 more)

### Community 42 - "Base de Jogadores"
Cohesion: 0.33
Nodes (4): carregarAlbum(), Base, estica(), jogador()

### Community 43 - "Vida e Valor"
Cohesion: 0.20
Nodes (7): C, d, DADOS, MIN, R, sobra, valorDe()

### Community 44 - "Eventos Aleatórios"
Cohesion: 0.36
Nodes (6): afastar(), EVENTOS, eventosAposRodada(), mexe(), valorElenco(), sufixo()

### Community 45 - "Sons"
Cohesion: 0.39
Nodes (7): ac(), alternarSom(), apito(), ligado, pancada(), SOM, torcida()

### Community 46 - "Correio"
Cohesion: 0.29
Nodes (6): lista(), naoLidas(), opiniao(), REMETENTES, ANO_FPF, ABRE_PRE

### Community 47 - "Graphify (CLAUDE.md)"
Cohesion: 0.33
Nodes (5): graphify-out/graph.json, Instalação do graphify (uv / pip), graphify query / explain / path / affected, Início de toda sessão: graphify, graphify update .

### Community 48 - "Banco: Contas e Saves"
Cohesion: 0.40
Nodes (5): mural, saves, sessoes, sessoes_usuario, usuarios

### Community 49 - "Ícone 512"
Cohesion: 0.50
Nodes (5): Figurinhos App Icon (icone-512), Possible collectible sticker/coin token (identity unclear), Figurinhos football-manager game, Orange pixel-art ball/token with dark outline, Striped green pitch background

### Community 50 - "Banco: Ligas"
Cohesion: 0.67
Nodes (3): ligas, mesas, mesas_usuario

### Community 51 - "Ícone 192"
Cohesion: 0.50
Nodes (4): App icon 192px (ball on striped pitch), Yellow-orange pixel-art football, Home-screen (PWA) icon purpose, Striped green pitch background

### Community 52 - "Rivalidades"
Cohesion: 0.67
Nodes (3): mapa(), PARES, rivaisDe()

### Community 53 - "Código de Rosto"
Cohesion: 0.50
Nodes (4): Campos do código de face (pele, cabelo, corte, barba, rosto, sobrancelha, nariz, boca, íris, acessório, luzes), Código de face de 11 caracteres (medido em foto), Índice na lista da Série A de brasil.json, Jogadores achados pela busca (saíram do clube ou sem foto no elenco)

## Ambiguous Edges - Review These
- `Orange pixel-art ball/token with dark outline` → `Possible collectible sticker/coin token (identity unclear)`  [AMBIGUOUS]
  public/img/icone-512.png · relation: conceptually_related_to

## Knowledge Gaps
- **25 isolated node(s):** `wrangler`, `css/fontes.css (fontes)`, `manifest.webmanifest (PWA)`, `main#tela (área de renderização das telas)`, `nav#abas (navegação entre seções, oculta no início)` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 388 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ehLivre()` connect `Preço e Vontade` to `Regras de Mercado`, `Transferências`, `Mercado por Técnico e Notícias`, `Build de Dados`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `wrangler`, `css/fontes.css (fontes)`, `manifest.webmanifest (PWA)` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Pixel Art e Leilão (tela)` be split into smaller, more focused modules?**
  _Cohesion score 0.0546984572230014 - nodes in this community are weakly interconnected._
- **Why does `clamp()` connect `Preço e Vontade` to `Tela do Mercado`, `Finanças e Patrocínio`, `Copas Continentais`, `Testes, Forma e Vestiário`, `Regras de Mercado`, `Elenco e Escalação`, `Motor da Partida`, `Imprensa e Confrontos`, `Mercado por Técnico e Notícias`, `Partida Ao Vivo`, `Transferências`, `Virada de Temporada`, `Motor do Leilão`, `Campinho Animado`, `Conclusão de Rodadas`, `Árbitros e Demissões`, `Carreira e Cargo`, `Departamento Médico`, `Preleção e Vestiário`, `Vida e Valor`, `Eventos Aleatórios`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `Tela do Mercado` be split into smaller, more focused modules?**
  _Cohesion score 0.05642633228840126 - nodes in this community are weakly interconnected._
- **Why does `rng()` connect `Árbitros e Demissões` to `Tela do Mercado`, `Finanças e Patrocínio`, `Rodadas do Mundo`, `App Shell e Saves`, `Copas Continentais`, `Testes, Forma e Vestiário`, `Regras de Mercado`, `Motor da Partida`, `Regionais e Estaduais`, `Imprensa e Confrontos`, `Mercado por Técnico e Notícias`, `Transferências`, `Jornais`, `Preço e Vontade`, `Virada de Temporada`, `Calendário e Janelas`, `Motor do Leilão`, `Conclusão de Rodadas`, `Carreira e Cargo`, `Copa do Brasil`, `Departamento Médico`, `Coletiva de Imprensa`, `Preleção e Vestiário`, `Vida e Valor`, `Eventos Aleatórios`, `Correio`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Orange pixel-art ball/token with dark outline` and `Possible collectible sticker/coin token (identity unclear)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._