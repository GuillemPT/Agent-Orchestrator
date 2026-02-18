/**
 * esbuild script for the Electron main process.
 * Replaces `tsc -p tsconfig.main.json` to:
 *  - Bundle all TypeScript (path aliases resolved at build time)
 *  - Target the Node.js version embedded in Electron 28
 *  - Keep native modules (keytar, chokidar) external so their native addons load correctly
 */

import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20', // Electron 28 uses Node 20
  external: [
    'electron',
    'keytar',
    'chokidar',
    // keep the node built-ins external (they're always available)
    'path', 'fs', 'os', 'child_process', 'util', 'crypto', 'events',
  ],
  sourcemap: true,
  logLevel: 'info',
};

async function build() {
  const ctx = await esbuild.context({
    ...commonOptions,
    entryPoints: [path.join(root, 'src/main/main.ts')],
    outfile: path.join(root, 'dist/main/main.js'),
    // Resolve @domain/* etc. to their actual paths
    alias: {
      '@domain': path.join(root, 'src/domain'),
      '@application': path.join(root, 'src/application'),
      '@infrastructure': path.join(root, 'src/infrastructure'),
      '@presentation': path.join(root, 'src/presentation'),
      '@': path.join(root, 'src'),
    },
  });

  const preloadCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: [path.join(root, 'src/main/preload.ts')],
    outfile: path.join(root, 'dist/main/preload.js'),
    alias: {
      '@domain': path.join(root, 'src/domain'),
      '@application': path.join(root, 'src/application'),
      '@infrastructure': path.join(root, 'src/infrastructure'),
      '@presentation': path.join(root, 'src/presentation'),
      '@': path.join(root, 'src'),
    },
  });

  if (watch) {
    await ctx.watch();
    await preloadCtx.watch();
    console.log('Watching for changes in main process...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    await preloadCtx.rebuild();
    await preloadCtx.dispose();
    console.log('Main process built successfully.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
