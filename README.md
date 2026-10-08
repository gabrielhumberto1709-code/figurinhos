# Figurinhos

Manager de futebol de botão. Cloudflare Worker + D1, front em JS puro (sem build).

- `npm test` — testes do motor (calendário, partida, temporada calibrada, save)
- `npx wrangler dev` — roda local em http://localhost:8787 (aplique antes `npx wrangler d1 migrations apply figurinhos --local`)
- `npm run dados -- <pasta-da-referencia>` — regera `public/data/brasil.json`

Deploy: cada push na `main` publica pelo Workers Builds da Cloudflare.
Dados de jogadores: base do Treineiros 1.38.10, uso autorizado pelo criador.

## Modo online (base pronta, ainda não ligado)
- Modelo escolhido: um Durable Object por liga roda o mesmo motor (`public/js/motor/`, ES modules puros) e é o único que grava o estado da liga; os navegadores mandam decisões (escalação, propostas) e recebem o estado. Replay da semente no cliente foi descartado: o Worker grátis não tem CPU para revalidar uma rodada.
- O motor não sorteia nada sozinho (a semente vem de fora) e não tem estado global: a formação personalizada viaja com o time (`pers`), não numa tabela do módulo.
- Falta: separar o mundo da liga das carreiras (hoje o save mistura os dois via `s.tecnico.clube`) e uma `Base` por liga no servidor.
- API: `PUT /api/saves/:slot` exige a versão (`base`) e responde 409 se outro aparelho salvou depois; login e cadastro têm limite por IP (tabela `limites`).
