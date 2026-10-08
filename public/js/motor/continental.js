// Libertadores e Sul-Americana: 32 clubes em 8 grupos de 4 (turno e returno), como na Conmebol; os 2 primeiros vão
// às oitavas; oitavas, quartas e semi em jogo único na casa de quem fez mais pontos nos grupos; final em campo neutro.
// Em 2026 os grupos são os do sorteio real; depois, sorteio com potes pela força.
// Supercopa do Brasil: campeão da Série A × campeão da Copa do Brasil, no começo de fevereiro (no meio dos estaduais).
// Clubes de fora entram com o elenco real completado por jogadores gerados (só existem nesses jogos).
import { rng, shuffle, pick, clamp, ATT, PERFIL } from './util.js';
import { melhorTime } from './partida.js';
import { penaltis } from './copa.js';
import { APOS_CONT, dataCont as diaCont, dataSup as diaSup } from './calendario.js';

export const TORNEIOS = {
  LIB: { nome: 'Libertadores', br: 6, premio: { grupos: 2.5e6, vitoria: 3e5, oit: 1e6, qua: 1.5e6, sem: 2.5e6, fin: 4e6, vice: 0, campeao: 12e6 } },
  SUL: { nome: 'Sul-Americana', br: 6, premio: { grupos: 9e5, vitoria: 1.2e5, oit: 4e5, qua: 6e5, sem: 1e6, fin: 1.5e6, vice: 0, campeao: 5e6 } },
};
export const PREMIO_SUP = { campeao: 3e6, vice: 1e6 };
// 6 rodadas de grupos e 4 de mata-mata, na quarta-feira livre depois da rodada "apos" do Brasileirão
export const FASES_CONT = [
  ...[0, 1, 2, 3, 4, 5].map(i => ({ k: 'g', nome: `Grupos · ${i + 1}ª rodada`, curto: `Grupos ${i + 1}` })),
  { k: 'oit', nome: 'Oitavas de final', curto: 'Oitavas' },
  { k: 'qua', nome: 'Quartas de final', curto: 'Quartas' },
  { k: 'sem', nome: 'Semifinal', curto: 'Semi' },
  { k: 'fin', nome: 'Final', curto: 'Final' },
].map((f, i) => ({ ...f, apos: APOS_CONT[i] }));
export const F_MATA = 6, F_OIT = 6, F_QUA = 7, F_SEM = 8, F_FIN = 9, N_GRUPOS = 8;
export const dataCont = (_, ano, i) => diaCont(ano, i);
export const dataSup = (_, ano) => diaSup(ano);
// cada par se enfrenta em casa e fora
const RODADAS_G = [[[0, 1], [2, 3]], [[2, 0], [3, 1]], [[0, 3], [1, 2]], [[1, 0], [3, 2]], [[0, 2], [1, 3]], [[3, 0], [2, 1]]];

// ---------- clubes de fora ----------
const SUL_AM = { 'Boca Juniors': 'ARG', 'River Plate': 'ARG', Racing: 'ARG', Independiente: 'ARG', Estudiantes: 'ARG', 'Lanús': 'ARG', 'Rosario Central': 'ARG', 'Vélez Sarsfield': 'ARG', 'San Lorenzo': 'ARG', Talleres: 'ARG', 'Argentinos Jrs': 'ARG', 'Huracán': 'ARG', 'Defensa y Justicia': 'ARG', Belgrano: 'ARG', 'Barracas Central': 'ARG', Banfield: 'ARG', 'Gimnasia LP': 'ARG', Instituto: 'ARG', 'Ind. Rivadavia': 'ARG', "Newell's": 'ARG', 'Unión': 'ARG', Tigre: 'ARG', Platense: 'ARG', 'Peñarol': 'URU', Nacional: 'URU', Olimpia: 'PAR', 'Cerro Porteño': 'PAR', Libertad: 'PAR', 'LDU Quito': 'EQU', 'Independiente del Valle': 'EQU', 'Atlético Nacional': 'COL', 'Universidad de Chile': 'CHI' };
const NOMES = ['Matías', 'Agustín', 'Facundo', 'Nicolás', 'Lautaro', 'Santiago', 'Franco', 'Joaquín', 'Tomás', 'Gonzalo', 'Ezequiel', 'Rodrigo', 'Maximiliano', 'Federico', 'Juan', 'Diego', 'Sebastián', 'Cristian', 'Brian', 'Emiliano', 'Alexis', 'Kevin', 'Leandro', 'Mauricio', 'Ignacio'];
const SOBRENOMES = ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Sosa', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Ojeda', 'Ledesma', 'Vera', 'Godoy', 'Cabrera', 'Ríos', 'Paredes', 'Villalba', 'Correa', 'Quiroga', 'Castro', 'Molina', 'Peralta', 'Domínguez', 'Ortiz'];
const MINIMO = { GOL: 2, ZAG: 4, LD: 2, LE: 2, VOL: 2, MC: 3, MEI: 2, PE: 2, PD: 2, CA: 3 };
const CONMEBOL = ['ARG', 'URU', 'PAR', 'CHI', 'COL', 'PER', 'EQU', 'BOL', 'VEN'];
export const sulAmericanos = base => base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'X' && (SUL_AM[base.clubes[i].n] || (base.clubes[i].tier <= 1 && CONMEBOL.includes(base.clubes[i].nat))));
// clube sem elenco completo na base: de fora (X) ou só dos regionais (R)
export const deFora = c => c.div === 'X' || c.div === 'R';
const NOMES_BR = ['Kauã', 'Gabriel', 'Davi', 'Pedro', 'Enzo', 'Arthur', 'Miguel', 'Heitor', 'Ryan', 'Kaique', 'Luan', 'Vitor', 'Igor', 'Caio', 'Rafael', 'Matheus', 'João', 'Lucas', 'Wesley', 'Yuri', 'Murilo', 'Thiago', 'Samuel', 'Breno', 'Gustavo', 'Diego', 'Renan', 'Erick', 'Wallace', 'Kelvin', 'Patrick', 'Ruan', 'Felipe', 'André', 'Leandro', 'Jefferson', 'Alisson', 'Cleiton', 'Dudu', 'Juninho'];
const SOBRENOMES_BR = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Araújo', 'Ribeiro', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Moura', 'Teixeira', 'Cardoso', 'Freitas', 'Nunes', 'Mendes', 'Batista', 'Vieira', 'Monteiro', 'Dias', 'Campos', 'Ramos', 'Farias', 'Moreira', 'Cunha', 'Lopes', 'Brito', 'Sales', 'Macedo', 'Bezerra', 'Cavalcante', 'Queiroz'];

const cache = new Map();
// elenco de jogo: os reais do clube + gerados para completar as posições (ids negativos e fixos por clube e ano)
export function elencoFora(base, ci, ano) {
  const k = `${ci}-${ano}-${base._versao}`;
  if (cache.has(k)) return cache.get(k);
  const c = base.clubes[ci], reais = base.elencos[ci].slice(), r = rng(`fora${ci}-${ano}`), conta = {}, usados = new Set(reais.map(j => j.num));
  for (const j of reais) conta[j.pos] = (conta[j.pos] || 0) + 1;
  const extra = [];
  for (const [pos, n] of Object.entries(MINIMO)) for (let q = conta[pos] || 0; q < n; q++) {
    const br = c.nat === 'BRA', ovr = clamp(Math.round((c.lvl || 66) + (r() - 0.5) * 8), 38, 82), sob = pick(r, br ? SOBRENOMES_BR : SOBRENOMES);
    let num = pos === 'GOL' ? 12 : 2; while (usados.has(num)) num++; usados.add(num);
    extra.push({ id: -(9e6 + ci * 100 + extra.length), nome: `${pick(r, br ? NOMES_BR : NOMES)} ${sob}`, curto: sob, clube: ci, pos, idade: 19 + Math.floor(r() * 13), nat: c.nat || SUL_AM[c.n] || 'ARG', ovr, valor: 0, contrato: ano + 1, pot: ovr, rosto: '0000000000', num, gerado: true,
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
// 1ª temporada: pela força do elenco. Depois: tabela final da Série A do ano anterior; o campeão da Copa do Brasil
// entra na Libertadores (se ainda não estiver).
function vagasBR(base, s) {
  const cl = s.classif, A = cl?.A?.filter(c => base.clubes[c].div === 'A' || c === cl.copa) || base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A').sort((a, b) => base.forca(b) - base.forca(a));
  const lib = A.slice(0, 6);
  if (cl?.copa != null && !lib.includes(cl.copa)) lib[5] = cl.copa;
  const sul = A.filter(c => !lib.includes(c)).slice(0, 6);
  return { LIB: lib, SUL: sul };
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
  const br = vagasBR(base, s), fora = sulAmericanos(base).sort((a, b) => (base.clubes[b].lvl + base.clubes[b].fan * 0.4) - (base.clubes[a].lvl + base.clubes[a].fan * 0.4));
  const reais = s.ano === 2026 && !s.classif;
  const torneio = (k, clubes) => ({ k, ano: s.ano, grupos: (reais && gruposReais(base, k)) || sortear(base, s, k, clubes), fase: 0, jogos: [], chaves: [], art: {}, campeao: null, vice: null });
  const cl = s.classif, Aord = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A').sort((a, b) => base.forca(b) - base.forca(a));
  const campA = cl?.A?.[0] ?? Aord[0], campCopa = cl?.copa ?? Aord[1];
  const nLib = N_GRUPOS * 4 - br.LIB.length, nSul = N_GRUPOS * 4 - br.SUL.length;
  s.cont = { ano: s.ano, LIB: torneio('LIB', [...br.LIB, ...fora.slice(0, nLib)]), SUL: torneio('SUL', [...br.SUL, ...fora.slice(nLib, nLib + nSul)]),
    sup: { h: campA, a: campCopa !== campA ? campCopa : (cl?.A?.[1] ?? Aord[1]), jogo: null } };
  return s.cont;
}

// ---------- andamento ----------
export const contDevida = (s, k) => !!s.cont?.[k] && s.cont[k].fase < FASES_CONT.length && FASES_CONT[s.cont[k].fase].apos < s.rodada;
export const naCont = (s, k, ci) => { const T = s.cont?.[k]; if (!T || T.fase >= FASES_CONT.length) return false; return T.fase < F_MATA ? T.grupos.some(g => g.includes(ci)) : T.chaves.some(c => c.includes(ci)); };
export const supDevida = s => !!s.cont?.sup && !s.cont.sup.jogo && s.cont.ano === s.ano;
export const emQualCont = (s, ci) => ['LIB', 'SUL'].find(k => s.cont?.[k] && (s.cont[k].grupos.some(g => g.includes(ci)))) || null;

// jogo do clube numa fase (grupos: dá para saber de antemão; mata-mata: só quando a chave existe)
export function jogoDoClube(T, f, ci) {
  if (f < F_MATA) { const g = T.grupos.find(x => x.includes(ci)); if (!g) return null; const p = RODADAS_G[f].find(([x, y]) => g[x] === ci || g[y] === ci); return [g[p[0]], g[p[1]]]; }
  return f === T.fase ? T.chaves.find(c => c.includes(ci)) || null : null;
}
export function jogosDaFase(T) {
  if (T.fase < F_MATA) return T.grupos.flatMap(g => RODADAS_G[T.fase].map(([x, y]) => [g[x], g[y]]));
  return T.chaves.map(c => c.slice());
}
export function tabelaGrupo(T, g) {
  const L = new Map(T.grupos[g].map(c => [c, { clube: c, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }]));
  for (const j of T.jogos) if (j.fase < F_MATA && L.has(j.h) && L.has(j.a)) {
    const H = L.get(j.h), A = L.get(j.a), [x, y] = j.gols;
    H.j++; A.j++; H.gp += x; H.gc += y; A.gp += y; A.gc += x;
    if (x > y) { H.v++; H.p += 3; A.d++; } else if (x < y) { A.v++; A.p += 3; H.d++; } else { H.e++; A.e++; H.p++; A.p++; }
  }
  return [...L.values()].map(l => ({ ...l, sg: l.gp - l.gc })).sort((a, b) => b.p - a.p || b.sg - a.sg || b.gp - a.gp || b.v - a.v || a.clube - b.clube);
}
const pontosGrupo = (T, c) => { for (let g = 0; g < T.grupos.length; g++) { const l = tabelaGrupo(T, g).find(x => x.clube === c); if (l) return l.p * 100 + l.sg; } return 0; };

// mata-mata: empate vai para os pênaltis (mesma semente da súmula ao vivo)
export function decidirCont(T, fase, h, a, gols, seed, campo) {
  if (fase < F_MATA) return {};
  if (gols[0] !== gols[1]) return { vencedor: gols[0] > gols[1] ? h : a, perdedor: gols[0] > gols[1] ? a : h };
  const pen = penaltis(seed, campo);
  return { vencedor: pen[0] > pen[1] ? h : a, perdedor: pen[0] > pen[1] ? a : h, pen: [pen[0], pen[1]], seq: pen.seq };
}
// fecha a fase: grupos viram oitavas (1º de um grupo × 2º do vizinho: A×B, C×D...); depois os vencedores se cruzam;
// a final (campo neutro) define o campeão
export function avancarCont(T, vencedores) {
  const f = T.fase++;
  if (f < F_MATA - 1) return;
  const casa = (x, y) => pontosGrupo(T, x) >= pontosGrupo(T, y) ? [x, y] : [y, x];
  if (f === F_MATA - 1) {
    const t = T.grupos.map((g, i) => tabelaGrupo(T, i));
    T.chaves = []; for (let g = 0; g < t.length; g += 2) T.chaves.push(casa(t[g][0].clube, t[g + 1][1].clube), casa(t[g + 1][0].clube, t[g][1].clube));
    return;
  }
  if (f === F_FIN) { T.campeao = vencedores[0]; T.vice = T.chaves[0].find(c => c !== T.campeao); T.chaves = []; return; }
  T.chaves = []; for (let i = 0; i < vencedores.length; i += 2) T.chaves.push(f === F_SEM ? [vencedores[i], vencedores[i + 1]] : casa(vencedores[i], vencedores[i + 1]));
}

export function campanhaCont(s, k, ci) {
  const T = s.cont?.[k]; if (!T || !T.grupos.some(g => g.includes(ci))) return null;
  if (T.campeao === ci) return 'Campeão';
  if (T.vice === ci) return 'Vice-campeão';
  if (naCont(s, k, ci)) return T.fase < F_MATA ? 'Fase de grupos' : `Na disputa (${FASES_CONT[T.fase].curto})`;
  const ult = T.jogos.filter(j => j.h === ci || j.a === ci).at(-1);
  return ult && ult.fase >= F_MATA ? `Eliminado ${{ [F_OIT]: 'nas oitavas', [F_QUA]: 'nas quartas', [F_SEM]: 'na semifinal' }[ult.fase]}` : 'Eliminado na fase de grupos';
}
