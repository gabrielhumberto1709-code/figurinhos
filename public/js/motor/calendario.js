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

// ---------- temporada ----------
// Igual todo ano, contada em semanas a partir do 2º domingo de janeiro (semana 0), como no calendário clássico:
// - 3 amistosos na primeira semana de janeiro;
// - semanas 0 a 12: só regionais, com a janela de transferências aberta. Estaduais nos domingos (e nas quartas das
//   3 primeiras semanas); Copa do Nordeste, Sul-Sudeste e Verde nas quartas das semanas 3 a 12; Supercopa na quarta
//   da semana 3 (quem joga a Supercopa está na Libertadores e não disputa copa regional);
// - semana 13 (meio de abril) em diante: Brasileirão até o começo de dezembro, com pausa de 6 semanas em junho/julho.
//   Toda semana tem rodada no domingo; a quarta é de Libertadores/Sul-Americana (L), Copa do Brasil (C), rodada (R) ou livre (-).
const DIA = 864e5;
export const semana0 = ano => { const d = new Date(Date.UTC(ano, 0, 1)).getUTCDay(); return Date.UTC(ano, 0, 1 + (7 - d) % 7 + 7); };
const dia = (ano, semana, quarta) => new Date(semana0(ano) + (semana * 7 + (quarta ? 3 : 0)) * DIA);
const QUARTAS = 'LLCLLCLLRCRLR-CRLR-R-LRCRCLR-';
const LIGA = [], COPA = [], CONT = [];
for (let a = 0; a < QUARTAS.length; a++) {
  const w = 13 + a + (a >= 8 ? 6 : 0);
  LIGA.push([w, 0]);
  ({ R: LIGA, C: COPA, L: CONT }[QUARTAS[a]] || []).push([w, 1]);
}
// rodada da liga logo antes de cada data de copa: a fase da copa "chega" quando essa rodada foi jogada
const antes = ([w, q]) => LIGA.findLastIndex(([x, y]) => x * 2 + y < w * 2 + q);
export const APOS_COPA = COPA.map(antes), APOS_CONT = CONT.map(antes);
export const dataRodada = (ano, r) => r >= LIGA.length ? new Date(+dia(ano, ...LIGA.at(-1)) + 7 * DIA) : dia(ano, ...LIGA[r]);
export const dataCopa = (ano, i) => dia(ano, ...COPA[i]);
export const dataCont = (ano, i) => dia(ano, ...CONT[i]);
export const dataSup = ano => dia(ano, 3, 1);
export const dataAmistoso = (ano, i) => new Date(semana0(ano) - [8, 5, 2][i] * DIA);
// datas dos regionais: E = estaduais (os 13 domingos; quem tem mais datas usa também as quartas das 3 primeiras semanas),
// C = copas regionais, T = todas as datas (Paulista A2, que tem 25). A competição se espalha da primeira à última data.
export function datasRegionais(ano, tipo, n) {
  const S = Array.from({ length: 13 }, (_, w) => w);
  const L = (tipo === 'C' ? S.slice(3).map(w => [w, 1]) : tipo === 'T' ? S.flatMap(w => [[w, 0], [w, 1]]) : [...S.map(w => [w, 0]), ...S.slice(0, Math.max(0, n - 13)).map(w => [w, 1])])
    .sort((x, y) => x[0] * 2 + x[1] - y[0] * 2 - y[1]);
  return Array.from({ length: n }, (_, i) => dia(ano, ...L[n > 1 ? Math.round(i * (L.length - 1) / (n - 1)) : L.length - 1]));
}
