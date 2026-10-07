// Partida ao vivo: campinho com os botões se mexendo, narração, placar, estatísticas e substituições.
import { criarPartida, passo, acabou, resultado, substituir, trocarEsquema, trocarEstilo, campoDe, FORMACOES, ESTILOS } from './motor/partida.js';
import { penaltis } from './motor/copa.js';
import * as Campinho from './campinho.js';
import { SOM, somLigado, alternarSom } from './sons.js';
import { RIGOR } from './motor/arbitros.js';

let H; // utilidades da interface (app, clube, esc, imgEscudo, $)
export const configurar = h => { H = h; };

const NOTAVEIS = new Set(['gol', 'golAnulado', 'var', 'defesa', 'fora', 'falta', 'amarelo', 'vermelho', 'lesao', 'sub', 'impedimento', 'escanteio', 'intervalo', 'fim']);
const ICONE = { gol: '⚽', defesa: '🧤', fora: '↗', falta: '✋', amarelo: '🟨', vermelho: '🟥', lesao: '✚', var: '📺', golAnulado: '✖', sub: '⇄', impedimento: '🚩', escanteio: '⛳', intervalo: '⏸', fim: '🏁' };

// cores dos dois times no campo, sem repetir
function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
const dist = (a, b) => { const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b); return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2); };
const claro = h => { const [r, g, b] = rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255 > 0.6; };
function cores(casa, fora) {
  const c1 = casa.c[0], c2 = casa.c[1] || '#FFFFFF';
  const op = [...fora.c, '#FFFFFF', '#1B1F2A'].find(x => dist(x, c1) > 160) || '#FFFFFF';
  const anel = [...fora.c, '#1B1F2A'].find(x => x !== op) || '#1B1F2A';
  const a0 = c2 === c1 ? '#FFFFFF' : c2;
  // cor das barras: a camisa, ou o detalhe dela se a camisa for clara demais para o fundo
  return [{ fundo: c1, anel: a0, txt: claro(c1) ? '#1B1F2A' : '#FFFFFF', barra: claro(c1) ? (claro(a0) ? '#1B1F2A' : a0) : c1 }, { fundo: op, anel, txt: claro(op) ? '#1B1F2A' : '#FFFFFF', barra: claro(op) ? (claro(anel) ? '#1B1F2A' : anel) : op }];
}

export function novaPartidaAoVivo(R) {
  const { th, ta, seed, humano, opts } = R.meu;
  let vel = 1; try { vel = +localStorage.getItem('fig.vel') || 1; } catch { }
  return { R, P: criarPartida(th, ta, seed, { ...opts, narrar: true, humano }), humano, fila: [], vel, pausado: false, painel: false, fim: false, k: 0, placar: [0, 0], min: 0, ult: null, sel: null, historico: [], cp: Campinho.criar() };
}

// ---------- tela ----------
export function tela(V) {
  const { app, clube, esc, imgEscudo } = H, m = V.R.meu, cs = cores(clube(m.h), clube(m.a));
  V.cores = cs;
  return `<div class="vivo" style="--c0:${cs[0].fundo};--a0:${cs[0].anel};--t0:${cs[0].txt};--b0:${cs[0].barra};--c1:${cs[1].fundo};--a1:${cs[1].anel};--t1:${cs[1].txt};--b1:${cs[1].barra}">
    <div class="vivo-barra"><span class="tag-comp">${esc(V.R.titulo || `Série ${m.d} · ${V.R.rd + 1}ª rodada`)}</span>
      <div class="chips">${[1, 2, 4].map(v => `<button class="chip" type="button" data-acao="vivo-vel" data-v="${v}" aria-pressed="${V.vel === v}">${v}×</button>`).join('')}
        <button class="chip" type="button" data-acao="vivo-pausa" id="vivo-pausa">${V.pausado ? 'Seguir' : 'Pausar'}</button>
        <button class="chip" type="button" data-acao="vivo-pular" id="vivo-pular">Pular</button>
        <button class="chip" type="button" data-acao="vivo-som" aria-pressed="${somLigado()}">Som</button></div></div>
    ${V.P.arbitro ? `<p class="arbitro">Árbitro: <b>${esc(V.P.arbitro.nome)}</b> · ${RIGOR[V.P.arbitro.rigor]}</p>` : ''}
    <section class="placar vivo-placar" id="vivo-placar">
      <div class="lado">${imgEscudo(m.h, 56, 61)}<span>${esc(clube(m.h).n)}</span></div>
      <div class="meio-placar"><span class="gols" id="vivo-gols">${V.placar[0]}:${V.placar[1]}</span><span class="minuto" id="vivo-min">${V.min}'</span></div>
      <div class="lado">${imgEscudo(m.a, 56, 61)}<span>${esc(clube(m.a).n)}</span></div>
      <div class="progresso"><b id="vivo-prog" style="width:${V.min / 0.9}%"></b></div>
      <div class="gooool" id="vivo-gol" hidden><strong>GOOOL!</strong><span></span></div>
    </section>
    <div class="campo-h"><canvas id="vivo-cv" role="img" aria-label="Campinho com a partida ao vivo"></canvas></div>
    <div class="ticker" id="vivo-ticker" role="status" aria-live="polite">${V.ult ? esc(V.ult.txt) : 'Bola rolando…'}</div>
    <div id="vivo-fim">${V.fim ? fimHtml(V) : ''}</div>
    <div class="linha-botoes"><button class="botao sec" type="button" data-acao="vivo-painel" ${V.fim ? 'disabled' : ''}>Mexer no time (${5 - V.P.subs[V.humano]} trocas)</button></div>
    <div id="vivo-painel">${V.painel ? painelHtml(V) : ''}</div>
    <section class="cartao stats" id="vivo-stats">${statsHtml(V)}</section>
    ${outrosHtml(V) ? `<section class="cartao" id="vivo-outros">${outrosHtml(V)}</section>` : ''}
    <section class="cartao" id="vivo-esc">${escalacoesHtml(V)}</section>
    <section class="cartao"><h3>Lance a lance</h3><ol class="lances-vivo" id="vivo-lances">${V.historico.map(lanceHtml).join('')}</ol></section>
  </div>`;
}

function lanceHtml(l) {
  return `<li class="t${l.t} ${l.tipo}"><span class="min">${l.min}'</span><span class="ico" aria-hidden="true">${ICONE[l.tipo] || ''}</span><span>${H.esc(l.txt)}</span></li>`;
}

// placar dos outros jogos da rodada andando junto com o seu
function outrosHtml(V) {
  const { clube, esc } = H, jogos = (V.R.jogos || []).filter(j => j.d == null || j.d === V.R.meu.d).slice(0, 10);
  if (!jogos.length) return '';
  const g = j => [0, 1].map(t => j.sim.eventos.filter(e => e.tipo === 'gol' && e.time === t && (V.fim || e.min <= V.min)).length);
  return `<h3>Outros jogos</h3><ul class="outros-jogos">${jogos.map(j => { const p = g(j); return `<li><span>${esc(clube(j.h).n)}</span><b class="num">${p[0]} × ${p[1]}</b><span>${esc(clube(j.a).n)}</span></li>`; }).join('')}</ul>`;
}
function statsHtml(V) {
  const st = V.P.st, tot = (st[0].posse + st[1].posse) || 1;
  const linha = (rot, a, b, fmt = x => x) => { const t = (a + b) || 1; return `<div class="stat"><span class="v">${fmt(a)}</span><div class="barra">${rot}<div><b style="width:${a / t * 100}%;background:var(--b0)"></b><b style="width:${b / t * 100}%;background:var(--b1)"></b></div></div><span class="v">${fmt(b)}</span></div>`; };
  return `<h3>Estatísticas</h3>${linha('Posse', Math.round(st[0].posse / tot * 100), Math.round(st[1].posse / tot * 100), x => x + '%')}${linha('Finalizações', st[0].chutes, st[1].chutes)}${linha('No alvo', st[0].noAlvo, st[1].noAlvo)}${linha('Gols esperados', st[0].xg, st[1].xg, x => x.toFixed(1).replace('.', ','))}${linha('Faltas', st[0].faltas, st[1].faltas)}${linha('Cartões', st[0].amarelos + st[0].vermelhos, st[1].amarelos + st[1].vermelhos)}`;
}

function escalacoesHtml(V) {
  const { clube, esc } = H, P = V.P, m = V.R.meu;
  const marcas = (t, id) => P.ev.filter(e => e.time === t && (e.jogador === id || (e.tipo === 'sub' && e.sai === id))).map(e => e.tipo === 'gol' && e.jogador === id ? '⚽' : e.tipo === 'amarelo' ? '🟨' : e.tipo === 'vermelho' ? '🟥' : e.tipo === 'lesao' ? '✚' : e.tipo === 'sub' ? (e.sai === id ? '↓' : '↑') : '').join('');
  const lista = t => {
    const time = P.times[t], slots = FORMACOES[time.formacao];
    const saiu = P.ev.filter(e => e.tipo === 'sub' && e.time === t).map(e => e.sai);
    return time.xi.map((j, i) => `<li class="${P.expulsos[t].has(j.id) ? 'expulso' : ''}"><span class="num-c">${j.num || ''}</span><span class="nm">${esc(j.curto)} ${marcas(t, j.id)}</span><span class="nota-mini">${(P.notas[t].get(j.id) || 6).toFixed(1).replace('.', ',')}</span><span class="slot">${slots[i]}</span></li>`).join('')
      + saiu.map(id => { const orig = m[t ? 'ta' : 'th'], j = [...orig.xi, ...orig.banco].find(x => x.id === id); return j ? `<li class="saiu"><span class="num-c">${j.num || ''}</span><span class="nm">${esc(j.curto)} ↓</span><span class="nota-mini">${(P.notas[t].get(id) || 6).toFixed(1).replace('.', ',')}</span><span class="slot">—</span></li>` : ''; }).join('');
  };
  return `<h3>Escalações</h3><div class="esc-vivo">${[0, 1].map(t => `<div><p class="esc-titulo">${esc(clube(t ? m.a : m.h).n)} <span class="mudo">${P.times[t].formacao}</span></p><ol>${lista(t)}</ol></div>`).join('')}</div>`;
}

function painelHtml(V) {
  const { esc } = H, P = V.P, t = V.humano, time = P.times[t], slots = FORMACOES[time.formacao];
  const resta = 5 - P.subs[t];
  return `<section class="cartao painel-vivo"><div class="titulo-linha"><h3>Mexer no time</h3><span class="mudo">${resta} troca${resta === 1 ? '' : 's'} restante${resta === 1 ? '' : 's'}</span></div>
    <div class="chips" role="group" aria-label="Esquema">${Object.keys(FORMACOES).map(f => `<button class="chip" type="button" data-acao="vivo-esquema" data-f="${f}" aria-pressed="${time.formacao === f}">${f}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Estilo">${Object.entries(ESTILOS).map(([k, e]) => `<button class="chip" type="button" data-acao="vivo-estilo" data-e="${k}" aria-pressed="${time.estilo === k}">${e.nome}</button>`).join('')}</div>
    <p class="dica">${V.sel ? `Quem entra no lugar de <b>${esc(time.xi.find(j => j.id === V.sel)?.curto || '')}</b>?` : 'Toque em quem vai sair.'}</p>
    <div class="painel-listas"><div><p class="esc-titulo">Em campo</p><ul>${time.xi.map((j, i) => P.expulsos[t].has(j.id) ? '' : `<li><button type="button" class="linha-jog ${V.sel === j.id ? 'sel' : ''}" data-acao="vivo-sai" data-id="${j.id}"><span class="slot">${slots[i]}</span><span class="nm">${esc(j.curto)}</span><span class="nota-mini">${(P.notas[t].get(j.id) || 6).toFixed(1).replace('.', ',')}</span></button></li>`).join('')}</ul></div>
      <div><p class="esc-titulo">Banco</p><ul>${time.banco.map(j => `<li><button type="button" class="linha-jog" data-acao="vivo-entra" data-id="${j.id}" ${!V.sel || !resta ? 'disabled' : ''}><span class="slot">${j.pos}</span><span class="nm">${esc(j.curto)}</span><span class="nota-mini">${j.ovr}</span></button></li>`).join('') || '<li class="mudo">Ninguém no banco</li>'}</ul></div></div>
    <button class="botao" type="button" data-acao="vivo-painel">Voltar ao jogo</button></section>`;
}

// mata-mata da copa: empate no jogo (ou no agregado da final) vai para os pênaltis, com a mesma semente da súmula
function fimHtml(V) {
  const g = V.P.gols, eu = V.humano, m = V.R.meu, ag = m.agg || [0, 0];
  const pen = m.mataMata && g[0] + ag[0] === g[1] + ag[1] ? penaltis(m.seed, campoDe(V.P)) : null;
  const res = pen ? (pen[eu] > pen[1 - eu] ? 'Vitória' : 'Derrota') : g[0] === g[1] ? 'Empate' : (g[eu] > g[1 - eu] ? 'Vitória' : 'Derrota');
  const sub = pen ? `<small>Pênaltis: ${pen[0]} a ${pen[1]}</small>` : m.mataMata && (ag[0] || ag[1]) ? `<small>Agregado: ${g[0] + ag[0]} a ${g[1] + ag[1]}</small>` : '';
  const serie = pen ? `<div class="penaltis">${[0, 1].map(t => `<p><b>${H.esc(H.clube(t ? m.a : m.h).s || '')}</b> ${pen.seq.filter(x => x.t === t).map(x => `<span class="${x.gol ? 'ok' : 'erro'}" title="${H.esc(x.nome)}">${x.gol ? '●' : '✕'} ${H.esc(x.nome)}</span>`).join('')}</p>`).join('')}</div>` : '';
  const titulo = m.final && res === 'Vitória' ? `<div class="campeao-vivo" role="status"><strong>CAMPEÃO!</strong>${'<i></i>'.repeat(24)}</div>` : '';
  return `${titulo}<section class="resultado-vivo ${res.toLowerCase()}"><strong>${res}</strong>${sub}<button class="botao" type="button" data-acao="vivo-fim">Continuar</button></section>${serie}`;
}

// ---------- atualização sem redesenhar a tela ----------
function mostrar(V, l) {
  const { $, esc } = H;
  V.ult = l; V.min = l.min;
  if (l.tipo === 'gol') V.placar = l.placar;
  $('#vivo-gols').textContent = `${V.placar[0]}:${V.placar[1]}`;
  $('#vivo-min').textContent = `${l.min}'`;
  $('#vivo-prog').style.width = Math.min(100, l.min / 0.9) + '%';
  const tk = $('#vivo-ticker'); tk.textContent = l.txt; tk.className = `ticker t${l.t} ${l.tipo}`;
  if (l.tipo === 'gol') {
    const ov = $('#vivo-gol'); ov.hidden = false; ov.querySelector('span').textContent = (V.P.times[l.t].xi.find(j => j.id === l.j) || {}).curto || '';
    setTimeout(() => { ov.hidden = true; }, 1900 / V.vel);
  }
  if (NOTAVEIS.has(l.tipo)) {
    V.historico.unshift(l);
    $('#vivo-lances').insertAdjacentHTML('afterbegin', lanceHtml(l));
    if (['gol', 'amarelo', 'vermelho', 'lesao', 'sub'].includes(l.tipo)) $('#vivo-esc').innerHTML = escalacoesHtml(V);
  }
  if (l.min !== V.minStats) { V.minStats = l.min; $('#vivo-stats').innerHTML = statsHtml(V); const o = $('#vivo-outros'); if (o) o.innerHTML = outrosHtml(V); }
  if (V.k === 1) SOM.inicio();
  ({ gol: SOM.gol, defesa: SOM.chance, fora: SOM.chance, golAnulado: SOM.chance, falta: SOM.falta, amarelo: SOM.cartao, vermelho: SOM.cartao, intervalo: SOM.intervalo, fim: SOM.fim }[l.tipo] || (() => { }))();
}

// o campinho anima sem parar; quando o lance atual termina, entra o próximo
function proximo(V) {
  if (!V.fila.length) {
    if (acabou(V.P)) return encerrar(V);
    V.fila.push(...passo(V.P));
    if (!V.fila.length) { V.min = V.P.min; H.$('#vivo-min').textContent = `${V.min}'`; V.cp.espera = 0.09; return; }
  }
  const l = V.fila.shift(); V.k++;
  Campinho.lance(V.cp, V.P, l, V.fila[0]);
  mostrar(V, l);
}

function loop(V, ts) {
  const cv = document.getElementById('vivo-cv');
  if (H.app.vivo !== V || !cv) return;
  const dt = Math.min(0.05, (ts - (V.ts ?? ts)) / 1000); V.ts = ts;
  if (!V.pausado && !V.painel) {
    Campinho.atualizar(V.cp, V.P, dt * V.vel);
    if (!V.fim && Campinho.pronto(V.cp)) proximo(V);
  }
  Campinho.desenhar(cv, V.cp, V.cores);
  V.raf = requestAnimationFrame(t => loop(V, t));
}

function encerrar(V) {
  V.fim = true; V.placar = V.P.gols.slice(); V.min = V.P.min;
  Campinho.encerrar(V.cp, V.P);
  const { $ } = H;
  if ($('#vivo-gols')) {
    $('#vivo-gols').textContent = `${V.placar[0]}:${V.placar[1]}`; $('#vivo-min').textContent = 'Fim'; $('#vivo-prog').style.width = '100%';
    const tk = $('#vivo-ticker'); tk.textContent = 'Fim de jogo!'; tk.className = 'ticker fim';
    $('#vivo-fim').innerHTML = fimHtml(V); $('#vivo-stats').innerHTML = statsHtml(V); $('#vivo-esc').innerHTML = escalacoesHtml(V); const o = $('#vivo-outros'); if (o) o.innerHTML = outrosHtml(V);
    $('[data-acao=vivo-painel]')?.setAttribute('disabled', '');
  }
}

// chamado depois que a tela foi desenhada
export function comecar(V) { cancelAnimationFrame(V.raf); V.ts = null; V.raf = requestAnimationFrame(t => loop(V, t)); }

// joga o resto do jogo na hora
export function pular(V) { V.fila = []; while (!acabou(V.P)) passo(V.P); encerrar(V); }

export const resultadoFinal = V => resultado(V.P);

export const acoes = {
  'vivo-vel': el => { const V = H.app.vivo; V.vel = +el.dataset.v; try { localStorage.setItem('fig.vel', V.vel); } catch { } for (const b of document.querySelectorAll('[data-acao=vivo-vel]')) b.setAttribute('aria-pressed', b === el); },
  'vivo-pausa': el => { const V = H.app.vivo; V.pausado = !V.pausado; el.textContent = V.pausado ? 'Seguir' : 'Pausar'; },
  'vivo-pular': () => pular(H.app.vivo),
  'vivo-som': el => el.setAttribute('aria-pressed', alternarSom()),
  'vivo-painel': () => { const V = H.app.vivo; V.painel = !V.painel; V.sel = null; H.$('#vivo-painel').innerHTML = V.painel ? painelHtml(V) : ''; if (V.painel) H.$('#vivo-painel').scrollIntoView({ block: 'nearest' }); },
  'vivo-sai': el => { const V = H.app.vivo; V.sel = +el.dataset.id; H.$('#vivo-painel').innerHTML = painelHtml(V); },
  'vivo-entra': el => {
    const V = H.app.vivo;
    if (substituir(V.P, V.humano, V.sel, +el.dataset.id)) { const l = V.P.lances[V.P.lances.length - 1]; V.sel = null; mostrar(V, { ...l, x: V.ult?.x ?? 50, y: V.ult?.y ?? 50 }); }
    H.$('#vivo-painel').innerHTML = painelHtml(V);
    H.$('[data-acao=vivo-painel]').textContent = `Mexer no time (${5 - V.P.subs[V.humano]} trocas)`;
  },
  'vivo-estilo': el => { const V = H.app.vivo; trocarEstilo(V.P, V.humano, el.dataset.e); H.$('#vivo-painel').innerHTML = painelHtml(V); },
  'vivo-esquema': el => { const V = H.app.vivo; trocarEsquema(V.P, V.humano, el.dataset.f); H.$('#vivo-painel').innerHTML = painelHtml(V); H.$('#vivo-esc').innerHTML = escalacoesHtml(V); },
};
