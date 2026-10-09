// Regionais: os estaduais e as copas regionais (Nordeste, Sul-Sudeste e Verde), entre os amistosos de janeiro e o
// Brasileirão (calendario.js). Não dão vaga em nada. Participantes, grupos e formatos são os reais de 2026 (federações
// estaduais, CBF, ge, Lance, RSSSF); no Paulistão, Carioca e Mineiro a 1ª fase usa a tabela real de jogos.
// Ficam de fora os torneios de consolação (Taça Rio, Troféu do Interior...), os quadrangulares de rebaixamento e as
// disputas de 3º lugar. Só o Paulista tem acesso e descenso entre A1 e A2; nos outros estados os clubes se repetem.
// Clube que não está nas Séries A, B e C entra com elenco gerado (div R). Valores de cota e prêmio estimados em euro
// a partir dos reais quando publicados (Paulistão, Carioca, Baiano, Cearense; zero onde a federação não paga prêmio).
import { pontosCorridos, datasRegionais } from './calendario.js';
import { penaltis } from './copa.js';
import { rng, shuffle } from './util.js';
import { clubesCont } from './continental.js';

// ---------- chaveamentos ----------
const top4 = L => [[L[0], L[3]], [L[1], L[2]]];
const cruz8 = L => [[L[0], L[7]], [L[3], L[4]], [L[1], L[6]], [L[2], L[5]]];   // na ordem do chaveamento: 1/8 × 4/5 e 2/7 × 3/6
const emPares = L => L.flatMap((x, i) => i % 2 ? [] : [[x, L[i + 1]]]);
const doGrupo = (C, e, g) => { const G = C.grupo(e, g); return [[G[0], G[3]], [G[1], G[2]]]; };               // 1º×4º e 2º×3º do grupo
const cruzados = (C, e, a, b) => { const A = C.grupo(e, a), B = C.grupo(e, b); return [[A[0], B[1]], [B[0], A[1]]]; }; // 1A×2B e 1B×2A
const QF = { nome: 'Quartas de final', curto: 'Quartas' }, SF = { nome: 'Semifinal', curto: 'Semi' }, FI = { nome: 'Final', curto: 'Final' };

// etapas: jogo turno (todos contra todos do grupo, uma vez), returno (ida e volta), outros (cada um enfrenta, uma vez,
// os clubes dos outros grupos — ou só do grupo par, com "pares") ou fixo (tabela real, pares de vagas em base 36).
// g = tamanho dos grupos na ordem de "clubes". mata: pernas 1 ou 2; empate 'vant' = passa a melhor campanha.
export const REGIONAIS = {
  SP: {
    nome: 'Campeonato Paulista', curto: 'Paulistão', uf: 'SP', datas: 'E',
    clubes: ['Corinthians', 'Palmeiras', 'Santos', 'São Paulo', 'Mirassol', 'Novorizontino', 'Bragantino', 'São Bernardo', 'Guarani', 'Ponte Preta', 'Portuguesa', 'Velo Clube', 'Botafogo-SP', 'Capivariano', 'Noroeste', 'Primavera-SP'],
    etapas: [{ jogo: 'fixo', g: [16], rodadas: 8, sobe: 8, fixo: ['7d 25 8f a1 09 bc e6 43', '58 da f4 12 9b ce 60 37', 'f5 ab d9 14 03 7e 6c 82', '51 ed 3a 46 97 20 cf b8', '74 9e 13 26 df 5c b0 a8', '89 0d c1 fa eb 67 45 32', 'a9 8c 57 3f e2 d4 b6 01', 'cd fe 4a 18 93 65 2b 70'] }],
    mata: [{ ...QF, chave: C => cruz8(C.geral(0)) }, { ...SF, chave: C => emPares(C.venc(0)) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) }],
    premio: { cota: 6e5, campeao: 8.3e5, vice: 2.75e5 },
    formato: '16 clubes numa tabela única: cada um faz 8 jogos, contra os 3 do seu pote (com os clássicos) e 5 sorteados. Os 8 primeiros vão às quartas (1º×8º, 2º×7º...); quartas e semi em jogo único na casa da melhor campanha, final em ida e volta. Os 2 últimos caem para a A2 e os finalistas da A2 sobem.',
  },
  SP2: {
    nome: 'Paulista Série A2', curto: 'Paulista A2', uf: 'SP', datas: 'T',
    clubes: ['Água Santa', 'Ferroviária', 'Ituano', 'São José-SP', 'Sertãozinho', 'Votuporanguense', 'Juventus-SP', 'XV de Piracicaba', 'Santo André', 'Osasco Sporting', 'Taubaté', 'Inter de Limeira', 'Linense', 'Monte Azul', 'Grêmio Prudente', 'São Bento'],
    etapas: [
      { jogo: 'turno', g: [16], rodadas: 15, sobe: 8, nome: '1ª fase', curto: '1ª fase' },
      { jogo: 'returno', rodadas: 6, sobe: 2, nome: '2ª fase', curto: '2ª fase', formar: C => { const L = C.geral(0); return [[L[0], L[2], L[5], L[7]], [L[1], L[3], L[4], L[6]]]; } },
    ],
    mata: [{ ...SF, pernas: 2, empate: 'vant', chave: C => cruzados(C, 1, 0, 1) }, { ...FI, pernas: 2, empate: 'vant', chave: C => emPares(C.venc(0)) }],
    premio: { cota: 6e4, campeao: 1e5, vice: 4e4 },
    formato: '16 clubes em turno único (15 rodadas). Os 8 primeiros formam dois grupos de 4 (1º, 3º, 6º e 8º / 2º, 4º, 5º e 7º) em ida e volta; os 2 de cada grupo vão à semi cruzada. Semi e final em ida e volta, sem pênaltis: empate no agregado classifica a melhor campanha. Os finalistas sobem para o Paulistão.',
  },
  RJ: {
    nome: 'Campeonato Carioca', curto: 'Carioca', uf: 'RJ', datas: 'E',
    clubes: ['Fluminense', 'Vasco', 'Volta Redonda', 'Bangu', 'Portuguesa-RJ', 'Sampaio Corrêa-RJ', 'Botafogo', 'Madureira', 'Boavista', 'Flamengo', 'Nova Iguaçu', 'Maricá'],
    etapas: [{ jogo: 'fixo', g: [6, 6], rodadas: 6, sobe: 4, nome: 'Taça Guanabara', curto: 'Taça GB', titulo: 'Taça Guanabara', fixo: ['07 39 28 1b 5a 46', '80 29 37 1a 56 4b', '91 62 b3 a0 75 84', '63 81 09 a2 74 b5', '58 a3 94 60 71 b2', '95 38 4a 0b 16 27'] }],
    mata: [{ ...QF, chave: C => [...doGrupo(C, 0, 0), ...doGrupo(C, 0, 1)] }, { ...SF, pernas: 2, chave: C => emPares(C.venc(0)) }, { ...FI, neutro: true, chave: C => emPares(C.venc(1)) }],
    premio: { cota: 5e5, campeao: 1.67e6, vice: 9.2e5 },
    formato: 'Taça Guanabara: 2 grupos de 6, e cada clube enfrenta uma vez os 6 do outro grupo; o líder geral leva a taça. Os 4 primeiros de cada grupo fazem as quartas dentro do grupo (1º×4º, 2º×3º) em jogo único, semi em ida e volta e final única no Maracanã.',
  },
  MG: {
    nome: 'Campeonato Mineiro', curto: 'Mineiro', uf: 'MG', datas: 'E',
    clubes: ['Atlético-MG', 'URT', 'Uberlândia', 'Democrata-GV', 'América-MG', 'Pouso Alegre', 'Tombense', 'Betim', 'Cruzeiro', 'North', 'Itabirito', 'Athletic'],
    etapas: [{ jogo: 'fixo', g: [4, 4, 4], rodadas: 8, sobe: 1, fixo: ['85 26 19 a3 4b 07', '34 b1 68 90 5a 72', '97 82 15 3b a4 06', '69 2a 5b 71 40 83', '95 24 1a b7 63 08', 'b2 50 41 39 a6 78', '7a 92 0b 53 61 84', '25 a0 37 49 b6 18'] }],
    mata: [
      { ...SF, pernas: 2, chave: C => { const lid = C.rank([0, 1, 2].map(g => C.grupo(0, g)[0])), seg = C.rank([0, 1, 2].map(g => C.grupo(0, g)[1]))[0]; return [[lid[0], seg], [lid[1], lid[2]]]; } },
      { ...FI, neutro: true, chave: C => emPares(C.venc(0)) },
    ],
    premio: { cota: 2.5e5, campeao: 3e5, vice: 1e5 },
    formato: '3 grupos de 4, e cada clube enfrenta uma vez os 8 dos outros grupos. Os 3 líderes e o melhor 2º vão à semi (o melhor líder pega o 2º colocado) em ida e volta; final única no Mineirão.',
  },
  RS: {
    nome: 'Campeonato Gaúcho', curto: 'Gauchão', uf: 'RS', datas: 'E', acumula: true,
    clubes: ['Internacional', 'Juventude', 'São José-RS', 'São Luiz', 'Avenida', 'Guarany de Bagé', 'Grêmio', 'Caxias', 'Ypiranga', 'Novo Hamburgo', 'Monsoon', 'Inter-SM'],
    etapas: [{ jogo: 'outros', g: [6, 6], rodadas: 6, sobe: 4 }],
    mata: [{ ...QF, chave: C => [...doGrupo(C, 0, 0), ...doGrupo(C, 0, 1)] }, { ...SF, pernas: 2, chave: C => top4(C.rank(C.venc(0))) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) }],
    premio: { cota: 2.5e5, campeao: 3e5, vice: 1e5 },
    formato: '2 grupos de 6, e cada clube enfrenta uma vez os 6 do outro grupo. Os 4 primeiros de cada grupo fazem as quartas dentro do grupo em jogo único; os 4 vencedores são reordenados pela campanha para a semi (1º×4º, 2º×3º). Semi e final em ida e volta.',
  },
  PR: {
    nome: 'Campeonato Paranaense', curto: 'Paranaense', uf: 'PR', datas: 'E', acumula: true,
    clubes: ['Athletico-PR', 'Londrina', 'Maringá', 'São Joseense', 'Cascavel', 'Foz do Iguaçu', 'Coritiba', 'Operário-PR', 'Cianorte', 'Azuriz', 'Andraus', 'Galo Maringá'],
    etapas: [{ jogo: 'outros', g: [6, 6], rodadas: 6, sobe: 4 }],
    mata: [{ ...QF, pernas: 2, chave: C => [...doGrupo(C, 0, 0), ...doGrupo(C, 0, 1)] }, { ...SF, pernas: 2, chave: C => emPares(C.venc(0)) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) }],
    premio: { cota: 1.5e5, campeao: 0, vice: 0 },
    formato: '2 grupos de 6, e cada clube enfrenta uma vez os 6 do outro grupo. Os 4 primeiros de cada grupo seguem em ida e volta dentro do próprio lado da chave até a final, que junta o campeão de cada grupo. A federação não paga premiação.',
  },
  SC: {
    nome: 'Campeonato Catarinense', curto: 'Catarinense', uf: 'SC', datas: 'E', acumula: true,
    clubes: ['Avaí', 'Brusque', 'Camboriú', 'Concórdia', 'Marcílio Dias', 'Joinville', 'Chapecoense', 'Criciúma', 'Barra', 'Figueirense', 'Santa Catarina', 'Carlos Renaux'],
    etapas: [{ jogo: 'outros', g: [6, 6], rodadas: 6, sobe: 4 }],
    mata: [{ ...QF, pernas: 2, chave: C => [...doGrupo(C, 0, 0), ...doGrupo(C, 0, 1)] }, { ...SF, pernas: 2, chave: C => { const v = C.venc(0); return [[v[0], v[3]], [v[2], v[1]]]; } }, { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) }],
    premio: { cota: 1e5, campeao: 1.5e5, vice: 5e4 },
    formato: '2 grupos de 6, e cada clube enfrenta uma vez os 6 do outro grupo. Os 4 primeiros de cada grupo fazem as quartas dentro do grupo; a semi cruza os grupos. Tudo em ida e volta, com a volta na casa da melhor campanha.',
  },
  GO: {
    nome: 'Campeonato Goiano', curto: 'Goianão', uf: 'GO', datas: 'E', acumula: true,
    clubes: ['Vila Nova', 'CRAC', 'Inhumas', 'Goiatuba', 'Goiás', 'Anápolis', 'Jataiense', 'Aparecidense', 'Atlético-GO', 'ABECAT', 'Centro Oeste', 'Anapolina'],
    etapas: [{ jogo: 'outros', g: [4, 4, 4], rodadas: 8, sobe: 8, geral: true }],
    mata: [{ ...QF, pernas: 2, chave: C => cruz8(C.geral(0)) }, { ...SF, pernas: 2, chave: C => top4(C.rank(C.venc(0))) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) }],
    premio: { cota: 8e4, campeao: 1e5, vice: 4e4 },
    formato: '3 grupos de 4, e cada clube enfrenta uma vez os 8 dos outros grupos, numa tabela geral. Os 8 primeiros fazem as quartas (1º×8º...); os vencedores são reordenados pela campanha para a semi. Tudo em ida e volta.',
  },
  BA: {
    nome: 'Campeonato Baiano', curto: 'Baiano', uf: 'BA', datas: 'E',
    clubes: ['Bahia', 'Vitória', 'Jacuipense', 'Juazeirense', 'Atlético-BA', 'Bahia de Feira', 'Barcelona de Ilhéus', 'Galícia', 'Jequié', 'Porto-BA'],
    etapas: [{ jogo: 'turno', g: [10], rodadas: 9, sobe: 4 }],
    mata: [{ ...SF, chave: C => top4(C.geral(0)) }, { ...FI, chave: C => emPares(C.venc(0)) }],
    premio: { cota: 1e5, campeao: 6.7e4, vice: 5e4 },
    formato: '10 clubes em turno único (9 rodadas). Os 4 primeiros vão à semi (1º×4º, 2º×3º); semi e final em jogo único na casa da melhor campanha.',
  },
  PE: {
    nome: 'Campeonato Pernambucano', curto: 'Pernambucano', uf: 'PE', datas: 'E',
    clubes: ['Sport', 'Náutico', 'Santa Cruz', 'Retrô', 'Decisão', 'Jaguar', 'Maguary', 'Vitória das Tabocas'],
    etapas: [{ jogo: 'turno', g: [8], rodadas: 7, sobe: 6 }],
    mata: [
      { ...QF, pernas: 2, diretos: C => C.geral(0).slice(0, 2), chave: C => { const L = C.geral(0); return [[L[2], L[5]], [L[3], L[4]]]; } },
      { ...SF, pernas: 2, chave: C => { const L = C.geral(0), v = C.venc(0); return [[L[0], v[1]], [L[1], v[0]]]; } },
      { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) },
    ],
    premio: { cota: 8e4, campeao: 0, vice: 0 },
    formato: '8 clubes em turno único (7 rodadas). 1º e 2º vão direto à semi; do 3º ao 6º jogam as quartas (3º×6º, 4º×5º). Todo o mata-mata em ida e volta. A federação não paga premiação.',
  },
  CE: {
    nome: 'Campeonato Cearense', curto: 'Cearense', uf: 'CE', datas: 'E',
    clubes: ['Fortaleza', 'Ferroviário', 'Maracanã', 'Horizonte', 'Quixadá', 'Ceará', 'Floresta', 'Iguatu', 'Tirol', 'Maranguape'],
    etapas: [
      { jogo: 'turno', g: [5, 5], rodadas: 5, sobe: 3, nome: '1ª fase', curto: '1ª fase' },
      { jogo: 'outros', rodadas: 3, sobe: 2, letras: 'CD', nome: '2ª fase', curto: '2ª fase', formar: C => [C.grupo(0, 0).slice(0, 3), C.grupo(0, 1).slice(0, 3)] },
    ],
    mata: [{ ...SF, pernas: 2, etapa: 1, chave: C => [0, 1].map(g => C.grupo(1, g).slice(0, 2)) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(0)) }],
    premio: { cota: 8e4, campeao: 3.3e4, vice: 1.5e4 },
    formato: '2 grupos de 5 em turno único dentro do grupo. Os 3 primeiros de cada grupo vão à 2ª fase (pontos zerados), enfrentando os 3 do outro grupo. 1º e 2º de cada grupo fazem a semi entre si; semi e final em ida e volta.',
  },
  AL: {
    nome: 'Campeonato Alagoano', curto: 'Alagoano', uf: 'AL', datas: 'E', acumula: true,
    clubes: ['CRB', 'ASA', 'CSA', 'CSE', 'Coruripe', 'Cruzeiro-AL', 'Murici', 'Penedense'],
    etapas: [{ jogo: 'turno', g: [8], rodadas: 7, sobe: 4 }],
    mata: [{ ...SF, pernas: 2, chave: C => top4(C.geral(0)) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(0)) }],
    premio: { cota: 4e4, campeao: 0, vice: 0 },
    formato: '8 clubes em turno único (7 rodadas). Os 4 primeiros vão à semi (1º×4º, 2º×3º); semi e final em ida e volta. O regulamento não prevê prêmio em dinheiro.',
  },
  SE: {
    nome: 'Campeonato Sergipano', curto: 'Sergipano', uf: 'SE', datas: 'E',
    clubes: ['Sergipe', 'Confiança', 'Itabaiana', 'Lagarto', 'América de Propriá', 'Atlético Gloriense', 'Desportiva Aracaju', 'Dorense', 'Falcon', 'Guarany-SE'],
    etapas: [{ jogo: 'turno', g: [10], rodadas: 9, sobe: 7 }],
    mata: [
      { nome: 'Eliminatória', curto: 'Eliminatória', diretos: C => C.geral(0).slice(0, 1), chave: C => { const L = C.geral(0); return [[L[1], L[6]], [L[2], L[5]], [L[3], L[4]]]; } },
      { ...SF, pernas: 2, chave: C => { const w = C.rank(C.venc(0)); return [[C.geral(0)[0], w[2]], [w[0], w[1]]]; } },
      { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) },
    ],
    premio: { cota: 4e4, campeao: 0, vice: 0 },
    formato: '10 clubes em turno único (9 rodadas). O 1º vai direto à semi; do 2º ao 7º jogam a eliminatória em jogo único (2º×7º, 3º×6º, 4º×5º). Na semi, o 1º pega o pior classificado; semi e final em ida e volta.',
  },
  PB: {
    nome: 'Campeonato Paraibano', curto: 'Paraibano', uf: 'PB', datas: 'E',
    clubes: ['Botafogo-PB', 'Sousa', 'Campinense', 'Treze', 'Serra Branca', 'Atlético-PB', 'Esporte de Patos', 'Nacional de Patos', 'Pombal', 'Confiança-PB'],
    etapas: [{ jogo: 'turno', g: [10], rodadas: 9, sobe: 4 }],
    mata: [{ ...SF, pernas: 2, chave: C => top4(C.geral(0)) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(0)) }],
    premio: { cota: 4e4, campeao: 3e4, vice: 1e4 },
    formato: '10 clubes em turno único (9 rodadas). Os 4 primeiros vão à semi (1º×4º, 2º×3º); semi e final em ida e volta.',
  },
  PA: {
    nome: 'Campeonato Paraense', curto: 'Parazão', uf: 'PA', datas: 'E',
    clubes: ['Remo', 'São Raimundo-PA', 'Capitão Poço', 'Tuna Luso', 'Cametá', 'Santa Rosa', 'Paysandu', 'São Francisco-PA', 'Bragantino-PA', 'Castanhal', 'Amazônia Independente', 'Águia de Marabá'],
    etapas: [{ jogo: 'outros', g: [6, 6], rodadas: 6, sobe: 8, geral: true }],
    mata: [{ ...QF, chave: C => cruz8(C.geral(0)) }, { ...SF, chave: C => emPares(C.venc(0)) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) }],
    premio: { cota: 8e4, campeao: 5e4, vice: 2e4 },
    formato: '2 grupos de 6, e cada clube enfrenta uma vez os 6 do outro grupo, numa tabela geral. Os 8 primeiros vão às quartas (1º×8º...); quartas e semi em jogo único, final em ida e volta.',
  },
  AM: {
    nome: 'Campeonato Amazonense', curto: 'Barezão', uf: 'AM', datas: 'E',
    clubes: ['Amazonas', 'Manauara', 'Parintins', 'Itacoatiara', 'Nacional-AM', 'Manaus', 'Princesa do Solimões', 'São Raimundo-AM'],
    etapas: [{ jogo: 'outros', g: [4, 4], rodadas: 4, sobe: 3, nome: '1º turno', curto: '1º turno' }, { jogo: 'turno', g: [4, 4], rodadas: 3, sobe: 3, nome: '2º turno', curto: '2º turno' }],
    mata: [
      { nome: '1º turno · Playoff', curto: 'Playoff', empate: 'vant', etapa: 0, diretos: C => [0, 1].map(g => C.grupo(0, g)[0]), chave: C => [0, 1].map(g => C.grupo(0, g).slice(1, 3)) },
      { nome: '1º turno · Semifinal', curto: 'Semi (1º t.)', etapa: 0, chave: C => [0, 1].map(g => [C.grupo(0, g)[0], C.venc(0)[g]]) },
      { nome: 'Final da Taça Rio Solimões', curto: 'Final (1º t.)', etapa: 0, titulos: ['Taça Rio Solimões'], chave: C => emPares(C.venc(1)) },
      { nome: '2º turno · Playoff', curto: 'Playoff', empate: 'vant', etapa: 1, diretos: C => [0, 1].map(g => C.grupo(1, g)[0]), chave: C => [[C.grupo(1, 0)[1], C.grupo(1, 1)[2]], [C.grupo(1, 1)[1], C.grupo(1, 0)[2]]] },
      { nome: '2º turno · Semifinal', curto: 'Semi (2º t.)', etapa: 1, chave: C => [[C.grupo(1, 0)[0], C.venc(3)[1]], [C.grupo(1, 1)[0], C.venc(3)[0]]] },
      { nome: 'Final da Taça Rio Negro', curto: 'Final (2º t.)', etapa: 1, titulos: ['Taça Rio Negro'], chave: C => emPares(C.venc(4)) },
      { nome: 'Final', curto: 'Final', neutro: true, chave: C => C.titulo('Taça Rio Solimões') === C.titulo('Taça Rio Negro') ? { campeao: C.titulo('Taça Rio Negro'), vice: C.perd(5)[0] } : [[C.titulo('Taça Rio Solimões'), C.titulo('Taça Rio Negro')]] },
    ],
    ordem: ['e0', 'm0', 'm1', 'm2', 'e1', 'm3', 'm4', 'm5', 'm6'],
    premio: { cota: 3e4, campeao: 0, vice: 0 },
    formato: 'Dois turnos com taça própria e os mesmos 2 grupos de 4. No 1º turno (Taça Rio Solimões) cada clube enfrenta os 4 do outro grupo; no 2º (Taça Rio Negro), os 3 do próprio grupo. Em cada turno o líder vai à semi e 2º e 3º fazem o playoff (empate classifica o melhor colocado). Os campeões dos turnos decidem o título em jogo único; quem ganha os dois é campeão direto. Sem premiação em dinheiro.',
  },
  MT: {
    nome: 'Campeonato Mato-Grossense', curto: 'Mato-Grossense', uf: 'MT', datas: 'E',
    clubes: ['Cuiabá', 'Primavera', 'Mixto', 'Luverdense', 'Operário-MT', 'Sport Sinop', 'Nova Mutum', 'Chapada', 'União Rondonópolis', 'Várzea Grande'],
    etapas: [{ jogo: 'turno', g: [10], rodadas: 9, sobe: 6 }],
    mata: [
      { ...QF, diretos: C => C.geral(0).slice(0, 2), chave: C => { const L = C.geral(0); return [[L[2], L[5]], [L[3], L[4]]]; } },
      { ...SF, pernas: 2, chave: C => { const L = C.geral(0), v = C.venc(0); return [[L[0], v[1]], [L[1], v[0]]]; } },
      { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) },
    ],
    premio: { cota: 5e4, campeao: 4e4, vice: 1.5e4 },
    formato: '10 clubes em turno único (9 rodadas). 1º e 2º vão direto à semi; do 3º ao 6º jogam as quartas em jogo único (3º×6º, 4º×5º). Semi e final em ida e volta.',
  },
  MA: {
    nome: 'Campeonato Maranhense', curto: 'Maranhense', uf: 'MA', datas: 'E', acumula: true,
    clubes: ['Maranhão', 'Imperatriz', 'Sampaio Corrêa', 'Moto Club', 'IAPE', 'Luminense', 'Tuntum', 'ITZ'],
    etapas: [{ jogo: 'turno', g: [8], rodadas: 7, sobe: 4 }],
    mata: [{ ...SF, pernas: 2, chave: C => top4(C.geral(0)) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(0)) }],
    premio: { cota: 3e4, campeao: 0, vice: 0 },
    formato: '8 clubes em turno único (7 rodadas). Os 4 primeiros vão à semi (1º×4º, 2º×3º); semi e final em ida e volta. Sem premiação em dinheiro.',
  },
  // ----- copas regionais (quartas-feiras); quem está na Libertadores ou na Sul-Americana não joga -----
  NE: {
    nome: 'Copa do Nordeste', curto: 'Nordestão', copa: true, datas: 'C',
    clubes: ['Vitória', 'ASA', 'Sousa', 'Itabaiana', 'Fluminense-PI', 'Juazeirense', 'CRB', 'Botafogo-PB', 'Confiança', 'Piauí', 'Ceará', 'Sport', 'América-RN', 'Imperatriz', 'Ferroviário', 'Fortaleza', 'Retrô', 'ABC', 'Maranhão', 'Jacuipense'],
    etapas: [{ jogo: 'outros', g: [5, 5, 5, 5], pares: [[0, 1], [2, 3]], rodadas: 5, sobe: 2 }],
    mata: [{ ...QF, chave: C => [...cruzados(C, 0, 0, 1), ...cruzados(C, 0, 2, 3)] }, { ...SF, pernas: 2, chave: C => emPares(C.venc(0)) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) }],
    ufs: [['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE']],
    premio: { cota: 3e5, vitoria: 4e4, mata: [1.5e5, 3e5, 5e5], campeao: 1.2e6 },
    formato: '20 clubes em 4 grupos de 5; cada um joga 5 vezes, contra os do grupo vizinho (A×B, C×D). Os 2 primeiros de cada grupo vão às quartas (1A×2B...), em jogo único na casa da melhor campanha; semi e final em ida e volta.',
  },
  SS: {
    nome: 'Copa Sul-Sudeste', curto: 'Sul-Sudeste', copa: true, datas: 'C',
    clubes: ['Sampaio Corrêa-RJ', 'Novorizontino', 'Caxias', 'Tombense', 'Cianorte', 'Chapecoense', 'Volta Redonda', 'São Bernardo', 'Juventude', 'América-MG', 'Operário-PR', 'Avaí'],
    etapas: [{ jogo: 'outros', g: [6, 6], rodadas: 6, sobe: 2 }],
    mata: [{ ...SF, pernas: 2, chave: C => cruzados(C, 0, 0, 1) }, { ...FI, pernas: 2, chave: C => emPares(C.venc(0)) }],
    ufs: [['SP', 'RJ', 'MG', 'PR', 'SC', 'RS']],
    premio: { cota: 2e5, vitoria: 3e4, mata: [2e5, 4e5], campeao: 8e5 },
    formato: '12 clubes em 2 grupos de 6; cada um joga 6 vezes, contra os do outro grupo. Os 2 primeiros de cada grupo vão à semi cruzada; semi e final em ida e volta.',
  },
  VE: {
    nome: 'Copa Verde', curto: 'Copa Verde', copa: true, datas: 'C',
    clubes: ['Nacional-AM', 'Paysandu', 'Independência', 'Guaporé', 'Trem', 'Grêmio Sampaio', 'Amazonas', 'Remo', 'Galvez', 'Gazin Porto Velho', 'Águia de Marabá', 'Monte Roraima',
      'Primavera', 'Vila Nova', 'Capital-DF', 'Rio Branco-ES', 'Araguaína', 'Operário-MS', 'Cuiabá', 'Atlético-GO', 'Gama', 'Porto Vitória', 'Tocantinópolis', 'Anápolis'],
    etapas: [{ jogo: 'turno', g: [6, 6, 6, 6], rodadas: 5, sobe: 2, regioes: ['Copa Norte', 'Copa Norte', 'Copa Centro-Oeste', 'Copa Centro-Oeste'] }],
    mata: [
      { ...QF, chave: C => [...cruzados(C, 0, 0, 1), ...cruzados(C, 0, 2, 3)] },
      { nome: 'Final regional', curto: 'Final reg.', pernas: 2, titulos: ['Copa Norte', 'Copa Centro-Oeste'], chave: C => emPares(C.venc(0)) },
      { ...FI, pernas: 2, chave: C => emPares(C.venc(1)) },
    ],
    ufs: [['AM', 'PA', 'AC', 'RO', 'AP', 'RR'], ['GO', 'DF', 'MT', 'MS', 'TO', 'ES']],
    premio: { cota: 1.2e5, vitoria: 2e4, mata: [8e4, 1.5e5, 2.5e5], campeao: 5e5 },
    formato: '24 clubes em 4 grupos de 6, em turno único dentro do grupo: A e B formam a Copa Norte; C e D, a Copa Centro-Oeste. Quartas em jogo único (1A×2B...); as finais regionais, em ida e volta, dão os títulos da Copa Norte e da Copa Centro-Oeste. Os dois campeões decidem a Copa Verde em ida e volta.',
  },
};
// estado dos clubes da base (para trocar, nas copas regionais, quem foi para a Libertadores/Sul-Americana)
const UF = { 'Athletico-PR': 'PR', Fluminense: 'RJ', Internacional: 'RS', Cruzeiro: 'MG', 'Grêmio': 'RS', Bahia: 'BA', Palmeiras: 'SP', Coritiba: 'PR', Remo: 'PA', 'São Paulo': 'SP', Santos: 'SP', 'Vitória': 'BA', Chapecoense: 'SC', Flamengo: 'RJ', Mirassol: 'SP', 'Atlético-MG': 'MG', Botafogo: 'RJ', Corinthians: 'SP', Vasco: 'RJ', Bragantino: 'SP',
  Fortaleza: 'CE', Sport: 'PE', Juventude: 'RS', 'Ceará': 'CE', 'Goiás': 'GO', Novorizontino: 'SP', Athletic: 'MG', 'Criciúma': 'SC', 'Atlético-GO': 'GO', CRB: 'AL', 'Vila Nova': 'GO', 'Cuiabá': 'MT', 'Operário-PR': 'PR', 'Avaí': 'SC', 'São Bernardo': 'SP', 'Botafogo-SP': 'SP', Londrina: 'PR', 'América-MG': 'MG', 'Ponte Preta': 'SP', 'Náutico': 'PE',
  Amazonas: 'AM', 'Volta Redonda': 'RJ', 'Santa Cruz': 'PE', Barra: 'SC', 'Ferroviária': 'SP', Figueirense: 'SC', Paysandu: 'PA', Caxias: 'RS', Guarani: 'SP', Itabaiana: 'SE', Brusque: 'SC', Floresta: 'CE', 'Confiança': 'SE', 'Maranhão': 'MA', Ypiranga: 'RS', 'Inter de Limeira': 'SP', 'Maringá': 'PR', Ituano: 'SP', 'Botafogo-PB': 'PB', 'Anápolis': 'GO' };
export const ESTADUAIS = Object.keys(REGIONAIS).filter(k => !REGIONAIS[k].copa), COPAS_REG = Object.keys(REGIONAIS).filter(k => REGIONAIS[k].copa);

// ---------- fases e datas ----------
const FASES = {};
export function fasesReg(k) {
  if (FASES[k]) return FASES[k];
  const S = REGIONAIS[k], L = [];
  for (const x of S.ordem || [...S.etapas.map((_, e) => 'e' + e), ...S.mata.map((_, m) => 'm' + m)]) {
    const i = +x.slice(1);
    if (x[0] === 'e') {
      const E = S.etapas[i], nome = E.nome || (S.etapas[0].g.length > 1 ? 'Fase de grupos' : 'Primeira fase');
      for (let r = 0; r < E.rodadas; r++) L.push({ e: i, r, nome: `${nome} · ${r + 1}ª rodada`, curto: `${E.curto || 'Rodada'} ${r + 1}` });
    } else {
      const M = S.mata[i];
      if ((M.pernas || 1) === 1) L.push({ m: i, perna: 'unico', nome: M.nome, curto: M.curto });
      else L.push({ m: i, perna: 'ida', nome: `${M.nome} · ida`, curto: `${M.curto} (ida)` }, { m: i, perna: 'volta', nome: `${M.nome} · volta`, curto: `${M.curto} (volta)` });
    }
  }
  return FASES[k] = L;
}
const DATAS = {};
export const dataFaseReg = (ano, k, i) => (DATAS[`${ano}${k}`] ||= datasRegionais(ano, REGIONAIS[k].datas, fasesReg(k).length))[i];
// o jogo da fase decide alguma coisa? (mata-mata que elimina, e final de verdade)
export const mataMataReg = F => F.m != null && F.perna !== 'ida';
export const finalReg = (k, F) => mataMataReg(F) && (F.m === REGIONAIS[k].mata.length - 1 || !!REGIONAIS[k].mata[F.m].titulos);

// ---------- tabelas e campanha ----------
function linhas(T, ids, filtro) {
  const L = new Map(ids.map(c => [c, { clube: c, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, ult: [] }]));
  for (const j of T.jogos) if (filtro(j)) for (const [c, eu, ele] of [[j.h, j.gols[0], j.gols[1]], [j.a, j.gols[1], j.gols[0]]]) {
    const l = L.get(c); if (!l) continue;
    l.j++; l.gp += eu; l.gc += ele; l.ult.push(eu > ele ? 'V' : eu < ele ? 'D' : 'E');
    if (eu > ele) { l.v++; l.p += 3; } else if (eu < ele) l.d++; else { l.e++; l.p++; }
  }
  return [...L.values()].map(l => ({ ...l, sg: l.gp - l.gc }));
}
const ordenar = (a, b) => b.p - a.p || b.v - a.v || b.sg - a.sg || b.gp - a.gp || a.clube - b.clube;
// classificação de uma etapa: só os jogos daquela etapa (cada etapa começa do zero)
export const tabelaReg = (T, e, ids) => linhas(T, ids, j => j.e === e).sort(ordenar);
// campanha para mando e desempate: a etapa pedida, ou todas as fases de grupos (com o mata-mata, se o regulamento soma)
const campanha = (T, c, e) => linhas(T, [c], j => e != null ? j.e === e : j.e != null || !!REGIONAIS[T.k].acumula)[0];
const ordem = (T, x, y, e) => ordenar(campanha(T, x, e), campanha(T, y, e)) <= 0 ? [x, y] : [y, x];
function ctx(T, e) {
  return {
    grupo: (et, g) => tabelaReg(T, et, T.etapas[et].grupos[g]).map(l => l.clube),
    geral: et => tabelaReg(T, et, T.etapas[et].grupos.flat()).map(l => l.clube),
    venc: m => T.res[m].map(x => x.venc), perd: m => T.res[m].map(x => x.perd),
    rank: L => L.slice().sort((x, y) => ordenar(campanha(T, x, e), campanha(T, y, e))),
    titulo: t => T.titulos[t],
  };
}

// ---------- tabela de jogos ----------
const fatiar = (L, g) => { let i = 0; return g.map(n => L.slice(i, i += n)); };
// mando alternado: quem jogou menos em casa até ali recebe
function mandos(rodadas) {
  const casa = new Map();
  return rodadas.map(rd => rd.map(([a, b]) => { const [h, v] = (casa.get(a) || 0) <= (casa.get(b) || 0) ? [a, b] : [b, a]; casa.set(h, (casa.get(h) || 0) + 1); return [h, v]; }));
}
// divide os jogos em rodadas em que todo mundo joga uma vez (casamento perfeito por busca, com recomeço)
function agendar(jogos, seed) {
  const r = rng(seed), times = [...new Set(jogos.flat())], nr = jogos.length * 2 / times.length;
  const casar = resto => {
    const usado = new Set(), esc = [];
    const dfs = () => {
      const t = times.find(x => !usado.has(x)); if (t == null) return true;
      for (const j of resto) if (j.includes(t) && !usado.has(j[0]) && !usado.has(j[1])) {
        usado.add(j[0]); usado.add(j[1]); esc.push(j);
        if (dfs()) return true;
        esc.pop(); usado.delete(j[0]); usado.delete(j[1]);
      }
      return false;
    };
    return dfs() ? esc : null;
  };
  for (let t = 0; t < 200; t++) {
    let resto = shuffle(r, jogos); const rodadas = [];
    while (rodadas.length < nr) { const rd = casar(resto); if (!rd) break; rodadas.push(rd); resto = resto.filter(j => !rd.includes(j)); }
    if (rodadas.length === nr) return mandos(rodadas);
  }
  throw new Error('regionais: tabela impossível');
}
function montarEtapa(T, e) {
  const S = REGIONAIS[T.k], E = S.etapas[e], seed = `reg${T.seed}-${T.k}${T.ano}-${e}`;
  const grupos = E.formar ? E.formar(ctx(T)) : fatiar(T.clubes, E.g);
  let rodadas;
  if (E.jogo === 'fixo') rodadas = E.fixo.map(rd => rd.split(' ').map(p => [T.clubes[parseInt(p[0], 36)], T.clubes[parseInt(p[1], 36)]]));
  else if (E.jogo === 'outros' && (E.pares || grupos.length === 2)) {
    // cada clube enfrenta os do grupo par; mando alternado
    rodadas = Array.from({ length: E.rodadas }, (_, f) => (E.pares || [[0, 1]]).flatMap(([x, y]) => grupos[x].map((c, i) => { const o = grupos[y][(i + f) % grupos[y].length]; return (i + f) % 2 ? [o, c] : [c, o]; })));
  } else if (E.jogo === 'outros') rodadas = agendar(grupos.flatMap((g, gi) => g.flatMap(c => grupos.slice(gi + 1).flat().map(o => [c, o]))), seed);
  else {
    const porGrupo = grupos.map((g, gi) => pontosCorridos(g, `${seed}-${gi}`).slice(0, E.jogo === 'returno' ? undefined : g.length % 2 ? g.length : g.length - 1));
    rodadas = porGrupo[0].map((_, r) => porGrupo.flatMap(x => x[r] || []));
  }
  T.etapas[e] = { grupos, rodadas };
}

// ---------- montagem do ano ----------
function nomesParaIndices(base, nomes, k) {
  return nomes.map(n => { const i = base.clubes.findIndex(c => c.n === n && c.div !== 'L'); if (i < 0) throw new Error(`regionais ${k}: clube "${n}" não existe`); return i; });
}
function participantes(base, s, k, ant, troca) {
  const S = REGIONAIS[k];
  let clubes = s.ano === 2026 || !ant?.[k]?.clubes ? nomesParaIndices(base, S.clubes, k) : ant[k].clubes.slice();
  if (troca && (k === 'SP' || k === 'SP2')) { const [de, para] = k === 'SP' ? [troca.caem, troca.sobem] : [troca.sobem, troca.caem]; clubes = clubes.map(c => de.includes(c) ? para[de.indexOf(c)] : c); }
  if (!S.copa || s.ano === 2026) return clubes;
  // copa regional: quem está na Libertadores/Sul-Americana sai; entra o mais forte da mesma região (A, B ou C) que ainda não joga
  const conm = new Set(['LIB', 'SUL'].flatMap(x => clubesCont(s, x))), usados = new Set(clubes);
  const a2 = new Set(ant?.SP2?.clubes || []);   // a A2 joga também nas quartas: não cabe copa regional
  const regiao = i => { const n = S.ufs.length > 1 ? Math.floor(i / (clubes.length / S.ufs.length)) : 0; return S.ufs[n]; };
  return clubes.map((ci, i) => {
    if (!conm.has(ci)) return ci;
    const sub = base.clubes.map((c, j) => j).filter(j => ['A', 'B', 'C'].includes(base.clubes[j].div) && regiao(i).includes(UF[base.clubes[j].n]) && !usados.has(j) && !conm.has(j) && !a2.has(j))
      .sort((a, b) => base.forca(b) - base.forca(a))[0];
    if (sub == null) return ci;
    usados.add(sub); return sub;
  });
}
export function novaReg(base, s) {
  const ant = s.reg?.v === 2 ? s.reg : null, sp = ant?.SP, sp2 = ant?.SP2;
  // acesso e descenso no Paulista: os 2 últimos da A1 descem, os finalistas da A2 sobem
  const troca = sp?.etapas?.[0] && sp2?.campeao != null ? { caem: tabelaReg(sp, 0, sp.etapas[0].grupos[0]).slice(-2).map(l => l.clube), sobem: [sp2.campeao, sp2.vice] } : null;
  const r = { v: 2, ano: s.ano };
  // save de antes desta versão no meio da temporada: os regionais deste ano ficam de fora
  if (s.rodada > 0) { s.reg = { ...r, pulado: true }; return s.reg; }
  for (const k of Object.keys(REGIONAIS)) {
    const T = { k, ano: s.ano, seed: s.seed, clubes: participantes(base, s, k, ant, troca), etapas: [], fase: 0, jogos: [], chaves: [], res: [], titulos: {}, campeao: null, vice: null };
    montarEtapa(T, 0);
    r[k] = T;
  }
  s.reg = r;
  return s.reg;
}

// ---------- jogos de cada fase ----------
export function jogosDaFaseReg(T) {
  const F = fasesReg(T.k)[T.fase];
  if (!F) return [];
  if (F.e != null) return T.etapas[F.e].rodadas[F.r] || [];
  return T.chaves.map(([x, y]) => F.perna === 'ida' ? [y, x] : [x, y]);   // chave = [melhor campanha, outro]: o melhor manda o jogo único e a volta
}
const ativo = (s, k) => { const T = s.reg?.[k]; return !!T && T.ano === s.ano && T.fase < fasesReg(k).length; };
export const naReg = (s, k, ci) => ativo(s, k) && jogosDaFaseReg(s.reg[k]).some(j => j.includes(ci));
// competições do clube no ano (estadual primeiro)
export const regsDe = (s, ci) => s.reg?.v === 2 ? Object.keys(REGIONAIS).filter(k => s.reg[k]?.clubes.includes(ci)) : [];
export const emQualReg = (s, ci) => regsDe(s, ci)[0] || null;
// fase pendente: a data dela já chegou antes da próxima rodada do Brasileirão (ou da data pedida)
export const regDevida = (s, k, ate) => ativo(s, k) && +dataFaseReg(s.ano, k, s.reg[k].fase) < +ate;
// agregado da ida, visto do mandante da volta
export function agregadoReg(T, h, a) { const ida = T.jogos.find(j => j.fase === T.fase - 1 && j.h === a && j.a === h); return ida ? [ida.gols[1], ida.gols[0]] : [0, 0]; }

// decide o jogo (ou o confronto, na volta) e devolve o vencedor
export function decidirReg(T, h, a, gols, seed, campo) {
  const F = fasesReg(T.k)[T.fase];
  if (F.e != null || F.perna === 'ida') return {};
  const M = REGIONAIS[T.k].mata[F.m];
  let ag = gols;
  if (F.perna === 'volta') { const [x, y] = agregadoReg(T, h, a); ag = [gols[0] + x, gols[1] + y]; }
  const agg = F.perna === 'volta' ? ag : null;
  if (ag[0] !== ag[1]) return { vencedor: ag[0] > ag[1] ? h : a, agg };
  if (M.empate === 'vant') return { vencedor: ordem(T, h, a, M.etapa)[0], agg, vantagem: true };
  const pen = penaltis(seed, campo);
  return { vencedor: pen[0] > pen[1] ? h : a, pen: [pen[0], pen[1]], agg };
}
// fecha a fase e monta a próxima
export function avancarReg(T, vencedores) {
  const S = REGIONAIS[T.k], fases = fasesReg(T.k), F = fases[T.fase++], prox = fases[T.fase];
  if (F.e != null) {
    if (prox?.e === F.e) return;
    const E = S.etapas[F.e];
    if (E.titulo) T.titulos[E.titulo] = ctx(T).geral(F.e)[0];
  } else {
    if (F.perna === 'ida') return;                                            // a chave segue para a volta
    T.res[F.m] = T.chaves.map((par, i) => ({ par, venc: vencedores[i], perd: par.find(c => c !== vencedores[i]) }));
    S.mata[F.m].titulos?.forEach((t, i) => { T.titulos[t] = vencedores[i]; });
    if (!prox) { T.campeao = vencedores[0]; T.vice = T.res[F.m][0].perd; T.chaves = []; return; }
  }
  T.chaves = [];
  if (prox.e != null) { montarEtapa(T, prox.e); return; }
  const M = S.mata[prox.m], C = ctx(T, M.etapa), c = M.chave(C);
  if (c.campeao != null) { Object.assign(T, { campeao: c.campeao, vice: c.vice, fase: fases.length }); return; }
  if (M.diretos) T.diretos = M.diretos(C);                               // quem espera a próxima fase sem jogar esta
  T.chaves = c.map(([x, y]) => M.neutro ? [x, y] : ordem(T, x, y, M.etapa));
}
// o clube ainda está vivo na competição?
export function vivoReg(T, ci) {
  const F = fasesReg(T.k)[T.fase];
  if (!F) return false;
  if (F.e != null) return !!T.etapas[F.e]?.grupos.flat().includes(ci);
  return T.chaves.some(c => c.includes(ci)) || (!!T.diretos?.includes(ci) && !T.res.some(r => r?.some(x => x.perd === ci)));
}
export function campanhaReg(s, k, ci) {
  const T = s.reg?.[k]; if (!T?.clubes?.includes(ci)) return null;
  if (T.campeao === ci) return 'Campeão';
  if (T.vice === ci) return 'Vice-campeão';
  const tit = Object.entries(T.titulos).find(([, c]) => c === ci)?.[0], F = fasesReg(k)[T.fase];
  if (T.ano === s.ano && vivoReg(T, ci)) return `${F.e != null ? F.nome.split(' · ')[0] : `Na disputa (${F.curto})`}${tit ? ` · campeão da ${tit}` : ''}`;
  const ult = T.jogos.filter(j => j.h === ci || j.a === ci).at(-1), fases = fasesReg(k);
  return `${ult && ult.e == null ? `Eliminado (${fases[ult.fase].curto})` : 'Eliminado na primeira fase'}${tit ? ` · campeão da ${tit}` : ''}`;
}
