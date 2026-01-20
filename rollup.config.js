import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/infinite-scroll-list.ts',
  output: {
    file: 'dist/infinite-scroll-list.min.js',
    format: 'iife',
    name: 'InfiniteScrollList',
    sourcemap: true
  },
  plugins: [
    nodeResolve(),
    typescript(),
    terser({
      compress: {
        drop_console: true,
      },
    })
  ]
};
