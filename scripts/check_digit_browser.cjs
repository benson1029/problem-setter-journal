const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const out = path.resolve(__dirname, '../tmp/digit-qa'); fs.mkdirSync(out, { recursive: true });
  try {
    for (const width of [1280, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto('http://127.0.0.1:8765/reader.html');
      await page.locator('#toc-toggle').click();
      await page.locator('#toc-panel [data-page="29"]').click();
      for (let i = 0; i < 2; i++) {
        const label = await page.locator('#page-label').textContent();
        await page.locator('#next-page').click();
        await page.waitForFunction(previous => document.querySelector('#page-label').textContent !== previous, label);
      }
      await page.getByRole('button', { name: 'Explore Digit Puzzle', exact: true }).click();
      const root = page.locator('.dp-widget'), q = name => root.locator(`[data-dp="${name}"]`);
      assert.match(await q('slots').textContent(), /104 digit slots/);
      assert(await page.locator('.widget-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `Overflow at ${width}`);
      await page.screenshot({ path: path.join(out, `large-${width}.png`) });
      if (width === 1280) {
        await q('speed').selectOption('0.5'); await q('play').click();
        await page.waitForFunction(() => document.querySelector('.dp-widget').dataset.stage === 'done');
        assert.deepEqual(await root.locator('.dp-total').allTextContents(), ['100', '100']);
        await page.screenshot({ path: path.join(out, 'large-solved.png') });
      }
      await q('preset').selectOption('book');
      await q('step').click(); // seed
      await q('step').click(); // jump
      if (width === 1280) {
        await page.waitForFunction(() => document.querySelector('[data-dp=axis]').getAnimations({ subtree: true }).some(a => a.playState === 'running'));
        await page.screenshot({ path: path.join(out, 'jump.png') });
      }
      await q('step').waitFor();
      await q('speed').selectOption('0.5');
      await q('play').click();
      await page.waitForFunction(() => document.querySelector('.dp-widget').dataset.stage === 'done');
      assert.deepEqual(await root.locator('.dp-total').allTextContents(), ['10', '10']);
      await root.locator('.dp-expression summary').click();
      assert.match(await q('verdict').textContent(), /Verified/);
      await page.screenshot({ path: path.join(out, `solved-${width}.png`) });
      await q('preset').selectOption('impossible');
      await q('step').click(); await q('step').click();
      assert.equal(await root.getAttribute('data-stage'), 'impossible');
      assert.match(await q('status').textContent(), /only 9/);
      await q('preset').selectOption('powers');
      await q('step').click(); await q('step').click();
      // Reset while the jump animation is running: no stale continuation.
      await q('reset').click();
      assert.equal(await root.getAttribute('data-stage'), 'group');
      await q('play').click(); await q('play').click();
      assert.equal(await q('play').textContent(), 'Play solution');
      if (width === 320) {
        await root.locator('.dp-custom summary').click();
        const groups = side => root.locator(`[data-dp="${side}-groups"] .dp-term-group`);
        await groups('positive').locator('.dp-group-count').fill('121'); await q('custom').click();
        assert.match(await q('error').textContent(), /1–120 whole terms/);
        await groups('positive').locator('.dp-group-count').fill('8');
        await groups('negative').locator('.dp-group-count').fill('2');
        await q('add-positive').click(); await q('add-negative').click();
        await groups('positive').nth(1).locator('.dp-group-count').fill('2');
        await groups('positive').nth(1).locator('.dp-group-length').fill('3');
        await groups('negative').nth(1).locator('.dp-group-count').fill('1');
        await groups('negative').nth(1).locator('.dp-group-length').fill('4');
        await q('custom').click();
        assert.match(await q('counts').textContent(), /10 positive · 4 negative/);
        assert.equal(await q('positive').locator('.dp-factors').count(), 2);
        assert.equal(await q('negative').locator('.dp-factors').count(), 3);
        assert.equal(await q('positive').locator('.dp-digit.is-blank').count(), 4); // 1-factor and 3-factor groups
        assert.equal(await q('negative').locator('.dp-digit.is-blank').count(), 7); // 2, 4, and the RHS digit
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await q('play').click();
        await page.waitForFunction(() => document.querySelector('.dp-widget').dataset.stage === 'done');
        const totals = await root.locator('.dp-total').allTextContents(); assert.equal(totals[0], totals[1]);
        assert(await page.locator('.widget-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      }
      await page.getByRole('button', { name: 'Close interactive widget', exact: true }).click();
      await page.getByRole('button', { name: 'Explore Digit Puzzle', exact: true }).click();
      assert.equal(await root.getAttribute('data-stage'), 'group');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.widget-dialog').count(), 0);
      assert.deepEqual(errors, []);
      await page.close(); console.log(`Digit Puzzle: ${width}px layout, animation, exact solution, impossible case, reset and reopen passed.`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
