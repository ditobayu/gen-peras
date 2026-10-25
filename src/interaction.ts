import * as THREE from 'three';

export type Gesture = {
  target: string;
  start: THREE.Vector2;
  current: THREE.Vector2;
  delta: THREE.Vector2;
  distance: number;
  world: THREE.Vector3;
  pointerType: string;
};
export interface InteractorOptions {
  enabled(): boolean;
  targets(): Record<string,THREE.Object3D>;
  accepts(id:string): boolean;
  hover(id:string|null): void;
  start(gesture:Gesture): void;
  move(gesture:Gesture): void;
  release(gesture:Gesture,dropTarget:string|null): void;
  cancel(): void;
}
/** Reusable world-space input. Rendering and recipe validation live elsewhere. */
export class WorldInteractor {
  private raycaster=new THREE.Raycaster();
  private ndc=new THREE.Vector2();
  private active:Gesture|null=null;
  private pointerId:number|null=null;
  private plane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.7);
  private disposers:(()=>void)[]=[];
  constructor(private canvas:HTMLCanvasElement,private camera:THREE.Camera,private options:InteractorOptions){
    this.bind('pointerdown',this.down);this.bind('pointermove',this.move);this.bind('pointerup',this.up);this.bind('pointercancel',this.cancel);this.bind('lostpointercapture',this.lost);
    const blur=()=>this.cancel();window.addEventListener('blur',blur);this.disposers.push(()=>window.removeEventListener('blur',blur));
    const context=(e:Event)=>e.preventDefault();canvas.addEventListener('contextmenu',context);this.disposers.push(()=>canvas.removeEventListener('contextmenu',context));
  }
  private bind(name:string,fn:(event:any)=>void){this.canvas.addEventListener(name,fn);this.disposers.push(()=>this.canvas.removeEventListener(name,fn));}
  private cast(x:number,y:number,filter=true){
    const bounds=this.canvas.getBoundingClientRect();this.ndc.set((x-bounds.left)/bounds.width*2-1,-(y-bounds.top)/bounds.height*2+1);this.raycaster.setFromCamera(this.ndc,this.camera);
    const entries=Object.entries(this.options.targets()).filter(([id])=>!filter||this.options.accepts(id));
    let best:{id:string,distance:number}|null=null;
    for(const [id,object] of entries){object.updateWorldMatrix(true,true);const hits=this.raycaster.intersectObject(object,true);if(hits[0]&&(!best||hits[0].distance<best.distance))best={id,distance:hits[0].distance};}
    return best?.id||null;
  }
  private world(x:number,y:number){const b=this.canvas.getBoundingClientRect();this.ndc.set((x-b.left)/b.width*2-1,-(y-b.top)/b.height*2+1);this.raycaster.setFromCamera(this.ndc,this.camera);return this.raycaster.ray.intersectPlane(this.plane,new THREE.Vector3())||new THREE.Vector3();}
  private update(event:PointerEvent){const g=this.active!;g.current.set(event.clientX,event.clientY);g.delta.copy(g.current).sub(g.start);const b=this.canvas.getBoundingClientRect();g.distance=g.delta.length()/Math.min(b.width,b.height);g.world.copy(this.world(event.clientX,event.clientY));return g;}
  private down=(event:PointerEvent)=>{
    if(event.button!==0||!this.options.enabled()||this.active)return;const target=this.cast(event.clientX,event.clientY);if(!target)return;
    event.preventDefault();this.pointerId=event.pointerId;this.canvas.setPointerCapture(event.pointerId);const point=new THREE.Vector2(event.clientX,event.clientY);
    this.active={target,start:point.clone(),current:point.clone(),delta:new THREE.Vector2(),distance:0,world:this.world(event.clientX,event.clientY),pointerType:event.pointerType};this.options.start(this.active);
  };
  private move=(event:PointerEvent)=>{
    if(!this.options.enabled()){if(this.active)this.cancel();return;}
    if(this.active&&event.pointerId===this.pointerId){event.preventDefault();this.options.move(this.update(event));}
    else this.options.hover(this.cast(event.clientX,event.clientY));
  };
  private up=(event:PointerEvent)=>{
    if(!this.active||event.pointerId!==this.pointerId)return;event.preventDefault();const gesture=this.update(event),drop=this.cast(event.clientX,event.clientY,false);this.options.release(gesture,drop);this.clear();
  };
  private clear(){const id=this.pointerId;this.active=null;this.pointerId=null;if(id!==null&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);this.options.hover(null);}
  private lost=()=>{if(this.active)this.cancel()};
  cancel=()=>{if(this.active)this.options.cancel();this.clear();};
  project(object:THREE.Object3D,offset=new THREE.Vector3()){
    object.updateWorldMatrix(true,false);const position=object.getWorldPosition(new THREE.Vector3()).add(offset).project(this.camera),b=this.canvas.getBoundingClientRect();return {x:(position.x*.5+.5)*b.width,y:(-.5*position.y+.5)*b.height,visible:position.z>-1&&position.z<1};
  }
  near(gesture:Gesture,id:string,radius=95){const object=this.options.targets()[id];if(!object)return false;const p=this.project(object),bounds=this.canvas.getBoundingClientRect();return Math.hypot(gesture.current.x-bounds.left-p.x,gesture.current.y-bounds.top-p.y)<radius;}
  dispose(){this.cancel();this.disposers.forEach(fn=>fn());}
}
