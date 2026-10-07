// Gera public/data/brasil.json a partir da base de referência (Treineiros 1.38.10, uso autorizado pelo criador).
// Uso: node tools/build-dados.js <pasta-da-referencia>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REF = process.argv[2] || path.join(ROOT, '..', 'referencia', 'treineiros-1.38.10');
const OUT = path.join(ROOT, 'public', 'data', 'brasil.json');
const ANO = 2026;

// ---------- catálogos (clubes, estádios) ----------
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(REF, '02-nucleo-regras-catalogos.js'), 'utf8') + '\n;globalThis.__CORE = CORE;', ctx);
const CORE = ctx.__CORE;
const RAW = JSON.parse(fs.readFileSync(path.join(REF, 'data.json'), 'utf8'));

// aparência medida em foto pela referência: id -> [pele 0-5, cabelo 0-6, careca 0/1]
const looksLine = fs.readFileSync(path.join(REF, '10-liga-online-e-interface.js'), 'utf8').split('\n').find(l => l.includes('SPR.setLooks('));
const LOOKS = {};
for (const it of looksLine.match(/for \(const it of '([^']+)'/)[1].split(',')) LOOKS[parseInt(it.slice(0, -3), 16)] = it.slice(-3).split('').map(Number);

// ---------- RNG determinístico ----------
function rng(seed) { let h = 2166136261 >>> 0; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- jogadores: mesma ordem de mescla da referência (o mais recente vence) ----------
const P = new Map();
const add = rows => { for (const r of rows || []) if (Array.isArray(r) && r.length >= 12 && typeof r[0] === 'number') P.set(r[0], r); };
for (const k of ['bra', 'rel', 'b26', 'reg26', 'arg', 'col', 'intl', 'young', 'int26', 'tm26']) add(RAW[k]);
for (const [id, club] of RAW.mv26 || []) { const r = P.get(id); if (r) P.set(id, [...r.slice(0, 3), club, ...r.slice(4)]); }

// ---------- clubes do Brasil 2026 ----------
const cat = n => CORE.CLUBS_A[n] || CORE.CLUBS_REL[n] || CORE.CLUBS_B_GEN[n] || CORE.CLUBS_REG_GEN[n];
const DIV = {
  A: [...new Set(RAW.bra.map(r => r[3]))],
  B: [...new Set(RAW.b26.map(r => r[3]))],
  C: CORE.SERIE_C_2026.slice(),
};
const regionOf = n => { for (const [reg, list] of Object.entries(CORE.CLUB_REGION)) if (list.includes(n)) return reg; const c = CORE.CLUBS_REG_GEN[n]; return c && c.reg || 'SSE'; };

// ---------- atributos (velocidade, finalização, passe, drible, defesa, físico) ----------
const PERFIL = {
  GOL: [-10, -40, -12, -25, 4, 0], ZAG: [-4, -22, -6, -10, 5, 4], LD: [5, -14, 0, -2, 1, 0], LE: [5, -14, 0, -2, 1, 0],
  VOL: [-3, -10, 2, -4, 4, 3], MC: [-1, -4, 5, 2, -2, 0], MEI: [1, 2, 5, 5, -14, -4], ME: [4, 0, 3, 4, -10, -2], MD: [4, 0, 3, 4, -10, -2],
  PE: [6, 2, 0, 6, -18, -3], PD: [6, 2, 0, 6, -18, -3], CA: [1, 6, -4, 1, -22, 4], SA: [3, 4, 2, 4, -18, 0],
};
function atributos(id, pos, ovr) { const r = rng('att' + id), p = PERFIL[pos] || PERFIL.MC; return p.map(d => clamp(Math.round(ovr + d + (r() - 0.5) * 8), 20, 99)); }
function potencial(id, idade, ovr) {
  const r = rng('pot' + id);
  const extra = idade <= 18 ? 12 + r() * 10 : idade <= 21 ? 8 + r() * 8 : idade <= 24 ? 3 + r() * 6 : idade <= 27 ? r() * 4 : 0;
  return clamp(Math.round(ovr + extra), ovr, 95);
}

// ---------- rosto: [pele, corCabelo, corte, barba, rosto, sobrancelha, nariz, boca, íris, acessório] em base36 ----------
const HAIR_MAP = [0, 0, 1, 2, 3, 3, 5]; // índice da referência -> preto, castanho, marrom, loiro, platinado, ruivo, grisalho
const CORTES_ESCUROS = [1, 2, 4, 7, 12, 13, 9, 2, 13];  // raspado, degradê, black, tranças, twists, baixinho, careca
const CORTES_CLAROS = [0, 3, 2, 10, 6, 5, 9, 1, 8, 11]; // curto, topete, degradê, topete-degradê, longo, cacheado, careca, raspado, coque, puxado
const CRAQUES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'craques.json'), 'utf8'));
function rosto(id, nat, idade) {
  if (CRAQUES[id]) return CRAQUES[id];
  const r = rng('rosto' + id);
  const M = LOOKS[id];
  let pele = M ? M[0] : pick(r, nat === 'BRA' ? [0, 1, 1, 2, 2, 3, 3, 4, 4, 5] : ['ARG', 'URU', 'CHI', 'PAR'].includes(nat) ? [0, 0, 1, 1, 1, 2] : [0, 1, 2, 3, 4, 5]);
  let cabelo = M ? HAIR_MAP[M[1]] : (pele >= 3 ? 0 : pick(r, [0, 0, 1, 1, 2, 3]));
  if (idade >= 34 && r() < 0.35) cabelo = 6;
  if (pele >= 3 && r() < 0.06) cabelo = 4; // descolorido
  let corte = M && M[2] ? 9 : pick(r, pele >= 3 ? CORTES_ESCUROS : CORTES_CLAROS);
  const barba = r() < (idade > 26 ? 0.5 : 0.22) ? pick(r, [1, 2, 3, 6, 7, 1, 7]) : (r() < 0.1 ? 5 : 0);
  const face = pick(r, [0, 0, 0, 1, 2]), sob = pele >= 3 ? pick(r, [0, 1, 1]) : pick(r, [0, 0, 1]);
  const nariz = pele >= 3 ? (r() < 0.6 ? 1 : 0) : (r() < 0.15 ? 1 : 0), boca = pele >= 3 ? (r() < 0.55 ? 1 : 0) : 0;
  const iris = pele <= 1 ? pick(r, [0, 1, 1, 2, 3]) : pick(r, [0, 0, 1]);
  const acc = r() < 0.04 ? 1 : r() < 0.06 ? 2 : 0;
  return [pele, cabelo, corte, barba, face, sob, nariz, boca, iris, acc].map(n => n.toString(36)).join('');
}

// ---------- montagem ----------
const clubes = [], jogadores = [];
const idxClube = new Map();
for (const div of ['A', 'B', 'C']) for (const n of DIV[div]) {
  const k = cat(n), est = CORE.STADIUMS[n] || [`Estádio do ${n}`, 12000];
  idxClube.set(n, clubes.length);
  clubes.push({ n, s: k.sig, pat: k.pat, c: k.c, sh: k.sh, so: k.so, fan: k.fan || 3, est, div, reg: regionOf(n), lvl: k.lvl || 0 });
}
const POS_FILL = ['GOL', 'GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LD', 'LE', 'LE', 'VOL', 'VOL', 'VOL', 'MC', 'MC', 'MEI', 'MEI', 'PE', 'PD', 'CA', 'CA', 'PE', 'PD', 'MC'];
let genId = 900000000;
for (const [n, ci] of idxClube) {
  const elenco = [...P.values()].filter(r => r[3] === n);
  const top = elenco.map(r => r[8]).sort((a, b) => b - a).slice(0, 16);
  const nivel = top.length >= 8 ? top.reduce((a, b) => a + b, 0) / top.length : (clubes[ci].lvl || 55);
  if (!clubes[ci].lvl) clubes[ci].lvl = Math.round(nivel);
  for (const r of elenco) {
    const [id, nome, curto, , pos, , idade, nat, ovr, , valor, contrato] = r;
    const ct = contrato && contrato >= ANO ? contrato : ANO + 1 + Math.floor(rng('ct' + id)() * 3);
    jogadores.push([id, nome, curto, ci, pos, idade, nat, ovr, valor || 0, ct, potencial(id, idade, ovr), atributos(id, pos, ovr), rosto(id, nat, idade)]);
  }
  // completa o elenco até 25 com garotos gerados (nomes da referência)
  const have = {}; for (const r of elenco) have[r[4]] = (have[r[4]] || 0) + 1;
  const need = []; const cnt = {}; for (const p of POS_FILL) { cnt[p] = (cnt[p] || 0) + 1; if ((have[p] || 0) < cnt[p]) need.push(p); }
  let total = elenco.length;
  for (const pos of need) {
    if (total >= 25 && pos !== 'GOL') continue;
    const r = rng('gen' + n + genId), id = genId++;
    const nm = CORE.genName(r, 'BRA'), idade = 18 + Math.floor(r() * 14), ovr = clamp(Math.round(nivel - 6 + (r() - 0.5) * 8), 40, 80);
    jogadores.push([id, nm.name, nm.short, ci, pos, idade, 'BRA', ovr, Math.round(ovr * ovr / 30), ANO + 1 + Math.floor(r() * 3), potencial(id, idade, ovr), atributos(id, pos, ovr), rosto(id, 'BRA', idade)]);
    total++;
  }
}
const dados = { versao: 1, ano: ANO, fonte: 'Treineiros 1.38.10 (uso autorizado)', clubes, jogadores, divisoes: DIV };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(dados));
const porDiv = d => jogadores.filter(j => clubes[j[3]].div === d).length;
console.log(`clubes ${clubes.length} · jogadores ${jogadores.length} (A ${porDiv('A')}, B ${porDiv('B')}, C ${porDiv('C')}) · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
