/* Rounded dice surfaces, shared across renders. Projection changes apparent
   face sizes; all six physical faces retain the same dimensions. */
const DICE_SURFACES = [
  [[0,0,1],[1,0,0],[0,1,0]], [[0,0,-1],[-1,0,0],[0,1,0]],
  [[1,0,0],[0,0,-1],[0,1,0]], [[-1,0,0],[0,0,1],[0,1,0]],
  [[0,-1,0],[1,0,0],[0,0,1]], [[0,1,0],[1,0,0],[0,0,-1]]
];
const dicePoint = (basis, x, y, depth = .5) => basis[0].map((n,i) => n*depth+basis[1][i]*x+basis[2][i]*y);
const DICE_MESH = (() => {
  const steps = [-.5,-.495,-.48,-.455,-.42,-.36,.36,.42,.455,.48,.495,.5];
  const rounded = p => {
    const core=p.map(v=>Math.max(-.36,Math.min(.36,v)));
    const delta=p.map((v,i)=>v-core[i]);
    const length=Math.hypot(...delta);
    const normal=delta.map(v=>v/length);
    return {p:core.map((v,i)=>v+.14*normal[i]),n:normal};
  };
  const mesh=[];
  for (const basis of DICE_SURFACES) {
    for(let x=0;x<steps.length-1;x++) for(let y=0;y<steps.length-1;y++) {
      const vertices=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([a,b])=>rounded(dicePoint(basis,steps[a],steps[b])));
      const n=[0,1,2].map(i=>vertices.reduce((sum,v)=>sum+v.n[i],0)/4);
      const length=Math.hypot(...n);
      mesh.push({points:vertices.map(v=>v.p),normal:n.map(v=>v/length)});
    }
  }
  return mesh;
})();
function drawRoundedDie(cube, matrix) {
  const canvas=cube.closest('.die-lift').querySelector('canvas');
  const size=cube.clientWidth;
  const extent=size*2;
  const ratio=Math.min(window.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(extent*ratio)) {
    canvas.width=Math.round(extent*ratio); canvas.height=canvas.width;
  }
  const ctx=canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,extent,extent);
  const rotate=p=>[
    matrix.m11*p[0]+matrix.m21*p[1]+matrix.m31*p[2],
    matrix.m12*p[0]+matrix.m22*p[1]+matrix.m32*p[2],
    matrix.m13*p[0]+matrix.m23*p[1]+matrix.m33*p[2]
  ];
  const project=p=>[size+p[0]*size,size+p[1]*size];
  const patches=[];
  for(const facet of DICE_MESH) {
    const n=rotate(facet.normal);
    if(n[2]<=0) continue;
    const points=facet.points.map(rotate);
    const diffuse=Math.max(0,.45*n[0]-.5*n[1]+.74*n[2]);
    const sheen=Math.pow(Math.max(0,.20*n[0]-.35*n[1]+.915*n[2]),18)*.07;
    const light=Math.min(1,.74+.28*diffuse+sheen);
    const c=Math.round(light*255);
    patches.push({points,z:points.reduce((s,p)=>s+p[2],0)/4,color:`rgb(${c},${c},${Math.round(c*.985)})`});
  }
  DICE_SURFACES.forEach((basis,index)=>{
    const n=rotate(basis[0]);
    if(n[2]<=0) return;
    for(const pip of PIPS[FACES[index].v]) {
      const x=(pip%3-1)*.235, y=(Math.floor(pip/3)-1)*.235;
      const points=Array.from({length:24},(_,i)=>{
        const a=i*Math.PI/12;
        return rotate(dicePoint(basis,x+Math.cos(a)*.067,y+Math.sin(a)*.067,.502));
      });
      patches.push({points,z:points.reduce((s,p)=>s+p[2],0)/points.length,color:'#202326',pip:true});
    }
  });
  // Visible pips lie entirely inside the flat area of a convex face, so draw
  // them after the shell rather than sorting their centers against large faces.
  patches.sort((a,b)=>Number(!!a.pip)-Number(!!b.pip)||a.z-b.z);
  for(const patch of patches) {
    ctx.beginPath();
    patch.points.forEach((p,i)=>{const q=project(p); i?ctx.lineTo(...q):ctx.moveTo(...q);});
    ctx.closePath(); ctx.fillStyle=patch.color; ctx.fill();
    if(!patch.pip) { ctx.strokeStyle=patch.color; ctx.lineWidth=.45; ctx.stroke(); }
  }
}
