# Figurinhos

Manager de futebol de botão. Cloudflare Worker + D1, front em JS puro (sem build).

- `npm test` — testes do motor (calendário, partida, temporada calibrada, save)
- `npx wrangler dev` — roda local em http://localhost:8787 (aplique antes `npx wrangler d1 migrations apply figurinhos --local`)
- `npm run dados` — regera `public/data/brasil.json` e `album.json` a partir da base do Treineiros. A pasta de referência fica em `../referencia/treineiros-1.38.10`; se só tiver o HTML do Treineiros, `node tools/extrair-treineiros.js <treineiros.html>` monta a pasta.
- Clubes de fora (`div: 'X'`, não jogáveis): `tools/europa.js` mantém Premier League, LaLiga, Serie A, Bundesliga e Ligue 1 com os clubes da temporada 2026-27 (lista no topo do arquivo; troque a lista e rode de novo a cada virada de temporada) e manda os rebaixados para Championship, Segunda División, Serie B, 2. Bundesliga e Ligue 2. Sul-americanos: `tools/sulamericanos.js`.
- Geral e atributos do EA FC 27 para todo jogador fora da Série A/B/C e dos regionais: `tools/fc27.js`, que lê `../referencia/fc27/players.csv` (base oficial da EA, https://github.com/mikedpad/ea-fc-player-stats) e escreve `tools/fc27-nao-casados.csv` com quem não casou. Potencial: a EA não publica, então vale a folga que o jogador já tinha somada ao geral novo.

Deploy: cada push na `main` publica pelo Workers Builds da Cloudflare.
Dados de jogadores: base do Treineiros 1.38.10, uso autorizado pelo criador.

## Modo online (base pronta, ainda não ligado)
- Modelo escolhido: um Durable Object por liga roda o mesmo motor (`public/js/motor/`, ES modules puros) e é o único que grava o estado da liga; os navegadores mandam decisões (escalação, propostas) e recebem o estado. Replay da semente no cliente foi descartado: o Worker grátis não tem CPU para revalidar uma rodada.
- O motor não sorteia nada sozinho (a semente vem de fora) e não tem estado global: a formação personalizada viaja com o time (`pers`), não numa tabela do módulo.
- Falta: separar o mundo da liga das carreiras (hoje o save mistura os dois via `s.tecnico.clube`) e uma `Base` por liga no servidor.
- API: `PUT /api/saves/:slot` exige a versão (`base`) e responde 409 se outro aparelho salvou depois; login e cadastro têm limite por IP (tabela `limites`).
