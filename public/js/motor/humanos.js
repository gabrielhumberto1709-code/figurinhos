// Vários técnicos humanos num mundo só (liga online). Offline o save é um objeto único com um técnico, como sempre.
// Online o mundo (W) não guarda nada de técnico: cada um tem a sua mesa (finanças, caixa, cargo, correio, propostas,
// escalação...) e o motor enxerga "o save daquele técnico" pela vista: W + a mesa dele num Proxy (lê e grava nos dois).
// W._mesas = { id: mesa } fica só em memória; W.tecnico.clube = -1 (o mundo em si não é de ninguém).

// campos que são do técnico (o resto é do mundo: calendário, tabelas, jogadores, IA, notícias...)
export const MESA = new Set(['tecnico', 'carreira', 'cargo', 'demitido', 'ofertas', 'fin', 'caixa', 'dificuldade', 'msgs', 'msgsVistas',
  'propostas', 'recebidas', 'listas', 'favoritos', 'observar', 'relatorios', 'olheiro', 'acordos', 'leilaoAtivo', 'recusas',
  'xi', 'banco', 'formacao', 'formPers', 'estilo', 'gatilhos', 'cobrador', 'capitao', 'vice', 'subsAuto', 'escSalvas', 'foco', 'treino',
  'prelecao', 'coletiva', 'coletivaPre', 'colAud', 'colUsados', 'tons', 'torcida', 'classicos', 'revolta', 'motim', 'ultima', 'ultimaVivo',
  'h2h', 'tetoAviso', 'palavra', 'pedidosAumento', 'avisoPilar', 'galaVista', 'vivo', 'amistosos', 'julgamentos', 'fpf', 'historico', 'salvoEm']);

const cache = new WeakMap();
export function vista(W, mesa) {
  const c = cache.get(mesa);
  if (c?.W === W) return c.p;
  const p = new Proxy(W, {
    get: (t, k) => k === '_W' ? t : k === '_mesa' ? mesa : MESA.has(k) ? mesa[k] : t[k],
    set: (t, k, v) => { (MESA.has(k) ? mesa : t)[k] = v; return true; },
    deleteProperty: (t, k) => { delete (MESA.has(k) ? mesa : t)[k]; return true; },
    has: (t, k) => k in (MESA.has(k) ? mesa : t),
    ownKeys: t => [...new Set([...Reflect.ownKeys(t).filter(k => !MESA.has(k)), ...Reflect.ownKeys(mesa)])],
    getOwnPropertyDescriptor: (t, k) => { const d = Reflect.getOwnPropertyDescriptor(MESA.has(k) ? mesa : t, k); return d && { ...d, configurable: true }; },
  });
  cache.set(mesa, { W, p });
  return p;
}
export const mundoDe = s => s._W || s;
const mesas = s => Object.values(mundoDe(s)._mesas || {}).filter(m => m.tecnico?.clube >= 0);
// [clube, vista] de cada técnico (offline: o save inteiro)
export function humanos(s) {
  const W = mundoDe(s);
  if (!W._mesas) return W.tecnico?.clube >= 0 ? [[W.tecnico.clube, W]] : [];
  return mesas(W).map(m => [m.tecnico.clube, vista(W, m)]);
}
export const ehHumano = (s, ci) => ci != null && ci >= 0 && (mundoDe(s)._mesas ? mesas(s).some(m => m.tecnico.clube === ci) : ci === mundoDe(s).tecnico?.clube);
// vista do técnico do clube ci (ou null se o clube é da IA)
export function vistaDo(s, ci) {
  const W = mundoDe(s);
  if (!W._mesas) return ci >= 0 && ci === W.tecnico?.clube ? W : null;
  const m = mesas(W).find(x => x.tecnico.clube === ci);
  return m ? vista(W, m) : null;
}
// sementes por técnico: offline nada muda; online cada mesa sorteia o seu (senão todos teriam o mesmo evento na rodada)
export const sufixo = (s, ci) => mundoDe(s)._mesas ? `-${ci}` : '';
// separa um save no mundo e na mesa (e junta de volta)
export function separar(s) {
  const W = {}, mesa = {};
  for (const [k, v] of Object.entries(s)) (MESA.has(k) ? mesa : W)[k] = v;
  return { W, mesa };
}
