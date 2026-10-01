import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
createServer(async (req,res) => { try { let path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname)); if (path !== root && !path.startsWith(root + sep)) throw Error(); if(path === root) path = resolve(root,'index.html'); const data = await readFile(path); res.writeHead(200,{'Content-Type':types[extname(path)] || 'application/octet-stream','Cache-Control':'no-store'}); res.end(data); } catch {res.writeHead(404);res.end('Not found');} }).listen(4173,'127.0.0.1',() => console.log('http://127.0.0.1:4173'));
