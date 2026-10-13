// Grandes ligas da Europa na temporada 2026-27 (clubes de fora, não jogáveis: div 'X').
// - Cada liga ganha exatamente os clubes certos (lista conferida com as tabelas da temporada 2026-27); quem a base de
//   referência ainda marcava como da primeira divisão e já caiu vai para a segunda (Championship, Segunda División,
//   Serie B, 2. Bundesliga, Ligue 2), com tier menor, que é o que o mercado usa para preço e destino de venda.
// - Os clubes dessas ligas ganham o elenco completo da referência (antes só entrava quem tinha 67+ de overall).
// - Rostos: quem a referência mediu em foto usa a medida; os demais sorteiam o tom de pele pela nacionalidade.
// Só acrescenta jogadores e clubes existentes mudam de campo, então os índices guardados nos saves não mudam. Idempotente.
// Uso: node tools/europa.js [pasta-da-referencia]   (o `npm run dados` chama no fim)
import { readFileSync, writeFileSync } from 'node:fs';
import { CORE, P, novoJogador, numerar, rosto, tierDe, LIGA_PAIS } from './build-dados.js';

const DADOS = new URL('../public/data/brasil.json', import.meta.url), d = JSON.parse(readFileSync(DADOS));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// liga -> [país, tier, clubes da temporada 2026-27 (nome do jogo; basta o começo do nome)]
const TOPO = {
  'Premier League': ['ING', 5, ['Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton', 'Chelsea', 'Coventry City', 'Crystal Palace', 'Everton', 'Fulham', 'Hull City', 'Ipswich Town', 'Leeds United', 'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United', 'Nottingham Forest', 'Sunderland', 'Tottenham']],
  LaLiga: ['ESP', 5, ['Deportivo Alavés', 'Athletic Bilbao', 'Atlético de Madrid', 'Barcelona', 'Celta de Vigo', 'Deportivo La Coruña', 'Elche', 'RCD Espanyol', 'Getafe', 'Levante', 'Málaga', 'CA Osasuna', 'Racing Santander', 'Rayo Vallecano', 'Real Betis', 'Real Madrid', 'Real Sociedad', 'Sevilla', 'Valencia', 'Villarreal']],
  'Serie A (ITA)': ['ITA', 5, ['Atalanta', 'Bologna', 'Cagliari', 'Como', 'ACF Fiorentina', 'Frosinone', 'Genoa', 'Inter Milan', 'Juventus', 'Società Lazio', 'US Lecce', 'Milan', 'Monza', 'Napoli', 'Parma', 'Roma', 'US Sassuolo', 'Torino', 'Udinese', 'Venezia']],
  Bundesliga: ['ALE', 5, ['Augsburg', 'Union Berlin', 'Werder Bremen', 'Borussia Dortmund', 'Elversberg', 'Eintracht Frankfurt', 'Freiburg', 'Hamburger', '1899 Hoffenheim', 'Köln', 'RB Leipzig', 'Bayer 04 Leverkusen', 'FSV Mainz', 'Borussia Mönchengladba', 'Bayern Munich', 'Paderborn', 'Schalke', 'Stuttgart']],
  'Ligue 1': ['FRA', 4, ['Angers', 'AJ Auxerre', 'Stade Brestois', 'Le Havre', 'Le Mans', 'Lens', 'LOSC Lille', 'Lorient', 'Olympique Lyon', 'Olympique Marseille', 'Monaco', 'Nice', 'Paris', 'Paris Saint-Germain', 'Stade Rennais', 'Strasbourg', 'Toulouse', 'ESTAC Troyes']],
};
// para onde vai quem a referência ainda deixou na primeira divisão e já não está nela
const SEGUNDA = {
  'Premier League': ['Championship', 'ING', 3],
  LaLiga: ['Segunda División', 'ESP', 2.2],
  'Serie A (ITA)': ['Serie B (ITA)', 'ITA', 2.5],
  Bundesliga: ['2. Bundesliga', 'ALE', 2.5],
  'Ligue 1': ['Ligue 2', 'FRA', 2],
};

const X = d.clubes.map((c, i) => i).filter(i => d.clubes[i].div === 'X');
const acha = nome => {
  const n = norm(nome);
  let r = X.filter(i => norm(d.clubes[i].n) === n);
  if (!r.length) r = X.filter(i => norm(d.clubes[i].n).startsWith(n));
  if (r.length !== 1) throw new Error(`europa: "${nome}" bate com ${r.length} clubes (${r.map(i => d.clubes[i].n).join(', ')})`);
  return r[0];
};

// ---------- 0. liga certa de cada clube de fora ----------
// A base montou a liga do clube pela etiqueta do primeiro jogador, que pode ser de onde ele veio (Leeds saía como
// "Bundesliga", PSG como "Championship", Galatasaray como "Premier League"). A etiqueta que a maioria do elenco tem é a certa.
// Argentina, Colômbia, Paraguai, Uruguai, Chile, Equador, Peru e Bolívia ficam com tools/sulamericanos.js.
const SUL = /^Liga (PAR|URU|CHI|EQU|PER|BOL)$|^Liga (Argentina|Colombiana)$/; // 'Liga Argentina' também é a etiqueta-lixo da base (Atlas, MLS...): tools/ligas.js já acertou esses
const etiquetas = new Map();
for (const r of P.values()) { if (!etiquetas.has(r[3])) etiquetas.set(r[3], new Map()); const m = etiquetas.get(r[3]); m.set(r[9], (m.get(r[9]) || 0) + 1); }
const corrigidas = [];
for (const ci of X) {
  const c = d.clubes[ci], m = etiquetas.get(c.n); if (!m) continue;
  const [moda] = [...m].sort((a, b) => b[1] - a[1])[0];
  if (moda === c.liga || SUL.test(moda) || !LIGA_PAIS[moda]) continue;
  corrigidas.push(`${c.n}: ${c.liga} → ${moda}`);
  Object.assign(c, { liga: moda, nat: LIGA_PAIS[moda], tier: tierDe(moda) });
}

// ---------- 1. liga, país e tier de cada clube ----------
const mexidos = new Set(), subiu = [], desceu = [];
const donos = new Set();
for (const [liga, [nat, tier, nomes]] of Object.entries(TOPO)) {
  const doLiga = new Set(nomes.map(acha));
  if (doLiga.size !== nomes.length) throw new Error(`europa: ${liga} tem clube repetido`);
  for (const ci of doLiga) {
    const c = d.clubes[ci];
    if (c.liga !== liga) subiu.push(`${c.n}: ${c.liga} → ${liga}`);
    Object.assign(c, { liga, nat, tier }); mexidos.add(ci); donos.add(ci);
  }
  const [lg2, nat2, tier2] = SEGUNDA[liga];
  for (const ci of X) if (d.clubes[ci].liga === liga && !doLiga.has(ci)) { Object.assign(d.clubes[ci], { liga: lg2, nat: nat2, tier: tier2 }); mexidos.add(ci); desceu.push(`${d.clubes[ci].n}: ${liga} → ${lg2}`); }
}

// ---------- 2. elenco completo da referência, valor e rosto ----------
const ids = new Set(d.jogadores.map(r => r[0]));
let novos = 0, semValor = 0, rostos = 0;
const valorDe = j => Math.max(25, Math.round(1200 * 1.16 ** (j[7] - 63) * (j[5] <= 21 ? 1.6 : j[5] <= 24 ? 1.25 : j[5] >= 33 ? 0.3 : j[5] >= 30 ? 0.6 : 1) / 25) * 25);
for (const ci of mexidos) {
  const c = d.clubes[ci];
  for (const r of P.values()) if (r[3] === c.n && !ids.has(r[0])) { d.jogadores.push(novoJogador(r, ci)); ids.add(r[0]); novos++; }
  const el = d.jogadores.filter(j => j[3] === ci);
  for (const j of el) {
    if (!(j[8] > 0)) { j[8] = valorDe(j); semValor++; }
    const rs = rosto(j[0], j[6], j[5]); if (rs !== j[12]) { j[12] = rs; rostos++; }
  }
  const top = el.map(j => j[7]).sort((a, b) => b - a).slice(0, 11);
  c.lvl = Math.round(top.reduce((a, b) => a + b, 0) / top.length);
  const k = CORE.INT_CLUBS[c.n] || CORE.KITS_KNOWN[c.n] || CORE.CLUBS_F_GEN[c.n];
  c.fan = k?.fan || clamp(Math.round(c.tier + (c.lvl - 70) / 3), 2, 9);
  const est = CORE.STADIUMS[c.n]; if (est && /^Estádio do /.test(c.est?.[0] || '')) c.est = est;
  numerar(d.jogadores, ci);
}
d.versao = 5;
writeFileSync(DADOS, JSON.stringify(d));

// ---------- relatório ----------
console.log(`europa: ${mexidos.size} clubes (${donos.size} na primeira divisão), ${novos} jogadores novos, ${semValor} valores preenchidos, ${rostos} rostos refeitos`);
if (corrigidas.length) console.log(`  liga corrigida pela maioria do elenco (${corrigidas.length}): ${corrigidas.join('; ')}`);
if (subiu.length) console.log(`  entrou na liga da temporada 2026-27: ${subiu.join('; ')}`);
if (desceu.length) console.log(`  rebaixados para a 2ª divisão: ${desceu.join('; ')}`);
for (const liga of [...Object.keys(TOPO), ...Object.values(SEGUNDA).map(s => s[0])]) {
  const cs = X.filter(i => d.clubes[i].liga === liga && mexidos.has(i));
  const curtos = cs.filter(i => d.jogadores.filter(j => j[3] === i).length < 18).map(i => d.clubes[i].n);
  console.log(`  ${liga}: ${cs.length} clubes${curtos.length ? ` · elenco curto (<18): ${curtos.join(', ')}` : ''}`);
}
