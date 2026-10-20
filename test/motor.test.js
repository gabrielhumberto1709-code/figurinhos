import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pontosCorridos } from '../public/js/motor/calendario.js';
import { simular, melhorTime } from '../public/js/motor/partida.js';
import { Base, novoJogo, avancar, tabela, paraSalvar, acessoEQueda } from '../public/js/motor/mundo.js';
import { tetoSalarial, salarioDia as salDia } from '../public/js/motor/financas.js';

const base = new Base(JSON.parse(fs.readFileSync(new URL('../public/data/brasil.json', import.meta.url))));
const cfg = seed => ({ tecnico: { nome: 'Teste', reputacao: 1 }, modo: 'escolher', clube: 0, seed });
// joga até a liga chegar na rodada n (jogos da copa no meio contam à parte)
const ate = (s, n) => { while (s.rodada < n) avancar(base, s); };
const rodada = s => ate(s, s.rodada + 1);
// na pré-temporada e nos regionais o mercado roda uma vez por semana: joga até a próxima semana fechar
const semana = s => { const n = s.semanaBloco?.n || 0, r = s.rodada; while ((s.semanaBloco?.n || 0) === n && s.rodada === r) avancar(base, s); };

test('calendário: 38 rodadas, cada par se enfrenta em casa e fora, um jogo por rodada', () => {
  const times = [...Array(20).keys()], cal = pontosCorridos(times, 7);
  assert.equal(cal.length, 38);
  const vistos = new Set();
  for (const rd of cal) {
    assert.equal(new Set(rd.flat()).size, 20);
    for (const [h, a] of rd) { assert.ok(!vistos.has(`${h}-${a}`)); vistos.add(`${h}-${a}`); }
  }
  assert.equal(vistos.size, 380);
});

test('partida é determinística pela semente', () => {
  const a = melhorTime(base.elencos[0]), b = melhorTime(base.elencos[1]);
  assert.deepEqual(simular(a, b, 'x'), simular(a, b, 'x'));
});

test('temporada da Série A com números de futebol de verdade', () => {
  let n = 0, g = 0, casa = 0;
  const campeoes = [], lanternas = [];
  for (const seed of [1, 2, 3]) {
    const s = novoJogo(base, cfg(seed));
    ate(s, 38);
    for (const v of Object.values(s.res.A)) { n++; g += v[0] + v[1]; if (v[0] > v[1]) casa++; }
    const t = tabela(base, s, 'A');
    assert.equal(t.reduce((x, l) => x + l.j, 0), 760);
    campeoes.push(t[0].p); lanternas.push(t[19].p);
  }
  const media = g / n, mando = casa / n;
  assert.ok(media > 2.1 && media < 2.8, `gols por jogo ${media}`);
  assert.ok(mando > 0.4 && mando < 0.55, `vitórias do mandante ${mando}`);
  for (const p of campeoes) assert.ok(p >= 65 && p <= 95, `campeão ${p}`);
  for (const p of lanternas) assert.ok(p >= 10 && p <= 40, `lanterna ${p}`);
});

test('save sem cache volta igual', () => {
  const s = novoJogo(base, cfg(5));
  rodada(s); rodada(s);
  const volta = JSON.parse(JSON.stringify(paraSalvar(s)));
  assert.equal(volta._cal, undefined);
  assert.deepEqual(tabela(base, volta, 'A'), tabela(base, s, 'A'));
});

import { escalar, trocarFormacao, escalacao } from '../public/js/motor/mundo.js';
import { interessados, media } from '../public/js/motor/noticias.js';

test('escalação manual: entra quem eu escolho, titular troca de vaga e muda esquema sem perder ninguém', () => {
  const s = novoJogo(base, cfg(8)), ci = s.tecnico.clube;
  const auto = escalacao(base, s, ci), reserva = auto.banco[auto.banco.length - 1];
  escalar(base, s, 9, reserva.id);
  assert.equal(escalacao(base, s, ci).xi[9].id, reserva.id);
  const a = s.xi[1], b = s.xi[2];
  escalar(base, s, 1, b);
  assert.deepEqual([s.xi[1], s.xi[2]], [b, a]);
  const onze = new Set(s.xi);
  trocarFormacao(base, s, '3-5-2');
  assert.equal(s.formacao, '3-5-2');
  assert.deepEqual(new Set(s.xi), onze);
  rodada(s);
  assert.ok(s.ultima.xi[s.ultima.casa === ci ? 0 : 1].includes(reserva.id));
});

test('jornal: estatísticas batem com os gols e rumores fazem sentido de futebol', () => {
  const s = novoJogo(base, cfg(9));
  // o rumor tem que fazer sentido quando sai (depois o mercado mexe nos elencos)
  const rumores = [];
  while (s.rodada < 20) {
    avancar(base, s);
    for (const n of s.noticias) {
      if (n.para == null || rumores.includes(n)) continue;
      rumores.push(n);
      const j = base.jog.get(n.jogador);
      // negócio fechado na mesma rodada, depois do rumor, muda as forças: aí não dá pra conferir
      if (s.historicoTransf.some(t => t.rodada >= n.rodada - 1 && [t.de, t.para].some(c => c === n.para || c === n.de))) continue;
      assert.ok(base.forca(n.para) >= base.forca(n.de) + 2, 'clube interessado tem que ser maior');
      assert.ok(interessados(base, j).includes(n.para));
      assert.ok(media(s.est[j.id]) > 0);
    }
  }
  const golsTabela = ['A', 'B', 'C'].reduce((t, d) => t + Object.values(s.res[d]).reduce((x, g) => x + g[0] + g[1], 0), 0);
  const golsEst = Object.values(s.est).reduce((t, e) => t + e[1], 0); // tem gente que trocou de série no mercado
  assert.equal(golsEst, golsTabela);
  assert.ok(rumores.length >= 10, `só ${rumores.length} rumores`);
  assert.ok(s.destaques.A.time.length === 11);
  // capa: o craque da rodada da sua série, com placar e nota do jogo dele
  const m = s.manchete, j = base.jog.get(m.jogador), [id, nota] = s.destaques.A.time.slice().sort((x, y) => y[1] - x[1])[0];
  assert.equal(m.rodada, 20);
  assert.equal(m.jogador, id);
  assert.ok(m.titulo.includes(j.curto) && m.sub.endsWith(`Nota ${nota.toFixed(1).replace('.', ',')}.`), `${m.titulo} / ${m.sub}`);
  assert.match(m.sub, / \d+ × \d+ /);
});

import { precoPedido, fazerProposta, vontade, salarioPedido, aceitarContraproposta, renovar, pedidoRenovacao, observar, listasIA, bloqueioProposta } from '../public/js/motor/mercado.js';
import { aplicarSave } from '../public/js/motor/mundo.js';
const proposta = (base, s, j, extra = {}) => ({ tipo: 'compra', valor: precoPedido(base, s, j), salario: salarioPedido(base, s, j, 3), anos: 3, ...extra });

test('mercado: proposta boa por jogador que quer vir fecha na rodada seguinte; dinheiro, salário e contrato mudam', () => {
  const ci = base.clubes.findIndex(c => c.n === 'Flamengo');
  const s = novoJogo(base, { ...cfg(21), clube: ci });
  const alvo = [...base.jog.values()].filter(j => j.clube !== ci && base.clubes[j.clube].div === 'B' && vontade(base, s, j, ci) >= 70).sort((a, b) => b.ovr - a.ovr)[0];
  assert.ok(alvo, 'precisa de um alvo');
  const o = proposta(base, s, alvo), n = base.elencos[ci].length;
  assert.equal(fazerProposta(base, s, alvo, o), null);
  semana(s);
  const p = s.propostas[0];
  assert.ok(['concluida', 'perdida'].includes(p.estado), `estado ${p.estado} ${p.motivo || ''}`);
  if (p.estado === 'concluida') {
    assert.equal(alvo.clube, ci);
    assert.ok(s.fin.extrato.some(e => e.tipo === 'compra' && e.valor === -o.valor));
    assert.equal(s.salarios[alvo.id], o.salario);
    assert.equal(alvo.contrato, s.ano + 3);
    assert.equal(base.elencos[ci].length, n + 1);
  }
});

import { responderProposta as respAgora, clausula as clausulaDe } from '../public/js/motor/mercado.js';
test('mercado: a CPU responde na hora; multa rescisória paga, o clube não segura (só o jogador decide)', () => {
  const s = novoJogo(base, cfg(23)), alvo = base.elencos[5][0];
  assert.equal(fazerProposta(base, s, alvo, proposta(base, s, alvo, { valor: precoPedido(base, s, alvo) * 0.5 })), null);
  assert.ok(respAgora(base, s, s.propostas[0].id)); assert.equal(s.propostas[0].estado, 'recusada');
  s.caixa = 2e9; s.fin.salarioBudget = null;
  const brs = [...base.jog.values()].filter(j => j.clube !== s.tecnico.clube && base.clubes[j.clube].div === 'A' && clausulaDe(base, s, j) && vontade(base, s, j, s.tecnico.clube) >= 75);
  const o = j => proposta(base, s, j, { valor: clausulaDe(base, s, j).nac, salario: salarioPedido(base, s, j, 3) });
  const j = brs.find(j => !bloqueioProposta(base, s, j, o(j)));
  assert.ok(j, 'precisa de um alvo com a multa no orçamento');
  assert.equal(fazerProposta(base, s, j, o(j)), null);
  assert.match(respAgora(base, s, s.propostas[0].id), /Multa rescisória paga/);
  assert.equal(s.propostas[0].estado, 'concluida', s.propostas[0].motivo); // ele quer vir: o clube não tinha como segurar
});

import { chegouNaJanela, transferir as transf } from '../public/js/motor/mercado.js';
test('mercado: quem chegou nesta janela não recebe proposta até ela fechar', () => {
  const s = novoJogo(base, cfg(24)), alvo = base.elencos[5][3], para = 7;
  assert.equal(chegouNaJanela(s, alvo.id), false);
  transf(base, s, alvo, para, 1e6);                       // pré-temporada: janela de janeiro aberta
  assert.ok(chegouNaJanela(s, alvo.id));
  assert.match(bloqueioProposta(base, s, alvo, proposta(base, s, alvo)), /acabou de chegar/);
  s.rodada = 10;                                          // maio: a janela fechou
  assert.equal(chegouNaJanela(s, alvo.id), false);
  assert.doesNotMatch(bloqueioProposta(base, s, alvo, proposta(base, s, alvo)) || '', /acabou de chegar/);
});

test('mercado: proposta baixa é recusada, janela fechada não bloqueia jogador livre', () => {
  const s = novoJogo(base, cfg(22));
  const alvo = base.elencos[5][0];
  assert.equal(fazerProposta(base, s, alvo, proposta(base, s, alvo, { valor: precoPedido(base, s, alvo) * 0.5 })), null);
  rodada(s);
  assert.equal(s.propostas[0].estado, 'recusada');
  s.rodada = 10; s.fin.salarioBudget = 1e9;
  const outro = base.elencos[6][0];
  const livre = base.elencos[base.clubes.findIndex(c => c.div === 'L')].sort((a, b) => b.ovr - a.ovr).find(j => vontade(base, s, j, s.tecnico.clube) >= 60 && salarioPedido(base, s, j, 2) <= tetoSalarial(base, s).teto);
  assert.ok(livre, 'precisa de um livre');
  assert.equal(precoPedido(base, s, livre), 0);
  assert.equal(fazerProposta(base, s, livre, { tipo: 'livre', salario: salarioPedido(base, s, livre, 2), anos: 2 }), null);
  rodada(s);
  const p = s.propostas[0];
  assert.ok(['concluida', 'perdida'].includes(p.estado), `estado ${p.estado} ${p.motivo || ''}`);
  if (p.estado === 'concluida') { assert.equal(livre.clube, s.tecnico.clube); assert.ok(!s.fin.extrato.some(e => e.tipo === 'compra')); }
  assert.match(bloqueioProposta(base, s, outro, { tipo: 'pre', salario: 1000, anos: 2 }), /Pré-contrato/);
});

test('mercado: salário baixo vira contraproposta do jogador; aceitar fecha o negócio', () => {
  const ci = base.clubes.findIndex(c => c.n === 'Palmeiras');
  const s = novoJogo(base, { ...cfg(23), clube: ci });
  const alvo = [...base.jog.values()].filter(j => j.clube !== ci && base.clubes[j.clube].div === 'B' && vontade(base, s, j, ci) >= 75).sort((a, b) => b.ovr - a.ovr)[0];
  const o = proposta(base, s, alvo), pede = o.salario;
  assert.equal(fazerProposta(base, s, alvo, { ...o, salario: Math.round(pede * 0.5) }), null);
  semana(s);
  const p = s.propostas[0];
  if (p.estado === 'perdida') return; // rival levou: caminho válido
  assert.equal(p.estado, 'contraproposta');
  assert.ok(p.contraSal >= pede * 0.9, `pediu ${p.contraSal}, esperado perto de ${pede}`);
  assert.equal(aceitarContraproposta(base, s, p.id), null);
  semana(s);
  assert.ok(['concluida', 'perdida'].includes(p.estado), p.estado);
  if (p.estado === 'concluida') assert.equal(s.salarios[alvo.id], p.salario);
});

test('mercado: renovação pede salário, aceita quando paga e o contrato novo sobrevive ao save', () => {
  const s = novoJogo(base, cfg(24)), ci = s.tecnico.clube;
  s.fin.salarioBudget = 1e9; // folga sobrando
  const cabe = x => pedidoRenovacao(base, s, x, 4).pede <= Math.max(tetoSalarial(base, s).teto, salDia(base, s, x) * 1.15);
  const j = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).slice(3).find(cabe);
  s.contratos[j.id] = s.ano; aplicarSave(base, s);
  const { pede } = pedidoRenovacao(base, s, j, 4);
  const nao = renovar(base, s, j, Math.round(pede * 0.6), 4);
  assert.equal(nao.ok, false); assert.equal(nao.pede, pede);
  assert.equal(renovar(base, s, j, pede, 4).ok, true);
  const volta = JSON.parse(JSON.stringify(paraSalvar(s)));
  base.aplicarTransferencias({}); assert.notEqual(j.contrato, s.ano + 4);
  aplicarSave(base, volta); assert.equal(j.contrato, s.ano + 4);
});

test('mercado: olheiro traz relatórios do foco e observação exata; listas da IA existem', () => {
  const s = novoJogo(base, cfg(25));
  s.olheiro = { regiao: 'EUR', setor: 'ATA', jovens: true };
  const alvo = base.elencos[3][0];
  assert.equal(observar(s, alvo.id), null);
  semana(s);
  assert.equal(s.relatorios[alvo.id].exato, true);
  const novos = Object.entries(s.relatorios).filter(([, r]) => r.novo).map(([id]) => base.jog.get(+id));
  assert.equal(novos.length, 2);
  for (const j of novos) { assert.equal(base.clubes[j.clube].div, 'X'); assert.ok(j.idade <= 21); }
  const L = listasIA(base, s);
  assert.ok(L.venda.size > 50 && L.emprestimo.size > 10, `listas ${L.venda.size}/${L.emprestimo.size}`);
});

test('mercado da IA: clubes se reforçam nas janelas sem desmontar elencos', () => {
  const s = novoJogo(base, cfg(26)), ci = s.tecnico.clube, n0 = base.elencos[ci].length, ini = base.elencos.map(e => e.length);
  ate(s, 38);
  const ia = s.historicoTransf.filter(x => x.ia);
  assert.ok(ia.length >= 8, `só ${ia.length} negócios da IA`);
  for (const x of ia) { assert.notEqual(x.para, ci); assert.notEqual(x.de, ci); }
  base.clubes.forEach((c, i) => { if (['A', 'B', 'C'].includes(c.div)) assert.ok(base.elencos[i].length >= Math.min(19, ini[i]) && base.elencos[i].length <= Math.max(38, ini[i]) + 1, `${c.n}: ${base.elencos[i].length}`); });
  assert.equal(base.elencos[ci].length, n0 + s.historicoTransf.filter(x => x.para === ci).length - s.historicoTransf.filter(x => x.de === ci).length);
});

import { criarPartida, passo, acabou, ESTILOS } from '../public/js/motor/partida.js';
import { recuperar, definirCapitao } from '../public/js/motor/mundo.js';

test('condição cai no jogo e volta no descanso; capitão novo mexe na moral', () => {
  const s = novoJogo(base, cfg(31)), ci = s.tecnico.clube;
  avancar(base, s);
  const titular = s.ultima.xi[s.ultima.casa === ci ? 0 : 1][3];
  const depois = s.cond[titular];
  assert.ok(depois < 85, `condição depois do jogo ${depois}`);
  recuperar(base, s, 4);
  assert.ok((s.cond[titular] ?? 100) > depois + 10, 'recupera com 4 dias');
  const outro = escalacao(base, s, ci).xi.find(j => j.id !== escalacao(base, s, ci).capitao && j.pos !== 'GOL');
  const antes = s.mor[outro.id] ?? 62;
  definirCapitao(base, s, outro.id);
  assert.equal(s.mor[outro.id], Math.min(100, antes + 4));
});

test('plano B entra sozinho: perdendo depois dos 60 o time vai para pressão total', () => {
  const a = melhorTime(base.elencos[30]), b = melhorTime(base.elencos[0]);
  let viu = false;
  for (let k = 0; k < 40 && !viu; k++) {
    const P = criarPartida({ ...a, gatilhos: { perdendo60: { estilo: 'pressao' } } }, b, 'plano' + k, { narrar: true });
    while (!acabou(P)) passo(P);
    if (P.disparou[0].perdendo60) { assert.equal(P.times[0].estilo, 'pressao'); assert.ok(P.lances.some(l => l.tipo === 'tatica')); viu = true; }
  }
  assert.ok(viu, 'em 40 jogos o time fraco deveria estar perdendo aos 60 alguma vez');
  assert.equal(Object.keys(ESTILOS).length, 8);
});

import { orcamento, folhaDia, balanco } from '../public/js/motor/financas.js';

test('finanças: salários saem e receitas entram a cada rodada; orçamento de compras nunca passa do caixa', () => {
  const s = novoJogo(base, cfg(41));
  const caixa0 = s.caixa;
  ate(s, 6);
  const b = balanco(s);
  assert.ok(b.salarios < 0 && b.tv > 0 && b.patrocinio > 0, JSON.stringify(b));
  const soma = Object.values(b).reduce((t, v) => t + v, 0);
  assert.ok(Math.abs(s.caixa - caixa0 - soma) < 5, 'extrato bate com o caixa');
  const o = orcamento(base, s);
  assert.ok(o.compras >= 0 && o.compras <= s.caixa);
  assert.ok(folhaDia(base, s) > 0);
});

import { virarTemporada, fimDeTemporada } from '../public/js/motor/temporada.js';
import { proximoEvento, rodadasDe } from '../public/js/motor/mundo.js';
import { FASES, penaltis } from '../public/js/motor/copa.js';

test('copa do brasil 2026: 126 clubes, fases 1-4 em jogo único, Série A na 5ª fase, final única', () => {
  const ci = base.clubes.findIndex(c => c.n === 'Flamengo');
  const s = novoJogo(base, { ...cfg(41), clube: ci });
  assert.equal(s.copa.chaves.length, 14);
  assert.equal(new Set(s.copa.todos).size, 126);
  assert.ok(s.copa.espera.f5.includes(ci) && s.copa.espera.f5.length === 20, 'Série A entra na 5ª fase');
  let jogosCopa = 0;
  while (!fimDeTemporada(s)) { if (proximoEvento(base, s)?.tipo === 'copa') jogosCopa++; avancar(base, s); }
  assert.equal(s.copa.fase, FASES.length);
  assert.ok(s.copa.campeao != null && s.copa.vice != null && s.copa.campeao !== s.copa.vice);
  assert.equal(s.copa.jogos.length, 14 + 44 + 24 + 12 + 2 * (16 + 8 + 4 + 2) + 1);
  for (const j of s.copa.jogos) {
    const P = FASES[j.fase].perna;
    if (P === 'unico' && j.gols[0] === j.gols[1]) assert.ok(j.pen, 'jogo único empatado vai para os pênaltis');
    if (P !== 'volta') continue;
    const ida = s.copa.jogos.find(x => x.fase === j.fase - 1 && x.h === j.a && x.a === j.h);
    assert.ok(ida, 'a volta inverte o mando da ida');
    if (j.gols[0] + ida.gols[1] === j.gols[1] + ida.gols[0]) assert.ok(j.pen, 'agregado empatado precisa de pênaltis');
  }
  assert.equal(FASES.at(-1).perna, 'unico');
  assert.ok(jogosCopa >= 2 && jogosCopa <= 9);
  if (s.copa.campeao === ci) assert.ok(s.fin.extrato.some(e => e.desc.includes('campeão')));
  assert.deepEqual(penaltis('x'), penaltis('x'));
});

test('virada de temporada: 4 sobem e 4 caem, todo mundo envelhece, contratos e calendário novos', () => {
  const s = novoJogo(base, cfg(42)), ci = s.tecnico.clube;
  const amostra = base.elencos[5].find(j => j.idade < 30), idade0 = amostra.idade;
  const sairao = base.elencos[ci].filter(j => j.contrato <= s.ano).map(j => j.id);
  const renovado = sairao[0];
  if (renovado != null) { s.contratos[renovado] = s.ano + 2; aplicarSave(base, s); }
  while (!fimDeTemporada(s)) avancar(base, s);
  const tabA = tabela(base, s, 'A'), tabB = tabela(base, s, 'B'), tabC = tabela(base, s, 'C'), Q = acessoEQueda(base, s);
  // 2026: B sobe os 2 primeiros + os vencedores do playoff (3º×6º, 4º×5º); C sobe os 2 de cada quadrangular e cai 2
  assert.deepEqual(Q.sobe.B.slice(0, 2), tabB.slice(0, 2).map(l => l.clube));
  assert.ok(Q.sobe.B.slice(2).every(c => tabB.slice(2, 6).some(l => l.clube === c)));
  assert.ok(Q.sobe.C.every(c => tabC.slice(0, 8).some(l => l.clube === c)) && Q.sobe.C.length === 4);
  assert.deepEqual(Q.cai.C, tabC.slice(18).map(l => l.clube));
  const h = virarTemporada(base, s);
  assert.equal(s.ano, 2027); assert.equal(s.rodada, 0); assert.equal(h.ano, 2026);
  for (const d of ['A', 'B', 'C']) assert.equal(base.clubes.filter(c => c.div === d).length, 20, d);
  for (const l of tabA.slice(16)) assert.equal(base.clubes[l.clube].div, 'B');
  for (const c of Q.sobe.B) assert.equal(base.clubes[c].div, 'A');
  for (const c of Q.cai.C) assert.equal(base.clubes[c].div, 'R');
  for (const c of h.sobem.C) assert.ok(base.clubes[c].div === 'C' && base.elencos[c].length >= 26, 'quem sobe da D chega com elenco');
  if (!amostra.fora) assert.equal(amostra.idade, idade0 + 1);
  for (const id of sairao.slice(1)) assert.notEqual(base.jog.get(id).clube, ci, 'contrato acabou: saiu');
  if (renovado != null) assert.equal(base.jog.get(renovado).clube, ci);
  for (const d of ['A', 'B', 'C']) { const cal = rodadasDe(base, s, d); assert.equal(cal.length, d === 'C' ? 19 : 38); assert.equal(new Set(cal[0].flat()).size, 20); }
  assert.ok(base.elencos[ci].length >= 18, `elenco ${base.elencos[ci].length}`);
  assert.equal(s.copa.ano, 2027); assert.equal(s.copa.chaves.length, 14);
  // save e carga na temporada nova: jovens da base e divisões voltam iguais
  const volta = JSON.parse(JSON.stringify(paraSalvar(s))), n = base.elencos[ci].length;
  base.aplicarTransferencias({}); aplicarSave(base, volta);
  assert.equal(base.elencos[ci].length, n);
  ate(s, 3);
  assert.equal(tabela(base, s, 'A').reduce((t, l) => t + l.j, 0), 60);
});

import { posJogo, infilInfo, infiltrar } from '../public/js/motor/dm.js';
test('DM: lesionado e suspenso ficam fora, a vaga é completada e o desfalque é cumprido', () => {
  const s = novoJogo(base, cfg(11)), ci = s.tecnico.clube;
  ate(s, 12);
  assert.ok(Object.keys(s.dm).length > 0, 'ninguém se machucou em 12 rodadas');
  for (const c of base.clubes.map((x, i) => i).filter(i => base.clubes[i].div === 'A')) {
    const t = escalacao(base, s, c, 'L');
    for (const j of [...t.xi, ...t.banco].filter(Boolean)) { assert.ok(!s.dm[j.id], `${j.curto} lesionado escalado`); assert.ok(!(s.susp[j.id]?.L > 0), `${j.curto} suspenso escalado`); }
  }
  // titular da escalação manual se machuca: entra outro só nesse jogo, a escalação salva continua igual
  const time = escalacao(base, s, ci, 'L'); s.xi = time.xi.map(j => j.id); s.formacao = time.formacao;
  const alvo = time.xi[9]; s.dm[alvo.id] = { k: 'posterior', n: 2, tot: 5 };
  const novo = escalacao(base, s, ci, 'L');
  assert.ok(!novo.xi.includes(alvo) && novo.trocados[0][0] === alvo && s.xi.includes(alvo.id));
  // reta final: dá pra infiltrar; aí ele pode jogar
  assert.ok(infilInfo(s, alvo.id).ok);
  infiltrar(s, alvo.id);
  assert.ok(escalacao(base, s, ci, 'L').xi.includes(alvo));
  // cumpre um jogo por partida do clube
  const n0 = s.dm[alvo.id].n;
  posJogo(base, s, ci, ci === 0 ? 1 : 0, { notas: [{}, {}], eventos: [] }, 'L');
  assert.equal(s.dm[alvo.id].n, n0 - 1);
  assert.ok(!s.dm[alvo.id].inf);
});

test('cartões: 3 amarelos ou vermelho suspendem só na competição do jogo', () => {
  const s = novoJogo(base, cfg(12)), ci = s.tecnico.clube, j = base.elencos[ci][3], adv = ci === 0 ? 1 : 0;
  const jogo = (ev, comp) => posJogo(base, s, ci, adv, { notas: [{ [j.id]: 6 }, {}], eventos: ev.map(tipo => ({ tipo, jogador: j.id, time: 0 })) }, comp);
  jogo(['amarelo'], 'L'); jogo(['amarelo'], 'L');
  assert.ok(!s.susp[j.id]);
  jogo(['amarelo'], 'CB');
  assert.ok(!s.susp[j.id], 'amarelo da copa não soma no campeonato');
  const N = jogo(['amarelo'], 'L');
  assert.equal(s.susp[j.id].L, 1);
  assert.ok(N.some(n => n.texto.includes('terceiro amarelo')));
  assert.ok(!escalacao(base, s, ci, 'L').xi.includes(j) && !escalacao(base, s, ci, 'L').banco.includes(j));
  // cumpre no próximo jogo do campeonato (o da copa não conta)
  posJogo(base, s, ci, adv, { notas: [{}, {}], eventos: [] }, 'CB');
  assert.equal(s.susp[j.id].L, 1);
  posJogo(base, s, ci, adv, { notas: [{}, {}], eventos: [] }, 'L');
  assert.ok(!s.susp[j.id]);
  jogo(['amarelo', 'vermelho'].slice(1), 'L');
  assert.equal(s.susp[j.id].L, 2);
});

import { aposRodada, aceitarOferta, pilares } from '../public/js/motor/carreira.js';
test('cargo: longe da meta e sem apoio leva ultimato; sem os pontos, demissão, propostas e clube novo', () => {
  const s = novoJogo(base, cfg(21)), ci = s.tecnico.clube, d = base.clubes[ci].div;
  ate(s, 12);
  // o time perdeu todos os jogos do campeonato
  for (const k of Object.keys(s.res[d])) { const [h, a] = k.split('-').map(Number); if (h === ci) s.res[d][k] = [0, 3]; if (a === ci) s.res[d][k] = [3, 0]; }
  const tabs = () => Object.fromEntries(['A', 'B', 'C'].map(x => [x, tabela(base, s, x)]));
  s.fin.diretoria = 20; s.torcida = 20; s.cargo.ults = []; s.cargo.ult = null;
  for (const j of base.elencos[ci]) s.mor[j.id] = 40;
  aposRodada(base, s, tabs());
  assert.equal(s.cargo.st, 'ult');
  assert.ok(s.noticias.length && s.cargo.ult.need >= 4);
  s.cargo.ult.j0 -= 3; // 3 jogos depois, nenhum ponto
  aposRodada(base, s, tabs());
  assert.ok(s.demitido && s.demitido.de === ci, 'devia ter sido demitido');
  assert.ok(s.ofertas.length >= 1 && s.ofertas.every(o => o.clube !== ci));
  const novo = s.ofertas[0].clube;
  aceitarOferta(base, s, novo);
  assert.equal(s.tecnico.clube, novo);
  assert.ok(!s.demitido && s.cargo.st === 'ok' && s.xi === null && s.caixa > 0);
  assert.equal(s.carreira.length, 2);
  assert.equal(pilares(base, s).T, 55);
  // e o jogo segue com o clube novo
  const r0 = s.rodada; avancar(base, s); assert.ok(s.rodada >= r0);
});

import { tabelaGrupo, FASES_CONT } from '../public/js/motor/continental.js';
test('continentais: grupos completos, mata-mata até o campeão, prêmios e vagas pela tabela no ano seguinte', () => {
  const A = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A').sort((a, b) => base.forca(b) - base.forca(a));
  const s = novoJogo(base, { ...cfg(31), clube: A[0] }), ci = s.tecnico.clube;
  // 2026: os grupos do sorteio real (32 clubes, 8 grupos; 6 brasileiros na Libertadores e 7 na Sul-Americana)
  for (const [k, br] of [['LIB', 6], ['SUL', 7]]) { const T = s.cont[k]; assert.equal(new Set(T.grupos.flat()).size, 32); assert.equal(T.grupos.length, 8); assert.equal(T.grupos.flat().filter(c => base.clubes[c].div !== 'X').length, br); }
  assert.deepEqual(s.cont.LIB.grupos[0].map(c => base.clubes[c].n), ['Flamengo', 'Estudiantes', 'Cusco FC', 'Independiente Medellín']);
  assert.ok(s.cont.LIB.grupos.flat().includes(ci), 'o mais forte da A joga a Libertadores');
  while (!fimDeTemporada(s)) avancar(base, s);
  for (const k of ['LIB', 'SUL']) {
    const T = s.cont[k];
    assert.equal(T.fase, FASES_CONT.length);
    assert.ok(T.campeao != null && T.vice != null && T.campeao !== T.vice);
    for (let g = 0; g < 8; g++) assert.ok(tabelaGrupo(T, g).every(l => l.j === 6));
    assert.equal(T.jogos.length, 96 + (k === 'SUL' ? 16 : 0) + 2 * (8 + 4 + 2) + 1); // a Sula tem o playoff
  }
  // playoff da Sula: os 8 terceiros da Libertadores contra os 8 segundos da Sula
  const terceiros = s.cont.LIB.grupos.map((g, i) => tabelaGrupo(s.cont.LIB, i)[2].clube).sort();
  assert.deepEqual(s.cont.SUL.vindos.slice().sort(), terceiros);
  assert.ok(s.cont.sup.jogo?.campeao != null);
  assert.ok(s.fin.extrato.some(e => e.desc.includes('Libertadores: cota da fase de grupos')));
  // vagas de 2026: 1º ao 4º e os campeões (Libertadores, Sula, Copa) nos grupos; o 5º e o vice da Copa na pré
  virarTemporada(base, s);
  const cl = s.classif, tabA = cl.A, br = c => c != null && ['A', 'B', 'C'].includes(base.clubes[c].div);
  const titulos = [cl.lib, cl.sul, cl.copa].filter(br), vice = br(cl.copaVice) ? cl.copaVice : null;
  const libBR = s.cont.LIB.espera.filter(br), preBR = s.cont.PRE.clubes.filter(br);
  assert.ok([...tabA.slice(0, 4), ...titulos].every(c => libBR.includes(c)), 'G4 e campeões nos grupos');
  assert.equal(libBR.length, 4 + titulos.length);
  assert.equal(preBR.length, 1 + (vice != null ? 1 : 0));
  if (vice != null) assert.ok(libBR.includes(vice) || preBR.includes(vice));
  assert.ok(preBR.includes(tabA.find(c => !libBR.includes(c))), 'o mais bem colocado de fora vai à pré');
  assert.equal(s.cont.sup.h, tabA[0]);
  // pré: 2ª e 3ª fases em ida e volta; no fim, sorteio com os 4 vencedores na Libertadores e os 4 da 3ª fase na Sula
  assert.equal(s.cont.LIB.grupos.length, 0);
  while (!s.cont.LIB.grupos.length) avancar(base, s);
  const P = s.cont.PRE, L = s.cont.LIB.grupos.flat(), U = s.cont.SUL.grupos.flat();
  assert.equal(P.jogos.length, 24); assert.equal(new Set([...L, ...U]).size, 64);
  assert.ok(P.venc.every(c => L.includes(c)) && P.perd.every(c => U.includes(c)));
});

import { abrirColetiva, responder, efeito, TONS, perfil } from '../public/js/motor/imprensa.js';
test('coletiva: 3 perguntas do jogo, respostas mexem nas plateias e viram notícia; nova coletiva a cada jogo', () => {
  const s = novoJogo(base, cfg(51)), ci = s.tecnico.clube;
  assert.equal(abrirColetiva(base, s), null);
  ate(s, 3);
  const C = abrirColetiva(base, s);
  assert.equal(C.perguntas.length, 3);
  assert.equal(new Set(C.perguntas.map(p => p.tema)).size, 3);
  for (const p of C.perguntas) { assert.ok(p.respostas.length >= 3 && p.texto.length > 5 && !p.texto.includes('{')); assert.ok(p.respostas.every(r => TONS[r.tom] && !r.texto.includes('{'))); }
  assert.equal(abrirColetiva(base, s), C, 'mesma coletiva até o próximo jogo');
  const d0 = s.fin.diretoria, t0 = s.torcida, n0 = s.noticias.length;
  const tom = C.perguntas[0].respostas.find(r => TONS[r.tom].sobe === 'D' || TONS[r.tom].desce === 'D')?.tom || C.perguntas[0].respostas[0].tom, e = efeito(s, tom);
  responder(base, s, 0, tom);
  assert.equal(s.fin.diretoria, Math.max(0, Math.min(100, d0 + (e.D || 0))));
  assert.equal(s.torcida, Math.max(0, Math.min(100, t0 + (e.T || 0))));
  assert.ok(s.noticias.length > n0 && s.noticias[0].imprensa);
  assert.equal(responder(base, s, 0, tom), null, 'não responde duas vezes');
  responder(base, s, 1, C.perguntas[1].respostas[0].tom); responder(base, s, 2, C.perguntas[2].respostas[0].tom);
  assert.ok(C.feita && Object.values(s.tons).reduce((a, b) => a + b, 0) === 3);
  assert.equal(perfil(s).nome, 'Em formação');
  rodada(s);
  assert.notEqual(abrirColetiva(base, s), C);
});

import { ganho, alternarFoco } from '../public/js/motor/treino.js';
test('treino: jovem com margem evolui jogando, treino intenso e foco aceleram, e o ganho fica no save', () => {
  const s = novoJogo(base, cfg(51)), ci = s.tecnico.clube;
  const jovem = base.elencos[ci].filter(j => j.id > 0 && j.idade <= 21 && j.pot - j.ovr >= 6).sort((a, b) => a.idade - b.idade)[0];
  const veterano = base.elencos[ci].find(j => j.idade >= 31);
  assert.ok(jovem, 'sem jovem no elenco');
  const g0 = ganho(s, jovem, 7);
  assert.ok(g0 > ganho(s, jovem, null) && ganho(s, jovem, 7.5) > ganho(s, jovem, 6));
  if (veterano) assert.equal(ganho(s, veterano, 8), 0);
  s.treino = 'intenso'; assert.ok(ganho(s, jovem, 7) > g0);
  alternarFoco(s, jovem.id); assert.ok(ganho(s, jovem, 7) > g0 * 1.4);
  const o0 = jovem.ovr;
  ate(s, 20);
  assert.ok(s.evo[jovem.id] > 0.5, `evo ${s.evo[jovem.id]}`);
  assert.equal(jovem.ovr, Math.min(o0 + Math.floor(s.evo[jovem.id]), Math.max(jovem.pot, o0)));
  // recarregar o save mantém; carreira nova volta ao original
  const salvo = JSON.parse(JSON.stringify(paraSalvar(s)));
  novoJogo(base, cfg(52)); assert.equal(jovem.ovr, o0);
  aplicarSave(base, salvo); assert.equal(jovem.ovr, Math.min(o0 + Math.floor(salvo.evo[jovem.id]), Math.max(jovem.pot, o0)));
});

import { rivais } from '../public/js/motor/rivais.js';
import { interessados as interessadosR } from '../public/js/motor/noticias.js';
test('rivais: clássicos reconhecidos, rival não entra no interesse, jogador não quer ir pro rival e IA quase nunca negocia entre rivais', () => {
  const id = n => base.clubes.findIndex(c => c.n === n);
  assert.ok(rivais(base, id('Flamengo'), id('Vasco')) && rivais(base, id('Grêmio'), id('Internacional')) && !rivais(base, id('Flamengo'), id('Grêmio')));
  const s = novoJogo(base, { ...cfg(61), clube: id('Corinthians') });
  const craque = base.elencos[id('Palmeiras')].slice().sort((a, b) => b.ovr - a.ovr)[0];
  assert.ok(vontade(base, s, craque, id('Corinthians')) <= 35, 'craque do Palmeiras não quer o Corinthians');
  for (const j of base.jog.values()) if (j.ovr >= 74 && base.clubes[j.clube].div === 'A') for (const ci of interessadosR(base, j)) assert.ok(!rivais(base, ci, j.clube));
  ate(s, 12);
  const entreRivais = s.historicoTransf.filter(t => t.ia && rivais(base, t.de, t.para)).length;
  assert.ok(entreRivais <= 1, `${entreRivais} negócios entre rivais`);
});

import { registrarForma, faseDe } from '../public/js/motor/forma.js';
test('fases: sequência de notas altas leva à fase excelente (+3 em campo), notas baixas à péssima; preço acompanha', () => {
  const s = novoJogo(base, cfg(71)), j = base.elencos[s.tecnico.clube][5];
  const p0 = precoPedido(base, s, j);
  assert.equal(faseDe(s, j.id).k, 'normal');
  for (let i = 0; i < 4; i++) registrarForma(s, { [j.id]: 8.4 });
  assert.equal(faseDe(s, j.id).k, 'excelente');
  assert.ok(precoPedido(base, s, j) > p0);
  for (let i = 0; i < 6; i++) registrarForma(s, { [j.id]: 4.6 });
  assert.equal(faseDe(s, j.id).k, 'pessima');
  assert.ok(precoPedido(base, s, j) < p0);
});

import { recusarRecebida, querIr } from '../public/js/motor/mercado.js';
test('mercado agressivo: jogador em fase excelente num clube da B recebe propostas, quer ir pro maior e fica chateado se for barrado', () => {
  const B = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'B').sort((a, b) => base.forca(b) - base.forca(a));
  const s = novoJogo(base, { ...cfg(81), clube: B[3] }), ci = s.tecnico.clube;
  const tops = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).slice(0, 4);
  let ofertas = [];
  for (let k = 0; k < 6; k++) { for (const j of tops) (s.forma ||= {})[j.id] = 7.6; semana(s); ofertas.push(...s.recebidas.filter(x => tops.some(j => j.id === x.jogador) && !ofertas.some(o => o.id === x.id))); }
  assert.ok(ofertas.length >= 2, `só ${ofertas.length} propostas`);
  const q = ofertas.find(o => o.quer && s.recebidas.includes(o));
  if (q) {
    const m0 = s.mor[q.jogador] ?? 62;
    assert.ok(recusarRecebida(base, s, q.id));
    assert.ok((s.mor[q.jogador] ?? 62) < m0 && s.querSair[q.jogador]);
  }
  assert.ok(ofertas.some(o => o.quer) || ofertas.every(o => !querIr(base, s, base.jog.get(o.jogador), o.de)));
});

import { naoLidas } from '../public/js/motor/correio.js';
test('caixa de mensagens: boas-vindas, meta, desfalques e propostas chegam uma vez só', () => {
  const s = novoJogo(base, cfg(91)), ci = s.tecnico.clube;
  assert.equal(naoLidas(s), 3); // boas-vindas, teto salarial e a escolha do patrocinador master
  assert.ok(s.msgs.some(m => m.assunto === 'Escolha o patrocinador master' && m.link === '#/patrocinio'));
  assert.ok(s.msgs.some(m => m.assunto.startsWith('Teto salarial') && m.texto.includes('meta'))); // antes de rolar: a caixa guarda só as 60 últimas e o caminho da temporada muda com a base
  ate(s, 3);
  assert.ok(s.msgs.filter(m => m.assunto.startsWith('Teto salarial')).length <= 1, 'o teto salarial não se repete');
  const j = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr)[0];
  s.dm[j.id] = { k: 'adutor', n: 3, tot: 3 };
  rodada(s);
  const desf = s.msgs.filter(m => m.assunto.startsWith('Desfalques'));
  assert.ok(desf.some(m => m.texto.includes(j.curto)), 'o desfalque dele foi avisado'); // com o estadual no meio, ele pode já ter voltado
  const n = s.msgs.length; rodada(s);
  assert.equal(s.msgs.filter(m => m.texto === desf[0].texto).length, 1, 'a mesma mensagem não repete');
  assert.ok(s.msgs.length >= n);
});

import { fazerPrelecao, prelecaoFeita, conversar, temperamento, responderAumento } from '../public/js/motor/vestiario.js';
test('vestiário: preleção uma por jogo, conversa com cooldown e efeito pelo temperamento, pedido de aumento', () => {
  const s = novoJogo(base, cfg(95)), ci = s.tecnico.clube;
  ate(s, 2);
  assert.equal(prelecaoFeita(base, s), null);
  assert.equal(fazerPrelecao(base, s, 'motivadora'), null);
  assert.equal(prelecaoFeita(base, s), 'motivadora');
  assert.ok(fazerPrelecao(base, s, 'tranquila'), 'segunda preleção no mesmo jogo é recusada');
  const temp = base.elencos[ci].find(j => temperamento(j) === 'temperamental'), m0 = s.mor[temp.id] ?? 62;
  const r = conversar(base, s, temp.id, 'banco');
  assert.ok(r.d <= -8 && (s.mor[temp.id] ?? 62) < m0);
  assert.ok(conversar(base, s, temp.id, 'elogiar').txt.includes('há pouco'));
  const j = base.elencos[ci][2]; s.pedidosAumento = [{ jogador: j.id, valor: 99990, rodada: s.rodada }];
  assert.match(responderAumento(base, s, j.id, true), /teto salarial/, 'aumento acima do teto da diretoria não passa');
  s.pedidosAumento = [{ jogador: j.id, valor: tetoSalarial(base, s).teto, rodada: s.rodada }];
  responderAumento(base, s, j.id, true);
  assert.equal(s.salarios[j.id], tetoSalarial(base, s).teto);
  assert.equal(s.pedidosAumento.length, 0);
});

import { eventosAposRodada } from '../public/js/motor/eventos.js';
test('eventos: afastado sai da escalação e cumpre os jogos; julgamento de doping resolve; eventos acontecem ao longo da temporada', () => {
  const s = novoJogo(base, cfg(96)), ci = s.tecnico.clube;
  ate(s, 2);
  const xi = escalacao(base, s, ci).xi.filter(Boolean), alvo = xi[3];
  s.afast = { [alvo.id]: { n: 2, motivo: 'indisciplina' } };
  assert.ok(!escalacao(base, s, ci).xi.some(j => j && j.id === alvo.id), 'afastado não joga');
  ate(s, 4);
  assert.ok(!(s.afast[alvo.id]?.n > 0), 'cumpriu os 2 jogos');
  s.julgamentos = [{ jogador: alvo.id, rodada: s.rodada, ano: s.ano }];
  const N = eventosAposRodada(base, s);
  assert.ok(N.some(n => n.texto.includes('doping')) && !s.julgamentos.length);
  let ev = 0; for (let k = 0; k < 30; k++) { s.rodada = 100 + k; ev += eventosAposRodada(base, s).filter(n => n.evento).length; }
  assert.ok(ev >= 4 && ev <= 18, `eventos em 30 rodadas: ${ev}`);
});

import { valorNaTroca, semPassagem, podeSair, conversaFechada, rescindir, multaRescisao, exercerOpcao, chamarDeVolta, emprestar, pedirMais, abrirLeilao, resolverMercado, alternarLista, LIMITE_ELENCO } from '../public/js/motor/mercado.js';
import { janelaAberta } from '../public/js/motor/mundo.js';
test('mercado extras: troca, limite de 3 clubes por temporada (FIFA), acordo com janela fechada, 3 recusas, rescisão, opção, volta, contraproposta, leilão e gigantes', () => {
  const ci = base.clubes.findIndex(c => c.n === 'Palmeiras'), s = novoJogo(base, { ...cfg(23), clube: ci });
  s.caixa = 5e8; s.fin.salarioBudget = folhaDia(base, s) * 3;
  const fechadaEm = r0 => { let r = r0; while (janelaAberta(s.ano, r) || janelaAberta(s.ano, r + 1)) r++; return r; };
  const cands = [...base.jog.values()].filter(j => j.clube !== ci && base.clubes[j.clube].div === 'B' && vontade(base, s, j, ci) >= 75 && !interessadosR(base, j).some(c => c !== ci)).sort((a, b) => b.ovr - a.ovr);
  // troca: dinheiro + jogador cobrem o preço
  const vai = c => base.elencos[ci].slice().sort((a, b) => a.ovr - b.ovr).find(x => x.pos !== 'GOL' && vontade(base, s, x, c) >= 45);
  const alvo = [...base.jog.values()].filter(j => j.clube !== ci && base.clubes[j.clube].div === 'A' && vontade(base, s, j, ci) >= 70 && vai(j.clube) && !interessadosR(base, j).some(c => c !== ci)).sort((a, b) => b.ovr - a.ovr)[0];
  const de = alvo.clube, t = vai(de);
  const vt = valorNaTroca(base, s, t, de), valor = Math.max(50000, precoPedido(base, s, alvo) - vt);
  assert.equal(fazerProposta(base, s, alvo, proposta(base, s, alvo, { valor, troca: t.id })), null);
  semana(s);
  const p = s.propostas[0];
  assert.equal(p.estado, 'concluida', p.motivo);
  assert.equal(alvo.clube, ci); assert.equal(t.clube, de);
  assert.ok(s.noticias.some(n => n.texto.startsWith('HERE WE GO') && n.jogador === alvo.id), 'Zeca Furo crava');
  assert.ok(s.fin.extrato.some(e => e.tipo === 'compra' && e.valor === -p.valor) && !s.fin.extrato.some(e => e.tipo === 'venda'), 'paga só a parte em dinheiro');
  // FIFA: registrado por 3 clubes na temporada (2 mudanças), não muda mais até o ano que vem
  assert.equal(s.passagens[alvo.id], 1); assert.equal(podeSair(base, s, alvo), null);
  s.passagens[alvo.id] = 2;
  assert.match(podeSair(base, s, alvo), /3 clubes/);
  assert.match(alternarLista(base, s, 'venda', alvo.id), /3 clubes/);
  delete s.passagens[alvo.id];
  // acordo com a janela fechada: fecha agora, chega quando abrir
  s.rodada = fechadaEm(s.rodada + 1);
  const b2 = cands.find(j => j.clube !== ci && j.clube !== de);
  assert.equal(fazerProposta(base, s, b2, proposta(base, s, b2, { valor: precoPedido(base, s, b2) * 1.1 })), null);
  rodada(s);
  assert.equal(s.propostas[0].estado, 'concluida', s.propostas[0].motivo);
  assert.equal(s.acordos.length, 1); assert.notEqual(b2.clube, ci);
  let r = s.rodada; while (!janelaAberta(s.ano, r + 1)) r++;
  s.rodada = r; rodada(s);
  assert.equal(b2.clube, ci); assert.equal(s.acordos.length, 0);
  // 3 recusas fecham a conversa por 2 rodadas
  const c3 = cands.find(j => j.clube !== ci && ![de, b2.clube].includes(j.clube) && !s.acordos.length);
  for (let k = 0; k < 3; k++) { assert.equal(fazerProposta(base, s, c3, proposta(base, s, c3, { valor: precoPedido(base, s, c3) * 0.4 })), null); rodada(s); }
  assert.equal(conversaFechada(s, c3.id), 2);
  assert.match(bloqueioProposta(base, s, c3, proposta(base, s, c3)), /fechou as conversas/);
  // rescisão: paga todo o resto do contrato (cláusula compensatória) e ele fica livre
  const res = base.elencos[ci].slice().sort((a, b) => a.ovr - b.ovr).find(x => x.pos !== 'GOL' && !semPassagem(s, x.id)), m = multaRescisao(base, s, res), cx1 = s.caixa;
  assert.ok(m > 0);
  assert.equal(rescindir(base, s, res.id), null);
  assert.equal(base.clubes[res.clube].div, 'L'); assert.equal(cx1 - s.caixa, m);
  // empréstimo com opção de compra e chamar de volta quem você emprestou
  const emp = base.elencos[5].find(x => !semPassagem(s, x.id)); emprestar(base, s, emp, ci); s.emprestimos[emp.id].opcao = 1e6;
  const cx2 = s.caixa; assert.equal(exercerOpcao(base, s, emp.id), null);
  assert.equal(emp.clube, ci); assert.ok(!s.emprestimos[emp.id]); assert.equal(cx2 - s.caixa, 1e6);
  r = s.rodada; while (!janelaAberta(s.ano, r) || !janelaAberta(s.ano, r + 1)) r++; s.rodada = r;
  const meu = base.elencos[ci].slice().sort((a, b) => a.ovr - b.ovr).find(x => !semPassagem(s, x.id) && x.pos !== 'GOL'); emprestar(base, s, meu, 7);
  assert.equal(meu.clube, 7); assert.equal(chamarDeVolta(base, s, meu.id), null); assert.equal(meu.clube, ci);
  // contraproposta numa oferta recebida: pedir 5% a mais sempre passa e o negócio sai
  const vend = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).find(x => !semPassagem(s, x.id) && x.pos !== 'GOL');
  s.recebidas = [{ id: 'x1', tipo: 'compra', jogador: vend.id, de: 3, valor: 2e6, rodada: s.rodada }];
  assert.equal(pedirMais(base, s, 'x1', 1.05), null);
  assert.ok(pedirMais(base, s, 'x1', 1.3), 'só uma contraproposta');
  resolverMercado(base, s, s.rodada);
  assert.equal(vend.clube, 3);
  // leilão: no fim sobra uma oferta só, pelo menos do tamanho da original
  const lei = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).find(x => !semPassagem(s, x.id) && x.pos !== 'GOL');
  s.recebidas = [{ id: 'x2', tipo: 'compra', jogador: lei.id, de: 3, valor: 1e6, rodada: s.rodada }];
  assert.equal(abrirLeilao(base, s, 'x2'), null);
  resolverMercado(base, s, s.rodada);
  const L = s.recebidas.filter(x => x.jogador === lei.id);
  assert.equal(L.length, 1); assert.equal(L[0].leilao, 'fim'); assert.ok(L[0].valor >= 1e6);
  // gigantes de fora aparecem pelos craques de vez em quando
  let g = 0;
  for (let k = 0; k < 120; k++) { s.seed = 1000 + k; s.recebidas = []; resolverMercado(base, s, s.rodada); g += s.recebidas.filter(x => x.gigante && base.clubes[x.de].div === 'X').length; }
  assert.ok(g >= 2 && g <= 20, `gigantes: ${g}`);
});

import { contasDaRodada, dicasFinanceiras } from '../public/js/motor/financas.js';
test('finanças: atraso escalona (pedido de saída, Justiça, fama de mau pagador), projeção do fim da temporada e dicas', () => {
  const s = novoJogo(base, cfg(97)), ci = s.tecnico.clube; ate(s, 3);
  const alvo = [...base.jog.values()].find(j => j.clube !== ci && base.clubes[j.clube].div === 'A'), v0 = vontade(base, s, alvo, ci);
  const o = orcamento(base, s); assert.equal(o.fim, Math.round(s.caixa + o.cota - o.custoDia * o.dias));
  s.caixa = -5e6; s.fin.temporada.compras = 1e7; s.fin.temporada.vendas = 0; s.fin.tvPagas = [0, 9, 19, 29];
  const n0 = base.elencos[ci].length, tab = tabela(base, s, base.clubes[ci].div);
  const N = []; let k = 0;
  for (; k < 30 && !N.some(t => t.includes('Justiça')); k++) N.push(...contasDaRodada(base, s, s.rodada + k, null, tab));
  const dias = (+diaLiga(s.ano, s.rodada + k - 1) - +diaLiga(s.ano, s.rodada)) / 864e5;
  assert.ok(dias >= 60 && dias < 75, `Justiça com ${dias} dias de atraso`);
  assert.ok(N.some(t => t.includes('pede')) && Object.values(s.querSair).some(q => q.motivo.includes('atrasado')));
  assert.ok(N.some(t => t.includes('Justiça') && t.includes('cláusula compensatória')) && base.elencos[ci].length === n0 - 1);
  assert.ok(vontade(base, s, alvo, ci) <= v0 - 10, 'mau pagador afasta reforço');
  const D = dicasFinanceiras(base, s);
  assert.ok(D.some(d => d.includes('faltam')) && D.some(d => d.includes('mau pagador')));
});

import { gala, premiado } from '../public/js/motor/gala.js';
test('gala: 3 finalistas por prêmio, artilheiro leva a Chuteira, arquivo na virada, premiado fica mais caro', () => {
  const s = novoJogo(base, cfg(98)); ate(s, 38);
  while (!fimDeTemporada(s)) avancar(base, s);
  const G = gala(base, s);
  for (const d of ['A', 'B', 'C']) {
    const P = G.divs[d].premios;
    for (const k of ['bola', 'chuteira', 'garcom', 'luva', 'prancheta']) assert.equal(P[k].length, 3, `${d} ${k}`);
    assert.equal(G.divs[d].selecao.length, 11);
    const art = Object.entries(s.est).filter(([id]) => base.jog.get(+id) && base.clubes[base.jog.get(+id).clube].div === d).reduce((m, [, e]) => Math.max(m, e[1]), 0);
    assert.ok(P.chuteira[0].v.startsWith(`${art} gols`));
  }
  const w = G.divs.A.premios.bola[0].id, j = base.jog.get(w);
  virarTemporada(base, s);
  assert.equal(s.galas[0].ano, s.ano - 1);
  assert.ok(premiado(s, w) && s.noticias.some(n => n.texto.includes('Bola de Ouro')));
  const com = precoPedido(base, s, j), g = s.galas; s.galas = []; const sem = precoPedido(base, s, j); s.galas = g;
  assert.ok(com > sem, `${com} > ${sem}`);
});

import { convocar, naSelecao, DATAS_FIFA } from '../public/js/motor/selecao.js';
import { indisponivel } from '../public/js/motor/dm.js';
test('data FIFA: Brasil convoca 26 por posição (máx 5 por clube), convocado do Brasileirão desfalca 2 rodadas e ganha moral', () => {
  const s = novoJogo(base, cfg(99));
  const bra = convocar(s, [...base.jog.values()].filter(j => j.nat === 'BRA' && !j.fora && base.clubes[j.clube].div !== 'L'));
  assert.equal(bra.length, 26);
  assert.equal(bra.filter(j => j.pos === 'GOL').length, 3);
  const por = {}; for (const j of bra) por[j.clube] = (por[j.clube] || 0) + 1;
  assert.ok(Math.max(...Object.values(por)) <= 5);
  ate(s, DATAS_FIFA[0]);
  const c = s.convocados;
  assert.ok(c && c.rodada === DATAS_FIFA[0] && c.ids.length && c.bra.length === 26);
  const id = c.ids.find(x => indisponivel(s, x) === 'selecao'); // (lesionado conta como lesão)
  assert.ok(id != null);
  assert.ok(s.noticias.some(n => n.texto.startsWith('Data FIFA')));
  ate(s, DATAS_FIFA[0] + 2);
  assert.ok(!naSelecao(s, id));
});

import { banca, cronica, matematicos } from '../public/js/motor/jornais.js';
test('jornais: três manchetes com linhas diferentes, crônica com os gols e título/queda matemáticos', () => {
  const s = novoJogo(base, cfg(100)); ate(s, 3);
  const B = banca(base, s);
  assert.equal(B.length, 3); assert.equal(new Set(B.map(b => b.titulo)).size, 3);
  assert.equal(B[1].titulo, B[1].titulo.toUpperCase(), 'tabloide grita');
  const c = cronica(base, s), gols = s.ultima.eventos.filter(e => e.tipo === 'gol');
  assert.ok(c.length > 60 && gols.every(e => c.includes(`${e.min}'`)));
  if (gols.length) assert.ok(c.includes('abriu o placar'));
  // tabela forjada: líder disparado a 2 rodadas do fim
  const N = [], add = (tipo, div, texto) => N.push(texto), tab = (p0) => Array.from({ length: 20 }, (_, i) => ({ clube: i, p: i ? 80 - 3 * i : p0, j: 36 }));
  s.mat = null; matematicos(base, s, { A: tab(90), B: tab(84), C: tab(80) }, add);
  assert.ok(N.some(t => t.startsWith('É CAMPEÃO') && t.includes('Série A')) && !N.some(t => t.startsWith('É CAMPEÃO') && t.includes('Série C')));
  assert.ok(N.some(t => t.startsWith('Rebaixado')));
  const n = N.length; matematicos(base, s, { A: tab(90), B: tab(84), C: tab(80) }, add); assert.equal(N.length, n, 'avisa uma vez só');
});

import { gigante, notaEmprestimo, limpaCl, fimDosEmprestimos, jogosNoEmprestimo, transferir, aceitarRecebida } from '../public/js/motor/mercado.js';
import { escalacao as escalacaoM, barradoMedo, pagarMedo, multaMedo, proximoEvento as proxEv } from '../public/js/motor/mundo.js';
import { rng as rngU } from '../public/js/motor/util.js';
import { salarioDia as salarioDiaF } from '../public/js/motor/financas.js';
import { correio as correioF } from '../public/js/motor/correio.js';
test('empréstimo com cláusulas: titular só com obrigação; obrigação por jogos, minutagem, medo e revenda', () => {
  const ci = base.clubes.findIndex(c => c.n === 'Palmeiras'), s = novoJogo(base, { ...cfg(101), clube: ci });
  s.caixa = 5e8; s.fin.salarioBudget = folhaDia(base, s) * 3;
  const rank = c => base.elencos[c].slice().sort((a, b) => b.ovr - a.ovr);
  const outro = base.clubes.findIndex((c, i) => i !== ci && c.div === 'A' && !rivais(base, i, ci));
  const titular = rank(outro)[0], reserva = rank(outro).find((j, k) => k >= 11 && k < 18 && vontade(base, s, j, ci) >= 70) || rank(outro)[12];
  assert.ok(notaEmprestimo(base, s, titular, limpaCl(base, s, titular)) < 40, 'titular sem obrigação: não');
  assert.ok(notaEmprestimo(base, s, titular, limpaCl(base, s, titular, { compra: 'obrigacao', gatilho: 'fim', valorCompra: precoPedido(base, s, titular) * 1.1, taxa: precoPedido(base, s, titular) * 0.1 })) >= 50, 'com obrigação bem paga: sim');
  const cl = { taxa: precoPedido(base, s, reserva) * 0.1, compra: 'obrigacao', gatilho: 'jogos', jogos: 2, valorCompra: precoPedido(base, s, reserva) * 1.1, minimo: 0, medo: true, revenda: 20 };
  assert.equal(fazerProposta(base, s, reserva, { tipo: 'emprestimo', cl }), null);
  rodada(s);
  assert.equal(s.propostas[0].estado, 'concluida', s.propostas[0].motivo);
  const e = s.emprestimos[reserva.id];
  assert.ok(e && e.obrig?.jogos === 2 && e.medo && s.fin.extrato.some(x => x.tipo === 'emprestimo' && x.valor < 0));
  // medo: contra o dono ele não joga
  const ev = proxEv(base, s), adv = ev.h === ci ? ev.a : ev.h, dono = e.de; e.de = adv;
  assert.ok(barradoMedo(base, s, reserva.id, ci) && !escalacaoM(base, s, ci).xi.some(j => j?.id === reserva.id));
  const cx = s.caixa; assert.equal(pagarMedo(base, s, reserva.id), null);
  assert.ok(!barradoMedo(base, s, reserva.id, ci) && s.caixa === cx - multaMedo(reserva), 'pagou, joga');
  e.de = dono;
  // obrigação: completou os jogos, vira compra definitiva com revenda guardada
  (s.est[reserva.id] ||= [0, 0, 0, 0, 0, 0])[0] = (e.jogos0 || 0) + 2;
  assert.equal(jogosNoEmprestimo(s, reserva.id), 2);
  resolverMercado(base, s, s.rodada);
  assert.ok(!s.emprestimos[reserva.id] && reserva.clube === ci && s.revenda[reserva.id]?.pct === 20);
  // revenda: na venda, 20% vão para o dono
  transferir(base, s, reserva, outro, 1e7);
  assert.ok(s.fin.extrato.some(x => x.tipo === 'revenda' && x.valor === -2e6));
  // minutagem e obrigação por permanência no fim da temporada
  const j2 = rank(outro).find(j => j.id !== reserva.id && j.idade <= 30 && !s.emprestimos[j.id]);
  emprestar(base, s, j2, ci, limpaCl(base, s, j2, { minimo: 10, compra: 'obrigacao', gatilho: 'permanencia', valorCompra: 3e6 }));
  const N = []; fimDosEmprestimos(base, s, [], t => N.push(t));
  assert.ok(N.some(t => t.startsWith('Multa de minutagem')) && N.some(t => t.startsWith('Obrigação de compra')) && j2.clube === ci && !s.emprestimos[j2.id]);
});

test('proposta árabe: salário 3 a 4x, valor pela fase, vontade decide e o diretor explica', () => {
  const ci = base.clubes.findIndex(c => c.n === 'Flamengo'), s = novoJogo(base, { ...cfg(102), clube: ci });
  const j = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr)[0], ar = base.clubes.findIndex(c => c.liga === 'Saudi Pro League');
  s.forma = { [j.id]: 7.5 }; const exc = gigante(base, s, j, ar, true, rngU('g1'));
  s.forma = { [j.id]: 5.0 }; const pes = gigante(base, s, j, ar, true, rngU('g1'));
  assert.ok(exc.valor > pes.valor * 1.3, `${exc.valor} x ${pes.valor}`);
  assert.ok(exc.mult >= 3 && exc.mult <= 4.3 && pes.mult >= 3 && pes.mult <= 4);
  assert.ok(Math.abs(exc.salario - salarioDiaF(base, s, j) * exc.mult) < 20);
  s.recebidas = [{ id: 'g', tipo: 'compra', jogador: j.id, de: ar, rodada: s.rodada, gigante: true, arabe: true, ...exc, vontade: 20, quer: null }];
  assert.match(aceitarRecebida(base, s, 'g'), /não aceita ir/);
  assert.equal(j.clube, ci);
  s.recebidas = [{ id: 'g2', tipo: 'compra', jogador: j.id, de: ar, rodada: s.rodada, gigante: true, arabe: true, ...exc }];
  correioF(base, s);
  const m = s.msgs.find(x => x.assunto.startsWith('Proposta milionária'));
  assert.ok(m && m.texto.includes('x o que ganha hoje') && /fase/.test(m.texto) && m.texto.includes('empresário'));
});

import { revisarPotencial, notaTemporada } from '../public/js/motor/potencial.js';
test('potencial dinâmico: temporada boa sobe, ruim desce (jovem oscila mais), fica no save e vale para a IA; IA paga o medo do titular', () => {
  const s = novoJogo(base, cfg(103)), ci = s.tecnico.clube;
  const jovens = [...base.jog.values()].filter(j => j.idade <= 20 && j.pot >= j.ovr + 6 && base.clubes[j.clube].div === 'A');
  const bom = jovens.find(j => j.clube !== ci), ruim = jovens.find(j => j !== bom && j.pot - 4 > j.ovr), velho = [...base.jog.values()].find(j => j.idade >= 32 && base.clubes[j.clube].div === 'A');
  const p0 = [bom.pot, ruim.pot, velho.pot];
  s.est = { [bom.id]: [30, 14, 8, 30 * 74, 0, 0], [ruim.id]: [20, 0, 0, 20 * 56, 3, 1], [velho.id]: [30, 15, 5, 30 * 75, 0, 0] };
  assert.ok(notaTemporada(s.est[bom.id]) > 3 && notaTemporada(s.est[ruim.id]) < -2);
  revisarPotencial(base, s);
  assert.ok(bom.pot >= p0[0] + 4, `${p0[0]} -> ${bom.pot}`);
  assert.ok(ruim.pot <= p0[1] - 3 && ruim.pot >= ruim.ovr);
  assert.equal(velho.pot, p0[2], 'veterano não muda');
  aplicarSave(base, s);
  assert.equal(bom.pot, bom.potOrig + s.potd[bom.id], 'fica no save');
  // IA paga a multa do medo para o titular enfrentar você
  ate(s, 1);
  const ev = proxEv(base, s), adv = ev.h === ci ? ev.a : ev.h, meu = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr)[0];
  emprestar(base, s, meu, adv, limpaCl(base, s, meu, { medo: true }));
  const cx = s.caixa;
  assert.equal(barradoMedo(base, s, meu.id, adv), false);
  assert.equal(s.caixa, cx + multaMedo(meu));
  barradoMedo(base, s, meu.id, adv); assert.equal(s.caixa, cx + multaMedo(meu), 'paga uma vez por jogo');
});

import { responderJogador } from '../public/js/motor/vestiario.js';
import { vaiAposentar } from '../public/js/motor/mercado.js';
test('caixa: jogador pede pra jogar e pra sair, responde com efeito; diretor avisa queda de moral; pré-contrato barra quem vai se aposentar', () => {
  const s = novoJogo(base, cfg(104)), ci = s.tecnico.clube; ate(s, 2);
  const el = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr), banco = el[14], saidor = el[3];
  s.semJogar = { [banco.id]: 4 }; s.mor[banco.id] = 50;
  s.querSair = { [saidor.id]: { de: 7, rodada: s.rodada, motivo: 'quer jogar num clube maior' } };
  correioF(base, s);
  const mj = s.msgs.find(m => m.tipoJ === 'jogar' && m.autor === banco.id), ms = s.msgs.find(m => m.tipoJ === 'sair');
  assert.ok(mj && ms && ms.texto.includes('quero jogar num clube maior'));
  responderJogador(base, s, mj.id, 'prometer');
  assert.ok(s.promessas[banco.id] && mj.resp === 'prometer');
  assert.match(responderJogador(base, s, mj.id, 'paciencia'), /respondida/);
  responderJogador(base, s, ms.id, 'vender');
  assert.ok(s.listas.venda.includes(saidor.id));
  // queda de moral da torcida
  s.torcida = 70; correioF(base, s); s.torcida = 50; correioF(base, s);
  assert.ok(s.msgs.some(m => m.assunto.startsWith('A torcida está perdendo')));
  // quem vai se aposentar não assina pré-contrato
  s.rodada = 20;
  const vel = [...base.jog.values()].find(j => j.clube !== ci && base.clubes[j.clube].div === 'A' && j.contrato <= s.ano && vaiAposentar(s, j));
  if (vel) assert.match(bloqueioProposta(base, s, vel, { tipo: 'pre', salario: 1000, anos: 2 }), /aposentar/);
});

import { editarVaga } from '../public/js/motor/mundo.js';
import { FORMACOES as FORM } from '../public/js/motor/partida.js';
test('tática: muda a posição de uma vaga e o time joga com a formação personalizada', () => {
  const s = novoJogo(base, cfg(105)); s.formacao = '4-3-3';
  assert.ok(editarVaga(base, s, 0, 'CA'), 'goleiro não muda');
  assert.equal(editarVaga(base, s, 7, 'PE'), null);
  assert.equal(s.formacao, 'Personalizada'); assert.equal(s.formPers[7][0], 'PE'); assert.equal(FORM['4-3-3'][7], 'MEI');
  assert.equal(FORM.Personalizada, undefined, 'a formação personalizada fica no save, não numa tabela global');
  assert.equal(escalacao(base, s, s.tecnico.clube).xi.length, 11);
  rodada(s); assert.equal(s.rodada, 1);
});

import { abrirColetivaPre, prePendente } from '../public/js/motor/imprensa.js';
import { responder as responderCol } from '../public/js/motor/imprensa.js';
import { confronto, textoConfronto } from '../public/js/motor/confrontos.js';
test('pré-temporada com 3 amistosos; retrospecto contra cada time; coletiva pré-jogo com perguntas do jogo e do histórico', () => {
  const s = novoJogo(base, cfg(106)), ci = s.tecnico.clube;
  const tipos = []; for (let k = 0; k < 3; k++) { tipos.push(proxEv(base, s).tipo); avancar(base, s); }
  assert.deepEqual(tipos, ['amistoso', 'amistoso', 'amistoso']);
  assert.ok(s.amistosos.jogos.every(j => j.g) && s.rodada === 0 && s.ultima.div === 'AMI');
  assert.ok(!prePendente(base, s) || proxEv(base, s).tipo !== 'amistoso');
  assert.notEqual(proxEv(base, s).tipo, 'amistoso');
  // retrospecto: força um histórico e a coletiva pré-jogo pergunta dele
  const ev = proxEv(base, s), adv = ev.h === ci ? ev.a : ev.h;
  s.h2h = { [`${ci}-${adv}`]: { j: 5, v: 0, e: 1, d: 4, gp: 2, gc: 11, maior: null, pior: [0, 4, 2026, 'Série A'], ult: ['d', 'd', 'e', 'd', 'd'] } };
  assert.match(textoConfronto(confronto(s, ci, adv)), /5 jogos.*pior derrota 0 a 4/);
  assert.ok(prePendente(base, s));
  const C = abrirColetivaPre(base, s);
  assert.equal(C.perguntas.length, 3);
  assert.ok(C.perguntas.some(p => ['preTabu', 'preRetro'].includes(p.tema)), C.perguntas.map(p => p.tema).join());
  for (let i = 0; i < 3; i++) assert.ok(responderCol(base, s, i, C.perguntas[i].respostas[0].tom, true));
  assert.ok(C.feita && !prePendente(base, s));
  // o jogo oficial entra no retrospecto
  const j0 = confronto(s, ci, adv).j; avancar(base, s);
  assert.equal(confronto(s, ci, adv).j, j0 + 1);
});

import { vontadeRenovar, emNovela } from '../public/js/motor/mercado.js';
test('renovação: IA renova cedo quem tem nível, deixa sair quem não tem ou quer sair; no seu clube vira novela', () => {
  const s = novoJogo(base, cfg(107)), ci = s.tecnico.clube;
  ate(s, 31);
  const dec = Object.values(s.renovIA || {}), d = k => dec.filter(x => x.d === k).length;
  assert.ok(d('renovou') > 20 && d('dispensa') + d('sai') > 5, JSON.stringify({ r: d('renovou'), dis: d('dispensa'), sai: d('sai') }));
  const renovado = Object.entries(s.renovIA).find(([, x]) => x.d === 'renovou')[0];
  assert.ok(base.jog.get(+renovado).contrato > s.ano, 'renovado não está mais no fim de contrato');
  assert.ok(clausulaDe(base, s, base.jog.get(+renovado))?.editada, 'IA blindou o renovado com multa maior');
  // novela: último ano, tratado mal, quer sair
  const j = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr)[2];
  s.contratos[j.id] = s.ano; aplicarSave(base, s); s.trato = { [j.id]: -10 }; s.querSair = { [j.id]: { de: 7, rodada: s.rodada, motivo: 'quer jogar num clube maior' } };
  assert.ok(vontadeRenovar(base, s, j).v < 32);
  while (!emNovela(s, j.id) && s.rodada < 37) rodada(s);
  assert.ok(emNovela(s, j.id));
  assert.match(renovar(base, s, j, 1e6, 3).txt, /novela/i);
  // na virada, quem saiu da IA sem renovar está livre
  const sai = Object.entries(s.renovIA).filter(([, x]) => x.d === 'sai' || x.d === 'dispensa').map(([id]) => base.jog.get(+id)).filter(x => x && !s.preContratos.some(p => p.jogador === x.id) && x.clube !== ci);
  ate(s, 38); while (!fimDeTemporada(s)) avancar(base, s);
  virarTemporada(base, s);
  assert.ok(sai.filter(x => !x.fora).every(x => base.clubes[x.clube].div === 'L' || x.clube === ci || s.historicoTransf.some(h => h.jogador === x.id)));
});

import { fairPlay, punirFPF, registroBloqueado } from '../public/js/motor/financas.js';
test('fair play financeiro (CBF): indicadores, advertência até 2027 e escada de punição a partir de 2028', () => {
  const s = novoJogo(base, cfg(108)), ci = s.tecnico.clube; ate(s, 10);
  const fp = fairPlay(base, s); assert.ok(fp.receita > 0 && fp.razao > 0 && fp.limCusto === 0.8 && fp.limCurto === 0.6 && fp.tol >= 5.1e6);
  // 2026: só advertência
  const cx = s.caixa; assert.match(punirFPF(base, s, 'teste'), /advertência/); assert.equal(s.caixa, cx); assert.ok(!s.fpf?.degrau);
  // caixa negativo vira dívida de curto prazo; déficit grande estoura o equilíbrio de 3 anos
  s.caixa = -fp.receita; assert.ok(fairPlay(base, s).falhas.some(f => /curto prazo/.test(f))); s.caixa = cx;
  s.fpf = { degrau: 0, anos: { [s.ano - 1]: { r: -30e6, c: 0 } } }; assert.ok(fairPlay(base, s).falhas.some(f => /três anos/.test(f)));
  s.fpf = { degrau: 0 };
  // 2028 em diante: advertência pública, multa, retenção, transfer ban, perda de pontos
  const ano0 = s.ano; s.ano = 2028;
  assert.match(punirFPF(base, s, 'teste'), /advertência pública/);
  const c1 = s.caixa; punirFPF(base, s, 'teste'); assert.ok(s.caixa < c1, 'multa');
  const c2 = s.caixa; punirFPF(base, s, 'teste'); assert.ok(s.caixa < c2 && s.fpf.retido > 0, 'retenção');
  punirFPF(base, s, 'teste');
  const outro = base.elencos[(ci + 3) % 20][0];
  assert.ok(registroBloqueado(s) && /bloqueado/.test(bloqueioProposta(base, s, outro, { tipo: 'compra', valor: 1e6, salario: 1000, anos: 2 })));
  const p0 = tabela(base, s, base.clubes[ci].div).find(l => l.clube === ci).p;
  punirFPF(base, s, 'teste');
  assert.equal(tabela(base, s, base.clubes[ci].div).find(l => l.clube === ci).p, p0 - 3);
  s.ano = ano0;
  s.fin.salarioBudget = null; s.fin.temporada.compras = fp.receita * 3; correioF(base, s);
  assert.ok(s.msgs.some(m => m.assunto.startsWith('Fair play financeiro')));
});

import { barrado12, naoJogaA } from '../public/js/motor/mundo.js';
test('regra dos 12 jogos: 13 jogos da Série A por um clube e ele não joga a A por outro na temporada', () => {
  const s = novoJogo(base, cfg(41)), ci = s.tecnico.clube; ate(s, 14);
  const j = [...base.jog.values()].find(x => x.clube !== ci && base.clubes[x.clube].div === 'A' && s.jogosA[x.id]?.c === x.clube && s.jogosA[x.id].n === 14);
  const k = [...base.jog.values()].find(x => x.clube !== ci && base.clubes[x.clube].div === 'A' && s.jogosA[x.id]?.n >= 1 && s.jogosA[x.id].n <= 12);
  assert.ok(j && k);
  const para = base.clubes.findIndex((c, i) => c.div === 'A' && i !== j.clube && i !== ci);
  assert.ok(barrado12(s, j.id, para) && !barrado12(s, j.id, j.clube) && !barrado12(s, k.id, para));
  assert.ok(naoJogaA(base, s, j.id, para) && !interessadosR(base, j, s).some(c => base.clubes[c].div === 'A'));
  const de = j.clube; transferir(base, s, j, para, 0);
  assert.ok(!escalacao(base, s, para, 'L').xi.concat(escalacao(base, s, para, 'L').banco).some(x => x.id === j.id), 'fora da Série A');
  assert.ok(!escalacao(base, s, para, 'CB').fora.has(j.id), 'Copa do Brasil pode');
  rodada(s); assert.equal(s.jogosA[j.id].c, de, 'não entrou em campo pela A');
});

import { REGIONAIS, fasesReg, tabelaReg, dataFaseReg, regsDe } from '../public/js/motor/regionais.js';
import { dataRodada as diaLiga } from '../public/js/motor/calendario.js';
test('regionais: amistosos, estaduais e copas regionais reais antes do Brasileirão, com a janela aberta; acesso no Paulista', () => {
  const nome = c => base.clubes[c].n, vit = base.clubes.findIndex(c => c.n === 'Vitória');
  const s = novoJogo(base, { ...cfg(11), clube: vit });
  assert.equal(diaLiga(2026, 0).toISOString().slice(0, 10), '2026-03-11'); // formato antigo: a Série A começa depois dos estaduais
  assert.deepEqual(regsDe(s, vit), ['BA', 'NE']);
  assert.deepEqual(s.reg.NE.etapas[0].grupos[0].map(nome), ['Vitória', 'ASA', 'Sousa', 'Itabaiana', 'Fluminense-PI']);
  assert.deepEqual(s.reg.RJ.etapas[0].grupos[1].map(nome), ['Botafogo', 'Madureira', 'Boavista', 'Flamengo', 'Nova Iguaçu', 'Maricá']);
  const conm = new Set(['LIB', 'SUL'].flatMap(k => s.cont[k].grupos.flat()));
  for (const k of ['NE', 'SS', 'VE']) assert.ok(!s.reg[k].clubes.some(c => conm.has(c)), k);
  // 1ª fase: todo mundo joga uma vez por rodada, e o número de rodadas é o do regulamento
  for (const k of Object.keys(REGIONAIS)) {
    const E = s.reg[k].etapas[0];
    assert.equal(E.rodadas.length, REGIONAIS[k].etapas[0].rodadas, k);
    for (const rd of E.rodadas) assert.equal(new Set(rd.flat()).size, rd.length * 2, k);
  }
  // Goianão: cada clube enfrenta uma vez os 8 dos outros grupos
  const go = s.reg.GO.etapas[0], vs = new Set(go.rodadas.flat().map(([h, a]) => [h, a].sort().join('-')));
  assert.equal(vs.size, 48);
  assert.ok(go.grupos.every(g => g.every(x => g.every(y => x === y || !vs.has([x, y].sort().join('-'))))));
  assert.ok(janelaAberta(2026, 0) && janelaAberta(2026, 0, Date.UTC(2026, 2, 1)) && !janelaAberta(2026, 0, Date.UTC(2026, 2, 8)) && !janelaAberta(2026, 1) && !janelaAberta(2026, 13) && janelaAberta(2026, 14), 'janelas reais: 5/jan a 3/mar (na pré-temporada vale a data) e 20/jul a 11/set');
  while (s.rodada < 19) avancar(base, s);
  for (const k of Object.keys(REGIONAIS)) {
    const T = s.reg[k], F = fasesReg(k);
    assert.equal(T.fase, F.length, k);
    assert.ok(T.campeao != null && T.vice != null && T.campeao !== T.vice, k);
    assert.ok(+dataFaseReg(2026, k, F.length - 1) <= (REGIONAIS[k].copa ? Date.UTC(2026, 5, 7) : k === 'SP2' ? Date.UTC(2026, 3, 19) : Date.UTC(2026, 2, 8)), k); // estaduais até 8/mar, copas até 7/jun
    const fim = F.length - 1;
    if (F[fim].perna === 'volta') {
      const volta = T.jogos.find(j => j.fase === fim), ida = T.jogos.find(j => j.fase === fim - 1 && j.h === volta.a), ag = [volta.gols[0] + ida.gols[1], volta.gols[1] + ida.gols[0]];
      if (ag[0] !== ag[1]) assert.equal(T.campeao, ag[0] > ag[1] ? volta.h : volta.a, k);
      else if (volta.pen) assert.equal(T.campeao, volta.pen[0] > volta.pen[1] ? volta.h : volta.a, k);
    }
  }
  assert.ok(s.reg.SP2.jogos.every(j => !j.pen), 'na A2 empate no agregado não vai para os pênaltis');
  assert.ok(s.reg.VE.titulos['Copa Norte'] != null && s.reg.VE.titulos['Copa Centro-Oeste'] != null && s.reg.RJ.titulos['Taça Guanabara'] != null);
  assert.equal(s.reg.BA.jogos.filter(j => j.e === 0 && (j.h === vit || j.a === vit)).length, 9);
  assert.ok(s.fin.extrato.some(e => e.desc === 'Salários (7 dias)'));
  while (!fimDeTemporada(s)) avancar(base, s);
  const sp = s.reg.SP, caem = tabelaReg(sp, 0, sp.etapas[0].grupos[0]).slice(-2).map(l => l.clube), sobem = [s.reg.SP2.campeao, s.reg.SP2.vice];
  virarTemporada(base, s);
  assert.equal(s.reg.ano, s.ano);
  assert.ok(sobem.every(c => s.reg.SP.clubes.includes(c)) && caem.every(c => s.reg.SP2.clubes.includes(c)));
  assert.ok(s.historico[0].reg?.campeoes.BA != null);
});

import { torcidaAposJogo } from '../public/js/motor/carreira.js';
test('clássico perdido revolta a torcida (protesto, diretoria em goleada); empréstimo com a janela fechada vira acordo; elenco até 45', () => {
  const s = novoJogo(base, cfg(141)), ci = s.tecnico.clube;
  const t0 = s.torcida ?? 55, d0 = s.fin.diretoria;
  torcidaAposJogo(s, ci, ci, [0, 4], { classico: true });
  assert.ok(s.torcida < t0 - 8 && s.fin.diretoria < d0 && s.revolta.protesto && s.revolta.diretoria);
  correioF(base, s);
  assert.ok(s.noticias.some(n => /protestaram/.test(n.texto)) && s.msgs.some(m => m.assunto === 'Protesto da torcida'));
  // empréstimo acertado com a janela fechada chega quando ela abrir
  s.rodada = 5; s.fin.salarioBudget = folhaDia(base, s) * 3;
  const alvo = [...base.jog.values()].filter(j => j.clube !== ci && base.clubes[j.clube].div === 'A' && j.idade <= 21 && vontade(base, s, j, ci) >= 60).sort((a, b) => a.ovr - b.ovr)[0];
  assert.equal(bloqueioProposta(base, s, alvo, { tipo: 'emprestimo', salario: salarioPedido(base, s, alvo, 1), anos: 1 }), null);
  s.acordos = [{ tipo: 'emprestimo', jogador: alvo.id, de: alvo.clube, cl: null }];
  resolverMercado(base, s, 5);
  assert.notEqual(alvo.clube, ci, 'não chega com a janela fechada');
  let r = 5; while (!janelaAberta(s.ano, r + 1)) r++;
  s.rodada = r; resolverMercado(base, s, r);
  assert.equal(alvo.clube, ci); assert.ok(s.emprestimos[alvo.id]);
  assert.equal(LIMITE_ELENCO, 45);
});

import { acompanharPromessas, medoDoBanco, palavraQuebrada, PROMESSA } from '../public/js/motor/mercado.js';
test('promessa de titularidade: tira o medo do banco; quebrada, ele quer sair e o mercado desconfia; cumprida, ele agradece', () => {
  const ci = base.clubes.findIndex(c => c.n === 'Palmeiras'), s = novoJogo(base, { ...cfg(151), clube: ci });
  const alvo = [...base.jog.values()].filter(j => j.clube !== ci && ['A', 'B'].includes(base.clubes[j.clube].div) && medoDoBanco(base, j, ci) >= 2 && vontade(base, s, j, ci) >= 25 && vontade(base, s, j, ci) <= 55).sort((a, b) => b.ovr - a.ovr)[0];
  const sem = vontade(base, s, alvo, ci), com = vontade(base, s, alvo, ci, true);
  assert.ok(com >= sem + 30, `promessa ${sem} -> ${com}`);
  // chega com promessa e fica no banco: na 5ª reserva a promessa cai
  const j = base.elencos[ci].slice().sort((a, b) => a.ovr - b.ovr)[0];
  s.promTit = { [j.id]: { ano: s.ano, jogos: 0, tit: 0 } };
  const banco = { notas: [{}, {}], eventos: [] };
  for (let k = 0; k < PROMESSA.jogos - PROMESSA.titular + 1; k++) acompanharPromessas(base, s, banco, 0);
  assert.ok(!s.promTit[j.id] && palavraQuebrada(s) === 1 && s.querSair[j.id]);
  assert.ok(s.msgs.some(m => m.assunto === 'Promessa quebrada'));
  const sem2 = vontade(base, s, alvo, ci), com2 = vontade(base, s, alvo, ci, true);
  assert.ok(sem2 < sem && com2 - sem2 < com - sem, 'quem teme o banco desconfia e a promessa vale menos');
  // cumprida: 6 jogos como titular
  const k2 = base.elencos[ci].slice().sort((a, b) => a.ovr - b.ovr)[1];
  s.promTit = { [k2.id]: { ano: s.ano, jogos: 0, tit: 0 } };
  for (let k = 0; k < PROMESSA.titular; k++) acompanharPromessas(base, s, { notas: [{ [k2.id]: 6.5 }, {}], eventos: [] }, 0);
  assert.ok(!s.promTit[k2.id] && s.palavra.cumpridas === 1);
});

// teste espelho: o mesmo elenco dos dois lados, campo neutro; nenhum estilo ou esquema pode ganhar sozinho
test('teste espelho: estilo e formação mudam o jogo sem virar trapaça', async () => {
  const { ESTILOS, FORMACOES } = await import('../public/js/motor/partida.js');
  const N = 300, ppg = (ta, tb) => { let p = 0; for (let i = 0; i < N; i++) { const [x, y] = i % 2 ? [tb, ta] : [ta, tb]; const r = simular(x, y, 'esp' + i, { neutro: true }); const g = i % 2 ? [r.gols[1], r.gols[0]] : r.gols; p += g[0] > g[1] ? 3 : g[0] === g[1] ? 1 : 0; } return p / N; };
  const ci = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A').sort((a, b) => base.forca(b) - base.forca(a))[8];
  const ref = { ...melhorTime(base.elencos[ci], '4-3-3'), estilo: 'equilibrado', gatilhos: {} }, b0 = ppg(ref, ref);
  for (const e of Object.keys(ESTILOS)) { const d = ppg({ ...ref, estilo: e }, ref) - b0; assert.ok(Math.abs(d) < 0.3, `estilo ${e}: ${d.toFixed(2)} ponto por jogo`); }
  const difs = Object.keys(FORMACOES).filter(f => f !== 'Personalizada').map(f => ppg({ ...melhorTime(base.elencos[ci], f), estilo: 'equilibrado', gatilhos: {} }, ref) - b0);
  for (const d of difs) assert.ok(Math.abs(d) < 0.35, `formação ${d.toFixed(2)}`);
  assert.ok(new Set(difs.map(d => d.toFixed(2))).size > 3, 'formação precisa fazer diferença');
});

// calendário real de 2026 e vaga repassada pela tabela
import { dataLiga as diaDiv, dataLiga2 as diaDiv2, dataCopa as diaCopa, dataCont as diaCont, janelaNaData } from '../public/js/motor/calendario.js';
import { vagasBR } from '../public/js/motor/continental.js';
import { dataSupDe } from '../public/js/motor/mundo.js';
test('calendário 2026: datas da CBF/Conmebol e vaga da Libertadores repassada a quem vem na tabela', () => {
  const d = x => x.toISOString().slice(0, 10);
  assert.equal(d(diaDiv(2026, 'A', 0)), '2026-03-11'); assert.equal(d(diaDiv(2026, 'A', 13)), '2026-05-31'); assert.equal(d(diaDiv(2026, 'A', 14)), '2026-07-23'); assert.equal(d(diaDiv(2026, 'A', 37)), '2026-12-02');
  assert.equal(d(diaDiv(2026, 'B', 0)), '2026-03-21'); assert.equal(d(diaDiv(2026, 'B', 37)), '2026-11-14'); assert.equal(d(diaDiv2(2026, 'B', 1)), '2026-11-28');
  assert.equal(d(diaDiv(2026, 'C', 0)), '2026-04-04'); assert.equal(d(diaDiv(2026, 'C', 18)), '2026-08-30'); assert.equal(d(diaDiv2(2026, 'C', 7)), '2026-10-25');
  assert.equal(d(diaCopa(2026, 0)), '2026-02-18'); assert.equal(d(diaCopa(2026, 12)), '2026-12-06');
  assert.equal(d(diaCont(2026, 6, 'SUL')), '2026-07-22'); assert.equal(d(diaCont(2026, 0, 'PRE')), '2026-02-19'); assert.equal(d(diaCont(2026, 3, 'PRE')), '2026-03-12'); assert.equal(d(diaCont(2026, 14, 'LIB')), '2026-11-28'); assert.equal(d(diaCont(2026, 14, 'SUL')), '2026-11-21');
  assert.ok(janelaNaData(2026, Date.UTC(2026, 0, 5)) && !janelaNaData(2026, Date.UTC(2026, 2, 4)) && janelaNaData(2026, Date.UTC(2026, 8, 11, 12)) && !janelaNaData(2026, Date.UTC(2026, 8, 12)));
  // formato antigo: a Série A começa depois dos estaduais (8/mar); 2027 repete as semanas de 2026, numa quarta
  assert.equal(diaDiv(2027, 'A', 0).getUTCDay(), 3);
  // campeão da Copa do Brasil já no G4: a vaga dele nos grupos vai para o vice, e a pré do vice para o próximo da tabela
  const A = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A');
  const s = { classif: { A, copa: A[2], copaVice: A[9], lib: A[12], sul: null } }, v = vagasBR(base, s);
  assert.deepEqual(v.LIB, [...A.slice(0, 4), A[12], A[9]]);
  assert.deepEqual(v.PRE, [A[4], A[5]]);
  assert.deepEqual(v.repasses.map(r => [r.clube, r.de, r.pos]), [[A[9], A[2], 10], [A[5], A[9], 6]]);
  assert.deepEqual(v.SUL, A.filter(c => !v.LIB.includes(c) && !v.PRE.includes(c)).slice(0, 6));
  // campeão da Copa fora do G4 vai aos grupos e o vice (fora) vai à pré com o 5º
  const v2 = vagasBR(base, { classif: { A, copa: A[7], copaVice: A[8] } });
  assert.deepEqual([v2.LIB, v2.PRE, v2.repasses.length], [[...A.slice(0, 4), A[7]], [A[4], A[8]], 0]);
  // Supercopa 2026: Flamengo × Corinthians; os dois têm estadual em 1º/fev, então ela vai para a Quarta de Cinzas
  const sj = novoJogo(base, cfg(5)), { h: sh, a: sa } = sj.cont.sup, ds = dataSupDe(base, sj);
  assert.deepEqual([base.clubes[sh].n, base.clubes[sa].n, d(ds)], ['Flamengo', 'Corinthians', '2026-02-18']);
  assert.ok([sh, sa].every(c => regsDe(sj, c).every(k => fasesReg(k).every((_, f) => +dataFaseReg(2026, k, f) !== +ds))));
});

test('teto salarial da diretoria: recém-promovido ganha menos aporte, continental e copa sobem, proposta acima é barrada', () => {
  const ini = n => { const ci = base.clubes.findIndex(c => c.n === n); return [novoJogo(base, { ...cfg(61), clube: ci }), ci]; };
  const [rem] = ini('Remo'), [fla] = ini('Flamengo'), [bah, ciB] = ini('Bahia');
  const tR = tetoSalarial(base, rem), tB = tetoSalarial(base, bah);
  assert.ok(tR.partes.some(([t]) => t.startsWith('recém')) && tR.teto < 5000, `Remo ${tR.teto}`);
  assert.ok(tetoSalarial(base, fla).teto > tB.teto && tB.teto > tR.teto);
  // dívida aperta: o Corinthians (3,2x a receita) tem teto bem menor que o do Flamengo; amortizar solta
  const [cor] = ini('Corinthians'), tC = tetoSalarial(base, cor);
  assert.ok(tC.partes.some(([t, p]) => t.startsWith('dívida') && p <= -30) && tC.teto < 0.65 * tetoSalarial(base, fla).teto, JSON.stringify(tC));
  cor.fin.divida /= 4; assert.ok(tetoSalarial(base, cor).teto > tC.teto * 1.3);
  // Bahia entra na Libertadores e chega às quartas da Copa do Brasil: o teto sobe 35% e mais 10%
  bah.cont.LIB.grupos[0][3] = ciB; bah.copa.jogos.push({ fase: FASES.findIndex(f => f.k === 'qua'), h: ciB, a: 0, gols: [1, 0] });
  assert.equal(tetoSalarial(base, bah).teto, Math.round(tB.teto * 1.35 * 1.1 / 50) * 50);
  // proposta acima do teto é barrada; empréstimo em que o outro clube paga quase tudo passa pelo teto
  const alvo = [...base.jog.values()].filter(j => base.clubes[j.clube].div === 'A' && j.clube !== rem.tecnico.clube).sort((a, b) => b.ovr - a.ovr)[0];
  rem.caixa = 50e6; // o Remo real quase não tem caixa: aqui o teste é só do teto
  assert.match(bloqueioProposta(base, rem, alvo, { tipo: 'compra', valor: 1e5, salario: tR.teto + 100, anos: 3 }), /teto salarial/);
  const livre = base.elencos[base.clubes.findIndex(c => c.div === 'L')][0];
  rem.fin.salarioBudget = 1e9; assert.equal(bloqueioProposta(base, rem, livre, { tipo: 'livre', salario: tR.teto, anos: 3 }), null);
  assert.match(bloqueioProposta(base, rem, livre, { tipo: 'livre', salario: tR.teto + 50, anos: 3 }), /teto salarial/);
});

test('base: 5 garotos gerados já no 1º ano do seu clube, uma vez por clube', () => {
  const s = novoJogo(base, cfg(93)), ci = s.tecnico.clube, meus = base.elencos[ci].filter(j => j.id <= -6e8);
  assert.equal(meus.length, 5); assert.ok(meus.every(j => j.idade >= 16 && j.idade <= 18 && j.pot >= j.ovr));
  assert.ok(s.noticias.some(n => n.texto.startsWith('Subiram da base')));
});

import { ofertasPatrocinio, assinarPatrocinio } from '../public/js/motor/patrocinio.js';
test('patrocínio: 3 propostas diferentes por clube, mensalidade todo dia 1º; sem escolha, a diretoria assina na 1ª rodada', () => {
  const s = novoJogo(base, cfg(95)), O = ofertasPatrocinio(base, s).lista, meses = s => s.fin.extrato.filter(e => e.desc.startsWith(`Patrocínio master · ${s.fin.patro.marca} (`)).length;
  assert.equal(new Set(O.map(o => o.tipo)).size, 3); assert.equal(new Set(O.map(o => o.marca)).size, 3);
  assert.notDeepEqual(ofertasPatrocinio(base, novoJogo(base, { ...cfg(95), clube: 5 })).lista.map(o => o.marca), O.map(o => o.marca));
  const cedo = novoJogo(base, cfg(95)); assert.equal(assinarPatrocinio(base, cedo, 1), null); assert.equal(cedo.fin.patrocinador, O[1].marca);
  ate(cedo, 1); assert.equal(meses(cedo), 3); // assinou em janeiro: jan, fev e mar
  ate(s, 1); assert.ok(s.fin.patro && !s.fin.patro.rompe); assert.equal(meses(s), 1); // a diretoria assinou em março: perdeu jan e fev
});

test('escalação fixa: o jogo não mexe no seu time; quem sai do clube é trocado só na vaga dele, neste jogo', () => {
  const s = novoJogo(base, cfg(91)), ci = s.tecnico.clube;
  s.xi = escalacao(base, s, ci).xi.map(j => j.id);
  const onze = s.xi.slice(), outro = base.clubes.findIndex((c, i) => c.div === 'A' && i !== ci), saiu = onze[5];
  s.transf[saiu] = outro; aplicarSave(base, s);
  const xi = escalacao(base, s, ci).xi.map(j => j.id);
  assert.ok(!xi.includes(saiu) && xi.every((id, i) => i === 5 || id === onze[i]), 'só a vaga de quem saiu muda');
  assert.deepEqual(s.xi, onze, 'a escalação salva continua a mesma');
  delete s.transf[saiu]; aplicarSave(base, s);
});

import { novoLeilao, comecarLeilao, lanceLeilao, desistirLeilao, tickLeilao, minimo as minimoLeilao, terminarSemHumanos, abrirLeilaoCompra, abrirLeilaoVenda, fecharLeilao, encerrarPendente } from '../public/js/motor/leilao.js';
import { pedidosDeQueda } from '../public/js/motor/mercado.js';

test('leilão: lance volta o relógio, dou-lhe uma e duas, IA para no máximo, vence quem deu mais', () => {
  const L = novoLeilao({ id: 'a', modo: 'compra', jogador: 1, vendedor: 9, valor: 1e6, lider: 0, reserva: 1.2e6, participantes: [{ ci: 0, humano: true, max: 3e6 }, { ci: 5, max: 1.6e6 }, { ci: 6, max: 2e6 }], seed: 'x' });
  assert.deepEqual(tickLeilao(L, 5), [], 'só anda depois do Começar');
  comecarLeilao(L);
  assert.match(lanceLeilao(L, 0, 2e6), /mais alto já é seu/);
  const ev = [];
  while (L.lider === 0 && !L.fim) ev.push(...tickLeilao(L, 0.5));
  assert.ok(L.valor >= 1.2e6 && L.relogio > 25, 'a IA cobre a partir do preço pedido e o relógio volta a 30');
  assert.match(lanceLeilao(L, 0, L.valor + 1), /mínimo/);
  assert.match(lanceLeilao(L, 0, 3.5e6), /pode gastar/);
  assert.equal(lanceLeilao(L, 0, minimoLeilao(L)), null); assert.equal(L.lider, 0);
  while (!L.fim) ev.push(...tickLeilao(L, 0.5));
  assert.ok(L.lances.every((x, i) => !i || x.valor > L.lances[i - 1].valor), 'cada lance maior que o anterior');
  assert.ok(Object.values(L.P).every(p => p.humano || L.lances.filter(x => L.P[x.ci] === p).every(x => x.valor <= p.max)), 'IA respeita o máximo');
  const tipos = ev.map(e => e.tipo);
  assert.ok(tipos.indexOf('uma') < tipos.indexOf('duas') && tipos.at(-1) === 'vendido');
  assert.ok(L.valor <= 3e6 && (L.lider === 0 || L.valor <= 2e6));
  // humano que desiste: a IA segue sozinha e o determinismo vale pela semente
  const roda = () => { const M = novoLeilao({ id: 'b', modo: 'compra', jogador: 1, vendedor: 9, valor: 1e6, lider: 0, participantes: [{ ci: 0, humano: true, max: 9e6 }, { ci: 5, max: 4e6 }, { ci: 6, max: 3e6 }], seed: 'y' }); comecarLeilao(M); tickLeilao(M, 3); desistirLeilao(M, 0); return terminarSemHumanos(M); };
  const A = roda(), B2 = roda();
  assert.equal(A.lider, 5); assert.ok(A.valor >= 3e6 / 1.04 && A.valor <= 4e6, `${A.valor}`); assert.deepEqual(A.lances, B2.lances);
});

test('leilão no jogo: concorrência abre na hora, perder leva o jogador, vencer deixa só o salário; venda decide no fim', () => {
  let s, j, L;
  for (let seed = 1; seed < 40 && !L; seed++) {
    s = novoJogo(base, cfg(70 + seed)); s.caixa = 60e6;
    const meu = s.tecnico.clube;
    j = [...base.jog.values()].filter(x => base.clubes[x.clube].div === 'A' && x.clube !== meu && x.ovr >= 76 && !rivais(base, x.clube, meu)).sort((a, b) => b.ovr - a.ovr)[seed % 7];
    const ped = precoPedido(base, s, j);
    if (fazerProposta(base, s, j, { tipo: 'compra', valor: ped * 0.9, salario: Math.min(tetoSalarial(base, s).teto, salarioPedido(base, s, j, 3)), anos: 3 })) continue;
    L = abrirLeilaoCompra(base, s, s.propostas[0].id);
  }
  assert.ok(L, 'algum craque tem concorrência');
  const de = j.clube, pid = L.id, rival = encerrarPendente(base, s); // fechou o app: a sala termina sem você
  const p = s.propostas.find(x => x.id === pid);
  assert.ok(!s.leilaoAtivo && rival.venceu === false && p.estado === 'perdida' && j.clube === rival.ci && j.clube !== de);
  assert.equal(s.historicoTransf[0].valor, rival.valor);
  // vencer: lance acima do máximo de todo mundo, o clube vendedor já topou e a conversa é só com o jogador
  const s2 = novoJogo(base, cfg(71)); s2.caixa = 60e6;
  const k = [...base.jog.values()].find(x => base.clubes[x.clube].div === 'B' && x.ovr >= 64), L2 = novoLeilao({ id: 'p1', modo: 'compra', jogador: k.id, vendedor: k.clube, valor: 5e5, lider: s2.tecnico.clube, reserva: 4e5, participantes: [{ ci: s2.tecnico.clube, humano: true, max: 9e6 }, { ci: 3, max: 6e5 }], seed: 1 });
  s2.propostas.unshift({ id: 'p1', jogador: k.id, de: k.clube, tipo: 'compra', valor: 5e5, salario: 500, anos: 3, rodada: s2.rodada, estado: 'aguardando' });
  s2.leilaoAtivo = L2; comecarLeilao(L2);
  while (!L2.fim) { tickLeilao(L2, 1); if (L2.lider !== s2.tecnico.clube && !L2.fim) lanceLeilao(L2, s2.tecnico.clube, minimoLeilao(L2)); }
  const r2 = fecharLeilao(base, s2);
  assert.ok(r2.venceu && s2.propostas[0].clubeOk && s2.propostas[0].valor === L2.valor && s2.propostas[0].valor > 6e5);
  // vendendo: a oferta vira a do vencedor e o jogador continua seu até você decidir
  const s3 = novoJogo(base, cfg(72)), ci3 = s3.tecnico.clube, v = base.elencos[ci3].slice().sort((a, b) => b.ovr - a.ovr)[1];
  s3.recebidas = [{ id: 'r1', tipo: 'compra', jogador: v.id, de: 3, valor: 1e6, rodada: s3.rodada }];
  assert.equal(abrirLeilaoVenda(base, s3, 'r1'), null); assert.match(abrirLeilaoVenda(base, s3, 'r1'), /leilão/);
  const r3 = encerrarPendente(base, s3);
  assert.equal(v.clube, ci3); assert.equal(s3.recebidas.length, 1); assert.equal(s3.recebidas[0].id, r3.id); assert.ok(r3.valor >= 1e6 && s3.recebidas[0].leilao === 'fim');
});

test('rebaixado: os melhores com perfil pedem para sair e, sem venda até a janela fechar, rescindem pagando multa', () => {
  const s = novoJogo(base, cfg(81)), meu = s.tecnico.clube, outro = base.clubes.findIndex((c, i) => c.div === 'A' && i !== meu && i > 5);
  pedidosDeQueda(base, s, [meu, outro]);
  const meus = Object.entries(s.querSair).filter(([, q]) => q.queda), ia = Object.keys(s.quedaIA);
  assert.ok(meus.length >= 1 && meus.length <= 3 && ia.length >= 1 && ia.length <= 3);
  for (const [id, q] of meus) { const j = base.jog.get(+id); assert.ok(q.queda.multa < j.valor * 1000 && q.queda.multa >= j.valor * 1000 * 0.38); }
  assert.ok(ia.every(id => listasIA(base, s).venda.has(+id)), 'craque do rebaixado da IA vai à venda');
  const cx = s.caixa, multas = meus.reduce((a, [, q]) => a + q.queda.multa, 0);
  for (let k = 0; k < 400 && janelaAberta(s.ano, s.rodada + 1); k++) avancar(base, s);
  for (const r0 = s.rodada; s.rodada === r0;) avancar(base, s); // a rodada em que a janela fecha
  for (const [id] of meus) assert.notEqual(base.jog.get(+id).clube, meu);
  assert.ok(s.caixa - cx > -5e6 && s.historicoTransf.some(h => h.tipo === 'rescisao' && h.de === meu && h.valor > 0) || multas === 0);
  assert.ok(!Object.keys(s.quedaIA).length, 'na IA, quem sobrou rescindiu');
});

import { lerValor, fmtDinheiro as fmtD } from '../public/js/motor/util.js';
test('preço: negócio entre clubes da IA não depende do seu clube; contrato acabando barateia mês a mês; dinheiro em 500 mil e 5M', () => {
  const ci = n => base.clubes.findIndex(c => c.n === n), j = [...base.jog.values()].find(x => x.curto === 'Arrascaeta'), pal = ci('Palmeiras');
  const precos = ['Athletico-PR', 'Fortaleza', 'Fluminense'].map(n => precoPedido(base, novoJogo(base, { ...cfg(3), clube: ci(n) }), j, pal));
  assert.equal(new Set(precos).size, 1);
  const s = novoJogo(base, cfg(4)), k = [...base.jog.values()].find(x => base.clubes[x.clube].div === 'A' && x.contrato === s.ano && x.clube !== s.tecnico.clube);
  const fim = precoPedido(base, s, k); s.ultimaData = Date.UTC(s.ano, 7, 1); const agosto = precoPedido(base, s, k);
  s.ultimaData = null; s.contratos[k.id] = s.ano + 3; aplicarSave(base, s); const renovado = precoPedido(base, s, k);
  assert.ok(agosto < fim * 0.7 && renovado / fim < 1.35, `${fim} ${agosto} ${renovado}`);
  assert.deepEqual(['500mil', '500 mil', '5M', '5,5m', '1.500.000', '12,5', '500'].map(lerValor), [5e5, 5e5, 5e6, 5.5e6, 1.5e6, 12.5e6, 5e5]);
  assert.deepEqual([4.5e5, 5e6, 12.4e6].map(v => fmtD(v)), ['€ 450 mil', '€ 5M', '€ 12,4M']);
});

import { precoExterior } from '../public/js/motor/mercado.js';
test('exterior: garoto vale mais que veterano do mesmo valor, teto de € 45M, Arábia paga mais; rival paga acima do limite', () => {
  const s = novoJogo(base, cfg(5)), r = () => 0.4, js = [...base.jog.values()].filter(j => base.clubes[j.clube].div === 'A' && j.contrato >= s.ano + 2);
  const jovem = js.find(j => j.idade <= 20 && j.valor >= 3000), velho = js.find(j => j.idade >= 31 && j.valor >= 3000);
  assert.ok(precoExterior(base, s, jovem, r) / (jovem.valor * 1000) > 1.4 && precoExterior(base, s, velho, r) / (velho.valor * 1000) < 0.7);
  const caro = js.filter(j => j.ovr < 86).sort((a, b) => b.valor - a.valor)[0], sau = base.clubes.findIndex(c => c.liga === 'Saudi Pro League');
  assert.ok(precoExterior(base, s, caro, r) <= 45e6);
  const vet = js.find(j => j.idade >= 27 && j.idade <= 30 && j.valor >= 5000);
  assert.ok(precoExterior(base, s, vet, r, sau) > precoExterior(base, s, vet, r) * 1.2);
  const ci = n => base.clubes.findIndex(c => c.n === n), arr = [...base.jog.values()].find(x => x.curto === 'Arrascaeta');
  assert.ok(precoPedido(base, novoJogo(base, { ...cfg(3), clube: ci('Fluminense') }), arr) > arr.valor * 1000 * 2.5, 'o rival paga caro');
});

test('IA monta elenco: na temporada, livres, empréstimos e compras mantêm os elencos cheios e a lista de livres enxuta', () => {
  const s = novoJogo(base, cfg(9)), div = ci => base.clubes[ci].div, vistos = [];
  let ult = s.historicoTransf[0];
  for (let k = 0; k < 4000 && !fimDeTemporada(s); k++) { avancar(base, s); for (const h of s.historicoTransf) { if (h === ult) break; vistos.push(h); } ult = s.historicoTransf[0]; }
  const ia = vistos.filter(h => h.ia), A = base.clubes.map((c, i) => i).filter(i => div(i) === 'A' && i !== s.tecnico.clube).map(i => base.elencos[i].length);
  assert.ok(ia.length >= 200, `${ia.length} negócios`);
  assert.ok(ia.some(h => h.tipo === 'emprestimo') && ia.some(h => h.tipo === 'livre'));
  assert.ok(A.reduce((a, b) => a + b, 0) / A.length >= 30 && Math.min(...A) >= 24, A.join(','));
  assert.ok(base.elencos[base.clubes.findIndex(c => c.div === 'L')].length <= 150);
});

import { clausula, recusaDistrato, valorDistrato } from '../public/js/motor/mercado.js';
import { salarioBase as salBase } from '../public/js/motor/financas.js';
test('salário pela idade, multa rescisória paga leva o jogador, distrato só com acordo, cartas de início e leilão-surpresa', () => {
  const s = novoJogo(base, cfg(12)), ci = s.tecnico.clube, c = base.clubes[ci];
  // veterano ganha mais que garoto do mesmo valor; garoto valorizado ganha bem menos que 30% do valor
  const jov = { idade: 21, ovr: 78, valor: 20000 }, vet = { idade: 33, ovr: 78, valor: 20000 };
  assert.ok(salBase(c, vet) > salBase(c, jov) * 1.8 && salBase(c, jov) * 365 < 0.2 * 20e6);
  // cartas de início: boas-vindas e teto
  assert.ok(s.msgs.some(m => m.assunto.startsWith('Bem-vindo')) && s.msgs.some(m => m.assunto.startsWith('Teto salarial')));
  // multa rescisória: proposta no valor da multa, o clube não recusa (nem abre leilão)
  s.caixa = 2e8; s.fin.salarioBudget = null;
  const j = [...base.jog.values()].find(x => base.clubes[x.clube].div === 'B' && x.ovr >= 64 && vontade(base, s, x, ci) >= 70);
  const cid = clausula(base, s, j); assert.ok(cid && cid.int >= cid.nac && cid.nac >= j.valor * 1000 * 1.5 - 1e4);
  assert.equal(fazerProposta(base, s, j, { tipo: 'compra', valor: cid.nac, salario: Math.min(tetoSalarial(base, s).teto, salarioPedido(base, s, j, 3) * 2), anos: 3 }), null);
  const p = s.propostas[0]; resolverMercado(base, s, s.rodada);
  assert.ok(p.clubeOk && p.leilao !== 'vivo', `${p.estado} ${p.motivo || ''}`);
  // distrato: titular jovem recusa, veterano aceita
  const el = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr), tit = el.find(x => x.idade <= 27), velho = el.find(x => x.idade >= 31);
  assert.ok(recusaDistrato(base, s, tit) && !recusaDistrato(base, s, velho) && valorDistrato(base, s, velho) < multaRescisao(base, s, velho));
  // leilão-surpresa sem ninguém na tela: depois de duas passadas do mercado, a sala termina sozinha
  s.leilaoAtivo = { ...novoLeilao({ id: 'x', modo: 'compra', jogador: j.id, vendedor: j.clube, valor: 1e6, lider: ci, participantes: [{ ci, humano: true, max: 1e7 }, { ci: 3, max: 2e6 }], seed: 1 }), criado: -5 };
  resolverMercado(base, s, s.rodada); assert.ok(!s.leilaoAtivo);
});

import { limiteEstrangeiros, estrangeiro, escalacao as escalacaoE } from '../public/js/motor/mundo.js';
test('limite de estrangeiros: 9 relacionados no Brasileirão e na Copa do Brasil em 2026, caindo até 5 em 2030; livre na Libertadores', () => {
  assert.deepEqual([2026, 2027, 2028, 2029, 2030, 2035].map(a => limiteEstrangeiros(a, 'L')), [9, 8, 7, 6, 5, 5]);
  assert.equal(limiteEstrangeiros(2026, 'LIB'), Infinity); assert.equal(limiteEstrangeiros(2026, 'CB'), 9);
  const ci = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A').sort((a, b) => base.elencos[b].filter(estrangeiro).length - base.elencos[a].filter(estrangeiro).length)[0];
  const s = novoJogo(base, { ...cfg(31), clube: ci }), conta = t => [...t.xi, ...t.banco].filter(estrangeiro).length;
  assert.ok(base.elencos[ci].filter(estrangeiro).length > 9);
  s.ano = 2030; const t = escalacaoE(base, s, ci, 'L');
  assert.ok(conta(t) <= 5 && t.xi.filter(Boolean).length === 11 && t.banco.length >= 7, `${conta(t)} estrangeiros`);
  const outro = base.clubes.findIndex((c, i) => c.div === 'A' && i !== ci && base.elencos[i].filter(estrangeiro).length > 5);
  assert.ok(conta(escalacaoE(base, s, outro, 'L')) <= 5 && conta(escalacaoE(base, s, outro, 'LIB')) > 5);
});

import { sulAmericanos, novaCont } from '../public/js/motor/continental.js';
test('base sul-americana do Treineiros: elencos reais e vagas por país nas copas a partir de 2027', () => {
  const sa = sulAmericanos(base), arg = sa.filter(ci => base.clubes[ci].nat === 'ARG');
  assert.ok(sa.length >= 100, `sul-americanos: ${sa.length}`);
  assert.equal(arg.length, 30); assert.ok(arg.every(ci => base.elencos[ci].length >= 20));
  const s = novoJogo(base, cfg(77)); s.ano = 2027; s.classif = { A: base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A') };
  novaCont(base, s);
  // grupos saem depois da pré: 28 direto + 16 na pré (Libertadores) e 28 direto na Sula
  const pais = L => { const n = {}; for (const c of L) { const p = base.clubes[c].div === 'X' ? base.clubes[c].nat : 'BRA'; n[p] = (n[p] || 0) + 1; } return n; };
  const { LIB, PRE, SUL } = s.cont, D = pais(LIB.espera), P = pais(PRE.clubes);
  assert.deepEqual([LIB.espera.length, PRE.clubes.length, SUL.espera.length, LIB.grupos.length], [28, 16, 28, 0]);
  assert.deepEqual([D.BRA, P.BRA], [4, 1]); assert.ok(D.ARG >= 5 && D.COL === 2 && D.BOL === 2 && P.ARG === 1 && P.COL === 2, JSON.stringify([D, P]));
  assert.equal(new Set([...LIB.espera, ...PRE.clubes, ...SUL.espera]).size, 72);
});

import { novoMundo, novaMesa, montar, processarProximo, vistaDe, horario, adiantar, devido, proximoHorario, merge3, liberarMesa, clubeLivre } from '../public/js/motor/online.js';
import { daFoto, pendentes } from '../public/js/motor/mundo.js';
import { aceitarRecebida as aceitarR, responderProposta } from '../public/js/motor/mercado.js';
test('liga online: dois técnicos no mesmo mundo, cada um com a sua tática, finanças e correio; proposta entre eles; replay igual; virada', () => {
  const W = novoMundo(base, 31), mesas = {};
  montar(W, mesas);
  const A = base.clubes.findIndex(c => c.n === 'Palmeiras'), B = base.clubes.findIndex(c => c.n === 'Flamengo');
  mesas.u1 = novaMesa(base, W, A, { nome: 'Ana' }); mesas.u2 = novaMesa(base, W, B, { nome: 'Beto' });
  assert.equal(novaMesa(base, W, A, { nome: 'Outro' }), null, 'clube já tem técnico');
  const va = vistaDe(W, 'u1'), vb = vistaDe(W, 'u2');
  assert.equal(va.tecnico.clube, A); assert.ok(va.msgs.length >= 2 && va.caixa > 0 && vb.caixa > 0);
  assert.equal(W.tecnico.clube, -1); assert.ok(!('fin' in W) && !('msgs' in W), 'mundo sem campos de técnico');
  assert.ok(mesas.u1.verbaCompras && mesas.u2.verbaCompras && !('verbaCompras' in W), 'verba de contratações do começo é de cada técnico');
  // pré-temporada: os 3 primeiros horários são os amistosos de cada técnico (com reprise igual)
  assert.equal(pendentes(base, va).find(e => e.meu).tipo, 'amistoso');
  for (let k = 1; k <= 3; k++) assert.deepEqual(processarProximo(base, W), { amistoso: k });
  assert.ok([va, vb].every(v => v.ultima.div === 'AMI' && v.amistosos.jogos.every(j => j.g)) && W.rodada === 0);
  const FA = daFoto(va.ultimaVivo); assert.deepEqual(simular(FA.th, FA.ta, FA.seed, FA.opts).gols, va.ultima.gols);
  // proposta da Ana por um jogador do Beto (janela aberta na pré-temporada)
  const alvo = base.elencos[B].slice().sort((a, b) => a.ovr - b.ovr)[8];
  const v = Math.round(clausula(base, vb, alvo).nac / 2e5) * 1e5; // abaixo da multa: o Beto decide
  assert.equal(fazerProposta(base, va, alvo, { tipo: 'compra', valor: v, salario: salarioPedido(base, va, alvo, 3, A), anos: 3 }), null);
  assert.match(responderProposta(base, va, va.propostas[0].id), /já chegou/);
  let n = 0;
  const x = vb.recebidas.find(y => y.humano);
  assert.ok(x && x.de === A && x.jogador === alvo.id, 'proposta chegou ao Beto na hora');
  const ca = va.caixa, cb = vb.caixa;
  assert.equal(aceitarR(base, vb, x.id), null);
  assert.equal(alvo.clube, A); assert.equal(va.caixa, ca - v); assert.equal(vb.caixa, cb + v);
  // multa rescisória paga: fecha na hora, o Beto não tem o que fazer (só o jogador podia recusar)
  const alvo2 = base.elencos[B].filter(j => j.id !== alvo.id && vontade(base, vb, j, A) >= 35).sort((a, b) => a.ovr - b.ovr)[5], m = clausula(base, vb, alvo2).nac;
  const cb2 = vb.caixa;
  assert.equal(fazerProposta(base, va, alvo2, { tipo: 'compra', valor: m, salario: salarioPedido(base, va, alvo2, 3, A), anos: 3 }), null);
  assert.match(responderProposta(base, va, va.propostas[0].id), /Multa rescisória paga/);
  assert.equal(alvo2.clube, A); assert.equal(vb.caixa, cb2 + m); assert.ok(!vb.recebidas.some(y => y.jogador === alvo2.id) && vb.msgs.some(c => /multa rescisória/.test(c.assunto)));
  assert.equal(va.propostas.find(p => p.jogador === alvo.id).estado, 'concluida');
  while (W.rodada < 4 && n++ < 400) processarProximo(base, W);
  // a Ana deixa o melhor jogador no banco: vale no próximo jogo dela
  const livre = j => !indisponivel(W, j.id), xi = escalacao(base, va, A, 'L').xi.map(j => j.id), melhor = base.elencos[A].filter(j => xi.includes(j.id)).sort((a, b) => b.ovr - a.ovr)[0];
  const outro = base.elencos[A].find(j => !xi.includes(j.id) && livre(j) && j.pos === melhor.pos) || base.elencos[A].find(j => !xi.includes(j.id) && livre(j) && j.pos !== 'GOL');
  va.xi = xi.map(id => id === melhor.id ? outro.id : id);
  const antes = va.ultima;
  while (va.ultima === antes && n++ < 420) processarProximo(base, W);
  for (const v of [va, vb]) { assert.ok(v.ultima?.gols && v.fin.extrato.some(e => e.tipo === 'salarios') && v.ultimaVivo, 'súmula, salários e replay de cada um'); }
  const lado = va.ultima.casa === A ? 0 : 1;
  if (!va.ultima.xi[lado].includes(outro.id)) assert.fail('a escalação da Ana não foi usada');
  // replay: a ficha refaz o mesmo jogo
  const F = daFoto(va.ultimaVivo);
  assert.deepEqual(simular(F.th, F.ta, F.seed, F.opts).gols, va.ultima.gols);
  // a IA não mexe nos elencos dos técnicos
  assert.ok(!W.historicoTransf.some(h => h.ia && ([A, B].includes(h.de) || [A, B].includes(h.para))));
  // relógio: horários em sequência; o ADM adianta o próximo para agora
  const L = { ritmo: 'normal', inicio: Date.UTC(2026, 9, 9, 14) }, W2 = { slot: 0 };
  const h0 = horario(L, 0), h1 = horario(L, 1);
  assert.ok(h0 >= L.inicio + 600e3 && h1 > h0 && !devido(L, W2, h0 - 1) && devido(L, W2, h0));
  const L2 = adiantar(L, W2, L.inicio + 60e3); assert.equal(proximoHorario(L2, W2), L.inicio + 60e3);
  // merge de 3 vias: dinheiro soma as duas mudanças, chave mexida só de um lado entra
  assert.deepEqual(merge3({ caixa: 100, a: 1, l: [1] }, { caixa: 90, a: 2, l: [1, 2] }, { caixa: 130, a: 1, l: [1, 3] }), { caixa: 120, a: 2, l: [1, 3, 2] });
  assert.deepEqual(merge3({}, { am: { jogos: [{ g: null }] } }, { am: { jogos: [{ g: [1, 0] }] } }), { am: { jogos: [{ g: [1, 0] }] } }, 'lista criada dos dois lados não duplica');
  // virada com os dois
  while (W.ano === 2026 && n++ < 600) processarProximo(base, W);
  // (sem ninguém mexendo no time, um técnico pode cair no meio do caminho: aí ele fica sem clube e sem histórico)
  assert.equal(W.ano, 2027);
  const ativos = [[va, A], [vb, B]].filter(([v]) => !v.demitido);
  assert.ok(ativos.length);
  for (const [v, c] of ativos) { assert.equal(v.historico[0].clube, c); assert.equal(pendentes(base, v).find(e => e.meu).tipo, 'amistoso', 'a temporada nova começa pelos amistosos'); }
  // o Beto sai: o Flamengo volta para a IA com o caixa
  const caixaB = vb.caixa; liberarMesa(base, W, 'u2');
  assert.ok(!mesas.u2 && clubeLivre(base, W, B) && (vb.demitido || W.caixaIA[B] === caixaB));
  processarProximo(base, W);
});

import { pedirDemissao } from '../public/js/motor/carreira.js';
import { ehHumano } from '../public/js/motor/humanos.js';
import { donoDe } from '../public/js/motor/online.js';
test('liga online: demitido larga o clube (IA assume com o caixa), proposta velha não cria dois técnicos, transfer ban do ADM, merge por id', () => {
  const W = novoMundo(base, 77), mesas = {};
  montar(W, mesas);
  const A = base.clubes.findIndex(c => c.n === 'Santos'), B = base.clubes.findIndex(c => c.n === 'Grêmio'), X = base.clubes.findIndex(c => c.n === 'Vasco');
  mesas.a = novaMesa(base, W, A, { nome: 'Ana' }); mesas.b = novaMesa(base, W, B, { nome: 'Beto' });
  const va = vistaDe(W, 'a'), vb = vistaDe(W, 'b');
  for (let k = 0; k < 5; k++) processarProximo(base, W);
  // Beto pede demissão: o Grêmio volta para a IA com o caixa, e o mundo segue sem quebrar
  const caixa = vb.caixa; pedirDemissao(base, vb);
  assert.ok(vb.demitido && !ehHumano(W, B) && donoDe(W, B) == null && W.caixaIA[B] === caixa);
  for (let k = 0; k < 6; k++) processarProximo(base, W);
  // proposta velha para um clube que outro técnico assumiu: recusada
  mesas.c = novaMesa(base, W, X, { nome: 'Caio' });
  vb.ofertas = [{ clube: X, tipo: 'demitido', ano: W.ano }];
  assert.match(aceitarOferta(base, vb, X), /outro técnico/);
  assert.equal(vistaDe(W, 'c').tecnico.clube, X);
  // transfer ban do ADM: não registra ninguém até a rodada marcada
  va.banAdm = { ano: W.ano, ate: W.rodada + 5, motivo: 'teste' };
  const alvo = base.elencos[X].slice().sort((p, q) => p.ovr - q.ovr)[5];
  assert.match(fazerProposta(base, va, alvo, { tipo: 'compra', valor: 1e6, salario: 1000, anos: 2 }), /ADM da liga/);
  // merge3: item com id mudado dos dois lados junta campo a campo
  assert.deepEqual(merge3({ p: [{ id: 1, e: 'a', n: 0 }] }, { p: [{ id: 1, e: 'b', n: 0 }] }, { p: [{ id: 1, e: 'a', n: 1 }, { id: 2 }] }), { p: [{ id: 1, e: 'b', n: 1 }, { id: 2 }] });
});

import { dividaInicial, verbaIA, receitaAnual, amortizar, garantirFinancas as garantirFin, JUROS } from '../public/js/motor/financas.js';
test('finanças reais de 2025: dívida, receita e verba de contratação no tamanho dos balanços', () => {
  const c = n => base.clubes.find(x => x.n === n), mi = v => v / 1e6;
  // dívida líquida (Sports Value 2025): Corinthians ~R$ 2,45 bi, Atlético ~R$ 2,3 bi, Flamengo ~R$ 473 mi; Mirassol zero
  assert.ok(mi(dividaInicial(c('Corinthians'))) > 350 && mi(dividaInicial(c('Atlético-MG'))) > 330 && mi(dividaInicial(c('Flamengo'))) < 90 && dividaInicial(c('Mirassol')) === 0);
  // receita recorrente: Flamengo a maior, depois Palmeiras; Flamengo perto de € 250 mi
  const R = ['Flamengo', 'Palmeiras', 'Corinthians', 'Mirassol'].map(n => mi(receitaAnual(c(n))));
  assert.ok(R[0] > R[1] && R[1] > R[2] && R[2] > R[3] && R[0] > 200 && R[0] < 300, R.join());
  // verba de contratação da IA: Palmeiras e Flamengo gastam, Corinthians e São Paulo quase nada
  assert.ok(verbaIA(c('Palmeiras')) > 30e6 && verbaIA(c('Flamengo')) > 25e6 && verbaIA(c('Corinthians')) < 3e6 && verbaIA(c('São Paulo')) < 4e6);
  // carreira no Corinthians: começa devendo, paga juros por rodada e pode amortizar
  const ci = base.clubes.findIndex(x => x.n === 'Corinthians'), s = novoJogo(base, { ...cfg(83), clube: ci });
  garantirFin(base, s); s.caixa = 20e6;
  const d0 = s.fin.divida; assert.ok(d0 > 350e6);
  assert.match(amortizar(base, s, 5e6), /amortizada/); assert.equal(s.fin.divida, d0 - 5e6); assert.equal(s.caixa, 15e6);
  while (s.rodada < 3) avancar(base, s);
  assert.ok(s.fin.extrato.some(e => e.tipo === 'juros' && Math.abs(e.valor + s.fin.divida * JUROS / 38) < 1e4), 'juros por rodada');
  assert.ok(s.fin.extrato.some(e => e.tipo === 'estrutura'), 'estrutura do clube');
});

test('calendário: mando alternado (sorteio) e tabela oficial da Série A 2026 em jogo novo', () => {
  const alt = pontosCorridos([...Array(20).keys()], 11, 2), seq = {};
  for (let i = 0; i < 20; i++) seq[i] = [];
  for (const rd of alt) { assert.equal(new Set(rd.flat()).size, 20); for (const [h, a] of rd) { seq[h].push(1); seq[a].push(0); } }
  for (const x of Object.values(seq)) { let run = 1; for (let i = 1; i < 38; i++) { run = x[i] === x[i - 1] ? run + 1 : 1; assert.ok(run <= 3); } }
  const s = novoJogo(base, cfg(5)), A = rodadasDe(base, s, 'A'), n = i => base.clubes[i].s;
  assert.equal(A.length, 38);
  assert.deepEqual(A[0].map(([h, a]) => `${n(h)}-${n(a)}`).slice(0, 3), ['FLU-GRE', 'BOT-CRU', 'SAO-FLA']);
  assert.ok(A[37].map(([h, a]) => `${n(h)}-${n(a)}`).includes('REM-COR'));
});

test('renovação: qualquer jogador, com multa editável; multa maior encarece', () => {
  const s = novoJogo(base, cfg(108)), ci = s.tecnico.clube;
  const j = base.elencos[ci].filter(x => x.contrato >= s.ano + 3 && !s.emprestimos[x.id]).sort((a, b) => a.ovr - b.ovr)[0];
  assert.ok(j, 'jogador com contrato longo');
  const { pede } = pedidoRenovacao(base, s, j, 3), pad = clausulaDe(base, s, j);
  const r1 = renovar(base, s, j, pede, 3, { nac: pad.nac, int: pad.int * 3 });
  assert.equal(r1.ok, false); assert.ok(r1.pede > pede);
  const r2 = renovar(base, s, j, r1.pede, 3, { nac: Math.round(pad.nac / 2), int: pad.int });
  assert.ok(r2.ok, r2.txt);
  assert.equal(clausulaDe(base, s, j).nac, Math.round(pad.nac / 2));
});

test('verba livre: todo clube começa com dinheiro para contratar, inclusive na Série C', () => {
  for (const div of ['A', 'B', 'C']) {
    for (const ci of base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === div).filter((_, k) => k % 4 === 0)) {
      const s = novoJogo(base, { ...cfg(3), modo: 'escolher', clube: ci });
      assert.ok(orcamento(base, s).compras >= 1e5, `${base.clubes[ci].n}: ${orcamento(base, s).compras}`);
    }
  }
});
