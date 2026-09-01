#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROUTE_ROOT = 'app';
const ROUTE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function collectRouteFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(path);
    return ROUTE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

const routeFiles = collectRouteFiles(ROUTE_ROOT);
const missingDefaultExports = routeFiles.filter(
  (file) => !/\bexport\s+default\b/.test(readFileSync(file, 'utf8')),
);

if (missingDefaultExports.length > 0) {
  console.error('❌ Expo Router default export가 없는 라우트:');
  for (const file of missingDefaultExports) console.error(`  - ${relative(process.cwd(), file)}`);
  process.exit(1);
}

console.log(`✅ Expo Router 라우트 ${routeFiles.length}개에 default export가 있습니다.`);
