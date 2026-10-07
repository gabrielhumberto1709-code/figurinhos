// Estado do jogo: cria a carreira, avança rodadas e calcula tabelas.
import { rng, pick, jogador } from './util.js';
import { pontosCorridos } from './calendario.js';
import { simular, melhorTime, bancoAuto } from './partida.js';
import { gerarNoticias } from './noticias.js';
import { resolverMercado, garantirMercado } from './mercado.js';
import { contasDaRodada, financasIniciais, bilheteria, lancar } from './financas.js';
import { FASES, PREMIOS, novaCopa, copaDevida, naCopa, mandoDe, dataCopa, decidir, avancarFase, agregadoIda } from './copa.js';

const DIVS = ['A', 'B', 'C'];

export const REPUTACOES = [
  { k: 0, nome: 'Desconhecido', desc: 'Nunca treinou ninguém. Só clubes pequenos te chamam.', faixa: [0, 0.35] },
  { k: 1, nome: 'Ex-jogador da várzea', desc: 'Conhece o vestiário, mas ninguém lembra de você.', faixa: [0.2, 0.55] },
  { k: 2, nome: 'Ex-jogador profissional', desc: 'Nome conhecido no meio. Clubes médios te ouvem.', faixa: [0.4, 0.8] },
  { k: 3, nome: 'Ex-craque', desc: 'Ídolo nacional. Gigante nenhum fecha a porta.', faixa: [0.7, 1] },
];
export const DIFICULDADES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

// datas das rodadas: começa na quarta-feira a partir de 28 de janeiro, alterna quarta/domingo e para no meio do ano
export function dataRodada(ano, r) {
  const ini = Date.UTC(ano, 0, 28), quarta = (3 - new Date(ini).getUTCDay() + 7) % 7;
  const d = new Date(ini + (quarta + 7 * r + (r % 2 ? 4 : 0)) * 864e5);
  if (d >= new Date(Date.UTC(ano, 5, 7))) d.setUTCDate(d.getUTCDate() + 42); // pausa de junho/julho (Copa do Mundo ou datas FIFA)
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

// evolução até o ano: jovem cresce rumo ao potencial, veterano cai; perto dos 38 pendura as chuteiras
export function evolucao(j, anos) {
  let ovr = j.ovrOrig, idade = j.idadeOrig, fora = false;
  for (let k = 0; k < anos && !fora; k++) {
    const r = rng(`evo${j.id}-${j.anoBase + k}`);
    const d = idade <= 20 ? 2 + r() * 5 : idade <= 23 ? 1 + r() * 4 : idade <= 27 ? r() * 2.5 - 0.5 : idade <= 30 ? r() * 1.5 - 1 : idade <= 33 ? -1 - r() * 2 : -2 - r() * 3;
    ovr = Math.round(Math.max(30, d > 0 ? Math.min(ovr + d, Math.max(j.pot, ovr)) : ovr + d));
    idade++;
    fora = idade >= 40 || (idade >= 36 && r() < (idade - 34) * 0.18) || (idade >= 33 && ovr < 58 && r() < 0.35);
  }
  return { ovr, idade, fora };
}
// contrato que acabou num clube da IA é renovado por 1 a 3 anos
const estica = (c, ano) => c >= ano ? c : ano + 1 + (ano - c) % 3;

export class Base {
  constructor(dados) {
    this.dados = dados;
    this.clubes = dados.clubes;
    for (const c of this.clubes) c.divOrig = c.div;
    this.jog = new Map(dados.jogadores.map(r => { const j = this.novo(r, dados.ano); return [j.id, j]; }));
    this._versao = 0;
    this.aplicar();
  }
  novo(r, anoBase) {
    const j = jogador(r);
    Object.assign(j, { anoBase, clubeOrig: j.clube, contratoOrig: j.contrato, ovrOrig: j.ovr, idadeOrig: j.idade, valorOrig: j.valor, attOrig: { ...j.att } });
    return j;
  }
  envelhecer(j, ano) {
    const anos = ano - j.anoBase, e = anos > 0 ? evolucao(j, anos) : { ovr: j.ovrOrig, idade: j.idadeOrig, fora: false }, d = e.ovr - j.ovrOrig;
    j.ovr = e.ovr; j.idade = e.idade; j.fora = e.fora;
    for (const k in j.attOrig) j.att[k] = Math.max(20, Math.min(99, j.attOrig[k] + d));
    j.valor = Math.round(j.valorOrig * 1.14 ** d * (j.idade > 30 ? 0.85 ** Math.min(Math.max(anos, 0), j.idade - 30) : 1));
  }
  // cada save carrega por cima da base original: ano (idade e evolução), divisões, garotos da base, transferências e contratos
  aplicar({ transf = {}, contratos = {}, divs = {}, jovens = [], ano = this.dados.ano } = {}) {
    const chaveJovens = `${jovens.length}:${jovens[0]?.[0]}:${jovens.at(-1)?.[0]}`;
    if (this._chaveJovens !== chaveJovens) {
      for (const id of this._extras || []) this.jog.delete(id);
      for (const r of jovens) { const j = this.novo(r.slice(0, 14), r[14]); this.jog.set(j.id, j); }
      this._extras = jovens.map(r => r[0]); this._chaveJovens = chaveJovens; this._ano = null;
    }
    if (this._ano !== ano) { for (const j of this.jog.values()) this.envelhecer(j, ano); this._ano = ano; }
    this.clubes.forEach((c, i) => { c.div = divs[i] ?? c.divOrig; });
    for (const j of this.jog.values()) { j.clube = transf[j.id] ?? j.clubeOrig; j.contrato = contratos[j.id] ?? estica(j.contratoOrig, ano); }
    this.elencos = this.clubes.map(() => []);
    for (const j of this.jog.values()) if (!j.fora) this.elencos[j.clube].push(j);
    this._forca = null; this._tatica = null;
    this._versao++;
  }
  aplicarTransferencias(transf = {}, contratos = {}) { this.aplicar({ transf, contratos }); }
  // força do clube: média dos 16 melhores (cacheada; o mercado vai precisar invalidar)
  forca(ci) {
    this._forca = this._forca || [];
    if (this._forca[ci] == null) { const t = this.elencos[ci].map(j => j.ovr).sort((a, b) => b - a).slice(0, 16); this._forca[ci] = t.reduce((a, b) => a + b, 0) / t.length; }
    return this._forca[ci];
  }
  ranking() { return this.clubes.map((c, i) => i).filter(i => DIVS.includes(this.clubes[i].div)).sort((a, b) => this.forca(b) - this.forca(a)); }
}
export const aplicarSave = (base, s) => base.aplicar(s);

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
    v: 1, dadosVersao: base.dados.versao, seed, criado: Date.now(), ano: base.dados.ano, anoInicial: base.dados.ano, rodada: 0,
    tecnico: { ...cfg.tecnico, clube, modo: cfg.modo },
    dificuldade: cfg.dificuldade || 'normal',
    formacao: '4-3-3', xi: null, ultima: null, est: {}, ...TATICA_PADRAO(), caixa: caixaInicial(base, clube, cfg.dificuldade), transf: {}, propostas: [], historicoTransf: [], noticias: [{ rodada: 0, tipo: 'clube', div: base.clubes[clube].div, texto: `${cfg.tecnico.nome} é o novo técnico do ${base.clubes[clube].n}.` }],
  };
  s.fin = financasIniciais(base, s);
  garantirMercado(s);
  novaCopa(base, s);
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
  if (!s._cal[d]) { const clubes = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d); s._cal[d] = pontosCorridos(clubes, s.ano === base.dados.ano ? s.seed + d : `${s.seed}${d}${s.ano}`); }
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
  copaSemVoce(base, s);
  const rd = s.rodada, ci = s.tecnico.clube, jogos = [];
  descansarAte(base, s, dataRodada(s.ano, rd));
  let meu = null;
  for (const d of DIVS) for (const [h, a] of rodadasDe(base, s, d)[rd]) {
    const th = escalacao(base, s, h), ta = escalacao(base, s, a), seed = `${s.seed}-${d}-${rd}-${h}-${a}`;
    const opts = { cond: s.cond, mor: s.mor, auto: [h === ci ? s.subsAuto !== false : true, a === ci ? s.subsAuto !== false : true] };
    if (h === ci || a === ci) meu = { d, h, a, th, ta, seed, humano: h === ci ? 0 : 1, opts, capitao: (h === ci ? th : ta).capitao };
    else jogos.push({ d, h, a, sim: simular(th, ta, seed, opts) });
  }
  return { rd, jogos, meu, titulo: meu ? `Série ${meu.d} · ${rd + 1}ª rodada` : '' };
}

// descanso entre um jogo e outro, contado pela data (liga e copa no meio)
function descansarAte(base, s, data) {
  const ult = s.ultimaData ?? (s.rodada > 0 && s.recuperado !== s.rodada ? +dataRodada(s.ano, s.rodada - 1) : null);
  if (ult != null && +data > ult) recuperar(base, s, Math.round((+data - ult) / 864e5));
  s.ultimaData = Math.max(+data, ult ?? 0);
}

// ---------- Copa do Brasil ----------
// próximo compromisso do seu clube: jogo da copa (se a fase já chegou e você está nela) ou rodada da liga
export function proximoEvento(base, s) {
  const ci = s.tecnico.clube;
  if (copaDevida(s) && naCopa(s, ci)) {
    const i = s.copa.fase, [h, a] = mandoDe(i, s.copa.chaves.find(c => c.includes(ci)));
    return { tipo: 'copa', fase: i, h, a, data: dataCopa(dataRodada, s.ano, i), titulo: `Copa do Brasil · ${FASES[i].nome}` };
  }
  if (s.rodada >= 38) return null;
  const d = base.clubes[ci].div, [h, a] = rodadasDe(base, s, d)[s.rodada].find(j => j.includes(ci));
  return { tipo: 'liga', rodada: s.rodada, h, a, data: dataRodada(s.ano, s.rodada), titulo: `Série ${d} · ${s.rodada + 1}ª rodada` };
}

export function iniciarCopa(base, s) {
  const i = s.copa.fase, ci = s.tecnico.clube, jogos = [];
  descansarAte(base, s, dataCopa(dataRodada, s.ano, i));
  let meu = null;
  for (const chave of s.copa.chaves) {
    const [h, a] = mandoDe(i, chave), th = escalacao(base, s, h), ta = escalacao(base, s, a), seed = `${s.seed}-copa${s.ano}-${i}-${h}-${a}`;
    const opts = { cond: s.cond, mor: s.mor, auto: [h === ci ? s.subsAuto !== false : true, a === ci ? s.subsAuto !== false : true] };
    if (h === ci || a === ci) meu = { d: 'copa', h, a, th, ta, seed, humano: h === ci ? 0 : 1, opts, capitao: (h === ci ? th : ta).capitao, mataMata: FASES[i].k !== 'f1', agg: FASES[i].k === 'f2' ? agregadoIda(s, h, a) : [0, 0] };
    else jogos.push({ h, a, seed, sim: simular(th, ta, seed, opts) });
  }
  return { copa: true, fase: i, jogos, meu, titulo: `Copa do Brasil · ${FASES[i].nome}` };
}

export function concluirCopa(base, s, R, simMeu) {
  const i = R.fase, ci = s.tecnico.clube, k = FASES[i].k, N = [], vencedores = [], nome = c => base.clubes[c].n;
  const jogos = R.jogos.slice();
  if (R.meu) { simMeu.capitao = R.meu.capitao; jogos.push({ h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu }); }
  for (const { h, a, seed, sim } of jogos) {
    aposJogo(base, s, h, a, sim);
    const dec = decidir(s, i, h, a, sim.gols, seed);
    s.copa.jogos.push({ fase: i, h, a, gols: sim.gols, pen: dec.pen || null });
    for (const e of sim.eventos) if (e.tipo === 'gol') s.copa.art[e.jogador] = (s.copa.art[e.jogador] || 0) + 1;
    if (dec.vencedor != null) vencedores.push(dec.vencedor);
    const meuJogo = h === ci || a === ci, placar = `${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : ''}`;
    if (meuJogo) {
      if (h === ci) { const b = bilheteria(base, s, ci, a, [], 10, s.fin.ingresso); lancar(s, 'bilheteria', `Bilheteria Copa do Brasil × ${nome(a)} (${b.publico.toLocaleString('pt-BR')} pagantes)`, b.renda); }
      s.ultima = { rodada: s.rodada - 1, copa: FASES[i].nome, div: 'copa', casa: h, fora: a, ...sim, pen: dec.pen || null, xi: [R.meu.th.xi.map(j => j.id), R.meu.ta.xi.map(j => j.id)] };
      N.push({ tipo: 'clube', texto: `Copa do Brasil, ${FASES[i].nome.toLowerCase()}: ${placar}.${dec.vencedor === ci ? (k === 'f2' ? ' É CAMPEÃO!' : ' Classificado!') : dec.perdedor === ci ? ' Eliminado.' : ''}` });
    }
  }
  const avancou = vencedores.includes(ci);
  avancarFase(s, vencedores);
  if (k === 'f2') {
    N.push({ tipo: 'destaque', texto: `${nome(s.copa.campeao)} é campeão da Copa do Brasil ${s.ano} em cima do ${nome(s.copa.vice)}.` });
    if (s.copa.campeao === ci) lancar(s, 'premio', 'Copa do Brasil: prêmio de campeão', PREMIOS.campeao);
    if (s.copa.vice === ci) lancar(s, 'premio', 'Copa do Brasil: prêmio de vice', PREMIOS.vice);
  } else if (avancou && k !== 'f1') {
    const prox = FASES[s.copa.fase], adv = s.copa.chaves.find(c => c.includes(ci)).find(x => x !== ci);
    if (PREMIOS[prox.k]) lancar(s, 'premio', `Copa do Brasil: classificação para ${prox.k === 'f1' ? 'a final' : prox.nome.toLowerCase()}`, PREMIOS[prox.k]);
    N.push({ tipo: 'clube', texto: `Sorteio da Copa do Brasil: ${prox.k === 'f1' ? 'final' : prox.nome.toLowerCase()} contra o ${nome(adv)}.` });
  }
  s.noticias = [...N.map(n => ({ rodada: s.rodada, div: base.clubes[ci].div, copa: true, ...n })), ...s.noticias].slice(0, 220);
  return R.meu ? s.ultima : null;
}

// fases da copa sem o seu clube (ou atrasadas) se resolvem sozinhas
export function copaSemVoce(base, s) {
  if (!s.copa) novaCopa(base, s);
  while (copaDevida(s)) {
    const R = iniciarCopa(base, s);
    concluirCopa(base, s, R, R.meu ? simular(R.meu.th, R.meu.ta, R.meu.seed, R.meu.opts) : null);
    if (R.meu) break; // o seu jogo atrasado foi simulado: para por aqui
  }
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
  if (!naCopa(s, s.tecnico.clube)) copaSemVoce(base, s);
  return s.ultima;
}

// rodada inteira de uma vez (jogo do usuário simulado direto)
export function avancar(base, s) {
  const ev = proximoEvento(base, s);
  if (ev?.tipo === 'copa') { const R = iniciarCopa(base, s); return concluirCopa(base, s, R, simular(R.meu.th, R.meu.ta, R.meu.seed, R.meu.opts)); }
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
  return s.rodada ? `${s.ano} · Série ${d} · ${s.rodada} de 38 rodadas · ${pos}º lugar` : `${s.ano} · Série ${d} · antes da 1ª rodada`;
}
