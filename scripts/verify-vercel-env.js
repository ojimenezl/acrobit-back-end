const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function get(content, key) {
  const re = new RegExp('^' + key + '=(.*)$', 'm');
  const m = content.match(re);
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

const vc = path.join(
  process.env.APPDATA || '',
  'npm/node_modules/vercel/dist/vc.js',
);
const tmp = '.env.vercel.check';
execFileSync(
  process.execPath,
  [vc, 'env', 'pull', tmp, '--yes', '--environment', 'production'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

const local = fs.readFileSync('.env', 'utf8');
const pulled = fs.readFileSync(tmp, 'utf8');
const L = get(local, 'MONGODB_URI');
const P = get(pulled, 'MONGODB_URI');
console.log(
  'mongoLenLocal=' +
    L.length +
    ' mongoLenPulled=' +
    P.length +
    ' majority=' +
    P.includes('majority') +
    ' match=' +
    (L === P),
);
console.log(
  'hasFirebaseJson=' + pulled.includes('FIREBASE_SERVICE_ACCOUNT_JSON='),
);
console.log('hasJwt=' + pulled.includes('JWT_SECRET='));
console.log('hasOpenAI=' + pulled.includes('OPENAI_API_KEY='));
fs.unlinkSync(tmp);
