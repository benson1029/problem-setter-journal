(function(scope){
  'use strict';
  const pair=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  function network(n=6,seed=1,book=false){
    if(!Number.isInteger(n)||n<4||n>12||n%2)throw Error('Each ring needs an even number of stations, from 4 to 12.');
    const size=2*n-1,edges=[],adj=Array.from({length:size},()=>[]);
    for(let ring=0;ring<2;ring++){const cycle=[0,...Array.from({length:n-1},(_,i)=>ring*(n-1)+i+1)];for(let i=0;i<n;i++){const a=cycle[i],b=cycle[(i+1)%n];edges.push([a,b]);adj[a].push(b);adj[b].push(a);}}
    const distances=adj.map((_,start)=>{const d=Array(size).fill(Infinity);d[start]=0;const queue=[start];for(const u of queue)for(const v of adj[u])if(!Number.isFinite(d[v])){d[v]=d[u]+1;queue.push(v);}return d;});
    const labels=Array.from({length:size},(_,i)=>i+1);let s=seed>>>0;
    for(let i=size-1;i>0;i--){s=(Math.imul(s,1664525)+1013904223)>>>0;const j=s%(i+1);[labels[i],labels[j]]=[labels[j],labels[i]];}
    if(book&&n===6)labels.splice(0,size,5,3,1,8,10,7,6,2,9,4,11);
    const slot=id=>labels.indexOf(id),distance=(a,b)=>distances[slot(a)][slot(b)];
    return{n,size,edges,adj,distances,labels,slot,distance};
  }
  function orient(n,slot,mask){
    if(slot===0)return 0;
    // Bits 0 and 1 reverse the rings as currently drawn (green and purple).
    // Bit 2 swaps the two drawings, giving the other four automorphisms.
    const sourceRing=slot<n?0:1,ring=sourceRing^((mask>>2)&1),t=slot-sourceRing*(n-1);
    return ring*(n-1)+(mask&(1<<ring)?n-t:t);
  }
  function equivalent(net,board){
    if(board.length!==net.size||board.some(id=>!Number.isInteger(id)||id<1||id>net.size)||new Set(board).size!==net.size)return false;
    const expected=new Set(net.edges.map(([a,b])=>pair(net.labels[a],net.labels[b])));
    return net.edges.every(([a,b])=>expected.has(pair(board[a],board[b])));
  }
  function domains(net,board,queries){
    const free=board.flatMap((id,slot)=>id===null?[slot]:[]),placed=new Map(board.flatMap((id,slot)=>id===null?[]:[[id,slot]]));
    const result=new Map();
    for(let id=1;id<=net.size;id++)if(!placed.has(id))result.set(id,free.filter(slot=>queries.every(q=>{
      const other=q.a===id?q.b:q.b===id?q.a:null;
      return other===null||!placed.has(other)||net.distances[slot][placed.get(other)]===q.d;
    })));
    // Equal candidate sets filling all of their slots exclude those slots
    // elsewhere. This exposes the book's 1/1/2 and 1/1 deductions without an
    // extra query to the final member of each distance layer.
    let changed=true;
    while(changed){changed=false;const groups=new Map();for(const[id,slots]of result){const key=slots.join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);}
      for(const[key,ids]of groups){const slots=key?key.split(',').map(Number):[];if(!slots.length||ids.length!==slots.length)continue;
        for(const[id,options]of result)if(!ids.includes(id)){const filtered=options.filter(s=>!slots.includes(s));if(filtered.length!==options.length){result.set(id,filtered);changed=true;}}
      }
    }
    return result;
  }
  function lesson(net,kind='full',anchor=net.labels[1]){
    const {n,size}=net,h=n/2,ids=Array.from({length:size},(_,i)=>i+1),events=[],cache=new Map();
    const s={board:Array(size).fill(null),queries:[],edges:[],profile:[],domains:[],query:null,phase:'Start',center:null,anchor,reference:null,candidates:[],case:null,done:false};
    const emit=(type,note)=>events.push({...s,board:[...s.board],queries:s.queries.map(q=>({...q})),edges:s.edges.map(e=>[...e]),profile:s.profile.map(e=>[...e]),domains:s.domains.map(([id,slots])=>[id,[...slots]]),candidates:[...s.candidates],query:s.query&&{...s.query},type,note});
    function ask(a,b,note){if(a===b)return 0;const key=pair(a,b);if(cache.has(key))return cache.get(key);
      s.query={a,b,d:null};emit('ask',note||`Query the shortest distance from ${a} to ${b}.`);
      const d=net.distance(a,b);cache.set(key,d);s.queries.push({a,b,d});s.query={a,b,d};emit('answer',`d(${a}, ${b}) = ${d}.`);return d;
    }
    function put(id,slot,note){if(s.board[slot]===id)return;if(s.board.includes(id)||s.board[slot]!==null)throw Error('Inconsistent placement');s.board[slot]=id;emit('place',note);}
    function deduce(){let changed=true;while(changed){changed=false;const d=domains(net,s.board,s.queries);s.domains=[...d];if([...d.values()].some(v=>!v.length))throw Error('Contradictory distance clues');const forced=[...d].find(([,slots])=>slots.length===1);if(forced){put(forced[0],forced[1][0],`Only one position remains for ${forced[0]}. Place it using the known distances and occupied positions.`);changed=true;}}}
    function scan(a,note){s.phase=note;emit('phase',note);const result=new Map([[a,0]]);s.profile=[[a,0]];for(const id of ids)if(id!==a){result.set(id,ask(a,id));s.profile=[...result];emit('profile',`Distance from ${a}: ${result.size}/${size} stations measured.`);}return result;}
    function findCenter(){const d=scan(anchor,'Scan from the anchor'),max=Math.max(...d.values());s.case=max===h?'center':max===n?'opposite':'ordinary';
      if(max===h){s.center=anchor;put(anchor,0,`All distances are at most ${h} = N/2: anchor ${anchor} is the center.`);return{d,max};}
      const far=[...d].find(([,distance])=>distance===max)[0],radius=max-h;
      s.candidates=ids.filter(id=>d.get(id)===radius);emit('infer',`The furthest station is ${far}, at distance ${max}. The center is ${max} − ${h} = ${radius} from the anchor: ${s.candidates.join(' or ')}.`);
      for(const candidate of s.candidates)if(s.candidates.length===1||ask(far,candidate,'Test a center candidate against the unique furthest station.')===h){s.center=candidate;break;}
      put(s.center,0,`${s.center} is the center. Its distance to the furthest station is N/2 = ${h}.`);s.candidates=[];return{d,max,far,radius};
    }
    emit('start',kind==='center'||kind==='full'?'The map is unlabeled. Distances will reveal station positions.':'This lesson begins after the center is known; the counter measures queries made from this starting point.');
    if(kind==='center'||kind==='full'){
      const {d,far,radius}=findCenter();if(kind==='center'){s.done=true;emit('done',`Center recovered: ${s.center}. ${s.queries.length} distinct queries; the rest of the map stays unknown.`);return{events};}
      if(s.case==='ordinary'){
        s.phase='Two asymmetric anchors';put(anchor,radius,`Choose a drawing orientation: put anchor ${anchor} on the green upper arm, ${radius} steps from the center.`);put(far,n-1+h,'The unique furthest station is the purple antipode.');
        const candidates=ids.filter(id=>d.get(id)===Math.max(...d.values())-1);let reference;
        for(const id of candidates)if(ask(far,id,'Check that this second-largest distance station really neighbors the furthest station.')===1){reference=id;break;}
        s.reference=reference;put(reference,n-1+h-1,'Choose the purple orientation so this verified neighbor is on the upper arm.');
        scan(reference,'Scan from the verified second-furthest station');deduce();
        // A center-adjacent pair may share the same two-anchor signature.
        // A distance to the opposite-ring antipode breaks this constant case.
        while(s.board.includes(null)){const [id]=s.domains[0];ask(far,id,'Break the remaining center-adjacent signature tie using the antipode.');const before=s.board.filter(Boolean).length;deduce();if(s.board.filter(Boolean).length===before)throw Error('Unresolved ordinary-anchor case');}
      }else if(s.case==='opposite'){
        s.phase='Solve rings separately';put(anchor,h,'The anchor is an antipode. Choose it as the green outer station.');put(far,n-1+h,'The farthest station is the purple antipode.');
        for(const ring of [0,1]){
          const members=ids.filter(id=>ring===0?d.get(id)<h:d.get(id)>h),near=members.find(id=>d.get(id)===(ring===0?1:n-1));s.reference=near;
          put(near,ring*(n-1)+h-1,`Choose the ${ring===0?'green':'purple'} orientation using station ${near}, next to its antipode.`);
          s.phase=ring===0?'Green ring distances':'Purple ring distances';emit('phase','Query only members of this ring; the first scan already identified ring membership.');
          for(const id of members)ask(near,id);deduce();
        }
      }else{
        s.phase='Center anchor: grouped deductions';
        const antipodes=ids.filter(id=>d.get(id)===h),farLeft=antipodes[0];put(farLeft,h,'Choose one of the two antipodes as the green outer station.');put(antipodes[1],n-1+h,'The other antipode belongs to the purple ring.');
        let g;for(const id of ids.filter(id=>d.get(id)===h-1))if(ask(farLeft,id,'Find a station next to the green antipode.')===1){g=id;break;}
        s.reference=g;put(g,h-1,'Choose this verified neighbor as the green upper-arm reference.');deduce();
        for(let depth=1;depth<h;depth++){
          s.phase=`Distance layer ${depth}: 1 / 1 / 2`;const group=ids.filter(id=>d.get(id)===depth);let queried=0;
          for(const id of group){if(queried>=3)break;if(s.board.includes(id))continue;ask(g,id,'Classify this layer using the green reference. Infer the final category by elimination.');queried++;deduce();}
          if(depth===1){while(s.board[n-1]===null){const candidate=s.domains.find(([,slots])=>slots.includes(n-1));if(!candidate)throw Error('Missing near-center candidate');ask(farLeft,candidate[0],'At distance 1, two categories tie. Use the antipode to separate the green neighbor from the purple pair.');deduce();}}
        }
        const rightNear=ids.find(id=>!s.board.includes(id)&&d.get(id)===h-1);
        if(rightNear!==undefined){s.reference=rightNear;put(rightNear,n-1+h-1,'Choose the orientation of the remaining purple ring.');deduce();
          for(let depth=1;depth<h;depth++){const unresolved=ids.filter(id=>!s.board.includes(id)&&d.get(id)===depth);if(unresolved.length){s.phase=`Purple pair at distance ${depth}`;ask(rightNear,unresolved[0],'One query distinguishes this pair; infer the other station.');deduce();}}
        }
      }
    }else{
      s.center=net.labels[0];s.anchor=s.center;put(s.center,0,'The center is given for this strategy lesson.');const d=scan(s.center,'Group stations by distance from the center'),groups=Array.from({length:h+1},(_,depth)=>ids.filter(id=>d.get(id)===depth));
      if(kind==='layers'){
        s.phase='Match consecutive distance layers';for(const id of groups[1]){s.edges.push([s.center,id]);emit('edge',`${id} is one step from the center, so its edge is already known.`);}
        for(let depth=1;depth<h;depth++){
          const capacity=new Map(groups[depth+1].map(id=>[id,depth+1===h?2:1]));
          for(const u of groups[depth]){const options=[...capacity].filter(([,count])=>count>0).map(([id])=>id);
            for(let i=0;i<options.length;i++){const v=options[i];s.candidates=[u,v];if(i===options.length-1||ask(u,v,`Match distance ${depth} to ${depth+1}. Distance 1 means an edge.`)===1){s.edges.push([u,v]);capacity.set(v,capacity.get(v)-1);emit('edge',i===options.length-1?`Infer ${u}—${v}: it is the last available match.`:`Recover edge ${u}—${v}.`);break;}}
          }
        }
        const adjacency=new Map(ids.map(id=>[id,[]]));for(const[u,v]of s.edges){adjacency.get(u).push(v);adjacency.get(v).push(u);}
        const used=new Set([s.center]);for(const ring of [0,1]){let previous=s.center,current=adjacency.get(s.center).find(id=>!used.has(id));for(let step=1;step<n;step++){put(current,ring*(n-1)+step,'Walk the recovered cycle to draw this station on the map.');used.add(current);const next=adjacency.get(current).find(id=>id!==previous);previous=current;current=next;}}
        s.candidates=[];
      }else if(kind==='arms'){
        const antipodes=groups[h];put(antipodes[0],h,'Choose the green antipode.');put(antipodes[1],n-1+h,'The second antipode belongs to the purple ring.');
        s.phase='Identify the four arms';
        for(const id of groups[1]){if(s.board.includes(id))continue;ask(antipodes[0],id,'Identify which ring this center neighbor belongs to.');deduce();const options=s.domains.find(([u])=>u===id)?.[1];if(options?.length===2){put(id,options[0],'Choose an orientation within this ring; reversing it represents the same map.');deduce();}}
        const neighbors=[s.board[1],s.board[n-1],s.board[n],s.board[2*n-2]];
        for(let depth=2;depth<h;depth++)for(const id of groups[depth]){s.phase=`Classify distance-${depth} stations`;for(const neighbor of neighbors.slice(0,3)){if(s.board.includes(id))break;ask(neighbor,id,`An arm's own neighbor is ${depth-1} away; the other neighbors are ${depth+1} away.`);deduce();}}
      }else throw Error('Unknown strategy');
    }
    if(!equivalent(net,s.board))throw Error(`Recovery failed: ${kind}/${s.case}/N=${n}`);
    s.done=true;s.query=null;s.domains=[];emit('done',`Map recovered in ${s.queries.length} distinct queries. Reversing either ring leaves exactly the same connections.`);
    return{events};
  }
  const api={network,orient,equivalent,domains,lesson};if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.InfinityModel=api;
})(typeof window==='undefined'?globalThis:window);
