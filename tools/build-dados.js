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
P.delete(340950); // Diogo Jota: faleceu em julho de 2025, a referência ainda o lista como sem clube

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
// faces medidas em foto: craques desenhados à mão + Série A (tools/faces.json, id -> código)
const CRAQUES = { ...JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'faces.json'), 'utf8')), ...JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'craques.json'), 'utf8')) };
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

// ---------- clubes de fora: liga, país, tier e camisa ----------
const LIGA_PAIS = { 'Premier League': 'ING', LaLiga: 'ESP', 'Serie A (ITA)': 'ITA', Bundesliga: 'ALE', 'Ligue 1': 'FRA', 'Liga Portugal': 'POR', Eredivisie: 'HOL', 'Saudi Pro League': 'KSA', 'Süper Lig': 'TUR', 'Pro League (BEL)': 'BEL', 'Premier Liga (RUS)': 'RUS', MLS: 'EUA', 'Liga MX': 'MEX', 'Liga Argentina': 'ARG', 'Liga Colombiana': 'COL', 'Liga PAR': 'PAR', 'Liga BOL': 'BOL', 'Liga CHI': 'CHI', 'Liga EQU': 'EQU', 'Liga PER': 'PER', 'Liga URU': 'URU', 'Premier League (EGI)': 'EGI', 'Super League (GRE)': 'GRE', 'Chance Liga (TCH)': 'TCH', 'Superliga (DIN)': 'DIN', 'Super League (SUI)': 'SUI', 'Premier Liga (UCR)': 'UCR', 'Bundesliga (AUT)': 'AUT', 'Premiership (AFS)': 'RSA', 'Super Liga (SÉR)': 'SER', 'Premiership (ESC)': 'ESC', Ekstraklasa: 'POL', 'Ligue 1 (TUN)': 'TUN', Eliteserien: 'NOR', 'HNL (CRO)': 'CRO', 'A-League': 'AUS', 'Superliga (ROM)': 'ROM', Allsvenskan: 'SUE', 'J1 League': 'JAP', 'K League 1': 'COR' };
const TIER_EXTRA = { 'Liga PAR': 1.2, 'Liga URU': 1.2, 'Liga CHI': 1.2, 'Liga EQU': 1.2, 'Liga PER': 1, 'Liga BOL': 0.8, 'Premier League (EGI)': 1.2, 'Chance Liga (TCH)': 2, 'Super Liga (SÉR)': 1.8, Ekstraklasa: 1.8, 'Ligue 1 (TUN)': 1, Eliteserien: 1.8, 'HNL (CRO)': 1.8, 'A-League': 1.2, 'Superliga (ROM)': 1.5, Allsvenskan: 1.8, Outras: 2 };
const PALETA = ['#D0102C', '#0B1F4B', '#1B3F9A', '#F4F4F4', '#141414', '#FFD200', '#0E7A3E', '#6CB4EE', '#7A1F3D', '#F28C28', '#5B2A86', '#8A8A8A'];
const PATS = ['solid', 'solid', 'vstripes', 'hoops', 'sash', 'band'];
const semAcento = t => t.replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function siglaDe(n) {
  const w = semAcento(n).replace(/[^A-Za-z ]/g, ' ').split(' ').filter(x => x.length > 2 && !/^(FC|CF|AC|SC|CD|CA|Club|Clube|Fussballclub|Real|Sporting|Atletico|Deportivo|Racing|United|City|Calcio|SSC|AFC|Olympique|Stade)$/i.test(x));
  return ((w[0] || semAcento(n).replace(/[^A-Za-z]/g, '')).slice(0, 3) || 'FC').toUpperCase();
}
function kitGerado(n) { const r = rng('kit' + n), c1 = pick(r, PALETA); let c2 = pick(r, PALETA); if (c2 === c1) c2 = c1 === '#F4F4F4' ? '#141414' : '#F4F4F4'; return { sig: siglaDe(n), pat: pick(r, PATS), c: [c1, c2], sh: c1, so: c2 }; }
const catExt = n => CORE.INT_CLUBS[n] || CORE.KITS_KNOWN[n] || CORE.CLUBS_F_GEN[n];
const tierDe = liga => CORE.LEAGUE_TIER[liga] ?? TIER_EXTRA[liga] ?? 1.5;
export const novoJogador = (r, ci) => { const [id, nome, curto, , pos, , idade, nat, ovr, , valor, contrato] = r; const ct = contrato && contrato >= ANO ? contrato : ANO + 1 + Math.floor(rng('ct' + id)() * 3); return [id, nome, curto, ci, pos, idade, nat, ovr, valor || 0, ct, potencial(id, idade, ovr), atributos(id, pos, ovr), rosto(id, nat, idade), RAW.nums?.[id] || 0]; };
// numeração: sem número ou repetido no clube ganha o próximo livre
export function numerar(jogadores, ci) {
  const usados = new Set();
  for (const j of jogadores.filter(j => j[3] === ci)) {
    if (!j[13] || usados.has(j[13])) { let n = j[4] === 'GOL' ? 12 : 2; while (usados.has(n) || n === 1 && j[4] !== 'GOL') n++; j[13] = n; }
    usados.add(j[13]);
  }
}
export { CORE, P, ANO, kitGerado, catExt, tierDe, LIGA_PAIS };

// ---------- montagem (só quando roda direto; tools/sulamericanos.js importa as funções acima) ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
    jogadores.push([id, nome, curto, ci, pos, idade, nat, ovr, valor || 0, ct, potencial(id, idade, ovr), atributos(id, pos, ovr), rosto(id, nat, idade), RAW.nums?.[id] || 0]);
  }
  // completa o elenco até 25 com garotos gerados (nomes da referência)
  const have = {}; for (const r of elenco) have[r[4]] = (have[r[4]] || 0) + 1;
  const need = []; const cnt = {}; for (const p of POS_FILL) { cnt[p] = (cnt[p] || 0) + 1; if ((have[p] || 0) < cnt[p]) need.push(p); }
  let total = elenco.length;
  for (const pos of need) {
    if (total >= 25 && pos !== 'GOL') continue;
    const r = rng('gen' + n + genId), id = genId++;
    const nm = CORE.genName(r, 'BRA'), idade = 18 + Math.floor(r() * 14), ovr = clamp(Math.round(nivel - 6 + (r() - 0.5) * 8), 40, 80);
    jogadores.push([id, nm.name, nm.short, ci, pos, idade, 'BRA', ovr, Math.round(ovr * ovr / 30), ANO + 1 + Math.floor(r() * 3), potencial(id, idade, ovr), atributos(id, pos, ovr), rosto(id, 'BRA', idade), 0]);
    total++;
  }
}
// ---------- sem clube e exterior: fora do calendário, só mercado (vêm depois de A/B/C para não mexer nos índices) ----------
const SKIP_LIGA = new Set(['Regional', 'Brasileirão', 'Brasileirão B']);
const ehLivre = r => /^sem clube$/i.test(r[3]);
const livres = [...P.values()].filter(ehLivre);
const ext = [...P.values()].filter(r => !idxClube.has(r[3]) && !ehLivre(r) && !SKIP_LIGA.has(r[9]) && (r[8] >= 67 || (r[6] <= 21 && r[8] >= 62)));
const porClube = new Map(); for (const r of ext) { if (!porClube.has(r[3])) porClube.set(r[3], []); porClube.get(r[3]).push(r); }
const clubesExt = [...porClube].filter(([, l]) => l.length >= 3).map(([n, l]) => ({ n, l, liga: l[0][9] })).sort((a, b) => tierDe(b.liga) - tierDe(a.liga) || a.liga.localeCompare(b.liga) || a.n.localeCompare(b.n));
idxClube.set('Sem clube', clubes.length);
clubes.push({ n: 'Sem clube', s: 'S/C', pat: 'solid', c: ['#8A8A8A', '#F4F4F4'], sh: '#8A8A8A', so: '#F4F4F4', fan: 0, est: ['—', 0], div: 'L', lvl: 60 });
for (const r of livres) { const j = novoJogador(r, clubes.length - 1); j[9] = ANO; jogadores.push(j); }
for (const { n, l, liga } of clubesExt) {
  const k = catExt(n) || kitGerado(n), tier = tierDe(liga), top = l.map(r => r[8]).sort((a, b) => b - a).slice(0, 11);
  const lvl = Math.round(top.reduce((a, b) => a + b, 0) / top.length);
  idxClube.set(n, clubes.length);
  clubes.push({ n, s: k.sig, pat: k.pat, c: k.c, sh: k.sh, so: k.so, fan: k.fan || clamp(Math.round(tier + (lvl - 70) / 3), 2, 9), est: [`Estádio do ${n}`, 30000], div: 'X', liga, tier, nat: k.nat || LIGA_PAIS[liga] || '', lvl });
  for (const r of l) jogadores.push(novoJogador(r, clubes.length - 1));
}
for (let ci = 0; ci < clubes.length; ci++) numerar(jogadores, ci);
const dados = { versao: 4, ano: ANO, fonte: 'Treineiros 1.38.10 (uso autorizado)', clubes, jogadores, divisoes: DIV };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(dados));
const porDiv = d => jogadores.filter(j => clubes[j[3]].div === d).length;
console.log(`clubes ${clubes.length} · jogadores ${jogadores.length} (A ${porDiv('A')}, B ${porDiv('B')}, C ${porDiv('C')}, livres ${porDiv('L')}, exterior ${porDiv('X')} em ${clubesExt.filter(c => c.l.length >= 3).length} clubes) · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
}
