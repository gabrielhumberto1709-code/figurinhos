// Build do Cloudflare Pages (figurinhos.pages.dev): o mesmo worker vira o _worker.js do Pages, rodando só em /api/*
// (o resto é arquivo estático, de graça). O banco é o mesmo D1 do worker, ligado no painel do Pages como DB.
import fs from 'node:fs';
fs.copyFileSync('src/worker.js', 'public/_worker.js');
fs.writeFileSync('public/_routes.json', JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }));
