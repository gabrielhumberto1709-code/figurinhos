// Leilão ao vivo, conduzido pelo Dr. Arremate. Toda proposta de compra pode virar leilão: se outro clube com
// interesse, dinheiro e vaga quiser o mesmo jogador, ele entra na sala. A sua proposta é o lance inicial, cada lance
// novo volta o relógio a 30 s ("dou-lhe uma" aos 10, "dou-lhe duas" aos 5) e, quando o tempo acaba, leva quem deu
// mais. Só se disputa o valor da transferência: o salário se acerta depois, com o jogador.
// Do outro lado do balcão, o botão Leilão numa oferta recebida chama os interessados para cobrir; no fim, você decide.
// O núcleo (novoLeilao, lanceLeilao, desistirLeilao, tickLeilao) não sabe de save nem de tela e aceita quantos
// humanos houver na sala: é o mesmo para o modo offline e para o online.
import { rng, clamp, shuffle, fmtDinheiro } from './util.js';
import { rivais } from './rivais.js';
import { faseDe } from './forma.js';
import { janelaAberta, naoJogaA } from './mundo.js';
import { orcamento } from './financas.js';
import { interessados } from './noticias.js';
import { ehHumano } from './humanos.js';
import { caixaDe, precoPedido, vontade, transferir, querIr, clausula } from './mercado.js';

export const RELOGIO = 30, UMA = 10, DUAS = 5;
const r10 = v => Math.round(v / 1e4) * 1e4;
// lance mínimo: 3% acima do atual (pelo menos € 10 mil), e nunca abaixo do preço pedido pelo vendedor
export const minimo = L => Math.max(L.reserva || 0, r10(L.valor + Math.max(1e4, L.valor * 0.03)));
export const fmtLance = v => fmtDinheiro(v, 2);
const sorte = L => rng(`${L.seed}-${L.k++}`)();

// ---------- núcleo ----------
// participantes: [{ ci, humano, max }] (max = até onde a IA vai; para humano, o que ele pode gastar)
export function novoLeilao({ id, modo, jogador, vendedor, valor, lider, reserva = 0, participantes, seed }) {
  const L = { id, modo, jogador, vendedor, seed: String(seed), k: 0, t: 0, relogio: RELOGIO, valor, lider, reserva, fase: 0, comecou: false, fim: false, lances: [{ ci: lider, valor, t: 0 }], P: {} };
  for (const p of participantes) L.P[p.ci] = { humano: !!p.humano, max: p.max ?? Infinity, fora: false, acao: null, em: 0 };
  agendar(L);
  return L;
}
const ativos = L => Object.entries(L.P).filter(([, p]) => !p.fora).map(([ci, p]) => [+ci, p]);
// com gente de verdade na sala o relógio anda no tempo real; só a IA disputando, anda no dobro
const ritmo = L => ativos(L).some(([, p]) => p.humano) ? 1 : 2;
// quanto a IA oferece: o mínimo, às vezes um pulo de até 8% para assustar
const valorIA = (L, p) => Math.min(p.max, r10(minimo(L) * (sorte(L) < 0.25 ? 1.02 + sorte(L) * 0.06 : 1)));

// cada clube da IA que não lidera decide: cobre depois de alguns segundos (às vezes no "dou-lhe duas") ou baixa a placa
function agendar(L) {
  for (const [ci, p] of ativos(L)) {
    p.acao = null;
    if (p.humano || ci === L.lider) continue;
    if (minimo(L) <= p.max) { p.acao = 'lance'; p.em = L.t + (sorte(L) < 0.72 ? 1.5 + sorte(L) * 6 : RELOGIO - 9 + sorte(L) * 6.5); }
    else { p.acao = 'sai'; p.em = L.t + 1 + sorte(L) * 3; }
  }
  comprimir(L);
}
// ninguém mais pode cobrir (IA sem fôlego e nenhum humano fora da liderança): o leiloeiro vai direto ao "dou-lhe uma"
function comprimir(L) {
  if (!ativos(L).some(([ci, p]) => ci !== L.lider && (p.humano || p.acao === 'lance'))) L.relogio = Math.min(L.relogio, UMA + 0.5);
}

export function comecarLeilao(L) { L.comecou = true; }
export function lanceLeilao(L, ci, valor) {
  const p = L.P[ci];
  if (L.fim) return 'O martelo já bateu.';
  if (!p || p.fora) return 'Você já saiu deste leilão.';
  if (ci === L.lider) return 'O lance mais alto já é seu.';
  const v = r10(valor), min = minimo(L);
  if (!(v >= min)) return `O lance mínimo é ${fmtLance(min)}.`;
  if (v > p.max) return p.humano ? `Passa do que você pode gastar (${fmtLance(p.max)}).` : 'Sem fôlego.';
  Object.assign(L, { valor: v, lider: ci, relogio: RELOGIO, fase: 0 });
  L.lances.push({ ci, valor: v, t: Math.round(L.t * 10) / 10 });
  agendar(L);
  return null;
}
export function desistirLeilao(L, ci) {
  const p = L.P[ci];
  if (!p || p.fora || L.fim) return null;
  if (ci === L.lider) return 'O lance mais alto é seu: espere o martelo.';
  Object.assign(p, { fora: true, acao: null });
  comprimir(L);
  return null;
}
// avança o relógio dt segundos (reais) e devolve o que aconteceu: lance, sai, uma, duas, vendido
export function tickLeilao(L, dt) {
  const ev = [];
  if (L.fim || !L.comecou) return ev;
  let falta = dt * ritmo(L);
  for (let guarda = 0; falta > 1e-9 && !L.fim && guarda < 500; guarda++) {
    const prox = ativos(L).filter(([, p]) => p.acao).sort((a, b) => a[1].em - b[1].em)[0];
    const passo = Math.min(falta, L.relogio, prox ? Math.max(0, prox[1].em - L.t) : Infinity);
    L.t += passo; L.relogio -= passo; falta -= passo;
    if (L.relogio <= UMA && L.fase < 1) { L.fase = 1; ev.push({ tipo: 'uma' }); }
    if (L.relogio <= DUAS && L.fase < 2) { L.fase = 2; ev.push({ tipo: 'duas' }); }
    if (L.relogio <= 1e-9) { Object.assign(L, { relogio: 0, fim: true, fase: 3 }); ev.push({ tipo: 'vendido', ci: L.lider, valor: L.valor }); break; }
    if (prox && L.t >= prox[1].em - 1e-9) {
      const [ci, p] = prox;
      if (p.acao === 'sai') { Object.assign(p, { fora: true, acao: null }); comprimir(L); ev.push({ tipo: 'sai', ci }); }
      else if (!lanceLeilao(L, ci, valorIA(L, p))) ev.push({ tipo: 'lance', ci, valor: L.valor });
      else p.acao = null;
    }
  }
  return ev;
}
// termina sem os humanos (saiu da tela, fechou o app): quem lidera continua liderando, a IA segue disputando
export function terminarSemHumanos(L) {
  for (const [ci, p] of ativos(L)) if (p.humano && ci !== L.lider) Object.assign(p, { fora: true, acao: null });
  comprimir(L); L.comecou = true;
  for (let i = 0; i < 5000 && !L.fim; i++) tickLeilao(L, 5);
  return L;
}

// ---------- no jogo ----------
const nome = (base, ci) => base.clubes[ci].n;
const noticia = (base, s, texto, jogador) => s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', clube: s.tecnico.clube, mercado: true, div: base.clubes[s.tecnico.clube].div, texto, jogador });

// quem também quer o jogador: clube com nível para ele, vaga na posição, dinheiro e um jogador topando ir.
// A chance de ter concorrência sobe com o overall, a fase e a juventude (de ~10% num 64 a ~65% num craque em fase
// excelente). Sorteio fixo por rodada: refazer a proposta não muda a sala.
export function concorrentes(base, s, j, valor, sal = '') {
  const meu = s.tecnico.clube, ped = precoPedido(base, s, j), f = faseDe(s, j.id), r = rng(`leilao${s.seed}-${s.ano}-${s.rodada}-${j.id}${sal}`);
  if (r() >= clamp(0.12 + (j.ovr - 64) * 0.025 + f.d * 0.08 + (j.idade <= 22 ? 0.08 : 0), 0.08, 0.65)) return [];
  const chance = 0.5, piso = Math.max(ped, minimo({ valor, reserva: 0 }));
  const out = [];
  base.clubes.forEach((c, ci) => {
    if (ci === meu || ci === j.clube || ehHumano(s, ci) || !['A', 'B', 'C', 'X'].includes(c.div) || rivais(base, ci, j.clube)) return;
    if ((c.div === 'X' && (j.idade > 29 || c.tier < 2)) || naoJogaA(base, s, j.id, ci)) return;
    const el = base.elencos[ci];
    if (el.length >= 38 || j.ovr < base.forca(ci) - 4 || el.filter(x => x.pos === j.pos && x.ovr >= j.ovr).length >= 2) return;
    if (r() >= chance || vontade(base, s, j, ci) < 45) return;
    const max = r10(Math.min(caixaDe(base, s, ci) * (c.div === 'X' ? 3 : 0.5), precoPedido(base, s, j, ci) * (1.05 + r() * 0.35 + f.d * 0.05)));
    if (max >= piso) out.push({ ci, max, peso: c.fan + r() * 4 });
  });
  return out.sort((a, b) => b.peso - a.peso).slice(0, 3).map(({ ci, max }) => ({ ci, max }));
}

// logo depois de enviar a proposta de compra (ou, de surpresa, quando a resposta ia sair: tarde = true): se tem
// concorrência, o leilão abre e a tela vem sozinha
export function abrirLeilaoCompra(base, s, pid, tarde = false) {
  const p = s.propostas.find(x => x.id === pid && x.estado === 'aguardando');
  if (!p || (p.tipo || 'compra') !== 'compra' || p.troca || p.leilao || s.leilaoAtivo || !janelaAberta(s.ano, s.rodada, s.ultimaData)) return null;
  const j = base.jog.get(p.jogador), cid = clausula(base, s, j);
  if (ehHumano(s, j.clube)) return null;                  // jogador de outro técnico: quem decide é ele
  if (cid && p.valor >= cid.nac) return null;              // multa paga: o vendedor não escolhe comprador
  if (tarde && p.valor < precoPedido(base, s, j) * 0.85) return null; // proposta baixa o vendedor só recusa
  const rv = concorrentes(base, s, j, p.valor, tarde ? `-tarde-${s.semanaBloco?.n || 0}` : '');
  if (!rv.length) return null;
  const meu = s.tecnico.clube;
  p.leilao = 'vivo';
  const L = novoLeilao({ id: pid, modo: 'compra', jogador: j.id, vendedor: j.clube, valor: p.valor, lider: meu, reserva: precoPedido(base, s, j),
    participantes: [{ ci: meu, humano: true, max: Math.min(s.caixa, orcamento(base, s).compras) }, ...rv], seed: `${s.seed}-${pid}${tarde ? '-t' : ''}` });
  Object.assign(L, { tarde, criado: s.rodada * 100 + (s.semanaBloco?.n || 0) });
  return (s.leilaoAtivo = L);
}
// o botão Leilão numa oferta recebida: quem ofereceu e até 3 interessados (teto de 190% do valor)
export function abrirLeilaoVenda(base, s, id) {
  const x = s.recebidas.find(y => y.id === id && y.tipo !== 'emprestimo');
  if (!x) return 'Proposta não existe mais.';
  if (x.contraFeita || x.leilao) return 'Essa negociação já teve contraproposta ou leilão.';
  if (x.humano) return 'Proposta de outro técnico não vai a leilão.';
  if (s.leilaoAtivo) return 'Já tem um leilão aberto.';
  const j = base.jog.get(x.jogador), meu = s.tecnico.clube, r = rng(`leilaoV${s.seed}-${x.id}`), teto = Math.max(x.valor, j.valor * 1000 * 1.9);
  const fol = ci => Math.min(teto, caixaDe(base, s, ci) * (base.clubes[ci].div === 'X' ? 3 : 0.6)) * (0.55 + r() * 0.45);
  const outros = shuffle(r, interessados(base, j, s).filter(ci => ci !== x.de && !ehHumano(s, ci) && !rivais(base, ci, meu) && base.elencos[ci].length < 38))
    .map(ci => ({ ci, max: r10(fol(ci)) })).filter(o => o.max >= minimo({ valor: x.valor })).slice(0, 3);
  x.leilao = 'vivo';
  s.leilaoAtivo = novoLeilao({ id, modo: 'venda', jogador: j.id, vendedor: meu, valor: x.valor, lider: x.de, participantes: [{ ci: x.de, max: r10(Math.max(x.valor, fol(x.de))) }, ...outros], seed: `${s.seed}-${id}` });
  return null;
}

// martelo batido: aplica o resultado. Compra: vencer deixa só a conversa de salário para a rodada seguinte;
// perder leva o jogador na hora para quem pagou mais. Venda: a oferta vira a do vencedor e você decide.
export function fecharLeilao(base, s) {
  const L = s.leilaoAtivo; if (!L?.fim) return null;
  delete s.leilaoAtivo;
  const j = base.jog.get(L.jogador), meu = s.tecnico.clube, rivaisNaSala = Object.keys(L.P).length - 1;
  if (L.modo === 'compra') {
    const p = s.propostas.find(x => x.id === L.id);
    if (p && p.leilao === 'vivo') p.leilao = true;
    if (!p || p.estado !== 'aguardando' || j.clube !== L.vendedor) return { modo: 'compra', erro: 'A proposta não existe mais.' };
    if (L.lider === meu) {
      Object.assign(p, { valor: L.valor, leilao: true, ...(L.valor >= L.reserva ? { clubeOk: true } : {}) });
      noticia(base, s, `Leilão por ${j.curto}: o ${nome(base, meu)} vence ${rivaisNaSala > 1 ? `${rivaisNaSala} concorrentes` : 'a concorrência'} com ${fmtLance(L.valor)}. Falta acertar o salário com ele.`, j.id);
      return { modo: 'compra', venceu: true, valor: L.valor };
    }
    Object.assign(p, { estado: 'perdida', motivo: `o ${nome(base, L.lider)} pagou mais no leilão (${fmtLance(L.valor)})`, leilao: true });
    transferir(base, s, j, L.lider, L.valor); s.historicoTransf[0].ia = true;
    noticia(base, s, `${L.valor >= 5e6 ? 'HERE WE GO! ' : ''}Leilão por ${j.curto}: o ${nome(base, L.lider)} cobre todo mundo e leva por ${fmtDinheiro(L.valor)}.`, j.id);
    return { modo: 'compra', venceu: false, ci: L.lider, valor: L.valor };
  }
  const x = s.recebidas.find(y => y.id === L.id);
  if (!x || j.clube !== meu) return { modo: 'venda', erro: 'A oferta não existe mais.' };
  const motivo = querIr(base, s, j, L.lider), r = rng(`${L.seed}-quer`);
  Object.assign(x, { id: `${x.id}-L`, de: L.lider, valor: L.valor, leilao: 'fim', rodada: s.rodada, quer: motivo && r() < 0.8 ? motivo : null });
  s.recebidas = s.recebidas.filter(y => y === x || y.jogador !== x.jogador);
  noticia(base, s, `Leilão por ${j.curto}: ${L.lances.length > 1 ? `o ${nome(base, L.lider)} vence com ${fmtLance(L.valor)}` : `ninguém cobriu o ${nome(base, L.lider)} (${fmtLance(L.valor)})`}. Responda no Mercado.`, j.id);
  return { modo: 'venda', id: x.id, ci: L.lider, valor: L.valor, quer: x.quer };
}
// leilão que ficou aberto (fechou o app no meio): a sala termina sem você e o resultado vale
export function encerrarPendente(base, s) {
  if (!s.leilaoAtivo) return null;
  if (!s.leilaoAtivo.fim) terminarSemHumanos(s.leilaoAtivo);
  return fecharLeilao(base, s);
}
