import { NxAppWebpackPlugin } from '@nx/webpack/app-plugin';
import { join } from 'node:path';

export default {
  // Emit an ES module bundle instead of CommonJS.
  experiments: { outputModule: true },
  output: {
    path: join(import.meta.dirname, '../../dist/apps/backend'),
    clean: true,
    module: true,
    chunkFormat: 'module',
    library: { type: 'module' },
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  // Nx's default externals emit require() calls, which don't exist in ESM.
  // Bare specifiers (packages and node: builtins) stay external; relative
  // imports and the `shared` path alias get bundled.
  externals: [
    ({ request }, callback) =>
      /^(?![./]|shared(\/|$))/.test(request)
        ? callback(null, `module ${request}`)
        : callback(),
  ],
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
      externalDependencies: 'none',
      mergeExternals: true,
    }),
  ],
};
