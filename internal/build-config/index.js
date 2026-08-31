/**
 * 共享 Rollup 配置工厂（monorepo 内部使用，不发布）
 *
 * 为每个 Web Component 包生成双产物配置：
 * - ESM（dist/index.esm.js）：npm 主通道，随业务 bundle 打包，无加载竞态
 * - IIFE（dist/*.min.js）：CDN / <script> 兜底通道
 *
 * @param {object} options
 * @param {string} options.input      入口文件（应为 SSR-safe 的 src/index.ts）
 * @param {string} options.esmFile    ESM 输出路径
 * @param {string} options.iifeFile   IIFE 输出路径
 * @param {string} [options.iifeName] IIFE 全局变量名
 * @returns {import('rollup').RollupOptions[]}
 */
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export function createConfig({ input, esmFile, iifeFile, iifeName }) {
  const common = {
    input,
    plugins: [nodeResolve(), typescript()],
  };

  return [
    {
      ...common,
      output: {
        file: esmFile,
        format: 'es',
        sourcemap: true,
      },
    },
    {
      ...common,
      output: {
        file: iifeFile,
        format: 'iife',
        name: iifeName,
        sourcemap: true,
        plugins: [terser({ compress: { drop_console: true } })],
      },
    },
  ];
}
