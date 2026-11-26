import raw from '../public/spatial-program.json';
import frozen from '../public/frozen-plan.json';
export interface Building {id:string;name:string;use:string;floors:number;width:number;depth:number;roof:number;equip:number;estimated_gross_floor_area:number}
export interface Floor {id:string;building:string;floor:number;base_z:number;floor_height:number;clear_height:number;corridor_id:string}
export interface Room {id:string;floor_id:string;building:string;floor:number;name:string;row:string;bounds:number[];area:number;clear_width:number;clear_depth:number;clear_height:number;world_z:number}
export interface Device {id:string;room_id:string;type:string;local_position:number[];metric_keys:string[]}
export const data=raw as unknown as {buildings:Building[];floors:Floor[];rooms:Room[];devices:Device[]};
export const buildings=new Map(data.buildings.map(b=>[b.id,b]));
export const floors=new Map(data.floors.map(f=>[f.id,f]));
export const rooms=new Map(data.rooms.map(r=>[r.id,r]));
export const devices=new Map(data.devices.map(d=>[d.id,d]));
export const placements=new Map(frozen.objects.filter(o=>o.category==='building').map(o=>[o.id,o.position]));
export const floorKey=(building:string,floor:number)=>`${building}-F${String(floor).padStart(2,'0')}`;
export const floorRooms=(building:string,floor:number)=>data.rooms.filter(r=>r.floor_id===floorKey(building,floor));
export const roomDevices=(room:string)=>data.devices.filter(d=>d.room_id===room);
/** P3 local positions remain authoritative; edited building placement replaces old world_position. */
export function deviceWorld(id:string){const d=devices.get(id);if(!d)throw Error('未知设备');const r=rooms.get(d.room_id)!;const b=buildings.get(r.building)!;const p=placements.get(b.id)!;return [p[0]+d.local_position[0]-b.width/2,p[1]+d.local_position[1]-b.depth/2,p[2]+r.world_z+d.local_position[2]]}
export function roomCenter(id:string){const r=rooms.get(id)!;const b=buildings.get(r.building)!;const p=placements.get(b.id)!;return [p[0]+(r.bounds[0]+r.bounds[2]-b.width)/2,p[1]+(r.bounds[1]+r.bounds[3]-b.depth)/2,p[2]+r.world_z]}
