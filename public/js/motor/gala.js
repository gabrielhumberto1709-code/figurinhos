// Premiação de gala do Brasileirão: Bola de Ouro, Chuteira, Garçom, Luva, Revelação, Prancheta e a seleção da
// temporada de cada série. Três finalistas por prêmio; o arquivo (s.galas) guarda as galas de todas as temporadas.
import { SETOR } from './util.js';
import { tabela } from './mundo.js';
import { tecnicoDe } from './carreira.js';
import { humanos, vistaDo } from './humanos.js';

export const PREMIOS = [
  ['bola', 'Bola de Ouro', 'Melhor jogador da temporada'],
  ['chuteira', 'Chuteira de Ouro', 'Artilheiro'],
  ['garcom', 'Garçom', 'Quem mais deu assistências'],
  ['luva', 'Luva de Ouro', 'Melhor goleiro'],
  ['revelacao', 'Revelação', 'Melhor jogador de até 21 anos'],
  ['prancheta', 'Prancheta de Ouro', 'Técnico que mais superou o elenco'],
];
const media = e => e[3] / 10 / e[0];
const fmtN = n => n.toFixed(2).replace('.', ',');

// s.est[id] = [jogos, gols, assistências, soma das notas × 10, amarelos, vermelhos]
export function gala(base, s) {
  const out = { ano: s.ano, divs: {} };
  for (const d of ['A', 'B', 'C']) {
    const tab = tabela(base, s, d), camp = tab[0]?.clube, minJ = Math.max(3, Math.round(s.rodada * 0.4));
    const js = Object.entries(s.est || {}).map(([id, e]) => [base.jog.get(+id), e]).filter(([j, e]) => j && !j.fora && base.clubes[j.clube].div === d && e[0]);
    const regular = js.filter(([, e]) => e[0] >= minJ);
    const por = (l, f) => l.slice().sort((a, b) => f(b) - f(a));
    const score = ([j, e]) => media(e) + e[1] * 0.04 + e[2] * 0.025 + (j.clube === camp ? 0.15 : 0);
    const fin = (l, info) => l.slice(0, 3).map(([j, e]) => ({ id: j.id, n: j.curto, c: j.clube, v: info(e) }));
    const P = {
      bola: fin(por(regular, score), e => `nota ${fmtN(media(e))} · ${e[1]} gols · ${e[2]} assist.`),
      chuteira: fin(por(js.filter(([, e]) => e[1]), ([, e]) => e[1] - e[0] / 1000), e => `${e[1]} gols em ${e[0]} jogos`),
      garcom: fin(por(js.filter(([, e]) => e[2]), ([, e]) => e[2] - e[0] / 1000), e => `${e[2]} assistências em ${e[0]} jogos`),
      luva: fin(por(regular.filter(([j]) => j.pos === 'GOL'), ([, e]) => media(e)), e => `nota ${fmtN(media(e))} em ${e[0]} jogos`),
      revelacao: fin(por(js.filter(([j, e]) => j.idade <= 21 && e[0] >= minJ / 2), score), e => `nota ${fmtN(media(e))} · ${e[1]} gols em ${e[0]} jogos`),
    };
    // técnico: posição final contra o tamanho do elenco (o campeão ganha bônus)
    const ranking = tab.map(l => l.clube).sort((a, b) => base.forca(b) - base.forca(a)), pts = x => x.esp - x.pos + (x.pos === 1 ? 4 : 0);
    P.prancheta = tab.map((l, i) => ({ ci: l.clube, pos: i + 1, esp: ranking.indexOf(l.clube) + 1 })).sort((a, b) => pts(b) - pts(a)).slice(0, 3)
      .map(x => { const v = vistaDo(s, x.ci), eu = !!v && !v.demitido; return { n: eu ? v.tecnico.nome : tecnicoDe(s, x.ci), c: x.ci, v: `${x.pos}º lugar com o ${x.esp}º elenco`, eu }; });
    // seleção da temporada (4-3-3) pela nota média
    const vagas = { GOL: 1, DEF: 4, MEI: 3, ATA: 3 }, selecao = [];
    for (const [j, e] of por(regular, ([, e]) => media(e))) { const st = SETOR[j.pos]; if (vagas[st]) { vagas[st]--; selecao.push({ id: j.id, n: j.curto, c: j.clube, st, nota: Math.round(media(e) * 100) / 100 }); } }
    out.divs[d] = { premios: P, selecao };
  }
  return out;
}

// quem ganhou algum prêmio individual na última gala (o preço sobe)
const cache = new WeakMap();
export function premiado(s, id) {
  const g = s.galas?.[0]; if (!g || g.ano < s.ano - 1) return false;
  if (!cache.has(g)) cache.set(g, new Set(Object.values(g.divs).flatMap(d => Object.entries(d.premios).filter(([k]) => k !== 'prancheta').map(([, l]) => l[0]?.id))));
  return cache.get(g).has(id);
}

// arquiva a gala na virada: moral para os premiados do seu clube e notícias
export function arquivarGala(base, s, G) {
  s.galas = [G, ...(s.galas || [])].slice(0, 30);
  const N = [], nomeP = Object.fromEntries(PREMIOS.map(([k, n]) => [k, n]));
  for (const [d, x] of Object.entries(G.divs)) {
    const b = x.premios.bola[0];
    if (b) N.push({ tipo: 'destaque', div: d, jogador: b.id, texto: `Premiação de gala: ${b.n} (${base.clubes[b.c].n}) leva a Bola de Ouro da Série ${d}.` });
    for (const [k, l] of Object.entries(x.premios)) {
      const w = l[0], v = w && vistaDo(s, w.c); if (!v || (k === 'prancheta' && !w.eu)) continue;
      if (k === 'prancheta') { v.torcida = Math.min(100, (v.torcida ?? 55) + 3); v.fin.diretoria = Math.min(100, v.fin.diretoria + 3); }
      else if (k !== 'bola') N.push({ tipo: 'clube', clube: w.c, div: d, jogador: w.id, texto: `${w.n} ganha o prêmio ${nomeP[k]} da Série ${d}.` });
      if (k === 'prancheta') N.push({ tipo: 'clube', clube: w.c, div: d, texto: `${v.tecnico.nome} ganha a Prancheta de Ouro da Série ${d}.` });
    }
  }
  return N;
}
// depois de zerar a moral da temporada nova: premiado do seu clube começa mais animado
export function moralDosPremiados(base, s) {
  const g = s.galas?.[0]; if (!g) return;
  const meus = new Set(humanos(s).map(([ci]) => ci));
  for (const x of Object.values(g.divs)) for (const [k, l] of Object.entries(x.premios)) if (k !== 'prancheta' && l[0] && meus.has(base.jog.get(l[0].id)?.clube)) s.mor[l[0].id] = Math.max(s.mor[l[0].id] ?? 62, 74);
}
