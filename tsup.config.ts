import { defineConfig } from 'tsup';

// Bundle the CLI entrypoint to ESM. Runtime dependencies (ink, pglite, pg,
// playwright, mathjs ...) are kept external and resolved from node_modules,
// which keeps native/wasm modules working and the build fast.
export default defineConfig({
  entry: { index: 'src/index.tsx' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  banner: { js: '#!/usr/bin/env node' },
});
