// API do Figurinhos: contas (apelido + PIN) e saves na nuvem.
// Tudo que não é /api/* é servido direto dos arquivos estáticos em public/.

const SESSAO_DIAS = 90, MAX_FALHAS = 5, BLOQUEIO_MS = 15 * 60 * 1000, MAX_SAVE = 1_500_000, SLOTS = 3;
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

};
const PUBLICAS = new Set(['POST /api/cadastro', 'POST /api/entrar', 'POST /api/sair']);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    let chave = `${req.method} ${url.pathname}`, slot = null;
    const m = url.pathname.match(/^\/api\/saves\/(\d+)$/);
    if (m) { slot = +m[1]; if (slot < 1 || slot > SLOTS) return erro('Slot inválido.'); chave = `${req.method} /api/saves/:slot`; }
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
