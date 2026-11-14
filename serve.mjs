import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve('docs');
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = resolve(join(ROOT, url === '/' ? 'index.html' : url));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) throw new Error('fuera de docs');
    const body = await readFile(file); // leer primero: si falla, aun no se enviaron encabezados
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end('No encontrado');
  }
}).listen(8080, () => console.log('http://localhost:8080/'));
