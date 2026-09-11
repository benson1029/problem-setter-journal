const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs');
(async()=>{fs.mkdirSync('tmp/infinity-qa',{recursive:true});const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
try{for(const width of [1280,390,320]){const page=await browser.newPage({viewport:{width,height:940}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.READER_URL||'http://127.0.0.1:8765/reader.html')+'?widget=center-of-infinity');await page.locator('.ci-widget').waitFor();const q=name=>page.locator(`[data-ci="${name}"]`);
  assert.equal(await page.locator('.ci-station:not(.is-unknown)').count(),0);
  await q('step').click();await q('speed').selectOption('100');await q('play').click();await page.waitForFunction(()=>document.querySelectorAll('.ci-history>div').length>=4);await q('play').click();const status=await q('status').textContent();await page.waitForTimeout(200);assert.equal(await q('status').textContent(),status);
  await q('finish').click();assert.equal(await page.locator('.ci-station:not(.is-unknown)').count(),1);assert.match(await q('status').textContent(),/Center recovered: 5/);
  await q('layers').click();await q('finish').click();assert.equal(await page.locator('.ci-station:not(.is-unknown)').count(),11);assert.equal(await page.locator('.ci-matched-edge').count(),12);
  await q('arms').click();await q('finish').click();assert.equal(await page.locator('.ci-station:not(.is-unknown)').count(),11);
  await q('full').click();for(const scenario of ['center','opposite','ordinary']){await q('case').selectOption(scenario);await q('finish').click();assert.equal(await page.locator('.ci-widget').getAttribute('data-finished'),'true');}
  await page.screenshot({path:`tmp/infinity-qa/solution-${width}.png`});
  await q('game').click();assert.equal(await page.locator('.ci-station:not(.is-unknown)').count(),0,'Game starts with no recovered positions');
  await q('a').selectOption('5');await q('b').selectOption('3');await q('ask').click();assert.equal(await q('history').locator('div').count(),1);await q('ask').click();assert.equal(await q('history').locator('div').count(),1,'Repeated queries are free');
  // Acquire center scan through public controls, then let the game infer it.
  for(const id of [1,2,4,6,7,8,9,10,11]){await q('b').selectOption(String(id));await q('ask').click();}
  await q('deduce').click();assert.equal(await page.locator('[data-slot="0"] text').textContent(),'5');
  await page.screenshot({path:`tmp/infinity-qa/partial-${width}.png`});
  const ids=[5,3,1,8,10,7,6,2,9,4,11];
  for(let slot=1;slot<ids.length;slot++){await page.locator(`[data-id="${ids[slot]}"]`).click();await page.locator(`[data-slot="${slot}"]`).press('Enter');}
  // Exercise every ring reversal plus the four swapped-ring orientations.
  for(let mask=0;mask<8;mask++){for(const[name,bit]of [['flip-left',1],['flip-right',2],['swap-rings',4]])if(Boolean(mask&bit)!==((await q(name).getAttribute('aria-pressed'))==='true'))await q(name).click();assert.equal(await q('orientation').textContent(),`Orientation ${mask+1} / 8`);await q('check').click();assert.equal(await page.locator('.ci-widget').getAttribute('data-finished'),'true');if(mask<7){await q('clear').click();for(let slot=0;slot<ids.length;slot++){await page.locator(`[data-id="${ids[slot]}"]`).click();await page.locator(`[data-slot="${slot}"]`).press('Enter');}}}
  assert(await page.locator('.widget-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`No horizontal overflow at ${width}`);
  await q('new-game').click();await q('a').selectOption('5');await q('b').selectOption('3');await q('ask').click();
  for(const [id,slot]of [[5,0],[3,3]]){await page.locator(`[data-id="${id}"]`).click();await page.locator(`[data-slot="${slot}"]`).press('Enter');}
  assert.equal(await page.locator('.ci-station.is-conflict').count(),2);await q('deduce').click();assert.match(await q('status').textContent(),/Revise the red stations first/);assert.equal(await page.locator('.ci-station:not(.is-unknown)').count(),2);
  await q('clear').click();let blocked=false;
  outer:for(let a=1;a<=11;a++)for(let b=a+1;b<=11;b++){if(a===3&&b===5)continue;await q('a').selectOption(String(a));await q('b').selectOption(String(b));if(await q('ask').isDisabled()){blocked=true;break outer;}await q('ask').click();}
  assert(blocked);assert.equal(await q('history').locator('div').count(),30);await q('budget').selectOption('practice');assert(!(await q('ask').isDisabled()));await q('ask').click();assert.equal(await q('history').locator('div').count(),31);
  await q('full').click();await q('n').selectOption('12');await q('finish').click();assert.equal(await page.locator('.ci-station:not(.is-unknown)').count(),23);
  await q('reset').click();await q('play').click();await page.getByRole('button',{name:'Close interactive widget',exact:true}).click();await page.waitForTimeout(200);assert.equal(await page.locator('.ci-widget').count(),0);assert.deepEqual(errors,[]);await page.close();console.log(`Infinity ${width}px: lessons, partial map, deductions, all orientations, query caching, N=12 and cleanup passed.`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
