// Virada de temporada: histórico, acesso e rebaixamento (4 sobem, 4 caem), contratos que acabam, empréstimos que
// voltam, pré-contratos que se cumprem, aposentadorias, garotos da base e a Copa do Brasil do ano novo.
import { rng, pick, clamp, PERFIL } from './util.js';
import { tabela, aplicarSave } from './mundo.js';
import { FASES, novaCopa, campanha } from './copa.js';
import { metaDiretoria, folhaDia, lancar, cotaTV, garantirFinancas } from './financas.js';
import { garantirMercado, cumprirAcordos } from './mercado.js';
import { viradaDM } from './dm.js';
import { novaCont, campanhaCont } from './continental.js';

const DIVS = ['A', 'B', 'C'];
export const fimDeTemporada = s => s.rodada >= 38 && !(s.copa && s.copa.fase < FASES.length);

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

// ---------- virada ----------
export function virarTemporada(base, s) {
  if (!fimDeTemporada(s)) return null;
  garantirMercado(s); garantirFinancas(base, s);
  const ci = s.tecnico.clube, div = base.clubes[ci].div, nome = c => base.clubes[c].n, N = [];
  const add = (texto, tipo = 'clube') => N.push({ rodada: 0, tipo, div: base.clubes[ci].div, texto });
  const tabs = Object.fromEntries(DIVS.map(d => [d, tabela(base, s, d)]));
  const pos = tabs[div].findIndex(l => l.clube === ci) + 1, meta = metaDiretoria(base, s);
  const artilheiro = d => { const t = Object.entries(s.est).map(([id, e]) => [base.jog.get(+id), e[1]]).filter(([j, g]) => j && g && base.clubes[j.clube].div === d).sort((a, b) => b[1] - a[1])[0]; return t ? { id: t[0].id, nome: t[0].curto, clube: t[0].clube, gols: t[1] } : null; };
  const sobe = { B: tabs.B.slice(0, 4).map(l => l.clube), C: tabs.C.slice(0, 4).map(l => l.clube) }, cai = { A: tabs.A.slice(16).map(l => l.clube), B: tabs.B.slice(16).map(l => l.clube) };
  s.historico ||= [];
  s.historico.unshift({
    ano: s.ano, clube: ci, div, pos, pts: tabs[div][pos - 1].p, meta: meta.txt, bateuMeta: pos <= meta.pos,
    campeoes: Object.fromEntries(DIVS.map(d => [d, tabs[d][0].clube])), art: Object.fromEntries(DIVS.map(d => [d, artilheiro(d)])),
    copa: s.copa ? { campeao: s.copa.campeao, vice: s.copa.vice, meu: campanha(s, ci) } : null,
    cont: s.cont ? { LIB: s.cont.LIB.campeao, SUL: s.cont.SUL.campeao, sup: s.cont.sup.jogo?.campeao ?? null, meu: ['LIB', 'SUL'].map(k => campanhaCont(s, k, ci) && `${k === 'LIB' ? 'Libertadores' : 'Sul-Americana'}: ${campanhaCont(s, k, ci).toLowerCase()}`).find(Boolean) || null } : null,
    sobem: { A: sobe.B, B: sobe.C }, caem: { B: cai.A, C: cai.B },
  });
  const f = s.fin;
  f.diretoria = clamp(f.diretoria + (pos <= meta.pos ? 10 : -12) + (s.copa?.campeao === ci ? 8 : 0), 0, 100);
  add(pos <= meta.pos ? `A diretoria comemora: meta da temporada cumprida (${meta.txt}).` : `A diretoria cobra: a meta era ${meta.txt} e o time terminou em ${pos}º.`);

  // vagas da próxima temporada: tabela final da Série A e o campeão da Copa do Brasil
  s.classif = { A: tabs.A.map(l => l.clube), copa: s.copa?.campeao ?? null };
  // acesso e rebaixamento
  s.divs ||= {};
  for (const [lista, d] of [[cai.A, 'B'], [sobe.B, 'A'], [cai.B, 'C'], [sobe.C, 'B']]) for (const c of lista) { if (base.clubes[c].divOrig === d) delete s.divs[c]; else s.divs[c] = d; }
  if (sobe.B.includes(ci) || sobe.C.includes(ci)) add(`ACESSO! O ${nome(ci)} vai disputar a Série ${sobe.B.includes(ci) ? 'A' : 'B'} em ${s.ano + 1}.`, 'destaque');
  if (cai.A.includes(ci) || cai.B.includes(ci)) add(`Rebaixado. O ${nome(ci)} cai para a Série ${cai.A.includes(ci) ? 'B' : 'C'}.`, 'crise');

  // empréstimos voltam e pré-contratos se cumprem
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
  s.jovens = [...(s.jovens || []), ...jovens];
  aplicarSave(base, s);
  const meus = jovens.filter(r => r[3] === ci);
  if (meus.length) add(`Subiram da base: ${meus.map(r => `${r[2]} (${r[4]}, ${r[5]} anos)`).join(', ')}.`);

  // temporada zerada
  viradaDM(base, s);
  s.forma = {}; s.afast = {}; s.julgamentos = [];
  Object.assign(s, { rodada: 0, res: { A: {}, B: {}, C: {} }, est: {}, ultima: null, lider: {}, rumores: {}, destaques: {}, ultimaData: null, recuperado: null, cond: {}, mor: {}, semJogar: {}, xi: null, banco: null, recebidas: [], preContratos: [] });
  delete s._cal;
  s.propostas = s.propostas.filter(p => !['aguardando', 'contraproposta'].includes(p.estado)).slice(0, 30);
  s.listas = { venda: s.listas.venda.filter(id => base.jog.get(id)?.clube === ci), emprestimo: s.listas.emprestimo.filter(id => base.jog.get(id)?.clube === ci) };
  if (f.socorro) { lancar(s, 'socorro', 'Desconto dos adiantamentos da TV', -cotaTV(base.clubes[ci]) / 8 * f.socorro, 0); f.socorro = 0; }
  Object.assign(f, { temporada: { ano: s.ano, compras: 0, vendas: 0, folha0: folhaDia(base, s) }, tvPagas: [], ultimaVerba: -99, verbasRecentes: [], atraso: 0, salarioBudget: null });
  novaCopa(base, s);
  novaCont(base, s);
  const h = s.historico[0];
  add(`Começa a temporada ${s.ano}. Sobem para a Série A: ${h.sobem.A.map(nome).join(', ')}. Caem para a B: ${h.caem.B.map(nome).join(', ')}.`, 'resultado');
  s.noticias = [...N, ...s.noticias].slice(0, 220);
  return h;
}
