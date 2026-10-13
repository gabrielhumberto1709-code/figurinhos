// O Treineiros vem num HTML só. Este script separa as 3 partes que o tools/build-dados.js lê para a pasta de referência:
//   data.json (o <script id="data">), 02-nucleo-regras-catalogos.js (CORE) e 10-liga-online-e-interface.js (aparências medidas).
// Uso: node tools/extrair-treineiros.js <treineiros-1.38.10.html> [pasta-de-saída]
// Saída padrão: ../referencia/treineiros-1.38.10 (onde o build-dados.js procura sozinho).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [html, saida] = [process.argv[2], process.argv[3] || path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), '..', 'referencia', 'treineiros-1.38.10')];
if (!html) { console.error('uso: node tools/extrair-treineiros.js <treineiros.html> [pasta-de-saída]'); process.exit(1); }
const t = readFileSync(html, 'utf8');
// conteúdo de cada <script ...>...</script>
const scripts = [...t.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map(m => ({ attrs: m[1], corpo: m[2] }));
const dados = scripts.find(s => /id="data"/.test(s.attrs));
const nucleo = scripts.find(s => s.corpo.includes('TREINEIROS v3 · núcleo'));
const looks = scripts.find(s => s.corpo.includes('SPR.setLooks('));
if (!dados || !nucleo || !looks) throw new Error(`não achei: ${[!dados && 'data', !nucleo && 'núcleo', !looks && 'setLooks'].filter(Boolean).join(', ')}`);
JSON.parse(dados.corpo); // confere que é JSON de verdade
mkdirSync(saida, { recursive: true });
writeFileSync(path.join(saida, 'data.json'), dados.corpo);
writeFileSync(path.join(saida, '02-nucleo-regras-catalogos.js'), nucleo.corpo);
writeFileSync(path.join(saida, '10-liga-online-e-interface.js'), looks.corpo);
console.log(`referência gravada em ${saida}`);
