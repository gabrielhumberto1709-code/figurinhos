-- backup de um passo: o mundo e as mesas como estavam antes da última gravação do mundo (o ADM pode voltar)
ALTER TABLE ligas ADD COLUMN mundo_ant TEXT;
ALTER TABLE ligas ADD COLUMN ver_ant INTEGER;
ALTER TABLE mesas ADD COLUMN dados_ant TEXT;
ALTER TABLE mesas ADD COLUMN ant_ver INTEGER;
