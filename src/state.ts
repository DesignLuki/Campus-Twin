import assets from '../public/visual-assets-v9.json';
import {buildings,rooms,devices,floors,floorKey,floorRooms} from './domain';
export type Mode='city'|'campus'|'building'|'floor'|'room';
export interface State {mode:Mode;building:string;floor:number;room:string;exploded:boolean;device:string|null;inspect?:string|null;partsExploded?:boolean;part?:string|null}
export const initial:State={mode:'campus',building:'A',floor:9,room:'A-903',exploded:false,device:null};
export type Action={type:'navigate';mode:Mode}|{type:'building';id:string}|{type:'floor';building:string;floor:number}|{type:'room';id:string}|{type:'device';id:string}|{type:'explode'}|{type:'back'}|{type:'inspect';id:string}|{type:'parts-toggle'}|{type:'component';id:string}|{type:'leave-inspect'};
export function reduce(s:State,a:Action):State {
 if(a.type==='parts-toggle')return s.inspect?{...s,partsExploded:!s.partsExploded}:s;
 if(a.type==='component')return s.inspect?{...s,part:a.id}:s;
 if(a.type==='leave-inspect'||a.type==='back'&&s.inspect)return {...s,inspect:null,partsExploded:false,part:null};
 if(a.type==='inspect'){const dev=devices.get(a.id),asset=assets.find(v=>v.id===a.id),r=rooms.get(dev?.room_id??asset?.room_id??'');if(!r)return s;return {mode:'room',building:r.building,floor:r.floor,room:r.id,device:dev?.id??null,exploded:false,inspect:a.id,partsExploded:false,part:null};}
 if(a.type==='navigate')return {...s,mode:a.mode,exploded:false,device:null,inspect:null,partsExploded:false,part:null};
 if(a.type==='building'){
  if(!buildings.has(a.id))return s;const floor=a.id===s.building?s.floor:a.id==='A'?9:1;const room=a.id===s.building?s.room:floorRooms(a.id,floor)[0].id;
  return {mode:'building',building:a.id,floor,room,exploded:false,device:null};
 }
 if(a.type==='floor'){
  if(!floors.has(floorKey(a.building,a.floor)))return s;const room=s.building===a.building&&s.floor===a.floor?s.room:floorRooms(a.building,a.floor)[0].id;
  return {mode:'floor',building:a.building,floor:a.floor,room,exploded:false,device:null};
 }
 if(a.type==='room'||a.type==='device'){
  const dev=a.type==='device'?devices.get(a.id):undefined;if(a.type==='device'&&!dev)return s;const room=rooms.get(dev?.room_id??a.id);if(!room)return s;
  return {mode:'room',building:room.building,floor:room.floor,room:room.id,exploded:false,device:dev?.id??null};
 }
 if(a.type==='explode')return s.mode==='building'?{...s,exploded:!s.exploded}:s;
 const modes:Mode[]=['city','campus','building','floor','room'];return {...s,mode:modes[Math.max(0,modes.indexOf(s.mode)-1)],exploded:false,device:null,inspect:null,partsExploded:false,part:null};
}
