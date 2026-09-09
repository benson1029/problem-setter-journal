(function(root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.PistonModel = model;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const key = p => `${p.row},${p.col}`;
  const clone = state => state.map(p => ({...p}));
  const occupancy = state => new Map(state.map(p => [key(p), p]));
  const PRESETS = [
    { name: 'A column of pistons', selected: 'p0', cells: [[2,4,'permanent'],[3,4,'temporary'],[4,4,'permanent'],[5,4,'temporary'],[7,4,'permanent']] },
    { name: 'Glue and a branching push', selected: 'p0', cells: [[5,2,'temporary'],[5,3,'permanent'],[4,3,'temporary'],[3,3,'permanent'],[3,4,'permanent'],[3,5,'temporary'],[6,3,'permanent'],[6,4,'temporary'],[4,2,'permanent'],[7,6,'permanent']] },
    { name: 'Room to experiment', selected: 'p0', cells: [[2,4,'permanent'],[3,4,'temporary'],[4,4,'permanent'],[5,4,'temporary'],[5,2,'temporary'],[5,3,'permanent'],[6,3,'temporary'],[6,4,'permanent'],[7,4,'temporary'],[3,7,'permanent'],[4,7,'temporary']] },
    { name: 'Beyond column 10', selected: 'p0', cells: [[4,9,'temporary'],[4,10,'permanent'],[3,10,'temporary'],[5,10,'permanent']] },
  ];
  const preset = i => PRESETS[i].cells.map(([row,col,type],j) => ({id:`p${j}`,row,col,type,active:false}));

  function plan(state, id) {
    const before = clone(state), cells = occupancy(before), base = before.find(p => p.id === id);
    if (!base || base.type === 'head' || base.active) throw new Error('Choose an inactive piston base.');
    const frames = [], moved = [];
    if (base.type === 'permanent') {
      let row = base.row + 1;
      while (cells.has(`${row},${base.col}`)) {
        const cell = {row,col:base.col};
        frames.push({kind:'scan',cell,occupied:true,visited:moved.map(key),stack:[]});
        moved.push(cells.get(key(cell))); row++;
      }
      frames.push({kind:'scan',cell:{row,col:base.col},occupied:false,visited:moved.map(key),stack:[]});
    } else {
      const seen = new Set(), stack = [];
      function dfs(cell, from = null) {
        const value = cells.get(key(cell));
        frames.push({kind:'probe',cell,from,occupied:!!value,seen:seen.has(key(cell)),visited:[...seen],stack:stack.map(p=>({...p}))});
        if (!value || seen.has(key(cell))) return;
        seen.add(key(cell)); moved.push(value); stack.push(cell);
        frames.push({kind:'visit',cell,visited:[...seen],stack:stack.map(p=>({...p}))});
        for (const [dr,dc] of [[-1,0],[1,0],[0,1]]) dfs({row:cell.row+dr,col:cell.col+dc}, cell);
        stack.pop();
        frames.push({kind:'backtrack',cell,visited:[...seen],stack:stack.map(p=>({...p}))});
      }
      dfs({row:base.row,col:base.col+1});
    }
    const ids = new Set(moved.map(p=>p.id));
    const extended = before.map(p => ({...p,
      row:p.row+(ids.has(p.id)&&base.type==='permanent'?1:0),
      col:p.col+(ids.has(p.id)&&base.type==='temporary'?1:0),
      active:p.id===base.id ? true : p.active,
    }));
    const head = {id:`head-${id}`,owner:id,type:'head',direction:base.type==='permanent'?'south':'east',row:base.row+(base.type==='permanent'?1:0),col:base.col+(base.type==='temporary'?1:0)};
    extended.push(head);
    frames.push({kind:'push',cell:base.type==='permanent'?frames.at(-1).cell:head,visited:moved.map(key),stack:[],state:extended});
    let after = extended;
    if (base.type === 'temporary') {
      frames.push({kind:'hold',cell:head,visited:[],stack:[]});
      after = extended.filter(p=>p.id!==head.id).map(p=>({...p,active:p.id===id?false:p.active}));
      frames.push({kind:'retract',cell:head,visited:[],stack:[],state:after});
    }
    return {base,before,extended,after,frames,moved:moved.map(p=>p.id),head};
  }
  return {key,clone,occupancy,PRESETS,preset,plan};
});
