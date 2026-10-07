// API do Figurinhos: contas (apelido + PIN), saves na nuvem e mural público.
// Tudo que não é /api/* é servido direto dos arquivos estáticos em public/.

const SESSAO_DIAS = 90, MAX_FALHAS = 5, BLOQUEIO_MS = 15 * 60 * 1000, MAX_SAVE = 1_500_000, SLOTS = 3;
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const aleatorio = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// ponytail: PIN tem pouca entropia, então o que protege de verdade é o bloqueio após 5 erros;
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

async function criarSessao(env, usuarioId) {
  const token = aleatorio(32);
  await env.DB.prepare('INSERT INTO sessoes (token, usuario_id, expira) VALUES (?, ?, ?)').bind(await sha256(token), usuarioId, Date.now() + SESSAO_DIAS * 864e5).run();
  return token;
}

async function usuarioDa(req, env) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer ([0-9a-f]{64})$/);
  if (!m) return null;
  return env.DB.prepare('SELECT u.id, u.apelido, u.admin FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira > ?').bind(await sha256(m[1]), Date.now()).first();
}

async function corpo(req) { try { return await req.json(); } catch { return {}; } }

const rotas = {
  async 'POST /api/cadastro'(req, env) {
    const { apelido, pin } = await corpo(req);
    const msg = validar(apelido, pin); if (msg) return erro(msg);
    const salt = aleatorio(16), nome = apelido.trim();
    const r = await env.DB.prepare('INSERT INTO usuarios (apelido, pin_hash, salt, criado) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id')
      .bind(nome, await hashPin(pin, salt), salt, Date.now()).first();
    if (!r) return erro('Esse apelido já tem dono.', 409);
    return json({ token: await criarSessao(env, r.id), apelido: nome, admin: 0 });
  },

  async 'POST /api/entrar'(req, env) {
    const { apelido, pin } = await corpo(req);
    if (validar(apelido, pin)) return erro('Apelido ou PIN errado.', 401);
    const u = await env.DB.prepare('SELECT * FROM usuarios WHERE apelido = ?').bind(apelido.trim()).first();
    if (!u) return erro('Apelido ou PIN errado.', 401);
    if (u.bloqueado_ate > Date.now()) return erro(`Muitas tentativas. Tente de novo em ${Math.ceil((u.bloqueado_ate - Date.now()) / 60000)} min.`, 429);
    if (!iguais(await hashPin(pin, u.salt), u.pin_hash)) {
      const falhas = u.falhas + 1, bloqueia = falhas >= MAX_FALHAS;
      await env.DB.prepare('UPDATE usuarios SET falhas = ?, bloqueado_ate = ? WHERE id = ?').bind(bloqueia ? 0 : falhas, bloqueia ? Date.now() + BLOQUEIO_MS : 0, u.id).run();
      return erro(bloqueia ? 'Muitas tentativas. Conta travada por 15 minutos.' : 'Apelido ou PIN errado.', bloqueia ? 429 : 401);
    }
    await env.DB.batch([
      env.DB.prepare('UPDATE usuarios SET falhas = 0, bloqueado_ate = 0 WHERE id = ?').bind(u.id),
      env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND expira < ?').bind(u.id, Date.now()),
    ]);
    return json({ token: await criarSessao(env, u.id), apelido: u.apelido, admin: u.admin });
  },

  async 'GET /api/eu'(req, env, u) { return json({ apelido: u.apelido, admin: u.admin }); },

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

  async 'PUT /api/saves/:slot'(req, env, u, slot) {
    const { nome = '', resumo = '', dados } = await corpo(req);
    if (typeof dados !== 'string' || !dados.length) return erro('Save vazio.');
    if (dados.length > MAX_SAVE) return erro('Save grande demais.', 413);
    const agora = Date.now();
    await env.DB.prepare(`INSERT INTO saves (usuario_id, slot, nome, resumo, atualizado, dados) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (usuario_id, slot) DO UPDATE SET nome = excluded.nome, resumo = excluded.resumo, atualizado = excluded.atualizado, dados = excluded.dados`)
      .bind(u.id, slot, String(nome).slice(0, 60), String(resumo).slice(0, 120), agora, dados).run();
    return json({ ok: true, atualizado: agora });
  },

  async 'DELETE /api/saves/:slot'(req, env, u, slot) {
    await env.DB.prepare('DELETE FROM saves WHERE usuario_id = ? AND slot = ?').bind(u.id, slot).run();
    return json({ ok: true });
  },

  async 'GET /api/mural'(req, env) {
    const { results } = await env.DB.prepare('SELECT quando, autor, acao, detalhe FROM mural ORDER BY id DESC LIMIT 100').all();
    return json(results);
  },
};
const PUBLICAS = new Set(['POST /api/cadastro', 'POST /api/entrar', 'POST /api/sair', 'GET /api/mural']);

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
