// Departamento médico e disciplina: lesões (no jogo), recuperação contada em jogos do clube,
// infiltração, suspensões por cartão separadas por competição (L = liga, CB = Copa do Brasil).
import { rng, pickW, clamp } from './util.js';
import { naSelecao } from './selecao.js';

// cat: mus muscular, art articulação/ligamento, oss óssea, cab cabeça, con contusão
// min/max em jogos fora; inf: aceita infiltração; risco: chance base de agravar jogando infiltrado
export const LESOES = {
  pancada: { n: 'Pancada no tornozelo', cat: 'con', g: 1, min: 1, max: 2, inf: true, risco: 0.08 },
  contusao: { n: 'Contusão na coxa', cat: 'con', g: 1, min: 1, max: 2, inf: true, risco: 0.08 },
  fadiga: { n: 'Fadiga muscular', cat: 'mus', g: 1, min: 1, max: 2, inf: true, risco: 0.18 },
  desconforto: { n: 'Desconforto muscular', cat: 'mus', g: 1, min: 1, max: 2, inf: true, risco: 0.15 },
  entorse1: { n: 'Entorse leve no tornozelo', cat: 'art', g: 1, min: 1, max: 3, inf: true, risco: 0.14 },
  concussao: { n: 'Concussão', cat: 'cab', g: 1, min: 1, max: 2, inf: false, risco: 0 },
  posterior: { n: 'Lesão no posterior da coxa', cat: 'mus', g: 2, min: 4, max: 7, inf: true, risco: 0.42 },
  adutor: { n: 'Lesão no adutor', cat: 'mus', g: 2, min: 3, max: 6, inf: true, risco: 0.34 },
  panturrilha: { n: 'Lesão na panturrilha', cat: 'mus', g: 2, min: 3, max: 6, inf: true, risco: 0.34 },
  quadriceps: { n: 'Estiramento no quadríceps', cat: 'mus', g: 2, min: 3, max: 6, inf: true, risco: 0.32 },
  entorse: { n: 'Entorse de tornozelo', cat: 'art', g: 2, min: 2, max: 5, inf: true, risco: 0.26 },
  pubalgia: { n: 'Pubalgia', cat: 'mus', g: 2, min: 4, max: 9, inf: true, risco: 0.3 },
  ombro: { n: 'Luxação no ombro', cat: 'art', g: 2, min: 3, max: 7, inf: true, risco: 0.22 },
  colateral: { n: 'Lesão no colateral do joelho', cat: 'art', g: 2, min: 5, max: 9, inf: true, risco: 0.3 },
  menisco: { n: 'Lesão no menisco', cat: 'art', g: 2, min: 6, max: 12, inf: false, risco: 0 },
  nariz: { n: 'Fratura no nariz', cat: 'oss', g: 2, min: 2, max: 4, inf: false, risco: 0 },
  ligamento: { n: 'Ruptura de ligamento do tornozelo', cat: 'art', g: 3, min: 8, max: 14, inf: false, risco: 0 },
  metatarso: { n: 'Fratura no metatarso', cat: 'oss', g: 3, min: 10, max: 16, inf: false, risco: 0 },
  perna: { n: 'Fratura na perna', cat: 'oss', g: 3, min: 22, max: 32, inf: false, risco: 0 },
  lca: { n: 'Ruptura do ligamento cruzado', cat: 'art', g: 3, min: 32, max: 45, inf: false, risco: 0 },
  aquiles: { n: 'Ruptura do tendão de Aquiles', cat: 'mus', g: 3, min: 30, max: 42, inf: false, risco: 0 },
};
export const CATEGORIA = { mus: 'Muscular', art: 'Articulação/ligamento', oss: 'Óssea', cab: 'Cabeça', con: 'Contusão' };
const POR_GRAU = { 1: [['pancada', 3], ['contusao', 2.5], ['fadiga', 2], ['desconforto', 3], ['entorse1', 2.5], ['concussao', 0.8]], 2: [['posterior', 3.5], ['adutor', 2.2], ['panturrilha', 2.2], ['quadriceps', 1.6], ['entorse', 2.4], ['pubalgia', 1.2], ['ombro', 0.7], ['colateral', 1], ['menisco', 0.8], ['nariz', 0.5]], 3: [['ligamento', 1.6], ['metatarso', 1.4], ['perna', 0.5], ['lca', 1.4], ['aquiles', 0.4]] };
// propensão conhecida a lesões (>1 mais frágil, <1 mais resistente)
const FRAG = { 68290: 2.3, 77100: 1.7, 428791: 1.6, 167850: 1.5, 67920: 1.5, 114937: 1.4, 29241: 1.4, 620477: 1.4, 244275: 1.3, 248410: 1.3, 489893: 1.3, 312294: 1.3, 103381: 1.3, 353108: 1.3, 52896: 1.2, 145707: 1.2, 79960: 1.2, 223560: 1.2, 565009: 1.2, 943837: 1.1, 102017: 1.1, 80562: 0.6, 69400: 0.6, 22415: 0.5, 50144: 0.6, 54590: 0.8, 341705: 0.8, 364972: 0.8, 205041: 0.9 };
export const TREINO_LES = { leve: 0.6, normal: 1, intenso: 1.6 };
export const COMP_NOME = { L: 'campeonato', CB: 'Copa do Brasil', LIB: 'Libertadores', SUL: 'Sul-Americana', SUP: 'Supercopa' };
export const COMP_DE = { L: 'do campeonato', CB: 'da Copa do Brasil', LIB: 'da Libertadores', SUL: 'da Sul-Americana', SUP: 'da Supercopa' };

const garantir = s => { s.dm = s.dm || {}; s.lesH = s.lesH || {}; s.susp = s.susp || {}; s.amar = s.amar || {}; };
const agora = s => s.ano * 100 + s.rodada;

export const fragilidade = (s, j) => !j ? 1 : (FRAG[j.id] || 1) * (1 + Math.max(0, j.idade - 30) * 0.04) * (1 + Math.min(3, s.lesH?.[j.id]?.[0] || 0) * 0.12);

// motivo de não poder jogar (null = liberado)
export function indisponivel(s, id, comp = 'L') {
  const l = s.dm?.[id];
  if (l && !l.inf) return 'lesao';
  if (s.susp?.[id]?.[comp] > 0) return 'suspenso';
  if (s.afast?.[id]?.n > 0) return 'afastado';
  if (naSelecao(s, id)) return 'selecao';
  return null;
}
export const indisponiveis = (s, elenco, comp) => new Set(elenco.filter(j => indisponivel(s, j.id, comp)).map(j => j.id));
export const pendurado = (s, id, comp = 'L') => (s.amar?.[id]?.[comp] || 0) === 2;

function sortearLesao(r, frag, ultima) {
  if (ultima && LESOES[ultima]?.cat === 'mus' && r() < 0.35 * Math.min(2, frag)) return ultima; // reincidência
  const q = r(), p3 = 0.06 * frag, p2 = 0.3 + 0.08 * (frag - 1);
  return pickW(r, POR_GRAU[q < p3 ? 3 : q < p3 + p2 ? 2 : 1], x => x[1])[0];
}

export function infilInfo(s, id) {
  const l = s.dm?.[id]; if (!l) return { ok: false, motivo: 'Não está lesionado.' };
  const L = LESOES[l.k] || { inf: false, risco: 0.25 };
  const risco = clamp((L.risco || 0.25) * (0.55 + l.n / Math.max(1, l.tot)) * (l.frag || 1), 0.04, 0.9);
  if (!L.inf) return { ok: false, bloqueada: true, motivo: 'Esse tipo de lesão não permite infiltração.', risco };
  if (l.inf) return { ok: false, marcada: true, motivo: 'Infiltração marcada para o próximo jogo.', risco };
  if (l.usou) return { ok: false, motivo: 'Já jogou infiltrado nesta lesão. Agora é seguir o tratamento.', risco };
  const ate = Math.max(2, Math.ceil(l.tot * 0.5));
  if (l.n > ate) return { ok: false, motivo: `Ainda cedo: só na reta final da recuperação (faltando até ${ate} jogos).`, risco };
  return { ok: true, risco };
}
export function infiltrar(s, id, sim = true) {
  const l = s.dm?.[id]; if (!l) return;
  if (!sim) { delete l.inf; return; }
  const i = infilInfo(s, id); if (!i.ok) return i.motivo;
  l.inf = true; l.risco = i.risco;
}

// depois de cada jogo: cumpre desfalques, registra lesões e cartões. Devolve notícias do jogo.
export function posJogo(base, s, h, a, sim, comp) {
  garantir(s);
  const N = [], ci = s.tecnico.clube, J = id => base.jog.get(+id), nome = c => base.clubes[c].n;
  const jogou = new Set([...Object.keys(sim.notas[0]), ...Object.keys(sim.notas[1])].map(Number));
  const lesNoJogo = new Set(sim.eventos.filter(e => e.tipo === 'lesao').map(e => e.jogador));
  const meu = c => c === ci, noticia = (c, texto, extra = {}) => N.push({ tipo: meu(c) ? 'clube' : 'lesao', clube: c, texto, ...extra });
  // 1) quem estava fora cumpre um jogo
  for (const c of [h, a]) for (const j of base.elencos[c]) {
    const l = s.dm[j.id];
    if (l && !lesNoJogo.has(j.id)) {
      if (l.inf) {
        if (jogou.has(j.id) && rng(`infil${j.id}${agora(s)}${comp}`)() < (l.risco || 0.25)) {
          const mais = Math.round(l.tot * 0.8) + 2; l.n += mais; l.tot = l.n;
          if (meu(c)) noticia(c, `Infiltração dá errado: ${j.curto} sente de novo e agora fica fora por ${l.n} jogos.`, { jogador: j.id });
        } else if (jogou.has(j.id) && meu(c)) noticia(c, `Deu certo: ${j.curto} jogou infiltrado sem sentir. O tratamento segue.`, { jogador: j.id });
        delete l.inf; delete l.risco; if (jogou.has(j.id)) l.usou = true;
      }
      if (--l.n <= 0) {
        delete s.dm[j.id]; s.lesH[j.id] = [s.lesH[j.id]?.[0] || 1, l.k, agora(s)];
        if (meu(c)) noticia(c, `${j.curto} está recuperado e volta a ficar à disposição.`, { jogador: j.id });
      }
    }
    const af = s.afast?.[j.id];
    if (af && !jogou.has(j.id) && --af.n <= 0) delete s.afast[j.id]; // afastado pelo clube: cumpre em qualquer competição
    const sp = s.susp[j.id];
    if (sp?.[comp] > 0 && !jogou.has(j.id)) { if (!--sp[comp]) delete sp[comp]; if (!Object.keys(sp).length) delete s.susp[j.id]; }
  }
  // 2) lesões deste jogo
  for (const e of sim.eventos) if (e.tipo === 'lesao') {
    const j = J(e.jogador); if (!j) continue;
    const r = rng(`les${j.id}-${agora(s)}-${comp}`), h0 = s.lesH[j.id], frag = fragilidade(s, j);
    const ultima = h0 && agora(s) - h0[2] < 12 ? h0[1] : null;
    const k = sortearLesao(r, frag, ultima), L = LESOES[k], n = L.min + Math.floor(r() * (L.max - L.min + 1));
    s.dm[j.id] = { k, n, tot: n, frag: Math.round(frag * 100) / 100 };
    s.lesH[j.id] = [(h0?.[0] || 0) + 1, k, agora(s)];
    if (meu(j.clube)) noticia(j.clube, `Lesão: ${j.curto} tem ${L.n.toLowerCase()}${ultima === k ? ' (reincidência)' : ''} e desfalca o ${nome(j.clube)} por ${n} jogo${n > 1 ? 's' : ''}.`, { jogador: j.id });
    else if (j.ovr >= 78 && n >= 3) noticia(j.clube, `${nome(j.clube)} perde ${j.curto}: ${L.n.toLowerCase()}, ${n} jogos fora.`, { jogador: j.id });
  }
  // 3) cartões valem só na competição do jogo
  const expulsos = new Set(sim.eventos.filter(e => e.tipo === 'vermelho').map(e => e.jogador));
  for (const e of sim.eventos) {
    const j = J(e.jogador); if (!j || (e.tipo !== 'amarelo' && e.tipo !== 'vermelho')) continue;
    const am = s.amar[j.id] || (s.amar[j.id] = {}), sp = s.susp[j.id] || (s.susp[j.id] = {});
    let txt = null;
    if (e.tipo === 'vermelho') { sp[comp] = e.segundo ? 1 : 2; delete am[comp]; txt = e.segundo ? `${j.curto} foi expulso com o segundo amarelo e cumpre suspensão no próximo jogo` : `${j.curto} levou vermelho direto e está fora dos próximos 2 jogos`; }
    else if (!expulsos.has(j.id) && (am[comp] = (am[comp] || 0) + 1) >= 3) { sp[comp] = 1; delete am[comp]; txt = `${j.curto} levou o terceiro amarelo e cumpre suspensão no próximo jogo`; }
    if (!Object.keys(am).length) delete s.amar[j.id];
    if (!Object.keys(sp).length) delete s.susp[j.id];
    if (txt && meu(j.clube)) noticia(j.clube, `${txt} ${COMP_DE[comp] || ''}.`, { jogador: j.id });
  }
  return N;
}

// virada: cartões zeram; lesão longa continua
export function viradaDM(base, s) {
  s.susp = {}; s.amar = {};
  for (const id in s.dm || {}) { const j = base.jog.get(+id); if (!j || j.fora || !['A', 'B', 'C'].includes(base.clubes[j.clube].div)) delete s.dm[id]; }
}
