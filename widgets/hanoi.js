(() => {
  'use strict';
  const M=window.HanoiModel,NS='http://www.w3.org/2000/svg';
  const COLORS=['#489182','#6687b5','#c7984d','#9c7da8','#c87e72','#729756','#669eac','#a38f65','#7c85b4'];
  const ORIGINS=['#489182','#6687b5','#c7984d'];
  function mount(container){
    const root=document.createElement('section');root.className='ha-widget';
    root.innerHTML=`
      <div class="ha-tabs" role="tablist" aria-label="Hanoi explorations"><button role="tab" id="ha-rec-tab" data-ha="recursion" aria-controls="ha-workspace" aria-selected="true">Recursion tree</button><button role="tab" id="ha-seg-tab" data-ha="segment" aria-controls="ha-workspace" aria-selected="false" tabindex="-1">Segment tree · spoiler</button></div>
      <p class="ha-intro" data-ha="intro"></p>
      <div class="ha-toolbar"><label>Hanoi N<select data-ha="levels" aria-label="Hanoi recursion size"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label><label class="ha-example">Example<select data-ha="example"><option value="standard">All disks on X</option><option value="operations">Book's five operations</option><option value="effect">Book's net-effect example</option></select></label><button data-ha="reset">Reset rods</button></div>
      <div class="ha-demo" data-ha="demo" hidden><button data-ha="demo-next"></button><span data-ha="demo-status">Rod state persists between operations.</span></div>
      <div class="ha-playback"><label>Execute from<input data-ha="start" type="number" min="1" value="1" aria-label="Starting command"></label><button class="ha-primary" data-ha="play">▶ Execute</button><button data-ha="step">Next step</button><button data-ha="stop" disabled>Stop</button><label>Speed<select data-ha="speed"><option value="1">1×</option><option value="0.4">2×</option><option value="1.6">½×</option></select></label></div>
      <p class="ha-status" data-ha="status" role="status" aria-live="polite"></p>
      <div id="ha-workspace" role="tabpanel" aria-labelledby="ha-rec-tab">
        <div class="ha-wide-layout">
          <div class="ha-state-pane">
            <div class="ha-top"><section><div class="ha-section-head"><h3>The rods</h3><button data-ha="arrange" aria-pressed="false">Arrange disks</button></div><svg data-ha="rods" viewBox="0 0 420 258" role="group" aria-label="Hanoi rods and disks"></svg><p class="ha-hint" data-ha="rod-hint">Smaller numbers are smaller disks. Rods keep their state after execution.</p></section>
            <aside class="ha-inspector"><h3 data-ha="node-title"></h3><p data-ha="node-meaning"></p><ul data-ha="checks"></ul></aside></div>
            <details class="ha-state-editor"><summary>Enter a starting state</summary><label>Bottom → top on each rod<input data-ha="state-text" spellcheck="false" aria-label="Rod state, bottom to top"></label><button data-ha="apply-state">Apply state</button><p class="ha-error" data-ha="state-error" role="alert"></p></details>
            <section class="ha-visibility" data-ha="visibility" hidden><div class="ha-section-head"><h3>Visible commands</h3><button class="ha-primary" data-ha="build">Build tree</button></div><div class="ha-range"><label>From<input data-ha="range-l" type="number" min="1" value="1"></label><label>To<input data-ha="range-r" type="number" min="1" value="7"></label><button data-ha="flip">Toggle range</button><button data-ha="all">Show all</button><button data-ha="none">Hide all</button></div><div class="ha-command-list" data-ha="commands"></div><p class="ha-hint" data-ha="visibility-hint">Choose visible commands, then build their abstractions.</p></section>
          </div>
          <div class="ha-tree-pane">
            <div class="ha-section-head ha-tree-head"><h3 data-ha="tree-title">Recursion tree</h3><span>Click a node to start at its first command.</span></div>
            <div class="ha-tree-scroll" data-ha="tree-scroll"><svg data-ha="tree" role="group" aria-label="Execution tree"></svg></div>
            <p class="ha-tree-key"><i class="ha-key-current"></i>Current <i class="ha-key-applied"></i>Applied <i class="ha-key-failed"></i>Failed <span>Scroll sideways for larger trees.</span></p>
            <section class="ha-abstraction" data-ha="abstraction" hidden><h3>Inside this node: symbolic net effect</h3><p class="ha-hint">X1 is the top disk originally on X, X2 the next, and so on. Colours track the original rod.</p><div class="ha-symbolic" data-ha="symbolic"></div><p class="ha-hint">Dashed tokens are the remaining stack; its top may be absent. Size checks also protect intermediate moves.</p></section>
            <details class="ha-explanation"><summary>How the tree accelerates execution</summary><p data-ha="explanation"></p></details>
          </div>
        </div>
      </div>`;
    container.append(root);
    const dialog=container.closest('.widget-dialog');dialog?.classList.add('ha-dialog');
    const q=n=>root.querySelector(`[data-ha="${n}"]`),abort=new AbortController();
    const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
    const svgNode=(tag,attrs={},text)=>{const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;return el;};
    let n=3,mode='recursion',state=[[1,2,3],[],[]],initial=M.clone(state),commands=[],tree=null,nodes=[];
    let visible=[],draft=[],dirty=false,selected=null,arranging=false,queue=null,cursor=0,running=false,moving=false,epoch=0,timer=null,motions=[],current=null;
    let applied=new Set(),built=null,demoIndex=-1,gesture=null;
    const rodX=r=>70+r*140;
    function position(disk,piles=state){for(let r=0;r<3;r++){const i=piles[r].indexOf(disk);if(i>=0)return {r,i,x:rodX(r),y:219-(piles[r].length-1-i)*19};}return null;}
    const textStatus=s=>q('status').textContent=s;
    function stop(clear=true){epoch++;clearTimeout(timer);motions.forEach(a=>a.cancel());motions=[];running=false;moving=false;queue=null;cursor=0;built=null;if(clear){current=null;applied.clear();}controls();}
    function flatten(t){return [t,...t.children.flatMap(flatten)];}
    function rebuild(){tree=mode==='recursion'?M.hanoi(n).tree:M.segment(commands,visible);nodes=flatten(tree);selected=tree;dirty=false;built=null;q('tree-scroll').scrollTop=0;}
    function setMode(next){
      stop();mode=next;arranging=false;
      if(mode==='recursion'&&q('example').value!=='standard'){q('example').value='standard';commands=M.hanoi(n).commands;visible=commands.map(()=>true);draft=visible.slice();demoIndex=-1;}
      rebuild();render();
    }
    function loadExample(){
      stop();n=Number(q('levels').value);const example=q('example').value;
      if(example==='standard'){commands=M.hanoi(n).commands;state=[Array.from({length:n},(_,i)=>i+1),[],[]];demoIndex=-1;}
      else {n=3;q('levels').value='3';mode='segment';commands=example==='effect'?M.BOOK_COMMANDS:M.hanoi(3).commands;state=example==='effect'?[[1,2,3,7],[5],[4,6]]:[[1,2,3],[],[]];demoIndex=example==='operations'?0:-1;}
      initial=M.clone(state);visible=commands.map(()=>true);draft=visible.slice();q('start').value=1;q('range-r').value=commands.length;arranging=false;rebuild();render();textStatus('Choose a node or starting command, then execute.');
    }
    function drawRods(){
      const svg=q('rods');svg.replaceChildren();svg.dataset.state=JSON.stringify(state);svg.classList.toggle('is-arranging',arranging);
      for(let r=0;r<3;r++){
        svg.append(svgNode('rect',{x:rodX(r)-62,y:13,width:124,height:221,rx:12,class:'ha-drop-zone','data-rod':r}));
        svg.append(svgNode('line',{x1:rodX(r),x2:rodX(r),y1:52,y2:233,class:'ha-rod'}));
        svg.append(svgNode('line',{x1:rodX(r)-54,x2:rodX(r)+54,y1:233,y2:233,class:'ha-plinth'}));
        svg.append(svgNode('text',{x:rodX(r),y:252,'text-anchor':'middle',class:'ha-rod-label'},M.RODS[r]));
      }
      state.flat().forEach(d=>{
        const p=position(d),g=svgNode('g',{transform:`translate(${p.x},${p.y})`,class:'ha-disk','data-disk':d,tabindex:arranging?'0':'-1',role:'button','aria-label':`Disk ${d}, rod ${M.RODS[p.r]}${arranging?'; use left/right arrows to move':''}`});
        const w=29+d*8;g.append(svgNode('rect',{x:-w/2,y:-9,width:w,height:17,rx:5,fill:COLORS[(d-1)%COLORS.length]}));g.append(svgNode('text',{'text-anchor':'middle',y:4},d));svg.append(g);
      });
      q('state-text').value=M.format(state);q('arrange').setAttribute('aria-pressed',String(arranging));q('arrange').textContent=arranging?'Finish arranging':'Arrange disks';
      q('rod-hint').textContent=arranging?'Drag any disk to a rod; it is placed in size order. Keyboard: focus a disk, then use ← / →.':'Smaller numbers are smaller disks. Rods keep their state after execution.';
    }
    function layout(){let maxDepth=0;function walk(t,depth){t.x=50+(t.l+t.r-2)*42;t.y=54+depth*108;maxDepth=Math.max(maxDepth,depth);t.children.forEach(c=>walk(c,depth+1));}walk(tree,0);return {width:Math.max(300,commands.length*84+18),height:112+maxDepth*108};}
    function drawTree(){
      const svg=q('tree'),size=layout();svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${size.width} ${size.height}`);svg.style.width=`${size.width}px`;
      svg.setAttribute('aria-label',`${mode==='recursion'?'Recursion':'Segment'} tree with ${commands.length} commands`);
      nodes.forEach(t=>t.children.forEach(c=>svg.append(svgNode('path',{d:`M${t.x},${t.y+44} C${t.x},${t.y+65} ${c.x},${c.y-62} ${c.x},${c.y-43}`,class:`ha-tree-edge${current?.node.id===c.id?' is-followed':''}`}))));
      nodes.forEach(t=>{
        const active=current?.node.id===t.id,failed=active&&(current.kind==='fail'||current.kind==='descend'||current.kind==='check'&&!current.result.ok);
        const g=svgNode('g',{transform:`translate(${t.x},${t.y})`,class:`ha-tree-node${selected?.id===t.id?' is-selected':''}${active?' is-current':''}${failed?' is-failed':''}${applied.has(t.id)?' is-applied':''}${built&&!built.has(t.id)?' is-pending':''}`,'data-node':t.id,role:'button',tabindex:'0','aria-label':`Commands ${t.l} to ${t.r}${mode==='recursion'?`, ${t.n} disks ${M.RODS[t.from]} to ${M.RODS[t.to]}`:`; ${t.summary.count} visible moves`}`});
        g.append(svgNode('rect',{x:-39,y:-43,width:78,height:88,rx:9,class:'ha-node-card'}));
        g.append(svgNode('text',{y:-26,'text-anchor':'middle',class:'ha-node-range'},t.l===t.r?`#${t.l}`:`[${t.l}–${t.r}]`));
        if(mode==='recursion'){
          g.append(svgNode('text',{y:-3,'text-anchor':'middle',class:'ha-node-transfer'},`${M.RODS[t.from]} → ${M.RODS[t.to]}`));
          g.append(svgNode('text',{y:16,'text-anchor':'middle',class:'ha-node-caption'},`${t.n} disk${t.n===1?'':'s'}`));
          g.append(svgNode('text',{y:34,'text-anchor':'middle',class:'ha-node-small'},t.children.length?`${t.r-t.l+1} moves`:'Move'));
        }else {
          for(let r=0;r<3;r++){
            const x=(r-1)*23;g.append(svgNode('line',{x1:x,x2:x,y1:-13,y2:20,class:'ha-mini-rod'}));
            const tokens=t.summary.out[r].slice(0,3);tokens.forEach((tok,i)=>g.append(svgNode('rect',{x:x-8,y:14-(tokens.length-1-i)*7,width:16,height:5,rx:2,fill:ORIGINS[tok.rod]})));
            g.append(svgNode('text',{x,y:30,'text-anchor':'middle',class:'ha-node-small'},M.RODS[r]));
            if(t.summary.out[r].length>3)g.append(svgNode('text',{x,y:-5,'text-anchor':'middle',class:'ha-node-small'},'+'));
          }
          g.append(svgNode('text',{y:41,'text-anchor':'middle',class:'ha-node-small'},t.summary.count?`${t.summary.constraints.length} size checks`:'invisible · skip'));
        }
        svg.append(g);
      });
      q('tree-scroll').classList.toggle('is-dirty',dirty);
    }
    function symbolic(summary){
      const el=q('symbolic');el.replaceChildren();
      for(const side of ['before','after']){
        const block=document.createElement('div');block.className='ha-symbolic-state';const title=document.createElement('h4');title.textContent=side==='before'?'Input top disks':'Output top disks';block.append(title);
        const rods=document.createElement('div');rods.className='ha-symbolic-rods';
        for(let r=0;r<3;r++){
          const column=document.createElement('div'),label=document.createElement('strong');label.textContent=M.RODS[r];column.append(label);
          const items=side==='before'?Array.from({length:summary.take[r]},(_,i)=>M.token(r,i+1)):summary.out[r];
          for(const tok of items){const chip=document.createElement('span');chip.style.background=ORIGINS[tok.rod];chip.textContent=M.name(tok);chip.title=`${M.RODS[tok.rod]}, disk ${tok.depth} from the top`;column.append(chip);}
          const tail=document.createElement('span');tail.className='ha-tail';tail.textContent=`${M.RODS[r]}${summary.take[r]+1}…`;column.append(tail);rods.append(column);
        }
        block.append(rods);el.append(block);
      }
    }
    function inspect(){
      if(!selected)return;const t=selected,evalState=current?.node.id===t.id&&current.before?current.before:state;
      const result=mode==='recursion'?M.checkCall(t,evalState):M.checkSummary(t.summary,evalState);
      q('node-title').textContent=`Commands ${t.l===t.r?t.l:`${t.l}–${t.r}`}`;
      q('node-meaning').textContent=mode==='recursion'?`Transfer the top ${t.n} disk${t.n===1?'':'s'} from ${M.RODS[t.from]} to ${M.RODS[t.to]}${t.n>1?`, using ${M.RODS[t.other]}`:''}.`:`${t.summary.count} visible move${t.summary.count===1?'':'s'}. ${t.summary.count?'Rearrange the input disks if every check passes.':'Identity: leave all rods as they are.'}`;
      q('checks').replaceChildren();
      result.checks.forEach(c=>{const li=document.createElement('li');li.className=c.ok?'is-pass':'is-fail';li.textContent=`${c.ok?'✓':'×'} ${c.text}`;q('checks').append(li);});
      if(mode==='segment')symbolic(t.summary);
    }
    function commandsView(){
      q('commands').replaceChildren();commands.forEach((c,i)=>{const label=document.createElement('label');label.className=draft[i]?'':'is-hidden';const input=document.createElement('input');input.type='checkbox';input.checked=draft[i];input.dataset.command=i;input.setAttribute('aria-label',`Command ${i+1}: ${M.RODS[c.from]} to ${M.RODS[c.to]} visible`);const text=document.createElement('span');text.textContent=`${i+1} · ${M.RODS[c.from]}→${M.RODS[c.to]}`;label.append(input,text);q('commands').append(label);});
      q('visibility-hint').textContent=dirty?'Visibility changed. Build the tree before executing.':'Each node combines its children’s rearrangements and size constraints.';
    }
    function controls(){
      root.dataset.busy=String(!!queue);root.dataset.mode=mode;
      q('play').textContent=running?'Ⅱ Pause':queue?'▶ Continue':'▶ Execute';q('play').disabled=dirty||arranging;
      q('step').disabled=dirty||arranging||running||moving;q('stop').disabled=!queue;
      for(const key of ['build','flip','all','none'])q(key).disabled=!!queue;
      for(const input of q('commands').querySelectorAll('input'))input.disabled=!!queue;
      q('start').max=commands.length||1;q('range-l').max=commands.length||1;q('range-r').max=commands.length||1;
      q('demo').hidden=demoIndex<0;q('demo-next').disabled=!!queue||demoIndex>=5;
      q('demo-next').textContent=['1. Execute(2)','2. Update(5, 6)','3. Execute(4)','4. Update(2, 5)','5. Execute(3)'][demoIndex]||'Book example complete';
    }
    function render(){
      for(const key of ['recursion','segment']){q(key).setAttribute('aria-selected',String(mode===key));q(key).tabIndex=mode===key?0:-1;}
      root.querySelector('#ha-workspace').setAttribute('aria-labelledby',mode==='recursion'?'ha-rec-tab':'ha-seg-tab');
      q('intro').textContent=mode==='recursion'?'Pick a starting node. Check a whole transfer; if it fails, descend to the first invalid move.':'Set command visibility, build the tree, then execute using each node’s symbolic net effect.';
      q('visibility').hidden=mode!=='segment';q('abstraction').hidden=mode!=='segment';
      q('tree-title').textContent=mode==='recursion'?'Recursion tree · all commands visible':'Segment tree · net effects in the nodes';
      q('explanation').textContent=mode==='recursion'?'Execute(l) covers the suffix from command l onward. A complete recursive call can transfer its top disks at once if the source count, destination size and temporary-rod size checks pass. If a check fails, descend left to right and keep every successful move before the first invalid command.':'Each visible leaf is one move; an invisible leaf is an identity. A parent composes the left child then the right child, translating disk identities and combining the size constraints. A valid node applies its net effect at once. A failed node is searched left to right. The tree is rebuilt from the chosen visibility state.';
      drawRods();drawTree();focusCurrent();inspect();commandsView();controls();
    }
    function focusCurrent(){
      const el=q('tree').querySelector(`[data-node="${selected.id}"]`),scroll=q('tree-scroll');if(!el)return;
      const rect=el.getBoundingClientRect(),box=scroll.getBoundingClientRect();
      if(rect.left<box.left||rect.right>box.right)scroll.scrollLeft+=rect.left-box.left-box.width/2+rect.width/2;
    }
    function delay(ms){return matchMedia('(prefers-reduced-motion: reduce)').matches?1:ms*Number(q('speed').value);}
    async function animateApply(event){
      moving=true;controls();const token=epoch,animations=[];
      for(const disk of state.flat()){
        const a=position(disk,event.before),b=position(disk,event.after);if(a.x===b.x&&a.y===b.y)continue;
        const el=q('rods').querySelector(`[data-disk="${disk}"]`),sourceLift=22+a.i*19,targetLift=22+b.i*19;
        const keys=a.r===b.r?[{transform:`translate(${a.x}px,${a.y}px)`},{transform:`translate(${b.x}px,${b.y}px)`}]:[{transform:`translate(${a.x}px,${a.y}px)`,offset:0},{transform:`translate(${a.x}px,${sourceLift}px)`,offset:.25},{transform:`translate(${b.x}px,${targetLift}px)`,offset:.72},{transform:`translate(${b.x}px,${b.y}px)`,offset:1}];
        const animation=el.animate(keys,{duration:delay(1050),easing:'ease-in-out',fill:'forwards'});animations.push(animation);
      }
      motions=animations;await Promise.all(animations.map(a=>a.finished.catch(()=>{})));if(token!==epoch)return;
      state=M.clone(event.after);animations.forEach(a=>a.cancel());motions=[];moving=false;applied.add(event.node.id);drawRods();drawTree();controls();
    }
    function eventText(e){
      const range=e.node.l===e.node.r?`#${e.node.l}`:`[${e.node.l}–${e.node.r}]`;
      if(e.kind==='build')return e.node.children.length?`Merge ${range}: left effect, then right effect; retain the size checks.`:`Build ${range}: ${e.node.summary.count?'one visible move':'invisible — identity'}.`;
      if(e.kind==='range')return `Range ${range} starts before command ${q('start').value}; descend to cover the suffix.`;
      if(e.kind==='check')return `Check ${range}: ${e.result.ok?'all preconditions pass.':e.result.checks.find(c=>!c.ok).text+'.'}`;
      if(e.kind==='descend')return `${range} cannot run as a whole. Search its children from left to right.`;
      if(e.kind==='fail')return `First invalid command: ${e.node.l}. Earlier successful moves remain applied.`;
      if(e.kind==='skip')return `Skip ${range}: every command here is invisible.`;
      return `Apply ${range} in one step · ${mode==='recursion'?e.node.r-e.node.l+1:e.node.summary.count} visible moves.`;
    }
    function prepare(){
      if(queue)return true;const start=Number(q('start').value);
      try{queue={...M.execute(tree,start,state,mode),purpose:'execute'};}catch(e){textStatus(e.message);return false;}
      cursor=0;applied.clear();current=null;return true;
    }
    async function advance(){
      if(moving||!prepare())return;
      const token=epoch,event=queue.events[cursor++];current=event;selected=event.node;
      if(event.kind==='build')built.add(event.node.id);
      drawTree();inspect();focusCurrent();textStatus(eventText(event));controls();
      if(event.kind==='apply')await animateApply(event);
      if(token!==epoch)return;
      if(cursor>=queue.events.length){
        const purpose=queue.purpose,failed=queue.failed;queue=null;running=false;built=null;
        if(purpose==='build')textStatus('Tree built. Select a starting command, then execute.');
        else if(failed===null)textStatus('All remaining visible commands executed. Rod state is saved for the next execution.');
        controls();return;
      }
      if(running)timer=setTimeout(advance,delay(event.kind==='build'?220:600));controls();
    }
    function beginBuild(animate=true){
      stop();visible=draft.slice();rebuild();render();
      if(!animate)return;
      const post=t=>[...t.children.flatMap(post),{kind:'build',node:t,before:M.clone(state)}];
      built=new Set();queue={purpose:'build',events:post(tree),failed:null};cursor=0;running=true;advance();
    }
    on(q('play'),'click',()=>{if(running){running=false;clearTimeout(timer);motions.forEach(a=>a.pause());controls();return;}if(!prepare())return;running=true;if(moving){motions.forEach(a=>a.play());controls();}else advance();});
    on(q('step'),'click',advance);on(q('stop'),'click',()=>{stop(false);render();textStatus('Stopped. Completed transfers are preserved.');});
    on(q('reset'),'click',()=>{stop();state=M.clone(initial);arranging=false;render();textStatus('Rods reset to your starting state.');});
    on(q('levels'),'change',()=>{q('example').value='standard';loadExample();});on(q('example'),'change',loadExample);
    on(q('start'),'change',()=>{stop();render();textStatus(`Ready to execute from command ${q('start').value}.`);});
    function selectNode(event){const el=event.target.closest('[data-node]');if(!el)return;stop();selected=nodes.find(t=>t.id===el.dataset.node);q('start').value=selected.l;drawTree();inspect();controls();textStatus(`Start at command ${selected.l}; execution continues to command ${commands.length}.`);}
    on(q('tree'),'click',selectNode);on(q('tree'),'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectNode(event);}});
    on(q('apply-state'),'click',()=>{try{const next=M.parse(q('state-text').value);stop();state=next;initial=M.clone(state);arranging=false;q('state-error').textContent='';render();textStatus('Starting state applied.');}catch(e){q('state-error').textContent=e.message;}});
    on(q('arrange'),'click',()=>{stop();arranging=!arranging;drawRods();controls();textStatus(arranging?'Drag disks to set the starting state.':'Starting state saved. Choose a tree node.');});
    function putDisk(disk,rod){state=state.map(p=>p.filter(d=>d!==disk));state[rod].push(disk);state[rod].sort((a,b)=>a-b);initial=M.clone(state);drawRods();inspect();textStatus(`Disk ${disk} placed on ${M.RODS[rod]}.`);}
    const pointer=event=>new DOMPoint(event.clientX,event.clientY).matrixTransform(q('rods').getScreenCTM().inverse());
    on(q('rods'),'pointerdown',event=>{const el=event.target.closest('[data-disk]');if(!arranging||!el||event.button!==0)return;event.preventDefault();const disk=Number(el.dataset.disk);gesture={disk,id:event.pointerId,el};q('rods').setPointerCapture(event.pointerId);el.classList.add('is-dragging');});
    on(q('rods'),'pointermove',event=>{if(!gesture||event.pointerId!==gesture.id)return;const p=pointer(event);gesture.el.setAttribute('transform',`translate(${p.x},${p.y})`);q('rods').querySelectorAll('[data-rod]').forEach(el=>el.classList.toggle('is-drop',Number(el.dataset.rod)===Math.max(0,Math.min(2,Math.round((p.x-70)/140)))));});
    on(q('rods'),'pointerup',event=>{if(!gesture||event.pointerId!==gesture.id)return;const p=pointer(event),disk=gesture.disk;gesture=null;if(p.x>=0&&p.x<=420&&p.y>=0&&p.y<=258)putDisk(disk,Math.max(0,Math.min(2,Math.round((p.x-70)/140))));else drawRods();});
    for(const event of ['pointercancel','lostpointercapture'])on(q('rods'),event,()=>{if(gesture){gesture=null;drawRods();}});
    on(q('rods'),'keydown',event=>{const disk=Number(event.target.closest('[data-disk]')?.dataset.disk);if(!arranging||!disk||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();putDisk(disk,(position(disk).r+(event.key==='ArrowRight'?1:2))%3);q('rods').querySelector(`[data-disk="${disk}"]`).focus();});
    function changeVisibility(){dirty=true;current=null;applied.clear();commandsView();drawTree();controls();}
    on(q('commands'),'change',event=>{const i=event.target.dataset.command;if(i!==undefined){draft[Number(i)]=event.target.checked;changeVisibility();}});
    on(q('flip'),'click',()=>{const l=Number(q('range-l').value),r=Number(q('range-r').value);if(!Number.isInteger(l)||!Number.isInteger(r)||l<1||r<l||r>commands.length){textStatus(`Use a range within 1–${commands.length}.`);return;}for(let i=l-1;i<r;i++)draft[i]=!draft[i];changeVisibility();});
    on(q('all'),'click',()=>{draft.fill(true);changeVisibility();});on(q('none'),'click',()=>{draft.fill(false);changeVisibility();});on(q('build'),'click',()=>beginBuild());
    on(q('demo-next'),'click',()=>{
      const actions=[['execute',2],['update',5,6],['execute',4],['update',2,5],['execute',3]],a=actions[demoIndex++];
      if(a[0]==='update'){for(let i=a[1]-1;i<a[2];i++)draft[i]=!draft[i];beginBuild();q('demo-status').textContent=`Update(${a[1]}, ${a[2]}) toggled these commands; rods are unchanged.`;}
      else{q('start').value=a[1];prepare();running=true;advance();q('demo-status').textContent=`Execute(${a[1]}) starts from the current rods.`;}
      controls();
    });
    for(const key of ['recursion','segment']){on(q(key),'click',()=>setMode(key));on(q(key),'keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'recursion':event.key==='End'?'segment':key==='recursion'?'segment':'recursion';q(next).click();q(next).focus();}});}
    const resize=new ResizeObserver(()=>root.style.setProperty('--ha-controls-height',`${root.querySelector('.ha-playback').offsetHeight+5}px`));resize.observe(root.querySelector('.ha-playback'));
    loadExample();
    return ()=>{stop();resize.disconnect();abort.abort();dialog?.classList.remove('ha-dialog');root.remove();};
  }
  (window.JournalWidgets=window.JournalWidgets||[]).push({id:'hanoi',title:'Challenge of Hanoi',pages:[71,72,73,74,75,76,77],badge:{page:73,y:.35},mount});
})();
