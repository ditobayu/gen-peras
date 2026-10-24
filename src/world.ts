import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
function seeded(i:number) {return (Math.sin(i*127.1+311.7)*43758.5453)%1;}
function rand(i:number) {return Math.abs(seeded(i));}
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
  return g;
}

function cutFruit(id:string,size:number,color:string) {
  const g=new THREE.Group();
  const flesh:Record<string,string>={mango:'#ffc65a',avocado:'#d7e593',orange:'#ffc06a',watermelon:'#f57d87',strawberry:'#ee8399',guava:'#efafa6',banana:'#f6e6b5',pineapple:'#f7d06a',tropical:'#f7d06a'};
  const peel:Record<string,string>={mango:'#e9a43c',avocado:'#6b8b4d',orange:'#e89c3c',watermelon:'#6f9c58',strawberry:'#cc5e79',guava:'#b2c871',banana:'#d4bb77',pineapple:'#cda04b',tropical:'#cda04b'};
  if(id==='banana'){cyl(g,0,0,0,size*.46,size*.46,size*.48,flesh[id],12);for(let i=0;i<3;i++)ball(g,Math.cos(i*2.1)*size*.14,size*.25,Math.sin(i*2.1)*size*.14,size*.035,size*.008,size*.035,'#baa377',6);}
  else {box(g,0,0,0,size*.85,size*.65,size*.72,flesh[id]||color,size*.15);box(g,0,-size*.32,0,size*.84,size*.09,size*.71,peel[id]||'#d6aa57',size*.025);
    if(id==='watermelon'||id==='strawberry'||id==='guava')for(let i=0;i<3;i++)ball(g,(i-1)*size*.2,size*.33,size*.04,size*.025,size*.009,size*.045,id==='watermelon'?'#6d5b45':'#ecd39f',6);
    if(id==='orange'){for(let i=0;i<3;i++)box(g,(i-1)*size*.22,size*.332,0,size*.012,size*.008,size*.56,'#ffedb5',.001);}
  }
  return g;
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
  // A small, tactile island, with individual paving stones and pockets of greenery.
  const ground=cyl(group,0,-.22,0,9.2,9.3,.42,'#b9c9a0',96);ground.receiveShadow=true;
  cyl(group,0,-.015,0,9.18,9.18,.05,'#f0dfbf',96);
  box(group,.1,.018,2.65,13,.035,2.8,'#e1caa4',.15);
  for(let i=0;i<15;i++)for(let j=0;j<4;j++){const x=-6.5+i*.9+(j%2)*.4,z=1.6+j*.68;box(group,x,.044,z,.85,.045,.61,(i+j)%4===0?'#d1bc9a':(i+j)%3===0?'#ead6b3':'#ddc8a5',.045);}
  for(let i=0;i<30;i++){const a=i*2.399,r=5+rand(i+47)*3.4;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(z>1.1&&z<4)continue;ball(group,x,.035,z,.13+rand(i)*.13,.07,.12,'#c4b99c',8);}
  const grassPatch=(x:number,z:number,w:number,d:number)=>{box(group,x,.015,z,w,.06,d,'#b9c391',.15);for(let i=0;i<20;i++){const xx=x+(rand(i+10)-.5)*w,zz=z+(rand(i+30)-.5)*d;for(let j=0;j<3;j++)leaf(group,xx,.14,zz,.15,'#95ad70',(j-1)*.4,i*1.1);}};
  grassPatch(-5.6,-1.5,2.5,3.5);grassPatch(5.7,-1.5,2.7,3.7);grassPatch(0,-5.7,5,2);
  house(group,-4.7,-5.25,3.5,3.35,C.coral);house(group,.1,-6.1,3.8,3.0,C.mint,'#9f9c78');house(group,5.1,-5.0,3.6,3.75,'#e5ce8f');
  label(group,'TOKO BUNGA',1.5,.29,-4.7,2.83,-4.11,'#f7e8c7','#bb775f',75);
  label(group,'WARUNG IBU',1.5,.29,5.1,3.2,-3.86,'#fff0cd','#788d6a',75);
  // Telephone wire, tiny hanging lanterns, and the sleepy village behind the stand.
  for(const x of [-7.5,7.1]){cyl(group,x,2.4,-3.1,.075,.1,4.8,'#9b8561',10);bar(group,new THREE.Vector3(x-.5,4.25,-3.1),new THREE.Vector3(x+.5,4.25,-3.1),.045,'#8b7657');}
  line(group,[new THREE.Vector3(-7.5,4.3,-3.1),new THREE.Vector3(0,3.72,-3.1),new THREE.Vector3(7.1,4.3,-3.1)],.017,'#6d7660');
  for(let i=0;i<10;i++){const x=-6.6+i*1.4,y=3.72+.58*(x/7.5)**2;cyl(group,x,y-.1,-3.1,.09,.09,.18,'#f0bd71',12);cyl(group,x,y+.005,-3.1,.1,.1,.035,'#8b8060');}
  animatedLeaves.push(palm(group,-6.5,-2.4,1.23),palm(group,6.4,-2.9,1.28),palm(group,4.1,-2.65,.88,true),palm(group,-4.1,-3.2,.85,true));
  scooter(group,4.8,-2.0,'#dca285',-.26);scooter(group,-5.8,-2.65,'#8ba99e',.4);
  // The wooden juice cart, generous counter and painted tongue-and-groove front.
  const stand=new THREE.Group();group.add(stand);stand.name='juice-stand';
  for(const x of [-1.92,1.92])for(const z of [-.76,.79]){const tire=cyl(stand,x,.29,z,.28,.28,.16,'#50634c',20);tire.rotation.x=Math.PI/2;const hub=cyl(stand,x,.29,z+.09,.13,.13,.025,'#e7d7ac',16);hub.rotation.x=Math.PI/2;}
  box(stand,0,.62,.17,4.55,1.02,1.9,C.green,.1);
  for(let i=0;i<16;i++){const o=box(stand,-2.13+i*.284,.65,1.14,.255,.93,.065,i%2?C.green:'#3b8d57',.018);changeable.push(o);}
  box(stand,0,.22,1.2,4.65,.16,.12,C.dark,.03);box(stand,0,1.09,1.21,4.7,.1,.15,C.lime,.025);
  box(stand,0,1.19,.17,4.9,.2,2.13,'#e9bb78',.09);box(stand,0,1.302,.18,4.88,.035,2.1,'#efd09a',.03);
  for(let i=0;i<5;i++)box(stand,-2+i*.95,1.323,.18,.012,.006,2.0,'#d8b57e',.002);
  const frontSign=label(stand,'SQUEEZED WITH LOVE',2.8,.36,0,.68,1.192,C.cream,C.green,65);frontSign.position.z=1.196;
  label(stand,'BUAH SEGAR · HATI SENANG',2.55,.19,0,.36,1.202,'#dce6ad',C.green,52);
  // Two slim rear uprights leave the little vendor fully visible.
  for(const x of [-2.26,2.26]){cyl(stand,x,2.06,-.75,.063,.07,3.58,C.dark,12);cyl(stand,x,2.16,1.05,.047,.053,2.65,C.dark,12);ball(stand,x,3.62,-.75,.11,.11,.11,'#f4d68d');}
  for(const z of [-1.36,1.43])bar(stand,new THREE.Vector3(-2.65,3.54,z),new THREE.Vector3(2.65,3.54,z),.036,C.dark);
  // Curved, alternating canvas panels with a separate scalloped hem.
  const strips=16,width=5.3/strips;
  for(let i=0;i<strips;i++){
    const pos:number[]=[],uv:number[]=[],idx:number[]=[];for(let j=0;j<=18;j++){const t=j/18,z=-1.43+t*2.86,y=3.55+Math.sin(t*Math.PI)*.4;for(let side=0;side<2;side++){pos.push(-2.65+(i+side)*width,y,z);uv.push(side,t);}if(j<18){const n=j*2;idx.push(n,n+2,n+1,n+1,n+2,n+3);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const m=mat(i%2?'#f7e9bc':'#76a25c').clone();m.side=THREE.DoubleSide;mesh(geo,m,stand);
    const sh=new THREE.Shape();sh.moveTo(-width*.5,0);sh.lineTo(width*.5,0);sh.lineTo(width*.5,-.13);sh.quadraticCurveTo(0,-.43,-width*.5,-.13);sh.closePath();mesh(new THREE.ExtrudeGeometry(sh,{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1}),m,stand,-2.65+(i+.5)*width,3.55,1.435);
    line(stand,[new THREE.Vector3(-2.65+i*width,3.56,-1.43),new THREE.Vector3(-2.65+i*width,3.96,0),new THREE.Vector3(-2.65+i*width,3.56,1.43)],.009,'#e8d8a4');
  }
  const logo=new THREE.Group();stand.add(logo);logo.position.set(0,4.34,.03);box(logo,0,0,0,2.15,.71,.13,C.dark,.15);box(logo,0,0,.075,2.04,.6,.055,C.cream,.13);
  for(const x of [-.72,.72])bar(stand,new THREE.Vector3(x,3.85,.02),new THREE.Vector3(x,4.12,.02),.035,C.dark);
  const logoTex=canvasTexture(1024,350,c=>{c.fillStyle=C.cream;c.fillRect(0,0,1024,350);c.textAlign='center';c.textBaseline='middle';c.fillStyle=C.dark;c.font='900 240px Fredoka, Arial, sans-serif';c.fillText('PERAS!',512,171);c.fillStyle='#b79443';c.font='bold 33px Arial, sans-serif';c.letterSpacing='9px';c.fillText('FRESHLY SQUEEZED HAPPINESS',512,305);});
  mesh(new THREE.PlaneGeometry(1.95,.59),new THREE.MeshStandardMaterial({map:logoTex,roughness:1}),logo,0,0,.108);
  pennants(stand);
  // Produce: little woven crates, one of every recipe fruit, and paper price tags.
  basket(stand,-1.68,1.33,.77,'orange',.6);basket(stand,-.98,1.33,.77,'mango',.6);basket(stand,-1.65,1.33,-.02,'avocado',.6);basket(stand,-.95,1.33,-.02,'strawberry',.6);
  const produce=new THREE.Group();stand.add(produce);produce.position.set(-3.05,.04,-.2);produce.rotation.y=.16;
  box(produce,0,.47,0,1.05,.8,.85,'#c7975d');for(let i=0;i<5;i++)box(produce,-.42+i*.21,.49,.44,.18,.76,.03,'#d9b17a',.01);
  basket(produce,0,.88,0,'pineapple',.93);basket(produce,.03,.13,.93,'watermelon',.85);basket(produce,-.04,.05,-.88,'dragonfruit',.85);
  basket(stand,1.7,.03,-1.25,'banana',.75);
  // Rear shelf and the citrus press.
  box(stand,0,1.05,-1.02,3.8,.12,.55,'#b78855');for(let i=0;i<5;i++){const b=new THREE.Group();stand.add(b);b.position.set(-1.5+i*.31,1.12,-1.07);cyl(b,0,.23,0,.08,.09,.46,['#f0b84c','#df947b','#a1b66a','#ebcf77','#e2a363'][i]);cyl(b,0,.48,0,.035,.04,.07,'#ebe0b5');label(b,['M','S','A','O','P'][i],.12,.13,0,.25,.094,C.dark,C.cream,130);}
  box(stand,.55,1.25,-.91,.43,.28,.36,'#dbad6e');bar(stand,new THREE.Vector3(.55,1.38,-.91),new THREE.Vector3(.55,1.85,-.91),.035,'#8f9f81');bar(stand,new THREE.Vector3(.55,1.84,-.91),new THREE.Vector3(.8,1.84,-.91),.035,'#87957b');cyl(stand,.55,1.56,-.91,.12,.05,.12,'#ced2b0');
  // The blender is a tactile countertop machine, with a translucent faceted jar.
  const blender=new THREE.Group();stand.add(blender);blender.position.set(.84,1.33,.68);blender.name='blender';
  box(blender,0,.14,0,.43,.28,.42,'#ebd8ac',.1);box(blender,0,.08,.216,.29,.09,.025,C.dark,.025);ball(blender,0,.095,.238,.042,.042,.025,'#f0bc4c',12);
  cyl(blender,0,.3,0,.16,.19,.08,'#617f62');
  const jar=new THREE.Group();blender.add(jar);jar.position.y=.34;
  const glass=new THREE.MeshPhysicalMaterial({color:'#e6f4d9',transparent:true,opacity:.3,roughness:.08,metalness:.02,transmission:.25,thickness:.08,side:THREE.DoubleSide,depthWrite:false});
  mesh(new THREE.CylinderGeometry(.22,.17,.61,12,1,true),glass,jar,0,.32,0);cyl(jar,0,.035,0,.175,.175,.07,'#c5cfac');
  const rim=mesh(new THREE.TorusGeometry(.22,.018,6,24),mat('#cbd7b9'),jar,0,.625,0);rim.rotation.x=Math.PI/2;
  line(jar,[new THREE.Vector3(.2,.5,0),new THREE.Vector3(.37,.5,0),new THREE.Vector3(.38,.19,0),new THREE.Vector3(.2,.15,0)],.032,'#b8cab0');
  for(let j=0;j<4;j++){box(jar,-.15,.18+j*.09,.146,.055,.009,.006,'#829e86',.002);}
  const lid=new THREE.Group();jar.add(lid);cyl(lid,0,.65,0,.24,.24,.055,C.dark);box(lid,0,.694,0,.1,.04,.09,'#d9dfb8',.015);
  const liquid=mesh(new THREE.CylinderGeometry(.193,.16,.44,24),new THREE.MeshStandardMaterial({color:'#f0ba50',roughness:.36,transparent:true,opacity:.94}),jar,0,.27,0);
  const swirl=new THREE.Group();jar.add(swirl);for(let i=0;i<3;i++){const r=mesh(new THREE.TorusGeometry(.12-i*.028,.008,5,24,Math.PI*1.5),mat(i%2?'#ffe098':'#f1c066'),swirl,0,.497+i*.004,0);r.rotation.x=Math.PI/2;r.rotation.z=i*2;}
  const fruitPieces=new THREE.Group();jar.add(fruitPieces);
  const bubbles=new THREE.Group();jar.add(bubbles);for(let i=0;i<9;i++)ball(bubbles,0,.1,0,.012+rand(i)*.009,.012+rand(i)*.009,.012+rand(i)*.009,'#fff0c3',8);
  // A paper cup, juicy fill, tiny straw and a continuous pour ribbon.
  const cup=new THREE.Group();stand.add(cup);cup.position.set(1.62,1.33,.84);cup.name='serving-cup';
  mesh(new THREE.CylinderGeometry(.155,.115,.43,24,1,true),new THREE.MeshPhysicalMaterial({color:'#fff9e2',transparent:true,opacity:.38,roughness:.16,depthWrite:false,side:THREE.DoubleSide}),cup,0,.215,0);
  const cupRim=mesh(new THREE.TorusGeometry(.154,.013,7,24),mat('#fff5da'),cup,0,.432,0);cupRim.rotation.x=Math.PI/2;
  cyl(cup,0,.018,0,.116,.116,.035,'#f8edcf');
  const cupLiquid=mesh(new THREE.CylinderGeometry(.14,.108,.37,24),mat('#f0ba50',.33),cup,0,.2,0);cupLiquid.visible=false;
  label(cup,'P!',.2,.16,0,.24,.14,C.dark,C.cream,150);
  const straw=bar(cup,new THREE.Vector3(.06,.1,0),new THREE.Vector3(.13,.68,0),.014,'#739c60');straw.visible=false;
  const pourCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(1.38,2.04,.68),new THREE.Vector3(1.56,1.97,.74),new THREE.Vector3(1.63,1.75,.84)]);
  const pourStream=mesh(new THREE.TubeGeometry(pourCurve,16,.025,8,false),mat('#f0ba50',.3),stand);pourStream.visible=false;
  // A cutting board, freshly sliced citrus, real blade, and cloth towel.
  box(stand,-.12,1.355,.8,.64,.06,.47,'#c4955d',.075);
  const boardContent=new THREE.Group();stand.add(boardContent);boardContent.position.set(-.12,1.405,.8);
  const boardWhole=new THREE.Group(),boardChunks=new THREE.Group();boardContent.add(boardWhole,boardChunks);
  const knifeRig=new THREE.Group();stand.add(knifeRig);knifeRig.position.set(.12,1.414,.84);knifeRig.rotation.y=-.3;
  box(knifeRig,0,0,0,.25,.018,.065,'#cbd4c7',.012);box(knifeRig,.17,.006,0,.14,.035,.075,C.dark,.02);
  const towel=box(stand,1.98,1.345,.06,.39,.025,.5,'#eee9c9',.02);towel.rotation.y=.1;for(let i=0;i<4;i++)box(stand,1.83+i*.08,1.36,.06,.014,.008,.49,'#94ad7b',.002);
  // Register, pencil jar, napkins, ice bucket, cooler and handmade price cards.
  const register=new THREE.Group();stand.add(register);register.position.set(1.75,1.33,-.6);box(register,0,.09,0,.43,.18,.37,'#577a60',.055);const scr=box(register,0,.28,-.05,.35,.27,.06,'#3f5e4d',.03);scr.rotation.x=-.2;const screen=label(register,'Rp 15.000',.29,.15,0,.295,-.006,'#cbe1a7','#3b5848',70);screen.rotation.x=-.2;for(let j=0;j<3;j++)for(let i=0;i<3;i++)box(register,-.1+i*.1,.193,.08+j*.05,.06,.018,.035,'#d2d3b0',.006);
  cyl(stand,2.11,1.45,-.61,.065,.06,.24,'#d6b57a');for(let i=0;i<3;i++){const o=cyl(stand,2.08+i*.027,1.61,-.61,.008,.008,.27,['#73985b','#dba06a','#6c8e78'][i],6);o.rotation.z=(i-1)*.15;}
  box(stand,1.2,1.39,-.67,.25,.12,.22,'#f5ebcf',.025);for(let i=0;i<3;i++)box(stand,1.2,1.45+i*.012,-.67,.23,.006,.2,'#fff5df',.001);
  cyl(stand,.13,1.49,-.35,.19,.15,.32,'#b3c8b3');cyl(stand,.13,1.66,-.35,.18,.18,.02,'#dbe4cd');for(let i=0;i<7;i++){const ice=box(stand,.13+(rand(i+54)-.5)*.24,1.67+rand(i)*.04,-.35+(rand(i+15)-.5)*.24,.085,.07,.08,'#e5f0dc',.02);ice.rotation.y=i;}
  const cooler=new THREE.Group();stand.add(cooler);cooler.position.set(3.02,.06,-.58);box(cooler,0,.35,0,.83,.69,.67,'#94b69a',.1);box(cooler,0,.72,0,.89,.14,.72,'#e6e4c4',.06);box(cooler,0,.43,.36,.22,.15,.035,'#eef0cf',.025);label(cooler,'ICE • ES',.5,.2,0,.3,.344,C.dark,'#bad0aa',85);bar(cooler,new THREE.Vector3(-.44,.5,-.18),new THREE.Vector3(-.44,.5,.18),.035,'#698e72');
  // The freestanding chalk menu has little drawings and hand-lettered specials.
  const menu=new THREE.Group();stand.add(menu);menu.position.set(-3.25,0,1.23);menu.rotation.set(-.09,.16,0);box(menu,0,.85,0,1.04,1.5,.1,'#b78957',.05);box(menu,0,.88,.065,.89,1.29,.025,'#355e48',.025);
  const menuTex=canvasTexture(512,768,c=>{c.fillStyle='#355e48';c.fillRect(0,0,512,768);c.textAlign='center';c.fillStyle='#fff0cc';c.font='italic 900 65px Georgia';c.fillText('Segar dulu!',256,95);c.strokeStyle='#adc28b';c.lineWidth=3;c.beginPath();c.moveTo(58,127);c.lineTo(454,127);c.stroke();c.font='bold 28px Arial';c.fillStyle='#d7dda6';c.fillText('TODAY’S HAPPY SQUEEZES',256,181);const names=['MANGO SUNSHINE','AVO-CUDDLE','BERRY HAPPY','TROPICAL GLOW'];names.forEach((t,i)=>{c.fillStyle='#fff0cc';c.font='bold 31px Arial';c.fillText(t,256,259+i*93);c.fillStyle='#e9c578';c.font='25px Arial';c.fillText('fresh fruit  ·  15k',256,296+i*93);});c.fillStyle='#d6dca4';c.font='italic 27px Georgia';c.fillText('a little sip of sunshine ♡',256,706);});mesh(new THREE.PlaneGeometry(.84,1.24),new THREE.MeshStandardMaterial({map:menuTex}),menu,0,.88,.083);
  for(const side of [-1,1]){const leg=box(menu,side*.4,.24,0,.08,.5,.1,'#b78957');leg.rotation.z=side*.12;bar(menu,new THREE.Vector3(side*.4,.1,-.4),new THREE.Vector3(side*.4,1.5,0),.035,'#b78957');}
  // Reusable upgrade props, revealed by the game as the tiny business grows.
  const upgradeGroup=(key:string)=>{const u=new THREE.Group();u.visible=false;stand.add(u);upgrades.set(key,u);return u;};
  const premium=upgradeGroup('blender');box(premium,.84,1.44,.68,.48,.05,.47,'#d9bd6c',.06);label(premium,'PRO',.19,.07,.84,1.51,.915,'#ecd799',C.dark,100);
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
  // Bake the hundreds of little carved details into material batches. Animated
  // pieces and painted surfaces stay separate, so the miniature is cheap to draw.
  const keep=new Set<THREE.Object3D>([ground,blender,cup,pourStream,bird,boardContent,knifeRig,...animatedLeaves,...changeable,...upgrades.values(),...locations.values()]);
  group.updateMatrixWorld(true);
  const batches=new Map<string,{material:THREE.Material,geometries:THREE.BufferGeometry[],originals:THREE.Mesh[]}>();
  group.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;let ancestor:THREE.Object3D|null=o;while(ancestor){if(keep.has(ancestor))return;ancestor=ancestor.parent;}if(o.material.transparent)return;
    let geo=o.geometry.clone();if(geo.index)geo=geo.toNonIndexed();geo.applyMatrix4(o.matrixWorld);const attributes=Object.keys(geo.attributes).sort().join(',');const key=o.material.uuid+attributes;
    if(!batches.has(key))batches.set(key,{material:o.material,geometries:[],originals:[]});const batch=batches.get(key)!;batch.geometries.push(geo);batch.originals.push(o);
  });
  for(const batch of batches.values()){if(batch.geometries.length<2){batch.geometries.forEach(g=>g.dispose());continue;}const geometry=mergeGeometries(batch.geometries,false);if(geometry){const baked=mesh(geometry,batch.material,group);baked.name='handcrafted-details';for(const o of batch.originals)o.removeFromParent();}batch.geometries.forEach(g=>g.dispose());}
  let lastStage='';let currentLocation='gang';let currentFruit='';
  const colorFruit:Record<string,string>={'#ffb746':'mango','#bed583':'avocado','#ffa342':'orange','#f77989':'watermelon','#ec88a0':'strawberry','#f0a3a4':'guava','#efda9a':'banana','#ffc163':'pineapple'};
  function refreshFruit(id:string,color:string) {
    currentFruit=id;boardWhole.clear();boardChunks.clear();fruitPieces.clear();
    const whole=createFruit(id,.145);whole.position.set(-.07,.145,0);whole.rotation.set(.4,.3,.15);boardWhole.add(whole);
    for(let i=0;i<8;i++){
      const piece=cutFruit(id,.105,color);piece.position.set((i%4-1.5)*.12,.043,(Math.floor(i/4)-.5)*.13);piece.rotation.y=i*.9;boardChunks.add(piece);
      const jarPiece=cutFruit(id,.09,color);jarPiece.position.set((rand(i+2)-.5)*.22,.09+rand(i+7)*.37,(rand(i+18)-.5)*.22);jarPiece.rotation.set(i,.4*i,i*.7);fruitPieces.add(jarPiece);
    }
  }
  function update(time:number,stage='idle',progress=0,color='#f4bc50',fruitId?:string) {
    const filling=Math.min(1,Math.max(0,progress));
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
    jar.position.x=stage==='pour'?.04:0;jar.position.y=.34+(stage==='pour'?.2:0);lid.visible=stage!=='pour'&&stage!=='add';
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
  }
  function setUpgrades(ids:string[]) {for(const [id,u] of upgrades)u.visible=ids.includes(id);}
  function setLocation(id:string) {
    currentLocation=locations.has(id)?id:'gang';for(const [key,themeGroup] of locations)themeGroup.visible=key===currentLocation;
    const themes:Record<string,{edge:string,paving:string,coral:string,mint:string}>={gang:{edge:'#b9c9a0',paving:'#f0dfbf',coral:'#edaa94',mint:'#a9ceba'},cfd:{edge:'#9ab494',paving:'#e3dec0',coral:'#e6b59b',mint:'#99c1b0'},pasar:{edge:'#c3ba8b',paving:'#ecd2a7',coral:'#dca080',mint:'#b7c596'},festival:{edge:'#bac48f',paving:'#f2ddad',coral:'#e7a894',mint:'#b5cba2'}};
    const theme=themes[currentLocation];(ground.material as THREE.MeshStandardMaterial).color.set(theme.edge);mat('#f0dfbf').color.set(theme.paving);mat(C.coral).color.set(theme.coral);mat(C.mint).color.set(theme.mint);
  }
  function setStandColor(color:string) {for(const o of changeable){o.material=(o.material as THREE.MeshStandardMaterial).clone();(o.material as THREE.MeshStandardMaterial).color.set(color);}void currentLocation;}
  update(0);
  const getJarRim=()=>{jar.updateWorldMatrix(true,false);return jar.localToWorld(new THREE.Vector3(.21,.625,0));};
  return {group,blender,jar,liquid,cup,cupLiquid,fruitPieces,pourStream,knife:knifeRig,board:boardContent,getJarRim,update,setUpgrades,setLocation,setStandColor};
}
