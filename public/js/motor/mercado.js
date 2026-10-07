// Mercado: preço, salário e contrato, vontade do jogador, disputa com rivais, livres, pré-contratos,
// listas de venda e empréstimo, olheiros, favoritos e negócios entre os clubes da IA.
// Extras: troca (jogador como parte do pagamento), acordo com a janela fechada, opção de compra no empréstimo,
// chamar emprestado de volta, rescisão, trava de 14 jogos pra quem chegou, 3 recusas fecham a conversa,
// contraproposta e leilão nas ofertas recebidas, gigantes europeus e árabes.
// Proposta feita numa rodada é respondida na seguinte (dá tempo de rival entrar na briga).
import { rivais } from './rivais.js';
import { premiado } from './gala.js';
import { faseDe } from './forma.js';
import { rng, clamp, pickW, shuffle, SETOR, nivelDiv, estrelas, continenteDe } from './util.js';
import { interessados, media } from './noticias.js';
import { janelaAberta, caixaInicial, aplicarSave } from './mundo.js';
import { orcamento, lancar, garantirFinancas, salarioDia, salarioBase, diasRestantes } from './financas.js';

const arred = v => Math.max(50000, Math.round(v / 10000) * 10000);
const arredSal = v => Math.max(10, Math.round(v / 10) * 10);
export const LIMITE_ELENCO = 40, MINIMO_ELENCO = 18, ABRE_PRE = 19, MAX_PRE = 5, TRAVA = 14;
const ehLivre = (base, ci) => base.clubes[ci].div === 'L';
const BR = ['A', 'B', 'C'];
const fmt = v => v >= 1e6 ? `€ ${(v / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} mi` : `€ ${Math.round(v / 1000)} mil`;

// campos do mercado no save (saves antigos ganham os que faltam)
export function garantirMercado(s) {
  for (const [k, v] of Object.entries({ propostas: [], recebidas: [], historicoTransf: [], transf: {}, contratos: {}, salarios: {}, favoritos: [], preContratos: [], emprestimos: {}, relatorios: {}, observar: [], chegou: {}, recusas: {}, acordos: [] })) s[k] ||= v;
  s.listas ||= { venda: [], emprestimo: [] };
  s.olheiro ||= { regiao: 'BR', setor: '', jovens: true };
  return s;
}

// quem chegou há menos de 14 jogos não pode ser negociado; 3 recusas seguidas fecham a conversa por 2 rodadas
const agora = s => s.ano * 40 + s.rodada;
const marcarChegada = (s, id) => { (s.chegou ||= {})[id] = agora(s); };
export const travado = (s, id) => { const c = s.chegou?.[id]; return c == null ? 0 : Math.max(0, TRAVA - (agora(s) - c)); };
export const conversaFechada = (s, id) => { const x = s.recusas?.[id]; return x?.ano === s.ano && x.ate > s.rodada ? x.ate - s.rodada : 0; };
const emAcordo = (s, id) => s.acordos?.some(a => a.jogador === id || a.troca === id);

// ---------- situação do jogador ----------
// listas dos clubes da IA: quem sobra no elenco vai à venda, garoto sem espaço em clube grande vai para empréstimo
export function listasIA(base, s) {
  const k = `${s.seed}-${s.ano}-${base._versao}`;
  if (base._listas?.k === k) return base._listas;
  const venda = new Set(), emprestimo = new Set(), meu = s.tecnico.clube;
  base.clubes.forEach((c, ci) => {
    if (ci === meu || c.div === 'L') return;
    const grande = c.div === 'A' || (c.div === 'X' && c.tier >= 3);
    const f = base.forca(ci);
    base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).forEach((j, rank) => {
      const r = rng(`lista${s.seed}-${s.ano}-${j.id}`)();
      if (s.emprestimos[j.id]) return;
      if (((rank >= 18 && j.idade >= 23) || (rank >= 12 && j.idade >= 33)) && j.ovr <= f - 2 && r < 0.55) venda.add(j.id);
      else if (grande && j.idade <= 22 && rank >= 14 && j.ovr <= f - 3 && r < 0.6) emprestimo.add(j.id);
    });
  });
  return (base._listas = { k, venda, emprestimo });
}
export const contratoNoFim = (s, j) => j.contrato <= s.ano;
export const preContratoDe = (s, id) => s.preContratos.find(p => p.jogador === id);
export function situacao(base, s, j) {
  const L = listasIA(base, s), meu = j.clube === s.tecnico.clube, t = [];
  if (ehLivre(base, j.clube)) return ['livre'];
  if (s.emprestimos[j.id]) t.push('emprestado');
  if (meu ? s.listas.venda.includes(j.id) : L.venda.has(j.id)) t.push('venda');
  if (meu ? s.listas.emprestimo.includes(j.id) : L.emprestimo.has(j.id)) t.push('emprestimo');
  if (contratoNoFim(s, j)) t.push('fim');
  if (preContratoDe(s, j.id)) t.push('pre');
  return t;
}

// ---------- preço e salário ----------
export function precoPedido(base, s, j) {
  if (ehLivre(base, j.clube)) return 0;
  let v = j.valor * 1000 || 30000;
  const el = base.elencos[j.clube].slice().sort((a, b) => b.ovr - a.ovr), rank = el.indexOf(j);
  v *= rank < 11 ? 1.35 : rank < 18 ? 1.1 : 0.85;
  const anos = j.contrato - s.ano;
  v *= anos <= 0 ? 0.5 : anos === 1 ? 0.8 : 1;
  if (j.idade <= 21 && j.pot >= j.ovr + 8) v *= 1.4;
  if (media(s.est?.[j.id]) >= 7) v *= 1.2;
  if (premiado(s, j.id)) v *= 1.15;                                     // premiado na última gala
  v *= 1 + faseDe(s, j.id).d * 0.05;                                   // fase excelente encarece 15%, péssima barateia
  if (base.clubes[j.clube].div === 'X') v *= 1.15;                      // clube de fora não vende barato
  if (rank < 3 && base.clubes[j.clube].div === base.clubes[s.tecnico.clube].div) v *= 1.3; // não vende craque pra rival direto
  if (listasIA(base, s).venda.has(j.id)) v *= 0.7;                       // está à venda: o clube quer se livrar
  if (rivais(base, j.clube, s.tecnico.clube)) v *= 1.6;                  // vender pro rival só se for muito bom
  return arred(v);
}

// quanto o jogador quer vir (0-100). Clube maior, divisão, chance de ser titular, idade e nome do técnico pesam.
export function vontade(base, s, j, destino) {
  const daqui = base.clubes[j.clube], dela = base.clubes[destino], livre = daqui.div === 'L';
  let v = livre ? 62 + (base.forca(destino) - j.ovr) * 2 : 50 + (base.forca(destino) - base.forca(j.clube)) * 3;
  if (!livre) { const nd = nivelDiv(dela) - nivelDiv(daqui); v += nd > 0 ? -25 * nd : nd < 0 ? 15 * -nd : 0; }
  if (daqui.div === 'X' && dela.div !== 'X') v += j.nat === 'BRA' ? 10 : -10; // brasileiro lá fora gosta de voltar
  const naPos = base.elencos[destino].filter(x => x.pos === j.pos && x.id !== j.id), acima = naPos.filter(x => x.ovr >= j.ovr).length;
  const peso = j.idade <= 23 ? 2 : 1;
  v += acima === 0 ? 15 * peso : acima >= 2 ? -20 * peso : 0;
  if (j.idade >= 31) v += 10;
  if (j.ovr >= 80 && base.forca(destino) < base.forca(j.clube)) v -= 20;
  if (destino === s.tecnico.clube) v += (s.tecnico.reputacao || 0) * 4 - (mauPagador(s) ? 12 : 0);
  if (rivais(base, j.clube, destino)) v -= 35; // trocar pelo rival queima o jogador com a torcida
  return clamp(Math.round(v), 0, 100);
}
export const pistaVontade = v => v >= 65 ? 'O empresário diz que ele adoraria jogar aqui.' : v >= 50 ? 'Ele topa ouvir a proposta.' : v >= 35 ? 'Ele não parece muito animado.' : 'Ele não quer saber de vir.';
function motivoRecusa(base, s, j) {
  if (rivais(base, j.clube, s.tecnico.clube)) return 'não quer jogar no rival';
  if (mauPagador(s)) return 'tem medo de não receber em dia';
  if (nivelDiv(base.clubes[s.tecnico.clube]) > nivelDiv(base.clubes[j.clube]) && !ehLivre(base, j.clube)) return 'não quer cair de divisão';
  if (base.elencos[s.tecnico.clube].filter(x => x.pos === j.pos && x.ovr >= j.ovr).length >= 2) return 'acha que não seria titular';
  return 'prefere esperar um clube maior';
}

// salário por dia que ele pede: o que ganha hoje ou o valor de mercado no destino, mais um tanto se não estiver animado.
// Veterano quer contrato longo; cada ano a menos que três encarece.
export function salarioPedido(base, s, j, anos = 3, destino = s.tecnico.clube) {
  const atual = ehLivre(base, j.clube) ? 0 : salarioDia(base, s, j);
  const v = vontade(base, s, j, destino);
  let pede = Math.max(atual, salarioBase(base.clubes[destino].div, j.valor)) * (1.1 + clamp((60 - v) / 100, -0.1, 0.6));
  if (j.idade >= 30) pede *= 1 + 0.06 * Math.max(0, 3 - anos);
  if (ehLivre(base, j.clube)) pede *= 0.9;
  return arredSal(pede);
}
// quanto de salário novo cabe (se ele já é seu, o salário atual sai da conta)
export function folgaPara(base, s, j) { return orcamento(base, s).folga + (j.clube === s.tecnico.clube ? salarioDia(base, s, j) : 0); }

export const caixaDe = (base, s, ci) => ci === s.tecnico.clube ? s.caixa : caixaInicial(base, ci);

// ---------- propostas do usuário ----------
// tipos: compra (paga ao clube), livre (sem clube), pre (contrato no fim; chega na próxima temporada), emprestimo (até o fim da temporada)
export function tiposPossiveis(base, s, j) {
  if (ehLivre(base, j.clube)) return ['livre'];
  const t = [];
  if (!s.emprestimos[j.id]) t.push('compra');
  if (contratoNoFim(s, j) && s.rodada >= ABRE_PRE && !preContratoDe(s, j.id)) t.push('pre');
  if (listasIA(base, s).emprestimo.has(j.id)) t.push('emprestimo');
  return t;
}

export function bloqueioProposta(base, s, j, o) {
  const meu = s.tecnico.clube, janela = janelaAberta(s.ano, s.rodada);
  if (j.clube === meu) return 'Ele já é seu.';
  if (s.propostas.some(p => p.jogador === j.id && ['aguardando', 'contraproposta'].includes(p.estado))) return 'Você já tem uma proposta por ele.';
  if (emAcordo(s, j.id)) return 'Já existe um acordo por ele.';
  const fx = conversaFechada(s, j.id);
  if (fx) return `O ${base.clubes[j.clube].n} fechou as conversas depois de 3 recusas. Tente de novo em ${fx} rodada${fx > 1 ? 's' : ''}.`;
  const pre = preContratoDe(s, j.id);
  if (pre) return `Já assinou pré-contrato com o ${base.clubes[pre.para].n}.`;
  if (s.emprestimos[j.id] && o.tipo !== 'pre') return 'Está emprestado até o fim da temporada.';
  if (!tiposPossiveis(base, s, j).includes(o.tipo)) return o.tipo === 'pre' ? `Pré-contrato só com contrato no fim, a partir da ${ABRE_PRE + 1}ª rodada.` : o.tipo === 'emprestimo' ? 'O clube não quer emprestar.' : 'Esse tipo de proposta não vale para ele.';
  if (o.tipo === 'emprestimo' && !janela) return 'A janela de transferências está fechada.'; // compra com a janela fechada vira acordo
  const t = o.troca && base.jog.get(o.troca);
  if (o.troca) {
    if (o.tipo !== 'compra') return 'Troca só em proposta de compra.';
    if (!t || t.clube !== meu) return 'O jogador da troca precisa ser do seu elenco.';
    if (s.emprestimos[t.id] || preContratoDe(s, t.id) || emAcordo(s, t.id)) return `${t.curto} não pode entrar na troca.`;
    if (travado(s, t.id)) return `${t.curto} chegou há pouco e ainda não pode ser negociado.`;
  }
  if (o.tipo === 'pre' && s.preContratos.filter(p => p.para === meu).length >= MAX_PRE) return `Limite de ${MAX_PRE} pré-contratos por temporada.`;
  if (o.tipo !== 'pre' && base.elencos[meu].length >= LIMITE_ELENCO) return `Elenco cheio (${LIMITE_ELENCO}).`;
  if (o.tipo === 'compra') {
    if (!(o.valor > 0) && !t) return 'Diga quanto quer oferecer.';
    if (o.valor > s.caixa) return 'Não tem dinheiro em caixa para isso.';
    const orc = orcamento(base, s);
    if (o.valor > orc.compras) return `Passa do orçamento de compras (${fmt(orc.compras)}). Ajuste a divisão salários x compras em Finanças ou venda alguém.`;
  }
  if (!(o.salario > 0)) return 'Diga o salário por dia.';
  if (!(o.anos >= 1 && o.anos <= 5)) return 'Contrato de 1 a 5 anos.';
  if (o.tipo !== 'pre') { const folga = folgaPara(base, s, j) + (t ? salarioDia(base, s, t) : 0); if (o.salario > folga) return `O salário passa da folga da folha (€ ${folga.toLocaleString('pt-BR')}/dia). Abra espaço em Finanças ou venda alguém.`; }
  return null;
}

export function fazerProposta(base, s, j, o) {
  const oferta = { tipo: o.tipo || 'compra', valor: o.tipo === 'compra' && o.valor > 0 ? arred(o.valor) : 0, salario: arredSal(o.salario), anos: o.tipo === 'emprestimo' ? 1 : Math.round(o.anos || 3), troca: o.tipo === 'compra' && +o.troca || 0 };
  const erro = bloqueioProposta(base, s, j, oferta);
  if (erro) return erro;
  s.propostas.unshift({ id: `${j.id}-${s.rodada}`, jogador: j.id, de: j.clube, ...oferta, rodada: s.rodada, estado: 'aguardando', pedido: precoPedido(base, s, j) });
  return null;
}

// contraproposta: o clube pediu mais dinheiro e/ou o jogador pediu mais salário
export function aceitarContraproposta(base, s, id) {
  const p = s.propostas.find(x => x.id === id && x.estado === 'contraproposta'); if (!p) return 'Proposta não existe mais.';
  const valor = p.contra ?? p.valor, salario = p.contraSal ?? p.salario;
  if (valor > s.caixa) return 'Não tem dinheiro em caixa para isso.';
  if (p.tipo !== 'pre' && salario > folgaPara(base, s, base.jog.get(p.jogador))) return 'O salário pedido não cabe na folha. Abra espaço em Finanças.';
  if (p.contra != null) p.clubeOk = true;
  if (p.contraSal != null) p.salOk = true;
  Object.assign(p, { valor, salario, estado: 'aguardando', rodada: s.rodada, contra: null, contraSal: null });
  return null;
}
// quanto o outro clube aceita pagar (em abatimento) pelo jogador que você coloca na troca
export function valorNaTroca(base, s, t, ci) {
  return arred(t.valor * 1000 * (t.ovr >= base.forca(ci) - 5 ? 0.9 : 0.5) * (t.idade >= 31 ? 0.7 : 1));
}
export const opcaoCompra = (base, s, j) => arred(precoPedido(base, s, j) * 1.2);
export function desistir(s, id) { const p = s.propostas.find(x => x.id === id); if (p) p.estado = 'cancelada'; }

// ---------- movimentos ----------
const tirarDasListas = (s, id) => { s.listas.venda = s.listas.venda.filter(x => x !== id); s.listas.emprestimo = s.listas.emprestimo.filter(x => x !== id); };
export function transferir(base, s, j, para, valor, { salario, anos } = {}) {
  const de = j.clube, meu = s.tecnico.clube;
  s.transf[j.id] = para; marcarChegada(s, j.id);
  if (para === meu) { if (salario) s.salarios[j.id] = salario; s.contratos[j.id] = s.ano + (anos || 3); }
  else { delete s.salarios[j.id]; s.contratos[j.id] = s.ano + (anos || 3); }
  tirarDasListas(s, j.id);
  aplicarSave(base, s);
  garantirFinancas(base, s);
  if (para === meu && valor) { lancar(s, 'compra', `Compra de ${j.curto} (${base.clubes[de].n})`, -valor); s.fin.temporada.compras += valor; }
  if (de === meu && valor) { lancar(s, 'venda', `Venda de ${j.curto} (${base.clubes[para].n})`, valor); s.fin.temporada.vendas += valor; }
  if (s.xi && (para === meu || de === meu)) s.xi = null; // escalação manual refeita com o elenco novo
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de, para, valor, tipo: ehLivre(base, de) ? 'livre' : 'compra' });
}
// empréstimo até o fim da temporada; o salário continua o mesmo e quem está com ele paga
export function emprestar(base, s, j, para) {
  const de = j.clube, meu = s.tecnico.clube;
  if (para === meu) s.salarios[j.id] = salarioDia(base, s, j);
  s.emprestimos[j.id] = { de, para, ate: s.ano };
  s.transf[j.id] = para; marcarChegada(s, j.id);
  tirarDasListas(s, j.id);
  aplicarSave(base, s);
  if (s.xi) s.xi = null;
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de, para, valor: 0, tipo: 'emprestimo' });
}

// ---------- vender e listar ----------
export function podeSair(base, s, j) {
  if (!janelaAberta(s.ano, s.rodada)) return 'A janela fechou.';
  const tr = travado(s, j.id);
  if (tr) return `${j.curto} chegou há pouco: só pode sair daqui a ${tr} jogo${tr > 1 ? 's' : ''}.`;
  return elencoAguenta(base, s, j);
}
function elencoAguenta(base, s, j) {
  const meu = s.tecnico.clube;
  if (base.elencos[meu].length <= MINIMO_ELENCO) return `Seu elenco não pode ficar com menos de ${MINIMO_ELENCO}.`;
  if (j.pos === 'GOL' && base.elencos[meu].filter(x => x.pos === 'GOL').length <= 2) return 'Você ficaria com menos de dois goleiros.';
  return null;
}
export function aceitarRecebida(base, s, id) {
  const p = s.recebidas.find(x => x.id === id); if (!p) return 'Proposta não existe mais.';
  const j = base.jog.get(p.jogador), erro = podeSair(base, s, j);
  if (erro) return erro;
  if (p.tipo === 'emprestimo') emprestar(base, s, j, p.de);
  else transferir(base, s, j, p.de, p.valor, { anos: 3 });
  s.recebidas = s.recebidas.filter(x => x.jogador !== p.jogador);
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, div: base.clubes[s.tecnico.clube].div, texto: p.tipo === 'emprestimo' ? `Emprestado: ${j.curto} vai jogar no ${base.clubes[p.de].n} até o fim da temporada.` : `Vendido: ${j.curto} acerta com o ${base.clubes[p.de].n} por ${fmt(p.valor)}.` });
  return null;
}
export function recusarRecebida(base, s, id) {
  const p = s.recebidas.find(x => x.id === id); if (!p) return null;
  s.recebidas = s.recebidas.filter(x => x.id !== id);
  return p.quer ? barrarSaida(base, s, p) : null;
}
// ele queria ir e o clube segurou: fica chateado, pode pedir pra sair e não quer renovar por um tempo
function barrarSaida(base, s, p) {
  const j = base.jog.get(p.jogador); if (!j) return null;
  s.mor[j.id] = Math.max(0, (s.mor[j.id] ?? 62) - (faseDe(s, j.id).d > 0 ? 15 : 10));
  (s.querSair ||= {})[j.id] = { de: p.de, rodada: s.rodada, motivo: p.quer };
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', imprensa: true, jogador: j.id, div: base.clubes[s.tecnico.clube].div, texto: `${j.curto} fica chateado por não ser liberado para o ${base.clubes[p.de].n}.` });
  return `${j.curto} queria ir e ficou chateado (moral em baixa).`;
}
// a proposta é de um clube maior? (divisão acima, copa continental que o seu não joga, ou bem mais forte)
const naContinental = (s, ci) => ['LIB', 'SUL'].some(k => s.cont?.[k]?.grupos.some(g => g.includes(ci)));
export function querIr(base, s, j, de) {
  const meu = s.tecnico.clube, a = base.clubes[de], b = base.clubes[meu];
  if (nivelDiv(a) < nivelDiv(b)) return a.div === 'X' ? 'sonha em jogar fora do país' : `é a chance de jogar a Série ${a.div}`;
  if (naContinental(s, de) && !naContinental(s, meu)) return `quer disputar a ${s.cont.LIB.grupos.some(g => g.includes(de)) ? 'Libertadores' : 'Sul-Americana'}`;
  if (base.forca(de) >= base.forca(meu) + 5) return 'quer jogar num clube maior';
  return null;
}

// contraproposta numa oferta recebida (uma por oferta) e leilão (até 3 clubes cobrem, teto de 190% do valor)
const recebida = (s, id) => s.recebidas.find(x => x.id === id && x.tipo !== 'emprestimo');
export function pedirMais(base, s, id, fator) {
  const x = recebida(s, id); if (!x) return 'Proposta não existe mais.';
  if (x.contraFeita || x.leilao) return 'Essa negociação já teve contraproposta ou leilão.';
  Object.assign(x, { pedido: arred(x.valor * clamp(+fator || 1.15, 1.05, 2)), contraFeita: true, rodada: s.rodada });
  return null;
}
export function abrirLeilao(base, s, id) {
  const x = recebida(s, id); if (!x) return 'Proposta não existe mais.';
  if (x.contraFeita || x.leilao) return 'Essa negociação já teve contraproposta ou leilão.';
  Object.assign(x, { leilao: 'aberto', rodada: s.rodada });
  return null;
}

// empréstimo com opção de compra; chamar de volta quem você emprestou; rescindir pagando metade do que falta do contrato
export function exercerOpcao(base, s, id) {
  const j = base.jog.get(+id), e = s.emprestimos[+id], meu = s.tecnico.clube;
  if (!j || !e || e.para !== meu || !e.opcao) return 'Não há opção de compra para ele.';
  if (e.opcao > s.caixa) return 'Não tem dinheiro em caixa para isso.';
  delete s.emprestimos[j.id];
  s.contratos[j.id] = s.ano + 3;
  lancar(s, 'compra', `Opção de compra: ${j.curto} (${base.clubes[e.de].n})`, -e.opcao); s.fin.temporada.compras += e.opcao;
  aplicarSave(base, s);
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de: e.de, para: meu, valor: e.opcao, tipo: 'compra' });
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, jogador: j.id, div: base.clubes[meu].div, texto: `Opção exercida: ${j.curto} fica em definitivo no ${base.clubes[meu].n} por ${fmt(e.opcao)}.` });
  return null;
}
export const reembolso = j => arred(j.valor * 1000 * 0.1);
export function chamarDeVolta(base, s, id) {
  const j = base.jog.get(+id), e = s.emprestimos[+id], meu = s.tecnico.clube;
  if (!j || !e || e.de !== meu) return 'Ele não está emprestado por você.';
  if (!janelaAberta(s.ano, s.rodada)) return 'Só dá para chamar de volta com a janela aberta.';
  if (base.elencos[meu].length >= LIMITE_ELENCO) return `Elenco cheio (${LIMITE_ELENCO}).`;
  const v = reembolso(j); if (v > s.caixa) return 'Não tem dinheiro em caixa para o reembolso.';
  delete s.emprestimos[j.id];
  if (j.clubeOrig === meu) delete s.transf[j.id]; else s.transf[j.id] = meu;
  lancar(s, 'reembolso', `Reembolso ao ${base.clubes[e.para].n} pela volta de ${j.curto}`, -v);
  aplicarSave(base, s); if (s.xi) s.xi = null;
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de: e.para, para: meu, valor: v, tipo: 'volta' });
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, jogador: j.id, div: base.clubes[meu].div, texto: `${j.curto} volta antes do fim do empréstimo ao ${base.clubes[e.para].n}. O clube paga ${fmt(v)} de reembolso.` });
  return null;
}
export const multaRescisao = (base, s, j) => Math.round(salarioDia(base, s, j) * (diasRestantes(s) + 365 * Math.max(0, j.contrato - s.ano)) * 0.5 / 1000) * 1000;
export function rescindir(base, s, id) {
  const j = base.jog.get(+id), meu = s.tecnico.clube;
  if (!j || j.clube !== meu) return 'Só dá para rescindir com jogador seu.';
  if (s.emprestimos[j.id]) return 'Ele está emprestado ao seu clube.';
  const e = elencoAguenta(base, s, j); if (e) return e;
  const v = multaRescisao(base, s, j); if (v > s.caixa) return `A multa (${fmt(v)}) passa do que tem em caixa.`;
  lancar(s, 'rescisao', `Rescisão de ${j.curto}`, -v);
  liberar(base, s, j, v);
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, jogador: j.id, div: base.clubes[meu].div, texto: `Rescisão: ${j.curto} deixa o ${base.clubes[meu].n}. A multa custou ${fmt(v)}.` });
  return null;
}

// jogador do seu clube vira livre (rescisão paga ou ganha na Justiça)
export function liberar(base, s, j, valor = 0) {
  const meu = s.tecnico.clube, livres = base.clubes.findIndex(c => c.div === 'L');
  s.transf[j.id] = livres; delete s.salarios[j.id]; delete s.contratos[j.id]; tirarDasListas(s, j.id);
  s.recebidas = s.recebidas.filter(x => x.jogador !== j.id); delete s.querSair?.[j.id];
  aplicarSave(base, s); if (s.xi) s.xi = null;
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de: meu, para: livres, valor, tipo: 'rescisao' });
}
export const mauPagador = s => s.fin?.mauPagador != null && s.ano - s.fin.mauPagador <= 1;

// acordos fechados com a janela fechada: o jogador (e quem foi na troca) se muda quando ela abre
export function cumprirAcordos(base, s, add) {
  const meu = s.tecnico.clube;
  for (const a of (s.acordos || []).splice(0)) {
    const j = base.jog.get(a.jogador), t = a.troca && base.jog.get(a.troca);
    if (!j || j.clube !== a.de || (t && t.clube !== meu)) { add(`O acordo por ${j?.curto || 'um reforço'} caiu: a situação mudou antes de a janela abrir.`); continue; }
    if (t) { transferir(base, s, t, a.de, 0); s.historicoTransf[0].tipo = 'troca'; }
    transferir(base, s, j, meu, a.valor, { salario: a.salario, anos: a.anos });
    add(`Chegou: ${j.curto}, acertado com o ${base.clubes[a.de].n} com a janela fechada.`);
  }
}

export function alternarLista(base, s, lista, id) {
  const j = base.jog.get(id);
  if (!j || j.clube !== s.tecnico.clube) return 'Só dá para listar jogador seu.';
  if (s.emprestimos[id]) return 'Ele está emprestado ao seu clube.';
  const tr = travado(s, id);
  if (tr && !s.listas[lista].includes(id)) return `${j.curto} chegou há pouco: só pode ser listado daqui a ${tr} jogo${tr > 1 ? 's' : ''}.`;
  const l = s.listas[lista], i = l.indexOf(id);
  if (i >= 0) { l.splice(i, 1); return null; }
  s.listas[lista === 'venda' ? 'emprestimo' : 'venda'] = s.listas[lista === 'venda' ? 'emprestimo' : 'venda'].filter(x => x !== id);
  l.push(id);
  return null;
}
export function alternarFavorito(s, id) { const i = s.favoritos.indexOf(id); if (i >= 0) s.favoritos.splice(i, 1); else s.favoritos.unshift(id); }

// ---------- renovação ----------
// quer ficar? Moral, espaço no time e idade pesam. Resposta na hora: aceita ou diz quanto quer.
export function renovacaoPossivel(s, j) { return j.contrato <= s.ano + 1 && !preContratoDe(s, j.id) && !s.emprestimos[j.id]; }
export function pedidoRenovacao(base, s, j, anos = 3) {
  const el = base.elencos[s.tecnico.clube].slice().sort((a, b) => b.ovr - a.ovr), rank = el.indexOf(j);
  const ficar = clamp(55 + ((s.mor?.[j.id] ?? 62) - 62) + (rank < 11 ? 10 : rank >= 18 ? -10 : 0) + (j.idade >= 31 ? 10 : 0) - (s.querSair?.[j.id] ? 30 : 0), 0, 100);
  let pede = Math.max(salarioDia(base, s, j), salarioBase(base.clubes[j.clube].div, j.valor)) * (1.05 + clamp((60 - ficar) / 100, -0.1, 0.5));
  if (j.idade >= 30) pede *= 1 + 0.06 * Math.max(0, 3 - anos);
  return { ficar, pede: arredSal(pede) };
}
export function renovar(base, s, j, salario, anos) {
  if (j.clube !== s.tecnico.clube || !renovacaoPossivel(s, j)) return { ok: false, txt: 'Não dá para renovar com ele agora.' };
  if (!(anos >= 1 && anos <= 5)) return { ok: false, txt: 'Contrato de 1 a 5 anos.' };
  const { ficar, pede } = pedidoRenovacao(base, s, j, anos);
  if (ficar < 30) return { ok: false, txt: `${j.curto} não quer renovar. Está insatisfeito no clube.` };
  if (salario - salarioDia(base, s, j) > orcamento(base, s).folga) return { ok: false, txt: 'O aumento não cabe na folga da folha. Abra espaço em Finanças.' };
  if (salario < pede) return { ok: false, pede, txt: `${j.curto} pede € ${pede.toLocaleString('pt-BR')}/dia por ${anos} ${anos > 1 ? 'anos' : 'ano'}.` };
  s.salarios[j.id] = arredSal(salario); s.contratos[j.id] = s.ano + anos; j.contrato = s.ano + anos;
  return { ok: true, txt: `Renovado: ${j.curto} assinou até ${s.ano + anos}.` };
}

// ---------- olheiro ----------
export const REGIOES = { BR: 'Brasil', AMS: 'América do Sul', EUR: 'Europa', OUT: 'Resto do mundo' };
export function regiaoDe(base, j) {
  const c = base.clubes[j.clube];
  if (c.div !== 'X') return 'BR';
  const k = continenteDe(c.nat);
  return k === 'AMS' || k === 'EUR' ? k : 'OUT';
}
export function observar(s, id) {
  if (s.relatorios[id]?.exato || s.observar.includes(id)) return 'Ele já está na lista do olheiro.';
  if (s.observar.length >= 5) return 'O olheiro já tem 5 jogadores para ver nesta rodada.';
  s.observar.push(id); return null;
}
function trabalhoDoOlheiro(base, s, rd, r) {
  for (const id of s.observar) { const j = base.jog.get(id); if (j) s.relatorios[id] = { e: estrelas(j.pot), rd: rd + 1, exato: true }; }
  s.observar = [];
  const o = s.olheiro, meu = s.tecnico.clube;
  const pool = [...base.jog.values()].filter(j => j.clube !== meu && !s.relatorios[j.id] && regiaoDe(base, j) === o.regiao && (!o.setor || SETOR[j.pos] === o.setor) && (!o.jovens || j.idade <= 21));
  const achados = pool.map(j => [j, j.pot + r() * 8]).sort((a, b) => b[1] - a[1]).slice(0, 2);
  for (const [j] of achados) { const e = estrelas(j.pot), erro = r() < 0.25 ? (r() < 0.5 ? -1 : 1) : 0; s.relatorios[j.id] = { e: clamp(e + erro, 1, 5), rd: rd + 1, novo: true }; }
}

// ---------- IA ----------
const GIGANTE = c => c.div === 'X' && ((c.tier >= 5 && c.fan >= 9) || (c.liga === 'Saudi Pro League' && c.fan >= 6));
const POS_CHAVE = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'CA'];
function vendedorAguenta(base, s, j) {
  if (ehLivre(base, j.clube)) return true;
  const el = base.elencos[j.clube];
  return j.clube !== s.tecnico.clube && el.length > 19 && !(j.pos === 'GOL' && el.filter(x => x.pos === 'GOL').length <= 2) && !travado(s, j.id) && !emAcordo(s, j.id);
}
// clubes da IA também compram: reforçam a posição mais fraca e o exterior leva destaques
function negociosIA(base, s, rd, r, add) {
  const meu = s.tecnico.clube, nome = ci => base.clubes[ci].n, mover = (j, para, valor) => {
    const de = j.clube;
    s.transf[j.id] = para; s.contratos[j.id] = s.ano + 2 + Math.floor(r() * 3); marcarChegada(s, j.id);
    aplicarSave(base, s);
    s.historicoTransf.unshift({ rodada: rd, jogador: j.id, nome: j.curto, de, para, valor, tipo: ehLivre(base, de) ? 'livre' : 'compra', ia: true });
    return de;
  };
  for (const ci of base.clubes.map((c, i) => i).filter(i => BR.includes(base.clubes[i].div) && i !== meu)) {
    if (r() > 0.09 || base.elencos[ci].length >= 38) continue;
    const el = base.elencos[ci], f = base.forca(ci), melhorNa = p => el.filter(x => x.pos === p).reduce((m, x) => Math.max(m, x.ovr), 0);
    const pos = POS_CHAVE.slice().sort((a, b) => melhorNa(a) - melhorNa(b))[0], min = melhorNa(pos) + 2, caixa = caixaInicial(base, ci) * 0.5;
    const cands = [...base.jog.values()].filter(j => j.pos === pos && j.clube !== ci && j.ovr >= min && j.ovr <= f + 5 && !s.emprestimos[j.id] && !preContratoDe(s, j.id)
      && vendedorAguenta(base, s, j) && precoPedido(base, s, j) <= caixa && vontade(base, s, j, ci) >= 50 && (!rivais(base, j.clube, ci) || r() < 0.03));
    if (!cands.length) continue;
    const j = pickW(r, cands, x => x.ovr - min + 1), valor = precoPedido(base, s, j), de = mover(j, ci, valor);
    add(ehLivre(base, de) ? `Mercado: ${nome(ci)} contrata ${j.curto}, que estava sem clube.` : `${valor >= 5e6 ? 'HERE WE GO! ' : 'Mercado: '}${j.curto} deixa o ${nome(de)} e acerta com o ${nome(ci)} por ${fmt(valor)}.`, 'mercado', base.clubes[ci].div, { jogador: j.id });
  }
  // quem está em fase boa num clube menor é disputado pelos maiores
  let quentes = 0;
  for (const j of shuffle(r, [...base.jog.values()].filter(j => BR.includes(base.clubes[j.clube].div) && j.clube !== meu && faseDe(s, j.id).d > 0 && vendedorAguenta(base, s, j) && !preContratoDe(s, j.id) && !s.emprestimos[j.id]))) {
    if (quentes >= 2) break;
    if (r() > (faseDe(s, j.id).k === 'excelente' ? 0.12 : 0.05)) continue;
    const ops = interessados(base, j).filter(ci => ci !== meu && base.elencos[ci].length < 38 && vontade(base, s, j, ci) >= 45);
    if (!ops.length) continue;
    const para = pickW(r, ops, ci => base.clubes[ci].fan), valor = arred(precoPedido(base, s, j) * (1 + r() * 0.2));
    if (caixaDe(base, s, para) * (base.clubes[para].div === 'X' ? 3 : 0.6) < valor) continue;
    const de = mover(j, para, valor); quentes++;
    add(`${valor >= 5e6 ? 'HERE WE GO! Em' : 'Mercado: em'} grande fase, ${j.curto} deixa o ${nome(de)} e acerta com o ${nome(para)} por ${fmt(valor)}.`, 'mercado', base.clubes[de].div, { jogador: j.id });
  }
  if (r() < 0.35) {
    const destaques = [...base.jog.values()].filter(j => base.clubes[j.clube].div === 'A' && j.clube !== meu && j.idade <= 27 && (j.ovr >= 78 || (j.ovr >= 75 && media(s.est[j.id]) >= 6.9)) && vendedorAguenta(base, s, j) && !preContratoDe(s, j.id) && !s.emprestimos[j.id]);
    const j = destaques.length && pickW(r, destaques, x => x.ovr - 72);
    const fora = j && interessados(base, j).filter(ci => base.clubes[ci].div === 'X');
    if (fora?.length) {
      const para = pickW(r, fora, ci => base.clubes[ci].fan), valor = arred(precoPedido(base, s, j) * (1 + r() * 0.3)), de = mover(j, para, valor);
      add(`HERE WE GO! Venda para o exterior: ${j.curto} troca o ${nome(de)} pelo ${nome(para)} (${base.clubes[para].liga}) por ${fmt(valor)}.`, 'mercado', base.clubes[de].div, { jogador: j.id });
    }
  }
}

// ---------- fim de rodada ----------
// responde as propostas do usuário, gera propostas pelos jogadores dele, pré-contratos, negócios da IA e relatórios do olheiro
export function resolverMercado(base, s, rd) {
  garantirMercado(s);
  const r = rng(`mercado${s.seed}-${rd}`), meu = s.tecnico.clube, N = [];
  const nome = ci => base.clubes[ci].n;
  const add = (texto, tipo = 'clube', div = base.clubes[meu].div, extra) => N.push({ rodada: rd + 1, tipo, div, texto, mercado: true, ...extra });
  for (const [id, c] of Object.entries(s.chegou)) if (agora(s) - c >= TRAVA) delete s.chegou[id];
  if (s.acordos.length && janelaAberta(s.ano, rd + 1)) cumprirAcordos(base, s, add);

  for (const p of s.propostas.filter(x => x.estado === 'aguardando' && x.rodada <= rd)) {
    const j = base.jog.get(p.jogador), tipo = p.tipo || 'compra', t = p.troca && base.jog.get(p.troca);
    const falha = (motivo, txt) => {
      p.estado = 'recusada'; p.motivo = motivo; if (txt) add(txt);
      const x = s.recusas[j.id]?.ano === s.ano ? s.recusas[j.id] : { n: 0, ate: 0 }, n = x.n + 1;
      s.recusas[j.id] = n >= 3 ? { n: 0, ano: s.ano, ate: rd + 3 } : { n, ano: s.ano, ate: x.ate };
      if (n >= 3) add(`Depois de três recusas, as conversas por ${j.curto} ficam fechadas por 2 rodadas.`);
    };
    if (j.clube !== p.de) { p.estado = 'cancelada'; p.motivo = 'ele já trocou de clube'; continue; }
    if (preContratoDe(s, j.id)) { p.estado = 'cancelada'; p.motivo = 'assinou pré-contrato com outro clube'; continue; }
    if (p.troca && (!t || t.clube !== meu)) { p.estado = 'cancelada'; p.motivo = 'o jogador da troca não está mais no elenco'; continue; }
    if (t && vontade(base, s, t, j.clube) < 35) { falha(`${t.curto} não quer ir para o ${nome(j.clube)}`, `${t.curto} não aceita ir para o ${nome(j.clube)} na troca por ${j.curto}.`); continue; }
    const fechada = tipo === 'compra' && !janelaAberta(s.ano, rd + 1), vt = t ? valorNaTroca(base, s, t, j.clube) : 0;
    if (tipo !== 'livre' && !p.clubeOk && rivais(base, j.clube, meu) && r() < 0.9) { falha('o clube não negocia com o rival', `O ${nome(j.clube)} nem abre conversa: não negocia ${j.curto} com o rival.`); continue; }
    if (tipo === 'compra' && !p.clubeOk && !p.aceitouContra) {
      const pedido = Math.min(precoPedido(base, s, j), p.pedido || Infinity); // o clube honra o preço que pediu na hora da proposta
      if (p.valor + vt < pedido) {
        if (p.valor + vt >= pedido * 0.85) { p.estado = 'contraproposta'; p.contra = Math.max(0, arred(pedido - vt)); add(`O ${nome(j.clube)} pede ${fmt(p.contra)}${t ? ` além de ${t.curto}` : ''} por ${j.curto}.`); }
        else falha('o clube achou pouco', `O ${nome(j.clube)} recusa a proposta por ${j.curto}.`);
        continue;
      }
      p.clubeOk = true;
    }
    if (tipo === 'emprestimo' && !listasIA(base, s).emprestimo.has(j.id)) { falha('o clube desistiu de emprestar', `O ${nome(j.clube)} não quer mais emprestar ${j.curto}.`); continue; }
    // disputa: clubes que também fariam sentido podem entrar na briga (por livre e pré-contrato também)
    let melhorRival = null;
    if (tipo !== 'emprestimo' && !fechada) {
      const rivais = interessados(base, j).filter(ci => ci !== meu && r() < (tipo === 'compra' ? 0.35 : 0.25))
        .map(ci => ({ ci, valor: tipo === 'compra' ? arred(Math.max(p.valor * (1.05 + r() * 0.15), precoPedido(base, s, j))) : 0 }))
        .filter(x => caixaDe(base, s, x.ci) >= x.valor).slice(0, 2);
      for (const x of rivais) add(tipo === 'compra' ? `O ${nome(x.ci)} entra na disputa por ${j.curto} com ${fmt(x.valor)}.` : `O ${nome(x.ci)} também quer ${j.curto}.`);
      melhorRival = rivais.map(x => ({ ...x, v: vontade(base, s, j, x.ci) + (tipo === 'compra' ? (x.valor - p.valor) / Math.max(p.valor, 1) * 20 : 0) + (r() - 0.5) * 16 })).sort((a, b) => b.v - a.v)[0];
    }
    const minha = vontade(base, s, j, meu) + (r() - 0.5) * 16 + (tipo === 'emprestimo' ? 10 : 0);
    if (minha < 50) { falha(`${j.curto} ${motivoRecusa(base, s, j)}`, `${j.curto} recusa: ${motivoRecusa(base, s, j)}.`); continue; }
    if (melhorRival && melhorRival.v > minha) {
      p.estado = 'perdida'; p.motivo = `ele escolheu o ${nome(melhorRival.ci)}`;
      if (tipo === 'pre') s.preContratos.push({ jogador: j.id, de: j.clube, para: melhorRival.ci, rodada: rd });
      else if (tipo === 'livre' || tipo === 'compra') { transferir(base, s, j, melhorRival.ci, 0); s.historicoTransf[0].valor = melhorRival.valor; s.historicoTransf[0].ia = true; }
      add(`${j.curto} escolhe o ${nome(melhorRival.ci)}${tipo === 'pre' ? ' e assina pré-contrato' : ' e vai jogar lá'}.`, 'mercado', base.clubes[melhorRival.ci].div, { jogador: j.id });
      continue;
    }
    // salário: abaixo de 90% do que pede, ele faz contraproposta; entre 90% e 100%, pode topar
    const pede = tipo === 'emprestimo' ? 0 : salarioPedido(base, s, j, p.anos);
    if (!p.salOk && p.salario < pede && !(p.salario >= pede * 0.9 && r() < (p.salario / pede - 0.9) * 10)) {
      p.estado = 'contraproposta'; p.contraSal = pede; add(`${j.curto} topa vir, mas pede € ${pede.toLocaleString('pt-BR')}/dia.`); continue;
    }
    if (tipo === 'compra' && p.valor > s.caixa) { falha('faltou dinheiro em caixa'); continue; }
    const de = j.clube;
    p.estado = 'concluida';
    const pago = `${p.valor ? fmt(p.valor) : ''}${p.valor && t ? ' + ' : ''}${t ? `${t.curto} na troca` : ''}`;
    if (tipo === 'pre') { s.preContratos.push({ jogador: j.id, de, para: meu, salario: p.salario, anos: p.anos, rodada: rd }); add(`Pré-contrato assinado: ${j.curto} chega do ${nome(de)} em janeiro de ${s.ano + 1}.`); }
    else if (tipo === 'emprestimo') { const opcao = opcaoCompra(base, s, j); emprestar(base, s, j, meu); s.emprestimos[j.id].opcao = opcao; add(`Reforço por empréstimo: ${j.curto} chega do ${nome(de)} até o fim da temporada, com opção de compra por ${fmt(opcao)}.`); }
    else if (fechada) { p.motivo = 'chega quando a janela abrir'; s.acordos.push({ jogador: j.id, de, valor: p.valor, salario: p.salario, anos: p.anos, troca: p.troca || 0 }); add(`Acordo fechado: ${j.curto} chega do ${nome(de)} (${pago}) quando a janela abrir.`); }
    else {
      if (t) { transferir(base, s, t, de, 0); s.historicoTransf[0].tipo = 'troca'; }
      transferir(base, s, j, meu, p.valor, { salario: p.salario, anos: p.anos });
      add(`HERE WE GO! ${j.curto} é do ${nome(meu)}. ${tipo === 'livre' ? 'Chega sem custo' : pago}, contrato até ${s.ano + p.anos}.`, 'mercado', base.clubes[meu].div, { jogador: j.id, para: meu });
      add(tipo === 'livre' ? `Reforço: ${j.curto}, que estava sem clube, assina até ${s.ano + p.anos}.` : `Reforço: ${j.curto} chega do ${nome(de)} (${pago}).`);
    }
  }

  // contrapropostas suas nas ofertas recebidas: o clube topa (e o negócio sai), sobe um pouco ou desiste
  for (const x of s.recebidas.filter(x => x.pedido && x.rodada <= rd)) {
    const j = base.jog.get(x.jogador), ped = x.pedido, teto = arred(x.valor * ((x.gigante ? 1.35 : 1.12) + r() * 0.2 + faseDe(s, j.id).d * 0.03));
    delete x.pedido;
    if (ped <= teto) {
      x.valor = ped;
      const e = aceitarRecebida(base, s, x.id);
      if (e) { x.rodada = rd; add(`O ${nome(x.de)} aceita pagar ${fmt(ped)} por ${j.curto}, mas o negócio travou: ${e}`); }
    } else if (r() < 0.5) { Object.assign(x, { id: `${x.id}-c`, valor: teto, rodada: rd }); add(`O ${nome(x.de)} não chega a ${fmt(ped)}, mas sobe a oferta por ${j.curto} para ${fmt(teto)}. Responda no Mercado.`, 'clube', base.clubes[meu].div, { jogador: j.id }); }
    else { s.recebidas = s.recebidas.filter(y => y !== x); add(`O ${nome(x.de)} acha caro e desiste de ${j.curto}.`, 'clube', base.clubes[meu].div, { jogador: j.id }); if (x.quer) barrarSaida(base, s, x); }
  }
  // leilão: quem fez a oferta e até 3 interessados dão lances; vence quem pagar mais (no máximo 190% do valor)
  for (const x of s.recebidas.filter(x => x.leilao === 'aberto' && x.rodada <= rd)) {
    const j = base.jog.get(x.jogador), teto = arred(Math.max(x.valor, j.valor * 1000 * 1.9));
    const outros = shuffle(r, interessados(base, j).filter(ci => ci !== x.de && ci !== meu && !rivais(base, ci, meu) && base.elencos[ci].length < 38)).slice(0, 3);
    const lances = [x.de, ...outros].map(ci => ({ ci, max: Math.max(ci === x.de ? x.valor : 0, Math.min(teto, caixaDe(base, s, ci) * (base.clubes[ci].div === 'X' ? 3 : 0.6)) * (0.55 + r() * 0.45)) }))
      .filter(l => l.max >= x.valor).sort((a, b) => b.max - a.max);
    const [v1, v2] = lances, valor = v2 ? Math.max(x.valor, arred(Math.min(v1.max, v2.max * 1.05))) : x.valor, motivo = querIr(base, s, j, v1.ci);
    Object.assign(x, { id: `${x.id}-L`, de: v1.ci, valor, leilao: 'fim', rodada: rd, quer: motivo && r() < 0.8 ? motivo : null });
    s.recebidas = s.recebidas.filter(y => y === x || y.jogador !== x.jogador);
    add(lances.length > 1 ? `Leilão por ${j.curto}: ${lances.length} clubes na briga e o ${nome(v1.ci)} vence com ${fmt(valor)}. Responda no Mercado.` : `Leilão por ${j.curto}: ninguém cobriu a oferta do ${nome(v1.ci)} (${fmt(valor)}).`, 'clube', base.clubes[meu].div, { jogador: j.id });
  }

  // propostas pelos seus jogadores (só com a janela aberta); vencem em 2 rodadas. Fase boa e lista de venda chamam atenção.
  for (const x of s.recebidas.filter(x => x.rodada < rd - 1 && x.quer && base.jog.get(x.jogador).clube === meu)) barrarSaida(base, s, x); // deixou vencer = segurou
  s.recebidas = s.recebidas.filter(x => x.rodada >= rd - 1 && base.jog.get(x.jogador).clube === meu);
  if (janelaAberta(s.ano, rd + 1)) {
    // gigante europeu ou árabe aparece pelo seu craque, de vez em quando, com dinheiro de sobra
    const craques = base.elencos[meu].filter(j => (j.ovr >= 77 || (j.ovr >= 73 && faseDe(s, j.id).k === 'excelente')) && j.idade <= 33 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && !travado(s, j.id) && !s.recebidas.some(x => x.jogador === j.id));
    if (craques.length && r() < 0.06) {
      const j = pickW(r, craques, x => x.ovr - 70), arabe = j.idade >= 29 || r() < 0.3;
      const ops = base.clubes.map((c, i) => i).filter(i => GIGANTE(base.clubes[i]) && (base.clubes[i].liga === 'Saudi Pro League') === arabe);
      if (ops.length) {
        const de = pickW(r, ops, ci => base.clubes[ci].fan), valor = arred(precoPedido(base, s, j) * (1.4 + r() * 0.5)), quer = r() < 0.9 ? (arabe ? 'não resiste ao salário da Arábia' : 'sonha em jogar na Europa') : null;
        s.recebidas.push({ id: `${j.id}-${de}-${rd}`, tipo: 'compra', jogador: j.id, de, valor, rodada: rd, quer, gigante: true });
        add(`Proposta milionária: o ${nome(de)} oferece ${fmt(valor)} por ${j.curto}.${quer ? ` Ele ${quer} e quer ir.` : ''} Responda no Mercado.`, 'clube', base.clubes[meu].div, { jogador: j.id, imprensa: true });
      }
    }
    let novas = 0;
    for (const j of base.elencos[meu].slice().sort((a, b) => faseDe(s, b.id).d - faseDe(s, a.id).d || b.ovr - a.ovr)) {
      if (novas >= 3) break;
      if (s.emprestimos[j.id] || preContratoDe(s, j.id) || travado(s, j.id) || emAcordo(s, j.id) || s.recebidas.some(x => x.jogador === j.id)) continue;
      const listado = s.listas.venda.includes(j.id);
      if (s.listas.emprestimo.includes(j.id)) {
        if (r() > 0.3) continue;
        const opcoes = base.clubes.map((c, i) => i).filter(ci => BR.includes(base.clubes[ci].div) && ci !== meu && base.elencos[ci].filter(x => x.ovr > j.ovr).length < 14);
        if (!opcoes.length) continue;
        const de = pickW(r, opcoes, ci => base.clubes[ci].fan);
        s.recebidas.push({ id: `${j.id}-${de}-${rd}`, tipo: 'emprestimo', jogador: j.id, de, valor: 0, rodada: rd });
        add(`O ${nome(de)} pede ${j.curto} emprestado até o fim da temporada. Responda no Mercado.`);
        continue;
      }
      const e = s.est?.[j.id], emAlta = e && e[0] >= 3 && (media(e) >= 6.9 || e[1] >= e[0] * 0.4), f = faseDe(s, j.id);
      const chance = listado ? 0.35 : f.k === 'excelente' ? 0.45 : f.k === 'boa' ? 0.28 : emAlta || j.ovr >= 78 || j.ovr >= base.forca(meu) + 4 ? 0.12 : 0;
      if (r() >= chance) continue;
      let opcoes = interessados(base, j);
      if (listado && !opcoes.length) opcoes = base.clubes.map((c, i) => i).filter(ci => BR.includes(base.clubes[ci].div) && ci !== meu && !rivais(base, ci, meu) && Math.abs(base.forca(ci) - j.ovr) <= 5);
      if (!opcoes.length) continue;
      const de = pickW(r, opcoes, ci => base.clubes[ci].fan + (naContinental(s, ci) ? 4 : 0)), valor = arred(precoPedido(base, s, j) * (listado ? 0.7 + r() * 0.25 : 0.85 + r() * 0.3 + f.d * 0.04));
      if (caixaDe(base, s, de) < valor) continue;
      const motivo = querIr(base, s, j, de), quer = motivo && r() < 0.8 ? motivo : null;
      s.recebidas.push({ id: `${j.id}-${de}-${rd}`, tipo: 'compra', jogador: j.id, de, valor, rodada: rd, quer });
      add(`O ${nome(de)} oferece ${fmt(valor)} por ${j.curto}.${quer ? ` Ele ${quer} e quer ir.` : ''} Responda no Mercado.`, 'clube', base.clubes[meu].div, { jogador: j.id });
      novas++;
    }
  }

  // contrato acabando e sem renovação: a partir da 25ª rodada, outro clube pode assinar pré-contrato com ele
  if (rd >= 24) for (const j of base.elencos[meu]) {
    if (!contratoNoFim(s, j) || preContratoDe(s, j.id) || s.emprestimos[j.id] || j.ovr < base.forca(meu) - 4 || r() > 0.15) continue;
    const opcoes = interessados(base, j); if (!opcoes.length) continue;
    const para = pickW(r, opcoes, ci => base.clubes[ci].fan);
    s.preContratos.push({ jogador: j.id, de: meu, para, rodada: rd });
    add(`${j.curto} assina pré-contrato com o ${nome(para)} e sai no fim da temporada. Renove os contratos que estão acabando.`);
  }

  // chateado por não ter sido liberado: moral não sobe e, de vez em quando, ele cobra em público
  for (const [id, q] of Object.entries(s.querSair || {})) {
    const j = base.jog.get(+id);
    if (!j || j.clube !== meu || rd - q.rodada >= 8) { delete s.querSair[id]; continue; }
    s.mor[id] = Math.min(s.mor[id] ?? 62, 45);
    if (r() < 0.15) add(`${j.curto} cobra a diretoria: "Eu ${q.motivo.replace(/^é /, 'tinha ')}. Quero ser negociado."`, 'clube', base.clubes[meu].div, { jogador: j.id, imprensa: true });
  }
  if (janelaAberta(s.ano, rd)) negociosIA(base, s, rd, r, add);
  trabalhoDoOlheiro(base, s, rd, r);
  if (s.historicoTransf.length > 400) s.historicoTransf.length = 400;
  s.noticias = [...N, ...s.noticias].slice(0, 220);
}
