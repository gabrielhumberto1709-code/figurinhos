// Tela da premiação de gala: três finalistas por prêmio e o vencedor revelado com um toque; seleção da temporada
// de cada série; arquivo com as galas dos anos anteriores.
import { gala, PREMIOS } from './motor/gala.js';
import { fimDeTemporada } from './motor/temporada.js';
import { urlRosto, urlBoneco } from './pixel.js';

let H; // { app, clube, esc, imgEscudo, render }
const TROFEU = '<path d="M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8" fill="none" stroke="currentColor" stroke-width="2.2"/>';
export const configurar = h => { H = h; };

function lista() {
  const s = H.app.s, g = fimDeTemporada(s) ? [gala(H.app.base, s)] : [];
  return [...g, ...(s.galas || [])];
}
const rosto = (id, c, w = 32) => { const j = H.app.base.jog.get(id); return j ? `<img class="px" src="${urlRosto(j.rosto, H.clube(c))}" width="${w}" height="${w}" alt="">` : H.imgEscudo(c, w - 6, w - 4); };

function premio([k, nome, desc], fin, chave, aberto) {
  if (!fin.length) return '';
  const ordem = aberto ? fin : fin.slice().sort((a, b) => a.n.localeCompare(b.n)); // fechado: em ordem alfabética, sem entregar o vencedor
  return `<section class="cartao premio ${aberto ? 'aberto' : ''}"><div class="titulo-linha"><h3>${nome}</h3><small class="mudo">${desc}</small></div>
    <ol class="finalistas">${ordem.map((f, i) => `<li class="${aberto && i === 0 ? 'vence' : ''}">${k === 'prancheta' ? H.imgEscudo(f.c, 26, 28) : rosto(f.id, f.c)}
      <span><b>${H.esc(f.n)}</b><small>${H.esc(H.clube(f.c).n)} · ${H.esc(f.v)}</small></span>${aberto && i === 0 ? `<svg class="trofeu" viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="Vencedor">${TROFEU}</svg>` : ''}</li>`).join('')}</ol>
    ${aberto ? '' : `<button class="botao peq" type="button" data-acao="gala-revelar" data-k="${chave}">Revelar o vencedor</button>`}</section>`;
}

function selecao(sel) {
  if (!sel.length) return '';
  const linhas = ['ATA', 'MEI', 'DEF', 'GOL'].map(st => sel.filter(x => x.st === st));
  return `<section class="cartao"><h3>Seleção da temporada</h3><div class="selr-campo">${linhas.map(l => `<div class="selr-linha">${l.map(x => {
    const j = H.app.base.jog.get(x.id);
    return `<figure>${j ? `<img class="px" src="${urlBoneco(j.rosto, H.clube(x.c), x.st === 'GOL')}" width="24" height="34" alt="">` : ''}<figcaption><b>${H.esc(x.n)}</b><span class="chip-nota">${x.nota.toFixed(1).replace('.', ',')}</span></figcaption></figure>`;
  }).join('')}</div>`).join('')}</div></section>`;
}

export function tela() {
  const s = H.app.s, L = lista(), topo = '<div class="titulo-linha"><h2>Premiação de gala</h2><a href="#/clube">Voltar</a></div>';
  if (!L.length) return `${topo}<section class="cartao"><p class="mudo">A gala acontece no fim do Brasileirão. Os finalistas aparecem aqui quando a temporada acabar.</p></section>`;
  const G = L.find(g => g.ano === H.app.galaAno) || L[0], d = H.app.galaDiv || H.clube(s.tecnico.clube).div, x = G.divs[d];
  const nova = G === L[0], rev = (H.app.galaRev ||= new Set());
  s.galaVista = Math.max(s.galaVista || 0, L[0].ano);
  return `${topo}
    ${L.length > 1 ? `<div class="chips" role="group" aria-label="Temporada">${L.map(g => `<button type="button" class="chip" data-acao="gala-ano" data-v="${g.ano}" aria-pressed="${g === G}">${g.ano}</button>`).join('')}</div>` : ''}
    <div class="chips" role="group" aria-label="Série">${['A', 'B', 'C'].map(k => `<button type="button" class="chip" data-acao="gala-div" data-v="${k}" aria-pressed="${k === d}">Série ${k}</button>`).join('')}
      ${nova && PREMIOS.some(([k]) => !rev.has(`${G.ano}${d}${k}`)) ? `<button type="button" class="chip" data-acao="gala-tudo">Revelar todos</button>` : ''}</div>
    ${PREMIOS.map(p => premio(p, x.premios[p[0]] || [], `${G.ano}${d}${p[0]}`, !nova || rev.has(`${G.ano}${d}${p[0]}`))).join('')}
    ${selecao(x.selecao)}`;
}

const re = fn => el => { fn(el); H.render(); };
export const acoes = {
  'gala-ano': re(el => { H.app.galaAno = +el.dataset.v; }),
  'gala-div': re(el => { H.app.galaDiv = el.dataset.v; }),
  'gala-revelar': re(el => { (H.app.galaRev ||= new Set()).add(el.dataset.k); }),
  'gala-tudo': re(() => { const G = lista()[0], d = H.app.galaDiv || H.clube(H.app.s.tecnico.clube).div; for (const [k] of PREMIOS) (H.app.galaRev ||= new Set()).add(`${G.ano}${d}${k}`); }),
};
