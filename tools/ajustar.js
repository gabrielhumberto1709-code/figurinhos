// Aplica tools/ajustes.json em public/data/brasil.json: overall/potencial à mão, nome, posição, idade, nacionalidade,
// troca de clube ("livre" = sem clube) e jogador novo. Os atributos andam junto com o overall (mesma diferença) e o
// valor de mercado acompanha (×1,14 por ponto); mudar a posição refaz os atributos pelo perfil da posição nova.
// Uso: node tools/ajustar.js        (mostra o que mudou e grava)
import { readFileSync, writeFileSync } from 'node:fs';
import { PERFIL } from '../public/js/motor/util.js';

const DADOS = new URL('../public/data/brasil.json', import.meta.url), AJ = new URL('./ajustes.json', import.meta.url);
const d = JSON.parse(readFileSync(DADOS)), aj = JSON.parse(readFileSync(AJ)).jogadores || {};
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clubeDe = r => d.clubes[r[3]]?.n || '';
const idxClube = n => n === 'livre' ? d.clubes.findIndex(c => c.div === 'L') : d.clubes.findIndex(c => norm(c.n) === norm(n));
const att = (pos, ovr) => PERFIL[pos].map(x => Math.max(20, Math.min(99, ovr + x)));
let feitos = 0;
for (const [chave, v] of Object.entries(aj)) {
  if (v.novo) {
    const ci = idxClube(v.clube);
    if (ci < 0 || d.jogadores.some(r => r[0] === +chave)) { console.log(`✘ novo ${chave}: clube "${v.clube}" não existe ou id repetido`); continue; }
    const nums = new Set(d.jogadores.filter(r => r[3] === ci).map(r => r[13])); let num = v.num || 30; while (nums.has(num)) num++;
    d.jogadores.push([+chave, v.nome, v.curto || v.nome, ci, v.pos, v.idade, v.nat || 'BRA', v.ovr, v.valor || Math.round(v.ovr * v.ovr / 3), v.contrato || d.ano + 3, Math.max(v.pot || v.ovr, v.ovr), att(v.pos, v.ovr), v.rosto || '1030000010', num]);
    console.log(`✚ ${v.nome} (${v.clube}) ${v.pos} ${v.idade} anos ${v.ovr}/${v.pot}`); feitos++; continue;
  }
  const [nome, clube] = chave.split('|');
  const achados = d.jogadores.filter(r => String(r[0]) === chave || ((norm(r[1]) === norm(nome) || norm(r[2]) === norm(nome)) && (!clube || norm(clubeDe(r)) === norm(clube))));
  if (achados.length !== 1) { console.log(`✘ ${chave}: ${achados.length ? `${achados.length} jogadores com esse nome (${achados.map(r => `${r[1]}|${clubeDe(r)}`).join(', ')}); use Nome|Clube` : 'não achei'}`); continue; }
  const r = achados[0], antes = `${r[1]} (${clubeDe(r)}) ${r[4]} ${r[7]}/${r[10]}`;
  if (v.ovr != null) { const dlt = v.ovr - r[7]; r[7] = v.ovr; r[11] = r[11].map(a => Math.max(20, Math.min(99, a + dlt))); r[8] = Math.round(r[8] * 1.14 ** dlt); }
  if (v.pot != null) r[10] = v.pot;
  else if (v.ovr != null && r[5] >= 27) r[10] = r[7]; // veterano sem potencial informado: potencial = overall
  r[10] = Math.max(r[10], r[7]);
  if (v.pos && v.pos !== r[4]) { r[4] = v.pos; r[11] = att(v.pos, r[7]); }
  if (v.nome) r[1] = v.nome;
  if (v.curto) r[2] = v.curto;
  if (v.idade) r[5] = v.idade;
  if (v.nat) r[6] = v.nat;
  if (v.clube) { const ci = idxClube(v.clube); if (ci < 0) console.log(`  ✘ clube "${v.clube}" não existe`); else r[3] = ci; }
  console.log(`✔ ${antes} → ${r[1]} (${clubeDe(r)}) ${r[4]} ${r[7]}/${r[10]}`); feitos++;
}
if (feitos) { writeFileSync(DADOS, JSON.stringify(d)); console.log(`${feitos} ajuste(s) gravado(s) em public/data/brasil.json`); }
