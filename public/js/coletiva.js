// Tela da coletiva: antes do jogo (abre ao tocar em Jogar) e depois do jogo (abre ao tocar em Continuar).
// Uma pergunta por vez; cada resposta mostra quem ela agrada e quem incomoda.
import { abrirColetiva, abrirColetivaPre, responder, efeito, TONS, PLATEIA, perfil, chaveDe } from './motor/imprensa.js';
import { urlRosto, urlEscudo } from './pixel.js';
import { rng, shuffle } from './motor/util.js';

let H; // { app, clube, esc, render, salvar, jogar }
export const configurar = h => { H = h; };
export const pendente = s => !!s.ultima && s.ultima.div !== 'AMI' && (s.coletiva?.chave !== chaveDe(s) || !s.coletiva.feita);

// a sala de imprensa em pixel: você de camisa polo do clube atrás da mesa, microfone na frente e o painel de
// patrocinadores atrás (o patrocinador master do clube no jogo e marcas inventadas)
const MARCAS = [['Laticínios Serra Azul', '#1E4FA0'], ['Tintas Arco-Íris', '#D7261E'], ['Unimais Saúde', '#0A8F3C'], ['Café Tropeiro', '#6B3E1E'], ['Gás Chama Boa', '#E8760C'],
  ['Moto Veloz', '#222222'], ['Feijão Dona Nena', '#2E7D32'], ['Bet da Torcida', '#6A1B9A'], ['Água Cristalina', '#0288D1'], ['Pneus Rodão', '#37474F'], ['Óticas Visão', '#C2185B'], ['Construtora Pilar', '#5D4037']];
const claro = hex => { const n = parseInt(String(hex).slice(1, 7), 16); return ((n >> 16) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) / 255 > 0.72; };
function cena(s, clube) {
  const ci = s.tecnico.clube, c = clube(ci), r = rng(`sala${ci}`), outras = shuffle(r, MARCAS).slice(0, 4);
  const cor = !claro(c.c[0]) ? c.c[0] : c.c[1] && !claro(c.c[1]) ? c.c[1] : '#1B1F2A', master = [s.fin?.patrocinador || 'Patrocinador', cor];
  const logo = ([n, cor], i) => i === 'escudo' ? `<span class="cena-logo"><img class="px" src="${urlEscudo(c)}" alt=""></span>` : `<span class="cena-logo" style="color:${cor}"><i style="background:${cor}"></i>${n}</span>`;
  const ordem = [master, outras[0], 'escudo', outras[1], outras[2], master, outras[3], 'escudo', 'escudo', outras[0], master, outras[1], outras[3], outras[2], 'escudo', master];
  const polo = { n: `${c.n} polo`, c: [c.c[0], c.c[1] || '#FFFFFF'], pat: 'solid' };
  return `<div class="cena-col" aria-hidden="true">
    <div class="cena-painel">${ordem.map(x => logo(x, x === 'escudo' ? 'escudo' : 0)).join('')}</div>
    <img class="px cena-tec" src="${urlRosto(s.tecnico.rosto, polo)}" alt="">
    <div class="cena-mesa" style="--cm:${cor}"><span class="cena-tablet">${master[0]}</span></div>
    <svg class="cena-mic" viewBox="0 0 12 30" shape-rendering="crispEdges"><rect x="3" y="0" width="6" height="7" fill="#262626"/><rect x="4" y="1" width="1" height="5" fill="#5a5a5a"/><rect x="1" y="7" width="10" height="6" fill="${c.c[0]}"/><rect x="1" y="11" width="10" height="2" fill="${c.c[1] || '#fff'}"/><rect x="5" y="13" width="2" height="15" fill="#1a1a1a"/><rect x="2" y="28" width="8" height="2" fill="#1a1a1a"/></svg>
  </div>`;
}

const setas = e => Object.entries(e).map(([p, v]) => `<span class="${v > 0 ? 'sobe' : 'desce'}">${PLATEIA[p]} ${v > 0 ? '▲' : '▼'}${Math.abs(v) >= 2 && v < 0 || v >= 4 ? (v > 0 ? '▲' : '▼') : ''}</span>`).join('') || '<span>Sem efeito</span>';

export function tela() {
  const { app, esc, clube } = H, s = app.s, pre = !!app.colPre, C = pre ? abrirColetivaPre(app.base, s) : s.ultima?.div === 'AMI' ? null : abrirColetiva(app.base, s);
  const topo = `<div class="titulo-linha"><h2>Coletiva ${pre ? 'pré-jogo' : 'pós-jogo'}</h2><a href="#/clube">Voltar</a></div>`;
  if (!C) return `${topo}<section class="cartao"><p class="mudo">${pre ? 'Sem jogo marcado.' : 'A coletiva pós-jogo sai depois de cada jogo oficial.'}</p></section>`;
  const u = s.ultima, i = C.perguntas.findIndex((_, k) => C.respostas[k] == null), P = C.perguntas[i], pf = perfil(s);
  const feitas = C.perguntas.map((q, k) => C.respostas[k] == null ? '' : `<li><p class="col-q"><b>${esc(q.reporter[0])}</b> · ${esc(q.reporter[1])}: ${esc(q.texto)}</p><p class="col-r">${esc(q.respostas.find(r => r.tom === C.respostas[k])?.texto || '')} <small>(${TONS[C.respostas[k]].rot})</small></p></li>`).join('');
  const cab = pre ? `<p class="mudo">Antes do jogo · ${esc(C.titulo)}</p><h3>${esc(clube(C.h).n)} × ${esc(clube(C.a).n)}</h3>`
    : `<p class="mudo">Depois do jogo · ${esc(u.copa || `${u.rodada + 1}ª rodada`)}</p><h3>${esc(clube(u.casa).n)} ${u.gols[0]} × ${u.gols[1]} ${esc(clube(u.fora).n)}</h3>`;
  const fim = pre ? `<div class="linha-botoes"><button class="botao grande" type="button" data-acao="col-jogar">Entrar em campo</button></div>`
    : `<div class="linha-botoes"><a class="botao" href="#/partida">Ver a súmula</a><a class="botao sec" href="#/clube">Voltar ao clube</a></div>`;
  return `${topo}${cena(s, clube)}<section class="cartao col-topo">${cab}
      ${C.quente ? '<p class="tag crise">Coletiva quente: tudo vale em dobro</p>' : ''}</section>
    ${feitas ? `<section class="cartao"><ol class="col-log">${feitas}</ol></section>` : ''}
    ${P ? `<section class="cartao col-pergunta"><p class="mudo">Pergunta ${i + 1} de ${C.perguntas.length} · ${esc(P.reporter[0])}, ${esc(P.reporter[1])}</p><h3 class="col-txt">“${esc(P.texto)}”</h3>
      <div class="col-respostas">${P.respostas.map(r => `<button type="button" class="col-resp" data-acao="responder" data-i="${i}" data-tom="${r.tom}"><span class="col-tom">${TONS[r.tom].rot}</span><span class="col-frase">${esc(r.texto)}</span><span class="col-ef">${setas(efeito(s, r.tom, C))}</span></button>`).join('')}</div>
      <p class="mudo" style="font-size:.92rem">Grupo mexe na moral do elenco, torcida no humor da arquibancada, diretoria na confiança no seu trabalho. Falar três vezes seguidas para a mesma plateia rende metade.</p>
      <div class="linha-botoes"><button class="botao sec peq" type="button" data-acao="col-pular">${pre ? 'Pular a entrevista e jogar' : 'Pular a entrevista'}</button></div></section>`
    : `<section class="cartao"><h3>Coletiva encerrada</h3><p>As respostas já estão no Jornal da Bola.</p><p><b>Seu perfil:</b> ${esc(pf.nome)}. <span class="mudo">${esc(pf.desc)}</span></p>${fim}</section>`}`;
}

export const acoes = {
  responder: el => { if (responder(H.app.base, H.app.s, +el.dataset.i, el.dataset.tom, !!H.app.colPre)) { H.render(); H.salvar(); } },
  'col-jogar': () => { H.app.colPre = false; H.jogar(); },
  'col-pular': () => {
    const s = H.app.s;
    if (H.app.colPre) { if (s.coletivaPre) s.coletivaPre.pulada = true; H.app.colPre = false; H.jogar(); }
    else { if (s.coletiva) s.coletiva.feita = true; H.salvar(); location.hash = '#/clube'; }
  },
};
