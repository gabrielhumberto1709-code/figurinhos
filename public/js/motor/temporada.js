// Virada de temporada: histórico, acesso e rebaixamento (4 sobem, 4 caem), contratos que acabam, empréstimos que
// voltam, pré-contratos que se cumprem, aposentadorias, garotos da base e a Copa do Brasil do ano novo.
import { rng, pick, clamp, PERFIL, fmtDinheiro } from './util.js';
import { tabela, aplicarSave, caixaIAInicial, acessoEQueda } from './mundo.js';
import { FASES_CONT } from './continental.js';
import { saidaPorQueda } from './carreira.js';
import { FASES, novaCopa, campanha } from './copa.js';
import { metaDiretoria, folhaDia, lancar, cotaTV, garantirFinancas, fecharFPF } from './financas.js';
import { garantirMercado, cumprirAcordos, fimDosEmprestimos, pedidosDeQueda } from './mercado.js';
import { viradaDM } from './dm.js';
import { novaCont, campanhaCont } from './continental.js';
import { novaReg, campanhaReg, regsDe, REGIONAIS } from './regionais.js';
import { gala, arquivarGala, moralDosPremiados } from './gala.js';
import { revisarPotencial } from './potencial.js';
import { enviar, cartasDeInicio } from './correio.js';
import { estrelas } from './util.js';
import { humanos, ehHumano } from './humanos.js';
import { fecharPatrocinio } from './patrocinio.js';

const DIVS = ['A', 'B', 'C'];
// a temporada acaba com tudo jogado: Série A (relógio), B e C com a segunda fase, Copa do Brasil e as continentais
const feito2 = (s, d, n) => s.f2?.[d]?.ano === s.ano && s.f2[d].i >= n;
export const fimDeTemporada = s => s.rodada >= 38 && (s.feitas?.B ?? 38) >= 38 && (s.feitas?.C ?? 19) >= 19 && feito2(s, 'B', 2) && feito2(s, 'C', 8)
  && !(s.copa && s.copa.fase < FASES.length) && ['LIB', 'SUL'].every(k => !s.cont?.[k] || s.cont.ano !== s.ano || s.cont[k].fase >= FASES_CONT.length);

// ---------- garotos da base ----------
const NOMES = ['Kauã', 'Gabriel', 'Davi', 'Pedro', 'Enzo', 'Arthur', 'Miguel', 'Heitor', 'Bernardo', 'Théo', 'Ryan', 'Kaique', 'Luan', 'Vitor', 'Igor', 'Caio', 'Rafael', 'Matheus', 'João', 'Lucas', 'Wesley', 'Yuri', 'Murilo', 'Thiago', 'Samuel', 'Breno', 'Otávio', 'Gustavo', 'Diego', 'Renan', 'Erick', 'Wallace', 'Jhonatan', 'Kelvin', 'Patrick', 'Nicolas', 'Ruan', 'Felipe', 'André', 'Leandro'];
const SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Araújo', 'Ribeiro', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Moura', 'Teixeira', 'Cardoso', 'Freitas', 'Nunes', 'Mendes', 'Pinto', 'Batista', 'Correia', 'Vieira', 'Monteiro', 'Dias', 'Campos', 'Ramos', 'Farias', 'Moreira', 'Cunha', 'Lopes', 'Brito', 'Paixão', 'Sales', 'Macedo'];
const IDEAL = { GOL: 3, ZAG: 4, LD: 2, LE: 2, VOL: 3, MC: 3, MEI: 2, PE: 2, PD: 2, CA: 3 };
function rostoNovo(r) {
  const pele = pick(r, [0, 1, 1, 2, 2, 3, 3, 4, 4, 5]), cabelo = pele >= 3 ? 0 : pick(r, [0, 0, 1, 1, 2, 3]);
  const corte = pick(r, pele >= 3 ? [1, 2, 4, 7, 12, 13, 2] : [0, 3, 2, 10, 6, 5, 1, 11]);
  return [pele, cabelo, corte, r() < 0.12 ? 1 : 0, pick(r, [0, 0, 1, 2]), pele >= 3 ? 1 : 0, pele >= 3 && r() < 0.6 ? 1 : 0, pele >= 3 && r() < 0.5 ? 1 : 0, pele <= 1 ? pick(r, [0, 1, 2]) : 0, 0].map(n => n.toString(36)).join('');
}
// cada clube sobe 1 a 3 garotos por ano para as posições mais carentes (o de um técnico sobe 5)
export function gerarJovens(base, s, r) {
  const rows = [];
  base.clubes.forEach((c, ci) => {
    if (!DIVS.includes(c.div)) return;
    const el = base.elencos[ci], n = Math.min(9, Math.max(18 - el.length, ehHumano(s, ci) ? 5 : el.length < 22 ? 3 : el.length < 28 ? 2 : 1));
    rows.push(...jovensDoClube(base, s, ci, n, r, k => -((s.ano % 1000) * 10000 + ci * 10 + k)));
  });
  return rows;
}
// base de quem assume um clube (carreira nova ou liga online): 5 garotos já no 1º ano, uma vez por clube
export function baseInicial(base, s, ci) {
  if ((s.baseIni ||= []).includes(ci)) return;
  s.baseIni.push(ci);
  const rows = jovensDoClube(base, s, ci, 5, rng(`baseini${s.seed}-${s.ano}-${ci}`), k => -(6e8 + (s.ano % 1000) * 1e5 + ci * 10 + k));
  s.jovens = [...(s.jovens || []), ...rows];
  aplicarSave(base, s);
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', clube: ci, div: base.clubes[ci].div, texto: `Subiram da base: ${rows.map(r => `${r[2]} (${r[4]}, ${r[5]} anos)`).join(', ')}.` });
}
function jovensDoClube(base, s, ci, n, r, idDe) {
  const rows = [], el = base.elencos[ci];
  const conta = {}; for (const j of el) conta[j.pos] = (conta[j.pos] || 0) + 1;
  const usados = new Set(el.map(j => j.num)), f = base.forca(ci);
  for (let k = 0; k < n; k++) {
    const pos = Object.keys(IDEAL).sort((a, b) => (conta[a] || 0) / IDEAL[a] - (conta[b] || 0) / IDEAL[b] || r() - 0.5)[0];
    conta[pos] = (conta[pos] || 0) + 1;
    const idade = 16 + Math.floor(r() * 3), ovr = clamp(Math.round(f - 16 + (r() - 0.5) * 10), 38, 74), pot = clamp(Math.round(ovr + 10 + r() * 18), ovr, 92);
    const nome = pick(r, NOMES), sob = pick(r, SOBRENOMES), curto = r() < 0.6 ? nome : sob;
    let num = pos === 'GOL' ? 30 : 25; while (usados.has(num)) num++; usados.add(num);
    const att = PERFIL[pos].map(d => clamp(Math.round(ovr + d + (r() - 0.5) * 8), 20, 99));
    rows.push([idDe(k), `${nome} ${sob}`, curto, ci, pos, idade, 'BRA', ovr, Math.round(ovr * ovr / 30 * (pot >= 80 ? 2 : 1)), s.ano + 3, pot, att, rostoNovo(r), num, s.ano]);
  }
  return rows;
}

// elenco para quem sobe da Série D: 26 jogadores perto do nível de Série C (ids próprios, entram como "jovens" no save)
function elencoDeAcesso(base, s, ci, r) {
  if (base.elencos[ci].length >= 22) return []; // quem já tem elenco (caiu e voltou) não ganha outro por cima
  const rows = [], usados = new Set(base.elencos[ci].map(j => j.num)), POS = Object.entries(IDEAL).flatMap(([p, n]) => Array(n).fill(p));
  POS.forEach((pos, k) => {
    const idade = 19 + Math.floor(r() * 14), ovr = clamp(Math.round(49 + (r() + r() + r() - 1.5) * 6), 40, 60), pot = clamp(Math.round(ovr + (idade <= 22 ? 4 + r() * 10 : r() * 3)), ovr, 75);
    const nome = pick(r, NOMES), sob = pick(r, SOBRENOMES), curto = r() < 0.5 ? nome : sob;
    let num = pos === 'GOL' ? 1 : 2; while (usados.has(num)) num++; usados.add(num);
    rows.push([-(5e8 + (s.ano % 1000) * 1e5 + ci * 40 + k), `${nome} ${sob}`, curto, ci, pos, idade, 'BRA', ovr, Math.round(150 * 1.16 ** (ovr - 50)), s.ano + 1 + Math.floor(r() * 3), pot, PERFIL[pos].map(dlt => clamp(Math.round(ovr + dlt + (r() - 0.5) * 8), 20, 99)), rostoNovo(r), num, s.ano]);
  });
  return rows;
}

// ---------- virada ----------
// O mundo vira uma vez (gala, acesso e queda, empréstimos, pré-contratos, contratos, idade, base, competições novas);
// cada técnico fecha o ano dele (meta, fair play, histórico, quem chega e quem sai, cartas da temporada nova).
export function virarTemporada(base, s) {
  if (!fimDeTemporada(s)) return null;
  garantirMercado(s);
  const hs = humanos(s), nome = c => base.clubes[c].n, N = [];
  for (const [, sv] of hs) { garantirMercado(sv); garantirFinancas(base, sv); }
  const addW = (texto, tipo = 'clube', div = base.clubes[s.tecnico.clube]?.div ?? 'A') => N.push({ rodada: 0, tipo, div, texto });
  const addDo = ci => (texto, tipo = 'clube') => N.push({ rodada: 0, tipo, div: base.clubes[ci].div, clube: ci, texto });
  const tabs = Object.fromEntries(DIVS.map(d => [d, tabela(base, s, d)])), AQ = acessoEQueda(base, s);
  const eles = hs.map(([ci, sv]) => { const div = base.clubes[ci].div; return { ci, sv, div, add: addDo(ci), pos: AQ.cl[div].indexOf(ci) + 1, meta: metaDiretoria(base, sv) }; });
  // fair play financeiro fecha o ano (custo do elenco, dívida de curto prazo e equilíbrio de três anos)
  s.puni = {}; // pontos perdidos valem só na temporada da punição (a tabela deste ano já foi fechada acima)
  for (const x of eles) x.fpN = fecharFPF(base, x.sv);
  const premiacao = arquivarGala(base, s, gala(base, s)); // antes de acesso, transferências e da estatística zerada
  const revisao = revisarPotencial(base, s);
  // histórico de cada jogador no jogo: [ano, clube, jogos, gols, assistências, nota média × 10]
  s.histJog ||= {};
  for (const [id, e] of Object.entries(s.est || {})) { const j = base.jog.get(+id); if (j && e[0]) (s.histJog[id] ||= []).push([s.ano, j.clube, e[0], e[1], e[2], Math.round(e[3] / e[0])]); }
  const artilheiro = d => { const t = Object.entries(s.est).map(([id, e]) => [base.jog.get(+id), e[1]]).filter(([j, g]) => j && g && base.clubes[j.clube].div === d).sort((a, b) => b[1] - a[1])[0]; return t ? { id: t[0].id, nome: t[0].curto, clube: t[0].clube, gols: t[1] } : null; };
  const { sobe, cai } = AQ;
  // Série D: os 2 últimos da C saem do jogo (viram clube de estadual) e sobem os 2 clubes de estadual mais fortes
  const doD = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'R').sort((a, b) => (base.clubes[b].lvl || 0) - (base.clubes[a].lvl || 0) || a - b).slice(0, cai.C.length);
  const doAno = {
    campeoes: { A: tabs.A[0].clube, B: tabs.B[0].clube, C: s.f2?.C?.campeao ?? AQ.cl.C[0] }, art: Object.fromEntries(DIVS.map(d => [d, artilheiro(d)])),
    sobem: { A: sobe.B, B: sobe.C, C: doD }, caem: { B: cai.A, C: cai.B, D: cai.C }, repasses: s.repasses || [],
  };
  for (const { ci, sv, div, pos, meta, add } of eles) {
    (sv.historico ||= []).unshift({
      ano: s.ano, clube: ci, div, pos, pts: tabs[div].find(l => l.clube === ci)?.p ?? 0, meta: meta.txt, bateuMeta: pos <= meta.pos, campeoes: doAno.campeoes, art: doAno.art,
      copa: s.copa ? { campeao: s.copa.campeao, vice: s.copa.vice, meu: campanha(s, ci) } : null,
      cont: s.cont ? { LIB: s.cont.LIB.campeao, SUL: s.cont.SUL.campeao, sup: s.cont.sup.jogo?.campeao ?? null, meu: ['LIB', 'SUL'].map(k => campanhaCont(s, k, ci) && `${k === 'LIB' ? 'Libertadores' : 'Sul-Americana'}: ${campanhaCont(s, k, ci).toLowerCase()}`).find(Boolean) || null } : null,
      reg: s.reg?.v === 2 && s.reg.ano === s.ano && !s.reg.pulado ? { campeoes: Object.fromEntries(Object.keys(REGIONAIS).map(k => [k, s.reg[k].campeao])), titulos: Object.values(s.reg).flatMap(T => Object.entries(T?.titulos || {})), meu: regsDe(s, ci).map(k => `${REGIONAIS[k].nome}: ${campanhaReg(s, k, ci).toLowerCase()}`) } : null,
      sobem: doAno.sobem, caem: doAno.caem, repasses: doAno.repasses,
    });
    sv.fin.diretoria = clamp(sv.fin.diretoria + (pos <= meta.pos ? 10 : -12) + (s.copa?.campeao === ci ? 8 : 0), 0, 100);
    // patrocínio: bônus de títulos (grande: Série A, Copa do Brasil, Libertadores; médio: B, C, Sula, Supercopa; pequeno: regionais) e de meta
    const h = sv.historico[0], titulos = [];
    if (h.campeoes[div] === ci) titulos.push([`Série ${div}`, div === 'A' ? 'grande' : 'medio']);
    if (h.copa?.campeao === ci) titulos.push(['Copa do Brasil', 'grande']);
    for (const [k, nomeT, peso] of [['LIB', 'Libertadores', 'grande'], ['SUL', 'Sul-Americana', 'medio'], ['sup', 'Supercopa', 'medio']]) if (h.cont?.[k] === ci) titulos.push([nomeT, peso]);
    for (const [k, c] of Object.entries(h.reg?.campeoes || {})) if (c === ci) titulos.push([REGIONAIS[k].nome, 'pequeno']);
    for (const t of fecharPatrocinio(sv, { bateuMeta: pos <= meta.pos, titulos })) add(t);
    add(pos <= meta.pos ? `A diretoria comemora: meta da temporada cumprida (${meta.txt}).` : `A diretoria cobra: a meta era ${meta.txt} e o time terminou em ${pos}º.`);
  }

  // vagas da próxima temporada: tabela final da Série A, campeão e vice da Copa do Brasil e campeões continentais
  // (quem já está classificado repassa a vaga ao próximo da tabela: continental.js vagasBR)
  s.classif = { A: tabs.A.map(l => l.clube), copa: s.copa?.campeao ?? null, copaVice: s.copa?.vice ?? null, lib: s.cont?.LIB?.campeao ?? null, sul: s.cont?.SUL?.campeao ?? null };
  // acesso e rebaixamento
  s.divs ||= {};
  for (const [lista, d] of [[cai.A, 'B'], [sobe.B, 'A'], [cai.B, 'C'], [sobe.C, 'B'], [cai.C, 'R'], [doD, 'C']]) for (const c of lista) { if (base.clubes[c].divOrig === d) delete s.divs[c]; else s.divs[c] = d; }
  for (const { ci, add } of eles) {
    if (sobe.B.includes(ci) || sobe.C.includes(ci)) add(`ACESSO! O ${nome(ci)} vai disputar a Série ${sobe.B.includes(ci) ? 'A' : 'B'} em ${s.ano + 1}.`, 'destaque');
    if (cai.A.includes(ci) || cai.B.includes(ci)) add(`Rebaixado. O ${nome(ci)} cai para a Série ${cai.A.includes(ci) ? 'B' : 'C'}.`, 'crise');
  }
  const addDe = ci => (eles.find(x => x.ci === ci)?.add) || addW;

  // empréstimos voltam (antes, as cláusulas de fim de temporada) e pré-contratos se cumprem
  fimDosEmprestimos(base, s, [...cai.A, ...cai.B], (t, ci) => addDe(ci)(t));
  for (const [id, e] of Object.entries(s.emprestimos)) {
    const j = base.jog.get(+id); if (!j) continue;
    if (e.de === j.clubeOrig) delete s.transf[id]; else s.transf[id] = e.de;
    if (ehHumano(s, e.para)) delete s.salarios[id];
    if (ehHumano(s, e.de)) addDe(e.de)(`${j.curto} volta de empréstimo do ${nome(e.para)}.`);
  }
  s.emprestimos = {};
  for (const p of s.preContratos) {
    const j = base.jog.get(p.jogador); if (!j) continue;
    s.transf[j.id] = p.para; s.contratos[j.id] = s.ano + (p.anos || 3); (s.chegou ||= {})[j.id] = (s.ano + 1) * 40; (s.janChegada ||= {})[j.id] = (s.ano + 1) * 2; // chega na janela de janeiro
    if (ehHumano(s, p.para)) { s.salarios[j.id] = p.salario; addDe(p.para)(`Chegou: ${j.curto}, do pré-contrato com o ${nome(p.de)}.`); } else delete s.salarios[j.id];
    s.historicoTransf.unshift({ rodada: 37, jogador: j.id, nome: j.curto, de: p.de, para: p.para, valor: 0, tipo: 'pre', ia: !ehHumano(s, p.para) && !ehHumano(s, p.de) });
  }
  for (const { sv, add } of eles) if (sv.acordos?.length) cumprirAcordos(base, sv, t => add(t));
  // clubes da IA: quem não renovou (sem nível ou quis sair) fica livre
  const livresIA = base.clubes.findIndex(c => c.div === 'L');
  for (const [id, x] of Object.entries(s.renovIA || {})) {
    if (x.ano !== s.ano || !['sai', 'dispensa'].includes(x.d)) continue;
    const j = base.jog.get(+id); if (!j || ehHumano(s, j.clube) || base.clubes[j.clube].div === 'L' || j.contrato > s.ano || s.preContratos.some(p => p.jogador === j.id)) continue;
    s.transf[j.id] = livresIA; delete s.contratos[j.id];
    if (j.ovr >= 74) addW(`${j.curto} deixa o ${nome(j.clube)} sem renovar e está no mercado como jogador livre.`, 'mercado');
  }
  aplicarSave(base, s);
  // contrato acabou e não renovou: vira jogador livre
  const livres = base.clubes.findIndex(c => c.div === 'L');
  for (const { ci, add } of eles) for (const j of base.elencos[ci].slice()) if (j.contrato <= s.ano) {
    s.transf[j.id] = livres; delete s.salarios[j.id]; delete s.contratos[j.id];
    s.historicoTransf.unshift({ rodada: 37, jogador: j.id, nome: j.curto, de: ci, para: livres, valor: 0, tipo: 'fim' });
    add(`${j.curto} terminou o contrato e deixou o clube.`);
  }

  // ano novo: todo mundo um ano mais velho, uns evoluem, outros penduram as chuteiras
  for (const x of eles) x.antes = new Map(base.elencos[x.ci].map(j => [j.id, j.ovr]));
  const craques = [...base.jog.values()].filter(j => j.ovr >= 80 && !j.fora).map(j => j.id);
  s.ano++;
  aplicarSave(base, s);
  for (const { antes, add } of eles) for (const [id, o] of antes) { const j = base.jog.get(id); if (j.fora) add(`${j.curto} se aposentou aos ${j.idade} anos.`); else if (j.ovr >= o + 4) add(`${j.curto} evoluiu na pré-temporada: agora tem ${j.ovr} de overall.`); }
  for (const id of craques) { const j = base.jog.get(id); if (j.fora && !eles.some(x => x.antes.has(id))) addW(`${j.curto} anuncia a aposentadoria.`, 'destaque'); }
  const jovens = gerarJovens(base, s, rng(`base${s.seed}-${s.ano}`));
  // quem sobe da Série D chega com elenco montado (no jogo eles só tinham o time gerado dos estaduais)
  const doDRows = doD.flatMap(c => elencoDeAcesso(base, s, c, rng(`acesso${s.seed}-${s.ano}-${c}`)));
  s.jovens = [...(s.jovens || []), ...jovens, ...doDRows];
  aplicarSave(base, s);
  for (const { ci, add } of eles) { const meus = jovens.filter(r => r[3] === ci); if (meus.length) add(`Subiram da base: ${meus.map(r => `${r[2]} (${r[4]}, ${r[5]} anos)`).join(', ')}.`); }

  // clubes da IA fecham o ano: a verba nova é 70% a do clube e 30% o que sobrou, entre 0,3x e 2x a normal
  for (const [c, v] of Object.entries(s.caixaIA || {})) { const ini = caixaIAInicial(base, +c); s.caixaIA[c] = Math.round(clamp(0.7 * ini + 0.3 * v, 0.3 * ini, 2 * ini)); }
  // temporada zerada
  viradaDM(base, s);
  s.forma = {}; s.afast = {};
  for (const id in s.trato || {}) s.trato[id] = Math.trunc(s.trato[id] / 2); // a mágoa diminui com o tempo
  Object.assign(s, { rodada: 0, feitas: { ano: s.ano, B: 0, C: 0 }, f2: {}, res: { A: {}, B: {}, C: {} }, cart: {}, est: {}, lider: {}, rumores: {}, destaques: {}, ultimaData: null, recuperado: null, cond: {}, mor: {}, semJogar: {}, preContratos: [], querSair: {}, quedaIA: {}, jogosA: {}, passagens: {} });
  for (const [, sv] of hs) Object.assign(sv, { ultima: null, ultimaVivo: null, recebidas: [], julgamentos: [] });
  for (const t of pedidosDeQueda(base, s, [...cai.A, ...cai.B])) addW(t, 'mercado'); // os melhores de quem caiu pedem para sair
  delete s._cal;
  for (const { ci, sv, add } of eles) {
    const f = sv.fin;
    sv.propostas = sv.propostas.filter(p => !['aguardando', 'contraproposta'].includes(p.estado)).slice(0, 30);
    sv.listas = { venda: sv.listas.venda.filter(id => base.jog.get(id)?.clube === ci), emprestimo: sv.listas.emprestimo.filter(id => base.jog.get(id)?.clube === ci) };
    if (f.socorro) { lancar(sv, 'socorro', 'Desconto dos adiantamentos da TV', -cotaTV(base.clubes[ci]) / 8 * f.socorro, 0); f.socorro = 0; }
    // caixa negativo no fim do ano vira dívida (o clube rola com bancos e credores; os juros continuam)
    if (sv.caixa < 0) { const v = -sv.caixa; f.divida = (f.divida || 0) + v; lancar(sv, 'rolagem', 'Caixa negativo vira dívida', v, 0); add(`O ano fechou no vermelho: ${fmtDinheiro(v)} viraram dívida (agora ${fmtDinheiro(f.divida)}).`); }
    Object.assign(f, { temporada: { ano: s.ano, compras: 0, vendas: 0, folha0: folhaDia(base, sv) }, tvPagas: [], ultimaVerba: -99, verbasRecentes: [], atraso: 0, salarioBudget: null });
  }
  novaCopa(base, s);
  novaCont(base, s);
  novaReg(base, s);
  moralDosPremiados(base, s);
  for (const { ci, sv, fpN, add } of eles) {
    for (const t of fpN) add(t, 'crise');
    const meusPot = revisao.filter(([j]) => j.clube === ci);
    if (meusPot.length) {
      const linha = ([j, d]) => `${j.curto} ${d > 0 ? 'sobe' : 'cai'} ${Math.abs(d)} (agora ${'★'.repeat(estrelas(j.pot))}${'☆'.repeat(5 - estrelas(j.pot))})`;
      const sobe = meusPot.filter(x => x[1] > 0), cai = meusPot.filter(x => x[1] < 0);
      enviar(sv, 'olheiro', `pot-${s.ano}`, 'Revisão de potencial', `Fechei a revisão depois da temporada. ${sobe.length ? `Em alta: ${sobe.map(linha).join(', ')}.` : ''} ${cai.length ? `Em baixa: ${cai.map(linha).join(', ')}.` : ''} Quem joga bem cresce mais; quem não rende, trava.`.replace(/\s+/g, ' ').trim(), { link: '#/elenco' });
      add(`Revisão de potencial no ${nome(ci)}: ${sobe.length} em alta, ${cai.length} em baixa.`);
    }
  }
  const joias = revisao.filter(([j, d]) => d >= 3 && j.idade <= 21 && !ehHumano(s, j.clube)).sort((a, b) => b[0].pot - a[0].pot).slice(0, 2);
  for (const [j] of joias) addW(`Joia em alta: ${j.curto} (${nome(j.clube)}) fez grande temporada e virou alvo dos grandes.`, 'destaque');
  for (const n of premiacao) N.push({ rodada: 0, ...n });
  addW(`Começa a temporada ${s.ano}. Sobem para a Série A: ${doAno.sobem.A.map(nome).join(', ')}. Caem para a B: ${doAno.caem.B.map(nome).join(', ')}.`, 'resultado');
  for (const r of s.repasses || []) addW(`Vaga repassada: o ${nome(r.de)} já estava na Libertadores pela tabela e a vaga de ${r.por} ficou com o ${nome(r.clube)} (${r.pos}º da Série A).`, 'resultado');
  for (const { ci, sv } of eles) if (cai.C.includes(ci)) saidaPorQueda(base, sv);
  for (const { sv } of eles) cartasDeInicio(base, sv);
  s.noticias = [...N, ...s.noticias].slice(0, 220);
  return eles[0]?.sv.historico[0] ?? doAno;
}
