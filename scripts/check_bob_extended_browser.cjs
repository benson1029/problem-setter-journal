const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs');
(async()=>{fs.mkdirSync('tmp/bob-extended-qa',{recursive:true});const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
try{for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:940}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.READER_URL||'http://127.0.0.1:8765/reader.html')+'?widget=tree-speculation-chain');
  const ts=n=>page.locator(`[data-ts="${n}"]`),q=n=>page.locator(`[data-bx="${n}"]`);
  await ts('walk-variant').selectOption('extended');await page.locator('.bx-widget').waitFor();
  assert.equal(await q('start').locator('option').count(),20);assert(!/core|leaf|chain/.test(await q('start').textContent()),'Start selector must not reveal roles');
  assert.equal(await page.locator('.bx-order-node.is-known').count(),0);assert.match(await q('position').textContent(),/not established/);assert.match(await q('order-count').textContent(),/48/);
  await q('scenario').selectOption('endpoint');await page.locator('[data-bx-look]').click();assert.match(await q('knowledge').textContent(),/same group.*endpoint/);assert.equal(await page.locator('[data-bx-move]').count(),1);
  await q('scenario').selectOption('leaf');await page.locator('[data-bx-look]').click();assert.match(await q('knowledge').textContent(),/different groups.*leaf/);assert((await page.locator('.bx-order-node.is-known').count())<5);
  await page.locator('[data-bx-move]').press('Enter');await page.waitForFunction(()=>document.querySelector('[data-bx="ledger"]').textContent.startsWith('1 / 5'));
  await q('back').click();assert.match(await q('ledger').textContent(),/^0 \/ 5/);
  // Mobile and desktop evidence while the global chain is still incomplete.
  await page.locator('.widget-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`tmp/bob-extended-qa/partial-${width}.png`});
  await q('style').selectOption('demo');await q('speed').selectOption('200');await q('play').click();await page.waitForFunction(()=>document.querySelector('[data-bx="ledger"]').textContent.startsWith('1 / 5'));await q('play').click();
  await page.waitForTimeout(400);const paused=await q('history').textContent();await page.waitForTimeout(400);assert.equal(await q('history').textContent(),paused);
  await q('finish').click();assert.equal(await page.locator('.bx-widget').getAttribute('data-finished'),'true');assert.equal(await page.locator('.bx-order-node.is-known').count(),5);assert.match(await q('ledger').textContent(),/^5 \/ 5/);
  await page.locator('.widget-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`tmp/bob-extended-qa/solved-${width}.png`});
  for(const scenario of ['endpoint','center','random']){await q('scenario').selectOption(scenario);await q('finish').click();assert.equal(await page.locator('.bx-widget').getAttribute('data-finished'),'true');}
  await q('size').selectOption('30');await q('finish').click();assert.match(await q('attachment-count').textContent(),/25\/25/);
  assert(await page.locator('.widget-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`No overflow at ${width}`);
  // Manual wrong walk consumes its five moves without falsely declaring a win.
  await q('scenario').selectOption('leaf');await q('style').selectOption('game');const start=await q('start').inputValue();await page.locator('[data-bx-look]').click();const host=await page.locator('[data-bx-move]').getAttribute('data-bx-move');
  for(const id of [host,start,host,start,host]){await page.locator(`[data-bx-move="${id}"]`).press('Enter');await page.waitForTimeout(170);}
  assert.match(await q('status').textContent(),/Five moves used/);assert.equal(await page.locator('.bx-widget').getAttribute('data-finished'),'false');
  await ts('walk-variant').selectOption('basic');assert.equal(await page.locator('.bx-widget').count(),0);assert(await ts('chain-graph').isVisible());
  await ts('walk-variant').selectOption('extended');await q('style').selectOption('demo');await q('play').click();await ts('binary').click();assert.equal(await page.locator('.bx-widget').count(),0);await ts('finish').click();assert.equal(await page.locator('[data-tree-vertex]').count(),12);
  await ts('chain').click();await q('style').selectOption('demo');await q('play').click();await page.getByRole('button',{name:'Close interactive widget',exact:true}).click();await page.waitForTimeout(500);assert.deepEqual(errors,[]);await page.close();console.log(`Extended Bob ${width}px: hidden roles/order, endpoint/leaf deductions, animation, undo, all scenarios, 30 IDs, win/failure, mode switching and cleanup passed.`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
