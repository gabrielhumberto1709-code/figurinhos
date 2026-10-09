// Estado do jogo: cria a carreira, avança rodadas e calcula tabelas.
import { rng, pick, jogador } from './util.js';
import { humanos, ehHumano, vistaDo, mundoDe } from './humanos.js';
import { pontosCorridos, dataRodada, dataAmistoso as diaAmistoso, dataLiga, dataLiga2, N_LIGA, janelaNaData, doAno } from './calendario.js';
import { simular, melhorTime, bancoAuto, posicoesDe, PERS, vagaPara, encaixe, fatorCond, forcaSetores } from './partida.js';
import { fragilidade, indisponiveis, posJogo, TREINO_LES } from './dm.js';
import { garantirCarreira, torcidaAposJogo, aposRodada, demissoesIA, tituloDeCopa } from './carreira.js';
import { evoluir } from './treino.js';
import { rivais } from './rivais.js';
import { registrarForma, bonusFase } from './forma.js';
import { correio, cartasDeInicio } from './correio.js';
import { arbitroDo } from './arbitros.js';
import { vestiarioAposRodada } from './vestiario.js';
import { eventosAposRodada } from './eventos.js';
import { TORNEIOS, PREMIO_SUP, FASES_CONT, F_MATA, F_PO, F_FIN, forcaCont, deFora, dataCont, dataSup, novaCont, contDevida, naCont, supDevida, jogosDaFase, decidirCont, avancarCont, timeFora, jogadorCont, agregadoCont, tabelaGrupo } from './continental.js';
import { gerarNoticias } from './noticias.js';
import { resolverMercado, garantirMercado, acompanharPromessas } from './mercado.js';
import { dataFifa } from './selecao.js';
import { registrarConfronto } from './confrontos.js';
import { REGIONAIS, novaReg, fasesReg, dataFaseReg, jogosDaFaseReg, naReg, regDevida, decidirReg, avancarReg, agregadoReg, mataMataReg, finalReg, vivoReg } from './regionais.js';
import { contasDaRodada, financasIniciais, bilheteria, bilheteriaLiga, lancar, folhaDia, garantirFinancas, caixaReal, verbaIA } from './financas.js';
import { FASES, PREMIOS, novaCopa, copaDevida, copaAtiva, naCopa, mandoDe, dataCopa, decidir, avancarFase, agregadoIda, penaltis } from './copa.js';

const DIVS = ['A', 'B', 'C'];
// calibragem por divisão (temporada simulada × médias reais): ritmo mexe no número de chances, mando no fator casa.
// A Série A tem mais qualidade na frente e passava de 2,7 gols por jogo; B e C empatavam demais e o mandante pesava pouco.
const RITMO_DIV = { A: 0.9, B: 1, C: 1.05 }, MANDO_DIV = { A: 0, B: 0.02, C: 0.025 };

export const REPUTACOES = [
  { k: 0, nome: 'Desconhecido', desc: 'Nunca treinou ninguém. Só clubes pequenos te chamam.', faixa: [0, 0.35] },
  { k: 1, nome: 'Ex-jogador da várzea', desc: 'Conhece o vestiário, mas ninguém lembra de você.', faixa: [0.2, 0.55] },
  { k: 2, nome: 'Ex-jogador profissional', desc: 'Nome conhecido no meio. Clubes médios te ouvem.', faixa: [0.4, 0.8] },
  { k: 3, nome: 'Ex-craque', desc: 'Ídolo nacional. Gigante nenhum fecha a porta.', faixa: [0.7, 1] },
];
export const DIFICULDADES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

// datas: calendario.js (o calendário real de 2026: cada divisão nas suas datas)
export { dataRodada, dataLiga };
// janelas reais (5/jan a 3/mar e 20/jul a 11/set), vistas na data da próxima rodada da Série A (o relógio do jogo);
// antes da 1ª rodada vale a janela de pré-temporada
export function janelaAberta(ano, r) {
  return janelaNaData(ano, r <= 0 ? Math.max(+doAno(ano, '1-5'), Math.min(+dataRodada(ano, 0), +doAno(ano, '3-3'))) : dataRodada(ano, Math.min(r, 37)));
}
// rodadas jogadas por divisão: a Série A é o relógio da temporada (s.rodada); B e C contam à parte
export const feitas = (s, d) => d === 'A' ? s.rodada : s.feitas?.[d] || 0;
export const ligaAcabou = (s, d) => feitas(s, d) >= (N_LIGA[d] || 38);

// caixa de quem assume um clube daqui: o do balanço real de 2025 (financas.js); de fora, pelo tamanho do clube
const caixaFora = c => Math.round(4e6 * c.tier ** 2 * c.fan / 6 / 10000) * 10000;
export function caixaInicial(base, ci, dificuldade = 'normal') {
  const c = base.clubes[ci];
  return c.div === 'L' ? 0 : c.div === 'X' ? caixaFora(c) : caixaReal(c, dificuldade);
}
// verba da IA para contratar numa temporada (o gasto real médio de 2025-26); de fora, o caixa do tamanho do clube
export function caixaIAInicial(base, ci) {
  const c = base.clubes[ci];
  return c.div === 'L' ? 0 : c.div === 'X' ? caixaFora(c) : verbaIA(c);
}

// alguns têm físico de atleta: caem bem devagar e jogam em alto nível até parar (mais comum entre os craques)
export const longevo = j => rng(`long${j.id}`)() < (j.ovrOrig >= 80 ? 0.25 : j.ovrOrig >= 75 ? 0.15 : 0.06);
// queda por idade: suave aos 31-33, pesada dos 35 em diante
const QUEDA = { 31: [0, 1.5], 32: [0.5, 2], 33: [1, 2.5], 34: [1.5, 3.5], 35: [2, 4.5] };
// evolução até o ano: jovem cresce rumo ao potencial, veterano cai; perto dos 38 pendura as chuteiras
export function evolucao(j, anos) {
  let ovr = j.ovrOrig, idade = j.idadeOrig, fora = false;
  const lg = longevo(j);
  for (let k = 0; k < anos && !fora; k++) {
    const r = rng(`evo${j.id}-${j.anoBase + k}`), q = QUEDA[idade] || (idade > 35 ? [3, 6] : null);
    let d = idade <= 20 ? 2 + r() * 5 : idade <= 23 ? 1 + r() * 4 : idade <= 27 ? r() * 2.5 - 0.5 : idade <= 30 ? r() * 1.5 - 0.5 : -(q[0] + r() * (q[1] - q[0]));
    if (d < 0 && lg) d *= 0.3;
    ovr = Math.round(Math.max(30, d > 0 ? Math.min(ovr + d, Math.max(j.pot, ovr)) : ovr + d));
    idade++;
    fora = idade >= (lg ? 42 : 40) || (idade >= (lg ? 38 : 36) && r() < (idade - (lg ? 36 : 34)) * 0.18) || (idade >= 33 && ovr < 58 && r() < 0.35);
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
    Object.assign(j, { anoBase, clubeOrig: j.clube, contratoOrig: j.contrato, potOrig: j.pot, ovrOrig: j.ovr, idadeOrig: j.idade, valorOrig: j.valor, attOrig: { ...j.att } });
    return j;
  }
  envelhecer(j, ano) {
    const anos = ano - j.anoBase, e = anos > 0 ? evolucao(j, anos) : { ovr: j.ovrOrig, idade: j.idadeOrig, fora: false }, d = e.ovr - j.ovrOrig;
    j.ovr = e.ovr; j.idade = e.idade; j.fora = e.fora;
    for (const k in j.attOrig) j.att[k] = Math.max(20, Math.min(99, j.attOrig[k] + d));
    j.valor = Math.round(j.valorOrig * 1.14 ** d * (j.idade > 30 ? 0.85 ** Math.min(Math.max(anos, 0), j.idade - 30) : 1));
    j.ovrBase = j.ovr; j.attBase = { ...j.att }; j.valorBase = j.valor;
  }
  // ganho do treino no dia a dia (s.evo) por cima da evolução do ano
  aplicarEvo(id, v) {
    const j = this.jog.get(+id); if (!j || j.ovrBase == null) return;
    const d = Math.max(0, Math.min(Math.floor(v || 0), Math.max(j.pot, j.ovrBase) - j.ovrBase)); // treino não passa do potencial
    j.ovr = Math.min(99, j.ovrBase + d); j.valor = Math.round(j.valorBase * 1.14 ** d);
    for (const k in j.attBase) j.att[k] = Math.max(20, Math.min(99, j.attBase[k] + d));
    (this._comEvo ||= new Set()).add(j.id); this._forca = null;
  }
  // cada save carrega por cima da base original: ano (idade e evolução), divisões, garotos da base, transferências e contratos
  aplicar({ transf = {}, contratos = {}, divs = {}, jovens = [], ano = this.dados.ano, evo = {}, potd = {} } = {}) {
    const chaveJovens = `${jovens.length}:${jovens[0]?.[0]}:${jovens.at(-1)?.[0]}`;
    if (this._chaveJovens !== chaveJovens) {
      for (const id of this._extras || []) this.jog.delete(id);
      for (const r of jovens) { const j = this.novo(r.slice(0, 14), r[14]); this.jog.set(j.id, j); }
      this._extras = jovens.map(r => r[0]); this._chaveJovens = chaveJovens; this._ano = null;
    }
    // potencial revisado pelas temporadas (antes de envelhecer, que usa o potencial como teto)
    for (const id of this._comPot || []) { const j = this.jog.get(id); if (j) j.pot = j.potOrig; }
    this._comPot = [];
    for (const [id, d] of Object.entries(potd)) { const j = this.jog.get(+id); if (j) { j.pot = Math.max(30, Math.min(99, j.potOrig + d)); this._comPot.push(j.id); } }
    if (this._ano !== ano) { for (const j of this.jog.values()) this.envelhecer(j, ano); this._ano = ano; this._comEvo = null; }
    for (const id of this._comEvo || []) { const j = this.jog.get(id); if (j) { j.ovr = j.ovrBase; j.valor = j.valorBase; Object.assign(j.att, j.attBase); } }
    this._comEvo = null;
    for (const [id, v] of Object.entries(evo)) this.aplicarEvo(id, v);
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
  const seed = cfg.seed ?? 1; // a semente vem de fora (interface ou servidor): o motor não sorteia nada sozinho
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
  garantirCarreira(base, s);
  novaCont(base, s);
  novaCopa(base, s);
  novaReg(base, s);
  s.msgs = []; cartasDeInicio(base, s, true); // boas-vindas e teto salarial na hora
  return s;
}

export const chave = (h, a) => `${h}-${a}`;

export function proximoJogo(base, s) {
  const ci = s.tecnico.clube, d = base.clubes[ci].div;
  const rd = feitas(s, d); if (ligaAcabou(s, d)) return null;
  return { rodada: rd, div: d, jogo: (rodadasDe(base, s, d)[rd] || []).find(([h, a]) => h === ci || a === ci) };
}

export function rodadasDe(base, s, d) {
  // calendário recriado a partir da semente (não precisa ir no save); a Série C joga só o turno (turno único)
  s._cal = s._cal || {};
  if (!s._cal[d]) { const clubes = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d); s._cal[d] = pontosCorridos(clubes, s.ano === base.dados.ano ? s.seed + d : `${s.seed}${d}${s.ano}`).slice(0, N_LIGA[d] || 38); }
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

// competição do próximo jogo do seu clube (os cartões valem por competição)
export const compProxima = (base, s) => { const ev = proximoEvento(base, s); return ev?.tipo === 'amistoso' ? 'AMI' : ev?.tipo === 'reg' ? 'REG' : ev?.tipo === 'copa' ? 'CB' : ev?.tipo === 'cont' ? ev.k : ev?.tipo === 'sup' ? 'SUP' : 'L'; };

// IA escala os melhores (poupando cansados) no esquema dela; o seu time usa a escalação manual quando ela ainda vale.
// Lesionados e suspensos ficam de fora; na escalação manual, a vaga deles é completada só para esse jogo.
// cláusula do medo: emprestado não enfrenta o clube dono, a não ser que quem está com ele pague a multa daquele jogo.
// A IA paga quando ele é titular (o dinheiro cai na sua conta uma vez por jogo).
const chaveEv = ev => `${ev.tipo}-${ev.rodada ?? ev.fase ?? 0}-${ev.h}-${ev.a}`;
export const multaMedo = j => Math.max(50000, Math.round(j.valor * 1000 * 0.08 / 10000) * 10000);
export function barradoMedo(base, s, id, ci) {
  const e = s.emprestimos?.[id]; if (!e?.medo || e.para !== ci) return false;
  const ev = proximoEvento(base, s);
  if (!ev || ![ev.h, ev.a].includes(e.de) || ![ev.h, ev.a].includes(ci)) return false;
  if (e.liberado === chaveEv(ev)) return false;
  const j = base.jog.get(+id);
  const dono = !ehHumano(s, ci) && vistaDo(s, e.de);
  if (dono && j && base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).indexOf(j) < 11) {
    e.liberado = chaveEv(ev);
    lancar(dono, 'medo', `Multa da cláusula do medo: ${j.curto} (${base.clubes[ci].n})`, multaMedo(j));
    s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', clube: e.de, mercado: true, jogador: j.id, div: base.clubes[e.de].div, texto: `O ${base.clubes[ci].n} paga ${Math.round(multaMedo(j) / 1000).toLocaleString('pt-BR')} mil euros de multa para ${j.curto} enfrentar o clube dono.` });
    return false;
  }
  return true;
}
// você paga a multa e ele joga contra o dono neste jogo
export function pagarMedo(base, s, id) {
  const ci = s.tecnico.clube, j = base.jog.get(+id), e = s.emprestimos?.[id];
  if (!j || !e || !barradoMedo(base, s, id, ci)) return 'Ele não está barrado pela cláusula do medo neste jogo.';
  const v = multaMedo(j); if (v > s.caixa) return 'Não tem dinheiro em caixa para a multa.';
  e.liberado = chaveEv(proximoEvento(base, s));
  lancar(s, 'medo', `Multa da cláusula do medo: ${j.curto} (${base.clubes[e.de].n})`, -v);
  return null;
}
// limite de estrangeiros nos relacionados (titulares + banco) nas competições da CBF: 9 em 2026, um a menos por ano
// até 5 em 2030 (aprovado pelos clubes em set/2026). Regionais, continentais e amistosos não têm limite.
export const limiteEstrangeiros = (ano, comp) => ['L', 'CB', 'SUP'].includes(comp) ? (ano <= 2026 ? 9 : Math.max(5, 9 - (ano - 2026))) : Infinity;
export const estrangeiro = j => !!j && j.nat !== 'BRA';
// regra dos 12 jogos (Série A 2026): quem entrou em campo em 13 jogos da A por um clube não joga a A por outro na mesma
// temporada. s.jogosA[id] = { c: clube, n: jogos por ele }; devolve o registro quando ele está barrado para o clube ci.
export const LIMITE_12 = 12;
export const barrado12 = (s, id, ci) => { const x = s.jogosA?.[id]; return x && x.c !== ci && x.n > LIMITE_12 ? x : null; };
export const naoJogaA = (base, s, id, ci) => base.clubes[ci]?.div === 'A' && !!barrado12(s, id, ci); // clube da A não contrata quem não pode usar
function contarSerieA(s, h, a, sim) {
  const J = (s.jogosA ||= {});
  [h, a].forEach((c, t) => { for (const id in sim.notas[t]) { const x = J[id]; if (x?.c === c) x.n++; else if (!x || x.n <= LIMITE_12) J[id] = { c, n: 1 }; } });
}
// os estrangeiros mais fortes ficam; o excedente entre os titulares dá lugar ao melhor brasileiro para a vaga e o banco
// só leva estrangeiro enquanto couber (banco manual: só tira; banco automático: completa com brasileiros)
function aplicarLimite(time, elenco, fora, lim, cond, bancoManual) {
  const xi = time.xi.slice(), slots = posicoesDe(time.formacao, time.pers).map(x => x[0]), usados = new Set(xi.filter(Boolean).map(j => j.id)), trocados = [];
  const est = xi.map((j, i) => [j, i]).filter(([j]) => estrangeiro(j)).sort((a, b) => b[0].ovr - a[0].ovr);
  for (const [j, i] of est.slice(lim)) {
    const sub = elenco.filter(x => !usados.has(x.id) && !fora.has(x.id) && !estrangeiro(x)).sort((a, b) => b.ovr * encaixe(b.pos, slots[i]) - a.ovr * encaixe(a.pos, slots[i]))[0];
    if (sub) { usados.add(sub.id); xi[i] = sub; trocados.push([j, sub, 'estrangeiro']); }
  }
  let vagas = Math.max(0, lim - xi.filter(estrangeiro).length);
  const cabe = j => !estrangeiro(j) || vagas-- > 0;
  const banco = bancoManual ? time.banco.filter(j => !usados.has(j.id)).filter(cabe)
    : bancoAuto(elenco.filter(j => !usados.has(j.id) && !fora.has(j.id)).sort((a, b) => b.ovr - a.ovr).filter(cabe), cond);
  return { ...time, xi, banco, trocados: [...(time.trocados || []), ...trocados] };
}
export function escalacao(base, s, ci, comp = compProxima(base, s), poupa = 0) {
  const t = escalacaoLivre(base, s, ci, comp, poupa), lim = limiteEstrangeiros(s.ano, comp);
  if (!(lim < Infinity) || [...t.xi, ...t.banco].filter(estrangeiro).length <= lim) return t;
  return aplicarLimite(t, base.elencos[ci], t.fora || indisponiveis(s, base.elencos[ci], comp), lim, s.cond || {}, !!vistaDo(s, ci)?.banco);
}
function escalacaoLivre(base, s0, ci, comp, poupa) {
  const elenco = base.elencos[ci], cond = s0.cond || {}, fora = indisponiveis(s0, elenco, comp), s = vistaDo(s0, ci);
  // time alternativo (IA nos regionais): os melhores descansam
  if (poupa && !s) for (const j of elenco.filter(j => !fora.has(j.id)).sort((a, b) => b.ovr - a.ovr).slice(0, poupa)) fora.add(j.id);
  for (const j of elenco) if (s0.emprestimos?.[j.id]?.medo && barradoMedo(base, s0, j.id, ci)) fora.add(j.id);
  if (comp === 'L' && base.clubes[ci].div === 'A') for (const j of elenco) if (barrado12(s0, j.id, ci)) fora.add(j.id);
  if (!s) { const t = taticaIA(base, ci); return { ...melhorTime(elenco, t.formacao, fora, cond, bonusFase(s0)), estilo: t.estilo, gatilhos: t.gatilhos, fora }; }
  let time = null, trocados = [];
  if (s.xi?.length === 11) {
    const porId = new Map(elenco.map(j => [j.id, j])), xi = s.xi.map(id => porId.get(id));
    if (xi.every(Boolean)) {
      const usados = new Set(xi.filter(j => !fora.has(j.id)).map(j => j.id)), slots = posicoesDe(s.formacao, s.formPers).map(x => x[0]);
      const rende = (j, slot) => j.ovr * encaixe(j.pos, slot) * fatorCond(cond[j.id]);
      time = { formacao: s.formacao, xi: xi.map((j, i) => {
        if (!fora.has(j.id)) return j;
        const sub = elenco.filter(x => !usados.has(x.id) && !fora.has(x.id)).sort((a, b) => rende(b, slots[i]) - rende(a, slots[i]))[0];
        if (sub) { usados.add(sub.id); trocados.push([j, sub]); }
        return sub || j; // sem ninguém para pôr, ele vai assim mesmo
      }) };
    }
  }
  time = time || melhorTime(elenco, s.formacao, fora, cond, bonusFase(s), s.formPers);
  const usados = new Set(time.xi.filter(Boolean).map(j => j.id)), resto = elenco.filter(j => !usados.has(j.id) && !fora.has(j.id));
  const banco = s.banco ? s.banco.map(id => resto.find(j => j.id === id)).filter(Boolean).slice(0, 9) : bancoAuto(resto, cond);
  return { formacao: time.formacao, pers: time.formacao === PERS ? s.formPers : null, xi: time.xi, banco, estilo: s.estilo || 'equilibrado', gatilhos: s.gatilhos || {}, cobrador: s.cobrador, capitao: capitaoDe(base, s, time.xi.filter(Boolean)), trocados, fora };
}
// quem tem histórico de lesão, idade e treino puxado se machuca mais
const fase = s => bonusFase(s);
// casa cheia empurra: mando de 1,03 (vazio) a 1,11 (lotado)
const fatorCasa = (base, s, h, a) => 1.03 + 0.08 * bilheteria(base, s, h, a, [], 10, vistaDo(s, h)?.fin?.ingresso || 'normal').occ;
// treino de cada técnico (clube -> fator); clube da IA = 1
const porTreino = (s, T) => new Map(humanos(s).map(([c, v]) => [c, T[v.treino] || 1]));
const fragilDe = (base, s) => { const tr = porTreino(s, TREINO_LES); return id => { const j = base.jog.get(id); return fragilidade(s, j) * (tr.get(j?.clube) ?? 1); }; };

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
  const tr = porTreino(s, TREINO);
  for (const [id, c] of Object.entries(s.cond)) {
    const j = base.jog.get(+id), ageF = !j ? 1 : j.idade >= 34 ? 0.78 : j.idade >= 31 ? 0.9 : j.idade <= 23 ? 1.12 : 1;
    const treino = (j && tr.get(j.clube)) ?? 1;
    const q = 0.18 * ageF * treino, nova = c + (100 - c) * (1 - (1 - q) ** dias); // recupera um pouco por dia: 3 dias não bastam, uma semana quase
    if (nova > 99 || !j) delete s.cond[id]; else s.cond[id] = Math.round(nova * 10) / 10;
  }
  for (const [id, m] of Object.entries(s.mor)) { const nova = m + (62 - m) * (1 - 0.96 ** dias); if (Math.abs(nova - 62) < 1 || !base.jog.has(+id)) delete s.mor[id]; else s.mor[id] = Math.round(nova * 10) / 10; }
}

// depois do jogo: condição de quem jogou e moral (resultado, nota, capitão)
function aposJogo(base, s, h, a, sim) {
  for (const [id, c] of Object.entries(sim.cond || {})) s.cond[id] = c;
  // fase: média recente das notas; seu jogador que entra em fase excelente ou péssima vira notícia
  for (const t of [0, 1]) for (const [id, , depois] of registrarForma(s, sim.notas[t])) {
    const j = base.jog.get(id);
    if (j && ehHumano(s, j.clube) && (depois.k === 'excelente' || depois.k === 'pessima')) s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', clube: j.clube, jogador: id, div: base.clubes[j.clube].div, texto: depois.k === 'excelente' ? `${j.curto} vive fase excelente e rende acima do próprio nível.` : `${j.curto} atravessa fase péssima. A torcida já pede mudança.` });
  }
  const k = rivais(base, h, a) ? 2 : 1, res = sim.gols[0] > sim.gols[1] ? [4 * k, -4 * k] : sim.gols[0] < sim.gols[1] ? [-4 * k, 4 * k] : [0, 0]; // clássico vale o dobro no vestiário
  [h, a].forEach((ci, t) => {
    let bonus = 0;
    if (ehHumano(s, ci)) { const cap = sim.capitaes?.[t] ?? sim.capitao; if (cap) { const mc = s.mor[cap] ?? 62; bonus = mc >= 70 ? 1 : mc < 35 ? -1 : 0; } }
    for (const [id, n] of Object.entries(sim.notas[t])) {
      const d = res[t] + (n >= 7.5 ? 3 : n <= 5.5 ? -3 : 0) + bonus;
      s.mor[id] = Math.max(0, Math.min(100, (s.mor[id] ?? 62) + d));
    }
  });
  // quem é dos 14 melhores e fica 3 jogos sem entrar perde moral
  for (const [ci, sv] of humanos(s)) if (ci === h || ci === a) {
    for (const n of evoluir(base, sv, ci, sim.notas[ci === h ? 0 : 1])) s.noticias.unshift({ rodada: s.rodada, div: base.clubes[ci].div, clube: ci, ...n });
    const jogou = new Set(Object.keys(sim.notas[ci === h ? 0 : 1]).map(Number));
    acompanharPromessas(base, sv, sim, ci === h ? 0 : 1);
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
export const POS_VAGA = ['ZAG', 'LE', 'LD', 'VOL', 'MC', 'ME', 'MD', 'MEI', 'PE', 'PD', 'SA', 'CA'];
// muda a posição de uma vaga (a formação vira "Personalizada"; quem está na vaga continua nela)
export function editarVaga(base, s, i, pos) {
  if (!(i > 0 && i < 11) || !POS_VAGA.includes(pos)) return 'Essa vaga não muda.';
  const slots = posicoesDe(s.formacao, s.formPers).map(x => x.slice());
  slots[i] = vagaPara(slots[i], pos, slots.filter((_, k) => k !== i));
  s.formPers = slots; s.formacao = PERS;
  return null;
}
// empurra a vaga no campo (setas no modo de editar posições)
export function moverVaga(base, s, i, dx, dy) {
  if (!(i > 0 && i < 11)) return 'O goleiro não sai do gol.';
  const slots = posicoesDe(s.formacao, s.formPers).map(x => x.slice());
  slots[i][1] = Math.max(6, Math.min(94, slots[i][1] + dx)); slots[i][2] = Math.max(10, Math.min(84, slots[i][2] + dy));
  s.formPers = slots; s.formacao = PERS;
  return null;
}
export function trocarFormacao(base, s, formacao) {
  const atuais = s.xi ? escalacao(base, s, s.tecnico.clube).xi : null;
  s.formacao = formacao;
  if (atuais) s.xi = melhorTime(atuais, formacao, new Set(), s.cond || {}, undefined, s.formPers).xi.map(j => j.id);
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

// rodada de uma divisão em duas etapas: os jogos da IA são decididos logo; o seu pode ser assistido ao vivo
export function iniciarRodada(base, s, d = base.clubes[s.tecnico.clube].div) {
  if (ligaAcabou(s, d)) return null;
  if (s.tecnico.clube >= 0) Object.assign(s, { ...TATICA_PADRAO(), ...s });
  const rd = feitas(s, d), ci = s.tecnico.clube, jogos = [];
  descansarAte(base, s, dataLiga(s.ano, d, rd));
  let meu = null;
  for (const [h, a] of rodadasDe(base, s, d)[rd]) {
    const th = escalacao(base, s, h, 'L'), ta = escalacao(base, s, a, 'L'), seed = `${s.seed}-${d}-${rd}-${h}-${a}`;
    const opts = { cond: s.cond, mor: s.mor, auto: [h === ci ? s.subsAuto !== false : true, a === ci ? s.subsAuto !== false : true], fragil: fragilDe(base, s), fase: fase(s), mando: fatorCasa(base, s, h, a) + MANDO_DIV[d], ritmo: RITMO_DIV[d], arbitro: arbitroDo(s, seed) };
    if (h === ci || a === ci) meu = { d, h, a, th, ta, seed, humano: h === ci ? 0 : 1, opts, capitao: (h === ci ? th : ta).capitao };
    else jogos.push({ d, ...jogoSimulado(s, h, a, th, ta, seed, opts) });
  }
  return { d, rd, jogos, meu, titulo: `Série ${d} · ${rd + 1}ª rodada` };
}

// descanso entre um jogo e outro, contado pela data (o relógio do mundo: s.ultimaData)
function descansarAte(base, s, data) {
  const ult = s.ultimaData ?? (s.rodada > 0 && s.recuperado !== s.rodada ? +dataRodada(s.ano, s.rodada - 1) : null);
  if (ult != null && +data > ult) recuperar(base, s, Math.round((+data - ult) / 864e5));
  s.ultimaData = Math.max(+data, ult ?? 0);
}

// ---------- o calendário andando ----------
// Tudo o que falta na temporada, com data e se o seu clube joga. O próximo compromisso é o mais cedo em que você joga;
// antes dele, o mundo anda sozinho na ordem das datas (mundoAte): rodadas das outras divisões, fases de copa, regionais.
const PRIO = { sup: 0, cont: 1, copa: 2, reg: 3, liga2: 4, liga: 5, amistoso: 6 };
export function pendentes(base, s) {
  garantirTemporada(base, s);
  // "meu": o clube do técnico (na vista de um técnico, o dele); no mundo da liga online, qualquer técnico
  const ci = s.tecnico.clube, ano = s.ano, L = [], tem = par => ci >= 0 ? par.includes(ci) : par.some(c => ehHumano(s, c));
  // liga online: os amistosos são os primeiros horários da temporada (W.pre conta quantos já foram)
  if (s.rodada === 0 && !s.demitido && ci >= 0 && (!mundoDe(s)._mesas || (mundoDe(s).pre?.ano === s.ano && mundoDe(s).pre.n < 3))) { const A = garantirAmistosos(base, s), i = A.jogos.findIndex(x => !x.g); if (i >= 0) L.push({ tipo: 'amistoso', i, h: A.jogos[i].h, a: A.jogos[i].a, data: dataAmistoso(s, A.jogos[i]), meu: true, titulo: `Amistoso de pré-temporada (${i + 1}/${A.jogos.length})` }); }
  for (const d of DIVS) if (!ligaAcabou(s, d)) {
    const k = feitas(s, d), par = rodadasDe(base, s, d)[k].find(tem);
    L.push({ tipo: 'liga', d, rodada: k, data: dataLiga(ano, d, k), meu: !!par, h: par?.[0], a: par?.[1], titulo: `Série ${d} · ${k + 1}ª rodada` });
  }
  for (const d of ['B', 'C']) { const F = fase2(base, s, d); if (!F || F.i >= N2[d]) continue; const par = jogosFase2(F, d).find(tem); L.push({ tipo: 'liga2', d, i: F.i, data: dataLiga2(ano, d, F.i), meu: !!par, h: par?.[0], a: par?.[1], titulo: tituloFase2(F, d, par), mataMata: !!par && decisivo2(F, d), final: d === 'C' && F.i === 7 }); }
  if (copaAtiva(s)) { const i = s.copa.fase, ch = s.copa.chaves.find(tem), [h, a] = ch ? mandoDe(i, ch) : []; L.push({ tipo: 'copa', fase: i, data: dataCopa(dataRodada, ano, i), meu: !!ch, h, a, titulo: `Copa do Brasil · ${FASES[i].nome}`, neutro: FASES[i].k === 'fin' }); }
  for (const k of ['LIB', 'SUL']) if (contDevida(s, k, Infinity)) { const T = s.cont[k], par = jogosDaFase(T).find(tem); L.push({ tipo: 'cont', k, fase: T.fase, data: dataCont(dataRodada, ano, T.fase, k), meu: !!par, h: par?.[0], a: par?.[1], titulo: `${TORNEIOS[k].nome} · ${FASES_CONT[T.fase].nome}`, neutro: T.fase === F_FIN }); }
  for (const k of Object.keys(REGIONAIS)) if (regDevida(s, k, Infinity)) {
    const T = s.reg[k], F = fasesReg(k)[T.fase], par = jogosDaFaseReg(T).find(tem);
    L.push({ tipo: 'reg', k, fase: T.fase, data: dataFaseReg(ano, k, T.fase), meu: !!par, h: par?.[0], a: par?.[1], titulo: `${REGIONAIS[k].nome} · ${F.nome}`, mataMata: mataMataReg(F), final: finalReg(k, F), neutro: !!REGIONAIS[k].mata[F.m]?.neutro });
  }
  if (supDevida(s)) { const { h, a } = s.cont.sup; L.push({ tipo: 'sup', h, a, data: dataSup(dataRodada, ano), meu: tem([h, a]), titulo: 'Supercopa do Brasil · final', neutro: true }); }
  return L.sort((x, y) => x.data - y.data || PRIO[x.tipo] - PRIO[y.tipo]);
}
// próximo compromisso do seu clube
export function proximoEvento(base, s) { return pendentes(base, s).find(e => e.meu) || null; }
// o mundo anda até a data (inclusive) sem o seu clube: o que é de outros se resolve na ordem das datas
export function mundoAte(base, s, ate, todos = false) {
  for (let n = 0; n < 4000; n++) {
    const x = pendentes(base, s).find(e => (todos || !e.meu) && +e.data <= +ate);
    if (!x) break;
    semanasDoBloco(base, s, x.data);
    rodar(base, s, x, R => R.meu ? simular(R.meu.th, R.meu.ta, R.meu.seed, R.meu.opts) : null);
  }
  semanasDoBloco(base, s, ate);
}
function rodar(base, s, x, sim) {
  if (x.tipo === 'amistoso') { const R = iniciarAmistoso(base, s); return concluirAmistoso(base, s, R, sim(R)); }
  if (x.tipo === 'reg') { const R = iniciarReg(base, s, x.k); return concluirReg(base, s, R, sim(R)); }
  if (x.tipo === 'copa') { const R = iniciarCopa(base, s); return concluirCopa(base, s, R, sim(R)); }
  if (x.tipo === 'cont') { const R = iniciarCont(base, s, x.k); return concluirCont(base, s, R, sim(R)); }
  if (x.tipo === 'sup') { const R = iniciarSup(base, s); return concluirSup(base, s, R, sim(R)); }
  if (x.tipo === 'liga2') { const R = iniciarLiga2(base, s, x.d); return concluirLiga2(base, s, R, sim(R)); }
  const R = iniciarRodada(base, s, x.d); return concluirRodada(base, s, R, sim(R));
}
// a temporada acabou quando não falta nada no calendário
export const temporadaAcabou = (base, s) => !pendentes(base, s).length;

// jogo simulado direto (IA, ou técnico na liga online): com técnico no jogo guarda os titulares, os capitães e, online,
// a ficha para assistir depois (mesmo resultado, refeito minuto a minuto)
function jogoSimulado(s, h, a, th, ta, seed, opts) {
  const sim = simular(th, ta, seed, opts), jg = { h, a, seed, sim };
  if (ehHumano(s, h) || ehHumano(s, a)) {
    sim.capitaes = [th.capitao ?? null, ta.capitao ?? null];
    jg.xi = [th.xi.map(j => j?.id), ta.xi.map(j => j?.id)];
    if (mundoDe(s)._mesas) jg.vivo = fotoJogo(th, ta, seed, opts);
  }
  return jg;
}
const fotoJ = j => j && { id: j.id, nome: j.nome, curto: j.curto, pos: j.pos, ovr: j.ovr, att: { ...j.att }, idade: j.idade, num: j.num, nat: j.nat, rosto: j.rosto, clube: j.clube };
const fotoT = t => ({ formacao: t.formacao, pers: t.pers || null, xi: t.xi.map(fotoJ), banco: (t.banco || []).map(fotoJ), estilo: t.estilo, gatilhos: t.gatilhos || {}, cobrador: t.cobrador ?? null, capitao: t.capitao ?? null });
export function fotoJogo(th, ta, seed, opts) {
  const ids = [th, ta].flatMap(t => [...t.xi, ...(t.banco || [])]).filter(Boolean).map(j => j.id), de = m => Object.fromEntries(ids.filter(id => m?.[id] != null).map(id => [id, m[id]]));
  return { th: fotoT(th), ta: fotoT(ta), seed, opts: { cond: de(opts.cond), mor: de(opts.mor), auto: opts.auto, neutro: !!opts.neutro, mando: opts.mando, ritmo: opts.ritmo, arbitro: opts.arbitro || null,
    fragil: Object.fromEntries(ids.map(id => [id, opts.fragil ? opts.fragil(id) : 1])), fase: Object.fromEntries(ids.map(id => [id, opts.fase ? opts.fase(id) : 0])) } };
}
// a ficha vira de novo os parâmetros da partida (para assistir)
export const daFoto = F => ({ th: F.th, ta: F.ta, seed: F.seed, opts: { ...F.opts, fragil: id => F.opts.fragil[id] ?? 1, fase: id => F.opts.fase[id] || 0 } });
const xiDe = M => [M.th.xi.map(j => j?.id), M.ta.xi.map(j => j?.id)];
// div das notícias de copa: a do clube citado (ou a do técnico do save)
const divNot = (base, s, n) => base.clubes[n.clube ?? s.tecnico.clube]?.div ?? 'A';

// ---------- Copa do Brasil ----------
export function iniciarCopa(base, s) {
  const i = s.copa.fase, F = FASES[i], jogos = [], decide = F.perna !== 'ida', fin = F.k === 'fin';
  descansarAte(base, s, dataCopa(dataRodada, s.ano, i));
  let meu = null;
  for (const chave of s.copa.chaves) {
    const [h, a] = mandoDe(i, chave), x = jogoCopa(base, s, h, a, 'CB', `${s.seed}-copa${s.ano}-${i}-${h}-${a}`, { mataMata: decide, final: fin, neutro: fin });
    if (x.meu) { meu = { ...x.meu, d: 'copa' }; if (F.perna === 'volta') meu.agg = agregadoIda(s, h, a); } else jogos.push(x.jogo);
  }
  return { copa: true, fase: i, jogos, meu, titulo: `Copa do Brasil · ${F.nome}` };
}

export function concluirCopa(base, s, R, simMeu) {
  const i = R.fase, F = FASES[i], decide = F.perna !== 'ida', fin = F.k === 'fin', N = [], vencedores = [], nome = c => base.clubes[c].n;
  const jogos = R.jogos.slice();
  if (R.meu) { simMeu.capitao = R.meu.capitao; jogos.push({ h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu, xi: xiDe(R.meu) }); }
  const hs = humanos(s), estreia = new Set(hs.map(([c]) => c).filter(c => !s.copa.jogos.some(j => j.h === c || j.a === c)));
  const dmN = [], jogaram = new Set();
  for (const jg of jogos) {
    const { h, a, seed, sim } = jg;
    aposJogo(base, s, h, a, daBase(base, sim));
    dmN.push(...posJogo(base, s, h, a, sim, 'CB'));
    const dec = decidir(s, i, h, a, sim.gols, seed, sim.campo);
    s.copa.jogos.push({ fase: i, h, a, gols: sim.gols, pen: dec.pen || null });
    for (const e of sim.eventos) if (e.tipo === 'gol' && base.jog.has(e.jogador)) s.copa.art[e.jogador] = (s.copa.art[e.jogador] || 0) + 1;
    if (dec.vencedor != null) vencedores.push(dec.vencedor);
    const placar = `${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.agg ? ` (agregado ${dec.agg[0]} a ${dec.agg[1]})` : ''}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : ''}`;
    for (const [ci, sv] of hs) {
      if (h !== ci && a !== ci) continue;
      jogaram.add(sv);
      if (h === ci && !fin) { const b = bilheteria(base, s, ci, a, [], 10, sv.fin.ingresso); lancar(sv, 'bilheteria', `Bilheteria Copa do Brasil × ${nome(a)} (${b.publico.toLocaleString('pt-BR')} pagantes)`, b.renda); }
      if (estreia.has(ci) && PREMIOS[F.k]) lancar(sv, 'premio', `Copa do Brasil: cota da ${F.nome.split(' ·')[0].toLowerCase()}`, PREMIOS[F.k]);
      torcidaAposJogo(sv, ci, h, sim.gols, { pen: dec.pen, mataMata: decide, final: fin, classico: rivais(base, h, a) });
      sv.ultima = { rodada: s.rodada - 1, copa: F.nome, div: 'copa', casa: h, fora: a, ...sim, pen: dec.pen || null, xi: jg.xi }; if (jg.vivo) sv.ultimaVivo = jg.vivo; registrarConfronto(base, sv);
      N.push({ tipo: 'clube', clube: ci, texto: `Copa do Brasil, ${F.nome.toLowerCase()}: ${placar}.${dec.vencedor === ci ? (fin ? ' É CAMPEÃO!' : ' Classificado!') : dec.perdedor === ci ? ' Eliminado.' : ''}` });
    }
  }
  avancarFase(s, vencedores, c => forcaCont(base, c, s.ano));
  if (fin) {
    N.push({ tipo: 'destaque', texto: `${nome(s.copa.campeao)} é campeão da Copa do Brasil ${s.ano} em cima do ${nome(s.copa.vice)}.` });
    for (const [ci, sv] of hs) {
      if (s.copa.campeao === ci) { lancar(sv, 'premio', 'Copa do Brasil: prêmio de campeão', PREMIOS.campeao); tituloDeCopa(sv); }
      if (s.copa.vice === ci) lancar(sv, 'premio', 'Copa do Brasil: prêmio de vice', PREMIOS.vice);
    }
  } else if (decide) for (const [ci, sv] of hs) {
    if (!vencedores.includes(ci)) continue;
    const prox = FASES[s.copa.fase], ch = s.copa.chaves.find(c => c.includes(ci)), adv = ch.find(x => x !== ci), etapa = prox.nome.split(' ·')[0].toLowerCase();
    if (PREMIOS[prox.k]) lancar(sv, 'premio', `Copa do Brasil: classificação para ${prox.k === 'fin' ? 'a final' : etapa}`, PREMIOS[prox.k]);
    N.push({ tipo: 'clube', clube: ci, texto: `Sorteio da Copa do Brasil: ${prox.k === 'fin' ? 'final em campo neutro' : etapa} contra o ${nome(adv)}${prox.k === 'fin' ? '' : prox.perna === 'unico' ? (ch[0] === ci ? ', em casa' : ', fora') : ch[0] === ci ? ', com a ida em casa' : ', com a volta em casa'}.` });
  }
  s.noticias = [...dmN.map(n => ({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n })), ...N.map(n => ({ rodada: s.rodada, div: divNot(base, s, n), copa: true, ...n })), ...s.noticias].slice(0, 220);
  for (const sv of jogaram) correio(base, sv);
  return R.meu ? s.ultima : null;
}

// ---------- Libertadores, Sul-Americana e Supercopa ----------
const timeCont = (base, s, ci, comp, poupa) => deFora(base.clubes[ci]) ? timeFora(base, s, ci) : escalacao(base, s, ci, comp, poupa);
// nos regionais, a IA da Série A (e um pouco a da B) usa time misto até o mata-mata, como os grandes fazem no estadual
const POUPA_REG = { A: 5, B: 2 };
// só os jogadores da base entram em condição e moral (os gerados dos clubes de fora não ficam no save)
const daBase = (base, sim) => ({ ...sim, cond: Object.fromEntries(Object.entries(sim.cond || {}).filter(([id]) => base.jog.has(+id))), notas: sim.notas.map(n => Object.fromEntries(Object.entries(n).filter(([id]) => base.jog.has(+id)))) });
function jogoCopa(base, s, h, a, comp, seed, extra = {}) {
  const ci = s.tecnico.clube, poupa = c => comp === 'REG' && !extra.mataMata ? POUPA_REG[base.clubes[c].div] || 0 : 0;
  const th = timeCont(base, s, h, comp, poupa(h)), ta = timeCont(base, s, a, comp, poupa(a));
  const opts = { cond: s.cond, mor: s.mor, auto: [h === ci ? s.subsAuto !== false : true, a === ci ? s.subsAuto !== false : true], fragil: fragilDe(base, s), neutro: !!extra.neutro, fase: fase(s), mando: fatorCasa(base, s, h, a), arbitro: arbitroDo(s, seed) };
  if (h === ci || a === ci) return { meu: { d: comp, h, a, th, ta, seed, humano: h === ci ? 0 : 1, opts, capitao: (h === ci ? th : ta).capitao, agg: [0, 0], ...extra } };
  return { jogo: jogoSimulado(s, h, a, th, ta, seed, opts) };
}
export function iniciarCont(base, s, k) {
  const T = s.cont[k], f = T.fase, jogos = [];
  descansarAte(base, s, dataCont(dataRodada, s.ano, f, k));
  let meu = null;
  for (const [h, a] of jogosDaFase(T)) {
    const volta = FASES_CONT[f].perna === 'volta', x = jogoCopa(base, s, h, a, k, `${s.seed}-${k}${s.ano}-${f}-${h}-${a}`, { mataMata: f >= F_MATA && FASES_CONT[f].perna !== 'ida', neutro: f === F_FIN, final: f === F_FIN });
    if (x.meu) { meu = x.meu; if (volta) meu.agg = agregadoCont(T, h, a); } else jogos.push(x.jogo);
  }
  return { cont: k, fase: f, jogos, meu, titulo: `${TORNEIOS[k].nome} · ${FASES_CONT[f].nome}` };
}
export function concluirCont(base, s, R, simMeu) {
  const k = R.cont, T = s.cont[k], f = R.fase, P = TORNEIOS[k].premio, nome = c => base.clubes[c].n, N = [], dmN = [];
  const jogos = R.jogos.slice();
  if (R.meu) { simMeu.capitao = R.meu.capitao; jogos.push({ h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu, xi: xiDe(R.meu) }); }
  const venc = {}, hs = humanos(s), jogaram = new Set();
  const estavam = new Map(hs.map(([ci]) => [ci, T.grupos.findIndex(g => g.includes(ci))]));
  for (const jg of jogos) {
    const { h, a, seed, sim } = jg;
    aposJogo(base, s, h, a, daBase(base, sim));
    dmN.push(...posJogo(base, s, h, a, sim, k));
    const dec = decidirCont(T, f, h, a, sim.gols, seed, sim.campo);
    venc[`${h}-${a}`] = dec.vencedor;
    T.jogos.push({ fase: f, h, a, gols: sim.gols, pen: dec.pen || null });
    for (const e of sim.eventos) if (e.tipo === 'gol') { const j = jogadorCont(base, s.ano, e.jogador), x = T.art[e.jogador] || (T.art[e.jogador] = [0, j?.curto || '?', j?.clube ?? (e.time ? a : h)]); x[0]++; }
    for (const [ci, sv] of hs) {
      if (h !== ci && a !== ci) continue;
      jogaram.add(sv);
      const casa = h === ci, adv = casa ? a : h, my = sim.gols[casa ? 0 : 1], ot = sim.gols[casa ? 1 : 0];
      if (casa && f !== F_FIN) { const b = bilheteria(base, s, ci, adv, [], 10, sv.fin.ingresso); lancar(sv, 'bilheteria', `Bilheteria ${TORNEIOS[k].nome} × ${nome(adv)} (${b.publico.toLocaleString('pt-BR')} pagantes)`, b.renda); }
      if (f === 0) lancar(sv, 'premio', `${TORNEIOS[k].nome}: cota da fase de grupos`, P.grupos);
      if (f < F_MATA && my > ot) lancar(sv, 'premio', `${TORNEIOS[k].nome}: vitória na fase de grupos`, P.vitoria);
      torcidaAposJogo(sv, ci, h, sim.gols, { pen: dec.pen, mataMata: f >= F_MATA && FASES_CONT[f].perna !== 'ida', final: f === F_FIN, classico: rivais(base, h, a) });
      sv.ultima = { rodada: s.rodada - 1, copa: `${TORNEIOS[k].nome} · ${FASES_CONT[f].nome}`, div: k, casa: h, fora: a, ...sim, pen: dec.pen || null, xi: jg.xi }; if (jg.vivo) sv.ultimaVivo = jg.vivo; registrarConfronto(base, sv);
      N.push({ tipo: 'clube', clube: ci, texto: `${TORNEIOS[k].nome}, ${FASES_CONT[f].nome.toLowerCase()}: ${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.agg ? ` (agregado ${dec.agg[0]} a ${dec.agg[1]})` : ''}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : ''}.${dec.vencedor === ci ? (f === F_FIN ? ' É CAMPEÃO!' : ' Classificado!') : dec.perdedor === ci ? ' Eliminado.' : ''}` });
    }
  }
  const vencedores = jogosDaFase(T).map(([h, a]) => venc[`${h}-${a}`]);
  avancarCont(T, vencedores);
  if (f === F_MATA - 1) for (const [ci, sv] of hs) {
    const g = estavam.get(ci); if (g < 0) continue;
    const pos = tabelaGrupo(T, g).findIndex(l => l.clube === ci) + 1;
    const oitavas = k === 'LIB' ? pos <= 2 : pos === 1, adv = T.chaves.find(c => c.includes(ci))?.find(x => x !== ci);
    N.push({ tipo: 'clube', clube: ci, texto: oitavas ? `${TORNEIOS[k].nome}: classificado para as oitavas de final${adv != null ? ` contra o ${nome(adv)}` : ''}.` : k === 'SUL' && pos === 2 ? 'Sul-Americana: 2º no grupo, vai ao playoff contra um 3º colocado da Libertadores.' : k === 'LIB' && pos === 3 ? 'Libertadores: 3º no grupo, cai para o playoff da Sul-Americana.' : `${TORNEIOS[k].nome}: eliminado na fase de grupos.` });
    if (oitavas) lancar(sv, 'premio', `${TORNEIOS[k].nome}: classificação para as oitavas`, P.oit);
  } else if (FASES_CONT[f].perna === 'volta') {
    const kf = FASES_CONT[f].k;
    for (const [ci, sv] of hs) if (T.chaves.some(c => c.includes(ci))) lancar(sv, 'premio', `${TORNEIOS[k].nome}: classificação para ${{ po: 'as oitavas', oit: 'as quartas', qua: 'a semifinal', sem: 'a final' }[kf]}`, { po: P.oit, oit: P.qua, qua: P.sem, sem: P.fin }[kf]);
  } else if (f === F_FIN) {
    N.push({ tipo: 'destaque', texto: `${nome(T.campeao)} é campeão da ${TORNEIOS[k].nome} ${s.ano} em cima do ${nome(T.vice)}.` });
    const sv = vistaDo(s, T.campeao); if (sv) { lancar(sv, 'premio', `${TORNEIOS[k].nome}: prêmio de campeão`, P.campeao); tituloDeCopa(sv); }
  }
  s.noticias = [...dmN.map(n => ({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n })), ...N.map(n => ({ rodada: s.rodada, div: divNot(base, s, n), copa: true, ...n })), ...s.noticias].slice(0, 220);
  for (const sv of jogaram) correio(base, sv);
  return R.meu ? s.ultima : null;
}
export function iniciarSup(base, s) {
  const { h, a } = s.cont.sup;
  descansarAte(base, s, dataSup(dataRodada, s.ano));
  const x = jogoCopa(base, s, h, a, 'SUP', `${s.seed}-sup${s.ano}-${h}-${a}`, { mataMata: true, neutro: true, final: true });
  return { sup: true, jogos: x.jogo ? [x.jogo] : [], meu: x.meu || null, titulo: 'Supercopa do Brasil · final' };
}
export function concluirSup(base, s, R, simMeu) {
  const nome = c => base.clubes[c].n, jg = R.meu ? { h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu, xi: xiDe(R.meu) } : R.jogos[0], { h, a, seed, sim } = jg;
  if (R.meu) simMeu.capitao = R.meu.capitao;
  aposJogo(base, s, h, a, sim);
  const dmN = posJogo(base, s, h, a, sim, 'SUP'), dec = decidirCont({}, F_FIN, h, a, sim.gols, seed, sim.campo);
  s.cont.sup.jogo = { h, a, gols: sim.gols, pen: dec.pen || null, campeao: dec.vencedor };
  const placar = `${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : ''}`;
  const hs = humanos(s).filter(([ci]) => ci === h || ci === a);
  for (const [ci, sv] of hs) {
    torcidaAposJogo(sv, ci, h, sim.gols, { pen: dec.pen, mataMata: true, final: true });
    lancar(sv, 'premio', `Supercopa do Brasil: ${dec.vencedor === ci ? 'campeão' : 'vice'}`, dec.vencedor === ci ? PREMIO_SUP.campeao : PREMIO_SUP.vice);
    sv.ultima = { rodada: -1, copa: 'Supercopa do Brasil · final', div: 'SUP', casa: h, fora: a, ...sim, pen: dec.pen || null, xi: jg.xi }; if (jg.vivo) sv.ultimaVivo = jg.vivo; registrarConfronto(base, sv);
  }
  const N = [{ tipo: ehHumano(s, dec.vencedor) ? 'clube' : 'destaque', clube: ehHumano(s, dec.vencedor) ? dec.vencedor : undefined, texto: `Supercopa do Brasil: ${placar}. ${nome(dec.vencedor)} é campeão.` }];
  s.noticias = [...dmN, ...N].map(n => ({ rodada: 0, div: divNot(base, s, n), copa: true, ...n })).concat(s.noticias).slice(0, 220);
  for (const [, sv] of hs) correio(base, sv);
  return R.meu ? s.ultima : null;
}
// ---------- amistosos de pré-temporada ----------
// três jogos na primeira semana de janeiro, antes dos regionais: um contra time menor (em casa), um parelho (fora) e um de fora do país (em casa).
// Não contam para nada: dão ritmo, cansam um pouco, mexem pouco na moral e rendem uma bilheteria pequena.
const dataAmistoso = (s, J) => diaAmistoso(s.ano, s.amistosos.jogos.indexOf(J));
export function garantirAmistosos(base, s) {
  const ci = s.tecnico.clube;
  if (s.amistosos?.ano === s.ano && s.amistosos.clube === ci) return s.amistosos;
  const r = rng(`amist${s.seed}${s.ano}${ci}`), f = base.forca(ci), usados = new Set([ci]);
  const perto = (l, alvo) => l.filter(i => !usados.has(i)).sort((a, b) => Math.abs(base.forca(a) - alvo) - Math.abs(base.forca(b) - alvo)).slice(0, 6);
  const br = base.clubes.map((c, i) => i).filter(i => DIVS.includes(base.clubes[i].div) && !rivais(base, i, ci) && !ehHumano(s, i));
  const fora = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'X' && base.clubes[i].tier >= 2);
  const escolhe = l => { const x = pick(r, l); usados.add(x); return x; };
  const advs = [escolhe(perto(br, f - 6)), escolhe(perto(br, f + 1)), escolhe(perto(fora, f + 2).length ? perto(fora, f + 2) : perto(br, f + 3))];
  s.amistosos = { ano: s.ano, clube: ci, jogos: advs.map((a, i) => ({ h: i === 1 ? a : ci, a: i === 1 ? ci : a, g: null })) };
  return s.amistosos;
}
export function iniciarAmistoso(base, s) {
  const A = garantirAmistosos(base, s), i = A.jogos.findIndex(x => !x.g), J = A.jogos[i];
  descansarAte(base, s, dataAmistoso(s, J));
  const x = jogoCopa(base, s, J.h, J.a, 'AMI', `${s.seed}-ami${s.ano}-${i}-${J.h}-${J.a}`, { amistoso: true });
  return { amistoso: true, i, jogos: [], meu: x.meu, titulo: `Amistoso de pré-temporada (${i + 1}/${A.jogos.length})` };
}
export function concluirAmistoso(base, s, R, simMeu) {
  const ci = s.tecnico.clube, J = s.amistosos.jogos[R.i], nome = c => base.clubes[c].n, sim = daBase(base, simMeu), t = J.h === ci ? 0 : 1, my = simMeu.gols[t], ot = simMeu.gols[1 - t];
  J.g = simMeu.gols;
  for (const [id, c] of Object.entries(sim.cond || {})) s.cond[id] = c;
  for (const id of Object.keys(sim.notas[t])) s.mor[id] = Math.max(0, Math.min(100, (s.mor[id] ?? 62) + (my > ot ? 1 : my < ot ? -1 : 0)));
  if (J.h === ci) { const b = bilheteria(base, s, ci, J.a, [], 10, s.fin.ingresso); lancar(s, 'bilheteria', `Amistoso × ${nome(J.a)} (${Math.round(b.publico * 0.5).toLocaleString('pt-BR')} pagantes)`, Math.round(b.renda * 0.4)); }
  s.ultima = { rodada: -1, copa: R.titulo, div: 'AMI', casa: J.h, fora: J.a, ...simMeu, pen: null, xi: [R.meu.th.xi.map(j => j.id), R.meu.ta.xi.map(j => j.id)] };
  s.noticias.unshift({ rodada: 0, tipo: 'clube', clube: ci, div: base.clubes[ci].div, texto: `${R.titulo}: ${nome(J.h)} ${simMeu.gols[0]} × ${simMeu.gols[1]} ${nome(J.a)}.` });
  correio(base, s);
  return s.ultima;
}
// liga online: o amistoso de cada técnico é simulado no horário (com a ficha para assistir depois)
export function amistosoSimulado(base, s) {
  if (s.demitido || !garantirAmistosos(base, s).jogos.some(x => !x.g)) return;
  const R = iniciarAmistoso(base, s), M = R.meu, opts = { ...M.opts, auto: [true, true] }, foto = fotoJogo(M.th, M.ta, M.seed, opts); // a ficha antes: o jogo mexe no físico
  concluirAmistoso(base, s, R, simular(M.th, M.ta, M.seed, opts));
  s.ultimaVivo = foto;
}

// chance de vitória, empate e derrota do próximo jogo (Poisson pelos setores, com o fator casa)
export function previa(base, s, ev) {
  const comp = compProxima(base, s), [fh, fa] = [ev.h, ev.a].map(c => forcaSetores(timeCont(base, s, c, comp), s.cond, s.mor));
  const m = ev.neutro ? 1 : fatorCasa(base, s, ev.h, ev.a), at = f => f.ataque * 0.6 + f.meio * 0.4, df = f => f.defesa * 0.7 + f.goleiro * 0.3;
  const lh = 1.15 * Math.exp((at(fh) * m - df(fa)) / 24), la = 1.15 * Math.exp((at(fa) - df(fh)) / 24);
  const pois = (l, k) => Math.exp(-l) * l ** k / [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880][k];
  let v = 0, e = 0, d = 0;
  for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) { const p = pois(lh, x) * pois(la, y); if (x > y) v += p; else if (x === y) e += p; else d += p; }
  const t = v + e + d, eu = ev.h === s.tecnico.clube;
  return { vitoria: Math.round((eu ? v : d) / t * 100), empate: Math.round(e / t * 100), derrota: Math.round((eu ? d : v) / t * 100) };
}

// ---------- regionais (estaduais e copas regionais, entre os amistosos e o Brasileirão) ----------
export function iniciarReg(base, s, k) {
  const T = s.reg[k], f = T.fase, F = fasesReg(k)[f], d = dataFaseReg(s.ano, k, f), jogos = [], M = REGIONAIS[k].mata[F.m];
  descansarAte(base, s, d);
  let meu = null;
  for (const [h, a] of jogosDaFaseReg(T)) {
    const x = jogoCopa(base, s, h, a, 'REG', `${s.seed}-${k}${s.ano}-${f}-${h}-${a}`, { mataMata: mataMataReg(F), final: finalReg(k, F), neutro: !!M?.neutro });
    if (x.meu) { meu = x.meu; if (F.perna === 'volta') meu.agg = agregadoReg(T, h, a); } else jogos.push(x.jogo);
  }
  return { reg: k, fase: f, jogos, meu, titulo: `${REGIONAIS[k].nome} · ${F.nome}` };
}
export function concluirReg(base, s, R, simMeu) {
  const k = R.reg, S = REGIONAIS[k], T = s.reg[k], f = R.fase, fases = fasesReg(k), F = fases[f], P = S.premio, nome = c => base.clubes[c].n, N = [], dmN = [];
  const de = S.copa ? 'da' : 'do', jogos = R.jogos.slice(), titulos = { ...T.titulos }, hs = humanos(s), vivos = new Map(hs.map(([ci]) => [ci, vivoReg(T, ci)])), jogaram = new Set();
  if (R.meu) { simMeu.capitao = R.meu.capitao; jogos.push({ h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu, xi: xiDe(R.meu), neutro: R.meu.opts.neutro }); }
  const venc = {}, neutro = !!REGIONAIS[k].mata[F.m]?.neutro;
  for (const jg of jogos) {
    const { h, a, seed, sim } = jg;
    aposJogo(base, s, h, a, daBase(base, sim));
    dmN.push(...posJogo(base, s, h, a, sim, 'REG'));
    const dec = decidirReg(T, h, a, sim.gols, seed, sim.campo);
    venc[`${h}-${a}`] = dec.vencedor;
    T.jogos.push({ fase: f, e: F.e, m: F.m, h, a, gols: sim.gols, pen: dec.pen || null });
    for (const [ci, sv] of hs) {
      if (h !== ci && a !== ci) continue;
      jogaram.add(sv);
      const casa = h === ci, adv = casa ? a : h, my = sim.gols[casa ? 0 : 1], ot = sim.gols[casa ? 1 : 0];
      if (casa && !(jg.neutro ?? neutro)) { const b = bilheteria(base, s, ci, adv, [], 10, sv.fin.ingresso), fator = S.copa ? 0.6 : 0.5; lancar(sv, 'bilheteria', `Bilheteria ${S.curto} × ${nome(adv)} (${Math.round(b.publico * (fator + 0.1)).toLocaleString('pt-BR')} pagantes)`, Math.round(b.renda * fator)); }
      if (f === 0 && P.cota) lancar(sv, 'premio', `${S.nome}: cota de participação`, P.cota);
      if (F.e != null && my > ot && P.vitoria) lancar(sv, 'premio', `${S.nome}: vitória na fase de grupos`, P.vitoria);
      torcidaAposJogo(sv, ci, h, sim.gols, { pen: dec.pen, mataMata: mataMataReg(F), final: finalReg(k, F), classico: rivais(base, h, a) });
      sv.ultima = { rodada: s.rodada - 1, copa: `${S.nome} · ${F.nome}`, div: k, casa: h, fora: a, ...sim, pen: dec.pen || null, xi: jg.xi }; if (jg.vivo) sv.ultimaVivo = jg.vivo; registrarConfronto(base, sv);
      N.push({ tipo: 'clube', clube: ci, texto: `${S.nome}, ${F.nome.toLowerCase()}: ${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.agg ? ` (agregado ${dec.agg[0]} a ${dec.agg[1]})` : ''}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : dec.vantagem ? ' (passa a melhor campanha)' : ''}.` });
    }
  }
  avancarReg(T, jogosDaFaseReg(T).map(([h, a]) => venc[`${h}-${a}`]));
  const prox = fases[T.fase];
  for (const [ci, sv] of hs) {
    const par = T.chaves.find(c => c.includes(ci));
    if (prox?.m != null && prox.m !== F.m && par) {
      if (P.mata?.[prox.m]) lancar(sv, 'premio', `${S.nome}: classificação (${prox.nome.split(' ·')[0].toLowerCase()})`, P.mata[prox.m]);
      N.push({ tipo: 'clube', clube: ci, texto: `${S.nome}: classificado para ${prox.nome.split(' ·')[0].toLowerCase()} contra o ${nome(par.find(x => x !== ci))}.` });
    } else if (vivos.get(ci) && !vivoReg(T, ci) && T.campeao !== ci && T.vice !== ci) N.push({ tipo: 'clube', clube: ci, texto: `${S.nome}: o ${nome(ci)} está eliminado.` });
  }
  for (const [t, c] of Object.entries(T.titulos)) if (titulos[t] == null) N.push({ tipo: ehHumano(s, c) ? 'clube' : 'destaque', clube: c, texto: `${nome(c)} é campeão da ${t}.` });
  if (T.campeao != null && !prox) {
    N.push({ tipo: ehHumano(s, T.campeao) ? 'clube' : 'destaque', clube: T.campeao, texto: `${nome(T.campeao)} é campeão ${de} ${S.nome} ${s.ano} em cima do ${nome(T.vice)}.` });
    const c = vistaDo(s, T.campeao), v = vistaDo(s, T.vice);
    if (c) { if (P.campeao) lancar(c, 'premio', `${S.nome}: prêmio de campeão`, P.campeao); tituloDeCopa(c); }
    if (v && P.vice) lancar(v, 'premio', `${S.nome}: prêmio de vice`, P.vice);
  }
  s.noticias = [...dmN.map(n => ({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n })), ...N.map(n => ({ rodada: s.rodada, div: divNot(base, s, n), copa: true, ...n })), ...s.noticias].slice(0, 220);
  for (const sv of jogaram) correio(base, sv);
  return R.meu ? s.ultima : null;
}
// pré-temporada: até a 1ª rodada da Série A, a cada semana o mercado roda e os salários saem
const SEMANA = 7 * 864e5;
function semanasDoBloco(base, s, ate) {
  if (s.rodada > 0) return;
  const fim = Math.min(+ate, +dataRodada(s.ano, 0)), B = s.semanaBloco?.ano === s.ano ? s.semanaBloco : { ano: s.ano, t: +diaAmistoso(s.ano, 0), n: 0 };
  while (B.t + SEMANA <= fim) {
    B.t += SEMANA; B.n++;
    for (const [, sv] of humanos(s)) { garantirFinancas(base, sv); lancar(sv, 'salarios', 'Salários (7 dias)', -folhaDia(base, sv) * 7, 0); }
    resolverMercado(base, s, 0, B.n);
  }
  s.semanaBloco = B;
}

// competições do ano existem (e saves de antes do calendário de 2026 passam para o formato novo)
export function garantirTemporada(base, s) {
  if (!s.copa || s.copa.ano !== s.ano) novaCopa(base, s);
  else if (s.copa.v !== 2026) migrarCopa(s);
  if (!s.cont || s.cont.ano !== s.ano) novaCont(base, s);
  else if (s.cont.v !== 2026) migrarCont(s);
  if (s.reg?.v !== 2 || s.reg.ano !== s.ano) novaReg(base, s);
  if (s.feitas?.ano !== s.ano) s.feitas = { ano: s.ano, B: Math.min(s.rodada, 38), C: Math.min(s.rodada, N_LIGA.C) };
}
// copa antiga (32 clubes, tudo em ida e volta): a 1ª fase vira a 5ª e o resto anda junto; a final passa a ser única
function migrarCopa(s) {
  const nova = i => i <= 7 ? i + 4 : 12;
  for (const j of s.copa.jogos) j.fase = nova(j.fase);
  Object.assign(s.copa, { v: 2026, fase: s.copa.fase >= 10 ? 13 : nova(s.copa.fase), espera: {} });
}
// Libertadores/Sula antigas: o mata-mata ganha 2 índices (playoff da Sula entra antes das oitavas)
function migrarCont(s) {
  for (const k of ['LIB', 'SUL']) { const T = s.cont[k]; if (!T) continue; T.k ||= k; for (const j of T.jogos) if (j.fase >= 6) j.fase += 2; if (T.fase >= 6) T.fase += 2; }
  s.cont.v = 2026;
}
export const copaSemVoce = garantirTemporada; // nome antigo (migração dos saves)

// rodada de uma divisão: resultados, súmula do seu jogo, bilheteria em casa e notícias da divisão. A rodada da Série A
// é o relógio da temporada: com ela andam as contas, o cargo, o vestiário, os eventos, a Data FIFA e o mercado.
export function concluirRodada(base, s, R, simMeu) {
  s.res = s.res || { A: {}, B: {}, C: {} };
  s.est = s.est || {};
  const d = R.d || base.clubes[s.tecnico.clube].div, jogos = R.jogos.slice(), m = R.meu;
  if (m) { simMeu.capitao = m.capitao; jogos.push({ d: m.d, h: m.h, a: m.a, sim: simMeu, xi: xiDe(m) }); }
  const dmN = [];
  for (const { h, a, sim } of jogos) { (s.res[d] ||= {})[chave(h, a)] = sim.gols; registrar(s.est, sim); if (d === 'A') contarSerieA(s, h, a, sim); cartoesDoTime(s, d, h, a, sim); aposJogo(base, s, h, a, sim); dmN.push(...posJogo(base, s, h, a, sim, 'L')); }
  // o jogo de cada técnico: súmula, confronto, torcida
  const hs = humanos(s), meus = hs.map(([ci, sv]) => [ci, sv, jogos.find(x => x.h === ci || x.a === ci)]).filter(x => x[2]);
  for (const [ci, sv, jg] of meus) {
    sv.ultima = { rodada: R.rd, div: d, casa: jg.h, fora: jg.a, ...jg.sim, xi: jg.xi }; if (jg.vivo) sv.ultimaVivo = jg.vivo;
    registrarConfronto(base, sv);
    torcidaAposJogo(sv, ci, jg.h, jg.sim.gols, { classico: rivais(base, jg.h, jg.a) });
  }
  if (d === 'A') s.rodada++; else s.feitas[d] = (s.feitas[d] || 0) + 1;
  const tabs = Object.fromEntries(DIVS.map(x => [x, tabela(base, s, x)]));
  for (const [ci, sv, jg] of meus) if (jg.h === ci) bilheteriaLiga(base, sv, R.rd, jg.a, tabs[base.clubes[ci].div]);
  gerarNoticias(base, s, R.rd, jogos, tabs, d);
  for (const n of dmN) s.noticias.unshift({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n });
  // a rodada da Série A é o relógio: contas, cargo, vestiário e eventos de cada técnico; a IA troca técnicos, a CBF
  // convoca na Data FIFA e o mercado anda
  if (d === 'A') {
    for (const [ci, sv] of hs) {
      const dv = base.clubes[ci].div;
      for (const txt of contasDaRodada(base, sv, R.rd, null, tabs[dv])) s.noticias.unshift({ rodada: R.rd + 1, tipo: 'clube', clube: ci, evento: true, div: dv, texto: txt });
      for (const n of [...aposRodada(base, sv, tabs), ...vestiarioAposRodada(base, sv, tabs), ...eventosAposRodada(base, sv)]) s.noticias.unshift({ rodada: R.rd + 1, div: base.clubes[n.clube].div, ...n });
    }
    for (const n of [...demissoesIA(base, s, tabs), ...dataFifa(base, s)]) s.noticias.unshift({ rodada: R.rd + 1, div: base.clubes[n.clube]?.div ?? 'A', ...n });
    resolverMercado(base, s, R.rd);
  }
  for (const [ci, sv] of hs) if (d === 'A' || meus.some(x => x[0] === ci)) correio(base, sv);
  return m ? s.ultima : null;
}

// ---------- segunda fase: playoff de acesso da Série B e quadrangulares + final da Série C ----------
// B: 3º×6º e 4º×5º em ida e volta, volta na casa do melhor colocado; empate no agregado classifica o melhor colocado.
// C: 1º, 4º, 5º e 8º num grupo e 2º, 3º, 6º e 7º no outro, em ida e volta; os 2 de cada grupo sobem e os líderes
// decidem o título em ida e volta (volta na casa da melhor campanha; empate vai para os pênaltis).
export const N2 = { B: 2, C: 8 };
export function fase2(base, s, d) {
  if (!N2[d] || !ligaAcabou(s, d)) return null;
  const F = (s.f2 ||= {});
  if (F[d]?.ano === s.ano) return F[d];
  const t = tabela(base, s, d).map(l => l.clube);
  if (d === 'B') return (F.B = { ano: s.ano, i: 0, chaves: [[t[2], t[5]], [t[3], t[4]]], jogos: [], venc: null });
  const grupos = [[t[0], t[3], t[4], t[7]], [t[1], t[2], t[5], t[6]]];
  const rodadas = Array.from({ length: 6 }, (_, r) => grupos.flatMap((g, gi) => pontosCorridos(g, `quad${s.seed}-${s.ano}-${gi}`)[r]));
  return (F.C = { ano: s.ano, i: 0, grupos, rodadas, jogos: [], final: null, campeao: null, vice: null });
}
export function jogosFase2(F, d) {
  if (!F || F.i >= N2[d]) return [];
  if (d === 'B') return F.chaves.map(([x, y]) => F.i === 0 ? [y, x] : [x, y]);
  if (F.i < 6) return F.rodadas[F.i];
  return [F.i === 6 ? [F.final[1], F.final[0]] : F.final];
}
const decisivo2 = (F, d) => d === 'B' ? F.i === 1 : F.i === 7;
function tituloFase2(F, d, par) {
  if (d === 'B') return `Série B · Playoff de acesso (${F.i ? 'volta' : 'ida'})`;
  if (F.i >= 6) return `Série C · Final (${F.i === 6 ? 'ida' : 'volta'})`;
  const g = par ? F.grupos.findIndex(x => x.includes(par[0])) : 0;
  return `Série C · Quadrangular ${g ? 'C' : 'B'} · ${F.i + 1}ª rodada`;
}
// classificação de um quadrangular da C
export function tabelaQuad(F, g) {
  const L = new Map(F.grupos[g].map(c => [c, { clube: c, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, ultimos: [] }]));
  for (const j of F.jogos) if (j.i < 6 && L.has(j.h) && L.has(j.a)) for (const [c, x, y] of [[j.h, j.gols[0], j.gols[1]], [j.a, j.gols[1], j.gols[0]]]) {
    const l = L.get(c); l.j++; l.gp += x; l.gc += y; l.ultimos.push(x > y ? 'V' : x < y ? 'D' : 'E');
    if (x > y) { l.v++; l.p += 3; } else if (x < y) l.d++; else { l.e++; l.p++; }
  }
  return [...L.values()].map(l => ({ ...l, sg: l.gp - l.gc })).sort((a, b) => b.p - a.p || b.v - a.v || b.sg - a.sg || b.gp - a.gp || F.grupos[g].indexOf(a.clube) - F.grupos[g].indexOf(b.clube));
}
export function iniciarLiga2(base, s, d) {
  const F = fase2(base, s, d), jogos = [];
  descansarAte(base, s, dataLiga2(s.ano, d, F.i));
  let meu = null;
  for (const [h, a] of jogosFase2(F, d)) {
    const x = jogoCopa(base, s, h, a, 'L', `${s.seed}-${d}2-${s.ano}-${F.i}-${h}-${a}`, { mataMata: decisivo2(F, d), final: d === 'C' && F.i === 7 });
    if (x.meu) { meu = { ...x.meu, d }; if (decisivo2(F, d)) meu.agg = agregado2(F, h, a); } else jogos.push(x.jogo);
  }
  return { liga2: d, i: F.i, jogos, meu, titulo: tituloFase2(F, d, meu && [meu.h, meu.a]) };
}
function agregado2(F, h, a) { const ida = F.jogos.find(j => j.i === F.i - 1 && j.h === a && j.a === h); return ida ? [ida.gols[1], ida.gols[0]] : [0, 0]; }
export function concluirLiga2(base, s, R, simMeu) {
  const d = R.liga2, F = s.f2[d], nome = c => base.clubes[c].n, N = [], dmN = [], jogos = R.jogos.slice(), decide = decisivo2(F, d), hs = humanos(s), jogaram = new Set();
  if (R.meu) { simMeu.capitao = R.meu.capitao; jogos.push({ h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu, xi: xiDe(R.meu) }); }
  const venc = {};
  for (const jg of jogos) {
    const { h, a, seed, sim } = jg;
    registrar(s.est, sim); cartoesDoTime(s, d, h, a, sim); aposJogo(base, s, h, a, sim); dmN.push(...posJogo(base, s, h, a, sim, 'L'));
    let dec = {};
    if (decide) {
      const ag = agregado2(F, h, a), t = [sim.gols[0] + ag[0], sim.gols[1] + ag[1]];
      if (t[0] !== t[1]) dec = { vencedor: t[0] > t[1] ? h : a, agg: t };
      else if (d === 'B') dec = { vencedor: h, agg: t, vantagem: true }; // a volta é na casa do melhor colocado
      else { const p = penaltis(seed, sim.campo); dec = { vencedor: p[0] > p[1] ? h : a, agg: t, pen: [p[0], p[1]] }; }
    }
    venc[`${h}-${a}`] = dec.vencedor;
    F.jogos.push({ i: F.i, h, a, gols: sim.gols, pen: dec.pen || null });
    const titulo = tituloFase2(F, d, [h, a]);
    for (const [ci, sv] of hs) {
      if (h !== ci && a !== ci) continue;
      jogaram.add(sv);
      if (h === ci) { const b = bilheteria(base, s, ci, a, [], 10, sv.fin.ingresso); lancar(sv, 'bilheteria', `Bilheteria ${titulo.split(' · ').slice(0, 2).join(' · ')} × ${nome(a)} (${b.publico.toLocaleString('pt-BR')} pagantes)`, Math.round(b.renda * 1.15)); }
      torcidaAposJogo(sv, ci, h, sim.gols, { pen: dec.pen, mataMata: decide, final: d === 'C' && F.i === 7, classico: rivais(base, h, a) });
      sv.ultima = { rodada: s.rodada - 1, copa: titulo, div: d, casa: h, fora: a, ...sim, pen: dec.pen || null, xi: jg.xi }; if (jg.vivo) sv.ultimaVivo = jg.vivo; registrarConfronto(base, sv);
      N.push({ tipo: 'clube', clube: ci, texto: `${titulo}: ${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.agg ? ` (agregado ${dec.agg[0]} a ${dec.agg[1]})` : ''}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : dec.vantagem ? ' (passa o melhor colocado)' : ''}.` });
    }
  }
  const vencedores = jogosFase2(F, d).map(([h, a]) => venc[`${h}-${a}`]);
  F.i++;
  const tipo = c => ehHumano(s, c) ? 'clube' : 'destaque';
  if (d === 'B' && F.i === 2) {
    F.venc = vencedores;
    for (const c of vencedores) N.push({ tipo: tipo(c), clube: c, texto: `ACESSO! ${nome(c)} vence o playoff e vai para a Série A.` });
  }
  if (d === 'C' && F.i === 6) {
    const t = [0, 1].map(g => tabelaQuad(F, g)), lider = t.map(x => x[0]), ord = lider[0].p > lider[1].p || (lider[0].p === lider[1].p && lider[0].sg >= lider[1].sg) ? [0, 1] : [1, 0];
    F.final = [lider[ord[0]].clube, lider[ord[1]].clube];
    F.sobem = t.flatMap(x => x.slice(0, 2).map(l => l.clube));
    for (const c of F.sobem) N.push({ tipo: tipo(c), clube: c, texto: `ACESSO! ${nome(c)} garante vaga na Série B.` });
  }
  if (d === 'C' && F.i === 8) { F.campeao = vencedores[0]; F.vice = F.final.find(c => c !== F.campeao); N.push({ tipo: tipo(F.campeao), clube: F.campeao, texto: `${nome(F.campeao)} é campeão da Série C ${s.ano} em cima do ${nome(F.vice)}.` }); const c = vistaDo(s, F.campeao); if (c) tituloDeCopa(c); }
  s.noticias = [...dmN.map(n => ({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n })), ...N.map(n => ({ rodada: s.rodada, ...n, div: d })), ...s.noticias].slice(0, 220);
  for (const sv of jogaram) correio(base, sv);
  return R.meu ? s.ultima : null;
}
// classificação final de cada divisão (acesso, queda, meta): a B põe os vencedores do playoff logo depois dos 2 primeiros;
// a C põe campeão, vice, os outros dois que subiram e o resto do quadrangular na frente da 1ª fase
export function classificacao(base, s, d) {
  const t = tabela(base, s, d).map(l => l.clube), F = s.f2?.[d]?.ano === s.ano ? s.f2[d] : null;
  if (d === 'B' && F?.venc) { const w = t.filter(c => F.venc.includes(c)); return [...t.slice(0, 2), ...w, ...t.slice(2).filter(c => !w.includes(c))]; }
  if (d === 'C' && F?.final) {
    const q = [0, 1].map(g => tabelaQuad(F, g).map(l => l.clube)), topo = F.campeao != null ? [F.campeao, F.vice] : F.final;
    const sobem = [...topo, ...F.sobem.filter(c => !topo.includes(c))], resto = [q[0][2], q[1][2], q[0][3], q[1][3]];
    return [...sobem, ...resto, ...t.filter(c => !sobem.includes(c) && !resto.includes(c))];
  }
  return t;
}
// quem sobe e quem cai em cada divisão (a C cai 2, a A cai 4, a B cai 4)
export function acessoEQueda(base, s) {
  const cl = Object.fromEntries(DIVS.map(d => [d, classificacao(base, s, d)]));
  return { sobe: { B: cl.B.slice(0, 4), C: cl.C.slice(0, 4) }, cai: { A: cl.A.slice(16), B: cl.B.slice(16), C: tabela(base, s, 'C').slice(18).map(l => l.clube) }, cl };
}

// próximo passo: seu próximo jogo (o mundo anda até a data dele antes) ou, se você não tem mais jogo, o mundo anda
// até a próxima data do calendário
export function avancar(base, s) {
  const ev = proximoEvento(base, s), sim = R => R.meu ? simular(R.meu.th, R.meu.ta, R.meu.seed, R.meu.opts) : null;
  if (!ev) { const x = pendentes(base, s)[0]; if (x) mundoAte(base, s, x.data); return null; }
  mundoAte(base, s, ev.data);
  const e = proximoEvento(base, s);
  if (!e) return null;
  return rodar(base, s, e, sim);
}

// cartões de cada clube no campeonato (desempate da CBF): s.cart[div][clube] = [amarelos, vermelhos]
function cartoesDoTime(s, d, h, a, sim) {
  const C = ((s.cart ||= {})[d] ||= {});
  for (const e of sim.eventos) if (e.tipo === 'amarelo' || e.tipo === 'vermelho') { const x = (C[e.time ? a : h] ||= [0, 0]); x[e.tipo === 'vermelho' ? 1 : 0]++; }
}
// critérios da CBF: pontos, vitórias, saldo, gols pró, confronto direto (só empate entre dois), menos vermelhos, menos amarelos, sorteio
function desempate(base, s, d, linhas, res) {
  const C = s.cart?.[d] || {}, sorteio = c => rng(`sorteio${s.seed}${s.ano}${c}`)();
  const chaveT = l => `${l.p}|${l.v}|${l.sg}|${l.gp}`;
  const direto = (x, y) => { let p = 0; for (const [h, a, sx] of [[x, y, 1], [y, x, -1]]) { const g = res[chave(h, a)]; if (g) p += sx * Math.sign(g[0] - g[1]); } return p; }; // >0: x levou a melhor
  linhas.sort((x, y) => y.p - x.p || y.v - x.v || y.sg - x.sg || y.gp - x.gp);
  for (let i = 0; i < linhas.length;) {
    let k = i + 1; while (k < linhas.length && chaveT(linhas[k]) === chaveT(linhas[i])) k++;
    if (k - i > 1) {
      const grupo = linhas.slice(i, k), dois = grupo.length === 2;
      grupo.sort((x, y) => (dois ? direto(y.clube, x.clube) : 0) || (C[x.clube]?.[1] || 0) - (C[y.clube]?.[1] || 0) || (C[x.clube]?.[0] || 0) - (C[y.clube]?.[0] || 0) || sorteio(x.clube) - sorteio(y.clube));
      linhas.splice(i, k - i, ...grupo);
    }
    i = k;
  }
  return linhas;
}
export function tabela(base, s, d) {
  const linhas = new Map(base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d).map(i => [i, { clube: i, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, ultimos: [] }]));
  const res = (s.res && s.res[d]) || {};
  const cal = rodadasDe(base, s, d);
  for (let rd = 0; rd < feitas(s, d); rd++) for (const [h, a] of cal[rd]) {
    const g = res[chave(h, a)]; if (!g) continue;
    const H = linhas.get(h), A = linhas.get(a);
    H.j++; A.j++; H.gp += g[0]; H.gc += g[1]; A.gp += g[1]; A.gc += g[0];
    if (g[0] > g[1]) { H.v++; H.p += 3; A.d++; H.ultimos.push('V'); A.ultimos.push('D'); }
    else if (g[0] < g[1]) { A.v++; A.p += 3; H.d++; H.ultimos.push('D'); A.ultimos.push('V'); }
    else { H.e++; A.e++; H.p++; A.p++; H.ultimos.push('E'); A.ultimos.push('E'); }
  }
  for (const [c, p] of Object.entries(s.puni || {})) if (linhas.has(+c)) linhas.get(+c).p -= p; // pontos perdidos no fair play financeiro
  return desempate(base, s, d, [...linhas.values()].map(l => ({ ...l, sg: l.gp - l.gc, ultimos: l.ultimos.slice(-5) })), res);
}

// o save leva só o necessário (calendário e cache saem)
export function paraSalvar(s) { const { _cal, ...resto } = s; return resto; }
export function resumo(base, s) {
  const ci = s.tecnico.clube, d = base.clubes[ci].div, pos = tabela(base, s, d).findIndex(l => l.clube === ci) + 1;
  const k = feitas(s, d);
  return k ? `${s.ano} · Série ${d} · ${k} de ${N_LIGA[d]} rodadas · ${pos}º lugar` : `${s.ano} · Série ${d} · antes da 1ª rodada`;
}
