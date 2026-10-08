-- tentativas por chave (IP, IP+conta) com janela; substitui o bloqueio da conta inteira
CREATE TABLE IF NOT EXISTS limites (chave TEXT PRIMARY KEY, n INTEGER NOT NULL, ate INTEGER NOT NULL);
DROP TABLE IF EXISTS mural;
