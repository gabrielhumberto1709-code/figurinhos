// Potencial dinâmico: na virada, quem fez grande temporada (nota média, gols e assistências, jogos) tem o potencial
// revisado para cima; quem foi mal, para baixo. Vale para todo mundo do Brasileirão (seu clube e a IA). Jovem oscila
// mais; veterano quase nada. O ajuste fica no save (s.potd) e entra na evolução do ano seguinte.
import { clamp } from './util.js';

// nota da temporada: ~0 é o jogador mediano; 2 já é dos 10% melhores
export const notaTemporada = e => (e[3] / 10 / e[0] - 6.25) * 6 + (e[1] + e[2] * 0.7) / e[0] * 3 + (e[0] >= 25 ? 0.4 : 0) - 0.45;
const PESO = idade => idade <= 21 ? 1.3 : idade <= 24 ? 1 : idade <= 27 ? 0.6 : 0; // depois dos 28 o potencial já não importa (a curva é de queda)

export function revisarPotencial(base, s) {
  s.potd ||= {};
  const mud = [];
  for (const [id, e] of Object.entries(s.est || {})) {
    const j = base.jog.get(+id);
    if (!j || j.fora || !e[0] || e[0] < 8 || !PESO(j.idade)) continue;
    const d = Math.round(clamp(notaTemporada(e), -3, 4) * PESO(j.idade));
    if (!d) continue;
    const novo = clamp(j.pot + d, j.ovr, 99), acum = clamp((s.potd[id] || 0) + novo - j.pot, -8, 10), real = acum - (s.potd[id] || 0);
    if (!real) continue;
    s.potd[id] = acum; j.pot += real;
    mud.push([j, real]);
  }
  return mud;
}
