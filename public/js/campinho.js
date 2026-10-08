// Campinho ao vivo em canvas. Os botões correm o tempo todo atrás de um alvo (a forma do time
// empurrada pela bola); cada lance do motor vira um passe, chute ou parada com a bola viajando de verdade.
// Coordenadas do campo: x 0→100 no comprimento (o mandante ataca para a direita), y 0→100 na largura.
import { posicoesDe } from './motor/partida.js';
import { clamp } from './motor/util.js';

// profundidade de cada vaga (0 = própria meta, 1 = meta adversária)
const PROF = { GOL: 0.04, ZAG: 0.2, LD: 0.27, LE: 0.27, VOL: 0.36, MC: 0.42, ME: 0.45, MD: 0.45, MEI: 0.5, PE: 0.6, PD: 0.6, SA: 0.6, CA: 0.66 };
const K = 68 / 105;              // na tela, uma unidade de largura vale menos que uma de comprimento
const V_BOLA = 75, V_JOG = 17;   // unidades de campo por segundo (no 1×)
const GK_COR = ['#F2B33D', '#5ED6CF'];
const hashN = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * K);
const lado = t => t === 0 ? 1 : -1;  // para onde o time ataca

export const criar = () => ({ sp: new Map(), bola: { x: 50, y: 50, z: 0 }, dono: null, voo: null, espera: 0, cond: null, limite: 0, passos: [], forca: new Map(), clock: 0, posse: 0, saida: true, marcas: [], flash: null });

// ---------- elenco em campo ----------
function sync(cp, P) {
  const vivos = new Set(), novo = !cp.sp.size;
  for (const t of [0, 1]) {
    const T = P.times[t], f = T.formacao, slots = T.slots, pos = posicoesDe(f, T.pers);
    P.times[t].xi.forEach((j, i) => {
      if (!j || P.expulsos[t].has(j.id)) return;
      vivos.add(j.id);
      let s = cp.sp.get(j.id);
      if (!s) { s = { id: j.id, t, x: 50, y: 104, vx: 0, vy: 0, h: hashN(j.id) }; cp.sp.set(j.id, s); }
      Object.assign(s, { f, i, slot: slots[i], lat: pos[i]?.[1] ?? 50, gk: slots[i] === 'GOL', num: j.num || '', nome: j.curto, sai: false });
    });
  }
  for (const s of cp.sp.values()) if (!vivos.has(s.id) && !s.sai) { s.sai = true; if (cp.dono === s.id) cp.dono = null; }
  if (novo) { alvos(cp); for (const s of cp.sp.values()) { s.x = s.tx; s.y = s.ty; } }
}

// ---------- para onde cada um quer ir ----------
function alvos(cp) {
  const b = cp.bola;
  for (const s of cp.sp.values()) {
    s.mult = 1;
    if (s.sai) { s.tx = s.x; s.ty = 106; s.mult = 0.7; continue; }
    const t = s.t, ataca = cp.posse === t, bf = t === 0 ? b.x : 100 - b.x, by = t === 0 ? b.y : 100 - b.y;
    const casa = PROF[s.slot] ?? 0.4, lat0 = s.lat ?? 50;
    let d, lat;
    if (s.gk) { d = 0.03 + (ataca ? clamp((bf - 50) / 100, 0, 0.5) * 0.14 : 0); lat = clamp(50 + (by - 50) * 0.3, 42, 58); }
    else if (cp.saida) { d = Math.min(casa, 0.47); lat = lat0; }
    else {
      d = casa + (bf / 100 - 0.5) * 0.45 + (ataca ? 0.09 : -0.03) + Math.sin(cp.clock * 0.9 + s.h * 7) * 0.012;
      lat = lat0 + (by - 50) * 0.25 + Math.cos(cp.clock * 0.7 + s.h * 5) * 1.6;
      d = clamp(d, 0.05, 0.95); lat = clamp(lat, 3, 97);
    }
    s.tx = t === 0 ? d * 100 : 100 - d * 100; s.ty = t === 0 ? lat : 100 - lat;
  }
  // quem defende manda o mais perto na bola
  if (!cp.saida && !cp.voo) {
    const o = 1 - cp.posse; let m = null, md = 1e9;
    for (const s of cp.sp.values()) if (s.t === o && !s.gk && !s.sai) { const d = dist(s, b); if (d < md) { md = d; m = s; } }
    if (m) { m.tx = b.x - lado(o) * 2.6; m.ty = b.y; m.mult = 1.25; }
  }
  // quem tem a bola conduz devagar
  const dono = cp.dono != null && cp.sp.get(cp.dono);
  if (dono && !dono.gk) { dono.tx = cp.conducao?.x ?? dono.x + lado(dono.t) * 2; dono.ty = cp.conducao?.y ?? dono.ty; dono.mult = 0.55; }
  for (const [id, a] of cp.forca) { const s = cp.sp.get(id); if (s) { s.tx = a.x; s.ty = a.y; s.mult = a.mult; } }
  // ninguém em cima do companheiro
  const lista = [...cp.sp.values()].filter(s => !s.gk && !s.sai);
  for (let i = 0; i < lista.length; i++) for (let k = i + 1; k < lista.length; k++) {
    const a = lista[i], c = lista[k]; if (a.t !== c.t) continue;
    const dx = a.tx - c.tx, dy = (a.ty - c.ty) * K, d = Math.hypot(dx, dy);
    if (d < 6.5 && d > 0.01) { const p = (6.5 - d) / 2 / d; a.tx += dx * p; a.ty += dy * p / K; c.tx -= dx * p; c.ty -= dy * p / K; }
  }
}

function mover(cp, dt) {
  const a = Math.min(1, dt * 6);
  for (const s of [...cp.sp.values()]) {
    const dx = s.tx - s.x, dy = (s.ty - s.y) * K, d = Math.hypot(dx, dy) || 1e-6;
    const quer = Math.min(V_JOG * s.mult, d * 3);
    s.vx += (dx / d * quer - s.vx) * a; s.vy += (dy / d * quer - s.vy) * a;
    s.x += s.vx * dt; s.y += s.vy * dt / K;
    if (s.sai && (s.y > 104 || s.y < -4)) cp.sp.delete(s.id);
  }
}

// ---------- bola ----------
function voar(cp, x, y, { rec = null, chute = false, rapido = 1, fim } = {}) {
  const b = cp.bola, d = Math.hypot(x - b.x, (y - b.y) * K);
  cp.dono = null; cp.conducao = null;
  cp.voo = { x0: b.x, y0: b.y, x1: x, y1: y, p: 0, dur: clamp(d / (chute ? 130 : V_BOLA), chute ? 0.18 : 0.2, 0.95) / rapido, alto: !chute && d > 36 ? d * 0.06 : 0, chute, rec, fim };
  if (rec != null) cp.forca.set(rec, { x, y, mult: 1.5 });
}

function bola(cp, dt) {
  const b = cp.bola, v = cp.voo;
  if (v) {
    v.p = Math.min(1, v.p + dt / v.dur);
    const e = v.chute ? v.p : 1 - (1 - v.p) ** 2;
    b.x = v.x0 + (v.x1 - v.x0) * e; b.y = v.y0 + (v.y1 - v.y0) * e; b.z = v.alto ? Math.sin(Math.PI * v.p) * v.alto : 0;
    if (v.p >= 1) {
      cp.voo = null;
      if (v.rec != null) { cp.forca.delete(v.rec); if (cp.sp.has(v.rec)) cp.dono = v.rec; }
      v.fim?.();
    }
    return;
  }
  const s = cp.dono != null && cp.sp.get(cp.dono);
  if (!s) return;
  const k = Math.min(1, dt * 14);
  b.x += (s.x + lado(s.t) * 1.3 - b.x) * k; b.y += (s.y + 1 - b.y) * k; b.z = 0;
}

// ---------- roteiro de cada lance ----------
const seq = (cp, ...fns) => cp.passos.push(...fns);
const goleiro = (cp, t) => [...cp.sp.values()].find(s => s.t === t && s.gk && !s.sai);
const marca = (cp, m) => cp.marcas.push({ ...m, ate: cp.clock + (m.dur || 1.6) });

function chute(cp, l, tipo, prox) {
  const canto = tipo !== 'gol' && prox?.tipo === 'escanteio';
  const t = l.t, o = 1 - t, linha = t === 0 ? 100 : 0, b = cp.bola;
  const autor = cp.sp.get(l.j), gk = goleiro(cp, o);
  seq(cp,
    // quem vai bater chega na bola
    () => { if (autor && cp.dono !== autor.id && dist(autor, b) > 2.5) { cp.dono = null; cp.forca.set(autor.id, { x: b.x - lado(t) * 1.5, y: b.y, mult: 1.6 }); cp.cond = () => dist(autor, b) < 3; cp.limite = 1.2; } },
    () => {
      if (autor) cp.forca.delete(autor.id);
      const gy = tipo === 'fora' ? 50 + (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 7) : 50 + (Math.random() - 0.5) * 8;
      const gx = tipo === 'defesa' ? linha - lado(t) * 2.5 : linha + lado(t) * 2; // 'anulado' entra no gol como um gol
      // o goleiro voa: na defesa ele chega, no gol ele erra o canto
      if (gk) cp.forca.set(gk.id, { x: linha - lado(t) * 2.5, y: tipo === 'defesa' ? gy : gy + (gy > 50 ? -4 : 4), mult: 2.4 });
      voar(cp, gx, gy, { chute: true, fim: () => {
        if (gk) cp.forca.delete(gk.id);
        if (tipo === 'anulado') { cp.posse = o; seq(cp, () => { cp.espera = 0.6; }, () => { if (gk) voar(cp, gk.x, gk.y, { rec: gk.id, rapido: 1.4, fim: () => { cp.espera = 0.3; } }); }); }
        else if (tipo === 'gol') {
          cp.flash = { x: linha, ate: cp.clock + 1.3 }; cp.posse = o;
          // o autor corre comemorar na bandeirinha
          if (autor) cp.forca.set(autor.id, { x: linha - lado(t) * 3, y: autor.y < 50 ? 4 : 96, mult: 1.3 });
          seq(cp, () => { cp.espera = 1.6; }, () => { if (autor) cp.forca.delete(autor.id); recomecar(cp, o); });
        }
        else if (canto) cp.espera = 0.3; // espalmou ou desviou: o escanteio vem a seguir
        else if (tipo === 'defesa') { if (gk) cp.dono = gk.id; cp.posse = o; cp.espera = 0.6; }
        else { cp.posse = o; seq(cp, () => { cp.espera = 0.5; }, () => { if (gk) voar(cp, gk.x, gk.y, { rec: gk.id, rapido: 1.4, fim: () => { cp.espera = 0.3; } }); }); }
      } });
    });
}

function recomecar(cp, t) {
  cp.saida = true; cp.posse = t;
  voar(cp, 50, 50, { rapido: 0.8, fim: () => { cp.espera = 0.8; } });
}

export function lance(cp, P, l, prox) {
  sync(cp, P);
  const b = cp.bola, s = l.j != null ? cp.sp.get(l.j) : null;
  switch (l.tipo) {
    case 'gol': case 'defesa': case 'fora': return chute(cp, l, l.tipo, prox);
    case 'golAnulado': return chute(cp, l, 'anulado', prox);
    case 'var': marca(cp, { tipo: 'var', x: 50, y: 50, dur: 1.6 }); cp.espera = 1.3; return;
    case 'escanteio': {
      const x = l.t === 0 ? 99.6 : 0.4, y = b.y < 50 ? 0.6 : 99.4;
      const quem = [...cp.sp.values()].filter(q => q.t === l.t && !q.gk && !q.sai).sort((a, c) => dist(a, { x, y }) - dist(c, { x, y }))[0];
      cp.posse = l.t; voar(cp, x, y, { rec: quem?.id ?? null, rapido: 0.9, fim: () => { cp.espera = 0.5; } });
      return;
    }
    case 'falta': {
      cp.dono = null; cp.conducao = null; marca(cp, { tipo: 'apito', x: b.x, y: b.y, dur: 0.9 });
      if (/^Pênalti/.test(l.txt)) { const px = l.t === 0 ? 10.5 : 89.5; cp.posse = 1 - l.t; voar(cp, px, 50, { rapido: 0.9, fim: () => { cp.espera = 0.9; } }); }
      else { if (s) cp.forca.set(s.id, { x: b.x, y: b.y + 2, mult: 1.3 }); cp.espera = 0.7; seq(cp, () => { if (s) cp.forca.delete(s.id); }); }
      return;
    }
    case 'amarelo': case 'vermelho': marca(cp, { tipo: l.tipo, id: l.j }); cp.espera = 0.9; return;
    case 'lesao': cp.dono = null; cp.conducao = null; marca(cp, { tipo: 'lesao', id: l.j, dur: 2 }); cp.espera = 1.1; return;
    case 'impedimento': cp.dono = null; cp.conducao = null; marca(cp, { tipo: 'bandeira', x: b.x }); cp.posse = 1 - l.t; cp.espera = 0.7; return;
    case 'intervalo': return recomecar(cp, 1 - l.t);
    case 'fim': cp.saida = true; cp.dono = null; voar(cp, 50, 50, { rapido: 0.6 }); return;
    case 'sub': case 'tatica': return;
  }
  // passe, lançamento ou roubada: a bola vai até o ponto do lance e o jogador corre pra ela
  const roubada = cp.posse !== l.t;
  cp.saida = false; cp.posse = l.t;
  if (s && cp.dono === s.id) { cp.conducao = { x: l.x, y: l.y }; cp.espera = clamp(dist(s, l) / (V_JOG * 0.55), 0.25, 1); return; }
  voar(cp, l.x, l.y, { rec: s?.id ?? null, rapido: roubada ? 1.3 : 1, fim: () => { cp.espera = 0.12 + Math.random() * 0.22; } });
}

// fim de jogo sem animar o resto
export function encerrar(cp, P) { sync(cp, P); cp.passos = []; cp.cond = null; cp.forca.clear(); cp.saida = true; voar(cp, 50, 50, { rapido: 0.6 }); }

export const pronto = cp => !cp.voo && cp.espera <= 0 && !cp.cond && !cp.passos.length;

export function atualizar(cp, P, dt) {
  cp.clock += dt;
  sync(cp, P);
  if (!cp.voo) {
    if (cp.espera > 0) cp.espera -= dt;
    else if (cp.cond) { cp.limite -= dt; if (cp.cond() || cp.limite <= 0) cp.cond = null; }
    else if (cp.passos.length) cp.passos.shift()();
  }
  alvos(cp); mover(cp, dt); bola(cp, dt);
  cp.marcas = cp.marcas.filter(m => m.ate > cp.clock);
}

// ---------- desenho ----------
export function desenhar(cv, cp, cores) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
  if (!cw) return;
  if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const fonte = cv._f || (cv._f = (st => ({ corpo: st.getPropertyValue('--f-corpo') || 'sans-serif', g1: st.getPropertyValue('--gramado').trim() || '#3E8A3A', g2: st.getPropertyValue('--gramado-2').trim() || '#4A9A44' }))(getComputedStyle(cv)));
  const mx = W * 0.03, my = H * 0.03, fx = x => mx + x / 100 * (W - 2 * mx), fy = y => my + y / 100 * (H - 2 * my);
  // gramado listrado e linhas
  for (let i = 0; i < 11; i++) { ctx.fillStyle = i % 2 ? fonte.g2 : fonte.g1; ctx.fillRect(Math.floor(i * W / 11), 0, Math.ceil(W / 11) + 1, H); }
  const lw = Math.max(1.5, W / 300);
  ctx.strokeStyle = 'rgba(232,240,222,.8)'; ctx.lineWidth = lw;
  ctx.strokeRect(fx(0), fy(0), fx(100) - fx(0), fy(100) - fy(0));
  ctx.beginPath(); ctx.moveTo(fx(50), fy(0)); ctx.lineTo(fx(50), fy(100)); ctx.stroke();
  ctx.beginPath(); ctx.arc(fx(50), fy(50), H * 0.13, 0, Math.PI * 2); ctx.stroke();
  for (const e of [0, 1]) {
    const x0 = e ? 100 : 0, s = e ? -1 : 1;
    ctx.strokeRect(fx(x0), fy(20.2), fx(16 * s) - fx(0), fy(79.8) - fy(20.2));
    ctx.strokeRect(fx(x0), fy(36.2), fx(5.85 * s) - fx(0), fy(63.8) - fy(36.2));
    ctx.fillStyle = 'rgba(232,240,222,.8)'; ctx.beginPath(); ctx.arc(fx(x0 + 10.5 * s), fy(50), lw * 1.2, 0, Math.PI * 2); ctx.fill();
    // gol com rede
    const gx = e ? fx(100) : fx(0) - mx * 0.8, gw = mx * 0.8;
    const brilho = cp.flash && cp.flash.x === x0 && cp.flash.ate > cp.clock;
    ctx.fillStyle = brilho ? `rgba(255,255,255,${0.45 + 0.4 * Math.sin(cp.clock * 18)})` : 'rgba(255,255,255,.18)';
    ctx.fillRect(gx, fy(44.6), gw, fy(55.4) - fy(44.6));
    ctx.strokeStyle = '#E8F0DE'; ctx.strokeRect(gx, fy(44.6), gw, fy(55.4) - fy(44.6));
    ctx.strokeStyle = 'rgba(232,240,222,.8)';
  }
  ctx.beginPath(); ctx.arc(fx(50), fy(50), lw * 1.2, 0, Math.PI * 2); ctx.fill();

  const r = clamp(cw * 0.024, 8, 13) * dpr;
  const lista = [...cp.sp.values()].sort((a, b) => a.y - b.y);
  // sombras
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  for (const s of lista) { ctx.beginPath(); ctx.ellipse(fx(s.x), fy(s.y) + r * 0.45, r * 0.95, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const s of lista) {
    const c = cores[s.t], x = fx(s.x), y = fy(s.y);
    ctx.globalAlpha = s.sai ? 0.5 : 1;
    ctx.fillStyle = s.gk ? GK_COR[s.t] : c.fundo; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = r * 0.24; ctx.strokeStyle = s.gk ? '#1B1F2A' : c.anel; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = s.gk ? '#1B1F2A' : c.txt; ctx.font = `700 ${Math.round(r * 1.05)}px ${fonte.corpo}`; ctx.fillText(s.num, x, y + r * 0.06);
  }
  ctx.globalAlpha = 1;
  // bola (sombra no chão, bola no alto quando é lançamento)
  const b = cp.bola, bx = fx(b.x), by = fy(b.y), br = r * 0.42;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(bx, by + br * 0.6, br, br * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  const bz = by - b.z * H / 100;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, bz, br * (1 + b.z * 0.03), 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = Math.max(1, br * 0.35); ctx.strokeStyle = '#1B1F2A'; ctx.stroke();
  // nome de quem está com a bola
  const dono = cp.dono != null && cp.sp.get(cp.dono);
  if (dono && !cp.saida) etiqueta(ctx, dono.nome, fx(dono.x), fy(dono.y) + r * 1.9, Math.round(11 * dpr), fonte.corpo, W);
  // cartões, apito e bandeira
  for (const m of cp.marcas) {
    if (m.tipo === 'amarelo' || m.tipo === 'vermelho') {
      const s = cp.sp.get(m.id); if (!s) continue;
      const x = fx(s.x) + r * 0.6, y = fy(s.y) - r * 2.1;
      ctx.fillStyle = m.tipo === 'amarelo' ? '#F2C230' : '#D7263D'; ctx.fillRect(x, y, r * 0.75, r * 1.05);
      ctx.lineWidth = Math.max(1, r * 0.12); ctx.strokeStyle = '#1B1F2A'; ctx.strokeRect(x, y, r * 0.75, r * 1.05);
    } else if (m.tipo === 'lesao') {
      const s = cp.sp.get(m.id); if (!s) continue;
      const x = fx(s.x), y = fy(s.y) - r * 2.2, q = r * 0.55;
      ctx.fillStyle = '#fff'; ctx.fillRect(x - q * 1.2, y - q * 1.2, q * 2.4, q * 2.4);
      ctx.lineWidth = Math.max(1, r * 0.12); ctx.strokeStyle = '#1B1F2A'; ctx.strokeRect(x - q * 1.2, y - q * 1.2, q * 2.4, q * 2.4);
      ctx.fillStyle = '#D7263D'; ctx.fillRect(x - q * 0.3, y - q, q * 0.6, q * 2); ctx.fillRect(x - q, y - q * 0.3, q * 2, q * 0.6);
    } else if (m.tipo === 'bandeira') {
      const x = fx(m.x), y = fy(0);
      ctx.strokeStyle = '#1B1F2A'; ctx.lineWidth = Math.max(1, r * 0.15); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - my * 0.9 + 1); ctx.stroke();
      ctx.fillStyle = Math.sin(cp.clock * 20) > 0 ? '#F2C230' : '#D7263D'; ctx.fillRect(x, y - my * 0.9 + 1, r * 0.9, my * 0.5);
    } else if (m.tipo === 'var') {
      etiqueta(ctx, '📺 VAR', fx(50), fy(50), Math.round(14 * dpr), fonte.corpo, W, '#1B1F2A', '#F2B33D');
    } else if (m.tipo === 'apito') {
      ctx.globalAlpha = Math.min(1, (m.ate - cp.clock) * 2);
      etiqueta(ctx, 'PRIII!', fx(m.x), fy(m.y) - r * 2.4, Math.round(11 * dpr), fonte.corpo, W, '#F2B33D', '#1B1F2A');
      ctx.globalAlpha = 1;
    }
  }
}

function etiqueta(ctx, txt, x, y, px, fam, W, bg = '#1B1F2A', fg = '#fff') {
  ctx.font = `700 ${px}px ${fam}`;
  const w = ctx.measureText(txt).width + px * 0.8, h = px * 1.35, x0 = clamp(x - w / 2, 2, W - w - 2);
  ctx.fillStyle = bg; ctx.fillRect(x0, y - h / 2, w, h);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x0 + w / 2, y + px * 0.05);
}
