#!/usr/bin/env node
/**
 * 将 packages 目录下各组件的 dist 产物同步到 website/public/components/目录名/
 * 文档站与 Playground 的 iframe 以静态资源方式加载这些产物，
 * 因此文档站演示的永远是「当前构建」的组件。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const websiteDir = join(scriptsDir, '..');
const rootDir = join(websiteDir, '..');
const packagesDir = join(rootDir, 'packages');
const outDir = join(websiteDir, 'public', 'components');

mkdirSync(outDir, { recursive: true });

// 清理旧产物，保证与当前构建一致
for (const d of readdirSync(outDir)) {
  rmSync(join(outDir, d), { recursive: true, force: true });
}

let count = 0;
for (const name of readdirSync(packagesDir)) {
  const dist = join(packagesDir, name, 'dist');
  if (!existsSync(dist)) continue;
  cpSync(dist, join(outDir, name), { recursive: true });
  count++;
  console.log(`[sync-components] ${name} -> public/components/${name}`);
}

if (count === 0) {
  console.warn('[sync-components] 未发现任何组件 dist 产物，请先执行 pnpm build');
  process.exit(1);
}
console.log(`[sync-components] 完成，共同步 ${count} 个组件产物`);
