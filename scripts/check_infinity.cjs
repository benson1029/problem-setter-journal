const assert=require('node:assert/strict'),M=require('../widgets/infinity-model.js');
function variants(net){const result=[];for(let mask=0;mask<8;mask++){const board=Array(net.size);net.labels.forEach((id,slot)=>{board[M.orient(net.n,slot,mask)]=id;});result.push(board);}return result;}
// Separate BFS over labeled edge lists, independent of the model distance API.
function oracle(net,a,b){const seen=new Set([a]),queue=[[a,0]],edges=net.edges.map(([u,v])=>[net.labels[u],net.labels[v]]);for(const[u,d]of queue){if(u===b)return d;for(const[x,y]of edges){const v=x===u?y:y===u?x:null;if(v!==null&&!seen.has(v)){seen.add(v);queue.push([v,d+1]);}}}}
let maxExtra=-Infinity;
for(const n of [4,6,8,10,12])for(let seed=1;seed<=10;seed++){
  const net=M.network(n,seed),maps=variants(net);
  assert.equal(new Set(maps.map(board=>board.join(','))).size,8,'Two ring reversals plus ring swapping give eight distinct drawings');
  for(const board of maps)assert(M.equivalent(net,board),'All independent ring reversals and ring swaps are equivalent');
  const bad=[...net.labels];[bad[0],bad[1]]=[bad[1],bad[0]];assert(!M.equivalent(net,bad));
  for(const a of net.labels)for(const b of net.labels)assert.equal(net.distance(a,b),oracle(net,a,b));
  for(const kind of ['center','layers','arms','full'])for(const anchor of kind==='full'?net.labels:[net.labels[1]]){
    const{events}=M.lesson(net,kind,anchor),last=events.at(-1),queryPairs=new Set();
    for(const e of events){assert(maps.some(board=>e.board.every((id,slot)=>id===null||id===board[slot])),'Every intermediate placement admits an equivalent hidden map');if(e.type==='answer'){const{a,b,d}=e.query;assert.equal(d,oracle(net,a,b));const key=[Math.min(a,b),Math.max(a,b)].join(':');assert(!queryPairs.has(key),'Queries are cached symmetrically');queryPairs.add(key);}}
    assert.equal(last.queries.length,queryPairs.size);
    if(kind==='center'){assert.equal(last.board[0],net.labels[0]);assert.equal(last.board.filter(Boolean).length,1);}
    else assert(M.equivalent(net,last.board));
    if(kind==='full'){assert(last.queries.length<=4*n+6);maxExtra=Math.max(maxExtra,last.queries.length-4*n);}
  }
}
const book=M.network(6,1,true),profile=a=>book.labels.map(b=>book.distance(a,b)).sort((a,b)=>a-b);
assert.deepEqual(profile(book.labels[1]),[0,1,1,2,2,2,2,3,3,3,4]);
assert.deepEqual(profile(book.labels[0]),[0,1,1,1,1,2,2,2,2,3,3]);
assert.deepEqual(profile(book.labels[3]),[0,1,1,2,2,3,4,4,5,5,6]);
assert.throws(()=>M.network(5));
console.log(`Infinity: BFS distances, exact warm-up profiles, four strategies, every anchor, partial deductions and all eight equivalent orientations passed. Largest full-solution query count relative to 4N: ${maxExtra}.`);
