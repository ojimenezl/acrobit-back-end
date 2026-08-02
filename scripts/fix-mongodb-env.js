/**
 * Re-push MONGODB_URI (and any key) via stdin — avoids cmd.exe breaking on `&`.
 */
const { execFileSync, execSync } = require('child_process');
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
const uri = env.MONGODB_URI;
if (!uri) {
  console.error('No MONGODB_URI in .env');
  process.exit(1);
}

const vercelBin = execSync('where vercel', { encoding: 'utf8' })
  .split(/\r?\n/)
  .map((s) => s.trim())
  .find((s) => s.toLowerCase().endsWith('.cmd') || s.toLowerCase().endsWith('.exe'));

if (!vercelBin) {
  console.error('vercel CLI not found');
  process.exit(1);
}

for (const target of ['production', 'preview', 'development']) {
  try {
    execFileSync(vercelBin, ['env', 'add', 'MONGODB_URI', target, '--yes', '--force'], {
      input: uri,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    console.log('OK MONGODB_URI ->', target, 'len=' + uri.length, 'hasMajority=' + uri.includes('majority'));
  } catch (e) {
    const msg = (e.stderr && e.stderr.toString()) || e.message;
    console.log('FAIL', target, String(msg).slice(0, 300));
  }
}

// Verify pull without printing secret
const tmp = path.join(__dirname, '..', '.env.vercel.check');
try {
  execFileSync(vercelBin, ['env', 'pull', tmp, '--yes', '--environment', 'production'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const pulled = parseEnv(fs.readFileSync(tmp, 'utf8'));
  const p = pulled.MONGODB_URI || '';
  console.log(
    'VERIFY production MONGODB_URI len=' +
      p.length +
      ' hasMajority=' +
      p.includes('majority') +
      ' hasRetry=' +
      p.includes('retryWrites') +
      ' matchLocal=' +
      (p === uri),
  );
  fs.unlinkSync(tmp);
} catch (e) {
  console.log('VERIFY fail', String(e.message).slice(0, 200));
  try {
    fs.unlinkSync(tmp);
  } catch {}
}
