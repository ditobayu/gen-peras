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
}

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
    const geometries=parts.map(part=>{
      const g=part.geometry.clone();
      // Procedural lofts omit UVs; normalize their layout before merging with organic/tube surfaces.
      if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
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
  const skin = material(options.skin!, .62); skin.emissive.set(options.skin!); skin.emissiveIntensity = .035;
  const warmSkin = material('#bd725a', .72), blush = material('#d98275', .86);
  const shirt = material(options.shirt!, .92), apronMat = material(options.apron === 'none' ? '#7dbb81' : options.apron!, .93);
  const hairMat = material(options.hair!, .72), hairLight = material(options.hair!, .76);
  const cocoa = material('#45312d', .65), mouthMat = material('#762f2c', .83), lipMat = material('#bd705b', .7);
  const ivory = material('#fff9df', .34), eyeWhite = material('#fff9e8', .29), irisMat = material('#5a3b2a', .3);
  const pupilMat = material('#211a19', .22), glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const trouser = material('#4c6763', .94), shoes = material('#fff2d6', .7), sole = material('#dbb88e', .91);
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
  function skinMesh(geometry: THREE.BufferGeometry, mat: THREE.Material, weights: (p: THREE.Vector3) => [string, string, number]) {
    const pos = geometry.getAttribute('position'), ids: number[] = [], w: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const [a, b, mix] = weights(new THREE.Vector3().fromBufferAttribute(pos, i));
      ids.push(boneList.indexOf(bones[a]), boneList.indexOf(bones[b]), 0, 0); w.push(1 - mix, mix, 0, 0);
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
    const pts: number[] = [], idx: number[] = [];
    for (let j = 0; j < rings.length; j++) for (let i = 0; i <= segments; i++) {
      const a = i / segments * TAU, r = rings[j];
      const pleat = 1 + .015 * Math.sin(a * 7 + j * 1.3);
      pts.push(r.p[0] + Math.cos(a) * r.rx * pleat, r.p[1], r.p[2] + Math.sin(a) * r.rz * pleat);
      if (j < rings.length - 1 && i < segments) { const n = j * (segments + 1) + i; idx.push(n, n + segments + 1, n + 1, n + 1, n + segments + 1, n + segments + 2); }
    }
    if(input[0].p[1]>input[input.length-1].p[1])for(let i=0;i<idx.length;i+=3){const a=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=a;}
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // Torso and four limbs are deformable surfaces bound to one real skeleton.
  skinMesh(loft([
    {p:[0,.675,0],rx:.19,rz:.125},{p:[0,.72,0],rx:.225,rz:.15},
    {p:[0,.82,.005],rx:.24,rz:.17},{p:[0,.98,0],rx:.226,rz:.172},
    {p:[0,1.17,0],rx:.25,rz:.157},{p:[0,1.285,0],rx:.28,rz:.14},
    {p:[0,1.34,0],rx:.22,rz:.12},{p:[0,1.375,0],rx:.09,rz:.085},
  ]), shirt, p => ['spine','chest',THREE.MathUtils.smoothstep(p.y, .96, 1.3)]);
  for (const [side, s] of [['L', 1], ['R', -1]] as const) {
    skinMesh(loft([
      {p:[s*.27,1.29,0],rx:.105,rz:.103},{p:[s*.32,1.20,.005],rx:.10,rz:.10},
      {p:[s*.37,1.08,.015],rx:.077,rz:.08},{p:[s*.39,.99,.025],rx:.073,rz:.073},
      {p:[s*.40,.86,.045],rx:.054,rz:.056},
    ]), skin, p => [`upperArm${side}`,`forearm${side}`,1 - THREE.MathUtils.smoothstep(p.y, 1.02, 1.14)]);
    skinMesh(loft([
      {p:[s*.242,1.37,0],rx:.025,rz:.045},{p:[s*.27,1.335,0],rx:.10,rz:.10},
      {p:[s*.292,1.285,0],rx:.121,rz:.12},{p:[s*.32,1.205,.005],rx:.109,rz:.112},
      {p:[s*.343,1.15,.009],rx:.096,rz:.103},{p:[s*.343,1.138,.009],rx:.098,rz:.104},
    ]), shirt, () => [`upperArm${side}`,`upperArm${side}`,0]);
    skinMesh(loft([
      {p:[s*.13,.76,0],rx:.129,rz:.13},{p:[s*.13,.64,0],rx:.13,rz:.135},
      {p:[s*.135,.45,.005],rx:.101,rz:.102},{p:[s*.135,.37,.005],rx:.094,rz:.097},
      {p:[s*.135,.18,.025],rx:.087,rz:.086},{p:[s*.135,.14,.025],rx:.084,rz:.084},
    ]), trouser, p => [`thigh${side}`,`calf${side}`,1-THREE.MathUtils.smoothstep(p.y,.35,.48)]);
    const foot = new THREE.Group(); bones[`ankle${side}`].add(foot);
    const shoe = organic(.109,.095,.19,(x,y,z) => [x*.112*(1+.05*z), y*.078 + .004*(1-z), z*.18+.065],28);
    mesh(foot,shoe,shoes,[0,-.052,.02]);
    blob(foot,[.115,.026,.185],sole,[0,-.105,.085]);
    stroke(foot,[[-.075,-.058,.215],[0,-.046,.233],[.075,-.058,.215]],.006,trim);
    for(let j=0;j<3;j++) stroke(foot,[[-.04,.004-j*.008,.13-j*.028],[0,.013-j*.008,.135-j*.028],[.04,.004-j*.008,.13-j*.028]],.006,ivory,8);
    batchStaticMeshes(foot);
    const cuff = new THREE.Group(); bones[`calf${side}`].add(cuff);
    stroke(cuff,[[-.077,-.23,.096],[0,-.225,.11],[.077,-.23,.096]],.012,trouser,12);
  }
  const collar = new THREE.Group(); collar.position.set(0,.135,0); bones.chest.add(collar);
  blob(collar,[.093,.105,.08],skin,[0,.03,0]);
  stroke(collar,[[-.115,-.013,.07],[-.085,-.032,.10],[0,-.055,.107],[.085,-.032,.10],[.115,-.013,.07]],.018,trim);
  batchStaticMeshes(collar);
  // Apron follows the upper body, with a shaped bib, piping, ties and a real pocket.
  const apron = new THREE.Group(); bones.spine.add(apron); apron.position.y = -.92;
  function clothPanel(parent: THREE.Object3D, y0:number,y1:number,width:(t:number)=>number,z:(t:number,x:number)=>number,mat:THREE.Material) {
    const p:number[]=[], idx:number[]=[];
    for(let j=0;j<=20;j++)for(let i=0;i<=20;i++){
      const t=j/20,u=i/20*2-1,x=u*width(t);p.push(x,lerp(y0,y1,t),z(t,u));
      if(j<20&&i<20){const a=j*21+i;idx.push(a,a+1,a+21,a+1,a+22,a+21);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
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
  batchStaticMeshes(apron);

  function makeHand(parent: THREE.Bone, sign:number) {
    const h=new THREE.Group();parent.add(h);
    blob(h,[.058,.079,.037],skin,[0,-.06,.009],24);
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.026, length=[.067,.082,.077,.06][i];
      sculptedLock(h,[[x,-.087,.014],[x,-.12,.028],[x+sign*.002,-.089-length,.039]],.014,.014,skin);
      stroke(h,[[x-.008,-.112,.043],[x+.008,-.112,.043]],.0014,warmSkin,4);
    }
    sculptedLock(h,[[sign*.043,-.027,.018],[sign*.077,-.06,.04],[sign*.069,-.102,.055]],.022,.019,skin);
    const grip=new THREE.Object3D();grip.name='prop grip';grip.position.set(0,-.103,.055);h.add(grip);batchStaticMeshes(h);return {h,grip};
  }
  const left=makeHand(bones.wristL,1),right=makeHand(bones.wristR,-1);
  const head=new THREE.Group();head.position.set(0,.295,.005);bones.neck.add(head);head.name='sculpted expressive head';
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
  const eyes:THREE.Group[]=[];
  const eyelids:THREE.Mesh[]=[];
  for(const s of [-1,1]){
    const eye=new THREE.Group();eye.position.set(s*.133,.067,.303);eye.rotation.y=s*.12;head.add(eye);eyes.push(eye);
    blob(eye,[.099,.111,.039],warmSkin,[0,0,-.006],28);
    blob(eye,[.092,.104,.04],eyeWhite,[0,0,0],32);
    blob(eye,[.050,.069,.014],irisMat,[-s*.005,-.004,.036],24);
    blob(eye,[.027,.047,.009],pupilMat,[-s*.004,-.001,.049],24);
    blob(eye,[.015,.018,.008],glintMat,[-.017,.026,.057],16);
    blob(eye,[.006,.007,.003],glintMat,[.018,-.026,.057],12);
    stroke(eye,[[-.087,.017,.015],[-.071,.079,.028],[0,.107,.029],[.071,.078,.028],[.087,.017,.015]],.008,cocoa,24);
    stroke(eye,[[-.081,-.033,.018],[-.05,-.082,.027],[0,-.101,.026],[.065,-.069,.023],[.086,-.025,.013]],.006,skin,20);
    const lid=blob(eye,[.096,.111,.044],skin,[0,0,.004],28);lid.visible=false;eyelids.push(lid);batchStaticMeshes(eye,false,new Set([lid]));
    sculptedLock(head,[[s*.053,.234,.303],[s*.124,.25,.303],[s*.207,.208,.281]],.020,.013,hairMat);
  }
  // Nose has a lifted bridge, broad soft tip, nostrils and a tiny warm underside.
  mesh(head,organic(.056,.081,.065,(x,y,z)=>[x*.056*(1-.25*y),y*.075,z*.062+.013*Math.max(0,-y)],28),skin,[0,-.035,.329]);
  blob(head,[.052,.035,.04],skin,[0,-.079,.371],24);
  for(const s of [-1,1])blob(head,[.011,.005,.006],warmSkin,[s*.029,-.099,.391],12);
  // Sculpted open smile, teeth and a separate lower lip.
  function smileSurface(yUpper:(u:number)=>number,yLower:(u:number)=>number,z:number,mat:THREE.Material){
    const p:number[]=[],id:number[]=[];
    for(let i=0;i<=36;i++)for(let j=0;j<=4;j++){
      const u=i/36*2-1;p.push(u*.126,lerp(yUpper(u),yLower(u),j/4),z-.035*u*u);
      if(i<36&&j<4){const a=i*5+j;id.push(a,a+1,a+5,a+1,a+6,a+5);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(id);g.computeVertexNormals();return mesh(head,g,mat);
  }
  const mouth=smileSurface(u=>-.144+.038*u*u,u=>-.235+.129*Math.pow(Math.abs(u),1.8),.322,mouthMat);
  smileSurface(u=>-.147+.038*u*u,u=>-.172+.063*u*u,.326,ivory);
  const tongue=blob(head,[.052,.019,.004],lipMat,[0,-.214,.324],20);
  stroke(head,[[-.125,-.108,.29],[-.09,-.194,.307],[0,-.239,.322],[.09,-.194,.307],[.125,-.108,.29]],.009,lipMat,28);
  for(const s of [-1,1])stroke(head,[[s*.129,-.10,.287],[s*.138,-.119,.285],[s*.133,-.135,.287]],.005,warmSkin,8);
  batchStaticMeshes(head,false,new Set([faceMesh,mouth,tongue]));
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
    options={...options,...next};skin.color.set(options.skin!);skin.emissive.set(options.skin!);faceMaterial.emissive.set(options.skin!);tintFace();
    const skinColor=new THREE.Color(options.skin!);warmSkin.color.copy(skinColor).lerp(new THREE.Color('#a85745'),.44);
    blush.color.copy(skinColor).lerp(new THREE.Color('#e9847c'),.43);
    lipMat.color.copy(skinColor).lerp(new THREE.Color('#a85a50'),.50);
    hairMat.color.set(options.hair!);hairLight.color.set(options.hair!).lerp(new THREE.Color('#9c7353'),.17);
    shirt.color.set(options.shirt!);apron.visible=options.apron!=='none';if(options.apron!=='none')apronMat.color.set(options.apron!);
    group.scale.setScalar(options.body==='tall'?1.07:options.body==='small'?.93:1);
    head.scale.set(options.face==='round'?1.065:1,options.face==='long'?1.07:1,1);
    if(oldStyle!==options.hairstyle||hairGroup.children.length===0)buildHair();
    if(oldHat!==options.hat||oldGlasses!==options.glasses||accessories.children.length===0)buildAccessories();
  }
  setOptions(options);
  let animationTime=0;
  function update(time: number,mode='idle',progress=0) {
    animationTime=time;
    const breathe=Math.sin(time*2.25),sway=Math.sin(time*1.6);
    const energetic=mode==='celebrate';
    bones.hips.position.y=.71+(energetic?Math.max(0,Math.sin(time*8))*.09:Math.sin(time*2.25)*.008);
    bones.hips.rotation.set(0,Math.sin(time*1.3)*.025,Math.sin(time*1.6)*.022);
    bones.spine.rotation.set(breathe*.012,0,-sway*.025);
    bones.chest.rotation.set(0,Math.sin(time*.8)*.018,0);
    bones.neck.rotation.set(Math.sin(time*1.45)*.022,Math.sin(time*.85)*.06,-sway*.025);
    head.rotation.set(.012*Math.sin(time*1.9),0,Math.sin(time*1.1)*.02);
    for(const [side,s] of [['L',1],['R',-1]] as const){
      bones[`upperArm${side}`].rotation.set(-.035+Math.sin(time*1.8+s)*.025,0,s*.045);
      bones[`forearm${side}`].rotation.set(-.10+Math.sin(time*1.8+s)*.02,0,0);
      bones[`wrist${side}`].rotation.set(0,0,0);
      bones[`thigh${side}`].rotation.set(0,0,0);bones[`calf${side}`].rotation.set(0,0,0);
      bones[`ankle${side}`].rotation.set(0,0,0);
    }
    const blinkPhase=(time+1.23)%4.6,blink=blinkPhase<.13;
    eyelids.forEach(l=>{l.visible=blink;});
    eyes.forEach((e,i)=>{e.rotation.y=(i===0?-1:1)*.12+Math.sin(time*.7)*.018;});
    mouth.scale.y=energetic?1.12:1;tongue.visible=true;
    if(mode==='walk'||mode==='run') {
      const speed=mode==='run'?10:7.5,a=Math.sin(time*speed),b=Math.sin(time*speed+Math.PI);
      bones.hips.position.y=.71+Math.abs(Math.sin(time*speed))*.025;
      bones.hips.rotation.y=a*.04;bones.neck.rotation.y=-a*.04;
      bones.thighL.rotation.x=a*.42;bones.thighR.rotation.x=b*.42;
      bones.calfL.rotation.x=Math.max(0,-a)*.48;bones.calfR.rotation.x=Math.max(0,-b)*.48;
      bones.upperArmL.rotation.x=b*.37;bones.upperArmR.rotation.x=a*.37;
      bones.forearmL.rotation.x=-.24;bones.forearmR.rotation.x=-.24;
    } else if(mode==='wave'||mode==='greet') {
      bones.upperArmR.rotation.set(-.35,0,-2.24);
      bones.forearmR.rotation.set(-.18,0,-.25+Math.sin(time*9)*.28);
      bones.wristR.rotation.z=Math.sin(time*9)*.18;
      bones.neck.rotation.z=.09;
    } else if(mode==='cut'||mode==='prepare') {
      bones.spine.rotation.x=.09;bones.neck.rotation.x=.12;
      bones.upperArmL.rotation.set(-.85,-.12,.19);bones.forearmL.rotation.x=-.40;
      bones.upperArmR.rotation.set(-.92+Math.sin(time*11)*.15,.08,-.22);bones.forearmR.rotation.x=-.32-Math.sin(time*11)*.13;
      bones.wristR.rotation.x=.35;
    } else if(mode==='blend'||mode==='press') {
      bones.upperArmR.rotation.set(-1.01,.12,-.16);bones.forearmR.rotation.x=-.18;
      bones.upperArmL.rotation.set(-.5,-.15,.08);bones.forearmL.rotation.x=-.5;
      bones.neck.rotation.x=.09;head.rotation.z=Math.sin(time*14)*.025;
      if(mode==='blend'){bones.hips.rotation.z=Math.sin(time*10)*.024;bones.chest.rotation.z=-Math.sin(time*10)*.018;}
    } else if(mode==='pour') {
      bones.upperArmR.rotation.set(-1.19,.12,-.30);bones.forearmR.rotation.set(-.42,0,-.18);
      bones.wristR.rotation.z=-.75;
      bones.upperArmL.rotation.set(-.98,-.20,.20);bones.forearmL.rotation.x=-.48;
      bones.neck.rotation.set(.12,-.07,.06);
    } else if(mode==='serve') {
      const a=Math.sin(Math.min(1,progress||.5)*Math.PI);
      bones.upperArmR.rotation.set(-1.16-.1*a,.12,-.12);bones.forearmR.rotation.x=-.22;
      bones.upperArmL.rotation.set(-.40,-.2,.16);bones.forearmL.rotation.x=-.5;
      bones.neck.rotation.x=-.025;
    } else if(mode==='celebrate'||mode==='victory') {
      bones.upperArmL.rotation.set(-.16,0,2.3+Math.sin(time*8)*.08);
      bones.upperArmR.rotation.set(-.16,0,-2.3-Math.sin(time*8)*.08);
      bones.forearmL.rotation.z=.35;bones.forearmR.rotation.z=-.35;
      bones.hips.rotation.z=Math.sin(time*8)*.08;head.rotation.z=-Math.sin(time*8)*.06;
      bones.neck.rotation.x=-.07;
    } else if(mode==='listen') {
      bones.neck.rotation.z=.11;bones.forearmL.rotation.x=-.5;bones.forearmR.rotation.x=-.45;
    }
    // Locks and apron have a tiny delayed follow-through, rather than moving as rigid costume pieces.
    hairGroup.rotation.z=Math.sin(time*1.6-.3)*.009+(mode==='celebrate'?Math.sin(time*8-.5)*.025:0);
    apron.rotation.x=Math.sin(time*2.25-.4)*.006;
  }
  /** Analytic two-bone IK. Call after update(). Targets are world coordinates; unreachable targets clamp. */
  function reach(hand: 'left' | 'right', worldTarget: THREE.Vector3, weight = 1) {
    const side = hand === 'left' ? 'L' : 'R', sign = side === 'L' ? 1 : -1;
    const upper = bones[`upperArm${side}`], lower = bones[`forearm${side}`];
    const grip = hand === 'left' ? left.grip : right.grip, parent = upper.parent!;
    const blend = THREE.MathUtils.clamp(weight, 0, 1); if (blend === 0) return;
    group.updateMatrixWorld(true);
    const upperBefore = upper.quaternion.clone(), lowerBefore = lower.quaternion.clone();
    // Solve to the actual prop socket, including the palm and any animated wrist rotation.
    const lowerRest = lower.worldToLocal(grip.getWorldPosition(new THREE.Vector3()));
    const upperRest = lower.position.clone(), lengthA = upperRest.length(), lengthB = lowerRest.length();
    const goal = parent.worldToLocal(worldTarget.clone()).sub(upper.position);
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
    lower.quaternion.copy(lowerBefore).slerp(lowerSolved,blend);group.updateMatrixWorld(true);
  }
  update(animationTime);
  return {group,head,leftHand:left.grip,rightHand:right.grip,update,setOptions,reach};
}
