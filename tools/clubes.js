// Acrescenta em public/data/brasil.json os clubes de tools/clubes.json que ainda não existem (pelo nome).
// Clubes novos entram no fim da lista, então os índices dos que já existem não mudam.
// Uso: node tools/clubes.js
import { readFileSync, writeFileSync } from 'node:fs';
const DADOS = new URL('../public/data/brasil.json', import.meta.url), d = JSON.parse(readFileSync(DADOS));
const novos = JSON.parse(readFileSync(new URL('./clubes.json', import.meta.url))).clubes.filter(c => !d.clubes.some(x => x.n === c.n));
d.clubes.push(...novos);
if (novos.length) writeFileSync(DADOS, JSON.stringify(d));
console.log(`${novos.length} clube(s) novo(s): ${novos.map(c => c.n).join(', ')}`);
