// Partida minuto a minuto. criarPartida/passo permitem jogar ao vivo (com narração e substituições);
// simular roda tudo de uma vez para os jogos da IA.
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

// melhor escalação: cada vaga com quem rende mais nela
export function melhorTime(jogadores, formacao = '4-3-3', indisponiveis = new Set()) {
  const slots = FORMACOES[formacao];
  const livres = jogadores.filter(j => !indisponiveis.has(j.id));
  const usados = new Set(), xi = Array(slots.length).fill(null);
  // ponytail: guloso pelos melhores pares (jogador, vaga); Hungarian só se aparecer escalação absurda
  const pares = [];
  slots.forEach((sl, i) => { for (const j of livres) pares.push([j.ovr * encaixe(j.pos, sl), i, j]); });
  pares.sort((a, b) => b[0] - a[0]);
  for (const [, i, j] of pares) if (!xi[i] && !usados.has(j.id)) { xi[i] = j; usados.add(j.id); }
  const banco = livres.filter(j => !usados.has(j.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 9);
  return { formacao, xi, banco };
}

// cansaço: depois de 55 minutos em campo o jogador rende um pouco menos (até -10%)
const cansaco = tempo => clamp(1 - Math.max(0, tempo - 55) * 0.0016, 0.9, 1);

function forca(time, min = 0, entrada = {}) {
  const slots = FORMACOES[time.formacao];
  const acc = { GOL: [], DEF: [], MEI: [], ATA: [] }, meio = [];
  time.xi.forEach((j, i) => {
    const slot = slots[i], s = SETOR[slot];
    if (!j) { acc[s].push(25); return; }
    const f = encaixe(j.pos, slot) * cansaco(min - (entrada[j.id] || 0)), a = j.att;
    const v = s === 'GOL' ? j.ovr : s === 'DEF' ? 0.55 * a.def + 0.2 * a.fis + 0.15 * a.vel + 0.1 * a.pas : s === 'MEI' ? 0.45 * a.pas + 0.3 * a.dri + 0.15 * a.fis + 0.1 * a.def : 0.45 * a.fin + 0.25 * a.dri + 0.2 * a.vel + 0.1 * a.fis;
    acc[s].push(v * f);
    if (s === 'MEI') meio.push((0.5 * a.pas + 0.5 * a.dri) * f);
  });
  const m = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 40;
  return { gol: m(acc.GOL), def: m(acc.DEF), mei: m(acc.MEI), ata: 0.68 * m(acc.ATA) + 0.32 * m(meio.length ? meio : [40]) };
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
// faixa lateral de cada vaga (0 = esquerda do time, 100 = direita), para a bola andar pelo lado certo
export const COORD_Y = {
  '4-3-3': [50, 14, 37, 63, 86, 26, 50, 74, 18, 50, 82],
  '4-4-2': [50, 14, 37, 63, 86, 14, 38, 62, 86, 36, 64],
  '4-2-3-1': [50, 14, 37, 63, 86, 36, 64, 16, 50, 84, 50],
  '3-5-2': [50, 26, 50, 74, 10, 36, 64, 50, 90, 36, 64],
  '5-3-2': [50, 9, 29, 50, 71, 91, 26, 50, 74, 36, 64],
};

// ---------- partida passo a passo ----------
export function criarPartida(casa, fora, seed, opts = {}) {
  const copia = t => ({ formacao: t.formacao, xi: t.xi.slice(), banco: (t.banco || []).slice() });
  const P = {
    times: [copia(casa), copia(fora)], min: 0, fim: 90, gols: [0, 0], ev: [], lances: [],
    st: [0, 1].map(() => ({ posse: 0, chutes: 0, noAlvo: 0, xg: 0, faltas: 0, amarelos: 0, vermelhos: 0, escanteios: 0 })),
    notas: [new Map(), new Map()], expulsos: [new Set(), new Set()], entrada: {}, subs: [0, 0], verm: [0, 0],
    r: rng('jogo' + seed), rn: rng('narra' + seed), ri: rng('ia' + seed),
    mando: opts.neutro ? 1 : 1.08, narrar: !!opts.narrar, humano: opts.humano ?? -1, bola: null,
  };
  P.fim = 90 + Math.floor(P.r() * 5);
  P.emCampo = t => P.times[t].xi.filter(j => j && !P.expulsos[t].has(j.id));
  P.slotDe = (t, j) => FORMACOES[P.times[t].formacao][P.times[t].xi.indexOf(j)];
  for (const t of [0, 1]) for (const j of P.times[t].xi) if (j) P.notas[t].set(j.id, 6.2 + (P.r() - 0.5) * 0.6);
  // dia bom/ruim: ninguém joga sempre igual
  P.dia = [0, 1].map(() => (P.r() + P.r() + P.r() - 1.5) * 4);
  recalcular(P);
  return P;
}

function recalcular(P) {
  P.F = [0, 1].map(t => {
    const f = forca(P.times[t], P.min, P.entrada), d = P.dia?.[t] || 0, v = P.verm[t];
    const m = t === 0 ? P.mando : 1;
    return { gol: f.gol, def: (f.def + d * 0.6) * 0.95 ** v, mei: (f.mei * m + d * 0.5) * 0.93 ** v, ata: (f.ata * m + d) * 0.93 ** v };
  });
}

const nota = (P, t, j, d) => { if (j) P.notas[t].set(j.id, (P.notas[t].get(j.id) ?? 6.2) + d); };

export const acabou = P => P.min >= P.fim;

// avança um minuto; devolve os lances narrados desse minuto (vazio se não estiver narrando)
export function passo(P) {
  if (acabou(P)) return [];
  P.min++;
  const inicio = P.lances.length;
  const min = P.min, N = P.narrar ? narrador(P) : null;
  if (min % 5 === 0 && min > 55) recalcular(P);
  if (P.humano !== 0) substituicaoIA(P, 0);
  if (P.humano !== 1) substituicaoIA(P, 1);
  const { r, F } = P;
  const posse0 = clamp(0.5 + (F[0].mei - F[1].mei) / 110, 0.3, 0.7);
  const t = r() < posse0 ? 0 : 1, o = 1 - t;
  P.st[t].posse++;
  const menos = P.expulsos[t].size - P.expulsos[o].size;
  const chance = 0.097 * Math.exp((F[t].ata - F[o].def) / 50) * (1 - 0.12 * menos);
  if (r() < chance) {
    const atacantes = P.emCampo(t);
    const quem = pickW(r, atacantes, j => { const s = SETOR[P.slotDe(t, j)]; return (s === 'ATA' ? 5 : s === 'MEI' ? 2.2 : s === 'DEF' ? 0.5 : 0) * (j.att.fin / 60) ** 2; });
    const xg = clamp(0.05 + r() * 0.32 * Math.exp((F[t].ata - F[o].def) / 60), 0.03, 0.75);
    P.st[t].chutes++; P.st[t].xg += xg;
    const golProb = xg * clamp(1 + (quem.att.fin - F[o].gol) / 90, 0.6, 1.5);
    const noAlvo = r() < 0.38 + xg * 0.6;
    if (noAlvo) P.st[t].noAlvo++;
    const gk = P.emCampo(o).find(j => P.slotDe(o, j) === 'GOL');
    if (N) { const ult = N.jogada(t, 0.62 + r0(P) * 0.2, 2 + Math.floor(P.rn() * 3)); if (ult !== quem) N.lance(t, pickTxt(P.rn, [`${NOME(ult)} serve ${NOME(quem)} na área`, `${NOME(ult)} cruza para ${NOME(quem)}`, `${NOME(ult)} enfia para ${NOME(quem)}`]), 0.84, quem); }
    if (noAlvo && r() < golProb / (0.38 + xg * 0.6)) {
      P.gols[t]++;
      const garcom = r() < 0.72 ? pickW(r, atacantes.filter(j => j !== quem && P.slotDe(t, j) !== 'GOL'), j => j.att.pas ** 2) : null;
      P.ev.push({ min, tipo: 'gol', time: t, jogador: quem.id, assist: garcom && garcom.id, placar: P.gols.slice() });
      nota(P, t, quem, 1.1); nota(P, t, garcom, 0.6);
      for (const j of P.emCampo(o)) { const s = SETOR[P.slotDe(o, j)]; if (s === 'GOL') nota(P, o, j, -0.45); else if (s === 'DEF') nota(P, o, j, -0.2); }
      if (N) N.lance(t, `GOL! ${NOME(quem)} marca${garcom ? `, passe de ${NOME(garcom)}` : ''}!`, 1, quem, 'gol', { placar: P.gols.slice() });
      P.bola = null;
    } else {
      P.ev.push({ min, tipo: noAlvo ? 'defesa' : 'fora', time: t, jogador: quem.id });
      if (noAlvo) nota(P, o, gk, 0.18);
      const esc = r() < 0.35;
      if (esc) P.st[t].escanteios++;
      if (N) {
        N.lance(t, noAlvo ? `${NOME(quem)} finaliza e ${gk ? NOME(gk) : 'o goleiro'} defende!` : pickTxt(P.rn, [`${NOME(quem)} finaliza para fora`, `${NOME(quem)} chuta por cima`, `${NOME(quem)} tenta e a bola passa raspando`]), noAlvo ? 0.97 : 0.99, quem, noAlvo ? 'defesa' : 'fora');
        if (esc) N.lance(t, `Escanteio para o ${t === 0 ? 'mandante' : 'visitante'}`, 0.98, null, 'escanteio');
      }
    }
  } else if (N && P.rn() < 0.85) {
    N.jogada(t, 0.3 + P.rn() * 0.4, 1 + Math.floor(P.rn() * 3));
    if (P.rn() < 0.06) { const j = pickW(P.rn, P.emCampo(t).filter(x => SETOR[P.slotDe(t, x)] === 'ATA'), () => 1); if (j) N.lance(t, `${NOME(j)} em impedimento`, 0.75, j, 'impedimento'); }
  }
  // faltas e cartões (quem defende faz a falta)
  if (r() < 0.16) {
    const f = o; P.st[f].faltas++;
    const autor = pickW(r, P.emCampo(f), j => P.slotDe(f, j) === 'GOL' ? 0.05 : (100 - j.att.def + 40) / 100);
    const cartao = r() < 0.13;
    if (N) N.lance(f, `Falta de ${NOME(autor)}`, 0.5 + (P.rn() - 0.5) * 0.4, autor, 'falta');
    if (cartao) {
      const jaTem = P.ev.some(e => e.tipo === 'amarelo' && e.jogador === autor.id);
      if (jaTem || r() < 0.025) {
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
const r0 = P => P.rn();

// troca de jogador: até 5 por time, quem entra vem do banco e assume a vaga de quem sai
export function substituir(P, t, saiId, entraId) {
  const time = P.times[t], i = time.xi.findIndex(j => j && j.id === saiId), b = time.banco.findIndex(j => j.id === entraId);
  if (P.subs[t] >= 5 || i < 0 || b < 0 || P.expulsos[t].has(saiId) || acabou(P)) return false;
  const sai = time.xi[i], entra = time.banco[b];
  time.xi[i] = entra; time.banco.splice(b, 1);
  P.subs[t]++; P.entrada[entra.id] = P.min;
  P.notas[t].set(entra.id, 6.0);
  P.ev.push({ min: P.min, tipo: 'sub', time: t, jogador: entra.id, sai: sai.id });
  if (P.narrar) P.lances.push({ min: P.min, t, tipo: 'sub', txt: `${NOME(sai)} sai, ${NOME(entra)} entra`, x: P.bola?.x ?? 50, y: P.bola?.y ?? 50, j: null });
  recalcular(P);
  return true;
}

// muda o esquema no meio do jogo com os mesmos jogadores em campo
export function trocarEsquema(P, t, formacao) {
  const time = P.times[t];
  const novo = melhorTime(time.xi.filter(Boolean), formacao);
  time.formacao = formacao; time.xi = novo.xi;
  recalcular(P);
}

// IA mexe no time entre 58' e 80': tira quem está pior e põe o melhor do banco no mesmo setor
function substituicaoIA(P, t) {
  if (P.subs[t] >= 3 || P.min < 58 || P.min > 80 || P.ri() > 0.09) return;
  const time = P.times[t], campo = P.emCampo(t).filter(j => P.slotDe(t, j) !== 'GOL');
  if (!campo.length || !time.banco.length) return;
  const sai = campo.reduce((a, b) => (P.notas[t].get(a.id) <= P.notas[t].get(b.id) ? a : b));
  const slot = P.slotDe(t, sai);
  const entra = time.banco.filter(j => j.pos !== 'GOL').reduce((m, j) => (!m || j.ovr * encaixe(j.pos, slot) > m.ovr * encaixe(m.pos, slot) ? j : m), null);
  if (entra) substituir(P, t, sai.id, entra.id);
}

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
  return { gols: gols.slice(), eventos: P.ev.slice(), stats: st, notas: notas.map(m => Object.fromEntries(m)), craque, formacoes: P.times.map(t => t.formacao) };
}

export function simular(casa, fora, seed, opts = {}) {
  const P = criarPartida(casa, fora, seed, opts);
  while (!acabou(P)) passo(P);
  return resultado(P);
}
