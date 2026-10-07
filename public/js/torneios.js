// Aba Torneios: Brasileirão (tabela e artilharia), Copa do Brasil (chaveamento e prêmios), Continental e Regionais
// (em breve), Agenda com todos os seus jogos e Histórico das temporadas.
import { tabela, rodadasDe, dataRodada } from './motor/mundo.js';
import { FASES, PREMIOS, dataCopa, campanha, naCopa, mandoDe } from './motor/copa.js';
import { fmtDinheiro } from './motor/util.js';

let H; // { app, clube, esc, imgEscudo, render }
export const configurar = h => { H = h; };

const ABAS = [['brasileirao', 'Brasileirão'], ['copa', 'Copa do Brasil'], ['continental', 'Continental'], ['regionais', 'Regionais'], ['agenda', 'Agenda'], ['historico', 'Histórico']];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dataCurta = d => `${SEMANA[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const ZONAS = {
  A: [[1, 4, 'z-lib', 'Libertadores', 'var(--carimbo)'], [5, 6, 'z-pre', 'Pré-Libertadores', '#6E8FD0'], [7, 12, 'z-sul', 'Sul-Americana', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
  B: [[1, 4, 'z-sobe', 'Acesso', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
  C: [[1, 4, 'z-sobe', 'Acesso', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
};
const chips = (rot, itens, acao, ativo) => `<div class="chips" role="group" aria-label="${rot}">${itens.map(([k, t]) => `<button type="button" class="chip" data-acao="${acao}" data-v="${k}" aria-pressed="${ativo(k)}">${t}</button>`).join('')}</div>`;
const nomeC = ci => `${H.imgEscudo(ci, 20, 22)}<span>${H.esc(H.clube(ci).n)}</span>`;

function brasileirao() {
  const s = H.app.s, ci = s.tecnico.clube, d = H.app.divTabela || H.clube(ci).div, B = H.app.base;
  const zona = n => (ZONAS[d].find(([a, b]) => n >= a && n <= b) || [])[2] || '';
  const art = [...B.jog.values()].filter(j => H.clube(j.clube).div === d && s.est?.[j.id]?.[1]).sort((a, b) => s.est[b.id][1] - s.est[a.id][1] || s.est[a.id][0] - s.est[b.id][0]).slice(0, 10);
  return `${chips('Divisão', ['A', 'B', 'C'].map(x => [x, `Série ${x}`]), 'div-tabela', x => d === x)}
    <section class="cartao tabela-wrap"><table><caption class="vh">Série ${d}</caption>
      <thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>V</th><th class="so-largo">E</th><th class="so-largo">D</th><th class="so-largo">GP</th><th>SG</th><th class="so-largo">Últimos</th></tr></thead>
      <tbody>${tabela(B, s, d).map((l, i) => `<tr class="${zona(i + 1)} ${l.clube === ci ? 'meu' : ''}"><td class="pos">${i + 1}</td>
        <td class="clube-cel"><span>${nomeC(l.clube)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.v}</td>
        <td class="so-largo">${l.e}</td><td class="so-largo">${l.d}</td><td class="so-largo">${l.gp}</td><td>${l.sg}</td>
        <td class="so-largo"><span class="forma">${l.ultimos.map(r => `<i class="${r}" title="${{ V: 'Vitória', E: 'Empate', D: 'Derrota' }[r]}"></i>`).join('')}</span></td></tr>`).join('')}</tbody></table></section>
    <div class="legenda">${ZONAS[d].map(z => `<span style="--c:${z[4]}">${z[3]}</span>`).join('')}</div>
    <section class="cartao"><h3>Artilharia · Série ${d}</h3>${art.length ? `<table><thead><tr><th>#</th><th style="text-align:left">Jogador</th><th>G</th><th>J</th></tr></thead><tbody>${art.map((j, i) => `<tr class="${j.clube === ci ? 'meu' : ''}"><td class="pos">${i + 1}</td><td class="clube-cel"><span>${H.imgEscudo(j.clube, 18, 20)}${H.esc(j.curto)}</span></td><td class="p">${s.est[j.id][1]}</td><td>${s.est[j.id][0]}</td></tr>`).join('')}</tbody></table>` : '<p class="mudo">Ninguém marcou ainda.</p>'}</section>`;
}

const placarCopa = (j, ci) => `<li class="${j.h === ci || j.a === ci ? 'meu' : ''}"><span class="cl">${nomeC(j.h)}</span><b class="num">${j.gols ? `${j.gols[0]} × ${j.gols[1]}` : '×'}</b><span class="cl dir">${nomeC(j.a)}</span>${j.pen ? `<small>pênaltis ${j.pen[0]} a ${j.pen[1]}</small>` : j.data ? `<small>${dataCurta(j.data)}</small>` : ''}</li>`;
function copa() {
  const s = H.app.s, ci = s.tecnico.clube, c = s.copa, B = H.app.base;
  if (!c) return '<section class="cartao"><p class="mudo">A Copa começa na próxima temporada.</p></section>';
  const camp = campanha(s, ci), fases = [];
  for (let i = FASES.length - 1; i >= 0; i--) {
    const jogos = c.jogos.filter(j => j.fase === i);
    if (jogos.length) fases.push(`<section class="cartao"><h3>${FASES[i].nome}</h3><ol class="chave-copa">${jogos.map(j => placarCopa(j, ci)).join('')}</ol></section>`);
    else if (i === c.fase && c.chaves.length) fases.push(`<section class="cartao"><h3>${FASES[i].nome} · ${dataCurta(dataCopa(dataRodada, s.ano, i))}</h3><ol class="chave-copa">${c.chaves.map(ch => { const [h, a] = mandoDe(i, ch); return placarCopa({ h, a }, ci); }).join('')}</ol></section>`);
  }
  const art = Object.entries(c.art).map(([id, g]) => [B.jog.get(+id), g]).filter(([j]) => j).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `<section class="cartao copa-topo"><div class="titulo-linha"><h3>Copa do Brasil ${c.ano}</h3>${c.campeao != null ? `<span class="tag destaque">Campeão: ${H.esc(H.clube(c.campeao).n)}</span>` : ''}</div>
      <p><b>${camp ? `${H.esc(H.clube(ci).n)}: ${camp}` : `O ${H.esc(H.clube(ci).n)} não disputa esta edição.`}</b></p>
      <p class="mudo" style="font-size:.95rem">Os 20 da Série A e os 12 mais fortes da B. Jogo único até a semifinal (empate vai para os pênaltis) e final em ida e volta, sempre na quarta-feira livre entre rodadas.</p>
      <div class="chips">${[['1ª fase', PREMIOS['1f']], ['Oitavas', PREMIOS.oit], ['Quartas', PREMIOS.qua], ['Semi', PREMIOS.sem], ['Vice', PREMIOS.vice], ['Campeão', PREMIOS.campeao]].map(([t, v]) => `<span class="chip-info">${t} ${fmtDinheiro(v)}</span>`).join('')}</div></section>
    ${fases.join('')}
    ${art.length ? `<section class="cartao"><h3>Artilharia da Copa</h3><ol class="selecao">${art.map(([j, g]) => `<li><span class="clube-cel"><span>${H.imgEscudo(j.clube, 18, 20)}${H.esc(j.curto)}</span></span><span class="nota">${g}</span></li>`).join('')}</ol></section>` : ''}`;
}

// todos os seus compromissos da temporada, liga e copa, em ordem de data
export function agenda() {
  const s = H.app.s, ci = s.tecnico.clube, d = H.clube(ci).div, ev = [];
  rodadasDe(H.app.base, s, d).forEach((rd, i) => {
    const [h, a] = rd.find(j => j.includes(ci)), g = s.res?.[d]?.[`${h}-${a}`];
    ev.push({ data: dataRodada(s.ano, i), comp: `Série ${d} · ${i + 1}ª`, h, a, g, prox: i === s.rodada });
  });
  if (s.copa) {
    for (const j of s.copa.jogos.filter(x => x.h === ci || x.a === ci)) ev.push({ data: dataCopa(dataRodada, s.ano, j.fase), comp: `Copa · ${FASES[j.fase].curto}`, copa: true, h: j.h, a: j.a, g: j.gols, pen: j.pen });
    if (naCopa(s, ci)) for (let i = s.copa.fase; i < FASES.length; i++) {
      const ch = i === s.copa.fase ? s.copa.chaves.find(x => x.includes(ci)) : null, [h, a] = ch ? mandoDe(i, ch) : [ci, null];
      ev.push({ data: dataCopa(dataRodada, s.ano, i), comp: `Copa · ${FASES[i].curto}`, copa: true, h, a, futuro: !ch });
    }
  }
  ev.sort((x, y) => x.data - y.data);
  const prox = ev.find(e => !e.g && !e.futuro);
  return `<section class="cartao"><ol class="rodadas agenda">${ev.map(e => {
    const casa = e.h === ci, adv = casa ? e.a : e.h, meus = e.g && (casa ? e.g[0] : e.g[1]), deles = e.g && (casa ? e.g[1] : e.g[0]);
    const r = e.g ? (meus > deles ? 'V' : meus < deles ? 'D' : e.pen ? ((casa ? e.pen[0] > e.pen[1] : e.pen[1] > e.pen[0]) ? 'V' : 'D') : 'E') : '';
    return `<li class="${e === prox ? 'atual' : ''} ${e.copa ? 'copa' : ''}"><span class="rd">${dataCurta(e.data)}<br><small>${e.comp}</small></span>
      ${adv != null ? `${H.imgEscudo(adv, 22, 24)}<span>${H.esc(H.clube(adv).n)} <small class="mudo">${casa ? '(casa)' : '(fora)'}</small></span>` : '<span></span><span class="mudo">Se passar de fase</span>'}
      ${e.g ? `<span class="res ${r}">${meus}-${deles}${e.pen ? '*' : ''}</span>` : '<span class="mudo">–</span>'}</li>`; }).join('')}</ol>
    ${ev.some(e => e.pen) ? '<p class="mudo" style="font-size:.9rem">* decidido nos pênaltis</p>' : ''}</section>`;
}

function historico() {
  const s = H.app.s, l = s.historico || [], nome = ci => H.esc(H.clube(ci).n);
  if (!l.length) return '<section class="cartao"><p class="mudo">A primeira temporada ainda está em andamento. O resumo de cada ano aparece aqui quando ela termina.</p></section>';
  return l.map(h => `<section class="cartao historico"><div class="titulo-linha"><h3>Temporada ${h.ano}</h3><span class="tag ${h.bateuMeta ? 'resultado' : 'crise'}">${h.bateuMeta ? 'Meta cumprida' : 'Meta não cumprida'}</span></div>
    <p>${H.imgEscudo(h.clube, 20, 22)} <b>${nome(h.clube)}</b>: ${h.pos}º na Série ${h.div} com ${h.pts} pontos${h.copa?.meu ? ` · Copa do Brasil: ${h.copa.meu.toLowerCase()}` : ''}.</p>
    <ul class="campeoes">${['A', 'B', 'C'].map(d => `<li><span class="mudo">Série ${d}</span><span>${H.imgEscudo(h.campeoes[d], 16, 17)} <b>${nome(h.campeoes[d])}</b>${h.art[d] ? ` <small class="mudo">· artilheiro ${H.esc(h.art[d].nome)} (${h.art[d].gols})</small>` : ''}</span></li>`).join('')}
      ${h.copa?.campeao != null ? `<li><span class="mudo">Copa do Brasil</span><span>${H.imgEscudo(h.copa.campeao, 16, 17)} <b>${nome(h.copa.campeao)}</b></span></li>` : ''}</ul>
    <p class="mudo" style="font-size:.95rem">Subiram para a A: ${h.sobem.A.map(nome).join(', ')}. Caíram para a B: ${h.caem.B.map(nome).join(', ')}.</p></section>`).join('');
}

const emBreve = (t, txt) => `<section class="cartao em-breve-card"><h3>${t}</h3><p class="mudo">${txt}</p></section>`;
export function tela() {
  const s = H.app.s, aba = H.app.abaTorneios || 'brasileirao';
  const corpo = {
    brasileirao, copa, agenda, historico,
    continental: () => emBreve('Libertadores e Sul-Americana', 'As vagas já contam na tabela da Série A (G4, G6 e G12). Os jogos continentais chegam numa próxima atualização.'),
    regionais: () => emBreve('Estaduais', 'Paulistão, Carioca, Mineiro e companhia, no começo do ano, chegam numa próxima atualização.'),
  }[aba]();
  return `<div class="titulo-linha"><h2>Torneios</h2><span class="mudo">${s.ano} · rodada ${Math.min(s.rodada + 1, 38)}/38</span></div>
    <nav class="abas-mercado" aria-label="Competições">${ABAS.map(([k, t]) => `<button type="button" class="chip" data-acao="aba-torneios" data-v="${k}" aria-pressed="${aba === k}">${t}</button>`).join('')}</nav>
    ${corpo}`;
}

export const acoes = {
  'aba-torneios': el => { H.app.abaTorneios = el.dataset.v; H.render(); },
  'div-tabela': el => { H.app.divTabela = el.dataset.v; H.render(); },
};
