// Builds the distributable bundles into `dist/`. Run with `npm run build`.
import { build } from 'esbuild';

/** @type {import('esbuild').BuildOptions} */
const COMMON_OPTIONS = {
    entryPoints: ['src/index.js'],
    bundle: true,
    target: ['es2022'],
    sourcemap: true,
    legalComments: 'none',

    // Keep class names, which error messages and debugging rely on.
    keepNames: true,
    logLevel: 'info',
};

// An ES module for bundlers and `<script type="module">`.
await build({ ...COMMON_OPTIONS, format: 'esm', outfile: 'dist/widgetry.js' });

// A minified classic script exposing the global `widgetry`, which also works from `file://` URLs.
await build({
    ...COMMON_OPTIONS,
    format: 'iife',
    globalName: 'widgetry',
    minify: true,
    outfile: 'dist/widgetry.min.js',
});

// The stylesheet, with all imports inlined.
await build({
    entryPoints: ['src/styles/index.css'],
    bundle: true,
    loader: { '.svg': 'dataurl' },
    target: ['chrome111', 'firefox113', 'safari16.4'],
    outfile: 'dist/widgetry.css',
    logLevel: 'info',
});
