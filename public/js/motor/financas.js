// Finanças do seu clube: salários por dia, bilheteria, TV, patrocínio, prêmios, extrato, diretoria e socorro.
import { clamp } from './util.js';
import { rivais } from './rivais.js';
import { dataRodada } from './mundo.js';

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
export function diasRestantes(s) { return Math.max(5, diasEntre(s, s.rodada, 37) + 3); }
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
  return { folha, salarios: sal, maxSal, folga: Math.max(0, sal - folha), compras, dias, cota, diasDeSalario, pagaAteFim: diasDeSalario >= dias };
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
  return rank <= 6 ? { pos: 4, txt: div === 'B' ? 'subir para a Série A (top 4)' : 'subir para a Série B (top 4)' } : rank <= 14 ? { pos: 10, txt: 'campanha segura (até 10º)' } : { pos: 16, txt: 'não cair (16º ou melhor)' };
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
  if (Math.random() < chance) {
    const valor = Math.round(sv * (0.012 + f.diretoria / 100 * 0.028) / 10000) * 10000;
    f.verbasRecentes.push(rd);
    lancar(s, 'verba', 'Verba extra da diretoria', valor);
    return { ok: true, valor, txt: `A diretoria liberou ${fmt(valor)} para reforços.` };
  }
  f.diretoria = Math.max(0, f.diretoria - 3);
  return { ok: false, txt: 'A diretoria negou o pedido e ficou um pouco mais desconfiada (-3 de confiança).' };
}

// fecha as contas da rodada: salários dos dias, bilheteria, TV, patrocínio, prêmio no fim, socorro e diretoria
export function contasDaRodada(base, s, rd, jogoCasa, tab) {
  garantirFinancas(base, s);
  const f = s.fin, ci = s.tecnico.clube, c = base.clubes[ci], N = [];
  const dias = rd === 0 ? 7 : diasEntre(s, rd - 1, rd);
  const folha = folhaDia(base, s);
  if (dias) lancar(s, 'salarios', `Salários (${dias} dias)`, -folha * dias, rd);
  if (jogoCasa) {
    const l = tab.find(x => x.clube === ci), pos = tab.indexOf(l) + 1;
    const b = bilheteria(base, s, ci, jogoCasa.adv, l?.ultimos || [], pos, f.ingresso);
    lancar(s, 'bilheteria', `Bilheteria × ${base.clubes[jogoCasa.adv].n} (${b.publico.toLocaleString('pt-BR')} pagantes)`, b.renda, rd);
    if (b.occ >= 0.98 && ['caro', 'abusivo'].includes(f.ingresso)) f.diretoria = Math.min(100, f.diretoria + 1);
    if (b.occ < 0.6 && f.ingresso === 'abusivo') f.diretoria = Math.max(0, f.diretoria - 2);
  }
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
    }
  } else if (f.atraso) { f.atraso = 0; for (const j of base.elencos[ci]) s.mor[j.id] = Math.min(100, (s.mor[j.id] ?? 62) + 4); N.push('Salários em dia de novo. O vestiário respirou.'); }
  // diretoria acompanha a campanha depois da 5ª rodada
  if (rd >= 4 && pos) f.diretoria = clamp(f.diretoria + clamp((metaDiretoria(base, s).pos - pos) * 0.35 + 0.3, -2, 2), 0, 100);
  return N;
}

// balanço da temporada por categoria
export function balanco(s) {
  const tot = {};
  for (const e of s.fin.extrato) if ((e.a ?? s.anoInicial ?? s.ano) === s.ano) tot[e.tipo] = (tot[e.tipo] || 0) + e.valor;
  return tot;
}
