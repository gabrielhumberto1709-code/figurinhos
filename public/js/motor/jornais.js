// Imprensa escrita: a banca com três jornais de linha editorial diferente (Jornal da Bola sério, O Chutão tabloide
// e Diário do Gramado esportivo), a crônica do seu jogo, título/acesso/queda matemáticos, alfinetada depois do
// clássico e aposentadoria anunciada no fim da temporada.
import { rng, pick } from './util.js';
import { rivais } from './rivais.js';
import { evolucao, tabela } from './mundo.js';

export const JORNAIS = [
  { k: 'bola', nome: 'Jornal da Bola', linha: 'O diário sério do futebol de botão' },
  { k: 'chutao', nome: 'O Chutão', linha: 'O tabloide que não perdoa ninguém' },
  { k: 'gramado', nome: 'Diário do Gramado', linha: 'Números, bastidores e o placar' },
];
const nomeJ = (base, id) => base.jog.get(+id)?.curto || '?';
const ord = n => `${n}º`;

// resumo do seu último jogo, do ponto de vista do seu clube
function jogoMeu(base, s) {
  const u = s.ultima; if (!u?.gols) return null;
  const ci = s.tecnico.clube, t = u.casa === ci ? 0 : 1, adv = t ? u.casa : u.fora;
  const m = u.gols[t], d = u.gols[1 - t], gols = (u.eventos || []).filter(e => e.tipo === 'gol');
  const meusGols = gols.filter(e => e.time === t), decisivo = meusGols.at(-1), notas = u.notas?.[t] || {};
  const craque = Object.entries(notas).sort((a, b) => b[1] - a[1])[0];
  const tab = tabela(base, s, base.clubes[ci].div), pos = tab.findIndex(l => l.clube === ci) + 1;
  return { ci, adv, t, m, d, gols, decisivo, craque, pos, C: base.clubes[ci].n, A: base.clubes[adv].n, casa: t === 0, classico: rivais(base, ci, adv), u };
}

// as três manchetes do dia sobre o seu jogo
export function banca(base, s) {
  const g = jogoMeu(base, s); if (!g) return null;
  const r = rng(`banca${s.seed}${s.ano}${g.u.rodada}`), { C, A, m, d, pos } = g, CC = C.toUpperCase(), AA = A.toUpperCase();
  const quem = g.decisivo ? nomeJ(base, g.decisivo.jogador) : g.craque ? nomeJ(base, g.craque[0]) : 'o time', tec = s.tecnico.nome;
  const res = m > d ? (m - d >= 3 ? 'goleada' : 'vitoria') : m < d ? (d - m >= 3 ? 'vexame' : 'derrota') : m === 0 ? 'zero' : 'empate';
  const local = g.casa ? 'em casa' : 'fora de casa';
  const T = {
    goleada: [`${C} goleia o ${A} por ${m} a ${d}`, pick(r, [`PASSEIO! ${CC} ATROPELA E O ${AA} NEM VIU A COR DA BOLA`, `${CC} DÁ OLÉ: ${m} A ${d} E A TORCIDA PEDE MAIS!`]), `${C} ${m}x${d}: ${quem} comanda a goleada`],
    vitoria: [`${C} vence o ${A} ${local}`, pick(r, [`${CC} SUA, MAS LEVA! ${AA} VOLTA DE MÃOS VAZIAS`, `DEU ${CC}! ${AA} FICA CHUPANDO O DEDO`]), `${C} ${m}x${d} ${A}: ${quem} decide`],
    empate: [`${C} e ${A} empatam em ${m} a ${d}`, pick(r, [`NEM PRA LÁ, NEM PRA CÁ: ${CC} E ${AA} SE ABRAÇAM NO EMPATE`, `${m} A ${d} E NINGUÉM SAI FELIZ`]), `Empate em ${m}x${d} deixa o ${C} em ${ord(pos)}`],
    zero: [`${C} e ${A} ficam no 0 a 0`, pick(r, [`SONÍFERO: ${CC} E ${AA} FAZEM O JOGO MAIS CHATO DO ANO`, `ZERO EMOÇÃO! TORCEDOR PEDE O DINHEIRO DO INGRESSO DE VOLTA`]), `0x0: ${C} segue em ${ord(pos)}`],
    derrota: [`${C} perde para o ${A} ${local}`, pick(r, [`${CC} TROPEÇA E A CADEIRA DE ${tec.toUpperCase()} ESQUENTA`, `DE NOVO? ${CC} CAI DIANTE DO ${AA}`]), `${C} ${m}x${d} ${A}: time fica em ${ord(pos)}`],
    vexame: [`${C} é goleado pelo ${A}: ${m} a ${d}`, pick(r, [`VEXAME! ${CC} APANHA DO ${AA} E A TORCIDA PERDE A PACIÊNCIA`, `VERGONHA: ${AA} ENFIA ${d} NO ${CC}`]), `${C} ${m}x${d}: noite para esquecer`],
  }[res];
  if (g.classico) T[1] = (m > d ? `A CIDADE TEM DONO: ` : m < d ? `CLÁSSICO É DO RIVAL: ` : 'CLÁSSICO SEM DONO: ') + T[1];
  return JORNAIS.map((j, i) => ({ ...j, titulo: T[i] }));
}

// a crônica do jogo em linguagem natural
export function cronica(base, s) {
  const g = jogoMeu(base, s); if (!g) return null;
  const { u, C, A } = g, nomes = [base.clubes[u.casa].n, base.clubes[u.fora].n];
  const r = rng(`cron${s.seed}${s.ano}${u.rodada}`), F = [];
  F.push(`O ${nomes[0]} recebeu o ${nomes[1]} ${u.div === 'AMI' ? 'em amistoso de pré-temporada' : u.copa ? `${/^(Campeonato|Paulista)/.test(u.copa) ? 'pelo' : 'pela'} ${u.copa}` : `pela ${u.rodada + 1}ª rodada`}${g.classico ? ', num clássico que valia mais do que três pontos' : ''}.`);
  const p = [0, 0], liderou = [false, false];
  if (!g.gols.length) F.push(pick(r, ['O jogo foi truncado, com pouca criação dos dois lados.', 'Os goleiros pouco trabalharam e a bola teimou em não entrar.']));
  for (const e of g.gols) {
    const x = e.time, antes = [...p]; p[x]++;
    const quem = nomeJ(base, e.jogador), time = nomes[x], ass = e.assist ? `, com passe de ${nomeJ(base, e.assist)}` : '', pen = e.penalti ? ' de pênalti' : '';
    const verbo = antes[0] === 0 && antes[1] === 0 ? 'abriu o placar' : antes[x] === antes[1 - x] - 1 ? 'empatou' : antes[x] === antes[1 - x] ? (liderou[x] ? 'recolocou o time na frente' : 'virou o jogo') : antes[x] > antes[1 - x] ? 'ampliou' : 'descontou';
    if (p[x] > p[1 - x]) liderou[x] = true;
    F.push(`${e.min >= 85 ? 'No fim, aos' : 'Aos'} ${e.min}', ${quem} ${verbo}${pen} para o ${time}${ass}.`);
  }
  for (const e of (u.eventos || []).filter(e => e.tipo === 'vermelho')) F.push(`${nomeJ(base, e.jogador)} foi expulso aos ${e.min}' e deixou o ${nomes[e.time]} com um a menos.`);
  if (g.craque) F.push(`O melhor do ${C} em campo foi ${nomeJ(base, g.craque[0])}, nota ${g.craque[1].toFixed(1).replace('.', ',')}.`);
  F.push(`${g.m > g.d ? 'Com a vitória' : g.m < g.d ? 'Com a derrota' : 'Com o empate'}, o ${C} fica em ${ord(g.pos)} na Série ${base.clubes[g.ci].div}.${g.m < g.d ? ` O ${A} comemora.` : ''}`);
  return F.join(' ');
}

// título, acesso e rebaixamento confirmados matematicamente (uma notícia por clube e acontecimento)
export function matematicos(base, s, tabs, add) {
  if (s.mat?.ano !== s.ano) s.mat = { ano: s.ano, k: [] };
  const uma = (k, f) => { if (!s.mat.k.includes(k)) { s.mat.k.push(k); f(); } };
  const ci = s.tecnico.clube, nome = c => base.clubes[c].n;
  for (const d of ['A', 'B', 'C']) {
    const tab = tabs[d], max = l => l.p + 3 * (38 - l.j), resta = 38 - tab[0].j;
    const [l1, ...outros] = tab;
    if (outros.every(l => max(l) < l1.p)) uma(`campeao-${d}`, () => add(l1.clube === ci ? 'clube' : 'destaque', d, `É CAMPEÃO! O ${nome(l1.clube)} conquista a Série ${d} ${resta ? `com ${resta} rodada${resta > 1 ? 's' : ''} de antecedência` : 'na última rodada'}.`, { clube: l1.clube }));
    for (const l of tab) {
      const resto = tab.filter(x => x !== l);
      if (d !== 'A' && resto.filter(x => max(x) >= l.p).length <= 3) uma(`acesso-${d}-${l.clube}`, () => add(l.clube === ci ? 'clube' : 'resultado', d, `Acesso garantido: o ${nome(l.clube)} está matematicamente na Série ${d === 'B' ? 'A' : 'B'} de ${s.ano + 1}.`, { clube: l.clube }));
      if (d !== 'C' && resto.filter(x => x.p > max(l)).length >= 16) uma(`queda-${d}-${l.clube}`, () => add(l.clube === ci ? 'clube' : 'crise', d, `Rebaixado: o ${nome(l.clube)} não tem mais chance e cai para a Série ${d === 'A' ? 'B' : 'C'}.`, { clube: l.clube }));
      if (l.clube === ci && d !== 'C' && resto.filter(x => max(x) < l.p).length >= 4) uma(`salvo-${d}-${ci}`, () => add('clube', d, `Missão cumprida: o ${nome(ci)} está matematicamente livre do rebaixamento.`, { clube: ci }));
    }
  }
}

// depois do clássico, alguém do vencedor provoca
export function alfinetadas(base, s, jogos, add, r) {
  for (const { d, h, a, sim } of jogos) {
    if (!rivais(base, h, a) || sim.gols[0] === sim.gols[1] || (h !== s.tecnico.clube && a !== s.tecnico.clube && r() > 0.4)) continue;
    const t = sim.gols[0] > sim.gols[1] ? 0 : 1, venc = t ? a : h, perd = t ? h : a;
    const [id] = Object.entries(sim.notas[t]).sort((x, y) => y[1] - x[1])[0] || [];
    if (id == null) continue;
    const frase = pick(r, ['A cidade tem dono.', 'Freguês é freguês.', `Manda um abraço pra torcida do ${base.clubes[perd].n}.`, 'Clássico a gente não joga, a gente ganha.', 'Podem ir se acostumando.']);
    add('imprensa', d, `Alfinetada: depois do clássico, ${nomeJ(base, id)} (${base.clubes[venc].n}) provoca: "${frase}"`, { jogador: +id, clube: venc, imprensa: true });
  }
}

// veteranos que vão parar no fim do ano avisam a partir da 30ª rodada (craques e quem é do seu clube)
export function aposentadorias(base, s, rd, add) {
  if (rd < 29) return;
  s.adeus ||= {};
  const ci = s.tecnico.clube;
  for (const j of base.jog.values()) {
    if (j.fora || j.idade < 33 || s.adeus[j.id] === s.ano || !(j.clube === ci || j.ovr >= 74) || !['A', 'B', 'C'].includes(base.clubes[j.clube].div)) continue;
    if (!evolucao(j, s.ano + 1 - j.anoBase).fora) continue;
    s.adeus[j.id] = s.ano;
    add(j.clube === ci ? 'clube' : 'destaque', base.clubes[j.clube].div, `${j.curto}, ${j.idade} anos, anuncia que vai pendurar as chuteiras no fim da temporada.`, { jogador: j.id, clube: j.clube });
  }
}
