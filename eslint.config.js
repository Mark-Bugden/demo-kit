import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/', '**/dist/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'template/src/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['bin/**/*.js', 'scripts/**/*.js', 'test/**/*.js', 'template/vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
];
