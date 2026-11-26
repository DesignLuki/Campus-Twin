import type {Bundle,Row} from './types';
import {pointView,energySummary,statusText,type PointView} from './runtime';
import {modelDeviceBusinessIds,boundScope,deviceBinding} from './validate';
import {formatTime,parseTime} from './time';
const valueText=(v:PointView['value'])=>v===undefined?'—':typeof v==='boolean'?(v?'TRUE':'FALSE'):typeof v==='number'?Number(v.toFixed(3)).toLocaleString('zh-CN'):v;
function Trend({view}:{view:PointView}){
 if(view.point.value_type!=='number')return null;const history=view.history.slice(-20);if(history.length<2)return null;
 const valid=history.map((r,i)=>({i,y:r.value_number!==''&&r.quality==='good'?Number(r.value_number):null}));const ys=valid.flatMap(v=>v.y===null?[]:[v.y]);if(!ys.length)return null;const min=Math.min(...ys),max=Math.max(...ys),range=max-min||1;
 const segments:string[]=[];let current='';for(const p of valid){if(p.y===null){if(current)segments.push(current);current=''}else current+=`${p.i/(history.length-1)*220},${34-(p.y-min)/range*28} `}if(current)segments.push(current);
 return <div className="point-trend"><svg viewBox="0 0 220 40" role="img" aria-label={`${view.point.metric_name}最近${history.length}次文件采样趋势`}>{segments.map((p,i)=><polyline key={i} points={p} fill="none" stroke="currentColor" strokeWidth="1.5"/>)}</svg><small>{formatTime(parseTime(history[0].collected_at))} → 最近{history.length}次采样</small></div>
}
export function DeviceReadings({modelId,bundle,now}:{modelId:string;bundle:Bundle|null;now:number}){
 if(!bundle)return <p>尚未接入此设备的业务数据。</p>;const ids=modelDeviceBusinessIds(modelId,bundle),points=bundle.rows.points.filter(p=>ids.includes(p.device_id));
 if(!points.length)return <p>当前快照没有绑定此设备的测点。</p>;
 return <div className="point-list">{points.map(p=>{const view=pointView(p,bundle,now),source=bundle.rows.sources.find(s=>s.source_id===p.source_id);return <article className={`point-card quality-${view.status}`} key={p.point_id} data-point={p.point_id}><div className="point-title"><span>{p.metric_name}</span><b>{statusText[view.status]}</b></div><div className="point-value">{valueText(view.value)}<small>{p.unit==='1'?'':p.unit}</small></div><div className="source-label">{view.label}{source?` · ${source.name}`:''}</div><small className="point-time">{view.sampleAt!==null?formatTime(view.sampleAt)+' 北京时间':'无有效采集时间'}</small><small>{p.point_id} · {p.device_id}</small><Trend view={view}/></article>})}</div>;
}
export function DataSummary({bundle,modelRooms,now,onDevice}:{bundle:Bundle|null;modelRooms:Set<string>;now:number;onDevice:(id:string)=>void}){
 if(!bundle)return <section><h3>能耗与告警</h3><div className="empty-data"><span>—</span><p>尚未导入业务数据</p><small>从顶部“数据接入”选择Excel或CSV</small></div></section>;
 const ids=boundScope(bundle,modelRooms),points=bundle.rows.points.filter(p=>ids.has(p.device_id)),views=points.map(p=>pointView(p,bundle,now)),energy=energySummary(bundle,ids);
 const alarms=bundle.rows.alarms.filter(a=>ids.has(a.device_id)).sort((a,b)=>parseTime(b.started_at)-parseTime(a.started_at));const active=alarms.filter(a=>a.status!=='resolved');
 const business=new Set([...bundle.rows.devices.filter(d=>ids.has(d.device_id)).map(d=>d.device_id),...points.map(p=>p.device_id)]);
 return <>
  <section><h3>业务数据覆盖</h3><div className="row"><span>业务设备 / 测点</span><b>{business.size} / {points.length}</b></div><div className="row"><span>真实标记 / 模拟读数</span><b>{views.filter(v=>v.source==='real').length} / {views.filter(v=>v.source==='mock').length}</b></div><div className="row"><span>过期 / 异常 / 未接入</span><b>{views.filter(v=>v.status==='stale').length} / {views.filter(v=>['bad','unknown'].includes(v.status)).length} / {views.filter(v=>['missing','api'].includes(v.status)).length}</b></div><small>文件快照仅代表采集时刻，不计算实时在线率。</small></section>
  <section><h3>导入范围用电量</h3><div className="row"><span>真实标记</span><b>{energy.real===null?'—':energy.real.toFixed(2)} kWh</b></div><div className="row"><span>模拟</span><b>{energy.mock===null?'—':energy.mock.toFixed(2)} kWh</b></div>{energy.from!==null&&<small>{formatTime(energy.from)}<br/>至 {formatTime(energy.to!)} 北京时间</small>}<p>{energy.eligible?`${energy.valid}/${energy.eligible}个电量测点可计算；异常质量、混合来源或计数器回退不汇总。`:'当前范围没有可汇总的 kWh 测点。'}</p></section>
  <section><h3>导入告警 <span className="count">{active.length} 未恢复</span></h3>{alarms.slice(0,6).map((a:Row)=>{const target=deviceBinding(a.device_id,bundle);return <button key={a.alarm_id} className={`alarm-row alarm-${a.status}`} disabled={!target} onClick={()=>target&&onDevice(target)}><div><b>{a.title}</b><span>{a.source_kind==='real'?'真实标记':'模拟'}</span></div><small>{a.device_id} · {a.status==='resolved'?'已恢复':a.status==='acknowledged'?'已确认':'待处理'}</small><small>{formatTime(a.started_at)} 北京时间</small>{!target&&<small>设备未绑定模型</small>}</button>})}{!alarms.length&&<p>当前范围没有导入告警事件。</p>}<small>仅展示导入事件，不自行生成业务告警。</small></section>
 </>;
}
