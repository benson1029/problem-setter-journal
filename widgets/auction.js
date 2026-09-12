(() => {
  'use strict';
  const PRESETS=[{name:'Book example A',values:[4,5,6,7],e:[0,1,4,4]},{name:'Book example B',values:[4,5,6,7],e:[0,1,1,4]},{name:'Tied highest bids',values:[3,5,6,6],e:[0,2,5,7]}];
  // Compare the full private value with the public lower bound, not two masked values.
  const withdrawn=(values,mask)=>{const lower=Math.max(...values.map(v=>v&mask));return values.map(v=>v<lower);};
  const count=a=>a.filter(Boolean).length,binary=n=>n.toString(2).padStart(3,'0');
  function solve(values,e){
    const dp=Array(8).fill(-Infinity),parent=Array(8).fill(null),events=[];dp[0]=0;
    for(let mask=0;mask<8;mask++)for(let bit=0;bit<3;bit++)if(!(mask&(1<<bit))){
      const next=mask|(1<<bit),added=count(withdrawn(values,next))-count(withdrawn(values,mask)),gain=e[added]||0,candidate=dp[mask]+gain,improved=candidate>dp[next];
      if(improved){dp[next]=candidate;parent[next]={mask,bit};}
      events.push({mask,next,bit,added,gain,candidate,improved,dp:dp.slice()});
    }
    const order=[];for(let m=7;m;m=parent[m].mask)order.unshift(parent[m].bit);
    return {dp,events,order,score:dp[7]};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={PRESETS,withdrawn,solve};
  if(typeof window==='undefined')return;
  function mount(container){
    const root=document.createElement('section');root.className='lesson-widget au-widget';
    const dialog=container.closest('.widget-dialog');dialog?.classList.add('widget-dialog--lesson');
    root.innerHTML=`<div class="lw-tabs" role="tablist" aria-label="Auction modes"><button role="tab" data-tab="room" aria-selected="true">Reveal the bids</button><button role="tab" data-tab="dp" aria-selected="false">Mask DP · spoiler</button></div>
      <div class="lw-toolbar"><label>Example <select data-au="preset">${PRESETS.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('')}</select></label><button data-au="reset">Reset</button><span class="au-score" data-au="score"></span></div>
      <div class="lw-workspace"><section class="lw-panel"><h3>AUCTION ROOM</h3><p class="lw-hint" data-au="hint"></p><div class="au-table" data-au="table"></div><div class="au-bound">Largest revealed lower bound <strong data-au="bound">0</strong></div><div class="lw-legend"><span><i></i>revealed bit</span><span><i class="lw-gold"></i>just revealed</span><span>× withdrawn</span></div></section>
      <section class="lw-panel"><div data-au="room"><h3>REVEAL HISTORY</h3><div class="au-rewards" data-au="rewards"></div><ol class="lw-log" data-au="log"></ol></div>
      <div data-au="dp" hidden><h3>REVEALED MASK → BEST EXCITEMENT</h3><svg data-au="graph" class="au-graph" viewBox="0 0 470 280" role="img" aria-label="Dynamic programming graph with eight revealed-bit masks"></svg><div class="lw-transport"><button data-au="back" aria-label="Previous DP transition">←</button><button data-au="step">Step</button><button data-au="play" class="lw-primary">▶ Play</button><output data-au="progress"></output></div><button class="au-watch" data-au="watch" hidden></button></div>
      <p class="lw-status" data-au="status" role="status" aria-live="polite"></p></section></div>`;
    container.append(root);const q=n=>root.querySelector(`[data-au="${n}"]`),events=new AbortController();
    let preset=PRESETS[0],mode='room',log=[],cursor=0,timer=null,plan=solve(preset.values,preset.e);
    function stop(){clearInterval(timer);timer=null;q('play').textContent='▶ Play';}
    function reset(){stop();preset=PRESETS[Number(q('preset').value)];plan=solve(preset.values,preset.e);cursor=0;log=[];render();}
    function reveal(bit){const mask=log.reduce((m,l)=>m|(1<<l.bit),0);if(mask&(1<<bit))return;const added=count(withdrawn(preset.values,mask|(1<<bit)))-count(withdrawn(preset.values,mask));log.push({bit,added,gain:preset.e[added]||0});render();}
    function renderGraph(event){
      const positions=[[32,140],[163,40],[163,140],[305,40],[163,240],[305,140],[305,240],[438,140]],dp=event?.dp||[0,...Array(7).fill(-Infinity)];
      let svg='';for(const edge of plan.events){const [x,y]=positions[edge.mask],[xx,yy]=positions[edge.next];svg+=`<path d="M${x+25},${y} L${xx-25},${yy}" class="${edge===event?'is-active':''}"/>`;}
      positions.forEach(([x,y],mask)=>{svg+=`<g transform="translate(${x},${y})" class="${mask===event?.next?'is-active':''}"><rect x="-27" y="-24" width="54" height="48" rx="9"/><text y="-4">${binary(mask)}</text><text y="15" class="au-dp-value">${Number.isFinite(dp[mask])?dp[mask]:'–'}</text></g>`;});q('graph').innerHTML=svg;
    }
    function render(){
      root.dataset.mode=mode;
      const event=cursor?plan.events[cursor-1]:null,mask=mode==='dp'?(event?.next||0):log.reduce((m,l)=>m|(1<<l.bit),0),lastBit=mode==='dp'?event?.bit:log.at(-1)?.bit,out=withdrawn(preset.values,mask),lower=Math.max(...preset.values.map(v=>v&mask));
      root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===mode)));
      q('room').hidden=mode!=='room';q('dp').hidden=mode!=='dp';
      q('hint').textContent=mode==='room'?'Choose a bit column to reveal it for every bidder.':'Step through each candidate next bit. Gold marks the active transition.';
      q('table').innerHTML=`<div class="au-table-head">Private bid</div>${[2,1,0].map(bit=>`<button class="au-column" data-bit="${bit}" ${mode==='dp'||(mask&(1<<bit))||timer?'disabled':''}>bit ${bit}<small>${mode==='room'&&!(mask&(1<<bit))?'reveal ↓':(mask&(1<<bit))?'shown':'hidden'}</small></button>`).join('')}${preset.values.map((value,i)=>`<div class="au-bid-name ${out[i]?'is-out':''}"><span>${String.fromCharCode(65+i)}</span><strong>${value}</strong><small>${out[i]?'× out':'in'}</small></div>${[2,1,0].map(bit=>`<div class="au-digit ${mask&(1<<bit)?'is-known':''} ${bit===lastBit?'is-current':''} ${out[i]?'is-out':''}">${mask&(1<<bit)?(value>>bit)&1:'·'}</div>`).join('')}`).join('')}`;
      q('bound').textContent=lower;q('score').textContent=mode==='room'?`Excitement ${log.reduce((s,l)=>s+l.gain,0)}`:`${cursor} / ${plan.events.length} transitions`;
      q('rewards').innerHTML=preset.e.map((value,i)=>`<span><small>${i} withdraw</small><b>+${value}</b></span>`).join('');
      q('log').innerHTML=log.length?log.map((l,i)=>`<li class="${i===log.length-1?'is-current':''}"><b>Bit ${l.bit}</b><span>${l.added} withdraw · +${l.gain}</span></li>`).join(''):'<li>Choose your first column.</li>';
      q('status').textContent=mode==='room'?log.length===3?`Finished · ${count(out)} withdrawn. Reset to try another order.`:`Withdraw only when the full private bid is below ${lower}.`:!event?'Start at 000 with excitement 0.':`${binary(event.mask)} → ${binary(event.next)}: ${event.dp[event.mask]} + E(${event.added}) = ${event.candidate}. ${event.improved?'Update.':'Keep the better value.'}`;
      renderGraph(event);q('back').disabled=!cursor||!!timer;q('step').disabled=cursor===plan.events.length||!!timer;q('play').disabled=cursor===plan.events.length;q('progress').textContent=`${cursor} / ${plan.events.length}`;q('watch').hidden=cursor!==plan.events.length;q('watch').textContent=`Watch best order · excitement ${plan.score} →`;
    }
    root.addEventListener('click',e=>{const tab=e.target.closest('[data-tab]');if(tab){stop();mode=tab.dataset.tab;render();return;}
      const bit=e.target.closest('[data-bit]');if(bit&&!bit.disabled){reveal(Number(bit.dataset.bit));return;}
      const a=e.target.closest('[data-au]')?.dataset.au;
      if(a==='reset')reset();if(a==='back'){cursor=Math.max(0,cursor-1);render();}if(a==='step'){cursor=Math.min(plan.events.length,cursor+1);render();}
      if(a==='play'){if(timer){stop();render();}else{timer=setInterval(()=>{cursor++;if(cursor>=plan.events.length)stop();render();},750);render();q('play').textContent='Ⅱ Pause';}}
      if(a==='watch'){stop();mode='room';log=[];timer=setInterval(()=>{const bit=plan.order[log.length];if(log.length===2)stop();reveal(bit);},850);render();}
    },{signal:events.signal});q('preset').addEventListener('change',reset,{signal:events.signal});render();
    return()=>{stop();events.abort();dialog?.classList.remove('widget-dialog--lesson');root.remove();};
  }
  window.JournalWidgets=window.JournalWidgets||[];window.JournalWidgets.push({id:'exciting-auction',title:'Exciting Auction',pages:[67,68,69,70],badge:{page:67,y:.58},mount});
})();
