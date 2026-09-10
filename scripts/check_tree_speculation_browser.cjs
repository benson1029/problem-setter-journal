const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
  fs.mkdirSync('tmp/tree-speculation-qa',{recursive:true});
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
  try{for(const width of [1280,390,320]){
    const page=await browser.newPage({viewport:{width,height:940}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.READER_URL||'http://127.0.0.1:8765/reader.html')+'?widget=tree-speculation-binary');
    await page.locator('.ts-widget').waitFor();const q=name=>page.locator(`[data-ts="${name}"]`);
    assert.equal(await page.locator('[data-tree-vertex]').count(),1,'Only Bob’s recovered root is visible');
    await q('step').click();assert.match(await q('query-box').textContent(),/Asking/);
    await q('step').click();assert.match(await q('query-box').textContent(),/Yes/);
    await q('finish').click();assert.equal(await page.locator('[data-tree-vertex]').count(),12);assert.match(await q('pool').textContent(),/All vertices matched/);
    await q('amortized').click();await q('speed').selectOption('160');await q('play').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-tree-vertex]').length>=4);await q('play').click();
    const paused=await q('status').textContent();await page.waitForTimeout(300);assert.equal(await q('status').textContent(),paused);
    await page.screenshot({path:`tmp/tree-speculation-qa/dfs-${width}.png`});
    await q('finish').click();assert.match(await q('ledger').textContent(),/Upper bound: 22/);
    assert.match(await q('history').textContent(),/\{L\} ↔ \{G\} No/);assert.match(await q('history').textContent(),/\{F\} ↔ \{G\} No/);assert.match(await q('history').textContent(),/\{C\} ↔ \{G\} Yes/);
    await q('hybrid').click();await q('prefix').fill('6');await q('prefix').dispatchEvent('change');await q('finish').click();assert.match(await q('history').textContent(),/prefix ends/);
    await q('editor').locator('summary').click();await q('edges').fill('A B\nC D');await q('apply-edges').click();assert.match(await q('error').textContent(),/connected/);
    await q('edges').fill('A B\nA C\nC D');await q('apply-edges').click();await q('finish').click();assert.equal(await page.locator('[data-tree-vertex]').count(),4);
    await q('chain').click();assert.equal(await page.locator('.ts-leaf-edge').count(),1,'The starting leaf reveals only its own attachment');
    await q('game').check();
    for(const u of [3,2,3,4,5])await page.locator(`[data-move="${u}"]`).click();
    await page.waitForTimeout(450);
    assert.match(await q('status').textContent(),/Decoded every attachment in 5 moves/);assert.equal(await page.locator('.ts-attachments .is-inferred').count(),2);
    await page.screenshot({path:`tmp/tree-speculation-qa/walk-${width}.png`});
    await q('reset').click();for(const u of [3,8,3,8,3])await page.locator(`[data-move="${u}"]`).click();assert.match(await q('status').textContent(),/Five moves used/);
    assert.equal(await page.locator('[data-move]:enabled').count(),0);
    await q('game').uncheck();await q('length').selectOption('4');await q('finish').click();assert.match(await q('status').textContent(),/Decoded every attachment/);
    assert(await page.locator('.widget-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`No horizontal overflow at ${width}`);
    await q('binary').click();await q('example').selectOption('random');await q('size').fill('24');await q('generate').click();await q('finish').click();assert.equal(await page.locator('[data-tree-vertex]').count(),24);
    await q('reset').click();await q('play').click();await page.getByRole('button',{name:'Close interactive widget',exact:true}).click();await page.waitForTimeout(250);assert.equal(await page.locator('.ts-widget').count(),0);assert.deepEqual(errors,[]);
    await page.close();console.log(`Tree Speculation ${width}px: hidden state, four strategies, book trace, editor, five-move game/win/failure and cleanup passed.`);
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
