// Rivalidades: clássicos mexem mais com torcida, moral e bilheteria, e quase nunca há negócio entre rivais.
const PARES = [
  ['Flamengo', 'Fluminense'], ['Flamengo', 'Vasco'], ['Flamengo', 'Botafogo'], ['Fluminense', 'Vasco'], ['Fluminense', 'Botafogo'], ['Vasco', 'Botafogo'],
  ['Palmeiras', 'Corinthians'], ['Palmeiras', 'São Paulo'], ['Palmeiras', 'Santos'], ['Corinthians', 'São Paulo'], ['Corinthians', 'Santos'], ['São Paulo', 'Santos'],
  ['Ponte Preta', 'Guarani'], ['Grêmio', 'Internacional'], ['Juventude', 'Caxias'], ['Cruzeiro', 'Atlético-MG'], ['América-MG', 'Atlético-MG'], ['América-MG', 'Cruzeiro'],
  ['Bahia', 'Vitória'], ['Athletico-PR', 'Coritiba'], ['Londrina', 'Operário-PR'], ['Ceará', 'Fortaleza'], ['Sport', 'Náutico'], ['Sport', 'Santa Cruz'], ['Náutico', 'Santa Cruz'],
  ['Goiás', 'Atlético-GO'], ['Goiás', 'Vila Nova'], ['Atlético-GO', 'Vila Nova'], ['Remo', 'Paysandu'], ['Avaí', 'Figueirense'], ['Criciúma', 'Figueirense'], ['Criciúma', 'Avaí'],
  ['Confiança', 'Itabaiana'], ['Boca Juniors', 'River Plate'], ['Racing', 'Independiente'], ['Rosario Central', "Newell's"], ['Estudiantes', 'Gimnasia LP'], ['San Lorenzo', 'Huracán'],
  ['Peñarol', 'Nacional'], ['Olimpia', 'Cerro Porteño'],
];
let idx = null;
function mapa(base) {
  if (idx?.base === base) return idx.m;
  const porNome = new Map(base.clubes.map((c, i) => [c.n, i])), m = new Map();
  for (const [a, b] of PARES) { const x = porNome.get(a), y = porNome.get(b); if (x == null || y == null) continue; (m.get(x) || m.set(x, new Set()).get(x)).add(y); (m.get(y) || m.set(y, new Set()).get(y)).add(x); }
  idx = { base, m };
  return m;
}
export const rivais = (base, a, b) => a != null && b != null && !!mapa(base).get(a)?.has(b);
export const rivaisDe = (base, ci) => [...(mapa(base).get(ci) || [])];
