// Estado do jogo: cria a carreira, avança rodadas e calcula tabelas.
import { rng, pick, jogador } from './util.js';
import { pontosCorridos } from './calendario.js';
import { simular, melhorTime } from './partida.js';
import { gerarNoticias } from './noticias.js';
import { resolverMercado } from './mercado.js';

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
  const c = base.clubes[ci], elenco = base.elencos[ci].reduce((t, j) => t + j.valor, 0) * 1000;
  return Math.round((elenco * 0.12 + c.fan * c.fan * 150000 * PESO_DIV[c.div]) * (PESO_DIF[dificuldade] || 1) / 10000) * 10000;
}

export class Base {
  constructor(dados) {
    this.dados = dados;
    this.clubes = dados.clubes;
    this.jog = new Map(dados.jogadores.map(r => { const j = jogador(r); j.clubeOrig = j.clube; return [j.id, j]; }));
    this.aplicarTransferencias({});
  }
  // cada save carrega as próprias transferências por cima da base original
  aplicarTransferencias(transf) {
    for (const j of this.jog.values()) j.clube = transf[j.id] ?? j.clubeOrig;
    this.elencos = this.clubes.map(() => []);
    for (const j of this.jog.values()) this.elencos[j.clube].push(j);
    this._forca = null;
  }
  // força do clube: média dos 16 melhores (cacheada; o mercado vai precisar invalidar)
  forca(ci) {
    this._forca = this._forca || [];
    if (this._forca[ci] == null) { const t = this.elencos[ci].map(j => j.ovr).sort((a, b) => b - a).slice(0, 16); this._forca[ci] = t.reduce((a, b) => a + b, 0) / t.length; }
    return this._forca[ci];
  }
  ranking() { return this.clubes.map((c, i) => i).sort((a, b) => this.forca(b) - this.forca(a)); }
}

export function clubeParaReputacao(base, rep, seed) {
  const r = rng('rep' + seed), ord = base.ranking(), f = REPUTACOES[rep].faixa;
  // ranking 0 = mais forte; reputação alta pega a parte de cima
  const lo = Math.floor((1 - f[1]) * ord.length), hi = Math.max(lo + 1, Math.floor((1 - f[0]) * ord.length));
  return ord[lo + Math.floor(r() * (hi - lo))];
}

export function novoJogo(base, cfg) {
  const seed = cfg.seed ?? Math.floor(Math.random() * 1e9);
  let clube = cfg.clube;
  if (cfg.modo === 'sorteio') { const r = rng('sorteio' + seed), lista = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === cfg.divisao); clube = pick(r, lista); }
  if (cfg.modo === 'reputacao') clube = clubeParaReputacao(base, cfg.tecnico.reputacao, seed);
  return {
    v: 1, dadosVersao: base.dados.versao, seed, criado: Date.now(), ano: base.dados.ano, rodada: 0,
    tecnico: { ...cfg.tecnico, clube, modo: cfg.modo },
    dificuldade: cfg.dificuldade || 'normal',
    formacao: '4-3-3', xi: null, ultima: null, est: {}, caixa: caixaInicial(base, clube, cfg.dificuldade), transf: {}, propostas: [], historicoTransf: [], noticias: [{ rodada: 0, tipo: 'clube', div: base.clubes[clube].div, texto: `${cfg.tecnico.nome} é o novo técnico do ${base.clubes[clube].n}.` }],
  };
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

// IA escala os melhores no 4-3-3; o seu time usa a escalação manual (s.xi) quando ela ainda vale
export function escalacao(base, s, ci) {
  const elenco = base.elencos[ci];
  if (ci !== s.tecnico.clube) return melhorTime(elenco, '4-3-3');
  if (s.xi?.length === 11) {
    const porId = new Map(elenco.map(j => [j.id, j])), xi = s.xi.map(id => porId.get(id));
    if (xi.every(Boolean)) { const usados = new Set(s.xi); return { formacao: s.formacao, xi, banco: elenco.filter(j => !usados.has(j.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 9) }; }
  }
  return melhorTime(elenco, s.formacao);
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
  if (atuais) s.xi = melhorTime(atuais, formacao).xi.map(j => j.id);
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
  const rd = s.rodada, ci = s.tecnico.clube, jogos = [];
  let meu = null;
  for (const d of DIVS) for (const [h, a] of rodadasDe(base, s, d)[rd]) {
    const th = escalacao(base, s, h), ta = escalacao(base, s, a), seed = `${s.seed}-${d}-${rd}-${h}-${a}`;
    if (h === ci || a === ci) meu = { d, h, a, th, ta, seed, humano: h === ci ? 0 : 1 };
    else jogos.push({ d, h, a, sim: simular(th, ta, seed) });
  }
  return { rd, jogos, meu };
}

export function concluirRodada(base, s, R, simMeu) {
  s.res = s.res || { A: {}, B: {}, C: {} };
  s.est = s.est || {};
  const jogos = R.jogos.slice();
  if (R.meu) jogos.push({ d: R.meu.d, h: R.meu.h, a: R.meu.a, sim: simMeu });
  for (const { d, h, a, sim } of jogos) { s.res[d][chave(h, a)] = sim.gols; registrar(s.est, sim); }
  const m = R.meu;
  s.ultima = m ? { rodada: R.rd, div: m.d, casa: m.h, fora: m.a, ...simMeu, xi: [m.th.xi.map(j => j.id), m.ta.xi.map(j => j.id)] } : null;
  s.rodada++;
  gerarNoticias(base, s, R.rd, jogos, Object.fromEntries(DIVS.map(d => [d, tabela(base, s, d)])));
  resolverMercado(base, s, R.rd);
  return s.ultima;
}

// rodada inteira de uma vez (jogo do usuário simulado direto)
export function avancar(base, s) {
  const R = iniciarRodada(base, s);
  if (!R) return null;
  return concluirRodada(base, s, R, R.meu ? simular(R.meu.th, R.meu.ta, R.meu.seed) : null);
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
