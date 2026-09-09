(function(root,factory){const m=factory();if(typeof module==='object'&&module.exports)module.exports=m;else root.HanoiModel=m;})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  const RODS=['X','Y','Z'];
  const clone=state=>state.map(rod=>rod.slice());
  const token=(rod,depth)=>({rod,depth});
  const name=t=>`${RODS[t.rod]}${t.depth}`;
  const identity=()=>({take:[0,0,0],out:[[],[],[]],constraints:[],count:0});
  function reduce(constraints){
    const strongest=new Map();
    for(const [a,b] of constraints){
      if(a.rod===b.rod&&a.depth<b.depth)continue;
      const key=`${name(a)}:${b.rod}`,old=strongest.get(key);
      if(!old||b.depth<old[1].depth)strongest.set(key,[a,b]);
    }
    const list=[...strongest.values()];
    return list.filter(([a,b],i)=>!list.some(([c,d],j)=>i!==j&&a.rod===c.rod&&b.rod===d.rod&&c.depth>=a.depth&&d.depth===b.depth));
  }
  function leafSummary(from,to,visible=true){
    const s=identity();if(!visible)return s;
    s.take[from]=1;s.out[to]=[token(from,1)];s.constraints=[[token(from,1),token(to,1)]];s.count=1;return s;
  }
  function merge(left,right){
    // Resolve a right-child token in the symbolic output of the left child.
    const resolve=t=>left.out[t.rod][t.depth-1]||token(t.rod,left.take[t.rod]+t.depth-left.out[t.rod].length);
    return {
      take:left.take.map((n,r)=>n+Math.max(0,right.take[r]-left.out[r].length)),
      out:right.out.map((rod,r)=>[...rod.map(resolve),...left.out[r].slice(right.take[r])]),
      constraints:reduce([...left.constraints,...right.constraints.map(([a,b])=>[resolve(a),resolve(b)])]),
      count:left.count+right.count,
    };
  }
  function hanoi(n){
    if(!Number.isInteger(n)||n<1||n>5)throw new Error('Choose 1–5 recursion levels.');
    const commands=[];
    function build(k,from,to,other){
      const l=commands.length+1;
      if(k===1){commands.push({from,to});return {id:`r${l}-${l}`,l,r:l,n:1,from,to,other,children:[]};}
      const a=build(k-1,from,other,to),m=build(1,from,to,other),b=build(k-1,other,to,from);
      return {id:`r${l}-${b.r}`,l,r:b.r,n:k,from,to,other,children:[a,m,b]};
    }
    const tree=build(n,0,2,1);return {tree,commands};
  }
  function segment(commands,visible){
    function build(l,r){
      if(l===r){const c=commands[l-1];return {id:`s${l}-${r}`,l,r,children:[],summary:leafSummary(c.from,c.to,visible[l-1]),...c};}
      const mid=Math.floor((l+r)/2),left=build(l,mid),right=build(mid+1,r);
      return {id:`s${l}-${r}`,l,r,children:[left,right],summary:merge(left.summary,right.summary)};
    }
    return build(1,commands.length);
  }
  function checkSummary(s,state){
    const checks=s.take.map((n,r)=>({ok:state[r].length>=n,text:`${RODS[r]} needs ${n} disk${n===1?'':'s'}; has ${state[r].length}`}));
    for(const [a,b] of s.constraints){
      const av=state[a.rod][a.depth-1],bv=state[b.rod][b.depth-1];
      checks.push({ok:av!==undefined&&(bv===undefined||av<bv),text:`${name(a)} < ${name(b)}: ${av??'missing'} < ${bv??'∞ (empty)'}`});
    }
    return {ok:checks.every(c=>c.ok),checks};
  }
  function applySummary(s,state){
    return s.out.map((rod,r)=>[...rod.map(t=>state[t.rod][t.depth-1]),...state[r].slice(s.take[r])]);
  }
  function checkCall(node,state){
    const {n,from,to,other}=node,block=state[from].slice(0,n),enough=block.length===n;
    const checks=[{ok:enough,text:`${RODS[from]} needs ${n} disk${n===1?'':'s'}; has ${state[from].length}`}];
    if(enough){
      const biggest=block[n-1],top=state[to][0];
      checks.push({ok:top===undefined||biggest<top,text:`Destination ${RODS[to]}: ${biggest} < ${top??'∞ (empty)'}`});
      if(n>1){const smaller=block[n-2],aux=state[other][0];checks.push({ok:aux===undefined||smaller<aux,text:`Temporary rod ${RODS[other]}: ${smaller} < ${aux??'∞ (empty)'}`});}
    }
    return {ok:checks.every(c=>c.ok),checks};
  }
  function applyCall(node,state){const next=clone(state),block=next[node.from].splice(0,node.n);next[node.to].unshift(...block);return next;}
  function execute(tree,start,state,mode){
    if(!Number.isInteger(start)||start<1||start>tree.r)throw new Error(`Start at a command from 1 to ${tree.r}.`);
    let current=clone(state),failed=null;const events=[];
    function visit(node){
      if(failed||node.r<start)return;
      if(node.l<start){events.push({kind:'range',node,before:clone(current)});for(const c of node.children)visit(c);return;}
      const result=mode==='segment'?checkSummary(node.summary,current):checkCall(node,current);
      events.push({kind:'check',node,result,before:clone(current)});
      if(result.ok){
        const after=mode==='segment'?applySummary(node.summary,current):applyCall(node,current);
        events.push({kind:mode==='segment'&&!node.summary.count?'skip':'apply',node,before:clone(current),after:clone(after)});current=after;
      }else if(!node.children.length){failed=node.l;events.push({kind:'fail',node,result,before:clone(current)});}
      else{events.push({kind:'descend',node,result,before:clone(current)});for(const c of node.children)visit(c);}
    }
    visit(tree);return {events,state:current,failed};
  }
  function parse(text){
    const parts=text.trim().split(/[|;\n]+/).filter(s=>s.trim());
    if(parts.length!==3)throw new Error('Use X: … | Y: … | Z: …, with disks bottom to top.');
    const state=[null,null,null];
    for(const part of parts){
      const match=part.trim().match(/^([XYZ])\s*:\s*(.*)$/i);
      if(!match)throw new Error('Label each rod X, Y or Z.');
      const r=RODS.indexOf(match[1].toUpperCase());if(state[r])throw new Error('List each rod once.');
      const values=/^(?:-|—|empty)?$/i.test(match[2].trim())?[]:match[2].trim().split(/[ ,]+/).map(Number);
      if(values.some(n=>!Number.isInteger(n)||n<1||n>9))throw new Error('Use disk sizes 1–9; use - for an empty rod.');
      if(values.some((n,i)=>i&&n>=values[i-1]))throw new Error('List each rod bottom to top, largest to smallest.');
      state[r]=values.reverse();
    }
    const disks=state.flat();if(!disks.length||disks.length>9||new Set(disks).size!==disks.length)throw new Error('Use 1–9 disks with unique sizes.');
    return state;
  }
  const format=state=>state.map((rod,r)=>`${RODS[r]}: ${rod.slice().reverse().join(' ')||'-'}`).join(' | ');
  const BOOK_COMMANDS=[[2,1],[0,1],[0,2],[1,2],[0,1],[1,0],[2,1]].map(([from,to])=>({from,to}));
  return {RODS,clone,token,name,identity,merge,leafSummary,hanoi,segment,checkSummary,applySummary,checkCall,applyCall,execute,parse,format,BOOK_COMMANDS};
});
