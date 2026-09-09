const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true}),out=path.resolve(__dirname,'../tmp/hanoi-qa');fs.mkdirSync(out,{recursive:true});
  try{for(const width of process.env.HANOI_WIDTH?[Number(process.env.HANOI_WIDTH)]:[1280,390,320]){
    const page=await browser.newPage({viewport:{width,height:940}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/reader.html');await page.locator('#toc-toggle').click();await page.locator('#toc-panel [data-page="71"]').click();
    for(let i=0;i<(width>720?1:2);i++){const before=await page.locator('#page-label').textContent();await page.locator('#next-page').click();await page.waitForFunction(s=>document.querySelector('#page-label').textContent!==s,before);}
    await page.getByRole('button',{name:'Explore Challenge of Hanoi',exact:true}).click();
    const root=page.locator('.ha-widget'),q=name=>root.locator(`[data-ha="${name}"]`),state=async()=>JSON.parse(await q('rods').getAttribute('data-state'));
    const idle=()=>page.waitForFunction(()=>document.querySelector('.ha-widget').dataset.busy==='false');
    const snap=async(name,locator=null)=>{assert(await page.locator('.widget-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`Overflow at ${width}`);if(locator)await locator.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${name}-${width}.png`)});};
    await snap('recursion');assert.equal(await q('tree').locator('[data-node]').count(),10);
    if(width>=700){
      assert(await page.locator('.widget-dialog').evaluate(el=>el.classList.contains('ha-dialog')));
      assert(await page.locator('.widget-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'Default recursion view should fit without vertical scrolling on a laptop.');
    }
    await q('step').click();assert.match(await q('status').textContent(),/all preconditions pass/);
    await snap('tree',q('tree-scroll'));
    await page.emulateMedia({reducedMotion:'reduce'});await q('play').click();await idle();assert.deepEqual(await state(),[[],[],[1,2,3]]);
    await q('reset').click();await q('arrange').click();
    const disk=q('rods').locator('[data-disk="1"]');await disk.scrollIntoViewIfNeeded();const box=await disk.boundingBox(),svg=await q('rods').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(svg.x+svg.width*.5,svg.y+svg.height*.5,{steps:8});await page.mouse.up();
    assert.deepEqual(await state(),[[2,3],[1],[]]);await q('arrange').click();
    await root.locator('.ha-state-editor summary').click();await q('state-text').fill('X: 1 | Y: 1 | Z: -');await q('apply-state').click();assert.match(await q('state-error').textContent(),/unique/);
    await q('state-text').fill('X: 3 | Y: 2 1 | Z: -');await q('apply-state').click();
    await q('tree').locator('[data-node="r5-7"]').click();assert.equal(await q('start').inputValue(),'5');
    await q('play').click();await idle();assert.deepEqual(await state(),[[3],[],[1,2]]);
    await q('example').selectOption('operations');
    for(let i=0;i<5;i++){
      await q('demo-next').click();await idle();
      if(i===0)assert.match(await q('status').textContent(),/First invalid command: 3/);
      if(i===2)assert.match(await q('status').textContent(),/First invalid command: 7/);
    }
    assert.deepEqual(await state(),[[3],[],[1,2]]);
    await q('example').selectOption('effect');assert.equal(await q('tree').locator('[data-node]').count(),13);
    assert.match(await q('symbolic').textContent(),/X3/);assert.equal(await q('checks').locator('li').count(),6);
    await snap('abstraction',q('abstraction'));await snap('segment-tree',q('tree-scroll'));
    await q('play').click();await idle();assert.deepEqual(await state(),[[3,7],[1,4,5],[2,6]]);
    await q('none').click();assert(await q('play').isDisabled());const previous=await state();
    await q('build').click();await idle();await q('play').click();await idle();assert.deepEqual(await state(),previous);
    await q('all').click();await q('build').click();await idle();
    await q('example').selectOption('standard');await q('recursion').click();
    await page.emulateMedia({reducedMotion:'no-preference'});await q('step').click();await q('step').click();
    await page.waitForFunction(()=>document.querySelector('[data-ha=rods]').getAnimations({subtree:true}).length>0);
    await q('play').click();await q('play').click();
    assert(await q('rods').evaluate(el=>el.getAnimations({subtree:true}).every(a=>a.playState==='paused')));
    const gaps=await q('rods').evaluate(el=>{
      el.getAnimations({subtree:true}).forEach(a=>a.currentTime=500);
      const y=[...el.querySelectorAll('[data-disk]')].map(d=>d.getBoundingClientRect().y).sort((a,b)=>a-b);
      return {min:Math.min(...y.slice(1).map((v,i)=>v-y[i])),unit:el.getBoundingClientRect().width/420};
    });
    assert(gaps.min>18*gaps.unit,'Bulk transfers preserve stack spacing during flight');
    await snap('motion-paused');
    // Step starts one animated transfer, then Play can resume automatic progression.
    await q('stop').click();assert.deepEqual(await state(),[[1,2,3],[],[]]);
    await page.getByRole('button',{name:'Close interactive widget',exact:true}).click();
    await page.getByRole('button',{name:'Explore Challenge of Hanoi',exact:true}).click();assert.deepEqual(await state(),[[1,2,3],[],[]]);
    assert.deepEqual(errors,[]);await page.close();console.log(`Hanoi ${width}px: drag/text states, subtree execution, book operations, abstraction, visibility rebuild and cancellation passed.`);
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
