const assert = require('node:assert/strict'), { chromium } = require('playwright'), fs = require('node:fs');
(async () => {
  fs.mkdirSync('tmp/seating-dp-qa', { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    for (const width of [1280, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto((process.env.READER_URL || 'http://127.0.0.1:8765/reader.html') + '?widget=introvert-seating-dp');
      await page.locator('.sd-widget').waitFor();
      const q = name => page.locator(`[data-sd="${name}"]`);
      // Follow actual playback well into both subtrees. The active node must
      // stay in the graph viewport without moving the surrounding modal.
      await q('speed').selectOption('450');
      await q('play').click();
      const outerScroll = await page.locator('.widget-body').evaluate(el => el.scrollTop);
      for (let i = 0; i < 14; i++) {
        await page.waitForTimeout(450);
        const view = await page.evaluate(() => {
          const viewport = document.querySelector('[data-tree=viewport]').getBoundingClientRect();
          const node = document.querySelector('.sd-node.is-current').getBoundingClientRect();
          return { inside: node.left >= viewport.left - 2 && node.right <= viewport.right + 2 && node.top >= viewport.top - 2 && node.bottom <= viewport.bottom + 2, scroll: document.querySelector('.widget-body').scrollTop };
        });
        assert(view.inside, `Active call stays visible while playing at ${width}`);
        assert.equal(view.scroll, outerScroll, 'Playback does not scroll the outer modal');
      }
      await q('play').click();
      await page.screenshot({ path: `tmp/seating-dp-qa/active-tree-${width}.png` });
      await q('finish').click();
      await page.waitForTimeout(260);
      assert.match(await q('compression').textContent(), /64\/64/);
      const branches = await page.evaluate(() => {
        const nodes = window.SeatingDP.distanceTrace(64, 23, true).nodes;
        return nodes.filter(n => n.children.length === 2).every(n => {
          const bounds = id => document.querySelector(`[data-node="${id}"]`).getBoundingClientRect();
          const a = bounds(n.children[0]), b = bounds(n.children[1]), parent = bounds(n.id);
          return Math.abs(a.top - b.top) < 1 && a.right < b.left && parent.bottom < a.top;
        });
      });
      assert(branches, 'Sibling calls sit side by side underneath their parent');
      await page.screenshot({ path: `tmp/seating-dp-qa/distances-${width}.png` });
      await q('preset').selectOption('largest'); await q('finish').click();
      assert.match(await q('compression').textContent(), /512\/512/);
      const groups = await q('histogram').textContent();
      await q('memo').uncheck(); await q('finish').click();
      assert.equal(await q('histogram').textContent(), groups);
      assert((await q('tree').locator('[data-node]').count()) > 400);
      await q('memo').check(); await q('query').click();
      await q('preset').selectOption('large'); await q('finish').click();
      assert((await q('tree').locator('.cached').count()) > 0);
      await q('tree').locator('.cached').first().click();
      await page.locator('[data-jump]').click();
      await page.screenshot({ path: `tmp/seating-dp-qa/query-${width}.png` });
      assert(await page.locator('.widget-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `No horizontal overflow at ${width}`);
      if (width > 1000) assert(await page.locator('.widget-body').evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'Fits one laptop screen');
      await q('reset').click(); await q('step').click(); await q('back').click();
      assert.equal(await q('tree').locator('[data-node]').count(), 0);
      await q('speed').selectOption('120'); await q('play').click();
      await page.waitForFunction(() => document.querySelectorAll('[data-node]').length >= 3);
      await q('play').click();
      const state = await q('status').textContent(); await page.waitForTimeout(300);
      assert.equal(await q('status').textContent(), state, 'Pause stops progress');
      await q('play').click(); await page.getByRole('button', { name: 'Close interactive widget', exact: true }).click();
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.sd-widget').count(), 0);
      assert.deepEqual(errors, []);
      await page.close(); console.log(`Seating DP ${width}px: direct link, 512 seats, cached/expanded trees, inspect, step/back/play/pause and cleanup passed.`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
