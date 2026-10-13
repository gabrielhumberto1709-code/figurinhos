# Figurinhos

## Início de toda sessão: graphify

Antes de qualquer tarefa, garanta o mapa do código e use-o para se orientar:

1. `command -v graphify || uv tool install graphifyy || pip install --break-system-packages graphifyy`
2. Sem `graphify-out/graph.json` (a pasta não vai para o git): `graphify update .` (só código, sem LLM, ~30 s).
   Com ela: `graphify update .` também, para pegar o que mudou.
3. Para entender uma área antes de mexer: `graphify query "<pergunta>"`, `graphify explain "<função>"`,
   `graphify path "A" "B"`, `graphify affected "<função>"` (o que quebra se ela mudar).

O mapa é ponto de partida; confirme no código antes de editar (ligações INFERRED podem ser falsas, ex.: duas
funções com o mesmo nome em arquivos diferentes).
