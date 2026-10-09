// Virada de temporada: histórico, acesso e rebaixamento (4 sobem, 4 caem), contratos que acabam, empréstimos que
// voltam, pré-contratos que se cumprem, aposentadorias, garotos da base e a Copa do Brasil do ano novo.
import { rng, pick, clamp, PERFIL } from './util.js';
import { tabela, aplicarSave, caixaInicial, acessoEQueda } from './mundo.js';
import { FASES_CONT } from './continental.js';
import { saidaPorQueda } from './carreira.js';
import { FASES, novaCopa, campanha } from './copa.js';
import { metaDiretoria, folhaDia, lancar, cotaTV, garantirFinancas, fairPlay, punirFPF, LIMITE_FPF, ANO_FPF, ANO_EQUILIBRIO } from './financas.js';
import { garantirMercado, cumprirAcordos, fimDosEmprestimos, pedidosDeQueda } from './mercado.js';
import { viradaDM } from './dm.js';
import { novaCont, campanhaCont } from './continental.js';
import { novaReg, campanhaReg, regsDe, REGIONAIS } from './regionais.js';
import { gala, arquivarGala, moralDosPremiados } from './gala.js';
import { revisarPotencial } from './potencial.js';
import { enviar } from './correio.js';
import { estrelas } from './util.js';

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
// cada clube sobe 1 a 3 garotos por ano para as posições mais carentes (o seu sobe 3)
export function gerarJovens(base, s, r) {
  const rows = [];
  base.clubes.forEach((c, ci) => {
    if (!DIVS.includes(c.div)) return;
    const el = base.elencos[ci], n = Math.min(9, Math.max(18 - el.length, ci === s.tecnico.clube || el.length < 22 ? 3 : el.length < 28 ? 2 : 1));
    const conta = {}; for (const j of el) conta[j.pos] = (conta[j.pos] || 0) + 1;
    const usados = new Set(el.map(j => j.num)), f = base.forca(ci);
    for (let k = 0; k < n; k++) {
      const pos = Object.keys(IDEAL).sort((a, b) => (conta[a] || 0) / IDEAL[a] - (conta[b] || 0) / IDEAL[b] || r() - 0.5)[0];
      conta[pos] = (conta[pos] || 0) + 1;
      const idade = 16 + Math.floor(r() * 3), ovr = clamp(Math.round(f - 16 + (r() - 0.5) * 10), 38, 74), pot = clamp(Math.round(ovr + 10 + r() * 18), ovr, 92);
      const nome = pick(r, NOMES), sob = pick(r, SOBRENOMES), curto = r() < 0.6 ? nome : sob;
      let num = pos === 'GOL' ? 30 : 25; while (usados.has(num)) num++; usados.add(num);
      const att = PERFIL[pos].map(d => clamp(Math.round(ovr + d + (r() - 0.5) * 8), 20, 99));
      rows.push([-((s.ano % 1000) * 10000 + ci * 10 + k), `${nome} ${sob}`, curto, ci, pos, idade, 'BRA', ovr, Math.round(ovr * ovr / 30 * (pot >= 80 ? 2 : 1)), s.ano + 3, pot, att, rostoNovo(r), num, s.ano]);
    }
  });
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
export function virarTemporada(base, s) {
  if (!fimDeTemporada(s)) return null;
  garantirMercado(s); garantirFinancas(base, s);
  const ci = s.tecnico.clube, div = base.clubes[ci].div, nome = c => base.clubes[c].n, N = [];
  const add = (texto, tipo = 'clube') => N.push({ rodada: 0, tipo, div: base.clubes[ci].div, texto });
  const tabs = Object.fromEntries(DIVS.map(d => [d, tabela(base, s, d)])), AQ = acessoEQueda(base, s);
  const pos = AQ.cl[div].indexOf(ci) + 1, meta = metaDiretoria(base, s);
  // fair play financeiro fecha o ano: custo do elenco acima de 70% (a partir de 2029) ou temporada no vermelho (2028+)
  const fp = fairPlay(base, s), fpN = [];
  s.puni = {}; // pontos perdidos valem só na temporada da punição (a tabela deste ano já foi fechada acima)
  if (fp.razao > LIMITE_FPF && s.ano >= ANO_FPF) fpN.push(punirFPF(base, s, `custo do elenco em ${Math.round(fp.razao * 100)}% da receita`));
  else if (fp.resultado < 0 && s.ano >= ANO_EQUILIBRIO) fpN.push(punirFPF(base, s, 'temporada fechou no vermelho'));
  else if (s.fpf && fp.razao <= LIMITE_FPF && !fp.divida) s.fpf.degrau = Math.max(0, (s.fpf.degrau || 0) - 1); // ano limpo alivia a escada
  const premiacao = arquivarGala(base, s, gala(base, s)); // antes de acesso, transferências e da estatística zerada
  const revisao = revisarPotencial(base, s), meusPot = revisao.filter(([j]) => j.clube === ci);
  // histórico de cada jogador no jogo: [ano, clube, jogos, gols, assistências, nota média × 10]
  s.histJog ||= {};
  for (const [id, e] of Object.entries(s.est || {})) { const j = base.jog.get(+id); if (j && e[0]) (s.histJog[id] ||= []).push([s.ano, j.clube, e[0], e[1], e[2], Math.round(e[3] / e[0])]); }
  const artilheiro = d => { const t = Object.entries(s.est).map(([id, e]) => [base.jog.get(+id), e[1]]).filter(([j, g]) => j && g && base.clubes[j.clube].div === d).sort((a, b) => b[1] - a[1])[0]; return t ? { id: t[0].id, nome: t[0].curto, clube: t[0].clube, gols: t[1] } : null; };
  const { sobe, cai } = AQ;
  // Série D: os 2 últimos da C saem do jogo (viram clube de estadual) e sobem os 2 clubes de estadual mais fortes
  const doD = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'R').sort((a, b) => (base.clubes[b].lvl || 0) - (base.clubes[a].lvl || 0) || a - b).slice(0, cai.C.length);
  s.historico ||= [];
  s.historico.unshift({
    ano: s.ano, clube: ci, div, pos, pts: tabs[div].find(l => l.clube === ci)?.p ?? 0, meta: meta.txt, bateuMeta: pos <= meta.pos,
    campeoes: { A: tabs.A[0].clube, B: tabs.B[0].clube, C: s.f2?.C?.campeao ?? AQ.cl.C[0] }, art: Object.fromEntries(DIVS.map(d => [d, artilheiro(d)])),
    copa: s.copa ? { campeao: s.copa.campeao, vice: s.copa.vice, meu: campanha(s, ci) } : null,
    cont: s.cont ? { LIB: s.cont.LIB.campeao, SUL: s.cont.SUL.campeao, sup: s.cont.sup.jogo?.campeao ?? null, meu: ['LIB', 'SUL'].map(k => campanhaCont(s, k, ci) && `${k === 'LIB' ? 'Libertadores' : 'Sul-Americana'}: ${campanhaCont(s, k, ci).toLowerCase()}`).find(Boolean) || null } : null,
    reg: s.reg?.v === 2 && s.reg.ano === s.ano && !s.reg.pulado ? { campeoes: Object.fromEntries(Object.keys(REGIONAIS).map(k => [k, s.reg[k].campeao])), titulos: Object.values(s.reg).flatMap(T => Object.entries(T?.titulos || {})), meu: regsDe(s, ci).map(k => `${REGIONAIS[k].nome}: ${campanhaReg(s, k, ci).toLowerCase()}`) } : null,
    sobem: { A: sobe.B, B: sobe.C, C: doD }, caem: { B: cai.A, C: cai.B, D: cai.C }, repasses: s.repasses || [],
  });
  const f = s.fin;
  f.diretoria = clamp(f.diretoria + (pos <= meta.pos ? 10 : -12) + (s.copa?.campeao === ci ? 8 : 0), 0, 100);
  add(pos <= meta.pos ? `A diretoria comemora: meta da temporada cumprida (${meta.txt}).` : `A diretoria cobra: a meta era ${meta.txt} e o time terminou em ${pos}º.`);

  // vagas da próxima temporada: tabela final da Série A, campeão e vice da Copa do Brasil e campeões continentais
  // (quem já está classificado repassa a vaga ao próximo da tabela: continental.js vagasBR)
  s.classif = { A: tabs.A.map(l => l.clube), copa: s.copa?.campeao ?? null, copaVice: s.copa?.vice ?? null, lib: s.cont?.LIB?.campeao ?? null, sul: s.cont?.SUL?.campeao ?? null };
  // acesso e rebaixamento
  s.divs ||= {};
  for (const [lista, d] of [[cai.A, 'B'], [sobe.B, 'A'], [cai.B, 'C'], [sobe.C, 'B'], [cai.C, 'R'], [doD, 'C']]) for (const c of lista) { if (base.clubes[c].divOrig === d) delete s.divs[c]; else s.divs[c] = d; }
  if (sobe.B.includes(ci) || sobe.C.includes(ci)) add(`ACESSO! O ${nome(ci)} vai disputar a Série ${sobe.B.includes(ci) ? 'A' : 'B'} em ${s.ano + 1}.`, 'destaque');
  if (cai.A.includes(ci) || cai.B.includes(ci)) add(`Rebaixado. O ${nome(ci)} cai para a Série ${cai.A.includes(ci) ? 'B' : 'C'}.`, 'crise');
  const caiuParaD = cai.C.includes(ci);

  // empréstimos voltam (antes, as cláusulas de fim de temporada) e pré-contratos se cumprem
  fimDosEmprestimos(base, s, [...cai.A, ...cai.B], t => add(t));
  for (const [id, e] of Object.entries(s.emprestimos)) {
    const j = base.jog.get(+id); if (!j) continue;
    if (e.de === j.clubeOrig) delete s.transf[id]; else s.transf[id] = e.de;
    if (e.para === ci) delete s.salarios[id];
    if (e.de === ci) add(`${j.curto} volta de empréstimo do ${nome(e.para)}.`);
  }
  s.emprestimos = {};
  for (const p of s.preContratos) {
    const j = base.jog.get(p.jogador); if (!j) continue;
    s.transf[j.id] = p.para; s.contratos[j.id] = s.ano + (p.anos || 3); (s.chegou ||= {})[j.id] = (s.ano + 1) * 40;
    if (p.para === ci) { s.salarios[j.id] = p.salario; add(`Chegou: ${j.curto}, do pré-contrato com o ${nome(p.de)}.`); } else delete s.salarios[j.id];
    s.historicoTransf.unshift({ rodada: 37, jogador: j.id, nome: j.curto, de: p.de, para: p.para, valor: 0, tipo: 'pre', ia: p.para !== ci && p.de !== ci });
  }
  if (s.acordos?.length) cumprirAcordos(base, s, t => add(t));
  // clubes da IA: quem não renovou (sem nível ou quis sair) fica livre
  const livresIA = base.clubes.findIndex(c => c.div === 'L');
  for (const [id, x] of Object.entries(s.renovIA || {})) {
    if (x.ano !== s.ano || !['sai', 'dispensa'].includes(x.d)) continue;
    const j = base.jog.get(+id); if (!j || j.clube === ci || base.clubes[j.clube].div === 'L' || j.contrato > s.ano || s.preContratos.some(p => p.jogador === j.id)) continue;
    s.transf[j.id] = livresIA; delete s.contratos[j.id];
    if (j.ovr >= 74) add(`${j.curto} deixa o ${nome(j.clube)} sem renovar e está no mercado como jogador livre.`, 'mercado');
  }
  aplicarSave(base, s);
  // contrato acabou e não renovou: vira jogador livre
  const livres = base.clubes.findIndex(c => c.div === 'L');
  for (const j of base.elencos[ci].slice()) if (j.contrato <= s.ano) {
    s.transf[j.id] = livres; delete s.salarios[j.id]; delete s.contratos[j.id];
    s.historicoTransf.unshift({ rodada: 37, jogador: j.id, nome: j.curto, de: ci, para: livres, valor: 0, tipo: 'fim' });
    add(`${j.curto} terminou o contrato e deixou o clube.`);
  }

  // ano novo: todo mundo um ano mais velho, uns evoluem, outros penduram as chuteiras
  const antes = new Map(base.elencos[ci].map(j => [j.id, j.ovr])), craques = [...base.jog.values()].filter(j => j.ovr >= 80 && !j.fora).map(j => j.id);
  s.ano++;
  aplicarSave(base, s);
  for (const [id, o] of antes) { const j = base.jog.get(id); if (j.fora) add(`${j.curto} se aposentou aos ${j.idade} anos.`); else if (j.ovr >= o + 4) add(`${j.curto} evoluiu na pré-temporada: agora tem ${j.ovr} de overall.`); }
  for (const id of craques) { const j = base.jog.get(id); if (j.fora && !antes.has(id)) add(`${j.curto} anuncia a aposentadoria.`, 'destaque'); }
  const jovens = gerarJovens(base, s, rng(`base${s.seed}-${s.ano}`));
  // quem sobe da Série D chega com elenco montado (no jogo eles só tinham o time gerado dos estaduais)
  const doDRows = doD.flatMap(c => elencoDeAcesso(base, s, c, rng(`acesso${s.seed}-${s.ano}-${c}`)));
  s.jovens = [...(s.jovens || []), ...jovens, ...doDRows];
  aplicarSave(base, s);
  const meus = jovens.filter(r => r[3] === ci);
  if (meus.length) add(`Subiram da base: ${meus.map(r => `${r[2]} (${r[4]}, ${r[5]} anos)`).join(', ')}.`);

  // clubes da IA fecham o ano: metade do caixa fica, a outra metade volta para o nível do clube (receitas menos folha)
  for (const [c, v] of Object.entries(s.caixaIA || {})) s.caixaIA[c] = Math.round((v + caixaInicial(base, +c)) / 2);
  // temporada zerada
  viradaDM(base, s);
  s.forma = {}; s.afast = {}; s.julgamentos = [];
  for (const id in s.trato || {}) s.trato[id] = Math.trunc(s.trato[id] / 2); // a mágoa diminui com o tempo
  Object.assign(s, { rodada: 0, feitas: { ano: s.ano, B: 0, C: 0 }, f2: {}, res: { A: {}, B: {}, C: {} }, cart: {}, est: {}, ultima: null, lider: {}, rumores: {}, destaques: {}, ultimaData: null, recuperado: null, cond: {}, mor: {}, semJogar: {}, xi: null, banco: null, recebidas: [], preContratos: [], querSair: {}, quedaIA: {} });
  for (const t of pedidosDeQueda(base, s, [...cai.A, ...cai.B])) add(t, 'mercado'); // os melhores de quem caiu pedem para sair
  delete s._cal;
  s.propostas = s.propostas.filter(p => !['aguardando', 'contraproposta'].includes(p.estado)).slice(0, 30);
  s.listas = { venda: s.listas.venda.filter(id => base.jog.get(id)?.clube === ci), emprestimo: s.listas.emprestimo.filter(id => base.jog.get(id)?.clube === ci) };
  if (f.socorro) { lancar(s, 'socorro', 'Desconto dos adiantamentos da TV', -cotaTV(base.clubes[ci]) / 8 * f.socorro, 0); f.socorro = 0; }
  Object.assign(f, { temporada: { ano: s.ano, compras: 0, vendas: 0, folha0: folhaDia(base, s) }, tvPagas: [], ultimaVerba: -99, verbasRecentes: [], atraso: 0, salarioBudget: null });
  novaCopa(base, s);
  novaCont(base, s);
  novaReg(base, s);
  moralDosPremiados(base, s);
  for (const t of fpN) add(t, 'crise');
  if (meusPot.length) {
    const linha = ([j, d]) => `${j.curto} ${d > 0 ? 'sobe' : 'cai'} ${Math.abs(d)} (agora ${'★'.repeat(estrelas(j.pot))}${'☆'.repeat(5 - estrelas(j.pot))})`;
    const sobe = meusPot.filter(x => x[1] > 0), cai = meusPot.filter(x => x[1] < 0);
    enviar(s, 'olheiro', `pot-${s.ano}`, 'Revisão de potencial', `Fechei a revisão depois da temporada. ${sobe.length ? `Em alta: ${sobe.map(linha).join(', ')}.` : ''} ${cai.length ? `Em baixa: ${cai.map(linha).join(', ')}.` : ''} Quem joga bem cresce mais; quem não rende, trava.`.replace(/\s+/g, ' ').trim(), { link: '#/elenco' });
    add(`Revisão de potencial no ${nome(ci)}: ${sobe.length} em alta, ${cai.length} em baixa.`);
  }
  const joias = revisao.filter(([j, d]) => d >= 3 && j.idade <= 21 && j.clube !== ci).sort((a, b) => b[0].pot - a[0].pot).slice(0, 2);
  for (const [j] of joias) add(`Joia em alta: ${j.curto} (${nome(j.clube)}) fez grande temporada e virou alvo dos grandes.`, 'destaque');
  for (const n of premiacao) N.push({ rodada: 0, ...n });
  const h = s.historico[0];
  add(`Começa a temporada ${s.ano}. Sobem para a Série A: ${h.sobem.A.map(nome).join(', ')}. Caem para a B: ${h.caem.B.map(nome).join(', ')}.`, 'resultado');
  for (const r of s.repasses || []) add(`Vaga repassada: o ${nome(r.de)} já estava na Libertadores pela tabela e a vaga de ${r.por} ficou com o ${nome(r.clube)} (${r.pos}º da Série A).`, 'resultado');
  if (caiuParaD) saidaPorQueda(base, s);
  s.noticias = [...N, ...s.noticias].slice(0, 220);
  return h;
}
