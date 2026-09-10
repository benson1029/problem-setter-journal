(() => {
  'use strict';
  const M=window.TreeSpeculation;
  function mount(container, initial='binary') {
    const root=document.createElement('div');root.className='ts-widget';container.append(root);
    const dialog=container.closest('dialog');dialog?.classList.add('ts-dialog');
    if(dialog)dialog.querySelector('#widget-title').textContent='Tree Speculation';
    root.innerHTML=`
      <div class="ts-tabs" role="tablist" aria-label="Tree Speculation strategies">
        <button data-ts="binary" role="tab">1 · Binary search</button><button data-ts="amortized" role="tab">2 · Amortized DFS</button><button data-ts="chain" role="tab">3 · Bob’s walk</button><button data-ts="hybrid" role="tab">4 · Combine</button>
      </div><p class="ts-intro" data-ts="intro"></p>
      <div data-ts="tree-setup" class="ts-setup">
        <label>Tree<select data-ts="example"><option value="book">Book example · A–L</option><option value="random">Random tree</option><option value="balanced">Balanced tree</option><option value="star">Star</option><option value="chain">Long path</option></select></label>
        <label>Size<input data-ts="size" type="number" min="2" max="24" value="12"></label><button data-ts="generate">New case</button>
        <label data-ts="prefix-label">Prefix length X<input data-ts="prefix" type="number" min="1" max="12" value="6"></label>
        <label class="ts-check"><input data-ts="reveal" type="checkbox"> Reveal hidden tree</label>
      </div>
      <div data-ts="chain-setup" class="ts-setup" hidden>
        <label>Core chain<select data-ts="length"><option value="2">2 vertices</option><option value="4">4 vertices</option><option value="5" selected>5 vertices</option></select></label>
        <label>Start at<select data-ts="start"></select></label><button data-ts="shuffle">New attachments</button>
        <label class="ts-check"><input data-ts="game" type="checkbox"> Choose Bob’s moves</label>
      </div>
      <div class="ts-playback">
        <button data-ts="reset" aria-label="Restart animation">↺</button><button data-ts="back" aria-label="Previous step">←</button><button data-ts="step" class="ts-primary">Step →</button><button data-ts="play">▶ Play</button><button data-ts="finish">Finish</button>
        <select data-ts="speed" aria-label="Animation speed"><option value="1050">Slow</option><option value="650" selected>Normal</option><option value="160">Fast</option></select><span data-ts="progress"></span>
      </div>
      <p class="ts-status" data-ts="status" role="status" aria-live="polite"></p>
      <div class="ts-workspace">
        <section class="ts-main">
          <div class="ts-heading"><h3 data-ts="graph-title">Bob’s partial tree</h3><span data-ts="graph-summary"></span></div>
          <div data-ts="graph" class="ts-graph"></div>
          <div data-ts="chain-graph" class="ts-chain-graph" hidden></div>
          <div class="ts-legend" data-ts="legend"></div>
          <div class="ts-ledger" data-ts="ledger"></div>
        </section>
        <aside class="ts-side">
          <section data-ts="reconstruction">
            <div class="ts-heading"><h3>Interactor</h3><span>Is there any edge across A and B?</span></div>
            <div class="ts-query" data-ts="query-box"></div>
            <div data-ts="preorder-section"><h3 class="ts-subhead">Alice’s preorder</h3><div data-ts="preorder" class="ts-chips"></div></div>
            <h3 class="ts-subhead">Open DFS path <small>root → current</small></h3><div data-ts="stack" class="ts-chips"></div>
            <h3 class="ts-subhead">Remaining vertex pool <small data-ts="pool-count"></small></h3><div data-ts="pool" class="ts-chips ts-pool"></div>
          </section>
          <section data-ts="walk" hidden>
            <div class="ts-heading"><h3>Bob’s local view</h3><span data-ts="moves"></span></div>
            <div class="ts-local" data-ts="local"></div>
            <h3 class="ts-subhead">Decoded leaf attachments</h3><div class="ts-attachments" data-ts="attachments"></div>
            <p class="ts-inference" data-ts="inference"></p>
          </section>
          <h3 class="ts-subhead">History <small data-ts="history-label"></small></h3><div class="ts-history" data-ts="history" aria-label="Operation history"></div>
        </aside>
      </div>
      <details class="ts-editor" data-ts="editor"><summary>Edit the hidden tree</summary><p>One edge per line (for example A B). The first label is the root; edge order determines DFS order. 2–24 labels.</p><textarea data-ts="edges" rows="3" aria-label="Hidden tree edges"></textarea><button data-ts="apply-edges">Apply tree</button><p data-ts="error" class="ts-error" role="alert"></p></details>
      <details class="ts-notes"><summary>Why this works</summary><p data-ts="notes"></p></details>`;
    const q=name=>root.querySelector(`[data-ts="${name}"]`),abort=new AbortController(),on=(el,type,fn)=>el.addEventListener(type,fn,{signal:abort.signal});
    const graph=new window.TreeSpeculationGraph(q('graph'));
    let mode=initial,t=M.preset(),seed=73,trace,cursor=0,timer=null,disposed=false;
    let c=M.chain(),start=8,path=[8],route=[],bob=null,travelTimer=null,traveling=false;
    function stop(){clearTimeout(timer);timer=null;q('play').textContent='▶ Play';}
    function updateTreeEditor(){q('edges').value=t.edges.map(([u,v])=>`${t.labels[u]} ${t.labels[v]}`).join('\n');q('size').value=t.n;q('prefix').max=t.n;q('prefix').value=Math.min(Number(q('prefix').value)||1,t.n);}
    function reset(){stop();clearTimeout(travelTimer);traveling=false;cursor=0;graph.reset();if(mode==='chain'){path=[start];route=M.chainRoute(c,start);buildChainScene();}else trace=M.reconstruct(t,mode,Number(q('prefix').value));render();}
    function chooseMode(next){mode=next;for(const name of ['binary','amortized','chain','hybrid'])q(name).setAttribute('aria-selected',String(name===mode));const walk=mode==='chain';
      for(const name of ['chain-setup','walk','chain-graph'])q(name).hidden=!walk;
      for(const name of ['tree-setup','reconstruction','graph','editor'])q(name).hidden=walk;
      q('prefix-label').hidden=mode!=='hybrid';q('preorder-section').hidden=mode==='binary';
      q('intro').textContent={binary:'Find one neighbor at a time. Keep the partial tree and unmatched pool separate.',amortized:'Use the next preorder label. A No exits the current vertex; a Yes adds a child.',chain:'Visit four of five core vertices in at most five moves. Infer attachments to the last one.',hybrid:'Build a preorder prefix, then continue from its open path using binary search.'}[mode];
      q('notes').textContent={binary:'Before binary searching, ask whether the current vertex has any unmatched neighbor. A No ends this vertex immediately. Otherwise repeatedly test half the candidate pool. Even a No is useful: an unmatched neighbor is already known to exist, so keep the other half. Attach the last candidate, descend, and continue. This takes O(N log N) queries without Alice’s preorder.',amortized:'A preorder tells us when a vertex enters DFS, but not when its ancestors exit. Query the next preorder vertex against the top of the open path. Every Yes recovers one of N−1 edges. Every No permanently pops one vertex, which can never be popped again. Thus there are at most 2N−2 queries; we stop without extra queries when the pool is empty.',chain:'Core labels and chain order are public in this demonstration. Bob sees only his current neighbors. Starting on a leaf uses one move to reach the core. Four visited core vertices reveal all their attached leaves; every still-unseen leaf must attach to the fifth. Starting at the center needs a U-turn. The book additionally encodes information using the core’s label group and permutations; this tab isolates the five-move decoding insight.',hybrid:'Keep the DFS path at the end of the prefix. Every vertex already exited is finished forever, while open vertices still have their one possible exit query available. Continue finding unmatched children from this path. Successful prefix queries cost X−1; remaining children cost existence checks and binary probes. Exit queries across both phases total at most N−1. No answers inside a binary search are probes, not DFS exits.'}[mode];
      q('graph-title').textContent=walk?'Alice’s message tree · Bob’s knowledge':'Bob’s partial tree';reset();
    }
    function chip(u,classes=''){return `<span class="ts-chip ${classes}">${t.labels[u]}</span>`;}
    function renderTree(){const s=trace.events[cursor];
      q('status').textContent=s.note;q('graph-summary').textContent=`${s.edges.length+1}/${t.n} matched · ${s.edges.length} edges`;
      graph.render(t,s,q('reveal').checked);
      q('legend').innerHTML='<span><i class="ts-a-key"></i> Query A / current</span><span><i class="ts-b-key"></i> Query B</span><span><i class="ts-exit-key"></i> Exited</span>';
      const a=s.query?.a||[],b=s.query?.b||[];
      const query=s.query||trace.events.slice(0,cursor+1).findLast(e=>e.query)?.query;
      q('query-box').innerHTML=query?`${!s.query?'<small class="ts-last-query">Last query</small>':''}<div><b class="ts-a">A</b><span>${query.a.map(u=>chip(u)).join('')}</span></div><div><b class="ts-b">B</b><span>${query.b.map(u=>chip(u)).join('')}</span></div><strong class="ts-answer ${query.answer===null?'pending':query.answer?'yes':'no'}">${query.answer===null?'Asking…':query.answer?'Yes · an edge exists':'No · no edge across these sets'}</strong>`:'<p>No query in progress.</p>';
      const known=new Set([0,...s.edges.flat()]);
      q('preorder').innerHTML=t.preorder.slice(0,trace.limit).map(u=>chip(u,known.has(u)?'is-known':b.includes(u)?'is-b':'')).join('')+(trace.limit<t.n?'<span class="ts-ellipsis">… not sent</span>':'');
      q('stack').innerHTML=s.stack.map(u=>chip(u,u===s.active?'is-a':'is-known')).join('<span class="ts-arrow">›</span>');
      q('pool-count').textContent=`${s.pool.length} left`;
      q('pool').innerHTML=s.pool.map(u=>chip(u,b.includes(u)?'is-b':s.candidates.includes(u)?'is-candidate':'')).join('')||'<span class="ts-empty">All vertices matched</span>';
      const budget=mode==='amortized'?`Upper bound: ${2*t.n-2}`:mode==='hybrid'?`Phase 1: ${s.prefixQueries} · phase 2: ${s.binaryQueries}`:'Without a preorder';
      q('ledger').innerHTML=`<div><strong>${s.queries}</strong><span>Queries</span></div><div><strong>${s.exits}<small> / ${t.n-1}</small></strong><span>Permanent exits</span></div><div><strong>${s.splits}</strong><span>Binary probes</span></div><p>${budget}</p>`;
      const history=trace.events.slice(0,cursor+1).map((e,i)=>({e,i})).filter(({e})=>['answer','attach','exit','phase','done'].includes(e.type));
      q('history').innerHTML=history.map(({e,i})=>`<button data-event="${i}" class="${i===cursor?'is-current':''}"><span>${e.type==='answer'?`Q${e.queries}`:e.type==='attach'?'+':e.type==='exit'?'↑':e.type==='phase'?'⇢':'✓'}</span>${e.type==='answer'?`{${e.query.a.map(u=>t.labels[u]).join(',')}} ↔ {${e.query.b.map(u=>t.labels[u]).join(',')}} <b class="${e.query.answer?'ts-yes':'ts-no'}">${e.query.answer?'Yes':'No'}</b>`:e.note}</button>`).join('');
      q('history-label').textContent=s.phase==='preorder'?'preorder phase':'binary-search phase';
      q('progress').textContent=`${cursor+1} / ${trace.events.length}`;
      q('back').disabled=cursor===0;q('step').disabled=q('play').disabled=q('finish').disabled=cursor===trace.events.length-1;
    }
    function refreshStarts(){q('start').replaceChildren();for(let u=1;u<=c.total;u++){const option=document.createElement('option');option.value=u;option.textContent=`${u} · ${u<=c.length?'core':'leaf'}`;q('start').append(option);}start=Math.max(1,Math.min(c.total,start));q('start').value=start;}
    function point(u){return u<=c.length?{x:70+(u-1)*520/(c.length-1),y:86}:{x:48+(u-c.length-1)%8*80,y:224+Math.floor((u-c.length-1)/8)*90};}
    function buildChainScene(){q('chain-graph').innerHTML='<svg viewBox="0 0 660 335" role="img" aria-label="Known core chain and decoded leaves"><g data-chain-edges></g><g data-chain-nodes></g><g class="ts-bob"><circle r="17"/><text y="4" text-anchor="middle">B</text></g></svg>';bob=q('chain-graph').querySelector('.ts-bob');}
    function renderChain(){const state=M.observe(c,path),known=new Map(state.known),game=q('game').checked,over=state.moves>=5&&!state.solved;
      const missed=Array.from({length:c.length},(_,i)=>i+1).filter(u=>!state.visited.includes(u));
      q('intro').textContent=`${c.length}-vertex core · local neighbors only · at most five moves. ${game?'Choose a neighbor to move Bob.':'Step through Bob’s decoding walk.'}`;
      q('status').textContent=state.solved?`Decoded every attachment in ${state.moves} moves.${state.inferred.length?` ${state.inferred.length} leaf attachment${state.inferred.length===1?' was':'s were'} inferred by elimination.`:''}`:over?'Five moves used. Some leaf attachments are still unknown. Restart and try visiting more distinct core vertices.':`Bob is at ${state.current}. ${state.visited.length}/${c.length} core vertices visited; ${c.hosts.length-known.size} attachments remain unknown.`;
      q('graph-summary').textContent=`${known.size}/${c.hosts.length} attachments decoded`;
      let edgeMarkup='',nodeMarkup='';
      for(let u=1;u<c.length;u++){const a=point(u),b=point(u+1);edgeMarkup+=`<path class="ts-core-edge" d="M${a.x} ${a.y}L${b.x} ${b.y}"/>`;}
      for(const[leaf,host]of known){const a=point(leaf),b=point(host);edgeMarkup+=`<path class="ts-leaf-edge${state.inferred.includes(leaf)?' is-inferred':''}" d="M${a.x} ${a.y}C${a.x} ${a.y-65} ${b.x} ${b.y+65} ${b.x} ${b.y}"/>`;}
      for(let u=1;u<=c.total;u++){const p=point(u),isCore=u<=c.length;nodeMarkup+=`<g transform="translate(${p.x},${p.y})" class="ts-chain-node${state.visited.includes(u)?' is-visited':''}${state.inferred.includes(u)?' is-inferred':''}"><circle r="${isCore?15:11}"/><text y="${isCore?35:28}" text-anchor="middle">${u}</text>${!isCore&&!known.has(u)?'<text y="4" text-anchor="middle" class="ts-question">?</text>':''}</g>`;}
      q('chain-graph').querySelector('[data-chain-edges]').innerHTML=edgeMarkup;q('chain-graph').querySelector('[data-chain-nodes]').innerHTML=nodeMarkup;
      const current=point(state.current);bob.style.transitionDuration=path.length===1||matchMedia('(prefers-reduced-motion: reduce)').matches?'0ms':`${Math.min(400,Number(q('speed').value)*.75)}ms`;bob.style.transform=`translate(${current.x}px,${current.y-26}px)`;
      q('legend').innerHTML='<span><i class="ts-a-key"></i> B = Bob</span><span><i class="ts-b-key"></i> Visited core</span><span><i class="ts-inferred-key"></i> Inferred attachment</span>';
      q('moves').textContent=`${state.moves}/5 moves`;
      q('local').innerHTML=`<p>At <strong>${state.current}</strong> · neighbors</p><div class="ts-neighbors">${c.neighbors(state.current).map(u=>`<button data-move="${u}" ${!game||state.solved||over||traveling?'disabled':''}>${u}<small>${u<=c.length?'core':'leaf'}</small></button>`).join('')}</div><small>${game?'Click an adjacent label to move.':'Enable “Choose Bob’s moves” to play.'}</small>`;
      q('attachments').innerHTML=c.hosts.map((_,i)=>{const leaf=c.length+i+1;return `<span class="${state.inferred.includes(leaf)?'is-inferred':known.has(leaf)?'is-known':''}">${leaf} → <b>${known.get(leaf)??'?'}</b></span>`;}).join('');
      q('inference').textContent=missed.length===1?`Only core ${missed[0]} is unvisited. Every leaf not seen elsewhere must attach there.`:state.solved?'Every leaf attachment has been observed.':'Unvisited cores can still hide leaf attachments.';
      q('ledger').innerHTML=`<div><strong>${state.moves}<small> / 5</small></strong><span>Moves used</span></div><div><strong>${state.visited.length}<small> / ${c.length}</small></strong><span>Core vertices seen</span></div><div><strong>${state.inferred.length}</strong><span>Inferred leaves</span></div>`;
      q('history').innerHTML=path.map((u,i)=>`<button data-walk-event="${i}" class="${i===path.length-1?'is-current':''}"><span>${i===0?'Start':i}</span>${i?`${path[i-1]} → ${u}`:`Placed at ${u}`}<small>Neighbors: ${c.neighbors(u).join(', ')}</small></button>`).join('');
      q('history-label').textContent=game?'your walk':'demonstration';q('progress').textContent=game?'Your decisions':`${path.length} / ${route.length} visits`;
      q('back').disabled=path.length===1;q('step').disabled=q('play').disabled=q('finish').disabled=game||state.solved||path.length>=route.length;
    }
    function render(){if(mode==='chain')renderChain();else renderTree();root.dataset.mode=mode;root.dataset.finished=String(mode==='chain'?M.observe(c,path).solved:cursor===trace.events.length-1);q('history').scrollTop=q('history').scrollHeight;}
    function step(){if(disposed)return;if(mode==='chain'){if(q('game').checked||path.length>=route.length||M.observe(c,path).solved){stop();return;}path.push(route[path.length]);}else if(cursor<trace.events.length-1)cursor++;render();if(q('step').disabled)stop();}
    function tick(){step();if(!q('step').disabled&&!disposed)timer=setTimeout(tick,Number(q('speed').value));}
    for(const name of ['binary','amortized','chain','hybrid'])on(q(name),'click',()=>chooseMode(name));
    on(q('reset'),'click',reset);on(q('step'),'click',()=>{stop();step();});
    on(q('back'),'click',()=>{stop();if(mode==='chain')path.pop();else cursor=Math.max(0,cursor-1);render();});
    on(q('play'),'click',()=>{if(timer!==null)stop();else{q('play').textContent='Ⅱ Pause';tick();}});
    on(q('finish'),'click',()=>{stop();if(mode==='chain')path=[...route];else cursor=trace.events.length-1;render();});
    on(q('reveal'),'change',render);
    function generate(){t=M.preset(q('example').value,Number(q('size').value)||12,++seed);updateTreeEditor();reset();}
    on(q('generate'),'click',generate);on(q('example'),'change',generate);
    on(q('prefix'),'change',()=>{q('prefix').value=Math.max(1,Math.min(t.n,Math.trunc(Number(q('prefix').value)||1)));reset();});
    on(q('apply-edges'),'click',()=>{try{const next=M.parse(q('edges').value);t=next;q('error').textContent='';updateTreeEditor();reset();}catch(e){q('error').textContent=e.message;}});
    on(q('length'),'change',()=>{const length=Number(q('length').value);c=M.chain(length,c.hosts.map(h=>1+(h-1)%length));start=Math.min(start,c.total);refreshStarts();reset();});
    on(q('start'),'change',()=>{start=Number(q('start').value);reset();});
    on(q('shuffle'),'click',()=>{seed++;c=M.chain(c.length,Array.from({length:8},(_,i)=>1+((i*7+seed*3+i*i)%c.length)));refreshStarts();reset();});
    on(q('game'),'change',reset);
    on(q('local'),'click',e=>{const button=e.target.closest('[data-move]');if(!button||button.disabled||!q('game').checked)return;const u=Number(button.dataset.move);if(c.neighbors(path.at(-1)).includes(u)&&path.length<=5){path.push(u);traveling=true;render();clearTimeout(travelTimer);travelTimer=setTimeout(()=>{traveling=false;if(!disposed&&mode==='chain')render();},Math.min(400,Number(q('speed').value)*.75));}});
    on(q('history'),'click',e=>{const event=e.target.closest('[data-event]'),walk=e.target.closest('[data-walk-event]');stop();if(event)cursor=Number(event.dataset.event);if(walk)path=path.slice(0,Number(walk.dataset.walkEvent)+1);render();});
    updateTreeEditor();refreshStarts();chooseMode(initial);
    return()=>{disposed=true;stop();clearTimeout(travelTimer);graph.destroy();abort.abort();dialog?.classList.remove('ts-dialog');root.remove();};
  }
  window.JournalWidgets=window.JournalWidgets||[];
  // Separate deliberate anchors keep later insights away from the warm-up.
  window.JournalWidgets.push({id:'tree-speculation-binary',title:'Tree Speculation · Binary Search',pages:[97,98,99,100,101,102,103],badge:{page:97,y:.55},mount:c=>mount(c,'binary')});
  window.JournalWidgets.push({id:'tree-speculation-dfs',title:'Tree Speculation · Amortized DFS',pages:[98,99,100,101,102,103],badge:{page:98,y:.59},mount:c=>mount(c,'amortized')});
  window.JournalWidgets.push({id:'tree-speculation-chain',title:'Tree Speculation · Bob’s Walk',pages:[100,101,102,103],badge:{page:100,y:.55},mount:c=>mount(c,'chain')});
  window.JournalWidgets.push({id:'tree-speculation',title:'Tree Speculation',pages:[102,103],badge:{page:102,y:.59},mount:c=>mount(c,'hybrid')});
})();
