// Retrospecto do seu clube contra cada adversário (só jogos oficiais deste save): V/E/D, gols, maior vitória,
// pior derrota e a sequência recente. Aparece antes do jogo e vira pergunta na coletiva.
const chave = (ci, adv) => `${ci}-${adv}`;
export const confronto = (s, ci, adv) => s.h2h?.[chave(ci, adv)] || null;

export function registrarConfronto(base, s) {
  const u = s.ultima; if (!u || u.div === 'AMI') return;
  const ci = s.tecnico.clube, t = u.casa === ci ? 0 : 1, adv = t ? u.casa : u.fora, my = u.gols[t], ot = u.gols[1 - t];
  const H = (s.h2h ||= {})[chave(ci, adv)] ||= { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, maior: null, pior: null, ult: [] };
  const r = my > ot ? 'v' : my < ot ? 'd' : 'e', jogo = [my, ot, s.ano, u.copa || `Série ${u.div}`];
  H.j++; H[r]++; H.gp += my; H.gc += ot;
  if (r === 'v' && (!H.maior || my - ot > H.maior[0] - H.maior[1])) H.maior = jogo;
  if (r === 'd' && (!H.pior || ot - my > H.pior[1] - H.pior[0])) H.pior = jogo;
  H.ult = [...H.ult, r].slice(-8);
}

// sequência atual: quantos jogos seguidos sem vencer (tabu) ou sem perder (freguesia)
export function sequencia(H) {
  let semVencer = 0, semPerder = 0;
  for (let i = H.ult.length - 1; i >= 0 && H.ult[i] !== 'v'; i--) semVencer++;
  for (let i = H.ult.length - 1; i >= 0 && H.ult[i] !== 'd'; i--) semPerder++;
  return { semVencer, semPerder };
}

const pl = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
export const resumoConfronto = H => `${pl(H.v, 'vitória', 'vitórias')}, ${pl(H.e, 'empate', 'empates')} e ${pl(H.d, 'derrota', 'derrotas')} em ${pl(H.j, 'jogo', 'jogos')}`;
export function textoConfronto(H) {
  if (!H?.j) return 'Primeiro encontro dos dois no jogo.';
  const t = [`${pl(H.j, 'jogo', 'jogos')}: ${pl(H.v, 'vitória', 'vitórias')}, ${pl(H.e, 'empate', 'empates')} e ${pl(H.d, 'derrota', 'derrotas')} (${H.gp} a ${H.gc} nos gols)`];
  if (H.maior) t.push(`maior vitória ${H.maior[0]} a ${H.maior[1]} em ${H.maior[2]}`);
  if (H.pior) t.push(`pior derrota ${H.pior[0]} a ${H.pior[1]} em ${H.pior[2]}`);
  return t.join(' · ');
}
