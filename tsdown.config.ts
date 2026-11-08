/**
 * Two artifacts, one npm package:
 * - lib/index.js  Host ESM (Stockfish + Lichess routes).
 * - lib/client.js Browser lazy-CJS factory registered with the DSH module
 *   loader. React is resolved from the platform table; everything else is
 *   bundled so installation has no runtime dependency tree.
 */
import { defineConfig } from 'tsdown'

const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'cordis',
]

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'node20',
    clean: false,
    dts: false,
    sourcemap: true,
    deps: {
      alwaysBundle: [/.*/],
      onlyBundle: false,
    },
    outputOptions: {
      entryFileNames: 'index.js',
    },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'neutral',
    target: 'es2022',
    clean: false,
    dts: false,
    sourcemap: true,
    deps: {
      neverBundle: CLIENT_EXTERNALS,
      onlyBundle: false,
    },
    inputOptions: {
      platform: 'browser',
      resolve: {
        conditionNames: ['browser', 'import', 'require', 'default'],
      },
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({\n\tid: "dsh-chess-coach",\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;`,
      footer: `return module.exports;\n\t}\n});`,
      codeSplitting: false,
    },
  },
])
