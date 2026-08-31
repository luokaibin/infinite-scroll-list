import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { publint } from 'publint';

const pkgDir = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(readFileSync(pkgDir + 'package.json', 'utf-8'));
const srcVersion = /'([^']+)'/.exec(
  readFileSync(pkgDir + 'src/version.ts', 'utf-8'),
)![1];

describe('包契约（packaging）', () => {
  it('exports/main/module/types 指向的文件全部存在', () => {
    const targets: string[] = [
      pkg.main,
      pkg.module,
      pkg.types,
      ...Object.values(pkg.exports['.']),
    ];
    for (const t of targets) {
      expect(existsSync(pkgDir + String(t).replace(/^\.\//, '')), `缺失产物: ${t}`).toBe(true);
    }
  });

  it('src/version.ts 与 package.json 版本一致', () => {
    expect(srcVersion).toBe(pkg.version);
  });

  it('publint 无 error 级发布问题', async () => {
    const { messages } = await publint({ pkgDir });
    const errors = messages.filter((m: any) => m.level === 'error');
    expect(errors.map((m: any) => m.code ?? m.message)).toEqual([]);
  });
});
