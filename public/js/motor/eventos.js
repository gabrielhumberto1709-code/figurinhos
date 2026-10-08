// Eventos do dia a dia: indisciplina, briga, doping, apostas, dinheiro que entra e sai, histórias curiosas.
// No seu clube mexem em moral, caixa, diretoria e torcida (e podem afastar jogador); nos outros viram notícia.
import { rng, pick, pickW, clamp, fmtDinheiro } from './util.js';
import { lancar, folhaDia } from './financas.js';
import { temperamento } from './vestiario.js';
import { faseDe } from './forma.js';

const mexe = (s, id, d) => { s.mor[id] = clamp((s.mor[id] ?? 62) + d, 0, 100); };
const afastar = (s, id, n, motivo) => { (s.afast ||= {})[id] = { n, motivo }; };
// dinheiro de evento é proporcional ao elenco, mas com teto (um aporte de €46 mi num clube grande quebrava a economia)
const teto = (v, max) => Math.max(1e4, Math.round(Math.min(v, max) / 10000) * 10000);
const valorElenco = (base, ci) => base.elencos[ci].reduce((t, j) => t + j.valor * 1000, 0);

// cada evento: peso no contexto e o que acontece (devolve o texto da notícia)
const EVENTOS = {
  balada: {
    peso: c => c.perdeu ? 3 : 1.2,
    faz: (base, s, c, r) => { const j = pickW(r, c.el, x => ({ temperamental: 4, ambicioso: 2, sensivel: 1, profissional: 0.4 })[temperamento(x)]); const n = 1 + (r() < 0.4); afastar(s, j.id, n, 'indisciplina'); mexe(s, j.id, -6); lancar(s, 'multa', `Multa de ${j.curto} (indisciplina)`, Math.round(folhaDia(base, s) * 0.4)); return { texto: `${j.curto} é flagrado em festa na véspera do jogo. O clube afasta o jogador por ${n} jogo${n > 1 ? 's' : ''} e aplica multa.`, jogador: j.id }; },
  },
  atraso: { peso: () => 1.5, faz: (base, s, c, r) => { const j = pick(r, c.el); mexe(s, j.id, -2); return { texto: `${j.curto} se atrasa para a reapresentação e paga multa interna.`, jogador: j.id }; } },
  briga: {
    peso: c => c.el.filter(j => temperamento(j) === 'temperamental').length >= 2 ? (c.perdeu ? 2 : 0.8) : 0,
    faz: (base, s, c, r) => { const t = c.el.filter(j => temperamento(j) === 'temperamental'), a = pick(r, t), b = pick(r, t.filter(x => x !== a)); mexe(s, a.id, -5); mexe(s, b.id, -5); for (const j of c.el) mexe(s, j.id, -1); return { texto: `Treino quente: ${a.curto} e ${b.curto} discutem e precisam ser separados.`, jogador: a.id }; },
  },
  aniversario: { peso: () => 1, faz: (base, s, c, r) => { const j = pick(r, c.el); for (const x of c.el) mexe(s, x.id, 1); s.cond[j.id] = Math.min(s.cond[j.id] ?? 100, 85); return { texto: `Aniversário de ${j.curto}: churrasco no CT e clima leve no elenco.`, jogador: j.id }; } },
  doping: { peso: () => 0.08, faz: (base, s, c, r) => { const j = pick(r, c.el); afastar(s, j.id, 6, 'doping'); (s.julgamentos ||= []).push({ jogador: j.id, rodada: s.rodada + 4, ano: s.ano }); return { texto: `Exame antidoping de ${j.curto} dá positivo. Ele fica fora preventivamente e vai a julgamento em 4 rodadas.`, jogador: j.id }; } },
  apostas: { peso: () => 0.06, faz: (base, s, c, r) => { const j = pick(r, c.el); afastar(s, j.id, 8, 'investigação'); mexe(s, j.id, -15); s.fin.diretoria = clamp(s.fin.diretoria - 3, 0, 100); return { texto: `${j.curto} é citado numa investigação sobre apostas. O clube afasta o jogador por 8 jogos até tudo se esclarecer.`, jogador: j.id }; } },
  patrocinio: { peso: (c, s) => s.caixa < c.ve * 0.05 ? 2 : 0.7, faz: (base, s, c, r) => { const v = teto(c.ve * (0.01 + r() * 0.02), 2.5e6); lancar(s, 'patrocinio', 'Patrocínio pontual de nova marca', v); return { texto: `Nova marca fecha patrocínio pontual com o ${c.nome}: ${fmtDinheiro(v)} no caixa.` }; } },
  investidor: { peso: () => 0.12, faz: (base, s, c, r) => { const v = teto(c.ve * (0.03 + r() * 0.05), 6e6); lancar(s, 'investidor', 'Aporte de investidor', v); s.fin.diretoria = clamp(s.fin.diretoria + 5, 0, 100); return { texto: `Grupo investidor faz aporte de ${fmtDinheiro(v)} no ${c.nome}. A diretoria promete reforços.` }; } },
  calote: { peso: () => 0.5, faz: (base, s, c, r) => { const v = teto(c.ve * (0.005 + r() * 0.01), 1.5e6); lancar(s, 'calote', 'Calote de patrocinador', -v); return { texto: `Patrocinador dá calote e o ${c.nome} deixa de receber ${fmtDinheiro(v)}.` }; } },
  penhora: { peso: (c, s) => s.fin.atraso || s.caixa < 0 ? 1.5 : 0, faz: (base, s, c, r) => { const v = Math.round(folhaDia(base, s) * (5 + r() * 10) / 1000) * 1000; lancar(s, 'penhora', 'Penhora judicial', -v); return { texto: `Justiça penhora ${fmtDinheiro(v)} das contas do ${c.nome} por dívidas antigas.` }; } },
  show: { peso: c => c.fan >= 6 ? 0.7 : 0.3, faz: (base, s, c, r) => { const v = teto(c.ve * (0.003 + r() * 0.006), 8e5); lancar(s, 'show', 'Aluguel do estádio para show', v); return { texto: `Show internacional no estádio do ${c.nome} rende ${fmtDinheiro(v)} ao clube.` }; } },
  vaquinha: { peso: (c, s) => s.fin.atraso ? 2 : 0, faz: (base, s, c, r) => { const v = Math.round(folhaDia(base, s) * (2 + r() * 3) / 1000) * 1000; lancar(s, 'vaquinha', 'Vaquinha da torcida', v); s.torcida = clamp((s.torcida ?? 55) + 3, 0, 100); return { texto: `Torcida faz vaquinha para ajudar a pagar os salários: ${fmtDinheiro(v)} arrecadados.` }; } },
  audio: { peso: () => 0.4, faz: (base, s, c, r) => { const j = pick(r, c.el); mexe(s, j.id, -5); s.fin.diretoria = clamp(s.fin.diretoria - 2, 0, 100); return { texto: `Vaza áudio de ${s.tecnico.nome} criticando ${j.curto} numa conversa interna. Clima estranho no CT.`, jogador: j.id }; } },
  curioso: { peso: () => 1.2, faz: (base, s, c, r) => { const j = pick(r, c.el), k = Math.floor(r() * 5); for (const x of c.el) mexe(s, x.id, 1);
    return { texto: [`${j.curto} perde o voo e chega à concentração de carona com torcedores. Virou ídolo da caravana.`, `Um cachorro invade o treino do ${c.nome} e só sai depois de ganhar um rachão.`, `${j.curto} aparece com chuteira da cor do rival e é zoado o treino inteiro.`, `Pane no ônibus: o elenco do ${c.nome} termina o caminho a pé até o estádio.`, `${j.curto} promete raspar a cabeça se o time vencer o próximo jogo.`][k], jogador: j.id }; } },
};

export function eventosAposRodada(base, s) {
  const ci = s.tecnico.clube, r = rng(`evento${s.seed}${s.ano}${s.rodada}`), N = [];
  if (s.demitido) return N;
  // julgamentos marcados (doping)
  for (const jl of (s.julgamentos || []).filter(x => x.ano === s.ano && x.rodada <= s.rodada)) {
    const j = base.jog.get(jl.jogador);
    if (j) { if (rng(`julg${jl.jogador}${jl.rodada}`)() < 0.4) { delete s.afast?.[j.id]; N.push({ tipo: 'clube', clube: j.clube, jogador: j.id, texto: `${j.curto} é absolvido no julgamento por doping e está liberado.` }); }
      else { const n = 10 + Math.floor(r() * 16); afastar(s, j.id, n, 'doping'); N.push({ tipo: 'clube', clube: j.clube, jogador: j.id, imprensa: true, texto: `${j.curto} é condenado por doping: ${n} jogos de suspensão.` }); } }
  }
  s.julgamentos = (s.julgamentos || []).filter(x => !(x.ano === s.ano && x.rodada <= s.rodada));
  if (r() > 0.3) return N; // mais ou menos um evento a cada três rodadas
  const ult = s.ultima, t = ult && (ult.casa === ci ? 0 : 1);
  const c = { el: base.elencos[ci].filter(j => !s.emprestimos?.[j.id] || s.emprestimos[j.id].para === ci), nome: base.clubes[ci].n, fan: base.clubes[ci].fan, ve: valorElenco(base, ci), perdeu: !!ult && ult.gols[t] < ult.gols[1 - t] };
  if (!c.el.length) return N;
  const pesos = Object.entries(EVENTOS).map(([k, e]) => [k, e.peso(c, s)]).filter(([, p]) => p > 0);
  const [k] = pickW(r, pesos, x => x[1]);
  const res = EVENTOS[k].faz(base, s, c, r);
  N.push({ tipo: 'clube', clube: ci, evento: true, imprensa: ['balada', 'briga', 'doping', 'apostas', 'audio'].includes(k), ...res });
  return N;
}
