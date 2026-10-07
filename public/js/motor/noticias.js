// Jornal da rodada: resultados, sequências, artilharia, crises e rumores de mercado.
// Rumor só sai quando faz sentido de futebol: clube maior, carência na posição e reforço de verdade.
import { rivais } from './rivais.js';
import { rng, pick, pickW, SETOR, nivelDiv } from './util.js';

const DIVS = ['A', 'B', 'C'];
export const media = e => e && e[0] ? e[3] / e[0] / 10 : 0;

// quem faria sentido ir atrás do jogador: clube maior, que precisa da posição e onde ele teria espaço.
// Ex.: ninguém busca centroavante veterano se já tem dois melhores que ele na posição.
export function interessados(base, j) {
  const daqui = base.clubes[j.clube], forcaAqui = base.forca(j.clube);
  return base.clubes.map((c, ci) => ci).filter(ci => {
    const c = base.clubes[ci];
    if (ci === j.clube || c.div === 'L' || nivelDiv(c) > nivelDiv(daqui) || rivais(base, ci, j.clube)) return false; // rival não negocia com rival
    if (c.div === 'X' && (j.idade > 29 || c.tier < 2)) return false;   // de fora só vem quem compra jovem, e de liga forte
    const f = base.forca(ci);
    if (f < forcaAqui + 2 || j.ovr < f - 6) return false;           // clube maior, e o jogador tem nível pra ele
    const naPos = base.elencos[ci].filter(x => x.pos === j.pos), acima = naPos.filter(x => x.ovr >= j.ovr);
    if (acima.length >= 2) return false;                             // já tem dois melhores: não faz sentido
    if (acima.length === 1) return j.idade <= 23 || naPos.length <= 1; // seria reserva: só jovem promessa ou elenco curto
    const tit = naPos.reduce((m, x) => Math.max(m, x.ovr), 0);
    return j.idade < 30 || j.ovr >= tit + 3;                         // veterano só se for reforço claro
  });
}

const MODELOS_RUMOR = [
  (j, de, para) => `${j} (${de}) está na mira do ${para}.`,
  (j, de, para) => `${para} monitora ${j}, do ${de}, para a próxima janela.`,
  (j, de, para) => `Empresário de ${j} se reuniu com a diretoria do ${para}.`,
  (j, de, para, pos) => `${j} é o plano A do ${para} para reforçar a ${pos}.`,
  (j, de, para) => `Olheiros do ${para} foram ver ${j} jogar pelo ${de}.`,
];
const SETOR_TXT = { GOL: 'meta', DEF: 'defesa', MEI: 'meia-cancha', ATA: 'frente' };
const ORD = n => `${n}ª`;
const qtd = (q, um, varios) => `${q} ${q === 1 ? um : varios}`;

// manchete da capa: o que o craque da rodada fez no jogo dele (t = lado dele no jogo x)
export function manchete(base, j, n, x, t, r = Math.random) {
  const ev = x.sim.eventos.filter(e => e.tipo === 'gol');
  const gols = ev.filter(e => e.jogador === j.id).length, ass = ev.filter(e => e.assist === j.id).length;
  const meus = x.sim.gols[t], deles = x.sim.gols[1 - t], defesas = x.sim.stats?.[t]?.defesas || 0;
  const N = j.curto, A = base.clubes[t ? x.h : x.a].n, C = base.clubes[t ? x.a : x.h].n, venceu = meus > deles;
  let titulo, fato = [gols && qtd(gols, 'gol', 'gols'), ass && qtd(ass, 'assistência', 'assistências')].filter(Boolean).join(' e ');
  if (j.pos === 'GOL' && defesas >= 4) { titulo = venceu || meus === deles ? pick(r, [`Paredão: ${N} faz ${defesas} defesas e segura o ${A}!`, `São ${N}! ${defesas} defesas contra o ${A}`]) : `${N} faz ${defesas} defesas, mas não segura o ${A}`; fato = `${defesas} defesas`; }
  else if (gols >= 3) titulo = pick(r, gols === 3 ? [`Show de ${N}: hat-trick contra o ${A}!`, `Tripleta de ${N} contra o ${A}!`, `${N} faz três e leva a bola para casa!`] : [`${N} marca ${gols} vezes e atropela o ${A}!`, `Noite de gala: ${N} faz ${gols} no ${A}!`]);
  else if (gols === 2) titulo = venceu ? pick(r, [`${N} faz dois e derruba o ${A}!`, `Dobradinha de ${N} contra o ${A}!`, `${N} marca duas vezes e o ${C} bate o ${A}!`]) : `${N} marca duas vezes contra o ${A}`;
  else if (ass >= 2) titulo = `Garçom: ${N} serve ${ass} vezes contra o ${A}!`;
  else if (gols === 1 && venceu && meus - deles === 1) titulo = pick(r, [`${N} decide e o ${C} vence o ${A}!`, `Gol de ${N} vale a vitória sobre o ${A}!`]);
  else if (gols + ass) titulo = `${N} brilha contra o ${A}`;
  else if (!deles && (j.pos === 'GOL' || SETOR[j.pos] === 'DEF')) { titulo = `Muralha: ${N} fecha a porta para o ${A}!`; fato = 'Sem sofrer gols'; }
  else titulo = `${N} é o dono da rodada`;
  const placar = `${base.clubes[x.h].n} ${x.sim.gols[0]} × ${x.sim.gols[1]} ${base.clubes[x.a].n}`;
  return { titulo, sub: `${fato ? `${fato} em ` : ''}${placar}. Nota ${n.toFixed(1).replace('.', ',')}.` };
}

export function gerarNoticias(base, s, rd, jogos, tabs) {
  const r = rng(`jornal${s.seed}-${rd}`), meu = s.tecnico.clube, N = [];
  const add = (tipo, div, texto, extra) => N.push({ rodada: rd + 1, tipo, div, texto, ...extra });
  const nome = ci => base.clubes[ci].n, curto = id => base.jog.get(+id)?.curto || '?';
  const golsNaRodada = {};

  for (const { d, h, a, sim } of jogos) for (const e of sim.eventos) if (e.tipo === 'gol') golsNaRodada[e.jogador] = (golsNaRodada[e.jogador] || 0) + 1;

  // seu jogo
  const mj = jogos.find(x => x.h === meu || x.a === meu);
  if (mj) {
    const g = mj.sim.eventos.filter(e => e.tipo === 'gol');
    add('clube', mj.d, `${rivais(base, mj.h, mj.a) ? 'Clássico: ' : ''}${nome(mj.h)} ${mj.sim.gols[0]} × ${mj.sim.gols[1]} ${nome(mj.a)}. ${g.length ? 'Gols: ' + g.map(e => `${curto(e.jogador)} ${e.min}'`).join(', ') + '.' : 'Sem gols.'}`);
  }

  for (const d of DIVS) {
    const daDiv = jogos.filter(x => x.d === d), tab = tabs[d];
    // goleada da rodada
    const gol = daDiv.map(x => ({ ...x, m: Math.abs(x.sim.gols[0] - x.sim.gols[1]) })).sort((x, y) => y.m - x.m)[0];
    if (gol && gol.m >= 3) add('resultado', d, `Goleada na Série ${d}: ${nome(gol.h)} ${gol.sim.gols[0]} × ${gol.sim.gols[1]} ${nome(gol.a)}.`, { clube: gol.sim.gols[0] > gol.sim.gols[1] ? gol.h : gol.a });
    // liderança
    s.lider = s.lider || {};
    if (rd >= 2 && tab[0].clube !== s.lider[d]) add('resultado', d, `${nome(tab[0].clube)} assume a liderança da Série ${d} com ${tab[0].p} pontos.`, { clube: tab[0].clube });
    s.lider[d] = tab[0].clube;
    // sequências: anuncia quando chega a 4 seguidas
    for (const l of tab) {
      const u = l.ultimos, ult = u[u.length - 1];
      let n = 0; for (let i = u.length - 1; i >= 0 && u[i] === ult; i--) n++;
      if (n !== 4 || ult === 'E') continue;
      const ehMeu = l.clube === meu;
      if (ult === 'V') add(ehMeu ? 'clube' : 'resultado', d, `${nome(l.clube)} engata a quarta vitória seguida na Série ${d}.`, { clube: l.clube });
      else add(ehMeu ? 'clube' : 'crise', d, ehMeu ? `Quarta derrota seguida. A torcida protesta e a diretoria cobra reação.` : `Crise no ${nome(l.clube)}: quarta derrota seguida e técnico pressionado.`, { clube: l.clube, imprensa: true });
    }
    // hat-tricks e artilharia
    const top3 = Object.entries(s.est).filter(([id]) => base.clubes[base.jog.get(+id)?.clube]?.div === d).sort((x, y) => y[1][1] - x[1][1]).slice(0, 3).map(([id]) => +id);
    for (const [id, nRd] of Object.entries(golsNaRodada)) {
      const j = base.jog.get(+id); if (base.clubes[j.clube].div !== d) continue;
      const agora = s.est[id][1], antes = agora - nRd;
      if (nRd >= 3) add('destaque', d, `${j.curto} marca ${nRd === 3 ? 'três' : nRd} vezes pelo ${nome(j.clube)}.`, { jogador: j.id });
      else if (agora >= 5 && Math.floor(antes / 5) < Math.floor(agora / 5) && (agora >= 10 || top3.includes(j.id))) add('destaque', d, `${j.curto} chega a ${agora} gols na Série ${d}${top3[0] === j.id ? ' e lidera a artilharia' : ''}.`, { jogador: j.id });
    }
  }

  // rumores: quem está jogando bem desperta interesse de quem precisa
  if (rd >= 3) {
    s.rumores = s.rumores || {};
    const emAlta = [...base.jog.values()].filter(j => {
      const e = s.est[j.id];
      return e && e[0] >= 3 && j.idade <= 32 && (media(e) >= 6.8 || e[1] >= Math.max(3, e[0] * 0.4)) && !(s.rumores[j.id] > rd - 8);
    });
    let qtos = 2 + Math.floor(r() * 2);
    while (qtos > 0 && emAlta.length) {
      const j = pickW(r, emAlta, x => media(s.est[x.id]) + s.est[x.id][1] * 0.3 + (x.clube === meu ? 2 : 0));
      emAlta.splice(emAlta.indexOf(j), 1);
      const opcoes = interessados(base, j); if (!opcoes.length) continue;
      qtos--;
      const para = pickW(r, opcoes, ci => base.clubes[ci].fan + base.forca(ci) / 10);
      s.rumores[j.id] = rd;
      const texto = pick(r, MODELOS_RUMOR)(j.curto, nome(j.clube), nome(para), SETOR_TXT[SETOR[j.pos]]);
      add(j.clube === meu ? 'clube' : 'rumor', base.clubes[j.clube].div, j.clube === meu ? `Assédio: ${texto}` : texto, { jogador: j.id, de: j.clube, para });
    }
  }

  // craque e seleção da rodada de cada série
  s.destaques = {};
  for (const d of DIVS) {
    const notas = [];
    for (const x of jogos.filter(y => y.d === d)) for (const t of [0, 1]) for (const [id, n] of Object.entries(x.sim.notas[t])) notas.push([+id, n, x, t]);
    notas.sort((x, y) => y[1] - x[1]);
    const vagas = { GOL: 1, DEF: 4, MEI: 3, ATA: 3 }, time = [];
    for (const [id, n] of notas) { const st = SETOR[base.jog.get(id).pos]; if (vagas[st]) { vagas[st]--; time.push([id, n]); } }
    s.destaques[d] = { rodada: rd + 1, time };
    if (d === base.clubes[meu].div && notas[0]) {
      const [id, n, x, t] = notas[0], j = base.jog.get(id);
      add('destaque', d, `Craque da ${ORD(rd + 1)} rodada: ${j.curto} (${nome(j.clube)}), nota ${n.toFixed(1).replace('.', ',')}.`, { jogador: j.id });
      s.manchete = { rodada: rd + 1, div: d, jogador: j.id, nota: n, ...manchete(base, j, n, x, t, r) };
    }
  }

  s.noticias = [...N, ...s.noticias].slice(0, 220);
}
