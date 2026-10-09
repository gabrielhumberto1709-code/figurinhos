// Interface do Figurinhos: telas, navegação por hash e saves na nuvem.
import { Base, novoJogo, iniciarRodada, concluirRodada, iniciarCopa, concluirCopa, iniciarCont, concluirCont, iniciarSup, concluirSup, iniciarReg, concluirReg, iniciarAmistoso, concluirAmistoso, iniciarLiga2, concluirLiga2, proximoEvento, pendentes, mundoAte, copaSemVoce, tabela, rodadasDe, feitas, acessoEQueda, escalacao, paraSalvar, resumo, REPUTACOES, DIFICULDADES, dataRodada, janelaAberta, caixaInicial, aplicarSave, compProxima, longevo, previa, barradoMedo, multaMedo, barrado12 } from './motor/mundo.js';
import { LESOES, COMP_DE, indisponivel, pendurado } from './motor/dm.js';
import { garantirCarreira, pilares, aceitarOferta, recusarOferta, pedirDemissao } from './motor/carreira.js';
import { virarTemporada, fimDeTemporada } from './motor/temporada.js';
import { campanha } from './motor/copa.js';
import { F_MATA, tabelaGrupo } from './motor/continental.js';
import { REGIONAIS, fasesReg, tabelaReg } from './motor/regionais.js';
import * as Torneios from './torneios.js';
import { garantirFinancas, orcamento, socorro, metaDiretoria, balanco, bilheteria, pedirVerba, dicasFinanceiras, fairPlay, registroBloqueado, tetoSalarial, ANO_FPF, SANCOES, PRECOS, NOME_PRECO } from './motor/financas.js';
import { garantirMercado } from './motor/mercado.js';
import * as Mercado from './mercado.js';
import * as AoVivo from './aovivo.js';
import * as Elenco from './elenco.js';
import * as Jornal from './jornal.js';
import * as Coletiva from './coletiva.js';
import * as Leilao from './leilao.js';
import * as Liga from './liga.js';
import { daFoto } from './motor/mundo.js';
import { encerrarPendente } from './motor/leilao.js';
import { confronto, textoConfronto } from './motor/confrontos.js';
import * as Gala from './gala.js';
import { perfil, prePendente } from './motor/imprensa.js';
import { faseDe } from './motor/forma.js';
import { remetente, naoLidas, enviar } from './motor/correio.js';
import { TEMPERAMENTOS, temperamento, PRELECOES, efeitoPrelecao, prelecaoFeita, fazerPrelecao, CONVERSAS, podeConversar, conversar, responderAumento, responderJogador } from './motor/vestiario.js';
import { POS_NOME, ATT, ATT_NOME, cartaDe, estrelas, fmtDinheiro, PAISES } from './motor/util.js';
import { urlRosto, urlEscudo, urlBandeira, urlBotao } from './pixel.js';

const $ = sel => document.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const guardado = { ler(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }, tirar(k) { try { localStorage.removeItem(k); } catch { } } };

const app = { conta: guardado.ler('fig.conta'), base: null, s: null, slot: null, novo: null, salvando: '', aba: null };
const TERNO = { n: 'Técnico', c: ['#1B1F2A', '#F3EBDD'], pat: 'solid' };

// ---------- servidor ----------
async function api(metodo, rota, corpo) {
  const headers = { 'content-type': 'application/json' };
  if (app.conta) headers.authorization = 'Bearer ' + app.conta.token;
  let r; const body = corpo && JSON.stringify(corpo);
  // keepalive deixa o envio terminar mesmo com a aba fechando (o navegador só aceita corpo pequeno)
  try { r = await fetch('/api' + rota, { method: metodo, headers, body, keepalive: !!body && body.length < 60000 }); }
  catch { throw new Error('Sem conexão com o servidor.'); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && app.conta && !rota.startsWith('/entrar')) { sairDaConta(); throw new Error(d.erro || 'Faça login de novo.'); }
  if (!r.ok) throw Object.assign(new Error(d.erro || 'Algo deu errado.'), { status: r.status, dados: d });
  return d;
}

// save comprimido: gzip + base64
async function compacta(obj) {
  const buf = await new Response(new Blob([typeof obj === 'string' ? obj : JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'gz:' + btoa(bin);
}
async function descompacta(txt) {
  if (!txt.startsWith('gz:')) return JSON.parse(txt);
  const bytes = Uint8Array.from(atob(txt.slice(3)), c => c.charCodeAt(0));
  return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}

// save em fila: várias chamadas seguidas viram um envio só (2 s depois da última); sair da página manda na hora.
// Versão do save = 'atualizado' que o servidor devolveu (app.ver). Se outro aparelho salvou depois, o servidor responde 409.
// A cópia local guarda a versão em que se baseou e se ainda falta subir (sujo), para o Continuar decidir sem olhar relógio.
const fila = { t: 0, sujo: false, rodando: null };
function salvar() { if (app.liga) return Liga.salvar(); if (!app.s) return; fila.sujo = true; clearTimeout(fila.t); fila.t = setTimeout(descarregar, 2000); }
async function descarregar() {
  if (app.liga) return Liga.descarregar();
  clearTimeout(fila.t);
  while (fila.rodando) await fila.rodando;
  if (!fila.sujo || !app.s) return;
  fila.sujo = false;
  fila.rodando = enviarSave(app.s, app.slot).finally(() => { fila.rodando = null; });
  await fila.rodando;
}
const chaveLocal = slot => `fig.backup.${app.conta.apelido}.${slot}`;
async function enviarSave(s, slot) {
  s.salvoEm = Date.now();
  const dados = await compacta(paraSalvar(s)), base = app.ver ?? 0;
  guardado.gravar(chaveLocal(slot), { quando: s.salvoEm, dados, base, sujo: true });
  app.salvando = 'salvando'; desenhaTopo();
  try {
    const r = await api('PUT', `/saves/${slot}`, { nome: `${s.tecnico.nome} · ${app.base.clubes[s.tecnico.clube].n}`, resumo: resumo(app.base, s), dados, base });
    app.ver = r.atualizado; app.salvando = 'salvo';
    guardado.gravar(chaveLocal(slot), { quando: s.salvoEm, dados, base: r.atualizado, sujo: false });
  } catch (e) {
    if (e.status === 409) { app.salvando = 'conflito'; app.verNuvem = e.dados.atualizado; aviso('Esta carreira foi salva em outro aparelho. Toque em "Conflito" no topo.'); }
    else { app.salvando = 'falhou'; fila.sujo = true; }
  }
  desenhaTopo();
}
// conflito: ficar com o progresso deste aparelho (sobrescreve a nuvem) ou carregar o da nuvem
async function resolverConflito() {
  if (confirm('Esta carreira foi salva em outro aparelho depois do seu último save.\n\nOK = manter o progresso DESTE aparelho (substitui o da nuvem)\nCancelar = carregar o que está na nuvem')) {
    app.ver = app.verNuvem; fila.sujo = true; return descarregar();
  }
  const { dados, atualizado } = await api('GET', `/saves/${app.slot}`);
  app.s = migrar(await descompacta(dados)); app.ver = atualizado; app.salvando = 'salvo';
  guardado.gravar(chaveLocal(app.slot), { quando: Date.now(), dados, base: atualizado, sujo: false });
  ir('#/clube'); render();
}
// jogo ao vivo em andamento vai no save (semente, minuto e mexidas) para retomar se o celular fechar a aba
function guardarVivo() { if (app.vivo && !app.vivo.fim && !app.vivo.R.replay && app.s) { app.s.vivo = AoVivo.estado(app.vivo); salvar(); } }
addEventListener('pagehide', () => { guardarVivo(); descarregar(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { guardarVivo(); descarregar(); } });

async function carregarBase() {
  if (app.base) return app.base;
  const r = await fetch('/data/brasil.json');
  if (!r.ok) throw new Error('Não consegui baixar a base de jogadores.');
  return (app.base = new Base(await r.json()));
}

const ir = rota => { if (location.hash === rota) render(); else location.hash = rota; };
async function sairDaConta() { await descarregar().catch(() => { }); Liga.fechar(); app.conta = null; app.s = null; guardado.tirar('fig.conta'); ir('#/entrar'); }

function aviso(msg) {
  const el = $('#aviso'); el.textContent = msg; el.classList.add('on');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => el.classList.remove('on'), 2600);
}

// ---------- pedaços de interface ----------
const clube = ci => app.base.clubes[ci];
const imgEscudo = (ci, w, h) => `<img class="px" src="${urlEscudo(clube(ci))}" width="${w}" height="${h}" alt="">`;
const bandeira = (nat, w = 16) => { const u = urlBandeira(nat); return u ? `<img class="px" src="${u}" width="${w}" height="${Math.round(w * 11 / 16)}" alt="">` : ''; };

function figurinha(j, extra = '', estatica = false, rendeNaVaga = null) {
  const carta = cartaDe(j.ovr), tag = estatica ? 'div' : 'button', escolha = rendeNaVaga != null;
  return `<${tag} class="fig ${carta.k} ${extra}" ${estatica ? '' : `data-acao="${escolha ? 'escolher' : 'ficha'}" data-id="${j.id}" type="button"`} aria-label="${esc(j.nome)}, ${POS_NOME[j.pos]}, overall ${j.ovr}${escolha ? `, rende ${rendeNaVaga} na vaga` : ''}">${escolha ? `<span class="rende">${rendeNaVaga}</span>` : ''}
    <span class="foto"><img class="px" src="${urlRosto(j.rosto, clube(j.clube))}" width="32" height="32" alt="" loading="lazy"><span class="ovr">${j.ovr}</span><span class="pos">${j.pos}</span><span class="band-fig">${bandeira(j.nat, 16)}</span></span>
    <span class="nome">${esc(j.curto)}</span><span class="tier">${carta.nome}</span></${tag}>`;
}

// posição de cada lado no ingresso, na competição do jogo (liga, grupo continental, regional); mata-mata não tem
function posicaoNoJogo(ev, ci) {
  const s = app.s;
  if (ev.tipo === 'liga') return feitas(s, ev.d) ? posicaoNaTabela(ci) : null;
  if (ev.tipo === 'cont' && ev.fase < F_MATA && ev.fase > 0) { const T = s.cont[ev.k], g = T.grupos.findIndex(x => x.includes(ci)); return g < 0 ? null : tabelaGrupo(T, g).findIndex(l => l.clube === ci) + 1; }
  if (ev.tipo === 'reg') {
    const T = s.reg[ev.k], F = fasesReg(ev.k)[ev.fase], E = F && F.e != null && T.etapas[F.e];
    if (!E || F.r === 0) return null;
    const X = REGIONAIS[ev.k].etapas[F.e], g = X.geral || E.grupos.length === 1 ? E.grupos.flat() : E.grupos.find(x => x.includes(ci));
    return g ? tabelaReg(T, F.e, g).findIndex(l => l.clube === ci) + 1 : null;
  }
  return null;
}
function posicaoNaTabela(ci) {
  const d = clube(ci).div;
  return tabela(app.base, app.s, d).findIndex(l => l.clube === ci) + 1;
}

const ICONES = {
  clube: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  elenco: '<rect x="3" y="4" width="8" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="13" y="8" width="8" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  tabela: '<path d="M4 5h16M4 10h16M4 15h16M4 20h10" stroke="currentColor" stroke-width="2.4"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3 10h18M8 2v5M16 2v5" stroke="currentColor" stroke-width="2.2"/>',
  noticias: '<rect x="3" y="4" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7 9h10M7 13h10M7 17h6" stroke="currentColor" stroke-width="2.2"/>',
  mercado: '<path d="M4 8h13l-3-3M20 16H7l3 3" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  torneios: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  tatica: '<rect x="3" y="4" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4v16" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
  apito: '<circle cx="9" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 10l9-4v4l-6 2" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  moeda: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.6.8-2.6 2s1 1.7 2.6 2 2.7.8 2.7 2.1-1.1 2-2.7 2c-1.2 0-2.2-.5-2.8-1.3M12 6.5v11" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  pessoa: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  halter: '<path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  broto: '<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-3 2.5-5 6-5 0 3-2.5 5-6 5z" fill="none" stroke="currentColor" stroke-width="2"/>',
  carta: '<rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m3 6 9 7 9-7" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  cruz: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="none" stroke="currentColor" stroke-width="2"/>',
  micro: '<rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  camisa: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z" fill="none" stroke="currentColor" stroke-width="2"/>',
  lua: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/>',
  sol: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2.2"/>',
};
const escuro = () => document.documentElement.dataset.tema === 'escuro';
const botaoTema = (classe = 'botao peq sec') => `<button class="${classe} tema" data-acao="tema" type="button" aria-label="${escuro() ? 'Usar tema claro' : 'Usar tema escuro'}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${ICONES[escuro() ? 'sol' : 'lua']}</svg></button>`;

function desenhaTopo() {
  const topo = $('#topo'), abas = $('#abas');
  const emJogo = !!app.s && !['entrar', 'saves', 'novo', 'ao-vivo'].includes(app.aba);
  topo.hidden = abas.hidden = !emJogo;
  if (!emJogo) return;
  const s = app.s, ci = s.tecnico.clube;
  const estado = app.liga ? Liga.estadoTopo() : { salvando: 'Salvando…', salvo: 'Salvo', falhou: 'Não salvou · tentar', conflito: 'Conflito · resolver' }[app.salvando] || '';
  topo.innerHTML = `<div class="topo-in">${imgEscudo(ci, 36, 39)}
    <div class="info"><div class="clube-nome">${esc(clube(ci).n)}</div><small>${(d => { const k = feitas(s, d); return `Série ${d} · ${k ? `Rodada ${Math.min(k + 1, { C: 19 }[d] || 38)} · ${posicaoNaTabela(ci)}º` : proximoEvento(app.base, s)?.tipo === 'liga' ? 'Rodada 1' : 'Pré-temporada'}`; })(clube(ci).div)}</small></div>
    <button class="estado ${app.salvando} ${app.liga ? 'liga' : ''}" data-acao="salvar" type="button" ${app.liga || ['falhou', 'conflito'].includes(app.salvando) ? '' : 'tabindex="-1"'} style="background:none;border:0;cursor:pointer">${estado}</button>
    ${botaoTema('botao peq')}<button class="botao peq" data-acao="menu" type="button">Sair</button></div>`;
  const pend = (s.recebidas || []).length + (s.propostas || []).filter(p => p.estado === 'contraproposta').length;
  const ativa = { calendario: 'clube', partida: 'clube', financas: 'clube', carreira: 'clube' }[app.aba] || app.aba;
  abas.innerHTML = `<ul>${[['clube', 'Clube'], ['elenco', 'Elenco'], ['mercado', 'Mercado'], ['torneios', 'Torneios'], ['noticias', 'Notícias']].map(([k, t]) =>
    `<li><a href="#/${k}" ${ativa === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[k]}</svg>${t}${k === 'mercado' && pend ? `<span class="badge" aria-label="${pend} pendentes">${pend}</span>` : ''}</a></li>`).join('')}</ul>`;
}

// ---------- telas ----------
const telas = {};

// vitrine: os dois craques desenhados à mão + o melhor jogador da Série A
const vitrine = () => {
  const fixos = [248410, 844797].map(id => app.base.jog.get(id)).filter(Boolean);
  const melhor = [...app.base.jog.values()].filter(j => clube(j.clube).div === 'A' && !fixos.includes(j)).sort((a, b) => b.ovr - a.ovr)[0];
  return `<div class="vitrine" aria-hidden="true">${[fixos[0], melhor, fixos[1]].filter(Boolean).map(j => figurinha(j, '', true)).join('')}</div>`;
};
telas.entrar = () => {
  return `<section class="entrada"><div style="display:flex;justify-content:flex-end">${botaoTema()}</div>
    <div><h1 class="logo">Figurinhos</h1><p class="logo-sub">Manager de futebol de botão. Monte o álbum, escale o time, brigue pelo título.</p></div>
    ${app.base ? vitrine() : ''}
    <form class="cartao" data-form="entrar" novalidate>
      <label>Apelido <input type="text" name="apelido" autocomplete="username" minlength="3" maxlength="20" required value="${esc(app.ultimoApelido || '')}"></label>
      <label>PIN <input type="password" name="pin" inputmode="numeric" autocomplete="current-password" minlength="4" maxlength="8" pattern="[0-9]*" required></label>
      <p class="erro" role="alert"></p>
      <button class="botao grande" name="modo" value="entrar">Entrar</button>
      <button class="botao sec" name="modo" value="cadastro">Criar conta nova</button>
      <p class="mudo" style="font-size:.95rem">Seu progresso fica salvo na nuvem. Guarde o PIN: sem ele não dá para recuperar a conta.</p>
    </form></section>`;
};

telas.saves = async () => {
  if (app.liga) { await descarregar(); Liga.fechar(); }
  const [lista, ligas] = await Promise.all([api('GET', '/saves'), api('GET', '/ligas').catch(() => null)]);
  const porSlot = Object.fromEntries(lista.map(x => [x.slot, x]));
  const quando = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `<div class="titulo-linha"><h2>Carreiras</h2><div class="linha-botoes" style="flex:0 0 auto">${botaoTema()}<button class="botao peq sec" data-acao="sair" type="button">Trocar conta</button></div></div>
    <p class="mudo">Olá, ${esc(app.conta.apelido)}. Você tem 3 espaços de carreira.</p>
    ${[1, 2, 3].map(n => { const x = porSlot[n]; return x ? `<article class="cartao slot">
      <span class="num" style="font-size:2.6rem;text-align:center">${n}</span>
      <div><h3 style="color:var(--texto)">${esc(x.nome)}</h3><p>${esc(x.resumo)}</p><p class="mudo" style="font-size:.9rem">Salvo em ${quando(x.atualizado)}</p></div>
      <div class="linha-botoes"><button class="botao" data-acao="continuar" data-slot="${n}" data-quando="${x.atualizado}" type="button">Continuar</button>
      <button class="botao perigo" data-acao="apagar" data-slot="${n}" type="button" style="flex:0 0 auto">Apagar</button></div></article>`
      : `<article class="cartao slot-vazio"><p class="mudo">Espaço ${n} livre</p><button class="botao" data-acao="novo" data-slot="${n}" type="button">Novo jogo</button></article>`; }).join('')}
    ${Liga.secaoSaves(ligas)}`;
};

// ----- novo jogo -----
const PARTES = [
  { nome: 'Pele', i: 0, n: 6, rot: v => `Tom ${v + 1}` },
  { nome: 'Cabelo', i: 1, n: 7, rot: v => ['Preto', 'Castanho', 'Marrom', 'Loiro', 'Platinado', 'Ruivo', 'Grisalho'][v] },
  { nome: 'Corte', i: 2, n: 14, rot: v => ['Curto', 'Raspado', 'Degradê', 'Topete', 'Black', 'Cacheado', 'Longo', 'Tranças', 'Coque', 'Careca', 'Topete degradê', 'Penteado', 'Twists', 'Baixinho'][v] },
  { nome: 'Barba', i: 3, n: 8, rot: v => ['Sem barba', 'Rala', 'Cheia', 'Cavanhaque', 'Bigode', 'Bigodinho', 'Aparada', 'Curta'][v] },
  { nome: 'Rosto', i: 4, n: 3, rot: v => ['Oval', 'Fino', 'Quadrado'][v] },
];
const NACOES = [['BRA', 'Brasil'], ['ARG', 'Argentina'], ['URU', 'Uruguai'], ['POR', 'Portugal'], ['ESP', 'Espanha'], ['ITA', 'Itália'], ['FRA', 'França'], ['ALE', 'Alemanha'], ['ING', 'Inglaterra'], ['COL', 'Colômbia'], ['CHI', 'Chile'], ['PAR', 'Paraguai'], ['EQU', 'Equador'], ['PER', 'Peru'], ['HOL', 'Holanda']];
const digito = (code, i) => parseInt(code[i], 36);
const comDigito = (code, i, v) => code.slice(0, i) + v.toString(36) + code.slice(i + 1);
const estrelasTxt = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const forcaEstrelas = ci => { const f = app.base.forca(ci); return f >= 76 ? 5 : f >= 71 ? 4 : f >= 66 ? 3 : f >= 60 ? 2 : 1; };

function rostoAleatorio() {
  const r = () => Math.random();
  return [Math.floor(r() * 6), Math.floor(r() * 7), Math.floor(r() * 14), Math.floor(r() * 8), Math.floor(r() * 3), 0, 0, 0, 0, 0].map(v => v.toString(36)).join('');
}

telas.novo = () => {
  const n = app.novo, t = n.tecnico;
  if (n.passo === 1) return `<div class="titulo-linha"><h2>Seu técnico</h2><span class="passos">Passo 1 de 2</span></div>
    <section class="cartao">
      <label>Nome do técnico <input type="text" data-campo="nome" maxlength="24" value="${esc(t.nome)}" placeholder="Ex.: Professor Pardal" autocomplete="off"></label>
      <div class="avatar-editor"><div class="moldura"><img class="px" src="${urlRosto(t.rosto, TERNO)}" width="32" height="32" alt="Aparência do técnico"></div>
        <div class="partes">${PARTES.map(p => { const v = digito(t.rosto, p.i); return `<div class="parte"><span>${p.nome}</span>
          <button type="button" data-acao="parte" data-i="${p.i}" data-n="${p.n}" data-d="-1" aria-label="${p.nome} anterior">‹</button><output>${p.rot(v)}</output>
          <button type="button" data-acao="parte" data-i="${p.i}" data-n="${p.n}" data-d="1" aria-label="Próximo ${p.nome.toLowerCase()}">›</button></div>`; }).join('')}
          <button class="botao peq sec" type="button" data-acao="sortear-rosto">Sortear visual</button></div></div>
      <label>Nacionalidade <select data-campo="nat">${NACOES.map(([k, v]) => `<option value="${k}" ${t.nat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </section>
    <section class="cartao"><h3>Passado no futebol</h3><p class="mudo">Define a sua reputação inicial: quem vai querer te contratar.</p>
      <div class="opcoes">${REPUTACOES.map(r => `<label class="opcao"><input type="radio" name="rep" data-campo="reputacao" value="${r.k}" ${t.reputacao === r.k ? 'checked' : ''}><strong>${r.nome}</strong><small>${r.desc}</small></label>`).join('')}</div></section>
    <section class="cartao"><h3>Dificuldade</h3>
      <div class="opcoes">${Object.entries(DIFICULDADES).map(([k, v]) => `<label class="opcao"><input type="radio" name="dif" data-campo="dificuldade" value="${k}" ${n.dificuldade === k ? 'checked' : ''}><strong>${v}</strong><small>${{ facil: 'Diretoria paciente e caixa folgado.', normal: 'O equilíbrio do futebol brasileiro.', dificil: 'Torcida cobra, dinheiro some, rivais espertos.' }[k]}</small></label>`).join('')}</div></section>
    <p class="erro" role="alert"></p>
    <div class="linha-botoes"><a class="botao sec" href="#/saves">Voltar</a><button class="botao" data-acao="passo2" type="button">Próximo</button></div>`;

  const divs = ['A', 'B', 'C'];
  const lista = app.base.clubes.map((c, i) => i).filter(i => clube(i).div === n.abaDiv).sort((a, b) => app.base.forca(b) - app.base.forca(a));
  return `<div class="titulo-linha"><h2>Onde começar</h2><span class="passos">Passo 2 de 2</span></div>
    <section class="cartao"><div class="opcoes">
      ${[['escolher', 'Escolher clube', 'Você decide onde vai trabalhar.'], ['sorteio', 'Sorteio', 'Um clube aleatório da série que você escolher.'], ['reputacao', 'Pela reputação', `Um clube do tamanho do seu nome: ${REPUTACOES[t.reputacao].nome.toLowerCase()}.`]]
        .map(([k, tit, d]) => `<label class="opcao"><input type="radio" name="modo" data-campo="modo" value="${k}" ${n.modo === k ? 'checked' : ''}><strong>${tit}</strong><small>${d}</small></label>`).join('')}
    </div></section>
    ${n.modo === 'reputacao' ? '' : `<section class="cartao"><h3>${n.modo === 'sorteio' ? 'Sortear entre os clubes da' : 'Escolha o clube'}</h3>
      <div class="chips" role="group" aria-label="Divisão">${divs.map(d => `<button type="button" class="chip" data-acao="aba-div" data-div="${d}" aria-pressed="${n.abaDiv === d}">Série ${d}</button>`).join('')}</div>
      ${n.modo === 'escolher' ? `<div class="clubes-lista">${lista.map(ci => `<label class="opcao clube-op"><input type="radio" name="clube" data-campo="clube" value="${ci}" ${n.clube === ci ? 'checked' : ''}>${imgEscudo(ci, 34, 37)}<span><strong style="font-size:1rem">${esc(clube(ci).n)}</strong><br><span class="estrelas" aria-label="Força ${forcaEstrelas(ci)} de 5">${estrelasTxt(forcaEstrelas(ci))}</span></span></label>`).join('')}</div>` : ''}
    </section>`}
    <p class="erro" role="alert"></p>
    <div class="linha-botoes"><button class="botao sec" data-acao="passo1" type="button">Voltar</button><button class="botao grande" data-acao="comecar" type="button" style="flex:2">Começar carreira</button></div>`;
};

// ----- clube -----
// quem não joga a próxima partida (lesão ou suspensão naquela competição)
function desfalques(ci, fim) {
  const s = app.s, comp = compProxima(app.base, s), doze = j => comp === 'L' && clube(ci).div === 'A' && barrado12(s, j.id, ci);
  const d = fim ? [] : app.base.elencos[ci].filter(j => indisponivel(s, j.id, comp) || barradoMedo(app.base, s, j.id, ci) || doze(j));
  const medo = d.filter(j => barradoMedo(app.base, s, j.id, ci));
  return (d.length ? `<a class="cartao aviso-contratos aviso-dm" href="#/dm"><b>Desfalques no próximo jogo</b><span>${d.map(j => `${esc(j.curto)} (${{ lesao: `lesão, ${s.dm[j.id]?.n} jogo${s.dm[j.id]?.n > 1 ? 's' : ''}`, suspenso: 'suspenso', afastado: `afastado, ${s.afast?.[j.id]?.n} jogo${s.afast?.[j.id]?.n > 1 ? 's' : ''}`, selecao: 'na seleção', medo: 'cláusula do medo', doze: 'regra dos 12 jogos' }[indisponivel(s, j.id, comp) || (doze(j) ? 'doze' : 'medo')]})`).join(', ')}</span></a>` : '') + medo.map(j => `<section class="cartao aviso-medo"><p><b>Cláusula do medo:</b> ${esc(j.curto)} não pode enfrentar o ${esc(clube(app.s.emprestimos[j.id].de).n)}, dono do passe. Pagando a multa, ele joga.</p><button class="botao peq" type="button" data-acao="pagar-medo" data-id="${j.id}">Pagar multa de ${fmtDinheiro(multaMedo(j))}</button></section>`).join('');
}
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'], SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const ATALHOS = [
  ['carta', 'Mensagens', '#/mensagens', '#7A5CC2'], ['tatica', 'Tática', '#/elenco', 'var(--gramado)'], ['calendario', 'Agenda', '#/calendario', 'var(--carimbo)'], ['apito', 'Último jogo', '#/partida', 'var(--placar)'],
  ['moeda', 'Finanças', '#/financas', '#C9A227'], ['pessoa', 'Carreira', '#/carreira', 'var(--cartao)'],
  ['halter', 'Treino', '#/treino', '#E07B39'], ['broto', 'Base', '#/base', 'var(--gramado)'], ['cruz', 'DM', '#/dm', 'var(--cartao)'], ['micro', 'Coletiva', '#/coletiva', 'var(--carimbo)'], ['camisa', 'Uniforme', null, '#2BA8A0'],
];

// ----- vestiário -----
function prelecaoHtml() {
  const s = app.s, feita = prelecaoFeita(app.base, s);
  if (feita) return `<section class="cartao prelecao"><b>Preleção feita:</b> ${PRELECOES[feita].nome} · moral dos titulares ${s.prelecao.media >= 0 ? '+' : ''}${String(s.prelecao.media).replace('.', ',')}</section>`;
  return `<section class="cartao prelecao"><h3>Preleção</h3><div class="col-respostas">${Object.entries(PRELECOES).map(([k, p]) => { const d = efeitoPrelecao(app.base, s, k);
    return `<button type="button" class="col-resp" data-acao="prelecao" data-t="${k}"><span class="col-tom">${p.nome}</span><span class="col-frase">${p.desc}</span><span class="col-ef"><span class="${d > 0 ? 'sobe' : d < 0 ? 'desce' : ''}">Grupo ${d > 1 ? '▲▲' : d > 0 ? '▲' : d < 0 ? '▼' : '='}</span></span></button>`; }).join('')}</div>
    <p class="mudo" style="font-size:.92rem">Uma por jogo, antes de entrar em campo. Mexe na moral dos titulares conforme o favoritismo, o último resultado e o temperamento de cada um.</p></section>`;
}
function conversaHtml(j) {
  const t = TEMPERAMENTOS[temperamento(j)], ok = podeConversar(app.s, j.id);
  return `<section class="conversa"><p><b>Temperamento:</b> ${t.nome} <span class="mudo">· ${t.desc}</span></p>
    ${ok ? `<div class="chips">${Object.entries(CONVERSAS).map(([k, c]) => `<button class="chip" type="button" data-acao="conversar" data-id="${j.id}" data-t="${k}" title="${c.desc}">${c.nome}</button>`).join('')}</div>` : '<p class="mudo">Vocês conversaram há pouco. Espere umas rodadas.</p>'}</section>`;
}

// ----- caixa de mensagens -----
const ROSTO_REM = { diretor: '3220100000', presidente: '1612200000', medico: '2033100000', olheiro: '4141000000' };
const cartaMsg = (m, curta = false) => {
  const aut = m.de === 'jogador' && app.base.jog.get(m.autor), r = aut ? { nome: aut.curto, cargo: `${POS_NOME[aut.pos]} do elenco` } : remetente(app.s, m.de);
  const foto = aut ? urlRosto(aut.rosto, clube(aut.clube)) : urlRosto(ROSTO_REM[m.de] || ROSTO_REM.diretor, TERNO);
  const resp = m.opcoes && !curta ? (m.resp ? `<p class="mudo msg-resp">Você respondeu: ${esc(m.opcoes.find(o => o[0] === m.resp)?.[1] || '')}</p>` : `<div class="linha-botoes">${m.opcoes.map(([k, rot], i) => `<button class="botao peq ${i ? 'sec' : ''}" type="button" data-acao="msg-resp" data-m="${m.id}" data-r="${k}">${rot}</button>`).join('')}${m.tipoJ === 'reforco' ? `<a class="botao peq sec" href="#/mercado" data-acao="msg-aba" data-a="buscar" data-setor="${m.setor || ''}">Abrir o Mercado</a>` : ''}</div>`) : '';
  return `<article class="msg ${m.lida ? '' : 'nova'} ${aut ? 'de-jogador' : ''}" data-msg="${esc(m.id)}"><div class="msg-topo"><img class="px" src="${foto}" width="32" height="32" alt=""><span><b>${esc(r.nome)}</b><small>${esc(r.cargo)} · ${m.rodada ? `rodada ${m.rodada}` : 'pré-temporada'}</small></span></div>
    <h3>${esc(m.assunto)}</h3>${curta ? '' : `<p>${esc(m.texto)}</p>${resp}`}
    ${curta ? '' : `<div class="linha-botoes">${m.jogador != null && app.base.jog.get(m.jogador) ? `<button class="botao peq sec" type="button" data-acao="ficha" data-id="${m.jogador}">Ver jogador</button>` : ''}${m.link ? `<a class="botao peq" href="${m.link}" ${m.aba ? `data-acao="msg-aba" data-a="${m.aba}"` : ''}>Resolver</a>` : ''}${m.aumento != null && (app.s.pedidosAumento || []).some(p => p.jogador === m.aumento) ? `<button class="botao peq" type="button" data-acao="aumento" data-id="${m.aumento}" data-sim="1">Dar aumento</button><button class="botao peq sec" type="button" data-acao="aumento" data-id="${m.aumento}">Negar</button>` : ''}</div>`}</article>`; };
function recados() {
  const novas = (app.s.msgs || []).filter(m => !m.lida);
  return novas.length ? `<a class="cartao recados" href="#/mensagens"><b>${novas.length} mensage${novas.length > 1 ? 'ns' : 'm'} do clube</b><span>${novas.slice(0, 3).map(m => esc(m.assunto)).join(' · ')}</span></a>` : '';
}
telas.mensagens = () => {
  const s = app.s, msgs = s.msgs || [];
  const html = `<div class="titulo-linha"><h2>Mensagens</h2><a href="#/clube">Voltar</a></div>
    ${msgs.length ? `<p class="mudo arrasta-msg">Arraste uma mensagem para a esquerda para apagar.</p><div class="caixa-msgs">${msgs.map(m => cartaMsg(m)).join('')}</div>` : '<section class="cartao"><p class="mudo">Nenhuma mensagem.</p></section>'}`;
  let mudou = false; for (const m of msgs) if (!m.lida) { m.lida = true; mudou = true; }
  if (mudou) { salvar(); setTimeout(desenhaTopo, 0); }
  return html;
};

// ----- vida de técnico -----
const CARGO_TXT = { ok: 'Cargo estável', risco: 'Cargo balançando' };
function cargoChip() {
  const C = app.s.cargo; if (!C || app.s.demitido) return '';
  return `<span class="cargo ${C.st}">${C.ult ? `Ultimato: ${C.ult.need} pts em 3 jogos` : CARGO_TXT[C.st] || CARGO_TXT.ok}</span>`;
}
const ofertaLinha = o => `<li class="oferta"><span class="of-clube">${imgEscudo(o.clube, 30, 33)}<span><b>${esc(clube(o.clube).n)}</b><small>Série ${clube(o.clube).div} · ${estrelasTxt(forcaEstrelas(o.clube))}${o.ate ? ` · responder até a ${o.ate}ª rodada` : ''}</small></span></span>
  <span class="of-botoes"><button class="botao peq" type="button" data-acao="aceitar-oferta" data-c="${o.clube}">Assumir</button>${o.tipo === 'vaga' ? `<button class="botao peq sec" type="button" data-acao="recusar-oferta" data-c="${o.clube}">Recusar</button>` : ''}</span></li>`;
function ofertasHtml() {
  const o = (app.s.ofertas || []).filter(x => x.tipo === 'vaga');
  return o.length && !app.s.demitido ? `<section class="cartao ofertas"><h3>Propostas de emprego</h3><ul>${o.map(ofertaLinha).join('')}</ul><p class="mudo">Aceitar leva você para o clube novo na hora: o elenco, o caixa e a meta passam a ser os de lá.</p></section>` : '';
}
function demitidoHtml() {
  const s = app.s, x = s.demitido;
  return `<section class="cartao escuro demitido"><h2>${x.pediu ? 'Você deixou o' : 'Demitido do'} ${esc(clube(x.de).n)}</h2><p>${esc(x.motivo)}</p>
    <p>Propostas na mesa. Escolha o próximo trabalho:</p><ul>${s.ofertas.map(ofertaLinha).join('')}</ul></section>`;
}

telas.clube = () => {
  const s = app.s, ci = s.tecnico.clube, c = clube(ci), d = c.div;
  garantirCarreira(app.base, s);
  const ev = proximoEvento(app.base, s), fim = !ev && fimDeTemporada(s), espera = !ev && !fim && pendentes(app.base, s)[0];
  const jogo = ev && [ev.h, ev.a];
  const tab = tabela(app.base, s, d), pos = tab.findIndex(l => l.clube === ci);
  const viz = tab.slice(Math.max(0, Math.min(pos - 2, tab.length - 5)), Math.max(5, pos + 3)).map(l => ({ ...l, n: tab.indexOf(l) + 1 }));
  const dt = ev ? ev.data : dataRodada(s.ano, 37), janela = janelaAberta(s.ano, s.rodada);
  const acabando = s.rodada >= 19 ? app.base.elencos[ci].filter(j => j.contrato <= s.ano && !s.preContratos?.some(p => p.jogador === j.id) && !s.emprestimos?.[j.id]) : [];
  const lado = ci2 => { const p = posicaoNoJogo(ev, ci2); return `<div class="lado">${imgEscudo(ci2, 64, 69)}<span>${esc(clube(ci2).n)}</span>${p ? `<small>${p}º</small>` : ''}</div>`; };
  return `<div class="status-clube"><span title="Dinheiro em caixa"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${ICONES.moeda}</svg>${fmtDinheiro(s.caixa ?? 0)}</span>
      <span>${feitas(s, d) ? `${pos + 1}º na Série ${d}` : `Série ${d}`}</span><span class="${janela ? 'aberta' : ''}">${janela ? 'Janela aberta' : 'Janela fechada'}</span>${cargoChip()}${app.liga ? `<a class="liga" href="#/liga"><span>${esc(Liga.estadoTopo())}</span></a>` : ''}</div>
    ${s.demitido ? demitidoHtml() : espera ? esperaHtml(espera) : fim ? `<section class="cartao escuro fim-temporada"><h2>Fim da temporada ${s.ano}</h2>${(Q => { const p = Q.cl[d].indexOf(ci) + 1, subiu = Q.sobe.B.includes(ci) || Q.sobe.C.includes(ci), caiu = [...Q.cai.A, ...Q.cai.B, ...Q.cai.C].includes(ci); return `<p>${esc(c.n)} terminou em <b>${p}º</b> na Série ${d}${subiu ? ' e <b>subiu</b>' : caiu ? ' e <b>caiu</b>' : ''}. Campeão: <b>${esc(clube(d === 'C' ? (s.f2?.C?.campeao ?? Q.cl.C[0]) : tab[0].clube).n)}</b>.${s.copa?.campeao != null ? ` Copa do Brasil: <b>${esc(clube(s.copa.campeao).n)}</b>.` : ''}</p>`; })(acessoEQueda(app.base, s))}
      ${acabando.length ? `<p style="color:var(--placar)">Saem por fim de contrato: ${acabando.map(j => esc(j.curto)).join(', ')}. Ainda dá para renovar na ficha de cada um.</p>` : ''}
      <div class="linha-botoes"><a class="botao sec" href="#/gala">Premiação de gala</a>${app.liga ? '' : `<button class="botao grande" type="button" data-acao="virar">Começar a temporada ${s.ano + 1}</button>`}</div>${app.liga ? Liga.relogio(`A temporada ${s.ano + 1} começa`) : ''}</section>`
    : `<section class="ingresso ${ev.tipo !== 'liga' ? 'copa' : ''}" style="--cc:${c.c[0]};--cc2:${c.c[1] || '#fff'}">
      <div class="ingresso-data"><span class="dia">${String(dt.getUTCDate()).padStart(2, '0')}</span><span class="mes">${MESES[dt.getUTCMonth()]}</span><span class="sem">${SEMANA[dt.getUTCDay()]}</span><span class="ano">${dt.getUTCFullYear()}</span></div>
      <div class="ingresso-corpo"><span class="ingresso-tag">${esc(ev.titulo)} · ${ev.neutro ? 'campo neutro' : jogo[0] === ci ? 'em casa' : 'fora'}</span>
        <div class="ingresso-jogo">${lado(jogo[0])}<span class="x">×</span>${lado(jogo[1])}</div>
        <span class="ingresso-local">${ev.neutro ? 'Estádio neutro' : esc(clube(jogo[0]).est[0])}</span>
        ${(p => `<span class="previa" title="Chance pelo que os elencos rendem hoje"><b>V ${p.vitoria}%</b><b>E ${p.empate}%</b><b>D ${p.derrota}%</b></span>`)(previa(app.base, s, ev))}
        ${ev.tipo === 'amistoso' ? '' : `<span class="retro-ingresso">${esc(textoConfronto(confronto(s, ci, jogo[0] === ci ? jogo[1] : jogo[0])))}</span>`}
        ${app.liga ? Liga.relogio('Bola rola', ev) : `<button class="botao grande" data-acao="jogar" type="button">${s.vivo ? `Retomar o jogo (${s.vivo.min}')` : 'Jogar'}</button>`}</div></section>`}
    ${s.demitido || fim || espera ? '' : prelecaoHtml()}${s.demitido || espera ? '' : desfalques(ci, fim)}${ofertasHtml()}${recados()}
    ${acabando.length && !fim ? `<a class="cartao aviso-contratos" href="#/elenco"><b>${acabando.length} ${acabando.length > 1 ? 'contratos acabam' : 'contrato acaba'} no fim da temporada</b><span>${acabando.slice(0, 5).map(j => esc(j.curto)).join(', ')}${acabando.length > 5 ? '…' : ''}. Quem não renovar sai de graça, e outro clube pode assinar pré-contrato.</span></a>` : ''}
    <nav class="atalhos" aria-label="Atalhos do clube">${ATALHOS.map(([ic, t, href, cor]) => {
      const off = !href || (href === '#/partida' && !s.ultima);
      const nl = ic === 'carta' ? naoLidas(s) : 0, ponto = nl ? `<i class="ponto num" aria-label="${nl} não lidas">${nl}</i>` : ic === 'micro' && !s.demitido && Coletiva.pendente(s) ? '<i class="ponto" aria-label="coletiva aberta"></i>' : '';
      return href && !off ? `<a class="atalho" href="${href}" style="--ac:${cor}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[ic]}</svg><span>${t}</span>${ponto}</a>`
        : `<button class="atalho off" type="button" data-acao="em-breve" data-t="${t}" style="--ac:${cor}" aria-disabled="true"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[ic]}</svg><span>${t}</span>${href ? '' : '<small>em breve</small>'}</button>`;
    }).join('')}</nav>
    <div class="grade-clube">
      <section class="cartao"><div class="titulo-linha"><h3>Seu clube no noticiário</h3><a href="#/noticias">Jornal da Bola</a></div><ul class="noticias">${s.noticias.filter(x => (x.tipo || 'clube') === 'clube').slice(0, 6).map(x => `<li><span class="rd">R${x.rodada}</span><span>${esc(x.texto)}</span></li>`).join('')}</ul></section>
      <section class="cartao"><div class="titulo-linha"><h3>Série ${d}</h3><a href="#/torneios">Tabela completa</a></div>
      <table><thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>SG</th></tr></thead>
      <tbody>${viz.map(l => `<tr class="${l.clube === ci ? 'meu' : ''}"><td class="pos">${l.n}</td><td class="clube-cel"><span>${imgEscudo(l.clube, 20, 22)}${esc(clube(l.clube).n)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.sg}</td></tr>`).join('')}</tbody></table></section></div>`;
};

// sem jogo seu até o fim da temporada (ou por um tempo): o calendário anda até a próxima data, ou até o fim
function esperaHtml(x) {
  const dt = new Date(+x.data), dia = `${dt.getUTCDate()} de ${MESES[dt.getUTCMonth()].toLowerCase()}`;
  return `<section class="cartao escuro fim-temporada"><h2>Sem jogos do ${esc(clube(app.s.tecnico.clube).n)} por agora</h2>
    <p>O calendário segue sem o seu clube. Próxima data: <b>${dia}</b> · ${esc(x.titulo)}.${janelaAberta(app.s.ano, app.s.rodada) ? ' A janela de transferências está aberta.' : ''}</p>
    ${app.liga ? Liga.relogio('O calendário anda sozinho. Próximo horário da liga:') : `<div class="linha-botoes"><button class="botao sec" type="button" data-acao="avancar-data">Avançar até ${dia}</button><button class="botao grande" type="button" data-acao="avancar-fim">Até o fim da temporada</button></div>`}</section>`;
}

// ----- finanças -----
const ROT_FIN = { bilheteria: 'Bilheteria', tv: 'Cota de TV', patrocinio: 'Patrocínio', premio: 'Prêmios', venda: 'Vendas', verba: 'Verba da diretoria', socorro: 'Socorro (adiantamentos)', salarios: 'Salários', compra: 'Compras', rescisao: 'Rescisões', emprestimo: 'Taxas de empréstimo', revenda: 'Percentual de revenda', minutagem: 'Multas de minutagem', medo: 'Cláusula do medo', multa: 'Multas de jogadores', investidor: 'Investidores', calote: 'Calotes', fpf: 'Fair play financeiro (CBF)', penhora: 'Penhoras', show: 'Shows no estádio', vaquinha: 'Vaquinha da torcida', reembolso: 'Reembolsos de empréstimo' };
telas.financas = () => {
  const s = app.s, ci = s.tecnico.clube, c = clube(ci), aba = app.abaFin || 'resumo';
  garantirFinancas(app.base, s);
  const f = s.fin, o = orcamento(app.base, s), sc = socorro(app.base, s), meta = metaDiretoria(app.base, s), bal = balanco(s);
  const topo = `<div class="titulo-linha"><h2>Finanças</h2><a href="#/clube">Voltar</a></div>
    <section class="cartao caixa-topo"><small>Caixa</small><b class="num">${fmtDinheiro(s.caixa)}</b>
      <p class="fim-temp ${o.fim < 0 ? 'neg' : 'pos'}">${o.fim < 0 ? `Faltam <b>${fmtDinheiro(-o.fim)}</b> para fechar a temporada` : `Fecha a temporada com <b>${fmtDinheiro(o.fim)}</b>`} <small>(com TV, patrocínio e bilheteria que faltam, menos ${o.dias} dias de salário)</small></p></section>
    <div class="chips" role="group" aria-label="Seção">${[['resumo', 'Resumo'], ['extrato', 'Extrato'], ['balanco', `Balanço ${s.ano}`]].map(([k, t]) => `<button type="button" class="chip" data-acao="aba-fin" data-a="${k}" aria-pressed="${aba === k}">${t}</button>`).join('')}</div>`;
  if (aba === 'extrato') return topo + `<section class="cartao"><h3>Extrato</h3>${f.extrato.length ? `<ul class="extrato">${f.extrato.slice(0, 150).map(e => `<li><span class="rd">R${e.r + 1}</span><span>${esc(e.desc)}</span><b class="${e.valor < 0 ? 'neg' : 'pos'}">${e.valor < 0 ? '−' : '+'} ${fmtDinheiro(Math.abs(e.valor))}</b></li>`).join('')}</ul>` : '<p class="mudo">Nada lançado ainda. As contas fecham a cada rodada.</p>'}</section>`;
  if (aba === 'balanco') {
    const rec = Object.entries(bal).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), desp = Object.entries(bal).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
    const soma = l => l.reduce((t, [, v]) => t + v, 0);
    const linha = ([k, v]) => `<li><span>${ROT_FIN[k] || k}</span><b class="${v < 0 ? 'neg' : 'pos'}">${v < 0 ? '−' : '+'} ${fmtDinheiro(Math.abs(v))}</b></li>`;
    return topo + `<section class="cartao"><h3>Receitas</h3><ul class="linhas-fin">${rec.map(linha).join('') || '<li class="mudo">Nenhuma ainda</li>'}</ul><p class="total">Total <b class="pos">+ ${fmtDinheiro(soma(rec))}</b></p></section>
      <section class="cartao"><h3>Despesas</h3><ul class="linhas-fin">${desp.map(linha).join('') || '<li class="mudo">Nenhuma ainda</li>'}</ul><p class="total">Total <b class="neg">− ${fmtDinheiro(Math.abs(soma(desp)))}</b></p></section>
      <section class="cartao"><p class="total">Resultado da temporada <b class="${soma(rec) + soma(desp) < 0 ? 'neg' : 'pos'}">${fmtDinheiro(soma(rec) + soma(desp))}</b></p></section>
      <section class="cartao"><h3>Dicas do diretor financeiro</h3><ul class="dicas">${dicasFinanceiras(app.base, s).map(d => `<li>${esc(d)}</li>`).join('')}</ul></section>`;
  }
  const jogo = rodadasDe(app.base, s, c.div)[feitas(s, c.div)]?.find(([h, a]) => h === ci || a === ci) || null;
  const tab = tabela(app.base, s, c.div), l = tab.find(x => x.clube === ci), pos = tab.indexOf(l) + 1;
  const advCasa = jogo && jogo[0] === ci ? jogo[1] : null;
  const prev = nivel => bilheteria(app.base, s, ci, advCasa ?? ci, l.ultimos, pos, nivel);
  const pctSal = o.maxSal > o.folha ? Math.round((o.salarios - o.folha) / (o.maxSal - o.folha) * 100) : 0;
  return topo + `
    <section class="cartao aviso-fin ${sc.ok ? 'ok' : 'nao'}"><p><b>${sc.ok ? 'Socorro disponível' : 'Socorro bloqueado'}:</b> se o caixa ficar negativo, a TV adianta a cota e os salários saem em dia. Perde esse direito quem comprar mais do que vender na temporada ou aumentar a folha em mais de 10% (regra da ANRESF).${sc.ok ? '' : ` Agora está bloqueado porque ${esc(sc.motivo)}.`}</p></section>
    ${(fp => { const p = v => `${Math.round(v * 100)}%`, serieC = fp.limCusto === Infinity;
      return `<section class="cartao aviso-fin ${fp.falhas.length || fp.divida ? 'nao' : 'ok'}"><p><b>Fair play financeiro</b> <span class="mudo">(ano até agora${s.ano < ANO_FPF ? `; até ${ANO_FPF - 1} a CBF só adverte` : ''})</span></p>
      ${serieC ? '<p>Na Série C a CBF só cobra dívida em atraso: salário em dia.</p>' : `<ul class="fpf"><li>Custo do elenco: <b>${p(fp.razao)}</b> da receita <span class="mudo">(limite ${p(fp.limCusto)})</span></li><li>Dívida de curto prazo: <b>${p(fp.razaoCurto)}</b> da receita <span class="mudo">(limite ${p(fp.limCurto)})</span></li><li>Resultado em 3 anos: <b>${fmtDinheiro(fp.tri)}</b> <span class="mudo">(déficit tolerado ${fmtDinheiro(fp.tol)})</span></li></ul>`}
      <p class="mudo" style="font-size:.95rem">${fp.divida ? 'Salário atrasado é dívida com credor relevante: a CBF confere em 31/3, 31/7 e 30/11. ' : ''}${registroBloqueado(s) ? `Transfer ban até a ${registroBloqueado(s) + 1}ª rodada. ` : ''}${s.fpf?.degrau ? `Situação na CBF: ${SANCOES[s.fpf.degrau]}${s.fpf.retido ? ` (${fmtDinheiro(s.fpf.retido)} retidos)` : ''}. ` : ''}A CBF julga o ano fechado, na virada. Verba da diretoria conta como aporte e alivia o custo e o déficit.</p></section>`; })(fairPlay(app.base, s))}
    <section class="cartao"><div class="titulo-linha"><h3>Diretoria</h3><span class="conf"><b class="num">${Math.round(f.diretoria)}</b>/100 de confiança</span></div>
      <p>Meta: <b>${meta.txt}</b>. ${s.rodada ? `Hoje: ${pos}º.` : ''}</p>
      ${(T => `<p>Teto salarial: <b>€ ${T.teto.toLocaleString("pt-BR")}/dia</b> por jogador em contrato novo.${T.partes.length ? ` <span class="mudo">(${T.partes.map(([t, p]) => `${t} ${p > 0 ? '+' : ''}${p}%`).join(' · ')})</span>` : ''}</p><p class="mudo" style="font-size:.95rem">A diretoria sobe o teto com Libertadores ou Sul-Americana, campanha na Copa do Brasil, título regional e confiança alta; recém-promovido recebe menos. Quem já ganha acima continua, mas não renova nem ganha aumento acima do teto.</p>`)(tetoSalarial(app.base, s))}
      <div class="linha-botoes"><button class="botao sec" type="button" data-acao="pedir-verba">Pedir verba</button></div></section>
    <section class="cartao"><div class="titulo-linha"><h3>Salários × compras</h3></div>
      <div class="barra-orc"><div class="orc-sal" style="width:${Math.max(8, Math.min(92, 100 - (o.compras / Math.max(1, o.compras + o.salarios * o.dias)) * 100))}%"></div></div>
      <div class="orc-legenda"><span class="sal">Salários ${fmtDinheiro(o.salarios)}/dia</span><span class="comp">Compras ${fmtDinheiro(o.compras)}</span></div>
      ${o.maxSal > o.folha ? `<label class="vh" for="orc-slider">Orçamento de salários por dia</label><input id="orc-slider" type="range" min="0" max="100" step="1" value="${pctSal}" data-orc>` : ''}
      <div class="chips"><span class="chip-info">Folha ${fmtDinheiro(o.folha)}/dia</span><span class="chip-info">Folga ${fmtDinheiro(o.folga)}/dia</span></div>
      <p class="msg-fin ${o.pagaAteFim ? 'ok' : 'nao'}">${o.pagaAteFim ? `O caixa paga os salários até o fim da temporada (faltam ${o.dias} dias).` : `O caixa (com a TV que falta) paga só ${o.diasDeSalario} dias de salário; faltam ${o.dias}.`}</p>
      <p class="mudo" style="font-size:.95rem">Mais espaço para salários deixa contratar quem ganha mais; o resto do caixa vira verba de compras. A folga é quanto ainda cabe de salário novo.</p></section>
    <section class="cartao"><div class="titulo-linha"><h3>${esc(c.est[0])}</h3><span class="mudo">${(c.est[1] || 0).toLocaleString('pt-BR')} lugares</span></div>
      <div class="chips" role="group" aria-label="Preço do ingresso">${Object.keys(PRECOS).map(k => `<button type="button" class="chip" data-acao="ingresso" data-p="${k}" aria-pressed="${f.ingresso === k}">${NOME_PRECO[k]} · ${fmtDinheiro(prev(k).preco)}</button>`).join('')}</div>
      ${advCasa != null ? `<p>Próximo jogo em casa (× ${esc(clube(advCasa).n)}): cerca de <b>${prev(f.ingresso).publico.toLocaleString('pt-BR')}</b> pagantes (${Math.round(prev(f.ingresso).occ * 100)}% de lotação), renda de <b>${fmtDinheiro(prev(f.ingresso).renda)}</b>.</p>` : '<p class="mudo">O próximo jogo é fora de casa.</p>'}
      <p class="mudo" style="font-size:.95rem">Ingresso caro com estádio cheio agrada a diretoria; abusivo com estádio vazio irrita.</p></section>
    <section class="cartao"><h3>Na temporada</h3><ul class="linhas-fin">${['bilheteria', 'tv', 'patrocinio', 'premio', 'venda', 'verba', 'salarios', 'compra'].map(k => `<li><span>${ROT_FIN[k]}${k === 'patrocinio' ? ` · ${esc(f.patrocinador)}` : ''}</span><b class="${(bal[k] || 0) < 0 ? 'neg' : 'pos'}">${(bal[k] || 0) < 0 ? '−' : '+'} ${fmtDinheiro(Math.abs(bal[k] || 0))}</b></li>`).join('')}</ul></section>`;
};

// ----- carreira -----
function cargoHtml() {
  const s = app.s, P = pilares(app.base, s), C = s.cargo, meta = metaDiretoria(app.base, s);
  const barra = (rot, v) => `<div class="pilar"><span>${rot}</span><div class="dm-barra"><b style="width:${Math.max(3, v)}%;background:${v >= 55 ? 'var(--gramado)' : v >= 40 ? 'var(--placar)' : 'var(--cartao)'}"></b></div><b class="num">${v}</b></div>`;
  const status = s.demitido ? 'sem clube' : C.ult ? `ultimato: ${C.ult.need} pontos em 3 jogos${C.ult.segunda ? ' (segunda chance)' : ''}` : C.st === 'risco' ? 'balançando' : 'estável';
  const hist = (s.historico || []).map(h => `<li>${h.ano} · ${imgEscudo(h.clube, 18, 20)} ${esc(clube(h.clube).n)} · Série ${h.div}: <b>${h.pos}º</b> · meta ${esc(h.meta)} ${h.bateuMeta ? '✔' : '✘'}</li>`).join('');
  return `<section class="cartao"><h3>Sustentação no cargo</h3>${barra('Diretoria', P.D)}${barra('Torcida', P.T)}${barra('Grupo', P.G)}
      <p style="margin-top:8px"><b>Nota do cargo: ${P.I}</b> · ${status}</p>
      <p><b>Perfil nas coletivas:</b> ${esc(perfil(s).nome)} <span class="mudo">· ${esc(perfil(s).desc)}</span></p>
      <p class="mudo" style="font-size:.95rem">Meta: ${esc(meta.txt)}. A nota é 60% diretoria e 40% torcida. Abaixo de 55 o cargo balança; abaixo de 40 (ou com o grupo abaixo de 20) vem o ultimato: pontos em 3 jogos do campeonato. Se o grupo estiver em 70 ou mais, os jogadores pedem uma segunda chance. Dentro da meta (ou a até 3 pontos dela) e nas 8 primeiras rodadas no clube, ninguém mexe com você. Título de copa derruba o ultimato.</p></section>
    <section class="cartao"><h3>Clubes</h3><ul class="lista-carreira">${(s.carreira || []).map(c => `<li>${imgEscudo(c.clube, 18, 20)} <b>${esc(clube(c.clube).n)}</b> · desde ${c.ano}${c.rodada ? ` (${c.rodada + 1}ª rodada)` : ''}${c.ateAno ? ` até ${c.ateAno} · ${c.saida}` : ' · atual'}</li>`).join('')}</ul>
      ${hist ? `<h3 style="margin-top:12px">Temporadas</h3><ul class="lista-carreira">${hist}</ul>` : ''}</section>
    ${s.demitido ? '' : `<section class="cartao"><h3>Pedir demissão</h3><p class="mudo">Você sai na hora e recebe propostas de clubes do mesmo tamanho ou menores.</p><button class="botao sec" type="button" data-acao="pedir-demissao">Pedir demissão</button></section>`}`;
}

telas.carreira = () => {
  const s = app.s, t = s.tecnico, ci = t.clube, d = clube(ci).div;
  garantirCarreira(app.base, s);
  const l = tabela(app.base, s, d).find(x => x.clube === ci);
  const aprov = l.j ? Math.round(l.p / (l.j * 3) * 100) : 0;
  return `<div class="titulo-linha"><h2>Carreira</h2><a href="#/clube">Voltar</a></div>
    <section class="cartao carreira"><div class="moldura-tec"><img class="px" src="${urlRosto(t.rosto, TERNO)}" width="32" height="32" alt=""></div>
      <div><h2 style="font-size:1.6rem">${esc(t.nome)}</h2><p class="mudo">${bandeira(t.nat)} ${esc((NACOES.find(n => n[0] === t.nat) || [, t.nat])[1])} · ${REPUTACOES[t.reputacao]?.nome || ''}</p>
      <dl class="ficha-dl"><dt>Clube</dt><dd>${imgEscudo(ci, 18, 20)} ${esc(clube(ci).n)}</dd><dt>Temporada</dt><dd>${s.ano}</dd><dt>Dificuldade</dt><dd>${DIFICULDADES[s.dificuldade]}</dd></dl></div></section>
    <div class="kpis"><div class="cartao kpi"><small>Jogos</small><b class="num">${l.j}</b></div><div class="cartao kpi"><small>V · E · D</small><b class="num">${l.v}·${l.e}·${l.d}</b></div>
      <div class="cartao kpi"><small>Gols pró · contra</small><b class="num">${l.gp}·${l.gc}</b></div><div class="cartao kpi"><small>Aproveitamento</small><b class="num">${aprov}%</b></div></div>
    ${cargoHtml()}`;
};

// ----- elenco (módulo próprio) -----
telas.elenco = () => Elenco.tela();

function faseFicha(j) {
  const f = faseDe(app.s, j.id), m = app.s.forma?.[j.id];
  return (f.d ? `<p class="aviso-ficha fase-${f.k}">${f.seta} ${f.nome}: rende como ${j.ovr + f.d} em campo · média recente ${m.toFixed(1).replace('.', ',')}.</p>` : '')
    + (j.idade >= 29 && j.ovrOrig != null && longevo(j) ? '<p class="aviso-ficha fase-boa">Físico de atleta: deve manter o nível por mais tempo que a maioria.</p>' : '');
}
function dmFicha(j) {
  const s = app.s, l = s.dm?.[j.id], sp = s.susp?.[j.id], p = Object.keys(s.amar?.[j.id] || {}).filter(c => pendurado(s, j.id, c));
  return [l && `✚ ${esc(LESOES[l.k]?.n || 'Lesão')}: ${l.inf ? 'vai jogar infiltrado' : `fora dos próximos ${l.n} jogo${l.n > 1 ? 's' : ''}`}.`,
    sp && `Suspenso: ${Object.entries(sp).map(([c, n]) => `${n} jogo${n > 1 ? 's' : ''} ${COMP_DE[c]}`).join(' e ')}.`,
    p.length && `Pendurado (2 amarelos) ${p.map(c => COMP_DE[c].replace(/^d/, 'n')).join(' e ')}.`].filter(Boolean).map(t => `<p class="aviso-ficha">${t}</p>`).join('');
}
// temporadas dele no jogo (Brasileirão) e prêmios de gala
function historicoJogador(j) {
  const s = app.s, e = s.est?.[j.id], linhas = [...(e?.[0] ? [[s.ano, j.clube, e[0], e[1], e[2], Math.round(e[3] / e[0]), true]] : []), ...(s.histJog?.[j.id] || []).slice().reverse()];
  const premios = (s.galas || []).flatMap(g => Object.entries(g.divs).flatMap(([d, x]) => Object.entries(x.premios).filter(([k, l]) => k !== 'prancheta' && l[0]?.id === j.id).map(([k]) => `${GALA_NOME[k]} ${g.ano} (Série ${d})`)));
  if (!linhas.length && !premios.length) return '';
  return `<section class="hist-jog"><h3>Temporadas no jogo</h3>${linhas.length ? `<table class="tabela-hist"><thead><tr><th>Ano</th><th>Clube</th><th>J</th><th>G</th><th>A</th><th>Nota</th></tr></thead><tbody>${linhas.map(([a, c, jg, g, as, n, atual]) => `<tr><td>${a}${atual ? '*' : ''}</td><td>${imgEscudo(c, 14, 15)} ${esc(clube(c).n)}</td><td>${jg}</td><td>${g}</td><td>${as}</td><td>${(n / 10).toFixed(1).replace('.', ',')}</td></tr>`).join('')}</tbody></table>${linhas.some(l => l[6]) ? '<p class="mudo" style="font-size:.85rem">* temporada em andamento · só jogos do Brasileirão</p>' : ''}` : ''}
    ${premios.length ? `<p class="premios-jog">Prêmios: ${premios.map(esc).join(' · ')}</p>` : ''}</section>`;
}
const GALA_NOME = { bola: 'Bola de Ouro', chuteira: 'Chuteira de Ouro', garcom: 'Garçom', luva: 'Luva de Ouro', revelacao: 'Revelação' };
function abrirFicha(id) {
  const j = app.base.jog.get(+id); if (!j) return;
  const meu = j.clube === app.s?.tecnico.clube, carta = cartaDe(j.ovr);
  const corAtt = v => v >= 80 ? 'var(--gramado)' : v >= 65 ? 'var(--carimbo)' : v >= 50 ? 'var(--placar)' : 'var(--cartao)';
  const d = $('#ficha');
  d.innerHTML = `<div class="ficha">
    <div class="ficha-topo">${figurinha(j, '', true)}
      <div><h2 style="font-size:1.4rem">${esc(j.nome)}</h2><p class="mudo">${POS_NOME[j.pos]} · ${esc(clube(j.clube).n)}</p>
      <dl style="margin-top:8px">${app.s && meu ? `<dt>Condição</dt><dd>${Math.round(app.s.cond?.[j.id] ?? 100)}%</dd><dt>Moral</dt><dd>${Elenco.carinha(app.s.mor?.[j.id])} ${Math.round(app.s.mor?.[j.id] ?? 62)}</dd>` : ''}<dt>Idade</dt><dd>${j.idade} anos</dd><dt>País</dt><dd class="pais">${bandeira(j.nat, 32)}${esc(PAISES[j.nat] || j.nat)}</dd><dt>Carta</dt><dd>${carta.nome}</dd>
      <dt>Potencial</dt><dd>${app.s ? Mercado.potencialTxt(j) : '? ? ?'}</dd></dl></div></div>
    <div class="atts">${ATT.map(k => `<div class="att" style="--c:${corAtt(j.att[k])}"><span>${ATT_NOME[k]}</span><span class="num">${j.att[k]}</span><div><b style="width:${j.att[k]}%"></b></div></div>`).join('')}</div>
    ${app.s ? faseFicha(j) + dmFicha(j) : ''}${app.s && meu ? conversaHtml(j) : ''}${app.s?.evo?.[j.id] >= 1 ? `<p class="aviso-ficha evo">▲ +${Math.floor(app.s.evo[j.id])} de overall com o treino no clube.</p>` : ''}
    <dl><dt>Valor</dt><dd>${fmtDinheiro(j.valor * 1000)}</dd><dt>Contrato</dt><dd>até ${j.contrato}</dd></dl>
    ${app.s ? historicoJogador(j) : ''}
    ${app.s ? Mercado.blocoFicha(j) : ''}
    <form method="dialog"><button class="botao sec" style="width:100%">Fechar</button></form></div>`;
  if (!d.open) d.showModal();
}

// ----- mercado (módulo próprio) -----
telas.mercado = () => Mercado.tela();

// ----- torneios e agenda (módulo próprio) -----
telas.torneios = () => Torneios.tela();
telas.calendario = () => `<div class="titulo-linha"><h2>Agenda ${app.s.ano}</h2><a href="#/clube">Voltar</a></div>${Torneios.agenda()}`;

// ----- súmula -----
telas.partida = () => {
  const u = app.s.ultima;
  if (!u) return `<p>Nenhum jogo ainda.</p><a class="botao" href="#/clube">Voltar</a>`;
  const ci = app.s.tecnico.clube, J = id => app.base.jog.get(id), nome = id => esc(J(id)?.curto || '?');
  const st = u.stats, claro = h => { const n = parseInt(h.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255)) / 255 > 0.8; };
  const corDe = (c, evita) => [...c.c, '#1B1F2A'].find(x => !claro(x) && x !== evita);
  const corCasa = corDe(clube(u.casa)), corFora = corDe(clube(u.fora), corCasa);
  const linha = (rot, a, b, fmt = v => v) => { const t = (a + b) || 1; return `<div class="stat"><span class="v">${fmt(a)}</span><div class="barra">${rot}<div><b style="width:${a / t * 100}%;background:${corCasa}"></b><b style="width:${b / t * 100}%;background:${corFora}"></b></div></div><span class="v">${fmt(b)}</span></div>`; };
  const lances = u.eventos.filter(e => ['gol', 'amarelo', 'vermelho', 'lesao', 'sub'].includes(e.tipo));
  const txt = e => e.tipo === 'sub' ? `<span class="assist" style="display:inline">⇄ ${nome(e.jogador)} no lugar de ${nome(e.sai)}</span>` : e.tipo === 'gol' ? `<span class="gol"><i class="ic bola"></i>${nome(e.jogador)}${e.assist ? `<span class="assist">assist. ${nome(e.assist)}</span>` : ''}</span>` : `<i class="ic ${e.tipo}"></i>${nome(e.jogador)}${e.segundo ? ' (2º amarelo)' : e.tipo === 'lesao' ? ' (lesão)' : ''}`;
  const classe = n => n >= 7.5 ? 'alta' : n < 5.5 ? 'baixa' : '';
  const notasTime = t => Object.entries(u.notas[t]).map(([id, n]) => [+id, n]).sort((a, b) => b[1] - a[1]);
  const resultado = u.pen ? ((u.pen[0] > u.pen[1]) === (u.casa === ci) ? 'Vitória nos pênaltis' : 'Derrota nos pênaltis') : u.gols[0] === u.gols[1] ? 'Empate' : (u.gols[0] > u.gols[1]) === (u.casa === ci) ? 'Vitória' : 'Derrota';
  return `<div class="titulo-linha"><h2>${resultado}</h2><span class="mudo">${u.div === 'copa' ? `Copa do Brasil · ${u.copa}` : u.copa || `${u.rodada + 1}ª rodada`}</span></div>
    <section class="placar"><div class="lado">${imgEscudo(u.casa, 60, 65)}<span>${esc(clube(u.casa).n)}</span></div>
      <span class="gols" aria-label="${u.gols[0]} a ${u.gols[1]}">${u.gols[0]}-${u.gols[1]}</span>
      <div class="lado">${imgEscudo(u.fora, 60, 65)}<span>${esc(clube(u.fora).n)}</span></div>
      <small>${u.pen ? `<b>Pênaltis: ${u.pen[0]} a ${u.pen[1]}</b> · ` : ''}${esc(clube(u.casa).est[0])} · Craque do jogo: ${nome(u.craque)}</small></section>
    ${lances.length ? `<section class="cartao"><h3>Lances</h3><ol class="lances">${lances.map(e => `<li><span class="c">${e.time === 0 ? txt(e) : ''}</span><span class="min">${e.min}'</span><span class="f">${e.time === 1 ? txt(e) : ''}</span></li>`).join('')}</ol></section>` : ''}
    <section class="cartao stats"><h3>Estatísticas</h3>
      ${linha('Posse', st[0].posse, st[1].posse, v => v + '%')}${linha('Finalizações', st[0].chutes, st[1].chutes)}${linha('No alvo', st[0].noAlvo, st[1].noAlvo)}
      ${linha('Gols esperados', st[0].xg, st[1].xg, v => v.toFixed(1).replace('.', ','))}${linha('Escanteios', st[0].escanteios, st[1].escanteios)}${linha('Faltas', st[0].faltas, st[1].faltas)}</section>
    <section class="cartao"><h3>Notas</h3><div class="notas">${[0, 1].map(t => `<div><p style="font-weight:700;margin-bottom:4px">${esc(clube(t ? u.fora : u.casa).n)}</p><ol>${notasTime(t).map(([id, n]) => `<li><span>${nome(id)}</span><span class="nota ${id === u.craque ? 'craque' : classe(n)}">${n.toFixed(1).replace('.', ',')}</span></li>`).join('')}</ol></div>`).join('')}</div></section>
    <div class="linha-botoes">${app.s.ultimaVivo ? '<button class="botao sec" type="button" data-acao="assistir">Assistir ao jogo</button>' : ''}<a class="botao" href="#/clube">Voltar ao clube</a></div>`;
};

// ----- jornal da bola -----
telas.noticias = () => Jornal.tela();
telas.coletiva = () => Coletiva.tela();
telas.gala = () => Gala.tela();
telas.leilao = () => Leilao.tela();
telas.liga = () => Liga.tela();

// saves antigos ganham os campos novos; a base recebe as transferências deste save
function migrar(s) {
  garantirMercado(s);
  s.anoInicial ??= s.ano;
  aplicarSave(app.base, s);
  s.est ||= {};
  if (s.leilaoAtivo?.comecou) encerrarPendente(app.base, s); // leilão começado e largado quando o app fechou: a sala termina sem você (o que nem começou abre de novo)
  copaSemVoce(app.base, s); // saves de antes da copa ganham a edição do ano (fases atrasadas se resolvem sozinhas)
  if (s.caixa == null) s.caixa = caixaInicial(app.base, s.tecnico.clube, s.dificuldade);
  garantirFinancas(app.base, s);
  // base de jogadores atualizada depois que a carreira começou: avisa (o save segue por cima da base nova)
  if (s.dadosVersao !== app.base.dados.versao) {
    enviar(s, 'diretor', `base-${app.base.dados.versao}`, 'Base de jogadores atualizada', 'Os clubes da Argentina, Colômbia, Uruguai, Paraguai, Chile, Equador, Peru e Bolívia chegaram com o elenco completo: dá para contratar de lá, e nas copas eles jogam com os titulares reais. Suas contratações, contratos e resultados continuam valendo.');
    s.dadosVersao = app.base.dados.versao;
  }
  return s;
}

// ----- ao vivo -----
telas['ao-vivo'] = () => AoVivo.tela(app.vivo);
function concluirAoVivo() {
  const V = app.vivo; if (!V) return;
  delete app.s.vivo;
  if (!V.fim) AoVivo.pular(V);
  (V.R.amistoso ? concluirAmistoso : V.R.copa ? concluirCopa : V.R.cont ? concluirCont : V.R.reg ? concluirReg : V.R.sup ? concluirSup : V.R.liga2 ? concluirLiga2 : concluirRodada)(app.base, app.s, V.R, AoVivo.resultadoFinal(V));
  app.vivo = null;
  salvar();
}

// os jogos dos outros (rodada inteira, regionais atrasados) podem levar um tempo: a tela avisa antes de calcular
const umQuadro = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
async function comecarJogo() {
  if (app.liga) return ir('#/clube'); // na liga o jogo acontece no horário
  const bt = $('[data-acao=jogar]'); if (bt) { bt.disabled = true; bt.textContent = 'Simulando os outros jogos…'; }
  await umQuadro();
  const b = app.base, s = app.s, antes = proximoEvento(b, s);
  if (!antes) return;
  mundoAte(b, s, antes.data); // o que acontece antes (e no mesmo dia, sem você) anda primeiro
  const ev = proximoEvento(b, s);
  const R = ev?.tipo === 'amistoso' ? iniciarAmistoso(b, s) : ev?.tipo === 'copa' ? iniciarCopa(b, s) : ev?.tipo === 'cont' ? iniciarCont(b, s, ev.k) : ev?.tipo === 'reg' ? iniciarReg(b, s, ev.k) : ev?.tipo === 'sup' ? iniciarSup(b, s) : ev?.tipo === 'liga2' ? iniciarLiga2(b, s, ev.d) : iniciarRodada(b, s, ev?.d);
  if (!R) return;
  if (!R.meu) { salvar(); ir('#/clube'); return render(); }
  app.vivo = AoVivo.novaPartidaAoVivo(R, app.s.vivo);
  if (app.vivo.min) aviso(`Jogo retomado no minuto ${app.vivo.min}. Toque em Seguir.`);
  ir('#/ao-vivo');
}

// ---------- navegação ----------
async function render() {
  const rota = location.hash.replace(/^#\/?/, '') || (app.conta ? 'saves' : 'entrar');
  if (rota !== 'coletiva') app.colPre = false;
  // saiu da tela do jogo (voltar do celular, por exemplo): pergunta antes; confirmando, o resto é simulado na hora
  const convite = rota.match(/^liga\/([A-Za-z0-9]{4,8})$/);
  if (convite) {
    const c = convite[1].toUpperCase();
    if (!app.conta) { app.convite = c; location.hash = '#/entrar'; return; }
    history.replaceState(null, '', '#/saves');
    $('#tela').innerHTML = '<p class="mudo">Entrando na liga…</p>';
    return Liga.entrar(c).catch(e => { aviso(e.message); render(); });
  }
  if (app.vivo?.R.replay && rota !== 'ao-vivo') app.vivo = null;
  if (app.vivo && rota !== 'ao-vivo') {
    if (!app.vivo.fim && !confirm('Sair agora encerra o jogo: o resto é simulado na hora. Sair mesmo?')) { history.replaceState(null, '', '#/ao-vivo'); return; }
    concluirAoVivo();
  }
  // saiu da sala de leilão no meio: conta como desistência (pergunta antes)
  if (app.aba === 'leilao' && rota !== 'leilao' && !Leilao.podeSair()) { history.replaceState(null, '', '#/leilao'); return; }
  if (rota === 'ao-vivo' && !app.vivo) { location.hash = app.s ? '#/clube' : '#/saves'; return; }
  if (rota === 'tabela') { location.hash = '#/torneios'; return; }
  if (rota === 'base' || rota === 'treino' || rota === 'dm') { app.abaElenco = rota; location.hash = '#/elenco'; return; }
  if (app.s?.demitido && ['elenco', 'mercado', 'financas', 'partida', 'calendario', 'coletiva'].includes(rota)) { location.hash = '#/clube'; return; } // sem clube: só propostas, tabelas e notícias
  const precisaJogo = ['clube', 'elenco', 'torneios', 'calendario', 'partida', 'noticias', 'mercado', 'financas', 'carreira', 'coletiva', 'mensagens', 'gala', 'leilao'].includes(rota);
  if (!app.conta && rota !== 'entrar') { location.hash = '#/entrar'; return; }
  if (precisaJogo && !app.s) { location.hash = app.liga ? '#/liga' : '#/saves'; return; }
  if (rota === 'liga' && !app.liga) { location.hash = '#/saves'; return; }
  // leilão por jogador que você quer: a sala abre sozinha, por cima do que estiver fazendo (menos no meio do jogo e da coletiva)
  if (precisaJogo && rota !== 'leilao' && rota !== 'coletiva' && app.s.leilaoAtivo && !app.s.leilaoAtivo.fim && !app.s.demitido) { location.hash = '#/leilao'; return; }
  if (rota === 'novo' && !app.novo) { location.hash = '#/saves'; return; }
  if (!telas[rota]) { location.hash = app.s ? '#/clube' : '#/saves'; return; }
  if (app.aba !== rota) { app.vaga = null; if ($('#ficha').open) $('#ficha').close(); }
  app.aba = rota;
  const main = $('#tela');
  try {
    if (rota !== 'entrar') await carregarBase();
    main.innerHTML = await telas[rota]();
  } catch (e) {
    main.innerHTML = `<section class="cartao"><h2>Ops</h2><p>${esc(e.message)}</p><button class="botao" type="button" data-acao="recarregar">Tentar de novo</button></section>`;
  }
  desenhaTopo();
  $('.aba-sub[aria-selected=true], .abas-mercado [aria-pressed=true]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); // aba escolhida sempre visível no celular
  if (rota === 'ao-vivo') AoVivo.comecar(app.vivo);
  if (rota === 'leilao') Leilao.aoMostrar();
  if (render.anterior !== rota) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  render.anterior = rota;
}

// ---------- ações ----------
const acoes = {
  recarregar: () => render(),
  sair: async () => { await api('POST', '/sair').catch(() => { }); sairDaConta(); },
  menu: async () => { await descarregar(); Liga.fechar(); app.s = null; app.salvando = ''; ir('#/saves'); },
  salvar: () => { if (app.liga) { if (app.salvando === 'falhou') { app.liga.sujo = true; descarregar(); } else ir('#/liga'); return; } if (app.salvando === 'conflito') resolverConflito().catch(e => aviso(e.message)); else if (app.salvando === 'falhou') { fila.sujo = true; descarregar(); } },
  ficha: el => abrirFicha(el.dataset.id),

  novo: el => { app.slot = +el.dataset.slot; app.novo = { passo: 1, tecnico: { nome: '', rosto: rostoAleatorio(), nat: 'BRA', reputacao: 1 }, dificuldade: 'normal', modo: 'escolher', abaDiv: 'A', clube: null }; ir('#/novo'); },
  parte: el => { const t = app.novo.tecnico, i = +el.dataset.i, n = +el.dataset.n; t.rosto = comDigito(t.rosto, i, (digito(t.rosto, i) + +el.dataset.d + n) % n); render(); },
  'sortear-rosto': () => { app.novo.tecnico.rosto = rostoAleatorio(); render(); },
  passo2: () => {
    const nome = app.novo.tecnico.nome.trim();
    if (nome.length < 2) { $('.erro').textContent = 'Dê um nome ao seu técnico.'; $('[data-campo=nome]').focus(); return; }
    app.novo.passo = 2; render();
  },
  passo1: () => { app.novo.passo = 1; render(); },
  'aba-div': el => { app.novo.abaDiv = el.dataset.div; render(); },
  comecar: async el => {
    const n = app.novo;
    if (n.modo === 'escolher' && n.clube == null) { $('.erro').textContent = 'Escolha um clube.'; return; }
    el.disabled = true;
    app.base.aplicarTransferencias({});
    app.s = novoJogo(app.base, { seed: crypto.getRandomValues(new Uint32Array(1))[0] % 1e9, tecnico: { ...n.tecnico, nome: n.tecnico.nome.trim() }, modo: n.modo, clube: n.clube, divisao: n.abaDiv, dificuldade: n.dificuldade });
    app.novo = null; app.ver = 0;
    ir('#/clube');
    if (n.modo !== 'escolher') aviso(`Você vai treinar o ${clube(app.s.tecnico.clube).n}!`);
    salvar();
  },

  continuar: async el => {
    el.disabled = true;
    const slot = +el.dataset.slot;
    try {
      await carregarBase();
      const { dados, atualizado } = await api('GET', `/saves/${slot}`);
      const local = guardado.ler(chaveLocal(slot));
      // cópia local que não subiu: se a nuvem ainda está na versão em que ela se baseou, é só continuar dela;
      // se a nuvem mudou (outro aparelho), pergunta. Cópia antiga (sem versão) cai na comparação de horário.
      let usarLocal = !!local && (local.base == null ? local.quando > atualizado : local.sujo);
      if (usarLocal && local.base != null && local.base !== atualizado)
        usarLocal = confirm('Este aparelho tem progresso que não subiu, mas outro aparelho salvou esta carreira depois.\n\nOK = continuar do progresso DESTE aparelho\nCancelar = continuar do que está na nuvem');
      app.s = migrar(await descompacta(usarLocal ? local.dados : dados));
      app.slot = slot; app.ver = atualizado; app.salvando = '';
      ir('#/clube');
      if (usarLocal) { aviso('Recuperei um progresso que não tinha subido.'); salvar(); }
    } catch (e) { el.disabled = false; aviso(e.message); }
  },
  apagar: async el => {
    if (el.dataset.confirma !== '1') { el.dataset.confirma = '1'; el.textContent = 'Apagar mesmo?'; return; }
    await api('DELETE', `/saves/${el.dataset.slot}`).catch(e => aviso(e.message));
    guardado.tirar(chaveLocal(el.dataset.slot));
    render();
  },

  // Jogar: primeiro a coletiva pré-jogo (amistoso não tem), depois o jogo ao vivo
  jogar: el => {
    el.disabled = true;
    if (prePendente(app.base, app.s)) { app.colPre = true; ir('#/coletiva'); return; }
    comecarJogo();
  },
  // Continuar: depois do jogo oficial vem a coletiva pós-jogo
  'vivo-fim': () => { if (app.vivo?.R.replay) { app.vivo = null; return ir('#/partida'); } concluirAoVivo(); const u = app.s.ultima; if (u && u.div !== 'AMI') { app.colPre = false; ir('#/coletiva'); } else ir('#/partida'); },
  'em-breve': el => aviso(`${el.dataset.t} chega numa próxima atualização.`),
  'avancar-data': async el => { el.disabled = true; el.textContent = 'Simulando…'; await umQuadro(); const x = pendentes(app.base, app.s)[0]; if (x) mundoAte(app.base, app.s, x.data); render(); salvar(); },
  'avancar-fim': async el => { el.disabled = true; el.textContent = 'Simulando o resto da temporada…'; await umQuadro(); for (let x; !proximoEvento(app.base, app.s) && (x = pendentes(app.base, app.s)[0]);) mundoAte(app.base, app.s, x.data); render(); salvar(); },
  'aba-fin': el => { app.abaFin = el.dataset.a; render(); },
  ingresso: el => { app.s.fin.ingresso = el.dataset.p; render(); salvar(); },
  'pedir-verba': () => { const s = app.s, c = clube(s.tecnico.clube), tab = tabela(app.base, s, c.div); const r = pedirVerba(app.base, s, tab.findIndex(l => l.clube === s.tecnico.clube) + 1); aviso(r.txt); render(); salvar(); },
  ...AoVivo.acoes,
  ...Mercado.acoes,
  ...Elenco.acoes,
  ...Jornal.acoes,
  ...Coletiva.acoes,
  ...Leilao.acoes,
  ...Gala.acoes,
  tema: () => {
    const novo = escuro() ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    try { localStorage.setItem('fig.tema', novo); } catch { }
    $('meta[name=theme-color]').content = novo === 'escuro' ? '#090B0F' : '#1B1F2A';
    render();
  },
  prelecao: el => { const m = fazerPrelecao(app.base, app.s, el.dataset.t); if (m) aviso(m); render(); salvar(); },
  conversar: el => { const r = conversar(app.base, app.s, el.dataset.id, el.dataset.t); aviso(r.txt); salvar(); abrirFicha(el.dataset.id); },
  aumento: el => { const m = responderAumento(app.base, app.s, el.dataset.id, el.dataset.sim === '1'); if (m) aviso(m); render(); salvar(); },
  'msg-aba': el => { app.abaMercado = el.dataset.a; if (el.dataset.setor) Mercado.filtroSetor(el.dataset.setor); ir(el.getAttribute('href')); },
  'msg-resp': el => { const m = responderJogador(app.base, app.s, el.dataset.m, el.dataset.r); if (m) aviso(m); render(); salvar(); },
  'aceitar-oferta': el => { const m = aceitarOferta(app.base, app.s, +el.dataset.c); if (m) return aviso(m); aviso(`Bem-vindo ao ${clube(app.s.tecnico.clube).n}!`); salvar(); location.hash === '#/clube' ? render() : ir('#/clube'); },
  'recusar-oferta': el => { recusarOferta(app.s, +el.dataset.c); render(); salvar(); },
  'pedir-demissao': el => { if (el.dataset.confirma !== '1') { el.dataset.confirma = '1'; el.textContent = 'Tem certeza? Toque de novo'; return; } pedirDemissao(app.base, app.s); salvar(); ir('#/clube'); },
  assistir: () => {
    const s = app.s, u = s.ultima, F = daFoto(s.ultimaVivo);
    app.vivo = AoVivo.novaPartidaAoVivo({ replay: true, pen: u.pen, titulo: u.copa || `Série ${u.div} · ${u.rodada + 1}ª rodada`, meu: { ...F, h: u.casa, a: u.fora, d: u.div, humano: u.casa === s.tecnico.clube ? 0 : 1 } });
    ir('#/ao-vivo');
  },
  virar: async el => { if (app.liga) return; el.disabled = true; el.textContent = 'Fechando a temporada…'; await umQuadro(); const h = virarTemporada(app.base, app.s); if (h) aviso(`Bem-vindo a ${app.s.ano}!`); render(); salvar(); },
  ...Torneios.acoes,
  ...Liga.acoes,
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-acao]');
  if (el && acoes[el.dataset.acao]) { e.preventDefault(); acoes[el.dataset.acao](el, e); }
});
// fecha a ficha ao tocar fora
$('#ficha').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#ficha').addEventListener('close', () => Mercado.aoFecharDialog());

// campos do novo jogo ficam guardados no rascunho
document.addEventListener('input', e => {
  if (e.target.dataset?.orc != null && app.s) {
    const o = orcamento(app.base, app.s); app.s.fin.salarioBudget = Math.round(o.folha + (o.maxSal - o.folha) * e.target.value / 100);
    const n = orcamento(app.base, app.s); $('.orc-legenda .sal').textContent = `Salários ${fmtDinheiro(n.salarios)}/dia`; $('.orc-legenda .comp').textContent = `Compras ${fmtDinheiro(n.compras)}`;
    $('.orc-sal').style.width = Math.max(8, Math.min(92, 100 - (n.compras / Math.max(1, n.compras + n.salarios * n.dias)) * 100)) + '%';
    clearTimeout(app.tSal); app.tSal = setTimeout(() => { render(); salvar(); }, 600); return;
  }
  if (Mercado.aoDigitar(e.target)) return;
  if (e.target.form?.dataset.form === 'entrar') e.target.form.querySelector('.erro').textContent = '';
  const k = e.target.dataset?.campo; if (!k || !app.novo) return;
  const v = e.target.value, n = app.novo;
  if (k === 'nome') n.tecnico.nome = v;
  else if (k === 'nat') n.tecnico.nat = v;
  else if (k === 'reputacao') n.tecnico.reputacao = +v;
  else if (k === 'dificuldade') n.dificuldade = v;
  else if (k === 'modo') { n.modo = v; render(); }
  else if (k === 'clube') n.clube = +v;
});

document.addEventListener('submit', async e => {
  if (['proposta', 'renovar'].includes(e.target.dataset.form)) { e.preventDefault(); Mercado.enviar(e.target); return; }
  if (e.target.dataset.form === 'lance') { e.preventDefault(); Leilao.darLance(e.target); return; }
  if (e.target.dataset.form?.startsWith('liga-')) { e.preventDefault(); Liga.enviarForm(e.target); return; }
  if (e.target.dataset.form !== 'entrar') return;
  e.preventDefault();
  const f = e.target, modo = e.submitter?.value || 'entrar', erro = f.querySelector('.erro');
  const apelido = f.apelido.value.trim(), pin = f.pin.value;
  app.ultimoApelido = apelido;
  if (apelido.length < 3) { erro.textContent = 'Apelido precisa de pelo menos 3 letras.'; return; }
  if (!/^\d{4,8}$/.test(pin)) { erro.textContent = 'O PIN tem de 4 a 8 números.'; return; }
  for (const b of f.querySelectorAll('button')) b.disabled = true;
  try {
    const r = await api('POST', modo === 'cadastro' ? '/cadastro' : '/entrar', { apelido, pin });
    app.conta = { token: r.token, apelido: r.apelido };
    guardado.gravar('fig.conta', app.conta);
    ir(app.convite ? `#/liga/${app.convite}` : '#/saves'); app.convite = null;
  } catch (err) {
    erro.textContent = err.message;
    for (const b of f.querySelectorAll('button')) b.disabled = false;
  }
});

AoVivo.configurar({ app, clube, esc, imgEscudo, $, guardar: guardarVivo });
Torneios.configurar({ app, clube, esc, imgEscudo, render: () => render() });
Coletiva.configurar({ app, clube, esc, render: () => render(), salvar: () => salvar(), jogar: () => comecarJogo() });
Gala.configurar({ app, clube, esc, imgEscudo, render: () => render() });
Liga.configurar({ app, api, compacta, descompacta, carregarBase, esc, clube, imgEscudo, aviso, ir, render: () => render(), desenhaTopo, rostoAleatorio,
  estrelas: ci => `<span class="estrelas" aria-label="Força ${forcaEstrelas(ci)} de 5">${estrelasTxt(forcaEstrelas(ci))}</span>` });
Leilao.configurar({ app, clube, esc, imgEscudo, aviso, render: () => render(), salvar: () => salvar() });
Jornal.configurar({ app, clube, esc, imgEscudo, render: () => render() });
Mercado.configurar({ app, clube, esc, imgEscudo, $, aviso, render: () => render(), salvar: () => salvar() });
Elenco.configurar({ app, clube, esc, imgEscudo, figurinha, render: () => render(), salvar: () => salvar(), aviso });
// mensagens: arrastar para a esquerda apaga
let arrasto = null;
document.addEventListener('pointerdown', e => {
  const m = e.target.closest?.('.caixa-msgs .msg');
  if (m && !e.target.closest('button, a, select')) arrasto = { m, x: e.clientX, y: e.clientY, dx: 0, lado: null };
});
document.addEventListener('pointermove', e => {
  if (!arrasto) return;
  const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
  if (!arrasto.lado && Math.hypot(dx, dy) > 8) arrasto.lado = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  if (arrasto.lado !== 'x') return;
  arrasto.dx = Math.min(0, dx);
  arrasto.m.style.transform = `translateX(${arrasto.dx}px)`; arrasto.m.style.opacity = String(Math.max(0.3, 1 + arrasto.dx / 300));
});
const soltar = () => {
  if (!arrasto) return;
  const { m, dx } = arrasto; arrasto = null;
  if (dx < -Math.min(120, m.offsetWidth * 0.35)) {
    m.style.transition = 'transform .2s, opacity .2s'; m.style.transform = 'translateX(-110%)'; m.style.opacity = '0';
    setTimeout(() => { app.s.msgs = (app.s.msgs || []).filter(x => x.id !== m.dataset.msg); salvar(); render(); }, 200);
  } else { m.style.transition = 'transform .15s'; m.style.transform = ''; m.style.opacity = ''; setTimeout(() => { m.style.transition = ''; }, 160); }
};
document.addEventListener('pointerup', soltar); document.addEventListener('pointercancel', soltar);
document.addEventListener('change', e => {
  if (e.target.matches?.('[data-reg-sel]')) { app.abaReg = e.target.value; return render(); }
  if (app.s && Elenco.aoMudar(e.target)) e.stopPropagation();
});
window.addEventListener('hashchange', render);
render();
// a vitrine entra sem redesenhar a tela, para não apagar o que a pessoa já digitou
if (!app.conta) carregarBase().then(() => { const topo = $('.entrada > div'); if (topo && !$('.vitrine')) topo.insertAdjacentHTML('afterend', vitrine()); }).catch(() => { });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
