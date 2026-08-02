/**
 * Ping local cada minuto a /api/internal/t10-tick (útil en Hobby / pruebas).
 * Uso: node scripts/t10-pinger.js
 */
const fs = require('fs');
const path = require('path');

function get(content, key) {
  const m = content.match(new RegExp('^' + key + '=(.*)$', 'm'));
  if (!m) return '';
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

const root = path.join(__dirname, '..');
const secret = get(fs.readFileSync(path.join(root, '.env'), 'utf8'), 'CRON_SECRET');
const url =
  process.env.T10_URL ||
  'https://acrobit-back-end.vercel.app/api/internal/t10-tick';

if (!secret) {
  console.error('Missing CRON_SECRET in .env');
  process.exit(1);
}

async function tick() {
  const started = new Date().toISOString();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    });
    const text = await res.text();
    console.log(started, res.status, text.slice(0, 200));
  } catch (err) {
    console.log(started, 'ERR', err.message);
  }
}

console.log('T-10 pinger →', url, '(cada 60s). Ctrl+C para parar.');
tick();
setInterval(tick, 60_000);
