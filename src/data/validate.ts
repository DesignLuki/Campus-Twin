import {data as spatial,floors,devices as modelDevices} from '../domain';
import {emptyRows,tables,primary,type Bundle,type Rows,type Row,type Issue,type Preview,type Snapshot,type Bindings,type Table} from './types';
import {parseTime} from './time';
export const baseSpaces=new Map<string,{type:string;parent:string;name:string}>([
 ['CITY-SH',{type:'city',parent:'',name:'上海市'}],['CAMPUS',{type:'campus',parent:'CITY-SH',name:'智慧园区'}],
 ...spatial.buildings.map(b=>[b.id,{type:'building',parent:'CAMPUS',name:b.name}] as const),
 ...spatial.floors.map(f=>[f.id,{type:'floor',parent:f.building,name:`${f.building}楼 ${f.floor}F`}] as const),
 ...spatial.rooms.map(r=>[r.id,{type:'room',parent:r.floor_id,name:r.name}] as const)
]);
export const numberValue=(raw:string)=>{if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())||!Number.isFinite(Number(raw)))throw Error('必须是有限数值');return Number(raw)};
export function readingValue(r:Row,p:Row):number|string|boolean|undefined {
 if(p.value_type==='number')return r.value_number?.trim()?numberValue(r.value_number):undefined;
 if(p.value_type==='boolean'){if(!r.value_boolean)return undefined;if(!/^(true|false)$/i.test(r.value_boolean))throw Error('布尔值只接受 TRUE / FALSE');return r.value_boolean.toLowerCase()==='true'}
 return r.value_text!==''?r.value_text:undefined;
}
export function spaceBinding(id:string,b:Bundle):string|undefined{return Object.hasOwn(b.bindings.spaces,id)?b.bindings.spaces[id]:(baseSpaces.has(id)?id:undefined)}
export function deviceBinding(id:string,b:Bundle):string|undefined{return Object.hasOwn(b.bindings.devices,id)?b.bindings.devices[id]:(modelDevices.has(id)?id:undefined)}
export function validateBundle(bundle:Bundle,now=Date.now()):Issue[]{
 const issues:Issue[]=[];const add=(t:Table,r:Row,f:string,m:string,level:Issue['level']='error')=>issues.push({level,table:r._sheet||t,row:r._row||'',field:f,message:m});
 const required=(t:Table,r:Row,fields:string[])=>{for(const f of fields)if(!r[f]?.trim())add(t,r,f,'必填项为空')};
 const choice=(t:Table,r:Row,f:string,values:string[],optional=false)=>{if(!(optional&&!r[f])&&!values.includes(r[f]))add(t,r,f,`须为 ${values.join(' / ')}`)};
 const numeric=(t:Table,r:Row,f:string,integer=false,positive=false)=>{if(!r[f])return;try{const n=numberValue(r[f]);if(n<0||(positive&&n<=0)||(integer&&!Number.isInteger(n)))throw Error();}catch{add(t,r,f,positive?'须为正数':integer?'须为非负整数':'须为非负有限数值')}};
 const time=(t:Table,r:Row,f:string)=>{if(!r[f])return;try{const ts=parseTime(r[f]);if(ts>now+300000)add(t,r,f,'时间晚于当前时间，请核对采集时区','warning')}catch(e){add(t,r,f,String((e as Error).message))}};
 const index=<T extends Row>(rows:T[],key:string)=>new Map(rows.map(r=>[r[key],r]));
 const spaceRows=index(bundle.rows.spaces,'space_id'),deviceRows=index(bundle.rows.devices,'device_id'),points=index(bundle.rows.points,'point_id'),sources=index(bundle.rows.sources,'source_id');
 for(const t of tables){if(bundle.rows[t].length>20000)issues.push({level:'error',table:t,row:'',field:'rows',message:'合并后每类表最多20000条记录，请缩小范围或整份替换'});const keys=new Set<string>();for(const r of bundle.rows[t]){
  required(t,r,['record_kind',primary[t]]);if(r.record_kind!=='data')add(t,r,'record_kind','有效快照只接受 data 记录');
  let k=r[primary[t]];if(t==='readings'){try{k+='@'+parseTime(r.collected_at)}catch{k+='@'+r.collected_at}}
  if(keys.has(k))add(t,r,primary[t],`编号或测点采样时间重复：${k}`);keys.add(k);
 }}
 const spaceType=(id:string)=>spaceRows.get(id)?.space_type||baseSpaces.get(id)?.type;
 const parentOf=(id:string)=>spaceRows.get(id)?.parent_id??baseSpaces.get(id)?.parent;
 const owner=(id:string)=>deviceRows.get(id)?.space_id??modelDevices.get(id)?.room_id;
 const deviceExists=(id:string)=>deviceRows.has(id)||modelDevices.has(id);
 const expected:Record<string,string>={campus:'city',building:'campus',floor:'building',room:'floor'};
 const usedSpaces=new Set<string>();
 for(const r of bundle.rows.spaces){
  required('spaces',r,['space_type','name','provenance']);choice('spaces',r,'space_type',['city','campus','building','floor','room']);choice('spaces',r,'provenance',['real','reference','inferred']);
  if(r.space_type==='city'&&r.parent_id)add('spaces',r,'parent_id','城市不能指定上级');
  if(r.space_type!=='city'&&spaceType(r.parent_id)!==expected[r.space_type])add('spaces',r,'parent_id','上级不存在或空间层级不匹配');
  if(r.space_type==='floor'){required('spaces',r,['floor_no']);if(!/^-?\d+$/.test(r.floor_no))add('spaces',r,'floor_no','楼层须为整数')}
  numeric('spaces',r,'area_m2');numeric('spaces',r,'capacity',true);
  let current=r.space_id;const visited=new Set<string>();for(let i=0;current;i++){if(visited.has(current)||i>5){add('spaces',r,'parent_id','空间父级循环或层级过深');break}visited.add(current);current=parentOf(current)||''}
  const mapped=spaceBinding(r.space_id,bundle);if(mapped){if(usedSpaces.has(mapped))add('spaces',r,'space_id','同一三维空间不能绑定两条业务空间');usedSpaces.add(mapped);const target=baseSpaces.get(mapped);if(!target||target.type!==r.space_type)add('spaces',r,'space_id','绑定模型的空间类型不匹配');else if(r.parent_id&&spaceBinding(r.parent_id,bundle)!==target.parent)add('spaces',r,'parent_id','绑定后的父子空间关系不一致');
   if(r.space_type==='floor'&&floors.has(mapped)&&Number(r.floor_no)!==floors.get(mapped)!.floor)add('spaces',r,'floor_no','楼层序号与绑定模型不一致');
  }else add('spaces',r,'space_id','仅保留空间台账，尚未绑定三维空间','warning');
 }
 const usedModels=new Set<string>();
 for(const r of bundle.rows.devices){required('devices',r,['space_id','name','device_type','provenance']);choice('devices',r,'provenance',['real','reference','inferred']);
  if(!spaceType(r.space_id))add('devices',r,'space_id','所属空间不存在');const target=deviceBinding(r.device_id,bundle);
  if(target){if(!modelDevices.has(target))add('devices',r,'device_id','绑定的三维设备不存在');else if(spaceBinding(r.space_id,bundle)!==modelDevices.get(target)!.room_id)add('devices',r,'space_id','设备模型不属于绑定后的房间');if(usedModels.has(target))add('devices',r,'device_id','同一三维设备不能绑定两条业务设备');usedModels.add(target)}
  else add('devices',r,'device_id','仅保留设备台账，尚未绑定三维设备','warning');
 }
 for(const r of bundle.rows.sources){required('sources',r,['name','source_type','endpoint','source_timezone']);choice('sources',r,'source_type',['file','http','websocket','mqtt']);choice('sources',r,'source_timezone',['Asia/Shanghai','UTC','offset_in_value']);choice('sources',r,'auth_type',['none','bearer','api_key','other'],true);numeric('sources',r,'refresh_s',false,true);
  if(r.source_type==='http'&&!r.refresh_s)add('sources',r,'refresh_s','HTTP轮询须填写刷新秒数');
  if(r.auth_type&&r.auth_type!=='none'&&!/^[A-Z_][A-Z0-9_]*$/.test(r.credential_ref||''))add('sources',r,'credential_ref','填写凭据环境变量名，例如 IOT_API_TOKEN，不填写密钥值');
 }
 for(const r of bundle.rows.points){required('points',r,['device_id','metric_name','value_type','data_mode','aggregation','semantics']);choice('points',r,'value_type',['number','boolean','string']);choice('points',r,'data_mode',['mock','file','api']);choice('points',r,'aggregation',['none','sum','avg','delta']);choice('points',r,'semantics',['instant','counter','state']);
  if(!deviceExists(r.device_id))add('points',r,'device_id','设备不存在');
  if(r.value_type==='number')required('points',r,['unit']);
  if(r.data_mode!=='mock'){const source=sources.get(r.source_id);if(!source)add('points',r,'source_id','数据源不存在');else if((r.data_mode==='file')!==(source.source_type==='file'))add('points',r,'source_id','测点模式与数据源类型不一致')}
  numeric('points',r,'stale_after_s',false,true);if(r.data_mode==='api'){required('points',r,['stale_after_s']);add('points',r,'data_mode','API配置仅保存，本阶段不连接接口','warning')}
  if(r.aggregation!=='none'&&r.value_type!=='number')add('points',r,'aggregation','数值统计只适用于 number 测点');
  if(r.semantics==='counter'&&r.value_type!=='number')add('points',r,'semantics','累计量必须使用 number');
  if(r.aggregation==='delta'&&r.semantics!=='counter')add('points',r,'aggregation','delta 仅用于 counter 累计量');
  if(r.semantics==='counter'&&['sum','avg'].includes(r.aggregation))add('points',r,'aggregation','累计量不可直接求和或平均，请使用 delta 或 none');
  if(/温度|temperature/i.test(r.metric_name)&&!['°C','℃','°F','K'].includes(r.unit))add('points',r,'unit','温度单位不匹配，请使用 °C / ℃ / °F / K');
  if(/湿度|humidity/i.test(r.metric_name)&&r.unit!=='%')add('points',r,'unit','相对湿度单位须为 %');
 }
 for(const r of bundle.rows.readings){required('readings',r,['collected_at','quality','source_kind']);choice('readings',r,'quality',['good','bad','unknown']);choice('readings',r,'source_kind',['real','mock']);time('readings',r,'collected_at');
  const p=points.get(r.point_id);if(!p){add('readings',r,'point_id','测点不存在');continue}
  const activeField=p.value_type==='number'?'value_number':p.value_type==='boolean'?'value_boolean':'value_text';for(const field of ['value_number','value_text','value_boolean'])if(field!==activeField&&r[field])add('readings',r,field,'与测点值类型不符，请只填写对应的一列');
  try{const value=readingValue(r,p);if(value===undefined&&r.quality!=='bad')add('readings',r,activeField,'读数缺失；0 和 FALSE 是有效值');if(typeof value==='number'&&p.unit==='%'&&(value<0||value>100))add('readings',r,activeField,'百分数须在0–100范围')}catch(e){add('readings',r,activeField,(e as Error).message)}
  if(p.data_mode==='mock'&&r.source_kind==='real')add('readings',r,'source_kind','模拟测点不能标为真实来源；请改为 file 模式');
 }
 for(const r of bundle.rows.alarms){required('alarms',r,['device_id','severity','title','started_at','status','source_kind']);choice('alarms',r,'severity',['info','warning','critical']);choice('alarms',r,'status',['active','acknowledged','resolved']);choice('alarms',r,'source_kind',['real','mock']);time('alarms',r,'started_at');time('alarms',r,'resolved_at');
  if(!deviceExists(r.device_id))add('alarms',r,'device_id','设备不存在');if(r.point_id&&points.get(r.point_id)?.device_id!==r.device_id)add('alarms',r,'point_id','告警测点不属于该设备');
  if(r.status==='resolved'){required('alarms',r,['resolved_at']);try{if(parseTime(r.resolved_at)<parseTime(r.started_at))add('alarms',r,'resolved_at','恢复时间早于发生时间')}catch{/* time fields already reported */}}
  else if(r.resolved_at)add('alarms',r,'resolved_at','未恢复的告警不能填写恢复时间');
 }
 for(const r of bundle.rows.mappings){const p=points.get(r.point_id);required('mappings',r,['external_device_id','record_path','value_path','time_path','time_format']);choice('mappings',r,'time_format',['iso8601','unix_s','unix_ms','local_datetime']);if(!p||p.data_mode!=='api')add('mappings',r,'point_id','接口映射只适用于已有 api 测点');if(p?.value_type==='number')for(const f of ['scale','offset']){required('mappings',r,[f]);try{numberValue(r[f])}catch{add('mappings',r,f,'请填写有限数值')}}}
 // Ensure live bindings referenced by built-in-device points are not ambiguous with imported aliases.
 for(const p of bundle.rows.points){const target=deviceBinding(p.device_id,bundle);if(!owner(p.device_id))add('points',p,'device_id','设备归属缺失');if(target&&modelDevices.has(p.device_id)&&usedModels.has(target)&&!deviceRows.has(p.device_id))add('points',p,'device_id','模型设备已被其他业务编号占用，请统一测点设备编号')}
 return issues;
}
function mergeKey(table:Table,r:Row){if(table==='readings'){try{return r.point_id+'@'+parseTime(r.collected_at)}catch{return r.point_id+'@'+r.collected_at}}return r[primary[table]]}
export function previewImport(incoming:Rows,current:Snapshot|null,bindings:Bindings,files:string[],replace=false,demo=false):Preview {
 const rows=emptyRows(),issues:Issue[]=[];let skipped=0,added=0,updated=0,count=0;
 for(const t of tables){const map=new Map<string,Row>((replace?[]:current?.rows[t]||[]).map(r=>[mergeKey(t,r),r]));const seen=new Set<string>();
  for(const r of incoming[t]){if(r.record_kind==='example'){skipped++;continue}count++;const k=mergeKey(t,r);if(seen.has(k))issues.push({level:'error',table:r._sheet||t,row:r._row||'',field:primary[t],message:`本次导入中编号或采样时间重复：${k}`});seen.add(k);if(map.has(k))updated++;else added++;map.set(k,{...r})}
  rows[t]=[...map.values()];
 }
 const mergedBindings={spaces:{...(!replace&&current?.bindings.spaces||{}),...bindings.spaces},devices:{...(!replace&&current?.bindings.devices||{}),...bindings.devices}};
 const bundle={rows,bindings:mergedBindings,files:[...new Set([...(replace?[]:current?.files||[]),...files])],demo:demo||(!replace&&!!current?.demo)};
 issues.push(...validateBundle(bundle));if(!count)issues.push({level:'warning',table:'导入批次',row:'',field:'record_kind',message:skipped?'只有 example 示例行，已跳过；没有可应用的 data 记录':'没有可应用的数据记录'});
 return {bundle,issues,added,updated,skipped,incoming:count};
}
export function boundScope(bundle:Bundle,modelRoomIds:Set<string>):Set<string>{
 const ids=new Set<string>();for(const d of spatial.devices)if(modelRoomIds.has(d.room_id))ids.add(d.id);
 for(const d of bundle.rows.devices)if(modelRoomIds.has(spaceBinding(d.space_id,bundle)||''))ids.add(d.device_id);
 return ids;
}
export function modelDeviceBusinessIds(modelId:string,bundle:Bundle){return [...new Set([modelId,...bundle.rows.devices.filter(d=>deviceBinding(d.device_id,bundle)===modelId).map(d=>d.device_id)])]}
export function spaceOptions(type:string){return [...baseSpaces].filter(([,s])=>s.type===type)}
export function modelOptions(spaceId:string,bundle:Bundle){const id=spaceBinding(spaceId,bundle);return spatial.devices.filter(d=>!id||d.room_id===id)}
export function mappedArea(id:string,bundle:Bundle|null){const r=bundle?.rows.spaces.find(r=>spaceBinding(r.space_id,bundle)===id&&r.area_m2!=='');return r?{value:Number(r.area_m2),provenance:r.provenance}:null}

