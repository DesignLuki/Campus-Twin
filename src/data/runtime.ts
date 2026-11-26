import type {Bundle,Row,Snapshot} from './types';
import {parseTime} from './time';
import {readingValue,validateBundle} from './validate';
export interface PointView {point:Row;value:number|string|boolean|undefined;status:'good'|'bad'|'unknown'|'stale'|'missing'|'api';source:'real'|'mock'|'none';sampleAt:number|null;label:string;history:Row[]}
const hash=(s:string)=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0);
export function pointView(point:Row,bundle:Bundle,now=Date.now()):PointView {
 const history=bundle.rows.readings.filter(r=>r.point_id===point.point_id).slice().sort((a,b)=>parseTime(a.collected_at)-parseTime(b.collected_at));
 const base={point,history};if(point.data_mode==='api')return {...base,value:undefined,status:'api',source:'none',sampleAt:null,label:'API未接入'};
 const last=history.at(-1);
 if(!last){
  if(point.data_mode!=='mock')return {...base,value:undefined,status:'missing',source:'none',sampleAt:null,label:'文件暂无读数'};
  const n=hash(point.point_id),baseNumber=/湿度|humidity/i.test(point.metric_name)?48:/温度|temperature/i.test(point.metric_name)?24:point.unit==='%'?50:10;const value=point.value_type==='boolean'?n%2===0:point.value_type==='string'?'模拟状态':Math.round((baseNumber+Math.sin(now/60000+n)*.8)*10)/10;
  return {...base,value,status:'good',source:'mock',sampleAt:now,label:'模拟生成'};
 }
 const sampleAt=parseTime(last.collected_at),value=readingValue(last,point);let status:PointView['status']=last.quality==='good'?'good':last.quality==='bad'?'bad':'unknown';
 if(status==='good'&&point.stale_after_s&&now-sampleAt>Number(point.stale_after_s)*1000)status='stale';
 return {...base,value,status,source:last.source_kind as 'real'|'mock',sampleAt,label:point.data_mode==='mock'?'模拟样本':last.source_kind==='real'?'文件快照 · 真实标记':'文件快照 · 模拟'};
}
export function energySummary(bundle:Bundle,ids:Set<string>){
 const eligible=bundle.rows.points.filter(p=>ids.has(p.device_id)&&p.unit==='kWh'&&p.value_type==='number'&&['sum','delta'].includes(p.aggregation));
 let real=0,mock=0,valid=0,realCount=0,mockCount=0;const excluded:string[]=[];let from=Infinity,to=-Infinity;
 for(const p of eligible){const rows=bundle.rows.readings.filter(r=>r.point_id===p.point_id).slice().sort((a,b)=>parseTime(a.collected_at)-parseTime(b.collected_at));
  if(p.data_mode==='api'||!rows.length||rows.some(r=>r.quality!=='good')||new Set(rows.map(r=>r.source_kind)).size!==1||(p.aggregation==='delta'&&rows.length<2)){excluded.push(p.point_id);continue}
  const values=rows.map(r=>Number(r.value_number));if(p.aggregation==='delta'&&values.some((v,i)=>i>0&&v<values[i-1])){excluded.push(p.point_id);continue}
  const value=p.aggregation==='delta'?values.at(-1)!-values[0]:values.reduce((a,b)=>a+b,0);if(rows[0].source_kind==='real'){real+=value;realCount++}else{mock+=value;mockCount++}valid++;
  from=Math.min(from,parseTime(rows[0].collected_at));to=Math.max(to,parseTime(rows.at(-1)!.collected_at));
 }
 return {eligible:eligible.length,valid,real:realCount?real:null,mock:mockCount?mock:null,excluded,from:Number.isFinite(from)?from:null,to:Number.isFinite(to)?to:null};
}
export const STORAGE_KEY='smart-campus-data-v1';
interface Saved {version:1;current:Snapshot|null;previous:Snapshot|null}
function checkSnapshot(value:unknown):value is Snapshot {
 if(!value||typeof value!=='object')return false;const s=value as Snapshot;
 if(s.version!==1||typeof s.appliedAt!=='string'||typeof s.demo!=='boolean'||!Array.isArray(s.files)||!s.files.every(x=>typeof x==='string')||!s.bindings||!s.rows)return false;
 for(const map of [s.bindings.spaces,s.bindings.devices])if(!map||typeof map!=='object'||Array.isArray(map)||!Object.values(map).every(v=>typeof v==='string'))return false;
 for(const table of ['spaces','devices','points','readings','alarms','sources','mappings'] as const)if(!Array.isArray(s.rows[table])||s.rows[table].length>20000||!s.rows[table].every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.values(r).every(v=>typeof v==='string')))return false;
 try{parseTime(s.appliedAt);return !validateBundle(s).some(i=>i.level==='error')}catch{return false}
}
export function readSaved(storage:Pick<Storage,'getItem'>):{saved:Saved;error:string}{
 const empty:Saved={version:1,current:null,previous:null};try{const raw=storage.getItem(STORAGE_KEY);if(!raw)return {saved:empty,error:''};if(raw.length>4_000_000)throw Error();const value=JSON.parse(raw);if(value.version!==1||(value.current!==null&&!checkSnapshot(value.current))||(value.previous!==null&&!checkSnapshot(value.previous)))throw Error();return {saved:value,error:''}}catch{return {saved:empty,error:'本地快照无法校验，未自动加载。请重新导入有效文件。'}}
}
export function writeSaved(storage:Pick<Storage,'setItem'>,current:Snapshot|null,previous:Snapshot|null){const text=JSON.stringify({version:1,current,previous});if(text.length>4_000_000)throw Error('快照超过本地400万字符上限，请缩小导入范围');try{storage.setItem(STORAGE_KEY,text)}catch{throw Error('浏览器存储不可用或空间不足，本次数据未应用')}}
export const statusText:Record<PointView['status'],string>={good:'有效',bad:'质量异常',unknown:'质量未知',stale:'已过期',missing:'缺失',api:'未接入'};
