// Mercado: preço, salário e contrato, vontade do jogador, disputa com rivais, livres, pré-contratos,
// listas de venda e empréstimo, olheiros, favoritos e negócios entre os clubes da IA.
// Extras: troca (jogador como parte do pagamento), acordo com a janela fechada, opção de compra no empréstimo,
// chamar emprestado de volta, rescisão, trava de 14 jogos pra quem chegou, 3 recusas fecham a conversa,
// contraproposta e leilão nas ofertas recebidas, gigantes europeus e árabes.
// Proposta feita numa rodada é respondida na seguinte. Compra com concorrência vira leilão na hora (leilao.js).
import { rivais } from './rivais.js';
import { premiado } from './gala.js';
import { faseDe } from './forma.js';
import { rng, clamp, pickW, shuffle, SETOR, nivelDiv, estrelas, continenteDe, fmtDinheiro } from './util.js';
import { temperamento, tratar } from './vestiario.js';
import { interessados, media } from './noticias.js';
import { janelaAberta, caixaInicial, aplicarSave, evolucao } from './mundo.js';
import { dataAmistoso, doAno } from './calendario.js';
import { orcamento, lancar, garantirFinancas, salarioDia, salarioBase, diasRestantes, registroBloqueado, passaDoTeto } from './financas.js';
import { naSelecao } from './selecao.js';
import { enviar } from './correio.js';

const arred = v => Math.max(50000, Math.round(v / 10000) * 10000);
const arredSal = v => Math.max(10, Math.round(v / 10) * 10);
export const LIMITE_ELENCO = 45, MINIMO_ELENCO = 18, ABRE_PRE = 19, MAX_PRE = 5, TRAVA = 14;
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
  const L = listasIA(base, s), meu = j.clube === s.tecnico.clube, t = [];
  if (ehLivre(base, j.clube)) return ['livre'];
  if (s.emprestimos[j.id]) t.push('emprestado');
  if (meu ? s.listas.venda.includes(j.id) : L.venda.has(j.id)) t.push('venda');
  if (meu ? s.listas.emprestimo.includes(j.id) : L.emprestimo.has(j.id)) t.push('emprestimo');
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
    if (!j || j.clube !== ci) { delete P[id]; continue; }
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
  let pede = Math.max(atual, salarioBase(base.clubes[destino].div, j.valor)) * (1.1 + clamp((60 - v) / 100, -0.1, 0.6));
  if (j.idade >= 30) pede *= 1 + 0.06 * Math.max(0, 3 - anos);
  if (ehLivre(base, j.clube)) pede *= 0.9;
  return arredSal(pede);
}
// quanto de salário novo cabe (se ele já é seu, o salário atual sai da conta)
export function folgaPara(base, s, j) { return orcamento(base, s).folga + (j.clube === s.tecnico.clube ? salarioDia(base, s, j) : 0); }

// caixa de verdade dos clubes da IA: começa no caixa inicial, mexe a cada compra e venda e se refaz em parte na virada
export const caixaDe = (base, s, ci) => ci === s.tecnico.clube ? s.caixa : s.caixaIA?.[ci] ?? caixaInicial(base, ci);
export function mexerCaixa(base, s, ci, v) {
  if (ci == null || ci === s.tecnico.clube || base.clubes[ci].div === 'L' || !v) return;
  (s.caixaIA ||= {})[ci] = Math.round(caixaDe(base, s, ci) + v);
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
  const meu = s.tecnico.clube, janela = janelaAberta(s.ano, s.rodada);
  if (j.clube === meu) return 'Ele já é seu.';
  const ban = registroBloqueado(s); if (ban) return `Registro de jogadores bloqueado pelo fair play financeiro até a ${ban + 1}ª rodada.`;
  if (s.propostas.some(p => p.jogador === j.id && ['aguardando', 'contraproposta'].includes(p.estado))) return 'Você já tem uma proposta por ele.';
  if (emAcordo(s, j.id)) return 'Já existe um acordo por ele.';
  const fx = conversaFechada(s, j.id);
  if (fx) return `O ${base.clubes[j.clube].n} fechou as conversas depois de 3 recusas. Tente de novo em ${fx} rodada${fx > 1 ? 's' : ''}.`;
  const pre = preContratoDe(s, j.id);
  if (pre) return `Já assinou pré-contrato com o ${base.clubes[pre.para].n}.`;
  if (s.emprestimos[j.id] && o.tipo !== 'pre') return 'Está emprestado até o fim da temporada.';
  if (o.tipo === 'pre' && s.rodada >= ABRE_PRE && vaiAposentar(s, j)) return 'Ele vai se aposentar no fim da temporada.';
  if (!tiposPossiveis(base, s, j).includes(o.tipo)) return o.tipo === 'pre' ? `Pré-contrato só com contrato no fim, a partir da ${ABRE_PRE + 1}ª rodada (metade do Brasileirão). Ele chega na temporada seguinte.` : o.tipo === 'emprestimo' ? 'Esse clube não empresta.' : 'Esse tipo de proposta não vale para ele.';
  if (o.tipo === 'emprestimo' && (o.cl?.taxa || 0) > s.caixa) return 'A taxa de empréstimo passa do que tem em caixa.';
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
  const meu = s.tecnico.clube;
  delete s.emprestimos[j.id];
  s.contratos[j.id] = s.ano + 3;
  if (e.para === meu) {
    s.salarios[j.id] = e.cheio || s.salarios[j.id];
    lancar(s, 'compra', `${txt}: ${j.curto} (${base.clubes[e.de].n})`, -valor); s.fin.temporada.compras += valor;
    if (e.revenda) (s.revenda ||= {})[j.id] = { clube: e.de, pct: e.revenda };
  } else if (e.de === meu) {
    delete s.salarios[j.id];
    lancar(s, 'venda', `${txt}: ${j.curto} (${base.clubes[e.para].n})`, valor); s.fin.temporada.vendas += valor;
  }
  mexerCaixa(base, s, e.para, -valor); mexerCaixa(base, s, e.de, valor);
  aplicarSave(base, s);
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de: e.de, para: e.para, valor, tipo: 'compra' });
}
// fim da temporada: multa de minutagem, obrigações por permanência/fim e a IA decidindo a opção pelo que ele jogou
export function fimDosEmprestimos(base, s, caem, add) {
  const meu = s.tecnico.clube, nome = c => base.clubes[c].n;
  for (const [id, e] of Object.entries(s.emprestimos)) {
    const j = base.jog.get(+id); if (!j || (e.para !== meu && e.de !== meu)) continue;
    const jogou = jogosNoEmprestimo(s, id);
    if (e.minimo && jogou < e.minimo) {
      const v = arred(j.valor * 1000 * 0.1);
      lancar(s, 'minutagem', `Multa de minutagem: ${j.curto}`, e.para === meu ? -v : v);
      add(`Multa de minutagem: ${j.curto} jogou ${jogou} dos ${e.minimo} jogos combinados e o ${nome(e.para)} paga ${fmt(v)} ao ${nome(e.de)}.`);
    }
    const ob = e.obrig;
    if (ob && (ob.gatilho === 'fim' || (ob.gatilho === 'permanencia' && !caem.includes(e.para)))) { efetivar(base, s, j, e, ob.valor, 'Obrigação de compra'); add(`Obrigação de compra: ${j.curto} fica em definitivo no ${nome(e.para)} por ${fmt(ob.valor)}.`); continue; }
    if (e.de === meu && e.opcao && jogou >= 8 && media(s.est?.[id]) >= 6.6) { efetivar(base, s, j, e, e.opcao, 'Opção de compra'); add(`O ${nome(e.para)} exerce a opção e compra ${j.curto} por ${fmt(e.opcao)}.`); }
  }
}
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
  mexerCaixa(base, s, para, -valor); mexerCaixa(base, s, de, valor);
  const rv = de === meu && valor && s.revenda?.[j.id];
  if (rv) { lancar(s, 'revenda', `Revenda: ${rv.pct}% da venda de ${j.curto} ao ${base.clubes[rv.clube].n}`, -Math.round(valor * rv.pct / 100)); delete s.revenda[j.id]; }
  if (s.xi && (para === meu || de === meu)) s.xi = null; // escalação manual refeita com o elenco novo
  s.historicoTransf.unshift({ rodada: s.rodada, jogador: j.id, nome: j.curto, de, para, valor, tipo: ehLivre(base, de) ? 'livre' : 'compra' });
}
// empréstimo até o fim da temporada; o salário continua o mesmo e quem está com ele paga
export function emprestar(base, s, j, para, cl = null) {
  const de = j.clube, meu = s.tecnico.clube, cheio = salarioDia(base, s, j);
  if (para === meu) s.salarios[j.id] = Math.round(cheio * (cl?.pct ?? 100) / 100);
  s.emprestimos[j.id] = { de, para, ate: s.ano, cheio, jogos0: s.est?.[j.id]?.[0] || 0, ...(cl ? { taxa: cl.taxa, pct: cl.pct, minimo: cl.minimo, medo: cl.medo, revenda: cl.revenda } : {}) };
  if (cl?.compra === 'opcao') s.emprestimos[j.id].opcao = cl.valorCompra;
  if (cl?.compra === 'obrigacao') s.emprestimos[j.id].obrig = { valor: cl.valorCompra, gatilho: cl.gatilho, jogos: cl.jogos };
  if (cl?.taxa && (para === meu || de === meu)) lancar(s, 'emprestimo', `Taxa de empréstimo de ${j.curto} (${base.clubes[para === meu ? de : para].n})`, para === meu ? -cl.taxa : cl.taxa);
  if (cl?.taxa) { mexerCaixa(base, s, para, -cl.taxa); mexerCaixa(base, s, de, cl.taxa); }
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
  if (p.vontade != null && p.vontade < 35) { s.recebidas = s.recebidas.filter(x => x !== p); return `${j.curto} não aceita ir para o ${base.clubes[p.de].n}: prefere seguir aqui. A proposta caiu.`; }
  if (p.tipo === 'emprestimo') emprestar(base, s, j, p.de, p.cl);
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
  s.mor[j.id] = Math.max(0, (s.mor[j.id] ?? 62) - (faseDe(s, j.id).d > 0 ? 15 : 10)); tratar(s, j.id, -2);
  (s.querSair ||= {})[j.id] = { ...s.querSair[j.id], de: p.de, rodada: s.rodada, motivo: p.quer }; // o rebaixado segue com a ameaça de rescindir
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
  efetivar(base, s, j, e, e.opcao, 'Opção de compra');
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
// quer ficar? Minutos, temperamento, como o técnico trata (s.trato), moral, quem está interessado, fase, idade e
// se já pediu pra sair. Abaixo de 32 vira novela: não renova por nada e o clube decide se vende ou perde de graça.
const MOTIVO_NOV = { minutos: 'joga pouco', trato: 'não gosta de como é tratado', maior: 'quer um clube maior', sair: 'já pediu pra sair', moral: 'anda insatisfeito' };
export function vontadeRenovar(base, s, j) {
  const ci = s.tecnico.clube, el = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr), rank = el.indexOf(j), t = temperamento(j);
  const jogosClube = base.clubes[ci] && s.res ? Object.keys(s.res[base.clubes[ci].div] || {}).filter(k => k.split('-').map(Number).includes(ci)).length : 0;
  const pct = (s.est?.[j.id]?.[0] || 0) / Math.max(1, jogosClube), maior = interessados(base, j).some(c => nivelDiv(base.clubes[c]) < nivelDiv(base.clubes[ci]) || base.forca(c) >= base.forca(ci) + 4);
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
export function renovacaoPossivel(s, j) { return j.contrato <= s.ano + 1 && !preContratoDe(s, j.id) && !s.emprestimos[j.id]; }
export function pedidoRenovacao(base, s, j, anos = 3) {
  const ficar = emNovela(s, j.id) ? 0 : vontadeRenovar(base, s, j).v;
  let pede = Math.max(salarioDia(base, s, j), salarioBase(base.clubes[j.clube].div, j.valor)) * (1.05 + clamp((60 - ficar) / 100, -0.1, 0.5));
  if (j.idade >= 30) pede *= 1 + 0.06 * Math.max(0, 3 - anos);
  return { ficar, pede: arredSal(pede) };
}
export function renovar(base, s, j, salario, anos) {
  if (j.clube !== s.tecnico.clube || !renovacaoPossivel(s, j)) return { ok: false, txt: 'Não dá para renovar com ele agora.' };
  if (!(anos >= 1 && anos <= 5)) return { ok: false, txt: 'Contrato de 1 a 5 anos.' };
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
  const meu = s.tecnico.clube, r = rng(`queda${s.seed}-${s.ano}`), N = [];
  const nivel = d => { const cs = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === d); return cs.reduce((a, ci) => a + base.forca(ci), 0) / Math.max(1, cs.length); };
  for (const ci of caidos) {
    const div = base.clubes[ci].div, acima = nivel(div) + 5;
    const quem = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).slice(0, 8)
      .filter(j => j.idade <= 32 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && (['ambicioso', 'temperamental'].includes(temperamento(j)) || j.ovr >= acima))
      .slice(0, r() < 0.5 ? 2 : 3);
    for (const j of quem) {
      const multa = arred(j.valor * 1000 * (0.4 + r() * 0.2));
      if (ci === meu) {
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
  const meu = s.tecnico.clube, livres = base.clubes.findIndex(c => c.div === 'L');
  for (const [id, q] of Object.entries(s.quedaIA || {})) {
    const j = base.jog.get(+id);
    if (!j || q.ano !== s.ano || j.clube !== q.de) { delete s.quedaIA[id]; continue; }
    if (aberta) {
      if (r() > 0.2) continue;
      const ops = interessados(base, j).filter(ci => ci !== meu && base.elencos[ci].length < 38 && vontade(base, s, j, ci) >= 45);
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
    mexerCaixa(base, s, para, -valor); mexerCaixa(base, s, de, valor);
    aplicarSave(base, s);
    s.historicoTransf.unshift({ rodada: rd, jogador: j.id, nome: j.curto, de, para, valor, tipo: ehLivre(base, de) ? 'livre' : 'compra', ia: true });
    return de;
  };
  for (const ci of base.clubes.map((c, i) => i).filter(i => BR.includes(base.clubes[i].div) && i !== meu)) {
    if (r() > 0.09 || base.elencos[ci].length >= 38) continue;
    const el = base.elencos[ci], f = base.forca(ci), melhorNa = p => el.filter(x => x.pos === p).reduce((m, x) => Math.max(m, x.ovr), 0);
    const pos = POS_CHAVE.slice().sort((a, b) => melhorNa(a) - melhorNa(b))[0], min = melhorNa(pos) + 2, caixa = caixaDe(base, s, ci) * 0.5;
    const cands = [...base.jog.values()].filter(j => j.pos === pos && j.clube !== ci && j.ovr >= min && j.ovr <= f + 5 && !s.emprestimos[j.id] && !preContratoDe(s, j.id)
      && vendedorAguenta(base, s, j) && precoPedido(base, s, j, ci) <= caixa && vontade(base, s, j, ci) >= 50 && (!rivais(base, j.clube, ci) || r() < 0.03));
    if (!cands.length) continue;
    const j = pickW(r, cands, x => x.ovr - min + 1), valor = precoPedido(base, s, j, ci), de = mover(j, ci, valor);
    add(ehLivre(base, de) ? `Mercado: ${nome(ci)} contrata ${j.curto}, que estava sem clube.` : `${valor >= 5e6 ? 'HERE WE GO! ' : 'Mercado: '}${j.curto} deixa o ${nome(de)} e acerta com o ${nome(ci)} por ${fmt(valor)}.`, 'mercado', base.clubes[ci].div, { jogador: j.id });
  }
  // quem está em fase boa num clube menor é disputado pelos maiores
  let quentes = 0;
  for (const j of shuffle(r, [...base.jog.values()].filter(j => BR.includes(base.clubes[j.clube].div) && j.clube !== meu && faseDe(s, j.id).d > 0 && vendedorAguenta(base, s, j) && !preContratoDe(s, j.id) && !s.emprestimos[j.id]))) {
    if (quentes >= 2) break;
    if (r() > (faseDe(s, j.id).k === 'excelente' ? 0.12 : 0.05)) continue;
    const ops = interessados(base, j).filter(ci => ci !== meu && base.elencos[ci].length < 38 && vontade(base, s, j, ci) >= 45);
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
  const pesoIdade = i => i <= 20 ? 4 : i <= 23 ? 2.5 : i <= 26 ? 1.2 : 0.4;
  for (const ci of base.clubes.map((c, i) => i).filter(i => BR.includes(base.clubes[i].div) && i !== meu)) {
    if (r() > { A: 0.16, B: 0.06, C: 0.015 }[base.clubes[ci].div] || base.elencos[ci].length <= 24) continue;
    const cands = base.elencos[ci].filter(j => j.idade <= 31 && j.pot >= 66 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && vendedorAguenta(base, s, j));
    if (!cands.length) continue;
    const j = pickW(r, cands, x => Math.max(0.2, x.pot - 65) * pesoIdade(x.idade)), arabia = j.idade >= 27 && j.ovr >= 76 && r() < 0.5;
    const ops = fora.filter(c => {
      const k = base.clubes[c], saudita = k.liga === 'Saudi Pro League';
      if (arabia !== saudita || base.elencos[c].length >= 40 || rivais(base, c, ci)) return false;
      return (arabia || (j.pot >= 80 ? k.tier >= 3 : k.tier <= 3)) && j.ovr >= base.forca(c) - (j.idade <= 21 ? 14 : 6);
    });
    if (!ops.length) continue;
    const para = pickW(r, ops, c => base.clubes[c].fan), valor = precoExterior(base, s, j, r, para);
    if (caixaDe(base, s, para) * 3 < valor) continue;
    mover(j, para, valor);
    add(`${valor >= 5e6 ? 'HERE WE GO! ' : ''}Venda para o exterior: ${j.curto} (${j.idade} anos) troca o ${nome(ci)} pelo ${nome(para)} (${base.clubes[para].liga}) por ${fmt(valor)}.`, 'mercado', base.clubes[ci].div, { jogador: j.id });
    const rep = livres.filter(x => x.pos === j.pos && x.ovr >= base.forca(ci) - 10 && x.ovr <= base.forca(ci) + 3).sort((a, b) => b.ovr - a.ovr)[0];
    if (rep) { mover(rep, ci, 0); add(`Para o lugar de ${j.curto}, o ${nome(ci)} contrata ${rep.curto}, que estava sem clube.`, 'mercado', base.clubes[ci].div, { jogador: rep.id }); }
  }
  // repatriação: brasileiro lá fora com 27 a 34 anos volta para clube daqui que precisa da posição (veterano sai barato)
  for (let k = 0; k < 2; k++) {
    if (r() > 0.4) continue;
    const volta = [...base.jog.values()].filter(j => j.nat === 'BRA' && base.clubes[j.clube].div === 'X' && j.idade >= 27 && j.idade <= 34 && j.ovr >= 68 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && !travado(s, j.id));
    const j = volta.length ? pickW(r, volta, x => x.idade - 25) : null;
    const ops = j ? base.clubes.map((c, i) => i).filter(ci => ['A', 'B'].includes(base.clubes[ci].div) && ci !== meu && base.elencos[ci].length < 36
      && j.ovr >= base.forca(ci) - 2 && j.ovr <= base.forca(ci) + 10 && base.elencos[ci].filter(x => x.pos === j.pos && x.ovr >= j.ovr).length < 2) : [];
    if (!ops.length) continue;
    const para = pickW(r, ops, ci => base.clubes[ci].fan), valor = arred(j.valor * 1000 * (j.idade >= 29 ? 0.75 : 1) * fatorContrato(mesesDeContrato(s, j)) * (0.9 + r() * 0.2));
    if (caixaDe(base, s, para) * 0.6 < valor) continue;
    const de = mover(j, para, valor);
    add(`${valor >= 5e6 ? 'HERE WE GO! ' : ''}De volta ao Brasil: ${j.curto} (${j.idade} anos) deixa o ${nome(de)} e acerta com o ${nome(para)} por ${fmt(valor)}.`, 'mercado', base.clubes[para].div, { jogador: j.id });
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
// IA renova cedo quem tem nível e quer ficar; quem não tem nível ou quer sair (minutos, temperamento, interesse de
// clube maior, fase) fica sem renovar e sai de graça no fim do ano (ou assina pré-contrato com outro)
function renovacoesIA(base, s, rd, add) {
  if (rd < 6 || rd > 34) return;
  s.renovIA ||= {};
  const meu = s.tecnico.clube; let mudou = false;
  for (const ci of base.clubes.map((c, i) => i).filter(i => BR.includes(base.clubes[i].div) && i !== meu)) {
    const el = base.elencos[ci], ord = el.slice().sort((a, b) => b.ovr - a.ovr), f = base.forca(ci), nome = base.clubes[ci].n, div = base.clubes[ci].div;
    let saem = el.filter(x => ['sai', 'dispensa', 'aposenta'].includes(s.renovIA[x.id]?.ano === s.ano && s.renovIA[x.id].d)).length;  // elenco não pode esvaziar
    for (const j of el) {
      if (j.contrato > s.ano || s.renovIA[j.id]?.ano === s.ano || s.emprestimos[j.id] || preContratoDe(s, j.id)) continue;
      const rr = rng(`renIA${s.seed}${s.ano}${j.id}`);
      if (rd !== 6 + Math.floor(rr() * 24)) continue;        // cada um tem a sua rodada de conversa
      if (vaiAposentar(s, j)) { s.renovIA[j.id] = { ano: s.ano, d: 'aposenta' }; continue; }
      const rank = ord.indexOf(j), pct = (s.est?.[j.id]?.[0] || 0) / Math.max(1, rd), t = temperamento(j);
      if ((rank >= 25 || j.ovr < f - 10 || (j.idade >= 33 && j.ovr < f - 4)) && el.length - saem > 26) {
        s.renovIA[j.id] = { ano: s.ano, d: 'dispensa' }; saem++;
        if (j.ovr >= 72) add(`O ${nome} não vai renovar com ${j.curto}, que fica livre no fim do ano.`, 'mercado', div, { jogador: j.id, de: ci });
        continue;
      }
      const quer = 60 + (rank < 16 && pct < 0.3 ? -20 : 0) + ({ ambicioso: -12, temperamental: -5, sensivel: 0, profissional: 6 }[t]) + (faseDe(s, j.id).d > 0 && j.idade <= 29 && interessados(base, j).length ? -20 : 0) + (j.idade >= 31 ? 12 : 0) + (rr() - 0.5) * 30;
      if (quer < 40 && el.length - saem > 24) {
        s.renovIA[j.id] = { ano: s.ano, d: 'sai' }; saem++;
        if (j.ovr >= 72) add(`${j.curto} recusa renovar com o ${nome} e pode sair de graça no fim do ano.`, 'rumor', div, { jogador: j.id, de: ci });
        continue;
      }
      const anos = j.idade >= 31 ? 1 + Math.floor(rr() * 2) : 2 + Math.floor(rr() * 3);
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
  const r = rng(`mercado${s.seed}-${rd}${semana ? `-s${semana}` : ''}`), meu = s.tecnico.clube, N = [];
  const aberta = x => !!semana || janelaAberta(s.ano, x);
  const nome = ci => base.clubes[ci].n;
  const add = (texto, tipo = 'clube', div = base.clubes[meu].div, extra) => N.push({ rodada: rd + 1, tipo, div, texto, mercado: true, ...extra });
  for (const [id, c] of Object.entries(s.chegou)) if (agora(s) - c >= TRAVA) delete s.chegou[id];
  if (s.acordos.length && aberta(rd + 1)) cumprirAcordos(base, s, add);
  for (const [id, e] of Object.entries(s.emprestimos)) {
    const j = base.jog.get(+id), jogou = jogosNoEmprestimo(s, id);
    if (j && e.obrig?.gatilho === 'jogos' && jogou >= e.obrig.jogos) { efetivar(base, s, j, e, e.obrig.valor, 'Obrigação de compra'); add(`Obrigação de compra acionada: ${j.curto} completa ${jogou} jogos pelo ${nome(e.para)} e fica em definitivo por ${fmt(e.obrig.valor)}.`, 'clube', base.clubes[meu].div, { jogador: j.id }); }
  }

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
    const fechada = ['compra', 'emprestimo'].includes(tipo) && !aberta(rd + 1), vt = t ? valorNaTroca(base, s, t, j.clube) : 0;
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
    if (tipo === 'emprestimo' && !p.clubeOk) {
      const cl = p.cl || limpaCl(base, s, j);
      if (notaEmprestimo(base, s, j, cl) + (r() - 0.5) * 12 < 50) { const m = motivoEmp(base, s, j, cl); falha(`o clube ${m}`, `O ${nome(j.clube)} não empresta ${j.curto}: ${m}.`); continue; }
      p.clubeOk = true;
    }
    // disputa por livre e pré-contrato: clubes que também fariam sentido entram na briga (na compra, a briga é o leilão)
    let melhorRival = null;
    if (tipo !== 'emprestimo' && tipo !== 'compra' && !fechada) {
      const rivais = interessados(base, j).filter(ci => ci !== meu && r() < 0.25).slice(0, 2);
      for (const ci of rivais) add(`O ${nome(ci)} também quer ${j.curto}.`);
      melhorRival = rivais.map(ci => ({ ci, v: vontade(base, s, j, ci) + (r() - 0.5) * 16 })).sort((a, b) => b.v - a.v)[0];
    }
    const minha = vontade(base, s, j, meu, p.promessa) + (r() - 0.5) * 16 + (tipo === 'emprestimo' ? 10 : 0);
    if (minha < 50) { falha(`${j.curto} ${motivoRecusa(base, s, j)}`, `${j.curto} recusa: ${motivoRecusa(base, s, j)}.`); continue; }
    if (melhorRival && melhorRival.v > minha) {
      p.estado = 'perdida'; p.motivo = `ele escolheu o ${nome(melhorRival.ci)}`;
      if (tipo === 'pre') s.preContratos.push({ jogador: j.id, de: j.clube, para: melhorRival.ci, rodada: rd });
      else { transferir(base, s, j, melhorRival.ci, 0); s.historicoTransf[0].ia = true; }
      add(`${j.curto} escolhe o ${nome(melhorRival.ci)}${tipo === 'pre' ? ' e assina pré-contrato' : ' e vai jogar lá'}.`, 'mercado', base.clubes[melhorRival.ci].div, { jogador: j.id });
      continue;
    }
    // salário: abaixo de 90% do que pede, ele faz contraproposta; entre 90% e 100%, pode topar
    const pede = tipo === 'emprestimo' ? 0 : salarioPedido(base, s, j, p.anos, meu, p.promessa);
    if (!p.salOk && p.salario < pede && !(p.salario >= pede * 0.9 && r() < (p.salario / pede - 0.9) * 10)) {
      p.estado = 'contraproposta'; p.contraSal = pede; add(`${j.curto} topa vir, mas pede € ${pede.toLocaleString('pt-BR')}/dia.`); continue;
    }
    if (tipo === 'compra' && p.valor > s.caixa) { falha('faltou dinheiro em caixa'); continue; }
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
  for (const x of s.recebidas.filter(x => (x.leilao === 'aberto' || (x.leilao === 'vivo' && s.leilaoAtivo?.id !== x.id)) && x.rodada <= rd)) {
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
  if (aberta(rd + 1)) {
    // gigante europeu ou árabe aparece pelo seu craque, de vez em quando, com dinheiro de sobra
    const craques = base.elencos[meu].filter(j => (j.ovr >= 77 || (j.ovr >= 73 && faseDe(s, j.id).k === 'excelente')) && j.idade <= 33 && !s.emprestimos[j.id] && !preContratoDe(s, j.id) && !travado(s, j.id) && !s.recebidas.some(x => x.jogador === j.id));
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
      if (s.emprestimos[j.id] || preContratoDe(s, j.id) || travado(s, j.id) || emAcordo(s, j.id) || s.recebidas.some(x => x.jogador === j.id)) continue;
      const listado = s.listas.venda.includes(j.id);
      if (s.listas.emprestimo.includes(j.id)) {
        if (r() > 0.3) continue;
        const opcoes = base.clubes.map((c, i) => i).filter(ci => BR.includes(base.clubes[ci].div) && ci !== meu && base.elencos[ci].filter(x => x.ovr > j.ovr).length < 14);
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
      let opcoes = interessados(base, j);
      if ((listado || queda) && !opcoes.length) opcoes = base.clubes.map((c, i) => i).filter(ci => BR.includes(base.clubes[ci].div) && ci !== meu && !rivais(base, ci, meu) && Math.abs(base.forca(ci) - j.ovr) <= 5);
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
    const opcoes = interessados(base, j); if (!opcoes.length) continue;
    const para = pickW(r, opcoes, ci => base.clubes[ci].fan);
    s.preContratos.push({ jogador: j.id, de: meu, para, rodada: rd });
    add(`${j.curto} assina pré-contrato com o ${nome(para)} e sai no fim da temporada. Renove os contratos que estão acabando.`);
  }

  // chateado por não ter sido liberado: moral não sobe e, de vez em quando, ele cobra em público
  for (const [id, q] of Object.entries(s.querSair || {})) {
    const j = base.jog.get(+id);
    if (!j || j.clube !== meu || (!q.queda && rd - q.rodada >= 8) || (q.queda && q.queda.ano !== s.ano)) { delete s.querSair[id]; continue; }
    if (q.queda && !aberta(rd + 1)) { rescisaoDaQueda(base, s, j, q.queda.multa, add); continue; }
    s.mor[id] = Math.min(s.mor[id] ?? 62, 45);
    if (r() < 0.15) add(q.queda ? `${j.curto} avisa: "Não jogo a Série ${q.queda.div}. Se a janela fechar e eu estiver aqui, rescindo."` : `${j.curto} cobra a diretoria: "Eu ${q.motivo.replace(/^é /, 'tinha ')}. Quero ser negociado."`, 'clube', base.clubes[meu].div, { jogador: j.id, imprensa: true });
  }
  rebaixadosIA(base, s, rd, r, aberta(rd + 1), add);
  renovacoesIA(base, s, rd, add);
  novelas(base, s, rd, add);
  if (aberta(rd)) negociosIA(base, s, rd, r, add);
  trabalhoDoOlheiro(base, s, rd, r);
  if (s.historicoTransf.length > 400) s.historicoTransf.length = 400;
  s.noticias = [...N, ...s.noticias].slice(0, 220);
}
