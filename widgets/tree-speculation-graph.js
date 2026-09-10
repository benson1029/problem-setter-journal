(() => {
  'use strict';
  const ns = 'http://www.w3.org/2000/svg';
  function element(tag, attrs = {}, text) { const el = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); if(text !== undefined)el.textContent=text; return el; }
  window.TreeSpeculationGraph = function(host) {
    const svg=element('svg',{'aria-label':'Recovered partial tree',role:'img'}), edges=element('g'), nodes=element('g'); svg.append(edges,nodes); host.append(svg);
    let people=new Map(), lines=new Map(), scrollTimer;
    function render(t,state,reveal=false) {
      const recovered=new Set([0,...state.edges.flat()]), shown=reveal?new Set(t.labels.map((_,i)=>i)):recovered;
      const links=reveal?t.edges:state.edges, adjacency=Array.from({length:t.n},()=>[]);
      links.forEach(([u,v])=>{adjacency[u].push(v);adjacency[v].push(u);});
      const points=new Map(); let leaves=0,maxDepth=0;
      function layout(u,parent,depth) { const children=adjacency[u].filter(v=>v!==parent); children.forEach(v=>layout(v,u,depth+1)); const x=children.length?(points.get(children[0]).x+points.get(children.at(-1)).x)/2:50+leaves++*74; points.set(u,{x,y:40+depth*82});maxDepth=Math.max(depth,maxDepth); }
      layout(0,-1,0);
      const width=Math.max(560,leaves*74+30),height=Math.max(320,maxDepth*82+85),offset=(width-(leaves*74+26))/2;
      points.forEach(p=>p.x+=offset);
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=`${width}px`;svg.style.height=`${height}px`;
      for(const [id,el]of people)if(!shown.has(id)){el.remove();people.delete(id);}
      const knownEdges=new Set(state.edges.map(([u,v])=>[Math.min(u,v),Math.max(u,v)].join(':'))),wanted=new Set();
      for(const [u,v]of links){ const id=[Math.min(u,v),Math.max(u,v)].join(':');wanted.add(id);let line=lines.get(id);if(!line){line=element('path');edges.append(line);lines.set(id,line);}const a=points.get(u),b=points.get(v);line.setAttribute('d',`M${a.x},${a.y} C${a.x},${(a.y+b.y)/2} ${b.x},${(a.y+b.y)/2} ${b.x},${b.y}`);line.setAttribute('class',knownEdges.has(id)?'ts-edge':'ts-edge is-secret');}
      for(const[id,el]of lines)if(!wanted.has(id)){el.remove();lines.delete(id);}
      for(const u of shown){let group=people.get(u);if(!group){group=element('g',{'data-tree-vertex':u});group.append(element('circle',{r:13}),element('text',{y:31,'text-anchor':'middle'},t.labels[u]),element('title',{},t.labels[u]));nodes.append(group);people.set(u,group);}
        group.setAttribute('class',`ts-vertex${!recovered.has(u)?' is-secret':''}${state.closed.includes(u)?' is-closed':''}${state.stack.includes(u)?' on-stack':''}${state.active===u?' is-active':''}${state.query?.a.includes(u)?' in-a':''}${state.query?.b.includes(u)?' in-b':''}`);
        const p=points.get(u);group.style.transform=`translate(${p.x}px,${p.y}px)`;
      }
      clearTimeout(scrollTimer);
      scrollTimer=setTimeout(()=>{const group=people.get(state.active);if(!group)return;const r=group.getBoundingClientRect(),b=host.getBoundingClientRect();if(r.top<b.top+8)host.scrollTop+=r.top-b.top-30;else if(r.bottom>b.bottom-8)host.scrollTop+=r.bottom-b.bottom+30;if(r.left<b.left+8)host.scrollLeft+=r.left-b.left-30;else if(r.right>b.right-8)host.scrollLeft+=r.right-b.right+30;},220);
    }
    return{render,reset(){clearTimeout(scrollTimer);people.clear();lines.clear();edges.replaceChildren();nodes.replaceChildren();host.scrollTop=host.scrollLeft=0;},destroy(){clearTimeout(scrollTimer);svg.remove();}};
  };
})();
