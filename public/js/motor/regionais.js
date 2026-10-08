// Regionais da CBF (calendário 2026-2029), de 25 de março a 7 de junho, com os grupos reais de 2026:
// - Copa do Nordeste: 20 clubes em 4 grupos de 5; turno único contra o grupo vizinho (A×B, C×D), 5 jogos.
//   Os 2 primeiros de cada grupo vão às quartas (jogo único); semi e final em ida e volta.
// - Copa Sul-Sudeste: 12 clubes em 2 grupos de 6; turno único contra o outro grupo, 6 jogos. Os 2 primeiros de cada
//   grupo vão à semi (ida e volta); final em ida e volta. Campeão vai à 3ª fase da Copa do Brasil do ano seguinte.
// - Copa Verde: 24 clubes em 4 grupos de 6 (A e B = Copa Norte, C e D = Copa Centro-Oeste), turno único dentro do
//   grupo. Quartas em jogo único e semi em ida e volta valem os títulos da Copa Norte e da Copa Centro-Oeste (os dois
//   campeões vão à Copa do Brasil); os dois decidem a Copa Verde em ida e volta.
// Clubes na Libertadores ou na Sul-Americana não disputam regional. Clube que não está na base entra com elenco gerado.
import { pontosCorridos } from './calendario.js';
import { penaltis } from './copa.js';

const G5 = ['26/03', '29/03', '09/04', '16/04', '30/04'], G6 = ['26/03', '29/03', '09/04', '16/04', '23/04', '30/04'];
const MATA = { qf: ['07/05'], sf: ['21/05', '28/05'], f: ['04/06', '07/06'] };
export const REGIONAIS = {
  NE: {
    nome: 'Copa do Nordeste', formato: 'cruzado', pares: [[0, 1], [2, 3]], datas: G5, mata: ['qf', 'sf', 'f'],
    grupos: [['Vitória', 'ASA', 'Sousa', 'Itabaiana', 'Fluminense-PI'], ['Juazeirense', 'CRB', 'Botafogo-PB', 'Confiança', 'Piauí'], ['Ceará', 'Sport', 'América-RN', 'Imperatriz', 'Ferroviário'], ['Fortaleza', 'Retrô', 'ABC', 'Maranhão', 'Jacuipense']],
    ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
    premio: { cota: 3e5, vitoria: 4e4, qf: 1.5e5, sf: 3e5, f: 5e5, campeao: 1.2e6 },
  },
  SS: {
    nome: 'Copa Sul-Sudeste', formato: 'cruzado', pares: [[0, 1]], datas: G6, mata: ['sf', 'f'],
    grupos: [['Sampaio Corrêa-RJ', 'Novorizontino', 'Caxias', 'Tombense', 'Cianorte', 'Chapecoense'], ['Volta Redonda', 'São Bernardo', 'Juventude', 'América-MG', 'Operário-PR', 'Avaí']],
    ufs: ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS'],
    premio: { cota: 2e5, vitoria: 3e4, sf: 2e5, f: 4e5, campeao: 8e5 },
  },
  VE: {
    nome: 'Copa Verde', formato: 'turno', datas: G5, mata: ['qf', 'sf', 'f'], regioes: ['Copa Norte', 'Copa Centro-Oeste'],
    grupos: [['Nacional-AM', 'Paysandu', 'Independência', 'Guaporé', 'Trem', 'Grêmio Sampaio'], ['Amazonas', 'Remo', 'Galvez', 'Gazin Porto Velho', 'Águia de Marabá', 'Monte Roraima'],
      ['Primavera', 'Vila Nova', 'Capital-DF', 'Rio Branco-ES', 'Araguaína', 'Operário-MS'], ['Cuiabá', 'Atlético-GO', 'Gama', 'Porto Vitória', 'Tocantinópolis', 'Anápolis']],
    ufs: [['AM', 'PA', 'AC', 'RO', 'AP', 'RR'], ['GO', 'DF', 'MT', 'MS', 'TO', 'ES']],
    premio: { cota: 1.2e5, vitoria: 2e4, qf: 8e4, sf: 1.5e5, f: 2.5e5, campeao: 5e5 },
  },
};
// estado dos clubes da base (para trocar quem foi para a Libertadores/Sul-Americana nos anos seguintes)
const UF = { 'Athletico-PR': 'PR', Fluminense: 'RJ', Internacional: 'RS', Cruzeiro: 'MG', 'Grêmio': 'RS', Bahia: 'BA', Palmeiras: 'SP', Coritiba: 'PR', Remo: 'PA', 'São Paulo': 'SP', Santos: 'SP', 'Vitória': 'BA', Chapecoense: 'SC', Flamengo: 'RJ', Mirassol: 'SP', 'Atlético-MG': 'MG', Botafogo: 'RJ', Corinthians: 'SP', Vasco: 'RJ', Bragantino: 'SP',
  Fortaleza: 'CE', Sport: 'PE', Juventude: 'RS', 'Ceará': 'CE', 'Goiás': 'GO', Novorizontino: 'SP', Athletic: 'MG', 'Criciúma': 'SC', 'Atlético-GO': 'GO', CRB: 'AL', 'Vila Nova': 'GO', 'Cuiabá': 'MT', 'Operário-PR': 'PR', 'Avaí': 'SC', 'São Bernardo': 'SP', 'Botafogo-SP': 'SP', Londrina: 'PR', 'América-MG': 'MG', 'Ponte Preta': 'SP', 'Náutico': 'PE',
  Amazonas: 'AM', 'Volta Redonda': 'RJ', 'Santa Cruz': 'PE', Barra: 'SC', 'Ferroviária': 'SP', Figueirense: 'SC', Paysandu: 'PA', Caxias: 'RS', Guarani: 'SP', Itabaiana: 'SE', Brusque: 'SC', Floresta: 'CE', 'Confiança': 'SE', 'Maranhão': 'MA', Ypiranga: 'RS', 'Inter de Limeira': 'SP', 'Maringá': 'PR', Ituano: 'SP', 'Botafogo-PB': 'PB', 'Anápolis': 'GO' };

// ---------- datas ----------
const DIA = 864e5;
// dia e mês do calendário real; se cair no dia de uma rodada do Brasileirão, vai para o dia seguinte
export function dataReg(dataRodada, ano, dm) {
  const [d, m] = dm.split('/').map(Number), dt = new Date(Date.UTC(ano, m - 1, d));
  const liga = new Set(Array.from({ length: 38 }, (_, r) => +dataRodada(ano, r)));
  while (liga.has(+dt)) dt.setUTCDate(dt.getUTCDate() + 1);
  return dt;
}
// fases: rodadas de grupo, depois o mata-mata (jogo único ou ida e volta)
export function fasesReg(k) {
  const R = REGIONAIS[k], f = R.datas.map((d, i) => ({ k: 'g', nome: `Grupos · ${i + 1}ª rodada`, curto: `Grupos ${i + 1}`, data: d }));
  for (const m of R.mata) {
    const nome = { qf: 'Quartas de final', sf: 'Semifinal', f: 'Final' }[m], ida = MATA[m];
    if (ida.length === 1) f.push({ k: m, nome, curto: nome.split(' ')[0], data: ida[0], unico: true });
    else f.push({ k: m, nome: `${nome} · ida`, curto: `${nome.split(' ')[0]} (ida)`, data: ida[0], ida: true }, { k: m, nome: `${nome} · volta`, curto: `${nome.split(' ')[0]} (volta)`, data: ida[1], volta: true });
  }
  if (k === 'VE') for (const x of f) if (x.k === 'sf') x.nome = x.nome.replace('Semifinal', 'Final regional'), x.curto = x.curto.replace('Semifinal', 'Final reg.');
  return f;
}
export const dataFaseReg = (dataRodada, ano, k, i) => dataReg(dataRodada, ano, fasesReg(k)[i].data);

// ---------- montagem ----------
function participantes(base, s, k) {
  const R = REGIONAIS[k], idx = n => base.clubes.findIndex(c => c.n === n && c.div !== 'L');
  const conm = new Set(['LIB', 'SUL'].flatMap(x => s.cont?.ano === s.ano ? s.cont[x]?.grupos.flat() || [] : []));
  const base0 = s.ano === 2026 ? R.grupos.map(g => g.map(idx)) : (s.reg?.[k]?.grupos || R.grupos.map(g => g.map(idx)));
  const usados = new Set(base0.flat());
  // quem está na Libertadores/Sul-Americana sai; entra o mais forte da mesma região que ainda não joga
  const ufsDe = gi => k === 'VE' ? R.ufs[gi < 2 ? 0 : 1] : R.ufs;
  return base0.map((g, gi) => g.map(ci => {
    if (ci >= 0 && !conm.has(ci)) return ci;
    const sub = base.clubes.map((c, i) => i).filter(i => ['A', 'B', 'C'].includes(base.clubes[i].div) && ufsDe(gi).includes(UF[base.clubes[i].n]) && !usados.has(i) && !conm.has(i))
      .sort((a, b) => base.forca(b) - base.forca(a))[0];
    if (sub != null) { usados.add(sub); return sub; }
    return ci;
  }).filter(ci => ci >= 0));
}
export function novaReg(base, s) {
  const r = {};
  for (const k of Object.keys(REGIONAIS)) {
    const grupos = participantes(base, s, k);
    // turno único dentro do grupo (Copa Verde): calendário do círculo, só o turno
    const tabelaTurno = REGIONAIS[k].formato === 'turno' ? grupos.map((g, gi) => pontosCorridos(g, `${s.seed}-${k}${s.ano}-${gi}`).slice(0, g.length - 1)) : null;
    r[k] = { k, ano: s.ano, grupos, turno: tabelaTurno, fase: 0, jogos: [], chaves: [], campeao: null, vice: null, regionais: k === 'VE' ? [null, null] : null };
  }
  s.reg = { ano: s.ano, ...r };
  return s.reg;
}

// ---------- jogos de cada fase ----------
export function jogosDaFaseReg(T) {
  const R = REGIONAIS[T.k], F = fasesReg(T.k)[T.fase];
  if (!F) return [];
  if (F.k === 'g') {
    if (R.formato === 'turno') return T.turno.flatMap(rodadas => rodadas[T.fase] || []);
    return R.pares.flatMap(([x, y]) => { const A = T.grupos[x], B = T.grupos[y], n = A.length; return A.map((c, i) => { const o = B[(i + T.fase) % n]; return (i + T.fase) % 2 ? [o, c] : [c, o]; }); });
  }
  return T.chaves.map(([a, b]) => F.volta ? [b, a] : [a, b]);
}
export const naReg = (s, k, ci) => { const T = s.reg?.[k]; return !!T && T.fase < fasesReg(k).length && jogosDaFaseReg(T).some(j => j.includes(ci)); };
export const emQualReg = (s, ci) => Object.keys(REGIONAIS).find(k => s.reg?.[k]?.grupos.some(g => g.includes(ci))) || null;
// fase pendente: a data dela já chegou antes da próxima rodada do Brasileirão
export const regDevida = (s, k, dataRodada) => { const T = s.reg?.[k]; return !!T && T.ano === s.ano && T.fase < fasesReg(k).length && +dataFaseReg(dataRodada, s.ano, k, T.fase) < +dataRodada(s.ano, s.rodada); };
// agregado da ida, visto do mandante da volta
export function agregadoReg(T, h, a) { const ida = T.jogos.find(j => j.fase === T.fase - 1 && j.h === a && j.a === h); return ida ? [ida.gols[1], ida.gols[0]] : [0, 0]; }

// classificação de um grupo: conta só os jogos da fase de grupos de quem é do grupo (no cruzado o adversário é do outro)
export function tabelaReg(T, g) {
  const L = new Map(T.grupos[g].map(c => [c, { clube: c, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }]));
  for (const j of T.jogos) if (j.g) for (const [c, eu, ele] of [[j.h, j.gols[0], j.gols[1]], [j.a, j.gols[1], j.gols[0]]]) {
    const l = L.get(c); if (!l) continue;
    l.j++; l.gp += eu; l.gc += ele;
    if (eu > ele) { l.v++; l.p += 3; } else if (eu < ele) l.d++; else { l.e++; l.p++; }
  }
  return [...L.values()].map(l => ({ ...l, sg: l.gp - l.gc })).sort((a, b) => b.p - a.p || b.v - a.v || b.sg - a.sg || b.gp - a.gp || a.clube - b.clube);
}
const campanha = (T, c) => { for (let g = 0; g < T.grupos.length; g++) { const t = tabelaReg(T, g), i = t.findIndex(x => x.clube === c); if (i >= 0) return t[i].p * 100 + t[i].sg - i * 1000; } return 0; };
// quem fez mais nos grupos manda o jogo único / a volta
const ordem = (T, x, y) => campanha(T, x) >= campanha(T, y) ? [x, y] : [y, x];

// decide o jogo (ou o confronto, na volta) e devolve o vencedor
export function decidirReg(T, h, a, gols, seed, campo) {
  const F = fasesReg(T.k)[T.fase];
  if (F.k === 'g' || F.ida) return {};
  let ag = gols;
  if (F.volta) { const ida = T.jogos.find(j => j.fase === T.fase - 1 && j.h === a && j.a === h); ag = [gols[0] + (ida?.gols[1] || 0), gols[1] + (ida?.gols[0] || 0)]; }
  if (ag[0] !== ag[1]) return { vencedor: ag[0] > ag[1] ? h : a, agg: F.volta ? ag : null };
  const pen = penaltis(seed, campo);
  return { vencedor: pen[0] > pen[1] ? h : a, pen: [pen[0], pen[1]], agg: F.volta ? ag : null };
}
// fecha a fase e monta a próxima
export function avancarReg(T, vencedores) {
  const fases = fasesReg(T.k), F = fases[T.fase++], prox = fases[T.fase];
  if (F.k === 'g' && prox?.k !== 'g') {
    const t = T.grupos.map((g, i) => tabelaReg(T, i)), c = [];
    for (let g = 0; g < t.length; g += 2) c.push(ordem(T, t[g][0].clube, t[g + 1][1].clube), ordem(T, t[g + 1][0].clube, t[g][1].clube));
    // ida e volta: quem fez campanha pior manda a ida
    T.chaves = prox.ida ? c.map(([x, y]) => [y, x]) : c;
    return;
  }
  if (F.k === 'g' || F.ida) return;                                     // ida: a chave segue para a volta
  if (!prox) { T.campeao = vencedores[0]; T.vice = T.chaves[0].flat().find(c => c !== T.campeao); T.chaves = []; return; }
  if (T.k === 'VE' && F.k === 'sf') T.regionais = vencedores.slice();  // campeões da Copa Norte e da Copa Centro-Oeste
  const c = []; for (let i = 0; i < vencedores.length; i += 2) c.push(ordem(T, vencedores[i], vencedores[i + 1]));
  T.chaves = prox.ida ? c.map(([x, y]) => [y, x]) : c;
}
export function campanhaReg(s, k, ci) {
  const T = s.reg?.[k]; if (!T || !T.grupos.some(g => g.includes(ci))) return null;
  if (T.campeao === ci) return 'Campeão';
  if (T.vice === ci) return 'Vice-campeão';
  if (T.regionais?.includes(ci)) return `Campeão da ${REGIONAIS.VE.regioes[T.regionais.indexOf(ci)]}`;
  if (naReg(s, k, ci) || T.fase < REGIONAIS[k].datas.length) return T.fase < REGIONAIS[k].datas.length ? 'Fase de grupos' : `Na disputa (${fasesReg(k)[T.fase].curto})`;
  const ult = T.jogos.filter(j => j.h === ci || j.a === ci).at(-1);
  return ult && !ult.g ? `Eliminado (${fasesReg(k)[ult.fase].curto})` : 'Eliminado na fase de grupos';
}
// vagas da Copa do Brasil do ano seguinte para os campeões (só clubes da base com elenco real)
export const vagasCopaDoBrasil = s => Object.values(s.reg || {}).filter(T => T?.k).flatMap(T => T.k === 'VE' ? T.regionais || [] : T.k === 'NE' || T.k === 'SS' ? [T.campeao] : []).filter(c => c != null);
