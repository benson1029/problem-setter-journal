// Requires Playwright and a running local preview; no production dependencies.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const widths = process.env.WIDGET_WIDTH ? [Number(process.env.WIDGET_WIDTH)] : [1280, 390, 320];
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto(process.env.READER_URL || 'http://127.0.0.1:8765/reader.html');
      async function nextSpread() {
        const label = await page.locator('#page-label').textContent();
        await page.locator('#next-page').click();
        await page.waitForFunction(previous => document.querySelector('#page-label').textContent !== previous, label);
        await page.waitForFunction(() => !document.querySelector('#next-page').disabled || document.querySelector('#page-label').textContent.includes('114'));
      }
      for (const [title, sourcePage, next] of [
        ['Ambiguous Undecimal System', 17, 0],
        ['Mechanical Grid', 37, 0],
        ['Cargo Sorting', 48, 0],
        ['Introvert Seating', 78, 1],
        ['Prisoners’ Gamble', 90, 1],
        ['Arctic Technology', 19, 0],
        ['Repetitive Journey', 24, 2],
      ]) {
        await page.locator('#toc-toggle').click();
        await page.locator(`#toc-panel [data-page="${sourcePage}"]`).click();
        const nextCount = next;
        for (let i = 0; i < nextCount; i += 1) await nextSpread();
        await page.getByRole('button', { name: `Explore ${title}`, exact: true }).first().waitFor();
        assert.equal(await page.getByRole('button', { name: `Explore ${title}`, exact: true }).count(), 1, `${title} should have one chapter anchor badge`);
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
        if (title === 'Arctic Technology') {
          assert.equal(await page.locator('.at-game').count(), 1);
          assert.equal(await page.locator('.at-cell .at-robot').count(), 0);
          assert.equal(await page.locator('.at-cell.is-reachable').count(), 0);
          assert.equal(await page.locator('.at-cell[data-cell="0,1"]').isDisabled(), true, 'Destroy must wait for a move');
          await page.getByLabel('Show possible robot positions').check();
          assert.equal(await page.locator('.at-cell .at-robot').count(), 1);
          await page.getByRole('button', { name: 'Move robot', exact: true }).click();
          assert.match(await page.locator('.at-status').textContent(), /possible position/);
          assert.equal(await page.locator('.at-cell[data-cell="0,0"]').isDisabled(), false, 'Destroy should follow a move');
          assert(await page.locator('img[src="assets/widgets/robot.png"]').count() >= 1);
          await page.getByLabel('Show possible robot positions').uncheck();
          assert.equal(await page.locator('.at-cell .at-robot').count(), 0);
          assert.match(await page.locator('.at-history-list').textContent(), /1 move/);

          // Destroying a cell that could contain the robot is a game-over state.
          await page.getByLabel('Show possible robot positions').check();
          await page.locator('.at-cell[data-cell="0,1"]').click();
          await page.locator('.at-failure').waitFor({ state: 'visible' });
          assert.match(await page.locator('.at-status').textContent(), /Game over: a possible robot position was destroyed/);
          assert.match(await page.locator('.at-history-list').textContent(), /robot could be here/);
          assert.equal(await page.locator('.at-history-list .is-replay-active').count(), 0, 'Replay should begin before the first operation');
          assert.equal(await page.locator('.at-cell.is-destroyed').count(), 0, 'Replay must begin on a clean grid');
          await page.waitForFunction(() => document.querySelector('.at-history-list .is-replay-active')?.textContent.includes('1 move'));
          assert.equal(await page.locator('.at-cell.is-destroyed').count(), 0, 'Move replay should precede destruction');
          await page.waitForFunction(() => document.querySelector('.at-history-list .is-replay-active')?.textContent.includes('Destroy 1, 2'));
          assert.equal(await page.locator('.at-cell.is-destroyed').count(), 1, 'Destruction should appear at the final replay step');
          assert(await page.locator('.at-cell .at-failure-robot').count() >= 1, 'Replay should show the robot on the destroyed cell');

          // If both neighbours of a possible (1,1) position are destroyed,
          // the robot is trapped immediately after the second destruction.
          await page.getByRole('button', { name: 'Reset', exact: true }).click();
          await page.locator('.at-number').fill('2');
          await page.getByRole('button', { name: 'Move robot', exact: true }).click();
          assert.equal(await page.locator('.at-cell[data-cell="1,1"].is-reachable').count(), 1, 'Target must be shown as a possible position');
          assert(await page.locator('.at-cell[data-cell="1,1"] .at-robot').count() >= 1, 'Target possible position should show the robot');
          await page.locator('.at-cell[data-cell="0,1"]').click();
          await page.locator('.at-number').fill('2');
          await page.getByRole('button', { name: 'Move robot', exact: true }).click();
          await page.locator('.at-cell[data-cell="1,0"]').click();
          assert.match(await page.locator('.at-status').textContent(), /Game over: the robot has no legal move/);
          await page.waitForFunction(() => document.querySelector('.at-history-list .is-replay-active')?.textContent.includes('Destroy 2, 1'));
          assert.equal(await page.locator('.at-cell.is-destroyed').count(), 2, 'Replay should apply both destructions');
          assert.equal(await page.locator('.at-cell.is-failure-active').count(), 1, 'Replay should mark the selected trapped path');

          // Regression for the wide-grid sequence: one possible position can
          // be isolated even while other possible positions remain mobile.
          await page.getByRole('button', { name: 'Reset', exact: true }).click();
          await page.locator('.at-select').selectOption('wide');
          await page.locator('.at-number').fill('2');
          await page.getByRole('button', { name: 'Move robot', exact: true }).click();
          assert.match(await page.locator('.at-status').textContent(), /4 possible positions/);
          await page.locator('.at-cell[data-cell="0,1"]').click();
          await page.getByRole('button', { name: 'Move robot', exact: true }).click();
          assert.match(await page.locator('.at-status').textContent(), /6 possible positions/);
          await page.locator('.at-cell[data-cell="1,0"]').click();
          await page.getByRole('button', { name: 'Move robot', exact: true }).click();
          assert.match(await page.locator('.at-status').textContent(), /Game over: the robot has no legal move/);
          await page.waitForFunction(() => document.querySelector('.at-history-list .is-replay-active')?.textContent.includes('no legal move'));

        }
        if (title === 'Repetitive Journey') {
          await page.locator('.rj-arrow').first().click();
          await page.getByRole('button', { name: 'Play', exact: true }).click();
          await page.waitForFunction(() => /Repeating|Infinite/.test(document.querySelector('.rj-status').textContent));
          assert(await page.locator('.rj-map-current').count() >= 1);
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
      console.log(`All widgets: ${width}px layout, badges, keyboard isolation and reopen passed.`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
