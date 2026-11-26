import {data,type Room} from '../domain';
import type {Bundle} from '../data/types';
import {boundScope} from '../data/validate';
export const seriesColors=['#75a3c6','#e79852','#c0a674','#8d9baa'];
export const monthlyDemo={months:['07月','08月','09月','10月'],actual:[21000,24000,20000,23000],plan:[23000,25000,22000,24000],costs:[42000,28000,18000,12000]};
export function scopeMetrics(selected:Room[],bundle:Bundle){
 const ids=new Set(selected.map(r=>r.id)),ds=data.devices.filter(d=>ids.has(d.room_id)),area=selected.reduce((s,r)=>s+r.area,0),totalArea=data.rooms.reduce((s,r)=>s+r.area,0),ratio=area/totalArea;
 const usage=[0,0,0,0];for(const r of selected){const index=/培训|备课/.test(r.name)?2:/会议|协作/.test(r.name)?1:/办公|实验|工作/.test(r.name)?0:3;usage[index]+=r.area}
 const total=usage.reduce((a,b)=>a+b,0),deviceTypes=[0,0,0,0];for(const d of ds)deviceTypes[d.id.includes('TH')?0:d.id.includes('DSP')?1:d.id.includes('ACS')?2:3]++;
 const business=boundScope(bundle,ids),alarms=bundle.rows.alarms.filter(a=>business.has(a.device_id)).sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at));
 return {ds,area,ratio,usage:usage.map(v=>total?v/total*100:0),deviceTypes,monthly:{actual:monthlyDemo.actual.map(v=>v*ratio),plan:monthlyDemo.plan.map(v=>v*ratio)},costs:monthlyDemo.costs.map(v=>v*ratio),alarms,points:bundle.rows.points.filter(p=>business.has(p.device_id)),businessDevices:bundle.rows.devices.filter(d=>business.has(d.device_id))};
}
