// Tela da coletiva pós-jogo: uma pergunta por vez, cada resposta mostra quem ela agrada e quem incomoda.
import { abrirColetiva, responder, efeito, TONS, PLATEIA, perfil, chaveDe } from './motor/imprensa.js';

let H; // { app, clube, esc, render, salvar }
export const configurar = h => { H = h; };
export const pendente = s => !!s.ultima && (s.coletiva?.chave !== chaveDe(s) || !s.coletiva.feita);

const setas = e => Object.entries(e).map(([p, v]) => `<span class="${v > 0 ? 'sobe' : 'desce'}">${PLATEIA[p]} ${v > 0 ? '▲' : '▼'}${Math.abs(v) >= 2 && v < 0 || v >= 4 ? (v > 0 ? '▲' : '▼') : ''}</span>`).join('') || '<span>Sem efeito</span>';

export function tela() {
  const { app, esc, clube } = H, s = app.s, C = abrirColetiva(app.base, s);
  const topo = '<div class="titulo-linha"><h2>Coletiva</h2><a href="#/clube">Voltar</a></div>';
  if (!C) return `${topo}<section class="cartao"><p class="mudo">A primeira coletiva é depois do seu primeiro jogo.</p></section>`;
  const u = s.ultima, i = C.perguntas.findIndex((_, k) => C.respostas[k] == null), P = C.perguntas[i], pf = perfil(s);
  const feitas = C.perguntas.map((q, k) => C.respostas[k] == null ? '' : `<li><p class="col-q"><b>${esc(q.reporter[0])}</b> · ${esc(q.reporter[1])}: ${esc(q.texto)}</p><p class="col-r">${esc(q.respostas.find(r => r.tom === C.respostas[k])?.texto || '')} <small>(${TONS[C.respostas[k]].rot})</small></p></li>`).join('');
  return `${topo}<section class="cartao col-topo"><p class="mudo">Coletiva pós-jogo · ${esc(u.copa || `${u.rodada + 1}ª rodada`)}</p>
      <h3>${esc(clube(u.casa).n)} ${u.gols[0]} × ${u.gols[1]} ${esc(clube(u.fora).n)}</h3>
      ${C.quente ? '<p class="tag crise">Coletiva quente: tudo vale em dobro</p>' : ''}</section>
    ${feitas ? `<section class="cartao"><ol class="col-log">${feitas}</ol></section>` : ''}
    ${P ? `<section class="cartao col-pergunta"><p class="mudo">Pergunta ${i + 1} de ${C.perguntas.length} · ${esc(P.reporter[0])}, ${esc(P.reporter[1])}</p><h3 class="col-txt">“${esc(P.texto)}”</h3>
      <div class="col-respostas">${P.respostas.map(r => `<button type="button" class="col-resp" data-acao="responder" data-i="${i}" data-tom="${r.tom}"><span class="col-tom">${TONS[r.tom].rot}</span><span class="col-frase">${esc(r.texto)}</span><span class="col-ef">${setas(efeito(s, r.tom))}</span></button>`).join('')}</div>
      <p class="mudo" style="font-size:.92rem">Grupo mexe na moral do elenco, torcida no humor da arquibancada, diretoria na confiança no seu trabalho. Falar três vezes seguidas para a mesma plateia rende metade.</p></section>`
    : `<section class="cartao"><h3>Coletiva encerrada</h3><p>As respostas já estão no Jornal da Bola. A próxima é depois do próximo jogo.</p><p><b>Seu perfil:</b> ${esc(pf.nome)}. <span class="mudo">${esc(pf.desc)}</span></p></section>`}`;
}

export const acoes = {
  responder: el => { if (responder(H.app.base, H.app.s, +el.dataset.i, el.dataset.tom)) { H.render(); H.salvar(); } },
};
