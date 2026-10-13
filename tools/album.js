// Gera public/data/album.json: a mini-base da capa (as 3 figurinhas do álbum antes do login). Tem todos os clubes
// (os índices dos jogadores apontam para eles) e só os jogadores da capa; o resto da base só baixa depois do login.
// Se mudar os jogadores da capa, mude também COLA em public/js/app.js. Uso: node tools/album.js (o `npm run dados` chama no fim)
import { readFileSync, writeFileSync } from 'node:fs';

const CAPA = [371998, 68290, 342229]; // Vinicius Junior, Neymar, Mbappé
const d = JSON.parse(readFileSync(new URL('../public/data/brasil.json', import.meta.url)));
const jogadores = CAPA.map(id => d.jogadores.find(j => j[0] === id));
if (jogadores.some(j => !j)) throw new Error('album: jogador da capa não está na base');
const { versao, ano, fonte, clubes } = d;
writeFileSync(new URL('../public/data/album.json', import.meta.url), JSON.stringify({ versao, ano, fonte, capa: true, clubes, jogadores, divisoes: {} }));
console.log(`album: ${clubes.length} clubes, ${jogadores.length} jogadores da capa`);
