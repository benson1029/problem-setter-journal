(() => {
  'use strict';
  const M = window.PistonModel, NS = 'http://www.w3.org/2000/svg', UNIT = 36;
  function mount(container) {
    const root = document.createElement('section'); root.className = 'pi-widget';
    root.innerHTML = `
      <div class="pi-tabs" role="tablist" aria-label="Piston views"><button role="tab" id="pi-sim-tab" aria-controls="pi-workspace" aria-selected="true" data-pi="simulation">Simulation</button><button role="tab" id="pi-alg-tab" aria-controls="pi-workspace" aria-selected="false" tabindex="-1" data-pi="solution">Solution · spoiler</button></div>
      <p class="pi-intro">Choose a piston, then push. Pistons stick along their top and bottom edges.</p>
      <div class="pi-toolbar"><label>Example<select data-pi="preset" aria-label="Piston example"></select></label><button data-pi="reset">Reset</button><button data-pi="edit" aria-pressed="false">Edit grid</button></div>
      <div class="pi-editor" data-pi="editor" hidden><label>Place<select data-pi="brush"><option value="permanent">Permanent ↓</option><option value="temporary">Temporary →</option><option value="erase">Erase</option></select></label><button data-pi="empty">Clear grid</button><span>Tap a cell to paint. Finish editing to try it.</span></div>
      <div class="pi-controls"><button class="pi-primary" data-pi="play">▶ Push piston</button><button data-pi="step" hidden>Next step</button><label>Speed<select data-pi="speed"><option value="1">1×</option><option value="0.45">2×</option><option value="1.8">½×</option></select></label><span data-pi="selection"></span></div>
      <div id="pi-workspace" class="pi-workspace" role="tabpanel" aria-labelledby="pi-sim-tab">
        <section class="pi-physical"><h3>Piston simulation <span>↓ south · → east</span></h3><div class="pi-scroll"><svg data-pi="board" role="group" aria-label="Piston grid"></svg></div><div class="pi-legend"><span><i class="pi-green"></i>Permanent ↓</span><span><i class="pi-amber"></i>Temporary →</span><span><i class="pi-glue"></i>Vertical glue</span></div></section>
        <aside data-pi="algorithm" class="pi-algorithm" hidden><h3>Boolean array <span>T occupied · F empty</span></h3><div class="pi-scroll"><svg data-pi="array" role="img" aria-label="Boolean occupancy array"></svg></div><div class="pi-code" data-pi="code"></div><div class="pi-stack"><strong>DFS stack</strong><div data-pi="stack">—</div></div></aside>
      </div>
      <p class="pi-status" data-pi="status" role="status" aria-live="polite"></p>
      <div class="pi-progress" data-pi="progress" hidden><span></span></div>
      <p class="pi-note">Temporary heads retract after 0.5 s; permanent heads stay. Columns beyond 10 continue off-screen.</p>
      <details data-pi="explanation" hidden><summary>What the array reveals</summary><p>A permanent push shifts a contiguous column down. Only the first empty cell changes from F to T in the final occupancy array.</p><p>A temporary push starts at the cell to its right. DFS follows occupied north/south neighbours because they are glued, and east neighbours because they are in the way. It never follows west. Discover the entire group before moving all of it one cell right.</p><p>This view shows the scan explicitly. The book then speeds up repeated permanent scans with disjoint-set path compression.</p></details>`;
    container.append(root);
    const q = name => root.querySelector(`[data-pi="${name}"]`), events = new AbortController();
    const on = (el,type,fn) => el.addEventListener(type,fn,{signal:events.signal});
    const node = (tag,attrs={},text) => {const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
    const xy = p => ({x:32+(p.col-1)*UNIT,y:28+(p.row-1)*UNIT});
    const coord = p => `(${p.row}, ${p.col})`;
    M.PRESETS.forEach((p,i)=>q('preset').add(new Option(p.name,i)));
    let state=M.preset(0), initial=M.clone(state), selected='p0', solution=false, editing=false;
    let operation=null, index=0, frame=null, playing=false, animating=false, epoch=0, nextId=100;
    let timer=null, motions=[], rows=8;
    const eligible = p => p && p.type!=='head' && !p.active && p.col<=10;
    const message = text => {q('status').textContent=text;};
    function cancel() {
      epoch++;clearTimeout(timer);timer=null;motions.forEach(a=>a.cancel());motions=[];
      operation=null;frame=null;index=0;playing=false;animating=false;
    }
    function piece(p, ghost=false) {
      const pos=xy(p), g=node('g',{transform:`translate(${pos.x},${pos.y})`,class:`pi-piece pi-${p.type}${p.active?' is-extended':''}${ghost?' pi-ghost':''}`,'data-id':p.id});
      if(p.type==='head') {
        const south=p.direction==='south';
        g.append(node('rect',{x:south?15:0,y:south?0:15,width:south?6:28,height:south?28:6,class:'pi-rod'}));
        g.append(node('rect',{x:south?4:26,y:south?26:4,width:south?28:6,height:south?6:28,rx:2,class:'pi-head-face'}));
      } else {
        g.append(node('rect',{x:4,y:4,width:28,height:28,rx:5,class:'pi-base'}));
        g.append(node('path',{d:'M8 6H28 M8 30H28',class:'pi-glue-marks'}));
        g.append(node('text',{x:18,y:23,'text-anchor':'middle',class:'pi-arrow'},p.active?'•':p.type==='permanent'?'↓':'→'));
      }
      return g;
    }
    function drawGrid(svg, boolean=false) {
      svg.replaceChildren();svg.setAttribute('viewBox',`0 0 400 ${rows*UNIT+36}`);
      const occupied=M.occupancy(state), seen=new Set(frame?.visited||[]);
      for(let col=1;col<=10;col++)svg.append(node('text',{x:xy({row:1,col}).x+18,y:17,'text-anchor':'middle',class:'pi-axis'},col));
      for(let row=1;row<=rows;row++) {
        svg.append(node('text',{x:22,y:xy({row,col:1}).y+22,'text-anchor':'end',class:'pi-axis'},row));
        for(let col=1;col<=10;col++) {
          const p={row,col}, pos=xy(p), id=M.key(p), cell=occupied.get(id);
          const active=frame&&M.key(frame.cell)===id;
          const group=node('g',{'data-cell':id,class:`pi-cell${seen.has(id)?' is-seen':''}${active?' is-current':''}${cell?.id===selected?' is-selected':''}`,transform:`translate(${pos.x},${pos.y})`});
          group.append(node('rect',{x:1,y:1,width:34,height:34,rx:4}));
          if(boolean)group.append(node('text',{x:18,y:23,'text-anchor':'middle',class:cell?'pi-true':'pi-false'},cell?'T':'F'));
          else {group.setAttribute('role','button');group.setAttribute('tabindex',editing||eligible(cell)?'0':'-1');group.setAttribute('aria-label',`${coord(p)} ${cell?cell.type==='head'?'piston head':`${cell.type} piston${cell.active?', extended':''}`:'empty'}`);}
          svg.append(group);
        }
      }
      if(!boolean) {
        // The group moves as a whole; top/bottom strips show the glued sides.
        for(const p of state) if(p.col<=10)svg.append(piece(p));
      }
      if(frame?.from && frame.cell.row>=1 && frame.cell.row<=rows && frame.cell.col<=10) {
        const a=xy(frame.from),b=xy(frame.cell), markerId=`pi-arrow-${boolean?'array':'board'}`;
        const defs=node('defs'),marker=node('marker',{id:markerId,viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:5,markerHeight:5,orient:'auto'});
        marker.append(node('path',{d:'M0 0L10 5L0 10Z',fill:'#ad7825'}));defs.append(marker);svg.append(defs);
        svg.append(node('line',{x1:a.x+18,y1:a.y+18,x2:b.x+18,y2:b.y+18,class:'pi-search-arrow','marker-end':`url(#${markerId})`}));
      }
      svg.append(node('line',{x1:393,x2:393,y1:26,y2:rows*UNIT+28,class:'pi-boundary'}));
    }
    function controls() {
      const base=state.find(p=>p.id===selected);
      q('play').textContent=playing?'Ⅱ Pause':operation?'▶ Continue':solution?'▶ Play push':'▶ Push piston';
      q('play').disabled=editing||(!operation&&!eligible(base));
      q('step').disabled=editing||playing||animating||(!operation&&!eligible(base));
      q('selection').textContent=base?`${base.type==='temporary'?'Temporary':'Permanent'} ${coord(base)}`:'Choose a piston';
      q('progress').hidden=!operation;q('progress').firstElementChild.style.width=operation?`${index/operation.frames.length*100}%`:'0';
    }
    function render() {
      const focused=q('board').contains(document.activeElement)?document.activeElement.dataset.cell:null;
      rows=Math.max(8,...state.map(p=>p.row+1),...(operation?operation.extended.map(p=>p.row+1):[]));
      drawGrid(q('board'));if(solution)drawGrid(q('array'),true);
      if(focused)q('board').querySelector(`[data-cell="${focused}"]`)?.focus({preventScroll:true});
      root.classList.toggle('has-solution',solution);q('algorithm').hidden=!solution;q('step').hidden=!solution;q('explanation').hidden=!solution;
      q('stack').parentElement.hidden=(operation?.base||state.find(p=>p.id===selected))?.type!=='temporary';
      q('stack').replaceChildren();
      for(const p of frame?.stack||[]) {const chip=document.createElement('span');chip.textContent=coord(p);q('stack').append(chip);}
      if(!q('stack').children.length)q('stack').textContent='—';
      const temporary=(operation?.base||state.find(p=>p.id===selected))?.type==='temporary';
      const lines=temporary?['Start at the cell to the right','Skip empty or already visited cells','Mark occupied cell; push onto stack','Explore north, south, then east','Pop stack; return to parent','Move the discovered group right','Retract the temporary head']:['Start below the piston','Scan downward while occupied','Stop at the first F','Push down; set that F to T'];
      const line=temporary?(frame?.kind==='probe'&&frame.from&&frame.occupied&&!frame.seen?3:({probe:1,visit:2,backtrack:4,push:5,hold:6,retract:6}[frame?.kind]??0)):frame?.kind==='scan'?(frame.occupied?1:2):frame?.kind==='push'?3:0;
      q('code').innerHTML=lines.map((s,i)=>`<div class="${i===line?'is-active':''}"><span>${i+1}</span>${s}</div>`).join('');
      controls();
    }
    function describe(f) {
      if(f.kind==='scan')return `${coord(f.cell)} = ${f.occupied?'T: occupied, scan one row down.':'F: the first available slot.'}`;
      if(f.kind==='probe')return `${f.from?`${coord(f.from)} → `:'Start at '}${coord(f.cell)}: ${!f.occupied?'empty — return.':f.seen?'already visited — return.':'occupied — visit next.'}`;
      if(f.kind==='visit')return `Visit ${coord(f.cell)}. Add it to the moving group and explore north, south, east.`;
      if(f.kind==='backtrack')return `Finished ${coord(f.cell)}. ${f.stack.length?'Return to '+coord(f.stack.at(-1))+'.':'DFS complete.'}`;
      if(f.kind==='push')return `Push ${operation.moved.length} occupied cell${operation.moved.length===1?'':'s'} ${operation.base.type==='permanent'?'down':'right'} together; extend the head.`;
      if(f.kind==='hold')return 'Temporary head extended · 0.5 s, then it retracts.';
      return 'Retract the head. The pushed pistons stay in their new positions.';
    }
    function duration(ms) {return matchMedia('(prefers-reduced-motion: reduce)').matches?1:ms*Number(q('speed').value);}
    async function motion(f) {
      animating=true;controls();const token=epoch, animations=[];
      const animate=(el,from,to)=> {const a=el.animate([{transform:`translate(${from.x}px,${from.y}px)`},{transform:`translate(${to.x}px,${to.y}px)`}],{duration:duration(600),easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'});animations.push(a);};
      if(f.kind==='push') {
        for(const id of operation.moved) {
          const old=state.find(p=>p.id===id), next=f.state.find(p=>p.id===id), el=q('board').querySelector(`[data-id="${id}"]`);
          if(el)animate(el,xy(old),xy(next));
        }
        const head=piece(operation.head,true);q('board').append(head);animate(head,xy(operation.base),xy(operation.head));
      } else {
        const el=q('board').querySelector(`[data-id="${operation.head.id}"]`);if(el)animate(el,xy(operation.head),xy(operation.base));
      }
      motions=animations;await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
      if(token!==epoch)return;
      state=M.clone(f.state);animations.forEach(a=>a.cancel());motions=[];animating=false;render();
    }
    function start() {
      if(operation)return true;
      const base=state.find(p=>p.id===selected);if(!eligible(base))return false;
      operation=M.plan(state,selected);index=0;frame=null;
      if(!solution)index=operation.frames.findIndex(f=>f.kind==='push');
      return true;
    }
    function finish() {
      const type=operation.base.type;state=M.clone(operation.after);operation=null;playing=false;render();
      message(type==='permanent'?(solution?`Extended permanently. Only ${coord(frame.cell)} changed from F to T.`:'Extended permanently. Select another piston, or reset to replay.'):'Retracted. You can push this temporary piston again.');
    }
    async function step() {
      if(animating||!start())return;
      const token=epoch;frame=operation.frames[index++];render();message(describe(frame));
      if(frame.kind==='push'||frame.kind==='retract')await motion(frame);
      if(token!==epoch)return;
      if(index>=operation.frames.length){finish();return;}
      if(playing)timer=setTimeout(step,duration(frame.kind==='hold'?500:frame.kind==='push'?0:solution?350:0));
      controls();
    }
    on(q('play'),'click',()=>{
      if(playing){playing=false;clearTimeout(timer);motions.forEach(a=>a.pause());controls();return;}
      if(!start())return;playing=true;
      // If paused during a physical movement, let its completion schedule the next frame.
      if(!animating)step();else {motions.forEach(a=>a.play());controls();}
    });
    on(q('step'),'click',step);
    function reset() {cancel();state=M.clone(initial);selected=state.find(eligible)?.id;render();message('Choose a piston, then push.');}
    on(q('reset'),'click',reset);
    on(q('preset'),'change',()=>{editing=false;q('editor').hidden=true;q('edit').textContent='Edit grid';q('edit').setAttribute('aria-pressed','false');initial=M.preset(Number(q('preset').value));reset();});
    on(q('edit'),'click',()=>{
      if(operation){state=M.clone(operation.before);cancel();}
      editing=!editing;q('editor').hidden=!editing;q('edit').textContent=editing?'Finish editing':'Edit grid';q('edit').setAttribute('aria-pressed',String(editing));
      if(editing) {state=state.filter(p=>p.type!=='head').map(p=>({...p,active:false}));message('Paint permanent or temporary pistons into the grid.');}
      else {initial=M.clone(state);selected=state.find(eligible)?.id;message('Your grid is ready. Choose a piston.');}
      render();
    });
    on(q('empty'),'click',()=>{state=[];selected=null;render();});
    function choose(event) {
      const cell=event.target.closest('[data-cell]');if(!cell||operation)return;
      const [row,col]=cell.dataset.cell.split(',').map(Number), existing=state.find(p=>p.row===row&&p.col===col);
      if(editing) {state=state.filter(p=>p!==existing);if(q('brush').value!=='erase')state.push({id:`custom${nextId++}`,row,col,type:q('brush').value,active:false});render();}
      else if(eligible(existing)){selected=existing.id;frame=null;render();message(`${existing.type==='permanent'?'Permanent ↓':'Temporary →'} at ${coord(existing)} is ready.`);}
      else message(`${coord({row,col})} is ${existing?'occupied'+(existing.active?' by an already extended piston':' by a head'):'empty'}.`);
    }
    on(q('board'),'click',choose);
    on(q('board'),'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(event);}});
    for(const name of ['simulation','solution']) {
      on(q(name),'click',()=>{
        if(operation){state=M.clone(operation.before);cancel();message('Push restarted in this view.');}
        solution=name==='solution';for(const tab of ['simulation','solution']){q(tab).setAttribute('aria-selected',String(tab===name));q(tab).tabIndex=tab===name?0:-1;}
        root.querySelector('.pi-workspace').setAttribute('aria-labelledby',solution?'pi-alg-tab':'pi-sim-tab');render();
      });
      on(q(name),'keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const other=event.key==='Home'?'simulation':event.key==='End'?'solution':name==='simulation'?'solution':'simulation';q(other).click();q(other).focus();}});
    }
    render();message('Select a green ↓ piston to extend it permanently.');
    return ()=>{cancel();events.abort();root.remove();};
  }
  (window.JournalWidgets=window.JournalWidgets||[]).push({id:'piston',title:'Piston',pages:[63,64,65,66,67],badge:{page:63,y:.61},mount});
})();
