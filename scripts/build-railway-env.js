/**
 * Genera scripts/railway-env.json desde .env + Firebase JSON.
 * Uso: node scripts/build-railway-env.js
 */
const fs = require('fs');
const path = require('path');

function parseEnv(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = parseEnv(fs.readFileSync('.env', 'utf8'));
const cred = env.GOOGLE_APPLICATION_CREDENTIALS;
if (cred) {
  const abs = path.resolve(cred);
  env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(
    JSON.parse(fs.readFileSync(abs, 'utf8')),
  );
}
delete env.GOOGLE_APPLICATION_CREDENTIALS;
delete env.PORT;
if (!env.NODE_ENV) env.NODE_ENV = 'production';

const outPath = path.join('scripts', 'railway-env.json');
fs.writeFileSync(outPath, JSON.stringify(env, null, 2));
console.log('wrote', outPath);
console.log('keys=' + Object.keys(env).sort().join(','));
