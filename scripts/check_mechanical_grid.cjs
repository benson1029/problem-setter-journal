const assert = require('node:assert/strict');
const {rotate, sorted, bounds} = require('../widgets/mechanical-model.js');
assert.deepEqual(rotate([1,2,3,4],2,{r0:0,r1:1,c0:0,c1:1}),[3,1,4,2]);
assert.deepEqual(rotate([1,2,3,4,5,6],3,{r0:0,r1:1,c0:0,c1:2}),[6,5,4,3,2,1]);
assert.deepEqual(rotate([1,2,3,4,5,6],3,{r0:0,r1:0,c0:0,c1:2}),[3,2,1,4,5,6]);
assert.deepEqual(rotate([1,2,3,4,5,6],3,{r0:0,r1:1,c0:1,c1:1}),[1,5,3,4,2,6]);
assert(sorted([1,3,2,4],2), 'Book rule permits multiple sorted targets');
assert(!sorted([1,4,2,3],2));
// Exhaust every rectangular selection: preserve the permutation and all
// outside cells, and return to the start after a full rotation cycle.
for(let columns=2;columns<=8;columns++) {
  const grid=Array.from({length:2*columns},(_,i)=>i+1);
  for(let a=0;a<grid.length;a++) for(let b=0;b<grid.length;b++) {
    const box=bounds(a,b,columns), h=box.r1-box.r0+1,w=box.c1-box.c0+1;
    let turned=rotate(grid,columns,box);
    assert.deepEqual([...turned].sort((a,b)=>a-b),grid);
    grid.forEach((value,i)=>{
      if(Math.floor(i/columns)<box.r0||Math.floor(i/columns)>box.r1||i%columns<box.c0||i%columns>box.c1) assert.equal(turned[i],value);
    });
    for(let i=1;i<(w===h?4:2);i++) turned=rotate(turned,columns,box);
    assert.deepEqual(turned,grid);
  }
}
console.log('Mechanical Grid: quarter-turn, half-turn, strip reversal, sorting and exhaustive rectangle invariants passed.');
