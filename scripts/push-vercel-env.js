/**
 * Push local .env (+ Firebase JSON) to Vercel via stdin (safe for `&` in URIs).
 * Logs only key names — never secret values.
 */
const { execFileSync } = require('child_process');
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

// Usar node + vc.js (stdin seguro en Windows; .cmd rompe con `&` en URIs)
const vcJs = path.join(
  process.env.APPDATA || '',
  'npm',
  'node_modules',
  'vercel',
  'dist',
  'vc.js',
);
if (!fs.existsSync(vcJs)) {
  console.error('vercel vc.js not found at', vcJs);
  process.exit(1);
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

const keys = Object.keys(env).filter((k) => env[k] != null && env[k] !== '');
const targets = ['production', 'preview', 'development'];
let ok = 0;
let fail = 0;

for (const key of keys) {
  for (const target of targets) {
    try {
      execFileSync(
        process.execPath,
        [vcJs, 'env', 'add', key, target, '--yes', '--force'],
        {
          input: env[key],
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        },
      );
      ok += 1;
      console.log('OK', key, '->', target);
    } catch (e) {
      fail += 1;
      const msg = (e.stderr && e.stderr.toString()) || e.message;
      console.log('FAIL', key, '->', target, String(msg).slice(0, 240));
    }
  }
}

console.log(`DONE ok=${ok} fail=${fail} keys=${keys.join(',')}`);
