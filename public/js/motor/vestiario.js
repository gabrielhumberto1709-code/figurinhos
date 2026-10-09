// Vestiário: temperamento de cada jogador, preleção antes do jogo, conversa individual, pedido de aumento,
// reserva que reclama em público, motim liderado pelo capitão e faixas de protesto depois de derrotas seguidas.
import { rng, clamp } from './util.js';
import { sufixo, ehHumano } from './humanos.js';
import { proximoEvento, previa, escalacao, capitaoDe } from './mundo.js';
import { salarioDia, salarioBase, passaDoTeto } from './financas.js';
import { faseDe } from './forma.js';

export const TEMPERAMENTOS = {
  profissional: { nome: 'Profissional', desc: 'Encara cobrança como parte do trabalho.' },
  sensivel: { nome: 'Sensível', desc: 'Sente muito a crítica, cresce com carinho.' },
  temperamental: { nome: 'Temperamental', desc: 'Pavio curto: cobrança pública pode explodir.' },
  ambicioso: { nome: 'Ambicioso', desc: 'Quer jogar sempre e quer mais: salário, clube maior, títulos.' },
};
export function temperamento(j) {
  const x = rng(`temp${j.id}`)();
  return x < 0.45 ? 'profissional' : x < 0.65 ? 'sensivel' : x < 0.85 ? 'temperamental' : 'ambicioso';
}
const mexe = (s, id, d) => { s.mor[id] = clamp((s.mor[id] ?? 62) + d, 0, 100); };
// como o técnico trata cada jogador (-10 a 10): pesa na hora de renovar
export const tratar = (s, id, d) => { (s.trato ||= {})[id] = clamp((s.trato[id] || 0) + d, -10, 10); };
const chaveJogo = ev => ev ? `${ev.tipo}-${ev.rodada ?? ev.fase ?? 0}-${ev.h}-${ev.a}` : null;

// ---------- preleção ----------
export const PRELECOES = {
  tranquila: { nome: 'Tranquila', desc: 'Sem pressão: jogar o que sabe.' },
  motivadora: { nome: 'Motivadora', desc: 'Vamos pra cima, é jogo pra deixar o sangue.' },
  confianca: { nome: 'Confiança', desc: 'Vocês são melhores que eles.' },
  cobranca: { nome: 'Cobrar postura', desc: 'Do jeito que vem jogando, não dá.' },
};
// efeito na moral dos titulares conforme o favoritismo e o último resultado
export function efeitoPrelecao(base, s, tom, j) {
  const ev = proximoEvento(base, s); if (!ev) return 0;
  const p = previa(base, s, ev), fav = p.vitoria >= 50, zebra = p.vitoria <= 30, u = s.ultima, t = u && (u.casa === s.tecnico.clube ? 0 : 1), perdeu = !!u && u.gols[t] < u.gols[1 - t];
  let d = { tranquila: fav ? 2 : 1, motivadora: zebra ? 4 : fav ? 1 : 3, confianca: zebra ? 2 : fav ? 2 : 1, cobranca: perdeu ? 3 : -1 }[tom] ?? 0;
  if (j) { const t = temperamento(j); if (tom === 'cobranca') d += t === 'sensivel' ? -3 : t === 'temperamental' ? -4 : t === 'profissional' ? 1 : 0; if (tom === 'confianca' && t === 'ambicioso') d += 2; if (tom === 'tranquila' && t === 'sensivel') d += 1; }
  return d;
}
export const prelecaoFeita = (base, s) => { const k = chaveJogo(proximoEvento(base, s)); return s.prelecao?.chave === k ? s.prelecao.tom : null; };
export function fazerPrelecao(base, s, tom) {
  const ev = proximoEvento(base, s), k = chaveJogo(ev);
  if (!k || !PRELECOES[tom]) return 'Sem jogo marcado.';
  if (s.prelecao?.chave === k) return 'A preleção deste jogo já foi feita.';
  const xi = escalacao(base, s, s.tecnico.clube).xi.filter(Boolean);
  let soma = 0; for (const j of xi) { const d = efeitoPrelecao(base, s, tom, j); mexe(s, j.id, d); soma += d; }
  s.prelecao = { chave: k, tom, media: Math.round(soma / Math.max(1, xi.length) * 10) / 10 };
  if (tom === 'cobranca') s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', imprensa: true, div: base.clubes[s.tecnico.clube].div, texto: `Vazou do vestiário: ${s.tecnico.nome} cobrou postura do elenco antes do jogo.` });
  return null;
}

// ---------- conversa individual ----------
export const CONVERSAS = {
  elogiar: { nome: 'Elogiar', desc: 'Reconhecer o trabalho.' },
  cobrar: { nome: 'Cobrar', desc: 'Exigir mais dele.' },
  prometer: { nome: 'Prometer minutos', desc: 'Ele vai jogar nos próximos jogos.' },
  banco: { nome: 'Ameaçar com o banco', desc: 'Ou rende ou senta.' },
};
export const podeConversar = (s, id) => !(s.conversas?.[id] && s.conversas[id].ano === s.ano && s.rodada - s.conversas[id].rodada < 3);
export function conversar(base, s, id, tipo) {
  const j = base.jog.get(+id); if (!j || j.clube !== s.tecnico.clube || !CONVERSAS[tipo]) return { txt: 'Não dá pra conversar com ele.' };
  if (!podeConversar(s, j.id)) return { txt: `Vocês conversaram há pouco. Espere umas rodadas.` };
  const t = temperamento(j), f = faseDe(s, j.id), bom = f.d > 0 || (s.forma?.[j.id] ?? 6.3) >= 6.5;
  let d, txt;
  if (tipo === 'elogiar') { d = bom ? 5 : t === 'sensivel' ? 3 : 1; txt = bom ? `${j.curto} gostou do reconhecimento.` : `${j.curto} agradeceu, mas sabe que não vem jogando tão bem.`; }
  else if (tipo === 'cobrar') { d = t === 'profissional' ? 2 : t === 'ambicioso' ? 1 : t === 'sensivel' ? -6 : -8; txt = d > 0 ? `${j.curto} ouviu e prometeu mais empenho.` : `${j.curto} não gostou nada da cobrança.`; }
  else if (tipo === 'prometer') { d = 6; s.promessas = { ...(s.promessas || {}), [j.id]: { rodada: s.rodada, ano: s.ano } }; txt = `${j.curto} ficou animado. Ele vai cobrar a promessa nos próximos 3 jogos.`; }
  else { d = t === 'profissional' ? -2 : t === 'temperamental' ? -10 : -6; txt = t === 'temperamental' ? `${j.curto} saiu batendo a porta.` : `${j.curto} entendeu o recado.`; }
  mexe(s, j.id, d);
  tratar(s, j.id, { elogiar: 1, prometer: 1, cobrar: t === 'profissional' ? 0 : -1, banco: t === 'temperamental' ? -3 : -2 }[tipo]);
  (s.conversas ||= {})[j.id] = { rodada: s.rodada, ano: s.ano, tipo };
  if (tipo === 'banco' && t === 'temperamental') s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', imprensa: true, jogador: j.id, div: base.clubes[j.clube].div, texto: `Clima tenso: ${j.curto} discute com ${s.tecnico.nome} no treino.` });
  return { txt, d };
}

// ---------- pedido de aumento ----------
export function responderAumento(base, s, id, sim) {
  const p = (s.pedidosAumento || []).find(x => x.jogador === +id); if (!p) return 'O pedido não está mais de pé.';
  const j = base.jog.get(p.jogador);
  s.pedidosAumento = s.pedidosAumento.filter(x => x !== p);
  if (!j || j.clube !== s.tecnico.clube) return null;
  if (sim) {
    const teto = passaDoTeto(base, s, p.valor, s.salarios?.[j.id] || 0);
    if (teto) { s.pedidosAumento.push(p); return teto; }
    s.salarios[j.id] = p.valor; mexe(s, j.id, 10); tratar(s, j.id, 3); return `${j.curto} ganhou o aumento e está feliz da vida.`;
  }
  mexe(s, j.id, temperamento(j) === 'ambicioso' ? -16 : -12); tratar(s, j.id, -3);
  if (temperamento(j) === 'ambicioso') (s.querSair ||= {})[j.id] = { de: j.clube, rodada: s.rodada, motivo: 'queria valorização' };
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', imprensa: true, jogador: j.id, div: base.clubes[j.clube].div, texto: `${j.curto} fica insatisfeito: o clube negou o pedido de aumento.` });
  return `${j.curto} não gostou da resposta.`;
}

// ---------- resposta às mensagens dos jogadores ----------
export function responderJogador(base, s, msgId, r) {
  const m = (s.msgs || []).find(x => x.id === msgId); if (!m || m.resp || !m.opcoes) return 'Mensagem já respondida.';
  const j = base.jog.get(m.autor), op = m.opcoes.find(o => o[0] === r); if (!j || !op) return null;
  if (j.clube !== s.tecnico.clube) { m.resp = r; return `${j.curto} não está mais no clube.`; }
  const t = temperamento(j), el = base.elencos[s.tecnico.clube];
  let txt;
  if (m.tipoJ === 'jogar') {
    if (r === 'prometer') { s.promessas = { ...(s.promessas || {}), [j.id]: { rodada: s.rodada, ano: s.ano } }; mexe(s, j.id, 6); txt = `${j.curto} ficou animado. Ele vai cobrar a promessa nos próximos 3 jogos.`; }
    else { mexe(s, j.id, t === 'profissional' ? 0 : t === 'sensivel' ? -5 : -3); txt = `${j.curto} vai esperar a vez dele.`; }
  } else if (m.tipoJ === 'sair' || m.tipoJ === 'emprestimo') {
    const lista = m.tipoJ === 'sair' ? 'venda' : 'emprestimo';
    if (r === 'vender' || r === 'emprestar') { if (!s.listas[lista].includes(j.id)) { s.listas[lista === 'venda' ? 'emprestimo' : 'venda'] = s.listas[lista === 'venda' ? 'emprestimo' : 'venda'].filter(x => x !== j.id); s.listas[lista].push(j.id); } mexe(s, j.id, 4); txt = `${j.curto} está ${lista === 'venda' ? 'à venda' : 'na lista de empréstimo'}. As propostas chegam com a janela aberta.`; }
    else { mexe(s, j.id, m.tipoJ === 'sair' ? -6 : -4); txt = `${j.curto} não gostou, mas fica.`; }
  } else if (m.tipoJ === 'fase') {
    if (r === 'apoiar') { mexe(s, j.id, 5); txt = `${j.curto} agradeceu o apoio.`; }
    else { const d = t === 'profissional' ? 2 : t === 'ambicioso' ? 0 : -6; mexe(s, j.id, d); txt = d >= 0 ? `${j.curto} aceitou a cobrança.` : `${j.curto} sentiu a cobrança.`; }
  } else if (m.tipoJ === 'reforco') {
    if (r === 'prometer') { for (const x of el) mexe(s, x.id, 1); txt = 'O grupo gostou de ouvir. Agora é buscar no Mercado.'; }
    else { mexe(s, j.id, -3); for (const x of el) if (x !== j) mexe(s, x.id, 1); txt = `${j.curto} esperava reforço, mas o grupo gostou da confiança.`; }
  }
  tratar(s, j.id, { prometer: 1, paciencia: -1, vender: 1, segurar: -2, emprestar: 1, fica: -1, apoiar: 1, cobrar: -1 }[r] || 0);
  m.resp = r;
  return txt;
}

// ---------- depois de cada rodada ----------
export function vestiarioAposRodada(base, s, tabs) {
  const ci = s.tecnico.clube, el = base.elencos[ci], r = rng(`vest${s.seed}${s.ano}${s.rodada}${sufixo(s, ci)}`), N = [], add = (texto, extra = {}) => N.push({ tipo: 'clube', clube: ci, imprensa: true, texto, ...extra });
  if (s.demitido) return N;
  // promessa de minutos não cumprida
  for (const [id, p] of Object.entries(s.promessas || {})) {
    const j = base.jog.get(+id);
    if (!j || !ehHumano(s, j.clube) || p.ano !== s.ano) { delete s.promessas[id]; continue; }
    if (j.clube !== ci) continue;                                          // promessa de outro técnico
    if (!s.semJogar?.[id]) { delete s.promessas[id]; continue; }            // jogou: promessa cumprida
    if (s.rodada - p.rodada >= 3) { mexe(s, id, -10); tratar(s, id, -3); delete s.promessas[id]; add(`${j.curto} reclama: "O professor prometeu que eu ia jogar. Não jogou ninguém aqui."`, { jogador: j.id }); }
  }
  // pedidos de aumento: quem está voando e ganha pouco
  s.pedidosAumento = (s.pedidosAumento || []).filter(p => {
    if (s.rodada - p.rodada < 3) return true;
    const j = base.jog.get(p.jogador); if (j && j.clube === ci) { mexe(s, j.id, -6); add(`${j.curto} se irrita com o silêncio da diretoria sobre o aumento.`, { jogador: j.id }); }
    return false;
  });
  for (const j of el) {
    if ((s.pedidosAumento || []).some(p => p.jogador === j.id) || s.aumentoPedido?.[j.id] === s.ano) continue;
    const quer = faseDe(s, j.id).k === 'excelente' || ((s.est?.[j.id]?.[1] || 0) >= 8 && temperamento(j) !== 'profissional');
    if (!quer || salarioDia(base, s, j) > salarioBase(base.clubes[ci], j) * 1.4 || r() > 0.12) continue;
    const valor = Math.round(salarioDia(base, s, j) * (1.25 + r() * 0.2) / 10) * 10;
    (s.pedidosAumento ||= []).push({ jogador: j.id, valor, rodada: s.rodada });
    (s.aumentoPedido ||= {})[j.id] = s.ano;
  }
  // reserva que é dos melhores e não entra reclama em público (o grupo sente)
  for (const j of el) if ((s.semJogar?.[j.id] || 0) >= 4 && (s.mor[j.id] ?? 62) < 45 && j.ovr >= 70 && r() < 0.25 && !(s.reclamou?.[j.id] > s.rodada - 6)) {
    (s.reclamou ||= {})[j.id] = s.rodada;
    for (const x of el) mexe(s, x.id, -1);
    add(`${j.curto} desabafa: "Não sei mais o que fazer pra jogar." O vestiário sente.`, { jogador: j.id });
  }
  // derrotas seguidas: faixas de protesto; com o grupo em baixa, o capitão pode puxar um motim
  const l = tabs[base.clubes[ci].div].find(x => x.clube === ci), ult = l.ultimos, seguidas = (() => { let n = 0; for (let i = ult.length - 1; i >= 0 && ult[i] === 'D'; i--) n++; return n; })();
  if (seguidas === 3) { for (const x of el) mexe(s, x.id, -2); s.torcida = clamp((s.torcida ?? 55) - 2, 0, 100); add('Faixas de protesto no CT depois da terceira derrota seguida. A torcida cobra o elenco.'); }
  const grupo = el.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 16).reduce((t, j) => t + (s.mor[j.id] ?? 62), 0) / Math.min(16, el.length || 1);
  if (ult.slice(-4).filter(x => x === 'D').length >= 3 && grupo < 42 && !(s.motim > s.rodada - 8) && r() < 0.3) {
    const cap = base.jog.get(capitaoDe(base, s, escalacao(base, s, ci).xi.filter(Boolean)));
    s.motim = s.rodada;
    for (const x of el) mexe(s, x.id, -3);
    s.fin.diretoria = clamp(s.fin.diretoria - 5, 0, 100);
    add(`Motim no ${base.clubes[ci].n}: ${cap ? `o capitão ${cap.curto} reúne` : 'jogadores reúnem'} o elenco sem a presença do técnico. A diretoria acompanha preocupada.`, cap ? { jogador: cap.id } : {});
  }
  return N;
}
