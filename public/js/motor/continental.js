// Libertadores e Sul-Americana 2026: 32 clubes em 8 grupos de 4 (turno e returno). Na Libertadores os 2 primeiros vão
// às oitavas e o 3º cai para o playoff da Sul-Americana; na Sul-Americana o 1º vai direto às oitavas e o 2º joga o
// playoff contra um 3º da Libertadores (volta na casa de quem veio da Libertadores). Oitavas, quartas e semi em ida e
// volta, com a volta na casa da melhor campanha; final única em campo neutro.
// Em 2026 os grupos são os do sorteio real; depois, sorteio com potes pela força.
// Supercopa do Brasil: campeão da Série A × campeão da Copa do Brasil, no começo de fevereiro (no meio dos estaduais).
// Clubes de fora entram com o elenco real completado por jogadores gerados (só existem nesses jogos).
import { rng, shuffle, pick, clamp, ATT, PERFIL } from './util.js';
import { melhorTime } from './partida.js';
import { penaltis } from './copa.js';
import { dataCont as diaCont, dataSup as diaSup } from './calendario.js';

export const TORNEIOS = {
  LIB: { nome: 'Libertadores', br: 6, premio: { grupos: 2.5e6, vitoria: 3e5, oit: 1e6, qua: 1.5e6, sem: 2.5e6, fin: 4e6, vice: 0, campeao: 12e6 } },
  SUL: { nome: 'Sul-Americana', br: 6, premio: { grupos: 9e5, vitoria: 1.2e5, oit: 4e5, qua: 6e5, sem: 1e6, fin: 1.5e6, vice: 0, campeao: 5e6 } },
};
export const PREMIO_SUP = { campeao: 3e6, vice: 1e6 };
// 6 rodadas de grupos, playoff (só a Sul-Americana joga; a Libertadores pula), mata-mata em ida e volta e final única
export const FASES_CONT = [
  ...[0, 1, 2, 3, 4, 5].map(i => ({ k: 'g', nome: `Grupos · ${i + 1}ª rodada`, curto: `Grupos ${i + 1}` })),
  ...[['po', 'Playoff', 'Playoff'], ['oit', 'Oitavas de final', 'Oitavas'], ['qua', 'Quartas de final', 'Quartas'], ['sem', 'Semifinal', 'Semi']].flatMap(([k, nome, curto]) => ['ida', 'volta'].map(perna => ({ k, perna, nome: `${nome} · ${perna}`, curto: `${curto} (${perna})` }))),
  { k: 'fin', nome: 'Final', curto: 'Final' },
];
export const F_MATA = 6, F_PO = 6, F_OIT = 8, F_QUA = 10, F_SEM = 12, F_FIN = 14, N_GRUPOS = 8;
export const dataCont = (_, ano, i, k) => diaCont(ano, i, k);
export const dataSup = (_, ano) => diaSup(ano);
// cada par se enfrenta em casa e fora
const RODADAS_G = [[[0, 1], [2, 3]], [[2, 0], [3, 1]], [[0, 3], [1, 2]], [[1, 0], [3, 2]], [[0, 2], [1, 3]], [[3, 0], [2, 1]]];

// ---------- clubes de fora ----------
const NOMES = ['Matías', 'Agustín', 'Facundo', 'Nicolás', 'Lautaro', 'Santiago', 'Franco', 'Joaquín', 'Tomás', 'Gonzalo', 'Ezequiel', 'Rodrigo', 'Maximiliano', 'Federico', 'Juan', 'Diego', 'Sebastián', 'Cristian', 'Brian', 'Emiliano', 'Alexis', 'Kevin', 'Leandro', 'Mauricio', 'Ignacio'];
const SOBRENOMES = ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Sosa', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Ojeda', 'Ledesma', 'Vera', 'Godoy', 'Cabrera', 'Ríos', 'Paredes', 'Villalba', 'Correa', 'Quiroga', 'Castro', 'Molina', 'Peralta', 'Domínguez', 'Ortiz'];
const MINIMO = { GOL: 2, ZAG: 4, LD: 2, LE: 2, VOL: 2, MC: 3, MEI: 2, PE: 2, PD: 2, CA: 3 };
const CONMEBOL = ['ARG', 'URU', 'PAR', 'CHI', 'COL', 'PER', 'EQU', 'BOL', 'VEN'];
export const sulAmericanos = base => base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'X' && CONMEBOL.includes(base.clubes[i].nat));
// vagas dos clubes de fora por país (Conmebol 2026, fase de grupos): Libertadores ARG 6, COL 4, EQU e PER 3, os outros 2;
// Sul-Americana ARG 6, URU, CHI e VEN 3, os outros 2. Como as ligas de lá não são simuladas, vai o elenco mais forte do país.
const COTA = { LIB: { ARG: 6, COL: 4, EQU: 3, PER: 3, URU: 2, PAR: 2, CHI: 2, BOL: 2, VEN: 2 }, SUL: { ARG: 6, URU: 3, CHI: 3, VEN: 3, COL: 2, PER: 2, EQU: 2, PAR: 2, BOL: 2 } };
// n clubes pela cota do país, na ordem da lista; sobra ou falta de vaga (o número de brasileiros muda com os repasses)
// corta os últimos ou completa com os primeiros que ficaram de fora
function porCota(base, k, n, lista) {
  const cota = { ...COTA[k] }, dentro = new Set(lista.filter(ci => cota[base.clubes[ci].nat]-- > 0));
  for (const ci of lista) if (dentro.size < n) dentro.add(ci);
  return lista.filter(ci => dentro.has(ci)).slice(0, n);
}
// clube sem elenco completo na base: de fora (X) ou só dos regionais (R)
export const deFora = c => c.div === 'X' || c.div === 'R';
const NOMES_BR = ['Kauã', 'Gabriel', 'Davi', 'Pedro', 'Enzo', 'Arthur', 'Miguel', 'Heitor', 'Ryan', 'Kaique', 'Luan', 'Vitor', 'Igor', 'Caio', 'Rafael', 'Matheus', 'João', 'Lucas', 'Wesley', 'Yuri', 'Murilo', 'Thiago', 'Samuel', 'Breno', 'Gustavo', 'Diego', 'Renan', 'Erick', 'Wallace', 'Kelvin', 'Patrick', 'Ruan', 'Felipe', 'André', 'Leandro', 'Jefferson', 'Alisson', 'Cleiton', 'Dudu', 'Juninho'];
const SOBRENOMES_BR = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Araújo', 'Ribeiro', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Moura', 'Teixeira', 'Cardoso', 'Freitas', 'Nunes', 'Mendes', 'Batista', 'Vieira', 'Monteiro', 'Dias', 'Campos', 'Ramos', 'Farias', 'Moreira', 'Cunha', 'Lopes', 'Brito', 'Sales', 'Macedo', 'Bezerra', 'Cavalcante', 'Queiroz'];

// cache por base; esvazia quando a base muda (antes a chave levava a versão e o mapa só crescia)
const caches = new WeakMap();
// elenco de jogo: os reais do clube + gerados para completar as posições (ids negativos e fixos por clube e ano)
export function elencoFora(base, ci, ano) {
  let C = caches.get(base);
  if (!C || C.versao !== base._versao) caches.set(base, C = { versao: base._versao, m: new Map() });
  const k = `${ci}-${ano}`, cache = C.m;
  if (cache.has(k)) return cache.get(k);
  const c = base.clubes[ci], reais = base.elencos[ci].slice(), r = rng(`fora${ci}-${ano}`), conta = {}, usados = new Set(reais.map(j => j.num));
  for (const j of reais) conta[j.pos] = (conta[j.pos] || 0) + 1;
  const extra = [];
  for (const [pos, n] of Object.entries(MINIMO)) for (let q = conta[pos] || 0; q < n; q++) {
    const br = c.nat === 'BRA', ovr = clamp(Math.round((c.lvl || 66) + (r() - 0.5) * 8), 38, 82), sob = pick(r, br ? SOBRENOMES_BR : SOBRENOMES);
    let num = pos === 'GOL' ? 12 : 2; while (usados.has(num)) num++; usados.add(num);
    extra.push({ id: -(9e6 + ci * 100 + extra.length), nome: `${pick(r, br ? NOMES_BR : NOMES)} ${sob}`, curto: sob, clube: ci, pos, idade: 19 + Math.floor(r() * 13), nat: c.nat || 'ARG', ovr, valor: 0, contrato: ano + 1, pot: ovr, rosto: '0000000000', num, gerado: true,
      att: Object.fromEntries(ATT.map((a, i) => [a, clamp(Math.round(ovr + PERFIL[pos][i] + (r() - 0.5) * 8), 20, 99)])) });
  }
  const el = [...reais, ...extra];
  cache.set(k, el);
  return el;
}
export const forcaCont = (base, ci, ano) => {
  if (!deFora(base.clubes[ci])) return base.forca(ci);
  const t = elencoFora(base, ci, ano).map(j => j.ovr).sort((a, b) => b - a).slice(0, 16);
  return t.reduce((a, b) => a + b, 0) / t.length;
};
// jogador de qualquer clube das copas (inclusive os gerados)
export const jogadorCont = (base, ano, id) => base.jog.get(+id) || (id < -9e6 ? elencoFora(base, Math.floor((-id - 9e6) / 100), ano).find(j => j.id === +id) : null);

const FORM_FORA = ['4-3-3', '4-4-2', '4-2-3-1', '4-3-1-2', '3-5-2', '4-4-1-1'];
export function timeFora(base, s, ci) {
  const r = rng(`tatfora${ci}`), el = elencoFora(base, ci, s.ano);
  const t = melhorTime(el, pick(r, FORM_FORA), new Set(), s.cond || {});
  return { ...t, estilo: pick(r, ['equilibrado', 'contra', 'equilibrado', 'pressao', 'direto']), gatilhos: { perdendo60: { estilo: 'pressao' } }, cobrador: null };
}

// ---------- sorteio e vagas ----------
// Regra de 2026: G5 da Série A na Libertadores (o 5º na pré, que aqui entra direto nos grupos), mais o campeão e o vice
// da Copa do Brasil e os campeões brasileiros da Libertadores e da Sul-Americana. Quem já está classificado pela tabela
// não ocupa duas vagas: a vaga dele passa para o próximo da Série A. Sul-Americana: os 6 seguintes da tabela.
// 1ª temporada: pela força do elenco.
export function vagasBR(base, s) {
  const cl = s.classif, br = c => c != null && ['A', 'B', 'C'].includes(base.clubes[c].div);
  const A = cl?.A || base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A').sort((a, b) => base.forca(b) - base.forca(a));
  const lib = A.slice(0, 5), repasses = [];
  const proximo = () => A.find(c => !lib.includes(c));
  for (const [c, por] of [[cl?.lib, 'campeão da Libertadores'], [cl?.sul, 'campeão da Sul-Americana'], [cl?.copa, 'campeão da Copa do Brasil'], [cl?.copaVice, 'vice da Copa do Brasil']]) {
    if (!br(c)) continue;
    if (!lib.includes(c)) { lib.push(c); continue; }
    const p = proximo(); if (p == null) continue;
    lib.push(p); repasses.push({ clube: p, de: c, por, pos: A.indexOf(p) + 1 });
  }
  const sul = A.filter(c => !lib.includes(c) && base.clubes[c].div === 'A').slice(0, 6);
  return { LIB: lib, SUL: sul, repasses };
}
// 4 potes de 8 pela força; cada pote espalha os clubes pelos 8 grupos evitando dois do mesmo país no grupo
function sortear(base, s, k, clubes) {
  const r = rng(`sorteio-${k}-${s.seed}-${s.ano}`), ord = clubes.slice().sort((a, b) => forcaCont(base, b, s.ano) - forcaCont(base, a, s.ano));
  const grupos = Array.from({ length: N_GRUPOS }, () => []), pais = ci => base.clubes[ci].div === 'X' ? base.clubes[ci].nat : 'BRA';
  for (let p = 0; p < 4; p++) for (const ci of shuffle(r, ord.slice(p * N_GRUPOS, p * N_GRUPOS + N_GRUPOS))) {
    const livres = grupos.filter(g => g.length === p), sem = livres.filter(g => !g.some(x => pais(x) === pais(ci)));
    (sem[0] || livres[0]).push(ci);
  }
  return grupos;
}
// sorteio real de 2026 (Conmebol, março de 2026): nomes como estão na base
const REAIS_2026 = {
  LIB: [['Flamengo', 'Estudiantes', 'Cusco FC', 'Independiente Medellín'], ['Nacional', 'Universitario', 'Coquimbo Unido', 'Deportes Tolima'], ['Fluminense', 'Bolívar', 'Deportivo La Guaira', 'Ind. Rivadavia'], ['Boca Juniors', 'Cruzeiro', 'Universidad Católica', 'Barcelona de Guayaquil'],
    ['Peñarol', 'Corinthians', 'Independiente Santa Fe', 'Platense'], ['Palmeiras', 'Cerro Porteño', 'Junior Barranquilla', 'Sporting Cristal'], ['LDU Quito', 'Lanús', 'Always Ready', 'Mirassol'], ['Independiente del Valle', 'Libertad', 'Rosario Central', 'Universidad Central']],
  SUL: [['América de Cali', 'Tigre', 'Macará', 'Alianza Atlético'], ['Atlético-MG', 'Cienciano', 'Academia Puerto Cabello', 'Juventud de Las Piedras'], ['São Paulo', 'Millonarios', 'Boston River', "O'Higgins"], ['Santos', 'San Lorenzo', 'Deportivo Cuenca', 'Recoleta'],
    ['Racing', 'Caracas', 'Independiente Petrolero', 'Botafogo'], ['Grêmio', 'Palestino', 'Montevideo City Torque', 'Deportivo Riestra'], ['Olimpia', 'Vasco', 'Audax Italiano', 'Barracas Central'], ['River Plate', 'Bragantino', 'Blooming', 'Carabobo']],
};
function gruposReais(base, k) {
  const idx = n => base.clubes.findIndex(c => c.n === n && c.div !== 'L');
  const g = REAIS_2026[k].map(l => l.map(idx));
  return g.flat().every(i => i >= 0) ? g : null;
}
export function novaCont(base, s) {
  const br = vagasBR(base, s); s.repasses = br.repasses;
  // o campeão de fora da Libertadores ou da Sul-Americana volta à Libertadores
  const campeoes = [s.classif?.lib, s.classif?.sul].filter(c => c != null && base.clubes[c]?.div === 'X');
  const fora = [...new Set([...campeoes, ...sulAmericanos(base).sort((a, b) => (base.clubes[b].lvl + base.clubes[b].fan * 0.4) - (base.clubes[a].lvl + base.clubes[a].fan * 0.4))])];
  const reais = s.ano === 2026 && !s.classif;
  const torneio = (k, clubes) => ({ k, ano: s.ano, grupos: (reais && gruposReais(base, k)) || sortear(base, s, k, clubes), fase: 0, jogos: [], chaves: [], art: {}, campeao: null, vice: null });
  const cl = s.classif, Aord = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A').sort((a, b) => base.forca(b) - base.forca(a));
  const campA = cl?.A?.[0] ?? Aord[0], campCopa = cl?.copa ?? Aord[1];
  const nLib = N_GRUPOS * 4 - br.LIB.length, nSul = N_GRUPOS * 4 - br.SUL.length;
  const libF = porCota(base, 'LIB', nLib, fora), sulF = porCota(base, 'SUL', nSul, fora.filter(c => !libF.includes(c)));
  s.cont = { ano: s.ano, LIB: torneio('LIB', [...br.LIB, ...libF]), SUL: torneio('SUL', [...br.SUL, ...sulF]),
    sup: { h: campA, a: campCopa !== campA ? campCopa : (cl?.A?.[1] ?? Aord[1]), jogo: null } };
  return s.cont;
}

// ---------- andamento ----------
// playoff da Sul-Americana: os 2º da Sula contra os 3º da Libertadores (que já fechou os grupos no mesmo dia, antes)
function garantirPlayoff(s) {
  const T = s.cont?.SUL, L = s.cont?.LIB;
  if (!T || T.fase !== F_PO || T.chaves.length || !L || L.fase < F_MATA) return;
  const r = rng(`playoff-${s.seed}-${s.ano}`), terceiros = shuffle(r, L.grupos.map((g, i) => tabelaGrupo(L, i)[2].clube)), segundos = T.grupos.map((g, i) => tabelaGrupo(T, i)[1].clube);
  T.chaves = segundos.map((c, i) => [terceiros[i], c]); // [manda a volta, outro]
  T.vindos = terceiros;
}
const ativa = (s, k) => !!s.cont?.[k] && s.cont.ano === s.ano && s.cont[k].fase < FASES_CONT.length;
export const contDevida = (s, k, ate) => { garantirPlayoff(s); return ativa(s, k) && +diaCont(s.ano, s.cont[k].fase, k) <= +ate; };
export const naCont = (s, k, ci) => { garantirPlayoff(s); const T = s.cont?.[k]; if (!ativa(s, k)) return false; return T.fase < F_MATA ? T.grupos.some(g => g.includes(ci)) : T.chaves.some(c => c.includes(ci)); };
export const supDevida = s => !!s.cont?.sup && !s.cont.sup.jogo && s.cont.ano === s.ano;
export const emQualCont = (s, ci) => ['LIB', 'SUL'].find(k => s.cont?.[k] && (s.cont[k].grupos.some(g => g.includes(ci)) || s.cont[k].vindos?.includes(ci))) || null;

// mata-mata: chave = [quem fez mais pontos nos grupos, outro]; o melhor manda a volta (e a ida fica com o outro)
const mando = (f, [x, y]) => FASES_CONT[f].perna === 'ida' ? [y, x] : [x, y];
// jogo do clube numa fase (grupos: dá para saber de antemão; mata-mata: quando a chave existe, ida e volta)
export function jogoDoClube(T, f, ci) {
  if (f < F_MATA) { const g = T.grupos.find(x => x.includes(ci)); if (!g) return null; const p = RODADAS_G[f].find(([x, y]) => g[x] === ci || g[y] === ci); return [g[p[0]], g[p[1]]]; }
  const ok = f === T.fase || (FASES_CONT[f].perna === 'volta' && f === T.fase + 1), c = ok && T.chaves.find(x => x.includes(ci));
  return c ? mando(f, c) : null;
}
export function jogosDaFase(T) {
  if (T.fase < F_MATA) return T.grupos.flatMap(g => RODADAS_G[T.fase].map(([x, y]) => [g[x], g[y]]));
  return T.chaves.map(c => mando(T.fase, c));
}
// gols da ida, vistos pelo mandante da volta
export function agregadoCont(T, h, a) { const ida = T.jogos.find(j => j.fase === T.fase - 1 && j.h === a && j.a === h); return ida ? [ida.gols[1], ida.gols[0]] : [0, 0]; }
export function tabelaGrupo(T, g) {
  const L = new Map(T.grupos[g].map(c => [c, { clube: c, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, ult: [] }]));
  for (const j of T.jogos) if (j.fase < F_MATA && L.has(j.h) && L.has(j.a)) {
    const H = L.get(j.h), A = L.get(j.a), [x, y] = j.gols;
    H.j++; A.j++; H.gp += x; H.gc += y; A.gp += y; A.gc += x;
    H.ult.push(x > y ? 'V' : x < y ? 'D' : 'E'); A.ult.push(y > x ? 'V' : y < x ? 'D' : 'E');
    if (x > y) { H.v++; H.p += 3; A.d++; } else if (x < y) { A.v++; A.p += 3; H.d++; } else { H.e++; A.e++; H.p++; A.p++; }
  }
  return [...L.values()].map(l => ({ ...l, sg: l.gp - l.gc })).sort((a, b) => b.p - a.p || b.sg - a.sg || b.gp - a.gp || b.v - a.v || a.clube - b.clube);
}
const pontosGrupo = (T, c) => { for (let g = 0; g < T.grupos.length; g++) { const l = tabelaGrupo(T, g).find(x => x.clube === c); if (l) return l.p * 100 + l.sg; } return T.vindos?.includes(c) ? 500 : 0; };

// mata-mata: decide na volta pelo agregado (na final, o jogo único); empate vai para os pênaltis (mesma semente da súmula)
export function decidirCont(T, fase, h, a, gols, seed, campo) {
  if (fase < F_MATA || FASES_CONT[fase].perna === 'ida') return {};
  const volta = FASES_CONT[fase].perna === 'volta', ag = volta ? agregadoCont(T, h, a) : [0, 0], t = [gols[0] + ag[0], gols[1] + ag[1]], agg = volta ? t : null;
  if (t[0] !== t[1]) return { vencedor: t[0] > t[1] ? h : a, perdedor: t[0] > t[1] ? a : h, agg };
  const pen = penaltis(seed, campo);
  return { vencedor: pen[0] > pen[1] ? h : a, perdedor: pen[0] > pen[1] ? a : h, pen: [pen[0], pen[1]], seq: pen.seq, agg };
}
// fecha a fase: na Libertadores os grupos viram oitavas (1º de um grupo × 2º do vizinho: A×B, C×D...); na Sula vem o
// playoff e depois os líderes de grupo pegam os vencedores do playoff (líder manda a volta). Final em campo neutro.
export function avancarCont(T, vencedores) {
  const f = T.fase++;
  if (f < F_MATA - 1 || FASES_CONT[f].perna === 'ida') return;
  const casa = (x, y) => pontosGrupo(T, x) >= pontosGrupo(T, y) ? [x, y] : [y, x];
  if (f === F_MATA - 1) {
    const t = T.grupos.map((g, i) => tabelaGrupo(T, i));
    T.chaves = [];
    if (T.k === 'SUL') { T.lideres = t.map(g => g[0].clube); return; } // o playoff é montado quando a Libertadores fechar os grupos
    for (let g = 0; g < t.length; g += 2) T.chaves.push(casa(t[g][0].clube, t[g + 1][1].clube), casa(t[g + 1][0].clube, t[g][1].clube));
    T.fase = F_OIT; // a Libertadores não tem playoff
    return;
  }
  if (f === F_PO + 1) { T.chaves = T.lideres.map((c, i) => [c, vencedores[(i + 1) % vencedores.length]]); return; } // líder não reencontra o 2º do próprio grupo
  if (f === F_FIN) { T.campeao = vencedores[0]; T.vice = T.chaves[0].find(c => c !== T.campeao); T.chaves = []; return; }
  T.chaves = []; for (let i = 0; i < vencedores.length; i += 2) T.chaves.push(f === F_SEM + 1 ? [vencedores[i], vencedores[i + 1]] : casa(vencedores[i], vencedores[i + 1]));
}
// pontos de quem veio da Libertadores contam como os da Sula para o mando (fez campanha de grupo também)

export function campanhaCont(s, k, ci) {
  const T = s.cont?.[k]; if (!T || !(T.grupos.some(g => g.includes(ci)) || T.vindos?.includes(ci))) return null;
  if (T.campeao === ci) return 'Campeão';
  if (T.vice === ci) return 'Vice-campeão';
  if (naCont(s, k, ci)) return T.fase < F_MATA ? 'Fase de grupos' : `Na disputa (${FASES_CONT[T.fase].curto})`;
  const ult = T.jogos.filter(j => j.h === ci || j.a === ci).at(-1);
  if (k === 'LIB' && s.cont.SUL?.vindos?.includes(ci)) return 'Terceiro no grupo: foi para a Sul-Americana';
  return ult && ult.fase >= F_MATA ? `Eliminado ${{ po: 'no playoff', oit: 'nas oitavas', qua: 'nas quartas', sem: 'na semifinal' }[FASES_CONT[ult.fase].k]}` : 'Eliminado na fase de grupos';
}
