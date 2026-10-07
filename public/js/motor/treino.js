// Evolução no dia a dia: quem é jovem e ainda tem margem até o potencial cresce a cada jogo do seu clube.
// Cresce mais com treino intenso, jogando (e jogando bem) e com foco individual (até 3 jogadores).
// O ganho fica no save (s.evo) e soma por cima da evolução natural de cada ano.
import { cartaDe, clamp } from './util.js';

export const TREINO_EVO = { leve: 0.6, normal: 1, intenso: 1.45 };
export const MAX_FOCO = 3;
export const idadeF = i => i <= 19 ? 1.3 : i <= 21 ? 1.1 : i <= 23 ? 0.8 : i <= 26 ? 0.4 : i <= 29 ? 0.15 : 0;

// quanto o jogador ganha num jogo do clube (nota = null se não entrou)
export function ganho(s, j, nota) {
  const gap = j.pot - j.ovr;
  if (gap <= 0) return 0;
  const jogo = nota != null ? 1.2 + clamp((nota - 6.3) * 0.5, -0.3, 0.8) : 0.6;
  return 0.05 * idadeF(j.idade) * (TREINO_EVO[s.treino] || 1) * gap / (gap + 4) * jogo * (s.foco?.includes(j.id) ? 1.8 : 1);
}

export function evoluir(base, s, ci, notas) {
  s.evo ||= {};
  const N = [];
  for (const j of base.elencos[ci]) {
    const g = ganho(s, j, notas[j.id] ?? null);
    if (g <= 0) continue;
    const antes = Math.floor(s.evo[j.id] || 0), carta = cartaDe(j.ovr);
    s.evo[j.id] = Math.round(((s.evo[j.id] || 0) + g) * 1000) / 1000;
    if (Math.floor(s.evo[j.id]) > antes) {
      base.aplicarEvo(j.id, s.evo[j.id]);
      const nova = cartaDe(j.ovr);
      if (nova.k !== carta.k) N.push({ tipo: 'clube', jogador: j.id, texto: `${j.curto} subiu de nível no treino: agora é ${nova.nome} (${j.ovr} de overall).` });
    }
  }
  return N;
}

export function alternarFoco(s, id) {
  s.foco ||= [];
  if (s.foco.includes(id)) { s.foco = s.foco.filter(x => x !== id); return null; }
  if (s.foco.length >= MAX_FOCO) return `Foco individual é para até ${MAX_FOCO} jogadores. Tire alguém antes.`;
  s.foco.push(id); return null;
}
