(() => {
  'use strict';
  const M=window.BobExtended;
  window.mountBobExtended=function(container){
    const root=document.createElement('div');root.className='bx-widget';container.append(root);
    root.innerHTML=`<div class="ts-setup bx-setup"><label>Play style<select data-bx="style"><option value="game">Choose my moves</option><option value="demo">Watch the strategy</option></select></label><label>Total IDs K<select data-bx="size">${[15,20,25,30].map(n=>`<option ${n===20?'selected':''}>${n}</option>`).join('')}</select></label><label>Practice case<select data-bx="scenario"><option value="random">Blind start</option><option value="endpoint">Empty chain endpoint</option><option value="leaf">Leaf beside the center</option><option value="center">Start at the center</option></select></label><button data-bx="new">New message</button><label>Start ID<select data-bx="start"></select></label></div>
      <div class="ts-playback"><button data-bx="reset" aria-label="Restart extended game">↺</button><button data-bx="back" aria-label="Undo extended move">←</button><button data-bx="step" class="ts-primary">Step →</button><button data-bx="play">▶ Play</button><button data-bx="finish">Finish</button><select data-bx="speed" aria-label="Extended animation speed"><option value="1000">Slow</option><option value="600" selected>Normal</option><option value="200">Fast</option></select><span data-bx="progress"></span></div>
      <p class="ts-status" data-bx="status" role="status" aria-live="polite"></p>
      <div class="ts-workspace"><section class="ts-main">
        <div class="ts-heading"><h3>Decoded chain order</h3><span data-bx="order-count"></span></div>
        <div class="bx-chain" data-bx="chain"></div><p class="bx-caption">? = position not determined · A reversed chain is the same message.</p>
        <div class="ts-heading"><h3>Bob’s local neighborhood</h3><span data-bx="position"></span></div>
        <div class="bx-local" data-bx="local"></div>
        <div class="bx-legend"><span><i class="bx-core-key"></i> Deduced chain ID</span><span><i class="bx-leaf-key"></i> Deduced leaf</span><span><i class="bx-unknown-key"></i> Role unknown</span></div>
        <div class="ts-ledger" data-bx="ledger"></div>
      </section><aside class="ts-side">
        <div class="ts-heading"><h3>What Bob can deduce</h3><span>From visited neighborhoods only</span></div>
        <div class="bx-knowledge" data-bx="knowledge"></div>
        <h3 class="ts-subhead">Label groups <small>Five consecutive IDs</small></h3><div class="bx-groups" data-bx="groups"></div>
        <h3 class="ts-subhead">Leaf → host <small data-bx="attachment-count"></small></h3><div class="ts-attachments bx-attachments" data-bx="attachments"></div>
        <p class="bx-caption" data-bx="inference"></p>
        <h3 class="ts-subhead">Move history <small>Click to rewind</small></h3><div class="ts-history" data-bx="history"></div>
      </aside></div>
      <details class="ts-notes"><summary>Encoding agreement & five-move strategy</summary><p>Alice chooses a complete group {5k+1, …, 5k+5}. ID 5k+3 always occupies the center; the other four IDs can be permuted. Reversing the chain changes no edges, so there are 4!/2 = 12 distinct orders per group. Every other ID is a leaf attached to one chain ID.</p><p>Degree greater than one identifies a chain ID. With exactly one neighbor, compare their groups: the same group means an empty chain endpoint; different groups mean a leaf. Enter the chain if needed. Starting at the distinguished center: move to either chain neighbor, return immediately, then continue along the other arm. Otherwise head toward the center and continue without turning back. Visiting four chain IDs reveals the whole chain and all but one host’s leaves; the remaining attachments follow by elimination.</p><p>The chain diagram is a consensus of orders consistent with Bob’s complete observations, not a peek at Alice’s tree. Left/right is normalized by putting the smaller endpoint first. A local neighborhood is not a global map: its neighbor positions are arranged by ID, with no clues about chain order. Looking around costs no moves.</p></details>`;
    const q=name=>root.querySelector(`[data-bx="${name}"]`),abort=new AbortController(),on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
    let seed=73,tree=M.generate(20,seed),start=tree.start,path=[start],inspected=false,notice='',playing=false,traveling=false,timer=null,travel=null,disposed=false;
    function stop(){playing=false;clearTimeout(timer);timer=null;q('play').textContent='▶ Play';}
    function cancel(){stop();clearTimeout(travel);travel=null;traveling=false;q('local').classList.remove('is-traveling');}
    function observations(){return inspected?[...new Set(path)].map(at=>({at,neighbors:tree.neighbors(at)})):[];}
    function state(){return M.decode(tree.total,observations());}
    function starts(){q('start').innerHTML=Array.from({length:tree.total},(_,i)=>`<option>${i+1}</option>`).join('');q('start').value=start;}
    function reset(){cancel();path=[start];inspected=false;notice='';render();}
    function newCase(){tree=M.generate(Number(q('size').value),++seed,q('scenario').value);start=tree.start;starts();reset();}
    function chainScene(s){const xs=[45,170,295,420,545];let markup='';
      for(let i=0;i<4;i++){const known=s.slots[i]!==null&&s.slots[i+1]!==null&&s.edges.includes(M.edge(s.slots[i],s.slots[i+1])),inferred=known&&s.inferred.includes(M.edge(s.slots[i],s.slots[i+1]));markup+=`<path class="bx-order-edge${known?' is-known':''}${inferred?' is-inferred':''}" d="M${xs[i]},34L${xs[i+1]},34"/>`;}
      for(let i=0;i<5;i++){const id=s.slots[i];markup+=`<g class="bx-order-node${id!==null?' is-known':''}" transform="translate(${xs[i]},34)"><circle r="12"/><text y="35" text-anchor="middle">${id??'?'}</text>${i===2?'<text class="bx-center-tag" y="-22" text-anchor="middle">center</text>':''}</g>`;}
      q('chain').innerHTML=`<svg viewBox="0 0 590 88" role="img" aria-label="Partially decoded chain order">${markup}</svg>`;
    }
    function localScene(s){const current=path.at(-1),game=q('style').value==='game',over=path.length>5,neighbors=inspected?tree.neighbors(current):[],cols=Math.min(6,neighbors.length),height=neighbors.length?120+Math.ceil(neighbors.length/6)*74:175;
      let edges='',nodes='';
      neighbors.forEach((id,i)=>{const row=Math.floor(i/6),rowCount=Math.min(6,neighbors.length-row*6),x=300+(i%6-(rowCount-1)/2)*90,y=130+row*74;
        edges+=`<path d="M300,35 C300,${75+row*10} ${x},${y-50} ${x},${y}"/>`;
        nodes+=`<g data-bx-move="${id}" data-x="${x}" data-y="${y}" class="bx-neighbor is-${s.roles[id]}${s.solved||over?' is-disabled':''}" role="button" tabindex="${game&&!s.solved&&!over?0:-1}" aria-label="Move to ID ${id}, ${s.roles[id]}" aria-disabled="${!game||s.solved||over||traveling}"><circle class="bx-hit" cx="${x}" cy="${y}" r="29"/><circle cx="${x}" cy="${y}" r="16"/><text x="${x}" y="${y+36}" text-anchor="middle">${id}</text></g>`;
      });
      q('local').innerHTML=`<svg viewBox="0 0 600 ${height}" aria-label="Bob at ${current}${inspected?'; observed neighbors '+neighbors.join(', '):'; neighbors not inspected yet'}"><g class="bx-local-edges">${edges}</g>${nodes}<g class="bx-bob" style="transform:translate(300px,35px)"><circle r="18"/><text y="5" text-anchor="middle">B</text></g><text class="bx-current-label" x="330" y="41">ID ${current}</text></svg>${inspected?`<p>${game?'Tap a neighboring circle to move.':'Watch Bob choose using only the information gathered so far.'}</p>`:'<button data-bx-look class="ts-primary">Look around · free</button>'}`;
    }
    function render(){const s=state(),current=path.at(-1),obs=observations(),loc=M.location(obs.find(o=>o.at===current)),game=q('style').value==='game',moves=path.length-1,over=moves>=5&&!s.solved;
      root.dataset.finished=String(s.solved);root.dataset.observed=String(inspected);
      q('status').textContent=notice||(s.solved?`Message decoded in ${moves} moves. The chain order and every leaf attachment are determined.`:over?'Five moves used; the message is still ambiguous. Undo a move or restart.':!inspected?`Bob starts at ID ${current}. Neither its role nor the chain order has been established. Look around first.`:`At ID ${current} · ${moves}/5 moves used. ${game?'Choose a neighbor to explore.':'Follow the book’s five-move strategy.'}`);
      q('order-count').textContent=`${s.candidates.length} possible order${s.candidates.length===1?'':'s'}`;chainScene(s);localScene(s);
      q('position').textContent=loc.role==='unknown'?'Role not established':loc.role==='chain'?`${current} is on the chain`:`${current} is a leaf`;
      const groupText=s.group===null?'Not identified':`${5*s.group+1}–${5*s.group+5}`,visited=obs.filter(o=>s.roles[o.at]==='chain').length;
      q('knowledge').innerHTML=`<p>${loc.note}</p><dl><div><dt>Chain group</dt><dd>${groupText}</dd></div><div><dt>Distinguished center</dt><dd>${s.group===null?'?':5*s.group+3}</dd></div><div><dt>Chain order</dt><dd>${s.candidates.length===1?'Recovered (up to reversal)':`${s.candidates.length} possibilities`}</dd></div></dl>`;
      q('groups').innerHTML=Array.from({length:Math.ceil(tree.total/5)},(_,g)=>`<div class="${s.groups.includes(g)?'is-possible':'is-ruled-out'}${s.group===g?' is-confirmed':''}"><span>${5*g+1}–${Math.min(tree.total,5*g+5)}</span><small>${s.group===g?'chain':s.groups.includes(g)?'possible':'not chain'}</small></div>`).join('');
      q('attachments').innerHTML=s.attachments.map(({id,host})=>`<span class="${host===null?'':s.inferred.includes(M.edge(id,host))?'is-inferred':'is-known'}">${id} → <b>${host??'?'}</b></span>`).join('')||'<p>Identify the chain group before classifying the other IDs as leaves.</p>';
      q('attachment-count').textContent=`${s.attachments.filter(e=>e.host!==null).length}/${tree.total-5} decoded`;
      q('inference').textContent=s.inferred.length?`${s.inferred.length} dashed / purple deductions follow from the remaining possibilities, without visiting those vertices.`:'Unseen attachments stay unknown; only observations and their logical consequences are shown.';
      q('ledger').innerHTML=`<div><strong>${moves}<small> / 5</small></strong><span>Moves used</span></div><div><strong>${visited}<small> / 5</small></strong><span>Chain IDs visited</span></div><div><strong>${s.edges.length}<small> / ${tree.total-1}</small></strong><span>Edges determined</span></div>`;
      q('history').innerHTML=path.map((id,i)=>`<button data-bx-history="${i}" class="${i===path.length-1?'is-current':''}"><span>${i===0?'Start':i}</span>${i?`${path[i-1]} → ${id}`:`Placed at ${id}`}<small>${inspected?`Neighbors: ${tree.neighbors(id).join(', ')}`:'Neighborhood not inspected'}</small></button>`).join('');q('history').scrollTop=q('history').scrollHeight;
      q('progress').textContent=`${game?'Your decisions':'Book strategy'} · seed ${seed}`;
      q('step').hidden=q('play').hidden=q('finish').hidden=game;
      q('back').disabled=traveling||!inspected;q('step').disabled=q('play').disabled=q('finish').disabled=game||s.solved||over||traveling;
      q('play').textContent=playing?'Ⅱ Pause':'▶ Play';
    }
    function inspect(){inspected=true;notice='';render();}
    function move(id){if(traveling||!inspected||state().solved||path.length>5||!tree.neighbors(path.at(-1)).includes(id))return;
      traveling=true;notice='';const node=q('local').querySelector(`[data-bx-move="${id}"]`),bob=q('local').querySelector('.bx-bob'),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.min(360,Number(q('speed').value)*.65);
      q('local').classList.add('is-traveling');q('back').disabled=true;
      if(node&&bob){bob.style.transitionDuration=`${duration}ms`;bob.style.transform=`translate(${node.dataset.x}px,${node.dataset.y}px)`;}
      travel=setTimeout(()=>{if(disposed)return;path.push(id);traveling=false;travel=null;q('local').classList.remove('is-traveling');render();if(playing)schedule();},duration);
    }
    function step(){if(disposed||traveling)return;if(!inspected){inspect();if(playing)schedule();return;}const s=state();if(s.solved||path.length>5){stop();render();return;}move(M.nextMove(tree.total,observations(),path));}
    function schedule(){clearTimeout(timer);if(state().solved||path.length>5){stop();render();return;}timer=setTimeout(step,Number(q('speed').value));}
    on(q('local'),'click',e=>{if(e.target.closest('[data-bx-look]')){inspect();return;}const node=e.target.closest('[data-bx-move]');if(node&&q('style').value==='game')move(Number(node.dataset.bxMove));});
    on(q('local'),'keydown',e=>{if(e.key==='Enter'||e.key===' '){const node=e.target.closest('[data-bx-move]');if(node&&q('style').value==='game'){e.preventDefault();move(Number(node.dataset.bxMove));}}});
    on(q('reset'),'click',reset);on(q('back'),'click',()=>{cancel();if(path.length>1)path.pop();else inspected=false;notice='';render();});
    on(q('step'),'click',()=>{stop();step();});on(q('play'),'click',()=>{if(playing){stop();render();}else{playing=true;step();}});
    on(q('finish'),'click',()=>{cancel();path=M.route(tree,start);inspected=true;notice='';render();});
    on(q('history'),'click',e=>{const button=e.target.closest('[data-bx-history]');if(button){cancel();path=path.slice(0,Number(button.dataset.bxHistory)+1);notice='';render();}});
    on(q('new'),'click',newCase);on(q('size'),'change',newCase);on(q('scenario'),'change',newCase);on(q('style'),'change',reset);on(q('start'),'change',()=>{start=Number(q('start').value);reset();});
    starts();render();return()=>{disposed=true;cancel();abort.abort();root.remove();};
  };
})();
