// Calendário de pontos corridos (turno e returno) pelo método do círculo.
import { rng, shuffle } from './util.js';

export function pontosCorridos(times, seed) {
  const r = rng('cal' + seed);
  const t = shuffle(r, times);
  if (t.length % 2) t.push(null);
  const n = t.length, turno = [];
  const fixo = t[0], gira = t.slice(1);
  for (let rd = 0; rd < n - 1; rd++) {
    const ordem = [fixo, ...gira];
    const jogos = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ordem[i], b = ordem[n - 1 - i];
      if (a === null || b === null) continue;
      // alterna mando para ninguém jogar muitas vezes seguidas em casa
      jogos.push((rd + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    turno.push(jogos);
    gira.unshift(gira.pop());
  }
  const returno = turno.map(jogos => jogos.map(([a, b]) => [b, a]));
  return [...turno, ...returno];
}

// ---------- temporada: o calendário real de 2026 (CBF e Conmebol) ----------
// Fontes: tabela básica da CBF (Série A rodada a rodada), regulamentos das Séries B e C, Copa do Brasil 2026 (art. 12),
// calendário Conmebol 2026. Os outros anos repetem 2026 pelas semanas: mesma semana do ano e mesmo dia da semana.
// - Estaduais de 11/jan a 8/mar (domingos e algumas quartas), em paralelo com o começo da Série A.
// - Série A de 28/jan a 2/dez, parada de 1º/jun a 22/jul (Copa do Mundo).
// - Série B de 21/mar a 14/nov (aos sábados, 3 terças) + playoff de acesso 21 e 28/nov (3º×6º e 4º×5º).
// - Série C: 1ª fase em turno único de 4/abr a 30/ago, quadrangulares de 5/set a 10/out e final 18 e 25/out.
// - Copa do Brasil: fases 1 a 4 em jogo único (fev-mar), a Série A entra na 5ª fase (abr-mai); oitavas, quartas e
//   semi em ida e volta; final única em 6/dez.
// - Libertadores e Sul-Americana: grupos de 8/abr a 27/mai; playoff da Sul-Americana 22 e 29/jul (2º do grupo da Sula
//   × 3º do grupo da Libertadores); oitavas em agosto, quartas em setembro, semi em outubro; finais 21/nov (Sula) e
//   28/nov (Libertadores). Copas regionais (Nordeste, Sul-Sudeste, Verde) de 25/mar a 7/jun, às quartas.
// - Janelas: 5/jan a 3/mar e 20/jul a 11/set.
const DIA = 864e5, BASE = 2026;
const domingo1 = ano => { const d = new Date(Date.UTC(ano, 0, 1)).getUTCDay(); return Date.UTC(ano, 0, 1 + (7 - d) % 7); };
// "mês-dia" de 2026 levado ao ano pedido (mesma semana, mesmo dia da semana)
export const doAno = (ano, md) => { const [m, d] = md.split('-').map(Number); return new Date(domingo1(ano) + Date.UTC(BASE, m - 1, d) - domingo1(BASE)); };
const lista = (ano, L) => L.map(md => doAno(ano, md));
const dias2026 = (de, ate, semana) => { const L = []; for (let t = Date.UTC(BASE, ...de), f = Date.UTC(BASE, ...ate); t <= f; t += DIA) { const d = new Date(t); if (semana.includes(d.getUTCDay())) L.push(`${d.getUTCMonth() + 1}-${d.getUTCDate()}`); } return L; };
const ordenar = L => L.sort((a, b) => { const [m1, d1] = a.split('-').map(Number), [m2, d2] = b.split('-').map(Number); return m1 - m2 || d1 - d2; });

export const LIGA = {
  A: ['1-28', '2-4', '2-11', '2-25', '3-11', '3-15', '3-18', '3-22', '4-1', '4-5', '4-12', '4-19', '4-26', '5-3', '5-10', '5-17', '5-24', '5-31',
    '7-23', '7-26', '7-30', '8-9', '8-16', '8-23', '8-30', '9-6', '9-13', '9-20', '10-7', '10-11', '10-18', '10-25', '10-28', '11-4', '11-18', '11-22', '11-29', '12-2'],
  B: ordenar([...dias2026([2, 21], [10, 14], [6]), '4-28', '7-14', '9-29']),
  C: ['4-4', ...dias2026([3, 12], [7, 30], [0]).filter(x => !['6-14', '6-28', '7-12'].includes(x))],
};
// segunda fase: playoff de acesso da B (ida, volta), quadrangulares da C (6 rodadas) e final da C (ida, volta)
export const LIGA2 = { B: ['11-21', '11-28'], C: ['9-5', '9-12', '9-19', '9-26', '10-3', '10-10', '10-18', '10-25'] };
export const N_LIGA = { A: 38, B: 38, C: 19 };
export const dataLiga = (ano, d, k) => doAno(ano, LIGA[d][Math.min(k, LIGA[d].length - 1)]);
export const dataLiga2 = (ano, d, i) => doAno(ano, LIGA2[d][i]);
export const dataRodada = (ano, r) => r >= 38 ? new Date(+dataLiga(ano, 'A', 37) + 4 * DIA) : dataLiga(ano, 'A', r);
export const COPA_DATAS = ['2-18', '2-25', '3-11', '3-18', '4-22', '5-13', '8-2', '8-5', '8-26', '9-2', '11-1', '11-8', '12-6'];
export const dataCopa = (ano, i) => doAno(ano, COPA_DATAS[i]);
const CONT_DATAS = ['4-8', '4-15', '4-29', '5-6', '5-20', '5-27', '7-22', '7-29', '8-12', '8-19', '9-9', '9-16', '10-14', '10-21'];
export const dataCont = (ano, i, k = 'LIB') => doAno(ano, CONT_DATAS[i] || (k === 'SUL' ? '11-21' : '11-28'));
export const dataSup = ano => doAno(ano, '2-1');
export const dataAmistoso = (ano, i) => doAno(ano, ['1-3', '1-6', '1-8'][i]);
export const JANELAS = [['1-5', '3-3'], ['7-20', '9-11']];
export const janelaNaData = (ano, t) => JANELAS.some(([a, b]) => +t >= +doAno(ano, a) && +t <= +doAno(ano, b) + DIA - 1);
// fim da temporada no calendário: dia seguinte à final da Copa do Brasil
export const fimDoAno = ano => new Date(+dataCopa(ano, 12) + DIA);
// datas dos regionais: E = estaduais (os 9 domingos de 11/jan a 8/mar; quem precisa de mais usa as quartas livres da
// Série A), T = Paulista A2 (domingos e quartas até abril), C = copas regionais (quartas de 25/mar a 7/jun).
const ESTADUAL = ['1-11', '1-18', '1-25', '2-1', '2-8', '2-15', '2-22', '3-1', '3-8'], QUARTAS_LIVRES = ['1-14', '1-21', '3-4', '2-18', '1-28'];
const COPAS_REG = ['3-25', '4-8', '4-15', '4-22', '4-29', '5-6', '5-20', '5-27', '6-3', '6-7'];
export function datasRegionais(ano, tipo, n) {
  let L = tipo === 'C' ? COPAS_REG : tipo === 'T' ? dias2026([0, 11], [3, 19], [0, 3]) : n > ESTADUAL.length ? ordenar([...ESTADUAL, ...QUARTAS_LIVRES.slice(0, n - ESTADUAL.length)]) : ESTADUAL;
  return Array.from({ length: n }, (_, i) => doAno(ano, L[n > 1 ? Math.round(i * (L.length - 1) / (n - 1)) : L.length - 1]));
}
