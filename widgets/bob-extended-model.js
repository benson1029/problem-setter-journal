(function(scope){
  'use strict';
  const group=id=>Math.floor((id-1)/5), edge=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  const permutations=items=>items.length?items.flatMap((v,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[v,...rest])):[[]];
  function orders(g){const base=5*g;return permutations([1,2,4,5].map(v=>base+v)).map(p=>[p[0],p[1],base+3,p[2],p[3]]).filter(p=>p[0]<p[4]);}
  function create(total,order,hosts){
    if(!Number.isInteger(total)||total<10||total>30||order.length!==5||!orders(group(order[2])).some(p=>p.join()===order.join()||[...p].reverse().join()===order.join())||order.some(id=>id<1||id>total))throw Error('Use a complete group of five, with its third ID at the center.');
    const leaves=Array.from({length:total},(_,i)=>i+1).filter(id=>!order.includes(id)),neighbors=Array.from({length:total+1},()=>[]);
    const edges=order.slice(1).map((id,i)=>[order[i],id]);
    for(const id of leaves){if(!order.includes(hosts[id]))throw Error('Each non-chain ID needs a chain host.');edges.push([id,hosts[id]]);}
    for(const[a,b]of edges){neighbors[a].push(b);neighbors[b].push(a);}neighbors.forEach(list=>list.sort((a,b)=>a-b));
    return{total,order:[...order],hosts:{...hosts},edges,neighbors:id=>[...neighbors[id]]};
  }
  function generate(total=20,seed=73,scenario='random'){
    let s=seed>>>0;const random=n=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return Math.floor(s/4294967296*n);};
    // All complete groups are possible; the default seed uses a non-1..5 core.
    const g=random(Math.floor(total/5)),choices=orders(g),order=choices[random(choices.length)],hosts={};
    const leaves=Array.from({length:total},(_,i)=>i+1).filter(id=>!order.includes(id));
    for(const id of leaves)hosts[id]=order[random(5)];
    let start=1+random(total);
    if(scenario==='endpoint'){start=order[0];for(const id of leaves)if(hosts[id]===start)hosts[id]=order[1+random(4)];}
    if(scenario==='leaf'){start=leaves[random(leaves.length)];hosts[start]=order[2];}
    if(scenario==='center')start=order[2];
    return{...create(total,order,hosts),start,seed};
  }
  // Decoder accepts public K and complete local observations only. It has no
  // reference to Alice's order, leaf hosts or unvisited neighborhoods.
  function decode(total,observations){
    const candidates=[];
    for(let g=0;g<Math.floor(total/5);g++)for(const order of orders(g)){
      const options=new Map(Array.from({length:total},(_,i)=>i+1).filter(id=>!order.includes(id)).map(id=>[id,[...order]]));let valid=true;
      for(const {at,neighbors}of observations){
        const i=order.indexOf(at);
        if(i>=0){const expected=[order[i-1],order[i+1]].filter(Boolean),actual=neighbors.filter(id=>order.includes(id));
          if(expected.length!==actual.length||expected.some(id=>!actual.includes(id))){valid=false;break;}
          for(const[id,hosts]of options)options.set(id,hosts.filter(host=>neighbors.includes(id)?host===at:host!==at));
        }else{if(neighbors.length!==1||!order.includes(neighbors[0])){valid=false;break;}options.set(at,options.get(at).filter(host=>host===neighbors[0]));}
      }
      if(valid&&[...options.values()].every(list=>list.length))candidates.push({group:g,order,options});
    }
    if(!candidates.length)throw Error('The observations do not fit the agreed encoding.');
    const observed=new Set(observations.flatMap(({at,neighbors})=>neighbors.map(id=>edge(at,id))));
    let forced;
    for(const c of candidates){const edges=new Set(c.order.slice(1).map((id,i)=>edge(c.order[i],id)));for(const[id,hosts]of c.options)if(hosts.length===1)edges.add(edge(id,hosts[0]));forced=forced?new Set([...forced].filter(e=>edges.has(e))):edges;}
    const groups=[...new Set(candidates.map(c=>c.group))],g=groups.length===1?groups[0]:null;
    const slots=Array.from({length:5},(_,i)=>{const values=[...new Set(candidates.map(c=>c.order[i]))];return values.length===1?values[0]:null;});
    const roles={},attachments=[];
    for(let id=1;id<=total;id++){const count=candidates.filter(c=>c.order.includes(id)).length;roles[id]=count===candidates.length?'chain':count===0?'leaf':'unknown';
      if(roles[id]==='leaf'){const hosts=[...new Set(candidates.flatMap(c=>c.options.get(id)))].sort((a,b)=>a-b);attachments.push({id,hosts,host:hosts.length===1?hosts[0]:null});}}
    return{candidates,groups,group:g,slots,roles,attachments,observed:[...observed],edges:[...forced],inferred:[...forced].filter(e=>!observed.has(e)),solved:forced.size===total-1};
  }
  function location(observation){if(!observation)return{role:'unknown',note:'Look around to classify your location. No move is charged.'};const{at,neighbors}=observation;
    if(neighbors.length>1)return{role:'chain',note:`Degree ${neighbors.length} > 1: ${at} is on the chain. Its group is ${group(at)*5+1}–${group(at)*5+5}.`};
    const same=group(at)===group(neighbors[0]);return{role:same?'chain':'leaf',note:same?`One neighbor, same group of five: ${at} is a chain endpoint with no attached leaves.`:`One neighbor, different groups: ${at} is a leaf. Move to ${neighbors[0]} to enter the chain.`};
  }
  function nextMove(total,observations,path){
    const state=decode(total,observations);if(state.solved)return null;
    const current=path.at(-1),local=observations.find(o=>o.at===current);if(!local)return null;
    if(location(local).role==='leaf')return local.neighbors[0];
    const g=state.group,center=5*g+3,core=local.neighbors.filter(id=>group(id)===g),entryIndex=path.findIndex(id=>group(id)===g),entry=path[entryIndex],walk=path.slice(entryIndex);
    if(walk.length===1){return entry===center?Math.min(...core):core.includes(center)?center:core[0];}
    // Starting at the distinguished center needs a one-step U-turn, not an
    // excursion all the way to an endpoint (which would exceed five moves).
    if(entry===center&&walk.length===2)return center;
    const previous=path.at(-2);return core.find(id=>id!==previous&&!path.includes(id))??core.find(id=>id!==previous)??core[0];
  }
  function route(tree,start=tree.start){const path=[start],observations=[{at:start,neighbors:tree.neighbors(start)}];
    while(!decode(tree.total,observations).solved&&path.length<=5){const next=nextMove(tree.total,observations,path);if(!tree.neighbors(path.at(-1)).includes(next))throw Error('Invalid strategy move');path.push(next);if(!observations.some(o=>o.at===next))observations.push({at:next,neighbors:tree.neighbors(next)});}
    if(!decode(tree.total,observations).solved)throw Error('Five-move strategy failed');return path;
  }
  const api={group,edge,orders,create,generate,decode,location,nextMove,route};if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.BobExtended=api;
})(typeof window==='undefined'?globalThis:window);
