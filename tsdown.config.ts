/**
 * Dual-face tsdown: like a real out-of-tree DSH plugin this ships
 * lib/index.js (Host, tsc) + lib/client.js (browser closure-factory).
 * For standalone use we also keep the Vite demo at dist/.
 */
import { defineConfig } from 'tsdown'

const CLIENT_EXTERNALS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-renderer',
]

const INLINE_SAFE = /^@deepseek-ai\/dsh-(session|llm|tools|brand|deque|output-retention|typert-protocol|util-crypto|util-values|util-workspace-path)(\/|$)|@deepseek-ai\/dsh-token-meter\/client$/
const VENDORED_LIBRARY = /^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/
const GENERATED_REMOTE = /^@deepseek-ai\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*\/remote$/

export default defineConfig([
  // Host half — the actual cordis plugin. tsc already emits types;
  // tsdown emits the runnable lib/index.js. In harness builds the harness
  // tsc pre-pass provides lib/types, so we only bundle lib/index.js.
  {
    name: 'dsh-plugin-github-manager/host',
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    // Never inline platform peers; everything else inlines (undici etc.)
    external: [...CLIENT_EXTERNALS, /^@deepseek-ai\//],
    noExternal: undefined,
  },
  // Client half — browser closure-factory for window.__ModuleLoader__
  {
    name: 'dsh-plugin-github-manager/client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    // undici/host-only code is tree-shaken out; everything not in the
    // loader module-table must inline or the browser throws at boot.
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    plugins: [
      {
        name: 'dsh-client-bundle-purity',
        resolveId(source: string) {
          if (!source.startsWith('@deepseek-ai/')) return null
          if ((CLIENT_EXTERNALS as readonly string[]).includes(source)) return null
          if (VENDORED_LIBRARY.test(source)) return null
          if (INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source)) return null
          // Allow our own sibling chunks (types only / pure contracts)
          if (source.startsWith('@deepseek-ai/dsh-plugin')) return null
          throw new Error(
            `client bundle purity: "${source}" is not in CLIENT_EXTERNALS, INLINE_SAFE or GENERATED_REMOTE — ` +
              'cross-plugin @deepseek-ai value imports are forbidden; collaborate through cordis services.',
          )
        },
      },
    ],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: \"dsh-plugin-github-manager\", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
