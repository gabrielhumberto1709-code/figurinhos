# Figurinhos

Manager de futebol de botão. Cloudflare Worker + D1, front em JS puro (sem build).

- `npm test` — testes do motor (calendário, partida, temporada calibrada, save)
- `npx wrangler dev` — roda local em http://localhost:8787 (aplique antes `npx wrangler d1 migrations apply figurinhos --local`)
- `npm run dados -- <pasta-da-referencia>` — regera `public/data/brasil.json`

Deploy: cada push na `main` publica pelo Workers Builds da Cloudflare.
Dados de jogadores: base do Treineiros 1.38.10, uso autorizado pelo criador.
