import * as T from 'three';
export interface SiteItem {id:string;category:string;position:number[];dimensions:number[];yawDeg:number}
export interface SitePlan {objects:SiteItem[]}
const mat=(color:string,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const rng=(seed:number)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
export function buildEnvironment(parent:T.Group,plan:SitePlan){
 parent.name='CampusEnvironment';parent.userData.environmentOnly=true;
 const pavement=mat('#536773'),asphalt=mat('#293d4c'),curb=mat('#9aa8ac'),grass=mat('#354d3d'),bark=mat('#5c594d'),metal=mat('#8195a3',.35,.65),line=mat('#a9b7bb'),glass=mat('#294557',.22,.4);
 const glow=new T.MeshBasicMaterial({color:'#e7c18b'}),rubber=mat('#18252b');
 const boxGeo=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
 const mesh=(size:number[],pos:number[],material:T.Material,cast=false)=>{const o=new T.Mesh(boxGeo,material);o.scale.set(size[0],size[1],size[2]);o.position.set(pos[0],pos[1],pos[2]);o.castShadow=cast;o.receiveShadow=true;parent.add(o);return o};
 const box=(x:number,z:number,w:number,d:number,h:number,y:number,m:T.Material,cast=false)=>mesh([w,h,d],[x,y+h/2,z],m,cast);
 box(0,0,2400,2400,.5,-.7,mat('#243948'));
 box(0,0,180,150,.12,-.12,pavement);
 // Distant city parcels and street corridors are separate context, outside the frozen site.
 const random=rng(20261118),cityGeo=new T.BoxGeometry(1,1,1),cityM=mat('#1b2e3e',.88),cityMatrices:T.Matrix4[]=[],cityWindows:T.Matrix4[]=[],cityRoofs:T.Matrix4[]=[];
 for(let ix=-9;ix<=9;ix++)for(let iz=-9;iz<=9;iz++){
  const x=ix*62,z=iz*58;if((Math.abs(x)<120&&Math.abs(z)<110)||(z>60&&Math.abs(x)<260))continue;
  for(let q=0;q<3;q++){const px=x+(q%2)*23-10,pz=z+Math.floor(q/2)*22-7,w=14+random()*10,d=14+random()*8,h=5+random()*17;dummy.position.set(px,h/2-.2,pz);dummy.scale.set(w,h,d);dummy.updateMatrix();cityMatrices.push(dummy.matrix.clone());
   dummy.position.set(px,h+.45,pz);dummy.scale.set(w*.62,.9,d*.66);dummy.updateMatrix();cityRoofs.push(dummy.matrix.clone());
   for(let level=3;level<h-1;level+=3.2){dummy.position.set(px,level,pz+d/2+.025);dummy.scale.set(w*.86,.62,.04);dummy.updateMatrix();cityWindows.push(dummy.matrix.clone());dummy.position.set(px+w/2+.025,level,pz);dummy.scale.set(.04,.62,d*.86);dummy.updateMatrix();cityWindows.push(dummy.matrix.clone())}}
 }
 const city=new T.InstancedMesh(cityGeo,cityM,cityMatrices.length);cityMatrices.forEach((m,i)=>city.setMatrixAt(i,m));city.receiveShadow=true;parent.add(city);
 for(const [matrices,material] of [[cityWindows,mat('#2b4050',.7,.2)],[cityRoofs,mat('#263a49',.9)]] as [T.Matrix4[],T.Material][]){const detail=new T.InstancedMesh(cityGeo,material,matrices.length);matrices.forEach((m,i)=>detail.setMatrixAt(i,m));parent.add(detail)}
 for(let j=-8;j<=8;j++){const c=j*62+29;if(Math.abs(c)>94){box(c,0,8,1100,.015,-.16,asphalt);box(0,c,1100,8,.015,-.15,asphalt)}}
 const trees:{x:number;z:number;y:number;h:number;w:number}[]=[];
 function tree(x:number,z:number,y:number,h:number,w:number){trees.push({x,z,y,h,w})}
 function lamp(x:number,z:number,h=5.8){box(x,z,.11,.11,h,.05,metal);box(x+.5,z,1.1,.14,.1,h,metal);box(x+.75,z,.5,.14,.035,h-.04,glow);const lit=new T.Mesh(new T.CircleGeometry(1.8,20),new T.MeshBasicMaterial({color:'#b29863',transparent:true,opacity:.13,depthWrite:false}));lit.rotation.x=-Math.PI/2;lit.position.set(x,.055,z);parent.add(lit)}
 function car(x:number,z:number,w:number,d:number,h:number,y:number,yaw:number,index:number){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=-yaw*Math.PI/180;parent.add(g);const paint=mat(['#b4c0c8','#5e788c','#d0d2cb','#354c60'][index%4],.27,.45);
  const part=(s:number[],p:number[],m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(...s as [number,number,number]),m);o.position.set(...p as [number,number,number]);o.castShadow=true;g.add(o);return o};
  part([w,h*.43,d],[0,h*.3,0],paint);part([w*.84,h*.38,d*.55],[0,h*.68,-d*.04],glass);part([w*.82,.06,d*.45],[0,h*.88,-d*.04],paint);part([w*.8,.12,.08],[0,h*.32,d/2+.01],metal);
  for(const side of [-1,1]){for(const zz of [-d*.31,d*.31]){const wheel=new T.Mesh(new T.CylinderGeometry(.32,.32,.18,16),rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(side*w*.47,.31,zz);g.add(wheel)}part([.28,.12,.035],[side*w*.31,h*.42,d/2+.03],glow);part([.25,.09,.035],[side*w*.31,h*.4,-d/2-.03],mat('#9b4c42'))}
 }
 let vehicle=0;
 // Public boulevard beyond the site boundary provides the foreground city connection.
 box(0,87,620,15,.05,-.10,asphalt);box(0,87,620,.65,.18,-.10,curb);
 for(let x=-300;x<300;x+=8)for(const z of [82.8,91.2])box(x,z,3.6,.12,.015,-.035,line);
 for(const z of [79.7,94.3])box(0,z,620,.13,.015,-.035,line);
 for(const x of [-118,-55,27,96,165])car(x,91,1.8,4.2,1.4,-.045,90,vehicle++);
 for(const x of [-150,-20,63,138])car(x,83,1.8,4.2,1.4,-.045,-90,vehicle++);
 for(const o of plan.objects){const [x,sy,base]=o.position,z=-sy,[w,d,h]=o.dimensions;
  if(o.category==='building'){
   box(x,z,w+3,d+3,.10,-.025,curb);
   for(const side of [-1,1])for(let t=-w/2;t<=w/2;t+=6)box(x+t,z+side*(d/2+1.05),.035,1.15,.01,.082,pavement);
  }else if(o.category==='road'){
   box(x,z,w,d,h,base,asphalt);const horizontal=w>d,length=Math.max(w,d);
   for(let t=-length/2+2;t<length/2-1;t+=6)box(x+(horizontal?t:0),z+(horizontal?0:t),horizontal?2.8:.10,horizontal?.10:2.8,.01,base+h+.008,line);
   for(const side of [-1,1])box(x+(horizontal?0:side*(w/2-.25)),z+(horizontal?side*(d/2-.25):0),horizontal?w:.10,horizontal?.10:d,.012,base+h+.01,line);
  }else if(o.category==='path'){box(x,z,w,d,h,base,curb);for(let v=-d/2+1;v<d/2;v+=1.2)box(x,z+v,w,.025,.01,base+h+.003,pavement)}
  else if(o.category==='parking'){
   box(x,z,w,d,h,base,asphalt);for(let k=0;k<=12;k++)box(x-w/2+k*3,z+3.5,.08,6,.012,base+h+.012,line);box(x,z+6.5,w,.08,.012,base+h+.012,line);
  }else if(o.category==='vehicle')car(x,z,w,d,h,base,o.yawDeg,vehicle++);
  else if(o.category==='vegetation'){
   box(x,z,w+.4,d+.4,h,base,curb);box(x,z,w,d,h+.015,base,grass);
   if(o.id==='garden'){
    box(x,z,2.4,d,.035,base+h+.02,pavement);box(x,z,w,2.4,.035,base+h+.02,pavement);
    for(const side of [-1,1])for(let t=-w/2+3;t<w/2;t+=6){const sx=x+t,sz=z+side*(d/2-1.4);for(let q=0;q<4;q++)tree(sx+q*.45,sz,base+h,1.3,1.15)}
    for(const side of [-1,1]){box(x+side*4,z+4,2,.45,.42,base+h,mat('#8e7a5f'));box(x+side*4,z+4.2,2,.09,.5,base+h+.25,mat('#8e7a5f'))}
   }
  }else if(o.category==='tree')tree(x,z,base,h,w);
  else if(o.id==='island'){
   const disk=new T.Mesh(new T.CylinderGeometry(3,3,.27,48),curb);disk.position.set(x,.18,z);parent.add(disk);const inner=new T.Mesh(new T.CylinderGeometry(2.5,2.5,.25,48),grass);inner.position.set(x,.36,z);parent.add(inner);tree(x,z,.48,5,3.4);
  }
 }
 // Street planting is placed on verges, not on the confirmed vehicle lanes or entrances.
 for(let x=-85;x<=85;x+=9){tree(x,69,.03,5.2,3.4);tree(x,-70,.03,5.1,3.4);if(x%18===-13||x%18===5){lamp(x,66);lamp(x,-66)}}
 for(let z=-54;z<=54;z+=9){tree(-84,z,.03,5.7,3.5);tree(84,z,.03,5.7,3.5);if(z%18===0){lamp(-81,z);lamp(81,z)}}
 for(let z=-48;z<55;z+=18)lamp(-15,z);
 for(let x=-400;x<=400;x+=26)for(const z of [-99,104]){if(Math.abs(x)>110||z===104)tree(x,z,-.1,5+random()*2,4)}
 for(let x=-55;x<=65;x+=40)car(x,62,1.8,4.2,1.4,.07,90,vehicle++);
 // Multi-lobe foliage with coherent branching; shared geometry/instances keep shadows affordable.
 const trunkGeo=new T.CylinderGeometry(.11,.20,1,7),leafGeo=new T.IcosahedronGeometry(1,1),trunks=new T.InstancedMesh(trunkGeo,bark,trees.length),foliage=new T.InstancedMesh(leafGeo,mat('#527158',.95),trees.length*35);
 let li=0;const color=new T.Color();
 trees.forEach((t,i)=>{dummy.position.set(t.x,t.y+t.h*.37,t.z);dummy.scale.set(t.w*.09,t.h*.74,t.w*.09);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
  for(let j=0;j<35;j++){const a=random()*Math.PI*2,r=Math.sqrt(random())*t.w*.28,level=random();dummy.position.set(t.x+Math.cos(a)*r,t.y+t.h*(.57+level*.34),t.z+Math.sin(a)*r);const s=t.w*(.12+random()*.07);dummy.scale.set(s,s*(.8+random()*.5),s);dummy.rotation.set(random(),random(),random());dummy.updateMatrix();foliage.setMatrixAt(li,dummy.matrix);color.setHSL(.27+random()*.045,.16+random()*.10,.23+random()*.13);foliage.setColorAt(li,color);li++}
 });trunks.castShadow=true;foliage.castShadow=true;foliage.receiveShadow=true;parent.add(trunks,foliage);
 return {treeCount:trees.length,cityBuildings:cityMatrices.length};
}
export function skyTexture(){const c=document.createElement('canvas');c.width=16;c.height=256;const ctx=c.getContext('2d')!,g=ctx.createLinearGradient(0,0,0,256);g.addColorStop(0,'#102d49');g.addColorStop(.5,'#10253c');g.addColorStop(1,'#091b2c');ctx.fillStyle=g;ctx.fillRect(0,0,16,256);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t}
