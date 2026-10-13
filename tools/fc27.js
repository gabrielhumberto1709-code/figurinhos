// Geral e atributos do EA SPORTS FC 27 (base oficial da EA, https://github.com/mikedpad/ea-fc-player-stats) para todo jogador
// que NÃO está na Série A, B, C nem nos regionais do jogo (esses ficam como estão): clubes de fora, livres e as ligas sul-americanas.
// - geral: o da EA; os 6 atributos do jogo (velocidade, finalização, passe, drible, defesa, físico) = as 6 faces da carta
//   (goleiro: segue o perfil, só acompanha a diferença do geral, porque as faces de goleiro da EA são outras).
// - potencial: a EA não publica (só existe no modo carreira). Mantém a folga que o jogador já tinha (potencial - geral) em cima
//   do geral novo, então garoto continua com margem e veterano sem. Se achar uma base com potencial real, é só trocar aqui.
// - valor de mercado acompanha o geral (x1,14 por ponto), como em tools/ajustar.js.
// Casa por nome + idade (+ clube e nacionalidade para desempatar). Quem não casa fica como está e vai para
// tools/fc27-nao-casados.csv. Idempotente. Uso: node tools/fc27.js [players.csv]  (o `npm run dados` chama no fim)
// O CSV padrão fica em ../referencia/fc27/players.csv; sem ele o passo é pulado.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSV = process.argv[2] || path.join(ROOT, '..', 'referencia', 'fc27', 'players.csv');
if (!existsSync(CSV)) { console.log(`fc27: ${CSV} não existe, passo pulado`); process.exit(0); }
const DADOS = path.join(ROOT, 'public', 'data', 'brasil.json'), d = JSON.parse(readFileSync(DADOS));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- CSV (com aspas) ----------
function lerCsv(t) {
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  return resto.filter(l => l.length === cab.length).map(l => Object.fromEntries(cab.map((k, i) => [k, l[i]])));
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const chave = t => [...t].sort().join(' ');

const EA = lerCsv(readFileSync(CSV, 'utf8')).filter(r => r.gender === "Men's Football").map(r => {
  const cheio = norm(`${r.first_name} ${r.last_name}`), comum = norm(r.common_name);
  return { r, id: r.player_id, cheio, comum, todos: new Set([...cheio, ...comum]), idade: 2026 - +r.birthdate.slice(0, 4), clube: new Set(norm(r.club)), nat: r.nationality };
});
const porToken = new Map();
for (const e of EA) for (const t of e.todos) if (t.length > 2) { if (!porToken.has(t)) porToken.set(t, []); porToken.get(t).push(e); }

// ---------- jogadores do jogo que entram (fora de A/B/C/regionais) ----------
const cl = d.clubes, FICA = new Set(['A', 'B', 'C', 'R']);
const alvo = d.jogadores.filter(j => !FICA.has(cl[j[3]].div));
const GENERICAS = new Set(['fc', 'cf', 'ac', 'sc', 'cd', 'club', 'de', 'del', 'la', 'real', 'united', 'city', 'sporting', 'deportivo', 'atletico', 'racing', 'athletic', 'ca', 'cs', 'fk', 'sk', 'as', 'ss', 'us', 'ud', 'rc']);
const tokensClube = j => new Set(norm(cl[j[3]].n).filter(t => !GENERICAS.has(t) && t.length > 2));

// pontuação de um par (jogador do jogo, jogador da EA); 0 = não é ele
function pontos(j, e, natDe) {
  const dIdade = Math.abs(e.idade - j[5]); if (dIdade > 1) return 0;
  const G = norm(j[1]), Gs = norm(j[2]); if (!G.length) return 0;
  let p = 0;
  if (chave(G) === chave(e.cheio) || (e.comum.length && chave(G) === chave(e.comum))) p = 100;
  else if (G.every(t => e.todos.has(t)) || (e.cheio.length && e.cheio.every(t => G.includes(t)))) p = 80;
  else if (Gs.length && Gs.every(t => e.todos.has(t)) && G.some(t => e.todos.has(t))) p = 65;
  else if (e.comum.length && e.comum.every(t => G.includes(t))) p = 65;
  else {
    const ult = G[G.length - 1], inter = G.filter(t => e.todos.has(t)).length;
    const pri = G[0], prefixo = pri.length >= 3 && [...e.todos].some(t => t !== pri && t.length >= 3 && (t.startsWith(pri) || pri.startsWith(t)));
    if (G.length >= 2 && e.todos.has(ult) && ult.length > 3 && prefixo) p = 70; // Ben White = Benjamin White, Sergi = Sergio
    else if (inter >= 2 && e.todos.has(ult)) p = 55;
    else if (inter >= 1 && e.todos.has(ult) && ult.length > 4 && dIdade === 0) p = 50;
  }
  if (!p) return 0;
  p -= dIdade * 3;
  const ct = tokensClube(j); if ([...ct].some(t => e.clube.has(t))) p += 15;
  if (natDe.get(j[6]) === e.nat) p += 10;
  return p;
}
const candidatos = j => { const v = new Map(); for (const t of new Set([...norm(j[1]), ...norm(j[2])])) if (t.length > 2) for (const e of porToken.get(t) || []) v.set(e.id, e); return [...v.values()]; };

// 1ª passada: casamentos exatos e únicos ensinam o código de nacionalidade do jogo -> nome da EA
const natDe = new Map(), cont = new Map();
for (const j of alvo) {
  const ex = candidatos(j).filter(e => pontos(j, e, natDe) >= 97);
  if (ex.length === 1) { const k = j[6] + '|' + ex[0].nat; cont.set(k, (cont.get(k) || 0) + 1); }
}
const melhor = {};
for (const [k, n] of cont) { const [c, nome] = k.split('|'); if (!melhor[c] || n > melhor[c][1]) melhor[c] = [nome, n]; }
for (const [c, [nome]] of Object.entries(melhor)) natDe.set(c, nome);

// 2ª passada: pares com pontuação, atribuição gulosa um para um (quem tem empate no topo fica sem casar)
const pares = [], ambiguos = new Set();
for (const j of alvo) {
  const ps = candidatos(j).map(e => [pontos(j, e, natDe), e]).filter(([p]) => p >= 50).sort((a, b) => b[0] - a[0]);
  if (!ps.length) continue;
  if (ps.length > 1 && ps[0][0] - ps[1][0] < 5 && ps[0][1].id !== ps[1][1].id) {
    // empate de nome: o geral parecido com o que o jogador já tinha desempata, se a diferença for clara
    const dist = e => Math.abs(+e.r.overall_rating - j[7]), [a, b] = [ps[0][1], ps[1][1]];
    if (ps.length > 2 && ps[2][0] - ps[0][0] > -5) { ambiguos.add(j[0]); continue; }
    if (Math.abs(dist(a) - dist(b)) < 4) { ambiguos.add(j[0]); continue; }
    if (dist(b) < dist(a)) { ps.unshift(ps.splice(1, 1)[0]); }
  }
  pares.push([ps[0][0], j, ps[0][1]]);
}
pares.sort((a, b) => b[0] - a[0]);
const usadoEA = new Set(), casou = new Map();
for (const [p, j, e] of pares) if (!usadoEA.has(e.id)) { usadoEA.add(e.id); casou.set(j[0], { e, p }); }

// ---------- aplica ----------
let mudou = 0, soma = 0, igual = 0;
const faixas = { exato: 0, nome: 0, aprox: 0 };
for (const j of alvo) {
  const m = casou.get(j[0]); if (!m) continue;
  const { e, p } = m, R = e.r, ovr = +R.overall_rating;
  faixas[p >= 97 ? 'exato' : p >= 75 ? 'nome' : 'aprox']++;
  const dlt = ovr - j[7], folga = Math.max(0, j[10] - j[7]);
  if (j[4] === 'GOL') j[11] = j[11].map(a => clamp(a + dlt, 20, 99));
  else j[11] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physicality'].map(k => clamp(+R[k] || 20, 20, 99));
  if (dlt) { j[8] = Math.round(j[8] * 1.14 ** dlt); mudou++; soma += dlt; } else igual++;
  j[7] = ovr; j[10] = clamp(ovr + folga, ovr, Math.max(ovr, 95));
}
// nível do clube de fora (média dos 11 melhores) acompanha os gerais novos
for (const ci of new Set(alvo.map(j => j[3]))) {
  if (cl[ci].div !== 'X') continue;
  const top = d.jogadores.filter(j => j[3] === ci).map(j => j[7]).sort((a, b) => b - a).slice(0, 11);
  if (top.length) cl[ci].lvl = Math.round(top.reduce((a, b) => a + b, 0) / top.length);
}
d.fc27 = EA[0]?.r.snapshot_date || '';
writeFileSync(DADOS, JSON.stringify(d));

// ---------- relatório ----------
const nao = alvo.filter(j => !casou.has(j[0])).sort((a, b) => b[7] - a[7]);
const q = s => `"${String(s).replace(/"/g, '""')}"`;
writeFileSync(path.join(ROOT, 'tools', 'fc27-nao-casados.csv'), ['id,nome,clube,liga,idade,nat,geral_atual,motivo', ...nao.map(j => [j[0], q(j[1]), q(cl[j[3]].n), q(cl[j[3]].liga || cl[j[3]].div), j[5], j[6], j[7], ambiguos.has(j[0]) ? 'mais de um candidato' : 'não achei'].join(','))].join('\n') + '\n');
console.log(`fc27 (${d.fc27}): ${alvo.length} jogadores de fora/livres; ${casou.size} casaram (${faixas.exato} nome exato, ${faixas.nome} nome parcial, ${faixas.aprox} aproximado), ${nao.length} ficaram como estavam (${ambiguos.size} ambíguos). Geral mudou em ${mudou} (média ${mudou ? (soma / mudou).toFixed(1) : 0} pontos), igual em ${igual}.`);
const top = nao.filter(j => j[7] >= 70).length; console.log(`  sem casar com geral 70+: ${top} (veja tools/fc27-nao-casados.csv)`);
