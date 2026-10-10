// Patrocínio master: a cada contrato novo, três empresas fazem propostas com jeitos diferentes de pagar. Todas giram em
// torno do mesmo valor anual do clube (o comercial do balanço real: financas.js patrocinio), com risco e prêmio
// diferentes: ninguém fica muito acima disso na média, então nenhuma escolha quebra o jogo. O dinheiro entra todo mês
// (dia 1º, inclusive na pré-temporada); bônus de título e de meta saem no fim da temporada, o de vitória na hora.
// Até assinar, o clube fica sem patrocinador master; sem escolha até a 1ª rodada da Série A, a diretoria assina.
import { rng, pick, shuffle } from './util.js';
import { lancar, patrocinio } from './financas.js';

// empresas inventadas por setor (o sorteio é por clube e por ano: cada clube vê propostas diferentes)
const EMPRESAS = {
  Apostas: ['Palpitão Bet', 'ChuteCerto', 'Lance da Sorte', 'GolDeOuro Apostas', 'Bola na Rede Bet', 'Zebra.bet', 'Cravada Bet', 'Acerto Bet', 'Placar Exato'],
  Banco: ['Banco Cordial', 'Pix&Vai', 'Banco Arrimo', 'Cofrinho Digital', 'Crédito Já', 'Banco Horizonte', 'Conta Fácil'],
  Varejo: ['Supermercados Boa Praça', 'Lojas Bom Preço', 'Atacado do Povo', 'Magazine Estrela', 'Casa & Lar', 'Calçados Passo Firme'],
  Telecom: ['TeleGol', 'Conecta Mais', 'FibraNet', 'Sinal Forte'],
  Automotivo: ['Auto Peças Turbo', 'Moto Veloz', 'Pneus Rodão', 'Montadora Vento Sul'],
  Alimentos: ['Café Arretado', 'Feijão Dona Nena', 'Laticínios Serra Azul', 'Frigorífico Boi Bom', 'Biscoitos Crocante', 'Refri Guaraná da Serra'],
  Saúde: ['Unimais Saúde', 'Farmácias Pague Pouco', 'Clínica Bem Viver', 'Óticas Visão'],
  Construção: ['Cimentos Rocha Firme', 'Construtora Pilar', 'Tintas Arco-Íris'],
  Energia: ['Gás Chama Boa', 'Solar Brasil Energia', 'Combustíveis Rota'],
  Educação: ['Faculdade Saber+', 'Curso Aprova', 'Escola de Idiomas Fala Aí'],
  Tecnologia: ['App Corre Já', 'Delivery Tá na Mão', 'StreamPlay', 'Nuvem Verde'],
  Seguros: ['Seguros Tá Tranquilo', 'Proteja Seguros'],
};
const mil = v => Math.round(v / 1e3) * 1e3;
// B = valor anual normal do patrocínio do clube; q = variação da proposta (±6%)
export const TIPOS = {
  fiel: { nome: 'Contrato longo', bom: 'Dinheiro garantido por duas temporadas, aconteça o que acontecer (caiu de divisão, continua pagando igual).', risco: 'Se o clube crescer (acesso, títulos, Libertadores), o valor fica preso no de hoje.',
    faz: (B, q) => ({ anos: 2, mensal: mil(B * 0.95 * q / 12) }) },
  titulo: { nome: 'Bônus por título', bom: 'Paga muito por cada título da temporada, até estadual.', risco: 'Sem título, fica só a mensalidade, a mais baixa das propostas.',
    faz: (B, q) => ({ anos: 1, mensal: mil(B * 0.7 * q / 12), titulo: { grande: mil(B * 0.45 * q), medio: mil(B * 0.25 * q), pequeno: mil(B * 0.08 * q) } }) },
  vitoria: { nome: 'Por vitória', bom: 'Cada vitória em jogo oficial (estadual e copas também) rende um bônus na hora.', risco: 'O bônus é pequeno: só compensa ganhando muito (uns 35 jogos no ano).',
    faz: (B, q) => ({ anos: 1, mensal: mil(B * 0.62 * q / 12), porVitoria: mil(B * 0.01 * q) }) },
  meta: { nome: 'Meta da diretoria', bom: 'Bônus grande se o time cumprir a meta do campeonato.', risco: 'Errou a meta, não ganha o bônus.',
    faz: (B, q) => ({ anos: 1, mensal: mil(B * 0.72 * q / 12), bonusMeta: mil(B * 0.35 * q) }) },
  luvas: { nome: 'Luvas na assinatura', bom: 'Um terço do ano entra de uma vez, na assinatura: alívio para o caixa agora.', risco: 'A mensalidade é menor e não tem bônus nenhum.',
    faz: (B, q) => ({ anos: 1, mensal: mil(B * 0.66 * q / 12), luvas: mil(B * 0.3 * q) }) },
  exigente: { nome: 'Cláusula de desempenho', bom: 'A maior mensalidade de todas.', risco: 'Se depois da 19ª rodada o time estiver 3 posições ou mais abaixo da meta da diretoria, a empresa rompe e para de pagar.',
    faz: (B, q) => ({ anos: 1, mensal: mil(B * 1.1 * q / 12), rompe: true }) },
};
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// o dia de hoje no jogo (último jogo ou semana da pré-temporada), nunca antes de 1º de janeiro do ano
const hojeDe = s => Math.max(+(s.ultimaData || 0), s.semanaBloco?.ano === s.ano ? s.semanaBloco.t : 0, Date.UTC(s.ano, 0, 1));
// garantido no ano (mensalidades e luvas), para comparar propostas
export const garantido = o => o.mensal * 12 + (o.luvas || 0);

export function ofertasPatrocinio(base, s) {
  const f = s.fin, ci = s.tecnico.clube;
  if (f.ofertasPatro?.ano === s.ano && f.ofertasPatro.ci === ci) return f.ofertasPatro;
  const r = rng(`patro${s.seed}-${ci}-${s.ano}`), B = patrocinio(base.clubes[ci], ci).valor, setores = shuffle(r, Object.keys(EMPRESAS));
  f.ofertasPatro = { ano: s.ano, ci, lista: shuffle(r, Object.keys(TIPOS)).slice(0, 3).map((tipo, k) => ({ tipo, setor: setores[k], marca: pick(r, EMPRESAS[setores[k]]), ...TIPOS[tipo].faz(B, 0.94 + r() * 0.12) })) };
  return f.ofertasPatro;
}

// assina a proposta i; auto: a diretoria escolhe a de mais dinheiro garantido (sem a cláusula de desempenho)
export function assinarPatrocinio(base, s, i, auto = false) {
  const f = s.fin; if (f.patro) return 'O clube já tem patrocinador master.';
  const L = ofertasPatrocinio(base, s).lista;
  if (auto) i = L.map((o, k) => [o, k]).filter(([o]) => !o.rompe).sort((a, b) => garantido(b[0]) - garantido(a[0]))[0]?.[1] ?? 0;
  const o = L[i]; if (!o) return 'Essa proposta não existe mais.';
  const hoje = hojeDe(s);
  f.patro = { ...o, ano0: s.ano, ate: s.ano + o.anos - 1, anoMes: s.ano, mes: new Date(hoje).getUTCMonth(), recebido: 0, vitorias: 0, rompido: false };
  f.patrocinador = o.marca; f.ofertasPatro = null;
  if (o.luvas) { lancar(s, 'patrocinio', `Luvas do patrocínio · ${o.marca}`, o.luvas); f.patro.recebido += o.luvas; }
  pagarPatrocinio(s, hoje);
  return null;
}

// mensalidades vencidas até hoje (dia 1º de cada mês)
export function pagarPatrocinio(s, hoje) {
  const P = s.fin?.patro; if (!P || P.rompido) return;
  if (P.anoMes !== s.ano) { P.anoMes = s.ano; P.mes = 0; }
  while (P.mes < 12 && +hoje >= Date.UTC(s.ano, P.mes, 1)) { lancar(s, 'patrocinio', `Patrocínio master · ${P.marca} (${MESES[P.mes]})`, P.mensal); P.recebido += P.mensal; P.mes++; }
}
// quanto ainda entra na temporada (para o orçamento); sem contrato ainda, a diretoria conta com o valor normal (B)
// nos meses que faltam, porque assina de qualquer jeito até a 1ª rodada
export function patrocinioRestante(s, B) {
  const P = s.fin?.patro;
  if (P === null) return 0.95 * B * (12 - new Date(hojeDe(s)).getUTCMonth()) / 12;
  return !P || P.rompido ? 0 : P.mensal * (12 - (P.anoMes === s.ano ? P.mes : 0));
}

// vitória em jogo oficial (chamado depois de cada jogo do técnico; amistoso não conta)
export function bonusVitoria(s) {
  const P = s.fin?.patro; if (!P?.porVitoria || P.rompido) return;
  P.vitorias++; P.recebido += P.porVitoria;
  lancar(s, 'patrocinio', `Bônus por vitória · ${P.marca}`, P.porVitoria);
}
// depois de cada rodada da Série A: cláusula de desempenho (3 posições ou mais abaixo da meta depois da 19ª rodada)
export function checarClausula(s, rd, pos, metaPos) {
  const P = s.fin?.patro; if (!P?.rompe || P.rompido || rd !== 18 || !pos || pos < metaPos + 3) return null;
  P.rompido = true;
  return `A ${P.marca} usou a cláusula de desempenho: com o time em ${pos}º, bem abaixo da meta da diretoria (${metaPos}º), rompeu o patrocínio e parou de pagar.`;
}
// fim da temporada: bônus de título e de meta; contrato vencido abre propostas novas
export function fecharPatrocinio(s, { bateuMeta, titulos }) {
  const f = s.fin, P = f.patro, N = [];
  if (P === undefined) { f.patro = null; return ['O contrato com o patrocinador master acabou. Três empresas já mandaram propostas: escolha na aba Patrocínio, em Finanças.']; }
  if (!P) return N;
  if (P.titulo && !P.rompido) for (const [nome, peso] of titulos) { lancar(s, 'patrocinio', `Bônus por título (${nome}) · ${P.marca}`, P.titulo[peso]); P.recebido += P.titulo[peso]; N.push(`A ${P.marca} pagou o bônus pelo título: ${nome}.`); }
  if (P.bonusMeta && !P.rompido && bateuMeta) { lancar(s, 'patrocinio', `Bônus pela meta cumprida · ${P.marca}`, P.bonusMeta); P.recebido += P.bonusMeta; N.push(`Meta cumprida: a ${P.marca} pagou o bônus.`); }
  if (P.ate <= s.ano || P.rompido) { f.patro = null; N.push(`Acabou o contrato com a ${P.marca}. Três empresas já mandaram propostas: escolha na aba Patrocínio, em Finanças.`); }
  return N;
}
