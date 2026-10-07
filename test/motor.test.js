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
  const golsTabela = Object.values(s.res.A).reduce((t, g) => t + g[0] + g[1], 0);
  const golsEst = Object.entries(s.est).filter(([id]) => base.clubes[base.jog.get(+id).clube].div === 'A').reduce((t, [, e]) => t + e[1], 0);
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
