// Caixa de mensagens: o diretor de futebol (e às vezes o presidente, o médico e o olheiro) escreve para o técnico
// depois de cada jogo: desfalques, pendurados, propostas com a opinião dele, quem quer sair, contratos, janela,
// dinheiro, cargo, fase dos jogadores, garotos que subiram de nível. Cada assunto sai uma vez só.
import { rng, pick, fmtDinheiro } from './util.js';
import { nomeTecnico, pilares } from './carreira.js';
import { proximoEvento, compProxima, janelaAberta, tabela } from './mundo.js';
import { indisponivel, pendurado, LESOES, COMP_DE } from './dm.js';
import { faseDe } from './forma.js';
import { orcamento, metaDiretoria } from './financas.js';
import { precoPedido } from './mercado.js';
import { fimDeTemporada } from './temporada.js';

export const REMETENTES = {
  diretor: { cargo: 'Diretor de futebol', semente: 'dir' },
  presidente: { cargo: 'Presidente', semente: 'pres' },
  medico: { cargo: 'Departamento médico', semente: 'med' },
  olheiro: { cargo: 'Chefe de observação', semente: 'olh' },
};
export const remetente = (s, k) => ({ ...REMETENTES[k], nome: nomeTecnico(rng(`${REMETENTES[k].semente}${s.seed}-${s.tecnico.clube}`)) });
export const naoLidas = s => (s.msgs || []).filter(m => !m.lida).length;

function enviar(s, de, chave, assunto, texto, extra = {}) {
  s.msgsVistas ||= [];
  if (s.msgsVistas.includes(chave)) return;
  s.msgsVistas = [...s.msgsVistas, chave].slice(-300);
  s.msgs = [{ id: `${s.ano}-${s.rodada}-${s.msgsVistas.length}`, de, ano: s.ano, rodada: s.rodada, assunto, texto, lida: false, ...extra }, ...(s.msgs || [])].slice(0, 60);
}
const lista = nomes => nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

// opinião do diretor sobre uma proposta recebida
function opiniao(base, s, j, x) {
  const el = base.elencos[s.tecnico.clube].slice().sort((a, b) => b.ovr - a.ovr), rank = el.indexOf(j), ref = precoPedido(base, s, j), r = x.valor / Math.max(1, ref);
  const papel = rank < 11 ? 'é titular' : rank < 18 ? 'é peça de rotação' : 'quase não joga';
  const conta = r >= 1.15 ? 'É dinheiro acima do que ele vale.' : r >= 0.95 ? 'O valor é justo.' : 'Está abaixo do que ele vale.';
  const conselho = r >= 1.15 && rank >= 11 ? 'Eu venderia sem pensar.' : r >= 1.15 ? 'Dá pra vender e repor com folga, mas a decisão é sua.' : r >= 0.95 && rank >= 18 ? 'Vale vender e aliviar a folha.' : rank < 5 ? 'Ele é dos nossos melhores. Eu seguraria.' : r < 0.95 ? 'Eu recusaria ou esperaria uma oferta melhor.' : 'Depende do que você planeja pra ele.';
  return `${j.curto} ${papel}. ${conta} ${conselho}${x.quer ? ` Aviso: ele já veio dizer que ${x.quer} e quer ir. Se segurar, vai ficar de cara feia.` : ''}`;
}

export function correio(base, s) {
  const ci = s.tecnico.clube, el = base.elencos[ci], ev = proximoEvento(base, s), nome = c => base.clubes[c].n, rd = s.rodada;
  if (s.demitido) return;
  const tag = ev ? `${ev.tipo}-${ev.rodada ?? ev.fase ?? 0}-${ev.h}-${ev.a}` : 'fim';
  // desfalques e pendurados do próximo jogo
  if (ev) {
    const comp = compProxima(base, s), adv = ev.h === ci ? ev.a : ev.h;
    const fora = el.filter(j => indisponivel(s, j.id, comp)).sort((a, b) => b.ovr - a.ovr);
    if (fora.length) enviar(s, 'diretor', `desf-${tag}`, `Desfalques contra o ${nome(adv)}`,
      `Professor, para o jogo contra o ${nome(adv)} não teremos ${lista(fora.map(j => `${j.curto} (${{ lesao: `lesão, ${s.dm[j.id]?.n} jogo${s.dm[j.id]?.n > 1 ? 's' : ''}`, suspenso: 'suspenso', afastado: `afastado pelo clube (${s.afast?.[j.id]?.motivo})` }[indisponivel(s, j.id, comp)]})`))}. Confira a escalação antes de entrar em campo.`, { link: '#/elenco' });
    const pend = el.filter(j => pendurado(s, j.id, comp) && !indisponivel(s, j.id, comp));
    if (pend.length) enviar(s, 'diretor', `pend-${tag}`, 'Pendurados', `${lista(pend.map(j => j.curto))} ${pend.length > 1 ? 'estão pendurados' : 'está pendurado'} ${COMP_DE[comp] || ''}. Mais um amarelo e ${pend.length > 1 ? 'ficam' : 'fica'} fora do jogo seguinte.`, { link: '#/dm' });
  }
  // lesões novas (o médico escreve)
  for (const j of el) { const l = s.dm?.[j.id]; if (l && l.n === l.tot) enviar(s, 'medico', `les-${j.id}-${l.tot}-${s.ano}-${s.lesH?.[j.id]?.[0] || 0}`, `Lesão de ${j.curto}`, `Exames confirmaram: ${(LESOES[l.k]?.n || 'lesão').toLowerCase()}. Previsão de ${l.n} jogo${l.n > 1 ? 's' : ''} fora.${LESOES[l.k]?.inf ? ' Na reta final dá pra pensar em infiltração.' : ''}`, { link: '#/dm', jogador: j.id }); }
  // propostas recebidas, com a opinião do diretor
  for (const x of s.recebidas || []) {
    const j = base.jog.get(x.jogador); if (!j) continue;
    enviar(s, 'diretor', `prop-${x.id}`, x.tipo === 'emprestimo' ? `Pedido de empréstimo: ${j.curto}` : `Proposta por ${j.curto}`,
      x.tipo === 'emprestimo' ? `O ${nome(x.de)} quer ${j.curto} emprestado até o fim da temporada. ${faseDe(s, j.id).d < 0 || el.indexOf(j) > 17 ? 'Pode ser bom pra ele ganhar ritmo.' : 'Ele é útil aqui. Eu não emprestaria agora.'}`
        : `Chegou proposta do ${nome(x.de)}: ${fmtDinheiro(x.valor)} por ${j.curto}. ${opiniao(base, s, j, x)} Ela vale por duas rodadas.`, { link: '#/mercado', aba: 'propostas', jogador: j.id });
  }
  // quem quer sair
  for (const [id, q] of Object.entries(s.querSair || {})) { const j = base.jog.get(+id); if (j) enviar(s, 'diretor', `sair-${id}-${q.rodada}`, `${j.curto} quer sair`, `${j.curto} esteve na minha sala. Ele ${q.motivo} e não engoliu a recusa da proposta do ${nome(q.de)}. Está desanimado e não quer falar de renovação. Se aparecer outra proposta, eu pensaria com carinho.`, { jogador: j.id }); }
  // pedidos de aumento
  for (const p of s.pedidosAumento || []) { const j = base.jog.get(p.jogador); if (j) enviar(s, 'diretor', `aum-${p.jogador}-${p.rodada}-${s.ano}`, `${j.curto} pede aumento`, `${j.curto} veio conversar: está em grande fase e quer passar a ganhar ${fmtDinheiro(p.valor)} por dia (hoje ganha bem menos). ${faseDe(s, j.id).k === 'excelente' ? 'Eu daria: ele está carregando o time.' : 'Dá pra negociar, mas cuidado com a folha.'} Ele espera resposta em até 3 rodadas.`, { aumento: p.jogador, jogador: j.id }); }
  // pré-contrato com outro clube
  for (const p of s.preContratos || []) if (p.de === ci && p.para !== ci) { const j = base.jog.get(p.jogador); if (j) enviar(s, 'diretor', `pre-${p.jogador}-${s.ano}`, `${j.curto} assinou com o ${nome(p.para)}`, `Perdemos ${j.curto}: o contrato acaba e ele já assinou pré-contrato com o ${nome(p.para)}. Sai de graça no fim da temporada.`, { jogador: j.id }); }
  // contratos acabando (no meio e na reta final)
  if (rd >= 19) { const ac = el.filter(j => j.contrato <= s.ano && !(s.preContratos || []).some(p => p.jogador === j.id) && !s.emprestimos?.[j.id]).sort((a, b) => b.ovr - a.ovr);
    if (ac.length) enviar(s, 'diretor', `contr-${s.ano}-${rd >= 30 ? 2 : 1}`, 'Contratos acabando', `Terminam no fim do ano: ${lista(ac.slice(0, 6).map(j => `${j.curto} (${j.ovr})`))}${ac.length > 6 ? ` e mais ${ac.length - 6}` : ''}. A partir da 25ª rodada outros clubes podem assinar pré-contrato. Quer renovar com quem?`, { link: '#/elenco' }); }
  // janela
  const jaAberta = janelaAberta(s.ano, rd), abreLogo = !jaAberta && janelaAberta(s.ano, rd + 1), fechaLogo = jaAberta && !janelaAberta(s.ano, rd + 1);
  if (abreLogo || fechaLogo) { const o = orcamento(base, s); enviar(s, 'diretor', `jan-${s.ano}-${rd}`, abreLogo ? 'A janela abre na próxima rodada' : 'Última rodada com a janela aberta', `${abreLogo ? 'A janela abre na próxima rodada.' : 'A janela fecha depois desta rodada.'} Temos ${fmtDinheiro(o.compras)} para compras e folga de ${fmtDinheiro(o.folga)} por dia na folha. ${o.pagaAteFim ? '' : 'Cuidado: do jeito que está, o caixa não fecha a temporada.'}`, { link: '#/mercado' }); }
  // dinheiro
  if (fimDeTemporada(s)) enviar(s, 'presidente', `gala-${s.ano}`, 'Premiação de gala', `Professor, hoje à noite é a premiação de gala do Brasileirão ${s.ano}. Bola de Ouro, Chuteira, Garçom, Luva, Revelação, Prancheta e a seleção da temporada. Vamos ver quem leva.`, { link: '#/gala' });
  if (s.fin?.atraso) enviar(s, 'presidente', `atraso-${s.ano}-${rd}`, 'Salários atrasados', `Não tivemos como pagar os salários em dia (${s.fin.atraso} rodada${s.fin.atraso > 1 ? 's' : ''}). O grupo está irritado. Precisamos vender ou cortar folha.`, { link: '#/financas' });
  // cargo (o presidente escreve)
  const C = s.cargo, P = pilares(base, s);
  if (C?.ult) enviar(s, 'presidente', `ult-${s.ano}-${C.ult.j0}${C.ult.segunda ? 'b' : ''}`, 'Ultimato', `Vou ser direto: a diretoria quer ${C.ult.need} pontos nos próximos 3 jogos do campeonato. Diretoria ${P.D}, torcida ${P.T}, grupo ${P.G}. Conto com você.`, { link: '#/carreira' });
  else if (C?.st === 'risco') enviar(s, 'presidente', `risco-${s.ano}-${Math.floor(rd / 6)}`, 'Preocupação', `O momento não é bom e a cobrança aumentou. Preciso de resultados nas próximas rodadas.`, { link: '#/carreira' });
  if (rd === 1) enviar(s, 'presidente', `meta-${s.ano}-${ci}`, `A meta para ${s.ano}`, `Boa sorte nesta temporada. A meta da diretoria é ${metaDiretoria(base, s).txt}. Dentro dela, você tem todo o meu apoio.`, { link: '#/carreira' });
  // fase dos jogadores
  for (const j of el) { const f = faseDe(s, j.id);
    if (f.k === 'excelente') enviar(s, 'diretor', `fase-${j.id}-${s.ano}-${Math.floor(rd / 8)}`, `${j.curto} está voando`, `${j.curto} vive fase excelente. Os olheiros dos grandes já estão de olho: prepare-se para propostas.`, { jogador: j.id });
    if (f.k === 'pessima') enviar(s, 'diretor', `fasep-${j.id}-${s.ano}-${Math.floor(rd / 8)}`, `${j.curto} em baixa`, `${j.curto} atravessa fase péssima. Talvez seja hora de dar um descanso e testar outro.`, { jogador: j.id, link: '#/elenco' });
  }
  // garotos que subiram de nível no treino
  for (const j of el) if ((s.evo?.[j.id] || 0) >= 1 && j.idade <= 21) enviar(s, 'diretor', `evo-${j.id}-${j.ovr}`, `${j.curto} evoluiu`, `O pessoal do treino está empolgado com ${j.curto}: já chegou a ${j.ovr} de overall. Merece minutos.`, { jogador: j.id });
  // propostas de emprego
  for (const o of s.ofertas || []) if (o.tipo === 'vaga') enviar(s, 'presidente', `emprego-${o.clube}-${o.ano}`, 'Sondagem de outro clube', `Fiquei sabendo que o ${nome(o.clube)} quer você. Espero que fique com a gente, mas a decisão é sua.`, { link: '#/clube' });
  // tabela: zona de rebaixamento ou acesso
  const d = base.clubes[ci].div, tab = tabela(base, s, d), pos = tab.findIndex(l => l.clube === ci) + 1;
  if (rd >= 10 && pos >= 17) enviar(s, 'presidente', `z4-${s.ano}-${Math.floor(rd / 5)}`, 'Zona de rebaixamento', `Estamos em ${pos}º. Cair seria um desastre para o clube. Precisamos sair daí já.`, { link: '#/torneios' });
  if (rd >= 25 && pos <= 4 && d !== 'A') enviar(s, 'presidente', `acesso-${s.ano}-${Math.floor(rd / 5)}`, 'O acesso está perto', `${pos}º lugar. A cidade inteira está sonhando com a Série ${d === 'B' ? 'A' : 'B'}. Vamos até o fim.`);
}
