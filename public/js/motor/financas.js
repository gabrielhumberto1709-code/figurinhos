// Finanças do seu clube: salários por dia, bilheteria, TV, patrocínio, prêmios, extrato, diretoria e socorro.
import { clamp, rng } from './util.js';
import { rivais } from './rivais.js';
import { dataRodada, tabela } from './mundo.js';
import { liberar } from './mercado.js';
import { dataAmistoso } from './calendario.js';
import { FASES } from './copa.js';

const DIA = 864e5;
const PISO = { A: 150000, B: 40000, C: 15000 };                 // salário anual mínimo por divisão
export const PRECOS = { barato: 0.65, normal: 1, caro: 1.4, abusivo: 2 };
export const NOME_PRECO = { barato: 'Barato', normal: 'Normal', caro: 'Caro', abusivo: 'Abusivo' };
const MARCAS = ['ApostaBet', 'Banco Cordial', 'Pix&Vai', 'Supermercados Boa Praça', 'TeleGol', 'Cimentos Rocha Firme', 'Café Arretado', 'Seguros Tá Tranquilo', 'Auto Peças Turbinão', 'Farmácia Saúde Já'];

// salário por dia: ~30% do valor de mercado por ano, com piso da divisão (ou o que foi acertado no contrato)
export const salarioBase = (div, valorK) => Math.round(Math.max(PISO[div] || PISO.C, valorK * 1000 * 0.3) / 365);
export function salarioDia(base, s, j) {
  return s.salarios?.[j.id] || salarioBase(base.clubes[j.clube].div, j.valor);
}
export const folhaDia = (base, s, ci = s.tecnico.clube) => base.elencos[ci].reduce((t, j) => t + salarioDia(base, s, j), 0);

// receitas de temporada do clube
export function cotaTV(c) { return c.div === 'A' ? 1e6 + c.fan * 2.3e6 : c.div === 'B' ? 8e5 + c.fan * 3.5e5 : 2.5e5 + c.fan * 6e4; }
export function patrocinio(c, ci) { return { marca: MARCAS[ci % MARCAS.length], valor: c.div === 'A' ? 8e5 + c.fan * 2.5e5 : c.div === 'B' ? 1.5e5 + c.fan * 5e4 : 5e4 + c.fan * 1e4 }; }
const PARCELAS_TV = [0, 9, 19, 29];
export function premioLiga(div, pos) {
  if (div === 'A') return pos <= 16 ? Math.round((8e6 - (pos - 1) * 4e5)) : 1e6;
  if (div === 'B') return Math.max(2e5, 1.5e6 - (pos - 1) * 7e4);
  return Math.max(8e4, 6e5 - (pos - 1) * 2.5e4);
}

// bilheteria de um jogo em casa: lotação depende da torcida, da fase, do adversário e do preço
export function bilheteria(base, s, ci, adv, ultimos = [], pos = 10, nivel = 'normal') {
  const c = base.clubes[ci], a = base.clubes[adv], fan = Math.min(10, c.fan || 3);
  const cap = c.est?.[1] || 8000 + fan * 5000;
  const occBase = 0.3 + fan * 0.055;
  const v = ultimos.filter(x => x === 'V').length, d = ultimos.filter(x => x === 'D').length;
  const fase = Math.max(0.4, 1 + 0.05 * v - 0.06 * d + (pos <= 4 ? 0.08 : pos >= 17 ? -0.06 : 0));
  const imp = (a.fan >= 8 ? 1.12 : 1) * (rivais(base, ci, adv) ? 1.25 : a.div === c.div && a.fan >= 7 && c.fan >= 7 ? 1.1 : 1);
  const pm = PRECOS[nivel] || 1, elast = clamp(1.25 - (imp - 1) * 0.9 - fan * 0.03, 0.35, 1.3);
  const occ = clamp(occBase * fase * imp * pm ** -elast, 0.08, 1);
  const publico = Math.round(cap * occ), preco = Math.round((8 + fan * 1.5) * pm * 100) / 100;
  return { publico, cap, occ, preco, renda: Math.round(publico * preco) };
}

export function financasIniciais(base, s) {
  const ci = s.tecnico.clube, c = base.clubes[ci];
  return { extrato: [], temporada: { ano: s.ano, compras: 0, vendas: 0, folha0: folhaDia(base, s) }, diretoria: 60, ultimaVerba: -99, verbasRecentes: [], tvPagas: [], ingresso: 'normal', salarioBudget: null, atraso: 0, socorro: 0, patrocinador: patrocinio(c, ci).marca };
}
export const garantirFinancas = (base, s) => (s.fin = s.fin || financasIniciais(base, s));

// lança no extrato e mexe no caixa
export function lancar(s, tipo, desc, valor, rodada = s.rodada) {
  s.caixa = Math.round(s.caixa + valor);
  s.fin.extrato.unshift({ r: rodada, a: s.ano, tipo, desc, valor: Math.round(valor) });
  if (s.fin.extrato.length > 400) s.fin.extrato.length = 400;
}

const diasEntre = (s, a, b) => Math.max(0, Math.round((dataRodada(s.ano, Math.min(b, 37)) - dataRodada(s.ano, Math.min(a, 37))) / DIA));
// salários da pré-temporada e dos regionais ainda não pagos (eles saem toda semana até a 1ª rodada)
const diasPre = s => Math.max(0, Math.round((dataRodada(s.ano, 0) - (s.semanaBloco?.ano === s.ano ? s.semanaBloco.t : +dataAmistoso(s.ano, 0))) / DIA));
export function diasRestantes(s) { return Math.max(5, diasEntre(s, s.rodada, 37) + 3 + (s.rodada === 0 ? diasPre(s) : 0)); }
export const cotaRestante = (base, s) => { const c = base.clubes[s.tecnico.clube]; return PARCELAS_TV.filter(r => !s.fin.tvPagas.includes(r) && r >= s.rodada).length * cotaTV(c) / 4; };

// receita que ainda vai entrar até o fim da temporada (TV, patrocínio e bilheteria estimada, com 10% de margem)
export function receitaPrevista(base, s) {
  const ci = s.tecnico.clube, c = base.clubes[ci], resta = Math.max(0, 38 - s.rodada);
  const casa = Math.round(resta / 2), b = bilheteria(base, s, ci, ci, [], 10, s.fin?.ingresso || 'normal');
  return cotaRestante(base, s) + patrocinio(c, ci).valor / 38 * resta + 0.9 * b.renda * casa;
}

// orçamento: quanto do caixa fica para salários até o fim da temporada e quanto sobra para compras
export function orcamento(base, s) {
  garantirFinancas(base, s);
  const folha = folhaDia(base, s), dias = diasRestantes(s), cota = receitaPrevista(base, s);
  const maxSal = Math.max(folha, Math.floor((s.caixa + cota) / dias));
  const sal = clamp(s.fin.salarioBudget ?? Math.round(folha * 1.1), folha, Math.max(folha, maxSal));
  const reserva = sal * dias - cota;
  const compras = Math.max(0, Math.min(s.caixa, Math.round(s.caixa - reserva)));
  const diasDeSalario = folha ? Math.floor((s.caixa + cota) / folha) : 999;
  return { folha, salarios: sal, maxSal, folga: Math.max(0, sal - folha), compras, dias, cota, diasDeSalario, pagaAteFim: diasDeSalario >= dias, fim: Math.round(s.caixa + cota - folha * dias) };
}

// regra da ANRESF: só tem socorro quem não comprou mais do que vendeu nem inchou a folha em mais de 10%
export function socorro(base, s) {
  const t = s.fin.temporada, folha = folhaDia(base, s);
  if (t.compras > t.vendas) return { ok: false, motivo: `o clube comprou ${fmt(t.compras)} e vendeu ${fmt(t.vendas)} na temporada` };
  if (t.folha0 && folha > t.folha0 * 1.1) return { ok: false, motivo: `a folha subiu ${Math.round((folha / t.folha0 - 1) * 100)}% desde o começo da temporada` };
  return { ok: true };
}
const fmt = v => v >= 1e6 ? `€ ${(v / 1e6).toFixed(1).replace('.', ',')} mi` : `€ ${Math.round(v / 1000)} mil`;

// meta da diretoria pelo tamanho do elenco na divisão
export function metaDiretoria(base, s) {
  const ci = s.tecnico.clube, div = base.clubes[ci].div;
  const ordem = base.clubes.map((c, i) => i).filter(i => base.clubes[i].div === div).sort((a, b) => base.forca(b) - base.forca(a));
  const rank = ordem.indexOf(ci) + 1;
  if (div === 'A') return rank <= 3 ? { pos: 4, txt: 'brigar pelo título (top 4)' } : rank <= 6 ? { pos: 6, txt: 'vaga na Libertadores (top 6)' } : rank <= 12 ? { pos: 12, txt: 'vaga na Sul-Americana (top 12)' } : { pos: 16, txt: 'não cair (16º ou melhor)' };
  // 2026: a B sobe 2 direto + 2 no playoff (3º ao 6º) e cai 4; a C leva 8 ao quadrangular, sobe 4 e cai só 2
  if (div === 'B') return rank <= 6 ? { pos: 4, txt: 'subir para a Série A (G2 direto ou vencendo o playoff)' } : rank <= 14 ? { pos: 10, txt: 'campanha segura (até 10º)' } : { pos: 16, txt: 'não cair (16º ou melhor)' };
  return rank <= 6 ? { pos: 4, txt: 'subir para a Série B (acesso no quadrangular)' } : rank <= 14 ? { pos: 8, txt: 'chegar ao quadrangular (top 8)' } : { pos: 18, txt: 'não cair para a Série D (18º ou melhor)' };
}

// ---------- teto salarial da diretoria ----------
// Salário máximo por jogador em contrato novo (compra, livre, pré-contrato, empréstimo, renovação e aumento), no
// offline e no online. Base pela divisão e pelo tamanho da torcida; quem acabou de subir ganha bem menos aporte
// (um recém-promovido à A fica perto de € 2,5 mil/dia). Sobe com Libertadores ou Sul-Americana, com a campanha na
// Copa do Brasil, com título regional e com a confiança da diretoria. Quem já ganha acima continua, mas não renova acima.
const TETO_DIV = { A: 6000, B: 1800, C: 700 };
// quem subiu para 2026 (Série B 2025 → A; Série C 2025 → B), para a primeira temporada
const SUBIU_2026 = ['Coritiba', 'Athletico-PR', 'Chapecoense', 'Remo', 'Ponte Preta', 'Londrina', 'São Bernardo', 'Náutico'];
export function recemPromovido(base, s, ci = s.tecnico.clube) {
  const h = s.historico?.[0];
  if (h?.ano === s.ano - 1) return [...(h.sobem?.A || []), ...(h.sobem?.B || []), ...(h.sobem?.C || [])].includes(ci);
  return s.ano === (s.anoInicial ?? s.ano) && s.ano === 2026 && SUBIU_2026.includes(base.clubes[ci].n);
}
export function tetoSalarial(base, s) {
  const ci = s.tecnico.clube, c = base.clubes[ci], partes = [];
  let v = (TETO_DIV[c.div] || 500) * (0.5 + (c.fan || 3) / 8);
  const pct = (txt, p) => { partes.push([txt, p]); v *= 1 + p / 100; };
  if (recemPromovido(base, s, ci)) pct('recém-promovido: aporte menor', c.div === 'A' ? -55 : -40);
  const cont = k => s.cont?.ano === s.ano && (s.cont[k]?.grupos.some(g => g.includes(ci)) || s.cont[k]?.vindos?.includes(ci));
  if (cont('LIB')) pct('na Libertadores', 35); else if (cont('SUL')) pct('na Sul-Americana', 15);
  const fase = s.copa?.ano === s.ano ? Math.max(-1, ...s.copa.jogos.filter(j => j.h === ci || j.a === ci).map(j => j.fase), ...(s.copa.chaves.some(x => x.includes(ci)) ? [s.copa.fase] : [])) : -1;
  const k = fase >= 0 ? FASES[fase].k : null, copa = { oit: 5, qua: 10, sem: 15, fin: 20 }[k];
  if (copa) pct(`Copa do Brasil (${{ oit: 'oitavas', qua: 'quartas', sem: 'semifinal', fin: 'final' }[k]})`, copa);
  const titulos = s.reg?.ano === s.ano ? Object.values(s.reg).filter(T => T?.campeao === ci).length : 0;
  if (titulos) pct(`título regional`, Math.min(10, 5 * titulos));
  const dir = s.fin?.diretoria ?? 60;
  if (dir >= 80) pct('diretoria confiante', 10); else if (dir < 30) pct('diretoria desconfiada', -10);
  if (s.dificuldade === 'facil') pct('dificuldade fácil', 20); else if (s.dificuldade === 'dificil') pct('dificuldade difícil', -15);
  return { teto: Math.max(100, Math.round(v / 50) * 50), partes };
}
const tetoTxt = t => `€ ${t.toLocaleString('pt-BR')}/dia`;
// salário de contrato novo acima do teto (quem já está no elenco pode renovar com até 15% sobre o que ganha hoje)
export function passaDoTeto(base, s, salario, atual = 0) {
  const { teto } = tetoSalarial(base, s), lim = Math.max(teto, Math.round(atual * 1.15));
  return salario > lim ? `A diretoria não aprova: o teto salarial do clube é ${tetoTxt(teto)} por jogador${lim > teto ? ` (para quem já está no elenco, até ${tetoTxt(lim)})` : ''}.` : null;
}

// pedir verba: depende da confiança, da campanha e de quanto dinheiro já entrou
export function pedirVerba(base, s, pos) {
  garantirFinancas(base, s);
  const f = s.fin, rd = s.rodada;
  if (rd - f.ultimaVerba < 2) return { ok: false, txt: 'A diretoria pediu para esperar pelo menos duas rodadas entre um pedido e outro.' };
  f.ultimaVerba = rd;
  const meta = metaDiretoria(base, s).pos, ci = s.tecnico.clube, sv = base.elencos[ci].reduce((t, j) => t + j.valor * 1000, 0);
  const conf = clamp((f.diretoria - 30) / 60, 0, 1);
  const sport = rd < 5 ? 0.85 : pos <= meta ? 1 : pos <= meta + 3 ? 0.55 : 0.25;
  const fin = s.caixa < 0 ? 0.2 : s.caixa > sv * 0.35 ? 0.45 : s.caixa < sv * 0.05 ? 0.8 : 1;
  f.verbasRecentes = f.verbasRecentes.filter(r => rd - r < 8);
  const rep = 0.35 ** f.verbasRecentes.length;
  const chance = 0.6 * conf * sport * fin * rep;
  if (rng(`verba${s.seed}-${s.ano}-${rd}-${f.verbasRecentes.length}`)() < chance) { // sorteio fixo pela semente (igual no online)
    const valor = Math.round(sv * (0.012 + f.diretoria / 100 * 0.028) / 10000) * 10000;
    f.verbasRecentes.push(rd);
    lancar(s, 'verba', 'Verba extra da diretoria', valor);
    return { ok: true, valor, txt: `A diretoria liberou ${fmt(valor)} para reforços.` };
  }
  f.diretoria = Math.max(0, f.diretoria - 3);
  return { ok: false, txt: 'A diretoria negou o pedido e ficou um pouco mais desconfiada (-3 de confiança).' };
}

// bilheteria do jogo do campeonato em casa (qualquer divisão; cada uma joga nas suas datas)
export function bilheteriaLiga(base, s, rd, adv, tab) {
  garantirFinancas(base, s);
  const f = s.fin, ci = s.tecnico.clube, l = tab.find(x => x.clube === ci), pos = tab.indexOf(l) + 1;
  const b = bilheteria(base, s, ci, adv, l?.ultimos || [], pos, f.ingresso);
  lancar(s, 'bilheteria', `Bilheteria × ${base.clubes[adv].n} (${b.publico.toLocaleString('pt-BR')} pagantes)`, b.renda, rd);
  if (b.occ >= 0.98 && ['caro', 'abusivo'].includes(f.ingresso)) f.diretoria = Math.min(100, f.diretoria + 1);
  if (b.occ < 0.6 && f.ingresso === 'abusivo') f.diretoria = Math.max(0, f.diretoria - 2);
}
// fecha as contas da rodada: salários dos dias, bilheteria, TV, patrocínio, prêmio no fim, socorro e diretoria
export function contasDaRodada(base, s, rd, jogoCasa, tab) {
  garantirFinancas(base, s);
  const f = s.fin, ci = s.tecnico.clube, c = base.clubes[ci], N = [];
  const dias = rd === 0 ? diasPre(s) : diasEntre(s, rd - 1, rd);
  const folha = folhaDia(base, s);
  if (dias) lancar(s, 'salarios', `Salários (${dias} dias)`, -folha * dias, rd);
  if (jogoCasa) bilheteriaLiga(base, s, rd, jogoCasa.adv, tab);
  if (PARCELAS_TV.includes(rd) && !f.tvPagas.includes(rd)) { f.tvPagas.push(rd); lancar(s, 'tv', `Cota de TV (parcela ${PARCELAS_TV.indexOf(rd) + 1} de 4)`, cotaTV(c) / 4, rd); }
  lancar(s, 'patrocinio', `Patrocínio master · ${f.patrocinador}`, patrocinio(c, ci).valor / 38, rd);
  const pos = tab.findIndex(x => x.clube === ci) + 1;
  if (rd === 37) { const p = premioLiga(c.div, pos); lancar(s, 'premio', `Premiação da Série ${c.div} (${pos}º lugar)`, p, rd); N.push(`Premiação: ${fmt(p)} pelo ${pos}º lugar.`); }
  // caixa negativo: socorro (adianta a TV) ou salários atrasados
  if (s.caixa < 0) {
    const sc = socorro(base, s), prox = PARCELAS_TV.find(r => !f.tvPagas.includes(r));
    if (sc.ok && (prox != null || f.socorro < 4)) {
      if (prox != null) { f.tvPagas.push(prox); lancar(s, 'socorro', 'Socorro: cota de TV adiantada', cotaTV(c) / 4, rd); }
      else { f.socorro++; lancar(s, 'socorro', 'Socorro: adiantamento da TV (desconta na próxima temporada)', cotaTV(c) / 8, rd); }
      N.push('Caixa negativo: a TV adiantou a cota e os salários foram pagos.');
      f.atraso = 0;
    } else {
      f.atraso++;
      f.diretoria = Math.max(0, f.diretoria - 2);
      for (const j of base.elencos[ci]) s.mor[j.id] = Math.max(0, (s.mor[j.id] ?? 62) - Math.min(4, 1 + f.atraso));
      N.push(`Salários atrasados: a ANRESF negou socorro porque ${sc.motivo}. O elenco está irritado.`);
      // atraso que se arrasta: os mais bem pagos pedem pra sair; depois um deles vai à Justiça e sai de graça
      const caros = base.elencos[ci].filter(j => !s.emprestimos?.[j.id]).sort((a, b) => salarioDia(base, s, b) - salarioDia(base, s, a));
      if (f.atraso >= 2) {
        const pedem = caros.filter(j => !s.querSair?.[j.id]).slice(0, 2);
        for (const j of pedem) (s.querSair ||= {})[j.id] = { de: ci, rodada: rd, motivo: 'está com o salário atrasado' };
        if (pedem.length) N.push(`Com o salário atrasado, ${pedem.map(j => j.curto).join(' e ')} ${pedem.length > 1 ? 'pedem' : 'pede'} para ser negociado${pedem.length > 1 ? 's' : ''}.`);
      }
      if (f.atraso >= 2) N.push(punirFPF(base, s, 'salários atrasados são dívida com credor relevante'));
      if (f.atraso >= 3 && base.elencos[ci].length > 18 && caros[0]) {
        const j = caros[0];
        f.mauPagador = s.ano;
        liberar(base, s, j);
        N.push(`${j.curto} vai à Justiça pelos salários atrasados, ganha a rescisão e sai de graça. O clube fica com fama de mau pagador.`);
      }
    }
  } else if (f.atraso) { f.atraso = 0; for (const j of base.elencos[ci]) s.mor[j.id] = Math.min(100, (s.mor[j.id] ?? 62) + 4); N.push('Salários em dia de novo. O vestiário respirou.'); }
  // diretoria acompanha a campanha depois da 5ª rodada
  if (rd >= 4 && pos) f.diretoria = clamp(f.diretoria + clamp((metaDiretoria(base, s).pos - pos) * 0.35 + 0.3, -2, 2), 0, 100);
  return N;
}

// dicas do balanço: o que pesa nas contas e o que dá pra fazer
export function dicasFinanceiras(base, s) {
  const bal = balanco(s), o = orcamento(base, s), t = s.fin.temporada, D = [];
  const entra = Object.values(bal).filter(v => v > 0).reduce((a, v) => a + v, 0), sal = -(bal.salarios || 0);
  if (o.fim < 0) D.push(`No ritmo atual, faltam ${fmt(-o.fim)} para pagar os salários até o fim da temporada. Vender alguém ou pedir verba resolve antes que atrase.`);
  else if (o.fim > o.folha * o.dias * 0.5) D.push(`O caixa fecha a temporada com folga (${fmt(o.fim)}). Dá para reforçar o time sem risco.`);
  if (entra && sal / entra > 0.75) D.push(`A folha come ${Math.round(sal / entra * 100)}% do que entra. Quem quase não joga e ganha bem é o primeiro a sair.`);
  if (t.compras > t.vendas) D.push('Você comprou mais do que vendeu: perdeu o direito ao socorro da TV se o caixa ficar negativo.');
  if (s.fin.atraso) D.push('Salário atrasado vira pedido de saída e, depois, processo na Justiça. Prioridade é colocar a folha em dia.');
  if (s.fin.mauPagador != null && s.ano - s.fin.mauPagador <= 1) D.push(`Fama de mau pagador: os jogadores pensam duas vezes antes de vir (até o fim de ${s.fin.mauPagador + 1}).`);
  if ((bal.bilheteria || 0) < entra * 0.08 && s.fin.ingresso !== 'barato') D.push('A bilheteria rende pouco. Ingresso mais barato enche o estádio e ajuda o time em casa.');
  if (!D.length) D.push('Contas equilibradas. Siga de olho na folga da folha antes de contratar.');
  return D;
}

// ---------- fair play financeiro (Sistema de Sustentabilidade Financeira da CBF) ----------
// Custo do elenco (salários do ano + compras) até 70% da receita: 2026-2028 é adaptação (só aviso), de 2029 em diante
// pune. Dívida com credor relevante (salário atrasado) pune na hora, em escada: plano de correção, multa, registro de
// jogadores bloqueado, perda de pontos. De 2028 em diante a temporada também não pode fechar no vermelho.
export const LIMITE_FPF = 0.7, ANO_FPF = 2029, ANO_EQUILIBRIO = 2028;
const RECEITAS = ['bilheteria', 'tv', 'patrocinio', 'premio', 'venda', 'show', 'vaquinha', 'investidor', 'emprestimo', 'reembolso', 'minutagem', 'medo', 'revenda'];
export function fairPlay(base, s) {
  garantirFinancas(base, s);
  const ci = s.tecnico.clube, c = base.clubes[ci], bal = balanco(s);
  const pos = s.rodada ? tabela(base, s, c.div).findIndex(l => l.clube === ci) + 1 : base.clubes.map((x, i) => i).filter(i => base.clubes[i].div === c.div).sort((x, y) => base.forca(y) - base.forca(x)).indexOf(ci) + 1;
  // receita = o que já entrou no extrato (bilheteria, TV, patrocínio, prêmios, vendas, eventos) + o que falta entrar até o fim;
  // verba da diretoria e socorro não contam (são adiantamento e aporte, não receita do futebol)
  const realizado = RECEITAS.reduce((a, k) => a + Math.max(0, bal[k] || 0), 0);
  const premioPago = s.fin.extrato.some(e => e.a === s.ano && /Premiação da Série/.test(e.desc));
  const receita = realizado + receitaPrevista(base, s) + (premioPago ? 0 : premioLiga(c.div, pos));
  // custo do elenco: salários já pagos + os que faltam + compras amortizadas em 3 anos
  const custo = -(bal.salarios || 0) + folhaDia(base, s) * (s.rodada >= 38 ? 0 : diasRestantes(s)) + (s.fin.temporada.compras || 0) / 3;
  const resultado = Object.values(bal).reduce((a, v) => a + v, 0);
  return { receita, custo, razao: custo / Math.max(1, receita), resultado, divida: (s.fin.atraso || 0) > 0 };
}
export const registroBloqueado = s => s.fpf?.ban?.ano === s.ano && s.rodada < s.fpf.ban.ate ? s.fpf.ban.ate : 0;
// um degrau na escada de punições (devolve o texto da notícia)
export function punirFPF(base, s, motivo) {
  const ci = s.tecnico.clube, F = (s.fpf ||= { degrau: 0 }), f = fairPlay(base, s);
  F.degrau = Math.min(4, (F.degrau || 0) + 1);
  if (F.degrau === 1) { s.fin.diretoria = clamp(s.fin.diretoria - 3, 0, 100); return `Fair play financeiro: a CBF exige um plano de correção do ${base.clubes[ci].n} (${motivo}).`; }
  if (F.degrau === 2) { const v = Math.round(f.receita * 0.02 / 10000) * 10000; lancar(s, 'multa', 'Multa do fair play financeiro', -v); return `Fair play financeiro: multa de ${fmt(v)} para o ${base.clubes[ci].n} (${motivo}).`; }
  if (F.degrau === 3) { F.ban = { ano: s.ano, ate: Math.min(38, s.rodada + 10) }; return `Fair play financeiro: o ${base.clubes[ci].n} está proibido de registrar jogadores até a ${F.ban.ate + 1}ª rodada (${motivo}).`; }
  (s.puni ||= {})[ci] = (s.puni[ci] || 0) + 3;
  return `Fair play financeiro: o ${base.clubes[ci].n} perde 3 pontos no Brasileirão (${motivo}).`;
}

// balanço da temporada por categoria
export function balanco(s) {
  const tot = {};
  for (const e of s.fin.extrato) if ((e.a ?? s.anoInicial ?? s.ano) === s.ano) tot[e.tipo] = (tot[e.tipo] || 0) + e.valor;
  return tot;
}
