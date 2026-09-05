import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

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
const EXCLUDED_DIRECTORIES = new Set([
  '.expo',
  '.git',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
]);

function listSourceFiles(directory = '.') {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) files.push(...listSourceFiles(path));
      continue;
    }

    if (entry.isFile()) files.push(path);
  }

  return files;
}

function listFilesToInspect() {
  if (existsSync('.git')) {
    try {
      return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
        .split('\0')
        .filter((file) => file && existsSync(file));
    } catch {
      // Deployment providers may upload source without Git metadata.
    }
  }

  return listSourceFiles();
}

const sourceFiles = listFilesToInspect();

const USER_AUTH_EDGE_FUNCTIONS = ['translate-message', 'translate-profile-bio'];

if (existsSync('supabase/config.toml')) {
  const supabaseConfig = readFileSync('supabase/config.toml', 'utf8');
  for (const functionName of USER_AUTH_EDGE_FUNCTIONS) {
    const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const section = supabaseConfig.match(
      new RegExp(`\\[functions\\.${escapedName}\\]([\\s\\S]*?)(?=\\n\\[|$)`),
    )?.[1];
    if (!section || !/^\s*verify_jwt\s*=\s*false\s*(?:#.*)?$/m.test(section)) {
      findings.push({
        file: 'supabase/config.toml',
        rule: `legacy-edge-jwt-verifier:${functionName}`,
      });
    }
  }
}

for (const file of sourceFiles) {
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

console.log(`Security check passed (${sourceFiles.length} source files inspected).`);
