import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const FORBIDDEN_DISCOVERY_COPY = [
  '오늘 볼 수 있는 사람을 다 봤어요',
  '오늘의 후보를 모두 확인했어요',
  '오늘의 후보를 다 봤어요',
];
const findings = [];

for (const file of [...listSourceFiles('app'), ...listSourceFiles('src')]) {
  const source = readFileSync(file, 'utf8');

  for (const copy of FORBIDDEN_DISCOVERY_COPY) {
    if (source.includes(copy)) findings.push(`${file}: final-sounding discovery copy: ${copy}`);
  }

  for (const match of source.matchAll(/fontSize\s*:\s*([0-9]+(?:\.[0-9]+)?)/g)) {
    if (Number(match[1]) < 10) findings.push(`${file}: undersized text: ${match[0]}`);
  }
}

if (findings.length) {
  console.error('UI quality check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('UI quality check passed.');

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}
