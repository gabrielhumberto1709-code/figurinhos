// Árbitros (inventados): cada carreira tem um quadro de 30, com rigor de 1 (deixa o jogo correr) a 5 (cartão fácil).
import { rng, pick } from './util.js';
const NOMES = ['Alessandro', 'Bráulio', 'Cleber', 'Denis', 'Edinaldo', 'Felipe', 'Gilberto', 'Heber', 'Ígor', 'Jean', 'Kleber', 'Luiz Flávio', 'Marcelo', 'Nílton', 'Otávio', 'Péricles', 'Rafael', 'Sandro', 'Thiago', 'Valdir', 'Wellington', 'Yuri', 'Adriano', 'Bruno', 'Caio'];
const SOBRENOMES = ['Albuquerque', 'Bezerra', 'Cavalcanti', 'Dornelles', 'Esteves', 'Figueiró', 'Gusmão', 'Holanda', 'Ignácio', 'Jardim', 'Lobato', 'Magalhães', 'Nóbrega', 'Pimentel', 'Quaresma', 'Rebouças', 'Seixas', 'Tenório', 'Uchoa', 'Vasconcelos', 'Xavier', 'Zanella'];
let cache = null;
export function quadro(seed) {
  if (cache?.seed === seed) return cache.q;
  const r = rng(`arbitros${seed}`), usados = new Set(), q = [];
  while (q.length < 30) { const n = `${pick(r, NOMES)} ${pick(r, SOBRENOMES)}`; if (usados.has(n)) continue; usados.add(n); q.push({ nome: n, rigor: 1 + Math.min(4, Math.floor(r() * 5.2)) }); }
  cache = { seed, q };
  return q;
}
export const arbitroDo = (s, jogoSeed) => pick(rng(`arb${jogoSeed}`), quadro(s.seed));
export const RIGOR = ['', 'deixa o jogo correr', 'tolerante', 'equilibrado', 'rigoroso', 'cartão fácil'];
