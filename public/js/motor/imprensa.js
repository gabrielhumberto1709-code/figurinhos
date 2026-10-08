// Coletiva pós-jogo: três perguntas tiradas do que aconteceu (resultado, personagens, tabela, cargo, vestiário).
// Cada tom de resposta agrada uma plateia e incomoda outra (grupo, torcida, diretoria); jogador citado sente
// na moral; reclamar da arbitragem pode virar denúncia no STJD. As respostas viram notícia e formam o seu perfil.
import { rng, pick, clamp, shuffle } from './util.js';
import { tabela, janelaAberta, proximoEvento, previa, escalacao, compProxima } from './mundo.js';
import { confronto, sequencia, resumoConfronto } from './confrontos.js';
import { F_MATA, F_FIN, FASES_CONT } from './continental.js';
import { FASES } from './copa.js';
import { REGIONAIS } from './regionais.js';
// estadual é masculino (o Campeonato Paulista, o Paulistão); copa é feminino
const ARTIGO = comp => /^(Campeonato|Paulista)/.test(comp) ? { na: 'no', da: 'do', pela: 'pelo' } : { na: 'na', da: 'da', pela: 'pela' };
import { indisponivel } from './dm.js';
import { pilares } from './carreira.js';
import { rivais } from './rivais.js';
import { metaDiretoria, folhaDia, lancar } from './financas.js';

export const TONS = {
  confiante: { rot: 'Confiante', sobe: 'T', desce: 'D', jog: 4 },
  motivacional: { rot: 'Motivacional', sobe: 'G', desce: 'D', jog: 3 },
  protege: { rot: 'Protege o elenco', sobe: 'G', desce: 'T', jog: 5 },
  diplomatica: { rot: 'Diplomática', sobe: 'D', desce: 'T', jog: 1 },
  autocritica: { rot: 'Autocrítica', sobe: 'D', desce: 'G', jog: 2 },
  cobra: { rot: 'Cobra os jogadores', sobe: 'T', desce: 'G', jog: -6 },
  irritada: { rot: 'Irritada', sobe: 'T', desce: 'D', jog: -8 },
  cautelosa: { rot: 'Cautelosa', jog: 0 },
};
export const PLATEIA = { G: 'Grupo', T: 'Torcida', D: 'Diretoria' };
const DUROS = ['cobra', 'irritada'], SUAVES = ['protege', 'diplomatica', 'motivacional'];
const BOM = ['confiante', 'motivacional', 'protege', 'diplomatica', 'cautelosa', 'autocritica', 'cobra'];
const RUIM = ['autocritica', 'protege', 'cobra', 'irritada', 'cautelosa', 'motivacional', 'diplomatica'];
const FORA = ['confiante', 'diplomatica', 'cautelosa', 'irritada', 'cobra', 'protege', 'motivacional'];
const REPORTERES = [['Paulinho Pena', 'Rádio Bola de Meia'], ['Cida Moraes', 'TV Escanteio'], ['Beto Cardoso', 'Portal Impedido'], ['Lúcia Faro', 'Jornal da Bola'], ['Jair Trivela', 'Rádio Trivela'], ['Nanda Reis', 'Canal do Torcedor'], ['Gérson Mota', 'Gazeta do Gramado'], ['Rose Antunes', 'Web Rádio Pelada'], ['Dudu Brandão', 'Placar Eletrônico'], ['Marta Leme', 'Revista Meia-Lua']];

// perguntas por tema (o peso diz quando o tema aparece; 0 = não cabe)
const TEMAS = {
  vitoria: { tons: BOM, q: ['O que deu certo hoje contra o {adv}?', '{placar} contra o {adv}. O time encontrou o caminho?', 'Vitória importante. Qual foi a chave do jogo?'] },
  classicoV: { tons: BOM, q: ['Vitória no clássico! O que significa bater o {adv}?', 'A cidade é sua essa semana. Recado para o torcedor do {adv}?'] },
  classicoD: { tons: RUIM, q: ['Perder clássico dói mais?', 'O torcedor não perdoa derrota pro {adv}. O que você diz pra ele?'] },
  goleada: { tons: BOM, q: ['Goleada sobre o {adv}. Foi a melhor atuação do ano?', '{placar}! Dá pra sonhar alto com esse futebol?'] },
  empate: { tons: [...BOM, 'irritada'], q: ['Empate com o {adv}. Ponto ganho ou dois perdidos?', 'O time criou, mas não venceu. O que faltou?'] },
  derrota: { tons: RUIM, q: ['O que faltou contra o {adv}?', 'A torcida saiu do estádio na bronca. O que você diz pra ela?', 'Derrota para o {adv}. Onde o time errou?'] },
  sofreuGoleada: { tons: RUIM, q: ['{placar}. Como explicar um resultado desses?', 'Foi a pior atuação desde que você chegou?'] },
  destaque: { tons: BOM, jog: true, q: ['{j} foi o melhor em campo. O que ele tem de diferente?', '{j} decidiu. Ele já é o dono do time?'] },
  criticado: { tons: RUIM, jog: true, q: ['{j} teve uma noite difícil. Ele segue entre os titulares?', 'A torcida pegou no pé de {j}. Você ainda confia nele?'] },
  expulsao: { tons: RUIM, jog: true, q: ['A expulsão de {j} mudou o jogo. Faltou cabeça?', '{j} deixou o time com um a menos. Vai ter punição interna?'] },
  penalti: { tons: RUIM, jog: true, q: ['{j} perdeu o pênalti. Ele continua batendo?'] },
  arbitragem: { tons: ['irritada', 'diplomatica', 'cautelosa', 'autocritica'], q: ['Você viu erro da arbitragem hoje?', 'O apito pesou contra o seu time?'] },
  lesao: { tons: ['cautelosa', 'protege', 'motivacional', 'confiante', 'irritada'], jog: true, q: ['{j} saiu machucado. Preocupa?', 'Como fica o time sem {j}?'] },
  virada: { tons: BOM, q: ['Que virada! O que você falou no vestiário?', 'Saiu atrás e virou. Isso mostra o quê sobre o grupo?'] },
  levouVirada: { tons: RUIM, q: ['Estava ganhando e perdeu. O que aconteceu?', 'O time apagou depois de abrir o placar. Falta preparo?'] },
  golNoFim: { tons: BOM, q: ['Gol no apagar das luzes. Coração aguenta?', 'Decidido no fim. Sorte ou insistência?'] },
  levouNoFim: { tons: RUIM, q: ['Sofrer gol no fim dói mais?', 'Faltou segurar o resultado nos minutos finais?'] },
  maFase: { tons: RUIM, q: ['São {n} derrotas nos últimos jogos. Você se sente ameaçado?', 'O que mudar para sair dessa sequência?'] },
  semVencer: { tons: RUIM, q: ['Já são {n} jogos sem vencer. Quando vem a vitória?'] },
  boaFase: { tons: BOM, q: ['{n} vitórias seguidas. Até onde vai esse time?', 'A sequência é boa. Dá pra pensar em título?'] },
  lider: { tons: BOM, q: ['Líder com {pts} pontos. O favorito agora é vocês?'] },
  titulo: { tons: BOM, q: ['{pos}º lugar e a liderança ali perto. Dá pra ser campeão?'] },
  rebaixamento: { tons: RUIM, q: ['O time está em {pos}º, na zona de perigo. Dá pra escapar?', 'A palavra rebaixamento já assusta o vestiário?'] },
  diretoria: { tons: FORA, q: ['A diretoria anda impaciente. Você conversou com o presidente?', 'Seu cargo está em risco?'] },
  ultimato: { tons: FORA, q: ['A diretoria deu um ultimato. Dá tempo de virar a chave?'] },
  torcida: { tons: FORA, q: ['A torcida está na bronca com você. O que você responde?'] },
  janela: { tons: FORA, q: ['A janela está aberta. Vem reforço?', 'O elenco precisa de peças novas?'] },
  encostado: { tons: FORA, jog: true, q: ['{j} não entra há {n} jogos. Ele está fora dos planos?'] },
  insatisfeito: { tons: FORA, jog: true, q: ['Dizem que {j} anda insatisfeito. Como está a relação?'] },
  renovacao: { tons: FORA, jog: true, q: ['O contrato de {j} termina no fim do ano. Ele renova?'] },
  salarios: { tons: FORA, q: ['Os salários estão atrasados. Como manter o grupo focado?'] },
  eliminado: { tons: RUIM, q: ['A eliminação {na} {comp} dói?', 'Fora {da} {comp}. O ano perdeu o sentido?'] },
  classificado: { tons: BOM, q: ['Classificado {na} {comp}. Dá pra sonhar com o título?'] },
  campeao: { tons: BOM, q: ['É campeão! O que esse título significa?', 'Título {da} {comp}. Pra quem você dedica?'] },
  vice: { tons: RUIM, q: ['Bateu na trave {na} {comp}. O que faltou?', 'Vice {da} {comp}. Dá pra tirar algo de bom?'] },
  meta: { tons: FORA, q: ['A meta é {meta}. Está ao alcance?'] },
  proximo: { tons: FORA, q: ['Qual o recado para o próximo jogo, contra o {adv2}?', 'O {adv2} vem aí. Muda alguma coisa?'] },
  retro: { tons: FORA, q: ['Contra o {adv}, agora são {retro}. O que esse retrospecto diz?', 'No histórico contra o {adv}: {retro}. Dá pra falar em freguesia?'] },
  tabuQuebrado: { tons: BOM, q: ['Acabou o tabu: eram {n} jogos sem vencer o {adv}. Alívio?', 'Fazia {n} jogos que vocês não ganhavam do {adv}. O que mudou hoje?'] },
};

// respostas: primeiro as do tema, senão as gerais do tom (B: depois de resultado bom, R: ruim, F: fora de campo/futuro)
const GERAL = {
  B: {
    confiante: ['O time fez o que treinou. E ainda tem mais pra mostrar.', 'Esse grupo é forte. Quem acompanha sabe que não foi sorte.', 'Pode anotar: esse time vai longe.'],
    motivacional: ['Ganhar é bom, mas o grupo quer mais. A fome continua.', 'Comemora hoje, amanhã já é treino. O caminho é esse.'],
    protege: ['O mérito é todo dos jogadores. Eles compraram a ideia.', 'Esse elenco merece cada elogio. Trabalham demais.'],
    diplomatica: ['Vitória de todo mundo: elenco, comissão, diretoria e torcida.', 'Agradeço o apoio da diretoria. O trabalho está aparecendo.'],
    cautelosa: ['Um jogo de cada vez. Não dá pra se empolgar.', 'Foi bom, mas o campeonato é longo.'],
    autocritica: ['O resultado veio, mas tenho coisas a corrigir no meu trabalho.', 'Demorei a mexer no time. Preciso ser mais rápido.'],
    cobra: ['Não me enganou. Dá pra jogar muito mais.', 'Teve gente que relaxou no segundo tempo. Vou cobrar.'],
    irritada: ['Quando a gente ganha ninguém pergunta nada, né?', 'Agora todo mundo é amigo. Semana passada era outra conversa.'],
  },
  R: {
    confiante: ['Fase ruim não é time ruim. Isso vira.', 'Conheço esse grupo. Vamos dar a resposta em campo.', 'Esse time vai reagir. Não tenho dúvida nenhuma.'],
    motivacional: ['O torcedor pode acreditar: a virada começa no próximo treino.', 'Quem veste essa camisa tem que entrar pra vencer. E vamos vencer.', 'Ninguém aqui desiste. A resposta vem no próximo jogo.'],
    protege: ['Se tem culpado, sou eu. Os jogadores deram tudo em campo.', 'Ninguém vai crucificar jogador meu. Eu respondo pelo time.', 'Esse grupo não merece ser massacrado. Eles vão dar a volta.', 'Quem quiser bater, bate em mim. Os jogadores eu protejo.'],
    diplomatica: ['Respeito a cobrança. Vamos trabalhar em silêncio.', 'Entendo a frustração de todos. Juntos a gente sai dessa.', 'A crítica faz parte. Quem está aqui tem que saber lidar.', 'Conversei com a diretoria e estamos todos do mesmo lado.'],
    cautelosa: ['Prefiro rever o jogo com calma antes de falar.', 'Vamos analisar e conversar internamente.', 'De cabeça quente ninguém decide nada. Amanhã a gente conversa.', 'Não é hora de apontar dedo. É hora de entender o que aconteceu.'],
    autocritica: ['Errei na escalação e assumo. Vou corrigir.', 'Minha leitura do jogo não foi boa. A responsabilidade é minha.', 'Demorei pra mexer. Isso pesa na minha conta.'],
    cobra: ['Do jeito que jogamos hoje não dá. Vou cobrar de cada um.', 'Faltou atitude. Isso eu não aceito.', 'Tem jogador que precisa entender onde está. Quem não correr vai pro banco.'],
    irritada: ['Vocês só aparecem quando a gente perde.', 'Não vou ficar dando satisfação a cada jogo. Próxima.', 'Já respondi isso semana passada. Próxima pergunta.', 'Querem manchete? Não vão ter.'],
  },
  F: {
    confiante: ['Estou tranquilo. O trabalho vai falar por si.', 'Tenho convicção no que estamos fazendo.'],
    motivacional: ['O grupo está mordido. Vocês vão ver em campo.', 'É hora de todo mundo remar junto, dentro e fora de campo.'],
    protege: ['O elenco está fechado comigo. Isso é o que importa.', 'Meus jogadores têm o meu respeito, e eu tenho o deles.'],
    diplomatica: ['Converso com todos no clube. Estamos alinhados.', 'Respeito todas as opiniões. Cada um faz a sua parte.', 'Tudo é conversado internamente. Não vou expor ninguém.'],
    cautelosa: ['Prefiro não antecipar nada. Vamos ver no dia a dia.', 'É cedo pra falar disso.', 'Vamos com calma. Uma coisa de cada vez.'],
    autocritica: ['Tenho que fazer mais, e sei disso.', 'Sou o primeiro a cobrar o meu trabalho.'],
    cobra: ['Quem não estiver a fim vai ficar de fora. Simples assim.', 'O nível de exigência aqui vai subir.'],
    irritada: ['Essa pergunta não faz o menor sentido. Próxima.', 'Não vou alimentar fofoca.', 'Isso é assunto interno. Próxima.'],
  },
};
// um tema por grupo em cada coletiva (não faz três perguntas sobre a mesma derrota)
const GRUPO = { classicoV: 'res', classicoD: 'res', vitoria: 'res', goleada: 'res', empate: 'res', derrota: 'res', sofreuGoleada: 'res', virada: 'res', levouVirada: 'res', golNoFim: 'res', levouNoFim: 'res', maFase: 'seq', semVencer: 'seq', boaFase: 'seq', lider: 'tab', titulo: 'tab', rebaixamento: 'tab', meta: 'tab', diretoria: 'cargo', ultimato: 'cargo', torcida: 'cargo', eliminado: 'res', classificado: 'res', campeao: 'res', vice: 'res' };
const famDe = T => T.tons === BOM ? 'B' : T.tons === RUIM ? 'R' : 'F';
const RESP = {
  classicoV: { confiante: ['Clássico se ganha na raça, e hoje sobrou raça.'], irritada: ['Eles falaram demais durante a semana. Respondemos em campo.'], diplomatica: ['Respeito muito o {adv}. Hoje fomos melhores.'], protege: ['A vitória é do grupo. Eles sabiam o tamanho desse jogo.'] },
  classicoD: { autocritica: ['Não preparei o time como devia. Clássico não perdoa.'], cobra: ['Perder clássico desse jeito é inaceitável. Vou cobrar um por um.'], irritada: ['Não vou ficar dando entrevista pra falar de rival.'], motivacional: ['Ainda tem o returno. A resposta vem.'] },
  vitoria: { confiante: ['O time fez exatamente o que treinou. É só o começo.'], cobra: ['Venceu, mas não me enganou. Dá pra jogar muito mais.'], autocritica: ['Ganhamos, mas eu demorei a mexer. Preciso ser mais rápido.'] },
  goleada: { confiante: ['Esse é o nosso nível. Quem duvidou vai ter que engolir.'], cautelosa: ['Placar elástico engana. Semana que vem é outra história.'] },
  derrota: { protege: ['Os jogadores não merecem a crítica. A culpa é minha.'], cobra: ['Faltou coragem. Teve gente que se escondeu hoje.'], irritada: ['Derrota faz parte. Querem que eu chore aqui?'] },
  sofreuGoleada: { autocritica: ['Fui o primeiro a errar. Peço desculpas ao torcedor.'], cobra: ['Vergonha. Não tem outra palavra. Vou cobrar um por um.'], irritada: ['Não vou ficar explicando goleada. Acontece.'] },
  destaque: { confiante: ['{j} é craque. Vai ser convocado, escrevam.'], protege: ['{j} é um menino de ouro. Trabalha mais que todo mundo.'], cobra: ['{j} jogou bem, mas tem obrigação de jogar assim sempre.'], cautelosa: ['{j} foi bem, como o time todo. Não gosto de individualizar.'] },
  criticado: { protege: ['{j} é titular e vai continuar sendo. Ponto.'], cobra: ['{j} sabe que não jogou nada. Vamos conversar.'], irritada: ['Se {j} não quer jogar, tem quem queira.'], motivacional: ['{j} vai dar a volta por cima. Conheço o caráter dele.'] },
  expulsao: { cobra: ['{j} deixou os companheiros na mão. Vai ser multado.'], protege: ['{j} errou, mas é o jogador mais dedicado do grupo.'], irritada: ['O vermelho foi exagero. O juiz quis aparecer.'] },
  penalti: { protege: ['{j} continua batendo. Só perde quem tem coragem de bater.'], cobra: ['Pênalti se treina. {j} vai treinar até acertar.'] },
  arbitragem: { irritada: ['A arbitragem foi uma vergonha. Alguém precisa explicar aquele lance.', 'Erraram contra nós de novo. Não é coincidência.'], diplomatica: ['Não vou falar de arbitragem. Erramos nós.'], cautelosa: ['Vou rever as imagens antes de falar qualquer coisa.'], autocritica: ['Juiz nenhum perdeu esse jogo. Fomos nós.'] },
  lesao: { cautelosa: ['Vamos esperar os exames. O departamento médico vai avaliar.'], protege: ['{j} vai ter todo o nosso suporte. Volta mais forte.'], irritada: ['O calendário está matando os jogadores. Ninguém aguenta.'] },
  maFase: { confiante: ['Fase ruim não é time ruim. Isso vira.'], protege: ['O grupo está fechado comigo. Ninguém larga a mão de ninguém.'], irritada: ['Ameaçado? Eu trabalho, quem demite é a diretoria.'] },
  lider: { cautelosa: ['Liderança agora não ganha nada. É no fim que se conta.'], confiante: ['Estamos em primeiro porque merecemos. E queremos ficar.'] },
  rebaixamento: { motivacional: ['Ninguém aqui vai cair. Vamos lutar até a última rodada.'], cobra: ['Quem não sentir o tamanho do clube vai sair.'] },
  diretoria: { diplomatica: ['Converso com o presidente toda semana. Estamos alinhados.'], irritada: ['Se quiserem me tirar, que tirem. Eu não vou mudar meu trabalho.'], confiante: ['Meu cargo depende de resultado, e o resultado vai vir.'] },
  janela: { confiante: ['O elenco é bom. Se vier alguém, que venha pra somar.'], cobra: ['Pedi reforços e estou esperando. O elenco é curto.'], diplomatica: ['A diretoria sabe das necessidades. Confio no trabalho dela.'] },
  encostado: { protege: ['{j} é importante e vai ter a chance dele.'], cobra: ['{j} precisa treinar mais pra jogar. Simples assim.'], diplomatica: ['A porta está aberta pra todo mundo, inclusive pro {j}.'] },
  insatisfeito: { protege: ['Minha relação com {j} é ótima. Isso é fofoca.'], cobra: ['Insatisfeito? Que mostre no treino.'], irritada: ['Quem quiser sair, a porta é a serventia da casa.'] },
  renovacao: { confiante: ['{j} fica. Pode escrever.'], diplomatica: ['Isso é com a diretoria e o empresário. Torço pra ele ficar.'], cobra: ['Primeiro ele precisa jogar o que sabe. Depois a gente fala de contrato.'] },
  salarios: { protege: ['O grupo é profissional e segue trabalhando. Tem o meu respeito.'], irritada: ['Ninguém trabalha de graça. A diretoria precisa resolver.'], diplomatica: ['É um problema que a diretoria está resolvendo. Confio nela.'] },
  campeao: { confiante: ['Esse título é só o começo. Quero mais.'], protege: ['O título é dos jogadores. Eles foram gigantes.'], diplomatica: ['Dedico à torcida e à diretoria, que confiaram no trabalho.'], cautelosa: ['Hoje é dia de comemorar. Amanhã a gente volta ao trabalho.'], motivacional: ['Esse grupo provou que pode ganhar tudo.'], cobra: ['Ganhamos, mas tem coisa pra melhorar já no próximo jogo.'], autocritica: ['Errei bastante no caminho. O mérito é todo deles.'] },
  vice: { irritada: ['Vice não é fracasso. Quem fala isso nunca disputou uma final.'], protege: ['Tenho orgulho desse grupo. Chegamos onde ninguém esperava.'], cobra: ['Final não se joga, se ganha. Faltou ambição.'], autocritica: ['Perdi a final no banco. Mexi mal.'], motivacional: ['Essa dor vai virar combustível.'] },
  eliminado: { autocritica: ['Dói, e a culpa é minha. Não preparei bem o time.'], motivacional: ['Agora é foco total no campeonato.'], irritada: ['Ninguém aqui prometeu título de copa.'] },
  retro: { confiante: ['O histórico mostra quem manda nesse confronto.'], cautelosa: ['Retrospecto não entra em campo. Cada jogo é um jogo.'], diplomatica: ['Respeito muito o {adv}. É sempre jogo duro.'] },
  tabuQuebrado: { confiante: ['Tabu existe pra ser quebrado. Esse grupo quebrou.'], motivacional: ['Hoje a torcida pode comemorar em dobro.'], irritada: ['Tabu é coisa de jornalista. Eu nunca acreditei nisso.'] },
  proximo: { confiante: ['Vamos lá pra ganhar. Respeito, mas sem medo.'], cautelosa: ['É um adversário difícil. Vamos estudar bem.'], irritada: ['O {adv2} que se preocupe com a gente.'] },
};

// ---------- montagem ----------
export const chaveDe = s => s.ultima ? `${s.ano}|${s.ultima.div}|${s.ultima.rodada}|${s.ultima.casa}|${s.ultima.fora}|${s.ultima.copa || ''}` : null;

function contexto(base, s) {
  const u = s.ultima, ci = s.tecnico.clube, t = u.casa === ci ? 0 : 1, my = u.gols[t], ot = u.gols[1 - t], adv = t ? u.casa : u.fora, J = id => base.jog.get(+id);
  const venceu = u.pen && my === ot ? u.pen[t] > u.pen[1 - t] : my > ot, perdeu = u.pen && my === ot ? !venceu : my < ot;
  const notas = Object.entries(u.notas[t]).map(([id, n]) => [J(id), n]).filter(([j]) => j?.clube === ci).sort((a, b) => b[1] - a[1]);
  const ev = (tipo, time = t) => u.eventos.filter(e => e.tipo === tipo && e.time === time);
  // placar ao longo do jogo: virada e gol no fim
  let p = [0, 0], frente = { eu: false, eles: false }, fim = null;
  for (const e of u.eventos.filter(e => e.tipo === 'gol')) { p[e.time]++; if (p[t] > p[1 - t]) frente.eu = true; if (p[t] < p[1 - t]) frente.eles = true; if (e.min >= 85) fim = e; }
  const d = base.clubes[ci].div, tab = tabela(base, s, d), l = tab.find(x => x.clube === ci), pos = tab.indexOf(l) + 1;
  const ult = l.ultimos, seq = (r) => { let n = 0; for (let i = ult.length - 1; i >= 0 && ult[i] === r; i--) n++; return n; };
  const top = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).slice(0, 14);
  const prox = proximoEvento(base, s);
  const mataMata = (u.div === 'copa' && !/· ida$/.test(u.copa || '')) || u.div === 'SUP' || (['LIB', 'SUL'].includes(u.div) && !/Grupos|· ida$/.test(u.copa || '')) || (REGIONAIS[u.div] && !/rodada$|· ida$/.test(u.copa || ''));
  const final = u.div === 'SUP' || /Final · volta$|· Final$/.test(u.copa || '');
  return {
    ci, adv, my, ot, venceu, perdeu, classico: rivais(base, u.casa, u.fora), placar: `${u.gols[0]} a ${u.gols[1]}`, notas, d, tab, l, pos, P: pilares(base, s), meta: metaDiretoria(base, s),
    destaque: notas[0]?.[1] >= 7.4 ? notas[0][0] : null, criticado: notas.at(-1)?.[1] <= 5.6 ? notas.at(-1)[0] : null,
    expulso: J(ev('vermelho')[0]?.jogador), lesionado: J(ev('lesao')[0]?.jogador),
    penPerdido: J(u.eventos.find(e => e.penalti && e.tipo !== 'gol' && e.time === t)?.jogador),
    arbitragem: perdeu && (ev('vermelho').length || u.eventos.some(e => e.penalti && e.time === 1 - t)),
    virada: venceu && frente.eles, levouVirada: perdeu && frente.eu, golNoFim: fim && fim.time === t && venceu, levouNoFim: fim && fim.time !== t && !venceu,
    derrotas: ult.slice(-4).filter(x => x === 'D').length, semVencer: (() => { let n = 0; for (let i = ult.length - 1; i >= 0 && ult[i] !== 'V'; i--) n++; return n; })(), vitorias: seq('V'),
    comp: u.copa ? (u.div === 'copa' ? 'Copa do Brasil' : u.copa.split(' · ')[0]) : null, mataMata, final,
    adv2: prox ? (prox.h === ci ? prox.a : prox.h) : null,
    janela: janelaAberta(s.ano, s.rodada),
    encostado: top.find(j => (s.semJogar?.[j.id] || 0) >= 3 && j.ovr >= 72), insatisfeito: top.find(j => (s.mor?.[j.id] ?? 62) < 35 && j.ovr >= 70),
    renova: s.rodada >= 19 ? top.find(j => j.contrato <= s.ano && j.ovr >= 76) : null,
    H: confronto(s, ci, adv), tabu: (() => { const H = confronto(s, ci, adv); if (!H || !venceu) return 0; let n = 0; for (let i = H.ult.length - 2; i >= 0 && H.ult[i] !== 'v'; i--) n++; return n; })(),
  };
}

function pesos(c, s) {
  const j = c.l.j;
  return {
    classicoV: c.classico && c.venceu ? 9 : 0, classicoD: c.classico && c.perdeu ? 9 : 0,
    vitoria: c.venceu && c.my - c.ot < 3 ? 5 : 0, goleada: c.venceu && c.my - c.ot >= 3 ? 7 : 0, empate: !c.venceu && !c.perdeu ? 5 : 0,
    derrota: c.perdeu && c.ot - c.my < 3 ? 5 : 0, sofreuGoleada: c.perdeu && c.ot - c.my >= 3 ? 8 : 0,
    destaque: c.destaque ? 4 : 0, criticado: c.criticado ? 4 : 0, expulsao: c.expulso ? 6 : 0, penalti: c.penPerdido ? 6 : 0, arbitragem: c.arbitragem ? 5 : 0, lesao: c.lesionado ? 4 : 0,
    virada: c.virada ? 6 : 0, levouVirada: c.levouVirada ? 6 : 0, golNoFim: c.golNoFim ? 5 : 0, levouNoFim: c.levouNoFim ? 5 : 0,
    maFase: c.derrotas >= 3 ? 6 : 0, semVencer: c.semVencer >= 4 ? 5 : 0, boaFase: c.vitorias >= 3 ? 5 : 0,
    lider: j >= 5 && c.pos === 1 ? 4 : 0, titulo: j >= 12 && c.pos > 1 && c.pos <= 3 ? 3 : 0, rebaixamento: j >= 8 && c.pos >= 17 ? 5 : 0,
    diretoria: c.P.D < 45 ? 4 : 0, ultimato: s.cargo?.ult ? 7 : 0, torcida: c.P.T < 40 ? 4 : 0, janela: c.janela ? 2 : 0,
    encostado: c.encostado ? 3 : 0, insatisfeito: c.insatisfeito ? 3 : 0, renovacao: c.renova ? 2 : 0, salarios: s.fin?.atraso ? 6 : 0,
    eliminado: c.mataMata && !c.final && c.perdeu ? 7 : 0, classificado: c.mataMata && !c.final && c.venceu ? 5 : 0, campeao: c.final && c.venceu ? 10 : 0, vice: c.final && c.perdeu ? 9 : 0, meta: j >= 6 ? 1.5 : 0, proximo: c.adv2 != null ? 1.5 : 0,
    retro: c.H?.j >= 3 ? 2.5 : 0, tabuQuebrado: c.tabu >= 3 ? 8 : 0,
  };
}
const JOG_TEMA = { destaque: 'destaque', criticado: 'criticado', expulsao: 'expulso', penalti: 'penPerdido', lesao: 'lesionado', encostado: 'encostado', insatisfeito: 'insatisfeito', renovacao: 'renova' };

export function abrirColetiva(base, s) {
  const k = chaveDe(s); if (!k) return null;
  if (s.coletiva?.chave === k) return s.coletiva;
  const c = contexto(base, s), r = rng(`coletiva${s.seed}${k}`), w = pesos(c, s), recentes = s.colUsados || [];
  const disp = Object.entries(w).filter(([, v]) => v > 0).map(([t, v]) => [t, v * (recentes.includes(t) ? 0.3 : 1)]);
  const temas = [];
  while (temas.length < 3 && disp.length) {
    let x = r() * disp.reduce((a, b) => a + b[1], 0), i = 0;
    for (; i < disp.length - 1; i++) { x -= disp[i][1]; if (x <= 0) break; }
    const t = disp.splice(i, 1)[0][0]; temas.push(t);
    if (GRUPO[t]) for (let k = disp.length - 1; k >= 0; k--) if (GRUPO[disp[k][0]] === GRUPO[t]) disp.splice(k, 1);
  }
  const usadas = new Set();
  const frase = (t, tom, fill) => { const T = TEMAS[t], op = [...(RESP[t]?.[tom] || []), ...GERAL[famDe(T)][tom]].filter(x => !usadas.has(x)), f = op[0] && RESP[t]?.[tom]?.includes(op[0]) ? op[0] : pick(r, op.length ? op : GERAL[famDe(T)][tom]); usadas.add(f); return fill(f); };
  const nome = ci => base.clubes[ci]?.n || '';
  const reps = shuffle(r, REPORTERES);
  const perguntas = temas.map((t, i) => {
    const T = TEMAS[t], j = T.jog ? c[JOG_TEMA[t]] : null;
    const n = t === 'maFase' ? c.derrotas : t === 'semVencer' ? c.semVencer : t === 'boaFase' ? c.vitorias : t === 'encostado' ? s.semJogar?.[j?.id] : t === 'tabuQuebrado' ? c.tabu : 0;
    const fill = txt => txt.replace(/\{j\}/g, j?.curto || '').replace(/\{adv\}/g, nome(c.adv)).replace(/\{adv2\}/g, nome(c.adv2)).replace(/\{placar\}/g, c.placar).replace(/\{pos\}/g, c.pos).replace(/\{pts\}/g, c.l.p).replace(/\{n\}/g, n).replace(/\{retro\}/g, c.H ? resumoConfronto(c.H) : '').replace(/\{(na|da|pela)\} (?=\{comp\})/g, (_, x) => ARTIGO(c.comp || 'copa')[x]).replace(/\{comp\}/g, c.comp || 'copa').replace(/\{meta\}/g, c.meta.txt);
    // 4 tons: pelo menos um duro e um suave
    const tons = shuffle(r, T.tons), duro = tons.find(x => DUROS.includes(x)), suave = tons.find(x => SUAVES.includes(x));
    const esc = [...new Set([duro, suave, ...tons].filter(Boolean))].slice(0, 4);
    return { tema: t, jogador: j?.id ?? null, reporter: reps[i % reps.length], texto: fill(pick(r, T.q)), respostas: shuffle(r, esc).map(tom => ({ tom, texto: frase(t, tom, fill) })) };
  });
  s.coletiva = { chave: k, quente: c.classico || c.mataMata || c.ot - c.my >= 3 || c.derrotas >= 3 || !!s.cargo?.ult, perguntas, respostas: [], feita: false };
  return s.coletiva;
}

// ---------- coletiva pré-jogo ----------
// perguntas sobre o jogo que vem: clássico, favoritismo, retrospecto (tabu, freguesia), desfalques, decisão, estreia, pressão
const PRE = ['confiante', 'cautelosa', 'motivacional', 'diplomatica', 'irritada', 'protege', 'cobra'];
const TEMAS_PRE = {
  preClassico: { q: ['Semana de clássico contra o {adv}. Como está o clima?', 'Clássico é jogo à parte. O {adv} chega melhor?'] },
  preFavorito: { q: ['Vocês entram como favoritos contra o {adv}. Isso pesa?', 'Todo mundo espera vitória contra o {adv}. Como lidar com isso?'] },
  preZebra: { q: ['O {adv} é favorito. Dá pra surpreender?', 'Contra um adversário mais forte, qual o plano?'] },
  preRetro: { q: ['No histórico contra o {adv}: {retro}. Isso conta amanhã?', 'O retrospecto contra o {adv} é de {retro}. O que você tira disso?'] },
  preTabu: { q: ['Já são {n} jogos sem vencer o {adv}. Amanhã acaba o tabu?', 'O {adv} virou pedra no sapato: {n} jogos sem vitória. O que muda?'] },
  preFreguesia: { q: ['O {adv} não vence vocês há {n} jogos. Virou freguês?', 'São {n} jogos sem perder para o {adv}. Dá pra manter?'] },
  preGoleada: { q: ['A maior vitória sobre o {adv} foi {placar}. Dá pra repetir?'] },
  preDesfalque: { jog: true, q: ['Sem {j}, como fica o time contra o {adv}?', 'A ausência de {j} preocupa?'] },
  preDecisao: { q: ['Jogo decisivo {pela} {comp}. Como o grupo chega?', 'Mata-mata contra o {adv}. Tem receita pra esse tipo de jogo?'] },
  preFinal: { q: ['Final {da} {comp}. O que você vai falar no vestiário?', 'Uma final contra o {adv}. O grupo está pronto?'] },
  preEstreia: { q: ['Estreia no Brasileirão contra o {adv}. Qual a expectativa?', 'Começa a temporada. A meta é {meta}. Dá pra cumprir?'] },
  preMaFase: { q: ['O time vem de {n} derrotas. Esse jogo é de recuperação?', 'Mais uma derrota contra o {adv} e a pressão aumenta. Como o grupo está?'] },
  preBoaFase: { q: ['São {n} vitórias seguidas. Dá pra manter contra o {adv}?'] },
  prePressao: { q: ['Dizem que seu cargo depende desse jogo contra o {adv}. Você sente isso?', 'A diretoria está de olho. Esse jogo é decisivo pra você?'] },
  preLider: { q: ['Líder do campeonato, obrigação de vencer o {adv}?'] },
  preRebaixamento: { q: ['Na zona de rebaixamento, esse jogo contra o {adv} é uma final?'] },
  preAdversario: { q: ['Onde o {adv} pode machucar vocês?', 'Qual a maior virtude do {adv}?'] },
  preTorcida: { q: ['Qual o recado para o torcedor antes desse jogo?', 'A torcida pode esperar o quê contra o {adv}?'] },
  preTime: { q: ['O time está definido para enfrentar o {adv}?', 'Vai ter mudança na escalação?'] },
};
const RESP_PRE = {
  preClassico: { confiante: ['Clássico a gente não joga, a gente ganha.'], cautelosa: ['Clássico não tem favorito. Vamos com respeito.'], irritada: ['Eles falam demais. Em campo a gente conversa.'], motivacional: ['Quero o estádio pulsando. Esse jogo é da torcida.'] },
  preFavorito: { confiante: ['Somos favoritos porque trabalhamos pra isso.'], cautelosa: ['Favoritismo não entra em campo.'], diplomatica: ['Respeito o {adv}. Vai ser difícil.'] },
  preZebra: { confiante: ['Ninguém ganha de véspera. Vamos lá pra vencer.'], motivacional: ['É nesse tipo de jogo que o grupo cresce.'], cautelosa: ['Vamos jogar com inteligência e aproveitar as chances.'], irritada: ['Podem continuar subestimando a gente.'] },
  preRetro: { confiante: ['O retrospecto é bom, mas eu quero mais.'], cautelosa: ['Histórico não ganha jogo. O que vale é amanhã.'], motivacional: ['Vamos escrever mais uma página bonita contra o {adv}.'] },
  preTabu: { confiante: ['Tabu existe pra ser quebrado. E vai ser amanhã.'], cautelosa: ['Não vamos jogar contra o passado. É um jogo novo.'], irritada: ['Tabu é coisa de vocês. Eu não acredito nisso.'], motivacional: ['O grupo está mordido. Esse tabu cai.'] },
  preFreguesia: { confiante: ['Freguês é freguês.'], diplomatica: ['Respeito muito o {adv}. Histórico não entra em campo.'], cautelosa: ['Cada jogo é uma história. Não dá pra relaxar.'] },
  preGoleada: { confiante: ['Se o time jogar o que sabe, pode sair de novo.'], cautelosa: ['Aquele jogo já passou. Amanhã é outra história.'] },
  preDesfalque: { protege: ['Quem entrar vai dar conta. Confio no grupo todo.'], cautelosa: ['Faz falta, claro. Mas temos opções.'], irritada: ['O calendário está matando os jogadores.'] },
  preDecisao: { confiante: ['Esse grupo nasceu pra jogo grande.'], cautelosa: ['Mata-mata é detalhe. Concentração total.'], motivacional: ['Quero ver sangue nos olhos amanhã.'] },
  preFinal: { motivacional: ['Final é pra quem tem coragem. E nós temos.'], cautelosa: ['Final se joga com calma e cabeça no lugar.'], confiante: ['Viemos até aqui pra levantar a taça.'] },
  preEstreia: { confiante: ['Esse time vai brigar lá em cima.'], cautelosa: ['Um passo de cada vez. A meta é clara.'], diplomatica: ['A diretoria montou um bom elenco. Agora é com a gente.'] },
  preAdversario: { cautelosa: ['É um time organizado. Vamos respeitar.'], confiante: ['Estudamos o {adv}. Sabemos onde atacar.'], diplomatica: ['O {adv} tem um bom trabalho. Vai ser jogo grande.'] },
  preTorcida: { motivacional: ['Quero o torcedor junto do início ao fim. Ele faz diferença.'], confiante: ['Pode vir pro estádio que o time vai dar alegria.'], protege: ['O grupo vai deixar tudo em campo. Isso eu garanto.'] },
  preTime: { cautelosa: ['O time sai no vestiário. Não vou entregar nada.'], confiante: ['Está definido. E está forte.'], cobra: ['Quem treinou melhor vai jogar. Simples assim.'] },
  prePressao: { protege: ['Meu cargo não importa. Importa o grupo.'], irritada: ['Meu cargo depende de resultado desde sempre. Nada de novo.'], confiante: ['Estou tranquilo. O time vai responder.'] },
};
const GRUPO_PRE = { preFavorito: 'fav', preZebra: 'fav', preRetro: 'h2h', preTabu: 'h2h', preFreguesia: 'h2h', preGoleada: 'h2h', preMaFase: 'seq', preBoaFase: 'seq', preDecisao: 'mm', preFinal: 'mm', preLider: 'tab', preRebaixamento: 'tab' };
const chaveEv = ev => `pre|${ev.tipo}-${ev.rodada ?? ev.fase ?? ev.i ?? 0}-${ev.h}-${ev.a}`;
export const chavePre = (base, s) => { const ev = proximoEvento(base, s); return ev ? `${s.ano}|${chaveEv(ev)}` : null; };
export const prePendente = (base, s) => { const k = chavePre(base, s); const ev = k && proximoEvento(base, s); return !!k && ev.tipo !== 'amistoso' && !(s.coletivaPre?.chave === k && (s.coletivaPre.feita || s.coletivaPre.pulada)); };

export function abrirColetivaPre(base, s) {
  const k = chavePre(base, s), ev = k && proximoEvento(base, s); if (!k || ev.tipo === 'amistoso') return null;
  if (s.coletivaPre?.chave === k) return s.coletivaPre;
  const ci = s.tecnico.clube, adv = ev.h === ci ? ev.a : ev.h, nome = c => base.clubes[c]?.n || '', r = rng(`colpre${s.seed}${k}`);
  const p = previa(base, s, ev), H = confronto(s, ci, adv), sq = H ? sequencia(H) : { semVencer: 0, semPerder: 0 };
  const comp = compProxima(base, s), top = base.elencos[ci].slice().sort((a, b) => b.ovr - a.ovr).slice(0, 8), fora = top.find(j => indisponivel(s, j.id, comp));
  const d = base.clubes[ci].div, tab = tabela(base, s, d), l = tab.find(x => x.clube === ci), pos = tab.indexOf(l) + 1, ult = l.ultimos;
  const seq = x => { let n = 0; for (let i = ult.length - 1; i >= 0 && ult[i] === x; i--) n++; return n; };
  const mataMata = (ev.tipo === 'copa' && FASES[ev.fase].perna === 'volta') || ev.tipo === 'sup' || (ev.tipo === 'cont' && ev.fase >= F_MATA && FASES_CONT[ev.fase].perna !== 'ida') || (ev.tipo === 'reg' && ev.mataMata), final = ev.tipo === 'sup' || (ev.tipo === 'cont' && ev.fase === F_FIN) || (ev.tipo === 'reg' ? ev.final : /Final/.test(ev.titulo));
  const compNome = ev.tipo === 'copa' ? 'Copa do Brasil' : ev.titulo.split(' · ')[0];
  const w = {
    preClassico: rivais(base, ev.h, ev.a) ? 9 : 0, preFavorito: p.vitoria >= 55 ? 4 : 0, preZebra: p.vitoria <= 25 ? 5 : 0,
    preRetro: H?.j >= 2 ? 4 : 0, preTabu: sq.semVencer >= 3 ? 7 : 0, preFreguesia: sq.semPerder >= 3 && H?.v >= 3 ? 6 : 0, preGoleada: H?.maior && H.maior[0] - H.maior[1] >= 3 ? 3 : 0,
    preDesfalque: fora ? 5 : 0, preDecisao: mataMata && !final ? 7 : 0, preFinal: final ? 10 : 0, preEstreia: ev.tipo === 'liga' && s.rodada === 0 ? 8 : 0,
    preMaFase: ult.slice(-4).filter(x => x === 'D').length >= 3 ? 5 : 0, preBoaFase: seq('V') >= 3 ? 4 : 0, prePressao: s.cargo?.ult || s.cargo?.st === 'risco' ? 6 : 0,
    preLider: l.j >= 5 && pos === 1 ? 3 : 0, preRebaixamento: l.j >= 8 && pos >= 17 ? 4 : 0,
    preAdversario: 1.5, preTorcida: 1.2, preTime: 1.2,   // sempre cabem: completam as três perguntas
  };
  const disp = Object.entries(w).filter(([, v]) => v > 0), temas = [];
  while (temas.length < 3 && disp.length) {
    let x = r() * disp.reduce((a, b) => a + b[1], 0), i = 0;
    for (; i < disp.length - 1; i++) { x -= disp[i][1]; if (x <= 0) break; }
    const t = disp.splice(i, 1)[0][0]; temas.push(t);
    if (GRUPO_PRE[t]) for (let k2 = disp.length - 1; k2 >= 0; k2--) if (GRUPO_PRE[disp[k2][0]] === GRUPO_PRE[t]) disp.splice(k2, 1);
  }
  const usadas = new Set(), reps = shuffle(r, REPORTERES);
  const perguntas = temas.map((t, i) => {
    const T = TEMAS_PRE[t], j = T.jog ? fora : null, n = t === 'preTabu' ? sq.semVencer : t === 'preFreguesia' ? sq.semPerder : t === 'preMaFase' ? ult.slice(-4).filter(x => x === 'D').length : t === 'preBoaFase' ? seq('V') : 0;
    const fill = txt => txt.replace(/\{j\}/g, j?.curto || '').replace(/\{adv\}/g, nome(adv)).replace(/\{retro\}/g, H ? resumoConfronto(H) : '').replace(/\{n\}/g, n).replace(/\{(na|da|pela)\} (?=\{comp\})/g, (_, x) => ARTIGO(compNome)[x]).replace(/\{comp\}/g, compNome).replace(/\{meta\}/g, metaDiretoria(base, s).txt).replace(/\{placar\}/g, H?.maior ? `${H.maior[0]} a ${H.maior[1]} em ${H.maior[2]}` : '');
    const tons = shuffle(r, PRE), esc = [...new Set([tons.find(x => DUROS.includes(x)), tons.find(x => SUAVES.includes(x)), ...tons].filter(Boolean))].slice(0, 4);
    const frase = tom => { const op = [...(RESP_PRE[t]?.[tom] || []), ...GERAL.F[tom]].filter(x => !usadas.has(x)), f = op[0] || pick(r, GERAL.F[tom]); usadas.add(f); return fill(f); };
    return { tema: t, jogador: j?.id ?? null, reporter: reps[i % reps.length], texto: fill(pick(r, T.q)), respostas: shuffle(r, esc).map(tom => ({ tom, texto: frase(tom) })) };
  });
  s.coletivaPre = { chave: k, pre: true, titulo: ev.titulo, h: ev.h, a: ev.a, quente: w.preClassico > 0 || mataMata || w.prePressao > 0, perguntas, respostas: [], feita: false };
  return s.coletivaPre;
}

// efeito de um tom: quem sobe e quem desce (com coletiva quente valendo o dobro)
export function efeito(s, tom, C = s.coletiva) {
  const T = TONS[tom], q = C?.quente ? 2 : 1, ult = (s.colAud || []).slice(-2);
  const meia = T.sobe && ult.length === 2 && ult.every(x => x === T.sobe) ? 0.5 : 1;
  return T.sobe ? { [T.sobe]: 2 * q * meia, [T.desce]: -1 * q } : {};
}

export function responder(base, s, i, tom, pre = false) {
  const C = pre ? s.coletivaPre : s.coletiva, P = C?.perguntas[i];
  if (!P || C.respostas[i] != null || !TONS[tom]) return null;
  const e = efeito(s, tom, C), ci = s.tecnico.clube, N = [], nome = s.tecnico.nome, resp = P.respostas.find(x => x.tom === tom);
  if (!resp) return null;
  if (e.G) for (const j of base.elencos[ci]) s.mor[j.id] = clamp((s.mor[j.id] ?? 62) + e.G, 0, 100);
  if (e.T) s.torcida = clamp((s.torcida ?? 55) + e.T, 0, 100);
  if (e.D) s.fin.diretoria = clamp(s.fin.diretoria + e.D, 0, 100);
  if (TONS[tom].sobe) s.colAud = [...(s.colAud || []), TONS[tom].sobe].slice(-3);
  const j = P.jogador != null ? base.jog.get(P.jogador) : null;
  if (j && j.clube === ci) {
    const elogio = ['destaque', 'renovacao'].includes(P.tema), d = tom === 'irritada' && elogio ? -2 : TONS[tom].jog;
    s.mor[j.id] = clamp((s.mor[j.id] ?? 62) + d, 0, 100);
    (s.trato ||= {})[j.id] = clamp((s.trato[j.id] || 0) + (d < 0 ? -2 : d >= 4 ? 1 : 0), -10, 10);
    if (d < 0 && (j.ovr >= 78 || (s.mor[j.id] ?? 62) < 30) && rng(`rebate${s.seed}${C.chave}${i}`)() < 0.6) {
      s.mor[j.id] = Math.max(0, s.mor[j.id] - 3);
      N.push({ tipo: 'clube', imprensa: true, jogador: j.id, texto: `${j.curto} rebate ${nome}: "${pick(rng(`rb${C.chave}${i}`), ['Cada um sabe o que faz em campo. Eu sei o que faço.', 'Não precisava falar isso em público.', 'Estou tranquilo. Quem me conhece sabe do meu trabalho.'])}"` });
    }
  }
  // falar da arbitragem tem preço
  if (P.tema === 'arbitragem' && tom === 'irritada' && rng(`stjd${s.seed}${C.chave}`)() < 0.4) {
    const multa = Math.max(3000, Math.round(folhaDia(base, s) * 1.2 / 1000) * 1000);
    lancar(s, 'multa', 'Multa do STJD por críticas à arbitragem', -multa);
    N.push({ tipo: 'clube', imprensa: true, texto: `STJD multa ${nome} por críticas à arbitragem: ${Math.round(multa / 1000)} mil.` });
  }
  s.tons = { ...(s.tons || {}), [tom]: ((s.tons || {})[tom] || 0) + 1 };
  C.respostas[i] = tom;
  N.unshift({ tipo: 'clube', imprensa: true, texto: `${nome}: "${resp.texto}"` });
  if (C.respostas.filter(x => x != null).length === C.perguntas.length) { C.feita = true; s.colUsados = [...(s.colUsados || []), ...C.perguntas.map(p => p.tema)].slice(-8); }
  s.noticias.unshift(...N.map(n => ({ rodada: s.rodada, div: base.clubes[ci].div, clube: ci, ...n })));
  return { efeito: e, noticias: N };
}

// perfil pelo tom das respostas: sereno ↔ intenso, protetor ↔ exigente
export function perfil(s) {
  const t = s.tons || {}, tot = Object.values(t).reduce((a, b) => a + b, 0);
  if (tot < 6) return { nome: 'Em formação', desc: `Responda mais ${6 - tot} pergunta${6 - tot === 1 ? '' : 's'} nas coletivas para o perfil aparecer.` };
  const g = k => t[k] || 0;
  const intenso = (g('irritada') + g('cobra') + g('confiante') * 0.5 - g('diplomatica') - g('cautelosa') - g('autocritica') * 0.5) / tot;
  const exigente = (g('cobra') + g('irritada') * 0.5 + g('autocritica') * 0.5 - g('protege') - g('motivacional')) / tot;
  if (Math.abs(intenso) < 0.15 && Math.abs(exigente) < 0.15) return { nome: 'Equilibrado', desc: 'Mede as palavras conforme o momento.' };
  if (exigente >= 0.15 && intenso >= 0.15) return { nome: 'Xerife', desc: 'Cobra em público e não foge de briga.' };
  if (exigente >= 0.15) return { nome: 'Gestor', desc: 'Exigente, mas frio: resolve dentro de casa.' };
  if (exigente <= -0.15 && intenso <= 0) return { nome: 'Paizão', desc: 'Protege o elenco de qualquer crítica.' };
  if (intenso <= -0.15) return { nome: 'Diplomata', desc: 'Fala pouco, agrada a diretoria e não cria atrito.' };
  return { nome: 'Motivador', desc: 'Inflama o grupo e a torcida.' };
}
