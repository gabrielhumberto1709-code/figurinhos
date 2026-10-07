// Fase do jogador: média recente das notas (cada jogo pesa 35%). Fase excelente rende como se tivesse +3 de
// overall em campo; péssima, -3. A fase também mexe no preço e no interesse dos outros clubes.
export const FASES = [
  { k: 'excelente', nome: 'Fase excelente', min: 7.0, d: 3, seta: '▲▲' },
  { k: 'boa', nome: 'Fase boa', min: 6.6, d: 1, seta: '▲' },
  { k: 'normal', nome: 'Fase normal', min: 5.85, d: 0, seta: '' },
  { k: 'ruim', nome: 'Fase ruim', min: 5.5, d: -1, seta: '▼' },
  { k: 'pessima', nome: 'Fase péssima', min: -Infinity, d: -3, seta: '▼▼' },
];
export const NEUTRA = 6.3;
export const faseDe = (s, id) => { const f = s.forma?.[id]; return f == null ? FASES[2] : FASES.find(x => f >= x.min); };
export const bonusFase = s => id => faseDe(s, id).d;

// atualiza a média de quem jogou; devolve quem mudou de fase
export function registrarForma(s, notas) {
  s.forma ||= {};
  const mudou = [];
  for (const [id, n] of Object.entries(notas)) {
    const antes = faseDe(s, id);
    s.forma[id] = Math.round(((s.forma[id] ?? NEUTRA) * 0.65 + n * 0.35) * 100) / 100;
    const depois = faseDe(s, id);
    if (depois !== antes) mudou.push([+id, antes, depois]);
  }
  return mudou;
}
