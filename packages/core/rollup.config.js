import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const createConfig = (format, minify = false) => ({
  input: 'src/index.ts',
  output: {
    file: `dist/index${format === 'es' ? '.esm' : ''}${minify ? '.min' : ''}.js`,
    format,
    name: format === 'umd' ? 'ChenAIKit' : undefined,
    sourcemap: true,
    exports: 'named',
  },
  external,
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: !minify,
      declarationDir: './dist',
      sourceMap: !minify,
    }),
    ...(minify ? [terser()] : []),
  ],
});

export default [
  // CommonJS build
  createConfig('cjs'),
  // ES modules build
  createConfig('es'),
  // UMD build for browsers
  createConfig('umd'),
  // Minified builds for production
  createConfig('cjs', true),
  createConfig('es', true),
  createConfig('umd', true),
];
