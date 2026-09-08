// Verifies the shared badge host without replaying every widget interaction.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.READER_URL || 'http://127.0.0.1:8765/reader.html');
    await page.waitForFunction(() => window.JournalWidgets?.length >= 9);
    const result = await page.evaluate(() => {
      const definitions = window.JournalWidgets;
      const rect = { left: 100, top: 50, width: 300, height: 500, right: 400, bottom: 550 };
      const canvas = document.createElement('canvas');
      canvas.getBoundingClientRect = () => rect;
      const results = [];
      for (const definition of definitions) {
        const badge = definition.badge;
        const earlierPage = definition.pages.find(page => page !== badge.page);
        if (earlierPage !== undefined) {
          window.dispatchEvent(new CustomEvent('journal:view', { detail: { pages: [earlierPage], canvases: [canvas] } }));
          results.push({ title: definition.title, before: document.querySelectorAll(`[aria-label="Explore ${definition.title}"]`).length });
        }
        window.dispatchEvent(new CustomEvent('journal:view', { detail: { pages: [badge.page], canvases: [canvas] } }));
        const button = document.querySelector(`[aria-label="Explore ${definition.title}"]`);
        results.push({ title: definition.title, count: document.querySelectorAll(`[aria-label="Explore ${definition.title}"]`).length, left: button?.style.left, top: button?.style.top, expectedTop: `${Math.min(490, 50 + 500 * badge.y + (badge.offsetY || 0))}px` });
      }
      return results;
    });
    for (const entry of result) {
      if ('before' in entry) assert.equal(entry.before, 0, `${entry.title} must not appear before its anchor page`);
      else {
        assert.equal(entry.count, 1, `${entry.title} needs exactly one Explore badge on its anchor page`);
        assert.equal(entry.left, '336px', `${entry.title} should use the solution/errata single-page column`);
        assert(Math.abs(Number.parseFloat(entry.top) - Number.parseFloat(entry.expectedTop)) < .01, `${entry.title} anchor row is wrong`);
      }
    }
    assert.deepEqual(errors, []);
    console.log(`Widget badges: ${result.filter(entry => 'count' in entry).length} chapter anchors are singular, deferred and gutter-aligned.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
