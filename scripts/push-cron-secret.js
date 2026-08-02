/**
 * Sube solo CRON_SECRET a Vercel (production/preview/development).
 * No imprime el valor.
 */
const { execFileSync } = require('child_process');
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

const secret = get(fs.readFileSync('.env', 'utf8'), 'CRON_SECRET');
if (!secret) {
  console.error('Missing CRON_SECRET in .env');
  process.exit(1);
}

const vcJs = path.join(
  process.env.APPDATA || '',
  'npm/node_modules/vercel/dist/vc.js',
);

for (const target of ['production', 'preview', 'development']) {
  try {
    execFileSync(
      process.execPath,
      [vcJs, 'env', 'add', 'CRON_SECRET', target, '--yes', '--force'],
      { input: secret, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );
    console.log('OK CRON_SECRET ->', target);
  } catch (e) {
    const msg = (e.stderr && e.stderr.toString()) || e.message;
    console.log('FAIL', target, String(msg).slice(0, 200));
  }
}
