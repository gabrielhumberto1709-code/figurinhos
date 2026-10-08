// Séries B e C com vida: na base de referência a Série C vem quase toda gerada (overall com desvio ~2, todo mundo
// valendo €0, elencos de 40-60). Aqui cada clube da C ganha um nível próprio (torcida + sorteio fixo), os jogadores
// gerados se espalham (desvio ~5), quem passa de 32 no elenco vai para os clubes dos regionais (ids continuam
// existindo, saves antigos não quebram) e todo jogador de A/B/C sem valor ganha valor de mercado pela idade e overall.
// Roda uma vez por base (marca d.vida); `npm run dados` chama na ordem certa.
// Uso: node tools/vida.js
import { readFileSync, writeFileSync } from 'node:fs';
import { rng, clamp } from '../public/js/motor/util.js';

const DADOS = new URL('../public/data/brasil.json', import.meta.url), d = JSON.parse(readFileSync(DADOS));
if (d.vida) { console.log('vida: base já ajustada'); process.exit(0); }
const cl = d.clubes, J = d.jogadores, divDe = r => cl[r[3]]?.div;
const gauss = r => (r() + r() + r() + r() - 2) * 1.73; // ~N(0,1)

// valor (milhares de €) pela curva do Brasileirão: ~150 mil num 50 de 25 anos, ×1,16 por ponto; jovem vale mais, veterano menos
const valorDe = r => { const x = rng('valor' + r[0]), idade = r[5]; return Math.max(10, Math.round(150 * 1.16 ** (r[7] - 50) * (idade <= 21 ? 1.9 : idade <= 24 ? 1.4 : idade >= 33 ? 0.3 : idade >= 30 ? 0.55 : 1) * (0.75 + x() * 0.5) / 5) * 5); };

// ---------- Série C: nível por clube e desvio maior ----------
const C = cl.map((c, i) => i).filter(i => cl[i].div === 'C');
let espalhados = 0;
for (const ci of C) {
  const el = J.filter(r => r[3] === ci), r = rng('vidaC' + cl[ci].n), media = el.reduce((a, x) => a + x[7], 0) / el.length;
  const nivel = 50.5 + (cl[ci].fan - 2) * 0.8 + gauss(r) * 1.8;
  for (const x of el) {
    if (x[8] > 0) continue; // jogador real (tem valor): fica como está
    const novo = clamp(Math.round(nivel + (x[7] - media) * 1.6 + gauss(r) * 3.2), 38, 68), dlt = novo - x[7];
    x[7] = novo; x[11] = x[11].map(a => clamp(a + dlt, 20, 99)); x[10] = Math.max(x[10] + dlt, novo); espalhados++;
  }
}

// ---------- elencos da C até 32: os mínimos por posição primeiro, depois os melhores ----------
const MIN = { GOL: 3, ZAG: 4, LD: 2, LE: 2, VOL: 2, MC: 2, MEI: 1, PE: 1, PD: 1, CA: 2 };
const R = cl.map((c, i) => i).filter(i => cl[i].div === 'R').sort((a, b) => cl[b].lvl - cl[a].lvl);
const sobra = [];
for (const ci of C) {
  const el = J.filter(r => r[3] === ci).sort((a, b) => b[7] - a[7]);
  if (el.length <= 32) continue;
  const fica = new Set();
  for (const [pos, n] of Object.entries(MIN)) for (const x of el.filter(r => r[4] === pos).slice(0, n)) fica.add(x);
  for (const x of el) if (fica.size < 32) fica.add(x);
  for (const x of el) if (!fica.has(x)) sobra.push(x);
}
// os que sobraram reforçam os clubes dos regionais (os melhores para os clubes mais fortes), sem passar do nível deles
sobra.sort((a, b) => b[7] - a[7]).forEach((x, k) => { const ci = R[k % R.length], teto = cl[ci].lvl + 4; if (x[7] > teto) { const dlt = teto - x[7]; x[7] = teto; x[11] = x[11].map(a => clamp(a + dlt, 20, 99)); x[10] = Math.max(x[10] + dlt, teto); } x[3] = ci; });

// ---------- valor de mercado para quem está em A/B/C (e agora nos regionais) com €0 ----------
let valores = 0;
for (const x of J) if (['A', 'B', 'C', 'R'].includes(divDe(x)) && !(x[8] > 0)) { x[8] = valorDe(x); valores++; }

d.vida = 1;
writeFileSync(DADOS, JSON.stringify(d));
console.log(`vida: ${espalhados} jogadores da C reespalhados, ${sobra.length} foram para clubes dos regionais, ${valores} ganharam valor`);
