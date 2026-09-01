/**
 * Accessibility gate for the design system.
 *
 * Runs axe-core over every story in both themes against a running Storybook,
 * so a token change that quietly breaks contrast fails here instead of in
 * review. The Storybook a11y addon shows the same results one story at a time;
 * this sweeps all of them and exits non-zero on any violation.
 *
 * Usage:
 *   npm run storybook          # in one terminal
 *   npm run a11y               # in another
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://localhost:6006';

const res = await fetch(`${STORYBOOK_URL}/index.json`).catch(() => {
  console.error(`Could not reach Storybook at ${STORYBOOK_URL}. Start it with \`npm run storybook\`.`);
  process.exit(2);
});
const index = await res.json();
/*
 * The Contrast story renders deliberate low-contrast specimens (borders and
 * fills are held to 3:1, not 4.5:1). axe reads them as body text, so it is
 * skipped here — the same exemption the story declares via its a11y parameter,
 * which this standalone runner does not read.
 */
const stories = Object.values(index.entries).filter(
  (e) => e.type === 'story' && e.title !== 'Foundations/Contrast',
);

const browser = await chromium.launch();
const page = await browser.newPage();
let total = 0;

for (const theme of ['light', 'dark']) {
  for (const story of stories) {
    const url = `${STORYBOOK_URL}/iframe.html?id=${story.id}&globals=theme:${theme}&viewMode=story`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    await page.addScriptTag({ content: axeSource });
    const results = await page.evaluate(async () => {
      // Match the addon's scope: colour-contrast plus the core WCAG A/AA rules.
      const r = await window.axe.run(document.body, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      });
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        count: v.nodes.length,
        sample: v.nodes[0]?.failureSummary?.split('\n').slice(0, 2).join(' ') ?? '',
      }));
    });
    if (results.length) {
      total += results.reduce((n, v) => n + v.count, 0);
      console.log(`\n[${theme}] ${story.title} / ${story.name}`);
      for (const v of results) console.log(`   ${v.id} (${v.impact}) x${v.count} — ${v.sample}`);
    }
  }
}

console.log(`\n${stories.length} stories x 2 themes — ${total} violation node(s).`);
await browser.close();
process.exit(total > 0 ? 1 : 0);
