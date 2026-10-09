// Aba Notícias: capa do Jornal da Bola (destaque da rodada, furos do Zeca Furo, classificação),
// seleção da rodada e o noticiário com filtros.
import { tabela, dataRodada } from './motor/mundo.js';
import { SETOR, cartaDe } from './motor/util.js';
import { urlBoneco, urlRosto } from './pixel.js';
import { banca, cronica } from './motor/jornais.js';

let H; // { app, clube, esc, imgEscudo, render }
export const configurar = h => { H = h; };

const INSIDER = 'Zeca Furo';
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dataCurta = d => `${SEMANA[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const nota = n => n.toFixed(1).replace('.', ',');
const jog = id => H.app.base.jog.get(id);
const boneco = (j, w) => `<img class="px" src="${urlBoneco(j.rosto, H.clube(j.clube), j.pos === 'GOL')}" width="${w}" height="${Math.round(w * 17 / 12)}" alt="">`;
const bola = px => `<svg class="jb-bola" viewBox="0 0 8 8" width="${px}" height="${px}" shape-rendering="crispEdges" aria-hidden="true"><path d="M2 0h4v1h1v1h1v4H7v1H6v1H2V7H1V6H0V2h1V1h1z" fill="#1B1F2A"/><path d="M2 1h4v1h1v4H6v1H2V6H1V2h1z" fill="#FBF6EC"/><path d="M3 3h2v2H3zM1 2h1v1H1zM6 2h1v1H6zM3 6h2v1H3z" fill="#1B1F2A"/></svg>`;

const FILTROS = [['tudo', 'Tudo'], ['clube', 'Meu clube'], ['jogos', 'Jogos'], ['mercado', 'Mercado'], ['eventos', 'Eventos'], ['imprensa', 'Imprensa']];
const doInsider = n => ['rumor', 'mercado'].includes(n.tipo) || n.para != null;
const ehMercado = n => doInsider(n) || n.mercado;
const CATS = {
  clube: (n, ci) => ((n.tipo || 'clube') === 'clube' && (n.clube == null || n.clube === ci)) || [n.clube, n.de, n.para].includes(ci),
  jogos: n => ['resultado', 'destaque'].includes(n.tipo) || / \d+ × \d+/.test(n.texto),
  mercado: ehMercado,
  eventos: n => n.copa || n.evento || n.rodada === 0,
  imprensa: n => n.tipo === 'crise' || n.imprensa || n.texto.startsWith('Assédio'),
};
const autor = (n, ci) => doInsider(n) ? INSIDER : n.copa ? 'Copa do Brasil' : n.tipo === 'crise' || n.imprensa ? 'Plantão' : n.tipo === 'destaque' || n.tipo === 'resultado' ? `Série ${n.div}` : n.mercado ? 'Mercado' : n.evento ? 'Diretoria' : H.clube(ci).n;

// nome do jogador grifado no texto
const grifa = (txt, j) => { const t = H.esc(txt); if (!j) return t; const nm = H.esc(j.curto), i = t.indexOf(nm); return i < 0 ? t : `${t.slice(0, i)}<mark>${nm}</mark>${t.slice(i + nm.length)}`; };

function capa() {
  const s = H.app.s, ci = s.tecnico.clube, d = H.clube(ci).div;
  const m = s.manchete && s.manchete.rodada <= s.rodada ? s.manchete : null;
  let j, titulo, sub;
  if (m) { ({ titulo, sub } = m); j = jog(m.jogador); }
  else {
    j = H.app.base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr)[0];
    titulo = `${H.clube(ci).n} se prepara para o Brasileirão ${s.ano}`;
    sub = `${j.curto} é a esperança da torcida na Série ${d}.`;
  }
  const data = m || !s.ultimaData ? dataRodada(s.ano, Math.max(0, (m ? m.rodada : 1) - 1)) : new Date(s.ultimaData); // na pré-temporada, o dia do último jogo
  const furos = s.noticias.filter(n => doInsider(n) && n.rodada >= s.rodada - 2).slice(0, 2);
  const tab = tabela(H.app.base, s, d), minha = tab.findIndex(l => l.clube === ci);
  const linhas = tab.slice(0, 5).map((l, i) => [i, l]);
  if (minha >= 5) linhas.push([minha, tab[minha]]);
  return `<article class="capa" aria-label="Capa do Jornal da Bola">
    <header class="jb-topo">${bola(40)}<div><p class="jb-nome">Jornal da Bola</p><p class="jb-linha">Ano ${s.ano} · Nº ${s.rodada + 1} · O diário do futebol de botão</p></div></header>
    <p class="jb-faixa"><span>${m ? 'Destaque da rodada' : 'Pré-temporada'}</span><span>${dataCurta(data)}${m ? ` · ${m.rodada}ª rodada` : ''}</span></p>
    <div class="jb-foto">${boneco(j, 72)}<span class="jb-escudo">${H.imgEscudo(j.clube, 24, 26)}</span>${m?.nota ? `<span class="chip-nota ${cartaDe(m.nota * 10).k}">${nota(m.nota)}</span>` : ''}</div>
    <h2 class="jb-manchete">${H.esc(titulo)}</h2>
    <p class="jb-sub">${H.esc(sub)}</p>
    ${m && s.ultima ? `<p class="jb-cronica"><b>Crônica do jogo do ${H.esc(H.clube(ci).n)}.</b> ${H.esc(cronica(H.app.base, s) || '')}</p>` : ''}
    ${furos.length ? `<div class="jb-furos">${furos.map(n => `<p class="jb-furo"><span>${INSIDER}</span>${grifa(n.texto, n.jogador != null && jog(n.jogador))}</p>`).join('')}</div>` : ''}
    <div class="jb-class"><p>Classificação · Série ${d}</p><ol>${linhas.map(([i, l]) => `<li class="${l.clube === ci ? 'meu' : ''}"><span>${i + 1}</span>${H.esc(H.clube(l.clube).n)} <b>${l.p}</b></li>`).join('')}</ol></div>
  </article>`;
}

function selecao() {
  const s = H.app.s, d = H.clube(s.tecnico.clube).div, sel = s.destaques?.[d];
  if (!sel) return '<section class="cartao"><p class="mudo">A seleção sai depois da 1ª rodada.</p></section>';
  const linhas = ['ATA', 'MEI', 'DEF', 'GOL'].map(st => sel.time.filter(([id]) => SETOR[jog(id).pos] === st));
  return `<section class="cartao"><h3>Seleção da ${sel.rodada}ª rodada · Série ${d}</h3><div class="selr-campo">${linhas.map(l => `<div class="selr-linha">${l.map(([id, n]) => {
    const j = jog(id);
    return `<figure>${boneco(j, 24)}<figcaption><b>${H.esc(j.curto)}</b><span class="chip-nota ${cartaDe(n * 10).k}">${nota(n)}</span></figcaption></figure>`;
  }).join('')}</div>`).join('')}</div></section>`;
}

function convocacao() {
  const c = H.app.s.convocados, js = c.bra.map(jog).filter(Boolean);
  return `<section class="cartao"><h3>Seleção Brasileira · Data FIFA da ${c.rodada}ª rodada</h3>${['GOL', 'DEF', 'MEI', 'ATA'].map(st => `<p class="conv-setor"><b>${st}</b> ${js.filter(j => SETOR[j.pos] === st).map(j => `<span>${H.imgEscudo(j.clube, 14, 15)} ${H.esc(j.curto)}</span>`).join('')}</p>`).join('')}
    <p class="mudo" style="font-size:.9rem">Quem joga no Brasil desfalca o clube por 2 rodadas.</p></section>`;
}

function cartao(n, ci) {
  const j = n.jogador != null && jog(n.jogador);
  const av = j ? `<img class="px" src="${urlRosto(j.rosto, H.clube(j.clube))}" width="32" height="32" alt="">` : n.clube != null ? H.imgEscudo(n.clube, 24, 26) : (n.tipo || 'clube') === 'clube' ? H.imgEscudo(ci, 24, 26) : bola(24);
  return `<li class="nota-jb"><span class="nj-av">${av}</span><div><p class="nj-autor">${H.esc(autor(n, ci))}</p><p class="nj-txt">${grifa(n.texto, j)}</p><p class="nj-pe">${n.rodada ? `${n.rodada}ª rodada` : 'Pré-temporada'}</p></div></li>`;
}

export function tela() {
  const { app } = H, s = app.s, ci = s.tecnico.clube, f = app.filtroNoticias || 'tudo';
  const lista = s.noticias.filter(n => f === 'tudo' || CATS[f](n, ci)), qtos = app.qtasNoticias || 25;
  const B = s.ultima ? banca(app.base, s) : null;
  return `${capa()}
    ${B ? `<section class="banca" aria-label="Nas bancas"><h3>Nas bancas</h3>${B.map(b => `<article class="jornal-${b.k}"><p class="bj-nome">${b.nome}</p><p class="bj-tit">${H.esc(b.titulo)}</p><p class="bj-linha">${b.linha}</p></article>`).join('')}</section>` : ''}
    <div class="titulo-linha jb-titulo"><h2>Notícias</h2><span class="linha-botoes">${s.convocados?.bra?.length ? `<button type="button" class="botao sec peq" data-acao="ver-convocacao" aria-pressed="${!!app.verConv}">Convocação</button>` : ''}<button type="button" class="botao sec peq" data-acao="ver-selecao" aria-pressed="${!!app.verSelecao}">Seleção da rodada</button></span></div>
    ${app.verConv && s.convocados?.bra?.length ? convocacao() : ''}${app.verSelecao ? selecao() : ''}
    <div class="chips" role="group" aria-label="Filtrar notícias">${FILTROS.map(([k, t]) => `<button type="button" class="chip" data-acao="filtro-noticias" data-f="${k}" aria-pressed="${f === k}">${t}</button>`).join('')}</div>
    ${lista.length ? `<ul class="feed-jb">${lista.slice(0, qtos).map(n => cartao(n, ci)).join('')}</ul>` : '<section class="cartao"><p class="mudo">Nada por aqui ainda. As notícias saem a cada rodada.</p></section>'}
    ${lista.length > qtos ? '<button class="botao sec" data-acao="mais-noticias" type="button">Mais notícias</button>' : ''}`;
}

export const acoes = {
  'filtro-noticias': el => { H.app.filtroNoticias = el.dataset.f; H.app.qtasNoticias = 25; H.render(); },
  'mais-noticias': () => { H.app.qtasNoticias = (H.app.qtasNoticias || 25) + 25; H.render(); },
  'ver-selecao': () => { H.app.verSelecao = !H.app.verSelecao; H.render(); },
  'ver-convocacao': () => { H.app.verConv = !H.app.verConv; H.render(); },
};
