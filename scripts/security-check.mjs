import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '',
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const findings = [];
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

for (const file of trackedFiles) {
  if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
  const content = readFileSync(file, 'utf8');

  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
    findings.push({ file, rule: 'private-key-material' });
  }
  if (/sb_secret_[A-Za-z0-9._-]{12,}/.test(content)) {
    findings.push({ file, rule: 'supabase-secret-key' });
  }

  for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') {
        findings.push({ file, rule: 'legacy-service-role-jwt' });
      }
    } catch {
      // Ignore non-JWT text that only resembles a token.
    }
  }

  for (const match of content.matchAll(/\b(EXPO_PUBLIC_[A-Z0-9_]+)\b/g)) {
    const name = match[1];
    if (/(?:SERVICE|SECRET|PRIVATE|PASSWORD|TOKEN)/.test(name)) {
      findings.push({ file, rule: `unsafe-public-env:${name}` });
    }
  }
}

for (const name of Object.keys(process.env)) {
  if (name.startsWith('EXPO_PUBLIC_') && /(?:SERVICE|SECRET|PRIVATE|PASSWORD|TOKEN)/.test(name)) {
    findings.push({ file: 'process environment', rule: `unsafe-public-env:${name}` });
  }
}

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (configuredUrl) {
  try {
    const parsed = new URL(configuredUrl);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(isLocal && parsed.protocol === 'http:')) {
      findings.push({ file: 'process environment', rule: 'insecure-supabase-url' });
    }
  } catch {
    findings.push({ file: 'process environment', rule: 'invalid-supabase-url' });
  }
}

const configuredKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (configuredKey) {
  if (
    configuredKey.startsWith('sb_secret_') ||
    configuredKey.toLowerCase().includes('service_role')
  ) {
    findings.push({ file: 'process environment', rule: 'supabase-server-key-in-public-env' });
  } else {
    try {
      const payload = JSON.parse(
        Buffer.from(configuredKey.split('.')[1] ?? '', 'base64url').toString('utf8'),
      );
      if (payload.role === 'service_role') {
        findings.push({
          file: 'process environment',
          rule: 'legacy-service-role-jwt-in-public-env',
        });
      }
    } catch {
      // Modern publishable keys are opaque, not JWTs.
    }
  }
}

if (findings.length) {
  console.error('Security check failed. Potential server secret material was found:');
  for (const finding of findings) console.error(`- ${finding.file} (${finding.rule})`);
  process.exit(1);
}

console.log(`Security check passed (${trackedFiles.length} tracked files inspected).`);
