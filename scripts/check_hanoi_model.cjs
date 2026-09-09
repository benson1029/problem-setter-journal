const assert=require('node:assert/strict'),M=require('../widgets/hanoi-model.js');
function naive(commands,visible,start,input){const state=M.clone(input);let failed=null;for(let i=start-1;i<commands.length;i++){if(!visible[i])continue;const {from,to}=commands[i],disk=state[from][0];if(disk===undefined||(state[to].length&&disk>state[to][0])){failed=i+1;break;}state[from].shift();state[to].unshift(disk);}return {state,failed};}
const h=M.hanoi(3);assert.deepEqual(h.commands.map(c=>M.RODS[c.from]+M.RODS[c.to]),['XZ','XY','ZY','XZ','YX','YZ','XZ']);
let state=[[1,2,3],[],[]],visible=Array(7).fill(true);
let run=M.execute(M.segment(h.commands,visible),2,state,'segment');assert.equal(run.failed,3);state=run.state;
for(let i=4;i<=5;i++)visible[i]=!visible[i];run=M.execute(M.segment(h.commands,visible),4,state,'segment');assert.equal(run.failed,7);state=run.state;
for(let i=1;i<=4;i++)visible[i]=!visible[i];run=M.execute(M.segment(h.commands,visible),3,state,'segment');assert.equal(run.failed,null);assert.deepEqual(run.state,[[3],[],[1,2]]);
let seed=37231;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
for(let i=0;i<2500;i++){
  const n=1+rand(4),{tree,commands}=M.hanoi(n),state=[[],[],[]],disks=1+rand(8);for(let d=1;d<=disks;d++)state[rand(3)].push(d);
  const start=1+rand(commands.length),mask=commands.map(()=>rand(2)===1);
  for(const mode of ['recursion','segment']){
    const visibility=mode==='recursion'?commands.map(()=>true):mask;
    const expected=naive(commands,visibility,start,state),actual=M.execute(mode==='recursion'?tree:M.segment(commands,visibility),start,state,mode);
    assert.deepEqual({state:actual.state,failed:actual.failed},expected,`${mode} ${JSON.stringify({state,start,visibility})}`);
  }
}
const abstract=M.segment(M.BOOK_COMMANDS,Array(7).fill(true)).summary;
assert.deepEqual(abstract.take,[3,0,1]);
assert.deepEqual(abstract.out.map(rod=>rod.map(M.name)),[['X3'],['X1','Z1'],['X2']]);
assert.deepEqual(new Set(abstract.constraints.map(([a,b])=>`${M.name(a)}<${M.name(b)}`)),new Set(['Z1<Y1','X2<Z2','X3<Z1']));
assert.deepEqual(M.parse(M.format([[1,3,7],[2,4],[5,6]])),[[1,3,7],[2,4],[5,6]]);
assert.throws(()=>M.parse('X: 1 2 | Y: - | Z: -'));assert.throws(()=>M.parse('X: 1 | Y: 1 | Z: -'));
for(let i=0;i<1000;i++){
  const commands=Array.from({length:1+rand(15)},()=>{const from=rand(3);return {from,to:(from+1+rand(2))%3};});
  const state=[[],[],[]],disks=1+rand(9);for(let d=1;d<=disks;d++)state[rand(3)].push(d);
  const visible=commands.map(()=>rand(2)===1),start=1+rand(commands.length);
  const actual=M.execute(M.segment(commands,visible),start,state,'segment');
  assert.deepEqual({state:actual.state,failed:actual.failed},naive(commands,visible,start,state));
}
const returnTrip=M.merge(M.leafSummary(0,1),M.leafSummary(1,0));
assert.deepEqual(M.applySummary(returnTrip,[[2],[1],[]]),[[2],[1],[]]);
assert(!M.checkSummary(returnTrip,[[2],[1],[]]).ok,'A net identity can still have an invalid intermediate move');
console.log('Hanoi: book failures 3/7, exact symbolic net effect, and 6,000 tree executions match direct simulation.');
