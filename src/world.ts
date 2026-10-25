import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PrepState } from './preparation';

const C = { green:'#348451', dark:'#235b3d', lime:'#b9cf58', cream:'#fff3d3', wood:'#d69b60', yellow:'#f6c74d', terracotta:'#da8068', coral:'#edaa94', mint:'#a9ceba', sand:'#e9d3ab' };
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color:string, roughness=.78, metalness=0) { const key=color+roughness+metalness; if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness})); return materialCache.get(key)!; }
function mesh(g:THREE.BufferGeometry,m:THREE.Material|THREE.Material[],p:THREE.Object3D,x=0,y=0,z=0) {const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
function box(p:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,c:string,r=.055) {return mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.24,h*.24,d*.24)),mat(c),p,x,y,z);}
function ball(p:THREE.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,c:string,segments=16) {const o=mesh(new THREE.SphereGeometry(1,segments,12),mat(c),p,x,y,z);o.scale.set(sx,sy,sz);return o;}
function cyl(p:THREE.Object3D,x:number,y:number,z:number,rt:number,rb:number,h:number,c:string,n=20) {return mesh(new THREE.CylinderGeometry(rt,rb,h,n),mat(c),p,x,y,z);}
function line(p:THREE.Object3D,points:THREE.Vector3[],radius:number,c:string) {return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(8,points.length*5),radius,6,false),mat(c),p);}
function bar(p:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,c:string) {const o=cyl(p,0,0,0,r,r,a.distanceTo(b),c,10);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o;}
function leaf(p:THREE.Object3D,x:number,y:number,z:number,size:number,color:string,rz=0,rx=0) {const o=ball(p,x,y,z,size*.25,size,size*.055,color,10);o.rotation.set(rx,0,rz);return o;}
function canvasTexture(w:number,h:number,draw:(ctx:CanvasRenderingContext2D)=>void) {const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')!;draw(ctx);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function label(p:THREE.Object3D,text:string,w:number,h:number,x:number,y:number,z:number,fg=C.dark,bg=C.cream,font=90) {const t=canvasTexture(768,256,c=>{c.fillStyle=bg;c.fillRect(0,0,768,256);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`900 ${font}px Arial, sans-serif`;c.fillText(text,384,137,710);});return mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.9}),p,x,y,z);}
function topOutline(p:THREE.Object3D,w:number,d:number,color:string,thickness=.012) {
  const x=w*.5,z=d*.5,r=Math.min(.055,w*.15,d*.15);
  const points=[[-x+r,-z],[x-r,-z],[x,-z+r],[x,z-r],[x-r,z],[-x+r,z],[-x,z-r],[-x,-z+r],[-x+r,-z]].map(([xx,zz])=>new THREE.Vector3(xx,0,zz));
  const o=line(p,points,thickness,color);o.material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false});o.castShadow=false;o.receiveShadow=false;return o;
}
function seeded(i:number) {return (Math.sin(i*127.1+311.7)*43758.5453)%1;}
function rand(i:number) {return Math.abs(seeded(i));}
let skinTexture:THREE.CanvasTexture|undefined;
const fruitMaterials=new Map<string,THREE.MeshStandardMaterial>();
function fruitSurface(material:THREE.MeshStandardMaterial,id:string) {
  if(!skinTexture){skinTexture=canvasTexture(128,128,c=>{c.fillStyle='#999';c.fillRect(0,0,128,128);for(let i=0;i<1800;i++){const v=110+Math.floor(rand(i+875)*75);c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(rand(i+31)*128,rand(i+72)*128,.7+rand(i)*1.4,.7+rand(i)*1.4);}});skinTexture.wrapS=skinTexture.wrapT=THREE.RepeatWrapping;}
  const key=material.uuid+id;if(!fruitMaterials.has(key)){const m=material.clone();m.bumpMap=skinTexture;m.bumpScale=id==='avocado'?.009:.003;m.roughness=id==='avocado'?.9:id==='orange'?.67:.57;fruitMaterials.set(key,m);}return fruitMaterials.get(key)!;
}
function compactDecoration(g:THREE.Group) {
  g.updateWorldMatrix(true,true);const inverse=g.matrixWorld.clone().invert();
  const buckets=new Map<string,{m:THREE.Material,geo:THREE.BufferGeometry[],old:THREE.Mesh[]}>();
  g.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;let geo=o.geometry.clone();if(geo.index)geo=geo.toNonIndexed();geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));const key=o.material.uuid+Object.keys(geo.attributes).sort().join(',');if(!buckets.has(key))buckets.set(key,{m:o.material,geo:[],old:[]});const b=buckets.get(key)!;b.geo.push(geo);b.old.push(o);});
  for(const b of buckets.values()){const geo=mergeGeometries(b.geo,false);if(geo){for(const o of b.old)o.removeFromParent();mesh(geo,b.m,g);}b.geo.forEach(v=>v.dispose());}
}

export function createFruit(id:string,size=.2):THREE.Group {
  const g=new THREE.Group();g.name=`fruit-${id}`;
  const stem=(y:number)=>{cyl(g,0,y,0,size*.055,size*.07,size*.2,'#7f6940',8);leaf(g,size*.12,y+size*.01,0,size*.25,'#49934b',-.9,.4);};
  if(id==='watermelon') {
    const skin=mesh(new THREE.SphereGeometry(size,24,16,0,Math.PI),mat('#377c44'),g);skin.rotation.x=-Math.PI/2;skin.scale.set(1,.5,1);
    const red=mesh(new THREE.CircleGeometry(size*.94,32),mat('#f26c70'),g,0,0,size*.01);red.rotation.x=-Math.PI/2;red.position.y=.005;
    for(let i=0;i<8;i++){const a=i*2.4,r=size*(.28+.5*rand(i));const s=ball(g,Math.cos(a)*r,.015,Math.sin(a)*r,size*.026,size*.015,size*.052,'#55483a',8);s.rotation.y=a;}
    g.rotation.x=.55;
  } else if(id==='pineapple') {
    ball(g,0,0,0,size*.69,size,size*.69,'#e8b43d');
    for(let j=0;j<5;j++)for(let i=0;i<7;i++){const a=i*Math.PI*2/7+(j%2)*.42,y=(j-2)*size*.32,r=size*.66*Math.sqrt(1-(y/size)**2);const s=ball(g,Math.cos(a)*r,y,Math.sin(a)*r,size*.11,size*.12,size*.065,j%2?'#f4ce5a':'#c9942f',8);s.rotation.y=-a;}
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const l=leaf(g,Math.sin(a)*size*.19,size*1.18,Math.cos(a)*size*.19,size*.66,i%2?'#518e50':'#377748',Math.sin(a)*.55,Math.cos(a)*.55);l.rotation.y=a;}
  } else if(id==='banana') {
    for(let i=0;i<3;i++){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-size*.7,-size*.2,(i-1)*size*.26),new THREE.Vector3(-size*.2,-size*.7,(i-1)*size*.32),new THREE.Vector3(size*.55,-size*.5,(i-1)*size*.27),new THREE.Vector3(size*.9,size*.15,(i-1)*size*.22)]);mesh(new THREE.TubeGeometry(curve,12,size*.2,8,false),mat(i===1?'#f8d955':'#eac447'),g);ball(g,size*.9,size*.16,(i-1)*size*.22,size*.08,size*.11,size*.08,'#80633b',8);}
    box(g,-size*.7,-size*.07,0,size*.19,size*.28,size*.7,'#746644',.03);g.rotation.z=-.2;
  } else if(id==='strawberry') {
    const o=ball(g,0,0,0,size*.73,size,size*.73,'#eb6464');o.rotation.z=Math.PI;
    for(let j=0;j<4;j++)for(let i=0;i<6;i++){const y=(j-1.5)*size*.34,a=i*Math.PI/3+j*.4,r=size*.67*Math.sqrt(1-(y/(size*1.15))**2);ball(g,Math.cos(a)*r,y,Math.sin(a)*r,size*.035,size*.065,size*.035,'#f8dba0',6);}
    for(let i=0;i<5;i++){const a=i*1.256;leaf(g,Math.cos(a)*size*.25,size*.83,Math.sin(a)*size*.25,size*.42,'#39804b',Math.sin(a)*1.1,Math.cos(a)*1.1);}
  } else if(id==='dragonfruit') {
    ball(g,0,0,0,size*.78,size,size*.75,'#ec6490');for(let i=0;i<10;i++){const a=i*2.4,y=(rand(i+60)-.5)*size*1.4;const l=leaf(g,Math.cos(a)*size*.65,y,Math.sin(a)*size*.65,size*.33,i%2?'#b8c95b':'#df88a3',-.9,0);l.rotation.y=-a;}
    stem(size*.95);
  } else if(id==='avocado') {
    const shape=new THREE.Shape();shape.moveTo(0,-size);shape.bezierCurveTo(-size*1.1,-size,-size*.8,size*.2,-size*.38,size*.76);shape.bezierCurveTo(-size*.2,size*1.2,size*.24,size*1.2,size*.4,size*.72);shape.bezierCurveTo(size*.86,size*.03,size*.95,-size,0,-size);
    const o=mesh(new THREE.ExtrudeGeometry(shape,{depth:size*.6,bevelEnabled:true,bevelSize:size*.13,bevelThickness:size*.14,bevelSegments:3,steps:1}),mat('#467343'),g,0,0,-size*.3);o.rotation.z=-.18;
    const flesh=ball(g,0,-size*.12,size*.43,size*.58,size*.8,size*.06,'#d7df7e');flesh.rotation.z=-.18;ball(g,0,-size*.36,size*.49,size*.29,size*.31,size*.15,'#a47849');
  } else if(id==='guava') {ball(g,0,0,0,size,size*.93,size*.9,'#b8c96d');ball(g,0,0,size*.72,size*.82,size*.79,size*.11,'#fae2bd');ball(g,0,0,size*.82,size*.69,size*.68,size*.06,'#eda29a');for(let i=0;i<12;i++){const a=i*2.4,r=size*(.18+rand(i)*.32);ball(g,Math.cos(a)*r,Math.sin(a)*r,size*.88,size*.025,size*.04,size*.015,'#ead2a1',6);}stem(size*.9);}
  else if(id==='mango') {const o=ball(g,0,0,0,size*.77,size,size*.6,'#fac252');o.rotation.z=-.37;ball(g,size*.3,-size*.3,size*.12,size*.49,size*.62,size*.51,'#ffb74c');stem(size*.85);}
  else {ball(g,0,0,0,size,size*.95,size,'#ef9e3d');for(let i=0;i<8;i++){const a=i*2.4;ball(g,Math.cos(a)*size*.85,(rand(i+23)-.5)*size,Math.sin(a)*size*.85,size*.025,size*.025,size*.025,'#e58d35',5);}stem(size*.94);}
  g.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial)o.material=fruitSurface(o.material,id);});compactDecoration(g);return g;
}

function cutFruit(id:string,size:number,color:string,withSeed=false) {
  const g=new THREE.Group();g.name=`fresh-cut-${id}`;
  const juicy=(c:string)=>mat(c,.27,.015);
  const organic=(c:string,depth:number,scale=1)=>{const s=new THREE.Shape();s.moveTo(-.65*size,-.38*size);s.bezierCurveTo(-.83*size,.12*size,-.33*size,.7*size,.34*size,.56*size);s.bezierCurveTo(.79*size,.36*size,.74*size,-.32*size,.17*size,-.49*size);s.bezierCurveTo(-.1*size,-.6*size,-.48*size,-.54*size,-.65*size,-.38*size);const o=mesh(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:size*.055,bevelSize:size*.065,bevelSegments:2,steps:1}),juicy(c),g,0,-depth*.5,0);o.rotation.x=-Math.PI/2;o.scale.setScalar(scale);return o;};
  const curvedWedge=(flesh:string,rind:string)=>{
    const start=-.96,arc=1.92,r=size*.82,h=size*.37;
    mesh(new THREE.CylinderGeometry(r*.92,r*.92,h,14,1,false,start,arc),juicy(flesh),g);
    const peel=mesh(new THREE.CylinderGeometry(r,r,h*1.12,14,1,true,start,arc),mat(rind,.65),g);(peel.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
    for(const a of [start,start+arc])line(g,[new THREE.Vector3(0,h*.51,0),new THREE.Vector3(Math.sin(a)*r*.94,h*.51,Math.cos(a)*r*.94)],size*.018,'#fff0bf');
    const points:THREE.Vector3[]=[];for(let i=0;i<=15;i++){const a=start+arc*i/15;points.push(new THREE.Vector3(Math.sin(a)*r*.93,h*.515,Math.cos(a)*r*.93));}line(g,points,size*.022,'#fff0bf');
    return {r,h,start,arc};
  };
  if(id==='orange') {
    const {r,h,start,arc}=curvedWedge('#ffbb59','#ec9b39');
    for(let row=0;row<3;row++)for(let i=0;i<5;i++){const a=start+.2+(arc-.4)*i/4,rr=r*(.27+row*.22);const cell=ball(g,Math.sin(a)*rr,h*.54,Math.cos(a)*rr,size*.057,size*.018,size*.088,row%2?'#ffc86b':'#ffd17b',8);cell.rotation.y=a;cell.material=juicy(row%2?'#ffc86b':'#ffd17b');}
    for(let i=1;i<4;i++){const a=start+arc*i/4;line(g,[new THREE.Vector3(Math.sin(a)*r*.08,h*.555,Math.cos(a)*r*.08),new THREE.Vector3(Math.sin(a)*r*.85,h*.555,Math.cos(a)*r*.85)],size*.008,'#ffe8ac');}
    g.position.z=-size*.25;
  } else if(id==='mango') {
    const skin=organic('#e8a440',size*.04,1.015);skin.position.y=-size*.15;organic('#ffc552',size*.25);
    line(g,[new THREE.Vector3(-size*.45,size*.19,-size*.1),new THREE.Vector3(0,size*.205,size*.06),new THREE.Vector3(size*.42,size*.19,size*.16)],size*.014,'#ffdc81');
  } else if(id==='watermelon') {
    const triangle=new THREE.Shape();triangle.moveTo(-size*.63,-size*.28);triangle.lineTo(size*.63,-size*.28);triangle.lineTo(size*.06,size*.66);triangle.closePath();
    mesh(new THREE.ExtrudeGeometry(triangle,{depth:size*.31,bevelEnabled:true,bevelSize:size*.022,bevelThickness:size*.025,bevelSegments:1,steps:1}),juicy('#f17883'),g,0,0,-size*.155);
    box(g,0,-size*.31,0,size*1.29,size*.13,size*.37,'#669a53',size*.025);box(g,0,-size*.23,0,size*1.23,size*.055,size*.34,'#e1e7a8',size*.012);
    for(const side of [-1,1])for(let i=0;i<5;i++){const xx=(i%3-1)*size*.24,yy=(i<3?0:.25)*size;const seed=ball(g,xx,yy,side*size*.181,size*.027,size*.055,size*.01,'#67513d',7);seed.rotation.z=(i-2)*.4;}
  } else if(id==='banana') {
    const disc=cyl(g,0,0,0,size*.56,size*.59,size*.27,'#f7e5b3',20);disc.material=juicy('#f7e5b3');
    const rim=mesh(new THREE.TorusGeometry(size*.535,size*.018,5,24),mat('#e2cc8c',.5),g,0,size*.141,0);rim.rotation.x=Math.PI/2;
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;ball(g,Math.cos(a)*size*.12,size*.145,Math.sin(a)*size*.12,size*.032,size*.009,size*.043,'#bfa477',7);}
    ball(g,0,size*.15,0,size*.04,size*.008,size*.04,'#ddc390',7);
  } else if(id==='avocado') {
    const shell=ball(g,0,-size*.08,0,size*.54,size*.26,size*.79,'#65864b',16);shell.rotation.y=-.18;
    const flesh=ball(g,0,size*.06,0,size*.49,size*.16,size*.73,'#d6df8e',16);flesh.rotation.y=-.18;flesh.material=juicy('#d6df8e');
    ball(g,0,size*.175,-size*.11,size*.24,size*.022,size*.29,'#b9c779',12);
    if(withSeed){const seed=ball(g,0,size*.26,-size*.11,size*.215,size*.18,size*.23,'#a67a4a',14);seed.material=mat('#a67a4a',.52);ball(g,-size*.065,size*.35,-size*.15,size*.055,size*.02,size*.07,'#c69d65',8);}
    else {ball(g,0,size*.185,-size*.11,size*.15,size*.01,size*.2,'#dce5a1',12);}
  } else if(id==='guava') {
    const {r,h}=curvedWedge('#f0b1a7','#b5c976');
    for(let i=0;i<8;i++){const a=(i-3.5)*.19,rr=r*(.45+rand(i)*.3);ball(g,Math.sin(a)*rr,h*.55,Math.cos(a)*rr,size*.022,size*.01,size*.035,'#f7ddb0',6);}
  } else if(id==='strawberry') {
    organic('#de7088',size*.31,.8);const flesh=organic('#f4b4ac',size*.04,.66);flesh.position.y=size*.18;
    for(let i=0;i<6;i++){const a=i*Math.PI/3;ball(g,Math.cos(a)*size*.42,size*.12,Math.sin(a)*size*.38,size*.024,size*.018,size*.037,'#efcf8e',6);}
    line(g,[new THREE.Vector3(-size*.32,size*.22,0),new THREE.Vector3(0,size*.23,size*.1),new THREE.Vector3(size*.3,size*.22,size*.2)],size*.025,'#f8d1b6');
  } else {
    const triangle=new THREE.Shape();triangle.moveTo(-size*.58,-size*.42);triangle.lineTo(size*.63,-size*.32);triangle.lineTo(size*.08,size*.65);triangle.closePath();const piece=mesh(new THREE.ExtrudeGeometry(triangle,{depth:size*.35,bevelEnabled:true,bevelSize:size*.05,bevelThickness:size*.03,bevelSegments:2,steps:1}),juicy(id==='pineapple'||id==='tropical'?'#f6cf65':color),g,0,0,-size*.17);piece.rotation.x=-Math.PI/2;piece.position.y=-size*.16;
    for(let i=0;i<3;i++)ball(g,(i-1)*size*.34,-size*.05,-size*.4,size*.13,size*.10,size*.07,'#c99e4d',7);
  }
  compactDecoration(g);return g;
}

function pot(p:THREE.Object3D,x:number,y:number,z:number,s=.5,color=C.terracotta) {const g=new THREE.Group();g.position.set(x,y,z);p.add(g);cyl(g,0,s*.3,0,s*.42,s*.31,s*.6,color);cyl(g,0,s*.58,0,s*.45,s*.45,s*.12,color);cyl(g,0,s*.65,0,s*.37,s*.37,s*.03,'#84664b');return g;}
function plant(p:THREE.Object3D,x:number,y:number,z:number,s=.5,color=C.terracotta,flowers=false) {const g=pot(p,x,y,z,s,color);for(let i=0;i<7;i++){const a=i*2.4,r=s*.15;const end=new THREE.Vector3(Math.cos(a)*s*.36,s*(1.1+rand(i)*.6),Math.sin(a)*s*.36);bar(g,new THREE.Vector3(0,s*.6,0),end,s*.02,'#6d9656');leaf(g,end.x*.7,end.y*.8,end.z*.7,s*.34,i%2?'#7fa158':'#4d8c54',Math.sin(a)*.7,Math.cos(a)*.7);if(flowers){for(let j=0;j<5;j++){const q=j*1.256;ball(g,end.x+Math.cos(q)*s*.1,end.y+Math.sin(q)*s*.1,end.z,s*.09,s*.09,s*.045,i%2?'#f7c0a1':'#f4df83',8);}ball(g,end.x,end.y,end.z+.04,s*.05,s*.05,s*.04,'#db9f49',8);}}return g;}

function basket(p:THREE.Object3D,x:number,y:number,z:number,id:string,s=.7) {
  const g=new THREE.Group();g.position.set(x,y,z);p.add(g);box(g,0,.035,0,s,.07,s*.72,'#b98b59');
  for(let j=0;j<3;j++){const yy=.08+j*.08;box(g,0,yy,s*.36,s+.04,.045,.035,'#d4ab71',.01);box(g,0,yy,-s*.36,s+.04,.045,.035,'#c59b65',.01);box(g,s*.5,yy,0,.035,.045,s*.72,'#d0a66e',.01);box(g,-s*.5,yy,0,.035,.045,s*.72,'#d0a66e',.01);}
  for(const xx of [-1,1])for(const zz of [-1,1])box(g,xx*s*.46,.17,zz*s*.31,.045,.32,.045,'#b98b59',.01);
  for(let i=0;i<6;i++){const f=createFruit(id,id==='pineapple'?.12:id==='banana'?.11:.115);f.position.set((i%3-1)*s*.26,.23+Math.floor(i/3)*.05,(Math.floor(i/3)-.5)*s*.32);f.rotation.y=i*2.4;g.add(f);}
  label(g,id==='dragonfruit'?'BUAH NAGA':id.toUpperCase(),s*.7,.13,0,.13,s*.386,C.dark,'#fff1c9',58);
  return g;
}

function house(p:THREE.Object3D,x:number,z:number,w:number,h:number,color:string,roof='#c77861') {
  const g=new THREE.Group();g.position.set(x,0,z);p.add(g);box(g,0,h*.5,0,w,h,2,color,.1);box(g,0,.16,1.02,w+.18,.32,.18,'#d8b592');
  const rg=new THREE.BufferGeometry();const verts=new Float32Array([-w*.6,h,1.23,w*.6,h,1.23,0,h+1,1.23,-w*.6,h,-1.23,0,h+1,-1.23,w*.6,h,-1.23,-w*.6,h,1.23,0,h+1,1.23,0,h+1,-1.23,-w*.6,h,1.23,0,h+1,-1.23,-w*.6,h,-1.23,0,h+1,1.23,w*.6,h,1.23,w*.6,h,-1.23,0,h+1,1.23,w*.6,h,-1.23,0,h+1,-1.23]);rg.setAttribute('position',new THREE.BufferAttribute(verts,3));rg.computeVertexNormals();mesh(rg,mat(roof),g);
  for(let side=-1;side<=1;side+=2)for(let row=0;row<7;row++)for(let j=0;j<11;j++){const xx=side*(row/7*w*.6),yy=h+1-row/7;const tile=box(g,xx,yy+.045,-1.16+j*.23,w*.6/7+.07,.055,.25,j%3===0?'#cc8269':roof,.02);tile.rotation.z=-side*Math.atan(1/(w*.6));}
  box(g,-w*.27,.95,1.06,.7,1.9,.12,'#658b76');box(g,-w*.27,1.05,1.15,.55,1.65,.055,'#436e5d');ball(g,-w*.05,.97,1.21,.045,.045,.045,'#e5c176');
  for(const xx of [w*.22]){box(g,xx,h*.62,1.065,1.05,1.15,.12,'#f7e8c4');box(g,xx,h*.62,1.14,.82,.93,.025,'#719d9b');bar(g,new THREE.Vector3(xx-.4,h*.62,1.17),new THREE.Vector3(xx+.4,h*.62,1.17),.025,'#f7e8c4');bar(g,new THREE.Vector3(xx,h*.62-.45,1.17),new THREE.Vector3(xx,h*.62+.45,1.17),.025,'#f7e8c4');for(const side of [-1,1]){box(g,xx+side*.67,h*.62,1.12,.36,1.08,.07,'#7b9f7f');for(let j=0;j<7;j++)box(g,xx+side*.67,h*.62-.4+j*.13,1.17,.3,.035,.025,'#a4bd96',.006);}}
  box(g,0,h*.92,1.09,w*.93,.1,.12,'#f6dfb7');
  const awning=box(g,w*.22,h*.62+.75,1.35,1.8,.1,.8,'#f3dfae');awning.rotation.x=.15;
  for(let i=0;i<9;i++)box(g,w*.22-.8+i*.2,h*.62+.76,1.36,.1,.11,.81,i%2?'#f3dfae':'#e3b77e');
  plant(g,w*.44,0,1.39,.42,'#cc8e6c',true);return g;
}

function palm(p:THREE.Object3D,x:number,z:number,s:number,banana=false) {
  const g=new THREE.Group();g.position.set(x,0,z);p.add(g);const top=new THREE.Vector3(.3*s,3.4*s,0);const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.05*s,1.4*s,0),top]);mesh(new THREE.TubeGeometry(curve,10,.12*s,8,false),mat(banana?'#98a26c':'#b59b70'),g);
  if(!banana)for(let i=0;i<15;i++){const y=i*.22*s;cyl(g,.3*s*(y/(3.4*s))**2,y,0,.135*s,.14*s,.025*s,'#927e57',10);}
  for(let i=0;i<(banana?7:9);i++){const a=i*Math.PI*2/(banana?7:9),len=(banana?1.9:2.1)*s;const dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a));const points=[top.clone(),top.clone().addScaledVector(dir,len*.43).add(new THREE.Vector3(0,.42*s,0)),top.clone().addScaledVector(dir,len).add(new THREE.Vector3(0,-.45*s,0))];const cv=new THREE.CatmullRomCurve3(points);line(g,points,.025*s,'#6b9852');
    if(banana){const positions:number[]=[],uv:number[]=[];const indices:number[]=[];for(let j=0;j<=10;j++){const t=j/10,v=cv.getPoint(t),width=Math.sin(t*Math.PI)*.35*s;for(let side=-1;side<=1;side+=2){positions.push(v.x+Math.cos(a+Math.PI/2)*width*side,v.y-.08*Math.abs(side),v.z+Math.sin(a+Math.PI/2)*width*side);uv.push(t,side===-1?0:1);}if(j<10){const n=j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const m=mat(i%2?'#6c9c52':'#579450').clone();m.side=THREE.DoubleSide;mesh(geo,m,g);}
    else for(let j=1;j<9;j++){const t=j/9,v=cv.getPoint(t);for(const side of [-1,1]){const out=v.clone().add(new THREE.Vector3(Math.cos(a+side*1.05),-.11,Math.sin(a+side*1.05)).multiplyScalar((1-t)*.85*s));const l=leaf(g,(v.x+out.x)*.5,(v.y+out.y)*.5,(v.z+out.z)*.5,v.distanceTo(out)*.6,i%2?'#6c9850':'#4d8647');l.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),out.clone().sub(v).normalize());}}
  }
  for(let i=0;i<3;i++)ball(g,top.x+(i-1)*.12*s,top.y-.12*s,0,.17*s,.2*s,.16*s,'#b2a95e');compactDecoration(g);return g;
}

function scooter(p:THREE.Object3D,x:number,z:number,color:string,rotation=0) {const g=new THREE.Group();p.add(g);g.position.set(x,0,z);g.rotation.y=rotation;for(const xx of [-.52,.55]){const wheel=cyl(g,xx,.29,0,.26,.26,.19,'#454d45',20);wheel.rotation.x=Math.PI/2;const hub=cyl(g,xx,.29,.11,.13,.13,.025,'#d8d2b8',16);hub.rotation.x=Math.PI/2;}box(g,-.1,.58,0,.94,.38,.5,color,.15);box(g,.48,.7,0,.28,.74,.43,color,.13);box(g,-.23,.85,0,.66,.11,.4,'#715a49');bar(g,new THREE.Vector3(.5,.85,0),new THREE.Vector3(.55,1.29,0),.045,'#657c70');bar(g,new THREE.Vector3(.55,1.29,-.27),new THREE.Vector3(.55,1.29,.27),.04,'#5b6458');ball(g,.64,1.02,0,.07,.16,.17,'#fcdf96');box(g,-.63,.7,.01,.18,.1,.32,'#e4ad66');bar(g,new THREE.Vector3(.53,1.27,-.2),new THREE.Vector3(.55,1.57,-.3),.015,'#70877b');ball(g,.55,1.57,-.3,.08,.07,.025,'#d4dcc8');return g;}

function bicycle(p:THREE.Object3D,x:number,z:number,color:string,rotation=0) {
  const g=new THREE.Group();p.add(g);g.position.set(x,0,z);g.rotation.y=rotation;
  for(const xx of [-.61,.61]){mesh(new THREE.TorusGeometry(.37,.033,7,24),mat('#657561'),g,xx,.4,0);mesh(new THREE.TorusGeometry(.315,.012,6,24),mat('#c5cfaf'),g,xx,.4,0);for(let i=0;i<8;i++){const a=i*Math.PI/4;bar(g,new THREE.Vector3(xx,.4,.01),new THREE.Vector3(xx+Math.cos(a)*.31,.4+Math.sin(a)*.31,.01),.006,'#c6cbb4');}}
  const a=new THREE.Vector3(-.61,.4,0),b=new THREE.Vector3(-.21,.89,0),c=new THREE.Vector3(.1,.39,0),d=new THREE.Vector3(.43,.96,0),e=new THREE.Vector3(.61,.4,0);
  for(const [u,v] of [[a,b],[b,c],[c,a],[b,d],[c,d],[d,e]])bar(g,u,v,.027,color);
  bar(g,b,new THREE.Vector3(-.23,1.04,0),.025,'#829477');box(g,-.24,1.04,0,.28,.055,.16,'#756b52',.03);bar(g,d,new THREE.Vector3(.42,1.2,0),.025,'#829477');bar(g,new THREE.Vector3(.42,1.2,-.2),new THREE.Vector3(.42,1.2,.2),.025,'#756b52');
  bar(g,c,new THREE.Vector3(.18,.29,.15),.015,'#829477');box(g,.18,.29,.15,.17,.035,.09,'#756b52',.01);return g;
}

function pennants(p:THREE.Object3D) {const points=[new THREE.Vector3(-2.42,2.86,1.42),new THREE.Vector3(0,2.58,1.44),new THREE.Vector3(2.42,2.86,1.42)];line(p,points,.012,'#d9b276');for(let i=0;i<13;i++){const x=-2.2+i*.365,y=2.59+.27*(x/2.42)**2;const shape=new THREE.Shape();shape.moveTo(-.12,0);shape.lineTo(.12,0);shape.lineTo(0,-.28);shape.closePath();const o=mesh(new THREE.ShapeGeometry(shape),mat(['#e69a70','#f7d266','#7aa569','#e4c396'][i%4]),p,x,y,1.45);o.material=(o.material as THREE.MeshStandardMaterial).clone();(o.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;}}

export function createWorld() {
  const group=new THREE.Group();group.name='PERAS — a little corner of sunshine';
  const animatedLeaves:THREE.Group[]=[];const upgrades=new Map<string,THREE.Group>();const changeable:THREE.Mesh[]=[];
  const woodTexture=canvasTexture(512,256,c=>{c.fillStyle='#e6bd82';c.fillRect(0,0,512,256);for(let i=0;i<110;i++){const y=rand(i+831)*256;c.strokeStyle=`rgba(126,83,40,${.025+rand(i)*.07})`;c.lineWidth=.4+rand(i)*1.2;c.beginPath();for(let x=0;x<=512;x+=8){const yy=y+Math.sin(x*.018+i)*(.8+rand(i)*2);if(x)c.lineTo(x,yy);else c.moveTo(x,yy);}c.stroke();}for(let i=0;i<9;i++){c.strokeStyle='rgba(125,77,31,.08)';c.beginPath();c.ellipse(rand(i+96)*512,rand(i+39)*256,8+rand(i)*15,2,0,0,Math.PI*2);c.stroke();}});woodTexture.wrapS=woodTexture.wrapT=THREE.RepeatWrapping;
  const woodMaterial=new THREE.MeshStandardMaterial({map:woodTexture,roughness:.68,bumpMap:woodTexture,bumpScale:.004});
  const fabricTexture=canvasTexture(128,128,c=>{c.fillStyle='#eee';c.fillRect(0,0,128,128);for(let i=0;i<128;i+=3){c.fillStyle=i%2?'#d4d4d4':'#e5e5e5';c.fillRect(i,0,1,128);c.fillRect(0,i,128,1);}});fabricTexture.wrapS=fabricTexture.wrapT=THREE.RepeatWrapping;fabricTexture.repeat.set(3,6);
  // A small, tactile island, with individual paving stones and pockets of greenery.
  const ground=cyl(group,0,-.22,0,9.2,9.3,.42,'#b9c9a0',96);ground.receiveShadow=true;
  cyl(group,0,-.015,0,9.18,9.18,.05,'#f0dfbf',96);
  box(group,.1,.018,2.65,13,.035,2.8,'#e1caa4',.15);
  for(let i=0;i<15;i++)for(let j=0;j<4;j++){const x=-6.5+i*.9+(j%2)*.4,z=1.6+j*.68;box(group,x,.044,z,.85,.045,.61,(i+j)%4===0?'#d1bc9a':(i+j)%3===0?'#ead6b3':'#ddc8a5',.045);}
  for(let i=0;i<30;i++){const a=i*2.399,r=5+rand(i+47)*3.4;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(z>1.1&&z<4)continue;ball(group,x,.035,z,.13+rand(i)*.13,.07,.12,'#c4b99c',8);}
  const grassPatch=(x:number,z:number,w:number,d:number)=>{box(group,x,.015,z,w,.06,d,'#b9c391',.15);for(let i=0;i<20;i++){const xx=x+(rand(i+10)-.5)*w,zz=z+(rand(i+30)-.5)*d;for(let j=0;j<3;j++)leaf(group,xx,.14,zz,.15,'#95ad70',(j-1)*.4,i*1.1);}};
  grassPatch(-5.6,-1.5,2.5,3.5);grassPatch(5.7,-1.5,2.7,3.7);grassPatch(0,-5.7,5,2);
  const houses=[house(group,-4.7,6.25,3.5,3.35,C.coral),house(group,.1,7.1,3.8,3.0,C.mint,'#9f9c78'),house(group,5.1,6.0,3.6,3.75,'#e5ce8f')];houses.forEach(h=>h.rotation.y=Math.PI);
  label(houses[0],'TOKO BUNGA',1.5,.29,0,2.83,1.14,'#f7e8c7','#bb775f',75);
  label(houses[2],'WARUNG IBU',1.5,.29,0,3.2,1.14,'#fff0cd','#788d6a',75);
  // Telephone wire, tiny hanging lanterns, and the sleepy village behind the stand.
  for(const x of [-7.5,7.1]){cyl(group,x,2.4,5.3,.075,.1,4.8,'#9b8561',10);bar(group,new THREE.Vector3(x-.5,4.25,5.3),new THREE.Vector3(x+.5,4.25,5.3),.045,'#8b7657');}
  line(group,[new THREE.Vector3(-7.5,4.3,5.3),new THREE.Vector3(0,3.72,5.3),new THREE.Vector3(7.1,4.3,5.3)],.017,'#6d7660');
  for(let i=0;i<10;i++){const x=-6.6+i*1.4,y=3.72+.58*(x/7.5)**2;cyl(group,x,y-.1,5.3,.09,.09,.18,'#f0bd71',12);cyl(group,x,y+.005,5.3,.1,.1,.035,'#8b8060');}
  animatedLeaves.push(palm(group,-6.5,4.2,1.23),palm(group,6.4,4.3,1.28),palm(group,4.1,4.7,.88,true),palm(group,-4.1,4.7,.85,true));
  scooter(group,4.8,-2.0,'#dca285',-.26);scooter(group,-5.8,-2.65,'#8ba99e',.4);
  // The wooden juice cart, generous counter and painted tongue-and-groove front.
  const stand=new THREE.Group();group.add(stand);stand.name='juice-stand';
  for(const x of [-1.92,1.92])for(const z of [-.76,.79]){const tire=cyl(stand,x,.29,z,.28,.28,.16,'#50634c',20);tire.rotation.x=Math.PI/2;const hub=cyl(stand,x,.29,z+.09,.13,.13,.025,'#e7d7ac',16);hub.rotation.x=Math.PI/2;}
  box(stand,0,.62,.8,4.55,1.02,.65,C.green,.1);
  for(let i=0;i<16;i++){const o=box(stand,-2.13+i*.284,.65,1.14,.255,.93,.065,i%2?C.green:'#3b8d57',.018);changeable.push(o);}
  box(stand,0,.22,1.2,4.65,.16,.12,C.dark,.03);box(stand,0,1.09,1.21,4.7,.1,.15,C.lime,.025);
  box(stand,0,1.19,.66,4.9,.2,1.3,'#e9bb78',.09);const countertop=box(stand,0,1.302,.66,4.88,.035,1.3,'#efd09a',.03);countertop.material=woodMaterial;
  for(let i=0;i<5;i++)box(stand,-2+i*.95,1.323,.66,.012,.006,1.2,'#d8b57e',.002);
  const frontSign=label(stand,'SQUEEZED WITH LOVE',2.8,.36,0,.68,1.192,C.cream,C.green,65);frontSign.position.z=1.196;
  label(stand,'BUAH SEGAR · HATI SENANG',2.55,.19,0,.36,1.202,'#dce6ad',C.green,52);
  // Two slim rear uprights leave the little vendor fully visible.
  for(const x of [-2.26,2.26]){cyl(stand,x,2.06,-.75,.063,.07,3.58,C.dark,12);cyl(stand,x,2.16,1.05,.047,.053,2.65,C.dark,12);ball(stand,x,3.62,-.75,.11,.11,.11,'#f4d68d');}
  for(const z of [-1.36,1.43])bar(stand,new THREE.Vector3(-2.65,3.54,z),new THREE.Vector3(2.65,3.54,z),.036,C.dark);
  // Curved, alternating canvas panels with a separate scalloped hem.
  const strips=16,width=5.3/strips;
  for(let i=0;i<strips;i++){
    const pos:number[]=[],uv:number[]=[],idx:number[]=[];for(let j=0;j<=18;j++){const t=j/18,z=-1.43+t*2.86,y=3.55+Math.sin(t*Math.PI)*.4;for(let side=0;side<2;side++){pos.push(-2.65+(i+side)*width,y,z);uv.push(side,t);}if(j<18){const n=j*2;idx.push(n,n+2,n+1,n+1,n+2,n+3);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const m=mat(i%2?'#f7e9bc':'#76a25c').clone();m.side=THREE.DoubleSide;m.bumpMap=fabricTexture;m.bumpScale=.004;mesh(geo,m,stand);
    const sh=new THREE.Shape();sh.moveTo(-width*.5,0);sh.lineTo(width*.5,0);sh.lineTo(width*.5,-.13);sh.quadraticCurveTo(0,-.43,-width*.5,-.13);sh.closePath();mesh(new THREE.ExtrudeGeometry(sh,{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1}),m,stand,-2.65+(i+.5)*width,3.55,1.435);
    line(stand,[new THREE.Vector3(-2.65+i*width,3.56,-1.43),new THREE.Vector3(-2.65+i*width,3.96,0),new THREE.Vector3(-2.65+i*width,3.56,1.43)],.009,'#e8d8a4');
  }
  const logo=new THREE.Group();stand.add(logo);logo.position.set(0,4.34,.03);box(logo,0,0,0,2.15,.71,.13,C.dark,.15);box(logo,0,0,.075,2.04,.6,.055,C.cream,.13);
  for(const x of [-.72,.72])bar(stand,new THREE.Vector3(x,3.85,.02),new THREE.Vector3(x,4.12,.02),.035,C.dark);
  const logoTex=canvasTexture(1024,350,c=>{c.fillStyle=C.cream;c.fillRect(0,0,1024,350);c.textAlign='center';c.textBaseline='middle';c.fillStyle=C.dark;c.font='900 240px Fredoka, Arial, sans-serif';c.fillText('PERAS!',512,171);c.fillStyle='#b79443';c.font='bold 33px Arial, sans-serif';c.letterSpacing='9px';c.fillText('FRESHLY SQUEEZED HAPPINESS',512,305);});
  mesh(new THREE.PlaneGeometry(1.95,.59),new THREE.MeshStandardMaterial({map:logoTex,roughness:1}),logo,0,0,.108);
  const backLogo=mesh(new THREE.PlaneGeometry(1.95,.59),new THREE.MeshStandardMaterial({map:logoTex,roughness:1}),logo,0,0,-.071);backLogo.rotation.y=Math.PI;
  pennants(stand);
  // Two shallow rows keep every source visible from behind the counter.
  const fruitDisplays=new Map<string,THREE.Group>();
  const fruitIds=['mango','avocado','orange','watermelon','strawberry','guava','banana','pineapple'];
  const fruitNames:Record<string,string>={mango:'MANGGA',avocado:'ALPUKAT',orange:'JERUK',watermelon:'SEMANGKA',strawberry:'STROBERI',guava:'JAMBU',banana:'PISANG',pineapple:'NANAS'};
  box(stand,-1.34,1.37,1.18,2.1,.11,.44,'#b88b57',.035);
  fruitIds.forEach((id,i)=>{
    const row=Math.floor(i/4),tray=new THREE.Group();stand.add(tray);tray.name=`ingredient-source-${id}`;tray.position.set(-2.12+(i%4)*.53,1.34+row*.12,.77+row*.43);fruitDisplays.set(id,tray);
    box(tray,0,.026,0,.49,.052,.37,'#bd925f',.035);box(tray,0,.056,0,.446,.014,.326,'#f2deb0',.02);
    for(const side of [-1,1])box(tray,side*.239,.095,0,.025,.11,.37,'#dfbd82',.008);
    box(tray,0,.08,.177,.48,.08,.024,'#d3aa70',.008);
    const fruit=createFruit(id,id==='pineapple'?.115:id==='banana'?.13:.139);fruit.position.set(-.033,.185,.015);fruit.rotation.y=id==='avocado'||id==='guava'?Math.PI:.2+i*.3;tray.add(fruit);
    if(!['banana','pineapple','watermelon'].includes(id)){const second=createFruit(id,.081);second.position.set(.133,.125,-.055);second.rotation.y=Math.PI-.3;tray.add(second);}
    const tag=label(tray,fruitNames[id],.46,.118,0,.105,-.195,C.dark,'#fff5d9',64);tag.rotation.y=Math.PI;
  });
  const produce=new THREE.Group();stand.add(produce);produce.position.set(-3.05,.04,-.2);produce.rotation.y=.16;
  box(produce,0,.47,0,1.05,.8,.85,'#c7975d');for(let i=0;i<5;i++)box(produce,-.42+i*.21,.49,.44,.18,.76,.03,'#d9b17a',.01);
  basket(produce,0,.88,0,'pineapple',.93);basket(produce,.03,.13,.93,'watermelon',.85);basket(produce,-.04,.05,-.88,'dragonfruit',.85);
  basket(stand,1.7,.03,-1.25,'banana',.75);
  // The side shelf keeps bottles out of the player's reach and camera path.
  box(stand,2.8,1.05,.05,.6,.12,1.4,'#b78855');for(let i=0;i<5;i++){const b=new THREE.Group();stand.add(b);b.position.set(2.8,1.12,-.5+i*.24);cyl(b,0,.23,0,.08,.09,.46,['#f0b84c','#df947b','#a1b66a','#ebcf77','#e2a363'][i]);cyl(b,0,.48,0,.035,.04,.07,'#ebe0b5');const tag=label(b,['M','S','A','O','P'][i],.12,.13,0,.25,-.094,C.dark,C.cream,130);tag.rotation.y=Math.PI;}
  box(stand,2.8,1.25,.95,.43,.28,.36,'#dbad6e');bar(stand,new THREE.Vector3(2.8,1.38,.95),new THREE.Vector3(2.8,1.85,.95),.035,'#8f9f81');bar(stand,new THREE.Vector3(2.8,1.84,.95),new THREE.Vector3(3.05,1.84,.95),.035,'#87957b');cyl(stand,2.8,1.56,.95,.12,.05,.12,'#ced2b0');
  // The blender is a tactile countertop machine, with a translucent faceted jar.
  const blender=new THREE.Group();stand.add(blender);blender.position.set(.65,1.33,.75);blender.name='blender';
  box(blender,0,.14,0,.43,.28,.42,'#e8d7b4',.085);box(blender,0,.105,-.216,.33,.12,.025,C.dark,.025);
  const controlKnob=new THREE.Group();blender.add(controlKnob);controlKnob.position.set(0,.13,-.246);const knob=cyl(controlKnob,0,0,0,.074,.074,.047,'#d4bf87',24);knob.rotation.x=Math.PI/2;box(controlKnob,0,.038,-.03,.011,.045,.014,'#425c42',.003);const controlLabel=label(blender,'HOLD',.25,.057,0,.029,-.234,'#e9d7a7',C.dark,85);controlLabel.rotation.y=Math.PI;
  cyl(blender,0,.3,0,.16,.19,.08,'#617f62');
  const jar=new THREE.Group();blender.add(jar);jar.position.y=.34;
  const glass=new THREE.MeshPhysicalMaterial({color:'#f1f7df',transparent:true,opacity:.27,roughness:.035,metalness:.015,transmission:.42,thickness:.035,ior:1.45,side:THREE.DoubleSide,depthWrite:false});
  mesh(new THREE.CylinderGeometry(.22,.17,.61,24,1,true),glass,jar,0,.32,0);cyl(jar,0,.035,0,.175,.175,.07,'#c5cfac');
  const rim=mesh(new THREE.TorusGeometry(.22,.018,6,24),mat('#cbd7b9'),jar,0,.625,0);rim.rotation.x=Math.PI/2;
  const jarDropRing=mesh(new THREE.TorusGeometry(.249,.018,8,40),new THREE.MeshBasicMaterial({color:'#c9df8b',transparent:true,opacity:.85,depthWrite:false}),jar,0,.665,0);jarDropRing.rotation.x=Math.PI/2;jarDropRing.castShadow=false;
  const dropArrow=new THREE.Group();jar.add(dropArrow);dropArrow.position.y=.86;
  cyl(dropArrow,0,.025,0,.012,.012,.115,'#c9df8b',10);const arrowTip=mesh(new THREE.ConeGeometry(.045,.065,3),mat('#c9df8b'),dropArrow,0,-.057,0);arrowTip.rotation.z=Math.PI;

  line(jar,[new THREE.Vector3(.2,.5,0),new THREE.Vector3(.37,.5,0),new THREE.Vector3(.4,.37,0),new THREE.Vector3(.37,.19,0),new THREE.Vector3(.2,.15,0)],.034,'#a7baa2');
  const spoutGeo=new THREE.BufferGeometry();spoutGeo.setAttribute('position',new THREE.Float32BufferAttribute([.17,.625,-.075,.32,.63,0,.17,.625,.075,.17,.625,-.075,.21,.665,-.065,.32,.63,0,.17,.625,.075,.32,.63,0,.21,.665,.065],3));spoutGeo.computeVertexNormals();mesh(spoutGeo,glass,jar);
  for(let j=0;j<5;j++){box(jar,-.1,.16+j*.085,-.175,.052,.009,.006,'#7d947d',.002);}
  const blades=new THREE.Group();jar.add(blades);cyl(blades,0,.083,0,.032,.04,.05,'#a5b09b');for(let i=0;i<4;i++){const blade=box(blades,0,.075,0,.25,.012,.036,'#c5cfbd',.005);blade.rotation.y=i*Math.PI/2;blade.rotation.z=i%2?.09:-.09;}
  const lid=new THREE.Group();jar.add(lid);cyl(lid,0,.65,0,.24,.24,.055,C.dark);box(lid,0,.694,0,.1,.04,.09,'#d9dfb8',.015);
  const liquid=mesh(new THREE.CylinderGeometry(.193,.16,.44,24),new THREE.MeshStandardMaterial({color:'#f0ba50',roughness:.36,transparent:true,opacity:.94}),jar,0,.27,0);
  const surfaceGeometry=new THREE.BufferGeometry(),surfaceVertices:number[]=[],surfaceIndices:number[]=[];
  for(let ring=0;ring<=8;ring++)for(let seg=0;seg<=40;seg++){const r=ring/8*.191,a=seg/40*Math.PI*2;surfaceVertices.push(Math.cos(a)*r,0,Math.sin(a)*r);if(ring<8&&seg<40){const n=ring*41+seg;surfaceIndices.push(n,n+41,n+1,n+1,n+41,n+42);}}
  surfaceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(surfaceVertices,3));surfaceGeometry.setIndex(surfaceIndices);surfaceGeometry.computeVertexNormals();
  const liquidSurface=mesh(surfaceGeometry,(liquid.material as THREE.MeshStandardMaterial).clone(),jar,0,.49,0);(liquidSurface.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
  const swirl=new THREE.Group();jar.add(swirl);for(let i=0;i<3;i++){const r=mesh(new THREE.TorusGeometry(.12-i*.028,.008,5,24,Math.PI*1.5),mat(i%2?'#ffe098':'#f1c066'),swirl,0,.497+i*.004,0);r.rotation.x=Math.PI/2;r.rotation.z=i*2;}
  const fruitPieces=new THREE.Group();jar.add(fruitPieces);
  const bubbles=new THREE.Group();jar.add(bubbles);for(let i=0;i<9;i++)ball(bubbles,0,.1,0,.012+rand(i)*.009,.012+rand(i)*.009,.012+rand(i)*.009,'#fff0c3',8);
  const jarIce=new THREE.Group();jar.add(jarIce);const iceMaterial=new THREE.MeshPhysicalMaterial({color:'#e7f0df',transparent:true,opacity:.58,roughness:.12,transmission:.25,thickness:.04});for(let i=0;i<5;i++){const cube=box(jarIce,0,0,0,.085,.08,.083,'#e7f0df',.016);cube.material=iceMaterial;cube.rotation.set(i*.7,i*.9,i*.35);}
  const jarFoam=new THREE.Group();jar.add(jarFoam);for(let i=0;i<15;i++){const a=i*2.4,r=.035+rand(i)*.12;ball(jarFoam,Math.cos(a)*r,0,Math.sin(a)*r,.018+rand(i)*.016,.009,.018+rand(i)*.016,'#fff0c9',8);}
  // A paper cup, juicy fill, tiny straw and a continuous pour ribbon.
  const cup=new THREE.Group();stand.add(cup);cup.position.set(1.5,1.33,.75);cup.name='serving-cup';
  mesh(new THREE.CylinderGeometry(.155,.115,.43,24,1,true),new THREE.MeshPhysicalMaterial({color:'#fff9e2',transparent:true,opacity:.38,roughness:.16,depthWrite:false,side:THREE.DoubleSide}),cup,0,.215,0);
  const cupRim=mesh(new THREE.TorusGeometry(.154,.013,7,24),mat('#fff5da'),cup,0,.432,0);cupRim.rotation.x=Math.PI/2;
  const fillMark=mesh(new THREE.TorusGeometry(.15,.006,5,32),mat('#75a45a'),cup,0,.375,0);fillMark.rotation.x=Math.PI/2;
  const cupCoaster=new THREE.Group();stand.add(cupCoaster);cupCoaster.position.set(1.5,1.329,.75);cyl(cupCoaster,0,.004,0,.235,.235,.012,'#d9dfb2',32);topOutline(cupCoaster,.48,.48,'#7fa16a',.009);
  const cupTag=label(cupCoaster,'GELAS',.35,.10,0,.04,-.275,C.dark,'#fff5d9',90);cupTag.rotation.y=Math.PI;

  cyl(cup,0,.018,0,.116,.116,.035,'#f8edcf');
  const cupLiquid=mesh(new THREE.CylinderGeometry(.14,.108,.37,24),mat('#f0ba50',.33),cup,0,.2,0);cupLiquid.visible=false;
  label(cup,'P!',.2,.16,0,.24,.14,C.dark,C.cream,150);
  const cupLogo=label(cup,'P!',.2,.16,0,.24,-.14,C.dark,C.cream,150);cupLogo.rotation.y=Math.PI;
  const cupFoam=new THREE.Group();cup.add(cupFoam);for(let i=0;i<13;i++){const a=i*2.4,r=.025+rand(i)*.09;ball(cupFoam,Math.cos(a)*r,0,Math.sin(a)*r,.016+rand(i)*.012,.006,.016+rand(i)*.012,'#fff0d2',8);}
  const straw=bar(cup,new THREE.Vector3(.06,.1,0),new THREE.Vector3(.13,.68,0),.014,'#739c60');straw.visible=false;
  const pourCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(1.38,2.04,.68),new THREE.Vector3(1.56,1.97,.74),new THREE.Vector3(1.63,1.75,.84)]);
  const pourStream=mesh(new THREE.TubeGeometry(pourCurve,16,.025,8,false),mat('#f0ba50',.3),stand);pourStream.visible=false;
  const spill=new THREE.Group();stand.add(spill);const puddle=mesh(new THREE.CircleGeometry(1,48),new THREE.MeshPhysicalMaterial({color:'#f0ba50',transparent:true,opacity:.33,roughness:.18,metalness:.02,depthWrite:false}),spill,1.5,1.328,.78);puddle.rotation.x=-Math.PI/2;puddle.scale.set(.001,.001,1);
  const spillDrops=new THREE.Group();spill.add(spillDrops);for(let i=0;i<12;i++)ball(spillDrops,0,0,0,.015,.022,.015,'#f0ba50',7);spill.visible=false;
  // A cutting board, freshly sliced citrus, real blade, and cloth towel.
  const cuttingBoard=box(stand,-.5,1.355,.65,.82,.06,.55,'#c4955d',.075);cuttingBoard.material=woodMaterial.clone();(cuttingBoard.material as THREE.MeshStandardMaterial).color.set('#ceaa75');
  const boardDropFrame=new THREE.Group();stand.add(boardDropFrame);boardDropFrame.position.set(-.5,1.391,.65);const boardOutline=topOutline(boardDropFrame,.79,.52,'#f3db81',.012);
  const boardTag=label(boardDropFrame,'TALENAN',.55,.105,0,-.012,-.305,C.dark,'#fff5d9',80);boardTag.rotation.y=Math.PI;
  const boardGrip=cyl(stand,-.962,1.355,.65,.065,.065,.045,'#c4955d',16);boardGrip.rotation.z=Math.PI/2;

  const boardContent=new THREE.Group();stand.add(boardContent);boardContent.position.set(-.5,1.405,.65);
  const boardWhole=new THREE.Group(),boardChunks=new THREE.Group();boardContent.add(boardWhole,boardChunks);
  const knifeRig=new THREE.Group();stand.add(knifeRig);knifeRig.position.set(-.12,1.414,.45);knifeRig.rotation.x=Math.PI/2;
  const blade=box(knifeRig,0,.078,0,.3,.145,.014,'#cbd4c7',.009);blade.material=new THREE.MeshStandardMaterial({color:'#d4ded2',roughness:.2,metalness:.7});box(knifeRig,.235,.105,0,.19,.055,.045,C.dark,.018);for(let i=0;i<2;i++)ball(knifeRig,.2+i*.065,.106,-.025,.009,.009,.004,'#d9cfa6',8);
  const cuttingGuide=new THREE.Group();boardContent.add(cuttingGuide);for(let i=0;i<6;i++){const dash=box(cuttingGuide,0,.005,-.22+i*.08,.012,.006,.04,'#fff0c4',.003);dash.material=new THREE.MeshBasicMaterial({color:'#fff0c4',transparent:true,opacity:.65});}
  const towel=box(stand,1.98,1.345,.06,.39,.025,.5,'#eee9c9',.02);towel.rotation.y=.1;for(let i=0;i<4;i++)box(stand,1.83+i*.08,1.36,.06,.014,.008,.49,'#94ad7b',.002);
  // Register, pencil jar, napkins, ice bucket, cooler and handmade price cards.
  const register=new THREE.Group();stand.add(register);register.position.set(2.12,1.33,.25);register.rotation.y=Math.PI;box(register,0,.09,0,.43,.18,.37,'#577a60',.055);const scr=box(register,0,.28,-.05,.35,.27,.06,'#3f5e4d',.03);scr.rotation.x=-.2;const screen=label(register,'Rp 15.000',.29,.15,0,.295,-.006,'#cbe1a7','#3b5848',70);screen.rotation.x=-.2;for(let j=0;j<3;j++)for(let i=0;i<3;i++)box(register,-.1+i*.1,.193,.08+j*.05,.06,.018,.035,'#d2d3b0',.006);
  cyl(stand,2.34,1.45,.7,.065,.06,.24,'#d6b57a');for(let i=0;i<3;i++){const o=cyl(stand,2.31+i*.027,1.61,.7,.008,.008,.27,['#73985b','#dba06a','#6c8e78'][i],6);o.rotation.z=(i-1)*.15;}
  box(stand,1.8,1.39,.12,.25,.12,.22,'#f5ebcf',.025);for(let i=0;i<3;i++)box(stand,1.8,1.45+i*.012,.12,.23,.006,.2,'#fff5df',.001);
  const iceBucket=new THREE.Group();stand.add(iceBucket);iceBucket.position.set(-1.92,1.33,.45);cyl(iceBucket,0,.16,0,.2,.15,.32,'#b3c8b3');cyl(iceBucket,0,.318,0,.183,.183,.018,'#829e91');
  const iceRim=mesh(new THREE.TorusGeometry(.195,.018,7,24),mat('#e0e9d4'),iceBucket,0,.33,0);iceRim.rotation.x=Math.PI/2;
  for(let i=0;i<7;i++){const ice=box(iceBucket,(rand(i+54)-.5)*.24,.34+rand(i)*.04,(rand(i+15)-.5)*.24,.085,.07,.08,'#e5f0dc',.02);ice.material=iceMaterial;ice.rotation.y=i;}
  const iceTag=label(iceBucket,'ES BATU',.31,.115,0,.175,-.197,C.dark,C.cream,80);iceTag.rotation.y=Math.PI;
  const scoop=new THREE.Group();iceBucket.add(scoop);scoop.position.set(.15,.37,.045);scoop.rotation.z=-.45;ball(scoop,0,0,0,.062,.024,.085,'#d8e0cd',12);bar(scoop,new THREE.Vector3(0,0,0),new THREE.Vector3(0,.19,.015),.018,'#758e7c');

  const liquids=new Map<string,THREE.Group>();for(const [id,x,color] of [['water',-1.53,'#c7dccc'],['milk',-1.15,'#f0e6c8']] as const){const b=new THREE.Group();stand.add(b);b.position.set(x,1.33,.2);liquids.set(id,b);cyl(b,0,.19,0,.108,.116,.38,color,20);cyl(b,0,.415,0,.052,.1,.07,color,16);cyl(b,0,.465,0,.06,.06,.04,id==='milk'?'#d9ac71':'#83a28b',16);const tag=label(b,id==='water'?'AIR':'SUSU',.17,.15,0,.22,-.115,C.dark,'#fff1cf',72);tag.rotation.y=Math.PI;}
  const cooler=new THREE.Group();stand.add(cooler);cooler.position.set(3.02,.06,-.58);box(cooler,0,.35,0,.83,.69,.67,'#94b69a',.1);box(cooler,0,.72,0,.89,.14,.72,'#e6e4c4',.06);box(cooler,0,.43,.36,.22,.15,.035,'#eef0cf',.025);label(cooler,'ICE • ES',.5,.2,0,.3,.344,C.dark,'#bad0aa',85);bar(cooler,new THREE.Vector3(-.44,.5,-.18),new THREE.Vector3(-.44,.5,.18),.035,'#698e72');
  // The freestanding chalk menu has little drawings and hand-lettered specials.
  const menu=new THREE.Group();stand.add(menu);menu.position.set(-3.25,0,1.23);menu.rotation.set(-.09,.16,0);box(menu,0,.85,0,1.04,1.5,.1,'#b78957',.05);box(menu,0,.88,.065,.89,1.29,.025,'#355e48',.025);
  const menuTex=canvasTexture(512,768,c=>{c.fillStyle='#355e48';c.fillRect(0,0,512,768);c.textAlign='center';c.fillStyle='#fff0cc';c.font='italic 900 65px Georgia';c.fillText('Segar dulu!',256,95);c.strokeStyle='#adc28b';c.lineWidth=3;c.beginPath();c.moveTo(58,127);c.lineTo(454,127);c.stroke();c.font='bold 28px Arial';c.fillStyle='#d7dda6';c.fillText('TODAY’S HAPPY SQUEEZES',256,181);const names=['MANGO SUNSHINE','AVO-CUDDLE','BERRY HAPPY','TROPICAL GLOW'];names.forEach((t,i)=>{c.fillStyle='#fff0cc';c.font='bold 31px Arial';c.fillText(t,256,259+i*93);c.fillStyle='#e9c578';c.font='25px Arial';c.fillText('fresh fruit  ·  15k',256,296+i*93);});c.fillStyle='#d6dca4';c.font='italic 27px Georgia';c.fillText('a little sip of sunshine ♡',256,706);});mesh(new THREE.PlaneGeometry(.84,1.24),new THREE.MeshStandardMaterial({map:menuTex}),menu,0,.88,.083);
  for(const side of [-1,1]){const leg=box(menu,side*.4,.24,0,.08,.5,.1,'#b78957');leg.rotation.z=side*.12;bar(menu,new THREE.Vector3(side*.4,.1,-.4),new THREE.Vector3(side*.4,1.5,0),.035,'#b78957');}
  // Reusable upgrade props, revealed by the game as the tiny business grows.
  const upgradeGroup=(key:string)=>{const u=new THREE.Group();u.visible=false;stand.add(u);upgrades.set(key,u);return u;};
  const premium=upgradeGroup('blender');box(premium,.65,1.44,.75,.48,.05,.47,'#d9bd6c',.06);const proLabel=label(premium,'PRO',.19,.07,.65,1.51,.513,'#ecd799',C.dark,100);proLabel.rotation.y=Math.PI;
  const decor=upgradeGroup('plants');plant(decor,-2.37,1.33,-.62,.27,C.terracotta,true);plant(decor,2.36,1.33,-.1,.25,'#e2b77a',true);plant(decor,-2.8,0,-1.7,.7,'#c88e6a',true);
  const storage=upgradeGroup('storage');box(storage,2.95,.5,-1.7,.9,.95,.7,'#bf975e');for(let j=0;j<4;j++)box(storage,2.95,.2+j*.2,-1.33,.88,.12,.04,'#deb780',.015);basket(storage,2.95,1.01,-1.7,'orange',.84);
  const shade=upgradeGroup('canopy');
  for(const x of [-2.67,2.67]){line(shade,[new THREE.Vector3(x,3.52,-1.4),new THREE.Vector3(x,3.28,0),new THREE.Vector3(x,3.52,1.4)],.045,'#e5bd66');for(const z of [-1.38,1.4]){cyl(shade,x,3.22,z,.055,.018,.24,'#e5bd66',8);ball(shade,x,3.36,z,.065,.065,.065,'#f3d592');}}
  const lights=upgradeGroup('lights');line(lights,[new THREE.Vector3(-2.2,3.3,.95),new THREE.Vector3(0,2.94,.95),new THREE.Vector3(2.2,3.3,.95)],.012,'#a28d64');
  const glow=new THREE.MeshStandardMaterial({color:'#ffe7aa',emissive:'#f8c867',emissiveIntensity:.65,roughness:.35});
  for(let i=0;i<9;i++){const x=-2.15+i*.54,y=2.94+.36*(x/2.2)**2;mesh(new THREE.SphereGeometry(.057,10,8),glow,lights,x,y-.055,.95);cyl(lights,x,y+.009,.95,.024,.024,.045,'#8f845d',8);}
  const warmLamp=new THREE.PointLight('#ffd58c',2.5,5,2);warmLamp.position.set(0,2.85,.5);lights.add(warmLamp);
  const brandedCups=upgradeGroup('cups');for(let i=0;i<5;i++){cyl(brandedCups,2.1,1.39+i*.063,.42,.125,.105,.1,'#f4e9c8',16);const band=cyl(brandedCups,2.1,1.4+i*.063,.42,.127,.112,.045,'#749858',16);void band;}label(brandedCups,'P!',.16,.11,2.1,1.62,.544,C.dark,C.cream,140);
  // Flowers, bench, woven rug, little waste bin and two very small neighbors.
  plant(stand,-2.75,0,1.05,.6,C.terracotta,true);plant(stand,2.73,0,1.0,.67,'#d7b376',true);plant(stand,3.28,0,-1.68,.55,'#a2b18a');
  for(let i=0;i<5;i++){const flower=plant(group,-4.45+i*.4,0,-2.2,.24,'#d99778',true);flower.rotation.y=i;}
  const rug=box(stand,.3,.066,1.68,2.3,.025,.55,'#a8b581',.06);for(let i=0;i<11;i++)box(stand,-.7+i*.2,.083,1.68,.025,.006,.53,'#e8d4a7',.002);
  const bench=new THREE.Group();group.add(bench);bench.position.set(4.3,0,.4);bench.rotation.y=-.25;for(let i=0;i<4;i++)box(bench,0,.51,(i-1.5)*.12,1.7,.1,.1,'#c59c68',.025);for(const x of [-.63,.63]){box(bench,x,.25,0,.1,.5,.47,C.dark,.025);box(bench,x,.77,-.25,.07,.65,.07,C.dark,.02);}for(let j=0;j<2;j++)box(bench,0,.78+j*.16,-.25,1.7,.12,.07,'#c59c68',.02);
  cyl(stand,3.15,.3,1.18,.24,.19,.6,'#b4bd8d');cyl(stand,3.15,.62,1.18,.25,.25,.065,'#70896b');cyl(stand,3.15,.655,1.18,.13,.13,.008,'#4f674e');
  const cat=new THREE.Group();group.add(cat);cat.position.set(4.15,.55,.52);cat.rotation.y=-.4;ball(cat,0,.12,0,.3,.17,.21,'#d5ab77');ball(cat,-.23,.22,.02,.16,.17,.15,'#dbb684');for(const x of [-.32,-.15]){const ear=mesh(new THREE.ConeGeometry(.07,.16,3),mat('#cfa271'),cat,x,.39,.01);ear.rotation.z=x<-.2?.2:-.2;}for(const x of [-.29,-.19]){box(cat,x,.245,.158,.045,.012,.006,'#6f6952',.002);}ball(cat,-.24,.2,.17,.02,.015,.01,'#c28273');line(cat,[new THREE.Vector3(.22,.12,0),new THREE.Vector3(.48,.13,.05),new THREE.Vector3(.49,.24,.1),new THREE.Vector3(.36,.26,.15)],.06,'#b88d61');
  const bird=new THREE.Group();group.add(bird);bird.position.set(-1.78,4.04,-.3);ball(bird,0,0,0,.115,.13,.19,'#d19e66');ball(bird,0,.12,.1,.09,.09,.09,'#deb585');const beak=mesh(new THREE.ConeGeometry(.035,.09,6),mat('#daae55'),bird,0,.11,.21);beak.rotation.x=Math.PI/2;for(const side of [-1,1])ball(bird,side*.065,.145,.16,.014,.014,.014,'#3b4b3c',8);ball(bird,.075,-.005,-.02,.06,.08,.13,'#9d8c68');
  // Scattered hand-painted blossoms at the edge of the miniature.
  for(let i=0;i<20;i++){const a=i*2.4,r=6+rand(i+5)*1.4;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(z>1&&z<4.3)continue;bar(group,new THREE.Vector3(x,0,z),new THREE.Vector3(x,.24,z),.012,'#8da16b');for(let j=0;j<4;j++)ball(group,x+Math.cos(j*1.57)*.052,.24+Math.sin(j*1.57)*.052,z,.05,.05,.025,i%2?'#edbda4':'#f6e3a1',6);}
  // Each neighborhood keeps the cozy cart but gives it a different occasion.
  const locations=new Map<string,THREE.Group>();
  function locationGroup(id:string){const g=new THREE.Group();g.name=`location-${id}`;g.visible=id==='gang';group.add(g);locations.set(id,g);return g;}
  const gang=locationGroup('gang');
  cyl(gang,-4.1,1.1,-1.7,.045,.06,2.2,C.dark,10);box(gang,-4.1,1.89,-1.7,1.6,.38,.08,C.dark,.06);label(gang,'GANG BAHAGIA',1.43,.27,-4.1,1.9,-1.65,C.cream,C.dark,78);
  const laundry=[new THREE.Vector3(-6.3,2.5,-3.6),new THREE.Vector3(-4.9,2.35,-3.6),new THREE.Vector3(-3.5,2.5,-3.6)];line(gang,laundry,.01,'#be9f72');
  for(let i=0;i<5;i++){const xx=-6.05+i*.5;const cloth=box(gang,xx,2.17,-3.6,.31,.47,.025,['#ddb28b','#d4dcc1','#e3a88e','#a5beb3','#eed59b'][i],.025);cloth.rotation.z=(i-2)*.025;for(const dx of [-.11,.11])box(gang,xx+dx,2.41,-3.6,.025,.07,.04,'#a68155',.008);}
  const cfd=locationGroup('cfd');
  box(cfd,5.7,.079,1.55,1.85,.045,5.3,'#afc1a0',.08);
  for(let i=0;i<6;i++){box(cfd,5.7,.107,-.55+i*.85,.065,.009,.4,'#fff0cd',.005);for(const x of [4.85,6.55])box(cfd,x,.108,-.55+i*.85,.025,.009,.76,'#e4dcad',.004);}
  for(const [x,z] of [[4.65,2.1],[6.7,.1],[4.6,-1.6],[6.7,3.6]]){box(cfd,x,.08,z,.38,.1,.38,'#c77753',.045);cyl(cfd,x,.31,z,.035,.145,.42,'#e9a16d',12);cyl(cfd,x,.33,z,.077,.09,.085,'#f9ebc8',12);}
  bicycle(cfd,5.4,-1.25,'#cba052',-.17);bicycle(cfd,-4.9,.22,'#91aa94',.25);
  for(const x of [4.25,6.5])cyl(cfd,x,1.6,-1.65,.035,.045,3.2,'#a7a178',10);box(cfd,5.38,2.92,-1.65,2.4,.55,.045,'#729b75',.04);label(cfd,'CAR FREE SUNDAY',2.15,.29,5.38,2.97,-1.618,'#fff0c8','#729b75',80);label(cfd,'walk · ride · sip · smile',1.9,.15,5.38,2.74,-1.615,'#e1e6b5','#729b75',58);
  const pasar=locationGroup('pasar');
  const umbrella=(x:number,z:number,color:string)=>{cyl(pasar,x,1.25,z,.035,.045,2.5,'#ac8e63',10);for(let i=0;i<10;i++){const m=mat(i%2?'#f3deb0':color).clone();m.side=THREE.DoubleSide;mesh(new THREE.ConeGeometry(1.13,.48,1,1,true,i*Math.PI/5,Math.PI/5),m,pasar,x,2.54,z);const a=i*Math.PI/5;ball(pasar,x+Math.sin(a)*1.09,2.3,z+Math.cos(a)*1.09,.13,.065,.13,i%2?'#f3deb0':color,8);}ball(pasar,x,2.81,z,.065,.075,.065,'#b6925e');};
  umbrella(-5.25,.4,'#d39678');umbrella(5.55,1.0,'#9eae78');
  for(const [x,z] of [[-5.25,.4],[5.55,1.0]]){box(pasar,x,.46,z,1.8,.82,.85,'#c49b64');for(let i=0;i<8;i++)box(pasar,x-.8+i*.23,.49,z+.45,.2,.75,.035,'#dab27a',.015);box(pasar,x,.92,z,1.95,.12,.96,'#eed19a',.04);basket(pasar,x-.47,.99,z,'guava',.77);basket(pasar,x+.43,.99,z,'orange',.77);label(pasar,x<0?'BUAH LOKAL':'SEGAR SETIAP HARI',1.45,.22,x,.57,z+.478,C.dark,'#e9cc8e',64);}
  line(pasar,[new THREE.Vector3(-6.4,3,-1.35),new THREE.Vector3(0,3.9,-2.2),new THREE.Vector3(6.7,3.1,-1.2)],.014,'#ac8e62');
  for(let i=0;i<12;i++){const xx=-6.1+i*1.1,yy=3.93-Math.abs(xx)*.13;mesh(new THREE.SphereGeometry(.075,10,8),glow,pasar,xx,yy,-1.75);}
  box(pasar,-5.25,1.65,-.1,1.64,.34,.05,'#9c7052');label(pasar,'PASAR PAGI',1.43,.25,-5.25,1.65,-.065,'#fff0cb','#9c7052',85);
  const festival=locationGroup('festival');
  for(const [x,z,fruit] of [[-5.2,.4,'pineapple'],[5.6,.5,'orange']] as const){cyl(festival,x,.25,z,.72,.81,.5,'#dca574',24);cyl(festival,x,.53,z,.76,.76,.08,'#f3d5a0',24);const sculpture=createFruit(fruit,fruit==='pineapple'?.6:.68);sculpture.position.set(x,fruit==='pineapple'?1.2:1.25,z);festival.add(sculpture);label(festival,'FESTIVAL BUAH',1.14,.18,x,.29,z+.746,C.dark,'#f4d8a9',72);}
  for(const side of [-1,1])for(let i=0;i<5;i++){const xx=side*(4.7+(i%2)*.38),yy=2.25+Math.floor(i/2)*.44,zz=1.3+(i%2)*.25;const balloon=ball(festival,xx,yy,zz,.23,.31,.23,['#efad8d','#d1ca7c','#9ebc91','#efcf80','#d59c9d'][i]);(balloon.material as THREE.MeshStandardMaterial)=mat(['#efad8d','#d1ca7c','#9ebc91','#efcf80','#d59c9d'][i],.38);const knot=mesh(new THREE.ConeGeometry(.035,.07,6),mat('#d7a778'),festival,xx,yy-.33,zz);knot.rotation.z=Math.PI;line(festival,[new THREE.Vector3(xx,yy-.35,zz),new THREE.Vector3(side*4.92,.72,1.4),new THREE.Vector3(side*4.95,.25,1.4)],.005,'#b59e71');}
  for(const side of [-1,1]){cyl(festival,side*3.7,1.75,-1.6,.045,.06,3.5,'#bb9160',10);ball(festival,side*3.7,3.56,-1.6,.1,.1,.1,'#e8bc6e');}
  const festivalCurve=[new THREE.Vector3(-3.7,3.5,-1.6),new THREE.Vector3(0,4.87,-1.9),new THREE.Vector3(3.7,3.5,-1.6)];line(festival,festivalCurve,.018,'#bba06c');
  for(let i=0;i<15;i++){const x=-3.5+i*.5,y=4.87-1.37*(Math.abs(x)/3.7)**1.5;const sh=new THREE.Shape();sh.moveTo(-.15,0);sh.lineTo(.15,0);sh.lineTo(0,-.37);sh.closePath();const pennant=mesh(new THREE.ShapeGeometry(sh),mat(['#df9f7b','#9ab28a','#efd187'][i%3]).clone(),festival,x,y,-1.77);(pennant.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;}
  label(festival,'P E S T A   B U A H',2.8,.37,0,4.81,-1.69,'#fff0cb','#829b68',84);
  for(const location of locations.values())compactDecoration(location);
  for(const display of fruitDisplays.values())compactDecoration(display);
  const sourceOutlines=new Map<string,THREE.Mesh>();
  for(const [id,display] of fruitDisplays){const outline=topOutline(display,.48,.36,'#eac45a',.01);outline.position.y=.069;outline.visible=false;sourceOutlines.set(id,outline);}

  const targets:Record<string,THREE.Object3D>={};
  const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false,side:THREE.DoubleSide});
  function target(id:string,parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number){const o=mesh(new THREE.BoxGeometry(w,h,d),hitMaterial,parent,x,y,z);o.name=id;o.userData.targetId=id;o.userData.interactionId=id;o.castShadow=false;o.receiveShadow=false;targets[id]=o;return o;}
  for(const [id,display] of fruitDisplays)target(`fruit-${id}`,display,0,.2,0,.51,.4,.4);
  target('board',boardContent,0,.12,0,.85,.35,.57);target('portions',boardContent,0,.13,0,.78,.32,.52);
  target('ice',iceBucket,0,.23,0,.43,.48,.43);for(const [id,bottle] of liquids)target(id,bottle,0,.24,0,.31,.53,.31);
  target('blender-control',blender,0,.13,-.25,.25,.21,.19);target('jar',jar,0,.36,0,.52,.75,.46);target('cup',cup,0,.25,0,.38,.55,.38);target('serve',stand,.25,1.55,2.0,.9,.85,.7);
  const dragVisual=new THREE.Group();stand.add(dragVisual);dragVisual.visible=false;
  const ingredientStream=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(0,.1,0),new THREE.Vector3(0,.2,0)]),8,.017,6,false),new THREE.MeshStandardMaterial({color:'#eef1d8',transparent:true,opacity:.8,roughness:.19}),stand);ingredientStream.visible=false;
  // A single coordinate frame keeps every tool, hit target and grip coherent
  // as the workstation is brought within the vendor's natural arm reach.
  const workGroup=new THREE.Group();workGroup.name='reachable-workstation';stand.add(workGroup);
  workGroup.add(cuttingBoard,boardGrip,boardDropFrame,boardContent,knifeRig,blender,cup,cupCoaster,iceBucket,premium,...liquids.values());workGroup.position.z=-.38;
  box(stand,-1.67,1.19,-.24,1.35,.2,.5,'#e9bb78',.065);const ingredientLedge=box(stand,-1.67,1.302,-.24,1.35,.035,.5,'#efd09a',.025);ingredientLedge.material=woodMaterial;
  // Bake the hundreds of little carved details into material batches. Animated
  // pieces and painted surfaces stay separate, so the miniature is cheap to draw.
  const keep=new Set<THREE.Object3D>([ground,blender,cup,boardDropFrame,cupCoaster,pourStream,bird,boardContent,knifeRig,spill,dragVisual,ingredientStream,iceBucket,...liquids.values(),...fruitDisplays.values(),...animatedLeaves,...changeable,...upgrades.values(),...locations.values()]);
  group.updateMatrixWorld(true);
  const batches=new Map<string,{material:THREE.Material,geometries:THREE.BufferGeometry[],originals:THREE.Mesh[]}>();
  group.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;let ancestor:THREE.Object3D|null=o;while(ancestor){if(keep.has(ancestor))return;ancestor=ancestor.parent;}if(o.material.transparent)return;
    let geo=o.geometry.clone();if(geo.index)geo=geo.toNonIndexed();geo.applyMatrix4(o.matrixWorld);const attributes=Object.keys(geo.attributes).sort().join(',');const key=o.material.uuid+attributes;
    if(!batches.has(key))batches.set(key,{material:o.material,geometries:[],originals:[]});const batch=batches.get(key)!;batch.geometries.push(geo);batch.originals.push(o);
  });
  for(const batch of batches.values()){if(batch.geometries.length<2){batch.geometries.forEach(g=>g.dispose());continue;}const geometry=mergeGeometries(batch.geometries,false);if(geometry){const baked=mesh(geometry,batch.material,group);baked.name='handcrafted-details';for(const o of batch.originals)o.removeFromParent();}batch.geometries.forEach(g=>g.dispose());}
  let lastStage='';let currentLocation='gang';let currentFruit='';let currentFruitIds=['orange'];
  let dragId:string|null=null,dragPosition:THREE.Vector3|null=null,dragKind='';
  const releasedDragOrigins=new Map<string,THREE.Vector3>();
  const colorFruit:Record<string,string>={'#ffb746':'mango','#bed583':'avocado','#ffa342':'orange','#f77989':'watermelon','#ec88a0':'strawberry','#f0a3a4':'guava','#efda9a':'banana','#ffc163':'pineapple'};
  function refreshFruit(id:string,color:string,ids=[id]) {
    currentFruitIds=ids;currentFruit=ids.join('|');boardWhole.clear();boardChunks.clear();fruitPieces.clear();
    ids.slice(0,3).forEach((species,i)=>{const whole=createFruit(species,ids.length>1?.13:.18);whole.position.set((i-(ids.length-1)*.5)*.23,.17,0);whole.rotation.set(.4,.3+i*.6,.15);boardWhole.add(whole);});
    for(let i=0;i<8;i++){
      const species=ids[i%ids.length];const piece=cutFruit(species,.14,color,i===0);piece.position.set((i%4-1.5)*.15,.055,(Math.floor(i/4)-.5)*.17);piece.rotation.y=i*.9;boardChunks.add(piece);
      const jarPiece=cutFruit(species,.09,color);jarPiece.position.set((rand(i+2)-.5)*.22,.09+rand(i+7)*.37,(rand(i+18)-.5)*.22);jarPiece.rotation.set(i,.4*i,i*.7);jarPiece.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial){o.material=o.material.clone();o.userData.fruitColor=o.material.color.getHex();}});fruitPieces.add(jarPiece);
    }
    dragKind='';
  }
  function populateDrag(kind:string,color:string){if(dragKind===kind)return;dragKind=kind;dragVisual.clear();
    if(kind.startsWith('fruit-')){const fruit=createFruit(kind.slice(6),.19);fruit.rotation.y=Math.PI;dragVisual.add(fruit);}
    else if(kind==='portions'){for(let i=0;i<4;i++){const f=cutFruit(currentFruitIds[i%currentFruitIds.length],.13,color);f.position.set((i%2-.5)*.13,(Math.floor(i/2))*.075,(Math.floor(i/2)-.5)*.13);f.rotation.y=i*.8;dragVisual.add(f);}}
    else if(kind==='ice'){for(let i=0;i<3;i++){const cube=box(dragVisual,(i-1)*.07,i%2*.07,0,.08,.08,.08,'#e7f0df',.015);cube.material=iceMaterial;cube.rotation.set(i,.5*i,.3*i);}}
    else {const source=liquids.get(kind);if(source){const bottle=source.clone(true);bottle.position.set(0,0,0);bottle.visible=true;bottle.traverse(o=>{if(o.userData.targetId)o.visible=false;});dragVisual.add(bottle);}}
  }
  function setDrag(id:string|null,position:THREE.Vector3|null){
    if(position)dragPosition=position.clone();
    if(!id){if(dragId&&dragPosition)releasedDragOrigins.set(dragId,dragPosition.clone());dragPosition=null;dragId=null;return;}
    dragId=id==='portion'?'portions':id;
  }
  function update(time:number,stage='idle',progress=0,color='#f4bc50',fruitId?:string) {
    const filling=Math.min(1,Math.max(0,progress));
    jarDropRing.visible=false;dropArrow.visible=false;boardOutline.visible=false;for(const outline of sourceOutlines.values())outline.visible=false;

    const selectedFruit=fruitId==='tropical'?'pineapple':fruitId||colorFruit[color.toLowerCase()]||'orange';if(selectedFruit!==currentFruit)refreshFruit(selectedFruit,color);
    for(let i=0;i<animatedLeaves.length;i++)animatedLeaves[i].rotation.z=Math.sin(time*.55+i)*.009;
    bird.rotation.y=Math.sin(time*.45)*.24;
    if(lastStage!==stage)lastStage=stage;
    const hasLoaded=['loaded','blend','blended','pour','ready','serve','done'].includes(stage);
    const hasBlended=['blend','blended','pour','ready','serve','done'].includes(stage);
    const hasPoured=['ready','serve','done'].includes(stage);
    fruitPieces.visible=stage==='add'||stage==='loaded'||(stage==='blend'&&filling<.78);
    boardContent.visible=['idle','select','cut','add'].includes(stage);
    boardWhole.visible=stage==='idle'||stage==='select'||(stage==='cut'&&filling<.54);
    boardWhole.scale.setScalar(stage==='cut'?1-Math.min(.6,filling):1);
    knifeRig.position.set(.12,1.414,.84);knifeRig.rotation.set(0,-.3,0);
    if(stage==='cut'){const chop=Math.abs(Math.sin(filling*Math.PI*7));knifeRig.position.set(-.15+filling*.36,1.45+chop*.19,.84);knifeRig.rotation.z=-.4+chop*.35;}
    (liquid.material as THREE.MeshStandardMaterial).color.set(color);(cupLiquid.material as THREE.MeshStandardMaterial).color.set(color);(pourStream.material as THREE.MeshStandardMaterial).color.set(color);
    liquid.visible=hasLoaded||stage==='add';
    (liquid.material as THREE.MeshStandardMaterial).opacity=hasBlended?.94:.45;
    liquid.scale.y=stage==='add'?.22+.42*filling:stage==='loaded'?.66:stage==='pour'?Math.max(.025,1-filling):hasPoured?.025:1;liquid.position.y=.05+.22*liquid.scale.y;
    swirl.visible=stage==='blend';swirl.rotation.y=time*14;
    for(let i=0;i<swirl.children.length;i++)swirl.children[i].position.y=.495-i*.018+Math.sin(time*14+i)*.005;
    bubbles.visible=stage==='blend';for(let i=0;i<bubbles.children.length;i++){const bubble=bubbles.children[i];const angle=time*(2+i*.11)+i*2.4;bubble.position.set(Math.cos(angle)*(.06+rand(i)*.07),.06+((time*.21+i*.078)%.43),Math.sin(angle)*(.06+rand(i)*.07));}
    blender.rotation.z=stage==='blend'?Math.sin(time*68)*.009:0;
    jar.rotation.z=stage==='pour'?-1.05*Math.min(1,filling*5):0;
    jar.position.x=stage==='pour'?.04:0;jar.position.y=.34+(stage==='pour'?.2:0);jar.position.z=stage==='pour'?-.15:0;lid.visible=stage!=='pour'&&stage!=='add';
    if(stage==='blend'){liquid.scale.x=1+Math.sin(time*25)*.02;liquid.scale.z=1-Math.sin(time*25)*.02;liquid.rotation.y=time*4;}
    else {liquid.scale.x=liquid.scale.z=1;}
    for(let i=0;i<fruitPieces.children.length;i++){
      const f=fruitPieces.children[i],boardPiece=boardChunks.children[i];const target=new THREE.Vector3((rand(i+2)-.5)*.22,.09+rand(i+7)*.37,(rand(i+18)-.5)*.22);
      boardPiece.visible=stage==='cut'&&filling>.10+i*.075;f.visible=true;f.scale.setScalar(1);
      if(stage==='add'){
        const t=THREE.MathUtils.clamp((filling-i*.065)/.49,0,1);boardPiece.visible=t===0;f.visible=t>0;
        const start=new THREE.Vector3(-.96+(i%4-1.5)*.12,-.265+.043,.12+(Math.floor(i/4)-.5)*.13);
        f.position.copy(start).lerp(target,t);f.position.y+=Math.sin(t*Math.PI)*.78;f.rotation.set(t*3+i,t*4+i,t*2+i);
      } else if(stage==='blend'){
        const angle=time*(8+i*.3)+i*2.4,r=.05+rand(i)*.09;f.position.set(Math.cos(angle)*r,.13+((time*.19+i*.06)%.27),Math.sin(angle)*r);f.rotation.set(time*6+i,time*4+i,time*5);f.scale.setScalar(Math.max(.08,1-filling*1.2));
      } else {f.position.copy(target);f.rotation.set(i,.4*i,i*.7);}
    }
    pourStream.visible=stage==='pour'&&filling>.13&&filling<.96;
    if(pourStream.visible){
      jar.updateWorldMatrix(true,false);cup.updateWorldMatrix(true,false);stand.updateWorldMatrix(true,false);
      const start=stand.worldToLocal(jar.localToWorld(new THREE.Vector3(.21,.625,0)));
      const end=stand.worldToLocal(cup.localToWorld(new THREE.Vector3(0,.39,0)));
      const mid=start.clone().lerp(end,.5);mid.y+=.04;
      const curve=new THREE.CatmullRomCurve3([start,mid,end]);
      pourStream.geometry.dispose();pourStream.geometry=new THREE.TubeGeometry(curve,12,.024+Math.sin(time*25)*.002,7,false);
    }
    pourStream.scale.x=1+Math.sin(time*32)*.008;pourStream.scale.z=1+Math.sin(time*24)*.03;
    cupLiquid.visible=stage==='pour'||hasPoured;cupLiquid.scale.y=stage==='pour'?Math.max(.02,filling):1;cupLiquid.position.y=.025+.185*cupLiquid.scale.y;straw.visible=hasPoured;
    cup.position.set(1.62,1.33,.84);cup.rotation.set(0,0,0);
    if(stage==='serve'){cup.position.lerp(new THREE.Vector3(.15,1.4,2.02),filling);cup.position.y+=Math.sin(filling*Math.PI)*.21;cup.rotation.z=Math.sin(filling*Math.PI)*.035;}
    if(stage==='done')cup.position.set(.15,1.4,2.02);
    liquidSurface.visible=liquid.visible;liquidSurface.position.y=.05+.44*liquid.scale.y;jarIce.visible=false;jarFoam.visible=false;cupFoam.visible=cupLiquid.visible;cupFoam.position.y=.025+.37*cupLiquid.scale.y;spill.visible=false;cuttingGuide.visible=false;dragVisual.visible=false;ingredientStream.visible=false;
  }
  let previousHandsTime=0,vortexEnergy=0,motorAngle=0,jarLift=0,jarTilt=0;
  const finalJuice=new THREE.Color(),liquidTint=new THREE.Color(),sourceTint=new THREE.Color();
  function updateHandsOn(time:number,state:PrepState,color:string,fruitId:string,modifier:string) {
    const dt=Math.min(.05,Math.max(0,time-previousHandsTime));previousHandsTime=time;
    const phase=state.phase,ids=state.selectedFruits.length?state.selectedFruits:[fruitId==='tropical'?'pineapple':fruitId];
    const pulse=.5+.5*Math.sin(time*3.1);
    for(const [id,outline] of sourceOutlines){outline.visible=phase==='select'&&state.requiredFruits.includes(id)&&!state.selectedFruits.includes(id);(outline.material as THREE.MeshBasicMaterial).opacity=.55+pulse*.3;outline.scale.setScalar(1+pulse*.022);}
    boardOutline.visible=['select','cut','load'].includes(phase);(boardOutline.material as THREE.MeshBasicMaterial).color.set(phase==='select'?'#c9df8b':phase==='cut'?'#fff1c4':'#efca68');(boardOutline.material as THREE.MeshBasicMaterial).opacity=dragId?.startsWith('fruit-')?.95:.47+pulse*.17;
    jarDropRing.visible=phase==='load';(jarDropRing.material as THREE.MeshBasicMaterial).opacity=dragId?.92:.48+pulse*.25;jarDropRing.scale.setScalar(1+pulse*.035);
    dropArrow.visible=phase==='load';dropArrow.position.y=.84+pulse*.045;dropArrow.scale.setScalar(dragId?1:.8);

    const fruitKey=ids.join('|');if(currentFruit!==fruitKey)refreshFruit(ids[0],color,ids);
    for(let i=0;i<animatedLeaves.length;i++)animatedLeaves[i].rotation.z=Math.sin(time*.55+i)*.009;
    bird.rotation.y=Math.sin(time*.45)*.24;
    const sliceActive=state.lastAction==='slice'&&state.actionAge<.36;
    const cutCount=Math.max(0,state.cuts-(sliceActive&&state.gesture<.48?1:0));
    const cutPieces=Math.floor(cutCount/state.cutsRequired*8);
    boardContent.visible=['select','cut','load'].includes(phase);
    boardWhole.visible=state.selectedFruits.length>0&&cutCount<3;
    for(let i=0;i<boardWhole.children.length;i++)boardWhole.children[i].visible=!(state.lastAction==='pick'&&state.actionAge<.48&&i===state.selectedFruits.length-1);
    boardWhole.scale.set(1-cutCount*.25,1,1);boardWhole.position.x=-cutCount*.035;
    cuttingGuide.visible=phase==='cut';cuttingGuide.position.x=.16-cutCount*.14;
    knifeRig.position.set(-.04,1.415,.43);knifeRig.rotation.set(Math.PI/2,0,-.2);
    if(sliceActive){
      const g=state.gesture,raise=THREE.MathUtils.smoothstep(g,0,.25),strike=THREE.MathUtils.smoothstep(g,.25,.6),recover=THREE.MathUtils.smoothstep(g,.7,1);
      knifeRig.rotation.set(Math.PI/2*recover,0,-.28+strike*.34-recover*.26);
      knifeRig.position.set(THREE.MathUtils.lerp(-.62+(state.cuts-1)*.11,-.04,recover),1.415+(raise-strike)*.24+Math.sin(recover*Math.PI)*.035,THREE.MathUtils.lerp(.46+strike*.18,.43,recover));
    }

    for(let i=0;i<boardChunks.children.length;i++){
      const piece=boardChunks.children[i];piece.visible=i<cutPieces&&i>=state.loadedPortions*4;
      if(dragId==='portions'&&i>=state.loadedPortions*4&&i<(state.loadedPortions+1)*4)piece.visible=false;
      piece.position.set((i%4-1.5)*.15,.055,(Math.floor(i/4)-.5)*.17);piece.rotation.z=0;
      if(sliceActive&&i>=Math.floor(Math.max(0,cutCount-1)/3*8)){const bounce=Math.sin(THREE.MathUtils.clamp((state.gesture-.42)/.58,0,1)*Math.PI)*.035;piece.position.y+=bounce;piece.position.x+=Math.sin(i*2.4)*bounce;piece.rotation.z=Math.sin(i*1.8)*bounce*.8;}
    }
    // No animation here changes the preparation result: these poses render input state.
    const transferActive=state.lastAction==='load'&&state.transfer<1;
    const settled=Math.max(0,state.loadedPortions-(transferActive?1:0));
    const smoothness=THREE.MathUtils.clamp(state.blendSeconds/3.15,0,1);
    const holdingBlend=phase==='blend'&&state.blendHeld;
    vortexEnergy=THREE.MathUtils.damp(vortexEnergy,holdingBlend?1:0,holdingBlend?10:5,dt);
    motorAngle+=dt*vortexEnergy*44;blades.rotation.y=motorAngle;controlKnob.rotation.z=THREE.MathUtils.damp(controlKnob.rotation.z,holdingBlend?-1.1:0,18,dt);
    blender.rotation.z=Math.sin(time*76)*.006*vortexEnergy;
    blender.position.set(.65,1.33,.75);
    jarTilt=THREE.MathUtils.damp(jarTilt,phase==='pour'?state.tilt:0,20,dt);
    if(jarTilt<.0001)jarTilt=0;
    jarLift=THREE.MathUtils.smoothstep(jarTilt,0,.62);
    jar.rotation.set(0,0,-jarTilt*1.23);
    jar.position.set(.08*jarLift,.34+.10*jarLift,.30*jarLift);
    lid.visible=phase==='blend';
    if(!['serve','react','done'].includes(phase)){cup.position.set(1.5,1.33,.75);cup.rotation.set(0,0,0);}
    jar.updateWorldMatrix(true,false);stand.updateWorldMatrix(true,false);
    fruitPieces.visible=state.loadedPortions>0&&smoothness<.99&&state.remaining>.035;
    for(let i=0;i<fruitPieces.children.length;i++){
      const f=fruitPieces.children[i],targetPos=new THREE.Vector3((rand(i+2)-.5)*.22,.095+rand(i+7)*.25,(rand(i+18)-.5)*.22);
      f.visible=i<settled*4;f.scale.setScalar(1-smoothness*.94);f.position.copy(targetPos);f.rotation.set(i,.4*i,i*.7);
      if(transferActive&&i>=settled*4&&i<state.loadedPortions*4){
        f.visible=true;const p=THREE.MathUtils.clamp((state.transfer-(i%4)*.045)/.86,0,1);
        const start=releasedDragOrigins.has('portions')?jar.worldToLocal(releasedDragOrigins.get('portions')!.clone()):jar.worldToLocal(boardContent.localToWorld(new THREE.Vector3(0,.11,0)));
        const opening=new THREE.Vector3((i%2-.5)*.08,.8,(Math.floor(i%4/2)-.5)*.08);
        if(p<.55){const q=THREE.MathUtils.smoothstep(p,0,.55);f.position.copy(start).lerp(opening,q);f.position.y+=Math.sin(q*Math.PI)*.16;}else {const q=THREE.MathUtils.smoothstep(p,.55,1);f.position.copy(opening).lerp(targetPos,q);f.position.y+=Math.sin(q*Math.PI)*.045;}
        f.rotation.set(p*4+i,p*3+i,p*2+i);
      } else if(state.blendSeconds>0&&i<state.loadedPortions*4){
        const a=state.blendSeconds*(8+i*.31)+i*2.4,r=.05+rand(i)*.09;f.position.set(Math.cos(a)*r,.13+((state.blendSeconds*.19+i*.06)%.27)*state.remaining,Math.sin(a)*r);f.rotation.set(state.blendSeconds*6+i,state.blendSeconds*4+i,state.blendSeconds*5);
      }
      f.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial&&o.userData.fruitColor!==undefined){sourceTint.setHex(o.userData.fruitColor);o.material.color.copy(sourceTint).lerp(finalJuice.set(color),smoothness*.8);}});
    }
    finalJuice.set(color);const milky=state.liquidType==='milk'||(!state.liquidType&&modifier!=='Tanpa susu'&&['avocado','banana','strawberry'].includes(fruitId));
    liquidTint.set(milky?'#f4ead2':'#dae5cd').lerp(finalJuice,smoothness);
    const afterBlend=['pour','ready','serve','react','done'].includes(phase);
    const addedVolume=Math.min(1,.08+state.loadedPortions*.22+(state.liquidAdded?.43:0)+(state.iceAdded?.05:0));
    const liquidLevel=afterBlend?state.remaining:addedVolume;
    liquid.visible=state.liquidAdded&&liquidLevel>.005;
    const liquidMat=liquid.material as THREE.MeshStandardMaterial;liquidMat.color.copy(liquidTint);liquidMat.opacity=milky?.76+smoothness*.2:.32+smoothness*.64;
    liquid.scale.set(1,Math.max(.005,liquidLevel),1);liquid.position.y=.05+.22*liquidLevel;liquid.rotation.set(0,0,0);
    liquidSurface.visible=liquid.visible;liquidSurface.position.y=.05+.44*liquidLevel;liquidSurface.scale.setScalar(.84+.16*liquidLevel);
    const surfaceMat=liquidSurface.material as THREE.MeshStandardMaterial;surfaceMat.color.copy(liquidTint);surfaceMat.opacity=liquidMat.opacity;
    const surface=surfaceGeometry.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<surface.count;i++){const x=surfaceVertices[i*3],z=surfaceVertices[i*3+2],r=Math.sqrt(x*x+z*z)/.191,a=Math.atan2(z,x);surface.setY(i,-Math.pow(1-r,1.5)*.105*vortexEnergy+Math.sin(a*3+state.blendSeconds*15)*r*.007*vortexEnergy+x*jarTilt*.1);}
    surface.needsUpdate=true;surfaceGeometry.computeVertexNormals();
    swirl.visible=vortexEnergy>.05&&liquid.visible;swirl.rotation.y=state.blendSeconds*15;swirl.position.y=liquidSurface.position.y-.49;
    for(let i=0;i<swirl.children.length;i++)swirl.children[i].position.y=.495-i*.02*vortexEnergy;
    bubbles.visible=holdingBlend;for(let i=0;i<bubbles.children.length;i++){const bubble=bubbles.children[i],a=state.blendSeconds*(3+i*.1)+i*2.4;bubble.position.set(Math.cos(a)*(.055+rand(i)*.07),.08+((state.blendSeconds*.24+i*.079)%.36),Math.sin(a)*(.055+rand(i)*.07));}
    jarFoam.visible=state.liquidAdded&&smoothness>.22&&state.remaining>.06;jarFoam.position.y=liquidSurface.position.y+.005;
    jarFoam.scale.setScalar(.65+smoothness*.35);
    jarIce.visible=state.iceAdded&&smoothness<.87;for(let i=0;i<jarIce.children.length;i++){const cube=jarIce.children[i],a=i*2.4+state.blendSeconds*5;cube.position.set(Math.cos(a)*.10,.16+i*.043,Math.sin(a)*.10);cube.scale.setScalar(1-smoothness*.8);
      if(state.lastAction==='ice'&&state.transfer<1){const p=THREE.MathUtils.clamp((state.transfer-i*.035)/.83,0,1),start=releasedDragOrigins.has('ice')?jar.worldToLocal(releasedDragOrigins.get('ice')!.clone()):jar.worldToLocal(iceBucket.localToWorld(new THREE.Vector3(0,.4,0)));cube.position.copy(start).lerp(new THREE.Vector3(0,.73,0),THREE.MathUtils.smoothstep(p,0,.55));if(p>.55)cube.position.lerp(new THREE.Vector3(Math.cos(a)*.1,.16+i*.043,Math.sin(a)*.1),THREE.MathUtils.smoothstep(p,.55,1));cube.position.y+=Math.sin(p*Math.PI)*.15;cube.rotation.set(i+p*.6,i*.9+p,i*.35+p*.3);}}
    dragVisual.visible=false;ingredientStream.visible=false;for(const bottle of liquids.values())bottle.visible=true;
    if(dragId&&dragPosition&&!['jar','cup'].includes(dragId)){
      populateDrag(dragId,color);dragVisual.visible=true;dragVisual.position.copy(stand.worldToLocal(dragPosition.clone()));dragVisual.rotation.set(0,0,0);if(liquids.has(dragId))liquids.get(dragId)!.visible=false;
    } else if(state.lastAction==='liquid'&&state.transfer<1){
      const kind=state.liquidType||'water';populateDrag(kind,color);const bottle=liquids.get(kind)!;bottle.visible=false;const p=state.transfer,start=releasedDragOrigins.has(kind)?stand.worldToLocal(releasedDragOrigins.get(kind)!.clone()):stand.worldToLocal(bottle.localToWorld(new THREE.Vector3(0,.2,0)));
      const pourPosition=stand.worldToLocal(workGroup.localToWorld(new THREE.Vector3(.38,2.38,.75)));
      const returnPosition=stand.worldToLocal(bottle.localToWorld(new THREE.Vector3())),approach=THREE.MathUtils.smoothstep(p,0,.32),returning=THREE.MathUtils.smoothstep(p,.76,1);
      dragVisual.visible=true;dragVisual.position.copy(start).lerp(pourPosition,approach).lerp(returnPosition,returning);dragVisual.position.y+=Math.sin(p*Math.PI)*.08;dragVisual.rotation.set(0,0,-.95*THREE.MathUtils.smoothstep(p,.16,.38)*(1-returning));

      if(p>.35&&p<.76){dragVisual.updateWorldMatrix(true,false);const startPoint=stand.worldToLocal(dragVisual.localToWorld(new THREE.Vector3(.03,.48,0))),endPoint=stand.worldToLocal(jar.localToWorld(new THREE.Vector3(0,.23,0))),mid=startPoint.clone().lerp(endPoint,.5);mid.y+=.04;ingredientStream.geometry.dispose();ingredientStream.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([startPoint,mid,endPoint]),10,.014,6,false);(ingredientStream.material as THREE.MeshStandardMaterial).color.set(milky?'#f2e7c8':'#dfead7');ingredientStream.visible=true;}
    }
    const fill=THREE.MathUtils.clamp(state.fill,0,1);cupLiquid.visible=fill>.003;cupLiquid.scale.set(1,Math.max(.003,fill),1);cupLiquid.position.y=.025+.185*fill;(cupLiquid.material as THREE.MeshStandardMaterial).color.copy(finalJuice);
    cupFoam.visible=fill>.05;cupFoam.position.y=.028+.37*fill;cupFoam.scale.setScalar(.7+fill*.3);cupFoam.rotation.y=Math.sin(time*1.7)*.035*state.flow;cupFoam.position.y+=Math.sin(time*13)*Math.min(.007,state.flow*.012);straw.visible=['ready','serve','react','done'].includes(phase);
    pourStream.visible=phase==='pour'&&state.pouringHeld&&state.tilt>.2&&state.flow>.005&&state.remaining>.003;
    (pourStream.material as THREE.MeshStandardMaterial).color.copy(finalJuice);pourStream.scale.set(1,1,1);
    if(pourStream.visible){jar.updateWorldMatrix(true,false);cup.updateWorldMatrix(true,false);const start=stand.worldToLocal(jar.localToWorld(new THREE.Vector3(.32,.63,0))),end=stand.worldToLocal(cup.localToWorld(new THREE.Vector3(0,.035+.37*fill,0))),mid=start.clone().lerp(end,.45);mid.x+=.055;mid.y+=.03;pourStream.geometry.dispose();pourStream.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start,mid,end]),15,.018+Math.min(.012,state.flow*.028),8,false);}
    const cupStation=stand.worldToLocal(workGroup.localToWorld(new THREE.Vector3(1.5,1.328,.75)));
    spill.visible=state.spilled>.001;(puddle.material as THREE.MeshPhysicalMaterial).color.copy(finalJuice);const wet=Math.min(.46,Math.sqrt(state.spilled)*.7);puddle.scale.set(wet*1.35,wet,1);puddle.position.copy(cupStation);
    spillDrops.visible=pourStream.visible&&state.fill>.985;for(let i=0;i<spillDrops.children.length;i++){const drop=spillDrops.children[i],p=(time*1.7+i*.091)%1,a=i*2.4;drop.position.set(cupStation.x+Math.cos(a)*(.12+p*.12),1.75-p*.41,cupStation.z+Math.sin(a)*(.12+p*.12));(drop as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.color.copy(finalJuice);}
  }
  function setUpgrades(ids:string[]) {for(const [id,u] of upgrades)u.visible=ids.includes(id);}
  function setLocation(id:string) {
    currentLocation=locations.has(id)?id:'gang';for(const [key,themeGroup] of locations)themeGroup.visible=key===currentLocation;
    const themes:Record<string,{edge:string,paving:string,coral:string,mint:string}>={gang:{edge:'#b9c9a0',paving:'#f0dfbf',coral:'#edaa94',mint:'#a9ceba'},cfd:{edge:'#9ab494',paving:'#e3dec0',coral:'#e6b59b',mint:'#99c1b0'},pasar:{edge:'#c3ba8b',paving:'#ecd2a7',coral:'#dca080',mint:'#b7c596'},festival:{edge:'#bac48f',paving:'#f2ddad',coral:'#e7a894',mint:'#b5cba2'}};
    const theme=themes[currentLocation];(ground.material as THREE.MeshStandardMaterial).color.set(theme.edge);mat('#f0dfbf').color.set(theme.paving);mat(C.coral).color.set(theme.coral);mat(C.mint).color.set(theme.mint);
  }
  function setStandColor(color:string) {for(const o of changeable){o.material=(o.material as THREE.MeshStandardMaterial).clone();(o.material as THREE.MeshStandardMaterial).color.set(color);}void currentLocation;}
  update(0);
  const getJarRim=()=>{jar.updateWorldMatrix(true,false);return jar.localToWorld(new THREE.Vector3(.32,.63,0));};
  const getJarGrip=()=>{jar.updateWorldMatrix(true,false);return jar.localToWorld(new THREE.Vector3(.38,.23,0));};
  const getKnifeGrip=()=>{knifeRig.updateWorldMatrix(true,false);return knifeRig.localToWorld(new THREE.Vector3(.235,.105,0));};
  const getCupGrip=()=>{cup.updateWorldMatrix(true,false);return cup.localToWorld(new THREE.Vector3(.13,.22,0));};
  return {group,blender,jar,liquid,cup,cupLiquid,fruitPieces,pourStream,knife:knifeRig,board:boardContent,targets,workGroup,workOffset:-.38,getJarRim,getJarGrip,getKnifeGrip,getCupGrip,update,updateHandsOn,setDrag,setUpgrades,setLocation,setStandColor};
}
