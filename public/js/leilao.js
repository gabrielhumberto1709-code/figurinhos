// Sala do leilão. O Dr. Arremate explica as regras, o botão Começar solta o relógio de 30 s e cada lance (seu ou da
// IA) volta o relógio. Durante o leilão a tela se atualiza em pedaços (relógio, placar, placas, falas), sem redesenhar
// tudo, para o relógio correr liso no celular. Martelo batido: carimbo "Arrematado" na figurinha e o resultado.
import * as Lm from './motor/leilao.js';
import { aceitarRecebida, recusarRecebida, responderProposta } from './motor/mercado.js';
import { cartaDe, valorCurto, lerValor } from './motor/util.js';
import { urlRosto, urlEscudo, urlLeiloeiro } from './pixel.js';
import { SOM } from './sons.js';

let H; // { app, clube, esc, $, aviso, render, salvar }
export const configurar = h => { H = h; };
const S = () => H.app.s, B = () => H.app.base, $ = sel => document.querySelector(sel);
const V = { raf: 0, ts: 0, seg: -1 };
const O = ci => `o ${H.clube(ci).n}`, Oo = ci => `O ${H.clube(ci).n}`;
const juntar = l => l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l.at(-1)}`;
const sala = () => S()?.leilaoAtivo || H.app.leilaoFim?.L || null;

// ---------- falas ----------
function abertura(L) {
  const j = B().jog.get(L.jogador), meu = S().tecnico.clube, outros = Object.keys(L.P).map(Number).filter(ci => ci !== meu && ci !== L.lider);
  if (L.modo === 'compra') {
    const rv = Object.keys(L.P).map(Number).filter(ci => ci !== meu);
    return `${L.tarde ? `Parem tudo! Enquanto o ${H.clube(L.vendedor).n} pensava na sua proposta, ` : 'Dr. Arremate na casa! '}${juntar(rv.map((ci, i) => i || L.tarde ? O(ci) : Oo(ci)))} também ${rv.length > 1 ? 'querem' : 'quer'} ${j.curto}: vai a leilão. Sua proposta (${Lm.fmtLance(L.valor)}) abre a sala. Cada lance volta o relógio a 30 s; zerou, bato o martelo e leva quem deu mais. O salário você acerta depois, com ele. Quem pisca, perde!`;
  }
  return outros.length
    ? `${Oo(L.lider)} ofereceu ${Lm.fmtLance(L.valor)} por ${j.curto} e chamei a concorrência: ${juntar(outros.map(O))}. Cada lance volta o relógio a 30 s. Bati o martelo, você decide se vende pelo maior lance. Quem pisca, perde!`
    : `${Oo(L.lider)} ofereceu ${Lm.fmtLance(L.valor)} por ${j.curto}. Chamei a praça inteira, mas ninguém mais apareceu. Bati o martelo, a decisão sobre a oferta é sua.`;
}
function falaLance(L, ci, v) {
  if (L.P[ci]?.humano) return `Lance seu: ${Lm.fmtLance(v)}! A sala se mexe.`;
  const n = H.clube(ci).n;
  return [`${Oo(ci)} cobre: ${Lm.fmtLance(v)}!`, `${Lm.fmtLance(v)} do ${n}! Quem dá mais?`, `Placa no ar: ${n}, ${Lm.fmtLance(v)}!`][L.lances.length % 3];
}
function falaFim(L, res) {
  const j = B().jog.get(L.jogador), v = Lm.fmtLance(L.valor);
  if (res?.erro) return `O martelo bateu, mas ${res.erro.toLowerCase()}`;
  if (L.modo === 'compra') return res.venceu ? `Vendido! ${j.curto} é do ${H.clube(S().tecnico.clube).n} por ${v}. ${res.resposta || ''}` : `Vendido ${O(L.lider).replace(/^o /, 'ao ')} por ${v}! Não foi dessa vez.`;
  return L.lances.length > 1 ? `Martelo batido: ${O(L.lider)} leva por ${v}. A decisão é sua.` : `Ninguém cobriu: fica a oferta ${O(L.lider).replace(/^o /, 'do ')}, ${v}. A decisão é sua.`;
}

// ---------- cena ----------
const MARTELO = '<svg class="lei-martelo" viewBox="0 0 24 10" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="3" width="2" height="4" fill="#3A1F0E"/><rect x="2" y="4" width="12" height="2" fill="#8A5530"/><rect x="2" y="4" width="12" height="1" fill="#A86A3D"/><rect x="14" y="1" width="9" height="8" fill="#4A2A14"/><rect x="15" y="1" width="1" height="8" fill="#C9A25A"/><rect x="21" y="1" width="1" height="8" fill="#C9A25A"/><rect x="16" y="2" width="5" height="1" fill="#6B3E1E"/></svg>';
function placas(L) {
  return Object.entries(L.P).map(([ci, p]) => { const c = H.clube(+ci); return `<span class="lei-placa ${+ci === L.lider ? 'no-ar' : ''} ${p.fora ? 'fora' : ''}" data-ci="${ci}"><span class="lei-disco"><img class="px" src="${urlEscudo(c)}" alt=""></span><small>${p.humano ? 'Você' : H.esc(c.s || c.n)}</small></span>`; }).join('');
}
function cena(L, vendido) {
  const j = B().jog.get(L.jogador), c = H.clube(j.clube);
  return `<div class="lei-cena ${vendido ? 'vendido' : ''}" aria-hidden="true">
    <div class="lei-placar"><span class="lei-lote">Lote<b>${H.esc(j.curto)}</b></span><b class="lei-valor" id="lei-valor">${Lm.fmtLance(L.valor)}</b></div>
    <img class="px lei-dr" src="${urlLeiloeiro()}" alt="">
    <div class="lei-pulpito"><span>Dr. Arremate</span></div>${MARTELO}
    <div class="lei-carta"><img class="px" src="${urlRosto(j.rosto, c)}" alt=""><b>${H.esc(j.curto)}</b><span class="nota ${cartaDe(j.ovr).k}">${j.ovr}</span><i class="lei-carimbo">Arrematado</i></div>
    <div class="lei-plateia" id="lei-plateia">${placas(L)}</div></div>`;
}
const linhaLog = (L, x) => `<li><span>${H.imgEscudo(x.ci, 16, 17)} ${L.P[x.ci]?.humano ? 'Você' : H.esc(H.clube(x.ci).n)}</span><b>${Lm.fmtLance(x.valor)}</b></li>`;
const log = L => L.lances.slice().reverse().map(x => linhaLog(L, x)).join('');
function status(L) {
  const meu = S().tecnico.clube;
  if (L.fim) return L.lider === meu ? `Arrematado por você: <b>${Lm.fmtLance(L.valor)}</b>` : `Arrematado pelo ${H.esc(H.clube(L.lider).n)}: <b>${Lm.fmtLance(L.valor)}</b>`;
  if (L.modo === 'venda') return `Maior lance: <b>${Lm.fmtLance(L.valor)}</b>, ${H.esc(O(L.lider))}`;
  return L.lider === meu ? `Você lidera com <b>${Lm.fmtLance(L.valor)}</b>` : `${H.esc(Oo(L.lider))} lidera com <b>${Lm.fmtLance(L.valor)}</b>`;
}
const emMi = v => valorCurto(v, 2);

export function tela() {
  const L = sala();
  if (!L) return '<section class="cartao"><p class="mudo">Nenhum leilão aberto.</p><a class="botao sec" href="#/mercado">Voltar ao Mercado</a></section>';
  const s = S(), b = B(), j = b.jog.get(L.jogador), meu = s.tecnico.clube, fim = H.app.leilaoFim, eu = L.P[meu];
  const topo = `<div class="titulo-linha"><h2>Leilão</h2><span class="mudo">${L.modo === 'compra' ? 'Você está comprando' : 'Você está vendendo'}</span></div>`;
  const balao = `<div class="lei-balao" role="status" aria-live="polite"><b>Dr. Arremate</b><p id="lei-fala">${H.esc(fim ? falaFim(L, fim.res) : L.comecou ? (H.app.leilaoFala || 'Valendo!') : abertura(L))}</p></div>`;
  if (fim) {
    const r = fim.res || {}, botoes = L.modo === 'venda' && r.id && !r.erro
      ? `${r.quer ? `<p class="quer-ir">${H.esc(j.curto)} ${H.esc(r.quer)} e quer ir. Se você recusar, ele fica chateado.</p>` : ''}<div class="linha-botoes"><button class="botao" type="button" data-acao="lei-vender">Vender por ${Lm.fmtLance(L.valor)}</button><button class="botao sec" type="button" data-acao="lei-recusar">Recusar</button></div><a class="botao sec peq" href="#/mercado" data-acao="lei-depois">Decidir depois, no Mercado</a>`
      : '<a class="botao" href="#/mercado" data-acao="lei-depois">Voltar ao Mercado</a>';
    return `${topo}${cena(L, true)}${balao}<section class="cartao lei-mesa"><p>${status(L)}</p>${botoes}</section><section class="cartao"><h3>Lances</h3><ol class="lei-log">${log(L)}</ol></section>`;
  }
  if (!L.comecou) return `${topo}${cena(L)}${balao}<section class="cartao lei-mesa">
      <button class="botao grande" type="button" data-acao="lei-comecar">Começar</button>
      ${L.modo === 'compra' ? `<p class="mudo">Você pode gastar até ${Lm.fmtLance(eu.max)} (caixa e orçamento de compras). Sair da sala conta como desistência: os outros seguem disputando.</p>` : '<p class="mudo">Você só assiste: os clubes disputam entre eles.</p>'}</section>`;
  const mesa = L.modo === 'compra' ? `<form class="lei-form" data-form="lance">
      <label>Seu lance <input type="text" name="valor" inputmode="text" autocomplete="off" spellcheck="false" data-dinheiro value="${emMi(Lm.minimo(L))}" ${eu.fora ? 'disabled' : ''}><small class="dinheiro-prev">Ex.: 500 mil, 5M ou 5,5M</small></label>
      <div class="chips">${[['Mínimo', 0], ['+5%', 0.05], ['+10%', 0.1]].map(([t, f]) => `<button type="button" class="chip" data-acao="lei-sug" data-f="${f}" ${eu.fora ? 'disabled' : ''}>${t}</button>`).join('')}</div>
      <p class="erro" role="alert"></p>
      <div class="linha-botoes"><button class="botao" type="submit" id="lei-dar" ${eu.fora || L.lider === meu ? 'disabled' : ''}>Dar lance</button><button class="botao sec" type="button" data-acao="lei-desistir" id="lei-sair" ${eu.fora || L.lider === meu ? 'disabled' : ''}>Desistir</button></div>
      <p class="mudo" style="font-size:.95rem">${eu.fora ? 'Você saiu do leilão. Os outros seguem até o martelo.' : `Até ${Lm.fmtLance(eu.max)} (caixa e orçamento de compras).`}</p></form>` : '';
  return `${topo}${cena(L)}${balao}<section class="cartao lei-mesa">
      <div class="lei-tempo"><b id="lei-seg">${Math.ceil(L.relogio)}</b><span class="lei-barra"><i id="lei-barra" style="transform:scaleX(${L.relogio / Lm.RELOGIO})"></i></span></div>
      <p id="lei-status">${status(L)}</p>${mesa}</section>
    <section class="cartao"><h3>Lances</h3><ol class="lei-log" id="lei-log">${log(L)}</ol></section>`;
}

// ---------- relógio ----------
function desenharRelogio(L) {
  const seg = Math.ceil(L.relogio), b = $('#lei-barra');
  if (b) b.style.transform = `scaleX(${Math.max(0, L.relogio / Lm.RELOGIO)})`;
  if (seg !== V.seg) { V.seg = seg; const el = $('#lei-seg'); if (el) { el.textContent = seg; el.classList.toggle('urgente', seg <= Lm.UMA); } }
}
function falar(t) { H.app.leilaoFala = t; const el = $('#lei-fala'); if (el) el.textContent = t; }
function bater(leve) {
  const m = $('.lei-martelo'); if (!m) return;
  m.classList.remove('bate', 'toca'); void m.offsetWidth; m.classList.add(leve ? 'toca' : 'bate');
  (leve ? SOM.batidinha : SOM.martelo)();
}
function aplicar(L, e) {
  const meu = S().tecnico.clube;
  if (e.tipo === 'lance') {
    SOM.lance();
    $('#lei-valor') && ($('#lei-valor').textContent = Lm.fmtLance(e.valor));
    for (const p of document.querySelectorAll('.lei-placa')) p.classList.toggle('no-ar', +p.dataset.ci === L.lider);
    $('#lei-log')?.insertAdjacentHTML('afterbegin', linhaLog(L, L.lances.at(-1)));
    $('#lei-status') && ($('#lei-status').innerHTML = status(L));
    const f = $('.lei-form');
    if (f) {
      const lidero = L.lider === meu, min = Lm.minimo(L);
      for (const id of ['#lei-dar', '#lei-sair']) { const b = $(id); if (b) b.disabled = lidero || L.P[meu].fora; }
      if (!lidero && !(lerValor(f.valor.value) >= min)) f.valor.value = emMi(min);
      f.querySelector('.erro').textContent = '';
    }
    falar(falaLance(L, e.ci, e.valor));
  } else if (e.tipo === 'sai') {
    document.querySelector(`.lei-placa[data-ci="${e.ci}"]`)?.classList.add('fora');
    falar(`${H.clube(e.ci).n} baixa a placa.`);
  } else if (e.tipo === 'uma') { falar('Dou-lhe uma…'); bater(true); }
  else if (e.tipo === 'duas') { falar('Dou-lhe duas…'); bater(true); }
  else if (e.tipo === 'vendido') {
    const res = Lm.fecharLeilao(B(), S());
    if (res?.venceu) res.resposta = responderProposta(B(), S(), L.id); // a conversa com ele sai na hora
    H.app.leilaoFim = { res, L }; H.app.leilaoFala = null;
    SOM.martelo(); H.salvar(); H.render();
  }
}
function loop(ts) {
  const L = S()?.leilaoAtivo;
  if (!L || !L.comecou || L.fim || H.app.aba !== 'leilao') { V.raf = 0; return; }
  const dt = V.ts ? Math.min(0.25, (ts - V.ts) / 1000) : 0; V.ts = ts;  // aba escondida = leilão parado
  for (const e of Lm.tickLeilao(L, dt)) aplicar(L, e);
  if (!L.fim) { desenharRelogio(L); V.raf = requestAnimationFrame(loop); }
}
// chamado depois de desenhar a tela: liga o relógio se o leilão está correndo
export function aoMostrar() {
  cancelAnimationFrame(V.raf); V.ts = 0; V.seg = -1;
  const L = S()?.leilaoAtivo;
  if (L?.comecou && !L.fim) V.raf = requestAnimationFrame(loop);
}
// sair da tela no meio conta como desistência: a sala termina sem você
export function podeSair() {
  const L = S()?.leilaoAtivo;
  if (!L) { H.app.leilaoFim = null; return true; }
  if (!L.fim && !confirm('Sair agora conta como desistência: os outros seguem disputando e o resultado vale. Sair mesmo?')) return false;
  cancelAnimationFrame(V.raf);
  const res = Lm.encerrarPendente(B(), S()); H.app.leilaoFim = null; H.app.leilaoFala = null;
  if (res && !res.erro) H.aviso(res.modo === 'venda' ? 'Leilão encerrado: a oferta vencedora está em Mercado › Propostas.' : res.venceu ? 'Ninguém cobriu: o leilão é seu. Falta o salário.' : `Você perdeu o leilão para o ${H.clube(res.ci).n}.`);
  H.salvar();
  return true;
}

// ---------- ações ----------
export function darLance(form) {
  const L = S().leilaoAtivo, meu = S().tecnico.clube; if (!L) return;
  const v = lerValor(form.valor.value);
  const e = Lm.lanceLeilao(L, meu, v);
  if (e) { form.querySelector('.erro').textContent = e; return; }
  aplicar(L, { tipo: 'lance', ci: meu, valor: L.valor }); H.salvar();
}
export const acoes = {
  'lei-comecar': () => { const L = S().leilaoAtivo; if (!L) return; Lm.comecarLeilao(L); H.app.leilaoFala = 'Valendo! O relógio está correndo.'; SOM.batidinha(); H.salvar(); H.render(); },
  'lei-sug': el => { const L = S().leilaoAtivo, f = el.closest('form'); if (!L || !f) return; const min = Lm.minimo(L); f.valor.value = emMi(Math.max(min, Math.round(L.valor * (1 + +el.dataset.f) / 1e4) * 1e4)); },
  'lei-desistir': () => { const L = S().leilaoAtivo, meu = S().tecnico.clube; if (!L) return; const e = Lm.desistirLeilao(L, meu); if (e) return H.aviso(e); falar('Você baixa a placa. A sala segue sem você.'); document.querySelector(`.lei-placa[data-ci="${meu}"]`)?.classList.add('fora'); H.salvar(); H.render(); },
  'lei-vender': () => { const r = H.app.leilaoFim?.res; H.app.leilaoFim = null; H.aviso(aceitarRecebida(B(), S(), r?.id) || 'Negócio fechado.'); H.salvar(); location.hash = '#/mercado'; },
  'lei-recusar': () => { const r = H.app.leilaoFim?.res; H.app.leilaoFim = null; const m = recusarRecebida(B(), S(), r?.id); H.aviso(m || 'Oferta recusada.'); H.salvar(); location.hash = '#/mercado'; },
  'lei-depois': () => { H.app.leilaoFim = null; H.app.abaMercado = 'propostas'; location.hash = '#/mercado'; },
};
