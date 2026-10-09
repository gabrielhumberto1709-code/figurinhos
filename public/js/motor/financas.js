// Finanças do seu clube: salários por dia, bilheteria, TV, patrocínio, prêmios, extrato, diretoria e socorro.
import { clamp, rng, fmtDinheiro } from './util.js';
import { rivais } from './rivais.js';
import { dataRodada, tabela } from './mundo.js';
import { liberar, multaRescisao } from './mercado.js';
import { dataAmistoso, doAno } from './calendario.js';
import { FASES } from './copa.js';

const DIA = 864e5;
const PISO = { A: 150000, B: 40000, C: 15000 };                 // salário anual mínimo por divisão
export const PRECOS = { barato: 0.65, normal: 1, caro: 1.4, abusivo: 2 };
export const NOME_PRECO = { barato: 'Barato', normal: 'Normal', caro: 'Caro', abusivo: 'Abusivo' };
const MARCAS = ['ApostaBet', 'Banco Cordial', 'Pix&Vai', 'Supermercados Boa Praça', 'TeleGol', 'Cimentos Rocha Firme', 'Café Arretado', 'Seguros Tá Tranquilo', 'Auto Peças Turbinão', 'Farmácia Saúde Já'];

// salário por dia (ou o que foi acertado no contrato). Uma fatia do valor de mercado que cresce com a idade: o garoto
// valorizado ganha pouco perto do que vale, o veterano ganha pelo nome (no mínimo 28% do que valeria no auge com o
// mesmo overall). Clube de torcida grande paga mais. Piso e teto por divisão. Calibrado nas folhas reais de 2025-26.
const TETO_ANUAL = { A: 8.5e6, B: 1.2e6, C: 3e5, X: 25e6 };
const FATIA = i => i <= 23 ? 0.14 : i <= 27 ? 0.2 : i <= 29 ? 0.22 : i <= 31 ? 0.28 : i <= 34 ? 0.35 : 0.5;
const noAuge = ovr => 150e3 * 1.16 ** (ovr - 50);
export function salarioBase(c, j) {
  const anual = Math.max(FATIA(j.idade) * (j.valor || 0) * 1000, j.idade >= 30 ? 0.28 * noAuge(j.ovr) : 0) * (0.9 + 0.035 * (c?.fan ?? 4));
  return Math.round(clamp(anual, PISO[c?.div] || PISO.C, TETO_ANUAL[c?.div] || TETO_ANUAL.C) / 365);
}
export function salarioDia(base, s, j) {
  return s.salarios?.[j.id] || salarioBase(base.clubes[j.clube], j);
}
export const folhaDia = (base, s, ci = s.tecnico.clube) => base.elencos[ci].reduce((t, j) => t + salarioDia(base, s, j), 0);

// ---------- o dinheiro de verdade (balanços de 2025, publicados em 2026) ----------
// Receita recorrente, dívida líquida e caixa em R$ milhões (Sports Value "Finanças TOP 20 2025", EY e balanços dos
// clubes), divisão do balanço e gasto médio com contratações por ano (ge, janelas de 2025 e 2026). € a R$ 6,31 (PTAX
// média de 2025). Bragantino: a dívida é empréstimo da Red Bull, sem juros. Clube fora da lista usa a fórmula da divisão.
export const EURO = 6.31;
const REAIS = {
  Flamengo: [1570.7, 472.8, 192, 366, 'A'], Palmeiras: [1094.2, 1149.8, 118, 437, 'A'], Botafogo: [655, 1571.2, 26, 97, 'A'],
  'São Paulo': [801.6, 858.2, 24, 26, 'A'], Fluminense: [789.1, 824.4, 35, 180, 'A'], Corinthians: [863.7, 2447, 26, 17, 'A'],
  'Grêmio': [375.5, 778.4, 18, 107, 'A'], Santos: [489.9, 890, 0.3, 143, 'A'], Cruzeiro: [641.9, 1152.8, 0.7, 236, 'A'],
  'Atlético-MG': [466.8, 2290.3, 17, 179, 'A'], Internacional: [469.9, 929.2, 2, 66, 'A'], Bragantino: [543, 0, 14, 126, 'A'],
  Vasco: [446.4, 839.3, 60, 172, 'A'], Bahia: [393.3, 167.8, 34, 189, 'A'], 'Athletico-PR': [232.6, 83.1, 48, 55, 'B'],
  Fortaleza: [203.3, 223.2, 4, 30, 'A'], 'Ceará': [198.4, 174.1, 2, 5, 'A'], 'Vitória': [147.2, 350.6, 0.1, 23, 'A'],
  Sport: [176.2, 379.6, 2, 30, 'A'], Mirassol: [163.7, 0, 50, 10, 'A'], Juventude: [119, 0, 5, 2, 'A'], Coritiba: [132.8, 150, 21.3, 20, 'B'],
  Remo: [82.9, 36.8, 5, 12, 'B'], 'Goiás': [45.4, 114, 10.2, 3, 'B'], 'Avaí': [41.5, 267.5, 0, 1, 'B'], Novorizontino: [69.5, 22, 1.5, 3, 'B'],
  Guarani: [63.5, 320, 0, 1, 'C'],
};
const real = c => { const r = REAIS[c?.n]; return r && { rec: r[0] * 1e6 / EURO, divida: r[1] * 1e6 / EURO, caixa: r[2] * 1e6 / EURO, gasto: r[3] * 1e6 / EURO, serie: r[4] }; };
// TV: cota do Brasileirão (parte igual + audiência; Flamengo perto de € 55 mi na A) e as das Séries B e C
const TV_DIV = { A: f => 9e6 + f * f * 4.5e5, B: f => 1.2e6 + f * f * 4e4, C: f => 2.5e5 + f * f * 5e3 };
const COM_DIV = { A: 1, B: 0.6, C: 0.35 };   // a marca vale menos fora da A, mas não some
// bilheteria de uma temporada normal: 19 jogos do Brasileirão mais estadual e copas em casa (~1,6x), preço normal
const bilEst = c => { const fan = Math.min(10, c.fan || 3), cap = c.est?.[1] || 8000 + fan * 5000; return 1.6 * 19 * Math.round(cap * clamp(0.3 + fan * 0.055, 0.08, 1) * Math.round((8 + fan * 1.5) * 100) / 100); };
// a receita recorrente do balanço inclui as premiações; no jogo elas vêm à parte, pelo que o time ganhar
const PREMIO_ESP = { A: 0.12, B: 0.05, C: 0.03 };
export function cotaTV(c) { return Math.round(TV_DIV[c.div]?.(c.fan || 2) ?? 0); }
// comercial: patrocínios, sócio-torcedor, licenciamento. Clube com balanço: o que sobra da receita real depois da TV e da
// bilheteria; sem balanço, pelo tamanho da torcida
function comercial(c) {
  const r = real(c), f = c.fan || 2;
  if (!COM_DIV[c.div]) return 0;
  if (!r) return f * f * 3.5e5 * COM_DIV[c.div];
  return Math.max(0.1 * r.rec, r.rec * (1 - PREMIO_ESP[r.serie]) - TV_DIV[r.serie](f) - bilEst(c)) * COM_DIV[c.div] / COM_DIV[r.serie];
}
export function patrocinio(c, ci) { return { marca: MARCAS[ci % MARCAS.length], valor: Math.round(comercial(c)) }; }
// receita recorrente da temporada (sem prêmios nem vendas)
export const receitaAnual = c => cotaTV(c) + comercial(c) + bilEst(c);
// custos além dos salários: encargos, direitos de imagem e comissão técnica (sobre a folha); estrutura do clube
// (administração, CT, base, viagens, impostos), uma fatia da receita; juros da dívida. Calibrado para que o resultado
// antes de vendas e compras fique perto do real de 2025 (Flamengo e São Paulo no azul, Corinthians e Atlético no vermelho).
export const ENCARGOS = 0.7, ESTRUTURA = 0.38, JUROS = 0.1;
export const estruturaAnual = c => Math.round(ESTRUTURA * receitaAnual(c));
export function dividaInicial(c) { const r = real(c); return Math.round(r ? r.divida : receitaAnual(c) * ({ A: 1, B: 2, C: 1 }[c.div] || 0)); }
// caixa de quem assume: o do balanço (sem balanço, 3% da receita), mais uma folga no fácil
export function caixaReal(c, dificuldade = 'normal') { const r = real(c), R = receitaAnual(c); return Math.round(((r ? r.caixa : 0.03 * R) + ({ facil: 0.15, normal: 0.03, dificil: 0 }[dificuldade] ?? 0.03) * R) / 1e4) * 1e4; }
// verba de contratações da IA por temporada: o gasto real médio (o resto vem do que ela vende); sem balanço, pela receita e a dívida
export function verbaIA(c) { const r = real(c), R = receitaAnual(c); return Math.round(Math.max(0, r ? 0.6 * r.gasto : 0.1 * R - 0.04 * dividaInicial(c)) / 1e4) * 1e4; }
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
  return { divida: dividaInicial(c), extrato: [], temporada: { ano: s.ano, compras: 0, vendas: 0, folha0: folhaDia(base, s) }, diretoria: 60, ultimaVerba: -99, verbasRecentes: [], tvPagas: [], ingresso: 'normal', salarioBudget: null, atraso: 0, socorro: 0, patrocinador: patrocinio(c, ci).marca };
}
export const garantirFinancas = (base, s) => { s.fin = s.fin || financasIniciais(base, s); s.fin.divida ??= dividaInicial(base.clubes[s.tecnico.clube]); return s.fin; };
// custos fixos por dia (estrutura e juros), para o orçamento
export const fixosDia = (base, s) => (estruturaAnual(base.clubes[s.tecnico.clube]) + (s.fin?.divida || 0) * JUROS) / 365;

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
  const folha = folhaDia(base, s), dias = diasRestantes(s), cota = receitaPrevista(base, s), k = 1 + ENCARGOS, fixos = fixosDia(base, s);
  const maxSal = Math.max(folha, Math.floor(((s.caixa + cota) / dias - fixos) / k));
  const sal = clamp(s.fin.salarioBudget ?? Math.round(folha * 1.1), folha, Math.max(folha, maxSal));
  const reserva = (sal * k + fixos) * dias - cota, custoDia = folha * k + fixos;
  const compras = Math.max(0, Math.min(s.caixa, Math.round(s.caixa - reserva)));
  const diasDeSalario = custoDia ? Math.floor((s.caixa + cota) / custoDia) : 999;
  return { folha, salarios: sal, maxSal, folga: Math.max(0, sal - folha), compras, dias, cota, custoDia, diasDeSalario, pagaAteFim: diasDeSalario >= dias, fim: Math.round(s.caixa + cota - custoDia * dias) };
}

// regra da ANRESF: só tem socorro quem não comprou mais do que vendeu nem inchou a folha em mais de 10%
export function socorro(base, s) {
  const t = s.fin.temporada, folha = folhaDia(base, s);
  if (t.compras > t.vendas) return { ok: false, motivo: `o clube comprou ${fmt(t.compras)} e vendeu ${fmt(t.vendas)} na temporada` };
  if (t.folha0 && folha > t.folha0 * 1.1) return { ok: false, motivo: `a folha subiu ${Math.round((folha / t.folha0 - 1) * 100)}% desde o começo da temporada` };
  return { ok: true };
}
const fmt = v => fmtDinheiro(v);

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
// (um recém-promovido à A fica perto de € 4 mil/dia; o Flamengo, perto de € 16 mil). Sobe com Libertadores ou Sul-Americana, com a campanha na
// Copa do Brasil, com título regional e com a confiança da diretoria. Quem já ganha acima continua, mas não renova acima.
const TETO_DIV = { A: 9000, B: 1800, C: 700 };
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
  if (dias) lancar(s, 'salarios', `Salários, encargos e comissão técnica (${dias} dias)`, -folha * (1 + ENCARGOS) * dias, rd);
  lancar(s, 'estrutura', 'Estrutura do clube (administração, CT, base, viagens)', -estruturaAnual(c) / 38, rd);
  if (f.divida > 0) lancar(s, 'juros', `Juros da dívida (${fmt(f.divida)} a ${Math.round(JUROS * 100)}% ao ano)`, -f.divida * JUROS / 38, rd);
  if (jogoCasa) bilheteriaLiga(base, s, rd, jogoCasa.adv, tab);
  if (PARCELAS_TV.includes(rd) && !f.tvPagas.includes(rd)) { f.tvPagas.push(rd); lancar(s, 'tv', `Cota de TV (parcela ${PARCELAS_TV.indexOf(rd) + 1} de 4)`, cotaTV(c) / 4, rd); }
  lancar(s, 'patrocinio', `Patrocínio master · ${f.patrocinador}`, patrocinio(c, ci).valor / 38, rd);
  const pos = (tab || []).findIndex(x => x.clube === ci) + 1;
  if (rd === 37) { const p = premioLiga(c.div, pos); lancar(s, 'premio', `Premiação da Série ${c.div} (${pos}º lugar)`, p, rd); N.push(`Premiação: ${fmt(p)} pelo ${pos}º lugar.`); }
  // caixa negativo: socorro (adianta a TV) ou salários atrasados
  if (s.caixa < 0) {
    const sc = socorro(base, s), prox = PARCELAS_TV.find(r => !f.tvPagas.includes(r));
    if (sc.ok && (prox != null || f.socorro < 4)) {
      if (prox != null) { f.tvPagas.push(prox); lancar(s, 'socorro', 'Socorro: cota de TV adiantada', cotaTV(c) / 4, rd); }
      else { f.socorro++; lancar(s, 'socorro', 'Socorro: adiantamento da TV (desconta na próxima temporada)', cotaTV(c) / 8, rd); }
      N.push('Caixa negativo: a TV adiantou a cota e os salários foram pagos.');
      f.atraso = 0; f.atrasoDesde = null;
    } else {
      f.atraso++;
      const hoje = +dataRodada(s.ano, rd); f.atrasoDesde ??= hoje;
      const dias = (hoje - f.atrasoDesde) / DIA;                  // a lei conta em meses de atraso, não em rodadas
      f.diretoria = Math.max(0, f.diretoria - 2);
      for (const j of base.elencos[ci]) s.mor[j.id] = Math.max(0, (s.mor[j.id] ?? 62) - Math.min(4, 1 + f.atraso));
      N.push(`Salários atrasados: a ANRESF negou socorro porque ${sc.motivo}. O elenco está irritado.`);
      // atraso que se arrasta: com 1 mês os mais bem pagos pedem pra sair; com 2 meses (Lei Geral do Esporte, art. 90)
      // um deles vai à Justiça, sai livre e o clube ainda deve a cláusula compensatória (o resto do contrato)
      const caros = base.elencos[ci].filter(j => !s.emprestimos?.[j.id]).sort((a, b) => salarioDia(base, s, b) - salarioDia(base, s, a));
      if (dias >= 30) {
        const pedem = caros.filter(j => !s.querSair?.[j.id]).slice(0, 2);
        for (const j of pedem) (s.querSair ||= {})[j.id] = { de: ci, rodada: rd, motivo: 'está com o salário atrasado' };
        if (pedem.length) N.push(`Com o salário atrasado, ${pedem.map(j => j.curto).join(' e ')} ${pedem.length > 1 ? 'pedem' : 'pede'} para ser negociado${pedem.length > 1 ? 's' : ''}.`);
      }
      const corte = rd > 0 && CONTROLE_FPF.find(md => { const x = +doAno(s.ano, md); return x > +dataRodada(s.ano, rd - 1) && x <= hoje; });
      if (corte) N.push(punirFPF(base, s, `salário atrasado na data de controle (${corte.split('-').reverse().join('/')}) é dívida com credor relevante`));
      if (dias >= 60 && base.elencos[ci].length > 18 && caros[0]) {
        const j = caros[0], v = multaRescisao(base, s, j);
        f.mauPagador = s.ano;
        lancar(s, 'rescisao', `Rescisão indireta de ${j.curto} na Justiça (cláusula compensatória)`, -v, rd);
        liberar(base, s, j, v);
        N.push(`${j.curto} vai à Justiça com dois meses de salário atrasado, ganha a rescisão indireta e sai livre. O clube ainda deve a cláusula compensatória: ${fmt(v)}. Fica a fama de mau pagador.`);
      }
    }
  } else if (f.atraso) { f.atraso = 0; f.atrasoDesde = null; for (const j of base.elencos[ci]) s.mor[j.id] = Math.min(100, (s.mor[j.id] ?? 62) + 4); N.push('Salários em dia de novo. O vestiário respirou.'); }
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

// ---------- fair play financeiro (Sistema de Sustentabilidade Financeira da CBF, 2026) ----------
// Séries A e B, três indicadores; 2026 e 2027 só geram advertência, punição a partir de 2028.
// 1) custo do elenco (salários + compras amortizadas em 3 anos) sobre receitas + transferências + aportes: até 80%;
//    de 2029 em diante, 70% na A (a B segue em 80%).
// 2) dívida de curto prazo (caixa negativo): até 60% da receita em 2028, 50% em 2029 e 45% de 2030 em diante.
// 3) equilíbrio: a soma dos três últimos anos não pode passar do déficit tolerado (A: R$ 30 mi, ~€ 5,1M; B: R$ 10 mi,
//    ~€ 1,7M; ou 2,5% da receita, o que for maior). Aporte da diretoria ou de investidor cobre o déficit.
// Série C: só dívida em atraso. Salário atrasado é dívida com credor relevante, conferida em 31/3, 31/7 e 30/11.
// Sanções em escada: advertência pública, multa, retenção de receitas, transfer ban e perda de pontos.
export const ANO_FPF = 2028;
export const limiteCusto = (ano, div) => div === 'C' ? Infinity : ano >= 2029 && div === 'A' ? 0.7 : 0.8;
export const limiteCurto = (ano, div) => div === 'C' ? Infinity : ano <= 2028 ? 0.6 : ano === 2029 ? 0.5 : 0.45;
const tolerancia = (div, receita) => div === 'A' ? Math.max(5.1e6, 0.025 * receita) : div === 'B' ? Math.max(1.7e6, 0.025 * receita) : Infinity;
export const CONTROLE_FPF = ['3-31', '7-31', '11-30'];
const RECEITAS = ['bilheteria', 'tv', 'patrocinio', 'premio', 'venda', 'show', 'vaquinha', 'investidor', 'emprestimo', 'reembolso', 'minutagem', 'medo', 'revenda'];
const pct = v => `${Math.round(v * 100)}%`;
export function fairPlay(base, s) {
  garantirFinancas(base, s);
  const ci = s.tecnico.clube, c = base.clubes[ci], bal = balanco(s), ano = s.ano;
  const pos = s.rodada ? tabela(base, s, c.div).findIndex(l => l.clube === ci) + 1 : base.clubes.map((x, i) => i).filter(i => base.clubes[i].div === c.div).sort((x, y) => base.forca(y) - base.forca(x)).indexOf(ci) + 1;
  // conta do ano até agora, como no balancete (a CBF julga o ano fechado): receitas que já entraram (bilheteria, TV,
  // patrocínio, prêmios, vendas, eventos) + a parte da premiação da Série que já corresponde às rodadas jogadas.
  // Aporte (verba da diretoria e investidor) entra na base do custo do elenco; socorro é adiantamento, não conta.
  const realizado = RECEITAS.reduce((a, k) => a + Math.max(0, bal[k] || 0), 0);
  const premioPago = s.fin.extrato.some(e => e.a === ano && /Premiação da Série/.test(e.desc));
  const falta = premioPago ? 0 : premioLiga(c.div, pos) * Math.min(1, s.rodada / 38), receita = realizado + falta;
  const aporte = Math.max(0, bal.verba || 0) + Math.max(0, bal.investidor || 0), compras = s.fin.temporada.compras || 0;
  const custo = -(bal.salarios || 0) + compras / 3;
  const razao = custo / Math.max(1, receita + Math.max(0, bal.verba || 0));
  const curto = Math.max(0, -s.caixa), razaoCurto = curto / Math.max(1, receita);
  // resultado do ano com as compras amortizadas: nos 3 anos da conta, a compra do ano pesa 1/3 e a do ano passado 2/3
  // (a de dois anos atrás já pesou inteira)
  const resultado = Object.entries(bal).reduce((a, [k, v]) => ['amortizacao', 'rolagem'].includes(k) ? a : a + v, 0), anoFim = resultado + falta; // pagar ou rolar dívida não é receita nem despesa
  const A = s.fpf?.anos || {}, ant = A[ano - 1], ant2 = A[ano - 2];
  const tri = anoFim + compras * 2 / 3 + (ant ? ant.r + ant.c / 3 : 0) + (ant2 ? ant2.r : 0), tol = tolerancia(c.div, receita);
  const limCusto = limiteCusto(ano, c.div), limCurto = limiteCurto(ano, c.div), falhas = [];
  if (razao > limCusto) falhas.push(`custo do elenco em ${pct(razao)} da receita, acima do limite de ${pct(limCusto)}`);
  if (razaoCurto > limCurto) falhas.push(`dívida de curto prazo em ${pct(razaoCurto)} da receita, acima do limite de ${pct(limCurto)}`);
  if (tri < -tol) falhas.push(`déficit de ${fmt(-tri)} em três anos, acima da tolerância de ${fmt(tol)}`);
  return { receita, aporte, custo, razao, limCusto, curto, razaoCurto, limCurto, resultado, anoFim, tri, tol, falhas, divida: (s.fin.atraso || 0) > 0 };
}
// registro de jogadores bloqueado (fair play da CBF ou transfer ban do ADM da liga): até qual rodada
export const registroBloqueado = s => Math.max(0, ...[s.fpf?.ban, s.banAdm].map(b => b?.ano === s.ano && s.rodada < b.ate ? b.ate : 0));
export const SANCOES = ['', 'advertência pública', 'multa', 'receitas retidas', 'transfer ban', 'perda de pontos'];
// um degrau na escada de punições (devolve o texto da notícia). Antes de 2028 a CBF só adverte.
export function punirFPF(base, s, motivo) {
  const ci = s.tecnico.clube, n = base.clubes[ci].n;
  if (s.ano < ANO_FPF) return `Fair play financeiro: advertência da CBF ao ${n} (${motivo}). A partir de ${ANO_FPF} isso dá punição.`;
  const F = (s.fpf ||= { degrau: 0 }), rec = fairPlay(base, s).receita, arred = v => Math.round(v / 1e4) * 1e4;
  F.degrau = Math.min(5, (F.degrau || 0) + 1);
  if (F.degrau === 1) { s.fin.diretoria = clamp(s.fin.diretoria - 3, 0, 100); return `Fair play financeiro: advertência pública da CBF ao ${n} (${motivo}).`; }
  if (F.degrau === 2) { const v = arred(rec * 0.02); lancar(s, 'fpf', 'Multa do fair play financeiro', -v); return `Fair play financeiro: multa de ${fmt(v)} para o ${n} (${motivo}).`; }
  if (F.degrau === 3) { const v = arred(rec * 0.05); F.retido = (F.retido || 0) + v; lancar(s, 'fpf', 'Receitas retidas pela CBF (fair play)', -v); return `Fair play financeiro: a CBF retém ${fmt(v)} das receitas do ${n} até a situação se regularizar (${motivo}).`; }
  if (F.degrau === 4) { const virada = s.rodada >= 38; F.ban = { ano: s.ano + virada, ate: virada ? 10 : Math.min(38, s.rodada + 10) }; return `Fair play financeiro: transfer ban, o ${n} não pode registrar jogadores até a ${F.ban.ate + 1}ª rodada${virada ? ` de ${F.ban.ano}` : ''} (${motivo}).`; }
  (s.puni ||= {})[ci] = (s.puni[ci] || 0) + 3;
  return `Fair play financeiro: o ${n} perde 3 pontos no Brasileirão (${motivo}).`;
}
// fecha o ano: confere os indicadores, guarda o resultado para a conta de três anos e, se está tudo em ordem, alivia a
// escada e devolve o que a CBF reteve. Chamada na virada, antes de zerar a temporada.
export function fecharFPF(base, s) {
  const fp = fairPlay(base, s), F = (s.fpf ||= { degrau: 0 }), N = [];
  if (fp.falhas.length) N.push(punirFPF(base, s, fp.falhas.join('; ')));
  else if (!fp.divida) {
    F.degrau = Math.max(0, (F.degrau || 0) - 1);
    if (F.retido) { lancar(s, 'fpf', 'CBF devolve as receitas retidas', F.retido); N.push(`Fair play financeiro em ordem: a CBF devolve ${fmt(F.retido)} retidos.`); F.retido = 0; }
  }
  F.anos = { [s.ano - 1]: F.anos?.[s.ano - 1], [s.ano]: { r: fp.anoFim, c: s.fin.temporada.compras || 0 } };
  return N;
}

// pagar parte da dívida com o caixa (corta os juros daqui pra frente)
export function amortizar(base, s, v) {
  garantirFinancas(base, s);
  const x = Math.round(Math.min(v, s.caixa, s.fin.divida));
  if (!(x > 0)) return s.fin.divida > 0 ? 'Não tem caixa para isso.' : 'O clube não tem dívida.';
  lancar(s, 'amortizacao', 'Amortização da dívida', -x); s.fin.divida -= x;
  return `Dívida amortizada em ${fmt(x)}: agora é ${fmt(s.fin.divida)} (${fmt(s.fin.divida * JUROS)} de juros por ano).`;
}
// balanço da temporada por categoria
export function balanco(s) {
  const tot = {};
  for (const e of s.fin.extrato) if ((e.a ?? s.anoInicial ?? s.ano) === s.ano) tot[e.tipo] = (tot[e.tipo] || 0) + e.valor;
  return tot;
}
