// Copa do Brasil no formato de 2026: fases 1 a 4 em jogo único (Série B, Série C e clubes dos estaduais), a Série A
// entra na 5ª fase; 5ª fase, oitavas, quartas e semi em ida e volta; final única em campo neutro (6 de dezembro).
// Mandos e chaves por sorteio; na 5ª fase os 16 mais fortes pegam os 16 mais fracos. Empate (no jogo único ou no
// agregado) vai para os pênaltis. O vice ganha vaga na Libertadores do ano seguinte.
import { rng, shuffle } from './util.js';
import { dataCopa as diaCopa } from './calendario.js';

const ETAPAS = [['f1', '1ª fase', 1], ['f2', '2ª fase', 1], ['f3', '3ª fase', 1], ['f4', '4ª fase', 1], ['f5', '5ª fase', 2], ['oit', 'Oitavas de final', 2, 'Oitavas'], ['qua', 'Quartas de final', 2, 'Quartas'], ['sem', 'Semifinal', 2, 'Semi'], ['fin', 'Final', 1]];
export const FASES = ETAPAS.flatMap(([k, nome, pernas, curto = nome]) => pernas === 1 ? [{ k, perna: 'unico', nome, curto }] : ['ida', 'volta'].map(perna => ({ k, perna, nome: `${nome} · ${perna}`, curto: `${curto} (${perna})` })));
export const F_FINAL = FASES.length - 1;
// prêmio por chegar a cada fase (entra quando o clube se classifica; quem estreia recebe a cota da fase de entrada)
export const PREMIOS = { f1: 6e4, f2: 9e4, f3: 1.3e5, f4: 1.8e5, f5: 3.5e5, oit: 7e5, qua: 1.1e6, sem: 1.9e6, vice: 6e6, campeao: 13e6 };
export const dataCopa = (_, ano, i) => diaCopa(ano, i);
const indice = k => FASES.findIndex(f => f.k === k);

// quem joga e onde entra: Série A na 5ª fase; os 4 mais fortes da B na 3ª (no lugar dos campeões do Nordeste, Verde,
// C e D do ano anterior); o resto da B, a C e os clubes de estadual mais fortes completam 106 vagas das fases 1 e 2
export function participantes(base) {
  const da = d => base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d).sort((a, b) => base.forca(b) - base.forca(a));
  const B = da('B'), C = da('C'), R = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'R').sort((a, b) => (base.clubes[b].lvl || 0) - (base.clubes[a].lvl || 0) || a - b);
  const resto = [...B.slice(4), ...C, ...R].slice(0, 102), f1 = resto.slice(-28);
  return { f1, f2: resto.slice(0, -28), f3: B.slice(0, 4), f5: da('A') };
}
const sortearPares = (r, L, aleatorioMando = true) => { const l = shuffle(r, L), c = []; for (let i = 0; i + 1 < l.length; i += 2) c.push(aleatorioMando && r() < 0.5 ? [l[i + 1], l[i]] : [l[i], l[i + 1]]); return c; };
export function novaCopa(base, s) {
  const r = rng(`copa${s.seed}-${s.ano}`), P = participantes(base);
  s.copa = { v: 2026, ano: s.ano, fase: 0, chaves: sortearPares(r, P.f1), espera: { f2: P.f2, f3: P.f3, f5: P.f5 }, jogos: [], art: {}, campeao: null, vice: null, todos: [...P.f1, ...P.f2, ...P.f3, ...P.f5] };
  return s.copa;
}
export const copaAtiva = s => !!s.copa && s.copa.fase < FASES.length;
export const copaDevida = (s, ate) => copaAtiva(s) && +diaCopa(s.ano, s.copa.fase) <= +ate;
export const naCopa = (s, ci) => copaAtiva(s) && s.copa.chaves.some(c => c.includes(ci));
// chave = [mandante da ida (ou do jogo único), mandante da volta]
export const mandoDe = (fase, [x, y]) => FASES[fase].perna === 'volta' ? [y, x] : [x, y];

// disputa de pênaltis: cinco cobranças e depois alternadas. Com quem estava em campo, cada um bate na sua vez
// (o cobrador oficial abre) e a chance depende da finalização dele e do goleiro do outro lado.
export function penaltis(seed, campo) {
  const r = rng('pen' + seed), p = [0, 0], seq = [];
  const gk = t => campo?.[t]?.find(j => j.gk)?.ovr ?? 70;
  const chance = (t, j) => j ? Math.min(0.9, Math.max(0.55, 0.74 + (j.fin - 70) / 250 - (gk(1 - t) - 70) / 300)) : 0.76;
  const bate = (t, n) => { const l = campo?.[t]; const j = l?.length ? l[n % l.length] : null, gol = r() < chance(t, j); p[t] += gol; seq.push({ t, id: j?.id ?? null, nome: j?.curto ?? '', gol }); };
  // série de 5 alternadas; para quando um lado não alcança mais o outro
  const feitas = [0, 0], acabou = () => p[0] > p[1] + (5 - feitas[1]) || p[1] > p[0] + (5 - feitas[0]);
  for (let i = 0; i < 5 && !acabou(); i++) for (const t of [0, 1]) { if (acabou()) break; bate(t, i); feitas[t]++; }
  for (let i = 5; p[0] === p[1]; i++) { bate(0, i); bate(1, i); }
  p.seq = seq;
  return p;
}
// gols da ida vistos pelo mando do jogo de volta (para somar o agregado)
export function agregadoIda(s, h, a) {
  const ida = s.copa.jogos.find(j => j.fase === s.copa.fase - 1 && j.h === a && j.a === h);
  return ida ? [ida.gols[1], ida.gols[0]] : [0, 0];
}
// quem passa: jogo único ou agregado dos dois jogos; empate vai para os pênaltis (mesma semente do jogo)
export function decidir(s, fase, h, a, gols, seed, campo) {
  const P = FASES[fase].perna;
  if (P === 'ida') return { vencedor: null };
  const ag = P === 'volta' ? agregadoIda(s, h, a) : [0, 0], t = [gols[0] + ag[0], gols[1] + ag[1]], agg = P === 'volta' ? t : null;
  if (t[0] !== t[1]) return { vencedor: t[0] > t[1] ? h : a, perdedor: t[0] > t[1] ? a : h, agg };
  const pen = penaltis(seed, campo);
  return { vencedor: pen[0] > pen[1] ? h : a, perdedor: pen[0] > pen[1] ? a : h, pen: [pen[0], pen[1]], seq: pen.seq, agg };
}
// próxima fase: classificados + quem entra nela; sorteio (na 5ª fase, os 16 mais fortes contra os 16 mais fracos)
export function avancarFase(s, vencedores, forca = () => 0) {
  const c = s.copa, F = FASES[c.fase];
  c.fase++;
  if (F.perna === 'ida') return;
  if (F.k === 'fin') { [c.campeao] = vencedores; c.vice = c.chaves[0].find(x => x !== c.campeao); c.chaves = []; return; }
  const prox = FASES[c.fase], r = rng(`sorteio${s.seed}-${s.ano}-${c.fase}`), L = [...vencedores, ...(c.espera?.[prox.k] || [])];
  if (prox.k === 'f5') {
    const ord = L.slice().sort((a, b) => forca(b) - forca(a)), fortes = shuffle(r, ord.slice(0, 16)), fracos = shuffle(r, ord.slice(16));
    c.chaves = fortes.map((f, i) => r() < 0.5 ? [fracos[i], f] : [f, fracos[i]]);
  } else c.chaves = sortearPares(r, L, prox.k !== 'fin');
}
// até onde o clube foi
export function campanha(s, ci) {
  const c = s.copa; if (!c) return null;
  if (c.campeao === ci) return 'Campeão';
  if (c.vice === ci) return 'Vice-campeão';
  const jogou = c.jogos.filter(j => j.h === ci || j.a === ci);
  if (!jogou.length) return naCopa(s, ci) || Object.values(c.espera || {}).some(l => l.includes(ci)) ? 'Na disputa' : null;
  if (naCopa(s, ci)) return `Na disputa (${FASES[c.fase].curto})`;
  const k = FASES[jogou.at(-1).fase].k;
  return `Eliminado ${{ oit: 'nas oitavas', qua: 'nas quartas', sem: 'na semifinal' }[k] || `na ${FASES[indice(k)].nome.split(' ·')[0]}`}`;
}
