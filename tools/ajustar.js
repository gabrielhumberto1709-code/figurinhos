// Aplica tools/ajustes.json em public/data/brasil.json: muda overall e/ou potencial à mão.
// Os atributos andam junto com o overall (mesma diferença) e o valor de mercado acompanha (×1,14 por ponto).
// Uso: node tools/ajustar.js        (mostra o que mudou e grava)
import { readFileSync, writeFileSync } from 'node:fs';

const DADOS = new URL('../public/data/brasil.json', import.meta.url), AJ = new URL('./ajustes.json', import.meta.url);
const d = JSON.parse(readFileSync(DADOS)), aj = JSON.parse(readFileSync(AJ)).jogadores || {};
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clubeDe = r => d.clubes[r[3]]?.n || '';
let feitos = 0;
for (const [chave, v] of Object.entries(aj)) {
  const [nome, clube] = chave.split('|');
  const achados = d.jogadores.filter(r => String(r[0]) === chave || ((norm(r[1]) === norm(nome) || norm(r[2]) === norm(nome)) && (!clube || norm(clubeDe(r)) === norm(clube))));
  if (achados.length !== 1) { console.log(`✘ ${chave}: ${achados.length ? `${achados.length} jogadores com esse nome (${achados.map(r => `${r[1]}|${clubeDe(r)}`).join(', ')}); use Nome|Clube` : 'não achei'}`); continue; }
  const r = achados[0], antes = [r[7], r[10]];
  if (v.ovr != null) { const dlt = v.ovr - r[7]; r[7] = v.ovr; r[11] = r[11].map(a => Math.max(20, Math.min(99, a + dlt))); r[8] = Math.round(r[8] * 1.14 ** dlt); }
  if (v.pot != null) r[10] = v.pot;
  r[10] = Math.max(r[10], r[7]);
  console.log(`✔ ${r[1]} (${clubeDe(r)}): ovr ${antes[0]}→${r[7]}, pot ${antes[1]}→${r[10]}`); feitos++;
}
if (feitos) { writeFileSync(DADOS, JSON.stringify(d)); console.log(`${feitos} ajuste(s) gravado(s) em public/data/brasil.json`); }
