// Liga online (até 8 técnicos num mundo só). Puro: roda no aparelho de quem estiver online na hora do jogo.
// - O mundo (W) é o save sem os campos de técnico; cada técnico tem a sua mesa (humanos.js).
// - Relógio: os compromissos dos técnicos acontecem em horários fixos (Normal: 3 por dia; Turbo: 12 por dia); o ADM
//   pode adiantar o próximo. Na hora, o mundo anda até a data do próximo jogo de algum técnico, com todos os jogos
//   simulados (cada técnico com a escalação, a tática e os planos que deixou), e o resultado é gravado para todos.
import { novoJogo, mundoAte, pendentes, TATICA_PADRAO, caixaInicial, aplicarSave } from './mundo.js';
import { separar, vista, MESA, mundoDe } from './humanos.js';
import { virarTemporada, fimDeTemporada } from './temporada.js';
import { garantirMercado } from './mercado.js';
import { garantirCarreira } from './carreira.js';
import { financasIniciais } from './financas.js';
import { cartasDeInicio } from './correio.js';

export const MAX_TECNICOS = 8;
// horários do dia (hora de Brasília, sem horário de verão)
export const RITMOS = {
  normal: { nome: 'Normal', horas: [12, 17, 21], txt: '3 jogos por dia (12h, 17h e 21h), cerca de um mês por temporada' },
  turbo: { nome: 'Turbo', horas: [8, 9 + 1 / 3, 10 + 2 / 3, 12, 13 + 1 / 3, 14 + 2 / 3, 16, 17 + 1 / 3, 18 + 2 / 3, 20, 21 + 1 / 3, 22 + 2 / 3], txt: '12 jogos por dia (das 8h às 22h40), cerca de uma semana por temporada' },
};
const BRT = -3 * 3600e3, DIA = 864e5;

// ---------- mundo e mesas ----------
// mundo novo da liga: um jogo novo sem técnico (tecnico.clube = -1)
export function novoMundo(base, seed) {
  const s = novoJogo(base, { tecnico: { nome: '', reputacao: 1 }, modo: 'escolher', clube: 0, seed });
  const { W } = separar(s);
  delete W._cal;
  W.tecnico = { clube: -1, nome: '' };
  W.noticias = [];
  W.slot = 0;
  return W;
}
// junta o mundo e as mesas (só em memória) e devolve o mundo pronto para o motor
export function montar(W, mesas) { Object.defineProperty(W, '_mesas', { value: mesas, enumerable: false, configurable: true, writable: true }); return W; }
export const vistaDe = (W, id) => W._mesas?.[id] ? vista(W, W._mesas[id]) : null;
export const donoDe = (W, ci) => Object.entries(W._mesas || {}).find(([, m]) => m.tecnico?.clube === ci)?.[0] ?? null;
export const clubeLivre = (base, W, ci) => ['A', 'B', 'C'].includes(base.clubes[ci]?.div) && donoDe(W, ci) == null;

// mesa de quem assume o clube ci: caixa do clube (o que a IA tinha), finanças, carreira, cartas de boas-vindas
export function novaMesa(base, W, ci, tecnico, dificuldade = 'normal') {
  if (!clubeLivre(base, W, ci)) return null;
  const T = TATICA_PADRAO(), mesa = { tecnico: { nome: tecnico.nome, rosto: tecnico.rosto, nat: tecnico.nat || 'BRA', reputacao: tecnico.reputacao ?? 1, clube: ci, modo: 'escolher' }, dificuldade, formacao: '4-3-3', xi: null, ultima: null };
  for (const k of Object.keys(T)) if (MESA.has(k)) mesa[k] = T[k];
  const v = vista(W, mesa);
  v.caixa = W.caixaIA?.[ci] ?? caixaInicial(base, ci, dificuldade);
  if (W.caixaIA) delete W.caixaIA[ci];
  v.fin = financasIniciais(base, v);
  garantirMercado(v); garantirCarreira(base, v);
  v.carreira = [{ clube: ci, ano: W.ano, rodada: W.rodada }];
  v.msgs = []; v.msgsVistas = [];
  cartasDeInicio(base, v, true);
  delete W.tecnicos?.[ci];
  W.noticias.unshift({ rodada: W.rodada, tipo: 'clube', clube: ci, div: base.clubes[ci].div, texto: `${tecnico.nome} é o novo técnico do ${base.clubes[ci].n}.` });
  return mesa;
}
// técnico sai da liga: o clube volta para a IA com o caixa que tinha
export function liberarMesa(base, W, id) {
  const m = W._mesas?.[id], ci = m?.tecnico?.clube;
  if (!m) return;
  delete W._mesas[id];
  if (!(ci >= 0)) return;
  (W.caixaIA ||= {})[ci] = m.caixa;
  W.noticias.unshift({ rodada: W.rodada, tipo: 'clube', clube: ci, div: base.clubes[ci].div, texto: `${m.tecnico.nome} deixa o ${base.clubes[ci].n}.` });
}

// ---------- o calendário andando ----------
// próximo compromisso de algum técnico (sem técnico: o próximo evento do mundo)
export function proximoCompromisso(base, W) { const L = pendentes(base, W); return L.find(e => e.meu) || L[0] || null; }
// processa um horário: o mundo anda até a data do próximo jogo de técnico (todos os jogos até ali); acabado o
// calendário, vira a temporada. Devolve o que aconteceu (para o aviso na tela).
export function processarProximo(base, W) {
  aplicarSave(base, W);
  W.slot = (W.slot || 0) + 1;
  if (fimDeTemporada(W)) { virarTemporada(base, W); return { virada: true, ano: W.ano }; }
  const ev = proximoCompromisso(base, W);
  if (!ev) { mundoAte(base, W, Infinity, true); return { fim: true }; }
  mundoAte(base, W, ev.data, true);
  return { data: +ev.data, titulo: ev.titulo };
}

// ---------- relógio ----------
// L = { ritmo, inicio (ms), desloc (ms adiantados pelo ADM), slot0 (horário do mundo quando o relógio começou) };
// horário k = (k - slot0)-ésimo da grade depois do início
export function horario(L, k) {
  const H = RITMOS[L.ritmo]?.horas || RITMOS.normal.horas, n = H.length;
  const dia0 = Math.floor((L.inicio + BRT) / DIA) * DIA - BRT, ponto = m => dia0 + Math.floor(m / n) * DIA + H[m % n] * 3600e3;
  let pulo = 0; while (ponto(pulo) < L.inicio + 10 * 60e3) pulo++;   // o primeiro jogo é pelo menos 10 min depois de começar
  return Math.round(ponto(pulo + k - (L.slot0 || 0)) - (L.desloc || 0));
}
export const proximoHorario = (L, W) => L?.inicio ? horario(L, W.slot || 0) : null;
export const devido = (L, W, agora = Date.now()) => !!L?.inicio && !L.pausa && proximoHorario(L, W) <= agora;
// ADM: o próximo jogo passa a ser agora (e os seguintes andam junto)
export function adiantar(L, W, agora = Date.now()) {
  const t = proximoHorario(L, W); if (t == null || t <= agora) return L;
  return { ...L, desloc: (L.desloc || 0) + (t - agora) };
}

// ---------- gravação ----------
// o que vai para o servidor: mundo sem o que é só da memória
export function mundoParaGravar(W) { const { _cal, ...resto } = mundoDe(W); return resto; }

// junta 3 versões (base, minha, deles): o que só um lado mexeu entra; dinheiro e contadores somam as duas mudanças;
// listas viram conjunto (o que eu tirei sai, o que eu pus entra); no resto, conflito fica com a minha
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const igual = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const chaveDe = v => v && typeof v === 'object' ? (v.id != null ? 'i' + v.id : JSON.stringify(v)) : JSON.stringify(v);
const SOMA = /^(caixa|torcida|caixaIA\.[^.]+|fin\.diretoria|fin\.temporada\.(compras|vendas))$/;
export function merge3(b, m, t, p = '') {
  if (igual(m, b)) return t;
  if (igual(t, b)) return m;
  if (typeof m === 'number' && typeof t === 'number' && typeof b === 'number' && SOMA.test(p)) return Math.round((m + t - b) * 100) / 100;
  if (isObj(m) && isObj(t)) {
    const bb = isObj(b) ? b : {}, out = {};
    for (const k of new Set([...Object.keys(m), ...Object.keys(t)])) {
      const inM = k in m, inT = k in t, inB = k in bb;
      if (!inM && inB) { if (inT && !igual(t[k], bb[k])) out[k] = t[k]; continue; }   // eu apaguei (eles não mexeram)
      if (!inT && inB) { if (inM && !igual(m[k], bb[k])) out[k] = m[k]; continue; }   // eles apagaram
      out[k] = !inM ? t[k] : !inT ? m[k] : merge3(bb[k], m[k], t[k], p ? `${p}.${k}` : k);
    }
    return out;
  }
  if (Array.isArray(m) && Array.isArray(t)) {
    const bArr = Array.isArray(b) ? b : [], bk = new Set(bArr.map(chaveDe)), mk = new Set(m.map(chaveDe));
    const tirei = new Set(bArr.filter(x => !mk.has(chaveDe(x))).map(chaveDe)), pus = m.filter(x => !bk.has(chaveDe(x)));
    let out = t.filter(x => !tirei.has(chaveDe(x)));
    const tk = new Set(out.map(chaveDe)), novos = pus.filter(x => !tk.has(chaveDe(x)));
    return m.length && novos.length && chaveDe(m[0]) === chaveDe(novos[0]) ? [...novos, ...out] : [...out, ...novos];
  }
  return m;
}
