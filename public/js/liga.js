// Liga online: criar/entrar, lobby (técnicos, clubes, relógio) e a sincronização com o servidor.
// O aparelho guarda o mundo e as mesas como vieram do servidor (srv, em texto) e grava só o que mudou; versão velha
// leva 409: baixa de novo, junta (merge3) e tenta outra vez. Na hora do jogo, quem estiver online processa o horário
// (o ADM primeiro, depois os outros pela ordem de entrada, com uns segundos de folga entre um e outro).
import { novoMundo, montar, vistaDe, clubeLivre, novaMesa, liberarMesa, processarProximo, proximoHorario, horario, amistososFaltando, devido, adiantar, mundoParaGravar, merge3, RITMOS, MAX_TECNICOS } from './motor/online.js';
import { aplicarSave, pendentes, proximoEvento } from './motor/mundo.js';
import { prePendente } from './motor/imprensa.js';
import { aceitarOferta as aceitarOfertaMotor } from './motor/carreira.js';
import { lancar } from './motor/financas.js';
import { fmtDinheiro } from './motor/util.js';
import { enviar as carta } from './motor/correio.js';

let H; // { app, api, compacta, descompacta, carregarBase, esc, clube, imgEscudo, estrelas, rostoAleatorio, aviso, render, ir, desenhaTopo, assistir }
export const configurar = h => { H = h; };
const Lg = () => H.app.liga;
export const _dbg = () => { const L = Lg(); return L && { slot: L.W?.slot, sujo: L.sujo, travado: L.travado, rodando: L.rodando, vigiando: L.vigiando, ver: L.ver, meta: L.meta, aba: H.app.aba, espera: H.app.esperaJogo }; }; // para depurar no console
const quadro = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const ATIVO = 10 * 60e3, FOLGA = 25e3;

// uma coisa de cada vez com o servidor (gravar, baixar, processar)
let fila = Promise.resolve();
const exclusivo = fn => { const p = fila.then(fn); fila = p.catch(() => { }); return p; };
const estado = x => { H.app.salvando = x; H.desenhaTopo(); };

// ---------- servidor ----------
// baixa tudo; sem descartar, o que mudou aqui e não subiu é juntado com o que veio
async function baixar(descartar = false) {
  const L = Lg(), r = await H.api('GET', `/ligas/${L.codigo}`);
  if (Lg() !== L) return;
  const W = await H.descompacta(r.mundo);
  const mesas = {}, srv = { w: JSON.stringify(W), m: {} };
  for (const m of r.mesas) if (m.dados) { mesas[m.id] = await H.descompacta(m.dados); srv.m[m.id] = JSON.stringify(mesas[m.id]); }
  Object.assign(L, { nome: r.nome, adminId: r.admin_id, eu: r.eu, meta: r.meta, ver: r.ver, vers: Object.fromEntries(r.mesas.map(m => [m.id, m.ver])), membros: r.mesas.map(({ dados, ...m }) => m) });
  adotar(L, W, mesas, srv, descartar);
}
// passa a usar a versão do servidor (W, mesas, srv = como elas estão gravadas); sem descartar, o que mudou aqui desde a
// última versão conhecida (L.srv) e ainda não subiu é juntado por cima (merge3)
function adotar(L, W, mesas, srv, descartar = false) {
  if (!descartar && L.W) {
    const meu = mundoParaGravar(L.W);
    if (JSON.stringify(meu) !== L.srv.w) W = merge3(JSON.parse(L.srv.w), meu, W);
    for (const id in mesas) { const mm = L.mesas[id], b = L.srv.m[id]; if (mm && b != null && JSON.stringify(mm) !== b) mesas[id] = merge3(JSON.parse(b), mm, mesas[id]); }
  }
  L.baixou = (L.baixou || 0) + 1;
  Object.assign(L, { W: montar(W, mesas), mesas, srv });
  aplicarSave(H.app.base, L.W);
  H.app.s = mesas[L.eu] ? vistaDe(L.W, L.eu) : null;
}
// grava W + mesas comparando com o que está no servidor (L.srv); devolve os textos gravados ou null (alguém gravou antes)
async function gravar(L, W, mesas, horario = false) {
  const w = JSON.stringify(mundoParaGravar(W)), corpo = { mesas: {}, ...(horario ? { horario: true } : {}) }, novos = {};
  for (const [id, m] of Object.entries(mesas)) {
    const t = JSON.stringify(m);
    if (t !== L.srv.m[id]) { novos[id] = t; corpo.mesas[id] = { ver: L.vers[id] ?? 0, dados: await H.compacta(t), clube: m.demitido ? null : m.tecnico?.clube ?? null }; }
  }
  const ids = Object.keys(novos), mudouW = w !== L.srv.w;
  if (!mudouW && !ids.length) return { w, novos };
  if (mudouW) corpo.mundo = await H.compacta(w);
  if (mudouW || ids.length > 1 || +ids[0] !== L.eu) corpo.ver = L.ver;
  try {
    const r = await H.api('POST', `/ligas/${L.codigo}/gravar`, corpo);
    if (r.ver) L.ver = r.ver;
    Object.assign(L.vers, r.mesas);
    return { w, novos };
  } catch (e) { if (e.status === 409) return null; throw e; }
}
// grava o que mudou aqui (false = alguém gravou antes)
async function enviar() {
  const L = Lg(), g = await gravar(L, L.W, L.mesas);
  if (!g) return false;
  L.srv.w = g.w; Object.assign(L.srv.m, g.novos);
  return true;
}
async function subir() {
  for (let k = 0; k < 4; k++) { if (await enviar()) return; await baixar(); }
  throw new Error('A liga está movimentada agora. Tente de novo.');
}

// save em fila (como o offline): várias mudanças seguidas viram um envio só
export function salvar() { const L = Lg(); if (!L?.W) return; L.sujo = true; clearTimeout(L.ts); L.ts = setTimeout(descarregar, 1500); }
export async function descarregar() {
  const L = Lg(); if (!L) return;
  clearTimeout(L.ts);
  if (!L.sujo) return fila;
  L.sujo = false; estado('salvando');
  const antes = marca();
  try { await exclusivo(subir); estado('salvo'); } catch { L.sujo = true; estado('falhou'); }
  notificar(antes);
}

// ---------- vigia: versões a cada poucos segundos; na hora do jogo, processa ----------
// o que veio de fora (download ou horário processado aqui): redesenha e avisa o resultado do seu jogo
function marca() { const L = Lg(), m = L?.mesas?.[L.eu]; return { b: L?.baixou, slot: L?.W?.slot, u: JSON.stringify(m?.ultima ?? null), ano: L?.W?.ano }; }
function notificar(antes) {
  const L = Lg(); if (!L) return;
  const agora = marca(); if (agora.b === antes.b && agora.slot === antes.slot && agora.u === antes.u) return;
  const E = H.app.esperaJogo;
  // a bola rolou: quem estava esperando (na espera ou ainda na coletiva pré-jogo) entra direto no jogo; quem saiu da
  // espera entra pelo retomar, como todo mundo (nunca com o placar no aviso)
  if (E && (L.W.slot || 0) > E.slot) {
    H.app.esperaJogo = null;
    if (H.app.aba === 'carregando' || (H.app.aba === 'coletiva' && H.app.colPre)) { H.app.colPre = false; return abrirJogo(); }
  }
  if (agora.u !== antes.u) { const r = retomar(); if (r) return; if (r === false) H.aviso('Seu jogo já rolou: ele abre assim que você sair desta tela.'); }
  else if (antes.ano && agora.ano !== antes.ano) H.aviso(`Começou a temporada ${agora.ano}.`);
  atualizarTela();
}
const FIXAS = new Set(['ao-vivo', 'leilao', 'coletiva', 'entrar', 'novo', 'carregando']);
function atualizarTela() {
  if (FIXAS.has(H.app.aba) || document.activeElement?.matches?.('input, select, textarea') || document.querySelector('dialog[open]')) return;
  H.render();
}
function minhaVez(agora = Date.now()) {
  const L = Lg();
  if (!L.W || L.sujo || L.travado === (L.W.slot || 0) || !devido(L.meta, L.W, agora)) return false;
  const ordem = L.membros.filter(m => m.id === L.eu || agora - m.visto < ATIVO).sort((a, b) => (b.id === L.adminId) - (a.id === L.adminId) || a.id - b.id);
  return agora >= proximoHorario(L.meta, L.W) + ordem.findIndex(m => m.id === L.eu) * FOLGA;
}
const intervalo = () => document.visibilityState === 'hidden' ? 60e3 : H.app.aba === 'chat' ? 3e3 : (proximoHorario(Lg().meta, Lg().W) ?? Infinity) - Date.now() < 45e3 ? 4e3 : 10e3;
async function vigiar() {
  const L = Lg(); if (!L || L.vigiando) return;
  L.vigiando = true; clearTimeout(L.tv);
  try {
    const v = await H.api('GET', `/ligas/${L.codigo}/v`);
    if (Lg() !== L) return;
    L.membros = v.mesas; L.meta = v.meta;
    if (v.chat > L.chatVisto) await puxarChat();
    const mudou = v.ver !== L.ver || v.mesas.length !== Object.keys(L.vers).length || v.mesas.some(m => L.vers[m.id] !== m.ver);
    // gravação que falhou (sem internet, servidor fora) é tentada de novo aqui, mesmo sem novidade no servidor: senão
    // o aparelho fica com mudanças presas e, sujo, nunca roda horário
    if ((mudou || L.sujo) && !L.rodando) {
      const antes = marca();
      if (L.sujo) await descarregar(); else await exclusivo(() => baixar());
      notificar(antes);
    }
    chamada(); retomar();
    if (minhaVez()) await processar();
    else if (H.app.aba === 'liga') atualizarTela();
    for (const el of document.querySelectorAll('[data-relogio]')) el.textContent = falta(+el.dataset.relogio);
  } catch (e) {
    if (Lg() === L && (e.status === 403 || e.status === 404)) { H.aviso(e.message); fechar(); H.ir('#/inicio'); return; }
  } finally { L.vigiando = false; }
  if (Lg() === L) L.tv = setTimeout(vigiar, intervalo());
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Lg()) vigiar(); });

// processa os horários vencidos (no máximo 6 por vez) numa CÓPIA do que está no servidor e grava mundo + mesas de uma
// vez. Assim o que o técnico fizer enquanto isso (contratar, escalar) fica intacto: dando certo, a cópia vira a versão
// do servidor e as mudanças dele são juntadas por cima; se outro aparelho gravou antes, a cópia é jogada fora e só.
async function processar() {
  const L = Lg(); if (L.rodando) return;
  L.rodando = true; estado('rodando');
  const antes = marca();
  try {
    await exclusivo(async () => {
      for (let k = 0; k < 3; k++) {
        await subir();
        if (!devido(L.meta, L.W)) return;
        const W = JSON.parse(L.srv.w), mesas = Object.fromEntries(Object.entries(L.srv.m).map(([id, t]) => [id, JSON.parse(t)]));
        montar(W, mesas); const s0 = W.slot || 0;
        // erro no meio: não insiste neste horário (o ADM pode voltar o último horário)
        try { for (let n = 0; n < 6 && devido(L.meta, W); n++) { await quadro(); processarProximo(H.app.base, W); } }
        catch (e) { aplicarSave(H.app.base, L.W); L.travado = s0; throw e; }
        const g = await gravar(L, W, mesas, true);
        if (g) { adotar(L, W, mesas, { w: g.w, m: { ...L.srv.m, ...g.novos } }); return; }
        aplicarSave(H.app.base, L.W);
        await baixar();
      }
    });
    L.rodando = false; estado('salvo');   // antes do estado(): ele redesenha o topo (senão fica "Rodando o horário…")
  } catch (e) { L.rodando = false; estado('falhou'); if (L.travado != null) H.aviso(`Não consegui rodar o horário da liga (${e.message}). O ADM pode voltar o último horário no lobby.`); }
  notificar(antes);
}

// ---------- abrir, criar, entrar, sair ----------
export async function abrir(codigo) {
  fechar();
  await H.carregarBase();
  H.app.liga = { codigo, mesas: {}, vers: {}, membros: [], chat: [], chatVisto: 0 };
  try { await exclusivo(() => baixar(true)); } catch (e) { fechar(); throw e; }
  H.app.salvando = '';
  vigiar();
}
export function fechar() {
  const L = Lg(); if (!L) return;
  clearTimeout(L.tv); clearTimeout(L.ts);
  H.app.liga = null; H.app.s = null;
}
export async function entrar(codigo) {
  await H.api('POST', `/ligas/${codigo}/entrar`);
  await abrir(codigo);
  H.ir('#/liga');
}
async function criar(nome, ritmo, publica, sorteio) {
  await H.carregarBase();
  const W = novoMundo(H.app.base, crypto.getRandomValues(new Uint32Array(1))[0] % 1e9);
  const { codigo } = await H.api('POST', '/ligas', { nome, meta: { ritmo, publica, sorteio }, mundo: await H.compacta(mundoParaGravar(W)) });
  await abrir(codigo);
  H.ir('#/liga');
}
// ação que precisa do estado mais novo (assumir clube, aceitar proposta, decisão do ADM): sobe o que estava pendente,
// baixa, aplica e grava; se alguém gravou no meio, desfaz e tenta de novo. fn devolve texto = não deu.
async function transacao(fn) {
  const L = Lg();
  return exclusivo(async () => {
    await subir(); L.sujo = false;
    for (let k = 0; k < 3; k++) {
      await baixar(true);
      const r = fn(L);
      if (typeof r === 'string') throw new Error(r);
      if (await enviar()) return r;
    }
    throw new Error('A liga está movimentada agora. Tente de novo.');
  });
}
// assumir um clube livre (técnico novo ou demitido sem proposta): leva o nome, o visual e a carreira. Com a série
// ('A', 'B' ou 'C') no lugar do clube, é o sorteio: um dos livres dela, conferido no mundo mais novo. Devolve o clube.
const assumir = alvo => transacao(L => {
  const velha = L.mesas[L.eu], eu = L.membros.find(m => m.id === L.eu), W = L.W, B = H.app.base;
  if (velha && !velha.demitido) return 'Você já tem clube.';
  const livres = typeof alvo === 'string' ? B.clubes.map((c, i) => i).filter(i => B.clubes[i].div === alvo && clubeLivre(B, W, i)) : [alvo];
  if (!livres.length) return `Nenhum clube sem técnico na Série ${alvo}.`;
  const ci = livres[Math.floor(Math.random() * livres.length)];
  const nova = novaMesa(H.app.base, W, ci, velha?.tecnico ? { ...velha.tecnico } : { nome: eu.apelido, rosto: H.rostoAleatorio(), nat: 'BRA' });
  if (!nova) return `O ${H.clube(ci).n} acabou de ser escolhido por outro técnico.`;
  if (velha) {
    const ult = velha.carreira?.at(-1); if (ult && ult.ateAno == null) Object.assign(ult, { ateAno: W.ano, ateRodada: W.rodada, saida: velha.demitido.pediu ? 'pediu demissão' : 'demitido' });
    nova.carreira = [...(velha.carreira || []), ...nova.carreira]; nova.historico = velha.historico;
  }
  L.mesas[L.eu] = nova; H.app.s = vistaDe(W, L.eu);
  return ci;
});
// aceitar proposta (demitido ou não): confere no mundo mais novo se o clube ainda não tem técnico
export const aceitarOferta = ci => transacao(() => aceitarOfertaMotor(H.app.base, H.app.s, ci) || null);

async function mudarMeta(f) {
  const L = Lg();
  await exclusivo(async () => {
    for (let k = 0; k < 3; k++) {
      const meta = f(L.meta, L.W);
      try { const r = await H.api('POST', `/ligas/${L.codigo}/gravar`, { ver: L.ver, meta }); L.ver = r.ver; L.meta = meta; return; }
      catch (e) { if (e.status !== 409) throw e; await baixar(); }
    }
  });
}
async function sairDaLiga() {
  const L = Lg();
  if (L.mesas[L.eu]) await transacao(() => { liberarMesa(H.app.base, L.W, L.eu); });
  await H.api('POST', `/ligas/${L.codigo}/sair`);
  fechar();
}

// ---------- relógio na tela ----------
function quando(t) {
  const d = new Date(t), mesmo = (a, b) => a.toDateString() === b.toDateString(), h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return mesmo(d, new Date()) ? `hoje às ${h}` : mesmo(d, new Date(Date.now() + 864e5)) ? `amanhã às ${h}` : `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} às ${h}`;
}
const falta = t => { const m = Math.ceil((t - Date.now()) / 60e3), sg = Math.ceil((t - Date.now()) / 1e3); return m <= 0 ? 'rolando agora' : sg < 60 ? `em ${sg} s` : m < 60 ? `em ${m} min` : `em ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };
// horário em que o jogo ev acontece: cada horário leva o mundo até a próxima data com jogo de algum técnico
function horarioDo(ev) {
  const L = Lg(), datas = [...new Set(pendentes(H.app.base, L.W).filter(e => e.meu).map(e => +e.data))].sort((a, b) => a - b), i = datas.indexOf(+ev.data);
  return ev.tipo === 'amistoso' ? null : i < 0 ? null : horario(L.meta, (L.W.slot || 0) + amistososFaltando(L.W) + i);
}
// linha do relógio (ingresso, fim de temporada, lobby): quando é, e o botão do ADM
export function relogio(rotulo, ev) {
  const L = Lg(), m = L.meta, adm = L.eu === L.adminId;
  if (!m.inicio) return `<p class="relogio-liga">A liga ainda não começou. ${adm ? 'Quando todos tiverem clube, comece pelo lobby.' : 'O ADM começa quando todos tiverem clube.'}</p><a class="botao" href="#/liga">Lobby da liga</a>`;
  if (m.pausa) return `<p class="relogio-liga">Liga pausada pelo ADM.</p>${adm ? '<button class="botao" type="button" data-acao="liga-retomar">Retomar a liga</button>' : ''}`;
  const t = (ev && horarioDo(ev)) ?? proximoHorario(m, L.W), agora = t <= Date.now();
  return `<p class="relogio-liga">${rotulo} <b>${quando(t)}</b> · <span data-relogio="${t}">${falta(t)}</span></p>
    ${adm && !agora ? '<button class="botao" type="button" data-acao="liga-agora">Jogar o próximo horário agora</button>' : ''}`;
}
export function estadoTopo() {
  const L = Lg(), t = L?.W && L.meta?.inicio && !L.meta.pausa ? proximoHorario(L.meta, L.W) : null;
  return H.app.salvando === 'falhou' ? 'Não salvou · tentar' : L?.rodando ? 'Rodando o horário…' : t ? `Liga · ${new Date(Math.max(t, Date.now())).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Liga';
}

// ---------- telas ----------
const online = m => m.id === Lg().eu || Date.now() - m.visto < ATIVO;
export function tela() {
  const L = Lg(), { esc, clube, imgEscudo } = H, adm = L.eu === L.adminId, minha = L.mesas[L.eu], m = L.meta;
  // clube de cada técnico pela mesa baixada (a lista de membros do servidor só atualiza na próxima consulta)
  const clubeDe = x => { const d = L.mesas[x.id]; return d ? (d.demitido ? null : d.tecnico?.clube ?? null) : x.clube; };
  const membros = L.membros.map(x => ({ ...x, clube: clubeDe(x) })).sort((a, b) => (b.id === L.adminId) - (a.id === L.adminId) || a.id - b.id);
  const dono = ci => membros.find(x => x.clube === ci);
  return `<div class="titulo-linha"><h2>${esc(L.nome)}</h2><button class="botao peq sec" type="button" data-acao="menu">Menu</button></div>
    <section class="cartao liga-cabeca">
      <p>Código do convite <b class="codigo-liga">${L.codigo}</b></p>
      <p class="mudo">${L.membros.length} de ${MAX_TECNICOS} técnicos · Ritmo ${RITMOS[m.ritmo].nome}: ${RITMOS[m.ritmo].txt}.</p>
      <p class="mudo">${m.publica ? 'Liga aberta: aparece em Encontrar uma liga.' : 'Liga fechada: só entra quem tem o código.'} ${m.sorteio ? 'Clube por sorteio: cada técnico escolhe só a série.' : 'Cada técnico escolhe o próprio clube.'}</p>
      <div class="linha-botoes"><button class="botao sec" type="button" data-acao="liga-convite">Convidar</button>${adm ? `<button class="botao sec" type="button" data-acao="liga-publica">${m.publica ? 'Fechar a liga' : 'Abrir a liga'}</button><button class="botao sec" type="button" data-acao="liga-sorteio">${m.sorteio ? 'Deixar escolher o clube' : 'Clube por sorteio'}</button>` : ''}</div></section>
    <a class="cartao chat-entrada" href="#/chat"><b>Chat da liga</b><span>${(n => n ? `${n} nova${n > 1 ? 's' : ''}` : 'Abrir')(chatNovas())}</span></a>
    <section class="cartao"><h3>Relógio</h3>
      ${m.inicio ? relogio('Próximo horário:') : `<p class="relogio-liga">A liga ainda não começou. ${adm ? 'Quando todos tiverem clube, comece: o primeiro horário é pelo menos 10 minutos depois.' : 'O ADM começa quando todos tiverem clube.'}</p>`}
      ${adm ? `<div class="linha-botoes">${!m.inicio ? '<button class="botao grande" type="button" data-acao="liga-comecar">Começar a liga</button>' : m.pausa ? '' : '<button class="botao sec" type="button" data-acao="liga-pausar">Pausar</button>'}</div>` : ''}
      <p class="mudo" style="font-size:.9rem">Na hora, os jogos são simulados com a escalação, a tática e os planos que cada técnico deixou, e o seu abre ao vivo, desde o começo, para quem estiver no app (quem chegar depois entra direto nele).</p></section>
    <section class="cartao"><h3>Técnicos</h3><ul class="tecnicos-liga">${membros.map(x => `<li>
      ${x.clube != null ? imgEscudo(x.clube, 28, 30) : '<span class="sem-clube" aria-hidden="true"></span>'}
      <span><b>${esc(x.apelido)}</b>${x.id === L.adminId ? ' <small class="tag-adm">ADM</small>' : ''}<br><small>${x.clube != null ? esc(clube(x.clube).n) : L.mesas[x.id]?.demitido ? 'sem clube (demitido)' : 'escolhendo clube'}${banDe(L, x.id) ? ` · transfer ban até a ${banDe(L, x.id) + 1}ª rodada` : ''}</small></span>
      <small class="${online(x) ? 'on' : ''}">${online(x) ? 'online' : ''}</small></li>`).join('')}</ul></section>
    ${!minha ? escolhaHtml(dono) : !minha.demitido ? `<a class="botao grande" href="#/clube">Ir para o ${esc(clube(minha.tecnico.clube).n)}</a>`
      : minha.ofertas?.length ? `<a class="botao grande" href="#/clube">Você está sem clube: ver propostas</a>` : `<p class="mudo">Você está sem clube e sem propostas: assuma um clube sem técnico.</p>${escolhaHtml(dono)}`}
    ${adm ? painelAdm(membros) : '<div class="linha-botoes" style="margin-top:16px"><button class="botao perigo" type="button" data-acao="liga-sair">Sair da liga</button></div>'}`;
}
function escolhaHtml(dono) {
  const L = Lg(), { esc, clube, imgEscudo } = H, d = L.div || 'A', regra = !!L.meta?.sorteio, sorteio = regra || L.modoEscolha === 'sorteio';
  const lista = H.app.base.clubes.map((c, i) => i).filter(i => clube(i).div === d).sort((a, b) => H.app.base.forca(b) - H.app.base.forca(a)), livres = lista.filter(ci => !dono(ci)).length;
  return `<section class="cartao"><h3>${sorteio ? 'Sortear o seu clube' : 'Escolha o seu clube'}</h3>
    ${regra ? '' : `<div class="chips" role="group" aria-label="Como escolher">${[['escolher', 'Escolher'], ['sorteio', 'Sorteio']].map(([k, t]) => `<button type="button" class="chip" data-acao="liga-modo" data-v="${k}" aria-pressed="${(L.modoEscolha || 'escolher') === k}">${t}</button>`).join('')}</div>`}
    <div class="chips" role="group" aria-label="Divisão">${['A', 'B', 'C'].map(x => `<button type="button" class="chip" data-acao="liga-div" data-div="${x}" aria-pressed="${d === x}">Série ${x}</button>`).join('')}</div>
    ${sorteio ? `<p class="mudo">${regra ? 'Nesta liga o clube é sorteado (regra do ADM). ' : ''}Você escolhe a série e o clube sai no sorteio, entre os ${livres} sem técnico. Não dá para sortear de novo: o clube é seu.</p>
    <p class="erro" role="alert"></p>
    <button class="botao grande" type="button" data-acao="liga-sortear" ${livres ? '' : 'disabled'}>Sortear um clube da Série ${d}</button></section>` : `
    <div class="clubes-lista">${lista.map(ci => { const x = dono(ci); return `<label class="opcao clube-op ${x ? 'ocupado' : ''}" ${x ? '' : `data-acao="liga-escolhe" data-c="${ci}"`}><input type="radio" name="liga-clube" ${L.escolha === ci ? 'checked' : ''} ${x ? 'disabled' : ''}>${imgEscudo(ci, 34, 37)}<span><strong style="font-size:1rem">${esc(clube(ci).n)}</strong><br>${x ? `<small>${esc(x.apelido)}</small>` : H.estrelas(ci)}</span></label>`; }).join('')}</div>
    <p class="erro" role="alert"></p>
    <button class="botao grande" type="button" data-acao="liga-assumir" ${L.escolha == null ? 'disabled' : ''}>${L.escolha == null ? 'Escolha um clube' : `Assumir o ${esc(clube(L.escolha).n)}`}</button></section>`}`;
}
// ---------- chamada do jogo ----------
// A menos de 1 min do horário em que o seu clube joga, quem está no app é chamado: coletiva pré-jogo (se tiver) e a
// tela de espera; quando o horário é simulado (neste aparelho ou em outro), o jogo abre no campinho.
const CHAMADA = 60e3;
function chamada() {
  const L = Lg(), s = H.app.s, t = proximoHorario(L.meta, L.W), slot = L.W.slot || 0;
  if (!s || s.demitido || t == null || L.meta.pausa || t - Date.now() > CHAMADA || L.chamado === slot || document.visibilityState !== 'visible') return;
  const ev = proximoEvento(H.app.base, s);
  if (!ev || !(amistososFaltando(L.W) ? ev.tipo === 'amistoso' : horarioDo(ev) === t)) return;      // seu clube não joga neste horário
  if (FIXAS.has(H.app.aba)) return;
  L.chamado = slot; abrirCaminho();
  H.app.esperaJogo = { slot, t, h: ev.h, a: ev.a, titulo: ev.titulo };
  if (ev.tipo !== 'amistoso' && prePendente(H.app.base, s)) { H.app.colPre = true; H.ir('#/coletiva'); } else H.ir('#/carregando');
}
function abrirJogo() {
  const s = H.app.s; H.app.esperaJogo = null;
  if (s?.ultimaVivo) transicao(H.assistir); else H.ir('#/partida');
}
// jogo que você ainda não viu (o horário rodou com o app fechado, você saiu da espera, estava no chat...): ele abre
// desde o começo, como ao vivo, em qualquer tela menos as que não dá para largar no meio (ao vivo, leilão, coletiva).
// Como no Treineiros, vale o estado (último jogo não visto), não o momento. O "já vi" fica neste aparelho; vale só o
// último jogo (é o que tem a ficha para assistir). Devolve true = abriu, false = vai abrir quando der, null = nada.
const chaveVisto = () => `fig.visto.${Lg().codigo}.${Lg().eu}`;
const chaveJogo = s => { const u = s?.ultima; return u ? `${s.ano}|${u.copa || u.div}|${u.rodada}|${u.casa}|${u.fora}|${u.gols}` : null; };
export function marcarVisto() { const k = chaveJogo(H.app.s); if (k) try { localStorage.setItem(chaveVisto(), k); } catch { } }
function retomar() {
  const L = Lg(), s = H.app.s, E = H.app.esperaJogo;
  if (E && (L.W.slot || 0) > E.slot) H.app.esperaJogo = null;   // espera vencida: o jogo dela já rolou
  if (!s?.ultimaVivo || s.demitido || L.rodando || document.getElementById('transicao')) return null;
  let visto = null; try { visto = localStorage.getItem(chaveVisto()); } catch { return null; }
  if (visto === chaveJogo(s)) return null;
  if (H.app.esperaJogo || document.visibilityState !== 'visible' || (FIXAS.has(H.app.aba) && H.app.aba !== 'carregando')) return false;
  abrirCaminho(); transicao(H.assistir);
  return true;
}
// hora do jogo: fecha a ficha aberta e larga o campo de texto (teclado do celular), como o Treineiros fecha a janela
function abrirCaminho() { document.querySelector('dialog[open]')?.close(); document.activeElement?.blur?.(); }
// fade: a cortina com os escudos entra, o jogo carrega por trás e começa quando ela sai
function transicao(fn) {
  const u = H.app.s?.ultima, el = document.createElement('div');
  marcarVisto(); el.id = 'transicao'; el.setAttribute('role', 'status');
  el.innerHTML = `${u ? `<div class="vs">${H.imgEscudo(u.casa, 64, 69)}<span>×</span>${H.imgEscudo(u.fora, 64, 69)}</div><p>${H.esc(u.copa || 'Brasileirão')}</p>` : ''}<div class="bola-gira" aria-hidden="true"></div><p class="entrando">Entrando em campo…</p>`;
  document.getElementById('transicao')?.remove(); document.body.appendChild(el);
  setTimeout(() => { fn(); el.classList.add('sai'); setTimeout(() => el.remove(), 600); }, 1200);
}
export function telaCarregando() {
  const L = Lg(), E = H.app.esperaJogo, { esc, imgEscudo, clube } = H;
  if (!E) return `<section class="cartao"><p class="mudo">Nenhum jogo para carregar agora.</p><a class="botao" href="#/clube">Voltar ao clube</a></section>`;
  if ((L.W.slot || 0) > E.slot) setTimeout(abrirJogo); // já foi simulado (enquanto você estava na coletiva)
  return `<section class="cartao escuro carregando-jogo"><p class="titulo-jogo">${esc(E.titulo)}</p>
      <div class="vs">${imgEscudo(E.h, 64, 69)}<span>×</span>${imgEscudo(E.a, 64, 69)}</div>
      <p class="nomes">${esc(clube(E.h).n)} × ${esc(clube(E.a).n)}</p>
      <div class="bola-gira" aria-hidden="true"></div>
      <p class="relogio-liga" role="status">Bola rola <b data-relogio="${E.t}">${falta(E.t)}</b></p>
      <p class="mudo">Os times estão no túnel. Quando o horário for simulado, o jogo abre aqui sozinho, para todo mundo da liga.</p>
      <a class="botao sec" href="#/clube">Voltar ao clube</a></section>`;
}

// ---------- chat da liga ----------
// o servidor guarda as últimas 200 mensagens; a consulta leve (/v) diz o id da última e só então as novas são baixadas
const chaveLido = () => `fig.chat.${Lg().codigo}`;
const lido = () => { try { return +localStorage.getItem(chaveLido()) || 0; } catch { return 0; } };
export const chatNovas = () => { const L = Lg(), l = lido(); return L ? L.chat.filter(m => m.id > l && m.de !== L.eu).length : 0; };
async function puxarChat() {
  const L = Lg(), primeira = !L.chatVisto, novas = await H.api('GET', `/ligas/${L.codigo}/chat?depois=${L.chatVisto}`);
  if (Lg() !== L || !novas.length) return;
  L.chat = [...L.chat, ...novas].slice(-200); L.chatVisto = novas.at(-1).id;
  if (H.app.aba === 'chat') return atualizarChat();
  const ult = novas.filter(m => m.de !== L.eu).at(-1);
  if (ult && !primeira) H.aviso(`${ult.apelido}: ${ult.texto.slice(0, 80)}`);
  H.desenhaTopo();
}
const itensChat = () => {
  const L = Lg(), { esc, imgEscudo } = H, hora = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const clubeDe = id => { const d = L.mesas[id]; return d && !d.demitido ? d.tecnico?.clube ?? null : null; };
  // lista invertida (column-reverse): a mais nova embaixo e a rolagem já começa no fim
  return L.chat.slice().reverse().map(m => { const ci = clubeDe(m.de); return `<li class="${m.de === L.eu ? 'meu' : ''}">${ci != null ? imgEscudo(ci, 22, 24) : '<span class="sem-clube" aria-hidden="true"></span>'}<div><small><b>${esc(m.apelido)}</b> · ${hora(m.criado)}</small><p>${esc(m.texto)}</p></div></li>`; }).join('')
    || '<li class="vazio mudo">Ninguém falou nada ainda. Comece a resenha.</li>';
};
const marcarLido = () => { try { localStorage.setItem(chaveLido(), Lg().chatVisto); } catch { } };
function atualizarChat() { const el = document.querySelector('.chat-lista'); if (el) el.innerHTML = itensChat(); marcarLido(); H.desenhaTopo(); }
export function telaChat() {
  const L = Lg(); marcarLido();
  return `<div class="titulo-linha"><h2>Chat</h2><a href="#/liga">${H.esc(L.nome)}</a></div>
    <section class="cartao chat"><ol class="chat-lista" aria-live="polite">${itensChat()}</ol>
      <form class="chat-form" data-form="liga-chat" novalidate><input type="text" name="texto" maxlength="300" autocomplete="off" enterkeyhint="send" placeholder="Mensagem para a liga" aria-label="Mensagem para a liga"><button class="botao" type="submit">Enviar</button></form>
      <p class="erro" role="alert"></p></section>`;
}
async function enviarChat(f) {
  const L = Lg(), t = f.texto.value.trim(), erro = f.parentNode.querySelector('.erro');
  if (!t) return;
  f.texto.value = ''; erro.textContent = '';
  try { await H.api('POST', `/ligas/${L.codigo}/chat`, { texto: t }); await puxarChat(); }
  catch (e) { erro.textContent = e.message; f.texto.value = t; }
  f.texto.focus();
}

// ---------- ADM: multa, dinheiro, transfer ban, expulsar, passar o posto, voltar horário, excluir ----------
const banDe = (L, id) => { const b = L.mesas[id]?.banAdm; return b && b.ano === L.W.ano && L.W.rodada < b.ate ? b.ate : 0; };
const OPS = [['multa', 'Multar'], ['dinheiro', 'Dar dinheiro'], ['ban', 'Transfer ban'], ['expulsar', 'Expulsar'], ['passar', 'Passar ADM']];
function painelAdm(membros) {
  const L = Lg(), { esc } = H, A = (L.adm ||= { op: 'multa' }), alvo = membros.find(x => x.id === A.alvo), nome = alvo ? esc(alvo.apelido) : '';
  const comClube = alvo && L.mesas[alvo.id] && !L.mesas[alvo.id].demitido;
  const form = !alvo ? '<p class="mudo">Escolha um técnico.</p>'
    : A.op === 'multa' || A.op === 'dinheiro' ? (comClube ? `<form data-form="liga-adm" class="adm-form" novalidate>
        <label>Valor (€ milhões) <input type="number" name="valor" min="0.1" max="500" step="0.1" inputmode="decimal" required></label>
        <label>Motivo <input type="text" name="motivo" maxlength="80" required placeholder="${A.op === 'multa' ? 'Ex.: atraso de salário combinado na liga' : 'Ex.: prêmio da rodada'}"></label>
        <p class="erro" role="alert"></p><button class="botao ${A.op === 'multa' ? 'perigo' : ''}">${A.op === 'multa' ? `Multar ${nome}` : `Dar dinheiro a ${nome}`}</button></form>` : `<p class="mudo">${nome} está sem clube.</p>`)
    : A.op === 'ban' ? (comClube ? `<form data-form="liga-adm" class="adm-form" novalidate>
        <div class="chips" role="group" aria-label="Duração">${[[5, '5 rodadas'], [10, '10 rodadas'], [38, 'Até o fim da temporada'], [0, 'Tirar o ban']].map(([n, t]) => `<label class="chip"><input type="radio" name="rodadas" value="${n}" ${n === 5 ? 'checked' : ''}> ${t}</label>`).join('')}</div>
        <label>Motivo <input type="text" name="motivo" maxlength="80" placeholder="Ex.: dívida com outro técnico"></label>
        <p class="erro" role="alert"></p><button class="botao perigo">Aplicar a ${nome}</button></form>` : `<p class="mudo">${nome} está sem clube.</p>`)
    : alvo.id === L.eu ? '<p class="mudo">Escolha outro técnico.</p>'
    : A.op === 'expulsar' ? `<p>${nome} sai da liga e o clube volta para a IA, com o caixa.</p><button class="botao perigo" type="button" data-acao="adm-expulsar">Expulsar ${nome}</button>`
    : `<p>${nome} vira o ADM e você continua na liga como técnico.</p><button class="botao" type="button" data-acao="adm-passar">Passar o ADM para ${nome}</button>`;
  return `<section class="cartao painel-adm"><h3>Painel do ADM</h3>
    <p class="mudo">Vale na hora, o técnico recebe uma carta e a liga fica sabendo pelo jornal.</p>
    <div class="chips" role="group" aria-label="Técnico">${membros.map(x => `<button type="button" class="chip" data-acao="adm-alvo" data-id="${x.id}" aria-pressed="${A.alvo === x.id}">${esc(x.apelido)}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="O que fazer">${OPS.map(([k, t]) => `<button type="button" class="chip" data-acao="adm-op" data-op="${k}" aria-pressed="${A.op === k}">${t}</button>`).join('')}</div>
    ${form}
    <div class="linha-botoes adm-liga"><button class="botao sec" type="button" data-acao="adm-restaurar">Voltar o último horário</button><button class="botao perigo" type="button" data-acao="adm-excluir">Excluir a liga</button></div></section>`;
}
// decisão do ADM numa mesa: carta para o técnico e nota no jornal
function avisoAdm(L, v, assunto, texto, noticia) {
  carta(v, 'diretor', `adm-${Date.now()}`, assunto, texto, { link: '#/financas' });
  const ci = v.tecnico.clube;
  L.W.noticias.unshift({ rodada: L.W.rodada, tipo: 'destaque', clube: ci, div: H.app.base.clubes[ci].div, texto: noticia });
}
const vistaAlvo = (L, id) => L.mesas[id] && !L.mesas[id].demitido ? vistaDe(L.W, id) : null;
const admDinheiro = (id, valor, motivo) => transacao(L => {
  const v = vistaAlvo(L, id); if (!v) return 'Esse técnico está sem clube.';
  const multa = valor < 0, n = H.clube(v.tecnico.clube).n, txt = fmtDinheiro(Math.abs(valor));
  lancar(v, 'adm', `${multa ? 'Multa' : 'Prêmio'} do ADM da liga: ${motivo}`, valor);
  avisoAdm(L, v, multa ? 'Multa do ADM da liga' : 'Dinheiro do ADM da liga', `O ADM da liga ${multa ? 'tirou' : 'colocou'} ${txt} ${multa ? 'do' : 'no'} caixa do clube. Motivo: ${motivo}.`,
    `ADM da liga ${multa ? `multa o ${n} em ${txt}` : `dá ${txt} ao ${n}`}: ${motivo}.`);
});
const admBan = (id, rodadas, motivo) => transacao(L => {
  const v = vistaAlvo(L, id); if (!v) return 'Esse técnico está sem clube.';
  const n = H.clube(v.tecnico.clube).n;
  if (!rodadas) { if (!v.banAdm) return 'Esse técnico não tem transfer ban.'; delete v.banAdm; avisoAdm(L, v, 'Transfer ban retirado', 'O ADM da liga retirou o transfer ban. O clube pode registrar jogadores de novo.', `ADM da liga retira o transfer ban do ${n}.`); return; }
  const ate = Math.min(38, L.W.rodada + rodadas);
  v.banAdm = { ano: L.W.ano, ate, motivo };
  for (const p of v.propostas || []) if (['aguardando', 'contraproposta'].includes(p.estado)) p.estado = 'cancelada';
  const ateTxt = ate >= 38 ? 'até o fim da temporada' : `até a ${ate + 1}ª rodada`;
  avisoAdm(L, v, 'Transfer ban do ADM da liga', `O ADM da liga proibiu o clube de registrar jogadores ${ateTxt}${motivo ? `. Motivo: ${motivo}` : ''}. Propostas em andamento foram canceladas. Vender continua liberado.`,
    `ADM da liga aplica transfer ban ao ${n} ${ateTxt}${motivo ? `: ${motivo}` : ''}.`);
});

// menu inicial: minhas ligas, criar e entrar com código
export function minhasLigas(ligas) {
  const { esc, clube, imgEscudo } = H;
  if (ligas == null) return '<p class="erro">Não consegui ver as suas ligas agora.</p>';
  if (!ligas.length) return '';
  return `<section class="cartao minhas-ligas"><h3>Minhas ligas</h3><ul>${ligas.map(l => `<li><button type="button" class="minha-liga" data-acao="liga-abrir" data-c="${l.codigo}">
    ${l.clube != null ? imgEscudo(l.clube, 30, 32) : '<span class="sem-clube" aria-hidden="true"></span>'}
    <span><b>${esc(l.nome)}</b><small>${RITMOS[l.meta.ritmo]?.nome || ''} · código ${l.codigo}${l.adm ? ' · ADM' : ''} · ${l.clube != null ? esc(clube(l.clube).n) : 'sem clube'}</small></span>
    <span class="seta" aria-hidden="true">›</span></button></li>`).join('')}</ul></section>`;
}
export const formsLiga = () => `<details class="dobra"><summary class="botao sec">Criar nova liga</summary><form class="cartao" data-form="liga-criar" novalidate>
    <label>Nome da liga <input type="text" name="nome" maxlength="30" required placeholder="Ex.: Liga da firma"></label>
    <div class="opcoes">${Object.entries(RITMOS).map(([k, r], i) => `<label class="opcao"><input type="radio" name="ritmo" value="${k}" ${i ? '' : 'checked'}><strong>${r.nome}</strong><small>${r.txt}.</small></label>`).join('')}</div>
    <div class="opcoes">${[['escolher', 'Cada um escolhe o clube', 'O técnico escolhe entre os clubes sem técnico.'], ['sorteio', 'Clube por sorteio', 'O técnico escolhe só a série; o clube sai no sorteio.']].map(([k, t, d], i) => `<label class="opcao"><input type="radio" name="clubes" value="${k}" ${i ? '' : 'checked'}><strong>${t}</strong><small>${d}</small></label>`).join('')}</div>
    <label class="check"><input type="checkbox" name="publica" checked> Liga aberta: aparece em Encontrar uma liga para quem quiser entrar</label>
    <p class="erro" role="alert"></p><button class="botao">Criar liga</button></form></details>
  <details class="dobra"><summary class="botao sec">Entrar com código</summary><form class="cartao" data-form="liga-entrar" novalidate>
    <label>Código do convite <input type="text" name="codigo" maxlength="8" autocapitalize="characters" autocomplete="off" required placeholder="Ex.: Y5RGPZ"></label>
    <p class="erro" role="alert"></p><button class="botao">Entrar na liga</button></form></details>`;
// Encontrar uma liga: abertas e com vaga
export async function telaAbertas() {
  const { esc } = H, L = await H.api('GET', '/ligas/abertas');
  return `<div class="titulo-linha"><h2>Encontrar uma liga</h2><a href="#/inicio">Voltar</a></div>
    ${L.length ? `<ul class="ligas-abertas">${L.map(l => `<li class="cartao"><div><b>${esc(l.nome)}</b><small>${RITMOS[l.meta.ritmo]?.nome || ''}${l.meta.sorteio ? ' · clube por sorteio' : ''} · ${l.n} de ${MAX_TECNICOS} técnicos · ADM ${esc(l.adm || '?')} · ${l.meta.inicio ? 'em andamento' : 'ainda não começou'}</small></div>
      <button class="botao" type="button" data-acao="liga-entrar-aberta" data-c="${l.codigo}">Entrar</button></li>`).join('')}</ul>`
    : `<section class="cartao vazio"><p>Nenhuma liga aberta com vaga agora.</p><p class="mudo">Crie a sua e chame os amigos pelo código.</p><a class="botao" href="#/inicio">Criar uma liga</a></section>`}`;
}
export async function enviarForm(f) {
  if (f.dataset.form === 'liga-chat') return enviarChat(f);
  const erro = f.querySelector('.erro'), bt = f.querySelector('button');
  bt.disabled = true; erro.textContent = '';
  try {
    if (f.dataset.form === 'liga-adm') {
      const A = Lg().adm, motivo = f.motivo.value.trim();
      if (A.op === 'ban') await admBan(A.alvo, +f.rodadas.value, motivo);
      else {
        const v = Math.round(parseFloat(String(f.valor.value).replace(',', '.')) * 1e6);
        if (!(v > 0)) throw new Error('Diga o valor em milhões de euros.');
        if (!motivo) throw new Error('Diga o motivo.');
        await admDinheiro(A.alvo, A.op === 'multa' ? -v : v, motivo);
      }
      H.aviso('Feito. O técnico recebeu a carta.'); H.render(); return;
    }
    if (f.dataset.form === 'liga-criar') {
      const nome = f.nome.value.trim();
      if (!nome) throw new Error('Dê um nome para a liga.');
      bt.textContent = 'Criando o mundo…'; await quadro();
      await criar(nome, f.ritmo.value, f.publica.checked, f.clubes.value === 'sorteio');
    } else {
      const c = f.codigo.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(c)) throw new Error('O código tem 6 letras e números.');
      await entrar(c);
    }
  } catch (e) { erro.textContent = e.message; bt.disabled = false; if (f.dataset.form !== 'liga-adm') bt.textContent = f.dataset.form === 'liga-criar' ? 'Criar liga' : 'Entrar na liga'; }
}

// botão perigoso: o primeiro toque pede confirmação
const confirma = (el, txt, fn) => { if (el.dataset.confirma !== '1') { el.dataset.confirma = '1'; el.textContent = txt; return; } return tenta(fn)(el); };
const tenta = fn => async el => { if (el) el.disabled = true; try { await fn(el); } catch (e) { H.aviso(e.message); } if (el?.isConnected) el.disabled = false; };
export const acoes = {
  'liga-abrir': tenta(async el => { await abrir(el.dataset.c); H.ir(H.app.s ? '#/clube' : '#/liga'); }),
  'liga-div': el => { Lg().div = el.dataset.div; H.render(); },
  'liga-escolhe': el => { Lg().escolha = +el.dataset.c; H.render(); },
  'liga-modo': el => { Lg().modoEscolha = el.dataset.v; H.render(); },
  'liga-sortear': tenta(async () => { const ci = await assumir(Lg().div || 'A'); H.aviso(`Sorteio: você vai treinar o ${H.clube(ci).n}!`); H.ir('#/clube'); }),
  'liga-assumir': tenta(async () => { if (Lg().meta?.sorteio) throw new Error('Nesta liga o clube é sorteado.'); const ci = Lg().escolha; await assumir(ci); Lg().escolha = null; H.aviso(`Você vai treinar o ${H.clube(ci).n}!`); H.ir('#/clube'); }),
  'liga-convite': async () => {
    const url = `${location.origin}${location.pathname}#/liga/${Lg().codigo}`, txt = `Entra na minha liga do Figurinhos: ${Lg().nome}`;
    try { if (navigator.share) return await navigator.share({ title: 'Figurinhos', text: txt, url }); } catch { return; }
    try { await navigator.clipboard.writeText(`${txt} ${url}`); H.aviso('Link do convite copiado.'); } catch { H.aviso(`Código: ${Lg().codigo}`); }
  },
  'liga-comecar': tenta(async () => { await mudarMeta((m, W) => ({ ...m, inicio: Date.now(), desloc: 0, pausa: false, slot0: W.slot || 0 })); H.render(); }),
  'liga-retomar': tenta(async () => { await mudarMeta((m, W) => ({ ...m, inicio: Date.now(), desloc: 0, pausa: false, slot0: W.slot || 0 })); H.render(); }),
  'liga-entrar-aberta': tenta(el => entrar(el.dataset.c)),
  'liga-publica': tenta(async () => { await mudarMeta(m => ({ ...m, publica: !m.publica })); H.render(); }),
  'liga-sorteio': tenta(async () => { await mudarMeta(m => ({ ...m, sorteio: !m.sorteio })); H.render(); }),
  'liga-pausar': tenta(async () => { await mudarMeta(m => ({ ...m, pausa: true })); H.render(); }),
  'liga-agora': tenta(async () => { await mudarMeta((m, W) => adiantar(m, W, Date.now() + CHAMADA)); H.aviso('O próximo horário começa em 1 minuto: o jogo abre para todos que estão no app.'); vigiar(); }),
  'adm-alvo': el => { Lg().adm.alvo = +el.dataset.id; H.render(); },
  'adm-op': el => { Lg().adm.op = el.dataset.op; H.render(); },
  'adm-expulsar': el => confirma(el, 'Expulsar mesmo? Toque de novo', async () => {
    const L = Lg(), id = L.adm.alvo;
    await transacao(L2 => { liberarMesa(H.app.base, L2.W, id); });
    await H.api('POST', `/ligas/${L.codigo}/expulsar`, { id });
    L.adm.alvo = null; await exclusivo(() => baixar(true)); H.aviso('Técnico expulso. O clube voltou para a IA.'); H.render();
  }),
  'adm-passar': el => confirma(el, 'Passar mesmo? Toque de novo', async () => {
    const L = Lg(); await H.api('POST', `/ligas/${L.codigo}/adm`, { id: L.adm.alvo });
    await exclusivo(() => baixar(true)); H.aviso('Agora o ADM é outro técnico.'); H.render();
  }),
  'adm-restaurar': el => confirma(el, 'Voltar mesmo? Toque de novo', async () => {
    const L = Lg(); await H.api('POST', `/ligas/${L.codigo}/restaurar`);
    L.travado = null; await exclusivo(() => baixar(true)); H.aviso('A liga voltou para antes da última gravação.'); H.render();
  }),
  'adm-excluir': el => confirma(el, 'Excluir mesmo? Não tem volta', async () => {
    const L = Lg(); await H.api('POST', `/ligas/${L.codigo}/excluir`);
    fechar(); H.aviso('Liga excluída.'); H.ir('#/inicio');
  }),
  'aceitar-oferta-liga': tenta(async el => { const ci = +el.dataset.c; await aceitarOferta(ci); H.aviso(`Bem-vindo ao ${H.clube(ci).n}!`); H.ir('#/clube'); }),
  'liga-sair': async el => {
    if (el.dataset.confirma !== '1') { el.dataset.confirma = '1'; el.textContent = 'Sair mesmo? Seu clube volta para a IA'; return; }
    await tenta(async () => { await sairDaLiga(); H.ir('#/inicio'); })(el);
  },
};
