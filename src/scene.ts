import {buildCityMap} from './visual/cityMap';
import * as T from 'three';
import rackFrames from '../public/rack-view-frames.json';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {initial,type State,type Action} from './state';
import {EquipmentStage} from './visual/equipment';
import {InteriorLighting} from './visual/interior';
import {NightEffects} from './visual/night';
import {buildEnvironment,skyTexture} from './visual/environment';
import {data,buildings,floors,rooms,placements,floorKey,roomCenter} from './domain';
function disposeObject(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}})}
interface Item {id:string;category:string;position:number[];dimensions:number[];yawDeg:number}
interface Plan {hash:string;objects:Item[];camera:{position:number[];target:number[]}}
const v=(p:number[])=>new T.Vector3(p[0],p[2],-p[1]);
export class CampusScene {
 scene=new T.Scene();camera=new T.PerspectiveCamera(34,1,1,1800);renderer:T.WebGLRenderer;controls:OrbitControls;
 context=new T.Group();city=new T.Group();asset:T.Object3D|null=null;state:State={...initial};
 composer:EffectComposer|null=null;bloom:UnrealBloomPass|null=null;output:OutputPass|null=null;
 equipment:EquipmentStage;roomCamera:{room:string;position:T.Vector3;target:T.Vector3}|null=null;
 interior:InteriorLighting;night:NightEffects|null=null;hemisphere:T.HemisphereLight;sun:T.DirectionalLight;
 perfFrames=0;perfStart=0;lastFps=0;alarmDevices=new Set<string>();
 setAlarmDevices(ids:string[]){this.alarmDevices=new Set(ids)}
 objects=new Map<string,T.Object3D>();baseY=new Map<string,number>();goals=new Map<T.Object3D,number>();
 targetPos=new T.Vector3();targetLook=new T.Vector3();moving=true;alive=true;frame=0;last=0;hash='';
 highlight=new T.Box3Helper(new T.Box3(),0xf6ae61);labels=new Map<string,HTMLButtonElement>();
 resize:ResizeObserver;pointer=[0,0];onAction:(a:Action)=>void;onReady:(error?:string)=>void;host:HTMLElement;
 constructor(host:HTMLElement,onAction:(a:Action)=>void,onReady:(error?:string)=>void){
  this.host=host;this.onAction=onAction;this.onReady=onReady;
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.78;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.localClippingEnabled=true;
  host.appendChild(this.renderer.domElement);this.scene.background=skyTexture();this.scene.fog=new T.Fog('#1c3347',200,850);
  const pmrem=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);this.scene.environment=env.texture;this.scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
  this.hemisphere=new T.HemisphereLight(0xb8d5ed,0x394b46,.8);this.scene.add(this.hemisphere);const sun=this.sun=new T.DirectionalLight(0xd5e5f3,1.5);sun.position.set(-120,180,90);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-130,right:130,top:130,bottom:-130,near:1,far:450});sun.shadow.bias=-.00012;sun.shadow.normalBias=.18;sun.shadow.radius=3.5;this.scene.add(sun,sun.target);
  this.equipment=new EquipmentStage(this.scene);this.interior=new InteriorLighting(this.scene);this.scene.add(this.context,this.city,this.highlight);this.highlight.visible=false;
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=7;this.controls.maxDistance=500;this.controls.maxPolarAngle=Math.PI*.485;this.controls.autoRotateSpeed=.5;
  this.controls.addEventListener('start',()=>{this.moving=false});
  this.renderer.domElement.addEventListener('pointerdown',this.down);this.renderer.domElement.addEventListener('pointerup',this.up);
  this.composer=new EffectComposer(this.renderer);this.composer.renderTarget1.samples=Math.min(4,this.renderer.capabilities.maxSamples);this.composer.renderTarget2.samples=Math.min(4,this.renderer.capabilities.maxSamples);this.renderer.info.autoReset=false;this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new UnrealBloomPass(new T.Vector2(1,1),.45,.45,.85);this.composer.addPass(this.bloom);this.output=new OutputPass();this.composer.addPass(this.output);
  this.resize=new ResizeObserver(()=>this.fit());this.resize.observe(host);this.fit();this.load();this.frame=requestAnimationFrame(this.tick);
 }
 fit(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(width,height,false);this.camera.aspect=width/height;if(this.camera.view?.enabled)this.camera.setViewOffset(width,height,width*.12,0,width,height);this.camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(34)/2)*Math.max(1,1.6/this.camera.aspect)));this.camera.updateProjectionMatrix();if(this.composer){this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(width,height);const physical=this.renderer.getDrawingBufferSize(new T.Vector2());this.bloom?.setSize(Math.max(1,physical.x/2),Math.max(1,physical.y/2))}}
 mesh(parent:T.Object3D,size:number[],pos:number[],color:string,metalness=0){const m=new T.Mesh(new T.BoxGeometry(...size as [number,number,number]),new T.MeshStandardMaterial({color,roughness:.68,metalness}));m.position.set(...pos as [number,number,number]);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 contextFrom(plan:Plan){
  this.mesh(this.context,[180,.25,150],[0,-.2,0],'#61717a');this.mesh(this.context,[1200,.3,1200],[0,-.5,0],'#213747');
  for(const o of plan.objects){if(o.category==='building')continue;const [w,d,h]=o.dimensions,p=v(o.position);const g=new T.Group();g.position.copy(p);g.rotation.y=-o.yawDeg*Math.PI/180;this.context.add(g);
   if(o.category==='tree'){
    const trunk=new T.Mesh(new T.CylinderGeometry(.15,.25,h*.45,8),new T.MeshStandardMaterial({color:'#635e4c'}));trunk.position.y=h*.22;g.add(trunk);
    for(let j=0;j<3;j++){const crown=new T.Mesh(new T.IcosahedronGeometry(w*.42,1),new T.MeshStandardMaterial({color:j%2?'#526d52':'#3b5a48',roughness:1,flatShading:true}));crown.scale.set(1,1.15,1);crown.position.set((j-1)*w*.15,h*.58+j*.07*h,0);crown.castShadow=true;g.add(crown)}
   }else if(o.category==='vehicle'){
    this.mesh(g,[w,h*.48,d],[0,h*.24,0],'#b7c3c9',.4);this.mesh(g,[w*.85,h*.42,d*.55],[0,h*.69,0],'#344c60',.2);
    for(const x of [-1,1])for(const z of [-1,1]){const tire=new T.Mesh(new T.CylinderGeometry(.32,.32,.2,12),new T.MeshStandardMaterial({color:'#1b252d'}));tire.rotation.z=Math.PI/2;tire.position.set(x*w*.48,.32,z*d*.29);g.add(tire)}
   }else{
    const colors:Record<string,string>={building:'#8298a8',road:'#394b58',path:'#a2a9a7',parking:'#566875',vegetation:'#4a624f',landscape:'#6d7e78'};
    this.mesh(g,[w,h,d],[0,h/2,0],colors[o.category]||'#83949b');
    
    if(o.category==='road'){const long=w>d;for(let k=-Math.max(w,d)/2+3;k<Math.max(w,d)/2-3;k+=7)this.mesh(g,long?[3,.015,.12]:[.12,.015,3],long?[k,h+.015,0]:[0,h+.015,k],'#a7b1b5')}
   }
  }
 }
 async load(){try{
  const r=await fetch('./frozen-plan.json');if(!r.ok)throw Error('布局文件加载失败');const plan:Plan=await r.json();this.hash=plan.hash;buildEnvironment(this.context,plan);
  const loaded=await Promise.all(['A','B','C'].map(id=>new GLTFLoader().loadAsync(`./assets/v10/${id}.glb`)));
  if(!this.alive){loaded.forEach(g=>disposeObject(g.scene));return}
  this.asset=new T.Group();loaded.forEach(g=>this.asset!.add(g.scene));this.scene.add(this.asset);
  this.asset.traverse(o=>{if(this.objects.has(o.name)&&o.userData.semantic_id)throw Error(`模型编号重复 ${o.name}`);this.objects.set(o.name,o);this.baseY.set(o.name,o.position.y);if(o instanceof T.Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>{if(m.name==='v5_glazing'){m.depthWrite=false;m.side=T.FrontSide}});o.castShadow=!materials.some(m=>m.name==='v5_glazing');o.receiveShadow=true;if(['walls','structure'].includes(o.parent?.userData.kind)||(o.parent?.userData.kind==='room'&&materials.some(m=>['ink','luminous','ivory','stone','slat','walnut'].includes(m.name))))o.material=(o.material as T.Material).clone()}});
  this.interior.finish(this.asset);
  for(const item of [...data.rooms,...data.devices])if(!this.objects.has(item.id))throw Error(`模型缺少语义对象 ${item.id}`);
  for(const b of data.buildings)this.label(b.id,`${b.id} 楼`);
  for(const d of data.devices.filter(d=>d.room_id==='A-903'))this.label('device:'+d.id,d.type);
  this.label('selected-room','');this.label('demo-campus','智慧园区 ↗');
  const campusLabel=this.labels.get('demo-campus')!;
  const summary=document.createElement('small');
  summary.textContent=`${data.rooms.length} 个空间 · ${data.devices.length} 台设备`;
  campusLabel.appendChild(summary);campusLabel.title='进入园区';
  await this.loadCity();if(!this.alive)return;this.night=new NightEffects(this.city,this.context,this.asset,plan);
  this.camera.position.copy(v(plan.camera.position));this.controls.target.copy(v(plan.camera.target));this.setState(this.state);this.onReady();
 }catch(e){if(this.alive)this.onReady(String(e))}}
 async loadCity(){
  const r=await fetch('./geodata/shanghai.json');if(!r.ok)throw Error('城市底图加载失败');const json=await r.json();
  const geometry=json.features[0].geometry;const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  buildCityMap(this.city,polygons);
  const pin=new T.Mesh(new T.CylinderGeometry(.7,.7,6,20),new T.MeshStandardMaterial({color:'#f5a85f',emissive:'#9d5524',emissiveIntensity:.6}));pin.position.set(0,5,0);pin.userData.kind='campus-pin';this.city.add(pin);
  const ring=new T.Mesh(new T.RingGeometry(3,3.4,64),new T.MeshBasicMaterial({color:'#f5a85f',side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=2.2;ring.userData.kind='campus-pin';this.city.add(ring);

 }
 label(id:string,text:string){const el=document.createElement('button');el.className='scene-label';el.textContent=text;el.dataset.object=id;el.onclick=()=>{if(id.startsWith('device:'))this.onAction({type:'device',id:id.slice(7)});else if(buildings.has(id))this.onAction({type:'building',id});else if(id==='selected-room')this.onAction({type:'room',id:this.state.room});else this.onAction({type:'navigate',mode:'campus'})};this.host.appendChild(el);this.labels.set(id,el)}
 setState(s:State){const previous=this.state;this.state=s;this.controls.autoRotate=false;if(!this.asset)return;
  if(s.inspect){if(previous.inspect!==s.inspect||!this.equipment.model){const source=this.objects.get(s.inspect);if(!source)return;if(!previous.inspect)this.roomCamera={room:s.room,position:(this.moving?this.targetPos:this.camera.position).clone(),target:(this.moving?this.targetLook:this.controls.target).clone()};this.equipment.open(source);this.inspectionView();}if(!!previous.partsExploded!==!!s.partsExploded)this.inspectionView();this.equipment.expanded=!!s.partsExploded;this.equipment.selected=s.part??null;this.asset.visible=false;this.context.visible=false;this.city.visible=false;this.highlight.visible=false;this.interior.configure(new T.Vector3(),3,3,true);this.sun.target.position.set(0,0,0);this.sun.position.set(-4,8,5);Object.assign(this.sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:30});this.sun.shadow.normalBias=.005;this.sun.shadow.camera.updateProjectionMatrix();this.hemisphere.intensity=1;this.sun.intensity=2;this.scene.environmentIntensity=.85;this.renderer.toneMappingExposure=1.1;return;}
  const returning=!!previous.inspect&&s.mode==='room'&&this.roomCamera?.room===s.room;this.equipment.close();
  const inside=s.mode==='floor'||s.mode==='room';this.hemisphere.intensity=inside?.68:.44;this.sun.intensity=inside?1.35:.82;this.scene.environmentIntensity=inside?.55:.43;this.renderer.toneMappingExposure=inside?.88:.86;if(this.bloom){this.bloom.enabled=true;this.bloom.strength=inside?.18:.45;this.bloom.threshold=inside?1.05:.85;}this.context.visible=s.mode==='campus';this.city.visible=s.mode==='city';this.asset.visible=s.mode!=='city';this.highlight.visible=false;
  this.asset.traverse(o=>{const kind=o.userData.kind;
   if(kind==='building')o.visible=s.mode==='campus'||o.name===s.building;
   if(kind==='floor'){o.visible=!inside||o.userData.floor_no===s.floor;this.goals.set(o,(this.baseY.get(o.name)||0)+(s.exploded&&o.userData.building===s.building?(o.userData.floor_no-1)*2:0))}
   if(kind==='facade')o.visible=!inside;
   if(kind==='roof'){o.visible=!inside;this.goals.set(o,(this.baseY.get(o.name)||0)+(s.exploded?buildings.get(s.building)!.floors*2+1:0))}
   if(kind==='entry')o.visible=!inside;
   if(kind==='ceiling')o.visible=false;
   if(kind==='room')o.visible=inside&&(s.mode==='floor'||o.name===s.room);
   if(kind==='room_cutaway')o.visible=s.mode==='room';
   if(kind==='walls')o.visible=s.mode!=='room';
   if(kind==='slab'||kind==='corridor')o.visible=s.mode!=='room';
   if(kind==='structure')o.visible=true;if(o.userData.exploded_only)o.visible=false;
   if(o instanceof T.Mesh&&o.parent?.userData.kind==='structure'){
    const mat=o.material as T.MeshStandardMaterial;mat.clippingPlanes=[];
    if(s.mode==='room'){const r=rooms.get(s.room)!,b=buildings.get(s.building)!,p=placements.get(b.id)!;const xmin=p[0]+r.bounds[0]-b.width/2,xmax=p[0]+r.bounds[2]-b.width/2,zmin=-(p[1]+r.bounds[3]-b.depth/2),zmax=-(p[1]+r.bounds[1]-b.depth/2);
     mat.clippingPlanes=[new T.Plane(new T.Vector3(1,0,0),-xmin),new T.Plane(new T.Vector3(-1,0,0),xmax),new T.Plane(new T.Vector3(0,0,1),-zmin),new T.Plane(new T.Vector3(0,0,-1),zmax)];
    }mat.needsUpdate=true;
   }
   // Lowered floor cutaways also clip room-owned perimeter light rails.
   if(o instanceof T.Mesh&&o.parent?.userData.kind==='room'){
    const m=o.material as T.MeshStandardMaterial;if(['ink','luminous','ivory','stone','slat','walnut'].includes(m.name)){
     const base=floors.get(floorKey(s.building,s.floor))!.base_z;m.clippingPlanes=s.mode==='floor'?[new T.Plane(new T.Vector3(0,-1,0),base+1.45)]:[];m.clipShadows=true;m.needsUpdate=true;
    }
   }
   if(o instanceof T.Mesh&&o.parent?.userData.kind==='walls'){
    const m=o.material as T.MeshStandardMaterial;const base=floors.get(floorKey(s.building,s.floor))!.base_z;
    m.clippingPlanes=inside?[new T.Plane(new T.Vector3(0,-1,0),base+1.45)]:[];m.needsUpdate=true;
   }
  });this.reset();if(returning&&this.roomCamera){this.targetPos.copy(this.roomCamera.position);this.targetLook.copy(this.roomCamera.target);this.moving=true;}this.roomCamera=null;
 }
 inspectionView(view?:string){const expanded=!!this.state.partsExploded,size=expanded?this.equipment.expandedSize:this.equipment.size,frame=this.objects.get(this.state.inspect??'')?.userData.asset_type==='rack'?rackFrames[expanded?'exploded':'assembled']:null,d=frame?.distance??Math.max(1.6,size*(expanded?2.6:3.4));this.camera.clearViewOffset();this.camera.near=.01;this.camera.updateProjectionMatrix();this.controls.minDistance=.3;this.targetLook.copy(frame?new T.Vector3().fromArray(frame.center):expanded?this.equipment.expandedCenter:this.equipment.center);const front=this.state.inspect?.includes("RK")||this.state.inspect?.endsWith("ACS01")?1:-1;this.targetPos.copy(view==='top'?new T.Vector3(0,d,.001):view==='side'?new T.Vector3(d,0,0):view==='front'?new T.Vector3(0,.03,d*front):new T.Vector3(d*.55,d*.32,d*front)).add(this.targetLook);this.moving=true;}
 reset(){
  if(this.state.inspect){this.inspectionView();return;}
  this.camera.clearViewOffset();this.camera.near=.3;this.camera.updateProjectionMatrix();this.controls.minDistance=3;
  const s=this.state,b=buildings.get(s.building)!,p=placements.get(s.building)!;let pos:T.Vector3,look:T.Vector3;
  if(s.mode==='city'){look=new T.Vector3(0,0,-10);pos=look.clone().add(new T.Vector3(30,165,164))}
  else if(s.mode==='campus'){pos=new T.Vector3(6,115,280);look=new T.Vector3(0,12,0)}
  else if(s.mode==='building'){const h=b.equip+(s.exploded?b.floors*2:0);look=v([p[0],p[1],h/2]);pos=look.clone().add(new T.Vector3(h*1.25,h*.9,h*1.85))}
  else if(s.mode==='floor'){const z=floors.get(floorKey(s.building,s.floor))!.base_z;look=v([p[0],p[1],z]);pos=look.clone().add(new T.Vector3(b.width,b.width*1.35,b.depth*2.15))}
  else{const r=rooms.get(s.room)!,c=roomCenter(r.id);look=v([c[0],c[1],c[2]+1.1]);const size=Math.max(r.clear_width,r.clear_depth);pos=look.clone().add(new T.Vector3(size*.9,size*1.25,(r.row==='north'?1:-1)*size*1.55))}
  // Narrow panels adjust vertical FOV in fit(), preserving the hero's horizontal framing.
  if(!['city','campus'].includes(s.mode))pos.sub(look).multiplyScalar(1.17).add(look);
  // Fit the shadow map to the inspected interior so chair legs and cabinets contact the floor.
  const interior=s.mode==='room'||s.mode==='floor',extent=s.mode==='room'?Math.max(rooms.get(s.room)!.clear_width,rooms.get(s.room)!.clear_depth)*1.35:s.mode==='floor'?b.width*1.1:130;
  this.sun.target.position.copy(interior?look:new T.Vector3());this.sun.position.copy(interior?look.clone().add(new T.Vector3(-22,40,26)):new T.Vector3(-120,180,90));
  Object.assign(this.sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:1,far:interior?130:450});this.sun.shadow.normalBias=interior?.018:.18;this.sun.shadow.camera.updateProjectionMatrix();
  this.interior.configure(look,s.mode==='room'?rooms.get(s.room)!.clear_width:b.width,s.mode==='room'?rooms.get(s.room)!.clear_depth:b.depth,s.mode==='room');
  this.targetPos.copy(pos);this.targetLook.copy(look);this.moving=true;
 }
 viewPreset(view:'front'|'side'|'top'|'device'){
  if(this.state.inspect){this.inspectionView(view);return;}
  if(!['floor','room'].includes(this.state.mode))return;
  this.reset();this.camera.clearViewOffset();this.controls.autoRotate=false;const s=this.state,r=rooms.get(s.room)!,b=buildings.get(s.building)!;
  const width=s.mode==='room'?r.clear_width:b.width,depth=s.mode==='room'?r.clear_depth:b.depth;
  const look=this.targetLook.clone();let offset:T.Vector3;
  const distance=Math.max(width,depth)*2.6;
  if(view==='device'&&s.device){const obj=this.objects.get(s.device);if(!obj)return;obj.updateWorldMatrix(true,false);const box=new T.Box3().setFromObject(obj);box.getCenter(look);const size=box.getSize(new T.Vector3()).length();const ds=Math.max(1.15,size*2.6);this.camera.setViewOffset(this.host.clientWidth,this.host.clientHeight,this.host.clientWidth*.12,0,this.host.clientWidth,this.host.clientHeight);offset=new T.Vector3(ds*.25,ds*(s.device.endsWith('OCC01')?-.3:.25),s.device.endsWith('ACS01')?ds:-ds);}
  else if(view==='top')offset=new T.Vector3(0,distance,.1);
  else if(view==='side')offset=new T.Vector3(distance,.4,0);
  else offset=new T.Vector3(0,.4,(r.row==='south'?-1:1)*distance);
  this.camera.near=view==='device'?.08:.3;this.camera.updateProjectionMatrix();this.controls.minDistance=view==='device'?.45:3;
  this.targetLook.copy(look);this.targetPos.copy(look).add(offset);this.moving=true;
 }
 down=(e:PointerEvent)=>{this.pointer=[e.clientX,e.clientY]};
 up=(e:PointerEvent)=>{if(Math.hypot(e.clientX-this.pointer[0],e.clientY-this.pointer[1])>5||!this.asset)return;const r=this.renderer.domElement.getBoundingClientRect();const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);
  if(this.state.inspect){const id=this.equipment.pick(ray);if(id)this.onAction({type:'component',id});return;}
  if(this.state.mode==='city'){if(ray.intersectObject(this.city,true).some(h=>h.object.userData.kind==='campus-pin'))this.onAction({type:'navigate',mode:'campus'});return}
  const hits=ray.intersectObject(this.asset,true).filter(h=>{let n:T.Object3D|null=h.object;while(n){if(!n.visible)return false;n=n.parent}if(h.object instanceof T.Mesh){const mat=h.object.material as T.Material;if(mat.clippingPlanes?.some(p=>p.distanceToPoint(h.point)<0))return false}return true});
  if(!hits.length)return;let n:T.Object3D|null=hits[0].object;
  while(n){const kind=n.userData.kind;
   if(kind==='visual_asset'&&this.state.mode==='room'){this.onAction({type:'inspect',id:n.userData.visual_asset_id});return;}
   if(kind==='device'&&this.state.mode==='room'){this.onAction({type:'device',id:n.name});return}
   if(kind==='room'&&this.state.mode==='floor'){this.onAction({type:'room',id:n.name});return}
   if(kind==='floor'&&this.state.mode==='building'){this.onAction({type:'floor',building:n.userData.building,floor:n.userData.floor_no});return}
   if(kind==='building'&&this.state.mode==='campus'){this.onAction({type:'building',id:n.name});return}n=n.parent;
  }
 };
 tick=(time:number)=>{if(!this.alive)return;const dt=Math.min(.05,(time-this.last)/1000||.016);this.last=time;if(this.renderer.getPixelRatio()!==Math.min(devicePixelRatio,2))this.fit();const k=1-Math.exp(-dt*7);
  for(const [o,y] of this.goals)o.position.y=T.MathUtils.lerp(o.position.y,y,k);
  if(this.moving){this.camera.position.lerp(this.targetPos,k);this.controls.target.lerp(this.targetLook,k);if(this.camera.position.distanceTo(this.targetPos)<.01){this.camera.position.copy(this.targetPos);this.controls.target.copy(this.targetLook);this.moving=false}}
  this.controls.enabled=!this.moving;if(this.moving)this.camera.lookAt(this.controls.target);else this.controls.update();this.night?.tick(dt);this.equipment.update(dt);
  if(this.state.device&&!this.state.inspect){const o=this.objects.get(this.state.device);if(o){o.updateWorldMatrix(true,false);this.highlight.box.setFromObject(o).expandByScalar(.12);this.highlight.visible=true;(this.highlight.material as T.LineBasicMaterial).color.set(this.alarmDevices.has(this.state.device)?0xff695d:0xf6ae61)}}
  this.renderer.info.reset();if(this.composer&&this.state.mode!=='city')this.composer.render();else this.renderer.render(this.scene,this.camera);
  const size=this.host.getBoundingClientRect();for(const [id,el] of this.labels){let point:T.Vector3|null=null;
   if(buildings.has(id)&&this.state.mode==='campus'){const p=placements.get(id)!;point=v([p[0],p[1],buildings.get(id)!.equip+3])}
   if(id==='selected-room'&&this.state.mode==='floor'){const c=roomCenter(this.state.room);point=v([c[0],c[1],c[2]+2]);el.textContent=`${this.state.room} · ${rooms.get(this.state.room)!.name} ↗`}
   if(id.startsWith('device:')&&this.state.mode==='room'&&this.state.room==='A-903'){const o=this.objects.get(id.slice(7));if(o){o.updateWorldMatrix(true,false);point=new T.Box3().setFromObject(o).getCenter(new T.Vector3());point.y+=.24;el.classList.add('device-scene-label');el.classList.toggle('selected',this.state.device===id.slice(7));}}
   if(id==='demo-campus'&&this.state.mode==='city')point=new T.Vector3(0,13,0);
   el.hidden=!point||!!this.state.inspect;if(point&&!this.state.inspect){point.project(this.camera);el.style.left=`${(point.x+1)*size.width/2}px`;el.style.top=`${(1-point.y)*size.height/2}px`;el.hidden=point.z>1||point.z< -1}
  }
  this.perfFrames++;if(time-this.perfStart>1000){this.lastFps=this.perfFrames*1000/(time-this.perfStart);this.perfFrames=0;this.perfStart=time;this.host.dataset.renderStats=JSON.stringify({...this.diagnostics(),fps:Math.round(this.lastFps),moving:this.moving,lcd:this.interior.lastLCD});}
  this.frame=requestAnimationFrame(this.tick);
 };
 diagnostics(){return {version:10,inspection:{parts:this.equipment.parts.size,progress:this.equipment.progress,selected:this.equipment.selected},state:this.state,hash:this.hash,loaded:!!this.asset,css:[this.host.clientWidth,this.host.clientHeight],buffer:this.renderer.getDrawingBufferSize(new T.Vector2()).toArray(),pixelRatio:this.renderer.getPixelRatio(),camera:this.camera.position.toArray(),target:this.controls.target.toArray(),triangles:this.renderer.info.render.triangles,calls:this.renderer.info.render.calls,floor9:this.objects.get('A_F09')?.getWorldPosition(new T.Vector3()).toArray(),room:this.objects.get(this.state.room)?.getWorldPosition(new T.Vector3()).toArray(),selectedFloor:this.objects.get(`${this.state.building}_F${String(this.state.floor).padStart(2,'0')}`)?.getWorldPosition(new T.Vector3()).toArray(),semanticCounts:{rooms:[...this.objects.values()].filter(o=>o.userData.kind==='room').length,devices:[...this.objects.values()].filter(o=>o.userData.kind==='device').length},nightEffects:{enabled:this.night?.enabled,time:this.night?.time,decorations:this.night?.owned.length},postProcessingBuffer:this.composer?[this.composer.renderTarget1.width,this.composer.renderTarget1.height]:null}}
 dispose(){this.alive=false;cancelAnimationFrame(this.frame);this.resize.disconnect();this.controls.dispose();this.equipment.close();this.interior.dispose();this.night?.dispose();this.bloom?.dispose();this.output?.dispose();this.composer?.dispose();this.renderer.domElement.removeEventListener('pointerdown',this.down);this.renderer.domElement.removeEventListener('pointerup',this.up);this.scene.traverse(o=>{if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose()}if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose())}});this.scene.environment?.dispose();if(this.scene.background instanceof T.Texture)this.scene.background.dispose();this.renderer.dispose();this.host.replaceChildren()}
}
