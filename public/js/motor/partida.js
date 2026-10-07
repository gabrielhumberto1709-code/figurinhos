// Simulação minuto a minuto. Recebe dois times já escalados e devolve placar, eventos, estatísticas e notas.
import { rng, clamp, pickW, SETOR } from './util.js';

export const FORMACOES = {
  '4-3-3': ['GOL', 'LE', 'ZAG', 'ZAG', 'LD', 'MC', 'VOL', 'MEI', 'PE', 'CA', 'PD'],
  '4-4-2': ['GOL', 'LE', 'ZAG', 'ZAG', 'LD', 'ME', 'VOL', 'MC', 'MD', 'CA', 'SA'],
  '4-2-3-1': ['GOL', 'LE', 'ZAG', 'ZAG', 'LD', 'VOL', 'VOL', 'PE', 'MEI', 'PD', 'CA'],
  '3-5-2': ['GOL', 'ZAG', 'ZAG', 'ZAG', 'LE', 'VOL', 'MC', 'MEI', 'LD', 'CA', 'SA'],
  '5-3-2': ['GOL', 'LE', 'ZAG', 'ZAG', 'ZAG', 'LD', 'MC', 'VOL', 'MC', 'CA', 'SA'],
};
const VIZINHOS = { LD: ['LE', 'ZAG'], LE: ['LD', 'ZAG'], ZAG: ['VOL', 'LD', 'LE'], VOL: ['MC', 'ZAG'], MC: ['VOL', 'MEI'], MEI: ['MC', 'SA', 'ME', 'MD'], ME: ['PE', 'MC', 'LE'], MD: ['PD', 'MC', 'LD'], PE: ['ME', 'PD', 'SA'], PD: ['MD', 'PE', 'SA'], CA: ['SA'], SA: ['CA', 'MEI'] };

export function encaixe(posJogador, slot) {
  if (posJogador === slot) return 1;
  if ((VIZINHOS[slot] || []).includes(posJogador)) return 0.93;
  if (SETOR[posJogador] === SETOR[slot]) return 0.88;
  if (slot === 'GOL' || posJogador === 'GOL') return 0.35;
  return 0.72;
}

// melhor escalação gulosa: preenche cada vaga com quem rende mais nela
export function melhorTime(jogadores, formacao = '4-3-3', indisponiveis = new Set()) {
  const slots = FORMACOES[formacao];
  const livres = jogadores.filter(j => !indisponiveis.has(j.id));
  const usados = new Set(), xi = Array(slots.length).fill(null);
  const ordem = slots.map((s, i) => i).sort((a, b) => (slots[a] === 'GOL' ? -1 : 0) - (slots[b] === 'GOL' ? -1 : 0));
  for (const i of ordem) {
    let best = null, bestV = -1;
    for (const j of livres) { if (usados.has(j.id)) continue; const v = j.ovr * encaixe(j.pos, slots[i]); if (v > bestV) { bestV = v; best = j; } }
    if (best) { xi[i] = best; usados.add(best.id); }
  }
  const banco = livres.filter(j => !usados.has(j.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 9);
  return { formacao, xi, banco };
}

function forca(time) {
  const slots = FORMACOES[time.formacao];
  const acc = { GOL: [], DEF: [], MEI: [], ATA: [] };
  time.xi.forEach((j, i) => {
    const slot = slots[i], s = SETOR[slot];
    if (!j) { acc[s].push(25); return; }
    const f = encaixe(j.pos, slot), a = j.att;
    const v = s === 'GOL' ? j.ovr : s === 'DEF' ? 0.55 * a.def + 0.2 * a.fis + 0.15 * a.vel + 0.1 * a.pas : s === 'MEI' ? 0.45 * a.pas + 0.3 * a.dri + 0.15 * a.fis + 0.1 * a.def : 0.45 * a.fin + 0.25 * a.dri + 0.2 * a.vel + 0.1 * a.fis;
    acc[s].push(v * f);
  });
  const m = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 40;
  const meio = time.xi.map((j, i) => [j, slots[i]]).filter(([j, s]) => j && SETOR[s] === 'MEI').map(([j]) => 0.5 * j.att.pas + 0.5 * j.att.dri);
  return { gol: m(acc.GOL), def: m(acc.DEF), mei: m(acc.MEI), ata: 0.68 * m(acc.ATA) + 0.32 * m(meio.length ? meio : [40]) };
}

export function simular(casa, fora, seed, opts = {}) {
  const r = rng('jogo' + seed);
  const F = [forca(casa), forca(fora)];
  const MANDO = opts.neutro ? 1 : 1.08;
  F[0] = { ...F[0], ata: F[0].ata * MANDO, mei: F[0].mei * MANDO };
  // dia bom/ruim: ninguém joga sempre igual
  for (const f of F) { const d = (r() + r() + r() - 1.5) * 4; f.ata += d; f.def += d * 0.6; f.mei += d * 0.5; }
  const times = [casa, fora];
  const ev = [], gols = [0, 0];
  const st = [0, 1].map(() => ({ posse: 0, chutes: 0, noAlvo: 0, xg: 0, faltas: 0, amarelos: 0, vermelhos: 0, escanteios: 0 }));
  const notas = [new Map(), new Map()];
  const fora11 = [new Set(), new Set()];
  const nota = (t, j, d) => { if (j) notas[t].set(j.id, (notas[t].get(j.id) ?? 6.2) + d); };
  for (const t of [0, 1]) for (const j of times[t].xi) if (j) notas[t].set(j.id, 6.2 + (r() - 0.5) * 0.6);
  const emCampo = t => times[t].xi.filter(j => j && !fora11[t].has(j.id));
  const slotDe = (t, j) => FORMACOES[times[t].formacao][times[t].xi.indexOf(j)];
  for (let min = 1; min <= 90 + Math.floor(r() * 5); min++) {
    const posse0 = clamp(0.5 + (F[0].mei - F[1].mei) / 110, 0.3, 0.7);
    const t = r() < posse0 ? 0 : 1, o = 1 - t;
    st[t].posse++;
    const menos = fora11[t].size - fora11[o].size; // expulsões pesam
    const chance = 0.097 * Math.exp((F[t].ata - F[o].def) / 50) * (1 - 0.12 * menos);
    if (r() < chance) {
      const atacantes = emCampo(t);
      const quem = pickW(r, atacantes, j => { const s = SETOR[slotDe(t, j)]; return (s === 'ATA' ? 5 : s === 'MEI' ? 2.2 : s === 'DEF' ? 0.5 : 0) * (j.att.fin / 60) ** 2; });
      const xg = clamp(0.05 + r() * 0.32 * Math.exp((F[t].ata - F[o].def) / 60), 0.03, 0.75);
      st[t].chutes++; st[t].xg += xg;
      const golProb = xg * clamp(1 + (quem.att.fin - F[o].gol) / 90, 0.6, 1.5);
      const noAlvo = r() < 0.38 + xg * 0.6;
      if (noAlvo) st[t].noAlvo++;
      if (noAlvo && r() < golProb / (0.38 + xg * 0.6)) {
        gols[t]++;
        const garcom = r() < 0.72 ? pickW(r, atacantes.filter(j => j !== quem), j => j.att.pas ** 2) : null;
        ev.push({ min, tipo: 'gol', time: t, jogador: quem.id, assist: garcom && garcom.id, placar: gols.slice() });
        nota(t, quem, 1.1); nota(t, garcom, 0.6);
        for (const j of emCampo(o)) { const s = SETOR[slotDe(o, j)]; if (s === 'GOL') nota(o, j, -0.45); else if (s === 'DEF') nota(o, j, -0.2); }
      } else {
        ev.push({ min, tipo: noAlvo ? 'defesa' : 'fora', time: t, jogador: quem.id });
        if (noAlvo) { const gk = emCampo(o).find(j => slotDe(o, j) === 'GOL'); nota(o, gk, 0.18); }
        if (r() < 0.35) st[t].escanteios++;
      }
    }
    // faltas e cartões
    if (r() < 0.16) {
      const f = 1 - t; st[f].faltas++;
      const autor = pickW(r, emCampo(f), j => SETOR[slotDe(f, j)] === 'GOL' ? 0.05 : (100 - j.att.def + 40) / 100);
      if (r() < 0.13) {
        const jaTem = ev.some(e => e.tipo === 'amarelo' && e.jogador === autor.id);
        if (jaTem || r() < 0.025) {
          st[f].vermelhos++; fora11[f].add(autor.id);
          ev.push({ min, tipo: 'vermelho', time: f, jogador: autor.id, segundo: jaTem });
          nota(f, autor, -1.6);
          F[f] = { ...F[f], ata: F[f].ata * 0.93, mei: F[f].mei * 0.93, def: F[f].def * 0.95 };
        } else { st[f].amarelos++; ev.push({ min, tipo: 'amarelo', time: f, jogador: autor.id }); nota(f, autor, -0.3); }
      }
    }
  }
  // fechamento das notas
  const res = gols[0] > gols[1] ? [0.35, -0.35] : gols[0] < gols[1] ? [-0.35, 0.35] : [0, 0];
  for (const t of [0, 1]) for (const j of times[t].xi) {
    if (!j) continue;
    const s = SETOR[slotDe(t, j)];
    let d = res[t];
    if (gols[1 - t] === 0 && (s === 'DEF' || s === 'GOL')) d += 0.5;
    nota(t, j, d);
    notas[t].set(j.id, Math.round(clamp(notas[t].get(j.id), 3, 10) * 10) / 10);
  }
  const totalPosse = st[0].posse + st[1].posse;
  st[0].posse = Math.round(100 * st[0].posse / totalPosse); st[1].posse = 100 - st[0].posse;
  for (const s of st) s.xg = Math.round(s.xg * 100) / 100;
  let craque = null, melhor = -1;
  for (const t of [0, 1]) for (const [id, n] of notas[t]) if (n > melhor) { melhor = n; craque = id; }
  return { gols, eventos: ev, stats: st, notas: notas.map(m => Object.fromEntries(m)), craque };
}
