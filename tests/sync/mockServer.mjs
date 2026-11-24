// خادم HTTP محلي يحاكي رابط Apps Script (نفس Code.gs) لتجربة جهازين حقيقيين في المتصفح.
//   node tests/sync/mockServer.mjs [port] [latencyMs]
import http from 'node:http';
import { createBackend } from './harness.mjs';

const port = Number(process.argv[2]) || 8787, latency = Number(process.argv[3]) || 0;
const backend = createBackend();
let hits = 0;
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.url === '/__stats') { res.writeHead(200, cors); return res.end(JSON.stringify({ hits })); }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => setTimeout(() => {
    hits++;
    const out = req.method === 'POST' ? JSON.stringify(backend.post(body)) : JSON.stringify(backend.get());
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(out);
  }, latency));
}).listen(port, () => console.log('mock apps-script on', port));
