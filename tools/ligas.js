// Corrige a liga de clubes de fora que vieram marcados como "Liga Argentina" na base de origem (MLS, México, Itália,
// França, Espanha, Paraguai, Equador, Uruguai). A liga define o tier (força do mercado) e o país do clube.
// Idempotente. Uso: node tools/ligas.js (o `npm run dados` chama no fim)
import { readFileSync, writeFileSync } from 'node:fs';

const DADOS = new URL('../public/data/brasil.json', import.meta.url), d = JSON.parse(readFileSync(DADOS));
const L = (liga, tier, nat, nomes) => nomes.map(n => [n, { liga, tier, nat }]);
const CERTO = new Map([
  ...L('MLS', 2.5, 'EUA', ['Atlanta United', 'Columbus Crew', 'Houston Dynamo', 'Internacional Miami']),
  ...L('Liga MX', 2.5, 'MEX', ['Atlas Guadalajara', 'León', 'Querétaro', 'Santos Laguna']),
  ...L('Serie A (ITA)', 5, 'ITA', ['Bologna 1909', 'Parma 1913']),
  ...L('Serie B (ITA)', 2.5, 'ITA', ['Monza']),
  ...L('LaLiga', 5, 'ESP', ['Elche']),
  ...L('Ligue 1', 4, 'FRA', ['LOSC Lille', 'Strasbourg Alsace']),
  ...L('Liga Paraguaia', 1, 'PAR', ['Cerro Porteño', 'Olimpia']),
  ...L('Liga Equatoriana', 1, 'EQU', ['LDU Quito']),
  ...L('Liga Uruguaia', 1, 'URU', ['Nacional', 'Peñarol']),
]);
let n = 0;
for (const c of d.clubes) { const x = c.div === 'X' && CERTO.get(c.n); if (x && c.liga !== x.liga) { Object.assign(c, x); n++; } }
writeFileSync(DADOS, JSON.stringify(d));
console.log(`ligas: ${n} clubes corrigidos`);
