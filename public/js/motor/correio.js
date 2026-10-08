// Caixa de mensagens: o diretor de futebol (e às vezes o presidente, o médico e o olheiro) escreve para o técnico
// depois de cada jogo: desfalques, pendurados, propostas com a opinião dele, quem quer sair, contratos, janela,
// dinheiro, cargo, fase dos jogadores, garotos que subiram de nível. Cada assunto sai uma vez só.
import { rng, pick, fmtDinheiro, SETOR } from './util.js';
import { temperamento } from './vestiario.js';
import { nomeTecnico, pilares } from './carreira.js';
import { proximoEvento, compProxima, janelaAberta, tabela, barradoMedo, multaMedo } from './mundo.js';
import { indisponivel, pendurado, LESOES, COMP_DE } from './dm.js';
import { faseDe } from './forma.js';
import { orcamento, metaDiretoria, salarioDia } from './financas.js';
import { precoPedido, textoVontade, resumoCl } from './mercado.js';
import { fimDeTemporada } from './temporada.js';

export const REMETENTES = {
  diretor: { cargo: 'Diretor de futebol', semente: 'dir' },
  presidente: { cargo: 'Presidente', semente: 'pres' },
  medico: { cargo: 'Departamento médico', semente: 'med' },
  olheiro: { cargo: 'Chefe de observação', semente: 'olh' },
};
export const remetente = (s, k) => ({ ...REMETENTES[k], nome: nomeTecnico(rng(`${REMETENTES[k].semente}${s.seed}-${s.tecnico.clube}`)) });
export const naoLidas = s => (s.msgs || []).filter(m => !m.lida).length;

export function enviar(s, de, chave, assunto, texto, extra = {}) {
  s.msgsVistas ||= [];
  if (s.msgsVistas.includes(chave)) return;
  s.msgsVistas = [...s.msgsVistas, chave].slice(-300);
  s.msgs = [{ id: `${s.ano}-${s.rodada}-${s.msgsVistas.length}`, de, ano: s.ano, rodada: s.rodada, assunto, texto, lida: false, ...extra }, ...(s.msgs || [])].slice(0, 60);
}
const lista = nomes => nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

// opinião do diretor sobre uma proposta recebida
// proposta de gigante: o diretor conta a fase, o salário e a cabeça do jogador
function opiniaoGigante(base, s, j, x) {
  const f = faseDe(s, j.id), c = base.clubes[x.de], fm = v => fmtDinheiro(v);
  const fase = f.d > 0 ? `Ele vive ${f.nome.toLowerCase()} e isso inflou o valor: sem a fase, não pagariam isso.` : f.d < 0 ? `Ele está em ${f.nome.toLowerCase()}. É uma chance de vender bem antes que o valor caia.` : 'Ele está em fase normal; o valor é o de mercado de um craque.';
  const quer = `Conversei com o empresário: ${j.curto} ${textoVontade(x.vontade)}.`;
  const conselho = x.vontade < 35 ? 'Mesmo que você aceite, ele não vai.' : x.vontade >= 60 ? 'Se segurar, vai ficar de cara feia.' : 'Dá pra segurar sem crise.';
  return `O ${c.n} (${c.liga}) oferece ${fm(x.valor)} por ${j.curto} e quer pagar a ele ${fm(x.salario)} por dia, ${String(x.mult).replace('.', ',')}x o que ganha hoje (${fm(salarioDia(base, s, j))}). ${fase} ${quer} ${conselho}`;
}
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
    const fora = el.filter(j => indisponivel(s, j.id, comp) || barradoMedo(base, s, j.id, ci)).sort((a, b) => b.ovr - a.ovr);
    if (fora.length) enviar(s, 'diretor', `desf-${tag}`, `Desfalques contra o ${nome(adv)}`,
      `Professor, para o jogo contra o ${nome(adv)} não teremos ${lista(fora.map(j => `${j.curto} (${{ lesao: `lesão, ${s.dm[j.id]?.n} jogo${s.dm[j.id]?.n > 1 ? 's' : ''}`, suspenso: 'suspenso', afastado: `afastado pelo clube (${s.afast?.[j.id]?.motivo})`, selecao: 'convocado pela seleção', medo: `cláusula do medo; dá pra pagar a multa de ${fmtDinheiro(multaMedo(j))} e escalar` }[indisponivel(s, j.id, comp) || 'medo']})`))}. Confira a escalação antes de entrar em campo.`, { link: '#/elenco' });
    const pend = el.filter(j => pendurado(s, j.id, comp) && !indisponivel(s, j.id, comp));
    if (pend.length) enviar(s, 'diretor', `pend-${tag}`, 'Pendurados', `${lista(pend.map(j => j.curto))} ${pend.length > 1 ? 'estão pendurados' : 'está pendurado'} ${COMP_DE[comp] || ''}. Mais um amarelo e ${pend.length > 1 ? 'ficam' : 'fica'} fora do jogo seguinte.`, { link: '#/dm' });
  }
  // convocados para a data FIFA
  const cv = s.convocados, conv = cv?.ano === s.ano && s.rodada < cv.ate ? cv.ids.map(id => base.jog.get(id)).filter(j => j?.clube === ci) : [];
  if (conv.length) enviar(s, 'diretor', `fifa-${s.ano}-${cv.rodada}`, 'Data FIFA', `${lista(conv.map(j => j.curto))} ${conv.length > 1 ? 'foram convocados e ficam' : 'foi convocado e fica'} fora das próximas 2 rodadas. É vitrine para o clube, mas o time sente.`, { link: '#/elenco' });
  // lesões novas (o médico escreve)
  for (const j of el) { const l = s.dm?.[j.id]; if (l && l.n === l.tot) enviar(s, 'medico', `les-${j.id}-${l.tot}-${s.ano}-${s.lesH?.[j.id]?.[0] || 0}`, `Lesão de ${j.curto}`, `Exames confirmaram: ${(LESOES[l.k]?.n || 'lesão').toLowerCase()}. Previsão de ${l.n} jogo${l.n > 1 ? 's' : ''} fora.${LESOES[l.k]?.inf ? ' Na reta final dá pra pensar em infiltração.' : ''}`, { link: '#/dm', jogador: j.id }); }
  // propostas recebidas, com a opinião do diretor
  for (const x of s.recebidas || []) {
    const j = base.jog.get(x.jogador); if (!j) continue;
    enviar(s, 'diretor', `prop-${x.id}`, x.tipo === 'emprestimo' ? `Pedido de empréstimo: ${j.curto}` : x.gigante ? `Proposta milionária por ${j.curto}` : `Proposta por ${j.curto}`,
      x.tipo === 'emprestimo' ? `O ${nome(x.de)} quer ${j.curto} emprestado até o fim da temporada${x.cl && resumoCl(x.cl) ? ` (${resumoCl(x.cl)})` : ''}. ${faseDe(s, j.id).d < 0 || el.indexOf(j) > 17 ? 'Pode ser bom pra ele ganhar ritmo.' : 'Ele é útil aqui. Eu não emprestaria agora.'}`
        : x.gigante ? `${opiniaoGigante(base, s, j, x)} A proposta vale por duas rodadas.`
        : `Chegou proposta do ${nome(x.de)}: ${fmtDinheiro(x.valor)} por ${j.curto}. ${opiniao(base, s, j, x)} Ela vale por duas rodadas.`, { link: '#/mercado', aba: 'propostas', jogador: j.id });
  }
  // quem quer sair
  // os próprios jogadores escrevem: quer sair, quer aumento, quer jogar, quer empréstimo, sabe que está mal, pede reforço
  const primeira = m => m.replace(/^é /, 'era ').replace(/^sonha /, 'sonho ').replace(/^quer /, 'quero ').replace(/^está /, 'estou ').replace(/^não resiste /, 'não resisto ');
  const fala = (j, chave, tipoJ, assunto, texto, opcoes, extra = {}) => enviar(s, 'jogador', chave, assunto, texto, { autor: j.id, jogador: j.id, tipoJ, opcoes, ...extra });
  for (const [id, q] of Object.entries(s.querSair || {})) { const j = base.jog.get(+id); if (j?.clube === ci) fala(j, `sair-${id}-${q.rodada}`, 'sair', 'Quero ser negociado', `Professor, vou ser sincero: ${primeira(q.motivo)}. ${q.de !== ci ? `Não engoli a recusa da proposta do ${nome(q.de)}. ` : ''}Se aparecer outra proposta, me libera.`, [['vender', 'Colocar à venda'], ['segurar', 'Você fica']]); }
  for (const p of s.pedidosAumento || []) { const j = base.jog.get(p.jogador); if (j) fala(j, `aum-${p.jogador}-${p.rodada}-${s.ano}`, 'aumento', 'Pedido de aumento', `Professor, acho que mereço ganhar mais. Estou carregando o time e queria passar para ${fmtDinheiro(p.valor)} por dia (hoje ganho ${fmtDinheiro(salarioDia(base, s, j))}). Espero resposta em até 3 rodadas.`, null, { aumento: p.jogador }); }
  if (!s.demitido && ev) {
    const ord = el.slice().sort((a, b) => b.ovr - a.ovr), rank = j => ord.indexOf(j), comp = compProxima(base, s);
    const quer = el.filter(j => (s.semJogar?.[j.id] || 0) >= 3 && rank(j) < 22 && j.idade >= 19 && !indisponivel(s, j.id, comp) && (s.mor?.[j.id] ?? 62) < 66 && !s.promessas?.[j.id]).sort((a, b) => b.ovr - a.ovr)[0];
    if (quer) fala(quer, `pj-jogar-${quer.id}-${s.ano}-${Math.floor(rd / 6)}`, 'jogar', 'Quero uma chance', `Professor, estou treinando forte e não jogo há ${s.semJogar[quer.id]} jogos. Só peço uma oportunidade pra mostrar serviço.`, [['prometer', 'Prometer minutos'], ['paciencia', 'Pedir paciência']]);
    const emp = el.filter(j => j.idade <= 23 && (s.semJogar?.[j.id] || 0) >= 5 && rank(j) >= 14 && !s.listas?.emprestimo.includes(j.id) && !s.emprestimos?.[j.id]).sort((a, b) => b.pot - a.pot)[0];
    if (emp) fala(emp, `pj-emp-${emp.id}-${s.ano}-${Math.floor(rd / 10)}`, 'emprestimo', 'Posso ser emprestado?', `Professor, sei que a concorrência aqui é grande. Queria ser emprestado pra ganhar ritmo de jogo e voltar melhor.`, [['emprestar', 'Colocar para empréstimo'], ['fica', 'Você fica']]);
    for (const j of el) { const f = faseDe(s, j.id); if (f.d < 0 && temperamento(j) !== 'temperamental') fala(j, `pj-fase-${j.id}-${s.ano}-${Math.floor(rd / 8)}`, 'fase', 'Sei que não estou bem', `Professor, sei que não venho jogando bem (${f.nome.toLowerCase()}). Não precisa me poupar da cobrança: vou trabalhar dobrado pra voltar.`, [['apoiar', 'Apoiar'], ['cobrar', 'Cobrar']]); }
    // o capitão pede reforço no setor mais fraco, com a janela aberta e o time mal
    const derrotas = (tabela(base, s, base.clubes[ci].div).find(l => l.clube === ci)?.ultimos || []).slice(-3).filter(x => x === 'D').length;
    if (janelaAberta(s.ano, rd) && rd >= 3 && derrotas >= 2) {
      const cap = base.jog.get(s.capitao) || ord[0], setores = { DEF: 'a defesa', MEI: 'o meio-campo', ATA: 'o ataque' };
      const media = st => { const l = ord.filter(j => SETOR[j.pos] === st).slice(0, st === 'DEF' ? 4 : 3); return l.reduce((a, j) => a + j.ovr, 0) / Math.max(1, l.length); };
      const fraco = Object.keys(setores).sort((a, b) => media(a) - media(b))[0];
      if (cap) fala(cap, `pj-ref-${s.ano}-${Math.floor(rd / 8)}`, 'reforco', 'O grupo precisa de reforço', `Professor, falo como capitão: o grupo está dando o sangue, mas ${setores[fraco]} precisa de reforço. Com a janela aberta, dá pra buscar alguém?`, [['prometer', 'Vou buscar'], ['confio', 'Confio nesse grupo']], { setor: fraco });
    }
  }
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
  // diretor avisa quando diretoria, torcida ou elenco esfriam (queda de 8 desde o último aviso, ou ao cruzar 55 e 40)
  const av = (s.avisoPilar ||= {}), DICA = {
    D: ['A diretoria anda insatisfeita', 'Resultado, meta e contas pesam aqui. Pedir verba agora não é boa ideia.'],
    T: ['A torcida está perdendo a paciência', 'Derrota em casa, clássico perdido e coletiva atravessada pesam. Uma vitória convincente acalma.'],
    G: ['O elenco está com a moral em queda', 'Preleção, conversa individual, minutos para quem está encostado e salário em dia ajudam.'],
  };
  for (const k of ['D', 'T', 'G']) {
    const v = P[k], ult = av[k] ?? v;
    if (av[k] == null) { av[k] = v; continue; }
    if (v <= ult - 8 || (ult >= 55 && v < 55) || (ult >= 40 && v < 40)) { enviar(s, 'diretor', `pilar-${k}-${s.ano}-${rd}`, DICA[k][0], `${DICA[k][0]}: ${v} de 100 (era ${ult}). ${v < 40 ? 'Está perigoso, professor. ' : ''}${DICA[k][1]}`, { link: '#/carreira' }); av[k] = v; }
    else if (v > ult) av[k] = v;
  }
  if (rd === 1) enviar(s, 'presidente', `meta-${s.ano}-${ci}`, `A meta para ${s.ano}`, `Boa sorte nesta temporada. A meta da diretoria é ${metaDiretoria(base, s).txt}. Dentro dela, você tem todo o meu apoio.`, { link: '#/carreira' });
  // fase dos jogadores
  for (const j of el) { const f = faseDe(s, j.id);
    if (f.k === 'excelente') enviar(s, 'diretor', `fase-${j.id}-${s.ano}-${Math.floor(rd / 8)}`, `${j.curto} está voando`, `${j.curto} vive fase excelente. Os olheiros dos grandes já estão de olho: prepare-se para propostas.`, { jogador: j.id });
    if (f.k === 'pessima' && temperamento(j) === 'temperamental') enviar(s, 'diretor', `fasep-${j.id}-${s.ano}-${Math.floor(rd / 8)}`, `${j.curto} em baixa`, `${j.curto} atravessa fase péssima. Talvez seja hora de dar um descanso e testar outro.`, { jogador: j.id, link: '#/elenco' });
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
