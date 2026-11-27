import * as T from 'three';
import {data,placements} from '../domain';
import type {SitePlan} from './environment';
const cyan=new T.Color('#30bfff'),amber=new T.Color('#ffc279');
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
/** Decorative light only. No business state, collision or picking ownership. */
export class NightEffects{
 time=0;enabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 shaders:T.ShaderMaterial[]=[];owned:T.Object3D[]=[];beacon:T.Group;mode='campus';
 constructor(city:T.Group,context:T.Group,asset:T.Object3D,plan:SitePlan,markerLift:number){
  const attach=(parent:T.Object3D,o:T.Object3D)=>{o.name='night-decoration';o.userData.decorative=true;o.traverse(n=>n.raycast=()=>{});parent.add(o);this.owned.push(o);return o};
  const tube=(parent:T.Object3D,points:T.Vector3[],color:T.Color,width=.06)=>{
   const curve=new T.CatmullRomCurve3(points,false,'catmullrom',0);const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(2,points.length*2),width,4,false),new T.MeshBasicMaterial({color:color.clone().multiplyScalar(2.0),toneMapped:false}));attach(parent,mesh);
  };
  const shader=(fragment:string,color=cyan)=>{const m=new T.ShaderMaterial({uniforms:{uTime:{value:0},uColor:{value:color}},vertexShader:vertex,fragmentShader:`uniform float uTime;uniform vec3 uColor;varying vec2 vUv;${fragment}`,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});this.shaders.push(m);return m};
  const radial=shader(`void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float base=exp(-r*r*5.)*.20;float rings=0.;for(int i=0;i<3;i++){float age=fract(uTime*.23+float(i)/3.);float rr=.15+age*.79;rings+=exp(-pow(abs(r-rr)*75.,2.))*(1.-age)*.8;}float a=(base+rings)*(1.-smoothstep(.90,1.,r));gl_FragColor=vec4(uColor,a);}`);
  const disc=new T.Mesh(new T.PlaneGeometry(30,30),radial);disc.rotation.x=-Math.PI/2;disc.position.y=2.16+markerLift;attach(city,disc);
  this.beacon=new T.Group();this.beacon.position.set(0,2.1+markerLift,0);attach(city,this.beacon);
  const beam=shader(`void main(){float sides=pow(sin(vUv.x*3.14159265),3.);float fade=pow(1.-vUv.y,2.5);float a=sides*fade*.30;gl_FragColor=vec4(uColor,a);}`);
  const light=new T.Mesh(new T.CylinderGeometry(1.7,2.4,23,48,1,true),beam);light.position.y=11.5;attach(this.beacon,light);
  const diamond=new T.Mesh(new T.OctahedronGeometry(1.15),new T.MeshBasicMaterial({color:amber,toneMapped:false}));diamond.position.y=8;diamond.name='beacon-diamond';attach(this.beacon,diamond);diamond.name='beacon-diamond';
  const orbit=new T.Mesh(new T.TorusGeometry(4.3,.045,6,96,Math.PI*1.6),new T.MeshBasicMaterial({color:amber,toneMapped:false}));orbit.rotation.x=-Math.PI/2;orbit.position.y=.14;attach(this.beacon,orbit);orbit.name='beacon-orbit';
  // Sparse warm rooms are visible through the existing PBR glass, without recoloring the building shell.
  asset.traverse(o=>{if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m instanceof T.MeshStandardMaterial){if(m.name==='v5_lamp'){m.emissive.set('#ffd49b');m.emissiveIntensity=3.2}if(m.name==='v5_warm'){m.emissive.set('#e6a85d');m.emissiveIntensity=.48}}}}});
  for(const b of data.buildings){
   const x=b.width/2+.44,z=b.depth/2+.44;
   for(const f of data.floors.filter(f=>f.building===b.id)){
    const facade=asset.getObjectByName(`${b.id}_F${String(f.floor).padStart(2,'0')}_facade`);if(!facade)continue;
    if(f.floor===b.floors||f.floor===1||f.floor%3===0){const h=f.floor_height-.13;tube(facade,[new T.Vector3(-x,h,z),new T.Vector3(x,h,z),new T.Vector3(x,h,-z),new T.Vector3(-x,h,-z),new T.Vector3(-x,h,z)],cyan,.085)}
    for(const sx of [-1,1])for(const sz of [-1,1])tube(facade,[new T.Vector3(sx*x,.4,sz*z),new T.Vector3(sx*x,f.floor_height-.4,sz*z)],cyan,.07);
   }
   const p=placements.get(b.id)!;const halo=new T.Mesh(new T.PlaneGeometry(b.width+12,b.depth+12),shader(`void main(){vec2 q=abs(vUv-.5)*2.;float edge=max(q.x,q.y);float glow=exp(-pow(abs(edge-.76)*14.,2.))*.20;gl_FragColor=vec4(uColor,glow);}`));halo.rotation.x=-Math.PI/2;halo.position.set(p[0],.115,-p[1]);attach(context,halo);
  }
  const flow=shader(`void main(){float edge=pow(max(0.,1.-abs(vUv.y-.5)*2.),1.6);float phase=fract(vUv.x*3.-uTime*.19);float trail=pow(phase,15.);float a=edge*(.13+.87*trail);gl_FragColor=vec4(uColor*1.5,a);}`);
  for(const o of plan.objects.filter(o=>o.category==='road')){const [w,d,h]=o.dimensions,horizontal=w>d,length=Math.max(w,d);for(const side of [-1,1]){const ribbon=new T.Mesh(new T.PlaneGeometry(length,.46),flow);ribbon.rotation.x=-Math.PI/2;if(!horizontal)ribbon.rotation.z=Math.PI/2;ribbon.position.set(o.position[0]+(horizontal?0:side*w*.30),o.position[2]+h+.07,-o.position[1]+(horizontal?side*d*.30:0));attach(context,ribbon)}}
  const landscapeGlow=shader(`void main(){float r=length((vUv-.5)*2.);float a=exp(-r*r*5.)*.23;gl_FragColor=vec4(uColor,a);}`,amber);
  for(const o of plan.objects.filter(o=>o.category==='tree')){const pool=new T.Mesh(new T.PlaneGeometry(5.5,5.5),landscapeGlow);pool.rotation.x=-Math.PI/2;pool.position.set(o.position[0],.36,-o.position[1]);attach(context,pool)}
  // Entrance markers, separate from alarm colors and data point markers.
  for(const o of plan.objects.filter(o=>o.category==='path')){const [w,d,h]=o.dimensions;for(const side of [-1,1]){tube(context,[new T.Vector3(o.position[0]+side*w*.48,h+.08,-o.position[1]-d/2),new T.Vector3(o.position[0]+side*w*.48,h+.08,-o.position[1]+d/2)],amber,.055)}}
 }
 tick(dt:number){if(this.enabled)this.time+=dt;for(const m of this.shaders)m.uniforms.uTime.value=this.time;const d=this.beacon.getObjectByName('beacon-diamond'),r=this.beacon.getObjectByName('beacon-orbit');if(d){d.rotation.y=this.time*.45;d.position.y=8+Math.sin(this.time*1.2)*.35}if(r)r.rotation.z=this.time*.18}
 dispose(){for(const root of this.owned){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});root.removeFromParent()}this.owned=[];this.shaders=[]}
}
