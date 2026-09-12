(() => {
  'use strict';
  function seatTrace(n,first,right=false){
    const occupied=new Set([first]),frames=[{occupied:[first],seat:first,distance:Infinity}],histogram=new Map();
    while(occupied.size<n){let best=-1,choices=[];for(let i=0;i<n;i++)if(!occupied.has(i)){const d=Math.min(...[...occupied].map(j=>Math.abs(i-j)));if(d>best){best=d;choices=[i];}else if(d===best)choices.push(i);}const seat=right?choices.at(-1):choices[0];occupied.add(seat);histogram.set(best,(histogram.get(best)||0)+1);frames.push({occupied:[...occupied],seat,distance:best,histogram:[...histogram].sort((a,b)=>b[0]-a[0])});}
    return frames;
  }
  function findTrace(parent,start){
    const p=parent.slice(),path=[],frames=[];let row=start;
    while(p[row]!==row){path.push(row);frames.push({parent:p.slice(),row,next:p[row],note:`Follow ${row} → ${p[row]}`});row=p[row];}
    frames.push({parent:p.slice(),row,note:`Row ${row} is the first free slot.`});
    for(const visited of path){p[visited]=row;frames.push({parent:p.slice(),row:visited,next:row,note:`Compress ${visited} → ${row}`});}
    p[row]=row+1;frames.push({parent:p.slice(),row,note:`Fill row ${row}; next search continues at ${row+1}.`});return frames;
  }
  function prefixTrace(n,prefix){
    let rank=0n;const pool=Array.from({length:n},(_,i)=>i),frames=[];
    for(const value of prefix){const digit=pool.indexOf(value),radix=pool.length;if(digit<0)throw Error('Repeated prefix label');const before=rank;rank=rank*BigInt(radix)+BigInt(digit);frames.push({before,rank,radix,digit,value,pool:pool.slice()});pool.splice(digit,1);}
    const capacity=prefix.reduce((p,_,i)=>p*BigInt(n-i),1n);return {frames,rank,capacity};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={seatTrace,findTrace,prefixTrace};
  if(typeof window==='undefined')return;
  function player(container,markup,render,total){
    const root=document.createElement('section');root.className='lesson-widget cl-widget';root.innerHTML=markup+`<p class="lw-status" data-cl="status" role="status"></p><div class="lw-transport"><button data-cl="reset" aria-label="Restart lesson">↺</button><button data-cl="step">Step</button><button data-cl="play" class="lw-primary">▶ Play</button><output data-cl="progress"></output></div>`;container.append(root);let cursor=0,timer=null;const abort=new AbortController(),q=n=>root.querySelector(`[data-cl="${n}"]`);
    const stop=()=>{clearInterval(timer);timer=null;};
    function draw(){render(root,cursor);q('step').disabled=!!timer||cursor===total-1;q('play').disabled=cursor===total-1;q('play').textContent=timer?'Ⅱ Pause':'▶ Play';q('progress').textContent=`${cursor+1} / ${total}`;}
    root.addEventListener('click',e=>{const action=e.target.closest('[data-cl]')?.dataset.cl;if(action==='reset'){stop();cursor=0;draw();}if(action==='step'){cursor++;draw();}if(action==='play'){if(timer)stop();else timer=setInterval(()=>{cursor++;if(cursor===total-1)stop();draw();},650);draw();}},{signal:abort.signal});draw();return()=>{stop();abort.abort();root.remove();};
  }
  function mountSeats(container){
    const setup=document.createElement('div');setup.className='lesson-widget';setup.innerHTML='<div class="lw-toolbar"><label>Tied seats <select><option value="left">Choose leftmost</option><option value="right">Choose rightmost</option></select></label><span class="lw-hint">8 seats · first seat 5</span></div>';container.append(setup);const host=document.createElement('div');container.append(host);let cleanup;
    function build(){cleanup?.();const frames=seatTrace(8,5,setup.querySelector('select').value==='right');cleanup=player(host,'<div class="cl-seats" data-cl="seats"></div><div class="cl-distances" data-cl="groups"></div>',(root,i)=>{const f=frames[i];root.querySelector('[data-cl=seats]').innerHTML=Array.from({length:8},(_,seat)=>`<div class="${f.occupied.includes(seat)?'is-filled':''} ${f.seat===seat?'is-active':''}"><span>${f.occupied.includes(seat)?'●':'·'}</span><small>${seat}</small></div>`).join('');root.querySelector('[data-cl=groups]').innerHTML=`<span>∞ × 1</span>${(f.histogram||[]).map(([d,c])=>`<span class="${d===f.distance?'is-active':''}">${d} × ${c}</span>`).join('')}`;root.querySelector('[data-cl=status]').textContent=i?`Arrival ${i+1} → seat ${f.seat}. Nearest person: distance ${f.distance}.`:'First arrival takes seat 5. Step to build the distance groups.';},frames.length);}
    setup.querySelector('select').addEventListener('change',build);build();return()=>{cleanup?.();setup.remove();host.remove();};
  }
  function mountNextFree(container){
    const parent=Array.from({length:10},(_,i)=>i);parent[1]=2;parent[2]=3;parent[3]=4;parent[4]=5;
    const first=findTrace(parent,1),second=findTrace(first.at(-1).parent,1),frames=[{parent,row:0,note:'One permanent column. Find the first free row below the piston.'},...first,{...first.at(-1),row:0,note:'Search from row 1 again. The compressed pointers skip the old run.'},...second];
    return player(container,'<p class="lw-hint">Permanent occupancy only · compare the first search with the next one.</p><svg data-cl="column" class="cl-column" viewBox="0 0 330 310" role="img" aria-label="Column occupancy and next-free pointers"></svg>',(root,i)=>{const f=frames[i];let svg='<text x="60" y="18">Column</text><text x="160" y="18">Next-free pointers</text>';
      for(let row=1;row<=8;row++){const y=28+(row-1)*32,occupied=f.parent[row]!==row;svg+=`<text x="20" y="${y+19}">${row}</text><rect x="60" y="${y}" width="55" height="28" rx="4" fill="${row===f.row?'#ffedb7':occupied?'#d9eadd':'#f7f9f7'}" stroke="#bbd0c0"/><text x="82" y="${y+19}">${occupied?'T':'F'}</text>`;if(occupied){const yy=28+(f.parent[row]-1)*32+14;svg+=`<path d="M125 ${y+14} C${150+row*12} ${y+14} ${150+row*12} ${yy} 125 ${yy}" fill="none" stroke="${f.row===row?'#b3892e':'#93b29d'}" stroke-width="${f.row===row?3:1.5}"/><text x="245" y="${y+19}">${row} → ${f.parent[row]}</text>`;}}
      root.querySelector('[data-cl=column]').innerHTML=svg;root.querySelector('[data-cl=status]').textContent=f.note;},frames.length);
  }
  window.mountPrefixCodec=(container,labels,prefix)=>{
    const data=prefixTrace(labels.length,prefix),frames=data.frames;
    return player(container,'<p class="lw-hint">Rank the ordered prefix among all distinct-label prefixes.</p><div class="cl-distances" data-cl="pool"></div><div class="cl-equation" data-cl="equation"></div><small data-cl="capacity"></small>',(root,i)=>{const f=frames[i];root.querySelector('[data-cl=pool]').innerHTML=f.pool.map((v,j)=>`<span class="${v===f.value?'is-active':''}">${labels[v]}<small>${j}</small></span>`).join('');root.querySelector('[data-cl=equation]').textContent=`${f.before} × ${f.radix} + ${f.digit} = ${f.rank}`;root.querySelector('[data-cl=capacity]').textContent=`${data.capacity.toLocaleString()} possible prefixes · ${(data.capacity-1n).toString(2).length} bits suffice`;root.querySelector('[data-cl=status]').textContent=`Encode ${labels[f.value]} at index ${f.digit}, then remove it from the pool.${i===frames.length-1?' Final rank: '+data.rank+'.':''}`;},frames.length);
  };
  function visualTab(id,selector,title,resetSelector,mount){
    const widget=window.JournalWidgets.find(w=>w.id===id);if(!widget)return;const original=widget.mount;
    widget.mount=container=>{
      const cleanup=original(container),tabs=container.querySelector(selector),root=tabs.parentElement,button=document.createElement('button');
      button.type='button';button.textContent=title;button.dataset.clTab='lesson';button.setAttribute('role','tab');button.setAttribute('aria-selected','false');tabs.append(button);
      const host=document.createElement('div');host.className='cl-tab-panel';host.hidden=true;root.append(host);let lesson=null,saved=null;
      const onClick=e=>{const chosen=e.target.closest('button');if(!chosen||!tabs.contains(chosen))return;
        if(chosen===button){if(saved)return;root.querySelector(resetSelector)?.click();saved=new Map([...root.children].filter(el=>el!==tabs&&el!==host).map(el=>[el,el.hidden]));for(const el of saved.keys())el.hidden=true;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b===button)));host.hidden=false;lesson=mount(host);}
        else if(saved){lesson?.();lesson=null;host.hidden=true;for(const [el,hidden]of saved)el.hidden=hidden;saved=null;button.setAttribute('aria-selected','false');}
      };
      // Restore the original view before its own tab listener renders that mode.
      tabs.addEventListener('click',onClick,true);
      return()=>{tabs.removeEventListener('click',onClick,true);lesson?.();host.remove();button.remove();cleanup?.();};
    };
  }
  visualTab('piston','.pi-tabs','Next-free · spoiler','[data-pi=reset]',mountNextFree);
  visualTab('introvert-seating-dp','.sd-tabs','Seats → distances','[data-sd=reset]',mountSeats);
})();
