// Estado do jogo: cria a carreira, avança rodadas e calcula tabelas.
import { rng, pick, jogador } from './util.js';
import { pontosCorridos, dataRodada, dataAmistoso as diaAmistoso } from './calendario.js';
import { simular, melhorTime, bancoAuto, FORMACOES, POSICOES, PERS, usarFormacao, vagaPara, encaixe, fatorCond, forcaSetores } from './partida.js';
import { fragilidade, indisponiveis, posJogo, TREINO_LES } from './dm.js';
import { garantirCarreira, torcidaAposJogo, aposRodada, tituloDeCopa } from './carreira.js';
import { evoluir } from './treino.js';
import { rivais } from './rivais.js';
import { registrarForma, bonusFase } from './forma.js';
import { correio } from './correio.js';
import { arbitroDo } from './arbitros.js';
import { vestiarioAposRodada } from './vestiario.js';
import { eventosAposRodada } from './eventos.js';
import { TORNEIOS, PREMIO_SUP, FASES_CONT, F_MATA, F_FIN, deFora, dataCont, dataSup, novaCont, contDevida, naCont, supDevida, jogosDaFase, decidirCont, avancarCont, timeFora, jogadorCont, agregadoCont } from './continental.js';
import { gerarNoticias } from './noticias.js';
import { resolverMercado, garantirMercado } from './mercado.js';
import { dataFifa } from './selecao.js';
import { registrarConfronto } from './confrontos.js';
import { REGIONAIS, novaReg, fasesReg, dataFaseReg, jogosDaFaseReg, naReg, regDevida, decidirReg, avancarReg, agregadoReg, mataMataReg, finalReg, vivoReg } from './regionais.js';
import { contasDaRodada, financasIniciais, bilheteria, lancar, folhaDia, garantirFinancas } from './financas.js';
import { FASES, PREMIOS, novaCopa, copaDevida, naCopa, mandoDe, dataCopa, decidir, avancarFase, agregadoIda } from './copa.js';

const DIVS = ['A', 'B', 'C'];

export const REPUTACOES = [
  { k: 0, nome: 'Desconhecido', desc: 'Nunca treinou ninguém. Só clubes pequenos te chamam.', faixa: [0, 0.35] },
  { k: 1, nome: 'Ex-jogador da várzea', desc: 'Conhece o vestiário, mas ninguém lembra de você.', faixa: [0.2, 0.55] },
  { k: 2, nome: 'Ex-jogador profissional', desc: 'Nome conhecido no meio. Clubes médios te ouvem.', faixa: [0.4, 0.8] },
  { k: 3, nome: 'Ex-craque', desc: 'Ídolo nacional. Gigante nenhum fecha a porta.', faixa: [0.7, 1] },
];
export const DIFICULDADES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

// datas: calendario.js (amistosos, regionais e Brasileirão do meio de abril ao começo de dezembro)
export { dataRodada };
// janelas: aberta do 1º amistoso até a 3ª rodada do Brasileirão (regionais inteiros) e do fim de julho ao começo de setembro
export function janelaAberta(ano, r) {
  if (r <= 2) return true;
  const d = dataRodada(ano, Math.min(r, 37)), m = d.getUTCMonth(), dia = d.getUTCDate();
  return (m === 6 && dia >= 20) || m === 7 || (m === 8 && dia <= 2);
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
  garantirCarreira(base, s);
  novaCont(base, s);
  novaCopa(base, s);
  novaReg(base, s);
  s.msgs = [{ id: 'boas-vindas', de: 'presidente', ano: s.ano, rodada: 0, lida: false, assunto: 'Bem-vindo', texto: `${cfg.tecnico.nome}, seja bem-vindo ao ${base.clubes[clube].n}. A partir de agora o diretor de futebol vai te escrever por aqui sempre que precisar de uma decisão sua: desfalques, propostas, contratos, dinheiro. Boa sorte.` }];
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
  if (ci !== s.tecnico.clube && e.de === s.tecnico.clube && j && base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).indexOf(j) < 11) {
    e.liberado = chaveEv(ev);
    lancar(s, 'medo', `Multa da cláusula do medo: ${j.curto} (${base.clubes[ci].n})`, multaMedo(j));
    s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, jogador: j.id, div: base.clubes[s.tecnico.clube].div, texto: `O ${base.clubes[ci].n} paga ${Math.round(multaMedo(j) / 1000).toLocaleString('pt-BR')} mil euros de multa para ${j.curto} enfrentar o clube dono.` });
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
export function escalacao(base, s, ci, comp = compProxima(base, s), poupa = 0) {
  if (s.formPers) usarFormacao(s.formPers);
  const elenco = base.elencos[ci], cond = s.cond || {}, fora = indisponiveis(s, elenco, comp);
  // time alternativo (IA nos regionais): os melhores descansam
  if (poupa && ci !== s.tecnico.clube) for (const j of elenco.filter(j => !fora.has(j.id)).sort((a, b) => b.ovr - a.ovr).slice(0, poupa)) fora.add(j.id);
  for (const j of elenco) if (s.emprestimos?.[j.id]?.medo && barradoMedo(base, s, j.id, ci)) fora.add(j.id);
  if (ci !== s.tecnico.clube) { const t = taticaIA(base, ci); return { ...melhorTime(elenco, t.formacao, fora, cond, bonusFase(s)), estilo: t.estilo, gatilhos: t.gatilhos }; }
  let time = null, trocados = [];
  if (s.xi?.length === 11) {
    const porId = new Map(elenco.map(j => [j.id, j])), xi = s.xi.map(id => porId.get(id));
    if (xi.every(Boolean)) {
      const usados = new Set(xi.filter(j => !fora.has(j.id)).map(j => j.id)), slots = FORMACOES[s.formacao];
      const rende = (j, slot) => j.ovr * encaixe(j.pos, slot) * fatorCond(cond[j.id]);
      time = { formacao: s.formacao, xi: xi.map((j, i) => {
        if (!fora.has(j.id)) return j;
        const sub = elenco.filter(x => !usados.has(x.id) && !fora.has(x.id)).sort((a, b) => rende(b, slots[i]) - rende(a, slots[i]))[0];
        if (sub) { usados.add(sub.id); trocados.push([j, sub]); }
        return sub || j; // sem ninguém para pôr, ele vai assim mesmo
      }) };
    }
  }
  time = time || melhorTime(elenco, s.formacao, fora, cond, bonusFase(s));
  const usados = new Set(time.xi.filter(Boolean).map(j => j.id)), resto = elenco.filter(j => !usados.has(j.id) && !fora.has(j.id));
  const banco = s.banco ? s.banco.map(id => resto.find(j => j.id === id)).filter(Boolean).slice(0, 9) : bancoAuto(resto, cond);
  return { formacao: time.formacao, xi: time.xi, banco, estilo: s.estilo || 'equilibrado', gatilhos: s.gatilhos || {}, cobrador: s.cobrador, capitao: capitaoDe(base, s, time.xi.filter(Boolean)), trocados, fora };
}
// quem tem histórico de lesão, idade e treino puxado se machuca mais
const fase = s => bonusFase(s);
// casa cheia empurra: mando de 1,03 (vazio) a 1,11 (lotado)
const fatorCasa = (base, s, h, a) => 1.03 + 0.08 * bilheteria(base, s, h, a, [], 10, h === s.tecnico.clube ? s.fin?.ingresso || 'normal' : 'normal').occ;
const fragilDe = (base, s) => id => { const j = base.jog.get(id); return fragilidade(s, j) * (j?.clube === s.tecnico.clube ? TREINO_LES[s.treino] || 1 : 1); };

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
    const q = 0.18 * ageF * treino, nova = c + (100 - c) * (1 - (1 - q) ** dias); // recupera um pouco por dia: 3 dias não bastam, uma semana quase
    if (nova > 99.5) delete s.cond[id]; else s.cond[id] = Math.round(nova * 10) / 10;
  }
  for (const [id, m] of Object.entries(s.mor)) { const nova = m + (62 - m) * (1 - 0.96 ** dias); if (Math.abs(nova - 62) < 0.5) delete s.mor[id]; else s.mor[id] = Math.round(nova * 10) / 10; }
}

// depois do jogo: condição de quem jogou e moral (resultado, nota, capitão)
function aposJogo(base, s, h, a, sim) {
  for (const [id, c] of Object.entries(sim.cond || {})) s.cond[id] = c;
  // fase: média recente das notas; seu jogador que entra em fase excelente ou péssima vira notícia
  for (const t of [0, 1]) for (const [id, , depois] of registrarForma(s, sim.notas[t])) {
    const j = base.jog.get(id);
    if (j && j.clube === s.tecnico.clube && (depois.k === 'excelente' || depois.k === 'pessima')) s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', jogador: id, div: base.clubes[j.clube].div, texto: depois.k === 'excelente' ? `${j.curto} vive fase excelente e rende acima do próprio nível.` : `${j.curto} atravessa fase péssima. A torcida já pede mudança.` });
  }
  const k = rivais(base, h, a) ? 2 : 1, res = sim.gols[0] > sim.gols[1] ? [4 * k, -4 * k] : sim.gols[0] < sim.gols[1] ? [-4 * k, 4 * k] : [0, 0]; // clássico vale o dobro no vestiário
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
    for (const n of evoluir(base, s, ci, sim.notas[ci === h ? 0 : 1])) s.noticias.unshift({ rodada: s.rodada, div: base.clubes[ci].div, clube: ci, ...n });
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
export const POS_VAGA = ['ZAG', 'LE', 'LD', 'VOL', 'MC', 'ME', 'MD', 'MEI', 'PE', 'PD', 'SA', 'CA'];
// muda a posição de uma vaga (a formação vira "Personalizada"; quem está na vaga continua nela)
export function editarVaga(base, s, i, pos) {
  if (s.formPers) usarFormacao(s.formPers);
  if (!(i > 0 && i < 11) || !POS_VAGA.includes(pos)) return 'Essa vaga não muda.';
  const slots = (POSICOES[s.formacao] || POSICOES['4-3-3']).map(x => x.slice());
  slots[i] = vagaPara(slots[i], pos, slots.filter((_, k) => k !== i));
  s.formPers = slots; usarFormacao(slots); s.formacao = PERS;
  return null;
}
// empurra a vaga no campo (setas no modo de editar posições)
export function moverVaga(base, s, i, dx, dy) {
  if (s.formPers) usarFormacao(s.formPers);
  if (!(i > 0 && i < 11)) return 'O goleiro não sai do gol.';
  const slots = (POSICOES[s.formacao] || POSICOES['4-3-3']).map(x => x.slice());
  slots[i][1] = Math.max(6, Math.min(94, slots[i][1] + dx)); slots[i][2] = Math.max(10, Math.min(84, slots[i][2] + dy));
  s.formPers = slots; usarFormacao(slots); s.formacao = PERS;
  return null;
}
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
  if (s.rodada === 0) regAte(base, s, dataRodada(s.ano, 0)); // fecha a pré-temporada e os regionais antes da estreia
  copaSemVoce(base, s); contSemVoce(base, s);
  const rd = s.rodada, ci = s.tecnico.clube, jogos = [];
  descansarAte(base, s, dataRodada(s.ano, rd));
  let meu = null;
  for (const d of DIVS) for (const [h, a] of rodadasDe(base, s, d)[rd]) {
    const th = escalacao(base, s, h, 'L'), ta = escalacao(base, s, a, 'L'), seed = `${s.seed}-${d}-${rd}-${h}-${a}`;
    const opts = { cond: s.cond, mor: s.mor, auto: [h === ci ? s.subsAuto !== false : true, a === ci ? s.subsAuto !== false : true], fragil: fragilDe(base, s), fase: fase(s), mando: fatorCasa(base, s, h, a), arbitro: arbitroDo(s, seed) };
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
  const ci = s.tecnico.clube, ev = [];
  if (s.rodada === 0 && !s.demitido) { const A = garantirAmistosos(base, s), i = A.jogos.findIndex(x => !x.g); if (i >= 0) ev.push({ tipo: 'amistoso', i, h: A.jogos[i].h, a: A.jogos[i].a, data: dataAmistoso(s, A.jogos[i]), titulo: `Amistoso de pré-temporada (${i + 1}/${A.jogos.length})` }); }
  if (supDevida(s) && [s.cont.sup.h, s.cont.sup.a].includes(ci)) ev.push({ tipo: 'sup', h: s.cont.sup.h, a: s.cont.sup.a, data: dataSup(dataRodada, s.ano), titulo: 'Supercopa do Brasil · final', neutro: true });
  if (copaDevida(s) && naCopa(s, ci)) {
    const i = s.copa.fase, [h, a] = mandoDe(i, s.copa.chaves.find(c => c.includes(ci)));
    ev.push({ tipo: 'copa', fase: i, h, a, data: dataCopa(dataRodada, s.ano, i), titulo: `Copa do Brasil · ${FASES[i].nome}` });
  }
  for (const k of ['LIB', 'SUL']) if (contDevida(s, k) && naCont(s, k, ci)) {
    const T = s.cont[k], [h, a] = jogosDaFase(T).find(j => j.includes(ci));
    ev.push({ tipo: 'cont', k, fase: T.fase, h, a, data: dataCont(dataRodada, s.ano, T.fase), titulo: `${TORNEIOS[k].nome} · ${FASES_CONT[T.fase].nome}`, neutro: T.fase === F_FIN });
  }
  for (const k of Object.keys(REGIONAIS)) if (regDevida(s, k, dataRodada(s.ano, s.rodada)) && naReg(s, k, ci)) {
    const T = s.reg[k], F = fasesReg(k)[T.fase], [h, a] = jogosDaFaseReg(T).find(j => j.includes(ci));
    ev.push({ tipo: 'reg', k, fase: T.fase, h, a, data: dataFaseReg(s.ano, k, T.fase), titulo: `${REGIONAIS[k].nome} · ${F.nome}`, mataMata: mataMataReg(F), final: finalReg(k, F), neutro: !!REGIONAIS[k].mata[F.m]?.neutro });
  }
  if (ev.length) return ev.sort((x, y) => x.data - y.data)[0];
  if (s.rodada >= 38) return null;
  const d = base.clubes[ci].div, [h, a] = rodadasDe(base, s, d)[s.rodada].find(j => j.includes(ci));
  return { tipo: 'liga', rodada: s.rodada, h, a, data: dataRodada(s.ano, s.rodada), titulo: `Série ${d} · ${s.rodada + 1}ª rodada` };
}

export function iniciarCopa(base, s) {
  const i = s.copa.fase, ci = s.tecnico.clube, jogos = [];
  descansarAte(base, s, dataCopa(dataRodada, s.ano, i));
  let meu = null;
  for (const chave of s.copa.chaves) {
    const [h, a] = mandoDe(i, chave), th = escalacao(base, s, h, 'CB'), ta = escalacao(base, s, a, 'CB'), seed = `${s.seed}-copa${s.ano}-${i}-${h}-${a}`;
    const opts = { cond: s.cond, mor: s.mor, auto: [h === ci ? s.subsAuto !== false : true, a === ci ? s.subsAuto !== false : true], fragil: fragilDe(base, s), fase: fase(s), mando: fatorCasa(base, s, h, a), arbitro: arbitroDo(s, seed) };
    if (h === ci || a === ci) meu = { d: 'copa', h, a, th, ta, seed, humano: h === ci ? 0 : 1, opts, capitao: (h === ci ? th : ta).capitao, mataMata: FASES[i].perna === 'volta', final: FASES[i].k === 'fin' && FASES[i].perna === 'volta', agg: FASES[i].perna === 'volta' ? agregadoIda(s, h, a) : [0, 0] };
    else jogos.push({ h, a, seed, sim: simular(th, ta, seed, opts) });
  }
  return { copa: true, fase: i, jogos, meu, titulo: `Copa do Brasil · ${FASES[i].nome}` };
}

export function concluirCopa(base, s, R, simMeu) {
  const i = R.fase, ci = s.tecnico.clube, k = FASES[i].k, volta = FASES[i].perna === 'volta', fin = k === 'fin' && volta, N = [], vencedores = [], nome = c => base.clubes[c].n;
  const jogos = R.jogos.slice();
  if (R.meu) { simMeu.capitao = R.meu.capitao; jogos.push({ h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu }); }
  const dmN = [];
  for (const { h, a, seed, sim } of jogos) {
    aposJogo(base, s, h, a, sim);
    dmN.push(...posJogo(base, s, h, a, sim, 'CB'));
    const dec = decidir(s, i, h, a, sim.gols, seed, sim.campo);
    s.copa.jogos.push({ fase: i, h, a, gols: sim.gols, pen: dec.pen || null });
    for (const e of sim.eventos) if (e.tipo === 'gol') s.copa.art[e.jogador] = (s.copa.art[e.jogador] || 0) + 1;
    if (dec.vencedor != null) vencedores.push(dec.vencedor);
    const meuJogo = h === ci || a === ci, placar = `${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${volta && dec.agg ? ` (agregado ${dec.agg[0]} a ${dec.agg[1]})` : ''}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : ''}`;
    if (meuJogo) {
      if (h === ci) { const b = bilheteria(base, s, ci, a, [], 10, s.fin.ingresso); lancar(s, 'bilheteria', `Bilheteria Copa do Brasil × ${nome(a)} (${b.publico.toLocaleString('pt-BR')} pagantes)`, b.renda); }
      torcidaAposJogo(s, ci, h, sim.gols, { pen: dec.pen, mataMata: volta, final: fin, classico: rivais(base, h, a) });
      s.ultima = { rodada: s.rodada - 1, copa: FASES[i].nome, div: 'copa', casa: h, fora: a, ...sim, pen: dec.pen || null, xi: [R.meu.th.xi.map(j => j.id), R.meu.ta.xi.map(j => j.id)] }; registrarConfronto(base, s);
      N.push({ tipo: 'clube', texto: `Copa do Brasil, ${FASES[i].nome.toLowerCase()}: ${placar}.${dec.vencedor === ci ? (fin ? ' É CAMPEÃO!' : ' Classificado!') : dec.perdedor === ci ? ' Eliminado.' : ''}` });
    }
  }
  const avancou = vencedores.includes(ci);
  avancarFase(s, vencedores);
  if (fin) {
    N.push({ tipo: 'destaque', texto: `${nome(s.copa.campeao)} é campeão da Copa do Brasil ${s.ano} em cima do ${nome(s.copa.vice)}.` });
    if (s.copa.campeao === ci) { lancar(s, 'premio', 'Copa do Brasil: prêmio de campeão', PREMIOS.campeao); tituloDeCopa(s); }
    if (s.copa.vice === ci) lancar(s, 'premio', 'Copa do Brasil: prêmio de vice', PREMIOS.vice);
  } else if (avancou && volta) {
    const prox = FASES[s.copa.fase], ch = s.copa.chaves.find(c => c.includes(ci)), adv = ch.find(x => x !== ci), etapa = prox.nome.split(' ·')[0].toLowerCase();
    if (PREMIOS[prox.k]) lancar(s, 'premio', `Copa do Brasil: classificação para ${prox.k === 'fin' ? 'a final' : etapa}`, PREMIOS[prox.k]);
    N.push({ tipo: 'clube', texto: `Sorteio da Copa do Brasil: ${prox.k === 'fin' ? 'final' : etapa} contra o ${nome(adv)}, ${ch[0] === ci ? 'com a ida em casa' : 'com a volta em casa'}.` });
  }
  s.noticias = [...dmN.map(n => ({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n })), ...N.map(n => ({ rodada: s.rodada, div: base.clubes[ci].div, copa: true, ...n })), ...s.noticias].slice(0, 220);
  if (R.meu || !R.cont) correio(base, s);
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
  return { jogo: { h, a, seed, sim: simular(th, ta, seed, opts) } };
}
export function iniciarCont(base, s, k) {
  const T = s.cont[k], f = T.fase, jogos = [];
  descansarAte(base, s, dataCont(dataRodada, s.ano, f));
  let meu = null;
  for (const [h, a] of jogosDaFase(T)) {
    const volta = FASES_CONT[f].perna === 'volta', x = jogoCopa(base, s, h, a, k, `${s.seed}-${k}${s.ano}-${f}-${h}-${a}`, { mataMata: f >= F_MATA && FASES_CONT[f].perna !== 'ida', neutro: f === F_FIN, final: f === F_FIN });
    if (x.meu) { meu = x.meu; if (volta) meu.agg = agregadoCont(T, h, a); } else jogos.push(x.jogo);
  }
  return { cont: k, fase: f, jogos, meu, titulo: `${TORNEIOS[k].nome} · ${FASES_CONT[f].nome}` };
}
export function concluirCont(base, s, R, simMeu) {
  const k = R.cont, T = s.cont[k], f = R.fase, P = TORNEIOS[k].premio, ci = s.tecnico.clube, nome = c => base.clubes[c].n, N = [], dmN = [];
  const jogos = R.jogos.slice();
  if (R.meu) { simMeu.capitao = R.meu.capitao; jogos.push({ h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu }); }
  const venc = {};
  for (const { h, a, seed, sim } of jogos) {
    aposJogo(base, s, h, a, daBase(base, sim));
    dmN.push(...posJogo(base, s, h, a, sim, k));
    const dec = decidirCont(T, f, h, a, sim.gols, seed, sim.campo);
    venc[`${h}-${a}`] = dec.vencedor;
    T.jogos.push({ fase: f, h, a, gols: sim.gols, pen: dec.pen || null });
    for (const e of sim.eventos) if (e.tipo === 'gol') { const j = jogadorCont(base, s.ano, e.jogador), x = T.art[e.jogador] || (T.art[e.jogador] = [0, j?.curto || '?', j?.clube ?? (e.time ? a : h)]); x[0]++; }
    if (h !== ci && a !== ci) continue;
    const casa = h === ci, adv = casa ? a : h, my = sim.gols[casa ? 0 : 1], ot = sim.gols[casa ? 1 : 0];
    if (casa && f !== F_FIN) { const b = bilheteria(base, s, ci, adv, [], 10, s.fin.ingresso); lancar(s, 'bilheteria', `Bilheteria ${TORNEIOS[k].nome} × ${nome(adv)} (${b.publico.toLocaleString('pt-BR')} pagantes)`, b.renda); }
    if (f === 0) lancar(s, 'premio', `${TORNEIOS[k].nome}: cota da fase de grupos`, P.grupos);
    if (f < F_MATA && my > ot) lancar(s, 'premio', `${TORNEIOS[k].nome}: vitória na fase de grupos`, P.vitoria);
    torcidaAposJogo(s, ci, h, sim.gols, { pen: dec.pen, mataMata: f >= F_MATA && FASES_CONT[f].perna !== 'ida', final: f === F_FIN, classico: rivais(base, h, a) });
    s.ultima = { rodada: s.rodada - 1, copa: `${TORNEIOS[k].nome} · ${FASES_CONT[f].nome}`, div: k, casa: h, fora: a, ...sim, pen: dec.pen || null, xi: [R.meu.th.xi.map(j => j.id), R.meu.ta.xi.map(j => j.id)] }; registrarConfronto(base, s);
    N.push({ tipo: 'clube', texto: `${TORNEIOS[k].nome}, ${FASES_CONT[f].nome.toLowerCase()}: ${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.agg ? ` (agregado ${dec.agg[0]} a ${dec.agg[1]})` : ''}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : ''}.${dec.vencedor === ci ? (f === F_FIN ? ' É CAMPEÃO!' : ' Classificado!') : dec.perdedor === ci ? ' Eliminado.' : ''}` });
  }
  const vencedores = jogosDaFase(T).map(([h, a]) => venc[`${h}-${a}`]);
  avancarCont(T, vencedores);
  if (f === F_MATA - 1) {
    const passou = T.chaves.some(c => c.includes(ci)), estava = T.grupos.some(g => g.includes(ci));
    if (estava) { N.push({ tipo: 'clube', texto: passou ? `${TORNEIOS[k].nome}: classificado para as oitavas de final contra o ${nome(T.chaves.find(c => c.includes(ci)).find(x => x !== ci))}.` : `${TORNEIOS[k].nome}: eliminado na fase de grupos.` }); if (passou) lancar(s, 'premio', `${TORNEIOS[k].nome}: classificação para as oitavas`, P.oit); }
  } else if (FASES_CONT[f].perna === 'volta') {
    const kf = FASES_CONT[f].k;
    if (T.chaves.some(c => c.includes(ci))) lancar(s, 'premio', `${TORNEIOS[k].nome}: classificação para ${{ oit: 'as quartas', qua: 'a semifinal', sem: 'a final' }[kf]}`, { oit: P.qua, qua: P.sem, sem: P.fin }[kf]);
  } else if (f === F_FIN) {
    N.push({ tipo: 'destaque', texto: `${nome(T.campeao)} é campeão da ${TORNEIOS[k].nome} ${s.ano} em cima do ${nome(T.vice)}.` });
    if (T.campeao === ci) { lancar(s, 'premio', `${TORNEIOS[k].nome}: prêmio de campeão`, P.campeao); tituloDeCopa(s); }
  }
  s.noticias = [...dmN.map(n => ({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n })), ...N.map(n => ({ rodada: s.rodada, div: base.clubes[ci].div, copa: true, ...n })), ...s.noticias].slice(0, 220);
  if (R.meu || !R.cont) correio(base, s);
  return R.meu ? s.ultima : null;
}
export function iniciarSup(base, s) {
  const { h, a } = s.cont.sup;
  if ([h, a].includes(s.tecnico.clube)) regAte(base, s, dataSup(dataRodada, s.ano));
  descansarAte(base, s, dataSup(dataRodada, s.ano));
  const x = jogoCopa(base, s, h, a, 'SUP', `${s.seed}-sup${s.ano}-${h}-${a}`, { mataMata: true, neutro: true, final: true });
  return { sup: true, jogos: x.jogo ? [x.jogo] : [], meu: x.meu || null, titulo: 'Supercopa do Brasil · final' };
}
export function concluirSup(base, s, R, simMeu) {
  const ci = s.tecnico.clube, nome = c => base.clubes[c].n, { h, a, seed, sim } = R.meu ? { h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu } : R.jogos[0];
  if (R.meu) simMeu.capitao = R.meu.capitao;
  aposJogo(base, s, h, a, sim);
  const dmN = posJogo(base, s, h, a, sim, 'SUP'), dec = decidirCont({}, F_FIN, h, a, sim.gols, seed, sim.campo);
  s.cont.sup.jogo = { h, a, gols: sim.gols, pen: dec.pen || null, campeao: dec.vencedor };
  const placar = `${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : ''}`;
  if (R.meu) {
    torcidaAposJogo(s, ci, h, sim.gols, { pen: dec.pen, mataMata: true, final: true });
    lancar(s, 'premio', `Supercopa do Brasil: ${dec.vencedor === ci ? 'campeão' : 'vice'}`, dec.vencedor === ci ? PREMIO_SUP.campeao : PREMIO_SUP.vice);
    s.ultima = { rodada: -1, copa: 'Supercopa do Brasil · final', div: 'SUP', casa: h, fora: a, ...sim, pen: dec.pen || null, xi: [R.meu.th.xi.map(j => j.id), R.meu.ta.xi.map(j => j.id)] }; registrarConfronto(base, s);
  }
  const N = [{ tipo: dec.vencedor === ci ? 'clube' : 'destaque', texto: `Supercopa do Brasil: ${placar}. ${nome(dec.vencedor)} é campeão.` }];
  s.noticias = [...dmN, ...N].map(n => ({ rodada: 0, div: base.clubes[n.clube ?? ci].div, copa: true, ...n })).concat(s.noticias).slice(0, 220);
  if (R.meu || !R.cont) correio(base, s);
  return R.meu ? s.ultima : null;
}
// ---------- amistosos de pré-temporada ----------
// três jogos na primeira semana de janeiro, antes dos regionais: um contra time menor (em casa), um parelho (fora) e um de fora do país (em casa).
// Não contam para nada: dão ritmo, cansam um pouco, mexem pouco na moral e rendem uma bilheteria pequena.
const dataAmistoso = (s, J) => diaAmistoso(s.ano, s.amistosos.jogos.indexOf(J));
function garantirAmistosos(base, s) {
  const ci = s.tecnico.clube;
  if (s.amistosos?.ano === s.ano && s.amistosos.clube === ci) return s.amistosos;
  const r = rng(`amist${s.seed}${s.ano}${ci}`), f = base.forca(ci), usados = new Set([ci]);
  const perto = (l, alvo) => l.filter(i => !usados.has(i)).sort((a, b) => Math.abs(base.forca(a) - alvo) - Math.abs(base.forca(b) - alvo)).slice(0, 6);
  const br = base.clubes.map((c, i) => i).filter(i => DIVS.includes(base.clubes[i].div) && !rivais(base, i, ci));
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
  s.noticias.unshift({ rodada: 0, tipo: 'clube', div: base.clubes[ci].div, texto: `${R.titulo}: ${nome(J.h)} ${simMeu.gols[0]} × ${simMeu.gols[1]} ${nome(J.a)}.` });
  correio(base, s);
  return s.ultima;
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
  if (naReg(s, k, s.tecnico.clube)) regAte(base, s, d); // o que vem antes (outros regionais, Supercopa, semanas do mercado) anda primeiro
  descansarAte(base, s, d);
  let meu = null;
  for (const [h, a] of jogosDaFaseReg(T)) {
    const x = jogoCopa(base, s, h, a, 'REG', `${s.seed}-${k}${s.ano}-${f}-${h}-${a}`, { mataMata: mataMataReg(F), final: finalReg(k, F), neutro: !!M?.neutro });
    if (x.meu) { meu = x.meu; if (F.perna === 'volta') meu.agg = agregadoReg(T, h, a); } else jogos.push(x.jogo);
  }
  return { reg: k, fase: f, jogos, meu, titulo: `${REGIONAIS[k].nome} · ${F.nome}` };
}
export function concluirReg(base, s, R, simMeu) {
  const k = R.reg, S = REGIONAIS[k], T = s.reg[k], f = R.fase, fases = fasesReg(k), F = fases[f], P = S.premio, ci = s.tecnico.clube, nome = c => base.clubes[c].n, N = [], dmN = [];
  const de = S.copa ? 'da' : 'do', jogos = R.jogos.slice(), titulos = { ...T.titulos }, vivo = vivoReg(T, ci);
  if (R.meu) { simMeu.capitao = R.meu.capitao; jogos.push({ h: R.meu.h, a: R.meu.a, seed: R.meu.seed, sim: simMeu }); }
  const venc = {};
  for (const { h, a, seed, sim } of jogos) {
    aposJogo(base, s, h, a, daBase(base, sim));
    dmN.push(...posJogo(base, s, h, a, sim, 'REG'));
    const dec = decidirReg(T, h, a, sim.gols, seed, sim.campo);
    venc[`${h}-${a}`] = dec.vencedor;
    T.jogos.push({ fase: f, e: F.e, m: F.m, h, a, gols: sim.gols, pen: dec.pen || null });
    if (h !== ci && a !== ci) continue;
    const casa = h === ci, adv = casa ? a : h, my = sim.gols[casa ? 0 : 1], ot = sim.gols[casa ? 1 : 0];
    if (casa && !R.meu?.opts.neutro) { const b = bilheteria(base, s, ci, adv, [], 10, s.fin.ingresso), fator = S.copa ? 0.6 : 0.5; lancar(s, 'bilheteria', `Bilheteria ${S.curto} × ${nome(adv)} (${Math.round(b.publico * (fator + 0.1)).toLocaleString('pt-BR')} pagantes)`, Math.round(b.renda * fator)); }
    if (f === 0 && P.cota) lancar(s, 'premio', `${S.nome}: cota de participação`, P.cota);
    if (F.e != null && my > ot && P.vitoria) lancar(s, 'premio', `${S.nome}: vitória na fase de grupos`, P.vitoria);
    torcidaAposJogo(s, ci, h, sim.gols, { pen: dec.pen, mataMata: mataMataReg(F), final: finalReg(k, F), classico: rivais(base, h, a) });
    s.ultima = { rodada: s.rodada - 1, copa: `${S.nome} · ${F.nome}`, div: k, casa: h, fora: a, ...sim, pen: dec.pen || null, xi: [R.meu.th.xi.map(j => j.id), R.meu.ta.xi.map(j => j.id)] }; registrarConfronto(base, s);
    N.push({ tipo: 'clube', texto: `${S.nome}, ${F.nome.toLowerCase()}: ${nome(h)} ${sim.gols[0]} × ${sim.gols[1]} ${nome(a)}${dec.agg ? ` (agregado ${dec.agg[0]} a ${dec.agg[1]})` : ''}${dec.pen ? ` (${dec.pen[0]} a ${dec.pen[1]} nos pênaltis)` : dec.vantagem ? ' (passa a melhor campanha)' : ''}.` });
  }
  avancarReg(T, jogosDaFaseReg(T).map(([h, a]) => venc[`${h}-${a}`]));
  const prox = fases[T.fase], par = T.chaves.find(c => c.includes(ci));
  if (prox?.m != null && prox.m !== F.m && par) {
    if (P.mata?.[prox.m]) lancar(s, 'premio', `${S.nome}: classificação (${prox.nome.split(' ·')[0].toLowerCase()})`, P.mata[prox.m]);
    N.push({ tipo: 'clube', texto: `${S.nome}: classificado para ${prox.nome.split(' ·')[0].toLowerCase()} contra o ${nome(par.find(x => x !== ci))}.` });
  } else if (vivo && !vivoReg(T, ci) && T.campeao !== ci && T.vice !== ci) N.push({ tipo: 'clube', texto: `${S.nome}: o ${nome(ci)} está eliminado.` });
  for (const [t, c] of Object.entries(T.titulos)) if (titulos[t] == null) N.push({ tipo: c === ci ? 'clube' : 'destaque', texto: `${nome(c)} é campeão da ${t}.` });
  if (T.campeao != null && !prox) {
    N.push({ tipo: T.campeao === ci ? 'clube' : 'destaque', texto: `${nome(T.campeao)} é campeão ${de} ${S.nome} ${s.ano} em cima do ${nome(T.vice)}.` });
    if (T.campeao === ci) { if (P.campeao) lancar(s, 'premio', `${S.nome}: prêmio de campeão`, P.campeao); tituloDeCopa(s); }
    if (T.vice === ci && P.vice) lancar(s, 'premio', `${S.nome}: prêmio de vice`, P.vice);
  }
  s.noticias = [...dmN.map(n => ({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n })), ...N.map(n => ({ rodada: s.rodada, div: base.clubes[ci].div, copa: true, ...n })), ...s.noticias].slice(0, 220);
  if (R.meu) correio(base, s);
  return R.meu ? s.ultima : null;
}
// pré-temporada e regionais: o que não envolve o seu clube (regionais e Supercopa) anda até a data, na ordem das datas,
// e a cada semana o mercado roda e os salários saem
export function regAte(base, s, ate) {
  if (s.reg?.v !== 2 || s.reg.ano !== s.ano) novaReg(base, s);
  const ci = s.tecnico.clube;
  for (;;) {
    let px = null;
    for (const k of Object.keys(REGIONAIS)) if (regDevida(s, k, ate) && !naReg(s, k, ci)) { const d = dataFaseReg(s.ano, k, s.reg[k].fase); if (!px || d < px.d) px = { k, d }; }
    const ds = dataSup(dataRodada, s.ano);
    if (supDevida(s) && ![s.cont.sup.h, s.cont.sup.a].includes(ci) && +ds < +ate && (!px || ds <= px.d)) { semanasDoBloco(base, s, ds); concluirSup(base, s, iniciarSup(base, s), null); continue; }
    if (!px) break;
    semanasDoBloco(base, s, px.d);
    concluirReg(base, s, iniciarReg(base, s, px.k), null);
  }
  semanasDoBloco(base, s, ate);
}
const SEMANA = 7 * 864e5;
function semanasDoBloco(base, s, ate) {
  if (s.rodada > 0) return;
  const fim = Math.min(+ate, +dataRodada(s.ano, 0)), B = s.semanaBloco?.ano === s.ano ? s.semanaBloco : { ano: s.ano, t: +diaAmistoso(s.ano, 0), n: 0 };
  while (B.t + SEMANA <= fim) {
    B.t += SEMANA; B.n++;
    garantirFinancas(base, s);
    lancar(s, 'salarios', 'Salários (7 dias)', -folhaDia(base, s) * 7, 0);
    resolverMercado(base, s, 0, B.n);
  }
  s.semanaBloco = B;
}

// fases que não envolvem o seu clube (ou já atrasadas) se resolvem sozinhas
export function contSemVoce(base, s) {
  if (!s.cont || s.cont.ano !== s.ano) novaCont(base, s);
  const ci = s.tecnico.clube;
  if (supDevida(s) && ![s.cont.sup.h, s.cont.sup.a].includes(ci)) concluirSup(base, s, iniciarSup(base, s), null);
  for (const k of ['LIB', 'SUL']) while (contDevida(s, k) && !naCont(s, k, ci)) concluirCont(base, s, iniciarCont(base, s, k), null);
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
  const dmN = [];
  for (const { d, h, a, sim } of jogos) { s.res[d][chave(h, a)] = sim.gols; registrar(s.est, sim); aposJogo(base, s, h, a, sim); dmN.push(...posJogo(base, s, h, a, sim, 'L')); }
  const m = R.meu;
  s.ultima = m ? { rodada: R.rd, div: m.d, casa: m.h, fora: m.a, ...simMeu, xi: [m.th.xi.map(j => j.id), m.ta.xi.map(j => j.id)] } : null;
  if (m) registrarConfronto(base, s);
  if (m && simMeu) torcidaAposJogo(s, s.tecnico.clube, m.h, simMeu.gols, { classico: rivais(base, m.h, m.a) });
  s.rodada++;
  const tabs = Object.fromEntries(DIVS.map(d => [d, tabela(base, s, d)]));
  gerarNoticias(base, s, R.rd, jogos, tabs);
  const casa = R.meu && R.meu.h === s.tecnico.clube ? { adv: R.meu.a } : null;
  for (const txt of contasDaRodada(base, s, R.rd, casa, tabs[base.clubes[s.tecnico.clube].div])) s.noticias.unshift({ rodada: R.rd + 1, tipo: 'clube', evento: true, div: base.clubes[s.tecnico.clube].div, texto: txt });
  for (const n of dmN) s.noticias.unshift({ rodada: R.rd + 1, div: base.clubes[n.clube].div, ...n });
  for (const n of [...aposRodada(base, s, tabs), ...vestiarioAposRodada(base, s, tabs), ...eventosAposRodada(base, s), ...dataFifa(base, s)]) s.noticias.unshift({ rodada: R.rd + 1, div: base.clubes[n.clube].div, ...n });
  resolverMercado(base, s, R.rd);
  if (!naCopa(s, s.tecnico.clube)) copaSemVoce(base, s);
  contSemVoce(base, s);
  regAte(base, s, dataRodada(s.ano, s.rodada));
  correio(base, s);
  return s.ultima;
}

// rodada inteira de uma vez (jogo do usuário simulado direto)
export function avancar(base, s) {
  const ev = proximoEvento(base, s), sim = R => R.meu ? simular(R.meu.th, R.meu.ta, R.meu.seed, R.meu.opts) : null;
  if (ev?.tipo === 'amistoso') { const R = iniciarAmistoso(base, s); return concluirAmistoso(base, s, R, sim(R)); }
  if (ev?.tipo === 'reg') { const R = iniciarReg(base, s, ev.k); return concluirReg(base, s, R, sim(R)); }
  if (ev?.tipo === 'copa') { const R = iniciarCopa(base, s); return concluirCopa(base, s, R, sim(R)); }
  if (ev?.tipo === 'cont') { const R = iniciarCont(base, s, ev.k); return concluirCont(base, s, R, sim(R)); }
  if (ev?.tipo === 'sup') { const R = iniciarSup(base, s); return concluirSup(base, s, R, sim(R)); }
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
  for (const [c, p] of Object.entries(s.puni || {})) if (linhas.has(+c)) linhas.get(+c).p -= p; // pontos perdidos no fair play financeiro
  return [...linhas.values()].map(l => ({ ...l, sg: l.gp - l.gc, ultimos: l.ultimos.slice(-5) }))
    .sort((x, y) => y.p - x.p || y.v - x.v || y.sg - x.sg || y.gp - x.gp || base.clubes[x.clube].n.localeCompare(base.clubes[y.clube].n));
}

// o save leva só o necessário (calendário e cache saem)
export function paraSalvar(s) { const { _cal, ...resto } = s; return resto; }
export function resumo(base, s) {
  const ci = s.tecnico.clube, d = base.clubes[ci].div, pos = tabela(base, s, d).findIndex(l => l.clube === ci) + 1;
  return s.rodada ? `${s.ano} · Série ${d} · ${s.rodada} de 38 rodadas · ${pos}º lugar` : `${s.ano} · Série ${d} · antes da 1ª rodada`;
}
