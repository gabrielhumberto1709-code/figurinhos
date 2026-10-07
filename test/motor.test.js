import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pontosCorridos } from '../public/js/motor/calendario.js';
import { simular, melhorTime } from '../public/js/motor/partida.js';
import { Base, novoJogo, avancar, tabela, paraSalvar } from '../public/js/motor/mundo.js';

const base = new Base(JSON.parse(fs.readFileSync(new URL('../public/data/brasil.json', import.meta.url))));
const cfg = seed => ({ tecnico: { nome: 'Teste', reputacao: 1 }, modo: 'escolher', clube: 0, seed });
// joga até a liga chegar na rodada n (jogos da copa no meio contam à parte)
const ate = (s, n) => { while (s.rodada < n) avancar(base, s); };
const rodada = s => ate(s, s.rodada + 1);

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
  rodada(s);
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

test('mercado: proposta baixa é recusada, janela fechada não bloqueia jogador livre', () => {
  const s = novoJogo(base, cfg(22));
  const alvo = base.elencos[5][0];
  assert.equal(fazerProposta(base, s, alvo, proposta(base, s, alvo, { valor: precoPedido(base, s, alvo) * 0.5 })), null);
  rodada(s);
  assert.equal(s.propostas[0].estado, 'recusada');
  s.rodada = 10; s.fin.salarioBudget = 1e9;
  const outro = base.elencos[6][0];
  const livre = base.elencos[base.clubes.findIndex(c => c.div === 'L')].sort((a, b) => b.ovr - a.ovr).find(j => vontade(base, s, j, s.tecnico.clube) >= 60);
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
  rodada(s);
  const p = s.propostas[0];
  if (p.estado === 'perdida') return; // rival levou: caminho válido
  assert.equal(p.estado, 'contraproposta');
  assert.ok(p.contraSal >= pede * 0.9, `pediu ${p.contraSal}, esperado perto de ${pede}`);
  assert.equal(aceitarContraproposta(base, s, p.id), null);
  rodada(s);
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
  rodada(s);
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
  rodada(s);
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

test('copa do brasil: 32 clubes, mata-mata até a final, campeão e prêmios', () => {
  const ci = base.clubes.findIndex(c => c.n === 'Flamengo');
  const s = novoJogo(base, { ...cfg(41), clube: ci });
  assert.equal(s.copa.chaves.length, 16);
  assert.equal(new Set(s.copa.chaves.flat()).size, 32);
  let jogosCopa = 0;
  while (s.rodada < 38) { if (proximoEvento(base, s).tipo === 'copa') jogosCopa++; avancar(base, s); }
  assert.ok(fimDeTemporada(s));
  assert.equal(s.copa.fase, FASES.length);
  assert.ok(s.copa.campeao != null && s.copa.vice != null && s.copa.campeao !== s.copa.vice);
  assert.equal(s.copa.jogos.length, 16 + 8 + 4 + 2 + 1 + 1);
  for (const j of s.copa.jogos.filter(x => x.fase < 4)) assert.ok(j.gols[0] !== j.gols[1] || j.pen, 'jogo único empatado precisa de pênaltis');
  assert.ok(jogosCopa >= 1 && jogosCopa <= 6);
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
  const tabA = tabela(base, s, 'A'), tabB = tabela(base, s, 'B');
  const h = virarTemporada(base, s);
  assert.equal(s.ano, 2027); assert.equal(s.rodada, 0); assert.equal(h.ano, 2026);
  for (const d of ['A', 'B', 'C']) assert.equal(base.clubes.filter(c => c.div === d).length, 20, d);
  for (const l of tabA.slice(16)) assert.equal(base.clubes[l.clube].div, 'B');
  for (const l of tabB.slice(0, 4)) assert.equal(base.clubes[l.clube].div, 'A');
  if (!amostra.fora) assert.equal(amostra.idade, idade0 + 1);
  for (const id of sairao.slice(1)) assert.notEqual(base.jog.get(id).clube, ci, 'contrato acabou: saiu');
  if (renovado != null) assert.equal(base.jog.get(renovado).clube, ci);
  for (const d of ['A', 'B', 'C']) { const cal = rodadasDe(base, s, d); assert.equal(cal.length, 38); assert.equal(new Set(cal[0].flat()).size, 20); }
  assert.ok(base.elencos[ci].length >= 18, `elenco ${base.elencos[ci].length}`);
  assert.equal(s.copa.ano, 2027); assert.equal(s.copa.chaves.length, 16);
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
  for (const k of ['LIB', 'SUL']) { const T = s.cont[k]; assert.equal(new Set(T.grupos.flat()).size, 16); assert.equal(T.grupos.flat().filter(c => base.clubes[c].div !== 'X').length, 6); }
  assert.ok(s.cont.LIB.grupos.flat().includes(ci), 'o mais forte da A joga a Libertadores');
  while (!fimDeTemporada(s)) avancar(base, s);
  for (const k of ['LIB', 'SUL']) {
    const T = s.cont[k];
    assert.equal(T.fase, FASES_CONT.length);
    assert.ok(T.campeao != null && T.vice != null && T.campeao !== T.vice);
    for (let g = 0; g < 4; g++) assert.ok(tabelaGrupo(T, g).every(l => l.j === 6));
    assert.equal(T.jogos.length, 48 + 4 + 2 + 1);
  }
  assert.ok(s.cont.sup.jogo?.campeao != null);
  assert.ok(s.fin.extrato.some(e => e.desc.includes('Libertadores: cota da fase de grupos')));
  const tabA = tabela(base, s, 'A').map(l => l.clube), copaCamp = s.copa.campeao;
  virarTemporada(base, s);
  const libBR = s.cont.LIB.grupos.flat().filter(c => base.clubes[c].div !== 'X');
  const esperado = tabA.filter(c => base.clubes[c].div === 'A' || c === copaCamp).slice(0, 6);
  if (!esperado.includes(copaCamp)) esperado[5] = copaCamp;
  assert.deepEqual(libBR.slice().sort(), esperado.slice().sort());
  assert.equal(s.cont.sup.h, tabA[0]);
});

import { abrirColetiva, responder, efeito, TONS, perfil } from '../public/js/motor/imprensa.js';
test('coletiva: 3 perguntas do jogo, respostas mexem nas plateias e viram notícia; nova coletiva a cada jogo', () => {
  const s = novoJogo(base, cfg(41)), ci = s.tecnico.clube;
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
  const jovem = base.elencos[ci].filter(j => j.idade <= 21 && j.pot - j.ovr >= 6).sort((a, b) => a.idade - b.idade)[0];
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
  for (let k = 0; k < 6; k++) { for (const j of tops) (s.forma ||= {})[j.id] = 7.6; rodada(s); ofertas.push(...s.recebidas.filter(x => tops.some(j => j.id === x.jogador) && !ofertas.some(o => o.id === x.id))); }
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
  assert.equal(naoLidas(s), 1);
  ate(s, 3);
  assert.ok(s.msgs.some(m => m.assunto.startsWith('A meta')));
  const j = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr)[0];
  s.dm[j.id] = { k: 'adutor', n: 3, tot: 3 };
  rodada(s);
  const desf = s.msgs.filter(m => m.assunto.startsWith('Desfalques'));
  assert.ok(desf.length >= 1 && desf[0].texto.includes(j.curto));
  const n = s.msgs.length; rodada(s);
  assert.equal(s.msgs.filter(m => m.assunto === desf[0].assunto).length, 1, 'mesmo assunto não repete');
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
  responderAumento(base, s, j.id, true);
  assert.equal(s.salarios[j.id], 99990);
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

import { valorNaTroca, travado, podeSair, conversaFechada, rescindir, multaRescisao, exercerOpcao, chamarDeVolta, emprestar, pedirMais, abrirLeilao, resolverMercado, alternarLista } from '../public/js/motor/mercado.js';
import { janelaAberta } from '../public/js/motor/mundo.js';
test('mercado extras: troca, trava de 14 jogos, acordo com janela fechada, 3 recusas, rescisão, opção, volta, contraproposta, leilão e gigantes', () => {
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
  rodada(s);
  const p = s.propostas[0];
  assert.equal(p.estado, 'concluida', p.motivo);
  assert.equal(alvo.clube, ci); assert.equal(t.clube, de);
  assert.ok(s.fin.extrato.some(e => e.tipo === 'compra' && e.valor === -p.valor) && !s.fin.extrato.some(e => e.tipo === 'venda'), 'paga só a parte em dinheiro');
  // trava: quem chegou não sai nem vai à lista
  assert.ok(travado(s, alvo.id) > 10);
  assert.match(podeSair(base, s, alvo), /chegou há pouco/);
  assert.match(alternarLista(base, s, 'venda', alvo.id), /chegou há pouco/);
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
  // rescisão: paga metade do que falta e ele fica livre
  const res = base.elencos[ci].slice().sort((a, b) => a.ovr - b.ovr).find(x => x.pos !== 'GOL' && !travado(s, x.id)), m = multaRescisao(base, s, res), cx1 = s.caixa;
  assert.ok(m > 0);
  assert.equal(rescindir(base, s, res.id), null);
  assert.equal(base.clubes[res.clube].div, 'L'); assert.equal(cx1 - s.caixa, m);
  // empréstimo com opção de compra e chamar de volta quem você emprestou
  const emp = base.elencos[5].find(x => !travado(s, x.id)); emprestar(base, s, emp, ci); s.emprestimos[emp.id].opcao = 1e6;
  const cx2 = s.caixa; assert.equal(exercerOpcao(base, s, emp.id), null);
  assert.equal(emp.clube, ci); assert.ok(!s.emprestimos[emp.id]); assert.equal(cx2 - s.caixa, 1e6);
  r = s.rodada; while (!janelaAberta(s.ano, r) || !janelaAberta(s.ano, r + 1)) r++; s.rodada = r;
  const meu = base.elencos[ci].slice().sort((a, b) => a.ovr - b.ovr).find(x => !travado(s, x.id) && x.pos !== 'GOL'); emprestar(base, s, meu, 7);
  assert.equal(meu.clube, 7); assert.equal(chamarDeVolta(base, s, meu.id), null); assert.equal(meu.clube, ci);
  // contraproposta numa oferta recebida: pedir 5% a mais sempre passa e o negócio sai
  const vend = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).find(x => !travado(s, x.id) && x.pos !== 'GOL');
  s.recebidas = [{ id: 'x1', tipo: 'compra', jogador: vend.id, de: 3, valor: 2e6, rodada: s.rodada }];
  assert.equal(pedirMais(base, s, 'x1', 1.05), null);
  assert.ok(pedirMais(base, s, 'x1', 1.3), 'só uma contraproposta');
  resolverMercado(base, s, s.rodada);
  assert.equal(vend.clube, 3);
  // leilão: no fim sobra uma oferta só, pelo menos do tamanho da original
  const lei = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).find(x => !travado(s, x.id) && x.pos !== 'GOL');
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
  const o = orcamento(base, s); assert.equal(o.fim, Math.round(s.caixa + o.cota - o.folha * o.dias));
  s.caixa = -5e6; s.fin.temporada.compras = 1e7; s.fin.temporada.vendas = 0; s.fin.tvPagas = [0, 9, 19, 29];
  const n0 = base.elencos[ci].length, tab = tabela(base, s, base.clubes[ci].div);
  const N = []; for (let k = 0; k < 3; k++) N.push(...contasDaRodada(base, s, s.rodada + k, null, tab));
  assert.equal(s.fin.atraso, 3);
  assert.ok(N.some(t => t.includes('pede')) && Object.values(s.querSair).some(q => q.motivo.includes('atrasado')));
  assert.ok(N.some(t => t.includes('Justiça')) && base.elencos[ci].length === n0 - 1);
  assert.ok(vontade(base, s, alvo, ci) <= v0 - 10, 'mau pagador afasta reforço');
  const D = dicasFinanceiras(base, s);
  assert.ok(D.some(d => d.includes('faltam')) && D.some(d => d.includes('mau pagador')));
});
