-- liga online: o mundo (gzip+base64, com versão) e a mesa de cada técnico (até 8), gravados com checagem de versão
CREATE TABLE IF NOT EXISTS ligas (codigo TEXT PRIMARY KEY, nome TEXT NOT NULL, admin_id INTEGER NOT NULL, criado INTEGER NOT NULL,
  meta TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 1, mundo TEXT NOT NULL, trava TEXT, atualizado INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS mesas (codigo TEXT NOT NULL, usuario_id INTEGER NOT NULL, apelido TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0,
  dados TEXT, clube INTEGER, entrou INTEGER NOT NULL, visto INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (codigo, usuario_id));
CREATE INDEX IF NOT EXISTS mesas_usuario ON mesas(usuario_id);
