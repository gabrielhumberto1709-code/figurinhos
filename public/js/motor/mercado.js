// Mercado: preço pedido, resposta do clube, vontade do jogador, disputa com rivais e propostas recebidas.
// Proposta feita numa rodada é respondida na seguinte (dá tempo de rival entrar na briga).
import { rng, clamp, pickW, SETOR } from './util.js';
import { interessados, media } from './noticias.js';
import { janelaAberta, caixaInicial } from './mundo.js';

const NIVEL = { A: 0, B: 1, C: 2 };
const arred = v => Math.max(50000, Math.round(v / 10000) * 10000);
export const LIMITE_ELENCO = 40, MINIMO_ELENCO = 18;

// valor que o clube dono pede
export function precoPedido(base, s, j) {
  let v = j.valor * 1000 || 30000;
  const el = base.elencos[j.clube].slice().sort((a, b) => b.ovr - a.ovr), rank = el.indexOf(j);
  v *= rank < 11 ? 1.35 : rank < 18 ? 1.1 : 0.85;
  const anos = j.contrato - s.ano;
  v *= anos <= 0 ? 0.5 : anos === 1 ? 0.8 : 1;
  if (j.idade <= 21 && j.pot >= j.ovr + 8) v *= 1.4;
  if (media(s.est?.[j.id]) >= 7) v *= 1.2;
  if (rank < 3 && base.clubes[j.clube].div === base.clubes[s.tecnico.clube].div) v *= 1.3; // não vende craque pra rival direto
  return arred(v);
}

// quanto o jogador quer vir (0-100). Clube maior, divisão, chance de ser titular, idade e nome do técnico pesam.
export function vontade(base, s, j, destino) {
  const daqui = base.clubes[j.clube], dela = base.clubes[destino];
  let v = 50 + (base.forca(destino) - base.forca(j.clube)) * 3;
  const nd = NIVEL[dela.div] - NIVEL[daqui.div];
  v += nd > 0 ? -25 * nd : nd < 0 ? 15 * -nd : 0;
  const naPos = base.elencos[destino].filter(x => x.pos === j.pos && x.id !== j.id), acima = naPos.filter(x => x.ovr >= j.ovr).length;
  const peso = j.idade <= 23 ? 2 : 1;
  v += acima === 0 ? 15 * peso : acima >= 2 ? -20 * peso : 0;
  if (j.idade >= 31) v += 10;
  if (j.ovr >= 80 && base.forca(destino) < base.forca(j.clube)) v -= 20;
  if (destino === s.tecnico.clube) v += (s.tecnico.reputacao || 0) * 4;
  return clamp(Math.round(v), 0, 100);
}
export const pistaVontade = v => v >= 65 ? 'O empresário diz que ele adoraria jogar aqui.' : v >= 50 ? 'Ele topa ouvir a proposta.' : v >= 35 ? 'Ele não parece muito animado.' : 'Ele não quer saber de vir.';
function motivoRecusa(base, s, j) {
  const nd = NIVEL[base.clubes[s.tecnico.clube].div] - NIVEL[base.clubes[j.clube].div];
  if (nd > 0) return 'não quer cair de divisão';
  if (base.elencos[s.tecnico.clube].filter(x => x.pos === j.pos && x.ovr >= j.ovr).length >= 2) return 'acha que não seria titular';
  return 'prefere esperar um clube maior';
}

export const caixaDe = (base, s, ci) => ci === s.tecnico.clube ? s.caixa : caixaInicial(base, ci);

// o que impede o usuário de propor
export function bloqueioProposta(base, s, j, valor) {
  if (!janelaAberta(s.ano, s.rodada)) return 'A janela de transferências está fechada.';
  if (j.clube === s.tecnico.clube) return 'Ele já é seu.';
  if (s.propostas.some(p => p.jogador === j.id && ['aguardando', 'contraproposta'].includes(p.estado))) return 'Você já tem uma proposta por ele.';
  if (base.elencos[s.tecnico.clube].length >= LIMITE_ELENCO) return `Elenco cheio (${LIMITE_ELENCO}).`;
  if (!(valor > 0)) return 'Diga quanto quer oferecer.';
  if (valor > s.caixa) return 'Não tem dinheiro em caixa para isso.';
  return null;
}

export function fazerProposta(base, s, j, valor) {
  const erro = bloqueioProposta(base, s, j, valor);
  if (erro) return erro;
  s.propostas.unshift({ id: `${j.id}-${s.rodada}`, jogador: j.id, de: j.clube, valor: arred(valor), rodada: s.rodada, estado: 'aguardando' });
  return null;
}

export function aceitarContraproposta(s, id) {
  const p = s.propostas.find(x => x.id === id && x.estado === 'contraproposta');
  if (!p || p.contra > s.caixa) return 'Não tem dinheiro em caixa para isso.';
  p.valor = p.contra; p.estado = 'aguardando'; p.aceitouContra = true; p.rodada = s.rodada;
  return null;
}
export function desistir(s, id) { const p = s.propostas.find(x => x.id === id); if (p) p.estado = 'cancelada'; }

export function transferir(base, s, j, para, valor) {
  const de = j.clube;
  s.transf[j.id] = para;
  base.aplicarTransferencias(s.transf);
  if (para === s.tecnico.clube) s.caixa -= valor;
  if (de === s.tecnico.clube) s.caixa += valor;
  if (s.xi) s.xi = null; // escalação manual refeita com o elenco novo
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de, para, valor });
}

// vender: aceitar proposta recebida
export function aceitarRecebida(base, s, id) {
  const p = s.recebidas?.find(x => x.id === id); if (!p) return 'Proposta não existe mais.';
  const j = base.jog.get(p.jogador);
  if (!janelaAberta(s.ano, s.rodada)) return 'A janela fechou.';
  if (base.elencos[s.tecnico.clube].length <= MINIMO_ELENCO) return `Seu elenco não pode ficar com menos de ${MINIMO_ELENCO}.`;
  if (j.pos === 'GOL' && base.elencos[s.tecnico.clube].filter(x => x.pos === 'GOL').length <= 2) return 'Você ficaria com menos de dois goleiros.';
  transferir(base, s, j, p.de, p.valor);
  s.recebidas = s.recebidas.filter(x => x.jogador !== p.jogador);
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', div: base.clubes[p.de].div, texto: `Vendido: ${j.curto} acerta com o ${base.clubes[p.de].n} por ${fmt(p.valor)}.` });
  return null;
}
export function recusarRecebida(s, id) { s.recebidas = (s.recebidas || []).filter(x => x.id !== id); }

const fmt = v => v >= 1e6 ? `€ ${(v / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} mi` : `€ ${Math.round(v / 1000)} mil`;

// roda no fim de cada rodada: responde as propostas do usuário e gera propostas pelos jogadores dele
export function resolverMercado(base, s, rd) {
  s.propostas = s.propostas || []; s.recebidas = s.recebidas || []; s.historicoTransf = s.historicoTransf || []; s.transf = s.transf || {};
  const r = rng(`mercado${s.seed}-${rd}`), meu = s.tecnico.clube, N = [];
  const nome = ci => base.clubes[ci].n;
  const add = (texto, tipo = 'clube', div = base.clubes[meu].div) => N.push({ rodada: rd + 1, tipo, div, texto });

  for (const p of s.propostas.filter(x => x.estado === 'aguardando' && x.rodada <= rd)) {
    const j = base.jog.get(p.jogador);
    if (j.clube !== p.de) { p.estado = 'cancelada'; p.motivo = 'ele já trocou de clube'; continue; }
    const pedido = precoPedido(base, s, j);
    if (!p.aceitouContra && p.valor < pedido) {
      if (p.valor >= pedido * 0.85) { p.estado = 'contraproposta'; p.contra = pedido; add(`O ${nome(j.clube)} pede ${fmt(pedido)} por ${j.curto}.`); }
      else { p.estado = 'recusada'; p.motivo = 'o clube achou pouco'; add(`O ${nome(j.clube)} recusa a proposta por ${j.curto}.`); }
      continue;
    }
    // disputa: clubes que também fariam sentido podem entrar com proposta maior
    const rivais = interessados(base, j).filter(ci => ci !== meu && r() < 0.35).map(ci => ({ ci, valor: arred(Math.max(p.valor * (1.05 + r() * 0.15), pedido)) })).filter(x => caixaDe(base, s, x.ci) >= x.valor).slice(0, 2);
    for (const x of rivais) add(`O ${nome(x.ci)} entra na disputa por ${j.curto} com ${fmt(x.valor)}.`);
    const minha = vontade(base, s, j, meu) + (r() - 0.5) * 16;
    const melhorRival = rivais.map(x => ({ ...x, v: vontade(base, s, j, x.ci) + (x.valor - p.valor) / Math.max(p.valor, 1) * 20 + (r() - 0.5) * 16 })).sort((a, b) => b.v - a.v)[0];
    if (minha < 50) { p.estado = 'recusada'; p.motivo = `${j.curto} ${motivoRecusa(base, s, j)}`; add(`${j.curto} recusa: ${motivoRecusa(base, s, j)}.`); continue; }
    if (melhorRival && melhorRival.v > minha) {
      p.estado = 'perdida'; p.motivo = `ele escolheu o ${nome(melhorRival.ci)}`;
      s.transf[j.id] = melhorRival.ci; base.aplicarTransferencias(s.transf);
      add(`${j.curto} escolhe o ${nome(melhorRival.ci)} e vai jogar lá.`, 'rumor', base.clubes[melhorRival.ci].div);
      continue;
    }
    if (p.valor > s.caixa) { p.estado = 'recusada'; p.motivo = 'faltou dinheiro em caixa'; continue; }
    const de = j.clube;
    transferir(base, s, j, meu, p.valor);
    p.estado = 'concluida';
    add(`Reforço: ${j.curto} chega do ${nome(de)} por ${fmt(p.valor)}.`);
  }

  // propostas pelos seus jogadores (só com a janela aberta); vencem em 2 rodadas
  s.recebidas = s.recebidas.filter(x => x.rodada >= rd - 1);
  if (janelaAberta(s.ano, rd + 1)) {
    for (const j of base.elencos[meu]) {
      const e = s.est?.[j.id], emAlta = e && e[0] >= 3 && (media(e) >= 6.9 || e[1] >= e[0] * 0.4);
      if (!(emAlta || j.ovr >= 78) || s.recebidas.some(x => x.jogador === j.id) || r() > 0.12) continue;
      const opcoes = interessados(base, j); if (!opcoes.length) continue;
      const de = pickW(r, opcoes, ci => base.clubes[ci].fan);
      const valor = arred(precoPedido(base, s, j) * (0.8 + r() * 0.3));
      if (caixaDe(base, s, de) < valor) continue;
      s.recebidas.push({ id: `${j.id}-${de}-${rd}`, jogador: j.id, de, valor, rodada: rd });
      add(`O ${nome(de)} oferece ${fmt(valor)} por ${j.curto}. Responda no Mercado.`);
    }
  }
  s.noticias = [...N, ...s.noticias].slice(0, 220);
}
