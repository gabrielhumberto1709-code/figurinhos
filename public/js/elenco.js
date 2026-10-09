// Aba Elenco: Jogadores, Escalação (campo, capitão, estilo, planos, banco), Números, DM, Base e Treino.
import { FORMACOES, posicoesDe, PERS, ESTILOS, encaixe, forcaSetores, fatorCond } from './motor/partida.js';
import { escalacao, escalar, trocarFormacao, definirCapitao, liderNatural, TATICA_PADRAO, compProxima, editarVaga, moverVaga, POS_VAGA, limiteEstrangeiros, estrangeiro } from './motor/mundo.js';
import { LESOES, CATEGORIA, COMP_NOME, COMP_DE, fragilidade, indisponivel, pendurado, infilInfo, infiltrar } from './motor/dm.js';
import { POS_NOME, POS_ORDEM, SETOR, cartaDe, fmtDinheiro, estrelas } from './motor/util.js';
import { ganho, idadeF, alternarFoco, MAX_FOCO } from './motor/treino.js';
import { faseDe } from './motor/forma.js';
import { media } from './motor/noticias.js';
import { urlBoneco, urlBandeira } from './pixel.js';

let H; // { app, clube, esc, imgEscudo, figurinha, render, salvar, aviso }
export const configurar = h => { H = h; };

const ABAS = [['jogadores', 'Jogadores'], ['escalacao', 'Escalação'], ['numeros', 'Números'], ['dm', 'DM'], ['base', 'Base'], ['treino', 'Treino']];
const ICONE_ESTILO = {
  equilibrado: '<path d="M12 3v18M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z" fill="none" stroke="currentColor" stroke-width="2"/>',
  gegenpress: '<path d="M13 2 5 14h6l-1 8 8-12h-6z" fill="none" stroke="currentColor" stroke-width="2"/>',
  tikitaka: '<circle cx="12" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 7l-5 9M13 7l5 9M8 18h8" stroke="currentColor" stroke-width="2"/>',
  contra: '<path d="M4 20 20 4M20 4h-7M20 4v7M4 20h7M4 20v-7" fill="none" stroke="currentColor" stroke-width="2"/>',
  direto: '<path d="M3 17c4-10 10-12 18-10M21 7l-4-3M21 7l-3 4" fill="none" stroke="currentColor" stroke-width="2"/>',
  pressao: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-5 1-9z" fill="none" stroke="currentColor" stroke-width="2"/>',
  pontas: '<path d="M3 4v16M21 4v16M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3" fill="none" stroke="currentColor" stroke-width="2"/>',
  retranca: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" fill="none" stroke="currentColor" stroke-width="2"/>',
};

// carinha da moral (0-100)
export function carinha(m = 62) {
  const [cor, boca] = m >= 80 ? ['#4CC24A', 'M8 14q4 4 8 0'] : m >= 62 ? ['#A6D84A', 'M8 14.5q4 2.5 8 0'] : m >= 45 ? ['#F2C94A', 'M8 15h8'] : m >= 30 ? ['#F2994A', 'M8 16q4-2.5 8 0'] : ['#E5484D', 'M8 17q4-4 8 0'];
  return `<svg class="carinha" viewBox="0 0 24 24" width="18" height="18" role="img" aria-label="Moral ${Math.round(m)}"><circle cx="12" cy="12" r="10" fill="${cor}" stroke="#1B1F2A" stroke-width="1.5"/><circle cx="9" cy="10" r="1.3" fill="#1B1F2A"/><circle cx="15" cy="10" r="1.3" fill="#1B1F2A"/><path d="${boca}" fill="none" stroke="#1B1F2A" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}
const chip = (txt, v) => `<span class="chip-nota ${cartaDe(v).k}">${txt}</span>`;
const barraCond = c => `<span class="cond" title="Condição ${Math.round(c)}"><b style="width:${c}%;background:${c >= 80 ? 'var(--gramado)' : c >= 60 ? 'var(--placar)' : 'var(--cartao)'}"></b></span>`;
const boneco = (j, gk) => `<img class="px boneco" src="${urlBoneco(j.rosto, H.clube(j.clube), gk)}" width="12" height="17" alt="">`;
const bandeira = nat => { const u = urlBandeira(nat); return u ? `<img class="px band" src="${u}" width="16" height="11" alt="${nat}">` : ''; };
// selo de desfalque: lesão (jogos fora) ou suspensão
export const seloFase = (s, id) => { const f = faseDe(s, id); return f.seta ? `<span class="selo-fase ${f.k}" title="${f.nome}">${f.seta}</span>` : ''; };
export function seloDM(s, id) {
  const l = s.dm?.[id], sp = s.susp?.[id];
  return (l ? `<span class="selo-dm les" title="${LESOES[l.k]?.n || 'Lesão'}">✚ ${l.inf ? 'infiltrado' : `${l.n}j`}</span>` : '')
    + (sp ? `<span class="selo-dm sus" title="Suspenso">${Object.entries(sp).map(([c, n]) => `${c === 'L' ? '' : `${COMP_NOME[c]} `}susp. ${n}`).join(' · ')}</span>` : '');
}

export function tela() {
  const { app } = H, s = app.s;
  Object.assign(s, { ...TATICA_PADRAO(), ...s });
  const aba = app.abaElenco || 'escalacao';
  const corpo = { jogadores: telaJogadores, escalacao: telaEscalacao, numeros: telaNumeros, dm: telaDM, base: telaBase, treino: telaTreino }[aba]();
  return `<div class="abas-sub" role="tablist">${ABAS.map(([k, t]) => `<button type="button" role="tab" class="aba-sub" data-acao="aba-elenco" data-a="${k}" aria-selected="${aba === k}">${t}</button>`).join('')}</div>${corpo}`;
}

// ---------- jogadores ----------
function telaJogadores() {
  const { app, clube, esc } = H, s = app.s, ci = s.tecnico.clube, ord = app.ordJog || 'pos';
  const titulares = new Set(escalacao(app.base, s, ci).xi.map(j => j.id));
  const lista = app.base.elencos[ci].slice().sort({
    pos: (a, b) => POS_ORDEM.indexOf(a.pos) - POS_ORDEM.indexOf(b.pos) || b.ovr - a.ovr,
    ovr: (a, b) => b.ovr - a.ovr, cond: (a, b) => (s.cond[a.id] ?? 100) - (s.cond[b.id] ?? 100), idade: (a, b) => a.idade - b.idade, contrato: (a, b) => a.contrato - b.contrato || b.ovr - a.ovr,
  }[ord]);
  return `<div class="titulo-linha"><h2>Jogadores</h2><span class="mudo">${lista.length} no elenco · ${titulares.size} titulares</span></div>
    <div class="chips" role="group" aria-label="Ordenar">${[['pos', 'Posição'], ['ovr', 'Overall'], ['cond', 'Mais cansados'], ['idade', 'Mais novos'], ['contrato', 'Contrato']].map(([k, t]) => `<button type="button" class="chip" data-acao="ord-jog" data-o="${k}" aria-pressed="${ord === k}">${t}</button>`).join('')}</div>
    <ul class="lista-jog">${lista.map(j => { const c = s.cond[j.id] ?? 100; return `<li><button type="button" class="linha-elenco ${titulares.has(j.id) ? 'tit' : ''}" data-acao="ficha" data-id="${j.id}">
      <span class="pos-mini">${j.pos}</span>${boneco(j, j.pos === 'GOL')}<span class="le-nome"><b>${esc(j.curto)} ${seloFase(s, j.id)}${seloDM(s, j.id)}${j.contrato <= s.ano ? `<span class="selo-fim" title="1 ano ou menos de contrato (até ${j.contrato})">FIM ${j.contrato}</span>` : ''}</b><small>${bandeira(j.nat)} ${j.idade} anos · até ${j.contrato} · ${fmtDinheiro(j.valor * 1000)}</small></span>
      ${carinha(s.mor[j.id])}${barraCond(c)}${chip(j.ovr, j.ovr)}</button></li>`; }).join('')}</ul>
    <p class="mudo" style="font-size:.95rem">Verde na borda: titular. A barrinha é a condição física; ela volta com descanso entre os jogos.</p>`;
}

// ---------- escalação ----------
function telaEscalacao() {
  const { app, clube, esc } = H, s = app.s, ci = s.tecnico.clube, time = escalacao(app.base, s, ci), pos = posicoesDe(time.formacao, time.pers), slots = pos.map(x => x[0]);
  const vaga = app.vaga, slotSel = vaga != null ? slots[vaga] : null, titulares = new Set(time.xi.map(j => j.id));
  const rende = (j, slot) => Math.round(j.ovr * encaixe(j.pos, slot) * fatorCond(s.cond[j.id]));
  const elenco = app.base.elencos[ci].slice().sort((a, b) => POS_ORDEM.indexOf(a.pos) - POS_ORDEM.indexOf(b.pos) || b.ovr - a.ovr);
  const opcoes = slotSel ? elenco.filter(j => j.id !== time.xi[vaga].id && !time.fora.has(j.id)).sort((a, b) => rende(b, slotSel) - rende(a, slotSel)).slice(0, 8) : [];
  const set = forcaSetores(time, s.cond, s.mor), cap = time.capitao, auto = liderNatural(app.base, s, time.xi);
  const desf = time.trocados.length ? `<a class="cartao aviso-contratos" href="#/dm"><b>Desfalques no próximo jogo</b><span>${time.trocados.map(([a, b, m]) => `${esc(a.curto)} (${m === 'estrangeiro' ? 'limite de estrangeiros' : { lesao: 'lesão', suspenso: 'suspenso', afastado: 'afastado', selecao: 'na seleção', medo: 'cláusula do medo' }[indisponivel(s, a.id, compProxima(app.base, s)) || 'medo']}) → entra ${esc(b.curto)}`).join(' · ')}. A sua escalação continua salva; ele volta quando estiver liberado.</span></a>` : '';
  const g = s.gatilhos || {};
  const linhaPlano = (k, rot) => { const p = g[k] || {}; return `<div class="plano"><span>${rot}</span>
    <select data-plano="${k}" data-campo-plano="estilo" aria-label="Estilo ${rot}"><option value="">Não mudar</option>${Object.entries(ESTILOS).map(([e, x]) => `<option value="${e}" ${p.estilo === e ? 'selected' : ''}>${x.nome}</option>`).join('')}</select>
    <select data-plano="${k}" data-campo-plano="formacao" aria-label="Formação ${rot}"><option value="">Mesma formação</option>${Object.keys(FORMACOES).map(f => `<option value="${f}" ${p.formacao === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>`; };
  const lim = limiteEstrangeiros(s.ano, compProxima(app.base, s)), nEst = [...time.xi, ...time.banco].filter(estrangeiro).length, nElenco = app.base.elencos[ci].filter(estrangeiro).length;
  const estr = !nElenco ? '' : lim < Infinity ? `<p class="mudo estr-linha">Estrangeiros relacionados: <b>${nEst} de ${lim}</b> (regra da CBF para Brasileirão e Copa do Brasil; ${nElenco} no elenco).</p>`
    : `<p class="mudo estr-linha">Estrangeiros: <b>${nElenco} no elenco</b>. No Brasileirão e na Copa do Brasil só ${limiteEstrangeiros(s.ano, 'L')} podem ser relacionados; no próximo jogo não há limite.</p>`;
  return `${desf}${estr}<section class="cartao"><div class="titulo-linha"><h3>Escalações salvas</h3><span class="mudo">${s.escSalvas.length}/3</span></div>
      <div class="salvas">${s.escSalvas.map((e, i) => `<div class="salva"><button type="button" class="salva-usar" data-acao="usar-salva" data-i="${i}"><b>${esc(e.nome)}</b><small>${e.formacao} · ${ESTILOS[e.estilo]?.nome || ''}</small></button><button type="button" class="salva-x" data-acao="apagar-salva" data-i="${i}" aria-label="Apagar ${esc(e.nome)}">×</button></div>`).join('')}
      ${s.escSalvas.length < 3 ? '<button type="button" class="salva nova" data-acao="salvar-escalacao">+ Salvar atual</button>' : ''}</div></section>
    <section class="cartao"><h3>Formação</h3>
      <div class="chips" role="group" aria-label="Formação">${[...Object.keys(FORMACOES), ...(s.formPers ? [PERS] : [])].map(f => `<button type="button" class="chip" data-acao="formacao" data-f="${f}" aria-pressed="${time.formacao === f}">${f}</button>`).join('')}</div>
      <div class="linha-botoes"><button type="button" class="chip" data-acao="editar-pos" aria-pressed="${!!app.editPos}">Editar posições</button></div>
      <p class="dica" role="status">${app.editPos ? (slotSel && vaga > 0 ? `Nova posição para a vaga de <b>${esc(time.xi[vaga].curto)}</b> (hoje ${slotSel}):` : 'Toque numa vaga do campo para mudar a posição dela (o goleiro não muda).') : slotSel ? `Quem entra no lugar de <b>${esc(time.xi[vaga].curto)}</b> (${slotSel})? Toque na figurinha. <button class="link" data-acao="vaga" data-i="${vaga}" type="button">Cancelar</button>` : 'Toque num jogador do campo para trocar.'}</p>
      ${app.editPos && slotSel && vaga > 0 ? `<div class="chips" role="group" aria-label="Posição da vaga">${POS_VAGA.map(p => `<button type="button" class="chip" data-acao="pos-vaga" data-p="${p}" aria-pressed="${slotSel === p}">${p}</button>`).join('')}</div>
        <div class="chips setas-vaga" role="group" aria-label="Mover a vaga no campo">${[['←', -6, 0, 'esquerda'], ['→', 6, 0, 'direita'], ['↑', 0, -6, 'para a frente'], ['↓', 0, 6, 'para trás']].map(([s2, dx, dy, rot]) => `<button type="button" class="chip" data-acao="mover-vaga" data-dx="${dx}" data-dy="${dy}" aria-label="Mover ${rot}">${s2}</button>`).join('')}</div>` : ''}
      <div class="campo campo-esc"><span class="area cima"></span><span class="area baixo"></span><span class="meio"></span><span class="roda"></span>
        ${time.xi.map((j, i) => { const [, x, y] = pos[i], r = rende(j, slots[i]), fora = encaixe(j.pos, slots[i]) < 0.9;
          return `<button class="jog-campo ${vaga === i ? 'sel' : ''}" style="left:${x}%;top:${y}%" data-acao="vaga" data-i="${i}" type="button" aria-label="${esc(j.curto)}, ${slots[i]}, rende ${r}">
            <span class="jc-fig">${boneco(j, slots[i] === 'GOL')}${carinha(s.mor[j.id])}${j.id === cap ? '<i class="braco">C</i>' : ''}</span>
            <span class="jc-nome ${fora ? 'fora' : ''}">${esc(j.curto)}${seloFase(s, j.id)}</span>${chip(`${slots[i]} · ${r}`, r)}${barraCond(s.cond[j.id] ?? 100)}</button>`; }).join('')}
      </div>
      ${slotSel && !app.editPos ? `<h3>Melhores opções para ${slotSel}</h3><div class="album opcoes-vaga">${opcoes.map(j => H.figurinha(j, titulares.has(j.id) ? 'titular escolha' : 'escolha', false, rende(j, slotSel))).join('')}</div>` : ''}
      <div class="setores">${[['Ataque', set.ataque], ['Meio', set.meio], ['Defesa', set.defesa], ['Goleiro', set.goleiro]].map(([t, v]) => `<div class="setor"><small>${t}</small><b class="num">${v}</b></div>`).join('')}</div>
      <div class="linha-botoes"><button class="botao sec" type="button" data-acao="melhor-time">${s.xi ? 'Escalar melhor time (poupa cansados)' : 'Automática: entram os melhores descansados'}</button></div></section>
    <section class="cartao"><h3>Capitão e pênaltis</h3>
      <label class="sel-linha"><i class="braco">C</i><select data-tatica="capitao" aria-label="Capitão"><option value="">Automático (${esc(auto?.curto || '')})</option>${time.xi.map(j => `<option value="${j.id}" ${s.capitao === j.id ? 'selected' : ''}>${esc(j.curto)}</option>`).join('')}</select></label>
      <label class="sel-linha"><i class="braco v">V</i><select data-tatica="vice" aria-label="Vice-capitão"><option value="">Sem vice definido</option>${time.xi.map(j => `<option value="${j.id}" ${s.vice === j.id ? 'selected' : ''}>${esc(j.curto)}</option>`).join('')}</select></label>
      <label class="sel-linha"><i class="braco p">P</i><select data-tatica="cobrador" aria-label="Cobrador de pênalti"><option value="">Pênalti: automático (quem finaliza melhor)</option>${time.xi.filter(j => j.pos !== 'GOL').map(j => `<option value="${j.id}" ${s.cobrador === j.id ? 'selected' : ''}>${esc(j.curto)} (fin ${j.att.fin})</option>`).join('')}</select></label>
      <p class="mudo" style="font-size:.95rem">Capitão com moral alta (70+) dá +1 de moral ao grupo por jogo; com moral baixa, tira 1. Tirar a braçadeira de quem continua jogando pesa: -4 (ou -8 se ele for o líder natural); o novo capitão ganha +4.</p></section>
    <section class="cartao"><h3>Estilo de jogo</h3>
      <div class="estilos">${Object.entries(ESTILOS).map(([k, e]) => `<button type="button" class="estilo ${s.estilo === k ? 'on' : ''}" data-acao="estilo" data-e="${k}" aria-pressed="${s.estilo === k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_ESTILO[k]}</svg><span>${e.nome}</span></button>`).join('')}</div>
      <p class="desc-estilo"><b>${ESTILOS[s.estilo].nome}:</b> ${ESTILOS[s.estilo].desc}</p></section>
    <section class="cartao"><h3>Plano B automático</h3>
      ${linhaPlano('vencendo2', 'Se estiver vencendo por 2 ou mais')}${linhaPlano('perdendo60', 'Se estiver perdendo depois dos 60 min')}${linhaPlano('empatando75', 'Se estiver empatando depois dos 75 min')}
      <p class="mudo" style="font-size:.95rem">Cada plano entra uma vez por jogo, sozinho, mesmo se você estiver só simulando.</p></section>
    ${bancoHtml(time)}`;
}

function bancoHtml(time) {
  const { app, esc } = H, s = app.s, ci = s.tecnico.clube;
  const naoTit = new Set([...time.xi, ...time.banco].map(j => j.id));
  const reservas = app.base.elencos[ci].filter(j => !naoTit.has(j.id) && !time.fora.has(j.id)).sort((a, b) => b.ovr - a.ovr);
  return `<section class="cartao"><div class="titulo-linha"><h3>Banco · ${time.banco.length}/9 · ${s.banco ? 'manual' : 'automático'}</h3>${s.banco ? '<button class="botao peq sec" type="button" data-acao="banco-auto">Voltar ao automático</button>' : ''}</div>
    <ul class="lista-banco">${time.banco.map(j => `<li><span class="pos-mini">${j.pos}</span>${boneco(j, j.pos === 'GOL')}<span class="le-nome"><b>${esc(j.curto)}</b><small>${POS_NOME[j.pos]} · condição ${Math.round(s.cond[j.id] ?? 100)}</small></span>${carinha(s.mor[j.id])}${chip(j.ovr, j.ovr)}<button type="button" class="salva-x" data-acao="banco-tirar" data-id="${j.id}" aria-label="Tirar ${esc(j.curto)} do banco">×</button></li>`).join('')}</ul>
    ${time.banco.length < 9 && reservas.length ? `<label class="sel-linha"><span>Pôr no banco</span><select data-acao-change="banco-por" aria-label="Pôr no banco"><option value="">Escolha um reserva…</option>${reservas.map(j => `<option value="${j.id}">${j.pos} · ${esc(j.curto)} (${j.ovr})</option>`).join('')}</select></label>` : ''}
    <label class="check"><input type="checkbox" data-tatica="subsAuto" ${s.subsAuto !== false ? 'checked' : ''}> O auxiliar faz trocas sozinho (aos 60, 70 e 80, em quem está cansado ou mal)</label>
    <p class="mudo" style="font-size:.95rem">As trocas durante o jogo usam só quem está no banco. Leve um goleiro reserva.</p></section>`;
}

// ---------- números ----------
function telaNumeros() {
  const { app, esc } = H, s = app.s, ci = s.tecnico.clube, ord = app.ordNum || 'g';
  const e = j => s.est?.[j.id] || [0, 0, 0, 0, 0, 0];
  const lista = app.base.elencos[ci].slice().sort({ g: (a, b) => e(b)[1] - e(a)[1] || e(b)[2] - e(a)[2], a: (a, b) => e(b)[2] - e(a)[2], n: (a, b) => media(e(b)) - media(e(a)), j: (a, b) => e(b)[0] - e(a)[0] }[ord]);
  return `<div class="titulo-linha"><h2>Números da temporada</h2></div>
    <div class="chips" role="group" aria-label="Ordenar">${[['g', 'Gols'], ['a', 'Assistências'], ['n', 'Nota média'], ['j', 'Jogos']].map(([k, t]) => `<button type="button" class="chip" data-acao="ord-num" data-o="${k}" aria-pressed="${ord === k}">${t}</button>`).join('')}</div>
    <section class="cartao tabela-wrap"><table><thead><tr><th style="text-align:left">Jogador</th><th>J</th><th>G</th><th>A</th><th>Nota</th><th class="so-largo">Amarelos</th><th class="so-largo">Vermelhos</th></tr></thead>
    <tbody>${lista.map(j => { const x = e(j); return `<tr><td class="clube-cel"><span><span class="pos-mini">${j.pos}</span> ${esc(j.curto)}</span></td><td>${x[0]}</td><td class="p">${x[1]}</td><td>${x[2]}</td><td>${x[0] ? media(x).toFixed(1).replace('.', ',') : '–'}</td><td class="so-largo">${x[4]}</td><td class="so-largo">${x[5]}</td></tr>`; }).join('')}</tbody></table></section>`;
}

// ---------- departamento médico ----------
function telaDM() {
  const { app, esc } = H, s = app.s, ci = s.tecnico.clube, el = app.base.elencos[ci], comp = compProxima(app.base, s);
  const les = el.filter(j => s.dm?.[j.id]).sort((a, b) => s.dm[a.id].n - s.dm[b.id].n);
  const sus = el.filter(j => s.susp?.[j.id]), pend = el.filter(j => Object.keys(s.amar?.[j.id] || {}).some(c => pendurado(s, j.id, c)));
  const carga = el.map(j => [j, fragilidade(s, j)]).filter(([, f]) => f >= 1.3).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const pct = x => Math.round(x * 100);
  const card = j => {
    const l = s.dm[j.id], L = LESOES[l.k] || { n: 'Lesão', cat: 'con' }, rec = (l.tot - l.n) / l.tot, inf = infilInfo(s, j.id);
    return `<section class="cartao dm-card"><div class="dm-topo">${boneco(j, j.pos === 'GOL')}<span class="le-nome"><b>${esc(j.curto)}</b><small>${POS_NOME[j.pos]} · ${CATEGORIA[L.cat]}</small></span>
        <span class="dm-jogos"><b class="num">${l.n}</b><small>jogo${l.n > 1 ? 's' : ''} fora</small></span></div>
      <p class="dm-diag">${esc(L.n)}${(s.lesH?.[j.id]?.[0] || 0) > 2 ? ' · <span class="selo-dm les">histórico de lesões</span>' : ''}</p>
      <div class="dm-barra" role="img" aria-label="Recuperação ${pct(rec)}%"><b style="width:${Math.max(4, pct(rec))}%"></b></div>
      <p class="mudo dm-rodape">Recuperação ${pct(rec)}% · ${l.n === 1 ? 'volta depois do próximo jogo' : `volta em ${l.n} jogos do clube`}</p>
      ${inf.ok ? `<button class="botao peq" type="button" data-acao="infiltrar" data-id="${j.id}">Infiltrar para o próximo jogo · risco de agravar ${pct(inf.risco)}%</button>`
        : inf.marcada ? `<p class="dm-inf">Vai jogar infiltrado no próximo jogo (risco de agravar: ${pct(inf.risco)}%). <button class="link" type="button" data-acao="desinfiltrar" data-id="${j.id}">Desmarcar</button></p>`
        : `<p class="mudo dm-rodape">Infiltração: ${inf.motivo}</p>`}</section>`;
  };
  const linha = (j, txt) => `<li><span class="pos-mini">${j.pos}</span>${boneco(j, j.pos === 'GOL')}<span class="le-nome"><b>${esc(j.curto)}</b><small>${txt}</small></span></li>`;
  return `<div class="titulo-linha"><h2>Departamento médico</h2><span class="mudo">${les.length} lesionado${les.length === 1 ? '' : 's'} · ${sus.length} suspenso${sus.length === 1 ? '' : 's'}</span></div>
    ${les.length ? les.map(card).join('') : '<section class="cartao"><p class="mudo">Ninguém no DM. Elenco inteiro à disposição.</p></section>'}
    ${sus.length ? `<section class="cartao"><h3>Suspensos</h3><ul class="lista-banco lista-dm">${sus.map(j => linha(j, Object.entries(s.susp[j.id]).map(([c, n]) => `${n} jogo${n > 1 ? 's' : ''} ${COMP_DE[c]}`).join(' · '))).join('')}</ul></section>` : ''}
    ${pend.length ? `<section class="cartao"><h3>Pendurados</h3><ul class="lista-banco lista-dm">${pend.map(j => linha(j, Object.keys(s.amar[j.id]).filter(c => pendurado(s, j.id, c)).map(c => `2 amarelos ${COMP_DE[c].replace(/^d/, 'n')}`).join(' · '))).join('')}</ul><p class="mudo" style="font-size:.95rem">Mais um amarelo e fica fora do jogo seguinte daquela competição.</p></section>` : ''}
    ${carga.length ? `<section class="cartao"><h3>Atenção à carga</h3><ul class="lista-banco lista-dm">${carga.map(([j, f]) => linha(j, `propensão ${f >= 1.6 ? 'muito alta' : 'alta'} a lesão · condição ${Math.round(s.cond[j.id] ?? 100)}`)).join('')}</ul></section>` : ''}
    <section class="cartao"><h3>Como funciona</h3><p class="mudo" style="font-size:.95rem">Lesão acontece no jogo, mais em quem entra esgotado (condição abaixo de 55), nos veteranos, em quem já se machucou e com treino intenso. A recuperação conta jogos do clube. Infiltração só na reta final da recuperação e uma vez por lesão: ele joga, mas pode agravar. Cartões valem por competição: 3 amarelos = 1 jogo; vermelho direto = 2; dois amarelos no mesmo jogo = 1. ${comp !== 'L' ? `O próximo jogo é pela ${COMP_NOME[comp]}.` : ''}</p></section>`;
}

function telaBase() {
  const s = H.app.s, jovens = H.app.base.elencos[s.tecnico.clube].filter(j => j.idade <= 20).sort((a, b) => b.pot - a.pot || b.ovr - a.ovr);
  return `<section class="cartao"><h3>Categorias de base</h3><p class="mudo">Todo começo de temporada sobem três garotos da base para as posições mais carentes. Até uns 23 anos eles crescem rápido rumo ao potencial; depois dos 30 o overall começa a cair.</p></section>
    ${jovens.length ? `<div class="album">${jovens.map(j => H.figurinha(j)).join('')}</div>` : '<section class="cartao"><p class="mudo">Nenhum jogador de até 20 anos no elenco. Os primeiros garotos sobem na virada da temporada.</p></section>'}`;
}

function telaTreino() {
  const { app, esc } = H, s = app.s, t = s.treino || 'normal', ci = s.tecnico.clube;
  const OP = [['leve', 'Leve', 'Recupera 25% mais rápido e machuca menos. Evolução mais lenta (×0,6).'], ['normal', 'Normal', 'O equilíbrio: recuperação, lesões e evolução no padrão.'], ['intenso', 'Intenso', 'Evolui mais rápido (×1,45), mas recupera 20% mais devagar e machuca mais.']];
  const emEvo = app.base.elencos[ci].filter(j => j.pot > j.ovr && idadeF(j.idade) > 0).sort((a, b) => ganho(s, b, 7) - ganho(s, a, 7));
  const foco = s.foco || [];
  return `<section class="cartao"><h3>Intensidade do treino</h3><div class="opcoes">${OP.map(([k, n, d]) => `<label class="opcao"><input type="radio" name="treino" data-tatica="treino" value="${k}" ${t === k ? 'checked' : ''}><strong>${n}</strong><small>${d}</small></label>`).join('')}</div>
    <p class="mudo" style="font-size:.95rem">A condição cai durante o jogo e volta nos dias entre uma partida e outra. A evolução acontece a cada jogo do clube: quem é jovem e tem margem até o potencial cresce, mais ainda se jogar e for bem.</p></section>
    <section class="cartao"><div class="titulo-linha"><h3>Em evolução</h3><span class="mudo">Foco individual ${foco.length}/${MAX_FOCO}</span></div>
      ${emEvo.length ? `<ul class="lista-banco lista-dm">${emEvo.map(j => { const ev = s.evo?.[j.id] || 0, f = foco.includes(j.id);
        return `<li class="evo-linha"><span class="pos-mini">${j.pos}</span>${boneco(j, j.pos === 'GOL')}<span class="le-nome"><b>${esc(j.curto)} ${chip(j.ovr, j.ovr)}</b><small>${j.idade} anos · potencial ${'★'.repeat(estrelas(j.pot))} · ${ev >= 1 ? `+${Math.floor(ev)} no clube · ` : ''}próximo ponto</small>
          <span class="dm-barra"><b style="width:${Math.max(4, Math.round((ev % 1) * 100))}%"></b></span></span>
          <button type="button" class="botao peq ${f ? '' : 'sec'}" data-acao="foco" data-id="${j.id}" aria-pressed="${f}">${f ? 'Em foco' : 'Focar'}</button></li>`; }).join('')}</ul>`
        : '<p class="mudo">Ninguém com margem para crescer no elenco.</p>'}
      <p class="mudo" style="font-size:.95rem">Foco individual: até ${MAX_FOCO} jogadores evoluem 80% mais rápido. Depois dos 30 ninguém cresce no treino, e o potencial é o teto.</p></section>`;
}

// ---------- ações ----------
export const acoes = {
  'aba-elenco': el => { H.app.abaElenco = el.dataset.a; H.app.vaga = null; H.render(); },
  'ord-jog': el => { H.app.ordJog = el.dataset.o; H.render(); },
  'ord-num': el => { H.app.ordNum = el.dataset.o; H.render(); },
  'editar-pos': el => { H.app.editPos = !H.app.editPos; H.app.vaga = null; H.render(); },
  'mover-vaga': el => { const e = moverVaga(H.app.base, H.app.s, H.app.vaga, +el.dataset.dx, +el.dataset.dy); if (e) H.aviso(e); H.render(); H.salvar(); },
  'pos-vaga': el => { const e = editarVaga(H.app.base, H.app.s, H.app.vaga, el.dataset.p); if (e) H.aviso(e); H.render(); H.salvar(); },
  formacao: el => { trocarFormacao(H.app.base, H.app.s, el.dataset.f); H.app.vaga = null; H.render(); H.salvar(); },
  vaga: el => { const i = +el.dataset.i; H.app.vaga = H.app.vaga === i ? null : i; H.render(); },
  escolher: el => { escalar(H.app.base, H.app.s, H.app.vaga, +el.dataset.id); H.app.vaga = null; H.render(); H.salvar(); },
  'melhor-time': () => { H.app.s.xi = null; H.aviso('Escalação automática: a cada jogo entram os melhores, poupando os cansados.'); H.render(); H.salvar(); },
  estilo: el => { H.app.s.estilo = el.dataset.e; H.render(); H.salvar(); },
  'salvar-escalacao': () => {
    const { app } = H, s = app.s, time = escalacao(app.base, s, s.tecnico.clube);
    s.escSalvas.push({ nome: `Escalação ${s.escSalvas.length + 1}`, formacao: time.formacao, pers: time.pers || null, estilo: s.estilo, xi: time.xi.map(j => j.id), banco: s.banco, gatilhos: JSON.parse(JSON.stringify(s.gatilhos || {})) });
    H.aviso('Escalação salva.'); H.render(); H.salvar();
  },
  'usar-salva': el => { const s = H.app.s, e = s.escSalvas[+el.dataset.i]; Object.assign(s, { formacao: e.formacao, ...(e.pers ? { formPers: e.pers } : {}), estilo: e.estilo, xi: e.xi.slice(), banco: e.banco ? e.banco.slice() : null, gatilhos: JSON.parse(JSON.stringify(e.gatilhos || {})) }); H.aviso(`${e.nome} em campo.`); H.render(); H.salvar(); },
  'apagar-salva': el => { H.app.s.escSalvas.splice(+el.dataset.i, 1); H.render(); H.salvar(); },
  foco: el => { const m = alternarFoco(H.app.s, +el.dataset.id); if (m) H.aviso(m); H.render(); H.salvar(); },
  infiltrar: el => { const m = infiltrar(H.app.s, +el.dataset.id); if (m) H.aviso(m); H.render(); H.salvar(); },
  desinfiltrar: el => { infiltrar(H.app.s, +el.dataset.id, false); H.render(); H.salvar(); },
  'banco-auto': () => { H.app.s.banco = null; H.render(); H.salvar(); },
  'banco-tirar': el => { const { app } = H, s = app.s; const atual = escalacao(app.base, s, s.tecnico.clube).banco.map(j => j.id); s.banco = atual.filter(id => id !== +el.dataset.id); H.render(); H.salvar(); },
};

// selects e checkboxes da escalação
export function aoMudar(el) {
  const { app } = H, s = app.s;
  if (el.dataset.acaoChange === 'banco-por' && el.value) { const atual = escalacao(app.base, s, s.tecnico.clube).banco.map(j => j.id); s.banco = [...atual, +el.value].slice(0, 9); H.render(); H.salvar(); return true; }
  if (el.dataset.plano) { const k = el.dataset.plano, campo = el.dataset.campoPlano; s.gatilhos = s.gatilhos || {}; const p = { ...(s.gatilhos[k] || {}) }; if (el.value) p[campo] = el.value; else delete p[campo]; s.gatilhos[k] = p.estilo || p.formacao ? p : null; H.salvar(); return true; }
  const k = el.dataset.tatica; if (!k) return false;
  if (k === 'capitao') { definirCapitao(app.base, s, el.value ? +el.value : null); H.render(); }
  else if (k === 'vice' || k === 'cobrador') s[k] = el.value ? +el.value : null;
  else if (k === 'subsAuto') s.subsAuto = el.checked;
  else if (k === 'treino') s.treino = el.value;
  H.salvar();
  return true;
}
