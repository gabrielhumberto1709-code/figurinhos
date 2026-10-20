// Geral e atributos do EA SPORTS FC 27 (base oficial da EA, https://github.com/mikedpad/ea-fc-player-stats) para todo jogador
// que NÃO está na Série A, B, C nem nos regionais do jogo (esses ficam como estão): clubes de fora, livres e as ligas sul-americanas.
// - geral: o da EA; os 6 atributos do jogo (velocidade, finalização, passe, drible, defesa, físico) = as 6 faces da carta
//   (goleiro: segue o perfil, só acompanha a diferença do geral, porque as faces de goleiro da EA são outras).
// - potencial: a EA não publica (só existe no modo carreira). Mantém a folga que o jogador já tinha (potencial - geral) em cima
//   do geral novo, então garoto continua com margem e veterano sem. Se achar uma base com potencial real, é só trocar aqui.
// - valor de mercado acompanha o geral (x1,14 por ponto), como em tools/ajustar.js.
// Casa por nome + idade, ignorando acento e grafia parecida (Yarmolyuk = Yarmoliuk, Ben = Benjamin), e usa o clube (aprendido
// com os casamentos exatos) para desempatar homônimos. Quem não existe na EA (liga russa, sérvia, sem clube...) recebe um geral
// estimado: o mesmo deslocamento que os colegas de clube (ou de liga) com geral parecido tiveram ao passar para a EA.
// Quem a EA põe num clube que o jogo conhece (e que não é da Série A/B/C) muda de clube: tools/fc27-transferencias.csv. Tudo que não casou vai para tools/fc27-nao-casados.csv. Idempotente. Uso: node tools/fc27.js [players.csv]  (o `npm run dados` chama no fim)
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

// ---------- nomes: acento, grafia parecida e distância de edição ----------
const canon = t => t.replace(/y/g, 'i').replace(/w/g, 'v').replace(/k/g, 'c').replace(/ph/g, 'f').replace(/h/g, '').replace(/ou/g, 'u').replace(/(.)\1+/g, '$1');
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let k = 1; k <= b.length; k++) cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// mesma palavra: igual ou igual depois de normalizar a grafia (y=i, k=c, h mudo, letra dobrada) / a 1 letra de distância (2 em palavra longa).
// A distância sozinha é perigosa (Castillo/Castilla, Pérez/Perea são pessoas diferentes), então só vale com o clube junto.
const mesmaGrafia = (a, b) => a === b || canon(a) === canon(b);
const pertoDe = (a, b) => { const x = canon(a), y = canon(b), m = Math.min(x.length, y.length); return m >= 4 && x[0] === y[0] && lev(x, y) <= (m >= 9 ? 2 : 1); };
const temGrafia = (conj, t) => conj.has(t) || [...conj].some(u => mesmaGrafia(t, u));
const temPerto = (conj, t) => conj.has(t) || [...conj].some(u => mesmaGrafia(t, u) || pertoDe(t, u));

const EA = lerCsv(readFileSync(CSV, 'utf8')).filter(r => r.gender === "Men's Football").map(r => {
  const cheio = norm(`${r.first_name} ${r.last_name}`), comum = norm(r.common_name);
  return { r, id: r.player_id, cheio, comum, todos: new Set([...cheio, ...comum]), idade: 2026 - +r.birthdate.slice(0, 4), clube: new Set(norm(r.club)), clubeNome: r.club, nat: r.nationality, liga: r.league };
});
const porChave = new Map(); // palavra normalizada e prefixo de 4 letras -> jogadores da EA
const indexar = (k, e) => { if (!porChave.has(k)) porChave.set(k, new Set()); porChave.get(k).add(e); };
for (const e of EA) for (const t of e.todos) if (t.length > 2) { const c = canon(t); indexar(c, e); indexar('~' + c.slice(0, 4), e); }

// ---------- jogadores do jogo que entram (fora de A/B/C/regionais) ----------
const cl = d.clubes, FICA = new Set(['A', 'B', 'C', 'R']);
const alvo = d.jogadores.filter(j => !FICA.has(cl[j[3]].div));
const GENERICAS = new Set(['fc', 'cf', 'ac', 'sc', 'cd', 'club', 'de', 'del', 'la', 'real', 'united', 'city', 'sporting', 'deportivo', 'atletico', 'racing', 'athletic', 'ca', 'cs', 'fk', 'sk', 'as', 'ss', 'us', 'ud', 'rc']);
const tokensClube = j => new Set(norm(cl[j[3]].n).filter(t => !GENERICAS.has(t) && t.length > 2));
const clubeEA = new Map(); // índice do clube no jogo -> nome do clube na EA (aprendido na 1ª passada)

// pontuação de um par (jogador do jogo, jogador da EA); 0 = não é ele. Só o sobrenome parecido NÃO basta (Medina, Castillo e
// Pérez têm centenas): casamento por nome completo (ou grafia parecida do nome completo) vale sozinho; os mais frágeis (nome
// de uma palavra só, nome curto, grafia parecida, Ben = Benjamin) exigem também o clube.
function pontos(j, e, natDe) {
  const dIdade = Math.abs(e.idade - j[5]); if (dIdade > 1) return 0;
  const G = norm(j[1]), Gs = norm(j[2]); if (!G.length) return 0;
  const ce = clubeEA.get(j[3]);
  const noClube = ce ? e.clubeNome === ce : [...tokensClube(j)].some(t => e.clube.has(t)); // clube do jogo = clube da EA
  const noPais = natDe.get(j[6]) === e.nat;
  let p = 0, exigeClube = false;
  if (chave(G) === chave(e.cheio) || (e.comum.length && chave(G) === chave(e.comum))) p = 100;
  else if (G.length >= 2 && chave(G.map(canon)) === chave(e.cheio.map(canon))) p = 90; // só acento ou grafia (Yarmolyuk = Yarmoliuk)
  else if (G.length >= 2 && G.every(t => e.todos.has(t))) p = 80; // o nome do jogo está inteiro dentro do nome completo da EA
  else if (e.cheio.length >= 2 && e.cheio.every(t => G.includes(t))) p = 80;
  else if (G.length >= 2 && G.every(t => temGrafia(e.todos, t))) p = 78; // idem, só com grafia diferente (Yarmolyuk = Yarmoliuk)
  else if (G.length >= 2 && G.every(t => temPerto(e.todos, t)) && G.some(t => temGrafia(e.todos, t))) { p = 72; exigeClube = !(dIdade === 0 && noPais); } // idem, a uma letra de distância (Yegor = Yehor): precisa do clube, ou da mesma idade e país
  else {
    const ult = G[G.length - 1], pri = G[0];
    const nick = G.length >= 2 && e.todos.has(ult) && ult.length > 3 && pri.length >= 3 && [...e.todos].some(t => t !== pri && t.length >= 3 && (t.startsWith(pri) || pri.startsWith(t)));
    if (nick) p = 70; // Ben White = Benjamin White, Sergi = Sergio
    else if (G.length === 1 && G.every(t => e.todos.has(t))) { p = 70; exigeClube = true; } // nome de uma palavra só (Malcom, Pedro)
    else if (Gs.length && Gs.every(t => e.todos.has(t)) && G.some(t => e.todos.has(t))) { p = 65; exigeClube = true; } // só o nome curto bate
    else if (G.length === 1 && G.every(t => temGrafia(e.todos, t))) { p = 65; exigeClube = true; }
  }
  if (!p) return 0;
  if (p < 90 && !(noClube || noPais)) return 0;
  if (p < 90 && !noClube && dIdade > 0) return 0; // sem o clube a favor, nome que não é idêntico só vale com a mesma idade
  if (exigeClube && !noClube) return 0;
  return p - dIdade * 3 + (noClube ? (ce ? 25 : 15) : 0) + (noPais ? 10 : 0);
}
const candidatos = j => {
  const v = new Map();
  for (const t of new Set([...norm(j[1]), ...norm(j[2])])) if (t.length > 2) { const c = canon(t); for (const k of [c, '~' + c.slice(0, 4)]) for (const e of porChave.get(k) || []) v.set(e.id, e); }
  return [...v.values()];
};

// 1ª passada: casamentos exatos e únicos ensinam a nacionalidade (código do jogo -> nome da EA) e o clube (clube do jogo -> clube da EA)
const natDe = new Map(), cont = new Map(), contClube = new Map();
for (const j of alvo) {
  const ex = candidatos(j).filter(e => pontos(j, e, natDe) >= 97);
  if (ex.length === 1) {
    const k = j[6] + '|' + ex[0].nat; cont.set(k, (cont.get(k) || 0) + 1);
    if (!contClube.has(j[3])) contClube.set(j[3], new Map()); const m = contClube.get(j[3]); m.set(ex[0].clubeNome, (m.get(ex[0].clubeNome) || 0) + 1);
  }
}
const melhor = {};
for (const [k, n] of cont) { const [c, nome] = k.split('|'); if (!melhor[c] || n > melhor[c][1]) melhor[c] = [nome, n]; }
for (const [c, [nome]] of Object.entries(melhor)) natDe.set(c, nome);
for (const [ci, m] of contClube) { const tot = [...m.values()].reduce((a, b) => a + b, 0), [nome, n] = [...m].sort((a, b) => b[1] - a[1])[0]; if (n >= 3 && n / tot >= 0.4) clubeEA.set(ci, nome); }

// 2ª passada: pares com pontuação, atribuição gulosa um para um (empate no topo: o geral parecido com o antigo desempata, se a diferença for clara)
const pares = [], ambiguos = new Set();
const ambig = (j, ps) => { ambiguos.add(j[0]); };
for (const j of alvo) {
  const ps = candidatos(j).map(e => [pontos(j, e, natDe), e]).filter(([p]) => p >= 50).sort((a, b) => b[0] - a[0]);
  if (!ps.length) continue;
  if (ps.length > 1 && ps[0][0] - ps[1][0] < 5 && ps[0][1].id !== ps[1][1].id) {
    const dist = e => Math.abs(+e.r.overall_rating - j[7]), [a, b] = [ps[0][1], ps[1][1]];
    if (ps.length > 2 && ps[2][0] - ps[0][0] > -5) { ambig(j, ps); continue; }
    if (j[7] < 55 || Math.abs(dist(a) - dist(b)) < 4) { ambig(j, ps); continue; } // geral de placeholder (45) não serve de pista
    if (dist(b) < dist(a)) { ps.unshift(ps.splice(1, 1)[0]); }
  }
  pares.push([ps[0][0], j, ps[0][1]]);
}
pares.sort((a, b) => b[0] - a[0]);
const usadoEA = new Set(), casou = new Map();
for (const [p, j, e] of pares) if (!usadoEA.has(e.id)) { usadoEA.add(e.id); casou.set(j[0], { e, p }); }

// ---------- geral estimado para quem não existe na EA ----------
// deslocamento (geral da EA - geral antigo) dos que casaram: do mesmo clube e geral parecido, senão da mesma liga, senão de ligas do mesmo tier
const ja = new Set(d.fc27?.estimados || []); // já estimados numa rodada anterior (não estima de novo, senão o número andaria a cada execução)
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const obs = []; // {j, ci, liga, tier, velho, delta}
for (const j of alvo) { const m = casou.get(j[0]); if (m && !ja.has(j[0])) obs.push({ ci: j[3], liga: cl[j[3]].liga || cl[j[3]].div, tier: cl[j[3]].tier ?? 2, velho: j[7], delta: +m.e.r.overall_rating - j[7] }); }
const porClube = new Map(), porLiga = new Map();
for (const o of obs) { if (!porClube.has(o.ci)) porClube.set(o.ci, []); porClube.get(o.ci).push(o); const k = o.liga; if (!porLiga.has(k)) porLiga.set(k, []); porLiga.get(k).push(o); }
function deslocamento(j) {
  const perto = lista => lista.filter(o => Math.abs(o.velho - j[7]) <= 6).map(o => o.delta);
  const ci = porClube.get(j[3]) || [], liga = cl[j[3]].liga || cl[j[3]].div, tier = cl[j[3]].tier ?? 2;
  let a = perto(ci); if (a.length >= 3) return [med(a), 'clube'];
  if (ci.length >= 5) return [med(ci.map(o => o.delta)), 'clube'];
  a = perto(porLiga.get(liga) || []); if (a.length >= 8) return [med(a), 'liga'];
  a = perto(obs.filter(o => Math.abs(o.tier - tier) <= 0.6)); if (a.length >= 15) return [med(a), 'tier'];
  return [med(perto(obs)), 'geral'];
}
const estimados = new Map();
for (const j of alvo) if (!casou.has(j[0]) && !ja.has(j[0])) {
  const [dl, de] = deslocamento(j), teto = (porClube.get(j[3]) || []).length >= 5 ? Math.max(...porClube.get(j[3]).map(o => o.velho + o.delta)) + 1 : 92;
  estimados.set(j[0], { novo: clamp(Math.round(j[7] + dl), 30, Math.min(92, Math.max(teto, 40))), de });
}

// ---------- aplica ----------
const parciais = []; // casamentos sem nome idêntico, para você conferir
let mudou = 0, soma = 0, igual = 0, estMudou = 0, estSoma = 0;
const faixas = { exato: 0, nome: 0, aprox: 0 };
const mudaOvr = (j, ovr) => { const dlt = ovr - j[7], folga = Math.max(0, j[10] - j[7]); if (dlt) j[8] = Math.round(j[8] * 1.14 ** dlt); j[7] = ovr; j[10] = clamp(ovr + folga, ovr, Math.max(ovr, 95)); return dlt; };
for (const j of alvo) {
  const m = casou.get(j[0]);
  if (m) {
    const { e, p } = m, R = e.r, ovr = +R.overall_rating;
    if (p < 97) parciais.push([j[0], j[1], cl[j[3]].n, j[5], j[7], `${R.first_name} ${R.last_name}`, e.clubeNome, e.idade, ovr, p]);
    faixas[p >= 97 ? 'exato' : p >= 75 ? 'nome' : 'aprox']++;
    if (j[4] === 'GOL') j[11] = j[11].map(a => clamp(a + (ovr - j[7]), 20, 99));
    else j[11] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physicality'].map(k => clamp(+R[k] || 20, 20, 99));
    const dlt = mudaOvr(j, ovr); if (dlt) { mudou++; soma += dlt; } else igual++;
    ja.delete(j[0]);
  } else if (estimados.has(j[0])) {
    const { novo } = estimados.get(j[0]), dlt = novo - j[7];
    j[11] = j[11].map(a => clamp(a + dlt, 20, 99));
    mudaOvr(j, novo); if (dlt) { estMudou++; estSoma += dlt; } ja.add(j[0]);
  }
}
// ---------- clube atual: quem a EA põe em outro clube que o jogo conhece muda de clube ----------
// Só entre clubes de fora e livres (A/B/C e regionais não mexem), só se o clube da EA corresponde a um clube do jogo (aprendido
// pelos casamentos exatos) e só com casamento forte. Jogador de clube que o jogo não tem (Salzburg, Al Ittihad...) fica onde está.
const deEA = new Map(); // nome do clube na EA -> índice no jogo (-1 se dois clubes do jogo disputam o nome)
for (const [ci, nome] of clubeEA) { if (FICA.has(cl[ci].div)) continue; deEA.set(nome, deEA.has(nome) ? -1 : ci); }
const trocas = [], mexidos = new Set();
for (const j of alvo) {
  const m = casou.get(j[0]); if (!m || m.p < 90) continue;
  const dest = deEA.get(m.e.clubeNome);
  if (dest == null || dest < 0 || dest === j[3] || FICA.has(cl[dest].div)) continue;
  trocas.push([j[0], j[1], cl[j[3]].n, cl[j[3]].liga || cl[j[3]].div, cl[dest].n, cl[dest].liga || cl[dest].div, j[7]]);
  mexidos.add(j[3]); mexidos.add(dest); j[3] = dest;
}
for (const ci of mexidos) { // camisa repetida no clube novo ganha o próximo número livre
  const usados = new Set();
  for (const j of d.jogadores.filter(x => x[3] === ci)) { if (!j[13] || usados.has(j[13])) { let n = j[4] === 'GOL' ? 12 : 2; while (usados.has(n) || (n === 1 && j[4] !== 'GOL')) n++; j[13] = n; } usados.add(j[13]); }
}
// nível do clube de fora (média dos 11 melhores) acompanha os gerais novos
for (const ci of new Set([...alvo.map(j => j[3]), ...mexidos])) {
  if (cl[ci].div !== 'X') continue;
  const top = d.jogadores.filter(j => j[3] === ci).map(j => j[7]).sort((a, b) => b - a).slice(0, 11);
  if (top.length) cl[ci].lvl = Math.round(top.reduce((a, b) => a + b, 0) / top.length);
}
d.fc27 = { snapshot: EA[0]?.r.snapshot_date || '', estimados: [...ja].sort((a, b) => a - b) };
writeFileSync(DADOS, JSON.stringify(d));

// ---------- relatório ----------
if (trocas.length) writeFileSync(path.join(ROOT, 'tools', 'fc27-transferencias.csv'), // só reescreve quando houve troca (numa 2ª execução não há, e o relatório da 1ª não some)
   ['id,nome,de,liga_de,para,liga_para,geral', ...trocas.map(r => r.map((v, i) => [1, 2, 3, 4, 5].includes(i) ? `"${String(v).replace(/"/g, '""')}"` : v).join(','))].join('\n') + '\n');
const q0 = s => `"${String(s).replace(/"/g, '""')}"`;
writeFileSync(path.join(ROOT, 'tools', 'fc27-casados-parciais.csv'), ['id,nome_no_jogo,clube_no_jogo,idade,geral_antigo,nome_na_ea,clube_na_ea,idade_ea,geral_ea,pontos', ...parciais.map(r => r.map((v, i) => [1, 2, 5, 6].includes(i) ? q0(v) : v).join(','))].join('\n') + '\n');
const nao = alvo.filter(j => !casou.has(j[0])).sort((a, b) => b[7] - a[7]);
const q = s => `"${String(s).replace(/"/g, '""')}"`;
writeFileSync(path.join(ROOT, 'tools', 'fc27-nao-casados.csv'), ['id,nome,clube,liga,idade,nat,geral_atual,motivo,origem_da_estimativa', ...nao.map(j => [j[0], q(j[1]), q(cl[j[3]].n), q(cl[j[3]].liga || cl[j[3]].div), j[5], j[6], j[7], ambiguos.has(j[0]) ? 'mais de um candidato' : 'não está na EA', estimados.get(j[0])?.de || (ja.has(j[0]) ? 'já estimado' : '')].join(','))].join('\n') + '\n');
console.log(`fc27 (${d.fc27.snapshot}): ${alvo.length} jogadores de fora/livres; ${casou.size} casaram (${faixas.exato} nome exato, ${faixas.nome} nome parcial, ${faixas.aprox} grafia parecida), geral mudou em ${mudou} (média ${mudou ? (soma / mudou).toFixed(1) : 0}), igual em ${igual}.`);
console.log(`  clube atual pela EA: ${trocas.length} jogadores trocaram de clube (veja tools/fc27-transferencias.csv)`);
console.log(`  ${nao.length} não casaram (${ambiguos.size} ambíguos): ${estimados.size} ganharam geral estimado (média ${estMudou ? (estSoma / estMudou).toFixed(1) : 0} pontos) pelo deslocamento de clube/liga; veja tools/fc27-nao-casados.csv`);
