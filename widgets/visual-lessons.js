(() => {
  'use strict';
  const key=(r,c)=>r+','+c;
  function arcticTrace(rows,cols,target){
    let available=new Set(Array.from({length:rows*cols},(_,i)=>key(Math.floor(i/cols),i%cols))),positions=new Set(['0,0']),color=0;
    const frames=[],order=[];
    const frame=(note,planned=null,kind='plan')=>frames.push({available:[...available],positions:[...positions],planned,note,kind});
    frame('Choose the next cell to remove.',null,'start');
    for(let r=0;r<target[0];r++)for(let c=0;c<cols;c++)order.push([r,c]);
    for(let r=rows-1;r>target[0];r--)for(let c=0;c<cols;c++)order.push([r,c]);
    for(let c=0;c<target[1];c++)order.push([target[0],c]);
    for(let c=cols-1;c>target[1];c--)order.push([target[0],c]);
    for(const [r,c] of order){
      const cell=key(r,c),moves=color===(r+c)%2?1:2;
      frame(`Remove (${r+1}, ${c+1}): first move ${moves} step${moves===1?'':'s'}.`,cell);
      for(let step=1;step<=moves;step++){
        const next=new Set();for(const p of positions){const [pr,pc]=p.split(',').map(Number);const neighbors=[[pr-1,pc],[pr+1,pc],[pr,pc-1],[pr,pc+1]].filter(([nr,nc])=>available.has(key(nr,nc)));if(!neighbors.length)throw Error('Strategy trapped a possible robot');neighbors.forEach(([nr,nc])=>next.add(key(nr,nc)));}
        positions=next;color^=1;frame(`Move ${step} / ${moves} · robot changes colour.`,cell,'move');
      }
      if(positions.has(cell))throw Error('Unsafe deletion');available.delete(cell);frame(`Destroy (${r+1}, ${c+1}) · remaining cells stay connected.`,cell,'destroy');
    }
    frame('Only the flag remains. Every possible robot is at the target.',null,'done');return frames;
  }
  function permutation(n,seed){
    // Each agreed seed produces one reproducible Fisher–Yates relabelling.
    let state=seed>>>0;const random=()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
    const p=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[p[i],p[j]]=[p[j],p[i]];}return p;
  }
  function cycles(p){const seen=new Set(),groups=[];for(let i=0;i<p.length;i++)if(!seen.has(i)){const g=[];for(let j=i;!seen.has(j);j=p[j]){seen.add(j);g.push(j);}groups.push(g);}return groups.sort((a,b)=>b.length-a.length);}
  function probability(n,q){const dp=[1];for(let i=1;i<=n;i++){let sum=0;for(let k=1;k<=Math.min(i,q);k++)sum+=dp[i-k];dp[i]=sum/i;}return dp[n];}
  if(typeof module!=='undefined'&&module.exports)module.exports={arcticTrace,permutation,cycles,probability};
  if(typeof window==='undefined')return;
  function mountArctic(container,options={}){
    const root=document.createElement('section');root.className='lesson-widget al-widget';
    root.innerHTML=`<div class="lw-toolbar"><label>Grid <select data-al="size"><option value="3,4">3 × 4</option><option value="4,5">4 × 5</option><option value="1,6">1 × 6</option></select></label><button data-al="reset">Reset</button><label><input type="checkbox" data-al="show" checked> Possible positions</label></div><p class="lw-hint">Click a cell to move the flag. Watch move parity keep each deletion safe.</p><div class="lw-workspace"><section class="lw-panel"><div class="al-grid" data-al="board" aria-label="Safe deletion grid"></div><div class="lw-legend"><span><i></i>possible robot</span><span><i class="lw-gold"></i>next deletion</span><span><i class="al-destroyed-key"></i>destroyed</span></div><div class="lw-transport"><button data-al="back" aria-label="Previous strategy step">←</button><button data-al="step">Step</button><button data-al="play" class="lw-primary">▶ Play</button><output data-al="progress"></output></div></section><aside class="lw-panel"><h3>MOVE → DESTROY</h3><ol class="lw-log" data-al="history"></ol><p class="lw-status" data-al="status" role="status" aria-live="polite"></p></aside></div>`;
    container.append(root);const q=n=>root.querySelector(`[data-al="${n}"]`),abort=new AbortController();let {rows,cols,target}=options.config||{rows:3,cols:4,target:[2,3]},frames,cursor=0,timer;
    options.config={rows,cols,target};
    const caseHost=document.createElement('div');root.prepend(caseHost);q('size').closest('label').remove();
    const controls=window.ArcticSetup.mount(caseHost,{rows,cols,target},config=>{({rows,cols,target}=config);options.config=config;build();});
    const boardScroll=document.createElement('div');boardScroll.className='arctic-board-scroll';boardScroll.tabIndex=0;boardScroll.setAttribute('aria-label','Scrollable safe deletion grid');q('board').before(boardScroll);boardScroll.append(q('board'));
    function stop(){clearInterval(timer);timer=null;}
    function build(){stop();cursor=0;frames=arcticTrace(rows,cols,target);boardScroll.scrollTop=boardScroll.scrollLeft=0;render();}
    function render(){const f=frames[cursor];q('board').style.setProperty('--arctic-cols',cols);q('board').innerHTML=Array.from({length:rows*cols},(_,i)=>{const r=Math.floor(i/cols),c=i%cols,k=key(r,c),alive=f.available.includes(k),possible=q('show').checked&&f.positions.includes(k),flag=r===target[0]&&c===target[1];return `<button data-cell="${k}" class="al-cell ${possible?'is-reachable':''} ${(r+c)%2?'is-dark':''} ${!alive?'is-destroyed':''} ${f.planned===k?'is-planned':''}" aria-label="Row ${r+1}, column ${c+1}${flag?', target':''}${possible?', possible robot':''}${alive?'':', destroyed'}">${!alive?'<img class="at-destroyed" src="assets/widgets/destroyed.png" alt="Destroyed" draggable="false">':''}${flag?'<img class="at-flag" src="assets/widgets/flag.png" alt="Flag" draggable="false">':''}${possible?'<img class="al-robot at-robot" src="assets/widgets/robot.png" alt="Possible robot position" draggable="false">':''}<small>${r+1},${c+1}</small></button>`;}).join('');
      q('history').innerHTML=frames.slice(0,cursor+1).map((entry,i)=>`<li class="${i===cursor?'is-current':''}"><span>${entry.kind==='move'?'↔':entry.kind==='destroy'?'×':entry.kind==='done'?'✓':'◇'}</span><span>${entry.note}</span></li>`).join('');q('history').scrollTop=q('history').scrollHeight;
      q('status').textContent=f.kind==='done'?f.note:`${f.positions.length} possible · ${f.available.length} cells remain`;q('back').disabled=!cursor||!!timer;q('step').disabled=!!timer||cursor===frames.length-1;q('play').disabled=cursor===frames.length-1;q('play').textContent=timer?'Ⅱ Pause':'▶ Play';q('progress').textContent=`${cursor} / ${frames.length-1}`;
      const active=q('board').querySelector('.is-planned');
      if(active){const a=active.getBoundingClientRect(),b=boardScroll.getBoundingClientRect();if(a.left<b.left)boardScroll.scrollLeft+=a.left-b.left-3;else if(a.right>b.right)boardScroll.scrollLeft+=a.right-b.right+3;if(a.top<b.top)boardScroll.scrollTop+=a.top-b.top-3;else if(a.bottom>b.bottom)boardScroll.scrollTop+=a.bottom-b.bottom+3;}
    }
    root.addEventListener('click',e=>{const cell=e.target.closest('[data-cell]');if(cell){target=cell.dataset.cell.split(',').map(Number);options.config={rows,cols,target};controls.set(options.config);build();return;}const a=e.target.closest('[data-al]')?.dataset.al;if(a==='reset')build();if(a==='back'){cursor--;render();}if(a==='step'){cursor++;render();}if(a==='play'){if(timer)stop();else timer=setInterval(()=>{cursor++;if(cursor===frames.length-1)stop();render();},650);render();}},{signal:abort.signal});q('show').addEventListener('change',render,{signal:abort.signal});build();return()=>{stop();controls.destroy();abort.abort();root.remove();};
  }
  function mountTrials(container){
    const root=document.createElement('section');root.className='lesson-widget pt-widget';
    root.innerHTML=`<div class="lw-toolbar"><label>Prisoners <select data-pt="n"><option>20</option><option>50</option><option>100</option></select></label><label>Budget <input data-pt="q" type="number" min="1" max="20" value="10"></label><button data-pt="reset">Reset</button><label><input type="checkbox" data-pt="stop" checked> Stop on success</label></div><p class="lw-hint">Try agreed seeds until every cycle fits the opening budget. Send only the winning seed.</p><div class="lw-workspace"><section class="lw-panel"><h3 data-pt="label">WAITING FOR FIRST TRIAL</h3><div class="pt-cycles" data-pt="cycles"></div><div class="lw-legend"><span><i></i>within budget</span><span><i class="pt-red"></i>too long</span></div><div class="lw-transport"><button data-pt="step">Try seed</button><button data-pt="play" class="lw-primary">▶ Play</button><button data-pt="batch">+100 trials</button></div><p class="lw-status" data-pt="status" role="status" aria-live="polite"></p></section><aside class="lw-panel"><h3>LONGEST CYCLE DISTRIBUTION</h3><svg class="pt-chart" data-pt="chart" viewBox="0 0 360 180" role="img" aria-label="Distribution of sampled longest cycles"></svg><div class="pt-compare" data-pt="compare"></div><div class="pt-seed" data-pt="seed"></div><ol class="lw-log" data-pt="history"></ol></aside></div>`;
    container.append(root);const q=n=>root.querySelector(`[data-pt="${n}"]`),abort=new AbortController();let n=20,limit=10,trial=0,wins=0,winning=null,groups=[],counts=[],history=[],timer;
    function stop(){clearInterval(timer);timer=null;}
    function reset(){stop();n=Number(q('n').value);limit=Math.max(1,Math.min(n,Math.floor(Number(q('q').value))||1));q('q').value=limit;q('q').max=n;trial=0;wins=0;winning=null;groups=[];counts=Array(n+1).fill(0);history=[];render();}
    function sample(){groups=cycles(permutation(n,trial));const longest=groups[0].length,success=longest<=limit;history.push({seed:trial,longest,success});if(success){wins++;if(winning===null)winning=trial;}trial++;counts[longest]++;if(success&&q('stop').checked)stop();return success;}
    function render(){
      q('label').textContent=trial?`SEED ${trial-1} · ${groups.length} CYCLES`:'WAITING FOR FIRST TRIAL';
      q('cycles').innerHTML=groups.length?groups.map(g=>{const radius=46,cx=60,cy=60;return `<div class="pt-cycle ${g.length>limit?'is-long':''}" title="${g.map(x=>x+1).join(' → ')}"><svg viewBox="0 0 120 120" role="img" aria-label="Cycle of length ${g.length}"><circle class="pt-ring" cx="60" cy="60" r="46"/>${g.map((v,i)=>{const angle=i/g.length*2*Math.PI-Math.PI/2,x=cx+radius*Math.cos(angle),y=cy+radius*Math.sin(angle);return `<circle cx="${x}" cy="${y}" r="${g.length>30?2:3.5}"/>`;}).join('')}<text x="60" y="66">${g.length}</text></svg><small>${g.length<=limit?'fits':'over budget'}</small></div>`;}).join(''):'<div class="pt-empty">Try the first seed to reveal its cycles.</div>';
      const max=Math.max(1,...counts),bar=320/n,marker=20+limit*bar;let chart='<path d="M20 140H340" stroke="#bdccc1"/>';
      for(let i=1;i<=n;i++){const h=110*counts[i]/max;chart+=`<rect x="${20+(i-1)*bar}" y="${140-h}" width="${Math.max(1,bar-1)}" height="${h}" fill="${i<=limit?'#72a087':'#ca9b91'}"/>`;}
      chart+=`<path d="M${marker} 20V142" stroke="#9a7627" stroke-dasharray="4 3"/><text x="${Math.max(45,Math.min(300,marker))}" y="14" text-anchor="middle">budget ${limit}</text><text x="20" y="160">1</text><text x="340" y="160" text-anchor="end">${n}</text><text x="180" y="177" text-anchor="middle">longest cycle</text>`;q('chart').innerHTML=chart;
      q('compare').innerHTML=`<span>Observed <b>${trial?(100*wins/trial).toFixed(1)+'%':'—'}</b></span><span>Exact <b>${(100*probability(n,limit)).toFixed(2)}%</b></span>`;
      q('seed').innerHTML=`<small>First winning seed</small><strong>${winning??'—'}</strong>${winning!==null?`<code>${winning.toString(2)}₂</code>`:''}`;
      q('history').innerHTML=history.slice(-5).reverse().map((h,i)=>`<li class="${i===0?'is-current':''}"><span>Seed ${h.seed}</span><span>max ${h.longest} · ${h.success?'✓':'×'}</span></li>`).join('');q('status').textContent=`${trial} trials · ${wins} successes${trial?` · latest ${history.at(-1).success?'fits the budget':'has an overlong cycle'}`:''}`;q('play').textContent=timer?'Ⅱ Pause':'▶ Play';q('step').disabled=q('batch').disabled=!!timer;
    }
    root.addEventListener('click',e=>{const a=e.target.closest('[data-pt]')?.dataset.pt;if(a==='reset')reset();if(a==='step'){sample();render();}if(a==='batch'){for(let i=0;i<100;i++)if(sample()&&q('stop').checked)break;render();}if(a==='play'){if(timer)stop();else timer=setInterval(()=>{sample();render();},650);render();}},{signal:abort.signal});for(const name of ['n','q'])q(name).addEventListener('change',reset,{signal:abort.signal});reset();return()=>{stop();abort.abort();root.remove();};
  }
  function extend(id,label,mountLesson){
    const widget=window.JournalWidgets.find(w=>w.id===id);if(!widget)return;const original=widget.mount;
    widget.mount=container=>{const settings={};const tabs=document.createElement('div');tabs.className='lesson-widget';tabs.innerHTML=`<div class="lw-tabs" role="tablist" aria-label="Exploration modes"><button role="tab" data-mode="original" aria-selected="true">Explore</button><button role="tab" data-mode="lesson" aria-selected="false">${label} · spoiler</button></div>`;const body=document.createElement('div');container.append(tabs,body);let cleanup=original(body,settings),mode='original';const onClick=e=>{const button=e.target.closest('[data-mode]');if(!button||button.dataset.mode===mode)return;cleanup?.();body.replaceChildren();mode=button.dataset.mode;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b===button)));cleanup=(mode==='original'?original:mountLesson)(body,settings);};tabs.addEventListener('click',onClick);return()=>{cleanup?.();tabs.removeEventListener('click',onClick);tabs.remove();body.remove();};};
  }
  extend('arctic-technology','Safe deletion',mountArctic);extend('prisoners-gamble','Seed search',mountTrials);
})();
