// Estado do jogo: cria a carreira, avança rodadas e calcula tabelas.
import { rng, pick, jogador } from './util.js';
import { pontosCorridos } from './calendario.js';
import { simular, melhorTime, bancoAuto } from './partida.js';
import { gerarNoticias } from './noticias.js';
import { resolverMercado, garantirMercado } from './mercado.js';
import { contasDaRodada, financasIniciais } from './financas.js';

const DIVS = ['A', 'B', 'C'];

export const REPUTACOES = [
  { k: 0, nome: 'Desconhecido', desc: 'Nunca treinou ninguém. Só clubes pequenos te chamam.', faixa: [0, 0.35] },
  { k: 1, nome: 'Ex-jogador da várzea', desc: 'Conhece o vestiário, mas ninguém lembra de você.', faixa: [0.2, 0.55] },
  { k: 2, nome: 'Ex-jogador profissional', desc: 'Nome conhecido no meio. Clubes médios te ouvem.', faixa: [0.4, 0.8] },
  { k: 3, nome: 'Ex-craque', desc: 'Ídolo nacional. Gigante nenhum fecha a porta.', faixa: [0.7, 1] },
];
export const DIFICULDADES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

// datas das rodadas: começa numa quarta de fim de janeiro, alterna quarta/domingo e para na Copa do Mundo
export function dataRodada(ano, r) {
  const d = new Date(Date.UTC(ano, 0, 28) + (7 * r + (r % 2 ? 4 : 0)) * 864e5);
  if (d >= new Date(Date.UTC(ano, 5, 7))) d.setUTCDate(d.getUTCDate() + 42); // pausa da Copa (junho/julho)
  return d;
}
// janelas do Brasil: até o começo de março e do fim de julho ao começo de setembro
export function janelaAberta(ano, r) {
  const d = dataRodada(ano, Math.min(r, 37)), m = d.getUTCMonth(), dia = d.getUTCDate();
  return m < 2 || (m === 2 && dia <= 3) || (m === 6 && dia >= 20) || m === 7 || (m === 8 && dia <= 2);
}

// caixa inicial: parte do valor do elenco + tamanho da torcida, pesado pela divisão
const PESO_DIV = { A: 1, B: 0.4, C: 0.15 }, PESO_DIF = { facil: 1.5, normal: 1, dificil: 0.6 };
export function caixaInicial(base, ci, dificuldade = 'normal') {
  const c = base.clubes[ci];
  if (c.div === 'L') return 0;
  if (c.div === 'X') return Math.round(4e6 * c.tier ** 2 * c.fan / 6 / 10000) * 10000;
  const elenco = base.elencos[ci].reduce((t, j) => t + j.valor, 0) * 1000;
  const minimo = { A: 3e6, B: 1e6, C: 3e5 }[c.div];
  return Math.round(Math.max(minimo, elenco * 0.12 + c.fan * c.fan * 150000 * PESO_DIV[c.div]) * (PESO_DIF[dificuldade] || 1) / 10000) * 10000;
}

export class Base {
  constructor(dados) {
    this.dados = dados;
    this.clubes = dados.clubes;
    this.jog = new Map(dados.jogadores.map(r => { const j = jogador(r); j.clubeOrig = j.clube; j.contratoOrig = j.contrato; return [j.id, j]; }));
    this.aplicarTransferencias({});
  }
  // cada save carrega as próprias transferências (e contratos renovados) por cima da base original
  aplicarTransferencias(transf, contratos = {}) {
    for (const j of this.jog.values()) { j.clube = transf[j.id] ?? j.clubeOrig; j.contrato = contratos[j.id] ?? j.contratoOrig; }
    this.elencos = this.clubes.map(() => []);
    for (const j of this.jog.values()) this.elencos[j.clube].push(j);
    this._forca = null;
    this._versao = (this._versao || 0) + 1;
  }
  // força do clube: média dos 16 melhores (cacheada; o mercado vai precisar invalidar)
  forca(ci) {
    this._forca = this._forca || [];
    if (this._forca[ci] == null) { const t = this.elencos[ci].map(j => j.ovr).sort((a, b) => b - a).slice(0, 16); this._forca[ci] = t.reduce((a, b) => a + b, 0) / t.length; }
    return this._forca[ci];
  }
  ranking() { return this.clubes.map((c, i) => i).filter(i => DIVS.includes(this.clubes[i].div)).sort((a, b) => this.forca(b) - this.forca(a)); }
}
export const aplicarSave = (base, s) => base.aplicarTransferencias(s.transf || {}, s.contratos || {});

export function clubeParaReputacao(base, rep, seed) {
  const r = rng('rep' + seed), ord = base.ranking(), f = REPUTACOES[rep].faixa;
  // ranking 0 = mais forte; reputação alta pega a parte de cima
  const lo = Math.floor((1 - f[1]) * ord.length), hi = Math.max(lo + 1, Math.floor((1 - f[0]) * ord.length));
  return ord[lo + Math.floor(r() * (hi - lo))];
}

export function novoJogo(base, cfg) {
  base.aplicarTransferencias({}); // carreira nova começa da base original
  const seed = cfg.seed ?? Math.floor(Math.random() * 1e9);
  let clube = cfg.clube;
  if (cfg.modo === 'sorteio') { const r = rng('sorteio' + seed), lista = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === cfg.divisao); clube = pick(r, lista); }
  if (cfg.modo === 'reputacao') clube = clubeParaReputacao(base, cfg.tecnico.reputacao, seed);
  const s = {
    v: 1, dadosVersao: base.dados.versao, seed, criado: Date.now(), ano: base.dados.ano, rodada: 0,
    tecnico: { ...cfg.tecnico, clube, modo: cfg.modo },
    dificuldade: cfg.dificuldade || 'normal',
    formacao: '4-3-3', xi: null, ultima: null, est: {}, ...TATICA_PADRAO(), caixa: caixaInicial(base, clube, cfg.dificuldade), transf: {}, propostas: [], historicoTransf: [], noticias: [{ rodada: 0, tipo: 'clube', div: base.clubes[clube].div, texto: `${cfg.tecnico.nome} é o novo técnico do ${base.clubes[clube].n}.` }],
  };
  s.fin = financasIniciais(base, s);
  garantirMercado(s);
  return s;
}

export const chave = (h, a) => `${h}-${a}`;

export function proximoJogo(base, s) {
  const ci = s.tecnico.clube, d = base.clubes[ci].div;
  const rd = s.rodada; if (rd >= 38) return null;
  return { rodada: rd, div: d, jogo: (rodadasDe(base, s, d)[rd] || []).find(([h, a]) => h === ci || a === ci) };
}

export function rodadasDe(base, s, d) {
  // calendário recriado a partir da semente (não precisa ir no save)
  s._cal = s._cal || {};
  if (!s._cal[d]) { const clubes = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d); s._cal[d] = pontosCorridos(clubes, s.seed + d); }
  return s._cal[d];
}

// tática do técnico (campos do save); saves antigos ganham estes valores
export const TATICA_PADRAO = () => ({ estilo: 'equilibrado', gatilhos: { vencendo2: { estilo: 'retranca' }, perdendo60: { estilo: 'pressao' }, empatando75: null }, capitao: null, vice: null, cobrador: null, banco: null, subsAuto: true, treino: 'normal', escSalvas: [], cond: {}, mor: {}, semJogar: {} });

// cada clube da IA tem um jeito de jogar: os grandes propõem, os pequenos se defendem
const FORM_IA = ['4-3-3', '4-4-2', '4-2-3-1', '4-1-4-1', '4-3-1-2', '3-5-2', '4-4-1-1', '4-3-3'];
function taticaIA(base, ci) {
  base._tatica = base._tatica || {};
  if (base._tatica[ci]) return base._tatica[ci];
  const r = rng('tatica' + ci), div = base.clubes[ci].div;
  const ordem = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === div).sort((a, b) => base.forca(b) - base.forca(a));
  const pos = ordem.indexOf(ci) / ordem.length;
  const estilo = pick(r, pos < 0.25 ? ['tikitaka', 'gegenpress', 'equilibrado'] : pos < 0.7 ? ['equilibrado', 'pontas', 'direto', 'equilibrado'] : ['contra', 'equilibrado', 'retranca']);
  return (base._tatica[ci] = { formacao: pick(r, FORM_IA), estilo, gatilhos: { perdendo60: { estilo: 'pressao' }, vencendo2: r() < 0.33 ? { estilo: 'retranca' } : null } });
}

// capitão: o escolhido; se não estiver em campo, o vice; senão o líder natural (nível, idade e jogos)
export const liderNatural = (base, s, js) => js.reduce((m, j) => { const v = j.ovr + 0.6 * j.idade + 0.3 * (s.est?.[j.id]?.[0] || 0); return !m || v > m.v ? { j, v } : m; }, null)?.j;
export function capitaoDe(base, s, xi) {
  const ids = new Set(xi.map(j => j.id));
  return ids.has(s.capitao) ? s.capitao : ids.has(s.vice) ? s.vice : liderNatural(base, s, xi)?.id ?? null;
}

// IA escala os melhores (poupando cansados) no esquema dela; o seu time usa a escalação manual quando ela ainda vale
export function escalacao(base, s, ci) {
  const elenco = base.elencos[ci], cond = s.cond || {};
  if (ci !== s.tecnico.clube) { const t = taticaIA(base, ci); return { ...melhorTime(elenco, t.formacao, new Set(), cond), estilo: t.estilo, gatilhos: t.gatilhos }; }
  let time = null;
  if (s.xi?.length === 11) {
    const porId = new Map(elenco.map(j => [j.id, j])), xi = s.xi.map(id => porId.get(id));
    if (xi.every(Boolean)) time = { formacao: s.formacao, xi };
  }
  time = time || melhorTime(elenco, s.formacao, new Set(), cond);
  const usados = new Set(time.xi.map(j => j.id)), resto = elenco.filter(j => !usados.has(j.id));
  const banco = s.banco ? s.banco.map(id => resto.find(j => j.id === id)).filter(Boolean).slice(0, 9) : bancoAuto(resto, cond);
  return { formacao: time.formacao, xi: time.xi, banco, estilo: s.estilo || 'equilibrado', gatilhos: s.gatilhos || {}, cobrador: s.cobrador, capitao: capitaoDe(base, s, time.xi) };
}

// escolher capitão mexe com o vestiário: quem perde a braçadeira e ainda joga fica chateado
export function definirCapitao(base, s, id) {
  const time = escalacao(base, s, s.tecnico.clube), antes = time.capitao;
  s.capitao = id;
  const depois = capitaoDe(base, s, time.xi);
  if (antes && depois && antes !== depois && time.xi.some(j => j.id === antes)) {
    const lider = liderNatural(base, s, time.xi)?.id === antes;
    s.mor[antes] = Math.max(0, (s.mor[antes] ?? 62) - (lider ? 8 : 4));
    s.mor[depois] = Math.min(100, (s.mor[depois] ?? 62) + 4);
  }
}

// descanso entre jogos: condição volta (mais rápido nos jovens e com treino leve) e a moral volta para o normal
const TREINO = { leve: 1.25, normal: 1, intenso: 0.8 };
export function recuperar(base, s, dias) {
  if (!(dias > 0)) return;
  for (const [id, c] of Object.entries(s.cond)) {
    const j = base.jog.get(+id), ageF = !j ? 1 : j.idade >= 34 ? 0.78 : j.idade >= 31 ? 0.9 : j.idade <= 23 ? 1.12 : 1;
    const treino = j && j.clube === s.tecnico.clube ? TREINO[s.treino] || 1 : 1;
    const q = 0.24 * ageF * treino, nova = c + (100 - c) * (1 - (1 - q) ** dias);
    if (nova > 99.5) delete s.cond[id]; else s.cond[id] = Math.round(nova * 10) / 10;
  }
  for (const [id, m] of Object.entries(s.mor)) { const nova = m + (62 - m) * (1 - 0.96 ** dias); if (Math.abs(nova - 62) < 0.5) delete s.mor[id]; else s.mor[id] = Math.round(nova * 10) / 10; }
}

// depois do jogo: condição de quem jogou e moral (resultado, nota, capitão)
function aposJogo(base, s, h, a, sim) {
  for (const [id, c] of Object.entries(sim.cond || {})) s.cond[id] = c;
  const res = sim.gols[0] > sim.gols[1] ? [4, -4] : sim.gols[0] < sim.gols[1] ? [-4, 4] : [0, 0];
  [h, a].forEach((ci, t) => {
    let bonus = 0;
    if (ci === s.tecnico.clube) { const cap = sim.capitao; if (cap) { const mc = s.mor[cap] ?? 62; bonus = mc >= 70 ? 1 : mc < 35 ? -1 : 0; } }
    for (const [id, n] of Object.entries(sim.notas[t])) {
      const d = res[t] + (n >= 7.5 ? 3 : n <= 5.5 ? -3 : 0) + bonus;
      s.mor[id] = Math.max(0, Math.min(100, (s.mor[id] ?? 62) + d));
    }
  });
  // quem é dos 14 melhores e fica 3 jogos sem entrar perde moral
  const ci = s.tecnico.clube;
  if (ci === h || ci === a) {
    const jogou = new Set(Object.keys(sim.notas[ci === h ? 0 : 1]).map(Number));
    for (const j of base.elencos[ci].slice().sort((x, y) => y.ovr - x.ovr).slice(0, 14)) {
      if (jogou.has(j.id)) { delete s.semJogar[j.id]; continue; }
      s.semJogar[j.id] = (s.semJogar[j.id] || 0) + 1;
      if (s.semJogar[j.id] >= 3) s.mor[j.id] = Math.max(0, (s.mor[j.id] ?? 62) - 2);
    }
  }
}

// coloca o jogador na vaga; se ele já era titular, os dois trocam de lugar
export function escalar(base, s, vaga, id) {
  const xi = escalacao(base, s, s.tecnico.clube).xi.map(j => j.id);
  const onde = xi.indexOf(id);
  if (onde >= 0) xi[onde] = xi[vaga];
  xi[vaga] = id;
  s.xi = xi;
}

// muda o esquema mantendo os mesmos 11 (cada um vai para a vaga em que rende mais)
export function trocarFormacao(base, s, formacao) {
  const atuais = s.xi ? escalacao(base, s, s.tecnico.clube).xi : null;
  s.formacao = formacao;
  if (atuais) s.xi = melhorTime(atuais, formacao, new Set(), s.cond || {}).xi.map(j => j.id);
}

// estatísticas da temporada por jogador: [jogos, gols, assistências, soma das notas x10, amarelos, vermelhos]
function registrar(est, sim) {
  for (const t of [0, 1]) for (const [id, n] of Object.entries(sim.notas[t])) { const e = est[id] || (est[id] = [0, 0, 0, 0, 0, 0]); e[0]++; e[3] += Math.round(n * 10); }
  for (const ev of sim.eventos) {
    if (ev.tipo === 'gol') { est[ev.jogador][1]++; if (ev.assist) est[ev.assist][2]++; }
    else if (ev.tipo === 'amarelo') est[ev.jogador][4]++;
    else if (ev.tipo === 'vermelho') est[ev.jogador][5]++;
  }
}

// rodada em duas etapas: os jogos da IA são decididos logo; o seu pode ser assistido ao vivo
export function iniciarRodada(base, s) {
  if (s.rodada >= 38) return null;
  Object.assign(s, { ...TATICA_PADRAO(), ...s });
  const rd = s.rodada, ci = s.tecnico.clube, jogos = [];
  if (rd > 0 && s.recuperado !== rd) { recuperar(base, s, Math.round((dataRodada(s.ano, rd) - dataRodada(s.ano, rd - 1)) / 864e5)); s.recuperado = rd; }
  let meu = null;
  for (const d of DIVS) for (const [h, a] of rodadasDe(base, s, d)[rd]) {
    const th = escalacao(base, s, h), ta = escalacao(base, s, a), seed = `${s.seed}-${d}-${rd}-${h}-${a}`;
    const opts = { cond: s.cond, mor: s.mor, auto: [h === ci ? s.subsAuto !== false : true, a === ci ? s.subsAuto !== false : true] };
    if (h === ci || a === ci) meu = { d, h, a, th, ta, seed, humano: h === ci ? 0 : 1, opts, capitao: (h === ci ? th : ta).capitao };
    else jogos.push({ d, h, a, sim: simular(th, ta, seed, opts) });
  }
  return { rd, jogos, meu };
}

export function concluirRodada(base, s, R, simMeu) {
  s.res = s.res || { A: {}, B: {}, C: {} };
  s.est = s.est || {};
  const jogos = R.jogos.slice();
  if (R.meu) jogos.push({ d: R.meu.d, h: R.meu.h, a: R.meu.a, sim: simMeu });
  if (R.meu && simMeu) simMeu.capitao = R.meu.capitao;
  for (const { d, h, a, sim } of jogos) { s.res[d][chave(h, a)] = sim.gols; registrar(s.est, sim); aposJogo(base, s, h, a, sim); }
  const m = R.meu;
  s.ultima = m ? { rodada: R.rd, div: m.d, casa: m.h, fora: m.a, ...simMeu, xi: [m.th.xi.map(j => j.id), m.ta.xi.map(j => j.id)] } : null;
  s.rodada++;
  const tabs = Object.fromEntries(DIVS.map(d => [d, tabela(base, s, d)]));
  gerarNoticias(base, s, R.rd, jogos, tabs);
  const casa = R.meu && R.meu.h === s.tecnico.clube ? { adv: R.meu.a } : null;
  for (const txt of contasDaRodada(base, s, R.rd, casa, tabs[base.clubes[s.tecnico.clube].div])) s.noticias.unshift({ rodada: R.rd + 1, tipo: 'clube', div: base.clubes[s.tecnico.clube].div, texto: txt });
  resolverMercado(base, s, R.rd);
  return s.ultima;
}

// rodada inteira de uma vez (jogo do usuário simulado direto)
export function avancar(base, s) {
  const R = iniciarRodada(base, s);
  if (!R) return null;
  return concluirRodada(base, s, R, R.meu ? simular(R.meu.th, R.meu.ta, R.meu.seed, R.meu.opts) : null);
}

export function tabela(base, s, d) {
  const linhas = new Map(base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d).map(i => [i, { clube: i, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, ultimos: [] }]));
  const res = (s.res && s.res[d]) || {};
  const cal = rodadasDe(base, s, d);
  for (let rd = 0; rd < s.rodada; rd++) for (const [h, a] of cal[rd]) {
    const g = res[chave(h, a)]; if (!g) continue;
    const H = linhas.get(h), A = linhas.get(a);
    H.j++; A.j++; H.gp += g[0]; H.gc += g[1]; A.gp += g[1]; A.gc += g[0];
    if (g[0] > g[1]) { H.v++; H.p += 3; A.d++; H.ultimos.push('V'); A.ultimos.push('D'); }
    else if (g[0] < g[1]) { A.v++; A.p += 3; H.d++; H.ultimos.push('D'); A.ultimos.push('V'); }
    else { H.e++; A.e++; H.p++; A.p++; H.ultimos.push('E'); A.ultimos.push('E'); }
  }
  return [...linhas.values()].map(l => ({ ...l, sg: l.gp - l.gc, ultimos: l.ultimos.slice(-5) }))
    .sort((x, y) => y.p - x.p || y.v - x.v || y.sg - x.sg || y.gp - x.gp || base.clubes[x.clube].n.localeCompare(base.clubes[y.clube].n));
}

// o save leva só o necessário (calendário e cache saem)
export function paraSalvar(s) { const { _cal, ...resto } = s; return resto; }
export function resumo(base, s) {
  const ci = s.tecnico.clube, d = base.clubes[ci].div, pos = tabela(base, s, d).findIndex(l => l.clube === ci) + 1;
  return s.rodada ? `Série ${d} · ${s.rodada} de 38 rodadas · ${pos}º lugar` : `Série ${d} · antes da 1ª rodada`;
}
