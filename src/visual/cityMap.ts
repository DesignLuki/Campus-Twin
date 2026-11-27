import * as T from 'three';
import roads from './shanghai-roads.json';

type Coordinate = number[];
type Polygon = Coordinate[][];
const project = ([lon, lat]: Coordinate) =>
  new T.Vector2((lon - 121.45) * 95 * Math.cos(31.2 * Math.PI / 180), (lat - 31.15) * 95);

function contains(ring: T.Vector2[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function outline(parent: T.Group, ring: T.Vector2[], height: number, color: string) {
  const points = ring.map(p => new T.Vector3(p.x, height, -p.y));
  parent.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(points), new T.LineBasicMaterial({color})));
}

function mapLabel(parent:T.Group, name:string, lon:number, lat:number) {
  const canvas=document.createElement('canvas');
  canvas.width=256; canvas.height=64;
  const ctx=canvas.getContext('2d')!;
  ctx.font='500 35px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.lineWidth=5;ctx.strokeStyle='#16364a';ctx.strokeText(name,128,32);
  ctx.fillStyle='#c6e7ee';ctx.fillText(name,128,32);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  const label=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}));
  const p=project([lon,lat]);label.position.set(p.x,3.2,-p.y);label.scale.set(20,5,1);
  parent.add(label);
}

// The coastline is geographic. Street blocks and the skyline illustrate urban form.
export function buildCityMap(parent: T.Group, polygons: Polygon[]) {
  const land = polygons.map(p => p.map(ring => ring.map(project)));
  const top = new T.MeshBasicMaterial({color:'#246885'});
  const wall = new T.MeshBasicMaterial({color:'#133d5d'});
  for (const [outer, ...holes] of land) {
    const shape = new T.Shape(outer);
    shape.holes = holes.map(h => new T.Path(h));
    const slab = new T.Mesh(new T.ExtrudeGeometry(shape, {depth:3.4, bevelEnabled:false}), [top,wall]);
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = -1.4;
    parent.add(slab);
    for (const ring of [outer,...holes]) {
      outline(parent,ring,2.06,'#8cedff');
      outline(parent,ring,.5,'#3187ad');
      outline(parent,ring,-1.35,'#308fb2');
    }
  }

  const onLand = (x:number,y:number) => land.some(([outer,...holes]) =>
    contains(outer,x,y) && !holes.some(h => contains(h,x,y)));
  const center = project([121.49,31.23]);
  // Natural Earth 1:10m roads, clipped to the municipal polygons.
  const roadSegments=roads.flatMap(line=>{
    const vertices=line.map(project);
    return vertices.slice(1).map((b,i)=>new T.Line3(
      new T.Vector3(vertices[i].x,0,-vertices[i].y),new T.Vector3(b.x,0,-b.y)));
  });
  const roadVertices=roadSegments.flatMap(({start,end})=>[start.clone().setY(2.09),end.clone().setY(2.09)]);
  parent.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(roadVertices),new T.LineBasicMaterial({color:'#83cad3'})));
  const testPoint=new T.Vector3(), closest=new T.Vector3();
  const blocks: {x:number;y:number;w:number;d:number;h:number;shade:number}[] = [];
  let seed = 41;
  const random = () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296);
  const angle = .24, c = Math.cos(angle), s = Math.sin(angle);
  for (let i = -39; i <= 39; i++) for (let j = -45; j <= 45; j++) {
    const x = (i*c-j*s)*1.65, y = (i*s+j*c)*1.65;
    if (!onLand(x,y) || !onLand(x-.95,y-.95) || !onLand(x+.95,y+.95)) continue;
    const urban = Math.exp(-((x-center.x)**2/160 + (y-center.y)**2/170));
    const lot = random();
    testPoint.set(x,0,-y);
    if (roadSegments.some(segment=>segment.closestPointToPoint(testPoint,true,closest).distanceToSquared(testPoint)<.85)) continue;
    if (lot < .40 || Math.hypot(x,y)<3.8) continue;
    const tower = urban>.12 && lot>.65;
    blocks.push({x,y,w:.58+random()*.62,d:.6+random()*.65,
      h:tower ? .75+urban*(2+random()*7) : .12+random()*.45, shade:random()});
  }
  const mesh = new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshLambertMaterial({emissive:'#10374a',emissiveIntensity:.65}),blocks.length);
  const matrix = new T.Object3D();
  blocks.forEach((b,i) => {
    matrix.position.set(b.x,2+b.h/2,-b.y); matrix.rotation.y=angle;
    matrix.scale.set(b.w,b.h,b.d); matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);
    mesh.setColorAt(i,new T.Color(b.h>3 ? (b.shade>.78?'#edc78d':'#78bfd5') : b.shade>.78 ? '#3d7084' : '#2c5d72'));
  });
  parent.add(mesh);
  mapLabel(parent,'崇 明 岛',121.59,31.63);
  mapLabel(parent,'长 江 口',121.96,31.43);

  // A graduated circular frame provides orientation during orbit.
  const ticks:T.Vector3[]=[];
  for(let deg=0;deg<360;deg+=3){
    const a=deg*Math.PI/180,outer=72+(deg%15===0?1.4:.55);
    ticks.push(new T.Vector3(72*Math.sin(a),-2.6,72*Math.cos(a)),new T.Vector3(outer*Math.sin(a),-2.6,outer*Math.cos(a)));
  }
  parent.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(ticks),new T.LineBasicMaterial({color:'#35677d'})));
  const circle=Array.from({length:180},(_,i)=>new T.Vector2(71.7*Math.cos(i*Math.PI/90),71.7*Math.sin(i*Math.PI/90)));
  outline(parent,circle,-2.6,'#244b60');
  const grid=new T.GridHelper(230,46,0x27546a,0x173b51);
  grid.position.y=-2.9;parent.add(grid);
}
