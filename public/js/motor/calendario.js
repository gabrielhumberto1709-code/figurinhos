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
