// Data FIFA: quatro janelas por temporada. Cada seleção convoca 26 com estrutura por posição e no máximo 5 do mesmo
// clube; quem joga no Brasil desfalca o clube por 2 rodadas (qualquer competição) e ganha moral pela convocação.
import { clamp, PAISES } from './util.js';
import { faseDe } from './forma.js';

export const DATAS_FIFA = [17, 24, 30];   // rodada do Brasileirão em que sai a convocação (setembro, outubro e novembro; a de março cai nos regionais)
export const ESTRUTURA = { GOL: 3, ZAG: 4, LD: 2, LE: 2, VOL: 3, MC: 2, MEI: 2, PE: 2, PD: 2, CA: 4 };
const BR = ['A', 'B', 'C'];
const lista = n => n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} e ${n.at(-1)}`;

export const naSelecao = (s, id) => s.convocados?.ano === s.ano && s.rodada < s.convocados.ate && s.convocados.ids.includes(+id);

// os 26 de uma seleção: melhores por posição (a fase pesa), sem passar de 5 por clube
export function convocar(s, jogadores) {
  const vagas = { ...ESTRUTURA }, porClube = {}, out = [];
  for (const [j] of jogadores.map(j => [j, j.ovr + faseDe(s, j.id).d * 1.5]).sort((a, b) => b[1] - a[1])) {
    if (!vagas[j.pos] || (porClube[j.clube] || 0) >= 5) continue;
    vagas[j.pos]--; porClube[j.clube] = (porClube[j.clube] || 0) + 1; out.push(j);
    if (out.length >= 26) break;
  }
  return out;
}

// chamada depois de cada rodada: na data FIFA, todas as seleções com jogador no Brasileirão convocam
export function dataFifa(base, s) {
  if (!DATAS_FIFA.includes(s.rodada) || (s.convocados?.ano === s.ano && s.convocados.rodada === s.rodada) || s.demitido) return [];
  const ci = s.tecnico.clube, porNat = new Map(), nats = new Set();
  for (const j of base.jog.values()) {
    const div = base.clubes[j.clube].div;
    if (j.fora || div === 'L' || j.ovr < 60 || j.idade > 36) continue;
    if (!porNat.has(j.nat)) porNat.set(j.nat, []);
    porNat.get(j.nat).push(j);
    if (BR.includes(div)) nats.add(j.nat);
  }
  const ids = [], bra = [];
  for (const nat of nats) for (const j of convocar(s, porNat.get(nat))) {
    if (nat === 'BRA') bra.push(j.id);
    if (BR.includes(base.clubes[j.clube].div)) ids.push(j.id);
  }
  s.convocados = { ano: s.ano, rodada: s.rodada, ate: s.rodada + 2, ids, bra };
  const meus = ids.map(id => base.jog.get(id)).filter(j => j.clube === ci), brasil = bra.map(id => base.jog.get(id)), daqui = brasil.filter(j => BR.includes(base.clubes[j.clube].div));
  for (const j of meus) s.mor[j.id] = clamp((s.mor[j.id] ?? 62) + 10, 0, 100);
  const N = [{ tipo: 'destaque', clube: ci, texto: `Data FIFA: a Seleção Brasileira convoca 26. ${daqui.length ? `Do Brasileirão: ${lista(daqui.map(j => `${j.curto} (${base.clubes[j.clube].n})`))}.` : 'Ninguém do Brasileirão.'} ${brasil.length - daqui.length ? `Os outros ${brasil.length - daqui.length} jogam fora do país.` : ''}`.trim() }];
  if (meus.length) N.push({ tipo: 'clube', clube: ci, texto: `Convocados: ${lista(meus.map(j => `${j.curto}${j.nat === 'BRA' ? '' : ` (${PAISES[j.nat] || j.nat})`}`))} ${meus.length > 1 ? 'desfalcam' : 'desfalca'} o ${base.clubes[ci].n} nas próximas 2 rodadas.` });
  return N;
}
