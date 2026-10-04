import axe from 'axe-core';

/**
 * Runs axe on a rendered container and returns its violations in a readable form, so a failing
 * `expect(...).toEqual([])` names each problem. Colour contrast cannot be measured in jsdom; the Playwright
 * checks in e2e/ cover it in a real browser.
 */
export async function axeViolations(container: Element) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.html),
  }));
}
