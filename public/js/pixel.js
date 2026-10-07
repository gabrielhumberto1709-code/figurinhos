// Pixel art do Figurinhos: figurinhas (busto 32x32), botões de campo, escudos, camisas e bandeiras.
// Gera grades {w,h,pal,rows} ('.' = transparente) e desenha em canvas com cache de dataURL.

// ---------- utilitários ----------
function rng(seed) { let h = 2166136261 >>> 0; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function rgb2hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function shade(h, f) { const [r, g, b] = hex2rgb(h); return f < 1 ? rgb2hex(r * f, g * f, b * f * 1.04) : rgb2hex(r + (255 - r) * (f - 1), g + (255 - g) * (f - 1), b + (255 - b) * (f - 1)); }
function lum(h) { const [r, g, b] = hex2rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; }

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.p = Array.from({ length: h }, () => Array(w).fill(null)); }
  set(x, y, c) { if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y][x] = c; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.p[y][x] : null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  // contorno seletivo: pinta vizinhos vazios com a versão escura da cor do pixel
  outline(fn) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.p[y][x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = this.get(x + dx, y + dy); if (c) { add.push([x, y, fn(c, dx, dy)]); break; } }
    }
    for (const [x, y, c] of add) this.set(x, y, c);
  }
  toData() {
    const pal = [], idx = new Map(), rows = [];
    for (const row of this.p) rows.push(row.map(c => { if (!c) return '.'; if (!idx.has(c)) { idx.set(c, String.fromCharCode(65 + pal.length + (pal.length >= 26 ? 6 : 0))); pal.push(c); } return idx.get(c); }).join(''));
    return { w: this.w, h: this.h, pal, rows };
  }
}

// ---------- paleta da casa ----------
const SKIN = [ // [brilho, base, sombra, contorno]
  ['#FBE5CF', '#F1C9A5', '#D8A37C', '#9E6B52'],
  ['#F4D0A9', '#E3B184', '#C48B60', '#8A5A3B'],
  ['#E1AD7D', '#C99062', '#A66E47', '#71452C'],
  ['#BE895B', '#A26C43', '#80502D', '#55311B'],
  ['#93613F', '#784A2D', '#5C371F', '#3A2111'],
  ['#6D442B', '#56331E', '#422413', '#28150A'],
];
const HAIR = { // [base, brilho, sombra]
  preto: ['#211C18', '#3D352E', '#0F0C0A'], castanho: ['#3E2617', '#5E3D26', '#26160C'], marrom: ['#6E4427', '#91603B', '#4C2D19'],
  loiro: ['#C9A25A', '#E7C980', '#9B7A3B'], platinado: ['#E9E3C9', '#FFFCEC', '#BEB598'], ruivo: ['#A9442C', '#CB674B', '#7B2D1C'], grisalho: ['#9B9B97', '#C4C4C0', '#6F6F6B'],
};
const IRIS = ['#2B1B12', '#3F2B1B', '#4E6C3B', '#3D5B8B'];
const EYE_W = '#F7F3EB', LASH = '#1B1513';

// ---------- figurinha: busto 32x32 ----------
// look = {skin:0-5, hair:'preto', style, beard, iris, acc, kit:{c1,c2,pat,collar}}
const FACES = {
  oval: { rows: { 4: [12, 19], 5: [11, 20], 6: [10, 21], 17: [10, 21], 18: [10, 21], 19: [11, 20], 20: [12, 19], 21: [13, 18] }, L: 9, R: 22 },
  fino: { rows: { 4: [12, 19], 5: [11, 20], 6: [11, 20], 17: [11, 20], 18: [11, 20], 19: [12, 19], 20: [12, 19], 21: [13, 18] }, L: 10, R: 21 },
  quadrado: { rows: { 4: [11, 20], 5: [10, 21], 6: [9, 22], 17: [9, 22], 18: [10, 21], 19: [10, 21], 20: [11, 20], 21: [12, 19] }, L: 9, R: 22 },
};
function makeHead(shape) { const F = FACES[shape] || FACES.oval; const span = y => F.rows[y] || (y >= 7 && y <= 16 ? [F.L, F.R] : null); span.L = F.L; span.R = F.R; return span; }
function portrait(look) {
  const g = new Grid(32, 32);
  const headSpan = makeHead(look.rosto), HL = headSpan.L, HR = headSpan.R;
  const [SH, SB, SS, SO] = SKIN[look.skin];
  const [HB, HH, HS] = HAIR[look.hair];
  const k = look.kit, c1 = k.c1, c2 = k.c2 || shade(c1, 0.6);
  const c1s = shade(c1, 0.78);

  // camisa (ombros) y 24..31
  const shirtRows = { 24: [10, 21], 25: [6, 25], 26: [4, 27] };
  for (let y = 24; y < 32; y++) {
    const [a, b] = shirtRows[y] || [2, 29];
    for (let x = a; x <= b; x++) {
      let c = c1;
      switch (k.pat) {
        case 'listras': c = Math.floor((x - 2) / 3) % 2 ? c2 : c1; break;
        case 'aros': c = Math.floor((y - 24) / 2) % 2 ? c2 : c1; break;
        case 'banda': c = y >= 27 && y <= 28 ? c2 : c1; break;
        case 'faixa': c = (x - y + 32) % 32 >= 15 && (x - y + 32) % 32 <= 18 ? c2 : c1; break;
        case 'metade': c = x >= 16 ? c2 : c1; break;
        case 'central': c = x >= 13 && x <= 18 ? c2 : c1; break;
        case 'v': c = y - 24 >= Math.abs(x - 15.5) - 4 && y - 24 <= Math.abs(x - 15.5) - 1 ? c2 : c1; break;
      }
      if (x >= b - 2 && y >= 27) c = shade(c, 0.82); // sombra do lado direito
      g.set(x, y, c);
    }
  }
  // dobra do ombro
  g.hline(5, 9, 26, shade(c1, 0.86)); g.hline(22, 26, 26, c1s);
  // escudinho no peito
  g.rect(20, 27, 3, 3, c2 === c1 ? '#FFFFFF' : c2); g.set(21, 28, c1);
  // pescoço
  for (let y = 21; y < 26; y++) g.hline(13, 18, y, y < 23 ? SS : SB);
  g.hline(13, 18, 21, SS);
  // gola
  if (k.collar === 'v') { g.set(15, 25, SB); g.set(16, 25, SB); g.set(14, 24, c2); g.set(17, 24, c2); g.set(15, 26, c2); g.set(16, 26, c2); g.set(13, 24, c1); g.set(18, 24, c1); }
  else if (k.collar === 'polo') { g.hline(11, 14, 24, c2); g.hline(17, 20, 24, c2); g.set(13, 25, c2); g.set(18, 25, c2); g.set(15, 25, c2); g.set(16, 25, c2); }
  else { g.hline(12, 19, 24, c2); g.set(12, 25, c2); g.set(19, 25, c2); }

  // cabeça
  for (let y = 4; y <= 21; y++) { const s = headSpan(y); if (!s) continue; for (let x = s[0]; x <= s[1]; x++) g.set(x, y, SB); }
  // luz e sombra do rosto (luz vem da esquerda)
  for (let y = 7; y <= 15; y++) { g.set(HL, y, SH); g.set(HR, y, SS); g.set(HR - 1, y, y > 11 ? SS : SB); }
  for (let y = 16; y <= 20; y++) { const s = headSpan(y); g.set(s[1], y, SS); g.set(s[1] - 1, y, SS); }
  g.hline(13, 18, 21, SS); g.set(10, 8, SH); g.set(11, 7, SH);
  // orelhas
  for (let y = 11; y <= 14; y++) { g.set(HL - 1, y, SB); g.set(HR + 1, y, SS); }
  g.set(HL - 1, 12, SS); g.set(HR + 1, 12, SO);
  // sobrancelhas, olhos
  const browC = look.hair === 'platinado' || look.hair === 'loiro' ? shade(HB, 0.62) : HB;
  const bc = look.sobrancelha === 'clara' ? shade(SB, 0.72) : browC;
  g.hline(11, 13, 10, bc); g.hline(18, 20, 10, bc);
  if (look.sobrancelha === 'grossa') { g.hline(12, 13, 9, bc); g.hline(18, 19, 9, bc); }
  g.hline(11, 13, 12, LASH); g.hline(18, 20, 12, LASH);
  g.set(11, 13, EYE_W); g.set(12, 13, IRIS[look.iris]); g.set(13, 13, EYE_W);
  g.set(18, 13, EYE_W); g.set(19, 13, IRIS[look.iris]); g.set(20, 13, EYE_W);
  // nariz e boca
  g.set(16, 14, SS); g.set(15, 15, SS); g.set(16, 16, SS); g.set(14, 16, SH);
  if (look.nariz === 'largo') { g.set(14, 16, shade(SS, 0.8)); g.set(17, 16, shade(SS, 0.8)); g.set(15, 16, SS); }
  const lip = shade(SS, 0.82);
  if (look.smile) { g.set(14, 17, lip); g.hline(15, 16, 18, lip); g.set(17, 17, lip); }
  else { g.hline(14, 17, 18, lip); }
  if (look.boca === 'cheia') g.hline(15, 16, 19, shade(SS, 0.95));

  // barba
  const BC = look.hair === 'grisalho' ? HAIR.grisalho[0] : look.hair === 'platinado' ? HAIR.castanho[0] : HB;
  if (look.beard === 'rala') { for (let y = 16; y <= 21; y++) { const s = headSpan(y); for (let x = s[0]; x <= s[1]; x++) if ((x + y) % 2 === 0 && !(y === 18 && x >= 14 && x <= 17)) g.set(x, y, shade(SB, 0.8)); } }
  else if (look.beard === 'cheia') { for (let y = 15; y <= 21; y++) { const s = headSpan(y); for (let x = s[0]; x <= s[1]; x++) if (!(y === 18 && x >= 14 && x <= 17) && !(y === 15 && x > 10 && x < 21)) g.set(x, y, (x + y) % 5 === 0 ? shade(BC, 1.18) : BC); } g.hline(14, 17, 17, BC); }
  else if (look.beard === 'cavanhaque') { g.hline(14, 17, 17, BC); g.hline(14, 17, 19, BC); g.hline(15, 16, 20, BC); g.hline(14, 17, 21, BC); }
  else if (look.beard === 'bigode') { g.hline(13, 18, 17, BC); }
  else if (look.beard === 'curta') {
    const BCl = shade(BC, 1.18);
    for (let y = 14; y <= 21; y++) { const s2 = headSpan(y); if (!s2) continue; g.set(s2[0], y, BCl); g.set(s2[1], y, BCl); }
    for (let y = 20; y <= 21; y++) { const s2 = headSpan(y); for (let x = s2[0]; x <= s2[1]; x++) if ((x + y) % 3) g.set(x, y, BCl); }
    g.hline(14, 17, 17, BCl); g.hline(15, 16, 20, BCl);
  }
  else if (look.beard === 'bigodinho') { g.hline(14, 17, 17, shade(SB, 0.72)); }
  else if (look.beard === 'aparada') {
    for (let y = 12; y <= 21; y++) { const s2 = headSpan(y); if (!s2) continue; const th = y >= 16 ? 2 : 1; for (let t = 0; t < th; t++) { g.set(s2[0] + t, y, BC); g.set(s2[1] - t, y, BC); } }
    for (let y = 19; y <= 21; y++) { const s2 = headSpan(y); for (let x = s2[0]; x <= s2[1]; x++) if (!(y === 19 && x >= 15 && x <= 16 && look.boca === 'cheia')) g.set(x, y, (x + y) % 6 === 0 ? shade(BC, 1.2) : BC); }
    g.hline(14, 17, 17, BC); g.set(13, 18, BC); g.set(18, 18, BC); g.hline(15, 16, 20, BC);
  }

  // cabelo
  const H = (x, y) => g.set(x, y, HB), Hh = (x, y) => g.set(x, y, HH), Hs = (x, y) => g.set(x, y, HS);
  const cap = (y0, y1, x0, x1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) H(x, y); };
  switch (look.style) {
    case 'curto': cap(3, 6, 10, 21); cap(4, 7, 9, 22); for (let y = 8; y <= 11; y++) { H(9, y); H(22, y); } for (const x of [12, 15, 18]) Hh(x, 4); Hs(21, 7); g.hline(12, 20, 2, HB); break;
    case 'raspado': for (let y = 3; y <= 7; y++) { const s = headSpan(Math.max(4, y)) || [12, 19]; for (let x = s[0]; x <= s[1]; x++) if ((x + y) % 2 === 0 || y <= 4) g.set(x, y, y <= 4 ? HB : shade(SB, 0.62)); } break;
    case 'degrade': cap(1, 5, 11, 20); cap(3, 6, 10, 21); for (let y = 6; y <= 10; y++) { g.set(9, y, (y % 2) ? HB : shade(SB, 0.7)); g.set(22, y, (y % 2) ? HS : shade(SB, 0.6)); } for (const x of [12, 14, 17]) Hh(x, 2); break;
    case 'topete': cap(3, 6, 10, 21); cap(0, 3, 12, 22); cap(5, 7, 9, 22); for (const x of [14, 16, 18, 20]) Hh(x, 1); H(9, 8); H(22, 8); Hs(21, 6); break;
    case 'black': for (let y = -1; y <= 9; y++) { const half = y < 2 ? 7 + y : y < 6 ? 9 : 10 - (y - 6); for (let x = 16 - half; x <= 15 + half; x++) if (y >= 0) g.set(x, y, (x * 3 + y * 5) % 7 === 0 ? HH : HB); } for (let y = 6; y <= 12; y++) { H(8, y); H(23, y); H(7, y - 2); H(24, y - 2); } break;
    case 'cacheado': cap(2, 6, 10, 21); cap(4, 8, 9, 22); for (const [x, y] of [[10, 1], [13, 1], [16, 1], [19, 1], [8, 6], [23, 6], [8, 9], [23, 9]]) H(x, y); for (const [x, y] of [[11, 3], [14, 2], [17, 3], [20, 4], [12, 5], [18, 5]]) Hh(x, y); break;
    case 'longo': cap(2, 6, 10, 21); cap(4, 7, 9, 22); for (let y = 6; y <= 22; y++) { H(8, y); H(23, y); if (y > 8) { H(7, y); Hs(24, y); } } for (const x of [12, 16, 19]) Hh(x, 3); break;
    case 'trancas': cap(2, 6, 10, 21); for (let x = 9; x <= 22; x += 2) for (let y = 6; y <= 9; y++) H(x, y); for (const x of [8, 23]) for (let y = 6; y <= 20; y++) if (y % 2) H(x, y); else Hs(x, y); for (const x of [11, 15, 19]) Hh(x, 3); break;
    case 'coque': cap(3, 6, 10, 21); cap(5, 7, 9, 22); cap(0, 2, 14, 17); Hh(15, 0); H(9, 8); H(22, 8); break;
    case 'topete-degrade': { cap(3, 6, HL + 1, HR - 1); g.hline(13, 19, 1, HB); g.hline(12, 20, 2, HB); g.hline(11, 21, 3, HB); for (const x of [14, 16, 18]) Hh(x, 2); Hh(17, 1); Hs(HR - 1, 5); for (let y = 6; y <= 10; y++) { g.set(HL, y, (y % 2) ? HB : shade(SB, 0.62)); g.set(HR, y, (y % 2) ? HS : shade(SB, 0.55)); } break; }
    case 'puxado': { for (let y = 3; y <= 6; y++) { const s2 = headSpan(Math.max(4, y)) || [12, 19]; for (let x = s2[0]; x <= s2[1]; x++) H(x, y); } g.hline(13, 18, 2, HB); for (const [x, y] of [[12, 4], [15, 4], [18, 4], [13, 5], [16, 5], [19, 5], [14, 3], [17, 3]]) Hh(x, y); g.hline(14, 17, 1, HS); g.hline(15, 16, 0, HB); for (let y = 6; y <= 9; y++) { g.set(HL, y, HS); g.set(HR, y, HS); } break; }
    case 'twists-degrade': {
      const rows = { 1: [13, 18], 2: [11, 20], 3: [HL + 1, HR - 1], 4: [HL + 1, HR - 1], 5: [HL + 1, HR - 1], 6: [HL + 1, HR - 1] };
      const rr = rng('tw' + HB + HL);
      for (const [y, [x0, x1]] of Object.entries(rows)) for (let x = x0; x <= x1; x++) { const v = rr(); g.set(x, +y, v < 0.18 ? HH : v < 0.55 ? HB : HS); }
      for (const x of [12, 14, 16, 19]) g.set(x, 0, HS);
      g.set(HL + 1, 2, HS); g.set(HR - 1, 2, HS);
      for (let y = 6; y <= 10; y++) { g.set(HL, y, (y % 2) ? HS : shade(SB, 0.62)); g.set(HR, y, (y % 2) ? HS : shade(SB, 0.55)); }
      break;
    }
    case 'baixinho': {
      // cabelo rente: pontilhado de fio e couro cabeludo
      const [r1, g1, b1] = hex2rgb(HB), [r2, g2, b2] = hex2rgb(SS), mix = rgb2hex((r1 + r2) / 2, (g1 + g2) / 2, (b1 + b2) / 2), skinDk = shade(SB, 0.55);
      for (let y = 3; y <= 6; y++) { const s2 = headSpan(Math.max(4, y)) || [12, 19]; for (let x = s2[0]; x <= s2[1]; x++) g.set(x, y, y === 6 && (x === s2[0] || x === s2[1]) ? skinDk : (x + y) % 2 && y > 3 ? mix : HB); }
      for (let y = 7; y <= 9; y++) { g.set(HL, y, skinDk); g.set(HR, y, skinDk); }
      break;
    }
    case 'cacheado-degrade': {
      const rr = rng('cd' + HB + HL + (look.semente || ''));
      for (let y = 0; y <= 6; y++) { const x0 = y === 0 ? 13 : y === 1 ? 11 : HL + 1, x1 = y === 0 ? 18 : y === 1 ? 20 : HR - 1; for (let x = x0; x <= x1; x++) { const v = rr(); g.set(x, y, (x + y) % 3 === 0 ? HH : v < 0.35 ? HS : HB); } }
      for (const x of [12, 15, 19]) g.set(x, 0, HB);
      for (let y = 6; y <= 10; y++) { g.set(HL, y, (y % 2) ? HS : shade(SB, 0.62)); g.set(HR, y, (y % 2) ? HS : shade(SB, 0.55)); }
      break;
    }
    case 'dreads': {
      cap(2, 6, HL + 1, HR - 1); g.hline(12, 19, 1, HB);
      for (const x of [12, 15, 18]) Hh(x, 2);
      for (const x of [HL - 1, HL, HR, HR + 1]) for (let y = 6; y <= 16; y++) g.set(x, y, (y + x) % 3 === 0 ? HS : HB);
      for (const x of [HL - 2, HR + 2]) for (let y = 9; y <= 15; y++) if (y % 2) g.set(x, y, HS);
      break;
    }
    case 'moicano': {
      for (let y = 3; y <= 7; y++) { const s2 = headSpan(Math.max(4, y)) || [12, 19]; for (let x = s2[0]; x <= s2[1]; x++) if ((x + y) % 2 === 0) g.set(x, y, shade(SB, 0.66)); }
      cap(0, 6, 13, 18); for (const x of [14, 16]) Hh(x, 1); Hs(18, 4);
      break;
    }
    case 'franja': cap(3, 6, 10, 21); cap(4, 7, 9, 22); g.hline(11, 20, 2, HB); g.hline(10, 19, 8, HB); g.hline(10, 16, 9, HS); for (const x of [12, 15, 18]) Hh(x, 4); H(9, 9); H(22, 9); break;
    case 'ondulado': cap(2, 6, 10, 21); cap(4, 7, 9, 22); for (let y = 7; y <= 13; y++) { H(8, y); H(23, y); if (y > 8) { H(9, y); Hs(22, y); } } for (const [x, y] of [[11, 3], [14, 2], [17, 3], [20, 4], [13, 5], [16, 4], [19, 6]]) Hh(x, y); g.hline(12, 19, 1, HB); break;
    case 'careca': g.set(13, 5, SH); g.set(14, 5, SH); g.set(15, 4, SH); for (let y = 8; y <= 12; y++) { g.set(9, y, HS); g.set(22, y, HS); } break;
  }
  if (look.luzes) {
    const L = HAIR[look.luzes], troca = new Map([[HB, L[0]], [HH, L[1]], [HS, L[2]]]);
    for (let y = 0; y <= 6; y++) for (let x = 0; x < 32; x++) { const c = g.get(x, y); if (troca.has(c)) g.set(x, y, troca.get(c)); }
  }
  if (look.acc === 'faixa') g.hline(9, 22, 7, look.accColor || '#FFFFFF');
  if (look.acc === 'brinco') g.set(23, 15, '#F2D24B');

  // contorno seletivo
  g.outline(c => {
    if (c === SB || c === SH || c === SS || c === lip) return SO;
    if (Object.values(HAIR).some(h => h.includes(c))) return shade(HB, 0.55);
    return shade(c, 0.55);
  });
  return g.toData();
}

// ---------- botão (jogador no campo, visto de cima) 12x12 ----------
function button(c1, c2) {
  const g = new Grid(12, 13);
  const ring = c2 || shade(c1, 0.6);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const d = Math.hypot(x - 5.5, y - 5.5);
    if (d <= 5.6) g.set(x, y, d > 4.4 ? ring : c1);
  }
  // brilho e sombra
  g.set(3, 2, shade(c1, 1.45)); g.set(2, 3, shade(c1, 1.45)); g.set(4, 2, shade(c1, 1.25));
  for (const [x, y] of [[9, 8], [8, 9], [9, 9]]) g.set(x, y, shade(c1, 0.8));
  // sombra no gramado
  g.hline(2, 9, 12, 'rgba-sombra');
  g.p[12] = g.p[12].map(c => c === 'rgba-sombra' ? '#2C5E2A' : c);
  return g.toData();
}

// ---------- escudos 24x24: cinco silhuetas ----------
const FONT46 = { // fonte própria 4x6
  A: '0110100110011111100110011001', B: '1110100111101001100111101110', C: '0111100010001000100001110000', D: '1110100110011001100111100000', E: '1111100011101000100011110000',
  F: '1111100011101000100010000000', G: '0111100010111001100101110000', H: '1001100111111001100110010000', I: '1110010001000100010011100000', J: '0011000100010001100101100000',
  K: '1001101011001010100110010000', L: '1000100010001000100011110000', M: '1001111111011001100110010000', N: '1001110110111001100110010000', O: '0110100110011001100101100000',
  P: '1110100110011110100010000000', R: '1110100110011110101010010000', S: '0111100001100001000111100000', T: '1111011000100010001000100000', U: '1001100110011001100101100000',
  V: '1001100110011001011001100000', X: '1001100101100110100110010000', Y: '1001100101100010001000100000', Z: '1111000100100100100011110000', Q: '0110100110011001101101110000', W: '1001100110011011111110010000',
};
function letter(g, ch, x0, y0, c) { const m = FONT46[ch]; if (!m) return; for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) if (m[y * 4 + x] === '1') g.set(x0 + x, y0 + y, c); }

function crestMask(shape, x, y) {
  const cx = 11.5;
  switch (shape) {
    case 'redondo': return Math.hypot(x - cx, y - 11.5) <= 11.6;
    case 'escudo': if (y < 1) return x >= 2 && x <= 21; if (y < 13) return x >= 1 && x <= 22; { const r = 11.5 - (y - 12) * 0.95; return Math.hypot((x - cx) * 0.95, 0) <= r && y <= 23; }
    case 'ponta': if (y < 2) return (x >= 1 && x <= 7) || (x >= 16 && x <= 22) || (x >= 9 && x <= 14 && y >= 1); if (y < 11) return x >= 1 && x <= 22; return Math.abs(x - cx) <= 11 - (y - 10) * 0.85;
    case 'flamula': { if (y < 3) return x >= 0 && x <= 23; return Math.abs(x - cx) <= 12 - (y - 2) * 0.58 && y <= 23; }
    case 'losango': return Math.abs(x - cx) / 11.6 + Math.abs(y - 11.5) / 11.6 <= 1;
  }
}
function crest(club) {
  const g = new Grid(24, 26);
  const r = rng('escudo' + club.nome);
  const shape = club.forma || pick(r, ['redondo', 'escudo', 'ponta', 'flamula', 'losango']);
  const c1 = club.c1, c2 = club.c2, c3 = club.c3 || (lum(c1) > 0.6 ? '#1B1F2A' : '#FFFFFF');
  const motif = club.motivo || pick(r, ['listras', 'faixa', 'metade', 'cruz', 'liso', 'chevron']);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    if (!crestMask(shape, x, y)) continue;
    let c = c1;
    switch (motif) {
      case 'listras': c = Math.floor((x - 1) / 3) % 2 ? c2 : c1; break;
      case 'faixa': c = Math.abs((x - y) - 0) <= 2 ? c2 : c1; break;
      case 'metade': c = x < 12 ? c1 : c2; break;
      case 'cruz': c = (x >= 10 && x <= 13) || (y >= 9 && y <= 12) ? c2 : c1; break;
      case 'chevron': c = y - 8 >= Math.abs(x - 11.5) * 0.7 && y - 8 <= Math.abs(x - 11.5) * 0.7 + 3 ? c2 : c1; break;
    }
    g.set(x, y, c);
  }
  // borda interna
  const inner = [];
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (g.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !crestMask(shape, x + dx, y + dy))) inner.push([x, y]);
  for (const [x, y] of inner) g.set(x, y, c2 === c1 ? c3 : (motif === 'liso' ? c2 : c3));
  // emblema no alto (estrela ou bola), com contorno próprio
  const emb = 'estrela', branca = club.estrelaBranca ?? (r() < 0.4);
  const ey = shape === 'losango' ? 4 : 3, OUTL = '#141821';
  const E = ['...X...', '...X...', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', 'X.....X'];
  const ecol = branca ? '#FFFFFF' : '#F2D24B';
  E.forEach((rowS, j) => [...rowS].forEach((ch, i) => { const x = 8 + i, y = ey + j; if (ch === 'X') g.set(x, y, ecol); if (ch === 'O') g.set(x, y, OUTL); }));
  for (let j = -1; j <= 7; j++) for (let i = -1; i <= 7; i++) { const x = 8 + i, y = ey + j; const isE = E[j] && E[j][i] && E[j][i] !== '.'; if (isE) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => E[j + dy] && E[j + dy][i + dx] && E[j + dy][i + dx] !== '.')) g.set(x, y, OUTL); }
  // fita com a sigla atravessando a parte de baixo (passa da borda do escudo, pontas dobradas)
  const sig = club.sigla.slice(0, 3).toUpperCase();
  const fita = lum(c1) > 0.55 && lum(c2) > 0.55 ? '#1B1F2A' : '#F7F3EB';
  const fitaSh = shade(fita, fita === '#F7F3EB' ? 0.8 : 1.35);
  const fy = 16;
  for (let y = fy; y <= fy + 7; y++) for (let x = 1; x <= 22; x++) g.set(x, y, fita);
  for (let y = fy + 1; y <= fy + 8; y++) { g.set(0, y, fitaSh); g.set(23, y, fitaSh); }
  g.set(0, fy + 4, null); g.set(23, fy + 4, null); g.set(1, fy + 8, fitaSh); g.set(22, fy + 8, fitaSh);
  const ink = fita === '#F7F3EB' ? (lum(c1) < 0.6 ? c1 : (lum(c2) < 0.6 ? c2 : '#1B1F2A')) : '#F7F3EB';
  const w = sig.length * 5 - 1, x0 = Math.round(11.5 - w / 2 + 0.5);
  [...sig].forEach((ch, i) => letter(g, ch, x0 + i * 5, fy + 1, ink));
  // estrelas de título: pontos dourados na fita
  for (let i = 0; i < (club.estrelas || 0); i++) g.set(2 + i * 2, fy + 7, '#F2D24B');
  g.outline(() => OUTL);
  return g.toData();
}

// ---------- camisa 20x18 ----------
function shirt(k) {
  const g = new Grid(20, 18);
  const c1 = k.c1, c2 = k.c2 || shade(c1, 0.6);
  for (let y = 1; y < 18; y++) for (let x = 0; x < 20; x++) {
    const body = x >= 4 && x <= 15 && y >= 1, sleeve = y <= 6 && ((x >= 0 && x <= 3 && y >= 2 + (3 - x) * 0.4) || (x >= 16 && x <= 19 && y >= 2 + (x - 16) * 0.4));
    if (!body && !sleeve) continue;
    if (y === 1 && x >= 8 && x <= 11) continue; // gola
    let c = c1;
    switch (k.pat) {
      case 'listras': c = Math.floor((x - 4) / 2) % 2 ? c2 : c1; break;
      case 'aros': c = Math.floor((y - 1) / 2) % 2 ? c2 : c1; break;
      case 'banda': c = y >= 7 && y <= 9 ? c2 : c1; break;
      case 'faixa': c = Math.abs((x - 4) - (y - 1)) <= 1 ? c2 : c1; break;
      case 'metade': c = x >= 10 ? c2 : c1; break;
      case 'central': c = x >= 8 && x <= 11 ? c2 : c1; break;
      case 'v': c = y - 1 >= Math.abs(x - 9.5) * 0.8 - 1 && y - 1 <= Math.abs(x - 9.5) * 0.8 + 1 ? c2 : c1; break;
    }
    if (sleeve && y === 6) c = c2;
    if (body && x >= 14) c = shade(c, 0.85);
    g.set(x, y, c);
  }
  g.hline(8, 11, 1, null); g.set(8, 2, c2); g.set(11, 2, c2); g.hline(9, 10, 3, c2);
  g.outline(c => shade(c, 0.5));
  return g.toData();
}

// ---------- bandeiras 16x11 (todas as seleções da base) ----------
const H = (...cs) => (x, y) => cs[Math.min(cs.length - 1, Math.floor(y * cs.length / 11))];
const V = (...cs) => x => cs[Math.min(cs.length - 1, Math.floor(x * cs.length / 16))];
const cor = c => typeof c === 'function' ? c : () => c;
// cruz nórdica (com borda opcional), disco, triângulo no mastro e cantão por cima de outro desenho
const nord = (bg, cr, borda) => (x, y) => { const cx = x >= 4 && x <= 6, cy = y >= 4 && y <= 6; if (borda) return x === 5 || y === 5 ? cr : cx || cy ? borda : bg; return cx || cy ? cr : bg; };
const disco = (bg, c, r = 2.8, cx = 7.5, cy = 5) => (x, y) => Math.hypot(x - cx, y - cy) < r ? c : cor(bg)(x, y);
const tri = (bg, c, w = 6) => (x, y) => x < w * (1 - Math.abs(y - 5) / 5.6) ? c : cor(bg)(x, y);
const lua = (bg, c, cx = 7, cy = 5) => (x, y) => Math.hypot(x - cx, y - cy) < 2.6 && Math.hypot(x - cx - 1, y - cy) >= 2.1 ? c : cor(bg)(x, y);
const estrela = (bg, c, cx = 7.5, cy = 5, r = 1.6) => (x, y) => Math.abs(x - cx) + Math.abs(y - cy) < r ? c : cor(bg)(x, y);
const jack = (bg, est) => (x, y) => {
  if (x <= 7 && y <= 5) { if (x === 3 || x === 4 || y === 2 || y === 3) return x === 3 || y === 2 || (x === 4 && y === 3) ? '#C8102E' : '#FFFFFF'; return Math.abs(x * 0.7 - y) < 0.7 || Math.abs((7 - x) * 0.7 - y) < 0.7 ? '#FFFFFF' : '#012169'; }
  return est.some(([a, b]) => a === x && b === y) ? (bg === '#012169' ? '#C8102E' : '#FFFFFF') : bg;
};
const BANDEIRAS = {
  BRA: (x, y) => { const d = Math.abs(x - 7.5) / 6.5 + Math.abs(y - 5) / 4.2; if (Math.hypot(x - 7.5, (y - 5) * 1.1) < 2.3) return '#24408E'; return d <= 1 ? '#F7D116' : '#1F9E4A'; },
  ARG: (x, y) => y < 3 || y > 7 ? '#74ACDF' : (x >= 7 && x <= 8 && y >= 4 && y <= 6 ? '#F6B40E' : '#FFFFFF'),
  URU: (x, y) => x < 6 && y < 5 ? (Math.hypot(x - 2.5, y - 2) < 1.6 ? '#F6B40E' : '#FFFFFF') : (y % 2 ? '#0038A8' : '#FFFFFF'),
  ITA: V('#109A4A', '#FFFFFF', '#CE2B37'), FRA: V('#1F3F95', '#FFFFFF', '#E1252E'), ALE: H('#1A1A1A', '#DD1F26', '#F7CE00'),
  ESP: (x, y) => y < 3 || y > 7 ? '#C8102E' : '#F6C21A',
  ING: (x, y) => (x >= 7 && x <= 8) || (y >= 4 && y <= 6) ? '#CE1124' : '#FFFFFF',
  POR: (x, y) => x < 6 ? '#0A6B35' : (Math.hypot(x - 6, y - 5) < 2.4 ? '#F6D33C' : '#DA291C'),
  NOR: nord('#BA0C2F', '#00205B', '#FFFFFF'), DIN: nord('#C8102E', '#FFFFFF'), SUE: nord('#006AA7', '#FECC00'), FIN: nord('#FFFFFF', '#003580'), ICE: nord('#02529C', '#DC1E35', '#FFFFFF'), FAR: nord('#FFFFFF', '#ED2939', '#005EB8'),
  COL: H('#FCD116', '#FCD116', '#003893', '#CE1126'), EQU: H('#FFD100', '#FFD100', '#0072CE', '#EF3340'), VEN: H('#FFCC00', '#00247D', '#CF142B'), BOL: H('#D52B1E', '#F9E300', '#007934'),
  PAR: H('#D52B1E', '#FFFFFF', '#0038A8'), PER: V('#D91023', '#FFFFFF', '#D91023'), CHI: (x, y) => y >= 5 ? '#D52B1E' : x < 6 ? (x === 3 && y === 2 ? '#FFFFFF' : '#0039A6') : '#FFFFFF',
  MEX: V('#006847', '#FFFFFF', '#CE1126'), HOL: H('#AE1C28', '#FFFFFF', '#21468B'), BEL: V('#1A1A1A', '#FDDA24', '#EF3340'), IRL: V('#169B62', '#FFFFFF', '#FF883E'),
  NGA: V('#008751', '#FFFFFF', '#008751'), CRO: (x, y) => Math.abs(x - 7.5) < 1.6 && y >= 3 && y <= 6 ? ((x + y) % 2 ? '#FF0000' : '#FFFFFF') : H('#FF0000', '#FFFFFF', '#171796')(x, y), RUS: H('#FFFFFF', '#0039A6', '#D52B1E'),
  AUT: H('#ED2939', '#FFFFFF', '#ED2939'), GAN: estrela(H('#CE1126', '#FCD116', '#006B3F'), '#000000', 7.5, 5, 1.3), CAM: estrela(V('#007A5E', '#CE1126', '#FCD116'), '#FCD116', 7.5, 5, 1.3),
  SEN: estrela(V('#00853F', '#FDEF42', '#E31B23'), '#00853F', 7.5, 5, 1.3), GUI: V('#CE1126', '#FCD116', '#009460'), POL: H('#FFFFFF', '#DC143C'), UCR: H('#0057B7', '#FFD700'),
  EUA: (x, y) => x < 7 && y < 6 ? ((x + y) % 2 ? '#FFFFFF' : '#3C3B6E') : (y % 2 ? '#FFFFFF' : '#B22234'),
  TUR: estrela(lua('#E30A17', '#FFFFFF', 6), '#FFFFFF', 10.5, 5, 1.1), TUN: lua(disco('#E70013', '#FFFFFF', 3.3), '#E70013', 7, 5),
  MAR: (x, y) => { const d = Math.abs(x - 7.5) + Math.abs(y - 5); return d < 2.6 && d > 1.4 ? '#006233' : '#C1272D'; },
  ARL: lua(V('#006233', '#FFFFFF'), '#D21034', 7.5, 5), LIB: lua(H('#E70013', '#000000', '#000000', '#239E46'), '#FFFFFF', 7, 5),
  SUI: (x, y) => (x >= 6 && x <= 9 && y >= 2 && y <= 8) || (y >= 4 && y <= 6 && x >= 4 && x <= 11) ? '#FFFFFF' : '#DA291C',
  CIV: V('#F77F00', '#FFFFFF', '#009E60'), MLI: V('#14B53A', '#FCD116', '#CE1126'), ROM: V('#002B7F', '#FCD116', '#CE1126'), MOL: V('#0046AE', '#FFD200', '#CC092F'), CHA: V('#002664', '#FECB00', '#C60C30'),
  GUA: V('#4997D0', '#FFFFFF', '#4997D0'), MAL: V('#FFFFFF', '#CF142B'), SER: H('#C6363C', '#0C4076', '#FFFFFF'),
  ESQ: (x, y) => x >= 3 && x <= 6 && y >= 3 && y <= 7 ? (x === 4 && y >= 4 && y <= 6 ? '#FFFFFF' : '#EE1C25') : H('#FFFFFF', '#0B4EA2', '#EE1C25')(x, y),
  ESL: (x, y) => x >= 3 && x <= 5 && y >= 1 && y <= 4 ? '#0B4EA2' : H('#FFFFFF', '#0000FF', '#FF0000')(x, y),
  BUL: H('#FFFFFF', '#00966E', '#D62612'), HUN: H('#CD2A3E', '#FFFFFF', '#436F4D'), EGI: estrela(H('#CE1126', '#FFFFFF', '#000000'), '#C09300', 7.5, 5, 1.2),
  SYR: (x, y) => y >= 4 && y <= 6 && (x === 5 || x === 10) ? '#007A3D' : H('#CE1126', '#FFFFFF', '#000000')(x, y), IRA: H('#239F40', '#FFFFFF', '#DA0000'), ARM: H('#D90012', '#0033A0', '#F2A800'),
  LIT: H('#FDB913', '#006A44', '#C1272D'), EST: H('#0072CE', '#000000', '#FFFFFF'), GAB: H('#009E60', '#FCD116', '#3A75C4'), SIE: H('#1EB53A', '#FFFFFF', '#0072C6'), UZB: H('#0099B5', '#FFFFFF', '#1EB53A'),
  TAJ: H('#CC0000', '#FFFFFF', '#006600'), LUX: H('#EF3340', '#FFFFFF', '#00A3E0'), LAT: (x, y) => y >= 4 && y <= 6 ? '#FFFFFF' : '#9E3039', ELS: H('#0047AB', '#FFFFFF', '#0047AB'), HON: H('#0073CF', '#FFFFFF', '#0073CF'),
  CRC: (x, y) => y <= 1 || y >= 9 ? '#002B7F' : y <= 3 || y >= 7 ? '#FFFFFF' : '#CE1126', HAI: H('#00209F', '#D21034'), IND: H('#CE1126', '#FFFFFF'),
  THE: (x, y) => y <= 3 ? '#CE1126' : y === 4 || y === 6 ? '#FFFFFF' : y === 5 ? '#0C1C8C' : '#3A7728',
  GRE: (x, y) => x < 6 && y < 6 ? (x === 2 || y === 2 ? '#FFFFFF' : '#0D5EAF') : (y % 2 ? '#FFFFFF' : '#0D5EAF'),
  ISR: (x, y) => { const d = Math.abs(x - 7.5) + Math.abs(y - 5); return y === 1 || y === 9 || (d < 2.7 && d > 1.5) ? '#0038B8' : '#FFFFFF'; },
  ARA: (x, y) => (y === 7 && x >= 4 && x <= 11) || (y >= 3 && y <= 5 && x >= 3 && x <= 12 && (x + y) % 3 === 0) ? '#FFFFFF' : '#006C35',
  QAT: (x, y) => x < 5 + (y % 2) ? '#FFFFFF' : '#8A1538', UNI: (x, y) => x < 4 ? '#FF0000' : H('#00732F', '#FFFFFF', '#000000')(x, y),
  JOR: tri(H('#000000', '#FFFFFF', '#007A3D'), '#CE1126', 7), PAL: tri(H('#000000', '#FFFFFF', '#009736'), '#EE2A35', 7),
  KOS: (x, y) => Math.abs(x - 7.5) < 2.5 && Math.abs(y - 5.5) < 1.5 ? '#D0A650' : (y === 2 && x >= 5 && x <= 10 && x % 2 ? '#FFFFFF' : '#244AA5'),
  ALB: (x, y) => (Math.abs(x - 7.5) < 1.5 && y >= 2 && y <= 8) || (Math.abs(y - 4) < 1 && Math.abs(x - 7.5) < 4) ? '#000000' : '#E41E20',
  BOS: (x, y) => x >= 4 + y * 0.7 && x <= 11 ? '#FECB00' : (Math.abs(x - (2.6 + y * 0.7)) < 0.5 && y % 2 === 0 ? '#FFFFFF' : '#002395'),
  DRC: (x, y) => { const d = Math.abs((x - 7.5) * 0.69 + (y - 5)); return d < 0.6 ? '#CE1021' : d < 1.3 ? '#F7D618' : (Math.hypot(x - 2.5, y - 2.5) < 1.4 ? '#F7D618' : '#007FFF'); },
  CON: (x, y) => { const d = x * 0.69 + y; return d < 6 ? '#009543' : d < 10.5 ? '#FBDE4A' : '#DC241F'; },
  TAN: (x, y) => { const d = x * 0.69 - (10 - y); return d < -2.2 ? '#1EB53A' : d < -1.4 ? '#FCD116' : d < 1.4 ? '#000000' : d < 2.2 ? '#FCD116' : '#00A3DD'; },
  TRI: (x, y) => { const d = Math.abs(x * 0.69 - y + 0.2); return d < 1.1 ? '#000000' : d < 1.7 ? '#FFFFFF' : '#CE1126'; },
  ZAM: (x, y) => x >= 10 && y >= 4 ? (x < 12 ? '#DE2010' : x < 14 ? '#000000' : '#EF7D00') : '#198A00',
  ZIM: tri(H('#006400', '#FFD200', '#D40000', '#000000', '#D40000', '#FFD200', '#006400'), '#FFFFFF', 6), MOZ: tri(H('#007168', '#FFFFFF', '#000000', '#FFFFFF', '#FCE100'), '#D21034', 6),
  ANG: estrela(H('#CC092F', '#000000'), '#FFCB00', 7.5, 5, 1.8), BUR: estrela(H('#EF2B2D', '#009E49'), '#FCD116', 7.5, 5, 1.4),
  TOG: (x, y) => x < 6 && y < 5 ? (Math.abs(x - 2.5) + Math.abs(y - 2) < 1.2 ? '#FFFFFF' : '#D21034') : (y % 4 < 2 ? '#006A4E' : '#FFCE00'),
  CPV: (x, y) => y === 6 || y === 8 ? '#FFFFFF' : y === 7 ? '#CF2027' : '#003893', CUR: (x, y) => y === 7 ? '#F9E814' : (x === 2 && y === 2) || (x === 4 && y === 3) ? '#FFFFFF' : '#002B7F',
  SUR: (x, y) => y <= 1 || y >= 9 ? '#377E3F' : y === 2 || y === 8 ? '#FFFFFF' : (Math.abs(x - 7.5) + Math.abs(y - 5) < 1.6 ? '#ECC81D' : '#B40A2D'),
  DOM: (x, y) => x === 7 || x === 8 || y === 5 ? '#FFFFFF' : ((x < 7) === (y < 5) ? '#002D62' : '#CE1126'),
  PAN: (x, y) => x < 8 ? (y < 5.5 ? (x === 3 && y === 2 ? '#005293' : '#FFFFFF') : '#005293') : (y < 5.5 ? '#D21034' : (x === 12 && y === 8 ? '#D21034' : '#FFFFFF')),
  NEW: jack('#012169', [[11, 3], [13, 5], [10, 6], [12, 8]]), AUS: jack('#012169', [[3, 8], [11, 2], [13, 5], [11, 8], [9, 5]]),
  RSA: (x, y) => { const yy = Math.abs(y - 5); if (x <= 3.5 - yy * 0.8) return '#000000'; if (x <= 4.6 - yy * 0.8) return '#FFB612'; if (yy <= 1 && x >= 4) return '#007749'; if (x <= 6.4 - yy * 0.8 && yy <= 4) return '#007749'; if (yy <= 2 || x <= 7.4 - yy * 0.8) return '#FFFFFF'; return y < 5 ? '#DE3831' : '#002395'; },
  GBS: (x, y) => x < 5 ? (Math.abs(x - 2.5) + Math.abs(y - 5) < 1.3 ? '#000000' : '#CE1126') : (y < 5.5 ? '#FCD116' : '#009E49'),
  CEN: (x, y) => x === 7 || x === 8 ? '#D21034' : H('#003082', '#FFFFFF', '#289728', '#FFCE00')(x, y), COM: tri(H('#FFC61E', '#FFFFFF', '#CE1126', '#3A75C4'), '#3D8E33', 6),
  MAU: (x, y) => y <= 1 || y >= 9 ? '#D01C1F' : lua('#00A95C', '#FFD700', 7.5, 4.5)(x, y), BEN: (x, y) => x < 6 ? '#008751' : y < 5.5 ? '#FCD116' : '#E8112D',
  JAP: disco('#FFFFFF', '#BC002D', 3), BAN: disco('#006A4E', '#F42A41', 3, 6.5), NIG: disco(H('#E05206', '#FFFFFF', '#0DB02B'), '#E05206', 1.3),
  COR: (x, y) => Math.hypot(x - 7.5, y - 5) < 2.8 ? (y < 5 ? '#CD2E3A' : '#0047A0') : (((x <= 2 || x >= 13) && (y <= 2 || y >= 8)) ? '#000000' : '#FFFFFF'),
  KAZ: disco('#00AFCA', '#FEC50C', 2.2), CYP: (x, y) => Math.abs(x - 7.5) < 3 && Math.abs(y - 4.5) < 1.2 ? '#D57800' : (y === 7 && Math.abs(x - 7.5) < 2 ? '#4E5B31' : '#FFFFFF'),
  MON: (x, y) => x === 0 || x === 15 || y === 0 || y === 10 || Math.hypot(x - 7.5, y - 5) < 2 ? '#C6A63F' : '#C40308',
  GAL: (x, y) => Math.abs(x - 7.5) < 3 && Math.abs(y - 5) < 2.2 ? '#C8102E' : (y < 5.5 ? '#FFFFFF' : '#00B140'),
  ESC: (x, y) => Math.abs((x - 7.5) * 0.69 - (y - 5)) < 0.9 || Math.abs((x - 7.5) * 0.69 + (y - 5)) < 0.9 ? '#FFFFFF' : '#005EB8',
  CAN: (x, y) => x < 4 || x > 11 ? '#FF0000' : (Math.abs(x - 7.5) + Math.abs(y - 5) * 1.1 < 2.6 ? '#FF0000' : '#FFFFFF'),
  NIR: (x, y) => x === 7 || x === 8 || y === 5 ? '#C8102E' : '#FFFFFF',
  JAM: (x, y) => Math.abs((x - 7.5) * 0.69 - (y - 5)) < 0.9 || Math.abs((x - 7.5) * 0.69 + (y - 5)) < 0.9 ? '#FED100' : Math.abs(y - 5) > Math.abs(x - 7.5) * 0.69 ? '#009B3A' : '#000000',
  GEO: (x, y) => x === 7 || x === 8 || y === 5 || [[3, 2], [12, 2], [3, 8], [12, 8]].some(([a, b]) => a === x && b === y) ? '#E8112D' : '#FFFFFF',
  TCH: (x, y) => x < 7 - Math.abs(y - 5) * 1.3 ? '#11457E' : y < 5.5 ? '#FFFFFF' : '#D7141A',
};
const ALIAS = { SOU: 'RSA', MNE: 'MON', FRE: 'FRA', GLP: 'FRA', ENG: 'ING', GER: 'ALE' };
function flag(code) {
  const F = BANDEIRAS[ALIAS[code] || code];
  if (!F) return null;
  const g = new Grid(16, 11);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 16; x++) { let c = F(x, y); if (x % 5 === 4 && y > 0) c = shade(c, 0.9); g.set(x, y, c); }
  g.outline(() => '#141821');
  return g.toData();
}

// ---------- gramado com botões (cena 96x60) ----------
function pitch(home, away) {
  const g = new Grid(96, 60);
  const G1 = '#3E8A3A', G2 = '#4A9A44', LINE = '#E8F0DE';
  for (let y = 0; y < 60; y++) for (let x = 0; x < 96; x++) g.set(x, y, Math.floor(x / 8) % 2 ? G1 : G2);
  for (let x = 2; x < 94; x++) { g.set(x, 2, LINE); g.set(x, 57, LINE); }
  for (let y = 2; y < 58; y++) { g.set(2, y, LINE); g.set(93, y, LINE); g.set(48, y, LINE); }
  for (let a = 0; a < 360; a += 4) { const x = Math.round(48 + Math.cos(a * Math.PI / 180) * 9), y = Math.round(30 + Math.sin(a * Math.PI / 180) * 9); g.set(x, y, LINE); }
  for (let y = 16; y <= 44; y++) { g.set(16, y, LINE); g.set(79, y, LINE); }
  for (let x = 2; x <= 16; x++) { g.set(x, 16, LINE); g.set(x, 44, LINE); }
  for (let x = 79; x <= 93; x++) { g.set(x, 16, LINE); g.set(x, 44, LINE); }
  const stamp = (d, ox, oy) => d.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g.set(ox + x, oy + y, d.pal[ch.charCodeAt(0) - 65 - (ch.charCodeAt(0) > 90 ? 6 : 0)]); }));
  const H = button(home.c1, home.c2), A = button(away.c1, away.c2);
  for (const [x, y] of [[6, 24], [20, 10], [22, 38], [34, 22], [40, 44]]) stamp(H, x, y);
  for (const [x, y] of [[80, 24], [66, 12], [64, 36], [54, 26], [58, 6]]) stamp(A, x, y);
  // bola
  g.rect(46, 33, 3, 3, '#FFFFFF'); g.set(47, 34, '#1B1F2A'); g.hline(46, 48, 36, '#2C5E2A');
  return g.toData();
}



// ---------- código de rosto (11 chars base36) -> look ----------
// [pele, corCabelo, corte, barba, rosto, sobrancelha, nariz, boca, íris, acessório, luzes]
const PELE = 6, CABELOS = ['preto', 'castanho', 'marrom', 'loiro', 'platinado', 'ruivo', 'grisalho'];
const CORTES = ['curto', 'raspado', 'degrade', 'topete', 'black', 'cacheado', 'longo', 'trancas', 'coque', 'careca', 'topete-degrade', 'puxado', 'twists-degrade', 'baixinho', 'cacheado-degrade', 'dreads', 'moicano', 'franja', 'ondulado'];
const LUZES = [null, 'loiro', 'platinado', 'ruivo'];
const BARBAS = [null, 'rala', 'cheia', 'cavanhaque', 'bigode', 'bigodinho', 'aparada', 'curta'];
const SOBRANCELHAS = ['normal', 'grossa', 'clara'], ROSTOS = ['oval', 'fino', 'quadrado'], ACC = [null, 'faixa', 'brinco'];
export function lookDe(code, kit) {
  const d = [...(code || '0000000000').padEnd(11, '0')].map(ch => parseInt(ch, 36) || 0);
  return {
    skin: Math.min(d[0], PELE - 1), hair: CABELOS[d[1]] || 'preto', style: CORTES[d[2]] || 'curto', beard: BARBAS[d[3]],
    rosto: ROSTOS[d[4]] || 'oval', sobrancelha: SOBRANCELHAS[d[5]] || 'normal', nariz: d[6] ? 'largo' : null, boca: d[7] ? 'cheia' : null,
    iris: Math.min(d[8], IRIS.length - 1), acc: ACC[d[9]], luzes: LUZES[d[10]] || null, kit,
  };
}

// uniforme do clube a partir do catálogo: c = cores, pat = padrão
const PADRAO = { hoops: 'aros', hoops3: 'aros', vstripes: 'listras', sash: 'faixa', band: 'banda', solid: 'liso' };
export const kitDe = clube => ({ c1: clube.c[0], c2: clube.c[1] || shade(clube.c[0], 0.6), pat: PADRAO[clube.pat] || 'liso', collar: 'redonda' });
export const escudoDe = clube => ({ nome: clube.n, sigla: clube.s, c1: clube.c[0], c2: clube.c[1] || clube.c[0], c3: clube.c[2] });

// ---------- bonequinho de corpo inteiro (12x17) para o campo ----------
const CRESPOS = new Set(['black', 'cacheado', 'twists-degrade', 'cacheado-degrade']), LONGOS = new Set(['longo', 'trancas', 'dreads']);
function boneco(look, gk) {
  const g = new Grid(12, 17);
  const [SH, SB, SS, SO] = SKIN[look.skin], [HB, HH, HS] = HAIR[look.hair];
  const k = look.kit, c1 = gk ? '#F2B33D' : k.c1, c2 = gk ? '#1B1F2A' : (k.c2 || shade(k.c1, 0.6));
  // cabeça (linhas 2-6) e pescoço
  g.rect(3, 2, 6, 5, SB); g.hline(3, 8, 6, SS); g.set(8, 3, SS); g.set(8, 4, SS); g.set(3, 3, SH);
  g.set(4, 4, '#1B1513'); g.set(7, 4, '#1B1513'); g.set(5, 7, SS); g.set(6, 7, SS);
  // barba
  const BC = look.hair === 'platinado' ? HAIR.castanho[0] : HB;
  if (['cheia', 'aparada', 'curta'].includes(look.beard)) { g.hline(3, 8, 6, BC); g.set(3, 5, BC); g.set(8, 5, BC); }
  else if (['cavanhaque', 'bigode', 'bigodinho'].includes(look.beard)) g.hline(5, 6, 6, BC);
  // cabelo
  const st = look.style;
  if (st !== 'careca') {
    if (st === 'raspado' || st === 'baixinho') { g.hline(3, 8, 2, HB); g.set(4, 2, HS); g.set(7, 2, HS); }
    else if (st === 'moicano') { g.rect(5, 0, 2, 3, HB); }
    else if (CRESPOS.has(st)) { g.rect(3, 0, 6, 3, HB); g.hline(2, 9, 1, HB); g.set(2, 2, HB); g.set(9, 2, HB); g.set(4, 0, HH); g.set(7, 1, HH); }
    else { g.rect(3, 1, 6, 2, HB); g.set(4, 1, HH); g.set(8, 2, HS); if (st === 'topete' || st === 'topete-degrade') g.hline(4, 8, 0, HB); if (st === 'coque') g.rect(5, 0, 2, 1, HB); if (st === 'franja') g.hline(3, 7, 3, HB); }
    if (LONGOS.has(st)) for (let y = 3; y <= 7; y++) { g.set(2, y, y % 2 && st !== 'longo' ? HS : HB); g.set(9, y, HB); }
    if (look.luzes) { const L = HAIR[look.luzes]; for (let y = 0; y <= 2; y++) for (let x = 2; x <= 9; x++) if ([HB, HH, HS].includes(g.get(x, y))) g.set(x, y, L[y === 0 ? 1 : 0]); }
  }
  if (look.acc === 'faixa') g.hline(3, 8, 2, '#FFFFFF');
  // camisa com braços, calção, meião e chuteira
  g.rect(2, 8, 8, 4, c1); g.set(1, 8, c1); g.set(10, 8, c1);
  if (!gk && k.pat === 'listras') for (let y = 8; y <= 11; y++) { g.set(4, y, c2); g.set(7, y, c2); }
  if (!gk && (k.pat === 'aros' || k.pat === 'banda')) g.hline(2, 9, 10, c2);
  if (!gk && k.pat === 'faixa') { g.set(3, 8, c2); g.set(4, 9, c2); g.set(5, 10, c2); g.set(6, 11, c2); }
  g.set(1, 9, SB); g.set(10, 9, SB); g.set(1, 10, SS); g.set(10, 10, SS);
  const calcao = gk ? '#1B1F2A' : (k.short || (lum(c1) > 0.75 ? '#1B1F2A' : '#FFFFFF'));
  g.rect(3, 12, 6, 2, calcao); g.set(5, 13, null); g.set(6, 13, null);
  g.rect(3, 14, 2, 2, c1); g.rect(7, 14, 2, 2, c1);
  g.hline(3, 4, 16, '#1B1F2A'); g.hline(7, 8, 16, '#1B1F2A');
  g.outline(c => c === SB || c === SH || c === SS ? SO : shade(c, 0.5));
  return g.toData();
}

// ---------- desenho em canvas, com cache ----------
const cache = new Map();
function paraURL(d) {
  const cv = document.createElement('canvas'); cv.width = d.w; cv.height = d.h;
  const ctx = cv.getContext('2d');
  d.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; const code = ch.charCodeAt(0); ctx.fillStyle = d.pal[code - 65 - (code > 90 ? 6 : 0)]; ctx.fillRect(x, y, 1, 1); } });
  return cv.toDataURL();
}
function mem(chave, fn) { if (!cache.has(chave)) { const d = fn(); cache.set(chave, d ? paraURL(d) : ''); } return cache.get(chave); }
export const urlRosto = (code, clube) => mem(`r${code}${clube.n}`, () => portrait(lookDe(code, kitDe(clube))));
export const urlEscudo = clube => mem(`e${clube.n}`, () => crest(escudoDe(clube)));
export const urlCamisa = clube => mem(`c${clube.n}`, () => shirt(kitDe(clube)));
export const urlBotao = clube => mem(`b${clube.n}`, () => button(clube.c[0], clube.c[1]));
export const urlBandeira = code => mem(`f${code}`, () => flag(code));
export const urlBoneco = (code, clube, gk = false) => mem(`p${code}${clube.n}${gk ? 'g' : ''}`, () => boneco(lookDe(code, { ...kitDe(clube), short: clube.so }), gk));
export { portrait, button, crest, shirt, flag, pitch, boneco, SKIN, HAIR, shade };
