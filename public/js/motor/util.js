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
  const [id, nome, curto, clube, pos, idade, nat, ovr, valor, contrato, pot, att, rosto, num] = r;
  return { id, nome, curto, clube, pos, idade, nat, ovr, valor, contrato, pot, att: Object.fromEntries(ATT.map((k, i) => [k, att[i]])), rosto, num };
}

export const POS_NOME = { GOL: 'Goleiro', ZAG: 'Zagueiro', LD: 'Lateral-direito', LE: 'Lateral-esquerdo', VOL: 'Volante', MC: 'Meio-campo', MEI: 'Meia', ME: 'Meia-esquerda', MD: 'Meia-direita', PE: 'Ponta-esquerda', PD: 'Ponta-direita', CA: 'Centroavante', SA: 'Segundo atacante' };
export const SETOR = { GOL: 'GOL', ZAG: 'DEF', LD: 'DEF', LE: 'DEF', VOL: 'MEI', MC: 'MEI', MEI: 'MEI', ME: 'MEI', MD: 'MEI', PE: 'ATA', PD: 'ATA', CA: 'ATA', SA: 'ATA' };
// desvio de cada atributo (vel, fin, pas, dri, def, fis) em relação ao overall, por posição (garotos gerados)
export const PERFIL = { GOL: [-10, -40, -12, -25, 4, 0], ZAG: [-4, -22, -6, -10, 5, 4], LD: [5, -14, 0, -2, 1, 0], LE: [5, -14, 0, -2, 1, 0], VOL: [-3, -10, 2, -4, 4, 3], MC: [-1, -4, 5, 2, -2, 0], MEI: [1, 2, 5, 5, -14, -4], PE: [6, 2, 0, 6, -18, -3], PD: [6, 2, 0, 6, -18, -3], CA: [1, 6, -4, 1, -22, 4] };
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
// nível para comparar clubes: exterior forte fica acima da Série A; 'L' é a lista de jogadores sem clube
export const nivelDiv = c => c.div === 'X' ? (c.tier >= 3 ? -1 : c.tier >= 2 ? 0 : 1) : ({ A: 0, B: 1, C: 2 }[c.div] ?? 3);
const CONT = {
  AMS: 'BRA ARG URU COL PAR CHI EQU PER BOL VEN SUR',
  EUR: 'POR ESP FRA ITA ALE ING HOL BEL SUI AUT DIN SUE NOR POL ESC GAL IRL SER TUR GRE RUS UCR CRO TCH ROM ESL ESQ ISL ICE FIN HUN BUL BOS ALB KOS MNE GEO ARM LIT LAT EST LUX MON FAR NIR CYP MOL MAL ISR KAZ',
  AFR: 'GAN CPV CAM DRC GUI ANG MAR SEN NGA EGI EGY CIV TUN SIE BUR ZAM MLI GBS TOG ZIM BEN GAB MAU MOZ CEN NIG TAN CON CHA RSA COM LIB ARL',
  AMN: 'MEX EUA CAN PAN CUR JAM HAI DOM GLP GUA ELS TRI CRC HON',
  ASI: 'JAP COR IRA QAT IND UZB TAJ JOR SYR PAL BAN ARA KSA AUS NEW NZL',
};
// nome do país pelo código da base
export const PAISES = { BRA: 'Brasil', ARG: 'Argentina', ESP: 'Espanha', FRA: 'França', ALE: 'Alemanha', ITA: 'Itália', ING: 'Inglaterra', POR: 'Portugal', HOL: 'Holanda', URU: 'Uruguai', COL: 'Colômbia', MEX: 'México', BEL: 'Bélgica', DIN: 'Dinamarca', EUA: 'Estados Unidos', TUR: 'Turquia', MAR: 'Marrocos', NOR: 'Noruega', SEN: 'Senegal', CIV: 'Costa do Marfim', SUI: 'Suíça', NGA: 'Nigéria', PAR: 'Paraguai', CRO: 'Croácia', AUT: 'Áustria', SUE: 'Suécia', SER: 'Sérvia', RUS: 'Rússia', JAP: 'Japão', POL: 'Polônia', EQU: 'Equador', UCR: 'Ucrânia', GAN: 'Gana', ARL: 'Argélia', TCH: 'Tchéquia', GRE: 'Grécia', CHI: 'Chile', ESC: 'Escócia', IRL: 'Irlanda', CAM: 'Camarões', DRC: 'RD Congo', MLI: 'Mali', CAN: 'Canadá', BOS: 'Bósnia', GUI: 'Guiné', EGI: 'Egito', ROM: 'Romênia', GAL: 'País de Gales', VEN: 'Venezuela', ESQ: 'Eslováquia', ALB: 'Albânia', HUN: 'Hungria', KOS: 'Kosovo', TUN: 'Tunísia', ESL: 'Eslovênia', GEO: 'Geórgia', ISR: 'Israel', COR: 'Coreia do Sul', ANG: 'Angola', ICE: 'Islândia', AUS: 'Austrália', FIN: 'Finlândia', BUR: 'Burkina Faso', JAM: 'Jamaica', MON: 'Montenegro', MNE: 'Montenegro', ARA: 'Arábia Saudita', PER: 'Peru', CPV: 'Cabo Verde', PAN: 'Panamá', SOU: 'África do Sul', RSA: 'África do Sul', BUL: 'Bulgária', IRA: 'Irã', HAI: 'Haiti', IND: 'Indonésia', SUR: 'Suriname', THE: 'Gâmbia', GAB: 'Gabão', ARM: 'Armênia', MAU: 'Mauritânia', NEW: 'Nova Zelândia', LIB: 'Líbia', COM: 'Comores', LUX: 'Luxemburgo', CRC: 'Costa Rica', CUR: 'Curaçao', QAT: 'Catar', ZAM: 'Zâmbia', TOG: 'Togo', BEN: 'Benin', UZB: 'Uzbequistão', SYR: 'Síria', BOL: 'Bolívia', DOM: 'República Dominicana', ZIM: 'Zimbábue', KAZ: 'Cazaquistão', NIR: 'Irlanda do Norte', CEN: 'Rep. Centro-Africana', MOZ: 'Moçambique', ELS: 'El Salvador', NIG: 'Níger', PAL: 'Palestina', UNI: 'Emirados Árabes', CYP: 'Chipre', SIE: 'Serra Leoa', GBS: 'Guiné-Bissau', GLP: 'Guadalupe', BAN: 'Bangladesh', EST: 'Estônia', FAR: 'Ilhas Faroé', LIT: 'Lituânia', FRE: 'Guiana Francesa', GUA: 'Guatemala', JOR: 'Jordânia', LAT: 'Letônia', TAJ: 'Tadjiquistão', TRI: 'Trinidad e Tobago', MOL: 'Moldávia', MAL: 'Malta', TAN: 'Tanzânia', CON: 'Congo', CHA: 'Chade', HON: 'Honduras' };
export const CONTINENTES = { AMS: 'América do Sul', EUR: 'Europa', AFR: 'África', AMN: 'América do Norte e Central', ASI: 'Ásia e Oceania' };
const CONT_DE = {}; for (const [k, l] of Object.entries(CONT)) for (const n of l.split(' ')) CONT_DE[n] = k;
export const continenteDe = nat => CONT_DE[nat] || '';
// dinheiro como se fala: € 500 mil, € 5M, € 12,4M (casas = decimais no milhão, sem zeros sobrando)
const decimais = (v, casas) => String(parseFloat(v.toFixed(casas))).replace('.', ',');
export const valorCurto = (v, casas = 1) => v >= 999500 ? `${decimais(v / 1e6, v >= 1e8 ? 0 : casas)}M` : v >= 1e3 ? `${Math.round(v / 1e3)} mil` : `${Math.round(v)}`;
export const fmtDinheiro = (v, casas) => `€ ${valorCurto(v, casas)}`;
// o que a pessoa digita: 500mil, 500 mil, 5M, 5,5m, 2.5M, 1.500.000; número solto vale milhões até 100, milhares até 100 mil
export function lerValor(t) {
  const x = String(t ?? '').toLowerCase().replace(/€|\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').match(/^(\d+(?:[.,]\d+)?)(milh(?:ões|oes|ão|ao)|mi|m|mil|k)?$/);
  if (!x) return NaN;
  const n = parseFloat(x[1].replace(',', '.')), u = x[2] || '';
  return Math.round(u === 'mil' || u === 'k' ? n * 1e3 : u ? n * 1e6 : n < 100 ? n * 1e6 : n < 1e5 ? n * 1e3 : n);
}
