// API do Figurinhos: contas (apelido + PIN), saves na nuvem e ligas online.
// Tudo que não é /api/* é servido direto dos arquivos estáticos em public/.

const SESSAO_DIAS = 90, MAX_FALHAS = 5, BLOQUEIO_MS = 15 * 60 * 1000, MAX_SAVE = 1_500_000, SLOTS = 3;
const MAX_MESAS = 8, MAX_MUNDO = 1_900_000, MAX_MESA = 600_000;
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const aleatorio = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// ponytail: PIN tem pouca entropia, então o que protege de verdade é o limite de erros (por IP e por IP+conta);
// o PBKDF2 fica leve para caber no limite de CPU do plano grátis.
async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 20000 }, key, 256));
}
function iguais(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

const json = (dados, status = 200) => new Response(JSON.stringify(dados), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (msg, status = 400) => json({ erro: msg }, status);

function validar(apelido, pin) {
  if (typeof apelido !== 'string' || !/^[\p{L}\p{N}_ .-]{3,20}$/u.test(apelido.trim())) return 'Apelido precisa ter de 3 a 20 letras ou números.';
  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return 'O PIN precisa ter de 4 a 8 números.';
  return null;
}

// contador com janela por chave; devolve os minutos de espera quando passou do máximo (0 = liberado)
async function limite(env, chave, max, janelaMs, soma = 1) {
  const agora = Date.now();
  const r = soma
    ? await env.DB.prepare(`INSERT INTO limites (chave, n, ate) VALUES (?1, ?2, ?3) ON CONFLICT (chave) DO UPDATE SET
        n = CASE WHEN ate < ?4 THEN ?2 ELSE n + ?2 END, ate = CASE WHEN ate < ?4 THEN ?3 ELSE ate END RETURNING n, ate`).bind(chave, soma, agora + janelaMs, agora).first()
    : await env.DB.prepare('SELECT n, ate FROM limites WHERE chave = ?').bind(chave).first();
  return r && r.ate > agora && r.n > max - (soma ? 0 : 1) ? Math.ceil((r.ate - agora) / 60000) : 0;
}
const ipDe = req => req.headers.get('cf-connecting-ip') || 'local';
const espera = min => erro(`Muitas tentativas. Tente de novo em ${min} min.`, 429);
// o save é gzip+base64 ("gz:...") ou JSON de save antigo; nada além disso entra no banco
const saveValido = d => typeof d === 'string' && d.length > 3 && (/^gz:[A-Za-z0-9+/]+={0,2}$/.test(d) || (d[0] === '{' && d.at(-1) === '}'));

// código de liga: 6 letras/números sem os que confundem (0/O, 1/I)
const codigoNovo = () => [...crypto.getRandomValues(new Uint8Array(6))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
// relógio da liga: ritmo, início, quanto o ADM adiantou e pausa
function metaValida(m) {
  if (!m || typeof m !== 'object' || !['normal', 'turbo'].includes(m.ritmo)) return null;
  const n = v => v == null ? null : Number.isFinite(+v) ? +v : NaN, out = { ritmo: m.ritmo, inicio: n(m.inicio), desloc: n(m.desloc) || 0, pausa: !!m.pausa, publica: !!m.publica, slot0: Math.max(0, Math.floor(n(m.slot0) || 0)) };
  return Number.isNaN(out.inicio) || Number.isNaN(out.desloc) || Number.isNaN(out.slot0) ? null : out;
}

async function criarSessao(env, usuarioId) {
  const token = aleatorio(32);
  await env.DB.prepare('INSERT INTO sessoes (token, usuario_id, expira) VALUES (?, ?, ?)').bind(await sha256(token), usuarioId, Date.now() + SESSAO_DIAS * 864e5).run();
  return token;
}

async function usuarioDa(req, env) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer ([0-9a-f]{64})$/);
  if (!m) return null;
  return env.DB.prepare('SELECT u.id, u.apelido FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira > ?').bind(await sha256(m[1]), Date.now()).first();
}

async function corpo(req) { try { return await req.json(); } catch { return {}; } }

const rotas = {
  async 'POST /api/cadastro'(req, env) {
    const { apelido, pin } = await corpo(req);
    const msg = validar(apelido, pin); if (msg) return erro(msg);
    const min = await limite(env, 'cad:' + ipDe(req), 10, 36e5); if (min) return espera(min);
    const salt = aleatorio(16), nome = apelido.trim();
    const r = await env.DB.prepare('INSERT INTO usuarios (apelido, pin_hash, salt, criado) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id')
      .bind(nome, await hashPin(pin, salt), salt, Date.now()).first();
    if (!r) return erro('Esse apelido já tem dono.', 409);
    return json({ token: await criarSessao(env, r.id), apelido: nome });
  },

  // erro de PIN trava só quem errou (aquele IP naquela conta), não a conta para todo mundo
  async 'POST /api/entrar'(req, env) {
    const { apelido, pin } = await corpo(req), ip = ipDe(req);
    let min = await limite(env, 'ip:' + ip, 30, BLOQUEIO_MS, 0); if (min) return espera(min);
    if (validar(apelido, pin)) return erro('Apelido ou PIN errado.', 401);
    const u = await env.DB.prepare('SELECT id, apelido, pin_hash, salt FROM usuarios WHERE apelido = ?').bind(apelido.trim()).first();
    const chave = `pin:${u?.id}:${ip}`;
    if (u && (min = await limite(env, chave, MAX_FALHAS, BLOQUEIO_MS, 0))) return espera(min);
    if (!u || !iguais(await hashPin(pin, u.salt), u.pin_hash)) {
      await limite(env, 'ip:' + ip, 30, BLOQUEIO_MS);
      if (u && (min = await limite(env, chave, MAX_FALHAS - 1, BLOQUEIO_MS))) return erro('Muitas tentativas. Conta travada para você por 15 minutos.', 429);
      return erro('Apelido ou PIN errado.', 401);
    }
    await env.DB.batch([
      env.DB.prepare('DELETE FROM limites WHERE chave = ? OR ate < ?').bind(chave, Date.now()),
      env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND expira < ?').bind(u.id, Date.now()),
    ]);
    return json({ token: await criarSessao(env, u.id), apelido: u.apelido });
  },

  async 'GET /api/eu'(req, env, u) { return json({ apelido: u.apelido }); },

  async 'POST /api/sair'(req, env) {
    const m = (req.headers.get('authorization') || '').match(/^Bearer ([0-9a-f]{64})$/);
    if (m) await env.DB.prepare('DELETE FROM sessoes WHERE token = ?').bind(await sha256(m[1])).run();
    return json({ ok: true });
  },

  async 'GET /api/saves'(req, env, u) {
    const { results } = await env.DB.prepare('SELECT slot, nome, resumo, atualizado FROM saves WHERE usuario_id = ? ORDER BY slot').bind(u.id).all();
    return json(results);
  },

  async 'GET /api/saves/:slot'(req, env, u, slot) {
    const r = await env.DB.prepare('SELECT dados, atualizado FROM saves WHERE usuario_id = ? AND slot = ?').bind(u.id, slot).first();
    return r ? json(r) : erro('Save não encontrado.', 404);
  },

  // versão = o 'atualizado' que o servidor devolveu no último save; quem manda uma versão velha leva 409
  // (outro aparelho salvou depois). base 0 = slot novo. Sem base = cliente antigo: grava por cima.
  async 'PUT /api/saves/:slot'(req, env, u, slot) {
    const { nome = '', resumo = '', dados, base } = await corpo(req);
    if (!saveValido(dados)) return erro('Save inválido.');
    if (dados.length > MAX_SAVE) return erro('Save grande demais.', 413);
    const n = String(nome).slice(0, 60), rs = String(resumo).slice(0, 120), b = Number(base) || 0, agora = Math.max(Date.now(), b + 1);
    if (base == null) {
      await env.DB.prepare(`INSERT INTO saves (usuario_id, slot, nome, resumo, atualizado, dados) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (usuario_id, slot) DO UPDATE SET nome = excluded.nome, resumo = excluded.resumo, atualizado = excluded.atualizado, dados = excluded.dados`)
        .bind(u.id, slot, n, rs, agora, dados).run();
      return json({ ok: true, atualizado: agora });
    }
    const r = b
      ? await env.DB.prepare('UPDATE saves SET nome = ?, resumo = ?, atualizado = ?, dados = ? WHERE usuario_id = ? AND slot = ? AND atualizado = ?').bind(n, rs, agora, dados, u.id, slot, b).run()
      : await env.DB.prepare('INSERT INTO saves (usuario_id, slot, nome, resumo, atualizado, dados) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(u.id, slot, n, rs, agora, dados).run();
    if (!r.meta.changes) {
      const x = await env.DB.prepare('SELECT atualizado FROM saves WHERE usuario_id = ? AND slot = ?').bind(u.id, slot).first();
      return json({ erro: 'Esta carreira foi salva em outro aparelho depois.', atualizado: x?.atualizado ?? 0 }, 409);
    }
    return json({ ok: true, atualizado: agora });
  },

  async 'DELETE /api/saves/:slot'(req, env, u, slot) {
    await env.DB.prepare('DELETE FROM saves WHERE usuario_id = ? AND slot = ?').bind(u.id, slot).run();
    return json({ ok: true });
  },

  // ---------- liga online ----------
  // O servidor só guarda e confere versões (no plano grátis ele não tem CPU para simular): quem processa a rodada é o
  // aparelho de um técnico, que grava mundo + mesas de uma vez. Versão velha leva 409 e o aparelho junta de novo.
  async 'POST /api/ligas'(req, env, u) {
    const { nome, meta, mundo } = await corpo(req);
    const n = String(nome || '').trim().slice(0, 30), m = metaValida(meta);
    if (!n) return erro('Dê um nome para a liga.');
    if (!m) return erro('Escolha o ritmo da liga.');
    if (!saveValido(mundo) || mundo.length > MAX_MUNDO) return erro('Mundo inválido.');
    const tem = await env.DB.prepare('SELECT COUNT(*) AS n FROM ligas WHERE admin_id = ?').bind(u.id).first();
    if (tem.n >= 3) return erro('Você já administra 3 ligas.');
    const agora = Date.now();
    for (let k = 0; k < 4; k++) {
      const codigo = codigoNovo();
      const r = await env.DB.prepare('INSERT INTO ligas (codigo, nome, admin_id, criado, meta, ver, mundo, atualizado) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT DO NOTHING')
        .bind(codigo, n, u.id, agora, JSON.stringify(m), mundo, agora).run();
      if (!r.meta.changes) continue;
      await env.DB.prepare('INSERT INTO mesas (codigo, usuario_id, apelido, ver, entrou, visto) VALUES (?, ?, ?, 0, ?, ?)').bind(codigo, u.id, u.apelido, agora, agora).run();
      return json({ codigo });
    }
    return erro('Não consegui criar a liga. Tente de novo.', 500);
  },

  async 'GET /api/ligas'(req, env, u) {
    const { results } = await env.DB.prepare(`SELECT l.codigo, l.nome, l.meta, l.admin_id = ?1 AS adm, m.clube, (SELECT COUNT(*) FROM mesas x WHERE x.codigo = l.codigo) AS n
      FROM mesas m JOIN ligas l ON l.codigo = m.codigo WHERE m.usuario_id = ?1 ORDER BY l.atualizado DESC`).bind(u.id).all();
    return json(results.map(r => ({ ...r, meta: JSON.parse(r.meta), adm: !!r.adm })));
  },

  // ligas abertas com vaga (Encontrar uma liga)
  async 'GET /api/ligas/abertas'(req, env, u) {
    const { results } = await env.DB.prepare(`SELECT l.codigo, l.nome, l.meta, (SELECT COUNT(*) FROM mesas x WHERE x.codigo = l.codigo) AS n,
      (SELECT apelido FROM mesas x WHERE x.codigo = l.codigo AND x.usuario_id = l.admin_id) AS adm
      FROM ligas l WHERE json_extract(l.meta, '$.publica') = 1 AND NOT EXISTS (SELECT 1 FROM mesas x WHERE x.codigo = l.codigo AND x.usuario_id = ?)
      ORDER BY l.atualizado DESC LIMIT 40`).bind(u.id).all();
    return json(results.filter(r => r.n < MAX_MESAS).map(r => ({ ...r, meta: JSON.parse(r.meta) })));
  },

  async 'POST /api/ligas/:c/entrar'(req, env, u, c) {
    const l = await env.DB.prepare('SELECT nome, (SELECT COUNT(*) FROM mesas WHERE codigo = ?1) AS n, (SELECT COUNT(*) FROM mesas WHERE codigo = ?1 AND usuario_id = ?2) AS eu FROM ligas WHERE codigo = ?1').bind(c, u.id).first();
    if (!l) return erro('Não existe liga com esse código.', 404);
    if (!l.eu) {
      if (l.n >= MAX_MESAS) return erro(`A liga já tem ${MAX_MESAS} técnicos.`);
      await env.DB.prepare('INSERT INTO mesas (codigo, usuario_id, apelido, ver, entrou, visto) VALUES (?, ?, ?, 0, ?, ?) ON CONFLICT DO NOTHING').bind(c, u.id, u.apelido, Date.now(), Date.now()).run();
    }
    return json({ ok: true, nome: l.nome });
  },

  async 'POST /api/ligas/:c/sair'(req, env, u, c) {
    const l = await env.DB.prepare('SELECT admin_id FROM ligas WHERE codigo = ?').bind(c).first();
    if (!l) return erro('Liga não existe.', 404);
    if (l.admin_id === u.id) return erro('O ADM não sai da liga.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM mesas WHERE codigo = ? AND usuario_id = ?').bind(c, u.id),
      env.DB.prepare('UPDATE ligas SET ver = ver + 1, atualizado = ? WHERE codigo = ?').bind(Date.now(), c),
    ]);
    return json({ ok: true });
  },

  // tudo: mundo + mesas (só para quem está na liga)
  async 'GET /api/ligas/:c'(req, env, u, c) {
    const [l, m] = await env.DB.batch([
      env.DB.prepare('SELECT codigo, nome, admin_id, meta, ver, mundo FROM ligas WHERE codigo = ?').bind(c),
      env.DB.prepare('SELECT usuario_id AS id, apelido, ver, dados, clube, visto FROM mesas WHERE codigo = ?').bind(c),
    ]);
    const liga = l.results[0];
    if (!liga) return erro('Liga não existe.', 404);
    if (!m.results.some(x => x.id === u.id)) return erro('Você não está nessa liga.', 403);
    await env.DB.prepare('UPDATE mesas SET visto = ? WHERE codigo = ? AND usuario_id = ?').bind(Date.now(), c, u.id).run();
    return json({ ...liga, meta: JSON.parse(liga.meta), eu: u.id, mesas: m.results });
  },

  // só as versões (consulta leve, sem gravar nada)
  async 'GET /api/ligas/:c/v'(req, env, u, c) {
    const [l, m] = await env.DB.batch([
      env.DB.prepare('SELECT ver, meta FROM ligas WHERE codigo = ?').bind(c),
      env.DB.prepare('SELECT usuario_id AS id, apelido, ver, clube, visto FROM mesas WHERE codigo = ?').bind(c),
    ]);
    if (!l.results[0]) return erro('Liga não existe.', 404);
    const eu = m.results.find(x => x.id === u.id);
    if (!eu) return erro('Você não está nessa liga.', 403);
    // "estou online": no máximo uma gravação a cada 5 min por técnico (quem processa a rodada é escolhido por isso)
    if (Date.now() - eu.visto > 300e3) await env.DB.prepare('UPDATE mesas SET visto = ? WHERE codigo = ? AND usuario_id = ?').bind(Date.now(), c, u.id).run();
    return json({ ver: l.results[0].ver, meta: JSON.parse(l.results[0].meta), mesas: m.results });
  },

  // grava de uma vez: { ver, mundo?, meta?, mesas: { id: { ver, dados, clube } } }. Só a própria mesa: confere a versão
  // dela. Com mundo, meta ou mais de uma mesa: confere a versão do mundo e a de cada mesa; vale tudo ou nada.
  async 'POST /api/ligas/:c/gravar'(req, env, u, c) {
    const { ver, mundo, meta, mesas = {} } = await corpo(req), agora = Date.now(), ids = Object.keys(mesas).map(Number);
    const l = await env.DB.prepare('SELECT admin_id, (SELECT COUNT(*) FROM mesas WHERE codigo = ?1 AND usuario_id = ?2) AS eu FROM ligas WHERE codigo = ?1').bind(c, u.id).first();
    if (!l) return erro('Liga não existe.', 404);
    if (!l.eu) return erro('Você não está nessa liga.', 403);
    const m = meta != null ? metaValida(meta) : null;
    if (meta != null && (!m || l.admin_id !== u.id)) return erro('Só o ADM mexe no relógio da liga.', 403);
    if (mundo != null && (!saveValido(mundo) || mundo.length > MAX_MUNDO)) return erro('Mundo inválido.');
    for (const id of ids) { const x = mesas[id]; if (!Number.isInteger(id) || !saveValido(x?.dados) || x.dados.length > MAX_MESA || !Number.isInteger(x.ver)) return erro('Mesa inválida.'); }
    const conflito = () => json({ erro: 'Outro aparelho gravou antes.', conflito: true }, 409);
    const novas = Object.fromEntries(ids.map(id => [id, mesas[id].ver + 1]));
    if (mundo == null && m == null && ids.length === 1) {
      const [id] = ids, x = mesas[id];
      const r = await env.DB.prepare('UPDATE mesas SET dados = ?, ver = ver + 1, clube = ?, visto = CASE WHEN usuario_id = ? THEN ? ELSE visto END WHERE codigo = ? AND usuario_id = ? AND ver = ?')
        .bind(x.dados, Number.isInteger(x.clube) ? x.clube : null, u.id, agora, c, id, x.ver).run();
      return r.meta.changes ? json({ ok: true, mesas: novas }) : conflito();
    }
    if (!Number.isInteger(ver)) return erro('Versão do mundo faltando.');
    const tok = aleatorio(8), campos = ['ver = ver + 1', 'trava = ?', 'atualizado = ?'], args = [tok, agora];
    if (mundo != null) { campos.push('mundo = ?'); args.push(mundo); }
    if (m) { campos.push('meta = ?'); args.push(JSON.stringify(m)); }
    const confere = ids.map(() => ' AND (SELECT ver FROM mesas WHERE codigo = ? AND usuario_id = ?) = ?').join('');
    const r = await env.DB.batch([
      env.DB.prepare(`UPDATE ligas SET ${campos.join(', ')} WHERE codigo = ? AND ver = ?${confere}`).bind(...args, c, ver, ...ids.flatMap(id => [c, id, mesas[id].ver])),
      ...ids.map(id => env.DB.prepare(`UPDATE mesas SET dados = ?, ver = ver + 1, clube = ?, visto = CASE WHEN usuario_id = ? THEN ? ELSE visto END
        WHERE codigo = ? AND usuario_id = ? AND (SELECT trava FROM ligas WHERE codigo = ?) = ?`).bind(mesas[id].dados, Number.isInteger(mesas[id].clube) ? mesas[id].clube : null, u.id, agora, c, id, c, tok)),
    ]);
    return r[0].meta.changes ? json({ ok: true, ver: ver + 1, mesas: novas }) : conflito();
  },

};
const PUBLICAS = new Set(['POST /api/cadastro', 'POST /api/entrar', 'POST /api/sair']);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    let chave = `${req.method} ${url.pathname}`, slot = null;
    const m = url.pathname.match(/^\/api\/saves\/(\d+)$/), lg = url.pathname.match(/^\/api\/ligas\/([A-Z0-9]{4,8})(\/[a-z]+)?$/);
    if (m) { slot = +m[1]; if (slot < 1 || slot > SLOTS) return erro('Slot inválido.'); chave = `${req.method} /api/saves/:slot`; }
    if (lg) { slot = lg[1]; chave = `${req.method} /api/ligas/:c${lg[2] || ''}`; }
    const rota = rotas[chave];
    if (!rota) return erro('Rota não existe.', 404);
    try {
      if (PUBLICAS.has(chave)) return await rota(req, env);
      const u = await usuarioDa(req, env);
      if (!u) return erro('Faça login de novo.', 401);
      return await rota(req, env, u, slot);
    } catch (e) {
      console.error(e);
      return erro('Deu ruim no servidor. Tenta de novo.', 500);
    }
  },
};
