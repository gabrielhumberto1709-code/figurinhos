// Interface do Figurinhos: telas, navegação por hash e saves na nuvem.
import { Base, novoJogo, iniciarRodada, concluirRodada, tabela, rodadasDe, escalacao, escalar, trocarFormacao, paraSalvar, resumo, REPUTACOES, DIFICULDADES, dataRodada, janelaAberta, caixaInicial } from './motor/mundo.js';
import { precoPedido, vontade, pistaVontade, fazerProposta, aceitarContraproposta, desistir, aceitarRecebida, recusarRecebida, bloqueioProposta } from './motor/mercado.js';
import * as AoVivo from './aovivo.js';
import { FORMACOES, encaixe } from './motor/partida.js';
import { media } from './motor/noticias.js';
import { POS_NOME, SETOR, ATT, ATT_NOME, cartaDe, estrelas, fmtDinheiro, POS_ORDEM } from './motor/util.js';
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
  let r;
  try { r = await fetch('/api' + rota, { method: metodo, headers, body: corpo && JSON.stringify(corpo) }); }
  catch { throw new Error('Sem conexão com o servidor.'); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && app.conta && !rota.startsWith('/entrar')) { sairDaConta(); throw new Error(d.erro || 'Faça login de novo.'); }
  if (!r.ok) throw new Error(d.erro || 'Algo deu errado.');
  return d;
}

// save comprimido: gzip + base64
async function compacta(obj) {
  const buf = await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'gz:' + btoa(bin);
}
async function descompacta(txt) {
  if (!txt.startsWith('gz:')) return JSON.parse(txt);
  const bytes = Uint8Array.from(atob(txt.slice(3)), c => c.charCodeAt(0));
  return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}

// salva na nuvem; uma cópia local garante que nada se perde se a internet cair
async function salvar() {
  if (!app.s) return;
  const s = app.s, slot = app.slot;
  s.salvoEm = Date.now();
  const dados = await compacta(paraSalvar(s));
  const chaveLocal = `fig.backup.${app.conta.apelido}.${slot}`;
  guardado.gravar(chaveLocal, { quando: s.salvoEm, dados });
  app.salvando = 'salvando'; desenhaTopo();
  try {
    await api('PUT', `/saves/${slot}`, { nome: `${s.tecnico.nome} · ${app.base.clubes[s.tecnico.clube].n}`, resumo: resumo(app.base, s), dados });
    app.salvando = 'salvo';
  } catch { app.salvando = 'falhou'; }
  desenhaTopo();
}

async function carregarBase() {
  if (app.base) return app.base;
  const r = await fetch('/data/brasil.json');
  if (!r.ok) throw new Error('Não consegui baixar a base de jogadores.');
  return (app.base = new Base(await r.json()));
}

const ir = rota => { if (location.hash === rota) render(); else location.hash = rota; };
function sairDaConta() { app.conta = null; app.s = null; guardado.tirar('fig.conta'); ir('#/entrar'); }

function aviso(msg) {
  const el = $('#aviso'); el.textContent = msg; el.classList.add('on');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => el.classList.remove('on'), 2600);
}

// ---------- pedaços de interface ----------
const clube = ci => app.base.clubes[ci];
const imgEscudo = (ci, w, h) => `<img class="px" src="${urlEscudo(clube(ci))}" width="${w}" height="${h}" alt="">`;
const bandeira = nat => { const u = urlBandeira(nat); return u ? `<img class="px" src="${u}" width="20" height="14" alt="">` : ''; };

function figurinha(j, extra = '', estatica = false, rendeNaVaga = null) {
  const carta = cartaDe(j.ovr), tag = estatica ? 'div' : 'button', escolha = rendeNaVaga != null;
  return `<${tag} class="fig ${carta.k} ${extra}" ${estatica ? '' : `data-acao="${escolha ? 'escolher' : 'ficha'}" data-id="${j.id}" type="button"`} aria-label="${esc(j.nome)}, ${POS_NOME[j.pos]}, overall ${j.ovr}${escolha ? `, rende ${rendeNaVaga} na vaga` : ''}">${escolha ? `<span class="rende">${rendeNaVaga}</span>` : ''}
    <span class="foto"><img class="px" src="${urlRosto(j.rosto, clube(j.clube))}" width="32" height="32" alt="" loading="lazy"><span class="ovr">${j.ovr}</span><span class="pos">${j.pos}</span></span>
    <span class="nome">${esc(j.curto)}</span><span class="tier">${carta.nome}</span></${tag}>`;
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
  const estado = { salvando: 'Salvando…', salvo: 'Salvo', falhou: 'Não salvou · tentar' }[app.salvando] || '';
  topo.innerHTML = `<div class="topo-in">${imgEscudo(ci, 36, 39)}
    <div class="info"><div class="clube-nome">${esc(clube(ci).n)}</div><small>Série ${clube(ci).div} · Rodada ${Math.min(s.rodada + 1, 38)}${s.rodada ? ` · ${posicaoNaTabela(ci)}º` : ''}</small></div>
    <button class="estado ${app.salvando}" data-acao="salvar" type="button" ${app.salvando === 'falhou' ? '' : 'tabindex="-1"'} style="background:none;border:0;cursor:pointer">${estado}</button>
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
  const lista = await api('GET', '/saves');
  const porSlot = Object.fromEntries(lista.map(x => [x.slot, x]));
  const quando = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `<div class="titulo-linha"><h2>Carreiras</h2><div class="linha-botoes" style="flex:0 0 auto">${botaoTema()}<button class="botao peq sec" data-acao="sair" type="button">Trocar conta</button></div></div>
    <p class="mudo">Olá, ${esc(app.conta.apelido)}. Você tem 3 espaços de carreira.</p>
    ${[1, 2, 3].map(n => { const x = porSlot[n]; return x ? `<article class="cartao slot">
      <span class="num" style="font-size:2.6rem;text-align:center">${n}</span>
      <div><h3 style="color:var(--texto)">${esc(x.nome)}</h3><p>${esc(x.resumo)}</p><p class="mudo" style="font-size:.9rem">Salvo em ${quando(x.atualizado)}</p></div>
      <div class="linha-botoes"><button class="botao" data-acao="continuar" data-slot="${n}" data-quando="${x.atualizado}" type="button">Continuar</button>
      <button class="botao perigo" data-acao="apagar" data-slot="${n}" type="button" style="flex:0 0 auto">Apagar</button></div></article>`
      : `<article class="cartao slot-vazio"><p class="mudo">Espaço ${n} livre</p><button class="botao" data-acao="novo" data-slot="${n}" type="button">Novo jogo</button></article>`; }).join('')}`;
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
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'], SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const dataCurta = d => `${SEMANA[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const ATALHOS = [
  ['tatica', 'Tática', '#/elenco', 'var(--gramado)'], ['calendario', 'Agenda', '#/calendario', 'var(--carimbo)'], ['apito', 'Último jogo', '#/partida', 'var(--placar)'],
  ['moeda', 'Finanças', '#/financas', '#C9A227'], ['pessoa', 'Carreira', '#/carreira', 'var(--cartao)'],
  ['halter', 'Treino', null, '#E07B39'], ['broto', 'Base', null, 'var(--gramado)'], ['cruz', 'DM', null, 'var(--cartao)'], ['micro', 'Coletiva', null, 'var(--carimbo)'], ['camisa', 'Uniforme', null, '#2BA8A0'],
];

telas.clube = () => {
  const s = app.s, ci = s.tecnico.clube, c = clube(ci), d = c.div;
  const fim = s.rodada >= 38;
  const jogo = fim ? null : rodadasDe(app.base, s, d)[s.rodada].find(([h, a]) => h === ci || a === ci);
  const tab = tabela(app.base, s, d), pos = tab.findIndex(l => l.clube === ci);
  const viz = tab.slice(Math.max(0, Math.min(pos - 2, tab.length - 5)), Math.max(5, pos + 3)).map(l => ({ ...l, n: tab.indexOf(l) + 1 }));
  const dt = dataRodada(s.ano, Math.min(s.rodada, 37)), janela = janelaAberta(s.ano, s.rodada);
  const lado = ci2 => `<div class="lado">${imgEscudo(ci2, 64, 69)}<span>${esc(clube(ci2).n)}</span>${s.rodada ? `<small>${posicaoNaTabela(ci2)}º</small>` : ''}</div>`;
  return `<div class="status-clube"><span title="Dinheiro em caixa"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${ICONES.moeda}</svg>${fmtDinheiro(s.caixa ?? 0)}</span>
      <span>${s.rodada ? `${pos + 1}º na Série ${d}` : `Série ${d}`}</span><span class="${janela ? 'aberta' : ''}">${janela ? 'Janela aberta' : 'Janela fechada'}</span></div>
    ${fim ? `<section class="cartao escuro"><h2>Fim da temporada</h2><p>${esc(c.n)} terminou em <b>${pos + 1}º</b> na Série ${d}. Campeão: <b>${esc(clube(tab[0].clube).n)}</b>.</p>
      <p style="color:var(--barra-texto-2)">A virada de temporada, com acesso e rebaixamento, entra na próxima atualização.</p></section>`
    : `<section class="ingresso" style="--cc:${c.c[0]};--cc2:${c.c[1] || '#fff'}">
      <div class="ingresso-data"><span class="dia">${String(dt.getUTCDate()).padStart(2, '0')}</span><span class="mes">${MESES[dt.getUTCMonth()]}</span><span class="sem">${SEMANA[dt.getUTCDay()]}</span><span class="ano">${dt.getUTCFullYear()}</span></div>
      <div class="ingresso-corpo"><span class="ingresso-tag">${s.rodada + 1}ª rodada · Série ${d} · ${jogo[0] === ci ? 'em casa' : 'fora'}</span>
        <div class="ingresso-jogo">${lado(jogo[0])}<span class="x">×</span>${lado(jogo[1])}</div>
        <span class="ingresso-local">${esc(clube(jogo[0]).est[0])}</span>
        <button class="botao grande" data-acao="jogar" type="button">Jogar</button></div></section>`}
    <nav class="atalhos" aria-label="Atalhos do clube">${ATALHOS.map(([ic, t, href, cor]) => {
      const off = !href || (href === '#/partida' && !s.ultima);
      return href && !off ? `<a class="atalho" href="${href}" style="--ac:${cor}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[ic]}</svg><span>${t}</span></a>`
        : `<button class="atalho off" type="button" data-acao="em-breve" data-t="${t}" style="--ac:${cor}" aria-disabled="true"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[ic]}</svg><span>${t}</span>${href ? '' : '<small>em breve</small>'}</button>`;
    }).join('')}</nav>
    <div class="grade-clube">
      <section class="cartao"><div class="titulo-linha"><h3>Seu clube no noticiário</h3><a href="#/noticias">Jornal da Bola</a></div><ul class="noticias">${s.noticias.filter(x => (x.tipo || 'clube') === 'clube').slice(0, 6).map(x => `<li><span class="rd">R${x.rodada}</span><span>${esc(x.texto)}</span></li>`).join('')}</ul></section>
      <section class="cartao"><div class="titulo-linha"><h3>Série ${d}</h3><a href="#/torneios">Tabela completa</a></div>
      <table><thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>SG</th></tr></thead>
      <tbody>${viz.map(l => `<tr class="${l.clube === ci ? 'meu' : ''}"><td class="pos">${l.n}</td><td class="clube-cel"><span>${imgEscudo(l.clube, 20, 22)}${esc(clube(l.clube).n)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.sg}</td></tr>`).join('')}</tbody></table></section></div>`;
};

// ----- finanças -----
telas.financas = () => {
  const s = app.s, ci = s.tecnico.clube, h = s.historicoTransf || [];
  const compras = h.filter(x => x.para === ci).reduce((t, x) => t + x.valor, 0), vendas = h.filter(x => x.de === ci).reduce((t, x) => t + x.valor, 0);
  const elenco = app.base.elencos[ci].reduce((t, j) => t + j.valor * 1000, 0);
  return `<div class="titulo-linha"><h2>Finanças</h2><a href="#/clube">Voltar</a></div>
    <div class="kpis"><div class="cartao kpi"><small>Em caixa</small><b class="num">${fmtDinheiro(s.caixa ?? 0)}</b></div><div class="cartao kpi"><small>Valor do elenco</small><b class="num">${fmtDinheiro(elenco)}</b></div>
      <div class="cartao kpi"><small>Gasto em reforços</small><b class="num">${fmtDinheiro(compras)}</b></div><div class="cartao kpi"><small>Recebido em vendas</small><b class="num">${fmtDinheiro(vendas)}</b></div></div>
    <section class="cartao"><h3>Movimentações</h3>${h.length ? `<ul class="noticias">${h.map(x => `<li><span class="rd">R${x.rodada + 1}</span><span>${x.para === ci ? 'Compra' : 'Venda'}: <b>${esc(x.nome)}</b> (${esc(clube(x.para === ci ? x.de : x.para).n)}) · ${fmtDinheiro(x.valor)}</span></li>`).join('')}</ul>` : '<p class="mudo">Nenhuma compra ou venda ainda.</p>'}</section>
    <p class="mudo">Bilheteria, patrocínios e salários entram na fase de gestão do clube.</p>`;
};

// ----- carreira -----
telas.carreira = () => {
  const s = app.s, t = s.tecnico, ci = t.clube, d = clube(ci).div;
  const l = tabela(app.base, s, d).find(x => x.clube === ci);
  const aprov = l.j ? Math.round(l.p / (l.j * 3) * 100) : 0;
  return `<div class="titulo-linha"><h2>Carreira</h2><a href="#/clube">Voltar</a></div>
    <section class="cartao carreira"><div class="moldura-tec"><img class="px" src="${urlRosto(t.rosto, TERNO)}" width="32" height="32" alt=""></div>
      <div><h2 style="font-size:1.6rem">${esc(t.nome)}</h2><p class="mudo">${bandeira(t.nat)} ${esc((NACOES.find(n => n[0] === t.nat) || [, t.nat])[1])} · ${REPUTACOES[t.reputacao]?.nome || ''}</p>
      <dl class="ficha-dl"><dt>Clube</dt><dd>${imgEscudo(ci, 18, 20)} ${esc(clube(ci).n)}</dd><dt>Temporada</dt><dd>${s.ano}</dd><dt>Dificuldade</dt><dd>${DIFICULDADES[s.dificuldade]}</dd></dl></div></section>
    <div class="kpis"><div class="cartao kpi"><small>Jogos</small><b class="num">${l.j}</b></div><div class="cartao kpi"><small>V · E · D</small><b class="num">${l.v}·${l.e}·${l.d}</b></div>
      <div class="cartao kpi"><small>Gols pró · contra</small><b class="num">${l.gp}·${l.gc}</b></div><div class="cartao kpi"><small>Aproveitamento</small><b class="num">${aprov}%</b></div></div>
    <p class="mudo">Histórico de temporadas, propostas de outros clubes e demissão chegam com a fase "Vida de técnico".</p>`;
};

// ----- elenco -----
const COORD = {
  '4-3-3': [[50, 90], [14, 68], [37, 74], [63, 74], [86, 68], [26, 48], [50, 56], [74, 48], [18, 22], [50, 15], [82, 22]],
  '4-4-2': [[50, 90], [14, 68], [37, 74], [63, 74], [86, 68], [14, 44], [38, 52], [62, 52], [86, 44], [36, 18], [64, 20]],
  '4-2-3-1': [[50, 90], [14, 68], [37, 74], [63, 74], [86, 68], [36, 56], [64, 56], [16, 32], [50, 36], [84, 32], [50, 14]],
  '3-5-2': [[50, 90], [26, 74], [50, 76], [74, 74], [10, 46], [36, 56], [64, 56], [50, 36], [90, 46], [36, 17], [64, 19]],
  '5-3-2': [[50, 90], [9, 62], [29, 74], [50, 77], [71, 74], [91, 62], [26, 46], [50, 52], [74, 46], [36, 18], [64, 20]],
};
const SETORES = [['GOL', 'Goleiros'], ['DEF', 'Defensores'], ['MEI', 'Meio-campistas'], ['ATA', 'Atacantes']];

// rendimento do jogador numa vaga do esquema (fora de posição rende menos)
const rende = (j, slot) => Math.round(j.ovr * encaixe(j.pos, slot));

telas.elenco = () => {
  const s = app.s, ci = s.tecnico.clube, time = escalacao(app.base, s, ci), slots = FORMACOES[time.formacao];
  const titulares = new Set(time.xi.map(j => j.id)), vaga = app.vaga, slotSel = vaga != null ? slots[vaga] : null;
  const elenco = app.base.elencos[ci].slice().sort((a, b) => POS_ORDEM.indexOf(a.pos) - POS_ORDEM.indexOf(b.pos) || b.ovr - a.ovr);
  const forcaXI = Math.round(time.xi.reduce((t, j, i) => t + rende(j, slots[i]), 0) / 11);
  const opcoes = slotSel ? elenco.filter(j => j.id !== time.xi[vaga].id).sort((a, b) => rende(b, slotSel) - rende(a, slotSel)).slice(0, 8) : [];
  const card = j => figurinha(j, `${titulares.has(j.id) ? 'titular' : ''} ${slotSel ? 'escolha' : ''}`, false, slotSel ? rende(j, slotSel) : null);
  return `<div class="titulo-linha"><h2>Elenco</h2><span class="mudo">${elenco.length} jogadores · força do time <b class="num" style="font-size:1.3rem">${forcaXI}</b></span></div>
    <section class="cartao"><div class="titulo-linha"><h3>Esquema</h3>${s.xi ? '<button class="botao peq sec" data-acao="auto" type="button">Escalar os melhores</button>' : '<span class="mudo" style="font-size:.95rem">Escalação automática</span>'}</div>
      <div class="chips" role="group" aria-label="Formação">${Object.keys(FORMACOES).map(f => `<button type="button" class="chip" data-acao="formacao" data-f="${f}" aria-pressed="${s.formacao === f}">${f}</button>`).join('')}</div>
      <p class="dica" role="status">${slotSel ? `Quem entra no lugar de <b>${esc(time.xi[vaga].curto)}</b> (${slotSel})? Toque na figurinha. <button class="link" data-acao="vaga" data-i="${vaga}" type="button">Cancelar</button>` : 'Toque num jogador do campo para trocar.'}</p>
      <div class="campo"><span class="area cima"></span><span class="area baixo"></span><span class="meio"></span><span class="roda"></span>
        ${time.xi.map((j, i) => { const [x, y] = COORD[time.formacao][i], r = rende(j, slots[i]), fora = encaixe(j.pos, slots[i]) < 0.9;
          return `<button class="botao-campo ${vaga === i ? 'sel' : ''} ${fora ? 'fora' : ''}" style="left:${x}%;top:${y}%" data-acao="vaga" data-i="${i}" type="button" aria-label="${esc(j.curto)}, ${slots[i]}, rende ${r}${fora ? ', fora de posição' : ''}"><img class="px" src="${urlBotao(clube(ci))}" width="12" height="13" alt=""><span>${esc(j.curto)}</span><b>${slots[i]} ${r}</b></button>`; }).join('')}
      </div>
      ${slotSel ? `<h3>Melhores opções para ${slotSel}</h3><div class="album opcoes-vaga">${opcoes.map(card).join('')}</div>` : ''}</section>
    ${SETORES.map(([k, t]) => { const js = elenco.filter(j => SETOR[j.pos] === k); return `<h3 class="setor-titulo">${t} <span class="mudo">${js.length}</span></h3><div class="album">${js.map(card).join('')}</div>`; }).join('')}
    <p class="mudo" style="font-size:.95rem">O ponto verde marca quem está no time titular. No campo, o número é quanto o jogador rende naquela vaga; nome em amarelo é jogador fora de posição.</p>`;
};

function abrirFicha(id) {
  const j = app.base.jog.get(+id); if (!j) return;
  const meu = j.clube === app.s?.tecnico.clube, carta = cartaDe(j.ovr);
  const corAtt = v => v >= 80 ? 'var(--gramado)' : v >= 65 ? 'var(--carimbo)' : v >= 50 ? 'var(--placar)' : 'var(--cartao)';
  const d = $('#ficha');
  d.innerHTML = `<div class="ficha">
    <div class="ficha-topo">${figurinha(j, '', true)}
      <div><h2 style="font-size:1.4rem">${esc(j.nome)}</h2><p class="mudo">${POS_NOME[j.pos]} · ${esc(clube(j.clube).n)}</p>
      <dl style="margin-top:8px"><dt>Idade</dt><dd>${j.idade} anos</dd><dt>País</dt><dd>${bandeira(j.nat)}${esc(j.nat)}</dd><dt>Carta</dt><dd>${carta.nome}</dd>
      <dt>Potencial</dt><dd><span class="estrelas" aria-label="${meu ? estrelas(j.pot) + ' de 5' : 'desconhecido'}">${meu ? estrelasTxt(estrelas(j.pot)) : '? ? ?'}</span></dd></dl></div></div>
    <div class="atts">${ATT.map(k => `<div class="att" style="--c:${corAtt(j.att[k])}"><span>${ATT_NOME[k]}</span><span class="num">${j.att[k]}</span><div><b style="width:${j.att[k]}%"></b></div></div>`).join('')}</div>
    <dl><dt>Valor</dt><dd>${fmtDinheiro(j.valor * 1000)}</dd><dt>Contrato</dt><dd>até ${j.contrato}</dd></dl>
    ${app.s ? blocoMercado(j, meu) : ''}
    <form method="dialog"><button class="botao sec" style="width:100%">Fechar</button></form></div>`;
  if (!d.open) d.showModal();
}

function blocoMercado(j, meu) {
  const s = app.s;
  if (meu) {
    const ofertas = (s.recebidas || []).filter(x => x.jogador === j.id);
    return ofertas.length ? `<section class="ficha-mercado"><h3>Propostas por ele</h3>${ofertas.map(x => `<div class="oferta"><span>${imgEscudo(x.de, 18, 20)} ${esc(clube(x.de).n)} · <b>${fmtDinheiro(x.valor)}</b></span><span class="linha-botoes"><button class="botao peq" type="button" data-acao="aceitar-recebida" data-id="${x.id}">Vender</button><button class="botao peq sec" type="button" data-acao="recusar-recebida" data-id="${x.id}">Recusar</button></span></div>`).join('')}</section>` : '';
  }
  const pedido = precoPedido(app.base, s, j), ja = (s.propostas || []).find(p => p.jogador === j.id && ['aguardando', 'contraproposta'].includes(p.estado));
  const bloq = bloqueioProposta(app.base, s, j, pedido);
  return `<section class="ficha-mercado"><h3>Mercado</h3><dl><dt>Preço pedido</dt><dd>${fmtDinheiro(pedido)}</dd><dt>Seu caixa</dt><dd>${fmtDinheiro(s.caixa)}</dd></dl>
    <p class="mudo">${pistaVontade(vontade(app.base, s, j, s.tecnico.clube))}</p>
    ${ja ? `<p><b>${ja.estado === 'contraproposta' ? `Contraproposta: ${fmtDinheiro(ja.contra)}. Veja em Mercado › Propostas.` : `Proposta de ${fmtDinheiro(ja.valor)} enviada. Resposta na próxima rodada.`}</b></p>`
      : bloq && !/dinheiro/.test(bloq) ? `<p class="erro">${esc(bloq)}</p>`
      : `<form class="proposta" data-form="proposta" data-id="${j.id}"><label>Sua proposta (€ milhões) <input type="number" name="valor" inputmode="decimal" step="0.01" min="0.05" value="${(pedido / 1e6).toFixed(2)}"></label>
        <div class="chips">${[0.85, 1, 1.15].map(f => `<button type="button" class="chip" data-acao="sugerir" data-v="${(pedido * f / 1e6).toFixed(2)}">${fmtDinheiro(Math.round(pedido * f / 1e4) * 1e4)}</button>`).join('')}</div>
        <p class="erro" role="alert"></p><button class="botao" type="submit">Enviar proposta</button></form>`}</section>`;
}

// ----- mercado -----
const ROTULO = { aguardando: 'Aguardando resposta', contraproposta: 'Contraproposta', recusada: 'Recusada', perdida: 'Perdida para rival', concluida: 'Contratado', cancelada: 'Cancelada' };
function filtrarMercado() {
  const s = app.s, f = app.fMercado || (app.fMercado = { q: '', pos: '', div: '', ord: 'ovr' });
  const q = f.q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let l = [...app.base.jog.values()].filter(j => j.clube !== s.tecnico.clube && (!f.pos || j.pos === f.pos) && (!f.div || clube(j.clube).div === f.div)
    && (!q || (j.nome + ' ' + clube(j.clube).n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q)));
  l.sort(f.ord === 'barato' ? (a, b) => a.valor - b.valor || b.ovr - a.ovr : f.ord === 'jovem' ? (a, b) => a.idade - b.idade || b.ovr - a.ovr : (a, b) => b.ovr - a.ovr);
  return l.slice(0, 60);
}
const linhaMercado = j => `<li><button type="button" class="linha-mercado" data-acao="ficha" data-id="${j.id}"><img class="px" src="${urlRosto(j.rosto, clube(j.clube))}" width="32" height="32" alt="" loading="lazy">
  <span class="lm-nome"><b>${esc(j.curto)}</b><small>${imgEscudo(j.clube, 14, 15)} ${esc(clube(j.clube).n)} · ${j.idade} anos</small></span><span class="pos-mini">${j.pos}</span><span class="nota ${cartaDe(j.ovr).k}">${j.ovr}</span><span class="lm-valor">${fmtDinheiro(j.valor * 1000)}</span></button></li>`;

telas.mercado = () => {
  const s = app.s, aba = app.abaMercado || 'buscar', f = app.fMercado || (app.fMercado = { q: '', pos: '', div: '', ord: 'ovr' });
  const janela = janelaAberta(s.ano, s.rodada), abertas = s.propostas.filter(p => ['aguardando', 'contraproposta'].includes(p.estado)).length;
  const ABAS = [['buscar', 'Buscar'], ['propostas', `Propostas${abertas ? ` (${abertas})` : ''}`], ['recebidas', `Recebidas${s.recebidas?.length ? ` (${s.recebidas.length})` : ''}`], ['historico', 'Histórico']];
  let corpo = '';
  if (aba === 'buscar') corpo = `<section class="cartao filtros-mercado">
      <label class="vh" for="busca-mercado">Buscar jogador ou clube</label><input type="text" id="busca-mercado" data-filtro="q" placeholder="Nome do jogador ou clube" value="${esc(f.q)}" autocomplete="off">
      <div class="filtros-linha"><select data-filtro="pos" aria-label="Posição"><option value="">Todas as posições</option>${POS_ORDEM.map(p => `<option value="${p}" ${f.pos === p ? 'selected' : ''}>${POS_NOME[p]}</option>`).join('')}</select>
        <select data-filtro="div" aria-label="Série"><option value="">Todas as séries</option>${['A', 'B', 'C'].map(x => `<option value="${x}" ${f.div === x ? 'selected' : ''}>Série ${x}</option>`).join('')}</select>
        <select data-filtro="ord" aria-label="Ordenar"><option value="ovr" ${f.ord === 'ovr' ? 'selected' : ''}>Melhores</option><option value="barato" ${f.ord === 'barato' ? 'selected' : ''}>Mais baratos</option><option value="jovem" ${f.ord === 'jovem' ? 'selected' : ''}>Mais jovens</option></select></div></section>
    <ul class="lista-mercado" id="lista-mercado">${filtrarMercado().map(linhaMercado).join('')}</ul>`;
  else if (aba === 'propostas') corpo = s.propostas.length ? `<ul class="lista-propostas">${s.propostas.map(p => { const j = app.base.jog.get(p.jogador); return `<li class="cartao"><div class="titulo-linha"><b>${esc(j.curto)}</b><span class="tag ${p.estado === 'concluida' ? 'resultado' : ['recusada', 'perdida'].includes(p.estado) ? 'crise' : 'rumor'}">${ROTULO[p.estado]}</span></div>
      <p class="mudo">${imgEscudo(p.de, 16, 17)} ${esc(clube(p.de).n)} · sua oferta ${fmtDinheiro(p.valor)}${p.motivo ? ` · ${esc(p.motivo)}` : ''}</p>
      ${p.estado === 'contraproposta' ? `<div class="linha-botoes"><button class="botao peq" type="button" data-acao="aceitar-contra" data-id="${p.id}">Pagar ${fmtDinheiro(p.contra)}</button><button class="botao peq sec" type="button" data-acao="desistir" data-id="${p.id}">Desistir</button></div>`
        : p.estado === 'aguardando' ? `<div class="linha-botoes"><button class="botao peq sec" type="button" data-acao="desistir" data-id="${p.id}">Cancelar proposta</button></div>` : ''}</li>`; }).join('')}</ul>` : '<section class="cartao"><p class="mudo">Você ainda não fez propostas. Busque um jogador e toque nele.</p></section>';
  else if (aba === 'recebidas') corpo = s.recebidas?.length ? `<ul class="lista-propostas">${s.recebidas.map(x => { const j = app.base.jog.get(x.jogador); return `<li class="cartao"><div class="titulo-linha"><b>${esc(j.curto)}</b><span class="nota ${cartaDe(j.ovr).k}">${j.ovr}</span></div>
      <p class="mudo">${imgEscudo(x.de, 16, 17)} ${esc(clube(x.de).n)} oferece <b>${fmtDinheiro(x.valor)}</b> · vale ${fmtDinheiro(j.valor * 1000)}</p>
      <div class="linha-botoes"><button class="botao peq" type="button" data-acao="aceitar-recebida" data-id="${x.id}">Vender</button><button class="botao peq sec" type="button" data-acao="recusar-recebida" data-id="${x.id}">Recusar</button></div></li>`; }).join('')}</ul>` : '<section class="cartao"><p class="mudo">Nenhuma proposta pelos seus jogadores. Quem joga bem chama atenção dos clubes maiores.</p></section>';
  else corpo = s.historicoTransf?.length ? `<section class="cartao"><ul class="noticias">${s.historicoTransf.map(x => `<li><span class="rd">R${x.rodada + 1}</span><span><b>${esc(x.nome)}</b>: ${esc(clube(x.de).n)} → ${esc(clube(x.para).n)} · ${fmtDinheiro(x.valor)}</span></li>`).join('')}</ul></section>` : '<section class="cartao"><p class="mudo">Nenhuma transferência ainda.</p></section>';
  return `<div class="titulo-linha"><h2>Mercado</h2><span class="mudo">${fmtDinheiro(s.caixa)} em caixa</span></div>
    <p class="janela ${janela ? 'aberta' : ''}">${janela ? 'Janela aberta: propostas respondidas na próxima rodada.' : `Janela fechada. Você pode olhar e planejar; propostas voltam quando ela abrir.`}</p>
    <div class="chips" role="group" aria-label="Seções do mercado">${ABAS.map(([k, t]) => `<button type="button" class="chip" data-acao="aba-mercado" data-a="${k}" aria-pressed="${aba === k}">${t}</button>`).join('')}</div>
    ${corpo}`;
};



// ----- tabela -----
const ZONAS = {
  A: [[1, 4, 'z-lib', 'Libertadores', 'var(--carimbo)'], [5, 6, 'z-pre', 'Pré-Libertadores', '#6E8FD0'], [7, 12, 'z-sul', 'Sul-Americana', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
  B: [[1, 4, 'z-sobe', 'Acesso', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
  C: [[1, 4, 'z-sobe', 'Acesso', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
};
telas.torneios = () => {
  const s = app.s, ci = s.tecnico.clube, d = app.divTabela || clube(ci).div;
  const zona = n => (ZONAS[d].find(([a, b]) => n >= a && n <= b) || [])[2] || '';
  const art = [...app.base.jog.values()].filter(j => clube(j.clube).div === d && s.est?.[j.id]?.[1]).sort((a, b) => s.est[b.id][1] - s.est[a.id][1] || s.est[a.id][0] - s.est[b.id][0]).slice(0, 10);
  return `<div class="titulo-linha"><h2>Torneios</h2><span class="mudo">${s.rodada} de 38 rodadas</span></div>
    <div class="chips" role="group" aria-label="Divisão">${['A', 'B', 'C'].map(x => `<button type="button" class="chip" data-acao="div-tabela" data-div="${x}" aria-pressed="${d === x}">Série ${x}</button>`).join('')}</div>
    <section class="cartao tabela-wrap"><table><caption class="vh">Série ${d}</caption>
      <thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>V</th><th class="so-largo">E</th><th class="so-largo">D</th><th class="so-largo">GP</th><th>SG</th><th class="so-largo">Últimos</th></tr></thead>
      <tbody>${tabela(app.base, s, d).map((l, i) => `<tr class="${zona(i + 1)} ${l.clube === ci ? 'meu' : ''}"><td class="pos">${i + 1}</td>
        <td class="clube-cel"><span>${imgEscudo(l.clube, 20, 22)}${esc(clube(l.clube).n)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.v}</td>
        <td class="so-largo">${l.e}</td><td class="so-largo">${l.d}</td><td class="so-largo">${l.gp}</td><td>${l.sg}</td>
        <td class="so-largo"><span class="forma">${l.ultimos.map(r => `<i class="${r}" title="${{ V: 'Vitória', E: 'Empate', D: 'Derrota' }[r]}"></i>`).join('')}</span></td></tr>`).join('')}</tbody></table></section>
    <div class="legenda">${ZONAS[d].map(z => `<span style="--c:${z[4]}">${z[3]}</span>`).join('')}</div>
    <div class="grade-clube"><section class="cartao"><h3>Artilharia · Série ${d}</h3>${art.length ? `<table><thead><tr><th>#</th><th style="text-align:left">Jogador</th><th>G</th><th>J</th></tr></thead><tbody>${art.map((j, i) => `<tr class="${j.clube === ci ? 'meu' : ''}"><td class="pos">${i + 1}</td><td class="clube-cel"><span>${imgEscudo(j.clube, 18, 20)}${esc(j.curto)}</span></td><td class="p">${s.est[j.id][1]}</td><td>${s.est[j.id][0]}</td></tr>`).join('')}</tbody></table>` : '<p class="mudo">Ninguém marcou ainda.</p>'}</section>
      <section class="cartao em-breve-card"><h3>Copa do Brasil</h3><p class="mudo">Mata-mata com os 60 clubes, jogos no meio de semana. Chega no próximo marco.</p></section></div>`;
};

// ----- calendário -----
telas.calendario = () => {
  const s = app.s, ci = s.tecnico.clube, d = clube(ci).div, cal = rodadasDe(app.base, s, d);
  return `<div class="titulo-linha"><h2>Agenda</h2><a href="#/clube">Voltar</a></div>
    <section class="cartao"><ol class="rodadas">${cal.map((rd, i) => {
      const [h, a] = rd.find(([x, y]) => x === ci || y === ci), casa = h === ci, adv = casa ? a : h;
      const g = s.res?.[d]?.[`${h}-${a}`], meus = g && (casa ? g[0] : g[1]), deles = g && (casa ? g[1] : g[0]);
      const r = g ? (meus > deles ? 'V' : meus < deles ? 'D' : 'E') : '';
      return `<li class="${i === s.rodada ? 'atual' : ''}"><span class="rd">${i + 1}ª<br>${dataCurta(dataRodada(s.ano, i))}</span>${imgEscudo(adv, 22, 24)}<span>${esc(clube(adv).n)} <small class="mudo">${casa ? '(casa)' : '(fora)'}</small></span>
        ${g ? `<span class="res ${r}">${meus}-${deles}</span>` : '<span class="mudo">–</span>'}</li>`; }).join('')}</ol></section>`;
};

// ----- súmula -----
telas.partida = () => {
  const u = app.s.ultima;
  if (!u) return `<p>Nenhum jogo ainda.</p><a class="botao" href="#/clube">Voltar</a>`;
  const ci = app.s.tecnico.clube, J = id => app.base.jog.get(id), nome = id => esc(J(id)?.curto || '?');
  const st = u.stats, claro = h => { const n = parseInt(h.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255)) / 255 > 0.8; };
  const corDe = (c, evita) => [...c.c, '#1B1F2A'].find(x => !claro(x) && x !== evita);
  const corCasa = corDe(clube(u.casa)), corFora = corDe(clube(u.fora), corCasa);
  const linha = (rot, a, b, fmt = v => v) => { const t = (a + b) || 1; return `<div class="stat"><span class="v">${fmt(a)}</span><div class="barra">${rot}<div><b style="width:${a / t * 100}%;background:${corCasa}"></b><b style="width:${b / t * 100}%;background:${corFora}"></b></div></div><span class="v">${fmt(b)}</span></div>`; };
  const lances = u.eventos.filter(e => ['gol', 'amarelo', 'vermelho', 'sub'].includes(e.tipo));
  const txt = e => e.tipo === 'sub' ? `<span class="assist" style="display:inline">⇄ ${nome(e.jogador)} no lugar de ${nome(e.sai)}</span>` : e.tipo === 'gol' ? `<span class="gol"><i class="ic bola"></i>${nome(e.jogador)}${e.assist ? `<span class="assist">assist. ${nome(e.assist)}</span>` : ''}</span>` : `<i class="ic ${e.tipo}"></i>${nome(e.jogador)}${e.segundo ? ' (2º amarelo)' : ''}`;
  const classe = n => n >= 7.5 ? 'alta' : n < 5.5 ? 'baixa' : '';
  const notasTime = t => Object.entries(u.notas[t]).map(([id, n]) => [+id, n]).sort((a, b) => b[1] - a[1]);
  const resultado = u.gols[0] === u.gols[1] ? 'Empate' : (u.gols[0] > u.gols[1]) === (u.casa === ci) ? 'Vitória' : 'Derrota';
  return `<div class="titulo-linha"><h2>${resultado}</h2><span class="mudo">${u.rodada + 1}ª rodada</span></div>
    <section class="placar"><div class="lado">${imgEscudo(u.casa, 60, 65)}<span>${esc(clube(u.casa).n)}</span></div>
      <span class="gols" aria-label="${u.gols[0]} a ${u.gols[1]}">${u.gols[0]}-${u.gols[1]}</span>
      <div class="lado">${imgEscudo(u.fora, 60, 65)}<span>${esc(clube(u.fora).n)}</span></div>
      <small>${esc(clube(u.casa).est[0])} · Craque do jogo: ${nome(u.craque)}</small></section>
    ${lances.length ? `<section class="cartao"><h3>Lances</h3><ol class="lances">${lances.map(e => `<li><span class="c">${e.time === 0 ? txt(e) : ''}</span><span class="min">${e.min}'</span><span class="f">${e.time === 1 ? txt(e) : ''}</span></li>`).join('')}</ol></section>` : ''}
    <section class="cartao stats"><h3>Estatísticas</h3>
      ${linha('Posse', st[0].posse, st[1].posse, v => v + '%')}${linha('Finalizações', st[0].chutes, st[1].chutes)}${linha('No alvo', st[0].noAlvo, st[1].noAlvo)}
      ${linha('Gols esperados', st[0].xg, st[1].xg, v => v.toFixed(1).replace('.', ','))}${linha('Escanteios', st[0].escanteios, st[1].escanteios)}${linha('Faltas', st[0].faltas, st[1].faltas)}</section>
    <section class="cartao"><h3>Notas</h3><div class="notas">${[0, 1].map(t => `<div><p style="font-weight:700;margin-bottom:4px">${esc(clube(t ? u.fora : u.casa).n)}</p><ol>${notasTime(t).map(([id, n]) => `<li><span>${nome(id)}</span><span class="nota ${id === u.craque ? 'craque' : classe(n)}">${n.toFixed(1).replace('.', ',')}</span></li>`).join('')}</ol></div>`).join('')}</div></section>
    <div class="linha-botoes"><a class="botao sec" href="#/clube">Clube</a>${app.s.rodada < 38 ? '<button class="botao" data-acao="jogar" type="button">Próxima rodada</button>' : ''}</div>`;
};

// ----- jornal da bola -----
const TAGS = { clube: ['Seu clube', 'clube'], resultado: ['Rodada', 'resultado'], rumor: ['Rumor', 'rumor'], crise: ['Crise', 'crise'], destaque: ['Destaque', 'destaque'] };
telas.noticias = () => {
  const s = app.s, ci = s.tecnico.clube, d = clube(ci).div, f = app.filtroNoticias || 'tudo';
  const FILTROS = [['tudo', 'Tudo'], ['clube', 'Meu clube'], ['rumor', 'Rumores'], ['A', 'Série A'], ['B', 'Série B'], ['C', 'Série C']];
  const tipo = n => n.tipo || 'clube';
  const lista = s.noticias.filter(n => f === 'tudo' || (f === 'clube' ? tipo(n) === 'clube' : f === 'rumor' ? tipo(n) === 'rumor' || n.para != null : n.div === f));
  const porRodada = new Map(); for (const n of lista) { if (!porRodada.has(n.rodada)) porRodada.set(n.rodada, []); porRodada.get(n.rodada).push(n); }
  const art = [...app.base.jog.values()].filter(j => clube(j.clube).div === d && s.est?.[j.id]?.[1]).sort((a, b) => s.est[b.id][1] - s.est[a.id][1] || s.est[a.id][0] - s.est[b.id][0]).slice(0, 10);
  const sel = s.destaques?.[d];
  const nomeJ = id => { const j = app.base.jog.get(id); return `${imgEscudo(j.clube, 18, 20)}<span>${esc(j.curto)}</span>`; };
  return `<div class="titulo-linha"><h2 class="jornal">Jornal da Bola</h2><span class="mudo">${s.rodada ? `Após a ${s.rodada}ª rodada` : 'Pré-temporada'}</span></div>
    <div class="chips" role="group" aria-label="Filtrar notícias">${FILTROS.map(([k, t]) => `<button type="button" class="chip" data-acao="filtro-noticias" data-f="${k}" aria-pressed="${f === k}">${t}</button>`).join('')}</div>
    <div class="grade-clube"><div style="display:flex;flex-direction:column;gap:16px">
      ${porRodada.size ? [...porRodada].slice(0, app.rodadasNoticias || 3).map(([rd, ns]) => `<section class="cartao"><h3>${rd ? `${rd}ª rodada` : 'Pré-temporada'}</h3><ul class="manchetes">${ns.map(n => { const [rot, cls] = TAGS[tipo(n)] || TAGS.resultado; return `<li><span class="tag ${cls}">${rot}</span><span>${esc(n.texto)}</span></li>`; }).join('')}</ul></section>`).join('')
        : '<section class="cartao"><p class="mudo">Nada por aqui ainda. As notícias saem a cada rodada.</p></section>'}
      ${porRodada.size > (app.rodadasNoticias || 3) ? '<button class="botao sec" data-acao="mais-noticias" type="button">Rodadas anteriores</button>' : ''}
    </div><div style="display:flex;flex-direction:column;gap:16px">
      <section class="cartao"><h3>Artilharia · Série ${d}</h3>${art.length ? `<table><thead><tr><th>#</th><th style="text-align:left">Jogador</th><th>G</th><th>J</th></tr></thead><tbody>${art.map((j, i) => `<tr class="${j.clube === ci ? 'meu' : ''}"><td class="pos">${i + 1}</td><td class="clube-cel"><span>${nomeJ(j.id)}</span></td><td class="p">${s.est[j.id][1]}</td><td>${s.est[j.id][0]}</td></tr>`).join('')}</tbody></table>` : '<p class="mudo">Ninguém marcou ainda.</p>'}</section>
      ${sel ? `<section class="cartao"><h3>Seleção da ${sel.rodada}ª rodada</h3><ol class="selecao">${sel.time.slice().sort((x, y) => POS_ORDEM.indexOf(app.base.jog.get(x[0]).pos) - POS_ORDEM.indexOf(app.base.jog.get(y[0]).pos)).map(([id, n]) => `<li><span class="pos-mini">${app.base.jog.get(id).pos}</span><span class="clube-cel"><span>${nomeJ(id)}</span></span><span class="nota ${n >= 7.5 ? 'alta' : ''}">${n.toFixed(1).replace('.', ',')}</span></li>`).join('')}</ol></section>` : ''}
    </div></div>`;
};

// saves antigos ganham os campos novos; a base recebe as transferências deste save
function migrar(s) {
  app.base.aplicarTransferencias(s.transf || (s.transf = {}));
  s.propostas ||= []; s.recebidas ||= []; s.historicoTransf ||= []; s.est ||= {};
  if (s.caixa == null) s.caixa = caixaInicial(app.base, s.tecnico.clube, s.dificuldade);
  return s;
}

// ----- ao vivo -----
telas['ao-vivo'] = () => AoVivo.tela(app.vivo);
function concluirAoVivo() {
  const V = app.vivo; if (!V) return;
  if (!V.fim) AoVivo.pular(V);
  concluirRodada(app.base, app.s, V.R, AoVivo.resultadoFinal(V));
  app.vivo = null;
  salvar();
}

// ---------- navegação ----------
async function render() {
  const rota = location.hash.replace(/^#\/?/, '') || (app.conta ? 'saves' : 'entrar');
  if (app.vivo && rota !== 'ao-vivo') concluirAoVivo(); // saiu no meio do jogo: termina na hora
  if (rota === 'ao-vivo' && !app.vivo) { location.hash = app.s ? '#/clube' : '#/saves'; return; }
  if (rota === 'tabela') { location.hash = '#/torneios'; return; }
  const precisaJogo = ['clube', 'elenco', 'torneios', 'calendario', 'partida', 'noticias', 'mercado', 'financas', 'carreira'].includes(rota);
  if (!app.conta && rota !== 'entrar') { location.hash = '#/entrar'; return; }
  if (precisaJogo && !app.s) { location.hash = '#/saves'; return; }
  if (rota === 'novo' && !app.novo) { location.hash = '#/saves'; return; }
  if (!telas[rota]) { location.hash = app.s ? '#/clube' : '#/saves'; return; }
  if (app.aba !== rota) app.vaga = null;
  app.aba = rota;
  const main = $('#tela');
  try {
    if (rota !== 'entrar') await carregarBase();
    main.innerHTML = await telas[rota]();
  } catch (e) {
    main.innerHTML = `<section class="cartao"><h2>Ops</h2><p>${esc(e.message)}</p><button class="botao" type="button" data-acao="recarregar">Tentar de novo</button></section>`;
  }
  desenhaTopo();
  if (rota === 'ao-vivo') AoVivo.comecar(app.vivo);
  if (render.anterior !== rota) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  render.anterior = rota;
}

// ---------- ações ----------
const acoes = {
  recarregar: () => render(),
  sair: async () => { await api('POST', '/sair').catch(() => { }); sairDaConta(); },
  menu: () => { app.s = null; ir('#/saves'); },
  salvar: () => { if (app.salvando === 'falhou') salvar(); },
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
    app.s = novoJogo(app.base, { tecnico: { ...n.tecnico, nome: n.tecnico.nome.trim() }, modo: n.modo, clube: n.clube, divisao: n.abaDiv, dificuldade: n.dificuldade });
    app.novo = null;
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
      const local = guardado.ler(`fig.backup.${app.conta.apelido}.${slot}`);
      const usarLocal = local && local.quando > atualizado;
      app.s = migrar(await descompacta(usarLocal ? local.dados : dados));
      app.slot = slot;
      ir('#/clube');
      if (usarLocal) { aviso('Recuperei um progresso que não tinha subido.'); salvar(); }
    } catch (e) { el.disabled = false; aviso(e.message); }
  },
  apagar: async el => {
    if (el.dataset.confirma !== '1') { el.dataset.confirma = '1'; el.textContent = 'Apagar mesmo?'; return; }
    await api('DELETE', `/saves/${el.dataset.slot}`).catch(e => aviso(e.message));
    guardado.tirar(`fig.backup.${app.conta.apelido}.${el.dataset.slot}`);
    render();
  },

  jogar: el => {
    el.disabled = true;
    const R = iniciarRodada(app.base, app.s);
    if (!R) return;
    if (!R.meu) { concluirRodada(app.base, app.s, R, null); salvar(); return render(); }
    app.vivo = AoVivo.novaPartidaAoVivo(R);
    ir('#/ao-vivo');
  },
  'vivo-fim': () => { concluirAoVivo(); ir('#/partida'); },
  'em-breve': el => aviso(`${el.dataset.t} chega numa próxima atualização.`),
  'aba-mercado': el => { app.abaMercado = el.dataset.a; render(); },
  sugerir: el => { const i = el.closest('form').valor; i.value = el.dataset.v; },
  'aceitar-contra': el => { const e = aceitarContraproposta(app.s, el.dataset.id); aviso(e || 'Topou pagar. A resposta final sai na próxima rodada.'); render(); salvar(); },
  desistir: el => { desistir(app.s, el.dataset.id); render(); salvar(); },
  'aceitar-recebida': el => { const e = aceitarRecebida(app.base, app.s, el.dataset.id); aviso(e || 'Venda concluída.'); if ($('#ficha').open) $('#ficha').close(); render(); salvar(); },
  'recusar-recebida': el => { recusarRecebida(app.s, el.dataset.id); if ($('#ficha').open) $('#ficha').close(); render(); salvar(); },
  ...AoVivo.acoes,
  formacao: el => { trocarFormacao(app.base, app.s, el.dataset.f); app.vaga = null; render(); salvar(); },
  vaga: el => { const i = +el.dataset.i; app.vaga = app.vaga === i ? null : i; render(); },
  escolher: el => { escalar(app.base, app.s, app.vaga, +el.dataset.id); app.vaga = null; render(); salvar(); },
  auto: () => { app.s.xi = null; app.vaga = null; render(); salvar(); },
  'filtro-noticias': el => { app.filtroNoticias = el.dataset.f; app.rodadasNoticias = 3; render(); },
  'mais-noticias': () => { app.rodadasNoticias = (app.rodadasNoticias || 3) + 5; render(); },
  tema: () => {
    const novo = escuro() ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    try { localStorage.setItem('fig.tema', novo); } catch { }
    $('meta[name=theme-color]').content = novo === 'escuro' ? '#090B0F' : '#1B1F2A';
    render();
  },
  'div-tabela': el => { app.divTabela = el.dataset.div; render(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-acao]');
  if (el && acoes[el.dataset.acao]) { e.preventDefault(); acoes[el.dataset.acao](el, e); }
});
// fecha a ficha ao tocar fora
$('#ficha').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// campos do novo jogo ficam guardados no rascunho
document.addEventListener('input', e => {
  const fk = e.target.dataset?.filtro;
  if (fk && app.fMercado) { app.fMercado[fk] = e.target.value; const l = $('#lista-mercado'); if (l) l.innerHTML = filtrarMercado().map(linhaMercado).join(''); return; }
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
  if (e.target.dataset.form === 'proposta') {
    e.preventDefault();
    const f = e.target, j = app.base.jog.get(+f.dataset.id), valor = Math.round(parseFloat(String(f.valor.value).replace(',', '.')) * 1e6);
    const erro = fazerProposta(app.base, app.s, j, valor);
    if (erro) { f.querySelector('.erro').textContent = erro; return; }
    $('#ficha').close(); aviso('Proposta enviada. A resposta sai na próxima rodada.'); render(); salvar();
    return;
  }
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
    app.conta = { token: r.token, apelido: r.apelido, admin: r.admin };
    guardado.gravar('fig.conta', app.conta);
    ir('#/saves');
  } catch (err) {
    erro.textContent = err.message;
    for (const b of f.querySelectorAll('button')) b.disabled = false;
  }
});

AoVivo.configurar({ app, clube, esc, imgEscudo, $ });
window.addEventListener('hashchange', render);
render();
// a vitrine entra sem redesenhar a tela, para não apagar o que a pessoa já digitou
if (!app.conta) carregarBase().then(() => { const topo = $('.entrada > div'); if (topo && !$('.vitrine')) topo.insertAdjacentHTML('afterend', vitrine()); }).catch(() => { });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
