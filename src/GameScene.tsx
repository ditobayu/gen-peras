import {useEffect,useRef,useState,forwardRef,useImperativeHandle} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createWorld,createFruit} from './world';
import {createCharacter,type CharacterRig} from './characters';
import {WorldInteractor,type Gesture} from './interaction';
import type {PrepState,PrepEvent} from './preparation';
import type {Appearance,Order} from './engine';
export type SceneApi={capture:()=>string,reset:()=>void,zoom:(n:number)=>void};
type Props={appearance:Appearance,order:Order|null,queue?:Order[],prep:PrepState,color:string,upgrades:string[],location:string,photo:boolean,light:string,paused:boolean,enabled:boolean,standColor:string,fruitId:string,modifier:string,eventType:string,reaction:'happy'|'neutral'|'confused',onAction:(event:PrepEvent)=>void,onTick:(dt:number)=>void,onReady:()=>void,showroom?:boolean,slowMotion?:number,cameraMode?:string,labRevision?:number,onLabFrame?:(phase:string,png:string)=>void};
const FRUIT_NAMES:Record<string,string>={mango:'Mangga',avocado:'Alpukat',orange:'Jeruk',watermelon:'Semangka',strawberry:'Stroberi',guava:'Jambu',banana:'Pisang',pineapple:'Nanas'};
const smooth=(x:number)=>x*x*(3-2*x);
export const GameScene=forwardRef<SceneApi,Props>(function GameScene(props,ref){
 const mount=useRef<HTMLDivElement>(null),live=useRef(props);live.current=props;
 const api=useRef<SceneApi>({capture(){return ''},reset(){},zoom(){}});
 useImperativeHandle(ref,()=>({capture:()=>api.current.capture(),reset:()=>api.current.reset(),zoom:n=>api.current.zoom(n)}),[]);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!mount.current)return;const el=mount.current;let disposed=false;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch{setError('WebGL is unavailable. Enable hardware acceleration in your browser to open your little stand.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.setClearColor(0xf7efdc,1);el.prepend(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xf7efdc,15,36);
  const camera=new THREE.PerspectiveCamera(49,1,.07,70);
  const home=new THREE.Vector3(0,2.32,-1.35),homeLook=new THREE.Vector3(-.1,1.58,1.0);camera.position.copy(home);camera.lookAt(homeLook);
  const photoControls=new OrbitControls(camera,renderer.domElement);photoControls.target.copy(homeLook);photoControls.enabled=false;photoControls.enableDamping=true;photoControls.dampingFactor=.07;photoControls.minDistance=1.6;photoControls.maxDistance=18;photoControls.maxPolarAngle=1.5;
  const hemi=new THREE.HemisphereLight(0xdceafa,0xbca67c,1.4);scene.add(hemi);scene.add(new THREE.AmbientLight(0xffe8c6,.16));
  const sun=new THREE.DirectionalLight(0xffe2ae,3.6);sun.position.set(-4,9,-5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:30});sun.shadow.bias=-.0002;sun.shadow.normalBias=.02;sun.shadow.radius=4;scene.add(sun);
  const bounce=new THREE.DirectionalLight(0xf6c68f,.65);bounce.position.set(2,2,-3);scene.add(bounce);const rim=new THREE.DirectionalLight(0xd5edeb,1.15);rim.position.set(4,5,7);scene.add(rim);
  const world=createWorld();world.targets.serve.position.x=-.55;scene.add(world.group);
  const vendor=createCharacter({});vendor.group.position.set(-.95,0,-.35);scene.add(vendor.group);
  const firstPersonArms=new THREE.Group();scene.add(firstPersonArms);const armMaterial=new THREE.MeshStandardMaterial({color:props.appearance.skin,roughness:.7});const viewArms=[-1,1].map(()=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.044,.072,1,14),armMaterial);m.castShadow=true;firstPersonArms.add(m);return m;});
  let customers:CharacterRig[]=[];
  const actors=new Map<string,{rig:CharacterRig,exitAt:number|null,exitFrom:THREE.Vector3}>();
  const queueSpot=(i:number)=>new THREE.Vector3(i===0?-.55:.4+(i-1)*.74,0,2.28+i*.92);
  function syncQueue(t:number){
   const orders=live.current.queue|| (live.current.order?[live.current.order]:[]),ids=new Set(orders.map(o=>o.id));
   for(const [id,actor] of actors)if(!ids.has(id)&&actor.exitAt===null){actor.exitAt=t;actor.exitFrom.copy(actor.rig.group.position);}
   customers=orders.map((o,i)=>{let actor=actors.get(o.id);if(!actor){const c=o.customer,rig=createCharacter({skin:c.id==='alex'?'#e5b58e':c.id==='budi'?'#ad7756':'#c78f66',shirt:c.color,hairstyle:['short','side','buzz'].includes(c.hair)?'sidepart':c.hair==='wavy'?'ponytail':c.hair,apron:'none',glasses:c.id==='oma'||c.id==='budi',hat:c.id==='alex'});rig.group.scale.setScalar(1.12);rig.group.position.copy(queueSpot(i)).add(new THREE.Vector3(.45,0,2.2));rig.group.rotation.y=Math.PI;rig.group.userData.orderId=o.id;rig.group.userData.customerId=c.id;scene.add(rig.group);actor={rig,exitAt:null,exitFrom:new THREE.Vector3()};actors.set(o.id,actor);}return actor.rig;});
  }
  const passing=createCharacter({skin:'#c2865e',hair:'#352e29',shirt:'#8ab4d2',apron:'none',hairstyle:'bob'});passing.group.scale.setScalar(.8);scene.add(passing.group);
  const overlay=document.createElement('div');overlay.className='world-hints';overlay.setAttribute('aria-label','Area kerja dan bahan');el.appendChild(overlay);
  const hints=new Map<string,HTMLDivElement>();
  for(const id of [...Object.keys(FRUIT_NAMES).map(id=>'fruit-'+id),'board','portions','ice','water','milk','blender-control','jar','cup','serve']){const label=document.createElement('div');label.className='world-hint';label.dataset.target=id;label.addEventListener('pointerdown',event=>interactor.begin(event,id));overlay.appendChild(label);hints.set(id,label);}
  const dragGuide=document.createElementNS('http://www.w3.org/2000/svg','svg');dragGuide.classList.add('drag-route');const route=document.createElementNS('http://www.w3.org/2000/svg','path');dragGuide.appendChild(route);overlay.prepend(dragGuide);
  const dragGhost=document.createElement('div');dragGhost.className='drag-ghost';overlay.appendChild(dragGhost);
  const feedback=document.createElement('div');feedback.className='drop-feedback';feedback.setAttribute('role','status');overlay.appendChild(feedback);let feedbackUntil=0;
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.25,.012,8,48),new THREE.MeshBasicMaterial({color:0xd8d88a,transparent:true,opacity:.65,depthTest:false}));halo.rotation.x=Math.PI/2;halo.renderOrder=8;scene.add(halo);
  const guides=new THREE.Group();scene.add(guides);const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.76,1.46,.25),new THREE.Vector3(-.22,1.46,.25)]);const guideLine=new THREE.Line(lineGeo,new THREE.LineDashedMaterial({color:0xffffc9,dashSize:.05,gapSize:.035,transparent:true,opacity:.9,depthTest:false}));guideLine.computeLineDistances();guides.add(guideLine);
  const heldFruit=new THREE.Group();scene.add(heldFruit);let heldId='';
  const rayScreen=new THREE.Vector3(),workLook=homeLook.clone(),cameraGoal=home.clone(),lookGoal=homeLook.clone();let zoomIntent=1,peekX=0,peekY=0,rightDrag=false,rightX=0,rightY=0;
  let appearance='',upgrade='',location='',standColor='',lighting='',lastOrder='',wasPhoto=false,lastPhase='',elapsed=0,raf=0;let hover:string|null=null,dragGesture:Gesture|null=null,dragging:string|null=null,dragWorld:THREE.Vector3|null=null,handoffFrom:THREE.Vector3|null=null,sliced=false,customerArrival=0,renderCount=0,previousSpill=0;const capturedFrames=new Set<string>();
  const targetId=()=>{const p=live.current.prep;if(p.phase==='select')return 'fruit-'+p.requiredFruits.find(f=>!p.selectedFruits.includes(f));if(p.phase==='cut')return 'board';if(p.phase==='load')return p.loadedPortions<2?'portions':!p.iceAdded&&p.modifier!=='Tanpa es'?'ice':p.liquidType===null?(live.current.fruitId==='avocado'&&p.modifier!=='Tanpa susu'?'milk':'water'):'jar';if(p.phase==='blend')return 'blender-control';if(p.phase==='pour')return 'jar';if(p.phase==='ready')return 'cup';return '';};
  const accepts=(id:string)=>{const p=live.current.prep;if(p.phase==='select')return id.startsWith('fruit-')&&p.requiredFruits.includes(id.slice(6))&&!p.selectedFruits.includes(id.slice(6));if(p.phase==='cut')return id==='board';if(p.phase==='load')return p.loadedPortions<2?id==='portions':!p.iceAdded&&p.modifier!=='Tanpa es'?id==='ice':!p.liquidAdded?['water','milk'].includes(id):false;if(p.phase==='blend')return id==='blender-control';if(p.phase==='pour')return id==='jar';if(p.phase==='ready')return id==='cup';return false;};
  const dispatch=(event:PrepEvent)=>live.current.onAction(event);
  let interactor:WorldInteractor;
  function releasePour(){dispatch({type:'POUR_STOP'});if(live.current.prep.fill>=.4)dispatch({type:'FINISH_POUR'});}
  interactor=new WorldInteractor(renderer.domElement,camera,{
   enabled:()=>live.current.enabled&&!live.current.photo,
   targets:()=>world.targets,
   accepts,
   bounds:id=>hints.get(id)?.getBoundingClientRect()||null,
   hover:id=>{hover=id;renderer.domElement.style.cursor=id?(id==='board'?'crosshair':'grab'):'default';},
   start:g=>{sliced=false;const phase=live.current.prep.phase;if(g.target.startsWith('fruit-')){dragging=g.target;dragGesture=g;dragWorld=g.world.clone();world.setDrag(g.target,g.world);renderer.domElement.style.cursor='grabbing';return;}if(phase==='load'){dragGesture=g;dragging=g.target;dragWorld=g.world.clone();world.setDrag(g.target,g.world);renderer.domElement.style.cursor='grabbing';}if(phase==='blend')dispatch({type:'BLEND_START'});if(phase==='pour')dispatch({type:'POUR_START',tilt:.62});if(phase==='ready'){dragGesture=g;dragging='cup';dragWorld=g.world.clone();renderer.domElement.style.cursor='grabbing';}},
   move:g=>{const phase=live.current.prep.phase;if(phase==='cut'&&g.distance>.065&&!sliced){sliced=true;dispatch({type:'SLICE',distance:Math.max(.08,g.distance)});}if(dragging){dragGesture=g;dragWorld=g.world.clone();world.setDrag(dragging,g.world);}if(phase==='pour')dispatch({type:'POUR_TILT',tilt:THREE.MathUtils.clamp(.62+(g.delta.x-g.delta.y)*.0028,.05,1)});},
   release:(g,drop)=>{const phase=live.current.prep.phase;let accepted=false;
    if(phase==='select'&&dragging?.startsWith('fruit-')){accepted=g.distance>.025&&interactor.near(g,'board');if(accepted)dispatch({type:'PICK_FRUIT',fruit:dragging.slice(6)});}
    if(phase==='cut'&&!sliced&&g.distance>=.045)dispatch({type:'SLICE',distance:.08});
    if(dragging&&phase==='load'){accepted=interactor.near(g,'jar');if(accepted)dispatch({type:dragging==='ice'?'ADD_ICE':dragging==='water'||dragging==='milk'?'ADD_LIQUID':'LOAD_PORTION',...(dragging==='milk'?{liquid:'milk' as const}:dragging==='water'?{liquid:'water' as const}:{})} as PrepEvent);}
    if(phase==='blend')dispatch({type:'BLEND_STOP'});if(phase==='pour')releasePour();
    if(dragging==='cup'&&phase==='ready'){accepted=g.distance>.025&&interactor.near(g,'serve');if(accepted){handoffFrom=world.cup.getWorldPosition(new THREE.Vector3());dispatch({type:'SERVE'});}}
    if(dragging){feedback.textContent=accepted?(dragging==='cup'?'✓ Jus diterima pelanggan.':'✓ Pas! Bahan masuk.'):'Lepas di dalam area bergaris. Bahan kembali ke tempatnya.';feedback.classList.toggle('missed',!accepted);feedbackUntil=performance.now()+1900;}
    world.setDrag(null,null);dragging=null;dragWorld=null;dragGesture=null;
   },
   cancel:()=>{if(live.current.prep.blendHeld)dispatch({type:'BLEND_STOP'});if(live.current.prep.pouringHeld)dispatch({type:'POUR_STOP'});world.setDrag(null,null);dragging=null;dragWorld=null;dragGesture=null;}

  });
  const peekDown=(e:PointerEvent)=>{if(e.button===2&&!live.current.photo){rightDrag=true;rightX=e.clientX;rightY=e.clientY;}};
  const peekMove=(e:PointerEvent)=>{if(rightDrag){peekX=THREE.MathUtils.clamp((e.clientX-rightX)*.0015,-.25,.25);peekY=THREE.MathUtils.clamp((e.clientY-rightY)*.001,-.12,.12);}};const peekUp=()=>{rightDrag=false};
  const wheel=(e:WheelEvent)=>{if(!live.current.photo){e.preventDefault();zoomIntent=THREE.MathUtils.clamp(zoomIntent-e.deltaY*.0003,.88,1.15);}};
  renderer.domElement.addEventListener('pointerdown',peekDown);renderer.domElement.addEventListener('pointermove',peekMove);window.addEventListener('pointerup',peekUp);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  api.current={capture:()=>{renderer.render(scene,camera);const png=renderer.domElement.toDataURL('image/png'),a=document.createElement('a');a.href=png;a.download=`PERAS-postcard-${Date.now()}.png`;a.click();return png;},reset:()=>{camera.position.copy(home);workLook.copy(homeLook);photoControls.target.copy(homeLook);camera.lookAt(homeLook);zoomIntent=1;},zoom:n=>{if(live.current.photo){const dir=camera.position.clone().sub(photoControls.target);dir.multiplyScalar(n>0?.88:1.12);camera.position.copy(photoControls.target).add(dir);}else zoomIntent=THREE.MathUtils.clamp(zoomIntent+n*.25,.88,1.15);}};
  const clock=new THREE.Clock();
  function hintLabel(id:string,p:Props){const h=p.prep;
   if(id.startsWith('fruit-'))return `<b>${FRUIT_NAMES[id.slice(6)]}</b><span>TAHAN & SERET → TALENAN</span>`;
   if(id==='board')return h.phase==='select'?'<b>↓ TALENAN</b><span>LEPAS BUAH DI SINI</span>':`<b>↔ Geser untuk memotong</b><span>${h.cuts} / ${h.cutsRequired} potongan</span>`;
   if(id==='portions')return `<b>Potongan buah</b><span>SERET → BLENDER · ${h.loadedPortions}/2</span>`;
   if(id==='ice')return '<b>Es batu</b><span>SERET → BLENDER</span>';
   if(id==='water'||id==='milk')return `<b>${id==='milk'?'Susu':'Air putih'}</b><span>SERET → BLENDER</span>`;
   if(id==='blender-control')return `<b>${h.blendHeld?(h.blendQuality==='perfect'?'Pas! Lepaskan.':h.blendQuality==='over'?'Cukup, lepaskan!':'Sedang menghaluskan…'):'Tekan & tahan tombol'}</b><span>${h.blendSeconds.toFixed(1)}s · LEPAS SAAT HIJAU</span>`;
   if(id==='jar')return h.phase==='load'?'<b>↓ BLENDER</b><span>LEPAS BAHAN DI SINI</span>':`<b>${h.pouringHeld?'Lepas untuk berhenti':'Tahan jar, geser untuk menuang'}</b><span>${Math.round(h.fill*100)}% · TARGET 88–98%</span>`;
   if(id==='cup')return '<b>Jus siap!</b><span>SERET GELAS → PELANGGAN</span>';
   if(id==='serve')return '<b>↓ SAJIKAN</b><span>LEPAS GELAS DI SINI</span>';return '';
  }

  function render(){
   if(disposed)return;raf=requestAnimationFrame(render);const raw=Math.min(clock.getDelta(),.05),p=live.current,dt=raw*(p.slowMotion||1);if(!p.paused){elapsed+=dt;if(p.enabled&&!p.photo)p.onTick(dt);}const t=elapsed,h=p.prep;
   if(appearance!==JSON.stringify(p.appearance)){appearance=JSON.stringify(p.appearance);const a=p.appearance;vendor.setOptions({skin:a.skin,hair:a.hairColor,shirt:a.shirt,apron:a.apron,hairstyle:a.hair,glasses:a.glasses,hat:a.hat,body:a.body,face:a.face});vendor.group.scale.multiplyScalar(1.08);}
   if(upgrade!==JSON.stringify(p.upgrades)){upgrade=JSON.stringify(p.upgrades);world.setUpgrades(p.upgrades);}if(location!==p.location){location=p.location;world.setLocation(location);}if(standColor!==p.standColor){standColor=p.standColor;world.setStandColor(standColor);}
   if(lighting!==p.light){lighting=p.light;const night=p.light==='Festival night',gold=p.light==='Golden hour',soft=p.light==='Soft cartoon',cozy=p.light==='Cozy afternoon';sun.color.set(night?0xf4b7a7:gold?0xffbd73:cozy?0xffd39b:0xffe2ae);sun.intensity=night?1:soft?2.6:3.6;hemi.intensity=night?1:1.4;renderer.setClearColor(night?0xbdbcd0:gold?0xf4dfbe:0xf7efdc);scene.fog!.color.set(night?0xbdbcd0:gold?0xf4dfbe:0xf7efdc);sun.position.set(gold?-8:-4,gold?5:9,-5);}
   syncQueue(t);if(lastOrder!==p.order?.id){lastOrder=p.order?.id||'';customerArrival=t;handoffFrom=null;}
   world.updateHandsOn(t,h,p.color,p.fruitId,p.modifier);
   const task=h.phase==='cut'?'cut':h.phase==='load'?'load':h.phase==='blend'?(h.blendHeld?'blend':'listen'):h.phase==='pour'?'pour':h.phase==='serve'?'serve':h.phase==='react'?(p.reaction==='happy'?'happy':p.reaction==='confused'?'confused':'idle'):'idle';
   const dest=new THREE.Vector3(h.phase==='pour'?.45:h.phase==='cut'?-.3:0,0,-.35);vendor.group.position.lerp(dest,1-Math.exp(-raw*6));vendor.group.rotation.y=0;
   vendor.group.visible=p.photo||!!dragging||['cut','pour','serve'].includes(h.phase)||h.phase==='blend'&&h.blendHeld||h.phase==='load'&&h.actionAge<.75||h.lastAction==='pick'&&h.actionAge<.7;vendor.setFirstPerson(!p.photo);vendor.update(t,task,h.phase==='serve'?h.animation:h.gesture);

   vendor.setExpression(h.spilled>previousSpill+.001?'surprised':h.phase==='cut'?'focused':h.phase==='react'?(p.reaction==='happy'?'happy':p.reaction==='confused'?'confused':'neutral'):'happy',h.phase==='cut'?.6:.4);previousSpill=h.spilled;
   vendor.setGrip('right',['load','pour'].includes(h.phase)?.9:0);vendor.setGrip('left',['cut','pour','serve','ready'].includes(h.phase)?.85:0);
   if(h.phase==='cut'){if(h.lastAction==='slice'&&h.actionAge<.55)vendor.reach('left',world.getKnifeGrip(),1);vendor.reach('right',new THREE.Vector3(-.7,1.49,.18),.9);}
   if(h.phase==='load'){const pos=dragging&&dragWorld?dragWorld:new THREE.Vector3(-.45+h.transfer*1.05,1.5+Math.sin(h.transfer*Math.PI)*.55,.29);vendor.reach('right',pos,.95);}
   if(h.phase==='blend'&&h.blendHeld){vendor.reach('left',world.targets['blender-control'].getWorldPosition(new THREE.Vector3()),1);vendor.lookAt(world.blender.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.5,0)),.5);}
   if(h.phase==='pour'){vendor.reach('left',world.getJarGrip(),1);vendor.reach('right',world.getCupGrip(),.5);}
   if(h.lastAction==='pick'&&h.actionAge<.7){const picked=h.selectedFruits.at(-1)||p.fruitId;if(heldId!==picked){heldFruit.clear();heldFruit.add(createFruit(picked,.18));heldId=picked;}heldFruit.visible=true;const a=smooth(Math.min(1,h.actionAge/.7)),from=world.targets['fruit-'+picked]?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(-1.3,1.3,.8),to=new THREE.Vector3(-.5,1.52,.27);heldFruit.position.copy(from).lerp(to,a);heldFruit.position.y+=Math.sin(a*Math.PI)*.35;vendor.reach('right',heldFruit.position,1);}else heldFruit.visible=false;
   customers.forEach((c,i)=>{const actor=actors.get(c.group.userData.orderId)!;
    if(i===0&&h.phase==='done'&&actor.exitAt===null){actor.exitAt=t;actor.exitFrom.copy(c.group.position);}
    if(actor.exitAt!==null)return;
    const slot=h.phase==='done'?i-1:i,target=queueSpot(Math.max(0,slot));if(i===0&&['serve','react'].includes(h.phase))target.z=1.95;
    const moving=c.group.position.distanceTo(target)>.045;
    if(!p.paused)c.group.position.lerp(target,1-Math.exp(-raw*2.7));
    const greeting=i===0&&t-customerArrival<1.3&&!moving;
    c.update(t,moving?'walk':i===0?(h.phase==='react'?'sip':h.phase==='serve'?'reach':greeting?'greet':'listen'):'idle',greeting?t-customerArrival:h.animation);
    c.group.rotation.y=THREE.MathUtils.damp(c.group.rotation.y,Math.PI,7,raw);
    if(i===0){c.setExpression(h.phase==='react'?p.reaction:'happy',h.phase==='react'?1:.4);c.lookAt(new THREE.Vector3(camera.position.x,camera.position.y,camera.position.z),.65);}
   });
   for(const [id,actor] of actors){if(actor.exitAt===null)continue;const c=actor.rig,a=Math.min(1,(t-actor.exitAt)/2.5),e=smooth(a);if(!p.paused)c.group.position.copy(actor.exitFrom).lerp(new THREE.Vector3(-4.7,0,3.1),e);c.group.rotation.y=THREE.MathUtils.damp(c.group.rotation.y,Math.PI*1.5,6,raw);c.update(t,'leave',a);if(a===1&&!customers.includes(c)){scene.remove(c.group);const materials=new Set<THREE.Material>();c.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});materials.forEach(m=>m.dispose());actors.delete(id);}}

   if(h.phase==='ready'&&dragging==='cup'&&dragWorld){vendor.reach('left',dragWorld.clone().add(new THREE.Vector3(.13,-.03,0)),1);vendor.setGrip('left',1);world.cup.position.copy(world.cup.parent!.worldToLocal(dragWorld.clone().add(new THREE.Vector3(0,-.18,0))));}
   if(customers[0]&&(h.phase==='serve'||h.phase==='react'||h.phase==='done')){
    const c=customers[0],a=h.phase==='serve'?Math.min(1,h.animation):1,meeting=new THREE.Vector3(-.45,1.47,1.42),from=handoffFrom?.clone()||new THREE.Vector3(1.5,1.33,.37);
    const mouth=c.head.localToWorld(new THREE.Vector3(-.075,-.28,.35)),sipBottom=mouth.clone().add(new THREE.Vector3(0,-.28,0));
    let bottom:THREE.Vector3;
    if(h.phase==='serve'){
     const carry=smooth(Math.min(1,a/.68));bottom=from.clone().lerp(meeting,carry);bottom.y+=Math.sin(carry*Math.PI)*.15;
     if(a>.68)bottom.lerp(sipBottom,smooth((a-.68)/.32));
     vendor.reach('right',bottom.clone().add(new THREE.Vector3(.1,.2,0)),1-smooth(THREE.MathUtils.clamp((a-.5)/.25,0,1)));vendor.setGrip('right',1);
     c.reach('right',bottom.clone().add(new THREE.Vector3(-.09,.2,0)),smooth(THREE.MathUtils.clamp((a-.32)/.36,0,1)));
    }else{
     const raised=h.phase==='react'?1-smooth(THREE.MathUtils.clamp((h.animation-.55)/.45,0,1)):0;
     const resting=c.group.localToWorld(new THREE.Vector3(-.22,1.25,.37));bottom=resting.lerp(sipBottom,raised);c.reach('right',bottom.clone().add(new THREE.Vector3(-.06,.19,0)),1);
    }
    c.setGrip('right',1);world.cup.position.copy(world.cup.parent!.worldToLocal(bottom));world.cup.rotation.set(h.phase==='react'?.15:0,0,h.phase==='react'?.12:0);
   }

   passing.group.position.set(Math.sin(t*.075)*6,0,4.9);passing.group.rotation.y=Math.cos(t*.075)>0?Math.PI/2:-Math.PI/2;passing.update(t,'walk');
   if(p.photo!==wasPhoto){wasPhoto=p.photo;photoControls.enabled=p.photo;interactor.cancel();if(p.photo)photoControls.target.copy(workLook);else zoomIntent=1;}
   if(p.photo){photoControls.update();overlay.style.display='none';halo.visible=false;guides.visible=false;}
   else{
    overlay.style.display=p.enabled?'block':'none';
    const phase=p.cameraMode==='overview'?'home':p.cameraMode==='cut'?'cut':p.cameraMode==='pour'?'pour':h.phase;
    cameraGoal.copy(home);lookGoal.copy(homeLook);
    if(phase==='cut'){lookGoal.set(-.5,1.36,.5);}else if(phase==='load'){lookGoal.set(-.1,1.52,.65);}else if(phase==='blend'){lookGoal.set(.25,1.68,.8);}else if(phase==='pour'||phase==='ready'){lookGoal.set(.42,1.48,.9);}else if(['serve','react','done'].includes(phase)){lookGoal.set(-.35,1.72,2);}
    const portrait=camera.aspect<.85,narrow=camera.aspect<1.45;if(portrait){cameraGoal.set(0,2.75,-2.65);camera.fov=84/zoomIntent;}else if(narrow){cameraGoal.set(0,2.4,-1.95);camera.fov=76/zoomIntent;}else camera.fov=67/zoomIntent;
    if(!rightDrag){peekX*=Math.exp(-raw*7);peekY*=Math.exp(-raw*7);}lookGoal.x+=peekX;lookGoal.y+=peekY;
    const damping=1-Math.exp(-raw*4);camera.position.lerp(cameraGoal,damping);workLook.lerp(lookGoal,damping);camera.lookAt(workLook);camera.updateProjectionMatrix();
    const active=targetId(),positions=world.targets,destination=h.phase==='select'?'board':h.phase==='load'?'jar':h.phase==='ready'?'serve':null;
    halo.visible=!!active&&p.enabled;guides.visible=h.phase==='cut';if(active&&positions[active]){const pos=positions[active].getWorldPosition(new THREE.Vector3());halo.position.copy(pos);halo.position.y+=.03;halo.scale.setScalar(hover===active?1.12:1+Math.sin(t*2)*.025);}
    let sourcePoint:{x:number,y:number}|null=null,destPoint:{x:number,y:number}|null=null;
    for(const [id,node] of hints){
     const secondary=id===destination,materialSource=h.phase==='load'&&h.loadedPortions===2&&(h.iceAdded||h.modifier==='Tanpa es')&&['water','milk'].includes(id),fruitSource=h.phase==='select'&&id.startsWith('fruit-')&&h.requiredFruits.includes(id.slice(6));
     const shown=p.enabled&&(id===active||secondary||materialSource||fruitSource);
     node.style.display=shown?'block':'none';if(!shown||!positions[id])continue;
     const projected=interactor.project(positions[id]);if(!projected.visible){node.style.display='none';continue;}
     const half=Math.max(58,node.getBoundingClientRect().width/2+8),x=Math.max(half,Math.min(el.clientWidth-half,projected.x));let y=Math.max(65,Math.min(el.clientHeight-55,projected.y));
     if(!secondary&&destination&&positions[destination]){const dp=interactor.project(positions[destination]),dn=hints.get(destination),dw=Math.max(110,dn?.getBoundingClientRect().width||0),dh=Math.max(90,dn?.getBoundingClientRect().height||0),sh=Math.max(52,node.getBoundingClientRect().height);if(Math.abs(x-dp.x)<half+dw/2+10&&Math.abs(y-dp.y)<sh/2+dh/2+14)y=Math.max(sh/2+20,dp.y-dh/2-sh/2-20);}

     if(id==='milk'&&materialSource){const wp=interactor.project(positions.water),wx=Math.max(half,Math.min(el.clientWidth-half,wp.x));if(Math.abs(x-wx)<112&&Math.abs(y-wp.y)<80)y=Math.max(65,y-76);}
     node.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
     node.classList.toggle('destination',secondary);node.classList.toggle('source',!secondary);node.classList.toggle('inactive',!secondary&&!accepts(id));node.classList.toggle('hovered',hover===id);node.classList.toggle('grabbed',dragging===id);
     node.setAttribute('role',secondary?'region':'button');node.setAttribute('aria-label',id.startsWith('fruit-')?`Seret ${FRUIT_NAMES[id.slice(6)]} ke talenan`:id==='board'&&h.phase==='select'?'Area drop talenan':id==='jar'&&h.phase==='load'?'Area drop blender':id==='serve'?'Area drop pelanggan':hintLabel(id,p).replace(/<[^>]*>/g,' '));
     const label=hintLabel(id,p);if(node.innerHTML!==label)node.innerHTML=label;
     if(id===(dragging||active))sourcePoint={x,y};if(secondary){destPoint={x,y};node.classList.toggle('drop-ready',!!dragGesture&&interactor.near(dragGesture,id));}
    }
    if(sourcePoint&&destPoint&&p.enabled){const from=dragGesture?{x:dragGesture.current.x-el.getBoundingClientRect().left,y:dragGesture.current.y-el.getBoundingClientRect().top}:sourcePoint;
     dragGuide.style.display='block';route.setAttribute('d',`M ${from.x} ${from.y} Q ${(from.x+destPoint.x)/2} ${Math.min(from.y,destPoint.y)-55} ${destPoint.x} ${destPoint.y}`);
    }else dragGuide.style.display='none';
    dragGhost.style.display=dragGesture?'block':'none';if(dragGesture){dragGhost.style.transform=`translate(${dragGesture.current.x-el.getBoundingClientRect().left+20}px,${dragGesture.current.y-el.getBoundingClientRect().top-25}px)`;dragGhost.textContent=dragging?.startsWith('fruit-')?FRUIT_NAMES[dragging.slice(6)]:dragging==='portions'?'Buah potong':dragging==='ice'?'Es batu':dragging==='cup'?'Jus siap':dragging==='milk'?'Susu':'Air putih';}
    feedback.style.display=performance.now()<feedbackUntil?'block':'none';

   }
   firstPersonArms.visible=!p.photo&&vendor.group.visible;
   if(firstPersonArms.visible){armMaterial.color.set(p.appearance.skin);camera.updateMatrixWorld();for(let i=0;i<2;i++){const wrist=vendor.group.getObjectByName(i===0?'wristL':'wristR')!;const end=wrist.getWorldPosition(new THREE.Vector3()),start=camera.localToWorld(new THREE.Vector3(i===0?-.44:.44,-.9,-.36));const arm=viewArms[i],direction=end.clone().sub(start),length=direction.length();arm.position.copy(start).lerp(end,.5);arm.scale.set(1,Math.max(.01,length),1);arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());}}
   lastPhase=h.phase;renderer.render(scene,camera);if(p.onLabFrame){const key=(p.order?.id||'')+h.phase+(p.labRevision||0),frame=h.phase==='cut'&&h.cuts===2&&h.actionAge<.3||h.phase==='blend'&&h.blendHeld&&h.blendSeconds>2||h.phase==='pour'&&h.pouringHeld&&h.fill>.3&&h.fill<.65||h.phase==='serve'&&h.animation>.56&&h.animation<.65||h.phase==='react'&&h.animation>.35&&h.animation<.5;if(frame&&!capturedFrames.has(key)){capturedFrames.add(key);p.onLabFrame(h.phase,renderer.domElement.toDataURL('image/png'));}}if(++renderCount===2)p.onReady();
  }
  render();
  return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();interactor.dispose();photoControls.dispose();renderer.domElement.removeEventListener('pointerdown',peekDown);renderer.domElement.removeEventListener('pointermove',peekMove);window.removeEventListener('pointerup',peekUp);renderer.domElement.removeEventListener('wheel',wheel);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();el.replaceChildren();};
 },[]);
 return <div ref={mount} className="scene-wrap" aria-label="First-person juice stand. Drag fruit onto the cutting board, swipe to cut, drag ingredients into the blender, hold to blend, tilt to pour, and drag the cup to the customer.">{error&&<div className="webgl-error">{error}</div>}</div>
});
export function CharacterPreview({appearance}:{appearance:Appearance}){const mount=useRef<HTMLDivElement>(null),live=useRef(appearance);live.current=appearance;useEffect(()=>{if(!mount.current)return;const el=mount.current;const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;el.appendChild(renderer.domElement);const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(32,1,.1,30);camera.position.set(0,1.4,5.1);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.12,0);controls.enablePan=false;controls.minDistance=3;controls.maxDistance=7;controls.enableDamping=true;controls.autoRotate=true;controls.autoRotateSpeed=1.5;scene.add(new THREE.HemisphereLight(0xffffff,0xc4b398,3));const sun=new THREE.DirectionalLight(0xffe6c1,3);sun.position.set(-3,5,4);scene.add(sun);const character=createCharacter({});scene.add(character.group);const floor=new THREE.Mesh(new THREE.CylinderGeometry(.8,.9,.08,64),new THREE.MeshStandardMaterial({color:0xf2d695,roughness:.75}));floor.position.y=-.04;scene.add(floor);let last='',raf=0;const clock=new THREE.Clock();const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();};const obs=new ResizeObserver(resize);obs.observe(el);resize();function render(){raf=requestAnimationFrame(render);if(JSON.stringify(live.current)!==last){last=JSON.stringify(live.current);const a=live.current;character.setOptions({skin:a.skin,hair:a.hairColor,hairstyle:a.hair,shirt:a.shirt,apron:a.apron,hat:a.hat,glasses:a.glasses,body:a.body,face:a.face});}character.update(clock.getElapsedTime(),'idle');controls.update();renderer.render(scene,camera);}render();return()=>{cancelAnimationFrame(raf);obs.disconnect();controls.dispose();renderer.dispose();el.replaceChildren();};},[]);return <div className="character-preview" ref={mount}/>;}
