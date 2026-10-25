import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface CharacterOptions {
  skin?: string; hair?: string; shirt?: string; apron?: string;
  hairstyle?: string; hat?: boolean | string; glasses?: boolean; body?: string; face?: string;
}
export interface CharacterRig {
  group: THREE.Group; head: THREE.Group;
  leftHand: THREE.Object3D; rightHand: THREE.Object3D;
  update(time: number, mode?: string, progress?: number): void;
  setOptions(options: CharacterOptions): void;
  reach(hand: 'left' | 'right', worldTarget: THREE.Vector3, weight?: number): void;
  setGrip(hand: 'left' | 'right', amount: number): void;
  setExpression(expression: CharacterExpression | 'auto', intensity?: number): void;
  lookAt(target: THREE.Vector3 | null, weight?: number): void;
  setFirstPerson(active: boolean): void;
}

export type CharacterExpression = 'happy' | 'focused' | 'surprised' | 'neutral' | 'confused';

type V = [number, number, number];
const vec = (p: V) => new THREE.Vector3(...p);
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;

/** A small organic surface modeller. Everything is modelled locally, including the face. */
function organic(rx: number, ry: number, rz: number, deform?: (x: number, y: number, z: number) => V, detail = 36) {
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  for (let j = 0; j <= detail; j++) {
    const phi = Math.PI * j / detail;
    for (let i = 0; i <= detail * 2; i++) {
      const theta = TAU * i / (detail * 2);
      let x = Math.sin(phi) * Math.cos(theta), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(theta);
      const p = deform ? deform(x, y, z) : [x * rx, y * ry, z * rz];
      vertices.push(...p); uv.push(i / (detail * 2), 1 - j / detail);
      if (j < detail && i < detail * 2) {
        const a = j * (detail * 2 + 1) + i, b = a + detail * 2 + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}
function material(color: string, roughness = .65) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: .07, clearcoatRoughness: .7 });
}
let clothWeave: THREE.DataTexture | undefined;
function fabricMaterial(color:string) {
  const m=material(color,.94);
  if(!clothWeave){
    const data=new Uint8Array(64*64*4);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const i=(y*64+x)*4,thread=((x%4<2)!==(y%4<2)?12:-12),noise=((x*73+y*157+x*y*13)%19)-9;
      const v=128+thread+noise;data.set([v,v,v,255],i);
    }
    clothWeave=new THREE.DataTexture(data,64,64,THREE.RGBAFormat);clothWeave.wrapS=clothWeave.wrapT=THREE.RepeatWrapping;
    clothWeave.repeat.set(6,6);clothWeave.magFilter=THREE.LinearFilter;clothWeave.minFilter=THREE.LinearMipmapLinearFilter;clothWeave.generateMipmaps=true;clothWeave.needsUpdate=true;
  }
  m.bumpMap=clothWeave;m.bumpScale=.0025;return m;
}
function tape(parent:THREE.Object3D,points:V[],width:number,mat:THREE.Material){
  const curve=new THREE.CatmullRomCurve3(points.map(vec)),p:number[]=[],idx:number[]=[];
  for(let j=0;j<=28;j++){
    const t=j/28,c=curve.getPoint(t),dir=curve.getTangent(t),side=new THREE.Vector3(dir.y,-dir.x,0).normalize();
    for(const s of [-1,1]){const v=c.clone().addScaledVector(side,s*width/2);p.push(v.x,v.y,v.z);}
    if(j<28){const a=j*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
  const m=mesh(parent,g,mat);m.material.side=THREE.DoubleSide;return m;
}
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, p: V = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(...p); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function blob(parent: THREE.Object3D, size: V, mat: THREE.Material, p: V, detail = 24) {
  return mesh(parent, organic(...size, undefined, detail), mat, p);
}
function stroke(parent: THREE.Object3D, points: V[], radius: number, mat: THREE.Material, segments = 24) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(vec)), segments, radius, 7, false), mat);
}
function sculptedLock(parent: THREE.Object3D, points: V[], width: number, depth: number, mat: THREE.Material, twist = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map(vec));
  const frames = curve.computeFrenetFrames(24, false);
  const vertices: number[] = [], indices: number[] = [];
  for (let j = 0; j <= 24; j++) {
    const t = j / 24, c = curve.getPoint(t);
    const fullness = Math.pow(Math.sin(Math.PI * t), .48) * (.92 + .08 * Math.sin(t * Math.PI * 3));
    for (let i = 0; i <= 12; i++) {
      const a = i / 12 * TAU + t * twist;
      const p = c.clone().addScaledVector(frames.normals[j], Math.cos(a) * width * Math.max(.015, fullness))
        .addScaledVector(frames.binormals[j], Math.sin(a) * depth * Math.max(.015, fullness));
      vertices.push(p.x, p.y, p.z);
      if (j < 24 && i < 12) { const k = j * 13 + i; indices.push(k, k + 1, k + 13, k + 1, k + 14, k + 13); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices); g.computeVertexNormals(); return mesh(parent, g, mat);
}
function disposeTree(group: THREE.Object3D) {
  group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  group.clear();
}

/** Batch only rigid decoration. Keep bones, attachment sockets and live facial meshes intact. */
function batchStaticMeshes(root: THREE.Object3D, recursive = true, exclude = new Set<THREE.Object3D>()) {
  root.updateWorldMatrix(true,true);
  const inverse = root.matrixWorld.clone().invert();
  const byMaterial = new Map<THREE.Material,THREE.Mesh[]>();
  const visit = (parent: THREE.Object3D) => {
    for(const child of parent.children){
      if(exclude.has(child))continue;
      if(child instanceof THREE.Mesh && !(child instanceof THREE.SkinnedMesh) && !Array.isArray(child.material)){
        const list=byMaterial.get(child.material)||[];list.push(child);byMaterial.set(child.material,list);
      }else if(recursive)visit(child);
    }
  };
  visit(root);
  for(const [mat,parts] of byMaterial){
    if(parts.length<2)continue;
    const hasColors=parts.some(p=>p.geometry.hasAttribute('color'));
    const geometries=parts.map(part=>{
      const g=part.geometry.clone();
      // Procedural lofts omit UVs; normalize their layout before merging with organic/tube surfaces.
      if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
      if(hasColors&&!g.getAttribute('color')){const c=new Float32Array(g.getAttribute('position').count*3);c.fill(1);g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));}
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,part.matrixWorld));return g;
    });
    const combined=mergeGeometries(geometries,false);
    if(combined){
      const merged=new THREE.Mesh(combined,mat);merged.name='batched rigid detail';
      merged.castShadow=parts.some(p=>p.castShadow);merged.receiveShadow=parts.some(p=>p.receiveShadow);root.add(merged);
      for(const p of parts){p.removeFromParent();p.geometry.dispose();}
    }
    geometries.forEach(g=>g.dispose());
  }
}

export function createCharacter(initial: CharacterOptions = {}): CharacterRig {
  let options: CharacterOptions = { skin: '#cc8d62', hair: '#352321', shirt: '#f6e9cc', apron: '#6da994', hairstyle: 'sidepart', ...initial };
  const group = new THREE.Group(); group.name = 'PERAS — sculpted character';
  const thirdPersonParts: THREE.Object3D[] = [];
  let firstPerson = false;
  const skin = material(options.skin!, .62); skin.emissive.set(options.skin!); skin.emissiveIntensity = .035;
  const handSkin=skin.clone();handSkin.vertexColors=true;
  const warmSkin = material('#bd725a', .72), blush = material('#d98275', .86);
  const shirt = fabricMaterial(options.shirt!), apronMat = fabricMaterial(options.apron === 'none' ? '#7dbb81' : options.apron!);
  const hairMat = material(options.hair!, .72), hairLight = material(options.hair!, .76);
  const cocoa = material('#45312d', .65), mouthMat = material('#762f2c', .83), lipMat = material('#bd705b', .7);
  const ivory = material('#fff9df', .34), eyeWhite = material('#fff9e8', .29), irisMat = material('#5a3b2a', .3);
  const pupilMat = material('#211a19', .22), glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const trouser = fabricMaterial('#4c6763'), shoes = material('#fff2d6', .7), sole = material('#dbb88e', .91);
  const trim = material('#e4c7a2', .92), gold = material('#e9ac50', .4);
  const boneList: THREE.Bone[] = [], bones: Record<string, THREE.Bone> = {}, world: Record<string, V> = {};
  function bone(name: string, point: V, parent?: string) {
    const b = new THREE.Bone(); b.name = name; const p = parent ? world[parent] : [0, 0, 0];
    b.position.set(point[0] - p[0], point[1] - p[1], point[2] - p[2]);
    (parent ? bones[parent] : group).add(b); boneList.push(b); bones[name] = b; world[name] = point; return b;
  }
  bone('hips', [0, .71, 0]); bone('spine', [0, .92, 0], 'hips'); bone('chest', [0, 1.26, 0], 'spine'); bone('neck', [0, 1.40, 0], 'chest');
  for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
    bone(`upperArm${side}`, [sign * .275, 1.285, 0], 'chest');
    bone(`forearm${side}`, [sign * .38, 1.055, .015], `upperArm${side}`);
    bone(`wrist${side}`, [sign * .40, .86, .045], `forearm${side}`);
    bone(`thigh${side}`, [sign * .13, .75, 0], 'hips');
    bone(`calf${side}`, [sign * .135, .40, .005], `thigh${side}`);
    bone(`ankle${side}`, [sign * .135, .13, .025], `calf${side}`);
  }
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(boneList);
  const armRest={L:{forearm:bones.forearmL.position.clone(),wrist:bones.wristL.position.clone()},R:{forearm:bones.forearmR.position.clone(),wrist:bones.wristR.position.clone()}};
  function skinMesh(geometry: THREE.BufferGeometry, mat: THREE.Material, weights: (p: THREE.Vector3) => [string, string, number], distalBone?:string) {
    const pos = geometry.getAttribute('position'), ids: number[] = [], w: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const [a, b, mix] = weights(new THREE.Vector3().fromBufferAttribute(pos, i));
      const tip=distalBone?1-THREE.MathUtils.smoothstep(pos.getY(i),.86,1.02):0;
      ids.push(boneList.indexOf(bones[a]), boneList.indexOf(bones[b]), distalBone?boneList.indexOf(bones[distalBone]):0, 0);w.push((1-mix)*(1-tip),mix*(1-tip),tip,0);
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ids, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
    const m = new THREE.SkinnedMesh(geometry, mat); m.castShadow = m.receiveShadow = true; group.add(m); m.bind(skeleton); return m;
  }
  function loft(input: { p: V; rx: number; rz: number }[], segments = 32) {
    const cat = (a:number,b:number,c:number,d:number,t:number) => .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    const rings: { p: V; rx: number; rz: number }[]=[];
    for(let j=0;j<(input.length-1)*5+1;j++){
      const u=j/5,k=Math.min(input.length-2,Math.floor(u)),t=u-k;
      const a=input[Math.max(0,k-1)],b=input[k],c=input[k+1],d=input[Math.min(input.length-1,k+2)];
      rings.push({p:[0,1,2].map(n=>cat(a.p[n],b.p[n],c.p[n],d.p[n],t)) as V,rx:cat(a.rx,b.rx,c.rx,d.rx,t),rz:cat(a.rz,b.rz,c.rz,d.rz,t)});
    }
    const pts: number[] = [], idx: number[] = [],uv:number[]=[];
    for (let j = 0; j < rings.length; j++) for (let i = 0; i <= segments; i++) {
      const a = i / segments * TAU, r = rings[j];
      const pleat = 1 + .015 * Math.sin(a * 7 + j * 1.3);
      const fold=.0025*Math.sin(a*5+j*.15)*Math.sin(j/(rings.length-1)*Math.PI);
      pts.push(r.p[0] + Math.cos(a) * (r.rx * pleat+fold), r.p[1], r.p[2] + Math.sin(a) * (r.rz * pleat+fold));uv.push(i/segments,j/(rings.length-1));
      if (j < rings.length - 1 && i < segments) { const n = j * (segments + 1) + i; idx.push(n, n + segments + 1, n + 1, n + 1, n + segments + 1, n + segments + 2); }
    }
    if(input[0].p[1]>input[input.length-1].p[1])for(let i=0;i<idx.length;i+=3){const a=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=a;}
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // Torso and four limbs are deformable surfaces bound to one real skeleton.
  thirdPersonParts.push(skinMesh(loft([
    {p:[0,.675,0],rx:.19,rz:.125},{p:[0,.72,0],rx:.225,rz:.15},
    {p:[0,.82,.005],rx:.24,rz:.17},{p:[0,.98,0],rx:.226,rz:.172},
    {p:[0,1.17,0],rx:.25,rz:.157},{p:[0,1.285,0],rx:.28,rz:.14},
    {p:[0,1.34,0],rx:.22,rz:.12},{p:[0,1.375,0],rx:.09,rz:.085},
  ]), shirt, p => ['spine','chest',THREE.MathUtils.smoothstep(p.y, .96, 1.3)]));
  for (const [side, s] of [['L', 1], ['R', -1]] as const) {
    thirdPersonParts.push(skinMesh(loft([
      {p:[s*.27,1.29,0],rx:.105,rz:.103},{p:[s*.32,1.20,.005],rx:.10,rz:.10},
      {p:[s*.37,1.08,.015],rx:.077,rz:.08},{p:[s*.39,.99,.025],rx:.073,rz:.073},
      {p:[s*.40,.86,.045],rx:.054,rz:.056},
    ]), skin, p => [`upperArm${side}`,`forearm${side}`,1 - THREE.MathUtils.smoothstep(p.y, 1.02, 1.14)],`wrist${side}`));
    thirdPersonParts.push(skinMesh(loft([
      {p:[s*.242,1.37,0],rx:.025,rz:.045},{p:[s*.27,1.335,0],rx:.10,rz:.10},
      {p:[s*.292,1.285,0],rx:.121,rz:.12},{p:[s*.32,1.205,.005],rx:.109,rz:.112},
      {p:[s*.343,1.15,.009],rx:.096,rz:.103},{p:[s*.343,1.138,.009],rx:.098,rz:.104},
    ]), shirt, () => [`upperArm${side}`,`upperArm${side}`,0]));
    thirdPersonParts.push(skinMesh(loft([
      {p:[s*.13,.76,0],rx:.129,rz:.13},{p:[s*.13,.64,0],rx:.13,rz:.135},
      {p:[s*.135,.45,.005],rx:.101,rz:.102},{p:[s*.135,.37,.005],rx:.094,rz:.097},
      {p:[s*.135,.18,.025],rx:.087,rz:.086},{p:[s*.135,.14,.025],rx:.084,rz:.084},
    ]), trouser, p => [`thigh${side}`,`calf${side}`,1-THREE.MathUtils.smoothstep(p.y,.35,.48)]));
    const foot = new THREE.Group(); bones[`ankle${side}`].add(foot);
    thirdPersonParts.push(foot);
    const shoe = organic(.109,.095,.19,(x,y,z) => [x*.112*(1+.05*z), y*.078 + .004*(1-z), z*.18+.065],28);
    mesh(foot,shoe,shoes,[0,-.052,.02]);
    blob(foot,[.115,.026,.185],sole,[0,-.105,.085]);
    stroke(foot,[[-.075,-.058,.215],[0,-.046,.233],[.075,-.058,.215]],.006,trim);
    for(let j=0;j<3;j++) stroke(foot,[[-.04,.004-j*.008,.13-j*.028],[0,.013-j*.008,.135-j*.028],[.04,.004-j*.008,.13-j*.028]],.006,ivory,8);
    batchStaticMeshes(foot);
    const cuff = new THREE.Group(); bones[`calf${side}`].add(cuff);
    thirdPersonParts.push(cuff);
    stroke(cuff,[[-.077,-.23,.096],[0,-.225,.11],[.077,-.23,.096]],.012,trouser,12);
  }
  const collar = new THREE.Group(); collar.position.set(0,.135,0); bones.chest.add(collar);
  thirdPersonParts.push(collar);
  blob(collar,[.093,.105,.08],skin,[0,.03,0]);
  stroke(collar,[[-.115,-.013,.07],[-.085,-.032,.10],[0,-.055,.107],[.085,-.032,.10],[.115,-.013,.07]],.018,trim);
  batchStaticMeshes(collar);
  // Apron follows the upper body, with a shaped bib, piping, ties and a real pocket.
  const apron = new THREE.Group(); bones.spine.add(apron); apron.position.y = -.92;
  thirdPersonParts.push(apron);
  function clothPanel(parent: THREE.Object3D, y0:number,y1:number,width:(t:number)=>number,z:(t:number,x:number)=>number,mat:THREE.Material) {
    const p:number[]=[], idx:number[]=[],uv:number[]=[];
    for(let j=0;j<=20;j++)for(let i=0;i<=20;i++){
      const t=j/20,u=i/20*2-1,x=u*width(t);p.push(x,lerp(y0,y1,t),z(t,u));uv.push(i/20,t);
      if(j<20&&i<20){const a=j*21+i;idx.push(a,a+1,a+21,a+1,a+22,a+21);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    const m=mesh(parent,g,mat);m.material.side=THREE.DoubleSide;return m;
  }
  const apronWidth=(t:number)=>t>.7?lerp(.225,.13,(t-.7)/.3):.225-.008*Math.sin(t*Math.PI);
  const apronDepth=(t:number,x:number)=>.195+.04*Math.sin(t*Math.PI)-.035*x*x+.006*Math.sin(x*8+t*7);
  clothPanel(apron,.67,1.315,apronWidth,apronDepth,apronMat);
  const edgeLeft:V[]=[],edgeRight:V[]=[];
  for(let i=0;i<=20;i++){const t=i/20;edgeLeft.push([-apronWidth(t),lerp(.67,1.315,t),apronDepth(t,-1)]);edgeRight.push([apronWidth(t),lerp(.67,1.315,t),apronDepth(t,1)]);}
  stroke(apron,edgeLeft,.006,trim);stroke(apron,edgeRight,.006,trim);
  stroke(apron,[[-.225,.681,.196],[0,.67,.207],[.225,.681,.196]],.006,trim);
  clothPanel(apron,.82,.98,t=>.125+.012*Math.sin(t*Math.PI),(t,x)=>.245+.011*Math.sin(t*Math.PI)-.017*x*x,apronMat);
  stroke(apron,[[-.125,.98,.23],[0,.971,.246],[.125,.98,.23]],.007,trim);
  stroke(apron,[[-.125,.97,.23],[-.125,.835,.235],[0,.818,.247],[.125,.835,.235],[.125,.97,.23]],.004,trim);
  for(const s of [-1,1]){
    stroke(apron,[[s*.115,1.31,.19],[s*.13,1.37,.12],[s*.10,1.398,.015],[s*.105,1.34,-.12]],.016,apronMat);
    blob(apron,[.013,.013,.008],gold,[s*.114,1.28,.211],12);
    stroke(apron,[[s*.22,.99,.17],[s*.25,.985,.0],[s*.205,.98,-.16]],.014,apronMat);
  }
  // Little embroidered citrus badge.
  blob(apron,[.041,.044,.009],ivory,[0,1.18,.239],16);
  blob(apron,[.029,.03,.01],gold,[0,1.18,.248],16);
  const badgeLeaf=blob(apron,[.019,.009,.006],material('#497959'),[.022,1.213,.257],12);badgeLeaf.rotation.z=.5;
  for(const sign of [-1,1]){
    tape(apron,[[sign*.105,1.355,-.112],[sign*.075,1.27,-.157],[-sign*.06,1.10,-.182],[-sign*.19,.987,-.17]],.034,apronMat);
    stroke(apron,[[sign*.105,1.355,-.118],[sign*.065,1.26,-.164],[-sign*.07,1.10,-.188]],.0024,trim,20);
    tape(apron,[[sign*.215,.99,-.164],[sign*.10,.985,-.183],[0,.985,-.193]],.029,apronMat);
    sculptedLock(apron,[[0,.988,-.205],[sign*.105,1.023,-.222],[sign*.133,.977,-.225],[sign*.055,.97,-.216],[0,.988,-.212]],.025,.011,apronMat);
    sculptedLock(apron,[[sign*.014,.982,-.213],[sign*.041,.91,-.223],[sign*.029,.80+sign*.015,-.217]],.023,.007,apronMat);
  }
  blob(apron,[.031,.023,.018],apronMat,[0,.987,-.217],16);
  batchStaticMeshes(apron);
  const backSeams=new THREE.Group();bones.spine.add(backSeams);backSeams.position.y=-.92;
  thirdPersonParts.push(backSeams);
  stroke(backSeams,[[0,1.34,-.121],[0,1.23,-.154],[0,1.04,-.176],[0,.80,-.176]],.0022,trim,28);
  stroke(backSeams,[[-.203,.742,-.089],[0,.727,-.162],[.203,.742,-.089]],.004,trim,24);
  batchStaticMeshes(backSeams);

  function makeHand(parent: THREE.Bone, sign:number) {
    const h=new THREE.Group();parent.add(h);h.name=sign>0?'left articulated hand':'right articulated hand';
    blob(h,[.055,.072,.036],skin,[0,-.054,.009],20);
    const fingers:{base:THREE.Group;tip:THREE.Group;spread:number}[]=[];
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.025,length=[.061,.075,.069,.052][i],base=new THREE.Group(),tip=new THREE.Group();
      base.name=['index','middle','ring','little'][i]+' proximal';tip.name=['index','middle','ring','little'][i]+' distal';base.position.set(x,-.095+.005*Math.abs(i-1.5),.011);h.add(base);base.add(tip);tip.position.y=-length*.52;
      blob(base,[.013,length*.29,.013],handSkin,[0,-length*.24,0],14);
      blob(tip,[.012,length*.29,.012],handSkin,[0,-length*.24,.001],14);
      const nail=blob(tip,[.008,.011,.002],handSkin,[0,-length*.32,-.010],10);const nc=new Float32Array(nail.geometry.getAttribute('position').count*3);for(let c=0;c<nc.length;c+=3)nc.set([1.35,1.28,1.22],c);nail.geometry.setAttribute('color',new THREE.Float32BufferAttribute(nc,3));
      batchStaticMeshes(tip);fingers.push({base,tip,spread:(i-1.5)*.055});
    }
    const thumb=new THREE.Group();thumb.name='opposable thumb';thumb.position.set(sign*.044,-.029,.012);h.add(thumb);
    sculptedLock(thumb,[[0,0,0],[sign*.025,-.024,.015],[sign*.025,-.060,.031]],.021,.018,handSkin);
    blob(thumb,[.010,.013,.002],handSkin,[sign*.026,-.047,.016],10);batchStaticMeshes(thumb);
    const grip=new THREE.Object3D();grip.name='prop grip';grip.position.set(0,-.103,.055);h.add(grip);
    h.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===handSkin&&!o.geometry.hasAttribute('color')){const colors=new Float32Array(o.geometry.getAttribute('position').count*3);colors.fill(1);o.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));}});
    return {h,grip,fingers,thumb,sign,amount:0,target:0};
  }
  const left=makeHand(bones.wristL,1),right=makeHand(bones.wristR,-1);
  const head=new THREE.Group();head.position.set(0,.295,.005);bones.neck.add(head);head.name='sculpted expressive head';
  thirdPersonParts.push(head);
  const faceGeo=organic(.37,.43,.31,(x,y,z)=>{
    const cheek=Math.exp(-Math.pow((y+.18)/.35,2));
    const jaw=1-.16*Math.max(0,-y-.15);
    const xx=x*(.351+.031*cheek)*jaw;
    const zz=z*(.305+.018*cheek)+.035*Math.max(0,z)*(1-y*y);
    return [xx,y*.425,zz];
  },44);
  const faceMaterial=skin.clone();faceMaterial.color.set('#ffffff');faceMaterial.vertexColors=true;const faceMesh=mesh(head,faceGeo,faceMaterial);
  function tintFace(){
    const pos=faceGeo.getAttribute('position'),colors:number[]=[],base=new THREE.Color(options.skin!),rose=new THREE.Color('#df8a7d');
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const a=z>.13?Math.exp(-Math.pow((Math.abs(x)-.218)/.073,2)-Math.pow((y+.09)/.044,2))*.42:0;const c=base.clone().lerp(rose,a);colors.push(c.r,c.g,c.b);}
    faceGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  }
  for(const s of [-1,1]){
    const ear=blob(head,[.073,.105,.052],skin,[s*.352,-.022,-.012],24);ear.rotation.z=s*-.15;
    blob(head,[.035,.058,.017],warmSkin,[s*.385,-.02,.025],20);
    blob(head,[.017,.032,.021],skin,[s*.375,-.039,.036],16);
    // Rosy cheek colour is blended directly over the sculpted facial surface.
    for(let i=0;i<3;i++)blob(head,[.0035,.004,.002],warmSkin,[s*(.191+i*.025),-.078+(i===1?.009:0),.301-i*.009],10);
  }
  const eyes:THREE.Group[]=[],gazes:THREE.Group[]=[],brows:THREE.Group[]=[];
  const lids:{update:(blink:number,focus:number,happy:number,surprise:number)=>void}[]=[];
  function makeLids(eye:THREE.Group){
    const cols=25,rows=7,count=cols*rows*2,p=new Float32Array(count*3),indices:number[]=[];
    for(let patch=0;patch<2;patch++)for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){
      const a=patch*cols*rows+j*cols+i;
      if(patch===0)indices.push(a,a+cols,a+1,a+1,a+cols,a+cols+1);else indices.push(a,a+1,a+cols,a+1,a+cols+1,a+cols);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setIndex(indices);
    const lid=mesh(eye,g,skin);lid.frustumCulled=false;
    const lashP=new Float32Array(cols*2*3),lashI:number[]=[];
    for(let i=0;i<cols-1;i++){const a=i*2;lashI.push(a,a+2,a+1,a+1,a+2,a+3);}
    const lashG=new THREE.BufferGeometry();lashG.setAttribute('position',new THREE.BufferAttribute(lashP,3));lashG.setIndex(lashI);
    const lash=mesh(eye,lashG,cocoa);lash.frustumCulled=false;
    function update(blink:number,focus:number,happy:number,surprise:number){
      const upper=lerp(.87-focus*.32,.99,surprise),lower=-.91+happy*.27-focus*.04;
      for(let i=0;i<cols;i++){
        const u=i/(cols-1)*2-1,h=Math.sqrt(Math.max(0,1-u*u));
        const boundary=h*lerp(upper,-1,blink);
        for(let j=0;j<rows;j++)for(let patch=0;patch<2;patch++){
          const v=j/(rows-1),y=h*(patch===0?lerp(1,lerp(upper,-1,blink),v):lerp(-1,lower*(1-blink)-blink,v));
          const k=(patch*cols*rows+j*cols+i)*3;p[k]=u*.097;p[k+1]=y*.110;p[k+2]=.009+Math.sqrt(Math.max(0,1-u*u-y*y))*.063;
        }
        for(let j=0;j<2;j++){const k=(i*2+j)*3;lashP[k]=u*.097;lashP[k+1]=boundary*.110+(j?1:-1)*.0035*h;lashP[k+2]=.011+Math.sqrt(Math.max(0,1-u*u-boundary*boundary))*.063;}
      }
      g.getAttribute('position').needsUpdate=true;g.computeVertexNormals();lashG.getAttribute('position').needsUpdate=true;lashG.computeVertexNormals();
    }
    update(0,0,0,0);return{update,lid,lash};
  }
  for(const s of [-1,1]){
    const eye=new THREE.Group();eye.position.set(s*.133,.067,.303);eye.rotation.y=s*.12;head.add(eye);eyes.push(eye);
    blob(eye,[.100,.113,.039],warmSkin,[0,0,-.008],24);
    blob(eye,[.092,.104,.04],eyeWhite,[0,0,0],28);
    const gaze=new THREE.Group();eye.add(gaze);gazes.push(gaze);
    blob(gaze,[.050,.069,.014],irisMat,[-s*.005,-.004,.036],24);
    const irisRing=mesh(gaze,new THREE.TorusGeometry(.048,.0025,5,32),pupilMat,[-s*.005,-.004,.050]);irisRing.scale.y=1.36;
    blob(gaze,[.027,.047,.009],pupilMat,[-s*.004,-.001,.049],20);
    blob(gaze,[.013,.016,.005],glintMat,[-.017,.026,.059],12);
    blob(gaze,[.005,.006,.003],glintMat,[.018,-.026,.058],10);
    batchStaticMeshes(gaze);
    const lid=makeLids(eye);lids.push(lid);batchStaticMeshes(eye,false,new Set([lid.lid,lid.lash]));
    const brow=new THREE.Group();brow.position.set(s*.133,.211,.324);head.add(brow);brows.push(brow);
    sculptedLock(brow,[[-s*.083,-.004,.011],[-s*.009,.016,.015],[s*.074,-.027,-.010]],.018,.011,hairMat);
  }
  irisMat.clearcoat=.45;irisMat.clearcoatRoughness=.16;pupilMat.clearcoat=.5;
  // A lifted bridge, soft nostril wings and gently shaded underside.
  mesh(head,organic(.056,.081,.065,(x,y,z)=>[x*.056*(1-.25*y),y*.075,z*.062+.013*Math.max(0,-y)],28),skin,[0,-.035,.329]);
  blob(head,[.052,.035,.04],skin,[0,-.079,.371],24);
  for(const s of [-1,1])blob(head,[.011,.005,.006],warmSkin,[s*.029,-.099,.391],12);
  const mouthGroup=new THREE.Group();mouthGroup.name='deformable expression';head.add(mouthGroup);
  function mouthSurface(mat:THREE.Material){
    const p=new Float32Array(37*5*3),id:number[]=[];
    for(let i=0;i<36;i++)for(let j=0;j<4;j++){const a=i*5+j;id.push(a,a+1,a+5,a+1,a+6,a+5);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setIndex(id);
    const m=mesh(mouthGroup,g,mat);m.frustumCulled=false;return m;
  }
  const mouth=mouthSurface(mouthMat),teeth=mouthSurface(ivory);
  const tongue=blob(mouthGroup,[.049,.016,.004],lipMat,[0,-.214,.325],16);
  const lipP=new Float32Array(37*9*3),lipI:number[]=[];
  for(let i=0;i<36;i++)for(let j=0;j<8;j++){const a=i*9+j;lipI.push(a,a+9,a+1,a+1,a+9,a+10);}
  const lipG=new THREE.BufferGeometry();lipG.setAttribute('position',new THREE.BufferAttribute(lipP,3));lipG.setIndex(lipI);
  const lowerLip=mesh(mouthGroup,lipG,lipMat);lowerLip.frustumCulled=false;
  const dimpleGroup=new THREE.Group();mouthGroup.add(dimpleGroup);
  for(const s of [-1,1])stroke(dimpleGroup,[[s*.129,-.10,.287],[s*.138,-.119,.285],[s*.133,-.135,.287]],.004,warmSkin,8);
  batchStaticMeshes(dimpleGroup);
  function shapeMouth(happy:number,focus:number,surprise:number,confused:number,neutral:number){
    const smile=THREE.MathUtils.clamp(.62+happy*.35-focus*.55-confused*.65-neutral*.36,0,1);
    const open=THREE.MathUtils.clamp(.62+happy*.25-focus*.58-confused*.43-neutral*.55,.045,1);
    const width=lerp(.126,.055,surprise);
    const top=(u:number)=>lerp(-.151+smile*.038*u*u+confused*u*.013,-.178+Math.sqrt(Math.max(0,1-u*u))*.060,surprise);
    const bottom=(u:number)=>lerp(top(u)-open*.084*Math.pow(Math.max(0,1-u*u),.7),-.178-Math.sqrt(Math.max(0,1-u*u))*.068,surprise);
    const m=mouth.geometry.getAttribute('position') as THREE.BufferAttribute,t=teeth.geometry.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<=36;i++){
      const u=i/36*2-1,up=top(u),lo=bottom(u),z=.325-.035*u*u;
      for(let j=0;j<=4;j++){
        const k=i*5+j;m.setXYZ(k,u*width,lerp(up,lo,j/4),z);
        t.setXYZ(k,u*width,lerp(up-.002,Math.max(lo,up-.022*(1-u*u)),j/4),z+.003);
      }
      const u0=Math.max(-1,u-.01),u1=Math.min(1,u+.01),tangent=new THREE.Vector2((u1-u0)*width,bottom(u1)-bottom(u0)).normalize();
      for(let j=0;j<=8;j++){
        const a=j/8*TAU,r=.006*Math.pow(Math.max(0,1-u*u),.18),k=(i*9+j)*3;
        lipP[k]=u*width-tangent.y*Math.cos(a)*r;lipP[k+1]=lo+tangent.x*Math.cos(a)*r;lipP[k+2]=z+Math.sin(a)*r;
      }
    }
    m.needsUpdate=t.needsUpdate=true;mouth.geometry.computeVertexNormals();teeth.geometry.computeVertexNormals();lipG.getAttribute('position').needsUpdate=true;lipG.computeVertexNormals();
    teeth.visible=open>.28&&surprise<.55;tongue.visible=open>.35&&surprise<.5;tongue.position.y=bottom(0)+.018;tongue.scale.x=width/.126;
    dimpleGroup.visible=smile>.65&&surprise<.3;
  }
  batchStaticMeshes(head,false,new Set([faceMesh]));
  const hairGroup=new THREE.Group(),accessories=new THREE.Group();head.add(hairGroup,accessories);
  function buildHair() {
    disposeTree(hairGroup);
    const style=options.hairstyle?.toLowerCase()||'sidepart';
    const positions:number[]=[],ids:number[]=[];
    for(let j=0;j<=24;j++)for(let i=0;i<=64;i++){
      const t=i/64*TAU,front=Math.max(0,Math.sin(t));
      const phi=j/24*(1.93-.65*front),wobble=.007*Math.sin(t*7+phi*4);
      positions.push(Math.sin(phi)*Math.cos(t)*(.373+wobble),.063+Math.cos(phi)*(.413+wobble),-.017+Math.sin(phi)*Math.sin(t)*(.334+wobble));
      if(j<24&&i<64){const a=j*65+i;ids.push(a,a+1,a+65,a+1,a+66,a+65);}
    }
    const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));cap.setIndex(ids);cap.computeVertexNormals();mesh(hairGroup,cap,hairMat);
    if(style==='curly'||style==='curls') {
      for(let ring=0;ring<4;ring++){
        const phi=.27+ring*.36,n=5+ring*5;
        for(let i=0;i<n;i++){
          const th=i/n*TAU+ring*.57;
          const front=Math.sin(th); if(ring===3&&front>.3)continue;
          const c=new THREE.Vector3(Math.sin(phi)*Math.cos(th)*.355,.07+Math.cos(phi)*.405,Math.sin(phi)*Math.sin(th)*.33);
          const normal=new THREE.Vector3(c.x,c.y-.06,c.z).normalize();
          const tangent=new THREE.Vector3(-Math.sin(th),0,Math.cos(th));const binormal=new THREE.Vector3().crossVectors(normal,tangent).normalize();
          const points:V[]=[];
          for(let k=0;k<8;k++){
            const a=k/7*Math.PI*1.65,r=.048*(.65+.35*Math.sin(k/7*Math.PI));
            const p=c.clone().addScaledVector(tangent,Math.cos(a)*r).addScaledVector(binormal,Math.sin(a)*r).addScaledVector(normal,.025+Math.sin(k/7*Math.PI)*.026);
            points.push([p.x,p.y,p.z]);
          }
          sculptedLock(hairGroup,points,.036,.032,(i+ring)%4===0?hairLight:hairMat);
        }
      }
      for(let i=0;i<6;i++){
        const x=-.25+i*.092;
        sculptedLock(hairGroup,[[x,.29,.24],[x-.025,.27,.31],[x+.025,.208,.351],[x+.05,.19,.31]],.048,.039,i%3?hairMat:hairLight);
      }
    } else if(['bob','long','ponytail','wavy'].includes(style)) {
      for(const s of [-1,1])for(let i=0;i<7;i++) {
        const z=.18-i*.065;
        sculptedLock(hairGroup,[[s*.22,.38,z*.5],[s*.34,.19,z],[s*(.37+Math.sin(i)*.015),-.08,z+.025],[s*.30,style==='long'?-.47:-.29,z+.035]],.063,.049,i%3?hairMat:hairLight);
      }
      for(let i=0;i<7;i++){
        const x=-.27+i*.085;
        sculptedLock(hairGroup,[[x*.7,.41,.0],[x,.32,.235],[x-.035,.205+.025*Math.sin(i),.323]],.054,.039,i%3?hairMat:hairLight);
      }
      if(style==='ponytail'){
        sculptedLock(hairGroup,[[0,.29,-.30],[.08,.27,-.45],[.10,-.02,-.49],[.03,-.34,-.40]],.13,.115,hairMat);
        blob(hairGroup,[.112,.035,.09],apronMat,[.022,.235,-.366],20);
      }
    } else {
      // Thick individually sculpted sweeping locks, with a visible side part and tapered tips.
      for(let i=0;i<10;i++){
        const t=i/9,x=lerp(-.29,.21,t);
        const points:V[]=[
          [lerp(-.22,.05,t),.40+.027*Math.sin(t*Math.PI),-.065],
          [x-.035,.431-.06*t,.12],
          [x+.055,.33-.07*t,.283],
          [x+.058,.17+.061*Math.sin(t*Math.PI),.326-.03*Math.abs(x)],
        ];
        sculptedLock(hairGroup,points,.048+.012*Math.sin(t*Math.PI),.037,i%4===0?hairLight:hairMat);
        if(i%2===0)stroke(hairGroup,[[x-.039,.43-.06*t,.138],[x+.053,.34-.07*t,.314],[x+.06,.20+.05*Math.sin(t*Math.PI),.345-.03*Math.abs(x)]],.0028,hairLight,16);
      }
      for(const s of [-1,1])for(let i=0;i<4;i++){
        const z=.14-i*.115;
        sculptedLock(hairGroup,[[s*.22,.35,z-.04],[s*.34,.25,z],[s*.355,.02-i*.018,z+.03]],.05,.037,i%2?hairMat:hairLight);
      }
      sculptedLock(hairGroup,[[-.19,.39,-.13],[-.16,.52,-.11],[-.10,.49,.02],[-.05,.40,.14]],.068,.046,hairMat);
    }
    const longBack=['bob','long','ponytail','wavy'].includes(style);
    for(let i=0;i<11;i++){
      const a=Math.PI+i/10*Math.PI,c=Math.cos(a),z=Math.sin(a);
      sculptedLock(hairGroup,[[c*.17,.405,z*.15],[c*.32,.23,z*.31],[c*.345,.07,z*.342],[c*.30,longBack?(style==='long'?-.40:-.27):-.08,z*.302]],longBack?.055:.044,.026,i%4===0?hairLight:hairMat);
    }
    batchStaticMeshes(hairGroup);
  }
  function buildAccessories() {
    disposeTree(accessories);
    if(options.glasses) {
      const frame=material('#d5a953',.4);
      for(const s of [-1,1]){
        const points:V[]=[];
        for(let i=0;i<=48;i++){
          const a=i/48*TAU;points.push([s*.136+Math.cos(a)*.114,.064+Math.sin(a)*.112,.36-Math.abs(Math.cos(a))*.008]);
        }
        stroke(accessories,points,.009,frame,48);
        const lens=blob(accessories,[.103,.103,.004],new THREE.MeshPhysicalMaterial({color:'#bce0cd',roughness:.15,transparent:true,opacity:.14,depthWrite:false}),[s*.136,.064,.36],28);lens.castShadow=false;
        stroke(accessories,[[s*.247,.077,.352],[s*.332,.09,.20],[s*.362,.064,.025]],.009,frame,20);
      }
      stroke(accessories,[[-.028,.085,.369],[0,.102,.383],[.028,.085,.369]],.008,frame,12);
    }
    if(options.hat && options.hat !== 'none') {
      const hatMat=material('#f4d08a',.92),bandMat=material('#de9266',.83);
      // Crown made from a lathed woven profile, with a softly drooping organic brim.
      const crownPoints=[new THREE.Vector2(.0,.57),new THREE.Vector2(.18,.565),new THREE.Vector2(.26,.52),new THREE.Vector2(.28,.37),new THREE.Vector2(.31,.33)];
      mesh(accessories,new THREE.LatheGeometry(crownPoints,64),hatMat,[0,-.045,-.024]);
      const p:number[]=[],id:number[]=[];
      for(let j=0;j<=7;j++)for(let i=0;i<=64;i++){
        const a=i/64*TAU,r=lerp(.286,.49,j/7);
        p.push(Math.cos(a)*r,.289-.05*Math.pow(j/7,2)+.018*Math.cos(a*2)*Math.pow(j/7,2),-.024+Math.sin(a)*r*.83);
        if(j<7&&i<64){const n=j*65+i;id.push(n,n+65,n+1,n+1,n+65,n+66);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(id);g.computeVertexNormals();hatMat.side=THREE.DoubleSide;mesh(accessories,g,hatMat);
      const band:V[]=[];for(let i=0;i<=64;i++){const a=i/64*TAU;band.push([Math.cos(a)*.286,.32,Math.sin(a)*.286-.024]);}stroke(accessories,band,.027,bandMat,64);
      for(let k=0;k<4;k++){
        const seam:V[]=[];for(let i=0;i<=64;i++){const a=i/64*TAU,r=.37+k*.033;seam.push([Math.cos(a)*r,.287-.05*((r-.286)/.204)**2,Math.sin(a)*r*.83-.024]);}stroke(accessories,seam,.0028,trim,64);
      }
    }
    batchStaticMeshes(accessories);
  }
  function setOptions(next: CharacterOptions) {
    const oldStyle=options.hairstyle,oldHat=options.hat,oldGlasses=options.glasses;
    options={...options,...next};skin.color.set(options.skin!);skin.emissive.set(options.skin!);handSkin.color.copy(skin.color);handSkin.emissive.copy(skin.emissive);faceMaterial.emissive.set(options.skin!);tintFace();
    const skinColor=new THREE.Color(options.skin!);warmSkin.color.copy(skinColor).lerp(new THREE.Color('#a85745'),.44);
    blush.color.copy(skinColor).lerp(new THREE.Color('#e9847c'),.43);
    lipMat.color.copy(skinColor).lerp(new THREE.Color('#a85a50'),.50);
    hairMat.color.set(options.hair!);hairLight.color.set(options.hair!).lerp(new THREE.Color('#9c7353'),.17);
    shirt.color.set(options.shirt!);apron.visible=!firstPerson&&options.apron!=='none';if(options.apron!=='none')apronMat.color.set(options.apron!);
    group.scale.setScalar(options.body==='tall'?1.07:options.body==='small'?.93:1);
    head.scale.set(options.face==='round'?1.065:1,options.face==='long'?1.07:1,1);
    if(oldStyle!==options.hairstyle||hairGroup.children.length===0)buildHair();
    if(oldHat!==options.hat||oldGlasses!==options.glasses||accessories.children.length===0)buildAccessories();
  }
  setOptions(options);
  function setFirstPerson(active:boolean){
    firstPerson=active;
    thirdPersonParts.forEach(part=>part.visible=!active);
    apron.visible=!active&&options.apron!=='none';
  }
  let animationTime=0,lastTime:number|undefined,lastMode='idle',modeStarted=0;
  let expressionOverride:{name:CharacterExpression;intensity:number}|null=null;
  const expression={happy:.35,focused:0,surprised:0,neutral:.3,confused:0};
  const manualGrips:{left:number|null;right:number|null}={left:null,right:null};
  let lookTarget:THREE.Vector3|null=null,lookWeight=0,gazeYaw=0,gazePitch=0;
  const phase=Array.from(`${initial.skin||''}${initial.shirt||''}`).reduce((n,c)=>n+c.charCodeAt(0),0)*.017;
  const previousPosition=new THREE.Vector3();
  let hasPosition=false,gaitPhase=phase,travelSpeed=0,previousHeading=0,turnRate=0;
  let nextGlance=0,glanceYaw=0,glancePitch=0,glanceCount=0;
  let nextBlink=1.1+(phase%1.7),blinkStarted=-10,blinkCount=0;
  const variation=(n:number)=>{const v=Math.sin(n*127.1+phase*311.7)*43758.5453;return v-Math.floor(v);};
  const poseBefore=boneList.map(()=>({q:new THREE.Quaternion(),p:new THREE.Vector3()}));
  const blendTarget=new THREE.Quaternion();
  const headBefore=new THREE.Quaternion(),hairBefore=new THREE.Quaternion(),apronBefore=new THREE.Quaternion();
  function setGrip(hand:'left'|'right',amount:number){manualGrips[hand]=THREE.MathUtils.clamp(amount,0,1);}
  function setExpression(name:CharacterExpression|'auto',intensity=1){expressionOverride=name==='auto'?null:{name,intensity:THREE.MathUtils.clamp(intensity,0,1)};}
  function lookAt(target:THREE.Vector3|null,weight=1){lookTarget=target?target.clone():null;lookWeight=THREE.MathUtils.clamp(weight,0,1);}
  function updateFingers(hand:typeof left,desired:number,alpha:number){
    hand.amount=lerp(hand.amount,desired,alpha);
    for(let i=0;i<hand.fingers.length;i++){
      const f=hand.fingers[i],g=hand.amount;
      f.base.rotation.set(-g*(.75+i*.045),-hand.sign*g*.035,f.spread*(1-g*.8));
      f.tip.rotation.x=-g*(1.20+i*.035);
    }
    hand.thumb.rotation.set(-hand.amount*.48,-hand.sign*hand.amount*.63,-hand.sign*hand.amount*.25);
  }
  function update(time: number,mode='idle',progress=0) {
    animationTime=time;
    const first=lastTime===undefined,dt=first?1/60:THREE.MathUtils.clamp(time-lastTime!,0,.07);lastTime=time;
    if(mode!==lastMode){lastMode=mode;modeStarted=time;}
    const age=Math.max(0,time-modeStarted),a=first?1:1-Math.exp(-dt*(mode==='cut'?17:11)),faceA=first?1:1-Math.exp(-dt*12);
    const walking=['walk','run','leave','arrive'].includes(mode),running=mode==='run';
    const distance=hasPosition?Math.min(Math.hypot(group.position.x-previousPosition.x,group.position.z-previousPosition.z),dt*2.8):0;
    const headingDelta=hasPosition?Math.atan2(Math.sin(group.rotation.y-previousHeading),Math.cos(group.rotation.y-previousHeading)):0;
    previousPosition.copy(group.position);previousHeading=group.rotation.y;hasPosition=true;
    travelSpeed=lerp(travelSpeed,dt>0?distance/dt:0,1-Math.exp(-dt*7));
    turnRate=lerp(turnRate,dt>0?THREE.MathUtils.clamp(headingDelta/dt,-2,2):0,1-Math.exp(-dt*6));
    // Advance the stride with actual travel so short queue steps and long walks have a matching cadence.
    if(walking)gaitPhase+=Math.max(distance,dt*(running?.85:.37))/(.70*Math.max(.75,group.scale.y))*TAU;
    for(let i=0;i<boneList.length;i++){poseBefore[i].q.copy(boneList[i].quaternion);poseBefore[i].p.copy(boneList[i].position);}
    headBefore.copy(head.quaternion);hairBefore.copy(hairGroup.quaternion);apronBefore.copy(apron.quaternion);
    const breathe=Math.sin(time*2.05+phase),sway=Math.sin(time*.83+phase),energetic=mode==='celebrate'||mode==='victory';
    const weightShift=Math.sin(time*.48+phase)*.65+Math.sin(time*.91+phase*1.7)*.35;
    bones.hips.position.set(weightShift*.018,.71+breathe*.005,Math.sin(time*.67+phase)*.004);
    bones.hips.rotation.set(0,Math.sin(time*.65+phase)*.018,-weightShift*.024);
    bones.spine.rotation.set(breathe*.010,0,weightShift*.020);
    bones.chest.rotation.set(breathe*.009,Math.sin(time*.57+phase)*.018,-weightShift*.012);
    bones.neck.rotation.set(Math.sin(time*1.22+phase)*.012,Math.sin(time*.49+phase)*.035,sway*.014);
    head.rotation.set(.008*Math.sin(time*1.57+phase),0,Math.sin(time*.95+phase)*.010);
    for(const [side,sign] of [['L',1],['R',-1]] as const){
      bones[`upperArm${side}`].rotation.set(-.035+Math.sin(time*1.8+sign+phase)*.025,0,sign*.045);
      bones[`forearm${side}`].rotation.set(-.10+Math.sin(time*1.8+sign+phase)*.02,0,0);
      bones[`forearm${side}`].position.copy(armRest[side].forearm);bones[`wrist${side}`].position.copy(armRest[side].wrist);
      bones[`wrist${side}`].rotation.set(.03*Math.sin(time*1.5+sign+phase),0,-sign*.02);
      bones[`thigh${side}`].rotation.set(-Math.max(0,weightShift*sign)*.025,0,sign*Math.max(0,weightShift*sign)*.025);
      bones[`calf${side}`].rotation.set(Math.max(0,weightShift*sign)*.045,0,0);
      bones[`ankle${side}`].rotation.set(-Math.max(0,weightShift*sign)*.020,0,0);
    }
    if(walking) {
      const w=Math.sin(gaitPhase),stride=(.22+Math.min(1,travelSpeed/1.15)*.21)*(running?1.25:1);
      bones.hips.position.y=.71+Math.cos(gaitPhase*2)*.010+(running?.012:0);bones.hips.position.x=w*.013;
      bones.hips.rotation.set(.015,w*.05,w*.028-turnRate*.022);
      bones.spine.rotation.set(.024+travelSpeed*.015,-w*.025,-w*.032);
      bones.chest.rotation.y=-w*.045;bones.neck.rotation.y=w*.020;bones.neck.rotation.x=-.012;
      head.rotation.x=Math.sin(gaitPhase*2-.4)*.009;
      for(const [side,sign] of [['L',1],['R',-1]] as const){
        const step=w*sign,swing=Math.max(0,-step),toeOff=Math.max(0,Math.sin(gaitPhase+sign*.65))*Math.max(0,step);
        bones[`thigh${side}`].rotation.set(step*stride,sign*.015,sign*.008);
        bones[`calf${side}`].rotation.x=.035+Math.pow(swing,1.45)*(running?.85:.57);
        bones[`ankle${side}`].rotation.x=-step*stride*.32-Math.pow(swing,1.45)*.26+toeOff*.12;
        bones[`upperArm${side}`].rotation.set(-step*stride*.72-.06,0,sign*(.045+Math.cos(gaitPhase*2)*.012));
        bones[`forearm${side}`].rotation.x=-.18-Math.max(0,step)*.15-(running?.28:0);
        bones[`wrist${side}`].rotation.x=Math.sin(gaitPhase*sign-.45)*.045;
      }
      if(mode==='leave'&&age<.8){
        const goodbye=Math.sin(Math.min(1,age/.8)*Math.PI);
        bones.upperArmR.rotation.z-=goodbye*.70;bones.forearmR.rotation.x-=goodbye*.65;
        bones.wristR.rotation.z+=Math.sin(age*12)*goodbye*.13;
        bones.neck.rotation.y=-goodbye*.17;
      }
    } else if(mode==='wave'||mode==='greet') {
      const greeting=mode==='greet'?1-THREE.MathUtils.smoothstep(age,1.05,1.65):1;
      const wave=Math.sin(age*8.4)*Math.exp(-age*.35),nod=Math.sin(Math.min(1,age/.65)*Math.PI);
      bones.upperArmR.rotation.set(-.35*greeting,0,-.05-1.95*greeting);bones.forearmR.rotation.set(-.18,0,(-.24+wave*.20)*greeting);
      bones.wristR.rotation.z=Math.sin(age*8.4-.35)*.19*greeting;bones.neck.rotation.z=.045*greeting;bones.neck.rotation.x=nod*.045;bones.chest.rotation.y=-.045*greeting;
    } else if(mode==='reach'||mode==='pick'||mode==='load'||mode==='add') {
      const lift=mode==='load'||mode==='add'?1.14:.88,anticipate=Math.sin(age*15)*Math.exp(-age*9)*.06;
      bones.spine.rotation.x=.055;bones.chest.rotation.y=-.035;bones.neck.rotation.x=.08;
      bones.upperArmR.rotation.set(-lift+anticipate,.08,-.18);bones.forearmR.rotation.x=-.30;
      bones.upperArmL.rotation.set(-.48,-.1,.15);bones.forearmL.rotation.x=-.42;
      bones.wristR.rotation.x=.16;
    } else if(mode==='cut'||mode==='prepare') {
      const cut=Math.sin(time*10.5)*Math.min(1,.35+progress),lift=Math.max(0,cut);
      bones.spine.rotation.x=.08;bones.neck.rotation.x=.12;bones.chest.rotation.y=-.025;
      bones.upperArmL.rotation.set(-.88,-.12,.18);bones.forearmL.rotation.x=-.42;
      bones.upperArmR.rotation.set(-.96+lift*.10,.08,-.19);bones.forearmR.rotation.x=-.32-cut*.12;
      bones.wristR.rotation.x=.28+cut*.06;
    } else if(mode==='blend'||mode==='press') {
      bones.upperArmR.rotation.set(-1.03,.12,-.14);bones.forearmR.rotation.x=-.18;bones.wristR.rotation.x=.18;
      bones.upperArmL.rotation.set(-.56,-.13,.08);bones.forearmL.rotation.x=-.42;
      bones.neck.rotation.x=.10;head.rotation.z=Math.sin(time*12)*.009;
      bones.hips.rotation.z=Math.sin(time*8)*.010;bones.chest.rotation.z=-Math.sin(time*8-.2)*.010;
    } else if(mode==='pour') {
      const tilt=THREE.MathUtils.clamp(progress,0,1);
      bones.upperArmR.rotation.set(-1.16,.12,-.26);bones.forearmR.rotation.set(-.42,0,-.12);
      bones.wristR.rotation.z=-.20-tilt*.55;
      bones.upperArmL.rotation.set(-.98,-.18,.18);bones.forearmL.rotation.x=-.46;bones.wristL.rotation.x=.06;
      bones.spine.rotation.x=.035;bones.neck.rotation.set(.11,-.05,.035);
    } else if(mode==='serve'||mode==='hold') {
      const extension=mode==='serve'?.10*Math.sin(Math.min(1,progress)*Math.PI):0;
      bones.upperArmR.rotation.set(-1.10-extension,.12,-.11);bones.forearmR.rotation.x=-.28;
      bones.upperArmL.rotation.set(-.40,-.12,.14);bones.forearmL.rotation.x=-.46;
      bones.neck.rotation.x=-.025;bones.chest.rotation.y=-.025;
    } else if(mode==='sip') {
      const drink=THREE.MathUtils.smoothstep(age,0,.48)*(1-THREE.MathUtils.smoothstep(progress,.82,1));
      const swallow=Math.sin(age*6.2)*Math.exp(-Math.max(0,age-.45)*2.1);
      bones.upperArmR.rotation.set(-.94-drink*.14,.24,-.22);bones.forearmR.rotation.set(-.45-drink*.93,0,-.12);bones.wristR.rotation.x=-.10*drink;
      bones.upperArmL.rotation.set(-.20,-.08,.08);bones.forearmL.rotation.x=-.38;
      bones.neck.rotation.x=.025+drink*.045+swallow*.012;head.rotation.x=-drink*.035;
      bones.chest.rotation.x=-drink*.012;bones.hips.rotation.z=-.015;
    } else if(energetic) {
      bones.upperArmL.rotation.set(-.16,0,2.24+Math.sin(time*7)*.07);bones.upperArmR.rotation.set(-.16,0,-2.24-Math.sin(time*7)*.07);
      bones.forearmL.rotation.z=.35;bones.forearmR.rotation.z=-.35;
      bones.hips.position.y=.71+Math.max(0,Math.sin(time*7))*.055;bones.hips.rotation.z=Math.sin(time*7)*.055;
      head.rotation.z=-Math.sin(time*7-.2)*.045;bones.neck.rotation.x=-.055;
    } else if(mode==='happy') {
      const joy=Math.sin(Math.min(1,age/.75)*Math.PI),nod=Math.sin(Math.min(1,Math.max(0,age-.20)/.75)*Math.PI);
      bones.hips.position.y=.71+joy*.018;bones.chest.rotation.x=-.025-joy*.025;bones.neck.rotation.x=-.035+nod*.075;
      bones.upperArmL.rotation.set(-.30,0,.38);bones.upperArmR.rotation.set(-.34,0,-.42);
      bones.forearmL.rotation.x=-.65-joy*.12;bones.forearmR.rotation.x=-.62-joy*.12;head.rotation.z=Math.sin(time*1.4+phase)*.026;
    } else if(mode==='confused') {
      bones.neck.rotation.z=.13;bones.chest.rotation.y=.035;
      bones.upperArmL.rotation.set(-.34,-.12,.34);bones.forearmL.rotation.x=-.75;bones.wristL.rotation.z=.35;
      bones.upperArmR.rotation.set(-.18,.10,-.15);bones.forearmR.rotation.x=-.40;
    } else if(mode==='surprised') {
      bones.spine.rotation.x=-.045;bones.neck.rotation.x=-.055;
      bones.upperArmL.rotation.set(-.38,0,.62);bones.upperArmR.rotation.set(-.38,0,-.62);
      bones.forearmL.rotation.x=-.50;bones.forearmR.rotation.x=-.50;
    } else if(mode==='listen') {
      const nod=Math.pow(Math.max(0,Math.sin(age*1.5+phase)),6);
      bones.neck.rotation.z=.045+Math.sin(time*.9+phase)*.012;bones.neck.rotation.x=nod*.055-.012;
      bones.forearmL.rotation.x=-.34;bones.forearmR.rotation.x=-.32;bones.chest.rotation.x=.012;
    }
    const target={happy:.28,focused:0,surprised:0,neutral:.28,confused:0};
    if(['cut','prepare','load','add','pick','reach','blend','press','pour'].includes(mode)){target.focused=.88;target.happy=.04;target.neutral=.12;}
    else if(['happy','celebrate','victory','serve'].includes(mode)){target.happy=1;target.neutral=0;}
    else if(mode==='neutral'||mode==='hold'){target.neutral=.88;target.happy=.12;}
    else if(mode==='confused'){target.confused=1;target.happy=0;target.neutral=0;}
    else if(mode==='surprised'){target.surprised=1;target.happy=0;target.neutral=0;}
    else if(mode==='sip'){target.happy=.55;target.focused=.20;target.neutral=.20;}
    else if(mode==='listen'){target.happy=.30;target.neutral=.65;}
    if(expressionOverride){for(const key of Object.keys(target) as (keyof typeof target)[])target[key]=0;target[expressionOverride.name]=expressionOverride.intensity;if(expressionOverride.name!=='neutral')target.neutral=1-expressionOverride.intensity;}
    for(const key of Object.keys(expression) as (keyof typeof expression)[])expression[key]=lerp(expression[key],target[key],faceA);
    const focusedTask=target.focused>.6;
    if(time>=nextGlance){
      glanceCount++;glanceYaw=(variation(glanceCount*2)-.5)*.26;glancePitch=(variation(glanceCount*2+1)-.5)*.12;
      nextGlance=time+1.2+variation(glanceCount+17)*2.5;
    }
    let yaw=glanceYaw*(focusedTask?.18:1),pitch=glancePitch*(focusedTask?.15:1);
    if(lookTarget&&lookWeight>0){
      group.updateMatrixWorld(true);
      const direction=lookTarget.clone().sub(head.getWorldPosition(new THREE.Vector3()));
      direction.applyQuaternion(bones.chest.getWorldQuaternion(new THREE.Quaternion()).invert());
      yaw+=THREE.MathUtils.clamp(Math.atan2(direction.x,direction.z),-.48,.48)*lookWeight;
      pitch+=THREE.MathUtils.clamp(-Math.atan2(direction.y,Math.hypot(direction.x,direction.z)),-.30,.30)*lookWeight;
    }
    // Eyes lead the slower neck, which prevents a fixed stare at the counter or player.
    bones.neck.rotation.y+=yaw*.68;bones.neck.rotation.x+=pitch*.62;
    gazeYaw=lerp(gazeYaw,yaw,faceA);gazePitch=lerp(gazePitch,pitch,faceA);
    if(!firstPerson)for(let i=0;i<gazes.length;i++){
      gazes[i].position.set(gazeYaw*.022,-gazePitch*.024,0);
      const sign=i===0?-1:1;
      brows[i].position.y=.211+expression.surprised*.040-expression.focused*.012+expression.confused*(i===0?.029:-.008);
      brows[i].rotation.z=sign*(-expression.focused*.14+expression.surprised*.06)+expression.confused*(i===0?-.12:.13);
      brows[i].scale.y=1+expression.surprised*.10;
    }
    if(time>=nextBlink){blinkStarted=time;blinkCount++;nextBlink=time+(blinkCount%5===0?.29:2.7+variation(blinkCount+83)*2.7);}
    const blinkPhase=(time-blinkStarted)/(.17+variation(blinkCount+31)*.035);
    const blink=blinkPhase>=0&&blinkPhase<=1?(blinkPhase<.34?THREE.MathUtils.smoothstep(blinkPhase,0,.34):1-THREE.MathUtils.smoothstep(blinkPhase,.34,1)):0;
    if(!firstPerson){
      lids.forEach(l=>l.update(blink,expression.focused,expression.happy,expression.surprised));
      shapeMouth(expression.happy,expression.focused,expression.surprised,expression.confused,expression.neutral);
    }
    const gripDefault=['hold','sip','pour','serve','pick','load','add'].includes(mode)?.80:mode==='cut'||mode==='prepare'?.92:.05;
    updateFingers(left,manualGrips.left??(mode==='cut'?.50:mode==='blend'?.25:gripDefault),faceA);
    updateFingers(right,manualGrips.right??(mode==='blend'?.18:gripDefault),faceA);
    hairGroup.rotation.set((walking?Math.sin(gaitPhase*2-.65)*.009:0)+breathe*.003,turnRate*.015,Math.sin(time*.83+phase-.35)*.008+(energetic?Math.sin(time*7-.45)*.018:walking?Math.sin(gaitPhase-.5)*.012:0));
    apron.rotation.set(Math.sin(time*2.05+phase-.4)*.005+(walking?Math.sin(gaitPhase*2-.45)*.017:0),walking?Math.sin(gaitPhase-.3)*.010:0,walking?Math.sin(gaitPhase-.55)*.008:0);
    for(let i=0;i<boneList.length;i++){
      const name=boneList[i].name,follow=first?1:name==='hips'||name==='spine'?1-Math.exp(-dt*9):name==='neck'?1-Math.exp(-dt*8):a;
      blendTarget.copy(boneList[i].quaternion);boneList[i].quaternion.slerpQuaternions(poseBefore[i].q,blendTarget,follow);boneList[i].position.lerpVectors(poseBefore[i].p,boneList[i].position,follow);
    }
    blendTarget.copy(head.quaternion);head.quaternion.slerpQuaternions(headBefore,blendTarget,a);blendTarget.copy(hairGroup.quaternion);hairGroup.quaternion.slerpQuaternions(hairBefore,blendTarget,a);blendTarget.copy(apron.quaternion);apron.quaternion.slerpQuaternions(apronBefore,blendTarget,a);
    if(mode==='sip'){
      group.updateMatrixWorld(true);const sipTarget=head.localToWorld(new THREE.Vector3(-.075,-.30,.37));reach('right',sipTarget,THREE.MathUtils.smoothstep(age,0,.45)*(1-THREE.MathUtils.smoothstep(progress,.82,1)));
    }
  }
  /** Two-bone IK with capped 25% anatomical extension. update() smoothly relaxes offsets when released. */
  function reach(hand: 'left' | 'right', worldTarget: THREE.Vector3, weight = 1) {
    const side = hand === 'left' ? 'L' : 'R', sign = side === 'L' ? 1 : -1;
    const upper = bones[`upperArm${side}`], lower = bones[`forearm${side}`];
    const grip = hand === 'left' ? left.grip : right.grip, parent = upper.parent!;
    const blend = THREE.MathUtils.clamp(weight, 0, 1); if (blend === 0) return;
    group.updateMatrixWorld(true);
    const upperBefore = upper.quaternion.clone(), lowerBefore = lower.quaternion.clone();
    const forearmBefore=lower.position.clone(),wrist=bones[`wrist${side}`],wristBefore=wrist.position.clone();
    const rest=armRest[side];
    const goal=parent.worldToLocal(worldTarget.clone()).sub(upper.position);
    // Preserve the real palm's length. Only the two anatomical limb offsets may extend, by at most 25%.
    const palmOffset=lower.worldToLocal(grip.getWorldPosition(new THREE.Vector3())).sub(wrist.position);
    const available=(stretch:number)=>rest.forearm.length()*stretch+rest.wrist.clone().multiplyScalar(stretch).add(palmOffset).length();
    let stretch=1;
    if(goal.length()+.0006>available(1)){
      let lo=1,hi=1.25;
      for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(available(mid)<goal.length()+.0006)lo=mid;else hi=mid;}
      stretch=hi;
    }
    lower.position.copy(rest.forearm).multiplyScalar(stretch);wrist.position.copy(rest.wrist).multiplyScalar(stretch);
    group.updateMatrixWorld(true);
    const lowerRest = lower.worldToLocal(grip.getWorldPosition(new THREE.Vector3()));
    const upperRest = lower.position.clone(), lengthA = upperRest.length(), lengthB = lowerRest.length();
    const distance = THREE.MathUtils.clamp(goal.length(), Math.abs(lengthA-lengthB)+.0005, lengthA+lengthB-.0005);
    const direction = goal.lengthSq() > .000001 ? goal.normalize() : new THREE.Vector3(0,-1,0);
    const pole = new THREE.Vector3(sign*.9,-.12,.4);
    pole.addScaledVector(direction,-pole.dot(direction));
    if(pole.lengthSq()<.0001)pole.set(sign,0,.1).addScaledVector(direction,-sign*direction.x);
    pole.normalize();
    const cos = THREE.MathUtils.clamp((distance*distance+lengthA*lengthA-lengthB*lengthB)/(2*distance*lengthA),-1,1);
    const elbow = direction.clone().multiplyScalar(cos*lengthA).addScaledVector(pole,Math.sqrt(1-cos*cos)*lengthA);
    const upperSolved = new THREE.Quaternion().setFromUnitVectors(upperRest.clone().normalize(),elbow.normalize());
    upper.quaternion.copy(upperSolved); group.updateMatrixWorld(true);
    const clampedWorld = parent.localToWorld(upper.position.clone().addScaledVector(direction,distance));
    const lowerDirection = upper.worldToLocal(clampedWorld).sub(lower.position).normalize();
    const lowerSolved = new THREE.Quaternion().setFromUnitVectors(lowerRest.normalize(),lowerDirection);
    upper.quaternion.copy(upperBefore).slerp(upperSolved,blend);
    lower.quaternion.copy(lowerBefore).slerp(lowerSolved,blend);
    lower.position.lerpVectors(forearmBefore,rest.forearm.clone().multiplyScalar(stretch),blend);wrist.position.lerpVectors(wristBefore,rest.wrist.clone().multiplyScalar(stretch),blend);
    group.updateMatrixWorld(true);
  }
  update(animationTime);
  return {group,head,leftHand:left.grip,rightHand:right.grip,update,setOptions,reach,setGrip,setExpression,lookAt,setFirstPerson};
}
