(() => {
  'use strict';
  const FACT=[1n];for(let i=1;i<=9;i++)FACT[i]=FACT[i-1]*BigInt(i);
  const RADIX=FACT[9];
  function unrank(rank){const pool=[1,2,3,4,5,6,7,8,9],out=[];for(let left=8;left>=0;left--){const index=Number(rank/FACT[left]);rank%=FACT[left];out.push(pool.splice(index,1)[0]);}return out;}
  function rank(values){const pool=[1,2,3,4,5,6,7,8,9];return values.reduce((n,value,i)=>{const p=pool.indexOf(value);if(p<0)throw Error('Not a permutation');pool.splice(p,1);return n+BigInt(p)*FACT[8-i];},0n);}
  const regionCells=(mode,i)=>mode==='row'?Array.from({length:9},(_,c)=>c):Array.from({length:9},(_,j)=>(i*3+Math.floor(j/3))*9+i*3+j%3);
  function complete(givens){
    const board=givens.slice(),rows=Array(9).fill(0),cols=Array(9).fill(0),boxes=Array(9).fill(0),box=i=>Math.floor(i/27)*3+Math.floor(i%9/3);
    board.forEach((v,i)=>{if(v){const b=1<<v,r=Math.floor(i/9),c=i%9,k=box(i);if((rows[r]|cols[c]|boxes[k])&b)throw Error('Conflicting givens');rows[r]|=b;cols[c]|=b;boxes[k]|=b;}});
    function search(){
      let chosen=-1,options=0,best=10;
      for(let i=0;i<81;i++)if(!board[i]){const bits=1022&~(rows[Math.floor(i/9)]|cols[i%9]|boxes[box(i)]);let count=0;for(let b=bits;b;b&=b-1)count++;if(!count)return false;if(count<best){best=count;chosen=i;options=bits;if(count===1)break;}}
      if(chosen<0)return true;
      const r=Math.floor(chosen/9),c=chosen%9,k=box(chosen);
      for(let bits=options;bits;bits&=bits-1){const b=bits&-bits;board[chosen]=Math.log2(b);rows[r]|=b;cols[c]|=b;boxes[k]|=b;if(search())return true;rows[r]^=b;cols[c]^=b;boxes[k]^=b;board[chosen]=0;}return false;
    }
    if(!search())throw Error('No Sudoku completion');return board;
  }
  function encode(value,mode='regions'){
    const size=mode==='row'?1:3,capacity=RADIX**BigInt(size);if(value<0n||value>=capacity)throw Error(`Use 0–${capacity-1n}.`);
    const chunks=[],givens=Array(81).fill(0);let rest=value;
    for(let i=0;i<size;i++){const r=rest%RADIX;rest/=RADIX;const values=unrank(r),cells=regionCells(mode,i);cells.forEach((cell,j)=>givens[cell]=values[j]);chunks.push({rank:r,values,cells});}
    return {value,capacity,chunks,givens,board:complete(givens)};
  }
  function decode(board,mode='regions'){let value=0n;for(let i=(mode==='row'?1:3)-1;i>=0;i--)value=value*RADIX+rank(regionCells(mode,i).map(c=>board[c]));return value;}
  if(typeof module!=='undefined'&&module.exports)module.exports={RADIX,rank,unrank,encode,decode,complete};
  if(typeof window==='undefined')return;
  function mount(container){
    const root=document.createElement('section');root.className='lesson-widget sc-widget';const dialog=container.closest('.widget-dialog');dialog?.classList.add('widget-dialog--lesson');
    root.innerHTML=`<div class="lw-tabs" role="tablist" aria-label="Sudoku encoding"><button data-mode="row" role="tab" aria-selected="false">One row</button><button data-mode="regions" role="tab" aria-selected="true">Three regions · spoiler</button></div>
      <form class="lw-toolbar" data-sc="form"><label>Message <input data-sc="message" aria-label="Integer message" inputmode="numeric" value="12345678901234567" autocomplete="off"></label><button class="lw-primary">Encode</button><button type="button" data-sc="random">Random</button><span data-sc="capacity" class="sc-capacity"></span></form><p data-sc="error" class="lw-error" role="alert"></p>
      <div class="lw-workspace"><section class="lw-panel"><div class="sc-journey" aria-label="Transmission stage"><span data-sc="alice">Alice</span><span class="sc-envelope" data-sc="send">→ ▤ →</span><span data-sc="bob">Bob</span></div><div data-sc="board" class="sc-board" role="img" aria-label="Sudoku board used to carry the message"></div><div class="lw-legend"><span><i></i>message digits</span><span><i class="lw-gold"></i>active region</span><span>grey: completion only</span></div></section>
      <section class="lw-panel"><h3 data-sc="heading">ENCODE THE MESSAGE</h3><div class="sc-chunks" data-sc="chunks"></div><div class="sc-recovered" data-sc="recovered"><small>Recovered message</small><output>—</output></div><p class="lw-status" data-sc="status" role="status" aria-live="polite"></p><div class="lw-transport"><button data-sc="back" aria-label="Previous encoding step">←</button><button data-sc="step">Step</button><button data-sc="play" class="lw-primary">▶ Play</button><button data-sc="reset" aria-label="Restart encoding">↺</button><output data-sc="progress"></output></div></section></div>`;
    container.append(root);const q=n=>root.querySelector(`[data-sc="${n}"]`),events=new AbortController();let mode='regions',data=null,step=0,timer=null;
    q('board').before(root.querySelector('.lw-transport'));
    q('board').parentElement.append(q('status'));
    function stop(){clearInterval(timer);timer=null;}
    function render(){
      const n=data.chunks.length,total=2*n+3,filled=step>n,sent=step>n+1,decoded=Math.max(0,step-(n+2)),active=step>=1&&step<=n?step-1:decoded>0&&decoded<=n?decoded-1:-1;
      q('board').innerHTML=data.board.map((digit,i)=>{const chunk=data.chunks.findIndex(c=>c.cells.includes(i)),shown=filled||chunk>=0&&chunk<step;return `<span class="sc-cell ${chunk>=0?'is-message':''} ${chunk>=0&&chunk===active?'is-active':''} ${i%9===2||i%9===5?'sc-right':''} ${Math.floor(i/9)===2||Math.floor(i/9)===5?'sc-bottom':''}">${shown?digit:''}</span>`;}).join('');
      q('alice').classList.toggle('is-active',!sent);q('bob').classList.toggle('is-active',sent);q('send').classList.toggle('is-active',step===n+2);
      q('heading').textContent=sent?'DECODE THE REGIONS':'ENCODE THE MESSAGE';
      q('chunks').innerHTML=data.chunks.map((chunk,i)=>{const known=sent?decoded>i:step>i;return `<div class="sc-chunk ${active===i?'is-active':''}"><span>${mode==='row'?'First row':`Region ${i+1}`}</span><div class="sc-permutation">${chunk.values.map(v=>`<b>${known?v:'·'}</b>`).join('')}</div><small>Permutation rank</small><strong>${known?chunk.rank:'—'}</strong><small>× (9!)<sup>${i}</sup></small></div>`;}).join('');
      q('recovered').classList.toggle('is-complete',step===total);q('recovered').querySelector('output').textContent=step===total?decode(data.board,mode).toString():'—';
      q('status').textContent=step===0?'Step to place each permutation into the board.':step<=n?`Region ${step}: rank ${data.chunks[step-1].rank} → one of 9! digit orders.`:step===n+1?'Complete the Sudoku. Message digits stay fixed.':step===n+2?'Send only the completed board to Bob.':step<total?`Read region ${decoded}, then recover its permutation rank.`:'Add rank × (9!)ⁱ. The original message is recovered.';
      q('capacity').textContent=`${(Math.log2(362880)*n).toFixed(1)} bits / board`;q('message').maxLength=String(data.capacity-1n).length;q('message').title=`Integer from 0 to ${data.capacity-1n}`;
      q('back').disabled=step===0||!!timer;q('step').disabled=step===total||!!timer;q('play').disabled=step===total;q('play').textContent=timer?'Ⅱ Pause':'▶ Play';q('progress').textContent=`${step} / ${total}`;
      root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===mode)));
    }
    function apply(){stop();try{const input=q('message').value.trim();if(!/^\d+$/.test(input))throw Error('Enter a non-negative whole number.');data=encode(BigInt(input),mode);step=0;q('error').textContent='';render();}catch(error){q('error').textContent=error.message;if(data)render();}}
    q('form').addEventListener('submit',e=>{e.preventDefault();apply();},{signal:events.signal});
    root.addEventListener('click',e=>{const tab=e.target.closest('[data-mode]');if(tab){stop();mode=tab.dataset.mode;const max=RADIX**BigInt(mode==='row'?1:3);q('message').value=(data.value%max).toString();apply();return;}
      const a=e.target.closest('[data-sc]')?.dataset.sc;
      if(a==='random'){const words=crypto.getRandomValues(new Uint32Array(2));q('message').value=((BigInt(words[0])*4294967296n+BigInt(words[1]))%data.capacity).toString();apply();}
      if(a==='step'){step++;render();}if(a==='back'){step--;render();}if(a==='reset'){stop();step=0;render();}
      if(a==='play'){if(timer)stop();else timer=setInterval(()=>{step++;if(step>=2*data.chunks.length+3)stop();render();},900);render();}
    },{signal:events.signal});apply();return()=>{stop();events.abort();dialog?.classList.remove('widget-dialog--lesson');root.remove();};
  }
  window.JournalWidgets=window.JournalWidgets||[];window.JournalWidgets.push({id:'collaborative-sudoku',title:'Collaborative Sudoku · Codec',pages:[87,88,89],badge:{page:88,y:.63},mount});
})();
