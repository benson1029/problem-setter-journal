// Requires Playwright and a running local preview; no production dependencies.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto(process.env.READER_URL || 'http://127.0.0.1:8765/reader.html');
      for (const [title, sourcePage, next] of [
        ['Ambiguous Undecimal System', 17, false],
        ['Mechanical Grid', 37, false],
        ['Cargo Sorting', 48, false],
        ['Introvert Seating', 78, true],
        ['Prisoners’ Gamble', 90, false],
      ]) {
        await page.locator('#toc-toggle').click();
        await page.locator(`#toc-panel [data-page="${sourcePage}"]`).click();
        if (next) await page.locator('#next-page').click();
        await page.getByRole('button', { name: `Explore ${title}`, exact: true }).first().waitFor();
        if (title === 'Mechanical Grid') assert.equal(await page.getByRole('button', { name: 'Explore Mechanical Grid', exact: true }).count(), 1);
        await page.getByRole('button', { name: `Explore ${title}`, exact: true }).first().click();
        const dialog = page.locator('.widget-dialog');
        await dialog.waitFor({ state: 'visible' });
        assert.equal(await dialog.getAttribute('aria-labelledby'), 'widget-title');
        assert(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }), `${title}: panel outside ${width}px viewport`);
        assert(await page.locator('.widget-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${title}: horizontal overflow at ${width}px`);
        if (title === 'Ambiguous Undecimal System') {
          await page.getByRole('button', { name: 'Book example 2', exact: true }).click();
          assert.match(await page.locator('.ud-decimal').first().textContent(), /1,342/);
          await page.getByRole('button', { name: 'Join all', exact: true }).first().click();
          assert.match(await page.locator('.ud-decimal').first().textContent(), /120/);
          await page.getByRole('button', { name: 'Reveal ranges and conclusion', exact: true }).click();
          assert.match(await page.locator('.ud-verdict').textContent(), /X > Y is guaranteed/);
        }
        if (title === 'Prisoners’ Gamble') {
          const contents = await page.locator('.pg-content').allTextContents();
          assert.match(await page.locator('.pg-cycle-status').textContent(), /Longest cycle: 3/);
          await page.getByRole('button', { name: 'Open next locker', exact: true }).click();
          assert.match(await page.locator('.pg-trace').textContent(), /find 5/);
          for (const [a, b] of [['1', '7'], ['2', '8']]) {
            await page.locator('.pg-swap-a').selectOption(a);
            await page.locator('.pg-swap-b').selectOption(b);
            await page.getByRole('button', { name: 'Announce swap', exact: true }).click();
          }
          assert.match(await page.locator('.pg-cycle-status').textContent(), /All prisoners can succeed/);
          assert.deepEqual(await page.locator('.pg-content').allTextContents(), contents, 'Relabelling must not move physical contents');
          await page.getByRole('button', { name: 'Undo swap', exact: true }).click();
          assert.match(await page.locator('.pg-cycle-status').textContent(), /Not all prisoners/);
        }
        if (title === 'Cargo Sorting') {
          const initial = await page.locator('.cargo-pile').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
          await page.getByRole('button', { name: 'Step one move', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('.cargo-status').textContent.startsWith('1 moves'));
          assert.match(await page.locator('.cargo-log ol').textContent(), /B · slot 1 → 2/);
          await page.locator('.cargo-widget [data-action="undo"]').click();
          assert.deepEqual(await page.locator('.cargo-pile').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), initial);
          await page.getByRole('button', { name: 'Look up', exact: true }).click();
          assert.match(await page.locator('.cargo-answer').textContent(), /Move 1: blue, slot 1 → 2/);
        }
        const label = await page.locator('#page-label').textContent();
        await page.locator('.widget-close').focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('#page-label').textContent(), label, `${title}: reader shortcut escaped modal`);
        await page.getByRole('button', { name: 'Close interactive widget', exact: true }).click();
        assert.equal(await page.locator('.widget-dialog').count(), 0);
        // A fresh mount must work after disposing the previous instance.
        await page.getByRole('button', { name: `Explore ${title}`, exact: true }).first().click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.widget-dialog').count(), 0);
      }
      assert.deepEqual(errors, [], `Browser errors at ${width}px`);
      await context.close();
      console.log(`All five widgets: ${width}px layout, badges, keyboard isolation and reopen passed.`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
