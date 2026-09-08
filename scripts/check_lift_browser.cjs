const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const out = path.resolve(__dirname, '../tmp/lift-qa'); fs.mkdirSync(out, { recursive: true });
  try {
    for (const width of [1280, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto(process.env.READER_URL || 'http://127.0.0.1:8765/reader.html');
      await page.locator('#toc-toggle').click(); await page.locator('#toc-panel [data-page="44"]').click();
      for (let i = 0; i < 1; i++) {
        const label = await page.locator('#page-label').textContent();
        await page.locator('#next-page').click();
        await page.waitForFunction(previous => document.querySelector('#page-label').textContent !== previous, label);
      }
      await page.getByRole('button', { name: 'Explore Lift Problem', exact: true }).click();
      const root = page.locator('.lf-widget'), q = name => root.locator(`[data-lf="${name}"]`);
      assert.equal(await root.getAttribute('data-order'), '1,2,3,4,5');
      assert.equal(await q('floor').textContent(), '27');
      assert(await page.locator('.widget-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `Overflow at ${width}`);
      await page.screenshot({ path: path.join(out, `initial-${width}.png`) });
      await q('destination').fill('15'); assert(await q('ride').isDisabled());
      await q('destination').fill('27'); assert(await q('ride').isDisabled());
      await q('destination').fill('49'); await q('speed').selectOption('0.5'); await q('ride').click();
      await page.waitForFunction(() => document.querySelector('.lf-widget').dataset.phase === 'travel');
      assert.equal(await root.getAttribute('data-order'), '1,2,3,4,5'); // Commit only after all three phases.
      await page.screenshot({ path: path.join(out, `travel-${width}.png`) });
      await page.waitForFunction(() => document.querySelector('.lf-widget').dataset.busy === 'false');
      assert.equal(await root.getAttribute('data-order'), '1,2,4,5,3');
      assert.equal(await q('floor').textContent(), '49');
      assert.equal(await q('count').textContent(), '1');
      await q('undo').click(); assert.equal(await root.getAttribute('data-order'), '1,2,3,4,5');
      await q('watch').click();
      // Interrupted motion must not commit stale state or append history.
      await q('play').click(); await q('reset').click();
      await page.waitForTimeout(700); assert.equal(await q('count').textContent(), '0');
      assert.equal(await root.getAttribute('data-busy'), 'false');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const preset of ['0', '1', '2', '3']) {
        await q('preset').selectOption(preset);
        for (const strategy of ['selection', 'swaps']) {
          await q('reset').click(); await q('strategy').selectOption(strategy);
          const expected = await page.evaluate(p => window.LiftModel.PRESETS[Number(p)].target.join(','), preset);
          await q('play').click();
          await page.waitForFunction(() => document.querySelector('.lf-widget').dataset.solved === 'true');
          assert.equal(await root.getAttribute('data-order'), expected);
          assert((await q('count').textContent()) * 1 <= (strategy === 'selection' ? 3 : 4) * expected.split(',').length);
          assert.equal(await root.locator('.lf-goal.is-matched').count(), expected.split(',').length);
        }
      }
      await page.screenshot({ path: path.join(out, `solved-eight-${width}.png`) });
      await q('reset').click(); await q('step').click();
      await page.waitForFunction(() => document.querySelector('.lf-widget').dataset.busy === 'false');
      assert.equal(await q('count').textContent(), '1');
      // Pause completes this ride and starts no further one.
      await q('play').click(); await q('play').click();
      await page.waitForFunction(() => document.querySelector('.lf-widget').dataset.busy === 'false');
      const pausedCount = await q('count').textContent(); await page.waitForTimeout(400);
      assert.equal(await q('count').textContent(), pausedCount);
      await root.getByText('Make a challenge', { exact: true }).click();
      await q('target').fill('1 2 2'); await q('custom').click(); assert.match(await q('error').textContent(), /each lift number/);
      await q('target').fill('3 2 1'); await q('start').fill('10'); await q('custom').click();
      assert.equal(await q('nearest').textContent(), '#1');
      assert.match(await q('hint').textContent(), /tie/);
      await q('play').click(); await page.waitForFunction(() => document.querySelector('.lf-widget').dataset.solved === 'true');
      assert.equal(await root.getAttribute('data-order'), '3,2,1');
      assert(await page.locator('.widget-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await q('reset').click(); await q('play').click();
      await page.getByRole('button', { name: 'Close interactive widget', exact: true }).click();
      await page.getByRole('button', { name: 'Explore Lift Problem', exact: true }).click();
      assert.equal(await q('count').textContent(), '0');
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.widget-dialog').count(), 0);
      assert.deepEqual(errors, []); await page.close();
      console.log(`Lift: ${width}px layout, vertical motion, both constructions, all presets, custom ties, undo, pause and cancellation passed.`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
