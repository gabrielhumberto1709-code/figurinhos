// Utilitários compartilhados (navegador e testes em Node).
export function rng(seed) {
  let h = 2166136261 >>> 0;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = (r, a) => a[Math.floor(r() * a.length)];
export function pickW(r, items, weight) {
  let total = 0; for (const it of items) total += Math.max(0, weight(it));
  let x = r() * total;
  for (const it of items) { x -= Math.max(0, weight(it)); if (x <= 0) return it; }
  return items[items.length - 1];
}
export function shuffle(r, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// jogador da base em formato de objeto
export const ATT = ['vel', 'fin', 'pas', 'dri', 'def', 'fis'];
export const ATT_NOME = { vel: 'Velocidade', fin: 'Finalização', pas: 'Passe', dri: 'Drible', def: 'Defesa', fis: 'Físico' };
export function jogador(r) {
  const [id, nome, curto, clube, pos, idade, nat, ovr, valor, contrato, pot, att, rosto] = r;
  return { id, nome, curto, clube, pos, idade, nat, ovr, valor, contrato, pot, att: Object.fromEntries(ATT.map((k, i) => [k, att[i]])), rosto };
}

export const POS_NOME = { GOL: 'Goleiro', ZAG: 'Zagueiro', LD: 'Lateral-direito', LE: 'Lateral-esquerdo', VOL: 'Volante', MC: 'Meio-campo', MEI: 'Meia', ME: 'Meia-esquerda', MD: 'Meia-direita', PE: 'Ponta-esquerda', PD: 'Ponta-direita', CA: 'Centroavante', SA: 'Segundo atacante' };
export const SETOR = { GOL: 'GOL', ZAG: 'DEF', LD: 'DEF', LE: 'DEF', VOL: 'MEI', MC: 'MEI', MEI: 'MEI', ME: 'MEI', MD: 'MEI', PE: 'ATA', PD: 'ATA', CA: 'ATA', SA: 'ATA' };
export const POS_ORDEM = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'ME', 'MD', 'PE', 'PD', 'SA', 'CA'];

// cartas por overall
export const CARTAS = [
  { k: 'goat', nome: 'GOAT', min: 87 },
  { k: 'craquinho', nome: 'Craquinho', min: 78 },
  { k: 'comum', nome: 'Comum', min: 65 },
  { k: 'bagre', nome: 'Bagre', min: 0 },
];
export const cartaDe = ovr => CARTAS.find(c => ovr >= c.min);
export function estrelas(pot) { return pot >= 88 ? 5 : pot >= 82 ? 4 : pot >= 75 ? 3 : pot >= 68 ? 2 : 1; }
export const fmtDinheiro = v => v >= 1e6 ? `€ ${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',')} mi` : v >= 1e3 ? `€ ${Math.round(v / 1e3)} mil` : `€ ${v}`;
