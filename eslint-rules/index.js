// @ts-check
// Project-local ESLint rules, registered as the `rupai` plugin in eslint.config.js.
import importBoundaries from './import-boundaries.js';

export default {
  meta: { name: 'eslint-plugin-rupai' },
  rules: { 'import-boundaries': importBoundaries },
};
