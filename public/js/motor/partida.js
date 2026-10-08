// Partida minuto a minuto. criarPartida/passo permitem jogar ao vivo (com narração e substituições);
// simular roda tudo de uma vez para os jogos da IA.
import { rng, clamp, pickW, SETOR } from './util.js';

// posição de cada vaga no campo vertical (x = lateral, 0 esquerda; y = profundidade, 90 = goleiro)
export const POSICOES = {
  '4-3-3': [['GOL', 50, 90], ['LE', 14, 68], ['ZAG', 37, 74], ['ZAG', 63, 74], ['LD', 86, 68], ['MC', 26, 48], ['VOL', 50, 56], ['MEI', 74, 48], ['PE', 18, 22], ['CA', 50, 15], ['PD', 82, 22]],
  '4-4-2': [['GOL', 50, 90], ['LE', 14, 68], ['ZAG', 37, 74], ['ZAG', 63, 74], ['LD', 86, 68], ['ME', 14, 44], ['VOL', 38, 52], ['MC', 62, 52], ['MD', 86, 44], ['CA', 36, 18], ['SA', 64, 20]],
  '4-4-1-1': [['GOL', 50, 90], ['LE', 14, 68], ['ZAG', 37, 74], ['ZAG', 63, 74], ['LD', 86, 68], ['ME', 14, 46], ['VOL', 38, 54], ['MC', 62, 54], ['MD', 86, 46], ['SA', 50, 32], ['CA', 50, 15]],
  '4-2-3-1': [['GOL', 50, 90], ['LE', 14, 68], ['ZAG', 37, 74], ['ZAG', 63, 74], ['LD', 86, 68], ['VOL', 36, 56], ['VOL', 64, 56], ['PE', 16, 32], ['MEI', 50, 36], ['PD', 84, 32], ['CA', 50, 14]],
  '4-1-4-1': [['GOL', 50, 90], ['LE', 14, 68], ['ZAG', 37, 74], ['ZAG', 63, 74], ['LD', 86, 68], ['VOL', 50, 60], ['ME', 14, 40], ['MC', 38, 44], ['MC', 62, 44], ['MD', 86, 40], ['CA', 50, 15]],
  '4-3-1-2': [['GOL', 50, 90], ['LE', 14, 68], ['ZAG', 37, 74], ['ZAG', 63, 74], ['LD', 86, 68], ['MC', 26, 52], ['VOL', 50, 58], ['MC', 74, 52], ['MEI', 50, 36], ['CA', 36, 16], ['SA', 64, 18]],
  '4-5-1': [['GOL', 50, 90], ['LE', 14, 68], ['ZAG', 37, 74], ['ZAG', 63, 74], ['LD', 86, 68], ['ME', 12, 42], ['MC', 32, 48], ['VOL', 50, 56], ['MC', 68, 48], ['MD', 88, 42], ['CA', 50, 16]],
  '3-5-2': [['GOL', 50, 90], ['ZAG', 26, 74], ['ZAG', 50, 76], ['ZAG', 74, 74], ['LE', 10, 46], ['VOL', 36, 56], ['MC', 64, 56], ['MEI', 50, 36], ['LD', 90, 46], ['CA', 36, 17], ['SA', 64, 19]],
  '3-4-3': [['GOL', 50, 90], ['ZAG', 26, 74], ['ZAG', 50, 76], ['ZAG', 74, 74], ['LE', 12, 48], ['VOL', 38, 54], ['MC', 62, 54], ['LD', 88, 48], ['PE', 18, 22], ['CA', 50, 15], ['PD', 82, 22]],
  '5-3-2': [['GOL', 50, 90], ['LE', 9, 62], ['ZAG', 29, 74], ['ZAG', 50, 77], ['ZAG', 71, 74], ['LD', 91, 62], ['MC', 26, 46], ['VOL', 50, 52], ['MC', 74, 46], ['CA', 36, 18], ['SA', 64, 20]],
};
export const FORMACOES = Object.fromEntries(Object.entries(POSICOES).map(([f, v]) => [f, v.map(x => x[0])]));
// faixa lateral de cada vaga (0 = esquerda do time, 100 = direita), para a bola andar pelo lado certo
export const COORD_Y = Object.fromEntries(Object.entries(POSICOES).map(([f, v]) => [f, v.map(x => x[1])]));
// formação personalizada: cada vaga pode mudar de posição e anda para o lugar típico dela no campo
export const PERS = 'Personalizada';
const PROF_POS = { GOL: 90, ZAG: 74, LE: 66, LD: 66, VOL: 56, MC: 48, ME: 44, MD: 44, MEI: 36, PE: 24, PD: 24, SA: 22, CA: 15 };
export function usarFormacao(slots) { POSICOES[PERS] = slots; FORMACOES[PERS] = slots.map(x => x[0]); COORD_Y[PERS] = slots.map(x => x[1]); }
export function vagaPara([antiga, x, y0], pos, outras = []) {
  const x0 = x;
  const esq = ['LE', 'ME', 'PE'], dir = ['LD', 'MD', 'PD'];
  if (esq.includes(pos)) x = Math.min(x, 16); else if (dir.includes(pos)) x = Math.max(x, 84);
  else if (esq.includes(antiga)) x = 32; else if (dir.includes(antiga)) x = 68;
  // não deixa duas vagas uma em cima da outra: tenta mais recuado, mais por dentro ou mais à frente
  const y = PROF_POS[pos], dx = x < 50 ? 14 : -14, livre = ([a, b]) => outras.every(o => Math.hypot(o[1] - a, o[2] - b) >= 16);
  const [nx, ny] = [[x, y], [x, y + 12], [x + dx, y], [x, y - 10], [x + dx, y + 12], [x + 2 * dx, y], [x0, y0]].find(livre) || [x0, y0];
  return [pos, nx, ny];
}

// estilos de jogo: bônus de ataque/meio/defesa, multiplicadores de chances a favor/contra, cansaço, faltas, posse e qualidade do chute
export const ESTILOS = {
  equilibrado: { nome: 'Equilibrado', att: 0, mid: 0, def: 0, xgF: 1, xgA: 1, fad: 1, faltas: 1, posse: 0, q: 1, desc: 'Nada de exagero: o time joga como o elenco permite.' },
  gegenpress: { nome: 'Gegenpress', att: 2, mid: 2, def: 0, xgF: 1.12, xgA: 1.05, fad: 1.35, faltas: 1.3, posse: 4, q: 1, desc: 'Perdeu, pressionou. Mais chances e mais faltas, mas cansa muito.' },
  tikitaka: { nome: 'Tiki-taka', att: 0, mid: 'meio', def: 1, xgF: 1, xgA: 0.9, fad: 0.95, faltas: 0.85, posse: 12, q: 1.25, desc: 'Posse e passes curtos. Menos finalizações, mais qualidade. Depende do meio-campo.' },
  contra: { nome: 'Contra-ataque', att: 2, mid: -2, def: 2, xgF: 0.95, xgA: 0.94, fad: 1, faltas: 1, posse: -10, q: 1.15, desc: 'Fecha e sai rápido. Rende mais quando o time tem menos a bola.' },
  direto: { nome: 'Jogo direto', att: 'ataque', mid: -2, def: 0, xgF: 1.05, xgA: 1.02, fad: 1.05, faltas: 1.05, posse: -6, q: 0.9, desc: 'Bola longa para o ataque. Bom quando o ataque é melhor que o meio.' },
  pressao: { nome: 'Pressão total', att: 4, mid: 0, def: -4, xgF: 1.4, xgA: 1.35, fad: 1.3, faltas: 1.15, posse: 8, q: 0.95, desc: 'Todo mundo pra frente. Muitas chances dos dois lados.' },
  pontas: { nome: 'Jogo pelas pontas', att: 'pontas', mid: 0, def: 0, xgF: 1.05, xgA: 1.02, fad: 1.1, faltas: 1, posse: 2, q: 0.95, desc: 'Abre o campo e cruza. Rende com pontas e laterais bons.' },
  retranca: { nome: 'Estacionar o ônibus', att: -5, mid: 0, def: 5, xgF: 0.6, xgA: 0.66, fad: 0.9, faltas: 1.1, posse: -16, q: 0.9, desc: 'Todo mundo atrás da linha da bola. Segura resultado, quase não cria.' },
};

const VIZINHOS = { LD: ['LE', 'ZAG'], LE: ['LD', 'ZAG'], ZAG: ['VOL', 'LD', 'LE'], VOL: ['MC', 'ZAG'], MC: ['VOL', 'MEI'], MEI: ['MC', 'SA', 'ME', 'MD'], ME: ['PE', 'MC', 'LE'], MD: ['PD', 'MC', 'LD'], PE: ['ME', 'PD', 'SA'], PD: ['MD', 'PE', 'SA'], CA: ['SA'], SA: ['CA', 'MEI'] };

export function encaixe(posJogador, slot) {
  if (posJogador === slot) return 1;
  if ((VIZINHOS[slot] || []).includes(posJogador)) return 0.93;
  if (SETOR[posJogador] === SETOR[slot]) return 0.88;
  if (slot === 'GOL' || posJogador === 'GOL') return 0.35;
  return 0.72;
}

// condição física (0-100) pesa no rendimento; moral (0-100) dá ±5%
export const fatorCond = c => 1 - 0.35 * ((100 - (c ?? 100)) / 100) ** 1.5;
export const fatorMoral = m => 0.95 + 0.1 * (m ?? 62) / 100;

// melhor escalação: cada vaga com quem rende mais nela (cansado rende menos e vira reserva)
export function melhorTime(jogadores, formacao = '4-3-3', indisponiveis = new Set(), cond = {}, fase = () => 0) {
  const slots = FORMACOES[formacao];
  const livres = jogadores.filter(j => !indisponiveis.has(j.id));
  const usados = new Set(), xi = Array(slots.length).fill(null);
  const peso = j => { const c = cond[j.id] ?? 100; return fatorCond(c) ** 1.6 * (c < 60 ? 0.93 : 1); };
  // ponytail: guloso pelos melhores pares (jogador, vaga); Hungarian só se aparecer escalação absurda
  const pares = [];
  slots.forEach((sl, i) => { for (const j of livres) pares.push([(j.ovr + fase(j.id)) * encaixe(j.pos, sl) * peso(j), i, j]); });
  pares.sort((a, b) => b[0] - a[0]);
  for (const [, i, j] of pares) if (!xi[i] && !usados.has(j.id)) { xi[i] = j; usados.add(j.id); }
  return { formacao, xi, banco: bancoAuto(livres.filter(j => !usados.has(j.id)), cond) };
}
// banco automático: 8 de linha mais o melhor goleiro reserva
export function bancoAuto(resto, cond = {}) {
  const v = j => j.ovr * fatorCond(cond[j.id]);
  const gol = resto.filter(j => j.pos === 'GOL').sort((a, b) => v(b) - v(a))[0];
  const linha = resto.filter(j => j.pos !== 'GOL').sort((a, b) => v(b) - v(a)).slice(0, gol ? 8 : 9);
  return gol ? [...linha, gol] : linha;
}

const PONTAS = new Set(['PE', 'PD', 'ME', 'MD', 'LE', 'LD']);
function forca(P, t) {
  const time = P.times[t], slots = FORMACOES[time.formacao];
  const acc = { GOL: [], DEF: [], MEI: [], ATA: [] }, meio = [], largo = [], outros = [];
  time.xi.forEach((j, i) => {
    const slot = slots[i], s = SETOR[slot];
    if (!j) { acc[s].push(25); return; }
    const f = encaixe(j.pos, slot) * fatorCond(P.cond[j.id]) * fatorMoral(P.mor[j.id]) * (1 + (P.fase?.(j.id) || 0) * 0.013), a = j.att; // fase: +3 rende ~4% a mais
    const v = s === 'GOL' ? j.ovr : s === 'DEF' ? 0.55 * a.def + 0.2 * a.fis + 0.15 * a.vel + 0.1 * a.pas : s === 'MEI' ? 0.45 * a.pas + 0.3 * a.dri + 0.15 * a.fis + 0.1 * a.def : 0.45 * a.fin + 0.25 * a.dri + 0.2 * a.vel + 0.1 * a.fis;
    acc[s].push(v * f);
    if (s === 'MEI') meio.push((0.5 * a.pas + 0.5 * a.dri) * f);
    if (s !== 'GOL') (PONTAS.has(slot) ? largo : outros).push(j.ovr * f);
  });
  const m = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 40;
  return { gol: m(acc.GOL), def: m(acc.DEF), mei: m(acc.MEI), ata: 0.68 * m(acc.ATA) + 0.32 * m(meio.length ? meio : [40]), ataPuro: m(acc.ATA), largo: m(largo), outros: m(outros) };
}
// força por setor para mostrar na tela (sem fator casa e sem sorteio)
export function forcaSetores(time, cond = {}, mor = {}) {
  const f = forca({ times: [time], cond, mor }, 0);
  return { ataque: Math.round(f.ataPuro), meio: Math.round(f.mei), defesa: Math.round(f.def), goleiro: Math.round(f.gol) };
}

// ---------- narração (só no jogo assistido; usa sorteio próprio para não mudar o resultado) ----------
const NOME = j => j.curto;
function narrador(P) {
  const rn = P.rn, L = [];
  const lado = (t, prog) => t === 0 ? prog * 100 : 100 - prog * 100;
  const quemNaFaixa = (t, prog) => pickW(rn, P.emCampo(t).filter(j => P.slotDe(t, j) !== 'GOL'), j => { const s = SETOR[P.slotDe(t, j)]; return prog < 0.35 ? (s === 'DEF' ? 3 : s === 'MEI' ? 2 : 0.5) : prog < 0.65 ? (s === 'MEI' ? 3 : 1.2) : (s === 'ATA' ? 3 : s === 'MEI' ? 2 : 0.6); });
  const yDe = (t, j) => { const i = P.times[t].xi.indexOf(j), c = COORD_Y[P.times[t].formacao]?.[i] ?? 50; return clamp((t === 0 ? c : 100 - c) + (rn() - 0.5) * 18, 6, 94); };
  const add = (t, txt, prog, j, tipo = 'passe', extra = {}) => { const b = P.bola = { t, x: lado(t, prog), y: j ? yDe(t, j) : 50, j: j?.id ?? null }; L.push({ min: P.min, t, txt, tipo, x: b.x, y: b.y, j: b.j, ...extra }); };
  return {
    L,
    // troca de passes que leva a bola até onde o lance acontece
    jogada(t, ate, nPasses) {
      let prog = P.bola && P.bola.t === t ? (t === 0 ? P.bola.x : 100 - P.bola.x) / 100 : 0.25 + rn() * 0.2;
      let atual = quemNaFaixa(t, prog);
      if (!P.bola || P.bola.t !== t) add(t, pickTxt(rn, [`${NOME(atual)} recupera a bola`, `${NOME(atual)} sai jogando`, `${NOME(atual)} domina`]), prog, atual);
      for (let k = 0; k < nPasses; k++) {
        prog = clamp(prog + (ate - prog) / (nPasses - k) + (rn() - 0.4) * 0.08, 0.05, 0.95);
        const prox = quemNaFaixa(t, prog);
        if (prox === atual) continue;
        add(t, pickTxt(rn, prog - 0.05 > ate ? [`${NOME(atual)} recua para ${NOME(prox)}`] : [`${NOME(atual)} toca para ${NOME(prox)}`, `${NOME(atual)} toca para ${NOME(prox)}`, `${NOME(atual)} lança ${NOME(prox)}`, `${NOME(atual)} acha ${NOME(prox)}`]), prog, prox);
        atual = prox;
      }
      return atual;
    },
    lance(t, txt, prog, j, tipo, extra) { add(t, txt, prog, j, tipo, extra); },
  };
}
const pickTxt = (r, a) => a[Math.floor(r() * a.length)];
// ---------- partida passo a passo ----------
const GATILHO_TXT = { vencendo2: 'vencendo por 2', perdendo60: 'perdendo depois dos 60', empatando75: 'empatando depois dos 75' };
export function criarPartida(casa, fora, seed, opts = {}) {
  const copia = t => ({ formacao: t.formacao, xi: t.xi.slice(), banco: (t.banco || []).slice(), estilo: t.estilo || 'equilibrado', gatilhos: t.gatilhos || {}, cobrador: t.cobrador ?? null });
  const P = {
    times: [copia(casa), copia(fora)], min: 0, fim: 90, gols: [0, 0], ev: [], lances: [],
    st: [0, 1].map(() => ({ posse: 0, chutes: 0, noAlvo: 0, xg: 0, faltas: 0, amarelos: 0, vermelhos: 0, escanteios: 0, defesas: 0 })),
    notas: [new Map(), new Map()], expulsos: [new Set(), new Set()], entrada: {}, subs: [0, 0], verm: [0, 0], disparou: [{}, {}],
    cond: { ...(opts.cond || {}) }, mor: opts.mor || {}, auto: opts.auto || [true, true],
    r: rng('jogo' + seed), rn: rng('narra' + seed), ri: rng('ia' + seed), rl: rng('les' + seed), fragil: opts.fragil || (() => 1), fase: opts.fase || null,
    mando: opts.neutro ? 1 : (opts.mando ?? 1.08), narrar: !!opts.narrar, humano: opts.humano ?? -1, bola: null,
    arbitro: opts.arbitro || null, rigor: opts.arbitro ? 0.7 + (opts.arbitro.rigor - 1) * 0.15 : 1, rv: rng('var' + seed),
  };
  P.fim = 90 + Math.floor(P.r() * 5);
  P.emCampo = t => P.times[t].xi.filter(j => j && !P.expulsos[t].has(j.id));
  P.slotDe = (t, j) => FORMACOES[P.times[t].formacao][P.times[t].xi.indexOf(j)];
  for (const t of [0, 1]) for (const j of P.times[t].xi) if (j) { P.notas[t].set(j.id, 6.2 + (P.r() - 0.5) * 0.6); P.cond[j.id] = P.cond[j.id] ?? 100; }
  // dia bom/ruim: ninguém joga sempre igual
  P.dia = [0, 1].map(() => (P.r() + P.r() + P.r() - 1.5) * 4);
  recalcular(P);
  return P;
}

function recalcular(P) {
  const f = [forca(P, 0), forca(P, 1)];
  P.F = [0, 1].map(t => {
    const st = ESTILOS[P.times[t].estilo] || ESTILOS.equilibrado, x = f[t], d = P.dia?.[t] || 0, v = P.verm[t], m = t === 0 ? P.mando : 1;
    const mid = st.mid === 'meio' ? clamp(4 * (x.mei - 66) / 8, -3, 6) : st.mid;
    const att = st.att === 'ataque' ? (x.ataPuro >= x.mei ? 2.5 : -1) : st.att === 'pontas' ? clamp((x.largo - x.outros) / 3 + 1.5, -2, 4.5) : st.att;
    return { st, gol: x.gol, def: (x.def + d * 0.6 + st.def) * 0.95 ** v, mei: (x.mei * m + d * 0.5 + mid) * 0.93 ** v, ata: (x.ata * m + d + att) * 0.93 ** v };
  });
}

const nota = (P, t, j, d) => { if (j) P.notas[t].set(j.id, (P.notas[t].get(j.id) ?? 6.2) + d); };

export const acabou = P => P.min >= P.fim;

export function trocarEstilo(P, t, estilo) { P.times[t].estilo = estilo; recalcular(P); }

// planos automáticos: cada um dispara uma vez por jogo
function gatilhos(P, t) {
  const g = P.times[t].gatilhos, dif = P.gols[t] - P.gols[1 - t], ja = P.disparou[t];
  const quando = { vencendo2: dif >= 2, perdendo60: P.min >= 60 && dif < 0, empatando75: P.min >= 75 && dif === 0 };
  for (const k of ['vencendo2', 'perdendo60', 'empatando75']) {
    const plano = g[k];
    if (!plano || ja[k] || !quando[k]) continue;
    ja[k] = true;
    if (plano.formacao && plano.formacao !== P.times[t].formacao) trocarEsquema(P, t, plano.formacao);
    if (plano.estilo) trocarEstilo(P, t, plano.estilo);
    if (P.narrar) P.lances.push({ min: P.min, t, tipo: 'tatica', txt: `Plano B (${GATILHO_TXT[k]}): ${ESTILOS[plano.estilo]?.nome || 'mesmo estilo'}${plano.formacao ? ` no ${plano.formacao}` : ''}`, x: P.bola?.x ?? 50, y: P.bola?.y ?? 50, j: null });
  }
}

// avança um minuto; devolve os lances narrados desse minuto (vazio se não estiver narrando)
export function passo(P) {
  if (acabou(P)) return [];
  P.min++;
  const inicio = P.lances.length;
  const min = P.min, N = P.narrar ? narrador(P) : null;
  // cansaço: cada minuto em campo gasta condição (mais nos estilos intensos e nos veteranos)
  for (const t of [0, 1]) { const fad = (ESTILOS[P.times[t].estilo] || ESTILOS.equilibrado).fad; for (const j of P.emCampo(t)) P.cond[j.id] = Math.max(0, P.cond[j.id] - 0.3 * fad * (j.idade >= 31 ? 1.15 : j.idade <= 21 ? 0.9 : 1)); }
  // lesões: raras, mais em quem está esgotado e nos frágeis (sorteio próprio para não mexer no resto do jogo)
  for (const t of [0, 1]) for (const j of P.emCampo(t)) if (P.rl() < (0.00015 + Math.max(0, 55 - P.cond[j.id]) * 0.00002) * P.fragil(j.id)) lesao(P, t, j);
  if (min % 5 === 0) recalcular(P);
  gatilhos(P, 0); gatilhos(P, 1);
  if (P.auto[0]) substituicaoIA(P, 0);
  if (P.auto[1]) substituicaoIA(P, 1);
  const { r, F } = P;
  // o estilo muda quanto o time fica com a bola, mas não quantas chances ele cria (isso vem do ataque/defesa e do xG)
  const base0 = clamp(0.5 + (F[0].mei - F[1].mei) / 110, 0.3, 0.7);
  const posse0 = clamp(base0 + (F[0].st.posse - F[1].st.posse) / 100, 0.24, 0.76);
  const t = r() < posse0 ? 0 : 1, o = 1 - t;
  P.st[t].posse++;
  const menos = P.expulsos[t].size - P.expulsos[o].size;
  const compensa = t === 0 ? base0 / posse0 : (1 - base0) / (1 - posse0);
  const chance = 0.084 * compensa * Math.exp((F[t].ata - F[o].def) / 50) * (1 - 0.12 * menos) * F[t].st.xgF * F[o].st.xgA / F[t].st.q;
  const gk = () => P.emCampo(o).find(j => P.slotDe(o, j) === 'GOL');
  if (r() < 0.003 * (0.85 + 0.15 * P.rigor)) penalti(P, t, o, N);
  else if (r() < chance) {
    const atacantes = P.emCampo(t);
    const quem = pickW(r, atacantes, j => { const s = SETOR[P.slotDe(t, j)]; return (s === 'ATA' ? 5 : s === 'MEI' ? 2.2 : s === 'DEF' ? 0.5 : 0) * (j.att.fin / 60) ** 2; });
    const possePropria = P.st[t].posse / Math.max(1, P.st[0].posse + P.st[1].posse);
    const xg = clamp((0.05 + r() * 0.32 * Math.exp((F[t].ata - F[o].def) / 60)) * F[t].st.q * (P.times[t].estilo === 'contra' && possePropria < 0.45 ? 1.12 : 1), 0.03, 0.8);
    P.st[t].chutes++; P.st[t].xg += xg;
    const golProb = xg * clamp(1 + (quem.att.fin - F[o].gol) / 90, 0.6, 1.5);
    const noAlvo = r() < 0.38 + xg * 0.6;
    if (noAlvo) P.st[t].noAlvo++;
    const goleiro = gk();
    if (N) { const ult = N.jogada(t, 0.62 + P.rn() * 0.2, 2 + Math.floor(P.rn() * 3)); if (ult !== quem) N.lance(t, pickTxt(P.rn, [`${NOME(ult)} serve ${NOME(quem)} na área`, `${NOME(ult)} cruza para ${NOME(quem)}`, `${NOME(ult)} enfia para ${NOME(quem)}`]), 0.84, quem); }
    if (noAlvo && r() < golProb / (0.38 + xg * 0.6) && P.rv() < 0.05) {
      // VAR: a bola entrou, mas o gol não vale
      const motivo = pickTxt(P.rv, ['impedimento', 'falta no início da jogada', 'toque de mão']);
      P.ev.push({ min, tipo: 'var', time: t, jogador: quem.id, anulado: true, motivo });
      if (N) { N.lance(t, `${NOME(quem)} manda pra rede...`, 1, quem, 'golAnulado'); N.lance(t, `VAR chama o árbitro: gol anulado por ${motivo}`, 0.5, null, 'var'); }
      P.bola = null;
    } else if (noAlvo && r() < golProb / (0.38 + xg * 0.6)) {
      P.gols[t]++;
      const garcom = r() < 0.72 ? pickW(r, atacantes.filter(j => j !== quem && P.slotDe(t, j) !== 'GOL'), j => j.att.pas ** 2) : null;
      P.ev.push({ min, tipo: 'gol', time: t, jogador: quem.id, assist: garcom && garcom.id, placar: P.gols.slice() });
      nota(P, t, quem, 1.1); nota(P, t, garcom, 0.6);
      for (const j of P.emCampo(o)) { const s = SETOR[P.slotDe(o, j)]; if (s === 'GOL') nota(P, o, j, -0.45); else if (s === 'DEF') nota(P, o, j, -0.2); }
      if (N) N.lance(t, `GOL! ${NOME(quem)} marca${garcom ? `, passe de ${NOME(garcom)}` : ''}!`, 1, quem, 'gol', { placar: P.gols.slice() });
      P.bola = null;
    } else {
      P.ev.push({ min, tipo: noAlvo ? 'defesa' : 'fora', time: t, jogador: quem.id, goleiro: noAlvo && goleiro ? goleiro.id : undefined });
      if (noAlvo) { nota(P, o, goleiro, 0.18); P.st[o].defesas++; }
      const esc = r() < 0.35;
      if (esc) P.st[t].escanteios++;
      if (N) {
        N.lance(t, noAlvo ? `${NOME(quem)} finaliza e ${goleiro ? NOME(goleiro) : 'o goleiro'} defende!` : pickTxt(P.rn, [`${NOME(quem)} finaliza para fora`, `${NOME(quem)} chuta por cima`, `${NOME(quem)} tenta e a bola passa raspando`]), noAlvo ? 0.97 : 0.99, quem, noAlvo ? 'defesa' : 'fora');
        if (esc) N.lance(t, `Escanteio para o ${t === 0 ? 'mandante' : 'visitante'}`, 0.98, null, 'escanteio');
      }
    }
  } else if (N && P.rn() < 0.85) {
    N.jogada(t, 0.3 + P.rn() * 0.4, 1 + Math.floor(P.rn() * 3));
    if (P.rn() < 0.06) { const j = pickW(P.rn, P.emCampo(t).filter(x => SETOR[P.slotDe(t, x)] === 'ATA'), () => 1); if (j) N.lance(t, `${NOME(j)} em impedimento`, 0.75, j, 'impedimento'); }
  }
  // faltas e cartões (quem defende faz a falta; estilos intensos fazem mais)
  if (r() < 0.16 * F[o].st.faltas) {
    const f = o; P.st[f].faltas++;
    const autor = pickW(r, P.emCampo(f), j => P.slotDe(f, j) === 'GOL' ? 0.05 : (100 - j.att.def + 40) / 100);
    const cartao = r() < 0.13 * P.rigor;
    if (N) N.lance(f, `Falta de ${NOME(autor)}`, 0.5 + (P.rn() - 0.5) * 0.4, autor, 'falta');
    if (cartao) {
      const jaTem = P.ev.some(e => e.tipo === 'amarelo' && e.jogador === autor.id);
      const direto = !jaTem && r() < 0.025 * P.rigor, revisto = direto && P.rv() < 0.15; // VAR transforma vermelho em amarelo
      if (revisto && N) N.lance(f, `VAR revisa a entrada de ${NOME(autor)}: o vermelho vira amarelo`, 0.5, autor, 'var');
      if (jaTem || (direto && !revisto)) {
        P.st[f].vermelhos++; P.expulsos[f].add(autor.id); P.verm[f]++;
        P.ev.push({ min, tipo: 'vermelho', time: f, jogador: autor.id, segundo: jaTem });
        nota(P, f, autor, -1.6);
        recalcular(P);
        if (N) N.lance(f, `Vermelho! ${NOME(autor)} ${jaTem ? 'leva o segundo amarelo e ' : ''}está expulso`, 0.5, autor, 'vermelho');
      } else {
        P.st[f].amarelos++; P.ev.push({ min, tipo: 'amarelo', time: f, jogador: autor.id }); nota(P, f, autor, -0.3);
        if (N) N.lance(f, `Amarelo para ${NOME(autor)}`, 0.5, autor, 'amarelo');
      }
    }
  }
  if (N && min === 45) N.lance(t, 'Fim do primeiro tempo', 0.5, null, 'intervalo');
  if (N && acabou(P)) N.lance(t, 'Fim de jogo!', 0.5, null, 'fim');
  if (N) P.lances.push(...N.L);
  return P.lances.slice(inicio);
}

// lesionado sai na hora (entra o melhor do banco para a vaga); sem troca, o time fica com um a menos
function lesao(P, t, j) {
  P.ev.push({ min: P.min, tipo: 'lesao', time: t, jogador: j.id });
  if (P.narrar) P.lances.push({ min: P.min, t, tipo: 'lesao', txt: `${NOME(j)} sente a lesão e não tem condições de seguir`, x: P.bola?.x ?? 50, y: P.bola?.y ?? 50, j: j.id });
  const entra = P.subs[t] < 5 && melhorDoBanco(P, t, P.slotDe(t, j));
  if (entra) substituir(P, t, j.id, entra.id);
  else { P.expulsos[t].add(j.id); P.verm[t]++; recalcular(P); }
}
const melhorDoBanco = (P, t, slot) => P.times[t].banco.filter(j => (slot === 'GOL') === (j.pos === 'GOL')).reduce((m, j) => { const v = j.ovr * encaixe(j.pos, slot) * ((P.cond[j.id] ?? 100) >= 70 ? 1 : 0.9); return !m || v > m.v ? { j, v } : m; }, null)?.j
  || P.times[t].banco.reduce((m, j) => !m || j.ovr * encaixe(j.pos, slot) > m.ovr * encaixe(m.pos, slot) ? j : m, null);

// pênalti: 76% gol, 14% defesa, 10% para fora; bate o cobrador escolhido se estiver em campo
function penalti(P, t, o, N) {
  const { r } = P, campo = P.emCampo(t).filter(j => P.slotDe(t, j) !== 'GOL');
  const escolhido = campo.find(j => j.id === P.times[t].cobrador);
  const quem = escolhido || campo.reduce((m, j) => (!m || j.att.fin > m.att.fin ? j : m), null);
  const defensores = P.emCampo(o).filter(j => SETOR[P.slotDe(o, j)] === 'DEF');
  const autor = defensores.length ? defensores[Math.floor(r() * defensores.length)] : P.emCampo(o)[0];
  const goleiro = P.emCampo(o).find(j => P.slotDe(o, j) === 'GOL');
  if (P.rv() < 0.06) { // VAR desmarca
    P.ev.push({ min: P.min, tipo: 'var', time: t, jogador: autor.id, penaltiDesmarcado: true });
    if (N) { N.lance(o, `Pênalti! ${NOME(autor)} derruba na área`, 0.12, autor, 'falta'); N.lance(t, 'VAR chama o árbitro: pênalti desmarcado', 0.5, null, 'var'); }
    return;
  }
  nota(P, o, autor, -0.5); P.st[o].faltas++;
  P.st[t].chutes++; P.st[t].xg += 0.76;
  const x = r(), min = P.min;
  if (N) { N.lance(o, `Pênalti! ${NOME(autor)} derruba na área`, 0.12, autor, 'falta'); }
  if (x < 0.76) {
    P.st[t].noAlvo++; P.gols[t]++;
    P.ev.push({ min, tipo: 'gol', time: t, jogador: quem.id, assist: null, penalti: true, placar: P.gols.slice() });
    nota(P, t, quem, 0.9);
    if (N) N.lance(t, `GOL! ${NOME(quem)} converte o pênalti!`, 1, quem, 'gol', { placar: P.gols.slice() });
    P.bola = null;
  } else {
    const defendeu = x < 0.9;
    if (defendeu) { P.st[t].noAlvo++; P.st[o].defesas++; nota(P, o, goleiro, 0.8); }
    P.ev.push({ min, tipo: defendeu ? 'defesa' : 'fora', time: t, jogador: quem.id, penalti: true, goleiro: defendeu && goleiro ? goleiro.id : undefined });
    nota(P, t, quem, -0.6);
    if (N) N.lance(t, defendeu ? `${goleiro ? NOME(goleiro) : 'O goleiro'} pega o pênalti de ${NOME(quem)}!` : `${NOME(quem)} isola o pênalti!`, 0.97, quem, defendeu ? 'defesa' : 'fora');
  }
}

// troca de jogador: até 5 por time, quem entra vem do banco e assume a vaga de quem sai
export function substituir(P, t, saiId, entraId) {
  const time = P.times[t], i = time.xi.findIndex(j => j && j.id === saiId), b = time.banco.findIndex(j => j.id === entraId);
  if (P.subs[t] >= 5 || i < 0 || b < 0 || P.expulsos[t].has(saiId) || acabou(P)) return false;
  const sai = time.xi[i], entra = time.banco[b];
  time.xi[i] = entra; time.banco.splice(b, 1);
  P.subs[t]++; P.entrada[entra.id] = P.min; P.cond[entra.id] = P.cond[entra.id] ?? 100;
  P.notas[t].set(entra.id, 6.0);
  P.ev.push({ min: P.min, tipo: 'sub', time: t, jogador: entra.id, sai: sai.id });
  if (P.narrar) P.lances.push({ min: P.min, t, tipo: 'sub', txt: `${NOME(sai)} sai, ${NOME(entra)} entra`, x: P.bola?.x ?? 50, y: P.bola?.y ?? 50, j: null });
  recalcular(P);
  return true;
}

// muda o esquema no meio do jogo com os mesmos jogadores em campo
export function trocarEsquema(P, t, formacao) {
  const time = P.times[t];
  const novo = melhorTime(time.xi.filter(Boolean), formacao, new Set(), P.cond);
  time.formacao = formacao; time.xi = novo.xi;
  recalcular(P);
}

// trocas automáticas aos 60, 70 e 80: sai quem está mais cansado ou jogando pior, entra o mais descansado do banco
const JANELAS = { 60: 2, 70: 2, 80: 1 };
function substituicaoIA(P, t) {
  const n = JANELAS[P.min]; if (!n) return;
  for (let k = 0; k < n && P.subs[t] < 5; k++) {
    const campo = P.emCampo(t).filter(j => P.slotDe(t, j) !== 'GOL');
    const nota = j => P.notas[t].get(j.id) ?? 6;
    const cand = campo.filter(j => P.cond[j.id] < 62 || nota(j) < 5.6 || P.min === 80).sort((a, b) => (P.cond[a.id] + (nota(a) - 6) * 8) - (P.cond[b.id] + (nota(b) - 6) * 8))[0];
    if (!cand) return;
    const entra = melhorDoBanco(P, t, P.slotDe(t, cand));
    if (!entra || entra.pos === 'GOL') return;
    substituir(P, t, cand.id, entra.id);
  }
}

// quem terminou em campo (para a disputa de pênaltis): cobrador escolhido primeiro, depois quem finaliza melhor
export const campoDe = P => [0, 1].map(t => P.emCampo(t).map(j => ({ id: j.id, curto: j.curto, fin: j.att.fin, ovr: j.ovr, gk: P.slotDe(t, j) === 'GOL' }))
  .sort((a, b) => (b.id === P.times[t].cobrador) - (a.id === P.times[t].cobrador) || a.gk - b.gk || b.fin - a.fin));
export function resultado(P) {
  const { gols } = P, st = P.st.map(x => ({ ...x }));
  const res = gols[0] > gols[1] ? [0.35, -0.35] : gols[0] < gols[1] ? [-0.35, 0.35] : [0, 0];
  const notas = [new Map(P.notas[0]), new Map(P.notas[1])];
  const jogaram = t => [...notas[t].keys()];
  for (const t of [0, 1]) for (const id of jogaram(t)) {
    const j = [...P.times[t].xi, ...P.times[t].banco].find(x => x && x.id === id);
    const def = j && (SETOR[j.pos] === 'DEF' || j.pos === 'GOL');
    let d = res[t];
    if (gols[1 - t] === 0 && def) d += 0.5;
    notas[t].set(id, Math.round(clamp(notas[t].get(id) + d, 3, 10) * 10) / 10);
  }
  const total = st[0].posse + st[1].posse || 1;
  st[0].posse = Math.round(100 * st[0].posse / total); st[1].posse = 100 - st[0].posse;
  for (const x of st) x.xg = Math.round(x.xg * 100) / 100;
  let craque = null, melhor = -1;
  for (const t of [0, 1]) for (const [id, n] of notas[t]) if (n > melhor) { melhor = n; craque = id; }
  const cond = {}; for (const t of [0, 1]) for (const id of notas[t].keys()) cond[id] = Math.round(P.cond[id] ?? 100);
  return { gols: gols.slice(), eventos: P.ev.slice(), stats: st, notas: notas.map(m => Object.fromEntries(m)), craque, formacoes: P.times.map(t => t.formacao), cond, campo: campoDe(P), arbitro: P.arbitro };
}

export function simular(casa, fora, seed, opts = {}) {
  const P = criarPartida(casa, fora, seed, opts);
  while (!acabou(P)) passo(P);
  return resultado(P);
}
