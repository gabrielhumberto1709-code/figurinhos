// Interface do Figurinhos: telas, navegação por hash e saves na nuvem.
import { Base, novoJogo, avancar, tabela, rodadasDe, escalacao, paraSalvar, resumo, REPUTACOES, DIFICULDADES } from './motor/mundo.js';
import { FORMACOES } from './motor/partida.js';
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

function figurinha(j, extra = '', estatica = false) {
  const carta = cartaDe(j.ovr), tag = estatica ? 'div' : 'button';
  return `<${tag} class="fig ${carta.k} ${extra}" ${estatica ? '' : `data-acao="ficha" data-id="${j.id}" type="button"`} aria-label="${esc(j.nome)}, ${POS_NOME[j.pos]}, overall ${j.ovr}">
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
};

function desenhaTopo() {
  const topo = $('#topo'), abas = $('#abas');
  const emJogo = !!app.s && !['entrar', 'saves', 'novo'].includes(app.aba);
  topo.hidden = abas.hidden = !emJogo;
  if (!emJogo) return;
  const s = app.s, ci = s.tecnico.clube;
  const estado = { salvando: 'Salvando…', salvo: 'Salvo', falhou: 'Não salvou · tentar' }[app.salvando] || '';
  topo.innerHTML = `<div class="topo-in">${imgEscudo(ci, 36, 39)}
    <div class="info"><div class="clube-nome">${esc(clube(ci).n)}</div><small>Série ${clube(ci).div} · Rodada ${Math.min(s.rodada + 1, 38)}${s.rodada ? ` · ${posicaoNaTabela(ci)}º` : ''}</small></div>
    <button class="estado ${app.salvando}" data-acao="salvar" type="button" ${app.salvando === 'falhou' ? '' : 'tabindex="-1"'} style="background:none;border:0;cursor:pointer">${estado}</button>
    <button class="botao peq" data-acao="menu" type="button">Sair</button></div>`;
  abas.innerHTML = `<ul>${[['clube', 'Clube'], ['elenco', 'Elenco'], ['tabela', 'Tabela'], ['calendario', 'Jogos']].map(([k, t]) =>
    `<li><a href="#/${k}" ${app.aba === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[k]}</svg>${t}</a></li>`).join('')}</ul>`;
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
  return `<section class="entrada">
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
  return `<div class="titulo-linha"><h2>Carreiras</h2><button class="botao peq sec" data-acao="sair" type="button">Trocar conta</button></div>
    <p class="mudo">Olá, ${esc(app.conta.apelido)}. Você tem 3 espaços de carreira.</p>
    ${[1, 2, 3].map(n => { const x = porSlot[n]; return x ? `<article class="cartao slot">
      <span class="num" style="font-size:2.6rem;text-align:center">${n}</span>
      <div><h3 style="color:var(--tinta)">${esc(x.nome)}</h3><p>${esc(x.resumo)}</p><p class="mudo" style="font-size:.9rem">Salvo em ${quando(x.atualizado)}</p></div>
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
telas.clube = () => {
  const s = app.s, ci = s.tecnico.clube, d = clube(ci).div;
  const fim = s.rodada >= 38;
  const jogo = fim ? null : rodadasDe(app.base, s, d)[s.rodada].find(([h, a]) => h === ci || a === ci);
  const tab = tabela(app.base, s, d), pos = tab.findIndex(l => l.clube === ci);
  const viz = tab.slice(Math.max(0, Math.min(pos - 2, tab.length - 5)), Math.max(5, pos + 3)).map(l => ({ ...l, n: tab.indexOf(l) + 1 }));
  const u = s.ultima;
  const lado = (c, rot) => `<div class="lado">${imgEscudo(c, 72, 78)}<span>${esc(clube(c).n)}</span><small class="mudo">${s.rodada ? posicaoNaTabela(c) + 'º · ' : ''}${rot}</small></div>`;
  return `<div class="grade-clube"><div style="display:flex;flex-direction:column;gap:16px">
    ${fim ? `<section class="cartao escuro"><h2>Fim da temporada</h2><p>${esc(clube(ci).n)} terminou em <b>${pos + 1}º</b> na Série ${d}. Campeão: <b>${esc(clube(tab[0].clube).n)}</b>.</p>
      <p style="color:#C9C3B6">A virada de temporada, com acesso e rebaixamento, entra na próxima atualização.</p></section>`
      : `<section class="cartao"><div class="titulo-linha"><h3>${s.rodada + 1}ª rodada · Série ${d}</h3><span class="mudo">${jogo[0] === ci ? 'Em casa' : 'Fora'}</span></div>
      <div class="proximo">${lado(jogo[0], 'mandante')}<span class="x">×</span>${lado(jogo[1], 'visitante')}</div>
      <p class="mudo" style="text-align:center">${esc(clube(jogo[0]).est[0])}</p>
      <button class="botao grande" data-acao="jogar" type="button">Continuar</button></section>`}
    ${u ? `<section class="cartao"><div class="titulo-linha"><h3>Último jogo</h3><a href="#/partida">Ver súmula</a></div>
      <p style="font-size:1.25rem;font-weight:700">${esc(clube(u.casa).n)} <span class="num" style="font-size:1.6rem">${u.gols[0]} × ${u.gols[1]}</span> ${esc(clube(u.fora).n)}</p></section>` : ''}
    <section class="cartao"><h3>Notícias</h3><ul class="noticias">${s.noticias.slice(0, 8).map(x => `<li><span class="rd">R${x.rodada}</span><span>${esc(x.texto)}</span></li>`).join('')}</ul></section>
    </div>
    <section class="cartao"><div class="titulo-linha"><h3>Série ${d}</h3><a href="#/tabela">Tabela completa</a></div>
      <table><thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>SG</th></tr></thead>
      <tbody>${viz.map(l => `<tr class="${l.clube === ci ? 'meu' : ''}"><td class="pos">${l.n}</td><td class="clube-cel"><span>${imgEscudo(l.clube, 20, 22)}${esc(clube(l.clube).n)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.sg}</td></tr>`).join('')}</tbody></table></section></div>`;
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

telas.elenco = () => {
  const s = app.s, ci = s.tecnico.clube, time = escalacao(app.base, s, ci);
  const titulares = new Set(time.xi.filter(Boolean).map(j => j.id));
  const elenco = app.base.elencos[ci].slice().sort((a, b) => POS_ORDEM.indexOf(a.pos) - POS_ORDEM.indexOf(b.pos) || b.ovr - a.ovr);
  const media = Math.round(time.xi.reduce((t, j) => t + (j ? j.ovr : 0), 0) / 11);
  return `<div class="titulo-linha"><h2>Elenco</h2><span class="mudo">${elenco.length} jogadores · time titular <b class="num" style="font-size:1.3rem">${media}</b></span></div>
    <section class="cartao"><div class="titulo-linha"><h3>Esquema</h3><span class="mudo" style="font-size:.95rem">Escalação automática pelos melhores</span></div>
      <div class="chips" role="group" aria-label="Formação">${Object.keys(FORMACOES).map(f => `<button type="button" class="chip" data-acao="formacao" data-f="${f}" aria-pressed="${s.formacao === f}">${f}</button>`).join('')}</div>
      <div class="campo"><span class="area cima"></span><span class="area baixo"></span><span class="meio"></span><span class="roda"></span>
        ${time.xi.map((j, i) => { const [x, y] = COORD[time.formacao][i]; return j ? `<button class="botao-campo" style="left:${x}%;top:${y}%" data-acao="ficha" data-id="${j.id}" type="button"><img class="px" src="${urlBotao(clube(ci))}" width="12" height="13" alt=""><span>${esc(j.curto)}</span></button>` : ''; }).join('')}
      </div></section>
    ${SETORES.map(([k, t]) => { const js = elenco.filter(j => SETOR[j.pos] === k); return `<h3 class="setor-titulo">${t} <span class="mudo">${js.length}</span></h3><div class="album">${js.map(j => figurinha(j, titulares.has(j.id) ? 'titular' : '')).join('')}</div>`; }).join('')}
    <p class="mudo" style="font-size:.95rem">O ponto verde marca quem está no time titular.</p>`;
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
    <form method="dialog"><button class="botao sec" style="width:100%">Fechar</button></form></div>`;
  d.showModal();
}

// ----- tabela -----
const ZONAS = {
  A: [[1, 4, 'z-lib', 'Libertadores', 'var(--carimbo)'], [5, 6, 'z-pre', 'Pré-Libertadores', '#6E8FD0'], [7, 12, 'z-sul', 'Sul-Americana', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
  B: [[1, 4, 'z-sobe', 'Acesso', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
  C: [[1, 4, 'z-sobe', 'Acesso', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
};
telas.tabela = () => {
  const s = app.s, ci = s.tecnico.clube, d = app.divTabela || clube(ci).div;
  const zona = n => (ZONAS[d].find(([a, b]) => n >= a && n <= b) || [])[2] || '';
  return `<div class="titulo-linha"><h2>Classificação</h2><span class="mudo">${s.rodada} de 38 rodadas</span></div>
    <div class="chips" role="group" aria-label="Divisão">${['A', 'B', 'C'].map(x => `<button type="button" class="chip" data-acao="div-tabela" data-div="${x}" aria-pressed="${d === x}">Série ${x}</button>`).join('')}</div>
    <section class="cartao tabela-wrap"><table><caption class="vh">Série ${d}</caption>
      <thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>V</th><th class="so-largo">E</th><th class="so-largo">D</th><th class="so-largo">GP</th><th>SG</th><th class="so-largo">Últimos</th></tr></thead>
      <tbody>${tabela(app.base, s, d).map((l, i) => `<tr class="${zona(i + 1)} ${l.clube === ci ? 'meu' : ''}"><td class="pos">${i + 1}</td>
        <td class="clube-cel"><span>${imgEscudo(l.clube, 20, 22)}${esc(clube(l.clube).n)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.v}</td>
        <td class="so-largo">${l.e}</td><td class="so-largo">${l.d}</td><td class="so-largo">${l.gp}</td><td>${l.sg}</td>
        <td class="so-largo"><span class="forma">${l.ultimos.map(r => `<i class="${r}" title="${{ V: 'Vitória', E: 'Empate', D: 'Derrota' }[r]}"></i>`).join('')}</span></td></tr>`).join('')}</tbody></table></section>
    <div class="legenda">${ZONAS[d].map(z => `<span style="--c:${z[4]}">${z[3]}</span>`).join('')}</div>`;
};

// ----- calendário -----
telas.calendario = () => {
  const s = app.s, ci = s.tecnico.clube, d = clube(ci).div, cal = rodadasDe(app.base, s, d);
  return `<div class="titulo-linha"><h2>Jogos</h2><span class="mudo">Série ${d}</span></div>
    <section class="cartao"><ol class="rodadas">${cal.map((rd, i) => {
      const [h, a] = rd.find(([x, y]) => x === ci || y === ci), casa = h === ci, adv = casa ? a : h;
      const g = s.res?.[d]?.[`${h}-${a}`], meus = g && (casa ? g[0] : g[1]), deles = g && (casa ? g[1] : g[0]);
      const r = g ? (meus > deles ? 'V' : meus < deles ? 'D' : 'E') : '';
      return `<li class="${i === s.rodada ? 'atual' : ''}"><span class="rd">${i + 1}ª</span>${imgEscudo(adv, 22, 24)}<span>${esc(clube(adv).n)} <small class="mudo">${casa ? '(casa)' : '(fora)'}</small></span>
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
  const lances = u.eventos.filter(e => ['gol', 'amarelo', 'vermelho'].includes(e.tipo));
  const txt = e => e.tipo === 'gol' ? `<span class="gol"><i class="ic bola"></i>${nome(e.jogador)}${e.assist ? `<span class="assist">assist. ${nome(e.assist)}</span>` : ''}</span>` : `<i class="ic ${e.tipo}"></i>${nome(e.jogador)}${e.segundo ? ' (2º amarelo)' : ''}`;
  const classe = n => n >= 7.5 ? 'alta' : n < 5.5 ? 'baixa' : '';
  const notasTime = t => u.xi[t].filter(Boolean).map(id => [id, u.notas[t][id]]).sort((a, b) => b[1] - a[1]);
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

// ---------- navegação ----------
async function render() {
  const rota = location.hash.replace(/^#\/?/, '') || (app.conta ? 'saves' : 'entrar');
  const precisaJogo = ['clube', 'elenco', 'tabela', 'calendario', 'partida'].includes(rota);
  if (!app.conta && rota !== 'entrar') { location.hash = '#/entrar'; return; }
  if (precisaJogo && !app.s) { location.hash = '#/saves'; return; }
  if (rota === 'novo' && !app.novo) { location.hash = '#/saves'; return; }
  if (!telas[rota]) { location.hash = app.s ? '#/clube' : '#/saves'; return; }
  app.aba = rota;
  const main = $('#tela');
  try {
    if (rota !== 'entrar') await carregarBase();
    main.innerHTML = await telas[rota]();
  } catch (e) {
    main.innerHTML = `<section class="cartao"><h2>Ops</h2><p>${esc(e.message)}</p><button class="botao" type="button" data-acao="recarregar">Tentar de novo</button></section>`;
  }
  desenhaTopo();
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
      app.s = await descompacta(usarLocal ? local.dados : dados);
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
    avancar(app.base, app.s);
    ir('#/partida');
    salvar();
  },
  formacao: el => { app.s.formacao = el.dataset.f; render(); salvar(); },
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

window.addEventListener('hashchange', render);
render();
// a vitrine entra sem redesenhar a tela, para não apagar o que a pessoa já digitou
if (!app.conta) carregarBase().then(() => { const topo = $('.entrada > div'); if (topo && !$('.vitrine')) topo.insertAdjacentHTML('afterend', vitrine()); }).catch(() => { });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
