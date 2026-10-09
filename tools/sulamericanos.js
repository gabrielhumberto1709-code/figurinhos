// Base sul-americana do Treineiros 1.38.10 (uso autorizado): elencos completos das ligas da Argentina, Colômbia,
// Paraguai, Uruguai, Chile, Equador, Peru e Bolívia (a Venezuela não está na base e segue com elenco gerado nas copas).
// Só acrescenta: clube que já existe ganha os jogadores que faltam e clube novo entra no fim da lista, então os índices
// guardados nos saves não mudam. Acerta liga, país, tier e nível de todo clube dessas ligas. Idempotente.
// Uso: node tools/sulamericanos.js [pasta-da-referencia]   (o `npm run dados` chama no fim)
import { readFileSync, writeFileSync } from 'node:fs';
import { CORE, P, novoJogador, numerar, kitGerado, catExt } from './build-dados.js';

const DADOS = new URL('../public/data/brasil.json', import.meta.url), d = JSON.parse(readFileSync(DADOS));
// liga na referência -> [nome no jogo, país, tier do mercado]
const LIGAS = { 'Liga Argentina': ['Liga Argentina', 'ARG', 2], 'Liga Colombiana': ['Liga Colombiana', 'COL', 1.5], 'Liga PAR': ['Liga Paraguaia', 'PAR', 1.2], 'Liga URU': ['Liga Uruguaia', 'URU', 1.2], 'Liga CHI': ['Liga Chilena', 'CHI', 1.2], 'Liga EQU': ['Liga Equatoriana', 'EQU', 1.2], 'Liga PER': ['Liga Peruana', 'PER', 1], 'Liga BOL': ['Liga Boliviana', 'BOL', 0.8] };
// nome na referência -> nome que o jogo já usa (é o dos grupos reais da Libertadores e da Sul-Americana 2026)
const APELIDO = { Riestra: 'Deportivo Riestra', 'Santa Fe': 'Independiente Santa Fe', Junior: 'Junior Barranquilla', 'Ind. Medellín': 'Independiente Medellín', 'Barcelona SC': 'Barcelona de Guayaquil', Juventud: 'Juventud de Las Piedras' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// clube da liga = 15 ou mais jogadores marcados com ela (o resto é jogador que já saiu e ficou com a etiqueta antiga)
const conta = new Map();
for (const r of P.values()) if (LIGAS[r[9]]) { const k = `${r[9]}|${r[3]}`; conta.set(k, (conta.get(k) || 0) + 1); }
const daLiga = new Map([...conta].filter(([, n]) => n >= 15).map(([k]) => { const [liga, n] = k.split('|'); return [n, LIGAS[liga]]; }));

const ids = new Set(d.jogadores.map(r => r[0])), mexidos = new Set();
let novosClubes = 0, novosJog = 0;
for (const [ref, [liga, nat, tier]] of daLiga) {
  const n = APELIDO[ref] || ref, elenco = [...P.values()].filter(r => r[3] === ref);
  const top = elenco.map(r => r[8]).sort((a, b) => b - a).slice(0, 11), lvl = Math.round(top.reduce((a, b) => a + b, 0) / top.length);
  let ci = d.clubes.findIndex(c => c.n === n && c.div === 'X');
  if (ci < 0) {
    const k = catExt(ref) || catExt(n) || kitGerado(n);
    ci = d.clubes.push({ n, s: k.sig, pat: k.pat, c: k.c, sh: k.sh, so: k.so, fan: k.fan || clamp(Math.round(tier + (lvl - 70) / 3), 2, 9), est: CORE.STADIUMS[ref] || [`Estádio do ${n}`, 20000], div: 'X' }) - 1;
    novosClubes++;
  }
  Object.assign(d.clubes[ci], { liga, nat, tier, lvl });
  for (const r of elenco) if (!ids.has(r[0])) { d.jogadores.push(novoJogador(r, ci)); ids.add(r[0]); novosJog++; mexidos.add(ci); }
}
for (const ci of mexidos) numerar(d.jogadores, ci);
d.versao = 4;
writeFileSync(DADOS, JSON.stringify(d));
console.log(`sul-americanos: ${daLiga.size} clubes (${novosClubes} novos), ${novosJog} jogadores novos`);
