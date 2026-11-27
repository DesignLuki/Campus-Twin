import * as T from 'three';

type Coordinate = number[];
type Polygon = Coordinate[][];
const xScale = 95 * Math.cos(31.2 * Math.PI / 180);
const project = ([lon, lat]: Coordinate) => new T.Vector2((lon - 121.45) * xScale, (lat - 31.15) * 95);
// Both local rasters are north-up and resampled to this geographic extent.
const bounds = {west:120.45, south:30.43, east:122.45, north:32.03};
const width = (bounds.east - bounds.west) * xScale;
const depth = (bounds.north - bounds.south) * 95;
const center = project([(bounds.east + bounds.west)/2,(bounds.north + bounds.south)/2]);
const surfaceY = 2;
const groundY = -8.5;

function label(parent:T.Group, text:string, x:number, y:number, z:number, compass=false) {
  const canvas=document.createElement('canvas');
  canvas.width=256; canvas.height=64;
  const ctx=canvas.getContext('2d')!;
  ctx.font=compass?'600 45px system-ui':'500 34px system-ui';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if (!compass) {
    const w=ctx.measureText(text).width+29;
    ctx.fillStyle='rgba(15,32,32,.86)';
    ctx.fillRect((256-w)/2,8,w,48);
    ctx.fillStyle='#8ce1cb';ctx.fillRect((256-w)/2,8,3,48);
  }
  ctx.fillStyle=compass ? (text==='N'?'#ffc77f':'#80d6c9') : '#eef2db';
  ctx.fillText(text,128,32);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}));
  sprite.position.set(x,y,z);sprite.scale.set(19,4.75,1);
  parent.add(sprite);
}

// Share vertices only along a panel; a corner keeps its own metallic face shading.
function addCutEdge(parent:T.Group, ring:T.Vector2[]) {
  const profile:[number,string][]=[
    [-6.25,'#342f29'],[-5.7,'#995a2f'],[-5.40,'#ffb956'],[-4.80,'#ffdb94'],
    [-4.40,'#755c40'],[-4.10,'#384852'],[-.2,'#586c72'],[1.38,'#97afab'],
    [1.55,'#5cb9af'],[1.88,'#c9fff0'],[surfaceY,'#b9e8d9']
  ];
  const verts:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],dir=b.clone().sub(a);
    if(!dir.lengthSq())continue;
    dir.normalize();
    const light=.70+.30*Math.abs(.72*dir.x+.69*dir.y);
    const base=verts.length/3;
    profile.forEach(([h,tint],row)=>{
      const color=new T.Color(tint).multiplyScalar(row===2||row===3?1:light);
      verts.push(a.x,h,-a.y,b.x,h,-b.y);
      colors.push(color.r,color.g,color.b,color.r,color.g,color.b);
      if(row){const n=base+row*2;indices.push(n-2,n-1,n,n,n-1,n+1)}
    });
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  parent.add(new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false})));
}

function addGround(parent:T.Group, photo:T.Texture) {
  // Same registered satellite image under the raised cutout, muted into the dot field.
  const atlas=new T.ShaderMaterial({
    uniforms:{photo:{value:photo},extent:{value:new T.Vector2(width,depth)},center:{value:center}},
    vertexShader:'varying vec2 xy; void main(){xy=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`
      uniform sampler2D photo; uniform vec2 extent,center; varying vec2 xy;
      void main(){
        vec2 uv=(xy-center)/extent+.5;
        vec3 img=texture2D(photo,clamp(uv,0.,1.)).rgb;
        float inside=smoothstep(0.,.13,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
        float luma=dot(img,vec3(.25,.61,.14));
        vec3 color=vec3(.005,.015,.024)+inside*sqrt(luma)*vec3(.12,.14,.13);
        vec2 cell=(fract(xy/2.8+.5)-.5)*2.8;
        float dots=1.-smoothstep(.06,.1+fwidth(xy.x)*.8,length(cell));
        color+=dots*vec3(.025,.047,.05);
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  });
  const ground=new T.Mesh(new T.PlaneGeometry(1500,1500),atlas);
  ground.rotation.x=-Math.PI/2;ground.position.y=groundY;
  parent.add(ground);
}

function addTerrain(parent:T.Group, photo:T.Texture, relief:T.Texture){
  const raster=relief.image as HTMLImageElement;
  const canvas=document.createElement('canvas');canvas.width=raster.width;canvas.height=raster.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(raster,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const geometry=new T.PlaneGeometry(width,depth,256,208);
  const uv=geometry.attributes.uv,pos=geometry.attributes.position;
  let markerLift=0;
  for(let i=0;i<pos.count;i++){
    const x=Math.round(uv.getX(i)*(canvas.width-1)),y=Math.round((1-uv.getY(i))*(canvas.height-1));
    // DEM values cover 0–110 m. The readable vertical scale is intentionally exaggerated.
    const h=pixels[(y*canvas.width+x)*4]/255*4.4;
    pos.setZ(i,h);
    if(Math.hypot(pos.getX(i)+center.x,pos.getY(i)+center.y)<5)markerLift=Math.max(markerLift,h);
  }
  geometry.computeVertexNormals();
  const material=new T.MeshStandardMaterial({
    map:photo,alphaMap:relief,alphaTest:.49,roughness:.97,metalness:0,
    emissiveMap:photo,emissive:0xffffff,emissiveIntensity:.50,envMapIntensity:.15
  });
  const terrain=new T.Mesh(geometry,material);
  terrain.rotation.x=-Math.PI/2;terrain.position.set(center.x,surfaceY+.025,-center.y);
  parent.add(terrain);
  return markerLift;
}

export async function buildCityMap(parent:T.Group,polygons:Polygon[]) {
  const loader=new T.TextureLoader();
  const [photo,relief]=await Promise.all([
    loader.loadAsync('./geodata/shanghai-surface.webp'),loader.loadAsync('./geodata/shanghai-relief.png')
  ]);
  photo.colorSpace=T.SRGBColorSpace;photo.anisotropy=4;
  addGround(parent,photo);
  const markerLift=addTerrain(parent,photo,relief);

  for(const polygon of polygons){
    const [outer,...holes]=polygon.map(r=>r.map(project));
    const shape=new T.Shape(outer);shape.holes=holes.map(r=>new T.Path(r));
    for(const ring of [outer,...holes])addCutEdge(parent,ring);
    // Deep contact shade makes the raised profile visible over neighbouring geography.
    const shadow=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:'#111b20',transparent:true,opacity:.70,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.set(1.1,groundY+.03,.85);parent.add(shadow);
  }
  for(const [name,lon,lat] of [['崇明岛',121.59,31.64],['佘山',121.187,31.095],['长江口',121.96,31.43]] as const){
    const p=project([lon,lat]);label(parent,name,p.x,name==='佘山'?7:3.8,-p.y);
  }
  label(parent,'N',0,groundY+1,-77,true);label(parent,'W',-64,groundY+1,0,true);
  label(parent,'E',62,groundY+1,-5,true);label(parent,'S',0,groundY+1,57,true);
  return {markerLift,dispose:()=>{photo.dispose();relief.dispose()}};
}
