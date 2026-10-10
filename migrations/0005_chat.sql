-- chat da liga: as últimas 200 mensagens de cada liga
CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL, usuario_id INTEGER NOT NULL, apelido TEXT NOT NULL,
  texto TEXT NOT NULL, criado INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS chat_liga ON chat(codigo, id);
