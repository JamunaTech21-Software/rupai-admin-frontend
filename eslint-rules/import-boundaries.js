// @ts-check
/**
 * Import boundaries between the layers of src/ (Spec P5 §3.1):
 *
 *   ui/        the component library — imports nothing from features/ or app/
 *   lib/       api, query client, auth, money, dates, i18n — imports nothing from features/ or app/
 *   types/     shared types — imports nothing from features/, app/, ui/ or lib/
 *   features/  a feature imports another feature only through its published index
 *              (`@/features/<name>`), never its internals, and never imports app/
 *   app/       composition root — may import anything
 *
 * Works for both `@/…` alias imports and relative imports, by resolving each specifier to a path under src/.
 */
import path from 'node:path';

/** @typedef {{ layer: string, feature?: string, rest: string[] }} Location */

/**
 * @param {string} posixPathFromSrc path relative to src/, posix separators, no extension stripping needed
 * @returns {Location}
 */
function locate(posixPathFromSrc) {
  const parts = posixPathFromSrc.split('/').filter(Boolean);
  const [layer = '', ...rest] = parts;
  if (layer === 'features') {
    const [feature, ...inner] = rest;
    return feature === undefined ? { layer, rest: inner } : { layer, feature, rest: inner };
  }
  return { layer, rest };
}

/**
 * @param {string} srcDir absolute src/ directory
 * @param {string} filename absolute path of the file being linted
 * @param {string} specifier the import specifier
 * @returns {string | null} the target as a posix path relative to src/, or null if it is outside src/
 */
function resolveTarget(srcDir, filename, specifier) {
  let absolute;
  if (specifier.startsWith('@/')) absolute = path.join(srcDir, specifier.slice(2));
  else if (specifier.startsWith('.')) absolute = path.resolve(path.dirname(filename), specifier);
  else return null; // a package
  const relative = path.relative(srcDir, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join('/');
}

const FORBIDDEN_LAYERS = /** @type {Record<string, string[]>} */ ({
  ui: ['features', 'app'],
  lib: ['features', 'app'],
  types: ['features', 'app', 'ui', 'lib'],
  features: ['app'],
});

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the import boundaries between src/ layers and features (Spec P5 §3.1)' },
    schema: [],
    messages: {
      forbiddenLayer: '`{{from}}/` must not import from `{{to}}/` (Spec P5 §3.1).',
      featureInternals:
        'Import feature `{{feature}}` through its published index (`@/features/{{feature}}`), not its internals.',
    },
  },
  create(context) {
    const filename = context.filename;
    const marker = `${path.sep}src${path.sep}`;
    const at = filename.lastIndexOf(marker);
    if (at === -1) return {};
    const srcDir = filename.slice(0, at + marker.length - 1);
    const from = locate(path.relative(srcDir, filename).split(path.sep).join('/'));

    /** @param {import('estree').Node & { source?: import('estree').Literal | null }} node */
    function check(node) {
      const source = node.source;
      if (!source || typeof source.value !== 'string') return;
      const target = resolveTarget(srcDir, filename, source.value);
      if (target === null) return;
      const to = locate(target);

      if ((FORBIDDEN_LAYERS[from.layer] ?? []).includes(to.layer)) {
        context.report({
          node: source,
          messageId: 'forbiddenLayer',
          data: { from: from.layer, to: to.layer },
        });
        return;
      }

      // Outside a feature, or inside the same feature: no further rule.
      if (to.layer !== 'features' || to.feature === undefined) return;
      if (from.layer === 'features' && from.feature === to.feature) return;

      const throughIndex =
        to.rest.length === 0 || (to.rest.length === 1 && /^index(\.tsx?)?$/.test(to.rest[0] ?? ''));
      if (!throughIndex) {
        context.report({ node: source, messageId: 'featureInternals', data: { feature: to.feature } });
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};

export default rule;
