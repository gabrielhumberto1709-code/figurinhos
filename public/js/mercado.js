// Aba Mercado: Buscar (atalhos, séries, posições e filtros), Favoritos, Listas, Livres, Pré-contrato, Olheiros,
// Propostas e Histórico. Também o bloco de mercado e contrato da ficha do jogador.
import { janelaAberta, dataRodada, barradoMedo, pagarMedo, multaMedo, barrado12, LIMITE_12 } from './motor/mundo.js';
import * as M from './motor/mercado.js';
import { abrirLeilaoCompra, abrirLeilaoVenda } from './motor/leilao.js';
import { orcamento, salarioDia, salarioBase, tetoSalarial } from './motor/financas.js';
import { faseDe } from './motor/forma.js';
import { POS_NOME, POS_ORDEM, SETOR, cartaDe, estrelas, fmtDinheiro, valorCurto, lerValor, CONTINENTES, continenteDe } from './motor/util.js';
import { urlRosto } from './pixel.js';
import { dataAmistoso, JANELAS, doAno } from './motor/calendario.js';

let H; // { app, clube, esc, imgEscudo, render, salvar, aviso, $ }
export const configurar = h => { H = h; };
const S = () => H.app.s, B = () => H.app.base;

const ABAS = [['buscar', 'Buscar'], ['favoritos', 'Favoritos'], ['listas', 'Listas'], ['livres', 'Livres'], ['pre', 'Pré-contrato'], ['olheiros', 'Olheiros'], ['propostas', 'Propostas'], ['historico', 'Histórico']];
const RAPIDOS = [['teto', 'Cabem no teto'], ['bolso', 'Cabem no bolso'], ['barganha', 'Barganhas'], ['jovem', 'Jovens promessas'], ['contrato', 'Contrato acabando']];
const GRUPOS = [['', 'Todos'], ['GOL', 'GOL'], ['DEF', 'DEF'], ['MEI', 'MEI'], ['ATA', 'ATA']];
const SITUACOES = [['todos', 'Todos'], ['favoritos', 'Favoritos'], ['livres', 'Livres'], ['pre', 'Pré-contrato'], ['venda', 'Lista de transferências'], ['emprestimo', 'Lista de empréstimo'], ['fim', 'Contrato no fim']];
const ORDENS = [['ovr', 'Overall'], ['valor-', 'Mais caros'], ['valor+', 'Mais baratos'], ['idade', 'Mais jovens'], ['sal', 'Maior salário'], ['nome', 'Nome']];
const FAIXAS = {
  ovr: { rot: 'Overall', min: 40, max: 99 },
  idade: { rot: 'Idade', min: 16, max: 42 },
  valor: { rot: 'Valor de mercado', passos: [0, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6, 100e6, Infinity] },
  sal: { rot: 'Salário por dia', passos: [0, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, Infinity] },
};
const TAG_SIT = { livre: 'Livre', venda: 'À venda', emprestimo: 'Empréstimo', fim: 'Fim de contrato', pre: 'Pré-contrato', emprestado: 'Emprestado', aposenta: 'Vai se aposentar' };
const ROTULO = { aguardando: 'Aguardando resposta', contraproposta: 'Contraproposta', recusada: 'Recusada', perdida: 'Perdida para rival', concluida: 'Fechado', cancelada: 'Cancelada' };
const NOME_TIPO = { compra: 'Compra', livre: 'Livre', pre: 'Pré-contrato', emprestimo: 'Empréstimo' };

const filtroPadrao = () => ({ q: '', rapido: '', grupo: '', pos: [], sit: 'todos', cont: '', ligas: [], ovr: [40, 99], idade: [16, 42], valor: [0, 12], sal: [0, 9], ord: 'ovr', n: 50 });
const filtro = () => H.app.fMercado || (H.app.fMercado = filtroPadrao());
export const filtroSetor = st => { H.app.fMercado = { ...filtroPadrao(), grupo: st }; };
const norm = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const passo = (k, i) => FAIXAS[k].passos[i];
const rotFaixa = (k, [a, b]) => FAIXAS[k].passos ? `${fmtPasso(k, a)} – ${fmtPasso(k, b)}` : `${a} – ${b}`;
const fmtPasso = (k, i) => { const v = passo(k, i); return v === Infinity ? 'sem limite' : k === 'sal' ? `€ ${v.toLocaleString('pt-BR')}` : fmtDinheiro(v); };
const euro = v => `€ ${Math.round(v).toLocaleString('pt-BR')}`;
const filtrosAtivos = f => (!H.app.sitFixa && f.sit !== 'todos') + (f.pos.length > 0) + !!f.cont + ['ovr', 'idade', 'valor', 'sal'].filter(k => { const d = filtroPadrao()[k]; return f[k][0] !== d[0] || f[k][1] !== d[1]; }).length;

// ---------- busca ----------
// liga de cada clube; quem está sem clube entra como "Livres". Nenhuma marcada = todas
const ligaDe = c => c.div === 'L' ? 'Livres' : c.liga || `Série ${c.div}`;
function filtrar(f = filtro(), sit = H.app.sitFixa || f.sit) {
  const s = S(), b = B(), meu = s.tecnico.clube, L = M.listasIA(b, s), o = orcamento(b, s), divMeu = b.clubes[meu].div, q = norm(f.q), ligas = f.ligas || [], teto = tetoSalarial(b, s).teto;
  const out = [];
  for (const j of b.jog.values()) {
    if (j.clube === meu) continue;
    const c = b.clubes[j.clube], livre = c.div === 'L';
    if (ligas.length && sit !== 'livres' && !ligas.includes(ligaDe(c))) continue; // na aba Livres a liga não conta
    if (f.grupo && SETOR[j.pos] !== f.grupo) continue;
    if (f.pos.length && !f.pos.includes(j.pos)) continue;
    if (j.ovr < f.ovr[0] || j.ovr > f.ovr[1] || j.idade < f.idade[0] || j.idade > f.idade[1]) continue;
    const valor = j.valor * 1000;
    if (valor < passo('valor', f.valor[0]) || valor > passo('valor', f.valor[1])) continue;
    if (f.cont && continenteDe(j.nat) !== f.cont) continue;
    const fim = !livre && M.contratoNoFim(s, j);
    if (sit === 'favoritos' && !s.favoritos.includes(j.id) || sit === 'livres' && !livre || sit === 'venda' && !L.venda.has(j.id) || sit === 'emprestimo' && !L.emprestimo.has(j.id)
      || (sit === 'fim' || f.rapido === 'contrato') && !fim || sit === 'pre' && !(fim && !M.preContratoDe(s, j.id) && !M.vaiAposentar(s, j))) continue;
    if (f.rapido === 'jovem' && !(j.idade <= 21 && (j.ovr >= 64 || s.relatorios[j.id]?.e >= 4))) continue;
    const sal = salarioDia(b, s, j);
    if (sal < passo('sal', f.sal[0]) || sal > passo('sal', f.sal[1])) continue;
    if (q && !norm(j.nome + ' ' + c.n).includes(q)) continue;
    if (f.rapido === 'bolso' && (M.precoPedido(b, s, j) > o.compras || Math.max(sal, salarioBase(b.clubes[meu], j)) > o.folga)) continue;
    if (f.rapido === 'barganha' && !(livre || M.precoPedido(b, s, j) <= valor * 0.75)) continue;
    if (f.rapido === 'teto' && Math.max(sal, salarioBase(b.clubes[meu], j)) * 1.1 > teto) continue; // estimativa do que ele pediria
    out.push(j);
  }
  const ord = { ovr: (a, b2) => b2.ovr - a.ovr, 'valor-': (a, b2) => b2.valor - a.valor, 'valor+': (a, b2) => a.valor - b2.valor || b2.ovr - a.ovr, idade: (a, b2) => a.idade - b2.idade || b2.ovr - a.ovr, sal: (a, b2) => salarioDia(b, s, b2) - salarioDia(b, s, a), nome: (a, b2) => a.curto.localeCompare(b2.curto) }[f.ord] || ((a, b2) => b2.ovr - a.ovr);
  return out.sort(ord);
}

function linha(j, extra = '') {
  const s = S(), b = B(), c = H.clube(j.clube), sit = M.situacao(b, s, j).filter(t => t !== 'pre' || j.clube === s.tecnico.clube);
  return `<li><button type="button" class="linha-mercado" data-acao="ficha" data-id="${j.id}"><img class="px" src="${urlRosto(j.rosto, c)}" width="32" height="32" alt="" loading="lazy">
    <span class="lm-nome"><b>${s.favoritos.includes(j.id) ? '<span class="fav-mini" aria-label="Favorito">★</span> ' : ''}${H.esc(j.curto)}</b><small>${H.imgEscudo(j.clube, 14, 15)} ${H.esc(c.n)} · ${j.idade} anos</small>
    ${sit.length || extra ? `<span class="lm-tags">${sit.map(t => `<i class="sit ${t}">${TAG_SIT[t]}</i>`).join('')}${extra}</span>` : ''}</span>
    <span class="pos-mini">${j.pos}</span><span class="nota ${cartaDe(j.ovr).k}">${j.ovr}</span><span class="lm-valor">${fmtDinheiro(j.valor * 1000)}</span></button></li>`;
}
const lista = (js, vazio, extra) => js.length ? `<ul class="lista-mercado">${js.map(j => linha(j, extra?.(j))).join('')}</ul>` : `<section class="cartao"><p class="mudo">${vazio}</p></section>`;
const chips = (rot, itens, acao, ativo, extra = '') => `<div class="chips" role="group" aria-label="${rot}">${itens.map(([k, t]) => `<button type="button" class="chip" data-acao="${acao}" data-v="${k}" aria-pressed="${ativo(k)}" ${extra}>${t}</button>`).join('')}</div>`;

// janelas reais (5/jan a 3/mar e 20/jul a 11/set): quanto falta para fechar ou abrir, contando de hoje (último jogo do calendário)
function janelaInfo(s) {
  const aberta = janelaAberta(s.ano, s.rodada, s.ultimaData), hoje = s.ultimaData ?? +dataAmistoso(s.ano, 0);
  for (const [a, b] of JANELAS) {
    const ini = doAno(s.ano, a), fim = doAno(s.ano, b);
    if (aberta && +fim >= hoje) return { aberta, dias: Math.max(0, Math.round((fim - hoje) / 864e5)), data: fim };
    if (!aberta && +ini > hoje) return { aberta, dias: Math.round((ini - hoje) / 864e5), data: ini };
  }
  return { aberta, dias: null };
}
const ddmm = d => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
function faixaJanela(s) {
  const J = janelaInfo(s);
  const txt = J.aberta ? (J.dias != null ? `Janela aberta · fecha em ${J.dias} dias (${ddmm(J.data)})` : 'Janela aberta') : J.dias != null ? `Janela fechada · abre em ${J.dias} dias (${ddmm(J.data)})` : 'Janela fechada até a próxima temporada';
  return `<p class="janela ${J.aberta ? 'aberta' : ''}"><b>${txt}</b><small>Livres e pré-contratos não dependem da janela. Com ela fechada, dá para fechar compra ou empréstimo do mesmo jeito: o negócio fica acertado e o jogador chega quando a janela abrir. A resposta das propostas sai na hora. Pagando a multa rescisória, o clube não pode recusar: só o jogador decide.</small></p>`;
}

function abaBuscar(topo = faixaJanela(S())) {
  const f = filtro(), res = filtrar(f), n = filtrosAtivos(f);
  return `${topo}
    <section class="cartao filtros-mercado">
      <label class="vh" for="busca-mercado">Buscar jogador ou clube</label><input type="search" id="busca-mercado" data-filtro="q" placeholder="Nome do jogador ou clube" value="${H.esc(f.q)}" autocomplete="off">
      ${chips('Atalhos', RAPIDOS, 'm-rapido', k => f.rapido === k)}
      ${chips('Ligas', listaLigas().map(l => [l, l]), 'm-liga', k => (f.ligas || []).includes(k))}
      ${chips('Setor', GRUPOS, 'm-grupo', k => f.grupo === k)}
      <div class="busca-rodape"><span class="mudo" id="conta-mercado">${res.length.toLocaleString('pt-BR')} jogadores</span>
        <button type="button" class="chip" data-acao="m-filtros" aria-haspopup="dialog">Filtros${n ? ` (${n})` : ''}</button>
        <label class="vh" for="ordem-mercado">Ordenar</label><select id="ordem-mercado" data-filtro="ord">${ORDENS.map(([k, t]) => `<option value="${k}" ${f.ord === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    </section>
    <div id="lista-mercado">${listaBusca(res, f)}</div>`;
}
const listaBusca = (res, f) => lista(res.slice(0, f.n), 'Ninguém com esses filtros. Tente afrouxar alguma coisa.') + (res.length > f.n ? `<button class="botao sec" type="button" data-acao="m-mais">Mostrar mais (${(res.length - f.n).toLocaleString('pt-BR')})</button>` : '');

// ---------- filtros (no mesmo dialog da ficha) ----------
function faixa(k) {
  const f = filtro(), F = FAIXAS[k], max = F.passos ? F.passos.length - 1 : F.max, min = F.passos ? 0 : F.min;
  return `<div class="faixa"><div class="faixa-topo"><span>${F.rot}</span><output id="out-${k}">${rotFaixa(k, f[k])}</output></div>
    <div class="faixa-trilho" style="--a:${(f[k][0] - min) / (max - min) * 100}%;--b:${(f[k][1] - min) / (max - min) * 100}%">
      <input type="range" min="${min}" max="${max}" step="1" value="${f[k][0]}" data-faixa="${k}" data-ponta="0" aria-label="${F.rot}: mínimo">
      <input type="range" min="${min}" max="${max}" step="1" value="${f[k][1]}" data-faixa="${k}" data-ponta="1" aria-label="${F.rot}: máximo"></div></div>`;
}
function abrirFiltros() {
  const f = filtro(), d = H.$('#ficha');
  d.innerHTML = `<div class="ficha filtros-dialog"><div class="titulo-linha"><h2>Filtros</h2><button class="botao peq sec" type="button" data-acao="f-limpar">Limpar</button></div>
    ${H.app.sitFixa ? '' : `<section><h3>Situação</h3>${chips('Situação', SITUACOES, 'f-sit', k => f.sit === k)}</section>`}
    <section><h3>Posição</h3>${chips('Posição', POS_ORDEM.map(p => [p, p]), 'f-pos', k => f.pos.includes(k))}</section>
    <section><h3>Continente</h3>${chips('Continente', [['', 'Todos'], ...Object.entries(CONTINENTES)], 'f-cont', k => f.cont === k)}</section>
    ${['ovr', 'idade', 'valor', 'sal'].map(faixa).join('')}
    <button class="botao grande" type="button" data-acao="f-ver" id="f-ver">Ver ${filtrar().length.toLocaleString('pt-BR')} jogadores</button></div>`;
  H.app.filtrosAbertos = true;
  if (!d.open) d.showModal();
}
let _ligas = null;
// ordem fixa e previsível: Brasil, as 5 grandes da Europa, as sul-americanas, o resto em ordem alfabética e Livres
const ORDEM_LIGAS = ['Série A', 'Série B', 'Série C', 'Série D', 'Estadual', 'Premier League', 'LaLiga', 'Serie A (ITA)', 'Bundesliga', 'Ligue 1',
  'Liga Argentina', 'Liga Colombiana', 'Liga Uruguaia', 'Liga Paraguaia', 'Liga Chilena', 'Liga Equatoriana', 'Liga Peruana', 'Liga Boliviana', 'Liga Venezuelana'];
const listaLigas = () => _ligas ||= (() => {
  const tem = new Set([...B().jog.values()].map(j => ligaDe(B().clubes[j.clube]))); tem.delete('Livres');
  return [...ORDEM_LIGAS.filter(l => tem.has(l)), ...[...tem].filter(l => !ORDEM_LIGAS.includes(l)).sort((a, b) => a.localeCompare(b)), 'Livres'];
})();
const atualizarContagem = () => { const b = H.$('#f-ver'); if (b) b.textContent = `Ver ${filtrar().length.toLocaleString('pt-BR')} jogadores`; };

// ---------- outras abas ----------
function abaListas() {
  const s = S(), b = B(), L = M.listasIA(b, s), sub = H.app.abaListas || 'venda';
  const mine = [...s.listas.venda, ...s.listas.emprestimo].map(id => b.jog.get(id)).filter(j => j?.clube === s.tecnico.clube);
  const topo = `${chips('Listas', [['venda', 'À venda'], ['emprestimo', 'Para empréstimo'], ['meus', `Meus listados${mine.length ? ` (${mine.length})` : ''}`]], 'aba-listas', k => sub === k)}
    <p class="mudo">${sub === 'venda' ? 'Os clubes querem se livrar desses: o preço pedido cai bastante.' : sub === 'emprestimo' ? 'Garotos sem espaço em clube grande: o clube empresta fácil. Você paga o salário.' : 'Seus jogadores listados recebem mais propostas a cada rodada com a janela aberta.'}</p>`;
  return sub === 'meus' ? topo + lista(mine, 'Você não listou ninguém. Na ficha de um jogador seu, coloque-o à venda ou para empréstimo: chovem propostas.') : abaBuscar(topo);
}
function abaPre() {
  const s = S(), b = B(), meu = s.tecnico.clube;
  const meus = s.preContratos.filter(p => p.para === meu), saem = s.preContratos.filter(p => p.de === meu);
  const pj = p => b.jog.get(p.jogador);
  return `<p class="janela ${s.rodada >= M.ABRE_PRE ? 'aberta' : ''}"><b>${s.rodada >= M.ABRE_PRE ? 'Pré-contratos liberados' : `Pré-contratos abrem na ${M.ABRE_PRE + 1}ª rodada`}</b><small>Da metade do Brasileirão em diante, quem está no último ano de contrato pode assinar e chega só na temporada seguinte, sem custo de transferência. Quem vai se aposentar ou já assinou com outro clube fica de fora.</small></p>
    ${meus.length ? `<section class="cartao"><h3>Chegam em ${s.ano + 1}</h3><ul class="noticias">${meus.map(p => `<li><span class="rd">R${p.rodada + 1}</span><span><b>${H.esc(pj(p).curto)}</b> · do ${H.esc(H.clube(p.de).n)} · ${euro(p.salario)}/dia por ${p.anos} anos</span></li>`).join('')}</ul></section>` : ''}
    ${saem.length ? `<section class="cartao"><h3>Saem no fim da temporada</h3><ul class="noticias">${saem.map(p => `<li><span class="rd">R${p.rodada + 1}</span><span><b>${H.esc(pj(p).curto)}</b> assinou com o ${H.esc(H.clube(p.para).n)}</span></li>`).join('')}</ul></section>` : ''}
    <h3>Contrato terminando em ${s.ano}</h3>${abaBuscar('')}`;
}
function abaOlheiros() {
  const s = S(), b = B(), o = s.olheiro;
  const rel = Object.entries(s.relatorios).map(([id, r]) => [b.jog.get(+id), r]).filter(([j]) => j && j.clube !== s.tecnico.clube).sort((x, y) => y[1].rd - x[1].rd || y[1].e - x[1].e).slice(0, 60);
  const fila = s.observar.map(id => b.jog.get(id)).filter(Boolean);
  return `<section class="cartao"><h3>Para onde o olheiro vai</h3>
      ${chips('Região', Object.entries(M.REGIOES), 'olheiro', k => o.regiao === k, 'data-k="regiao"')}
      ${chips('Setor', GRUPOS, 'olheiro', k => o.setor === k, 'data-k="setor"')}
      ${chips('Idade', [['1', 'Só jovens (até 21)'], ['0', 'Qualquer idade']], 'olheiro', k => String(+o.jovens) === k, 'data-k="jovens"')}
      <p class="mudo" style="font-size:.95rem">A cada rodada ele traz dois nomes com o potencial estimado (pode errar por uma estrela). Na ficha de qualquer jogador dá para pedir uma observação exata.</p></section>
    ${fila.length ? `<section class="cartao"><h3>Vai observar nesta rodada</h3><p>${fila.map(j => H.esc(j.curto)).join(', ')}</p></section>` : ''}
    <h3>Relatórios</h3>${lista(rel.map(([j]) => j), 'Nenhum relatório ainda. Jogue uma rodada.', j => { const r = s.relatorios[j.id]; return `<i class="sit pot" aria-label="Potencial ${r.e} de 5">${'★'.repeat(r.e)}${'☆'.repeat(5 - r.e)}${r.exato ? '' : ' ~'}</i>`; })}`;
}
// botões de uma oferta recebida: vender, pedir mais (uma vez), leilão, recusar
function acoesRecebida(x) {
  if (x.leilao === 'aberto') return '<p class="mudo">Leilão aberto: os lances saem na próxima rodada.</p>';
  if (x.leilao === 'vivo') return '<a class="botao peq" href="#/leilao">Voltar à sala do leilão</a>';
  if (x.pedido) return `<p class="mudo">Você pediu ${fmtDinheiro(x.pedido)}. Esperando a resposta.</p>`;
  const compra = x.tipo !== 'emprestimo', livre = compra && !x.contraFeita && !x.leilao;
  return `<div class="linha-botoes"><button class="botao peq" type="button" data-acao="aceitar-recebida" data-id="${x.id}">${compra ? 'Vender' : 'Emprestar'}</button>
    ${livre ? `<button class="botao peq sec" type="button" data-acao="pedir-mais" data-id="${x.id}" data-f="1.15">Pedir +15%</button><button class="botao peq sec" type="button" data-acao="pedir-mais" data-id="${x.id}" data-f="1.3">Pedir +30%</button><button class="botao peq sec" type="button" data-acao="leilao" data-id="${x.id}">Leilão</button>` : ''}
    <button class="botao peq sec" type="button" data-acao="recusar-recebida" data-id="${x.id}">Recusar</button></div>`;
}
const FASE_TXT = j => { const f = faseDe(S(), j.id); return f.nome.toLowerCase(); };
const TIPO_HIST = { emprestimo: 'empréstimo', troca: 'na troca', volta: 'volta de empréstimo' };
function abaPropostas() {
  const s = S(), b = B(), J = id => b.jog.get(id);
  const env = s.propostas.slice(0, 40).map(p => { const j = J(p.jogador), tipo = p.tipo || 'compra'; return `<li class="cartao"><div class="titulo-linha"><button type="button" class="link" data-acao="ficha" data-id="${j.id}">${H.esc(j.curto)}</button><span class="tag ${p.estado === 'concluida' ? 'resultado' : ['recusada', 'perdida'].includes(p.estado) ? 'crise' : 'rumor'}">${ROTULO[p.estado]}</span></div>
    <p class="mudo">${H.imgEscudo(p.de, 16, 17)} ${tipo === 'livre' ? 'Sem clube' : `${H.esc(H.clube(p.de).n)} · ${NOME_TIPO[tipo]}`}${tipo === 'compra' ? ` · ${fmtDinheiro(p.valor)}` : ''}${p.troca && J(p.troca) ? ` + ${H.esc(J(p.troca).curto)}` : ''}${p.salario ? ` · ${euro(p.salario)}/dia` : ''}${p.anos && tipo !== 'emprestimo' ? ` · ${p.anos} anos` : ''}${p.leilao === true && p.estado === 'aguardando' ? ' · venceu o leilão, falta o salário' : p.leilao === 'vivo' ? ' · em leilão' : ''}${p.motivo ? ` · ${H.esc(p.motivo)}` : ''}</p>${p.cl && M.resumoCl(p.cl) ? `<p class="mudo clausulas-txt">${H.esc(M.resumoCl(p.cl))}</p>` : ''}
    ${p.estado === 'contraproposta' ? `<p><b>${p.contra != null ? `O clube pede ${fmtDinheiro(p.contra)}.` : ''} ${p.contraSal != null ? `Ele pede ${euro(p.contraSal)}/dia.` : ''}</b></p><div class="linha-botoes"><button class="botao peq" type="button" data-acao="aceitar-contra" data-id="${p.id}">Aceitar</button><button class="botao peq sec" type="button" data-acao="desistir" data-id="${p.id}">Desistir</button></div>`
      : p.estado === 'aguardando' ? `<div class="linha-botoes"><button class="botao peq sec" type="button" data-acao="desistir" data-id="${p.id}">Cancelar proposta</button></div>` : ''}</li>`; }).join('');
  const rec = s.recebidas.map(x => { const j = J(x.jogador); return `<li class="cartao"><div class="titulo-linha"><button type="button" class="link" data-acao="ficha" data-id="${j.id}">${H.esc(j.curto)}</button>${x.gigante ? '<span class="tag destaque">Gigante</span>' : ''}<span class="nota ${cartaDe(j.ovr).k}">${j.ovr}</span></div>
    <p class="mudo">${H.imgEscudo(x.de, 16, 17)} ${H.esc(H.clube(x.de).n)} ${x.tipo === 'emprestimo' ? 'pede emprestado até o fim da temporada' : `oferece <b>${fmtDinheiro(x.valor)}</b> · vale ${fmtDinheiro(j.valor * 1000)}`}</p>${x.cl && M.resumoCl(x.cl) ? `<p class="mudo clausulas-txt">${H.esc(M.resumoCl(x.cl))}</p>` : ''}
    ${x.gigante ? `<p class="mudo">Salário oferecido: <b>${euro(x.salario)}/dia</b> (${String(x.mult).replace('.', ',')}x o atual) · ${FASE_TXT(j)} · ele ${M.textoVontade(x.vontade)}</p>` : ''}${x.quer ? `<p class="quer-ir">${H.esc(j.curto)} ${H.esc(x.quer)} e quer ir. Se você recusar, ele fica chateado.</p>` : x.vontade != null && x.vontade < 35 ? `<p class="quer-ir">${H.esc(j.curto)} não quer ir: se você aceitar, ele recusa.</p>` : ''}
    ${acoesRecebida(x)}</li>`; }).join('');
  const acordos = (s.acordos || []).map(a => `<li><span>${H.imgEscudo(a.de, 14, 15)}</span><span><b>${H.esc(J(a.jogador).curto)}</b> · ${a.tipo === 'emprestimo' ? 'empréstimo' : a.valor ? fmtDinheiro(a.valor) : ''}${a.troca ? ` + ${H.esc(J(a.troca).curto)}` : ''}</span></li>`).join('');
  return `${acordos ? `<section class="cartao"><h3>Acertados: chegam quando a janela abrir</h3><ul class="noticias">${acordos}</ul></section>` : ''}<h3>Pelos seus jogadores</h3>${rec ? `<ul class="lista-propostas">${rec}</ul>` : '<section class="cartao"><p class="mudo">Nenhuma proposta agora. Quem joga bem, ou está listado, chama atenção.</p></section>'}
    <h3>Feitas por você</h3>${env ? `<ul class="lista-propostas">${env}</ul>` : '<section class="cartao"><p class="mudo">Você ainda não fez propostas. Busque um jogador e toque nele.</p></section>'}`;
}
function abaHistorico() {
  const s = S(), meu = s.tecnico.clube, sub = H.app.abaHist || 'meu';
  const l = s.historicoTransf.filter(x => sub === 'todas' || x.de === meu || x.para === meu).slice(0, 150);
  return `${chips('Histórico', [['meu', 'Meu clube'], ['todas', 'Todas']], 'aba-hist', k => sub === k)}
    ${l.length ? `<section class="cartao"><ul class="noticias">${l.map(x => `<li><span class="rd">R${x.rodada + 1}</span><span><b>${H.esc(x.nome)}</b>: ${H.esc(H.clube(x.de).n)} → ${H.esc(H.clube(x.para).n)} · ${x.tipo === 'rescisao' ? `rescisão (${fmtDinheiro(x.valor)})` : TIPO_HIST[x.tipo] || (x.valor ? fmtDinheiro(x.valor) : 'sem custo')}</span></li>`).join('')}</ul></section>` : '<section class="cartao"><p class="mudo">Nenhuma transferência ainda.</p></section>'}`;
}

export function tela() {
  const s = S(), b = B(), aba = H.app.abaMercado || 'buscar';
  M.garantirMercado(s);
  H.app.sitFixa = { listas: (H.app.abaListas || 'venda') === 'meus' ? null : H.app.abaListas || 'venda', livres: 'livres', pre: 'pre' }[aba] || null;
  const abertas = s.propostas.filter(p => ['aguardando', 'contraproposta'].includes(p.estado)).length + s.recebidas.length;
  const corpo = {
    buscar: abaBuscar,
    favoritos: () => lista(s.favoritos.map(id => b.jog.get(id)).filter(Boolean), 'Nenhum favorito. Toque na estrela da ficha de um jogador para acompanhar.'),
    listas: abaListas,
    livres: () => abaBuscar('<p class="mudo">Sem clube: assinam a qualquer momento, sem custo de transferência. Só o salário.</p>'),
    pre: abaPre, olheiros: abaOlheiros, propostas: abaPropostas, historico: abaHistorico,
  }[aba]();
  const o = orcamento(b, s);
  return `<div class="titulo-linha"><h2>Mercado</h2><span class="mudo">${fmtDinheiro(s.caixa)} em caixa</span></div>
    <div class="chips" style="gap:8px"><span class="chip-info">Compras ${fmtDinheiro(o.compras)}</span><span class="chip-info">Folga ${euro(o.folga)}/dia</span></div>
    <nav class="abas-mercado" aria-label="Seções do mercado">${ABAS.map(([k, t]) => `<button type="button" class="chip" data-acao="aba-mercado" data-a="${k}" aria-pressed="${aba === k}">${t}${k === 'propostas' && abertas ? ` (${abertas})` : ''}</button>`).join('')}</nav>
    ${corpo}`;
}

// ---------- ficha ----------
export function potencialTxt(j) {
  const s = S(), r = s?.relatorios?.[j.id], meu = s && j.clube === s.tecnico.clube;
  const n = meu ? estrelas(j.pot) : r?.e;
  return n ? `<span class="estrelas" aria-label="${n} de 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>${meu || r.exato ? '' : ' <small class="mudo">olheiro</small>'}` : '<span class="estrelas" aria-label="desconhecido">? ? ?</span>';
}
const anosSelect = (nome, v = 3) => `<label>Contrato <select name="${nome}">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === v ? 'selected' : ''}>${n} ${n > 1 ? 'anos' : 'ano'}</option>`).join('')}</select></label>`;

// cláusulas do empréstimo: taxa, salário, compra (opção ou obrigação com gatilho), minutagem, medo e revenda
// campos de dinheiro aceitam 500mil, 5M, 5,5M (lerValor) e mostram embaixo quanto entendeu
const txt = v => valorCurto(v, 2), DICA = 'Ex.: 500 mil, 5M ou 5,5M';
const campoDinheiro = (nome, v) => `<input type="text" name="${nome}" inputmode="text" autocomplete="off" spellcheck="false" data-dinheiro value="${txt(v)}"><small class="dinheiro-prev">${DICA}</small>`;
function formEmprestimo(j) {
  const s = S(), b = B(), c = M.limpaCl(b, s, j), opt = (nome, l, v) => `<select name="${nome}">${l.map(([k, t]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  return `<div class="so-emprestimo clausulas">
    <p class="mudo">Empréstimo até o fim da temporada. Salário cheio: ${euro(salarioDia(b, s, j))}/dia.</p>
    <div class="campos-2"><label>Taxa de empréstimo ${campoDinheiro('taxa', 0)}</label>
      <label>Você paga do salário ${opt('pct', [[100, '100%'], [75, '75%'], [50, '50%']], 100)}</label></div>
    <div class="campos-2"><label>Cláusula de compra ${opt('compra', [['nenhuma', 'Nenhuma'], ['opcao', 'Opção de compra'], ['obrigacao', 'Obrigação de compra']], 'nenhuma')}</label>
      <label>Valor da compra ${campoDinheiro('valorCompra', c.valorCompra)}</label></div>
    <div class="campos-2"><label>Obrigação vale ${opt('gatilho', Object.entries(M.GATILHOS), 'jogos')}</label>
      <label>N de jogos (gatilho) <input type="number" name="jogos" inputmode="numeric" min="1" max="38" value="15"></label></div>
    <div class="campos-2"><label>Jogos mínimos (senão multa) <input type="number" name="minimo" inputmode="numeric" min="0" max="30" value="0"></label>
      <label>Revenda para o dono ${opt('revenda', [[0, 'Nada'], [10, '10%'], [20, '20%'], [30, '30%']], 0)}</label></div>
    <label class="check"><input type="checkbox" name="medo"> Cláusula do medo: ele não enfrenta o ${H.esc(H.clube(j.clube).n)}</label>
    <p class="chance-emp">${chanceEmp(j, c)}</p></div>`;
}
const lerCl = form => { const v = n => form[n]?.value; return { taxa: lerValor(v('taxa')) || 0, pct: v('pct'), compra: v('compra'), valorCompra: lerValor(v('valorCompra')) || 0, gatilho: v('gatilho'), jogos: v('jogos'), minimo: v('minimo'), medo: form.medo?.checked, revenda: v('revenda') }; };
function chanceEmp(j, cl) {
  const n = M.notaEmprestimo(B(), S(), j, cl);
  return `Chance de o ${H.esc(H.clube(j.clube).n)} aceitar: <b>${n >= 62 ? 'alta' : n >= 50 ? 'boa' : n >= 40 ? 'baixa' : 'quase nenhuma'}</b>`;
}

export function blocoFicha(j) {
  const s = S(), b = B(), meu = j.clube === s.tecnico.clube, sit = M.situacao(b, s, j);
  M.garantirMercado(s);
  const tags = sit.length ? `<p class="lm-tags">${sit.map(t => `<i class="sit ${t}">${TAG_SIT[t]}</i>`).join('')}</p>` : '';
  const fav = `<button type="button" class="chip fav" data-acao="favorito" data-id="${j.id}" aria-pressed="${s.favoritos.includes(j.id)}">★ Favorito</button>`;
  if (meu) {
    const ofertas = s.recebidas.filter(x => x.jogador === j.id), pre = M.preContratoDe(s, j.id), emp = s.emprestimos[j.id];
    const ren = M.renovacaoPossivel(s, j) && M.pedidoRenovacao(b, s, j), tr = M.semPassagem(s, j.id), a12 = b.clubes[j.clube].div === 'A' && s.jogosA?.[j.id]?.c === j.clube ? s.jogosA[j.id].n : 0;
    return `<section class="ficha-mercado"><div class="titulo-linha"><h3>Contrato</h3>${fav}</div>${tags}
      <dl><dt>Salário</dt><dd>${euro(salarioDia(b, s, j))}/dia</dd><dt>Contrato</dt><dd>até ${j.contrato}</dd>${(c => c ? `<dt>Multa rescisória</dt><dd>${fmtDinheiro(c.nac)} · exterior ${fmtDinheiro(c.int)}</dd>` : '')(M.clausula(b, s, j))}</dl>
      ${pre ? `<p><b>Assinou pré-contrato com o ${H.esc(H.clube(pre.para).n)} e sai no fim da temporada.</b></p>` : ''}
      ${s.promTit?.[j.id] ? (pr => `<p class="aviso-ficha">Promessa de titularidade: titular em ${pr.tit} de ${pr.jogos} jogo${pr.jogos === 1 ? '' : 's'}. Precisa de ${M.PROMESSA.titular} em ${M.PROMESSA.jogos}; mais ${M.PROMESSA.jogos - M.PROMESSA.titular - (pr.jogos - pr.tit) + 1 > 0 ? M.PROMESSA.jogos - M.PROMESSA.titular - (pr.jogos - pr.tit) + 1 : 0} no banco e a promessa cai.</p>`)(s.promTit[j.id]) : ''}
      ${emp ? `<p><b>Emprestado pelo ${H.esc(H.clube(emp.de).n)} até o fim da temporada.</b></p>${M.resumoCl(emp, M.jogosNoEmprestimo(s, j.id)) ? `<p class="mudo clausulas-txt">${H.esc(M.resumoCl(emp, M.jogosNoEmprestimo(s, j.id)))}</p>` : ''}${emp.opcao ? `<button class="botao peq" type="button" data-acao="opcao" data-id="${j.id}">Exercer opção de compra (${fmtDinheiro(emp.opcao)})</button>` : ''}` : ''}
      ${emp && barradoMedo(b, s, j.id, s.tecnico.clube) ? `<button class="botao peq" type="button" data-acao="pagar-medo" data-id="${j.id}">Pagar a multa do medo (${fmtDinheiro(multaMedo(j))}) para ele jogar contra o dono</button>` : ''}
      ${tr ? `<p class="mudo">${H.esc(M.textoPassagem(j))}</p>` : ''}
      ${a12 >= 8 ? `<p class="mudo">Série A: ${a12} jogos pelo clube. ${a12 > LIMITE_12 ? 'Pela regra dos 12 jogos, não joga mais a A por outro clube este ano.' : `Com mais ${LIMITE_12 + 1 - a12}, fica preso ao clube na Série A este ano (regra dos 12 jogos).`}</p>` : ''}
      ${M.emNovela(s, j.id) ? `<p class="aviso-ficha fase-pessima">Novela: ${H.esc(j.curto)} não renova (${H.esc(s.novela[j.id].motivo)}). Venda enquanto dá ou ele sai de graça no fim do ano.</p>` : ''}
      ${ren && !M.emNovela(s, j.id) ? `<form class="proposta" data-form="renovar" data-id="${j.id}"><p class="mudo">${ren.ficar < 30 ? 'Ele anda insatisfeito e não quer conversa.' : `Ele deve pedir cerca de <b>${euro(ren.pede)}/dia</b>. Folga na folha: ${euro(orcamento(b, s).folga)}/dia.`}</p>
        <div class="campos-2"><label>Salário por dia (€) <input type="number" name="salario" inputmode="numeric" min="10" step="10" value="${ren.pede}"></label>${anosSelect('anos')}</div>
        <p class="erro" role="alert"></p><button class="botao" type="submit">Renovar contrato</button></form>` : ''}
      ${emp ? '' : `<div class="chips"><button type="button" class="chip" data-acao="lista" data-l="venda" data-id="${j.id}" aria-pressed="${s.listas.venda.includes(j.id)}">À venda</button><button type="button" class="chip" data-acao="lista" data-l="emprestimo" data-id="${j.id}" aria-pressed="${s.listas.emprestimo.includes(j.id)}">Para empréstimo</button></div>`}
      ${ofertas.map(x => `<div class="oferta"><span>${H.imgEscudo(x.de, 18, 20)} ${H.esc(H.clube(x.de).n)} · <b>${x.tipo === 'emprestimo' ? 'empréstimo' : fmtDinheiro(x.valor)}</b></span>${acoesRecebida(x)}</div>`).join('')}
      ${emp ? '' : `<div class="linha-botoes"><button class="botao peq sec" type="button" data-acao="distrato" data-id="${j.id}">Propor distrato (${fmtDinheiro(M.valorDistrato(b, s, j))})</button><button class="botao peq sec" type="button" data-acao="rescindir" data-id="${j.id}">Rescindir (paga o contrato: ${fmtDinheiro(M.multaRescisao(b, s, j))})</button></div>
        <p class="mudo" style="font-size:.9rem">Rescindir: o clube paga todos os salários até o fim do contrato (Lei Geral do Esporte). Distrato: sai por 60% disso, se ele aceitar.</p>`}</section>`;
  }
  const fora = s.emprestimos[j.id];
  if (fora?.de === s.tecnico.clube) return `<section class="ficha-mercado"><div class="titulo-linha"><h3>Mercado</h3>${fav}</div>
    <p><b>Emprestado por você ao ${H.esc(H.clube(fora.para).n)} até o fim da temporada.</b></p>${M.resumoCl(fora, M.jogosNoEmprestimo(s, j.id)) ? `<p class="mudo clausulas-txt">${H.esc(M.resumoCl(fora, M.jogosNoEmprestimo(s, j.id)))}</p>` : ''}
    <button class="botao peq sec" type="button" data-acao="chamar-volta" data-id="${j.id}">Chamar de volta (reembolso de ${fmtDinheiro(M.reembolso(j))})</button></section>`;
  const livre = b.clubes[j.clube].div === 'L', pedido = M.precoPedido(b, s, j), tipos = M.tiposPossiveis(b, s, j), cid = M.clausula(b, s, j);
  const ja = s.propostas.find(p => p.jogador === j.id && ['aguardando', 'contraproposta'].includes(p.estado));
  const tipo0 = tipos.includes(H.app.tipoProposta) ? H.app.tipoProposta : tipos[0];
  const geral = tipos.length ? M.bloqueioProposta(b, s, j, { tipo: tipo0, valor: 1, salario: 1, anos: 3 }) : 'Sem negócio possível agora.';
  const pede = M.salarioPedido(b, s, j, 3), rel = s.relatorios[j.id], medo = M.medoDoBanco(b, j, s.tecnico.clube), q = M.palavraQuebrada(s);
  const promessa = medo && tipos.some(t => t !== 'pre') ? `<label class="check-promessa nao-pre"><input type="checkbox" name="promessa"> <span><b>Prometer titularidade</b>: titular em ${M.PROMESSA.titular} dos ${M.PROMESSA.jogos} primeiros jogos que ele puder jogar. Com a promessa, ${M.pistaVontade(M.vontade(b, s, j, s.tecnico.clube, true)).replace(/^O empresário diz que ele|^Ele/, 'ele').toLowerCase()}${q ? ` <span class="erro">Você quebrou ${q} promessa${q > 1 ? 's' : ''} de titularidade${q >= 2 ? ': ninguém mais acredita.' : ': ele desconfia.'}</span>` : ''} Se não cumprir, ele quer sair e o mercado fica sabendo.</span></label>` : '';
  const olheiro = rel?.exato ? '' : s.observar.includes(j.id) ? '<p class="mudo">O olheiro vai observá-lo na próxima rodada.</p>' : `<button type="button" class="botao sec peq" data-acao="observar" data-id="${j.id}">Mandar o olheiro observar</button>`;
  const fixo = geral && (!/dinheiro|orçamento|salário|folga|janela|Elenco cheio|Limite/.test(geral) || /acabou de chegar/.test(geral)); // erro que nenhum valor resolve
  return `<section class="ficha-mercado"><div class="titulo-linha"><h3>Mercado</h3>${fav}</div>${tags}
    <dl>${livre ? '' : `<dt>Preço pedido</dt><dd>${fmtDinheiro(pedido)}</dd>`}${cid ? `<dt>Multa rescisória</dt><dd>${fmtDinheiro(cid.nac)}</dd>` : ''}<dt>Salário hoje</dt><dd>${livre ? '—' : `${euro(salarioDia(b, s, j))}/dia`}</dd><dt>Seu caixa</dt><dd>${fmtDinheiro(s.caixa)}</dd></dl>
    <p class="mudo">${M.pistaVontade(M.vontade(b, s, j, s.tecnico.clube))}${medo ? ` Ele tem medo de ser reserva${medo >= 2 ? ': tem dois ou mais melhores na posição' : ''}.` : ''}</p>
    ${(x => x && b.clubes[s.tecnico.clube].div === 'A' ? `<p class="aviso-ficha">Regra dos 12 jogos: ${H.esc(j.curto)} já fez ${x.n} jogos da Série A pelo ${H.esc(H.clube(x.c).n)}. Se vier, não joga a Série A por você nesta temporada (só Copa do Brasil, estadual e continental).</p>` : '')(barrado12(s, j.id, s.tecnico.clube))}
    ${ja ? `<p><b>${ja.estado === 'contraproposta' ? 'Tem contraproposta esperando. Veja em Mercado › Propostas.' : 'Proposta enviada. Esperando a resposta.'}</b></p>`
      : fixo ? `<p class="erro">${H.esc(geral)}</p>`
      : `<form class="proposta" data-form="proposta" data-id="${j.id}" data-pedido="${pedido}">
        ${tipos.length > 1 ? `<div class="chips tipos" role="radiogroup" aria-label="Tipo de proposta">${tipos.map(t => `<label class="chip"><input class="vh" type="radio" name="tipo" value="${t}" ${t === tipo0 ? 'checked' : ''}>${NOME_TIPO[t]}</label>`).join('')}</div>` : `<input type="hidden" name="tipo" value="${tipos[0]}">`}
        ${tipos.includes('compra') ? `<div class="so-compra"><label>Valor da transferência ${campoDinheiro('valor', pedido)}</label>
          <div class="chips">${[0.85, 1, 1.15].map(f => `<button type="button" class="chip" data-acao="sugerir" data-v="${txt(Math.round(pedido * f / 1e4) * 1e4)}">${fmtDinheiro(Math.round(pedido * f / 1e4) * 1e4)}</button>`).join('')}${cid ? `<button type="button" class="chip" data-acao="sugerir" data-v="${txt(cid.nac)}">Pagar a multa</button>` : ''}</div>
          ${cid ? `<p class="mudo" style="font-size:.9rem">Pagando a multa rescisória (${fmtDinheiro(cid.nac)}), o ${H.esc(H.clube(j.clube).n)} não pode recusar nem abrir leilão: só ele decide.</p>` : ''}
          <label>Jogador na troca <select name="troca"><option value="">Sem troca</option>${b.elencos[s.tecnico.clube].filter(t => !s.emprestimos[t.id] && !M.semPassagem(s, t.id) && !M.chegouNaJanela(s, t.id) && !M.preContratoDe(s, t.id)).sort((x, y) => y.ovr - x.ovr).map(t => `<option value="${t.id}" data-v="${M.valorNaTroca(b, s, t, j.clube)}">${H.esc(t.curto)} · ${t.pos} ${t.ovr} · abate ~${fmtDinheiro(M.valorNaTroca(b, s, t, j.clube))}</option>`).join('')}</select></label></div>` : ''}
        <div class="campos-2 nao-emprestimo"><label>Salário por dia (€) <input type="number" name="salario" inputmode="numeric" min="10" step="10" value="${pede}"></label>${anosSelect('anos')}</div>
        ${tipos.includes('emprestimo') ? formEmprestimo(j) : ''}${promessa}
        ${pede > tetoSalarial(b, s).teto ? `<p class="erro" style="font-size:.95rem">Ele deve pedir acima do teto salarial da diretoria (${euro(tetoSalarial(b, s).teto)}/dia). Só com empréstimo em que o outro clube paga parte do salário.</p>` : ''}
        <p class="mudo" style="font-size:.95rem">Ele deve pedir perto de ${euro(pede)}/dia. Teto da diretoria: ${euro(tetoSalarial(b, s).teto)}/dia por jogador. Folga na sua folha: ${euro(M.folgaPara(b, s, j))}/dia.${tipos.includes('pre') ? ` Pré-contrato: chega em janeiro de ${s.ano + 1}, sem pagar nada ao clube.` : ''}</p>
        <p class="erro" role="alert">${geral ? H.esc(geral) : ''}</p><button class="botao" type="submit">Enviar proposta</button></form>`}
    ${rel ? `<p>Relatório do olheiro: ${potencialTxt(j)}</p>` : ''}${olheiro}</section>`;
}

// ---------- formulários ----------
export function enviar(form) {
  const s = S(), b = B(), j = b.jog.get(+form.dataset.id), num = n => parseFloat(String(form[n]?.value ?? '').replace(',', '.'));
  const erro = form.querySelector('.erro');
  if (form.dataset.form === 'renovar') {
    const r = M.renovar(b, s, j, Math.round(num('salario')), Math.round(num('anos')));
    if (!r.ok) { erro.textContent = r.txt; if (r.pede) form.salario.value = r.pede; return; }
    H.$('#ficha').close(); H.aviso(r.txt); H.render(); H.salvar(); return;
  }
  const tipo = form.querySelector('[name=tipo]:checked, [name=tipo][type=hidden]')?.value || 'compra';
  const e = M.fazerProposta(b, s, j, { tipo, valor: lerValor(form.valor?.value) || 0, salario: tipo === 'emprestimo' ? salarioDia(b, s, j) : Math.round(num('salario')), anos: Math.round(num('anos')), troca: tipo === 'compra' ? +form.troca?.value || 0 : 0, promessa: !!form.promessa?.checked, cl: tipo === 'emprestimo' ? lerCl(form) : null });
  if (e) { erro.textContent = e; return; }
  H.$('#ficha').close();
  if (abrirLeilaoCompra(b, s, s.propostas[0].id)) { H.salvar(); location.hash = '#/leilao'; return; } // outro clube também quer: vira leilão na hora
  H.aviso(M.responderProposta(b, s, s.propostas[0].id) || 'Proposta enviada.'); H.render(); H.salvar();
}

// ---------- eventos ----------
const refazerLista = () => { const f = filtro(), res = filtrar(f), l = H.$('#lista-mercado'); if (l) l.innerHTML = listaBusca(res, f); const c = H.$('#conta-mercado'); if (c) c.textContent = `${res.length.toLocaleString('pt-BR')} jogadores`; };
const re = (fn, salva) => el => { fn(el); H.render(); if (salva) H.salvar(); };
export const acoes = {
  'aba-mercado': re(el => { H.app.abaMercado = el.dataset.a; }),
  'aba-listas': re(el => { H.app.abaListas = el.dataset.v; }),
  'aba-hist': re(el => { H.app.abaHist = el.dataset.v; }),
  'm-rapido': re(el => { const f = filtro(); f.rapido = f.rapido === el.dataset.v ? '' : el.dataset.v; f.n = 50; }),
  'm-liga': el => { // a fileira é longa: redesenha sem voltar a rolagem para o começo
    const f = filtro(), v = el.dataset.v, x = el.parentElement.scrollLeft; f.ligas = (f.ligas || []).includes(v) ? f.ligas.filter(y => y !== v) : [...(f.ligas || []), v]; f.n = 50;
    Promise.resolve(H.render()).then(() => { const r = H.$('[aria-label="Ligas"]'); if (r) r.scrollLeft = x; });
  },
  'm-grupo': re(el => { filtro().grupo = el.dataset.v; filtro().n = 50; }),
  'm-mais': () => { filtro().n += 50; refazerLista(); },
  'm-filtros': () => abrirFiltros(),
  'f-sit': el => { filtro().sit = el.dataset.v; abrirFiltros(); },
  'f-pos': el => { const f = filtro(), v = el.dataset.v; f.pos = f.pos.includes(v) ? f.pos.filter(x => x !== v) : [...f.pos, v]; abrirFiltros(); },
  'f-cont': el => { filtro().cont = el.dataset.v; abrirFiltros(); },
  'f-limpar': () => { const f = filtro(), q = f.q, ord = f.ord; H.app.fMercado = { ...filtroPadrao(), q, ord, grupo: f.grupo, rapido: f.rapido, ligas: f.ligas || [] }; abrirFiltros(); },
  'f-ver': () => H.$('#ficha').close(),
  favorito: el => { M.alternarFavorito(S(), +el.dataset.id); el.setAttribute('aria-pressed', S().favoritos.includes(+el.dataset.id)); H.salvar(); },
  lista: el => { const e = M.alternarLista(B(), S(), el.dataset.l, +el.dataset.id); if (e) return H.aviso(e); for (const c of el.parentElement.children) c.setAttribute('aria-pressed', S().listas[c.dataset.l].includes(+el.dataset.id)); H.salvar(); },
  observar: el => { const e = M.observar(S(), +el.dataset.id); H.aviso(e || 'O olheiro vai observá-lo na próxima rodada.'); if (!e) el.outerHTML = '<p class="mudo">O olheiro vai observá-lo na próxima rodada.</p>'; H.salvar(); },
  olheiro: re(el => { const o = S().olheiro, k = el.dataset.k; o[k] = k === 'jovens' ? el.dataset.v === '1' : el.dataset.v; }, true),
  sugerir: el => { const c = el.closest('form').valor; c.value = el.dataset.v; aoDigitar(c); },
  'aceitar-contra': re(el => { H.aviso(M.aceitarContraproposta(B(), S(), el.dataset.id) || M.responderProposta(B(), S(), el.dataset.id) || 'Topou.'); }, true),
  desistir: re(el => { M.desistir(S(), el.dataset.id); }, true),
  'aceitar-recebida': re(el => { H.aviso(M.aceitarRecebida(B(), S(), el.dataset.id) || 'Negócio fechado.'); if (H.$('#ficha').open) H.$('#ficha').close(); }, true),
  'pagar-medo': re(el => { H.aviso(pagarMedo(B(), S(), +el.dataset.id) || 'Multa paga: ele está liberado para este jogo.'); if (H.$('#ficha').open) H.$('#ficha').close(); }, true),
  'pedir-mais': re(el => { H.aviso(M.pedirMais(B(), S(), el.dataset.id, +el.dataset.f) || M.responderPedidoAgora(B(), S(), el.dataset.id) || 'Contraproposta enviada ao outro técnico.'); }, true),
  leilao: el => { const e = abrirLeilaoVenda(B(), S(), el.dataset.id); if (e) return H.aviso(e); if (H.$('#ficha').open) H.$('#ficha').close(); H.salvar(); location.hash = '#/leilao'; },
  opcao: re(el => { H.aviso(M.exercerOpcao(B(), S(), +el.dataset.id) || 'Opção exercida: ele é seu em definitivo.'); if (H.$('#ficha').open) H.$('#ficha').close(); }, true),
  'chamar-volta': re(el => { H.aviso(M.chamarDeVolta(B(), S(), +el.dataset.id) || 'Ele está de volta ao elenco.'); if (H.$('#ficha').open) H.$('#ficha').close(); }, true),
  rescindir: el => { // dois toques: o primeiro pede confirmação
    if (!el.dataset.ok) { el.dataset.ok = 1; el.textContent = 'Toque de novo para confirmar a rescisão'; el.classList.add('perigo'); return; }
    const e = M.rescindir(B(), S(), +el.dataset.id); H.aviso(e || 'Contrato rescindido.'); if (!e && H.$('#ficha').open) H.$('#ficha').close(); H.render(); H.salvar();
  },
  distrato: el => {
    if (!el.dataset.ok) { el.dataset.ok = 1; el.textContent = 'Toque de novo para propor o distrato'; el.classList.add('perigo'); return; }
    const e = M.rescindir(B(), S(), +el.dataset.id, true); H.aviso(e || 'Distrato assinado: ele está livre.'); if (!e && H.$('#ficha').open) H.$('#ficha').close(); H.render(); H.salvar();
  },
  'recusar-recebida': re(el => { const m = M.recusarRecebida(B(), S(), el.dataset.id); if (m) H.aviso(m); if (H.$('#ficha').open) H.$('#ficha').close(); }, true),
};

// digitação e sliders: atualiza sem redesenhar a tela inteira (não perde o foco)
export function aoDigitar(el) {
  if (!H?.app.s) return false;
  if (el.dataset?.dinheiro != null) { const o = el.parentElement.querySelector('.dinheiro-prev'), v = lerValor(el.value); if (o) o.textContent = v > 0 ? `= ${fmtDinheiro(v, 2)}` : DICA; }
  const k = el.dataset?.filtro;
  if (k) { filtro()[k] = el.value; filtro().n = 50; refazerLista(); return true; }
  const fx = el.dataset?.faixa;
  if (fx) {
    const f = filtro(), p = +el.dataset.ponta, v = +el.value, par = f[fx].slice();
    par[p] = v; if (par[0] > par[1]) { par[1 - p] = v; el.parentElement.children[1 - p].value = v; }
    f[fx] = par; f.n = 50;
    const tr = el.parentElement, F = FAIXAS[fx], min = F.passos ? 0 : F.min, max = F.passos ? F.passos.length - 1 : F.max;
    tr.style.setProperty('--a', `${(par[0] - min) / (max - min) * 100}%`); tr.style.setProperty('--b', `${(par[1] - min) / (max - min) * 100}%`);
    H.$(`#out-${fx}`).textContent = rotFaixa(fx, par);
    clearTimeout(aoDigitar.t); aoDigitar.t = setTimeout(atualizarContagem, 120);
    return true;
  }
  if (el.name === 'tipo' && el.closest('[data-form=proposta]')) { H.app.tipoProposta = el.value; return true; }
  if (el.closest?.('.clausulas')) { const f = el.form, j = B().jog.get(+f.dataset.id), c = f.querySelector('.chance-emp'); if (j && c) c.innerHTML = chanceEmp(j, M.limpaCl(B(), S(), j, lerCl(f))); return true; }
  if (el.name === 'troca') { const f = el.form; f.valor.value = txt(Math.max(0, f.dataset.pedido - (+el.selectedOptions[0]?.dataset.v || 0))); return true; }
  return el.dataset?.dinheiro != null;
}
// filtros fechados (botão ou toque fora): redesenha a lista
export function aoFecharDialog() { if (H.app.filtrosAbertos) { H.app.filtrosAbertos = false; if (H.app.aba === 'mercado') H.render(); } }
