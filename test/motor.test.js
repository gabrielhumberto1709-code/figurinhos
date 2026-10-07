import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pontosCorridos } from '../public/js/motor/calendario.js';
import { simular, melhorTime } from '../public/js/motor/partida.js';
import { Base, novoJogo, avancar, tabela, paraSalvar } from '../public/js/motor/mundo.js';

const base = new Base(JSON.parse(fs.readFileSync(new URL('../public/data/brasil.json', import.meta.url))));
const cfg = seed => ({ tecnico: { nome: 'Teste', reputacao: 1 }, modo: 'escolher', clube: 0, seed });

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
    for (let i = 0; i < 38; i++) avancar(base, s);
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
  avancar(base, s); avancar(base, s);
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
  avancar(base, s);
  assert.ok(s.ultima.xi[s.ultima.casa === ci ? 0 : 1].includes(reserva.id));
});

test('jornal: estatísticas batem com os gols e rumores fazem sentido de futebol', () => {
  const s = novoJogo(base, cfg(9));
  for (let i = 0; i < 20; i++) avancar(base, s);
  const golsTabela = ['A', 'B', 'C'].reduce((t, d) => t + Object.values(s.res[d]).reduce((x, g) => x + g[0] + g[1], 0), 0);
  const golsEst = Object.values(s.est).reduce((t, e) => t + e[1], 0); // tem gente que trocou de série no mercado
  assert.equal(golsEst, golsTabela);
  const rumores = s.noticias.filter(n => n.para != null);
  assert.ok(rumores.length >= 10, `só ${rumores.length} rumores`);
  for (const n of rumores) {
    const j = base.jog.get(n.jogador);
    assert.ok(base.forca(n.para) >= base.forca(n.de) + 2, 'clube interessado tem que ser maior');
    assert.ok(interessados(base, j).includes(n.para));
    assert.ok(media(s.est[j.id]) > 0);
  }
  assert.ok(s.destaques.A.time.length === 11);
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
  avancar(base, s);
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

test('mercado: proposta baixa é recusada, janela fechada bloqueia compra mas não jogador livre', () => {
  const s = novoJogo(base, cfg(22));
  const alvo = base.elencos[5][0];
  assert.equal(fazerProposta(base, s, alvo, proposta(base, s, alvo, { valor: precoPedido(base, s, alvo) * 0.5 })), null);
  avancar(base, s);
  assert.equal(s.propostas[0].estado, 'recusada');
  s.rodada = 10; s.fin.salarioBudget = 1e9;
  const outro = base.elencos[6][0];
  assert.match(fazerProposta(base, s, outro, proposta(base, s, outro)), /janela/);
  const livre = base.elencos[base.clubes.findIndex(c => c.div === 'L')].sort((a, b) => b.ovr - a.ovr).find(j => vontade(base, s, j, s.tecnico.clube) >= 60);
  assert.ok(livre, 'precisa de um livre');
  assert.equal(precoPedido(base, s, livre), 0);
  assert.equal(fazerProposta(base, s, livre, { tipo: 'livre', salario: salarioPedido(base, s, livre, 2), anos: 2 }), null);
  avancar(base, s);
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
  avancar(base, s);
  const p = s.propostas[0];
  if (p.estado === 'perdida') return; // rival levou: caminho válido
  assert.equal(p.estado, 'contraproposta');
  assert.ok(p.contraSal >= pede * 0.9, `pediu ${p.contraSal}, esperado perto de ${pede}`);
  assert.equal(aceitarContraproposta(base, s, p.id), null);
  avancar(base, s);
  assert.ok(['concluida', 'perdida'].includes(p.estado), p.estado);
  if (p.estado === 'concluida') assert.equal(s.salarios[alvo.id], p.salario);
});

test('mercado: renovação pede salário, aceita quando paga e o contrato novo sobrevive ao save', () => {
  const s = novoJogo(base, cfg(24)), ci = s.tecnico.clube;
  const j = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr)[3];
  s.contratos[j.id] = s.ano; aplicarSave(base, s);
  s.fin.salarioBudget = 1e9; // folga sobrando
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
  avancar(base, s);
  assert.equal(s.relatorios[alvo.id].exato, true);
  const novos = Object.entries(s.relatorios).filter(([, r]) => r.novo).map(([id]) => base.jog.get(+id));
  assert.equal(novos.length, 2);
  for (const j of novos) { assert.equal(base.clubes[j.clube].div, 'X'); assert.ok(j.idade <= 21); }
  const L = listasIA(base, s);
  assert.ok(L.venda.size > 50 && L.emprestimo.size > 10, `listas ${L.venda.size}/${L.emprestimo.size}`);
});

test('mercado da IA: clubes se reforçam nas janelas sem desmontar elencos', () => {
  const s = novoJogo(base, cfg(26)), ci = s.tecnico.clube, n0 = base.elencos[ci].length, ini = base.elencos.map(e => e.length);
  for (let i = 0; i < 38; i++) avancar(base, s);
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
  for (let i = 0; i < 6; i++) avancar(base, s);
  const b = balanco(s);
  assert.ok(b.salarios < 0 && b.tv > 0 && b.patrocinio > 0, JSON.stringify(b));
  const soma = Object.values(b).reduce((t, v) => t + v, 0);
  assert.ok(Math.abs(s.caixa - caixa0 - soma) < 5, 'extrato bate com o caixa');
  const o = orcamento(base, s);
  assert.ok(o.compras >= 0 && o.compras <= s.caixa);
  assert.ok(folhaDia(base, s) > 0);
});
