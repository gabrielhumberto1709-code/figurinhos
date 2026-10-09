// Vida de técnico: três pilares (diretoria, torcida e grupo) sustentam o cargo; carência na chegada,
// ultimato de 3 jogos, segunda chance se o grupo fechar com você, demissão. Técnicos da IA caem por má fase
// e abrem vagas; quem vai bem recebe propostas. Trocar de clube leva o técnico, não o caixa.
import { rng, pick, clamp } from './util.js';
import { caixaInicial } from './mundo.js';
import { metaDiretoria, financasIniciais } from './financas.js';
import { cartasDeInicio } from './correio.js';

const DIVS = ['A', 'B', 'C'];
const PRIMEIROS = ['Renato', 'Marcelo', 'Paulo', 'Luiz', 'Roberto', 'Sérgio', 'Carlos', 'Márcio', 'Ricardo', 'Fábio', 'Eduardo', 'Jorge', 'Antônio', 'Cláudio', 'Gilson', 'Wagner', 'Adilson', 'Hélio', 'Marcos', 'Celso', 'Dário', 'Osvaldo', 'Nelson', 'Toninho', 'Vadão', 'Joel', 'Zé Carlos', 'Mário', 'Gustavo', 'Rui'];
const SOBRENOMES = ['Moreira', 'Barros', 'Teixeira', 'Rangel', 'Pacheco', 'Nogueira', 'Fontes', 'Bastos', 'Siqueira', 'Lacerda', 'Prates', 'Valente', 'Medeiros', 'Quintana', 'Arruda', 'Peixoto', 'Brandão', 'Coutinho', 'Furtado', 'Guedes', 'Leitão', 'Mattos', 'Rezende', 'Sampaio', 'Tavares'];
export const nomeTecnico = r => `${pick(r, PRIMEIROS)} ${pick(r, SOBRENOMES)}`;
const ULT_PONTOS = { 4: 6, 6: 6, 8: 5, 10: 5, 12: 5, 16: 4, 18: 4 };

export function garantirCarreira(base, s) {
  s.torcida ??= 55;
  s.tecnicos ||= {};
  s.ofertas ||= [];
  s.cargo ||= { st: 'ok', desde: s.rodada, anoDesde: s.ano, ano: s.ano, ults: [] };
  s.carreira ||= [{ clube: s.tecnico.clube, ano: s.anoInicial ?? s.ano, rodada: 0 }];
  return s;
}

// técnico de um clube da IA: nome fixo pela semente até alguém ser demitido
export const tecnicoDe = (s, ci) => s.tecnicos?.[ci]?.nome ?? nomeTecnico(rng(`tec${s.seed}-${ci}`));

// grupo = moral média dos 16 melhores; nota do cargo = 60% diretoria + 40% torcida (o grupo vale como trava)
export function pilares(base, s) {
  const el = base.elencos[s.tecnico.clube].slice().sort((a, b) => b.ovr - a.ovr).slice(0, 16);
  const D = Math.round(s.fin?.diretoria ?? 60), T = Math.round(s.torcida ?? 55);
  const G = el.length ? Math.round(el.reduce((t, j) => t + (s.mor?.[j.id] ?? 62), 0) / el.length) : 62;
  return { D, T, G, I: Math.round(D * 0.6 + T * 0.4) };
}

// a torcida reage a cada jogo oficial e volta devagar para o normal
export function torcidaAposJogo(s, ci, h, gols, { pen = null, mataMata = false, final = false, classico = false } = {}) {
  s.torcida ??= 55;
  const casa = h === ci, my = gols[casa ? 0 : 1], ot = gols[casa ? 1 : 0];
  let won = my > ot, lost = my < ot;
  if (pen && my === ot) { won = pen[casa ? 0 : 1] > pen[casa ? 1 : 0]; lost = !won; }
  let v = won ? 2.5 : lost ? -2.5 : casa ? -0.5 : 0.5;
  if (mataMata && lost) v -= 3;
  if (final && won) v += 5;
  if (Math.abs(my - ot) >= 3) v += won ? 2 : -2;
  if (classico) v *= 1.6;
  v += (55 - s.torcida) * 0.08;
  // clássico perdido: a torcida se revolta (mais ainda em goleada ou em sequência) e, às vezes, a diretoria também cobra
  if (classico) s.classicos = lost ? (s.classicos || 0) + 1 : 0;
  if (classico && lost) {
    const goleada = ot - my >= 3, seguidos = s.classicos >= 2;
    v -= 3 + (goleada ? 3 : 0) + (seguidos ? 2 : 0);
    const protesto = goleada || seguidos || s.torcida < 45, diretoria = goleada || (seguidos && s.torcida < 50);
    if (diretoria && s.fin) s.fin.diretoria = clamp((s.fin.diretoria ?? 60) - (goleada ? 6 : 4), 0, 100);
    s.revolta = { ano: s.ano, rodada: s.rodada, id: `${s.ano}-${s.rodada}-${h}-${gols.join('x')}`, placar: [my, ot], goleada, seguidos: s.classicos, protesto, diretoria, avisada: false };
  }
  s.torcida = clamp(Math.round((s.torcida + v) * 10) / 10, 0, 100);
}

// ---------- depois de cada rodada do campeonato ----------
export function aposRodada(base, s, tabs) {
  garantirCarreira(base, s);
  const N = [], ci = s.tecnico.clube;
  const add = (texto, extra = {}) => N.push({ tipo: 'clube', clube: ci, texto, ...extra });
  s.ofertas = s.ofertas.filter(o => o.tipo === 'demitido' || (o.ano === s.ano && o.ate > s.rodada));
  if (!s.demitido) cargo(base, s, tabs, add);
  demissoesIA(base, s, tabs, N);
  return N;
}

function cargo(base, s, tabs, add) {
  const ci = s.tecnico.clube, d = base.clubes[ci].div, tab = tabs[d], l = tab.find(x => x.clube === ci), pos = tab.indexOf(l) + 1, j = l.j;
  const meta = metaDiretoria(base, s), P = pilares(base, s), C = s.cargo, f = s.fin;
  if (C.ano !== s.ano) Object.assign(C, { ano: s.ano, ults: [], ult: null, st: 'ok' });
  if (f.atraso) s.torcida = Math.max(0, s.torcida - 1);
  if (P.T < 15) {
    f.diretoria = Math.max(0, f.diretoria - 1);
    if (!(C.protesto > s.rodada - 5)) { C.protesto = s.rodada; add(`Protesto no CT: torcedores cobram ${s.tecnico.nome} e a diretoria. A pressão chega ao presidente.`, { imprensa: true }); }
  }
  // ultimato em andamento: pontos nos 3 jogos seguintes do campeonato
  if (C.ult) {
    const U = C.ult, got = l.p - U.p0, jogados = j - U.j0;
    if (got >= U.need) {
      C.ult = null; C.st = 'ok'; f.diretoria = Math.min(100, f.diretoria + 8); s.torcida = Math.min(100, s.torcida + 5);
      add(`${s.tecnico.nome} cumpre o ultimato (${got} pontos em ${jogados} jogos) e segue no ${base.clubes[ci].n}. A diretoria renova a confiança.`);
    } else if (jogados >= 3) {
      if (P.G >= 70 && !U.segunda) { C.ult = { j0: j, p0: l.p, need: U.need, segunda: true }; add(`O grupo fecha com ${s.tecnico.nome}: os jogadores pedem mais uma chance. Novo prazo: ${U.need} pontos em 3 jogos.`, { imprensa: true }); }
      else demitir(base, s, `Ultimato não cumprido: ${got} de ${U.need} pontos.`, add);
    }
    return;
  }
  const corte = tab[meta.pos - 1], dentro = pos <= meta.pos, perto = !dentro && corte && corte.p - l.p <= 3;
  const carencia = C.anoDesde === s.ano && s.rodada - C.desde < 8;
  const turno = j <= 19 ? 1 : 2, antes = C.st;
  if (P.I >= 55 || carencia || j < 5 || dentro || perto) C.st = 'ok';
  else if (P.I >= 40 && P.G >= 20) C.st = 'risco';
  else if (!C.ults.includes(turno)) {
    const need = (ULT_PONTOS[meta.pos] || 5) + (P.I < 30 ? 1 : 0);
    C.ult = { j0: j, p0: l.p, need }; C.ults.push(turno); C.st = 'ult';
    add(`Ultimato: ${s.tecnico.nome} tem 3 jogos. ${P.G < 20 ? 'O técnico perdeu o vestiário. ' : ''}A diretoria exige ${need} pontos nos próximos 3 jogos do campeonato.`, { imprensa: true });
    return;
  } else C.st = 'risco';
  if (C.st === 'risco' && antes !== 'risco') add(`Cargo de ${s.tecnico.nome} balança: diretoria ${P.D}, torcida ${P.T}, grupo ${P.G}. Os resultados precisam aparecer.`, { imprensa: true });
}

// título de copa derruba o ultimato
export function tituloDeCopa(s) { if (s.cargo?.ult) { s.cargo.ult = null; s.cargo.st = 'ok'; s.fin.diretoria = Math.min(100, s.fin.diretoria + 8); } }

// ---------- demissão, pedido de demissão e propostas ----------
function demitir(base, s, motivo, add, pediu = false) {
  const ci = s.tecnico.clube, nome = base.clubes[ci].n, novo = nomeTecnico(rng(`int${s.seed}${s.ano}${s.rodada}${ci}`));
  s.tecnicos[ci] = { nome: novo, ano: s.ano, rodada: s.rodada };
  s.demitido = { de: ci, motivo, ano: s.ano, rodada: s.rodada, pediu };
  s.cargo.st = pediu ? 'saiu' : 'demitido'; s.cargo.ult = null;
  s.ofertas = ofertasPraQuemSai(base, s, ci).map(c => ({ clube: c, tipo: 'demitido', ano: s.ano }));
  add(pediu ? `${s.tecnico.nome} pede demissão e deixa o ${nome}. ${novo} assume.` : `${nome} demite ${s.tecnico.nome}. ${motivo} ${novo} assume o time.`, { imprensa: true });
}
// clube caiu para a Série D (fora do jogo): o técnico sai com propostas de quem fica nas séries
export function saidaPorQueda(base, s) {
  garantirCarreira(base, s);
  const N = [];
  demitir(base, s, 'O clube caiu para a Série D e a diretoria desfez a comissão técnica.', (texto, extra) => N.push({ tipo: 'clube', clube: s.tecnico.clube, texto, ...extra }));
  s.noticias.unshift(...N.map(n => ({ rodada: 0, div: 'C', ...n })));
}
export function pedirDemissao(base, s) {
  garantirCarreira(base, s);
  const N = [];
  demitir(base, s, 'Pediu para sair.', (texto, extra) => N.push({ tipo: 'clube', clube: s.tecnico.clube, texto, ...extra }), true);
  s.noticias.unshift(...N.map(n => ({ rodada: s.rodada, div: base.clubes[n.clube].div, ...n })));
}

// quem sai recebe propostas de clubes do mesmo tamanho ou menores, de preferência mal na tabela
function ofertasPraQuemSai(base, s, de) {
  const r = rng(`ofertas${s.seed}${s.ano}${s.rodada}${de}`), d = base.clubes[de].div, f = base.forca(de);
  const divs = d === 'A' ? ['A', 'B'] : d === 'B' ? ['B', 'C'] : ['C', 'B'];
  const lista = base.clubes.map((c, i) => i).filter(i => i !== de && divs.includes(base.clubes[i].div) && base.forca(i) <= f + (d === 'C' ? 2 : 0));
  const out = [];
  while (out.length < 3 && lista.length) out.push(lista.splice(Math.floor(r() * lista.length), 1)[0]);
  return out.length ? out : [base.clubes.findIndex(c => c.div === 'C' && c !== base.clubes[de])];
}

// técnicos da IA: 6 jogos ruins com o time na metade de baixo (ou bem abaixo do esperado) podem custar o cargo
function demissoesIA(base, s, tabs, N) {
  const ci = s.tecnico.clube, P = s.demitido ? null : pilares(base, s), meuTab = tabs[base.clubes[ci].div], minha = meuTab.findIndex(x => x.clube === ci) + 1;
  const vouBem = P && minha <= metaDiretoria(base, s).pos && !s.cargo.ult;
  for (const d of DIVS) {
    const tab = tabs[d], ordem = tab.map(x => x.clube).sort((a, b) => base.forca(b) - base.forca(a));
    const cand = [];
    tab.forEach((l, i) => {
      const c = l.clube, t = s.tecnicos[c], pos = i + 1;
      if (c === ci || l.j < 7 || (t && t.ano === s.ano && s.rodada - t.rodada < 10)) return;
      const v = l.ultimos.filter(x => x === 'V').length, p = l.ultimos.filter(x => x === 'D').length;
      if (v > 1 || p < 3 || (pos <= tab.length / 2 && pos < ordem.indexOf(c) + 5)) return;
      cand.push({ c, chance: Math.min(0.8, 0.19 + (v === 0 ? 0.17 : 0) + (p >= 4 ? 0.14 : 0) + (pos > tab.length - 4 ? 0.12 : 0)), peso: p * 3 - v * 2 + pos / 4 });
    });
    for (const { c, chance } of cand.sort((a, b) => b.peso - a.peso)) {
      if (rng(`demissao${s.seed}${s.ano}${s.rodada}${c}`)() >= chance) continue;
      const velho = tecnicoDe(s, c), novo = nomeTecnico(rng(`novo${s.seed}${s.ano}${s.rodada}${c}`));
      s.tecnicos[c] = { nome: novo, ano: s.ano, rodada: s.rodada };
      N.push({ tipo: 'tecnico', clube: c, evento: true, texto: `${base.clubes[c].n} demite ${velho} após má fase. ${novo} é o novo técnico.` });
      // vaga num clube maior: quem está bem no cargo pode ser chamado
      const ordemDiv = DIVS.indexOf(d) - DIVS.indexOf(base.clubes[ci].div);
      if (vouBem && ordemDiv <= 0 && base.forca(c) >= base.forca(ci) + 1.5 && !s.ofertas.some(o => o.clube === c) && rng(`oferta${s.seed}${s.ano}${s.rodada}${c}`)() < 0.6) {
        s.ofertas.push({ clube: c, tipo: 'vaga', ano: s.ano, ate: s.rodada + 3 });
        N.push({ tipo: 'clube', clube: c, texto: `Proposta: o ${base.clubes[c].n} (Série ${d}) quer ${s.tecnico.nome} para o lugar de ${velho}. A resposta vale até a ${s.rodada + 3}ª rodada.` });
      }
      break; // no máximo uma demissão por divisão a cada rodada
    }
  }
}

export function recusarOferta(s, c) { s.ofertas = s.ofertas.filter(o => o.clube !== c || o.tipo === 'demitido'); }

// assume outro clube: o técnico muda, o caixa e o orçamento passam a ser os do clube novo
export function aceitarOferta(base, s, novo) {
  garantirCarreira(base, s);
  if (!s.ofertas.some(o => o.clube === novo)) return 'Essa proposta não está mais de pé.';
  const velho = s.tecnico.clube, nomeVelho = base.clubes[velho].n, N = [];
  if (!s.demitido) { const subst = nomeTecnico(rng(`saida${s.seed}${s.ano}${s.rodada}${velho}`)); s.tecnicos[velho] = { nome: subst, ano: s.ano, rodada: s.rodada }; N.push(`${s.tecnico.nome} deixa o ${nomeVelho} e acerta com o ${base.clubes[novo].n}. ${subst} assume o ${nomeVelho}.`); }
  const ult = s.carreira[s.carreira.length - 1]; if (ult) Object.assign(ult, { ateAno: s.ano, ateRodada: s.rodada, saida: s.demitido ? (s.demitido.pediu ? 'pediu demissão' : 'demitido') : 'aceitou proposta' });
  s.carreira.push({ clube: novo, ano: s.ano, rodada: s.rodada });
  s.tecnico.clube = novo; delete s.tecnicos[novo];
  // o caixa fica com o clube: o antigo passa a ser da IA, o novo vem com o que a IA tinha (ou o inicial)
  (s.caixaIA ||= {})[velho] = s.caixa;
  s.caixa = s.caixaIA[novo] ?? caixaInicial(base, novo, s.dificuldade); delete s.caixaIA[novo];
  s.fin = financasIniciais(base, s);
  Object.assign(s, { xi: null, banco: null, capitao: null, vice: null, cobrador: null, escSalvas: [], listas: { venda: [], emprestimo: [] }, recebidas: [], torcida: 55, ofertas: [] });
  s.propostas = (s.propostas || []).filter(p => !['aguardando', 'contraproposta'].includes(p.estado));
  s.cargo = { st: 'ok', desde: s.rodada, anoDesde: s.ano, ano: s.ano, ults: [] };
  delete s.demitido;
  cartasDeInicio(base, s, true);
  N.push(`${s.tecnico.nome} é o novo técnico do ${base.clubes[novo].n}.`);
  s.noticias.unshift(...N.map(texto => ({ rodada: s.rodada, tipo: 'clube', clube: novo, div: base.clubes[novo].div, texto })));
}
