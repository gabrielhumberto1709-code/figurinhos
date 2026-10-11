// Aba Torneios: Brasileirão (tabela e artilharia), Copa do Brasil (chaveamento e prêmios), Libertadores,
// Sul-Americana e Supercopa, Regionais (Nordeste, Sul-Sudeste e Verde), Agenda com todos os seus jogos e Histórico das temporadas.
import { tabela, rodadasDe, dataRodada, dataLiga, feitas, tabelaQuad, dataSupDe } from './motor/mundo.js';
import { FASES, PREMIOS, dataCopa, campanha, naCopa, mandoDe } from './motor/copa.js';
import { fmtDinheiro } from './motor/util.js';
import { REGIONAIS, ESTADUAIS, COPAS_REG, fasesReg, dataFaseReg, jogosDaFaseReg, tabelaReg, campanhaReg, vivoReg, regsDe } from './motor/regionais.js';
import { dataAmistoso, dataLiga2, N_LIGA } from './motor/calendario.js';
import { TORNEIOS, PREMIO_SUP, F_MATA, dataCont, tabelaGrupo, campanhaCont, naCont, jogoDoClube, emQualCont, jogosDaFase, fasesDe, jogadorCont } from './motor/continental.js';

let H; // { app, clube, esc, imgEscudo, render }
export const configurar = h => { H = h; };

const ABAS = [['brasileirao', 'Brasileirão'], ['copa', 'Copa do Brasil'], ['continental', 'Continental'], ['regionais', 'Regionais'], ['agenda', 'Agenda'], ['historico', 'Histórico']];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dataCurta = d => `${SEMANA[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
// zonas de 2026 (CBF): 1º ao 4º nos grupos da Libertadores, 5º na pré-Libertadores, 6º ao 11º na Sula, 4 caem
// (vaga repassada pela Copa do Brasil ou pelas continentais muda quem entra, como na vida real);
// B sobe 2 direto e do 3º ao 6º joga o playoff; C leva 8 ao quadrangular e cai só 2
const ZONAS = {
  A: [[1, 4, 'z-lib', 'Libertadores', 'var(--carimbo)'], [5, 5, 'z-pre', 'Pré-Libertadores', '#6E8FD0'], [6, 11, 'z-sul', 'Sul-Americana', 'var(--gramado)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
  B: [[1, 2, 'z-sobe', 'Acesso direto', 'var(--gramado)'], [3, 6, 'z-sul', 'Playoff de acesso', 'var(--carimbo)'], [17, 20, 'z-cai', 'Rebaixamento', 'var(--cartao)']],
  C: [[1, 8, 'z-sobe', 'Quadrangular de acesso', 'var(--gramado)'], [19, 20, 'z-cai', 'Rebaixamento (Série D)', 'var(--cartao)']],
};
const chips = (rot, itens, acao, ativo) => `<div class="chips" role="group" aria-label="${rot}">${itens.map(([k, t]) => `<button type="button" class="chip" data-acao="${acao}" data-v="${k}" aria-pressed="${ativo(k)}">${t}</button>`).join('')}</div>`;
const nomeC = ci => `${H.imgEscudo(ci, 20, 22)}<span>${H.esc(H.clube(ci).n)}</span>`;
// últimos 5 jogos: bolinha verde (vitória), cinza (empate), vermelha (derrota)
const forma = ult => `<span class="forma">${(ult || []).slice(-5).map(r => `<i class="${r}" title="${{ V: 'Vitória', E: 'Empate', D: 'Derrota' }[r]}"></i>`).join('')}</span>`;

function brasileirao() {
  const s = H.app.s, ci = s.tecnico.clube, d = H.app.divTabela || H.clube(ci).div, B = H.app.base;
  const zona = n => (ZONAS[d].find(([a, b]) => n >= a && n <= b) || [])[2] || '';
  const art = [...B.jog.values()].filter(j => H.clube(j.clube).div === d && s.est?.[j.id]?.[1]).sort((a, b) => s.est[b.id][1] - s.est[a.id][1] || s.est[a.id][0] - s.est[b.id][0]).slice(0, 10);
  return `${chips('Divisão', ['A', 'B', 'C'].map(x => [x, `Série ${x}`]), 'div-tabela', x => d === x)}
    <section class="cartao tabela-wrap"><table class="tab-arrasta"><caption class="vh">Série ${d}</caption>
      <thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>SG</th><th>Últimos 5</th></tr></thead>
      <tbody>${tabela(B, s, d).map((l, i) => `<tr class="${zona(i + 1)} ${l.clube === ci ? 'meu' : ''}"><td class="pos">${i + 1}</td>
        <td class="clube-cel"><span>${nomeC(l.clube)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.v}</td>
        <td>${l.e}</td><td>${l.d}</td><td>${l.gp}</td><td>${l.sg}</td><td>${forma(l.ultimos)}</td></tr>`).join('')}</tbody></table></section>
    <p class="mudo arrasta-dica">Arraste a tabela para o lado para ver os últimos 5 jogos.</p>
    <div class="legenda">${ZONAS[d].map(z => `<span style="--c:${z[4]}">${z[3]}</span>`).join('')}</div>
    ${segundaFase(d)}
    <section class="cartao"><h3>Artilharia · Série ${d}</h3>${art.length ? `<table><thead><tr><th>#</th><th style="text-align:left">Jogador</th><th>G</th><th>J</th></tr></thead><tbody>${art.map((j, i) => `<tr class="${j.clube === ci ? 'meu' : ''}"><td class="pos">${i + 1}</td><td class="clube-cel"><span>${H.imgEscudo(j.clube, 18, 20)}${H.esc(j.curto)}</span></td><td class="p">${s.est[j.id][1]}</td><td>${s.est[j.id][0]}</td></tr>`).join('')}</tbody></table>` : '<p class="mudo">Ninguém marcou ainda.</p>'}</section>`;
}

// segunda fase da B (playoff) e da C (quadrangulares e final)
function segundaFase(d) {
  const s = H.app.s, ci = s.tecnico.clube, F = s.f2?.[d]?.ano === s.ano ? s.f2[d] : null;
  if (d === 'A') return '';
  if (!F) return `<p class="mudo" style="font-size:.95rem">${d === 'B' ? 'Depois da 38ª rodada: 3º×6º e 4º×5º em ida e volta (21 e 28/nov), volta na casa do melhor colocado; empate no agregado classifica o melhor colocado. Os 2 vencedores sobem com o 1º e o 2º.' : 'Turno único (19 rodadas). Os 8 primeiros formam dois quadrangulares em ida e volta (1º, 4º, 5º e 8º / 2º, 3º, 6º e 7º); os 2 de cada grupo sobem e os líderes decidem o título em ida e volta. Os 2 últimos caem para a Série D.'}</p>`;
  const jogos = i => F.jogos.filter(j => j.i === i);
  if (d === 'B') return `<section class="cartao"><h3>Playoff de acesso</h3><ol class="chave-copa">${F.chaves.map(([x, y]) => { const v = jogos(1).find(j => j.h === x && j.a === y), ida = jogos(0).find(j => j.h === y && j.a === x); return placarCopa(v ? { h: x, a: y, gols: [v.gols[0] + (ida?.gols[1] || 0), v.gols[1] + (ida?.gols[0] || 0)] } : { h: x, a: y, data: dataLiga2(s.ano, 'B', F.i) }, ci); }).join('')}</ol><p class="mudo" style="font-size:.9rem">Placar somado dos dois jogos.${F.venc ? ` Subiram: ${F.venc.map(c => H.esc(H.clube(c).n)).join(' e ')}.` : ''}</p></section>`;
  const grupos = [0, 1].map(g => `<section class="cartao tabela-wrap"><h3>Quadrangular ${g ? 'C' : 'B'}</h3><table><thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>SG</th></tr></thead>
    <tbody>${tabelaQuad(F, g).map((l, n) => `<tr class="${n < 2 ? 'z-sobe' : ''} ${l.clube === ci ? 'meu' : ''}"><td class="pos">${n + 1}</td><td class="clube-cel"><span>${nomeC(l.clube)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.sg}</td></tr>`).join('')}</tbody></table></section>`).join('');
  const fin = F.final ? `<section class="cartao"><h3>Final da Série C${F.campeao != null ? ` · campeão: ${H.esc(H.clube(F.campeao).n)}` : ''}</h3><ol class="chave-copa">${[6, 7].map(i => jogos(i)[0] ? placarCopa(jogos(i)[0], ci) : placarCopa({ h: i === 6 ? F.final[1] : F.final[0], a: i === 6 ? F.final[0] : F.final[1], data: dataLiga2(s.ano, 'C', i) }, ci)).join('')}</ol></section>` : '';
  return fin + `<div class="grupos-cont">${grupos}</div>`;
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
  const art = Object.entries(c.art).map(([id, g]) => [jogadorCont(B, c.ano, +id), g]).filter(([j]) => j).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `<section class="cartao copa-topo"><div class="titulo-linha"><h3>Copa do Brasil ${c.ano}</h3>${c.campeao != null ? `<span class="tag destaque">Campeão: ${H.esc(H.clube(c.campeao).n)}</span>` : ''}</div>
      <p><b>${camp ? `${H.esc(H.clube(ci).n)}: ${camp}` : `O ${H.esc(H.clube(ci).n)} não disputa esta edição.`}</b></p>
      <p class="mudo" style="font-size:.95rem">Formato de 2026: fases 1 a 4 em jogo único (fevereiro e março) com Série B, Série C e clubes dos estaduais; a Série A entra na 5ª fase (abril e maio). 5ª fase, oitavas, quartas e semi em ida e volta; final única em campo neutro em 6 de dezembro. Mandos e chaves por sorteio; empate vai para os pênaltis. Campeão e vice vão à Libertadores.</p>
      <div class="chips">${[['1ª fase', PREMIOS.f1], ['3ª fase', PREMIOS.f3], ['5ª fase', PREMIOS.f5], ['Oitavas', PREMIOS.oit], ['Quartas', PREMIOS.qua], ['Semi', PREMIOS.sem], ['Vice', PREMIOS.vice], ['Campeão', PREMIOS.campeao]].map(([t, v]) => `<span class="chip-info">${t} ${fmtDinheiro(v)}</span>`).join('')}</div></section>
    ${fases.join('')}
    ${art.length ? `<section class="cartao"><h3>Artilharia da Copa</h3><ol class="selecao">${art.map(([j, g]) => `<li><span class="clube-cel"><span>${H.imgEscudo(j.clube, 18, 20)}${H.esc(j.curto)}</span></span><span class="nota">${g}</span></li>`).join('')}</ol></section>` : ''}`;
}

// Libertadores, Sul-Americana e Supercopa
const LETRA = 'ABCDEFGH';
function continental() {
  const s = H.app.s, ci = s.tecnico.clube, k = H.app.abaCont || emQualCont(s, ci) || 'LIB', B = H.app.base;
  const topo = chips('Competição', [['LIB', 'Libertadores'], ['SUL', 'Sul-Americana'], ['SUP', 'Supercopa']], 'aba-cont', x => x === k);
  if (!s.cont) return `${topo}<section class="cartao"><p class="mudo">As copas continentais começam na próxima temporada.</p></section>`;
  if (k === 'SUP') {
    const x = s.cont.sup, j = x.jogo;
    return `${topo}<section class="cartao copa-topo"><div class="titulo-linha"><h3>Supercopa do Brasil ${s.cont.ano}</h3>${j ? `<span class="tag destaque">Campeão: ${H.esc(H.clube(j.campeao).n)}</span>` : ''}</div>
      <p class="mudo" style="font-size:.95rem">Campeão da Série A × campeão da Copa do Brasil, em jogo único e campo neutro. Data de 2026: 1º de fevereiro; se um dos dois tiver estadual nesse dia, ela vai para a Quarta-feira de Cinzas (18/fev). Empate vai para os pênaltis.</p>
      <ol class="chave-copa">${placarCopa({ h: x.h, a: x.a, gols: j?.gols, pen: j?.pen, data: j ? null : dataSupDe(B, s) }, ci)}</ol>
      <div class="chips"><span class="chip-info">Campeão ${fmtDinheiro(PREMIO_SUP.campeao)}</span><span class="chip-info">Vice ${fmtDinheiro(PREMIO_SUP.vice)}</span></div></section>`;
  }
  const T = s.cont[k], P = TORNEIOS[k].premio, camp = campanhaCont(s, k, ci), nome = c => H.esc(H.clube(c).n);
  // mata-mata, do mais recente ao mais antigo: jogos feitos e, na fase atual, os confrontos com a data
  const mata = (T, k, de, pre = '') => { const F = fasesDe(k), out = []; for (let f = F.length - 1; f >= de; f--) {
    const jogos = T.jogos.filter(j => j.fase === f);
    if (jogos.length) out.push(`<section class="cartao"><h3>${pre}${F[f].nome}</h3><ol class="chave-copa">${jogos.map(j => placarCopa(j, ci)).join('')}</ol></section>`);
    else if (f === T.fase && T.chaves.length) out.push(`<section class="cartao"><h3>${pre}${F[f].nome} · ${dataCurta(dataCont(dataRodada, s.ano, f, k))}</h3><ol class="chave-copa">${jogosDaFase(T).map(([h, a]) => placarCopa({ h, a }, ci)).join('')}</ol></section>`);
  } return out.join(''); };
  const PR = k === 'LIB' && s.cont.PRE, sorteio = T.espera && !T.grupos.length;
  const pre = PR ? `<section class="cartao"><h3>Pré-Libertadores ${PR.ano}</h3>
      <p class="mudo" style="font-size:.95rem">16 clubes na 2ª fase (19 e 26/fev) e 8 na 3ª (5 e 12/mar), em ida e volta, com a volta na casa do cabeça de chave; empate no agregado vai para os pênaltis. Os 4 vencedores vão aos grupos da Libertadores; quem cai na 3ª fase vai para os grupos da Sul-Americana.</p>
      ${PR.venc ? `<p style="font-size:.95rem">Foram aos grupos: ${PR.venc.map(nome).join(', ')}.</p>` : ''}
      <div class="chips"><span class="chip-info">2ª fase ${fmtDinheiro(TORNEIOS.PRE.premio.f2)}</span><span class="chip-info">3ª fase ${fmtDinheiro(TORNEIOS.PRE.premio.f3)}</span></div></section>${mata(PR, 'PRE', 0, 'Pré-Libertadores · ')}` : '';
  const fases = [mata(T, k, F_MATA)];
  const grupos = T.grupos.map((g, i) => `<section class="cartao tabela-wrap"><h3>Grupo ${LETRA[i]}</h3><table class="tab-arrasta"><thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>SG</th><th>Últimos 5</th></tr></thead>
    <tbody>${tabelaGrupo(T, i).map((l, n) => `<tr class="${n < (k === 'LIB' ? 2 : 1) ? 'z-lib' : n === (k === 'LIB' ? 2 : 1) ? 'z-sul' : ''} ${l.clube === ci ? 'meu' : ''}"><td class="pos">${n + 1}</td><td class="clube-cel"><span>${nomeC(l.clube)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.sg}</td><td>${forma(l.ult)}</td></tr>`).join('')}</tbody></table></section>`).join('');
  const art = Object.values(T.art).sort((a, b) => b[0] - a[0]).slice(0, 5);
  return `${topo}<section class="cartao copa-topo"><div class="titulo-linha"><h3>${TORNEIOS[k].nome} ${T.ano}</h3>${T.campeao != null ? `<span class="tag destaque">Campeão: ${H.esc(H.clube(T.campeao).n)}</span>` : ''}</div>
      <p><b>${camp ? `${H.esc(H.clube(ci).n)}: ${camp}` : `O ${H.esc(H.clube(ci).n)} não disputa esta edição.`}</b></p>
      <p class="mudo" style="font-size:.95rem">32 clubes em 8 grupos de 4, em turno e returno (em 2026, os grupos do sorteio real), de 8/abr a 27/mai. ${k === 'LIB' ? 'Os 2 primeiros vão às oitavas e o 3º cai para o playoff da Sul-Americana.' : 'O 1º vai direto às oitavas; o 2º joga o playoff (22 e 29/jul) contra um 3º da Libertadores, que decide em casa.'} Oitavas, quartas e semi em ida e volta, com a volta na casa da melhor campanha (empate no agregado vai para os pênaltis); final única em campo neutro (${k === 'LIB' ? '28' : '21'}/nov). ${k === 'LIB' ? 'Vagas brasileiras (regra de 2026): do 1º ao 4º da Série A e o campeão da Copa do Brasil vão direto aos grupos; o 5º e o vice da Copa jogam a pré-Libertadores. Campeões brasileiros da Libertadores e da Sula também vão aos grupos. Vaga de quem já está classificado passa adiante: a do campeão da Copa vai para o vice, as outras para o próximo da tabela.' : 'Vagas brasileiras: do 6º ao 11º da Série A (os 6 seguintes a quem foi à Libertadores); mais 4 vagas de quem cai na 3ª fase da pré-Libertadores.'}</p>${(s.repasses || []).length && k === 'LIB' ? `<p style="font-size:.95rem">${s.repasses.map(r => `Vaga repassada: ${nome(r.clube)}${r.pos ? ` (${r.pos}º)` : ''} herdou a vaga ${r.pre ? 'na pré' : 'nos grupos'} de ${r.por} do ${nome(r.de)}.`).join(' ')}</p>` : ''}
      ${sorteio ? `<p style="font-size:.95rem"><b>Sorteio dos grupos em 12/mar, depois da pré-Libertadores.</b> Já classificados do Brasil: ${T.espera.filter(c => H.clube(c).div !== 'X').map(nome).join(', ')}.</p>` : ''}
      <div class="chips">${[['Grupos', P.grupos], ['Vitória nos grupos', P.vitoria], ['Oitavas', P.oit], ['Quartas', P.qua], ['Semi', P.sem], ['Final', P.fin], ['Campeão', P.campeao]].map(([t, v]) => `<span class="chip-info">${t} ${fmtDinheiro(v)}</span>`).join('')}</div></section>
    ${fases.join('')}<div class="grupos-cont">${grupos}</div>${pre}
    ${art.length ? `<section class="cartao"><h3>Artilharia</h3><ol class="selecao">${art.map(([g, nome, c]) => `<li><span class="clube-cel"><span>${H.imgEscudo(c, 18, 20)}${H.esc(nome)}</span></span><span class="nota">${g}</span></li>`).join('')}</ol></section>` : ''}`;
}

// estaduais e copas regionais: as do seu clube em chips, todas no seletor
const ROT_PREMIO = { cota: 'Cota', vitoria: 'Vitória nos grupos', campeao: 'Campeão', vice: 'Vice' };
function regionais() {
  const s = H.app.s, ci = s.tecnico.clube, meus = regsDe(s, ci), k = REGIONAIS[H.app.abaReg] ? H.app.abaReg : meus[0] || 'SP';
  const opt = x => `<option value="${x}" ${x === k ? 'selected' : ''}>${REGIONAIS[x].nome}</option>`;
  const topo = `${meus.length ? chips('Do seu clube', meus.map(x => [x, REGIONAIS[x].curto]), 'aba-reg', x => x === k) : ''}
    <label class="sel-linha sel-reg">Ver <select data-reg-sel aria-label="Competição regional"><optgroup label="Estaduais">${ESTADUAIS.map(opt).join('')}</optgroup><optgroup label="Copas regionais">${COPAS_REG.map(opt).join('')}</optgroup></select></label>`;
  const T = s.reg?.v === 2 && s.reg.ano === s.ano && !s.reg.pulado ? s.reg[k] : null;
  if (!T) return `${topo}<section class="cartao"><p class="mudo">Os regionais voltam em janeiro.</p></section>`;
  const S = REGIONAIS[k], F = fasesReg(k), camp = campanhaReg(s, k, ci), blocos = [];
  const bloco = (titulo, jogos) => `<section class="cartao"><h3>${titulo}</h3><ol class="chave-copa">${jogos.map(j => placarCopa(j, ci)).join('')}</ol></section>`;
  if (T.fase < F.length && jogosDaFaseReg(T).length) blocos.push(bloco(`${F[T.fase].nome} · ${dataCurta(dataFaseReg(s.ano, k, T.fase))}`, jogosDaFaseReg(T).map(([h, a]) => ({ h, a }))));
  // mata-mata inteiro e, da fase de grupos, só a última rodada jogada
  let rodadaVista = false;
  for (let f = Math.min(T.fase, F.length) - 1; f >= 0; f--) {
    if (F[f].e != null) { if (rodadaVista) continue; rodadaVista = true; }
    blocos.push(bloco(F[f].nome, T.jogos.filter(j => j.fase === f)));
  }
  const tabelas = T.etapas.map((E, e) => {
    const X = S.etapas[e], L = X.letras || 'ABCDEFGH', geral = X.geral || E.grupos.length === 1, gs = geral ? [E.grupos.flat()] : E.grupos;
    return gs.map((g, gi) => `<section class="cartao tabela-wrap"><h3>${S.etapas.length > 1 ? `${X.nome} · ` : ''}${geral ? 'Classificação' : `Grupo ${L[gi]}${X.regioes ? ` · ${X.regioes[gi]}` : ''}`}</h3><table class="tab-arrasta"><thead><tr><th>#</th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>SG</th><th>Últimos 5</th></tr></thead>
      <tbody>${tabelaReg(T, e, g).map((l, n) => `<tr class="${n < X.sobe ? 'z-lib' : ''} ${l.clube === ci ? 'meu' : ''}"><td class="pos">${n + 1}</td><td class="clube-cel"><span>${nomeC(l.clube)}</span></td><td class="p">${l.p}</td><td>${l.j}</td><td>${l.sg}</td><td>${forma(l.ult)}</td></tr>`).join('')}</tbody></table></section>`).join('');
  }).reverse().join('');
  const tags = [T.campeao != null && `<span class="tag destaque">Campeão: ${H.esc(H.clube(T.campeao).n)}</span>`, ...Object.entries(T.titulos).map(([t, c]) => `<span class="tag">${t}: ${H.esc(H.clube(c).n)}</span>`)].filter(Boolean).join('');
  const premios = [...Object.entries(S.premio).filter(([x, v]) => ROT_PREMIO[x] && v).map(([x, v]) => [ROT_PREMIO[x], v]), ...(S.premio.mata || []).map((v, m) => [`Vaga ${S.mata[m].curto.toLowerCase()}`, v])];
  return `${topo}<section class="cartao copa-topo"><div class="titulo-linha"><h3>${S.nome} ${T.ano}</h3>${tags}</div>
      <p><b>${camp ? `${H.esc(H.clube(ci).n)}: ${camp}` : `O ${H.esc(H.clube(ci).n)} não disputa ${S.copa ? 'esta copa' : 'este estadual'}.`}</b></p>
      <p class="mudo" style="font-size:.95rem">${S.formato} ${S.copa ? 'De 25/mar a 7/jun, às quartas, junto com o Brasileirão. Quem está na Libertadores ou na Sul-Americana não joga.' : 'De 11/jan a 8/mar (domingos e algumas quartas), junto com o começo da Série A.'} Não vale vaga em nada.</p>
      ${premios.length ? `<div class="chips">${premios.map(([t, v]) => `<span class="chip-info">${t} ${fmtDinheiro(v)}</span>`).join('')}</div>` : ''}</section>
    ${blocos.join('')}<div class="grupos-cont">${tabelas}</div>`;
}

// todos os seus compromissos da temporada, liga e copa, em ordem de data
export function agenda() {
  const s = H.app.s, ci = s.tecnico.clube, d = H.clube(ci).div, ev = [];
  rodadasDe(H.app.base, s, d).forEach((rd, i) => {
    const [h, a] = rd.find(j => j.includes(ci)), g = i < feitas(s, d) ? s.res?.[d]?.[`${h}-${a}`] : null;
    ev.push({ data: dataLiga(s.ano, d, i), comp: `Série ${d} · ${i + 1}ª`, h, a, g });
  });
  const F2 = s.f2?.[d]?.ano === s.ano ? s.f2[d] : null;
  if (F2) for (const j of F2.jogos.filter(x => x.h === ci || x.a === ci)) ev.push({ data: dataLiga2(s.ano, d, j.i), comp: d === 'B' ? `Playoff · ${j.i ? 'volta' : 'ida'}` : j.i >= 6 ? `Final · ${j.i === 6 ? 'ida' : 'volta'}` : `Quadrangular · ${j.i + 1}ª`, h: j.h, a: j.a, g: j.gols, pen: j.pen });
  if (s.amistosos?.ano === s.ano) s.amistosos.jogos.forEach((j, i) => ev.push({ data: dataAmistoso(s.ano, i), comp: `Amistoso ${i + 1}`, copa: true, h: j.h, a: j.a, g: j.g }));
  if (s.copa) {
    for (const j of s.copa.jogos.filter(x => x.h === ci || x.a === ci)) ev.push({ data: dataCopa(dataRodada, s.ano, j.fase), comp: `Copa · ${FASES[j.fase].curto}`, copa: true, h: j.h, a: j.a, g: j.gols, pen: j.pen });
    if (naCopa(s, ci)) for (let i = s.copa.fase; i < FASES.length; i++) {
      const ch = i === s.copa.fase ? s.copa.chaves.find(x => x.includes(ci)) : null, [h, a] = ch ? mandoDe(i, ch) : [ci, null];
      ev.push({ data: dataCopa(dataRodada, s.ano, i), comp: `Copa · ${FASES[i].curto}`, copa: true, h, a, futuro: !ch });
    }
  }
  for (const k of ['PRE', 'LIB', 'SUL']) {
    const T = s.cont?.[k], F = fasesDe(k), rot = { PRE: 'Pré-Liberta', LIB: 'Liberta', SUL: 'Sul-Am.' }[k];
    if (!T || !(k === 'PRE' ? T.clubes.includes(ci) : T.grupos.some(g => g.includes(ci)) || T.vindos?.includes(ci))) continue;
    for (const j of T.jogos.filter(x => x.h === ci || x.a === ci)) ev.push({ data: dataCont(dataRodada, s.ano, j.fase, k), comp: `${rot} · ${F[j.fase].curto}`, copa: true, h: j.h, a: j.a, g: j.gols, pen: j.pen });
    if (naCont(s, k, ci)) for (let f = T.fase; f < F.length; f++) {
      const jg = jogoDoClube(T, f, ci), [h, a] = jg || [ci, null];
      if (k === 'LIB' && F[f].k === 'po') continue;
      ev.push({ data: dataCont(dataRodada, s.ano, f, k), comp: `${rot} · ${F[f].curto}`, copa: true, h, a, futuro: !jg });
    }
  }
  for (const kr of s.reg?.ano === s.ano ? regsDe(s, ci) : []) {
    const TR = s.reg[kr], F = fasesReg(kr), rot = f => `${REGIONAIS[kr].curto}<br>${F[f].curto}`, quando = f => dataFaseReg(s.ano, kr, f);
    for (const j of TR.jogos.filter(x => x.h === ci || x.a === ci)) ev.push({ data: quando(j.fase), comp: rot(j.fase), copa: true, h: j.h, a: j.a, g: j.gols, pen: j.pen });
    if (vivoReg(TR, ci)) for (let f = TR.fase; f < F.length; f++) {
      const ok = F[f].e != null ? TR.etapas[F[f].e] : f === TR.fase || (F[f].perna === 'volta' && f === TR.fase + 1);
      const jg = ok ? jogosDaFaseReg({ ...TR, fase: f }).find(j => j.includes(ci)) : null, [h, a] = jg || [ci, null];
      if (jg || F[f].e == null) ev.push({ data: quando(f), comp: rot(f), copa: true, h, a, futuro: !jg });
    }
  }
  const sup = s.cont?.sup;
  if (sup && [sup.h, sup.a].includes(ci)) ev.push({ data: dataSupDe(H.app.base, s), comp: 'Supercopa', copa: true, h: sup.h, a: sup.a, g: sup.jogo?.gols, pen: sup.jogo?.pen });
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
      ${h.copa?.campeao != null ? `<li><span class="mudo">Copa do Brasil</span><span>${H.imgEscudo(h.copa.campeao, 16, 17)} <b>${nome(h.copa.campeao)}</b></span></li>` : ''}
      ${h.cont ? [['Libertadores', h.cont.LIB], ['Sul-Americana', h.cont.SUL], ['Supercopa', h.cont.sup]].filter(x => x[1] != null).map(([t, c]) => `<li><span class="mudo">${t}</span><span>${H.imgEscudo(c, 16, 17)} <b>${nome(c)}</b></span></li>`).join('') : ''}
      ${h.reg?.campeoes ? COPAS_REG.filter(k => h.reg.campeoes[k] != null).map(k => `<li><span class="mudo">${REGIONAIS[k].nome}</span><span>${H.imgEscudo(h.reg.campeoes[k], 16, 17)} <b>${nome(h.reg.campeoes[k])}</b></span></li>`).join('') : ''}</ul>
    ${[h.cont?.meu, ...(Array.isArray(h.reg?.meu) ? h.reg.meu : [])].filter(Boolean).map(t => `<p class="mudo" style="font-size:.95rem">${H.esc(t)}</p>`).join('')}
    ${h.reg?.campeoes ? `<p class="mudo" style="font-size:.9rem">Estaduais: ${ESTADUAIS.filter(k => h.reg.campeoes[k] != null).map(k => `${nome(h.reg.campeoes[k])} (${REGIONAIS[k].curto})`).join(', ')}.</p>` : ''}
    <p class="mudo" style="font-size:.95rem">Subiram para a A: ${h.sobem.A.map(nome).join(', ')}. Caíram para a B: ${h.caem.B.map(nome).join(', ')}.${h.caem.D ? ` Caíram para a D: ${h.caem.D.map(nome).join(', ')}; subiram da D: ${h.sobem.C.map(nome).join(', ')}.` : ''}</p>
    ${(s.galas || []).some(g => g.ano === h.ano) ? `<p><a href="#/gala">Premiação de gala de ${h.ano}</a></p>` : ''}</section>`).join('');
}

export function tela() {
  const s = H.app.s, aba = H.app.abaTorneios || 'brasileirao';
  const corpo = {
    brasileirao, copa, agenda, historico,
    continental,
    regionais,
  }[aba]();
  const d = H.clube(s.tecnico.clube).div, k = feitas(s, d);
  return `<div class="titulo-linha"><h2>Torneios</h2><span class="mudo">${s.ano} · ${k === 0 ? 'pré-temporada e regionais' : `Série ${d} · rodada ${Math.min(k + 1, N_LIGA[d])}/${N_LIGA[d]}`}</span></div>
    <nav class="abas-mercado" aria-label="Competições">${ABAS.map(([k, t]) => `<button type="button" class="chip" data-acao="aba-torneios" data-v="${k}" aria-pressed="${aba === k}">${t}</button>`).join('')}</nav>
    ${corpo}`;
}

export const acoes = {
  'aba-torneios': el => { H.app.abaTorneios = el.dataset.v; H.render(); },
  'div-tabela': el => { H.app.divTabela = el.dataset.v; H.render(); },
  'aba-cont': el => { H.app.abaCont = el.dataset.v; H.render(); },
  'aba-reg': el => { H.app.abaReg = el.dataset.v; H.render(); },
};
