// Partida ao vivo: campinho com os botões se mexendo, narração, placar, estatísticas e substituições.
import { criarPartida, passo, acabou, resultado, substituir, trocarEsquema, FORMACOES, COORD_Y } from './motor/partida.js';
import { clamp } from './motor/util.js';

let H; // utilidades da interface (app, clube, esc, imgEscudo, $)
export const configurar = h => { H = h; };

// profundidade de cada vaga no campo (0 = própria meta, 1 = meta adversária)
const PROF = { GOL: 0.04, ZAG: 0.2, LD: 0.27, LE: 0.27, VOL: 0.36, MC: 0.42, ME: 0.45, MD: 0.45, MEI: 0.5, PE: 0.6, PD: 0.6, SA: 0.6, CA: 0.66 };
const NOTAVEIS = new Set(['gol', 'defesa', 'fora', 'falta', 'amarelo', 'vermelho', 'sub', 'impedimento', 'escanteio', 'intervalo', 'fim']);
const ICONE = { gol: '⚽', defesa: '🧤', fora: '↗', falta: '✋', amarelo: '🟨', vermelho: '🟥', sub: '⇄', impedimento: '🚩', escanteio: '⛳', intervalo: '⏸', fim: '🏁' };
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

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
  const { th, ta, seed, humano } = R.meu;
  let vel = 1; try { vel = +localStorage.getItem('fig.vel') || 1; } catch { }
  return { R, P: criarPartida(th, ta, seed, { narrar: true, humano }), humano, fila: [], vel, pausado: false, painel: false, fim: false, k: 0, placar: [0, 0], min: 0, ult: null, timer: null, sel: null, historico: [] };
}

// ---------- posições dos botões a partir da bola ----------
function posicoes(V, l) {
  const P = V.P, out = [];
  for (const t of [0, 1]) {
    const time = P.times[t], slots = FORMACOES[time.formacao], cy = COORD_Y[time.formacao];
    const pb = l ? (t === 0 ? l.x : 100 - l.x) / 100 : 0.5, lb = l ? (t === 0 ? l.y : 100 - l.y) : 50;
    time.xi.forEach((j, i) => {
      if (!j || P.expulsos[t].has(j.id)) return;
      const gk = slots[i] === 'GOL';
      let d = PROF[slots[i]] ?? 0.4, lat = cy[i];
      if (!gk) { d = clamp(d + (pb - 0.5) * 0.42 + (hash(j.id + ':' + V.k) - 0.5) * 0.04, 0.06, 0.93); lat = clamp(lat + (lb - 50) * 0.22 + (hash(V.k + ':' + j.id) - 0.5) * 5, 4, 96); }
      else lat = clamp(50 + (lb - 50) * 0.12, 38, 62);
      let x = t === 0 ? d * 100 : 100 - d * 100, y = t === 0 ? lat : 100 - lat;
      if (l && l.j === j.id) { x = l.x; y = l.y; }
      out.push({ j, t, x: clamp(x, 1.5, 98.5), y: clamp(y, 3, 97), gk });
    });
  }
  return out;
}

// ---------- tela ----------
export function tela(V) {
  const { app, clube, esc, imgEscudo } = H, m = V.R.meu, cs = cores(clube(m.h), clube(m.a));
  V.cores = cs;
  return `<div class="vivo" style="--c0:${cs[0].fundo};--a0:${cs[0].anel};--t0:${cs[0].txt};--b0:${cs[0].barra};--c1:${cs[1].fundo};--a1:${cs[1].anel};--t1:${cs[1].txt};--b1:${cs[1].barra}">
    <div class="vivo-barra"><span class="tag-comp">Série ${m.d} · ${V.R.rd + 1}ª rodada</span>
      <div class="chips">${[1, 2, 4].map(v => `<button class="chip" type="button" data-acao="vivo-vel" data-v="${v}" aria-pressed="${V.vel === v}">${v}×</button>`).join('')}
        <button class="chip" type="button" data-acao="vivo-pausa" id="vivo-pausa">${V.pausado ? 'Seguir' : 'Pausar'}</button>
        <button class="chip" type="button" data-acao="vivo-pular" id="vivo-pular">Pular</button></div></div>
    <section class="placar vivo-placar" id="vivo-placar">
      <div class="lado">${imgEscudo(m.h, 56, 61)}<span>${esc(clube(m.h).n)}</span></div>
      <div class="meio-placar"><span class="gols" id="vivo-gols">${V.placar[0]}:${V.placar[1]}</span><span class="minuto" id="vivo-min">${V.min}'</span></div>
      <div class="lado">${imgEscudo(m.a, 56, 61)}<span>${esc(clube(m.a).n)}</span></div>
      <div class="progresso"><b id="vivo-prog" style="width:${V.min / 0.9}%"></b></div>
      <div class="gooool" id="vivo-gol" hidden><strong>GOOOL!</strong><span></span></div>
    </section>
    <div class="campo-h" id="vivo-campo"><span class="meio-h"></span><span class="roda-h"></span><span class="area-h e"></span><span class="area-h d"></span><span class="peq-h e"></span><span class="peq-h d"></span><span class="bola" id="vivo-bola"></span><span class="etiqueta" id="vivo-etq"></span></div>
    <div class="ticker" id="vivo-ticker" role="status" aria-live="polite">${V.ult ? esc(V.ult.txt) : 'Bola rolando…'}</div>
    <div id="vivo-fim">${V.fim ? fimHtml(V) : ''}</div>
    <div class="linha-botoes"><button class="botao sec" type="button" data-acao="vivo-painel" ${V.fim ? 'disabled' : ''}>Mexer no time (${5 - V.P.subs[V.humano]} trocas)</button></div>
    <div id="vivo-painel">${V.painel ? painelHtml(V) : ''}</div>
    <section class="cartao stats" id="vivo-stats">${statsHtml(V)}</section>
    <section class="cartao" id="vivo-esc">${escalacoesHtml(V)}</section>
    <section class="cartao"><h3>Lance a lance</h3><ol class="lances-vivo" id="vivo-lances">${V.historico.map(lanceHtml).join('')}</ol></section>
  </div>`;
}

function lanceHtml(l) {
  return `<li class="t${l.t} ${l.tipo}"><span class="min">${l.min}'</span><span class="ico" aria-hidden="true">${ICONE[l.tipo] || ''}</span><span>${H.esc(l.txt)}</span></li>`;
}

function statsHtml(V) {
  const st = V.P.st, tot = (st[0].posse + st[1].posse) || 1;
  const linha = (rot, a, b, fmt = x => x) => { const t = (a + b) || 1; return `<div class="stat"><span class="v">${fmt(a)}</span><div class="barra">${rot}<div><b style="width:${a / t * 100}%;background:var(--b0)"></b><b style="width:${b / t * 100}%;background:var(--b1)"></b></div></div><span class="v">${fmt(b)}</span></div>`; };
  return `<h3>Estatísticas</h3>${linha('Posse', Math.round(st[0].posse / tot * 100), Math.round(st[1].posse / tot * 100), x => x + '%')}${linha('Finalizações', st[0].chutes, st[1].chutes)}${linha('No alvo', st[0].noAlvo, st[1].noAlvo)}${linha('Gols esperados', st[0].xg, st[1].xg, x => x.toFixed(1).replace('.', ','))}${linha('Faltas', st[0].faltas, st[1].faltas)}${linha('Cartões', st[0].amarelos + st[0].vermelhos, st[1].amarelos + st[1].vermelhos)}`;
}

function escalacoesHtml(V) {
  const { clube, esc } = H, P = V.P, m = V.R.meu;
  const marcas = (t, id) => P.ev.filter(e => e.time === t && (e.jogador === id || e.sai === id)).map(e => e.tipo === 'gol' && e.jogador === id ? '⚽' : e.tipo === 'amarelo' ? '🟨' : e.tipo === 'vermelho' ? '🟥' : e.tipo === 'sub' ? (e.sai === id ? '↓' : '↑') : '').join('');
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
    <p class="dica">${V.sel ? `Quem entra no lugar de <b>${esc(time.xi.find(j => j.id === V.sel)?.curto || '')}</b>?` : 'Toque em quem vai sair.'}</p>
    <div class="painel-listas"><div><p class="esc-titulo">Em campo</p><ul>${time.xi.map((j, i) => P.expulsos[t].has(j.id) ? '' : `<li><button type="button" class="linha-jog ${V.sel === j.id ? 'sel' : ''}" data-acao="vivo-sai" data-id="${j.id}"><span class="slot">${slots[i]}</span><span class="nm">${esc(j.curto)}</span><span class="nota-mini">${(P.notas[t].get(j.id) || 6).toFixed(1).replace('.', ',')}</span></button></li>`).join('')}</ul></div>
      <div><p class="esc-titulo">Banco</p><ul>${time.banco.map(j => `<li><button type="button" class="linha-jog" data-acao="vivo-entra" data-id="${j.id}" ${!V.sel || !resta ? 'disabled' : ''}><span class="slot">${j.pos}</span><span class="nm">${esc(j.curto)}</span><span class="nota-mini">${j.ovr}</span></button></li>`).join('') || '<li class="mudo">Ninguém no banco</li>'}</ul></div></div>
    <button class="botao" type="button" data-acao="vivo-painel">Voltar ao jogo</button></section>`;
}

function fimHtml(V) {
  const g = V.P.gols, eu = V.humano, res = g[0] === g[1] ? 'Empate' : (g[eu] > g[1 - eu] ? 'Vitória' : 'Derrota');
  return `<section class="resultado-vivo ${res.toLowerCase()}"><strong>${res}</strong><button class="botao" type="button" data-acao="vivo-fim">Continuar</button></section>`;
}

// ---------- atualização sem redesenhar a tela ----------
function desenharCampo(V, l) {
  const { $ } = H, campo = $('#vivo-campo'); if (!campo) return;
  const pos = posicoes(V, l), vistos = new Set();
  for (const p of pos) {
    vistos.add(String(p.j.id));
    let el = campo.querySelector(`.bt[data-id="${p.j.id}"]`);
    if (!el) { el = document.createElement('span'); el.className = `bt t${p.t}${p.gk ? ' gk' : ''}`; el.dataset.id = p.j.id; el.textContent = p.j.num || ''; el.title = p.j.curto; campo.appendChild(el); }
    el.style.left = p.x + '%'; el.style.top = p.y + '%';
  }
  for (const el of campo.querySelectorAll('.bt')) if (!vistos.has(el.dataset.id)) el.remove();
  const bola = $('#vivo-bola'), etq = $('#vivo-etq');
  const bx = l ? l.x : 50, by = l ? l.y : 50;
  bola.style.left = clamp(bx + (l?.j ? 1.2 : 0), 0.5, 99.5) + '%'; bola.style.top = clamp(by + (l?.j ? 2 : 0), 1, 99) + '%';
  const dono = l?.j ? pos.find(p => p.j.id === l.j) : null;
  etq.hidden = !dono; if (dono) { etq.textContent = dono.j.curto; etq.style.left = dono.x + '%'; etq.style.top = dono.y + '%'; }
}

function mostrar(V, l) {
  const { $, esc } = H;
  V.ult = l; V.min = l.min;
  if (l.tipo === 'gol') V.placar = l.placar;
  campoDur(V);
  desenharCampo(V, l);
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
    if (['gol', 'amarelo', 'vermelho', 'sub'].includes(l.tipo)) $('#vivo-esc').innerHTML = escalacoesHtml(V);
  }
  if (l.min !== V.minStats) { V.minStats = l.min; $('#vivo-stats').innerHTML = statsHtml(V); }
}

const campoDur = V => { const c = H.$('#vivo-campo'); if (c) c.style.setProperty('--dur', `${Math.round(560 / V.vel)}ms`); };

function tick(V) {
  clearTimeout(V.timer);
  if (H.app.vivo !== V || V.fim) return;
  if (V.pausado || V.painel) { V.timer = setTimeout(() => tick(V), 250); return; }
  if (!V.fila.length) {
    if (acabou(V.P)) return encerrar(V);
    V.fila.push(...passo(V.P));
    if (!V.fila.length) { V.min = V.P.min; H.$('#vivo-min').textContent = `${V.min}'`; V.timer = setTimeout(() => tick(V), 90 / V.vel); return; }
  }
  const l = V.fila.shift(); V.k++;
  mostrar(V, l);
  const base = l.tipo === 'gol' ? 2200 : ['defesa', 'fora', 'vermelho', 'intervalo', 'sub'].includes(l.tipo) ? 1000 : 520;
  V.timer = setTimeout(() => tick(V), base / V.vel);
}

function encerrar(V) {
  V.fim = true; V.placar = V.P.gols.slice(); V.min = V.P.min;
  const { $ } = H;
  if ($('#vivo-gols')) {
    $('#vivo-gols').textContent = `${V.placar[0]}:${V.placar[1]}`; $('#vivo-min').textContent = 'Fim'; $('#vivo-prog').style.width = '100%';
    const tk = $('#vivo-ticker'); tk.textContent = 'Fim de jogo!'; tk.className = 'ticker fim';
    $('#vivo-fim').innerHTML = fimHtml(V); $('#vivo-stats').innerHTML = statsHtml(V); $('#vivo-esc').innerHTML = escalacoesHtml(V);
    $('[data-acao=vivo-painel]')?.setAttribute('disabled', '');
  }
}

// chamado depois que a tela foi desenhada
export function comecar(V) { campoDur(V); desenharCampo(V, V.ult); if (V.fim) return; tick(V); }

// joga o resto do jogo na hora
export function pular(V) { clearTimeout(V.timer); V.fila = []; while (!acabou(V.P)) passo(V.P); encerrar(V); }

export const resultadoFinal = V => resultado(V.P);

export const acoes = {
  'vivo-vel': el => { const V = H.app.vivo; V.vel = +el.dataset.v; try { localStorage.setItem('fig.vel', V.vel); } catch { } for (const b of document.querySelectorAll('[data-acao=vivo-vel]')) b.setAttribute('aria-pressed', b === el); campoDur(V); },
  'vivo-pausa': el => { const V = H.app.vivo; V.pausado = !V.pausado; el.textContent = V.pausado ? 'Seguir' : 'Pausar'; },
  'vivo-pular': () => pular(H.app.vivo),
  'vivo-painel': () => { const V = H.app.vivo; V.painel = !V.painel; V.sel = null; H.$('#vivo-painel').innerHTML = V.painel ? painelHtml(V) : ''; if (V.painel) H.$('#vivo-painel').scrollIntoView({ block: 'nearest' }); },
  'vivo-sai': el => { const V = H.app.vivo; V.sel = +el.dataset.id; H.$('#vivo-painel').innerHTML = painelHtml(V); },
  'vivo-entra': el => {
    const V = H.app.vivo;
    if (substituir(V.P, V.humano, V.sel, +el.dataset.id)) { const l = V.P.lances[V.P.lances.length - 1]; V.sel = null; mostrar(V, { ...l, x: V.ult?.x ?? 50, y: V.ult?.y ?? 50 }); }
    H.$('#vivo-painel').innerHTML = painelHtml(V);
    H.$('[data-acao=vivo-painel]').textContent = `Mexer no time (${5 - V.P.subs[V.humano]} trocas)`;
  },
  'vivo-esquema': el => { const V = H.app.vivo; trocarEsquema(V.P, V.humano, el.dataset.f); H.$('#vivo-painel').innerHTML = painelHtml(V); H.$('#vivo-esc').innerHTML = escalacoesHtml(V); desenharCampo(V, V.ult); },
};
