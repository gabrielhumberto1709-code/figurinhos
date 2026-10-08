// Copa do Brasil: 32 clubes (os 20 da Série A, os campeões regionais do ano anterior que estão na B ou na C e os mais
// fortes da B até fechar 12), mata-mata em jogo único com pênaltis
// e final em ida e volta. Os jogos caem na quarta-feira livre entre duas rodadas do Brasileirão.
import { rng, shuffle } from './util.js';

export const FASES = [
  { k: '1f', nome: '1ª fase', curto: '1ª fase', apos: 6 },
  { k: 'oit', nome: 'Oitavas de final', curto: 'Oitavas', apos: 12 },
  { k: 'qua', nome: 'Quartas de final', curto: 'Quartas', apos: 16 },
  { k: 'sem', nome: 'Semifinal', curto: 'Semi', apos: 22 },
  { k: 'f1', nome: 'Final · ida', curto: 'Final (ida)', apos: 28 },
  { k: 'f2', nome: 'Final · volta', curto: 'Final (volta)', apos: 32 },
];
// prêmio por chegar a cada fase (entra quando o clube se classifica) e pelo título
export const PREMIOS = { '1f': 4e5, oit: 6e5, qua: 9e5, sem: 1.6e6, vice: 5e6, campeao: 12e6 };
const DIA = 864e5;
export const dataCopa = (dataRodada, ano, i) => new Date(+dataRodada(ano, FASES[i].apos) + 7 * DIA);

export function participantes(base, s) {
  const da = d => base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d).sort((a, b) => base.forca(b) - base.forca(a));
  const vagas = [...new Set(s?.vagasCB || [])].filter(c => ['B', 'C'].includes(base.clubes[c]?.div)).slice(0, 12);
  return [...da('A'), ...vagas, ...da('B').filter(c => !vagas.includes(c)).slice(0, 12 - vagas.length)];
}

// sorteio: na 1ª fase os 16 mais fortes pegam os 16 mais fracos, e o mais fraco tem o mando
export function novaCopa(base, s) {
  const r = rng(`copa${s.seed}-${s.ano}`), lista = participantes(base, s).sort((a, b) => base.forca(b) - base.forca(a));
  const fortes = shuffle(r, lista.slice(0, 16)), fracos = shuffle(r, lista.slice(16));
  s.copa = { ano: s.ano, fase: 0, chaves: fortes.map((f, i) => [fracos[i], f]), jogos: [], art: {}, campeao: null, vice: null };
  return s.copa;
}
export const copaDevida = s => !!s.copa && s.copa.fase < FASES.length && FASES[s.copa.fase].apos < s.rodada;
export const naCopa = (s, ci) => !!s.copa && s.copa.fase < FASES.length && s.copa.chaves.some(c => c.includes(ci));
// mando do jogo da fase: na volta da final inverte
export const mandoDe = (fase, [x, y]) => FASES[fase].k === 'f2' ? [y, x] : [x, y];

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
  const ida = s.copa.jogos.find(j => j.fase === 4 && j.h === a && j.a === h);
  return ida ? [ida.gols[1], ida.gols[0]] : [0, 0];
}
// quem passa: jogo único ou agregado da final; empate vai para os pênaltis (mesma semente do jogo)
export function decidir(s, fase, h, a, gols, seed, campo) {
  if (FASES[fase].k === 'f1') return { vencedor: null };
  const ag = FASES[fase].k === 'f2' ? agregadoIda(s, h, a) : [0, 0], t = [gols[0] + ag[0], gols[1] + ag[1]];
  if (t[0] !== t[1]) return { vencedor: t[0] > t[1] ? h : a, perdedor: t[0] > t[1] ? a : h };
  const pen = penaltis(seed, campo);
  return { vencedor: pen[0] > pen[1] ? h : a, perdedor: pen[0] > pen[1] ? a : h, pen: [pen[0], pen[1]], seq: pen.seq };
}
// próxima fase: sorteio livre entre os classificados (a final mantém o par)
export function avancarFase(s, vencedores) {
  const c = s.copa, k = FASES[c.fase].k;
  c.fase++;
  if (k === 'f1') return;
  if (k === 'f2') { [c.campeao] = vencedores; c.vice = c.chaves[0].find(x => x !== c.campeao); c.chaves = []; return; }
  const r = rng(`sorteio${s.seed}-${s.ano}-${c.fase}`), l = shuffle(r, vencedores);
  c.chaves = []; for (let i = 0; i < l.length; i += 2) c.chaves.push([l[i], l[i + 1]]);
}
// até onde o clube foi
export function campanha(s, ci) {
  const c = s.copa; if (!c) return null;
  if (c.campeao === ci) return 'Campeão';
  if (c.vice === ci) return 'Vice-campeão';
  const jogou = c.jogos.filter(j => j.h === ci || j.a === ci);
  if (!jogou.length) return naCopa(s, ci) ? 'Na disputa' : null;
  if (naCopa(s, ci)) return `Na disputa (${FASES[c.fase].curto})`;
  return `Eliminado ${{ '1f': 'na 1ª fase', oit: 'nas oitavas', qua: 'nas quartas', sem: 'na semifinal' }[FASES[jogou.at(-1).fase].k]}`;
}
