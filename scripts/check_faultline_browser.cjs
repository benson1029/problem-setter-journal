const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../widgets/faultline-model.js');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const widths = process.env.FAULTLINE_WIDTH ? [Number(process.env.FAULTLINE_WIDTH)] : [1280, 390, 320];
  const out = path.resolve(__dirname, '../tmp/faultline-qa'); fs.mkdirSync(out, { recursive: true });
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 940 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto(process.env.READER_URL || 'http://127.0.0.1:8765/reader.html');
      await page.locator('#toc-toggle').click(); await page.locator('#toc-panel [data-page="53"]').click();
      for (let i = 0; i < (width > 720 ? 3 : 6); i++) {
        const label = await page.locator('#page-label').textContent(); await page.locator('#next-page').click();
        await page.waitForFunction(previous => document.querySelector('#page-label').textContent !== previous, label);
      }
      await page.getByRole('button', { name: 'Explore Faultline of the Earthquake', exact: true }).click();
      const root = page.locator('.fl-widget');
      const q = name => root.locator(`[data-fl="${name}"]`);
      const point = (grid, id) => q(grid).locator(`[data-point="${id}"]`);
      const tab = name => root.locator(`[data-fl-tab="${name}"]`).click();
      const snap = async name => {
        assert(await page.locator('.widget-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `Overflow in ${name} at ${width}px`);
        await root.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, `${name}-${width}.png`) });
      };
      assert.match(await q('path-status').textContent(), /Shortest/);
      assert.equal(await root.locator('.fl-node text').count(), 0);
      await point('path-grid', '3,2').hover();
      assert.equal(await q('path-grid').locator('.fl-coordinate').textContent(), '(3, 2)');
      assert.equal(await q('path-grid').locator('.fl-coordinate').evaluate(el => getComputedStyle(el).fill), 'rgb(17, 17, 17)');
      await snap('paths');
      await q('path-example').selectOption('detour');
      assert.match(await q('path-status').textContent(), /all three edge families/);
      await q('path-example').selectOption('reverse');
      assert.match(await q('path-status').textContent(), /Can be shortened/);
      assert.equal(await root.locator('.fl-family .is-used').count(), 2);
      await q('shortest').click(); assert.match(await q('path-status').textContent(), /Shortest/);
      const before = await q('path-grid').getAttribute('data-path');
      const expected = before.split(';').map(id => { const [row,col] = id.split(',').map(Number); return M.key(M.rotate({row,col},8)); }).join(';');
      await q('rotate').click();
      assert.equal(await q('path-grid').getAttribute('aria-busy'), 'true');
      const animation = await q('path-grid').locator('.fl-world').evaluate(el => {
        const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 500;
        return { transform: getComputedStyle(el).transform, duration: animation.effect.getTiming().duration };
      });
      assert.notEqual(animation.transform, 'none'); assert.equal(animation.duration, 1000);
      assert.equal(await q('path-grid').getAttribute('data-path'), before);
      await snap('rotation');
      // At 120°, every animated point must land on its model-rotated position.
      const alignmentError = await q('path-grid').evaluate(svg => {
        svg.querySelector('.fl-world').getAnimations()[0].currentTime = 1000;
        let worst = 0;
        for (const node of svg.querySelectorAll('.fl-node')) {
          const [row,col] = node.dataset.point.split(',').map(Number);
          const rotated = window.FaultlineModel.rotate({row,col},8);
          const target = new DOMPoint(280 + (rotated.col - (rotated.row + 1)/2)*Math.sqrt(3)*240/7, 40+(rotated.row-1)*360/7).matrixTransform(svg.getScreenCTM());
          const actual = new DOMPoint(0,0).matrixTransform(node.getScreenCTM());
          worst = Math.max(worst, Math.hypot(target.x-actual.x,target.y-actual.y));
        }
        svg.querySelector('.fl-world').getAnimations()[0].currentTime = 500;
        return worst;
      });
      assert(alignmentError < 0.1, `Rotation landing drift: ${alignmentError}`);
      await q('path-grid').locator('.fl-world').evaluate(el => el.getAnimations()[0].play());
      await page.waitForFunction(() => !document.querySelector('[data-fl=path-grid]').hasAttribute('aria-busy'));
      assert.equal(await q('path-grid').getAttribute('data-path'), expected);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (let i=0;i<2;i++) {
        await q('rotate').click();
        await page.waitForFunction(() => !document.querySelector('[data-fl=path-grid]').hasAttribute('aria-busy'));
      }
      assert.equal(await q('path-grid').getAttribute('data-path'), before);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await q('rotate').click(); await q('clear-path').click();
      assert.equal(await q('path-grid').getAttribute('data-path'), '');
      for (const id of ['1,1','2,1','2,2']) await point('path-grid',id).click();
      await q('path-undo').click(); assert.equal(await q('path-grid').getAttribute('data-path'),'1,1;2,1');

      await tab('sensor');
      await point('sensor-grid','5,3').click();
      assert.match(await q('sensor-status').textContent(), /Not valid yet · actual reading 0/);
      await q('sensor-clear').click(); await point('sensor-grid','3,1').click();
      assert.match(await q('sensor-status').textContent(), /Valid faultline · actual reading 2/);
      await point('sensor-grid','4,2').click();
      assert.match(await q('sensor-status').textContent(), /Not valid yet · actual reading 1/);
      await q('sensor-undo').click(); assert.match(await q('sensor-status').textContent(), /Valid faultline/);
      await snap('sensor');
      await q('sensor-move').click(); await point('sensor-grid','1,1').click();
      assert(await point('sensor-grid','1,1').evaluate(el => el.classList.contains('is-sensor')));
      await root.locator('#fl-sensor summary').click();
      await q('sensor-col').fill('99'); await q('sensor-apply').click();
      assert.match(await q('sensor-error').textContent(), /column/);
      await q('sensor-reset').click(); await q('sensor-draw').click(); await q('reading').fill('0');
      await point('sensor-grid','5,3').click();
      assert.match(await q('sensor-status').textContent(), /Valid faultline · actual reading 0/);

      await tab('discover');
      assert.equal(await root.getByRole('tab').count(),4);
      assert.equal(await q('highlight-corners').isChecked(),false);
      assert.equal(await q('discovery-grid').locator('.fl-corner-halo').count(),0);
      let generated = await q('discovery-grid').getAttribute('data-path');
      await point('discovery-grid','5,3').click();
      assert.equal(await q('discovery-grid').getAttribute('data-path'),generated);
      await snap('discovery');
      await q('highlight-corners').check();
      assert.equal(await q('discovery-grid').locator('.fl-corner-halo').count(),2);
      assert.equal(await q('discovery-grid').getAttribute('data-path'),generated);
      assert.match(await q('discovery-status').textContent(), /visits the (left|right) corner/);
      for(let i=0;i<8;i++) {
        await q('random-path').click();
        generated = await q('discovery-grid').getAttribute('data-path');
        const route = generated.split(';').map(id=>{const [row,col]=id.split(',').map(Number);return {row,col};});
        assert.equal(M.reading(route,{row:7,col:4}),2);
        assert(M.pathInfo(route).shortest); assert.equal(route.length,11);
        assert.equal(await q('discovery-grid').locator('.fl-corner-halo').count(),2);
      }
      await snap('discovery-revealed');
      await q('highlight-corners').uncheck();
      assert.equal(await q('discovery-grid').locator('.fl-corner-halo').count(),0);
      await tab('sensor'); await tab('discover');
      assert.equal(await q('discovery-grid').getAttribute('data-path'),generated);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await tab('corners');
      const play = async (possible, count) => {
        await q('corner-play').click();
        await page.waitForFunction(n => Number(document.querySelector('[data-fl=corner-grid]').dataset.progress) === n, count);
        assert.equal(await q('corner-grid').getAttribute('data-solved'), String(possible));
        assert.match(await q('corner-status').textContent(), possible ? /all .* readings verified/ : /No valid top-to-bottom/);
      };
      assert.equal(await q('corner-grid').getAttribute('data-progress'),'0');
      await q('corner-step').click(); assert.equal(await q('corner-grid').getAttribute('data-progress'),'1');
      await play(true,5);
      await root.locator('[data-layer="2"]').click();
      await snap('corners');
      await q('corner-example').selectOption('impossible'); await play(false,4);
      await q('corner-example').selectOption('small'); await play(true,4);
      await q('edit-case').click();
      await q('case-size').fill('12'); await q('cancel-case').click();
      await q('edit-case').click(); assert.equal(await q('case-size').inputValue(),'7');
      await q('case-size').fill('5'); await q('case-end').fill('3');
      await root.locator('.fl-editor-row').last().locator('[data-remove]').click();
      await root.locator('.fl-editor-row [data-field=row]').fill('3');
      await root.locator('.fl-editor-row [data-field=col]').fill('99');
      await root.locator('.fl-editor-row [data-field=d]').fill('0');
      await q('apply-case').click(); assert.match(await q('case-error').textContent(), /column/);
      assert.equal(await q('corner-grid').getAttribute('data-solved'),'true');
      await root.locator('.fl-editor-row [data-field=col]').fill('2');
      await q('add-sensor').click();
      await root.locator('.fl-editor-row').last().locator('[data-field=row]').fill('3');
      await root.locator('.fl-editor-row').last().locator('[data-field=col]').fill('2');
      await q('apply-case').click(); assert.match(await q('case-error').textContent(), /distinct/);
      await root.locator('.fl-editor-row').last().locator('[data-remove]').click();
      await snap('editor');
      await q('apply-case').click();
      assert.equal(await q('corner-example').inputValue(),'custom');
      assert.equal(await q('corner-grid').locator('.fl-node').count(),15);
      await play(true,3);
      await page.getByRole('button', { name: 'Close interactive widget', exact: true }).click();
      await page.getByRole('button', { name: 'Explore Faultline of the Earthquake', exact: true }).click();
      assert.match(await page.locator('[data-fl=path-status]').textContent(), /Shortest/);
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.widget-dialog').count(), 0);
      assert.deepEqual(errors, []); await page.close();
      console.log(`Faultline: ${width}px rotation, paths, sensors, random corner discovery, editable DP and cleanup passed.`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
