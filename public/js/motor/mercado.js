// Mercado: preço, salário e contrato, vontade do jogador, disputa com rivais, livres, pré-contratos,
// listas de venda e empréstimo, olheiros, favoritos e negócios entre os clubes da IA.
// Extras: troca (jogador como parte do pagamento), acordo com a janela fechada, opção de compra no empréstimo,
// chamar emprestado de volta, rescisão, no máximo 3 clubes por temporada (FIFA), 3 recusas fecham a conversa,
// contraproposta e leilão nas ofertas recebidas, gigantes europeus e árabes.
// Proposta é respondida na hora (responderProposta); multa rescisória paga, o clube não segura. Compra com concorrência vira leilão (leilao.js).
import { rivais } from './rivais.js';
import { premiado } from './gala.js';
import { faseDe } from './forma.js';
import { rng, clamp, pickW, shuffle, SETOR, nivelDiv, estrelas, continenteDe, fmtDinheiro } from './util.js';
import { temperamento, tratar } from './vestiario.js';
import { interessados, media } from './noticias.js';
import { janelaAberta, janelaAtual, caixaIAInicial, aplicarSave, evolucao, limiteEstrangeiros, naoJogaA } from './mundo.js';
import { dataAmistoso, doAno } from './calendario.js';
import { orcamento, lancar, garantirFinancas, salarioDia, salarioBase, diasRestantes, registroBloqueado, passaDoTeto, dividaInicial, receitaAnual } from './financas.js';
import { naSelecao } from './selecao.js';
import { enviar } from './correio.js';
import { abrirLeilaoCompra, encerrarPendente } from './leilao.js';
import { humanos, ehHumano, vistaDo, sufixo } from './humanos.js';
import { emQualCont } from './continental.js';

const arred = v => Math.max(50000, Math.round(v / 10000) * 10000);
const arredSal = v => Math.max(10, Math.round(v / 10) * 10);
export const LIMITE_ELENCO = 45, MINIMO_ELENCO = 18, ABRE_PRE = 19, MAX_PRE = 5, MAX_PASSAGENS = 2;
const ehLivre = (base, ci) => base.clubes[ci].div === 'L';
const BR = ['A', 'B', 'C'];
const fmt = v => fmtDinheiro(v);

// campos do mercado no save (saves antigos ganham os que faltam)
export function garantirMercado(s) {
  for (const [k, v] of Object.entries({ propostas: [], recebidas: [], historicoTransf: [], transf: {}, contratos: {}, salarios: {}, favoritos: [], preContratos: [], emprestimos: {}, relatorios: {}, observar: [], chegou: {}, recusas: {}, acordos: [] })) s[k] ||= v;
  s.listas ||= { venda: [], emprestimo: [] };
  s.olheiro ||= { regiao: 'BR', setor: '', jovens: true };
  return s;
}

// FIFA (RSTP, art. 5): na temporada o jogador é registrado por no máximo 3 clubes, ou seja, 2 mudanças (venda,
// empréstimo ou contrato de livre). A IA, por conta própria, não revende quem chegou há menos de 14 jogos (bom senso, não
// regra). 3 recusas seguidas fecham a conversa por 2 rodadas. Quem chegou nesta janela não recebe proposta (de ninguém)
// até ela fechar.
const agora = s => s.ano * 40 + s.rodada;
const janelaHoje = s => { const k = janelaAtual(s.ano, s.rodada, s.ultimaData); return k < 0 ? null : s.ano * 2 + k; };
export const chegouNaJanela = (s, id) => { const k = janelaHoje(s); return k != null && s.janChegada?.[id] === k; };
const marcarChegada = (s, id) => { (s.chegou ||= {})[id] = agora(s); (s.passagens ||= {})[id] = (s.passagens[id] || 0) + 1; const k = janelaHoje(s); if (k != null) (s.janChegada ||= {})[id] = k; };
export const semPassagem = (s, id) => (s.passagens?.[id] || 0) >= MAX_PASSAGENS;
export const textoPassagem = j => `${j.curto} já foi registrado por 3 clubes nesta temporada: pela regra da FIFA, só muda de clube no ano que vem.`;
const recente = (s, id) => semPassagem(s, id) || chegouNaJanela(s, id) || (s.chegou?.[id] != null && agora(s) - s.chegou[id] < 14);
export const textoJanela = (base, j) => `${j.curto} acabou de chegar ao ${base.clubes[j.clube].n}: só pode receber proposta quando esta janela de transferências fechar.`;
export const conversaFechada = (s, id) => { const x = s.recusas?.[id]; return x?.ano === s.ano && x.ate > s.rodada ? x.ate - s.rodada : 0; };
const emAcordo = (s, id) => s.acordos?.some(a => a.jogador === id || a.troca === id);

// ---------- situação do jogador ----------
// listas dos clubes da IA: quem sobra no elenco vai à venda, garoto sem espaço em clube grande vai para empréstimo
export function listasIA(base, s) {
  const k = `${s.seed}-${s.ano}-${base._versao}`;
  if (base._listas?.k === k) return base._listas;
  const venda = new Set(), emprestimo = new Set();
  base.clubes.forEach((c, ci) => {
    if (ehHumano(s, ci) || c.div === 'L') return;
    const grande = c.div === 'A' || (c.div === 'X' && c.tier >= 3);
    const f = base.forca(ci);
    base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).forEach((j, rank) => {
      const r = rng(`lista${s.seed}-${s.ano}-${j.id}`)();
      if (s.emprestimos[j.id]) return;
      if (s.quedaIA?.[j.id]?.ano === s.ano) { venda.add(j.id); return; } // caiu e pediu pra sair: vai à venda mais barato
      if (((rank >= 18 && j.idade >= 23) || (rank >= 12 && j.idade >= 33)) && j.ovr <= f - 2 && r < 0.55) venda.add(j.id);
      else if (grande && j.idade <= 22 && rank >= 14 && j.ovr <= f - 3 && r < 0.6) emprestimo.add(j.id);
    });
  });
  return (base._listas = { k, venda, emprestimo });
}
export const contratoNoFim = (s, j) => j.contrato <= s.ano;
// vai pendurar as chuteiras no fim da temporada (a evolução do ano que vem já diz)
export const vaiAposentar = (s, j) => !j.fora && j.idade >= 33 && evolucao(j, s.ano + 1 - j.anoBase).fora;
export const preContratoDe = (s, id) => s.preContratos.find(p => p.jogador === id);
export function situacao(base, s, j) {
  const L = listasIA(base, s), dono = vistaDo(s, j.clube), t = [];
  if (ehLivre(base, j.clube)) return ['livre'];
  if (s.emprestimos[j.id]) t.push('emprestado');
  if (dono ? dono.listas?.venda.includes(j.id) : L.venda.has(j.id)) t.push('venda');
  if (dono ? dono.listas?.emprestimo.includes(j.id) : L.emprestimo.has(j.id)) t.push('emprestimo');
  if (contratoNoFim(s, j)) t.push('fim');
  if (preContratoDe(s, j.id)) t.push('pre');
  if (s.rodada >= ABRE_PRE && vaiAposentar(s, j)) t.push('aposenta');
  return t;
}

// ---------- preço e salário ----------
// preço pedido ao comprador (por padrão, você). Contrato acabando barateia mês a mês: nos últimos 6 meses ele já
// pode assinar pré-contrato de graça. Os fatores ficam entre 0,35x e 2,2x o valor de mercado; para o rival, x1,6 por cima.
const hoje = s => s.ultimaData ?? +dataAmistoso(s.ano, 0);
export const mesesDeContrato = (s, j) => (+doAno(j.contrato, '12-31') - hoje(s)) / (30.44 * 864e5);
export const fatorContrato = m => m >= 24 ? 1 : m >= 12 ? 0.8 + 0.2 * (m - 12) / 12 : m >= 6 ? 0.5 + 0.3 * (m - 6) / 6 : Math.max(0.15, 0.5 * m / 6);
export function precoPedido(base, s, j, comprador = s.tecnico.clube) {
  if (ehLivre(base, j.clube)) return 0;
  const el = base.elencos[j.clube].slice().sort((a, b) => b.ovr - a.ovr), rank = el.indexOf(j), daqui = base.clubes[j.clube];
  let f = rank < 11 ? 1.35 : rank < 18 ? 1.1 : 0.85;
  if (j.idade <= 21 && j.pot >= j.ovr + 8) f *= 1.4;
  if (media(s.est?.[j.id]) >= 7) f *= 1.2;
  if (premiado(s, j.id)) f *= 1.15;                                     // premiado na última gala
  f *= 1 + faseDe(s, j.id).d * 0.05;                                   // fase excelente encarece 15%, péssima barateia
  if (daqui.div === 'X') f *= 1.15;                                     // clube de fora não vende barato
  if (rank < 3 && j.clube !== comprador && daqui.div === base.clubes[comprador].div) f *= 1.3; // não vende craque pra concorrente direto
  if (listasIA(base, s).venda.has(j.id)) f *= 0.7;                       // está à venda: o clube quer se livrar
  const rival = rivais(base, j.clube, comprador) ? 1.6 : 1;               // vender pro rival só se for muito bom (fica fora do limite)
  return arred((j.valor * 1000 || 30000) * clamp(f, 0.35, 2.2) * rival * fatorContrato(mesesDeContrato(s, j)));
}

// quanto o jogador quer vir (0-100). Clube maior, divisão, chance de ser titular, idade e nome do técnico pesam.
// ---------- promessa de titularidade ----------
// Quem teme o banco (tem gente igual ou melhor na posição) pode vir com a promessa de ser titular em 6 dos 10 primeiros
// jogos que puder jogar. Promessa quebrada fica na sua fama por 2 temporadas: quem teme o banco desconfia de você e cada
// promessa nova vale metade (com 2 quebradas, não vale nada).
export const PROMESSA = { jogos: 10, titular: 6 };
export const medoDoBanco = (base, j, destino) => base.elencos[destino].filter(x => x.pos === j.pos && x.id !== j.id && x.ovr >= j.ovr).length;
export const palavraQuebrada = s => (s.palavra?.quebradas || []).filter(a => a >= s.ano - 1).length;
function prometerTitular(base, s, j) { (s.promTit ||= {})[j.id] = { ano: s.ano, jogos: 0, tit: 0 }; }
// depois de cada jogo oficial do seu clube: conta jogos e jogos como titular de quem tem promessa
export function acompanharPromessas(base, s, sim, t) {
  const P = s.promTit; if (!P || !Object.keys(P).length) return;
  const ci = s.tecnico.clube, entrou = new Set(sim.eventos.filter(e => e.tipo === 'sub' && e.time === t).map(e => e.jogador)), nome = base.clubes[ci].n;
  for (const [id, p] of Object.entries(P)) {
    const j = base.jog.get(+id);
    if (!j || !ehHumano(s, j.clube)) { delete P[id]; continue; }
    if (j.clube !== ci) continue;                                          // promessa de outro técnico
    const jogou = sim.notas[t][id] != null, titular = jogou && !entrou.has(+id);
    const fora = (s.dm?.[id] && !s.dm[id].inf) || Object.values(s.susp?.[id] || {}).some(n => n > 0) || s.afast?.[id]?.n > 0 || naSelecao(s, +id);
    if (!jogou && fora) continue;                                        // lesionado, suspenso ou convocado: o jogo não conta
    p.jogos++; if (titular) p.tit++;
    const noticia = texto => s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', clube: ci, jogador: j.id, imprensa: true, div: base.clubes[ci].div, texto });
    if (p.tit >= PROMESSA.titular) {
      delete P[id]; s.palavra = { ...(s.palavra || {}), cumpridas: (s.palavra?.cumpridas || 0) + 1 };
      s.mor[id] = clamp((s.mor[id] ?? 62) + 5, 0, 100); tratar(s, j.id, 2);
      noticia(`${j.curto} agradece: "O professor prometeu que eu ia ser titular e cumpriu."`);
    } else if (p.jogos - p.tit > PROMESSA.jogos - PROMESSA.titular) {
      delete P[id]; s.palavra = { ...(s.palavra || {}), quebradas: [...(s.palavra?.quebradas || []), s.ano] };
      s.mor[id] = clamp((s.mor[id] ?? 62) - 15, 0, 100); tratar(s, j.id, -4);
      (s.querSair ||= {})[id] = { de: null, rodada: s.rodada, motivo: 'vim com a promessa de ser titular' };
      noticia(`${j.curto} desabafa: "Vim para o ${nome} com a promessa de ser titular. Não foi o que aconteceu."`);
      enviar(s, 'diretor', `promessa-${id}-${s.ano}-${s.rodada}`, 'Promessa quebrada', `${j.curto} veio com a promessa de ser titular e ficou no banco. Ele quer sair, e o mercado já sabe: jogador que tem medo de ficar na reserva vai desconfiar de qualquer promessa nossa pelas próximas duas temporadas.`, { jogador: j.id });
    }
  }
}

export function vontade(base, s, j, destino, promessa = false) {
  const daqui = base.clubes[j.clube], dela = base.clubes[destino], livre = daqui.div === 'L';
  let v = livre ? 62 + (base.forca(destino) - j.ovr) * 2 : 50 + (base.forca(destino) - base.forca(j.clube)) * 3;
  if (!livre) { const nd = nivelDiv(dela) - nivelDiv(daqui); v += nd > 0 ? -25 * nd : nd < 0 ? 15 * -nd : 0; }
  if (daqui.div === 'X' && dela.div !== 'X') v += j.nat === 'BRA' ? 10 : -10; // brasileiro lá fora gosta de voltar
  const naPos = base.elencos[destino].filter(x => x.pos === j.pos && x.id !== j.id), acima = naPos.filter(x => x.ovr >= j.ovr).length;
  const peso = j.idade <= 23 ? 2 : 1;
  v += acima === 0 ? 15 * peso : acima >= 2 ? -20 * peso : 0;
  if (destino === s.tecnico.clube && acima >= 1) {
    const q = palavraQuebrada(s);
    v -= 12 * Math.min(q, 3);                                                                     // fama de não cumprir
    if (promessa) v += ((acima >= 2 ? 20 : 0) + 15) * peso * Math.max(0, 1 - q * 0.5);            // a promessa tira o medo
  }
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
export function salarioPedido(base, s, j, anos = 3, destino = s.tecnico.clube, promessa = false) {
  const atual = ehLivre(base, j.clube) ? 0 : salarioDia(base, s, j);
  const v = vontade(base, s, j, destino, promessa);
  let pede = Math.max(atual, salarioBase(base.clubes[destino], j)) * (1.1 + clamp((60 - v) / 100, -0.1, 0.6));
  if (j.idade >= 30) pede *= 1 + 0.06 * Math.max(0, 3 - anos);
  if (ehLivre(base, j.clube)) pede *= 0.9;
  return arredSal(pede);
}
// quanto de salário novo cabe (se ele já é seu, o salário atual sai da conta)
export function folgaPara(base, s, j) { return orcamento(base, s).folga + (j.clube === s.tecnico.clube ? salarioDia(base, s, j) : 0); }

// caixa de verdade dos clubes da IA: começa no caixa inicial, mexe a cada compra e venda e se refaz em parte na virada
export const caixaDe = (base, s, ci) => { const v = vistaDo(s, ci); return v ? v.caixa : s.caixaIA?.[ci] ?? caixaIAInicial(base, ci); };
// dinheiro que entra num clube da IA: parte fica para contratar (o resto vai para folha, dívida e impostos, como nos
// clubes de verdade). Os daqui reinvestem até 75% do que vendem (Palmeiras e Botafogo gastaram quase o que venderam em
// 2025); quem deve muito, menos. O que sai, sai inteiro.
export function mexerCaixa(base, s, ci, v) {
  if (ci == null || ehHumano(s, ci) || base.clubes[ci].div === 'L' || !v) return; // técnico: o dinheiro entra pelo extrato
  const c = base.clubes[ci], fica = c.div === 'X' ? 0.4 : clamp(0.75 - dividaInicial(c) / Math.max(1, receitaAnual(c)) * 0.12, 0.3, 0.75);
  (s.caixaIA ||= {})[ci] = Math.round(caixaDe(base, s, ci) + (v > 0 ? v * fica : v));
}

// ---------- propostas do usuário ----------
// tipos: compra (paga ao clube), livre (sem clube), pre (contrato no fim; chega na próxima temporada), emprestimo (até o fim da temporada)
export function tiposPossiveis(base, s, j) {
  if (ehLivre(base, j.clube)) return ['livre'];
  const t = [];
  if (!s.emprestimos[j.id]) t.push('compra');
  if (contratoNoFim(s, j) && s.rodada >= ABRE_PRE && !preContratoDe(s, j.id) && !vaiAposentar(s, j)) t.push('pre');
  if (!s.emprestimos[j.id] && base.clubes[j.clube].div !== 'X') t.push('emprestimo'); // quem decide são as cláusulas
  return t;
}

export function bloqueioProposta(base, s, j, o) {
  const meu = s.tecnico.clube, janela = janelaAberta(s.ano, s.rodada, s.ultimaData);
  if (j.clube === meu) return 'Ele já é seu.';
  const ban = registroBloqueado(s); if (ban) return `Registro de jogadores bloqueado ${s.banAdm?.ate === ban && s.banAdm.ano === s.ano ? 'pelo ADM da liga' : 'pelo fair play financeiro'} ${ban >= 38 ? 'até o fim da temporada' : `até a ${ban + 1}ª rodada`}.`;
  if (s.propostas.some(p => p.jogador === j.id && ['aguardando', 'contraproposta'].includes(p.estado))) return 'Você já tem uma proposta por ele.';
  if (emAcordo(s, j.id)) return 'Já existe um acordo por ele.';
  const fx = conversaFechada(s, j.id);
  if (fx) return `O ${base.clubes[j.clube].n} fechou as conversas depois de 3 recusas. Tente de novo em ${fx} rodada${fx > 1 ? 's' : ''}.`;
  const pre = preContratoDe(s, j.id);
  if (pre) return `Já assinou pré-contrato com o ${base.clubes[pre.para].n}.`;
  if (s.emprestimos[j.id] && o.tipo !== 'pre') return 'Está emprestado até o fim da temporada.';
  if (o.tipo !== 'pre' && semPassagem(s, j.id)) return textoPassagem(j);
  if (o.tipo !== 'livre' && chegouNaJanela(s, j.id)) return textoJanela(base, j);
  if (o.tipo === 'pre' && s.rodada >= ABRE_PRE && vaiAposentar(s, j)) return 'Ele vai se aposentar no fim da temporada.';
  if (!tiposPossiveis(base, s, j).includes(o.tipo)) return o.tipo === 'pre' ? `Pré-contrato só com contrato no fim, a partir da ${ABRE_PRE + 1}ª rodada (metade do Brasileirão). Ele chega na temporada seguinte.` : o.tipo === 'emprestimo' ? 'Esse clube não empresta.' : 'Esse tipo de proposta não vale para ele.';
  if (o.tipo === 'emprestimo' && (o.cl?.taxa || 0) > s.caixa) return 'A taxa de empréstimo passa do que tem em caixa.';
  const t = o.troca && base.jog.get(o.troca);
  if (o.troca) {
    if (o.tipo !== 'compra') return 'Troca só em proposta de compra.';
    if (!t || t.clube !== meu) return 'O jogador da troca precisa ser do seu elenco.';
    if (s.emprestimos[t.id] || preContratoDe(s, t.id) || emAcordo(s, t.id)) return `${t.curto} não pode entrar na troca.`;
    if (semPassagem(s, t.id)) return textoPassagem(t);
    if (chegouNaJanela(s, t.id)) return `${t.curto} acabou de chegar: não pode entrar em troca nesta janela.`;
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
  const teto = passaDoTeto(base, s, o.salario); if (teto) return teto;
  if (o.tipo !== 'pre') { const folga = folgaPara(base, s, j) + (t ? salarioDia(base, s, t) : 0); if (o.salario > folga) return `O salário passa da folga da folha (€ ${folga.toLocaleString('pt-BR')}/dia). Abra espaço em Finanças ou venda alguém.`; }
  return null;
}

export function fazerProposta(base, s, j, o) {
  const cl = o.tipo === 'emprestimo' ? limpaCl(base, s, j, o.cl) : null;
  const oferta = { tipo: o.tipo || 'compra', valor: o.tipo === 'compra' && o.valor > 0 ? arred(o.valor) : 0, salario: cl ? Math.round(salarioDia(base, s, j) * cl.pct / 100) : arredSal(o.salario), anos: o.tipo === 'emprestimo' ? 1 : Math.round(o.anos || 3), troca: o.tipo === 'compra' && +o.troca || 0, ...(cl ? { cl } : {}), ...(o.promessa && o.tipo !== 'pre' && medoDoBanco(base, j, s.tecnico.clube) ? { promessa: true } : {}) };
  const erro = bloqueioProposta(base, s, j, oferta);
  if (erro) return erro;
  s.propostas.unshift({ id: `${j.id}-${s.rodada}`, jogador: j.id, de: j.clube, ...oferta, rodada: s.rodada, estado: 'aguardando', pedido: precoPedido(base, s, j) });
  return null;
}

// contraproposta: o clube pediu mais dinheiro e/ou o jogador pediu mais salário
export function aceitarContraproposta(base, s, id) {
  const p = s.propostas.find(x => x.id === id && x.estado === 'contraproposta'); if (!p) return 'Proposta não existe mais.';
  if (registroBloqueado(s)) return 'Registro de jogadores bloqueado: não dá para fechar agora.';
  const valor = p.contra ?? p.valor, salario = p.contraSal ?? p.salario;
  const teto = passaDoTeto(base, s, salario); if (teto) return `${teto} Ele pede € ${salario.toLocaleString('pt-BR')}/dia.`;
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

// ---------- cláusulas de empréstimo ----------
// taxa paga na hora, quanto do salário quem recebe banca, opção ou obrigação de compra (gatilho: N jogos,
// permanência na divisão ou fim do empréstimo), jogos mínimos com multa, cláusula do medo e revenda para o dono.
export const GATILHOS = { jogos: 'após N jogos', permanencia: 'se o time não cair', fim: 'no fim do empréstimo' };
export function limpaCl(base, s, j, c = {}) {
  return {
    taxa: Math.max(0, Math.round((+c.taxa || 0) / 1e4) * 1e4), pct: [50, 75, 100].includes(+c.pct) ? +c.pct : 100,
    compra: ['opcao', 'obrigacao'].includes(c.compra) ? c.compra : 'nenhuma', valorCompra: c.valorCompra > 0 ? arred(c.valorCompra) : opcaoCompra(base, s, j),
    gatilho: GATILHOS[c.gatilho] ? c.gatilho : 'jogos', jogos: clamp(Math.round(+c.jogos || 15), 1, 38), minimo: clamp(Math.round(+c.minimo || 0), 0, 30),
    medo: !!c.medo, revenda: [0, 10, 20, 30].includes(+c.revenda) ? +c.revenda : 0,
  };
}
// quanto o dono gosta da proposta (50 ou mais costuma fechar). Garoto da lista de empréstimo sai fácil;
// titular só sai com obrigação de compra bem paga.
export function notaEmprestimo(base, s, j, cl) {
  const ref = precoPedido(base, s, j), rank = base.elencos[j.clube].slice().sort((a, b) => b.ovr - a.ovr).indexOf(j);
  let n = listasIA(base, s).emprestimo.has(j.id) ? 60 : rank >= 18 ? 42 : rank >= 11 ? 30 : 8;
  n += Math.min(20, cl.taxa / Math.max(ref, 1) * 100);                       // taxa de 10% do preço = +10
  n += { 100: 8, 75: 0, 50: -12 }[cl.pct];
  if (cl.compra !== 'nenhuma') n += (cl.compra === 'obrigacao' ? { fim: 32, permanencia: 26, jogos: 24 - Math.max(0, cl.jogos - 12) * 0.8 }[cl.gatilho] : 6) + clamp((cl.valorCompra / Math.max(ref, 1) - 1) * 40, -25, 15);
  n += Math.min(10, cl.minimo * 0.6) + (cl.medo ? 4 : 0) + cl.revenda / 2;
  if (rivais(base, j.clube, s.tecnico.clube)) n -= 30;
  return Math.round(n);
}
const motivoEmp = (base, s, j, cl) => {
  const rank = base.elencos[j.clube].slice().sort((a, b) => b.ovr - a.ovr).indexOf(j);
  return rank < 11 && cl.compra !== 'obrigacao' ? 'titular só sai com obrigação de compra' : cl.pct < 100 ? 'quer que você pague o salário inteiro' : cl.compra !== 'nenhuma' && cl.valorCompra < precoPedido(base, s, j) ? 'achou baixo o valor da compra' : 'quer taxa maior ou uma cláusula de compra';
};
export function resumoCl(cl, jogou = null) {
  if (!cl) return '';
  const fm = v => fmt(v), t = [];
  if (cl.taxa) t.push(`taxa de ${fm(cl.taxa)}`);
  if (cl.pct && cl.pct < 100) t.push(`quem recebe paga ${cl.pct}% do salário`);
  const ob = cl.obrig || (cl.compra === 'obrigacao' && { valor: cl.valorCompra, gatilho: cl.gatilho, jogos: cl.jogos }), op = cl.opcao || (cl.compra === 'opcao' && cl.valorCompra);
  if (op) t.push(`opção de compra por ${fm(op)}`);
  if (ob) t.push(`obrigação de compra de ${fm(ob.valor)} ${ob.gatilho === 'jogos' ? `após ${ob.jogos} jogos${jogou != null ? ` (jogou ${jogou})` : ''}` : GATILHOS[ob.gatilho]}`);
  if (cl.minimo) t.push(`mínimo de ${cl.minimo} jogos${jogou != null ? ` (jogou ${jogou})` : ''}, senão multa`);
  if (cl.medo) t.push('cláusula do medo');
  if (cl.revenda) t.push(`${cl.revenda}% de uma venda futura para o dono`);
  return t.join(' · ');
}
export const jogosNoEmprestimo = (s, id) => { const e = s.emprestimos[id]; return e ? (s.est?.[id]?.[0] || 0) - (e.jogos0 || 0) : 0; };
// compra definitiva de quem está emprestado (opção exercida ou obrigação cumprida), nos dois sentidos
function efetivar(base, s, j, e, valor, txt) {
  const vp = vistaDo(s, e.para), vd = vistaDo(s, e.de);
  delete s.emprestimos[j.id];
  s.contratos[j.id] = s.ano + 3;
  if (vp) {
    s.salarios[j.id] = e.cheio || s.salarios[j.id];
    lancar(vp, 'compra', `${txt}: ${j.curto} (${base.clubes[e.de].n})`, -valor); vp.fin.temporada.compras += valor;
    if (e.revenda) (s.revenda ||= {})[j.id] = { clube: e.de, pct: e.revenda };
  } else delete s.salarios[j.id];
  if (vd) { lancar(vd, 'venda', `${txt}: ${j.curto} (${base.clubes[e.para].n})`, valor); vd.fin.temporada.vendas += valor; }
  mexerCaixa(base, s, e.para, -valor); mexerCaixa(base, s, e.de, valor);
  aplicarSave(base, s);
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de: e.de, para: e.para, valor, tipo: 'compra' });
}
// fim da temporada: multa de minutagem, obrigações por permanência/fim e a IA decidindo a opção pelo que ele jogou
export function fimDosEmprestimos(base, s, caem, add) {
  const nome = c => base.clubes[c].n;
  for (const [id, e] of Object.entries(s.emprestimos)) {
    const j = base.jog.get(+id), vp = vistaDo(s, e.para), vd = vistaDo(s, e.de); if (!j || (!vp && !vd)) continue;
    const jogou = jogosNoEmprestimo(s, id);
    if (e.minimo && jogou < e.minimo) {
      const v = arred(j.valor * 1000 * 0.1);
      if (vp) lancar(vp, 'minutagem', `Multa de minutagem: ${j.curto}`, -v);
      if (vd) lancar(vd, 'minutagem', `Multa de minutagem: ${j.curto}`, v);
      add(`Multa de minutagem: ${j.curto} jogou ${jogou} dos ${e.minimo} jogos combinados e o ${nome(e.para)} paga ${fmt(v)} ao ${nome(e.de)}.`, vp ? e.para : e.de);
    }
    const ob = e.obrig;
    if (ob && (ob.gatilho === 'fim' || (ob.gatilho === 'permanencia' && !caem.includes(e.para)))) { efetivar(base, s, j, e, ob.valor, 'Obrigação de compra'); add(`Obrigação de compra: ${j.curto} fica em definitivo no ${nome(e.para)} por ${fmt(ob.valor)}.`, vp ? e.para : e.de); continue; }
    if (vd && !vp && e.opcao && jogou >= 8 && media(s.est?.[id]) >= 6.6) { efetivar(base, s, j, e, e.opcao, 'Opção de compra'); add(`O ${nome(e.para)} exerce a opção e compra ${j.curto} por ${fmt(e.opcao)}.`, e.de); }
  }
}
export function desistir(s, id) { const p = s.propostas.find(x => x.id === id); if (p) p.estado = 'cancelada'; }

// ---------- movimentos ----------
const tirarDasListas = (s, id) => { s.listas.venda = s.listas.venda.filter(x => x !== id); s.listas.emprestimo = s.listas.emprestimo.filter(x => x !== id); };
// quem compra e quem vende pode ser técnico (o dinheiro vai pelo extrato dele) ou IA (caixa da IA)
export function transferir(base, s, j, para, valor, { salario, anos } = {}) {
  const de = j.clube, vp = vistaDo(s, para), vd = vistaDo(s, de);
  s.transf[j.id] = para; marcarChegada(s, j.id);
  if (vp) { if (salario) s.salarios[j.id] = salario; s.contratos[j.id] = s.ano + (anos || 3); }
  else { delete s.salarios[j.id]; s.contratos[j.id] = s.ano + (anos || 3); }
  if (vd) tirarDasListas(vd, j.id);
  aplicarSave(base, s);
  for (const v of [vp, vd]) if (v) garantirFinancas(base, v);
  if (vp && valor) { lancar(vp, 'compra', `Compra de ${j.curto} (${base.clubes[de].n})`, -valor); vp.fin.temporada.compras += valor; }
  if (vd && valor) { lancar(vd, 'venda', `Venda de ${j.curto} (${base.clubes[para].n})`, valor); vd.fin.temporada.vendas += valor; }
  mexerCaixa(base, s, para, -valor); mexerCaixa(base, s, de, valor);
  const rv = vd && valor && s.revenda?.[j.id];
  if (rv) { lancar(vd, 'revenda', `Revenda: ${rv.pct}% da venda de ${j.curto} ao ${base.clubes[rv.clube].n}`, -Math.round(valor * rv.pct / 100)); delete s.revenda[j.id]; }
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de, para, valor, tipo: ehLivre(base, de) ? 'livre' : 'compra' });
}
// empréstimo até o fim da temporada; o salário continua o mesmo e quem está com ele paga
export function emprestar(base, s, j, para, cl = null) {
  const de = j.clube, vp = vistaDo(s, para), vd = vistaDo(s, de), cheio = salarioDia(base, s, j);
  if (vp) s.salarios[j.id] = Math.round(cheio * (cl?.pct ?? 100) / 100);
  s.emprestimos[j.id] = { de, para, ate: s.ano, cheio, jogos0: s.est?.[j.id]?.[0] || 0, ...(cl ? { taxa: cl.taxa, pct: cl.pct, minimo: cl.minimo, medo: cl.medo, revenda: cl.revenda } : {}) };
  if (cl?.compra === 'opcao') s.emprestimos[j.id].opcao = cl.valorCompra;
  if (cl?.compra === 'obrigacao') s.emprestimos[j.id].obrig = { valor: cl.valorCompra, gatilho: cl.gatilho, jogos: cl.jogos };
  if (cl?.taxa && vp) lancar(vp, 'emprestimo', `Taxa de empréstimo de ${j.curto} (${base.clubes[de].n})`, -cl.taxa);
  if (cl?.taxa && vd) lancar(vd, 'emprestimo', `Taxa de empréstimo de ${j.curto} (${base.clubes[para].n})`, cl.taxa);
  if (cl?.taxa) { mexerCaixa(base, s, para, -cl.taxa); mexerCaixa(base, s, de, cl.taxa); }
  s.transf[j.id] = para; marcarChegada(s, j.id);
  if (vd) tirarDasListas(vd, j.id);
  aplicarSave(base, s);
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de, para, valor: 0, tipo: 'emprestimo' });
}

// ---------- vender e listar ----------
export function podeSair(base, s, j) {
  if (!janelaAberta(s.ano, s.rodada, s.ultimaData)) return 'A janela fechou.';
  if (semPassagem(s, j.id)) return textoPassagem(j);
  return elencoAguenta(base, s, j);
}
function elencoAguenta(base, s, j) {
  const meu = s.tecnico.clube;
  if (base.elencos[meu].length <= MINIMO_ELENCO) return `Seu elenco não pode ficar com menos de ${MINIMO_ELENCO}.`;
  if (j.pos === 'GOL' && base.elencos[meu].filter(x => x.pos === 'GOL').length <= 2) return 'Você ficaria com menos de dois goleiros.';
  return null;
}
// ---------- entre técnicos (liga online) ----------
// a proposta para o jogador de outro técnico vai para as ofertas recebidas dele: ele aceita, recusa ou pede mais
// (a contraproposta volta para quem propôs; aceita, o negócio fecha). Sem resposta em 2 rodadas, a proposta cai.
function propostaEntreTecnicos(base, s, dono, p, j, rd, add) {
  const id = `h${p.id}`, nome = c => base.clubes[c].n;
  if (j.clube !== p.de) { p.estado = 'cancelada'; p.motivo = 'ele já trocou de clube'; return; }
  garantirMercado(dono);
  const x = { id, tipo: p.tipo, jogador: j.id, de: s.tecnico.clube, valor: p.valor, salario: p.salario, anos: p.anos, troca: p.troca || 0, cl: p.cl || null, promessa: !!p.promessa, rodada: rd, humano: true, proposta: p.id };
  // multa rescisória paga: o outro técnico não tem o que fazer; só o jogador decide se vai
  if (!p.clubeOk && p.tipo === 'compra' && pagouClausula(base, s, j, s.tecnico.clube, p.valor)) {
    const e = fecharEntreTecnicos(base, dono, x);
    if (e) { p.estado = 'recusada'; p.motivo = e; add(`Multa rescisória paga, mas o negócio não saiu: ${e}.`); return; }
    add(`Multa rescisória paga: ${j.curto} aceitou e é do ${nome(s.tecnico.clube)}. O ${nome(p.de)} não tinha como segurar.`);
    enviar(dono, 'diretor', `h-multa-${id}`, `${j.curto} saiu pela multa rescisória`, `O ${nome(s.tecnico.clube)}, de ${s.tecnico.nome}, pagou a multa rescisória de ${j.curto} (${fmt(p.valor)}) e ele aceitou ir. Com a multa paga, o clube não pode recusar: o dinheiro já está no caixa.`, { jogador: j.id });
    return;
  }
  if (p.clubeOk) { const e = fecharEntreTecnicos(base, dono, x); if (e) { p.estado = 'recusada'; p.motivo = e; } return; } // contraproposta dele aceita
  if (p.enviada) { if (!dono.recebidas.some(y => y.id === id)) { p.estado = 'recusada'; p.motivo = `o técnico do ${nome(p.de)} não respondeu`; } return; }
  dono.recebidas = dono.recebidas.filter(y => y.id !== id); dono.recebidas.push(x); p.enviada = true;
  add(`Proposta enviada ao técnico do ${nome(p.de)} por ${j.curto}: já chegou para ele, que tem 2 rodadas para responder.`);
  const oferta = p.tipo === 'emprestimo' ? 'empréstimo' : `${fmt(p.valor)}${p.troca ? ` e ${base.jog.get(p.troca)?.curto} na troca` : ''}`;
  enviar(dono, 'diretor', `h-${id}`, `${s.tecnico.nome} quer ${j.curto}`, `O ${nome(s.tecnico.clube)}, de ${s.tecnico.nome}, propõe ${oferta} por ${j.curto}. Responda em Mercado › Propostas (vale por 2 rodadas).`, { jogador: j.id });
}
// fecha o negócio entre dois técnicos (quem vende é a vista vB); devolve o erro ou null
function fecharEntreTecnicos(base, vB, x) {
  const vA = vistaDo(vB, x.de), j = base.jog.get(x.jogador), pA = vA?.propostas?.find(q => q.id === x.proposta), nome = c => base.clubes[c].n;
  const cai = motivo => { if (pA) Object.assign(pA, { estado: 'recusada', motivo }); return motivo; };
  if (!vA) return 'o outro técnico não está mais na liga';
  if (j.clube !== vB.tecnico.clube) return cai('ele já trocou de clube');
  if (x.tipo !== 'emprestimo' && x.valor > vA.caixa) return cai(`o ${nome(x.de)} não tem mais esse dinheiro em caixa`);
  if (vontade(base, vB, j, x.de, x.promessa) < 35) return cai(`${j.curto} não quis ir para o ${nome(x.de)}`);
  const t = x.troca && base.jog.get(x.troca), de = j.clube;
  if (x.tipo === 'emprestimo') emprestar(base, vB, j, x.de, x.cl);
  else {
    if (t && t.clube === x.de) { transferir(base, vB, t, de, 0); vB.historicoTransf[0].tipo = 'troca'; }
    transferir(base, vB, j, x.de, x.valor, { salario: x.salario, anos: x.anos });
  }
  if (x.promessa) prometerTitular(base, vA, j);
  if (pA) Object.assign(pA, { estado: 'concluida', motivo: null });
  vB.recebidas = (vB.recebidas || []).filter(y => y.jogador !== j.id);
  vB.noticias.unshift({ rodada: vB.rodada, tipo: 'mercado', mercado: true, jogador: j.id, para: x.de, clube: x.de, div: base.clubes[x.de].div, texto: x.tipo === 'emprestimo' ? `Entre técnicos: ${j.curto} vai emprestado do ${nome(de)} para o ${nome(x.de)}.` : `HERE WE GO! Entre técnicos: ${j.curto} sai do ${nome(de)} para o ${nome(x.de)} (${fmt(x.valor)}${t ? ` + ${t.curto}` : ''}).` });
  enviar(vA, 'diretor', `h-ok-${x.id}`, `${j.curto} é seu`, `O técnico do ${nome(de)} aceitou: ${j.curto} chega${x.tipo === 'emprestimo' ? ' emprestado até o fim da temporada' : ` por ${fmt(x.valor)}`}.`, { jogador: j.id });
  return null;
}
export function aceitarRecebida(base, s, id) {
  const p = s.recebidas.find(x => x.id === id); if (!p) return 'Proposta não existe mais.';
  const j = base.jog.get(p.jogador), erro = podeSair(base, s, j);
  if (erro) return erro;
  if (p.humano) { const e = fecharEntreTecnicos(base, s, p); s.recebidas = s.recebidas.filter(x => x !== p); return e ? `O negócio caiu: ${e}.` : null; }
  if (p.vontade != null && p.vontade < 35) { s.recebidas = s.recebidas.filter(x => x !== p); return `${j.curto} não aceita ir para o ${base.clubes[p.de].n}: prefere seguir aqui. A proposta caiu.`; }
  if (p.tipo === 'emprestimo') emprestar(base, s, j, p.de, p.cl);
  else transferir(base, s, j, p.de, p.valor, { anos: 3 });
  s.recebidas = s.recebidas.filter(x => x.jogador !== p.jogador);
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, div: base.clubes[s.tecnico.clube].div, texto: p.tipo === 'emprestimo' ? `Emprestado: ${j.curto} vai jogar no ${base.clubes[p.de].n} até o fim da temporada.` : `Vendido: ${j.curto} acerta com o ${base.clubes[p.de].n} por ${fmt(p.valor)}.` });
  return null;
}
export function recusarRecebida(base, s, id) {
  const p = s.recebidas.find(x => x.id === id); if (!p) return null;
  const j = base.jog.get(p.jogador);
  if (p.humano) {
    const vA = vistaDo(s, p.de), pA = vA?.propostas?.find(q => q.id === p.proposta);
    s.recebidas = s.recebidas.filter(x => x !== p);
    if (pA) Object.assign(pA, { estado: 'recusada', motivo: `o técnico do ${base.clubes[s.tecnico.clube].n} recusou` });
    if (vA) enviar(vA, 'diretor', `h-nao-${p.id}`, `Recusado: ${j?.curto}`, `O técnico do ${base.clubes[s.tecnico.clube].n} recusou a sua proposta por ${j?.curto}.`, { jogador: p.jogador });
    return null;
  }
  if (p.tipo !== 'emprestimo' && j && p.quer && pagouClausula(base, s, j, p.de, p.valor)) return `O ${base.clubes[p.de].n} pagou a multa rescisória e ${j.curto} quer ir: o clube não pode segurar.`;
  s.recebidas = s.recebidas.filter(x => x.id !== id);
  return p.quer ? barrarSaida(base, s, p) : null;
}
// ele queria ir e o clube segurou: fica chateado, pode pedir pra sair e não quer renovar por um tempo
function barrarSaida(base, s, p) {
  const j = base.jog.get(p.jogador); if (!j) return null;
  s.mor[j.id] = Math.max(0, (s.mor[j.id] ?? 62) - (faseDe(s, j.id).d > 0 ? 15 : 10)); tratar(s, j.id, -2);
  (s.querSair ||= {})[j.id] = { ...s.querSair[j.id], de: p.de, rodada: s.rodada, motivo: p.quer }; // o rebaixado segue com a ameaça de rescindir
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', imprensa: true, jogador: j.id, div: base.clubes[s.tecnico.clube].div, texto: `${j.curto} fica chateado por não ser liberado para o ${base.clubes[p.de].n}.` });
  return `${j.curto} queria ir e ficou chateado (moral em baixa).`;
}
// a proposta é de um clube maior? (divisão acima, copa continental que o seu não joga, ou bem mais forte)
const naContinental = (s, ci) => !!emQualCont(s, ci);
export function querIr(base, s, j, de) {
  const meu = s.tecnico.clube, a = base.clubes[de], b = base.clubes[meu];
  if (nivelDiv(a) < nivelDiv(b)) return a.div === 'X' ? 'sonha em jogar fora do país' : `é a chance de jogar a Série ${a.div}`;
  if (naContinental(s, de) && !naContinental(s, meu)) return `quer disputar a ${emQualCont(s, de) === 'LIB' ? 'Libertadores' : 'Sul-Americana'}`;
  if (base.forca(de) >= base.forca(meu) + 5) return 'quer jogar num clube maior';
  return null;
}

// contraproposta numa oferta recebida (uma por oferta) e leilão (até 3 clubes cobrem, teto de 190% do valor)
const recebida = (s, id) => s.recebidas.find(x => x.id === id && x.tipo !== 'emprestimo');
export function pedirMais(base, s, id, fator) {
  const x = recebida(s, id); if (!x) return 'Proposta não existe mais.';
  if (x.contraFeita || x.leilao) return 'Essa negociação já teve contraproposta ou leilão.';
  if (x.humano) { // contraproposta para o outro técnico: aceitando, o negócio fecha
    const vA = vistaDo(s, x.de), pA = vA?.propostas?.find(q => q.id === x.proposta), j = base.jog.get(x.jogador);
    if (!pA) return 'A proposta dele não existe mais.';
    const pedido = arred(Math.max(x.valor, 50000) * clamp(+fator || 1.15, 1.05, 2));
    Object.assign(pA, { estado: 'contraproposta', contra: pedido, enviada: false });
    s.recebidas = s.recebidas.filter(y => y !== x);
    enviar(vA, 'diretor', `h-contra-${x.id}`, `Contraproposta por ${j.curto}`, `O técnico do ${base.clubes[s.tecnico.clube].n} pede ${fmt(pedido)} por ${j.curto}. Aceitando em Mercado › Propostas, o negócio fecha.`, { jogador: j.id });
    return null;
  }
  Object.assign(x, { pedido: arred(x.valor * clamp(+fator || 1.15, 1.05, 2)), contraFeita: true, rodada: s.rodada });
  return null;
}
export function abrirLeilao(base, s, id) {
  const x = recebida(s, id); if (!x) return 'Proposta não existe mais.';
  if (x.humano) return 'Proposta de outro técnico não vai a leilão.';
  if (x.contraFeita || x.leilao) return 'Essa negociação já teve contraproposta ou leilão.';
  Object.assign(x, { leilao: 'aberto', rodada: s.rodada });
  return null;
}

// empréstimo com opção de compra; chamar de volta quem você emprestou; rescindir pagando metade do que falta do contrato
export function exercerOpcao(base, s, id) {
  const j = base.jog.get(+id), e = s.emprestimos[+id], meu = s.tecnico.clube;
  if (!j || !e || e.para !== meu || !e.opcao) return 'Não há opção de compra para ele.';
  if (e.opcao > s.caixa) return 'Não tem dinheiro em caixa para isso.';
  efetivar(base, s, j, e, e.opcao, 'Opção de compra');
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, jogador: j.id, div: base.clubes[meu].div, texto: `Opção exercida: ${j.curto} fica em definitivo no ${base.clubes[meu].n} por ${fmt(e.opcao)}.` });
  return null;
}
export const reembolso = j => arred(j.valor * 1000 * 0.1);
export function chamarDeVolta(base, s, id) {
  const j = base.jog.get(+id), e = s.emprestimos[+id], meu = s.tecnico.clube;
  if (!j || !e || e.de !== meu) return 'Ele não está emprestado por você.';
  if (!janelaAberta(s.ano, s.rodada, s.ultimaData)) return 'Só dá para chamar de volta com a janela aberta.';
  if (base.elencos[meu].length >= LIMITE_ELENCO) return `Elenco cheio (${LIMITE_ELENCO}).`;
  const v = reembolso(j); if (v > s.caixa) return 'Não tem dinheiro em caixa para o reembolso.';
  delete s.emprestimos[j.id];
  if (j.clubeOrig === meu) delete s.transf[j.id]; else s.transf[j.id] = meu;
  lancar(s, 'reembolso', `Reembolso ao ${base.clubes[e.para].n} pela volta de ${j.curto}`, -v);
  aplicarSave(base, s);
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de: e.para, para: meu, valor: v, tipo: 'volta' });
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, jogador: j.id, div: base.clubes[meu].div, texto: `${j.curto} volta antes do fim do empréstimo ao ${base.clubes[e.para].n}. O clube paga ${fmt(v)} de reembolso.` });
  return null;
}
// cláusula compensatória (Lei Geral do Esporte, art. 86): o clube que dispensa paga todos os salários até o fim do
// contrato, no máximo 400 salários mensais. Distrato (acordo) sai por 60%, mas só se ele aceitar: veterano, reserva,
// quem quer sair ou anda insatisfeito.
const salarioMes = (base, s, j) => salarioDia(base, s, j) * 30.44;
export const multaRescisao = (base, s, j) => Math.round(Math.min(salarioDia(base, s, j) * (diasRestantes(s) + 365 * Math.max(0, j.contrato - s.ano)), 400 * salarioMes(base, s, j)) / 1000) * 1000;
export const valorDistrato = (base, s, j) => Math.round(multaRescisao(base, s, j) * 0.6 / 1000) * 1000;
export function recusaDistrato(base, s, j) {
  const rank = base.elencos[s.tecnico.clube].slice().sort((a, b) => b.ovr - a.ovr).indexOf(j), jogos = s.est?.[j.id]?.[0] || 0;
  const reserva = rank >= 18 || (s.rodada >= 5 && jogos < 0.2 * s.rodada);
  return j.idade >= 31 || reserva || s.querSair?.[j.id] || (s.mor[j.id] ?? 62) < 45 ? null : `${j.curto} não aceita o distrato: joga, está bem e quer receber o contrato até o fim.`;
}
export function rescindir(base, s, id, acordo = false) {
  const j = base.jog.get(+id), meu = s.tecnico.clube;
  if (!j || j.clube !== meu) return 'Só dá para rescindir com jogador seu.';
  if (s.emprestimos[j.id]) return 'Ele está emprestado ao seu clube.';
  const e = elencoAguenta(base, s, j); if (e) return e;
  if (acordo) { const nao = recusaDistrato(base, s, j); if (nao) return nao; }
  const v = acordo ? valorDistrato(base, s, j) : multaRescisao(base, s, j); if (v > s.caixa) return `${acordo ? 'O distrato' : 'A multa'} (${fmt(v)}) passa do que tem em caixa.`;
  lancar(s, 'rescisao', `${acordo ? 'Distrato' : 'Rescisão'} de ${j.curto}`, -v);
  liberar(base, s, j, v);
  s.noticias.unshift({ rodada: s.rodada, tipo: 'clube', mercado: true, jogador: j.id, div: base.clubes[meu].div, texto: acordo ? `Distrato: ${j.curto} e o ${base.clubes[meu].n} se acertam e ele sai por ${fmt(v)}.` : `Rescisão: ${j.curto} deixa o ${base.clubes[meu].n}. O clube pagou ${fmt(v)}, o resto do contrato.` });
  return null;
}

// cláusula indenizatória (multa rescisória, art. 86): quem paga leva o jogador sem o clube poder recusar; só ele
// decide. Para clube daqui, até 2.000 salários mensais (na A, 2 a 4 vezes o valor; na B e na C, 1,5 a 3); para o
// exterior não há limite (3 a 5 vezes o valor até 23 anos, 1,8 a 3 depois). Sorteio fixo por contrato.
export function clausula(base, s, j) {
  const d = base.clubes[j.clube].div;
  if (!BR.includes(d)) return null;
  const m = s.multas?.[j.id]; if (m && m.clube === j.clube) return { nac: m.nac, int: Math.max(m.nac, m.int), minha: true }; // definida pelo técnico do clube
  const r = rng(`cid${j.id}-${j.contrato}`), a = r(), b = r(), v = (j.valor || 30) * 1000;
  const nac = arred(Math.min(2000 * salarioMes(base, s, j), v * (d === 'A' ? 2 + a * 2 : 1.5 + a * 1.5)));
  return { nac, int: Math.max(nac, arred(v * (j.idade <= 23 ? 3 + b * 2 : 1.8 + b * 1.2))) };
}
// o técnico muda a multa dos seus jogadores: a nacional respeita o teto da lei (2.000 salários mensais) e a do exterior não pode ser menor
export function definirMulta(base, s, j, nac, int) {
  if (j.clube !== s.tecnico.clube || !BR.includes(base.clubes[j.clube].div)) return { ok: false, txt: 'Só dá para mexer na multa de jogador do seu clube.' };
  const mes = salarioMes(base, s, j), teto = Math.round(2000 * mes / 10000) * 10000;
  if (!(nac > 0) || !(int > 0)) return { ok: false, txt: 'Informe os dois valores da multa.' };
  if (nac < mes) return { ok: false, txt: `A multa nacional não pode ser menor que um salário mensal (${fmt(Math.round(mes))}).` };
  if (nac > teto) return { ok: false, txt: `A lei limita a multa para clube daqui a 2.000 salários mensais (${fmt(teto)} para ${j.curto}).` };
  if (int < nac) return { ok: false, txt: 'A multa do exterior não pode ser menor que a nacional.' };
  (s.multas ||= {})[j.id] = { clube: j.clube, nac: Math.round(nac / 10000) * 10000, int: Math.round(int / 10000) * 10000 };
  return { ok: true, txt: `Multa de ${j.curto} agora é ${fmt(s.multas[j.id].nac)} (exterior ${fmt(s.multas[j.id].int)}).` };
}
const pagouClausula = (base, s, j, comprador, valor) => { const c = clausula(base, s, j); return !!c && valor >= (base.clubes[comprador].div === 'X' ? c.int : c.nac); };

// jogador do seu clube vira livre (rescisão paga ou ganha na Justiça)
export function liberar(base, s, j, valor = 0) {
  const meu = s.tecnico.clube, livres = base.clubes.findIndex(c => c.div === 'L');
  s.transf[j.id] = livres; delete s.salarios[j.id]; delete s.contratos[j.id]; tirarDasListas(s, j.id);
  s.recebidas = s.recebidas.filter(x => x.jogador !== j.id); delete s.querSair?.[j.id];
  aplicarSave(base, s);
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de: meu, para: livres, valor, tipo: 'rescisao' });
}
export const mauPagador = s => s.fin?.mauPagador != null && s.ano - s.fin.mauPagador <= 1;

// acordos fechados com a janela fechada: o jogador (e quem foi na troca) se muda quando ela abre
export function cumprirAcordos(base, s, add) {
  const meu = s.tecnico.clube;
  for (const a of (s.acordos || []).splice(0)) {
    const j = base.jog.get(a.jogador), t = a.troca && base.jog.get(a.troca);
    if (!j || j.clube !== a.de || (t && t.clube !== meu)) { add(`O acordo por ${j?.curto || 'um reforço'} caiu: a situação mudou antes de a janela abrir.`); continue; }
    if (a.promessa) prometerTitular(base, s, j);
    if (a.tipo === 'emprestimo') { emprestar(base, s, j, meu, a.cl); add(`Chegou: ${j.curto}, emprestado pelo ${base.clubes[a.de].n} (acertado com a janela fechada).`); continue; }
    if (t) { transferir(base, s, t, a.de, 0); s.historicoTransf[0].tipo = 'troca'; }
    transferir(base, s, j, meu, a.valor, { salario: a.salario, anos: a.anos });
    add(`Chegou: ${j.curto}, acertado com o ${base.clubes[a.de].n} com a janela fechada.`);
  }
}

export function alternarLista(base, s, lista, id) {
  const j = base.jog.get(id);
  if (!j || j.clube !== s.tecnico.clube) return 'Só dá para listar jogador seu.';
  if (s.emprestimos[id]) return 'Ele está emprestado ao seu clube.';
  if (semPassagem(s, id) && !s.listas[lista].includes(id)) return textoPassagem(j);
  const l = s.listas[lista], i = l.indexOf(id);
  if (i >= 0) { l.splice(i, 1); return null; }
  s.listas[lista === 'venda' ? 'emprestimo' : 'venda'] = s.listas[lista === 'venda' ? 'emprestimo' : 'venda'].filter(x => x !== id);
  l.push(id);
  return null;
}
export function alternarFavorito(s, id) { const i = s.favoritos.indexOf(id); if (i >= 0) s.favoritos.splice(i, 1); else s.favoritos.unshift(id); }

// ---------- renovação ----------
// quer ficar? Minutos, temperamento, como o técnico trata (s.trato), moral, quem está interessado, fase, idade e
// se já pediu pra sair. Abaixo de 32 vira novela: não renova por nada e o clube decide se vende ou perde de graça.
const MOTIVO_NOV = { minutos: 'joga pouco', trato: 'não gosta de como é tratado', maior: 'quer um clube maior', sair: 'já pediu pra sair', moral: 'anda insatisfeito' };
export function vontadeRenovar(base, s, j) {
  const ci = s.tecnico.clube, el = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr), rank = el.indexOf(j), t = temperamento(j);
  const jogosClube = base.clubes[ci] && s.res ? Object.keys(s.res[base.clubes[ci].div] || {}).filter(k => k.split('-').map(Number).includes(ci)).length : 0;
  const pct = (s.est?.[j.id]?.[0] || 0) / Math.max(1, jogosClube), maior = interessados(base, j, s).some(c => nivelDiv(base.clubes[c]) < nivelDiv(base.clubes[ci]) || base.forca(c) >= base.forca(ci) + 4);
  const p = {
    minutos: jogosClube >= 6 && rank < 16 && pct < 0.35 ? -18 : pct > 0.7 ? 8 : 0,
    trato: (s.trato?.[j.id] || 0) * 3,
    moral: ((s.mor?.[j.id] ?? 62) - 62) * 0.5,
    maior: maior ? (t === 'ambicioso' ? -18 : -10) - (faseDe(s, j.id).d > 0 && j.idade <= 29 ? 6 : 0) : 0,
    sair: s.querSair?.[j.id] ? -30 : 0,
  };
  const v = 58 + Object.values(p).reduce((a, b) => a + b, 0) + { ambicioso: -6, temperamental: -4, sensivel: 0, profissional: 6 }[t] + (j.idade >= 31 ? 12 : 0) + (rank >= 18 ? 6 : 0) + (rng(`nov${s.seed}${s.ano}${j.id}`)() - 0.5) * 16;
  const pior = Object.entries(p).sort((a, b) => a[1] - b[1])[0];
  return { v: clamp(Math.round(v), 0, 100), motivo: pior[1] < 0 ? MOTIVO_NOV[pior[0]] : 'não se sente valorizado' };
}
export const emNovela = (s, id) => s.novela?.[id]?.ano === s.ano;
export function renovacaoPossivel(s, j) { return !preContratoDe(s, j.id) && !s.emprestimos[j.id]; } // qualquer jogador do elenco, em qualquer fase do contrato
export function pedidoRenovacao(base, s, j, anos = 3) {
  const ficar = emNovela(s, j.id) ? 0 : vontadeRenovar(base, s, j).v;
  let pede = Math.max(salarioDia(base, s, j), salarioBase(base.clubes[j.clube], j)) * (1.05 + clamp((60 - ficar) / 100, -0.1, 0.5));
  if (j.idade >= 30) pede *= 1 + 0.06 * Math.max(0, 3 - anos);
  return { ficar, pede: arredSal(pede) };
}
export function renovar(base, s, j, salario, anos) {
  if (j.clube !== s.tecnico.clube || !renovacaoPossivel(s, j)) return { ok: false, txt: 'Não dá para renovar com ele agora.' };
  if (!(anos >= 1 && anos <= 5)) return { ok: false, txt: 'Contrato de 1 a 5 anos.' };
  if (s.ano + anos < j.contrato) return { ok: false, txt: `${j.curto} já tem contrato até ${j.contrato}: escolha ${j.contrato - s.ano} anos ou mais.` };
  const { ficar, pede } = pedidoRenovacao(base, s, j, anos);
  if (emNovela(s, j.id)) return { ok: false, txt: `${j.curto} não quer saber de renovar (${s.novela[j.id].motivo}). A novela segue: venda enquanto dá ou ele sai de graça.` };
  if (ficar < 30) return { ok: false, txt: `${j.curto} não quer renovar. Está insatisfeito no clube.` };
  if (salario - salarioDia(base, s, j) > orcamento(base, s).folga) return { ok: false, txt: 'O aumento não cabe na folga da folha. Abra espaço em Finanças.' };
  const teto = passaDoTeto(base, s, salario, salarioDia(base, s, j)); if (teto) return { ok: false, txt: teto };
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

// ---------- rebaixados ----------
// Na virada, os 2 ou 3 melhores de quem caiu (entre os 8 melhores do elenco), com perfil para isso (ambicioso,
// temperamental ou bom demais para a nova divisão), pedem para sair e ameaçam rescindir: se não forem vendidos até a
// janela fechar, saem pagando uma multa de 40% a 60% do valor de mercado. Nos clubes da IA que caíram, eles vão à
// venda mais baratos (preço pedido -30%) e quem sobrar rescinde do mesmo jeito.
export function pedidosDeQueda(base, s, caidos) {
  const r = rng(`queda${s.seed}-${s.ano}`), N = [];
  const nivel = d => { const cs = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d); return cs.reduce((a, ci) => a + base.forca(ci), 0) / Math.max(1, cs.length); };
  for (const ci of caidos) {
    const div = base.clubes[ci].div, acima = nivel(div) + 5;
    const quem = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).slice(0, 8)
      .filter(j => j.idade <= 32 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && (['ambicioso', 'temperamental'].includes(temperamento(j)) || j.ovr >= acima))
      .slice(0, r() < 0.5 ? 2 : 3);
    for (const j of quem) {
      const multa = arred(j.valor * 1000 * (0.4 + r() * 0.2));
      if (ehHumano(s, ci)) {
        (s.querSair ||= {})[j.id] = { de: null, rodada: s.rodada, motivo: `não quer jogar a Série ${div}`, queda: { ano: s.ano, multa, div } };
        s.mor[j.id] = Math.min(s.mor[j.id] ?? 62, 45);
        N.push(`${j.curto} não quer jogar a Série ${div}: pede para ser negociado e ameaça rescindir se não sair nesta janela.`);
      } else {
        (s.quedaIA ||= {})[j.id] = { ano: s.ano, de: ci, multa };
        if (j === quem[0]) N.push(`Depois da queda, ${j.curto} pede para deixar o ${base.clubes[ci].n}. O clube aceita vender mais barato.`);
      }
    }
  }
  base._listas = null;
  return N;
}
// a janela fechou e ninguém comprou: ele rescinde e paga a multa reduzida ao clube
function rescisaoDaQueda(base, s, j, multa, add) {
  const meu = s.tecnico.clube, nome = base.clubes[meu].n;
  garantirFinancas(base, s);
  lancar(s, 'venda', `Rescisão de ${j.curto}: multa paga ao clube`, multa); s.fin.temporada.vendas += multa;
  liberar(base, s, j, multa);
  add(`${j.curto} cumpre a ameaça: rescinde com o ${nome}, paga ${fmt(multa)} de multa e está livre no mercado.`, 'clube', base.clubes[meu].div, { jogador: j.id, imprensa: true });
  enviar(s, 'diretor', `queda-resc-${j.id}-${s.ano}`, `${j.curto} rescindiu`, `A janela fechou sem proposta que servisse e ${j.curto} cumpriu o que disse: rescindiu e pagou ${fmt(multa)} de multa. É menos do que ele vale (${fmt(j.valor * 1000)}), mas ao menos entrou alguma coisa no caixa.`, { jogador: j.id });
}
// clubes da IA rebaixados: interessados levam pelo preço de liquidação; fechada a janela, quem sobrou rescinde
function rebaixadosIA(base, s, rd, r, aberta, add) {
  const livres = base.clubes.findIndex(c => c.div === 'L');
  for (const [id, q] of Object.entries(s.quedaIA || {})) {
    const j = base.jog.get(+id);
    if (!j || q.ano !== s.ano || j.clube !== q.de) { delete s.quedaIA[id]; continue; }
    if (aberta) {
      if (r() > 0.2) continue;
      const ops = interessados(base, j, s).filter(ci => !ehHumano(s, ci) && base.elencos[ci].length < 38 && vontade(base, s, j, ci) >= 45);
      const para = ops.length ? pickW(r, ops, ci => base.clubes[ci].fan) : null, valor = para == null ? 0 : precoPedido(base, s, j, para);
      if (para == null || caixaDe(base, s, para) * (base.clubes[para].div === 'X' ? 3 : 0.6) < valor) continue;
      transferir(base, s, j, para, valor); s.historicoTransf[0].ia = true; delete s.quedaIA[id];
      add(`Depois da queda, o ${base.clubes[q.de].n} perde ${j.curto}: ele acerta com o ${base.clubes[para].n} por ${fmt(valor)}.`, 'mercado', base.clubes[para].div, { jogador: j.id });
    } else {
      s.transf[j.id] = livres; delete s.contratos[j.id]; mexerCaixa(base, s, q.de, q.multa); aplicarSave(base, s); delete s.quedaIA[id];
      s.historicoTransf.unshift({ rodada: rd, jogador: j.id, nome: j.curto, de: q.de, para: livres, valor: q.multa, tipo: 'rescisao', ia: true });
      add(`${j.curto} rescinde com o ${base.clubes[q.de].n}, paga ${fmt(q.multa)} de multa e está livre no mercado.`, 'mercado', base.clubes[q.de].div, { jogador: j.id });
    }
  }
}

// ---------- IA ----------
// proposta de gigante: o valor acompanha a fase; árabe paga 3 a 4 vezes o salário (europeu, 1,5 a 2,2);
// a vontade dele pesa salário, idade, temperamento, como está no clube e o sonho europeu
export function gigante(base, s, j, de, arabe, r) {
  const f = faseDe(s, j.id), atual = salarioDia(base, s, j);
  const valor = arred(precoExterior(base, s, j, r, de) * 1.1);   // gigante paga um pouco acima do mercado
  const mult = Math.round((arabe ? 3 + r() + (f.k === 'excelente' ? 0.3 : 0) : 1.5 + r() * 0.7) * 10) / 10;
  const t = temperamento(j), mor = s.mor[j.id] ?? 62;
  let v = 40 + (mult - 1) * 9 + (arabe ? (j.idade >= 30 ? 15 : j.idade <= 24 ? -20 : 0) : 25 + (j.idade <= 27 ? 8 : j.idade >= 31 ? -12 : 0));
  v += { ambicioso: 10, sensivel: -6, temperamental: 0, profissional: 0 }[t] + (s.querSair?.[j.id] ? 15 : 0) + (mor < 45 ? 10 : mor >= 75 ? -10 : 0) + (naContinental(s, s.tecnico.clube) ? -5 : 0);
  v = clamp(Math.round(v + (r() - 0.5) * 10), 0, 100);
  return { valor, mult, salario: Math.round(atual * mult / 10) * 10, vontade: v, quer: v >= 60 ? (arabe ? `não resiste a ganhar ${mult.toFixed(1).replace('.', ',')}x mais na Arábia` : 'sonha em jogar na Europa') : null };
}
export const textoVontade = v => v >= 75 ? 'está decidido a ir' : v >= 60 ? 'quer ir' : v >= 45 ? 'está balançado' : v >= 35 ? 'prefere ficar, mas ouviria' : 'não quer ir de jeito nenhum';
// para onde o Brasil vende (valor de 2025): Inglaterra 38%, Rússia 17%, Portugal 11%, Itália 7%, Arábia e Espanha 6%
const DESTINO = { 'Premier League': 3, 'Premier Liga (RUS)': 4, 'Liga Portugal': 2, 'Serie A (ITA)': 1.2, LaLiga: 0.9, 'Premier Liga (UCR)': 2, MLS: 1, 'Liga MX': 0.6, Bundesliga: 0.45, 'Ligue 1': 0.45, Eredivisie: 0.5, 'Süper Lig': 0.3, 'Pro League (BEL)': 0.35, 'Saudi Pro League': 1 };
const GIGANTE = c => c.div === 'X' && ((c.tier >= 5 && c.fan >= 9) || (c.liga === 'Saudi Pro League' && c.fan >= 6));
const POS_CHAVE = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'CA'];
function vendedorAguenta(base, s, j) {
  if (ehLivre(base, j.clube)) return true;
  const el = base.elencos[j.clube];
  return !ehHumano(s, j.clube) && el.length > 19 && !(j.pos === 'GOL' && el.filter(x => x.pos === 'GOL').length <= 2) && !recente(s, j.id) && !emAcordo(s, j.id);
}
// clubes da IA também compram: reforçam a posição mais fraca e o exterior leva destaques
// contrato dos negócios da IA, como no Brasil de hoje (CBF 2026: média de 22 meses na A, 19 na B, 11 na C): o número
// é quantas viradas ele fica além desta (0 = acaba em dezembro). Compra cara é longa; de fora, 2 a 4 anos.
const anosIA = (div, idade, valor, r) => {
  const x = r();
  if (div === 'X') return 2 + Math.floor(x * 3);
  if (valor >= 1e6) return 1 + Math.floor(x * 3);
  if (idade >= 31) return x < 0.7 ? 0 : 1;
  return div === 'A' ? (x < 0.2 ? 0 : x < 0.8 ? 1 : 2) : div === 'B' ? (x < 0.45 ? 0 : x < 0.95 ? 1 : 2) : (x < 0.85 ? 0 : 1);
};
// elenco alvo e mínimo por posição dos clubes da IA
const ALVO = { A: 32, B: 30, C: 28 }, MIN_POS = { GOL: 3, ZAG: 4, LD: 2, LE: 2, VOL: 2, MC: 2, MEI: 1, PE: 1, PD: 1, CA: 2 };
function negociosIA(base, s, rd, r, add) {
  // mexe direto nos elencos (sem refazer a base inteira a cada negócio); no fim, um aplicarSave acerta tudo
  const nome = ci => base.clubes[ci].n, ia = ci => !ehHumano(s, ci), mover = (j, para, valor, emp = null) => {
    const de = j.clube;
    if (emp) s.emprestimos[j.id] = { de, para, ate: s.ano, cheio: salarioDia(base, s, j), jogos0: s.est?.[j.id]?.[0] || 0, ia: true };
    else j.contrato = s.contratos[j.id] = s.ano + anosIA(base.clubes[para].div, j.idade, valor, r);
    s.transf[j.id] = para; marcarChegada(s, j.id);
    mexerCaixa(base, s, para, -valor); mexerCaixa(base, s, de, valor);
    const a = base.elencos[de], i = a.indexOf(j); if (i >= 0) a.splice(i, 1);
    base.elencos[para].push(j); j.clube = para; base._forca = null; base._tatica = null;
    s.historicoTransf.unshift({ rodada: rd, jogador: j.id, nome: j.curto, de, para, valor, tipo: emp ? 'emprestimo' : ehLivre(base, de) ? 'livre' : 'compra', ia: true });
    return de;
  };
  montarElencos(base, s, rd, r, add, mover);
  for (const ci of base.clubes.map((c, i) => i).filter(i => BR.includes(base.clubes[i].div) && !ehHumano(s, i))) {
    if (r() > (base.clubes[ci].div === 'A' ? 0.14 : 0.09) || base.elencos[ci].length >= 38) continue;
    const el = base.elencos[ci], f = base.forca(ci), melhorNa = p => el.filter(x => x.pos === p).reduce((m, x) => Math.max(m, x.ovr), 0);
    const pos = POS_CHAVE.slice().sort((a, b) => melhorNa(a) - melhorNa(b))[0], min = melhorNa(pos) + 2, caixa = caixaDe(base, s, ci) * 0.7;
    const cands = [...base.jog.values()].filter(j => j.pos === pos && j.clube !== ci && j.ovr >= min && j.ovr <= f + 5 && !s.emprestimos[j.id] && !preContratoDe(s, j.id)
      && vendedorAguenta(base, s, j) && !naoJogaA(base, s, j.id, ci) && (ehLivre(base, j.clube) || base.elencos[j.clube].length > 28) && precoPedido(base, s, j, ci) <= caixa && vontade(base, s, j, ci) >= 50 && (!rivais(base, j.clube, ci) || r() < 0.03));
    if (!cands.length) continue;
    const j = pickW(r, cands, x => x.ovr - min + 1), valor = precoPedido(base, s, j, ci), de = mover(j, ci, valor);
    add(ehLivre(base, de) ? `Mercado: ${nome(ci)} contrata ${j.curto}, que estava sem clube.` : `${valor >= 5e6 ? 'HERE WE GO! ' : 'Mercado: '}${j.curto} deixa o ${nome(de)} e acerta com o ${nome(ci)} por ${fmt(valor)}.`, 'mercado', base.clubes[ci].div, { jogador: j.id });
  }
  // reforço de peso: clube da A com verba vai atrás de um titular melhor que a média do time, daqui ou de fora (Paquetá,
  // Gerson, Vitor Roque, Arias...). É onde está a maior parte do dinheiro que os grandes gastam.
  for (const ci of base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'A' && ia(i))) {
    const caixa = caixaDe(base, s, ci);
    if (caixa < 6e6 || r() > 0.12 || base.elencos[ci].length >= 36) continue;
    const f = base.forca(ci), el = base.elencos[ci];
    const cands = [...base.jog.values()].filter(j => j.clube !== ci && j.ovr >= f + 1 && j.ovr <= f + 9 && j.idade <= 30 && !s.emprestimos[j.id] && !preContratoDe(s, j.id)
      && (base.clubes[j.clube].div === 'X' ? !recente(s, j.id) : vendedorAguenta(base, s, j)) && el.filter(x => x.pos === j.pos && x.ovr >= j.ovr).length < 1
      && !naoJogaA(base, s, j.id, ci) && !rivais(base, j.clube, ci) && precoPedido(base, s, j, ci) <= caixa * 0.8 && vontade(base, s, j, ci) >= 50);
    if (!cands.length) continue;
    const j = pickW(r, cands, x => (x.ovr - f) * (x.nat === 'BRA' ? 2 : 1)), valor = precoPedido(base, s, j, ci), de = mover(j, ci, valor);
    add(`${valor >= 5e6 ? 'HERE WE GO! ' : 'Mercado: '}${j.curto} deixa o ${nome(de)} e acerta com o ${nome(ci)} por ${fmt(valor)}.`, 'mercado', base.clubes[ci].div, { jogador: j.id });
  }
  // quem está em fase boa num clube menor é disputado pelos maiores
  let quentes = 0;
  for (const j of shuffle(r, [...base.jog.values()].filter(j => BR.includes(base.clubes[j.clube].div) && ia(j.clube) && faseDe(s, j.id).d > 0 && vendedorAguenta(base, s, j) && !preContratoDe(s, j.id) && !s.emprestimos[j.id]))) {
    if (quentes >= 2) break;
    if (r() > (faseDe(s, j.id).k === 'excelente' ? 0.12 : 0.05)) continue;
    const ops = interessados(base, j, s).filter(ci => ia(ci) && base.elencos[ci].length < 38 && vontade(base, s, j, ci) >= 45);
    if (!ops.length) continue;
    const para = pickW(r, ops, ci => base.clubes[ci].fan), valor = base.clubes[para].div === 'X' ? precoExterior(base, s, j, r, para) : arred(precoPedido(base, s, j, para) * (1 + r() * 0.2));
    if (caixaDe(base, s, para) * (base.clubes[para].div === 'X' ? 3 : 0.6) < valor) continue;
    const de = mover(j, para, valor); quentes++;
    add(`${valor >= 5e6 ? 'HERE WE GO! Em' : 'Mercado: em'} grande fase, ${j.curto} deixa o ${nome(de)} e acerta com o ${nome(para)} por ${fmt(valor)}.`, 'mercado', base.clubes[de].div, { jogador: j.id });
  }
  // vendas para fora: todo clube daqui vende de vez em quando, de preferência o garoto de potencial (A ~2 a 3 por ano,
  // B ~1, C quase nunca). Potencial 80+ vai para liga forte; o resto para MLS, México, Argentina, Portugal, Bélgica...
  // Veterano de nível (27+, 76+) às vezes vai para a Arábia. Quem vendeu repõe com um livre da posição, se houver.
  const fora = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === 'X'), livres = base.elencos[base.clubes.findIndex(c => c.div === 'L')] || [];
  // metade do dinheiro que o Brasil fez exportando em 2015-25 veio de garotos de até 20 anos (CIES)
  const pesoIdade = i => i <= 20 ? 8 : i <= 23 ? 3 : i <= 26 ? 1 : 0.3;
  for (const ci of base.clubes.map((c, i) => i).filter(i => BR.includes(base.clubes[i].div) && !ehHumano(s, i))) {
    if (r() > { A: 0.16, B: 0.06, C: 0.015 }[base.clubes[ci].div] || base.elencos[ci].length <= 24) continue;
    const cands = base.elencos[ci].filter(j => j.idade <= 31 && j.pot >= 66 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && vendedorAguenta(base, s, j));
    if (!cands.length) continue;
    const j = pickW(r, cands, x => Math.max(0.2, x.pot - 65) * pesoIdade(x.idade)), arabia = j.idade >= 27 && j.ovr >= 76 && r() < 0.5;
    const ops = fora.filter(c => {
      const k = base.clubes[c], saudita = k.liga === 'Saudi Pro League';
      if (arabia !== saudita || base.elencos[c].length >= 40 || rivais(base, c, ci)) return false;
      return (arabia || (j.pot >= 80 ? k.tier >= 3 : k.tier <= 3)) && j.ovr >= base.forca(c) - (j.idade <= 20 ? 18 : j.idade <= 21 ? 14 : 6);
    });
    if (!ops.length) continue;
    const para = pickW(r, ops, c => base.clubes[c].fan * (DESTINO[base.clubes[c].liga] ?? 0.5)), valor = precoExterior(base, s, j, r, para);
    if (caixaDe(base, s, para) * 3 < valor) continue;
    mover(j, para, valor);
    add(`${valor >= 5e6 ? 'HERE WE GO! ' : ''}Venda para o exterior: ${j.curto} (${j.idade} anos) troca o ${nome(ci)} pelo ${nome(para)} (${base.clubes[para].liga}) por ${fmt(valor)}.`, 'mercado', base.clubes[ci].div, { jogador: j.id });
    const rep = livres.filter(x => x.pos === j.pos && x.ovr >= base.forca(ci) - 10 && x.ovr <= base.forca(ci) + 3).sort((a, b) => b.ovr - a.ovr)[0];
    if (rep) { mover(rep, ci, 0); add(`Para o lugar de ${j.curto}, o ${nome(ci)} contrata ${rep.curto}, que estava sem clube.`, 'mercado', base.clubes[ci].div, { jogador: rep.id }); }
  }
  // repatriação: brasileiro lá fora volta para clube daqui que precisa da posição. As compras mais caras do Brasil em
  // 2025-26 foram assim (Paquetá, Gerson, Danilo, Samuel Lino, Wendel): 24 a 29 anos, € 15-40 mi, por quem tem verba.
  // O veterano (29+) sai mais barato.
  for (let k = 0; k < 3; k++) {
    if (r() > 0.4) continue;
    const volta = [...base.jog.values()].filter(j => j.nat === 'BRA' && base.clubes[j.clube].div === 'X' && j.idade >= 23 && j.idade <= 34 && j.ovr >= 68 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && !recente(s, j.id));
    const j = volta.length ? pickW(r, volta, x => x.idade <= 29 ? 3 : x.idade - 27) : null;
    const ops = j ? base.clubes.map((c, i) => i).filter(ci => ['A', 'B'].includes(base.clubes[ci].div) && ia(ci) && base.elencos[ci].length < 36
      && j.ovr >= base.forca(ci) - 2 && j.ovr <= base.forca(ci) + 10 && base.elencos[ci].filter(x => x.pos === j.pos && x.ovr >= j.ovr).length < 2) : [];
    if (!ops.length) continue;
    const para = pickW(r, ops, ci => Math.max(1e5, caixaDe(base, s, ci))), valor = arred(j.valor * 1000 * (j.idade >= 29 ? 0.75 : 1.1) * fatorContrato(mesesDeContrato(s, j)) * (0.9 + r() * 0.2));
    if (caixaDe(base, s, para) * 0.8 < valor) continue;
    const de = mover(j, para, valor);
    add(`${valor >= 5e6 ? 'HERE WE GO! ' : ''}De volta ao Brasil: ${j.curto} (${j.idade} anos) deixa o ${nome(de)} e acerta com o ${nome(para)} por ${fmt(valor)}.`, 'mercado', base.clubes[para].div, { jogador: j.id });
  }
  aplicarSave(base, s);
}

// Clubes da IA montam o elenco: abaixo do alvo (A 32, B 30, C 28) ou com posição abaixo do mínimo, vão ao mercado.
// Na A, a compra vem primeiro; na B e na C, quase tudo é jogador livre ou emprestado por clube grande (garoto sem
// espaço). Assim os elencos não esvaziam e a lista de livres não incha.
function montarElencos(base, s, rd, r, add, mover) {
  const ia = ci => !ehHumano(s, ci), L = listasIA(base, s), livresIdx = base.clubes.findIndex(c => c.div === 'L'), nome = ci => base.clubes[ci].n, limEstr = limiteEstrangeiros(s.ano, 'L');
  const emprestaveis = [...L.emprestimo].map(id => base.jog.get(id)).filter(j => j && BR.includes(base.clubes[j.clube].div) && ia(j.clube) && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && !emAcordo(s, j.id) && !recente(s, j.id));
  for (const ci of shuffle(r, base.clubes.map((c, i) => i).filter(i => BR.includes(base.clubes[i].div) && ia(i)))) {
    const c = base.clubes[ci], alvo = ALVO[c.div], el = base.elencos[ci];
    const conta = p => el.filter(x => x.pos === p).length, falta = POS_CHAVE.filter(p => conta(p) < MIN_POS[p]);
    let vagas = Math.min(3, falta.length + (el.length < alvo - 4 ? 3 : el.length < alvo - 1 ? 2 : el.length < alvo && r() < 0.5 ? 1 : 0));
    for (; vagas > 0; vagas--) {
      const f = base.forca(ci), caixa = caixaDe(base, s, ci), aperto = Math.max(0, alvo - el.length - 2); // elenco curto aceita jogador mais fraco
      const pos = POS_CHAVE.filter(p => conta(p) < MIN_POS[p])[0] || POS_CHAVE.slice().sort((a, b) => conta(a) / MIN_POS[a] - conta(b) / MIN_POS[b] || r() - 0.5)[0];
      const barra = x => semPassagem(s, x.id) || naoJogaA(base, s, x.id, ci); // FIFA (3 clubes) e regra dos 12 jogos
      const estrOk = x => x.nat === 'BRA' || el.filter(y => y.nat !== 'BRA').length < limEstr + 3;  // ninguém contrata estrangeiro que não vai poder relacionar
      const livre = () => base.elencos[livresIdx].filter(x => estrOk(x) && !barra(x) && x.pos === pos && x.ovr >= f - 9 - aperto && x.ovr <= f + 3 && x.idade <= 34 && vontade(base, s, x, ci) >= 40).sort((a, b) => b.ovr - a.ovr)[0];
      const emprestado = () => emprestaveis.filter(x => !barra(x) && x.pos === pos && x.clube !== ci && !s.emprestimos[x.id] && base.forca(x.clube) >= f + 3 && x.ovr >= f - 9 && !rivais(base, x.clube, ci)).sort((a, b) => b.ovr - a.ovr)[0];
      const comprado = () => {
        const cands = (el.length >= 38 ? [] : [...base.jog.values()]).filter(x => estrOk(x) && !barra(x) && x.pos === pos && x.clube !== ci && BR.includes(base.clubes[x.clube].div) && x.ovr >= f - 6 - aperto && x.ovr <= f + 4 && !s.emprestimos[x.id] && !preContratoDe(s, x.id)
          && vendedorAguenta(base, s, x) && !rivais(base, x.clube, ci) && base.elencos[x.clube].length > (nivelDiv(base.clubes[x.clube]) > nivelDiv(c) ? 24 : ALVO[base.clubes[x.clube].div])); // vende quem tem sobra (para divisão de cima, quase sempre)
        const j = cands.length ? pickW(r, cands, x => x.ovr - f + 5) : null;
        return j && precoPedido(base, s, j, ci) <= caixa * 0.5 && vontade(base, s, j, ci) >= 50 ? j : null;
      };
      const ordem = c.div === 'A' ? (r() < 0.45 ? [comprado, livre, emprestado] : [livre, emprestado, comprado]) : r() < 0.12 ? [comprado, livre, emprestado] : [livre, emprestado];
      for (const fonte of ordem) {
        const j = fonte(); if (!j) continue;
        if (fonte === emprestado) {
          const de = mover(j, ci, 0, true);
          add(`Empréstimo: ${j.curto} (${j.idade} anos), sem espaço no ${nome(de)}, vai jogar no ${nome(ci)} até o fim da temporada.`, 'mercado', c.div, { jogador: j.id });
        } else if (fonte === livre) {
          mover(j, ci, 0);
          if (j.ovr >= 70) add(`Mercado: ${nome(ci)} contrata ${j.curto}, que estava sem clube.`, 'mercado', c.div, { jogador: j.id });
        } else {
          const valor = precoPedido(base, s, j, ci), de = mover(j, ci, valor);
          add(`${valor >= 5e6 ? 'HERE WE GO! ' : 'Mercado: '}${j.curto} deixa o ${nome(de)} e acerta com o ${nome(ci)} por ${fmt(valor)}.`, 'mercado', c.div, { jogador: j.id });
        }
        break;
      }
    }
  }
}

// ---------- exterior ----------
// preço de venda para fora: valor de mercado pesado pela idade (o mercado paga pelo garoto), pela fase e pelo contrato,
// com teto de € 45M (só craque de 86+ passa disso). Na Arábia, quem tem 26+ sai 25% mais caro.
const F_IDADE_EXT = i => i <= 20 ? 1.55 : i <= 23 ? 1.35 : i <= 27 ? 1.15 : i <= 30 ? 0.9 : 0.6;
const F_FASE_EXT = { pessima: 0.85, ruim: 0.92, normal: 1, boa: 1.1, excelente: 1.22 };
export function precoExterior(base, s, j, r, para) {
  const arabe = para != null && base.clubes[para].liga === 'Saudi Pro League' && j.idade >= 26;
  const v = (j.valor * 1000 || 30000) * F_IDADE_EXT(j.idade) * F_FASE_EXT[faseDe(s, j.id).k] * (0.92 + r() * 0.2) * (arabe ? 1.25 : 1) * fatorContrato(mesesDeContrato(s, j));
  return arred(j.ovr >= 86 ? v : Math.min(v, 45e6));
}

// ---------- renovações ----------
// IA é agressiva: começa a conversa logo no início da temporada e renova quem tem nível e quer ficar, inclusive quem ainda tem
// mais um ano (titulares e promessas não esperam o contrato apertar); quem não tem nível ou quer sair (minutos, temperamento,
// interesse de clube maior, fase) fica sem renovar e sai de graça no fim do ano (ou assina pré-contrato com outro)
function renovacoesIA(base, s, rd, add) {
  if (rd < 1 || rd > 34) return;
  s.renovIA ||= {};
  let mudou = false;
  for (const ci of base.clubes.map((c, i) => i).filter(i => BR.includes(base.clubes[i].div) && !ehHumano(s, i))) {
    const el = base.elencos[ci], ord = el.slice().sort((a, b) => b.ovr - a.ovr), f = base.forca(ci), nome = base.clubes[ci].n, div = base.clubes[ci].div;
    let saem = el.filter(x => ['sai', 'dispensa', 'aposenta'].includes(s.renovIA[x.id]?.ano === s.ano && s.renovIA[x.id].d)).length;  // elenco não pode esvaziar
    for (const j of el) {
      if (j.contrato > s.ano + 1 || s.renovIA[j.id]?.ano === s.ano || s.emprestimos[j.id] || preContratoDe(s, j.id)) continue;
      const rank = ord.indexOf(j), ultimo = j.contrato <= s.ano;
      // quem ainda tem um ano só entra se é titular/valor: o clube quer segurar antes de virar problema
      if (!ultimo && !(rank < 14 || j.ovr >= f - 2 || (j.idade <= 23 && (j.pot || j.ovr) >= j.ovr + 6))) continue;
      const rr = rng(`renIA${s.seed}${s.ano}${j.id}`);
      if (rd !== 1 + Math.floor(rr() * (ultimo ? 14 : 20))) continue;        // cada um tem a sua rodada de conversa, cedo
      if (ultimo && vaiAposentar(s, j)) { s.renovIA[j.id] = { ano: s.ano, d: 'aposenta' }; continue; }
      const pct = (s.est?.[j.id]?.[0] || 0) / Math.max(1, rd), t = temperamento(j);
      if (ultimo && (rank >= 25 || j.ovr < f - 10 || (j.idade >= 33 && j.ovr < f - 4)) && el.length - saem > 26) {
        s.renovIA[j.id] = { ano: s.ano, d: 'dispensa' }; saem++;
        if (j.ovr >= 72) add(`O ${nome} não vai renovar com ${j.curto}, que fica livre no fim do ano.`, 'mercado', div, { jogador: j.id, de: ci });
        continue;
      }
      const quer = 66 + (rank < 16 && pct < 0.3 ? -18 : 0) + ({ ambicioso: -10, temperamental: -4, sensivel: 0, profissional: 6 }[t]) + (faseDe(s, j.id).d > 0 && j.idade <= 29 && interessados(base, j, s).length ? -18 : 0) + (j.idade >= 31 ? 12 : 0) + (rr() - 0.5) * 26;
      if (quer < 38 && ultimo && el.length - saem > 24) {
        s.renovIA[j.id] = { ano: s.ano, d: 'sai' }; saem++;
        if (j.ovr >= 72) add(`${j.curto} recusa renovar com o ${nome} e pode sair de graça no fim do ano.`, 'rumor', div, { jogador: j.id, de: ci });
        continue;
      }
      if (!ultimo && quer < 50) { s.renovIA[j.id] = { ano: s.ano, d: 'adiou' }; continue; }  // não quis agora; tenta de novo no ano que vem
      const anos = j.idade >= 31 ? 1 + Math.floor(rr() * 2) : 2 + Math.floor(rr() * 3);
      if (s.ano + anos <= j.contrato) { s.renovIA[j.id] = { ano: s.ano, d: 'adiou' }; continue; }
      s.contratos[j.id] = s.ano + anos; s.renovIA[j.id] = { ano: s.ano, d: 'renovou' }; mudou = true;
      if (j.ovr >= 75) add(`${j.curto} renova com o ${nome} até ${s.ano + anos}.`, 'mercado', div, { jogador: j.id, de: ci });
    }
  }
  if (mudou) aplicarSave(base, s);
}
// no seu clube: quem está no último ano de contrato e não quer renovar vira novela
function novelas(base, s, rd, add) {
  if (rd < 5 || rd % 4) return;
  const meu = s.tecnico.clube; s.novela ||= {};
  for (const j of base.elencos[meu]) {
    if (j.contrato > s.ano || emNovela(s, j.id) || s.emprestimos[j.id] || preContratoDe(s, j.id) || vaiAposentar(s, j)) continue;
    const { v, motivo } = vontadeRenovar(base, s, j);
    if (v >= 32 || j.ovr < base.forca(meu) - 6) continue;
    s.novela[j.id] = { ano: s.ano, rodada: rd, motivo };
    add(`Novela: ${j.curto} avisa que não renova com o ${base.clubes[meu].n} (${motivo}). O contrato acaba no fim do ano.`, 'clube', base.clubes[meu].div, { jogador: j.id, imprensa: true });
  }
}

// ---------- fim de rodada ----------
// responde as propostas do usuário, gera propostas pelos jogadores dele, pré-contratos, negócios da IA e relatórios do olheiro
// roda depois de cada rodada; na pré-temporada e nos regionais (rodada 0), uma vez por semana ("semana" = 1, 2, ...)
export function resolverMercado(base, s, rd, semana = 0) {
  garantirMercado(s);
  const r = rng(`mercado${s.seed}-${rd}${semana ? `-s${semana}` : ''}`), N = [];
  const aberta = x => semana ? janelaAberta(s.ano, 0, s.semanaBloco?.t) : janelaAberta(s.ano, x), nome = ci => base.clubes[ci].n, divDe = ci => base.clubes[ci]?.div ?? 'A';
  const add = (texto, tipo = 'clube', div = divDe(s.tecnico.clube), extra) => N.push({ rodada: rd + 1, tipo, div, texto, mercado: true, ...extra });
  const addDo = ci => (texto, tipo = 'clube', div = divDe(ci), extra) => N.push({ rodada: rd + 1, tipo, div, texto, mercado: true, clube: ci, ...extra });
  for (const [id, c] of Object.entries(s.chegou)) if (agora(s) - c >= 14) delete s.chegou[id];
  for (const [id, k] of Object.entries(s.janChegada || {})) if (k !== janelaHoje(s)) delete s.janChegada[id]; // a janela fechou
  const hs = humanos(s);
  for (const [ci, sv] of hs) mercadoDoTecnico(base, sv, rd, semana, r, addDo(ci));
  // obrigação de compra por número de jogos (empréstimo envolvendo técnico)
  for (const [id, e] of Object.entries(s.emprestimos)) {
    const j = base.jog.get(+id), jogou = jogosNoEmprestimo(s, id), dono = ehHumano(s, e.para) ? e.para : e.de;
    if (j && e.obrig?.gatilho === 'jogos' && jogou >= e.obrig.jogos) { efetivar(base, s, j, e, e.obrig.valor, 'Obrigação de compra'); add(`Obrigação de compra acionada: ${j.curto} completa ${jogou} jogos pelo ${nome(e.para)} e fica em definitivo por ${fmt(e.obrig.valor)}.`, 'clube', divDe(dono), { jogador: j.id, clube: dono }); }
  }
  rebaixadosIA(base, s, rd, r, aberta(rd + 1), add);
  renovacoesIA(base, s, rd, add);
  for (const [ci, sv] of hs) novelas(base, sv, rd, addDo(ci));
  if (aberta(rd)) negociosIA(base, s, rd, r, add);
  for (const [, sv] of hs) trabalhoDoOlheiro(base, sv, rd, r);
  if (s.historicoTransf.length > 400) s.historicoTransf.length = 400;
  s.noticias = [...N, ...s.noticias].slice(0, 220);
}
// o clube que fez a oferta responde ao seu pedido de +15%/+30%: topa (e o negócio sai), sobe um pouco ou desiste
function responderPedido(base, s, x, r, add, rd) {
  const meu = s.tecnico.clube, nome = ci => base.clubes[ci].n;
  const j = base.jog.get(x.jogador), ped = x.pedido, teto = arred(x.valor * ((x.gigante ? 1.35 : 1.12) + r() * 0.2 + faseDe(s, j.id).d * 0.03));
  const pct = Math.round((ped / x.valor - 1) * 100), msg = (aceitou, texto) => enviar(s, 'diretor', `contra-${x.id}`, `${nome(x.de)} ${aceitou ? 'aceitou' : 'recusou'} pagar ${pct}% a mais`, texto, { jogador: j.id });
  delete x.pedido;
  if (ped <= teto || fmt(ped) === fmt(teto)) { // diferença que nem aparece no valor arredondado: topa
    x.valor = ped;
    const e = aceitarRecebida(base, s, x.id);
    msg(true, `O ${nome(x.de)} aceitou pagar ${fmt(ped)} (+${pct}%) por ${j.curto}. ${e ? `Mas o negócio travou: ${e}` : 'Negócio fechado.'}`);
    if (e) { x.rodada = rd; add(`O ${nome(x.de)} aceita pagar ${fmt(ped)} por ${j.curto}, mas o negócio travou: ${e}`); }
    else add(`O ${nome(x.de)} aceitou pagar ${fmt(ped)} (+${pct}%): ${j.curto} foi vendido.`, 'clube', base.clubes[meu].div, { soAviso: true });
  } else if (r() < 0.5) { msg(false, `O ${nome(x.de)} não chega a ${fmt(ped)} (+${pct}%) por ${j.curto}, mas subiu a oferta para ${fmt(teto)}. Responda em Mercado › Ofertas.`); Object.assign(x, { id: `${x.id}-c`, valor: teto, rodada: rd }); add(`O ${nome(x.de)} não chega a ${fmt(ped)}, mas sobe a oferta por ${j.curto} para ${fmt(teto)}. Responda no Mercado.`, 'clube', base.clubes[meu].div, { jogador: j.id }); }
  else { msg(false, `O ${nome(x.de)} achou caro pagar ${fmt(ped)} (+${pct}%) por ${j.curto} e desistiu da negociação.`); s.recebidas = s.recebidas.filter(y => y !== x); add(`O ${nome(x.de)} acha caro e desiste de ${j.curto}.`, 'clube', base.clubes[meu].div, { jogador: j.id }); if (x.quer) barrarSaida(base, s, x); }
}
// negociação na hora: a proposta que você acabou de enviar (ou a contraproposta que aceitou) e o seu pedido de mais
// dinheiro numa oferta recebida já voltam com a resposta; devolve o texto dela
function naHora(base, s, chave, fn) {
  const N = [], div = base.clubes[s.tecnico.clube].div;
  const add = (texto, tipo = 'clube', d = div, extra) => N.push({ rodada: s.rodada, tipo, div: d, texto, mercado: true, ...extra });
  fn(rng(`agora${s.seed}-${chave}`), add);
  s.noticias = [...N.filter(n => !n.soAviso), ...s.noticias].slice(0, 220);
  return N.filter(n => n.tipo === 'clube').map(n => n.texto).join(' ') || null;
}
export function responderProposta(base, s, id) {
  const p = s.propostas.find(x => x.id === id && x.estado === 'aguardando'); if (!p) return null;
  p.tentativa = (p.tentativa || 0) + 1;
  return naHora(base, s, `${p.id}-${p.tentativa}`, (r, add) => responder(base, s, p, r, add, s.rodada, !janelaAberta(s.ano, s.rodada, s.ultimaData)));
}
export function responderPedidoAgora(base, s, id) {
  const x = s.recebidas.find(y => y.id === id && y.pedido && !y.humano); if (!x) return null;
  return naHora(base, s, `pedido-${x.id}`, (r, add) => responderPedido(base, s, x, r, add, s.rodada));
}

// resposta de uma proposta sua: clube (preço, rival, multa paga), disputa de livre e pré-contrato, vontade e salário do
// jogador. Na hora em que você envia (responderProposta) e, para o que ficou esperando, no mercado da rodada (tarde:
// na hora da resposta outro clube ainda pode aparecer e virar leilão)
function responder(base, s, p, r, add, rd, janelaFechada, tarde = false) {
  const meu = s.tecnico.clube, nome = ci => base.clubes[ci].n;
  const j = base.jog.get(p.jogador), tipo = p.tipo || 'compra', t = p.troca && base.jog.get(p.troca);
  if (p.leilao === 'vivo') return;                         // esperando o leilão
  const dono = j.clube !== meu && ['compra', 'emprestimo'].includes(tipo) && vistaDo(s, j.clube);
  if (dono) { propostaEntreTecnicos(base, s, dono, p, j, rd, add); return; }
  // de surpresa: na hora da resposta, outro clube aparece e o vendedor abre leilão (a tela vem sozinha)
  if (tarde && tipo === 'compra' && j.clube === p.de && abrirLeilaoCompra(base, s, p.id, true)) { add(`Leilão! Outro clube também quer ${j.curto} e o ${nome(j.clube)} abriu a disputa. A sala está esperando você.`); return; }
  const falha = (motivo, txt) => {
    p.estado = 'recusada'; p.motivo = motivo; if (txt) add(txt);
    const x = s.recusas[j.id]?.ano === s.ano ? s.recusas[j.id] : { n: 0, ate: 0 }, n = x.n + 1;
    s.recusas[j.id] = n >= 3 ? { n: 0, ano: s.ano, ate: rd + 3 } : { n, ano: s.ano, ate: x.ate };
    if (n >= 3) add(`Depois de três recusas, as conversas por ${j.curto} ficam fechadas por 2 rodadas.`);
  };
  if (j.clube !== p.de) { p.estado = 'cancelada'; p.motivo = 'ele já trocou de clube'; return; }
  if (preContratoDe(s, j.id)) { p.estado = 'cancelada'; p.motivo = 'assinou pré-contrato com outro clube'; return; }
  if (p.troca && (!t || t.clube !== meu)) { p.estado = 'cancelada'; p.motivo = 'o jogador da troca não está mais no elenco'; return; }
  if (t && vontade(base, s, t, j.clube) < 35) { falha(`${t.curto} não quer ir para o ${nome(j.clube)}`, `${t.curto} não aceita ir para o ${nome(j.clube)} na troca por ${j.curto}.`); return; }
  const fechada = ['compra', 'emprestimo'].includes(tipo) && janelaFechada, vt = t ? valorNaTroca(base, s, t, j.clube) : 0;
  if (tipo === 'compra' && !p.clubeOk && pagouClausula(base, s, j, meu, p.valor + vt)) { p.clubeOk = true; add(`Multa rescisória paga: o ${nome(j.clube)} não pode segurar ${j.curto}. Agora a conversa é com ele.`); }
  if (tipo !== 'livre' && !p.clubeOk && rivais(base, j.clube, meu) && r() < 0.9) { falha('o clube não negocia com o rival', `O ${nome(j.clube)} nem abre conversa: não negocia ${j.curto} com o rival.`); return; }
  if (tipo === 'compra' && !p.clubeOk && !p.aceitouContra) {
    const pedido = Math.min(precoPedido(base, s, j), p.pedido || Infinity); // o clube honra o preço que pediu na hora da proposta
    if (p.valor + vt < pedido) {
      if (p.valor + vt >= pedido * 0.85) { p.estado = 'contraproposta'; p.contra = Math.max(0, arred(pedido - vt)); add(`O ${nome(j.clube)} pede ${fmt(p.contra)}${t ? ` além de ${t.curto}` : ''} por ${j.curto}.`); }
      else falha('o clube achou pouco', `O ${nome(j.clube)} recusa a proposta por ${j.curto}.`);
      return;
    }
    p.clubeOk = true;
  }
  if (tipo === 'emprestimo' && !p.clubeOk) {
    const cl = p.cl || limpaCl(base, s, j);
    if (notaEmprestimo(base, s, j, cl) + (r() - 0.5) * 12 < 50) { const m = motivoEmp(base, s, j, cl); falha(`o clube ${m}`, `O ${nome(j.clube)} não empresta ${j.curto}: ${m}.`); return; }
    p.clubeOk = true;
  }
  // disputa por livre e pré-contrato: clubes que também fariam sentido entram na briga (na compra, a briga é o leilão)
  let melhorRival = null;
  if (tipo !== 'emprestimo' && tipo !== 'compra' && !fechada) {
    const rivais = interessados(base, j, s).filter(ci => !ehHumano(s, ci) && r() < 0.25).slice(0, 2);
    for (const ci of rivais) add(`O ${nome(ci)} também quer ${j.curto}.`);
    melhorRival = rivais.map(ci => ({ ci, v: vontade(base, s, j, ci) + (r() - 0.5) * 16 })).sort((a, b) => b.v - a.v)[0];
  }
  const minha = vontade(base, s, j, meu, p.promessa) + (r() - 0.5) * 16 + (tipo === 'emprestimo' ? 10 : 0);
  if (minha < 50) { falha(`${j.curto} ${motivoRecusa(base, s, j)}`, `${j.curto} recusa: ${motivoRecusa(base, s, j)}.`); return; }
  if (melhorRival && melhorRival.v > minha) {
    p.estado = 'perdida'; p.motivo = `ele escolheu o ${nome(melhorRival.ci)}`;
    if (tipo === 'pre') s.preContratos.push({ jogador: j.id, de: j.clube, para: melhorRival.ci, rodada: rd });
    else { transferir(base, s, j, melhorRival.ci, 0); s.historicoTransf[0].ia = true; }
    add(`${j.curto} escolhe o ${nome(melhorRival.ci)}${tipo === 'pre' ? ' e assina pré-contrato' : ' e vai jogar lá'}.`, 'mercado', base.clubes[melhorRival.ci].div, { jogador: j.id });
    return;
  }
  // salário: abaixo de 90% do que pede, ele faz contraproposta; entre 90% e 100%, pode topar
  const pede = tipo === 'emprestimo' ? 0 : salarioPedido(base, s, j, p.anos, meu, p.promessa);
  if (!p.salOk && p.salario < pede && !(p.salario >= pede * 0.9 && r() < (p.salario / pede - 0.9) * 10)) {
    p.estado = 'contraproposta'; p.contraSal = pede; add(`${j.curto} topa vir, mas pede € ${pede.toLocaleString('pt-BR')}/dia.`); return;
  }
  if (tipo === 'compra' && p.valor > s.caixa) { falha('faltou dinheiro em caixa'); return; }
  const de = j.clube;
  p.estado = 'concluida';
  const pago = `${p.valor ? fmt(p.valor) : ''}${p.valor && t ? ' + ' : ''}${t ? `${t.curto} na troca` : ''}`;
  if (tipo === 'pre') { s.preContratos.push({ jogador: j.id, de, para: meu, salario: p.salario, anos: p.anos, rodada: rd }); add(`Pré-contrato assinado: ${j.curto} chega do ${nome(de)} em janeiro de ${s.ano + 1}.`); }
  else if (tipo === 'emprestimo' && fechada) { p.motivo = 'chega quando a janela abrir'; s.acordos.push({ tipo: 'emprestimo', jogador: j.id, de, cl: p.cl || limpaCl(base, s, j), promessa: !!p.promessa }); add(`Empréstimo acertado: ${j.curto} chega do ${nome(de)} quando a janela abrir.`); }
  else if (tipo === 'emprestimo') { const cl = p.cl || limpaCl(base, s, j), res = resumoCl(cl); emprestar(base, s, j, meu, cl); if (p.promessa) prometerTitular(base, s, j); add(`Reforço por empréstimo: ${j.curto} chega do ${nome(de)} até o fim da temporada${res ? ` (${res})` : ''}.`); }
  else if (fechada) { p.motivo = 'chega quando a janela abrir'; s.acordos.push({ jogador: j.id, de, valor: p.valor, salario: p.salario, anos: p.anos, troca: p.troca || 0, promessa: !!p.promessa }); add(`Acordo fechado: ${j.curto} chega do ${nome(de)} (${pago}) quando a janela abrir.`); }
  else {
    if (p.promessa) prometerTitular(base, s, j);
    if (t) { transferir(base, s, t, de, 0); s.historicoTransf[0].tipo = 'troca'; }
    transferir(base, s, j, meu, p.valor, { salario: p.salario, anos: p.anos });
    add(`HERE WE GO! ${j.curto} é do ${nome(meu)}. ${tipo === 'livre' ? 'Chega sem custo' : pago}, contrato até ${s.ano + p.anos}.`, 'mercado', base.clubes[meu].div, { jogador: j.id, para: meu });
    add(tipo === 'livre' ? `Reforço: ${j.curto}, que estava sem clube, assina até ${s.ano + p.anos}.` : `Reforço: ${j.curto} chega do ${nome(de)} (${pago}).`);
  }
}
// a parte de cada técnico: acordos que chegam, respostas às propostas dele, ofertas pelos jogadores dele, pré-contratos
// e quem quer sair
function mercadoDoTecnico(base, s, rd, semana, r, add) {
  garantirMercado(s);
  // leilão que ninguém abriu em duas passadas do mercado (avanço rápido, motor sem tela): a sala termina sem você
  if (s.leilaoAtivo && (s.leilaoAtivo.comecou || s.rodada * 100 + (s.semanaBloco?.n || 0) - (s.leilaoAtivo.criado ?? -1e9) >= 2)) encerrarPendente(base, s);
  const meu = s.tecnico.clube, aberta = x => semana ? janelaAberta(s.ano, 0, s.semanaBloco?.t) : janelaAberta(s.ano, x), nome = ci => base.clubes[ci].n;
  if (s.acordos.length && aberta(rd + 1)) cumprirAcordos(base, s, add);

  for (const p of s.propostas.filter(x => x.estado === 'aguardando' && x.rodada <= rd)) responder(base, s, p, r, add, rd, !aberta(rd + 1), true);

  // contrapropostas suas nas ofertas recebidas: o clube topa (e o negócio sai), sobe um pouco ou desiste
  for (const x of s.recebidas.filter(x => x.pedido && !x.humano && x.rodada <= rd)) responderPedido(base, s, x, r, add, rd);
  // leilão: quem fez a oferta e até 3 interessados dão lances; vence quem pagar mais (no máximo 190% do valor)
  for (const x of s.recebidas.filter(x => (x.leilao === 'aberto' || (x.leilao === 'vivo' && s.leilaoAtivo?.id !== x.id)) && x.rodada <= rd)) {
    const j = base.jog.get(x.jogador), teto = arred(Math.max(x.valor, j.valor * 1000 * 1.9));
    const outros = shuffle(r, interessados(base, j, s).filter(ci => ci !== x.de && !ehHumano(s, ci) && !rivais(base, ci, meu) && base.elencos[ci].length < 38)).slice(0, 3);
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
  if (aberta(rd + 1)) {
    // gigante europeu ou árabe aparece pelo seu craque, de vez em quando, com dinheiro de sobra
    const craques = base.elencos[meu].filter(j => (j.ovr >= 77 || (j.ovr >= 73 && faseDe(s, j.id).k === 'excelente')) && j.idade <= 33 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && !recente(s, j.id) && !s.recebidas.some(x => x.jogador === j.id));
    if (craques.length && r() < 0.06) {
      const j = pickW(r, craques, x => x.ovr - 70), arabe = j.idade >= 29 || r() < 0.3;
      const ops = base.clubes.map((c, i) => i).filter(i => GIGANTE(base.clubes[i]) && (base.clubes[i].liga === 'Saudi Pro League') === arabe);
      if (ops.length) {
        const de = pickW(r, ops, ci => base.clubes[ci].fan), f = faseDe(s, j.id), x = gigante(base, s, j, de, arabe, r);
        s.recebidas.push({ id: `${j.id}-${de}-${rd}`, tipo: 'compra', jogador: j.id, de, rodada: rd, gigante: true, arabe, ...x });
        add(`Proposta milionária: o ${nome(de)} oferece ${fmt(x.valor)} por ${j.curto} e salário ${x.mult.toFixed(1).replace('.', ',')}x maior.${f.d > 0 ? ` A ${f.nome.toLowerCase()} valorizou o passe.` : ''} Responda no Mercado.`, 'clube', base.clubes[meu].div, { jogador: j.id, imprensa: true });
      }
    }
    let novas = 0;
    for (const j of base.elencos[meu].slice().sort((a, b) => faseDe(s, b.id).d - faseDe(s, a.id).d || b.ovr - a.ovr)) {
      if (novas >= 3) break;
      if (s.emprestimos[j.id] || preContratoDe(s, j.id) || recente(s, j.id) || emAcordo(s, j.id) || s.recebidas.some(x => x.jogador === j.id)) continue;
      const listado = s.listas.venda.includes(j.id);
      if (s.listas.emprestimo.includes(j.id)) {
        if (r() > 0.3) continue;
        const opcoes = base.clubes.map((c, i) => i).filter(ci => BR.includes(base.clubes[ci].div) && !ehHumano(s, ci) && !naoJogaA(base, s, j.id, ci) && base.elencos[ci].filter(x => x.ovr > j.ovr).length < 14);
        if (!opcoes.length) continue;
        const de = pickW(r, opcoes, ci => base.clubes[ci].fan);
        const compra = r() < 0.3 ? 'opcao' : r() < 0.25 ? 'obrigacao' : 'nenhuma';
        const cl = limpaCl(base, s, j, { taxa: r() < 0.4 ? j.valor * 1000 * (0.03 + r() * 0.07) : 0, compra, valorCompra: precoPedido(base, s, j) * (1 + r() * 0.3), gatilho: ['jogos', 'fim', 'permanencia'][Math.floor(r() * 3)], jogos: 10 + Math.floor(r() * 12), minimo: r() < 0.3 ? 10 : 0, medo: r() < 0.3 });
        s.recebidas.push({ id: `${j.id}-${de}-${rd}`, tipo: 'emprestimo', jogador: j.id, de, valor: 0, rodada: rd, cl });
        const res = resumoCl(cl);
        add(`O ${nome(de)} pede ${j.curto} emprestado até o fim da temporada${res ? ` (${res})` : ''}. Responda no Mercado.`);
        continue;
      }
      const e = s.est?.[j.id], emAlta = e && e[0] >= 3 && (media(e) >= 6.9 || e[1] >= e[0] * 0.4), f = faseDe(s, j.id), queda = s.querSair?.[j.id]?.queda;
      const chance = queda ? 0.5 : emNovela(s, j.id) ? 0.4 : listado ? 0.35 : f.k === 'excelente' ? 0.45 : f.k === 'boa' ? 0.28 : emAlta || j.ovr >= 78 || j.ovr >= base.forca(meu) + 4 ? 0.12 : 0;
      if (r() >= chance) continue;
      let opcoes = interessados(base, j, s).filter(ci => !ehHumano(s, ci));
      if ((listado || queda) && !opcoes.length) opcoes = base.clubes.map((c, i) => i).filter(ci => BR.includes(base.clubes[ci].div) && !ehHumano(s, ci) && !rivais(base, ci, meu) && !naoJogaA(base, s, j.id, ci) && Math.abs(base.forca(ci) - j.ovr) <= 5);
      if (!opcoes.length) continue;
      const de = pickW(r, opcoes, ci => base.clubes[ci].fan + (naContinental(s, ci) ? 4 : 0)), valor = queda ? arred(j.valor * 1000 * (0.7 + r() * 0.3)) : arred(precoPedido(base, s, j, de) * (listado ? 0.7 + r() * 0.25 : 0.85 + r() * 0.3 + f.d * 0.04));
      if (caixaDe(base, s, de) < valor) continue;
      const motivo = queda ? `não quer jogar a Série ${queda.div}` : querIr(base, s, j, de), quer = motivo && (queda || r() < 0.8) ? motivo : null;
      s.recebidas.push({ id: `${j.id}-${de}-${rd}`, tipo: 'compra', jogador: j.id, de, valor, rodada: rd, quer });
      add(`O ${nome(de)} oferece ${fmt(valor)} por ${j.curto}.${quer ? ` Ele ${quer} e quer ir.` : ''} Responda no Mercado.`, 'clube', base.clubes[meu].div, { jogador: j.id });
      novas++;
    }
  }

  // contrato acabando e sem renovação: a partir da 25ª rodada, outro clube pode assinar pré-contrato com ele
  if (rd >= ABRE_PRE) for (const j of base.elencos[meu]) {
    const nov = emNovela(s, j.id);
    if (!contratoNoFim(s, j) || preContratoDe(s, j.id) || s.emprestimos[j.id] || vaiAposentar(s, j) || (!nov && (rd < 24 || j.ovr < base.forca(meu) - 4)) || r() > (nov ? 0.3 : 0.15)) continue;
    const opcoes = interessados(base, j, s).filter(ci => !ehHumano(s, ci)); if (!opcoes.length) continue;
    const para = pickW(r, opcoes, ci => base.clubes[ci].fan);
    s.preContratos.push({ jogador: j.id, de: meu, para, rodada: rd });
    add(`${j.curto} assina pré-contrato com o ${nome(para)} e sai no fim da temporada. Renove os contratos que estão acabando.`);
  }

  // chateado por não ter sido liberado: moral não sobe e, de vez em quando, ele cobra em público
  for (const [id, q] of Object.entries(s.querSair || {})) {
    const j = base.jog.get(+id);
    if (!j || !ehHumano(s, j.clube) || (!q.queda && rd - q.rodada >= 8) || (q.queda && q.queda.ano !== s.ano)) { delete s.querSair[id]; continue; }
    if (j.clube !== meu) continue;
    if (q.queda && !aberta(rd + 1)) { rescisaoDaQueda(base, s, j, q.queda.multa, add); continue; }
    s.mor[id] = Math.min(s.mor[id] ?? 62, 45);
    if (r() < 0.15) add(q.queda ? `${j.curto} avisa: "Não jogo a Série ${q.queda.div}. Se a janela fechar e eu estiver aqui, rescindo."` : `${j.curto} cobra a diretoria: "Eu ${q.motivo.replace(/^é /, 'tinha ')}. Quero ser negociado."`, 'clube', base.clubes[meu].div, { jogador: j.id, imprensa: true });
  }
}
