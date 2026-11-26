import {describe,it,expect} from 'vitest';
import {initial,reduce} from '../src/state';
import {data,rooms,floors,devices,deviceWorld,placements,buildings} from '../src/domain';
describe('all-space navigation invariants',()=>{
 it('resolves all 248 rooms and 176 devices to their own building/floor',()=>{
  expect(rooms.size).toBe(248);expect(devices.size).toBe(176);expect(floors.size).toBe(25);
  for(const r of data.rooms){const s=reduce(initial,{type:'room',id:r.id});expect([s.building,s.floor,s.room]).toEqual([r.building,r.floor,r.id]);expect(s.device).toBeNull()}
  for(const d of data.devices){const r=rooms.get(d.room_id)!;const s=reduce(initial,{type:'device',id:d.id});expect([s.building,s.floor,s.room,s.device]).toEqual([r.building,r.floor,r.id,d.id])}
 });
 it('every floor selects a valid room without leaking A-903',()=>{for(const f of data.floors){const s=reduce(initial,{type:'floor',building:f.building,floor:f.floor});expect(rooms.get(s.room)?.floor_id).toBe(f.id)}});
 it('switching building cancels explosion and device state',()=>{let s=reduce(initial,{type:'navigate',mode:'building'});s=reduce(s,{type:'explode'});s=reduce(s,{type:'building',id:'B'});expect(s.exploded).toBe(false);expect(s.device).toBeNull();expect(s.room.startsWith('B-')).toBe(true)});
 it('invalid IDs and cross-building floor numbers are ignored',()=>{for(const action of [{type:'device',id:'bad'},{type:'room',id:'B-999'},{type:'building',id:'D'},{type:'floor',building:'C',floor:12}] as const)expect(reduce(initial,action)).toEqual(initial)});
 it('returns through five levels and keeps selected hierarchy',()=>{let s=reduce(initial,{type:'device',id:'B-201-TH01'});for(const mode of ['floor','building','campus','city','city']){s=reduce(s,{type:'back'});expect(s.mode).toBe(mode);expect(s.building).toBe('B');expect(s.device).toBeNull()}});
 it('interior cannot explode',()=>{const s=reduce(initial,{type:'room',id:'C-201'});expect(reduce(s,{type:'explode'})).toEqual(s)});
 it('edited B placement is used for device world coordinates',()=>{const p=placements.get('B')!,d=devices.get('B-201-TH01')!,b=buildings.get('B')!;expect(deviceWorld(d.id)).toEqual([p[0]+d.local_position[0]-b.width/2,p[1]+d.local_position[1]-b.depth/2,4.2+d.local_position[2]])});
});

it('isolated visual equipment does not become a business point and navigation clears decomposition',()=>{
 const room=reduce(initial,{type:'room',id:'A-1253'}),selected=reduce(room,{type:'inspect',id:'VIZ-A1253-RK01'});
 expect(selected.inspect).toBe('VIZ-A1253-RK01');expect(selected.device).toBe(null);
 const expanded=reduce(selected,{type:'parts-toggle'});expect(expanded.partsExploded).toBe(true);
 const returned=reduce(expanded,{type:'back'});expect(returned.mode).toBe('room');expect(returned.room).toBe('A-1253');expect(returned.inspect).toBe(null);
 const city=reduce(expanded,{type:'navigate',mode:'city'});expect(city.inspect).toBe(null);expect(city.partsExploded).toBe(false);
 expect(reduce(initial,{type:'inspect',id:'missing'})).toBe(initial);
});
