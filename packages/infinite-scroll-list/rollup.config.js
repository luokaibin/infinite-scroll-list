import { createConfig } from '@wc-lib/build-config';

export default createConfig({
  input: 'src/index.ts',
  esmFile: 'dist/index.esm.js',
  iifeFile: 'dist/infinite-scroll-list.min.js',
  iifeName: 'InfiniteScrollList',
});
