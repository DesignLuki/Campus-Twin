import visualAssets from '../../public/visual-assets-v9.json';
import {useEffect,useState,type ReactNode} from 'react';
import {data,type Room} from '../domain';
import type {Action,State} from '../state';
import type {Bundle} from '../data/types';
import {deviceBinding,mappedArea} from '../data/validate';
import {DeviceReadings} from '../data/DataViews';
import {scopeMetrics,seriesColors,monthlyDemo} from './metrics';

function AnimatedNumber({value,digits=0}:{value:number;digits?:number}){
 const [display,setDisplay]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches?value:0);
 useEffect(()=>{let frame=0;const media=matchMedia('(prefers-reduced-motion: reduce)'),start=performance.now();
  const stop=()=>{cancelAnimationFrame(frame);setDisplay(value)};
  const tick=(now:number)=>{const t=Math.max(0,Math.min(1,(now-start)/1150));setDisplay(value*(1-Math.pow(1-t,3)));if(t<1)frame=requestAnimationFrame(tick)};
  if(media.matches)stop();else frame=requestAnimationFrame(tick);media.addEventListener('change',stop);
  return()=>{cancelAnimationFrame(frame);media.removeEventListener('change',stop)};
 },[value]);
 return <span className="animated-number" aria-label={value.toLocaleString('zh-CN',{maximumFractionDigits:digits})}>{display.toLocaleString('zh-CN',{minimumFractionDigits:0,maximumFractionDigits:digits})}</span>
}
function SolidPie({values,colors}:{values:number[];colors:string[]}){
 const total=values.reduce((a,b)=>a+b,0);let angle=-Math.PI/2;
 const point=(a:number,depth=0)=>[90+77*Math.cos(a),79+47*Math.sin(a)+depth];
 const trace=(a:number,b:number,depth=0)=>{const n=Math.max(2,Math.ceil((b-a)/.04)+1);return Array.from({length:n},(_,i)=>point(a+(b-a)*i/(n-1),depth))};
 const path=(points:number[][])=>'M'+points.map(p=>p.map(v=>v.toFixed(3)).join(',')).join('L')+'Z';
 const slices=values.map((v,i)=>{const from=angle;angle+=total?v/total*Math.PI*2:0;return {from,to:angle,v,color:colors[i]}});
 return <svg className="donut solid-pie" viewBox="0 0 180 180" role="img" aria-label={`设备分布图，共 ${total} 台`}>
  <ellipse cx="90" cy="102" rx="80" ry="50" fill="#091a29" opacity=".45"/>
  {!total?<ellipse cx="90" cy="88" rx="77" ry="47" fill="#526777"/>:<>
   {slices.filter(s=>s.v>0).map((s,i)=><path key={'base'+i} d={path([[90,97],...trace(s.from,s.to,18)])} fill={s.color} style={{filter:'brightness(.58)'}}/>)}
   {slices.filter(s=>s.v>0).flatMap((s,i)=>[0,Math.PI*2].map(offset=>{const a=Math.max(s.from,offset),b=Math.min(s.to,offset+Math.PI);return b>a?<path key={`side${i}-${offset}`} d={path([...trace(a,b),...trace(a,b,18).reverse()])} fill={s.color} style={{filter:'brightness(.70)'}}/>:null}))}
   {slices.filter(s=>s.v>0).map((s,i)=><path className="pie-top" key={'top'+i} d={path([[90,79],...trace(s.from,s.to)])} fill={s.color} stroke="#c8dbe4" strokeOpacity=".32" strokeWidth=".55"><title>{s.v} 台 · {(s.v/total*100).toFixed(1)}%</title></path>)}
  </>}
 </svg>
}

function Icon({kind}:{kind:number}){
 const art=[
  <><path fill="#367896" d="m3 20 13-7 13 7-13 8z"/><path fill="#559cb6" d="m3 15 13-7 13 7-13 8z"/><path fill="#a1e0ee" d="m3 10 13-7 13 7-13 8z"/><path fill="#e9b36c" d="m12 10 4-2 4 2-4 2z"/></>,
  <><path fill="#4381a0" d="m3 15 7-3 6 3v12l-7 2-6-3z"/><path fill="#90d4e8" d="m13 5 9-3 7 4-9 4z"/><path fill="#508daa" d="m13 5 7 5v18l-7-3z"/><path fill="#2c617e" d="m20 10 9-4v18l-9 4z"/><path stroke="#b8ebf4" d="m23 12 3-1m-3 5 3-1m-3 5 3-1"/><path stroke="#f5c685" d="M6 17v3m4-3v3"/></>,
  <><path fill="#376e89" d="m2 17 15-10 13 7-15 12z"/><path fill="#75b6ca" d="m2 14 15-10 13 7-15 12z"/><path stroke="#d3f1ee" d="m8 14 5 3 9-7m-6 5 4 2"/><path stroke="#f1b875" d="m4 23 10 5m-11-7 1 3m9 2 2 3"/></>,
  <><path fill="#376e89" d="m3 6 24-2 3 2v16l-24 3-3-2z"/><path fill="#173e54" stroke="#8fcedd" d="m5 8 22-2v14L5 23z"/><path stroke="#f3bc75" d="m8 16 4-.5 2-4 3 6 2-4 5-.6"/><path fill="#81bbcf" d="m13 24 5-.6v3l5-.5v2l-15 1.6v-2l5-.6z"/></>
 ];
 return <svg className="asset-glyph" viewBox="0 0 32 32" aria-hidden="true" strokeLinejoin="round" strokeLinecap="round" strokeWidth="1.4">{art[kind]}</svg>
}
function Panel({title,children,className='',note,action}:{title:string;children:ReactNode;className?:string;note?:string;action?:ReactNode}){return <section className={'viz-panel '+className}><h2><i/>{title}{note&&<small>{note}</small>}{action}</h2><div className="panel-body">{children}</div></section>}
function Donut({values,center,colors=seriesColors,pie=false}:{values:number[];center:string;colors?:string[];pie?:boolean}){
 if(pie)return <SolidPie values={values} colors={colors}/>;
 const total=values.reduce((a,b)=>a+b,0),circumference=2*Math.PI*70;let a=0;
 return <svg className="donut" viewBox="0 0 180 180" role="img" aria-label={`${center}分布图`}>{values.map((value,i)=>{const dash=(total?value/total:0)*circumference,offset=a;a+=dash;return <circle key={i} cx="90" cy="90" r="70" fill="none" stroke={colors[i]} strokeWidth="31" strokeDasharray={`${dash} ${circumference-dash}`} strokeDashoffset={-offset} transform="rotate(-90 90 90)"/>})}{!total&&<circle cx="90" cy="90" r="70" fill="none" stroke="#526777" strokeWidth="30"/>}<text x="90" y="98" textAnchor="middle">{center}</text></svg>
}
function Legend({names,values,unit,colors=seriesColors}:{names:string[];values:number[];unit:string;colors?:string[]}){return <div className="chart-legend">{names.map((name,i)=><div key={name}><i style={{background:colors[i]}}/><span>{name}</span><b><AnimatedNumber value={values[i]} digits={0}/>{unit}</b></div>)}</div>}
function Monthly({actual,plan}:{actual:number[];plan:number[]}){const max=Math.max(...actual,...plan,1)*1.22,unit=max>=10000?10000:1;return <><div className="chart-key"><span>{unit===10000?'万 kWh':'kWh'}</span><span><i style={{background:seriesColors[0]}}/>模拟实际</span><span><i style={{background:seriesColors[1]}}/>模拟计划</span></div><svg className="bar-chart" viewBox="0 0 400 155" role="img" aria-label="模拟月度用能与计划对比">{[0,1,2,3].map(i=><g key={i}><line x1="39" y1={125-i*36} x2="391" y2={125-i*36} stroke="#6a82924d" strokeDasharray="3 3"/><text x="30" y={129-i*36} textAnchor="end">{(max*i/3/unit).toFixed(unit===1?0:1)}</text></g>)}{actual.map((v,i)=><g key={i}><rect x={58+i*85} y={125-v/max*108} width="25" height={v/max*108} rx="2" fill="#75a3c6"/><rect x={86+i*85} y={125-plan[i]/max*108} width="25" height={plan[i]/max*108} rx="2" fill="#e79852"/><text x={85+i*85} y="148" textAnchor="middle">{monthlyDemo.months[i]}</text></g>)}</svg></>}
export function Panels({state,selected,bundle,dispatch,now,onLedger,onData}:{state:State;selected:Room[];bundle:Bundle;dispatch:(a:Action)=>void;now:number;onLedger:()=>void;onData:()=>void}){
 const m=scopeMetrics(selected,bundle),isRoom=state.mode==='room',isGlobal=['city','campus'].includes(state.mode),prefix=isGlobal?'园区':state.mode==='building'?state.building+'楼':state.mode==='floor'?state.floor+'F':'房间';
 const scopeArea=isGlobal?18828:state.mode==='building'?data.buildings.find(b=>b.id===state.building)!.estimated_gross_floor_area:state.mode==='floor'?data.buildings.find(b=>b.id===state.building)!.width*data.buildings.find(b=>b.id===state.building)!.depth:m.area;
 const ledger=mappedArea(isRoom?state.room:state.mode==='floor'?`${state.building}-F${String(state.floor).padStart(2,'0')}`:state.mode==='building'?state.building:'CAMPUS',bundle);
 const costTotal=m.costs.reduce((a,b)=>a+b,0),costs=m.costs.map(v=>costTotal?v/costTotal*100:0),costColors=[seriesColors[1],seriesColors[2],seriesColors[0],seriesColors[3]];
 return <>
 <aside key={state.mode+state.building+state.floor+state.room+'left'} className="viz-column viz-left">
  <Panel title={prefix+'资产概况'} className="asset-panel" action={<button className="ledger-open" onClick={onLedger}>空间导航 ↗</button>}><div className="kpi-grid">{[
   ['资产总数',m.ds.length,'',0], [isGlobal?'楼宇数量':isRoom?'当前楼层':'空间数量',isGlobal?3:isRoom?state.floor:selected.length,isGlobal?'栋':isRoom?'F':'间',1],
   [ledger?'台账面积':isRoom?'房间面积':'建筑面积',Number((ledger?.value??scopeArea).toFixed(2)),'m²',2],['模拟在线',Math.max(0,m.ds.length-(isGlobal||state.building==='A'?1:0)),'',3]
  ].map(([label,value,unit,icon])=><div className="kpi" key={String(label)}><Icon kind={Number(icon)}/><div><span>{label}</span><b><AnimatedNumber value={Number(value)} digits={unit==='m²'?2:0}/><em>{unit}</em></b></div></div>)}</div></Panel>
  <Panel title="空间使用占比"><div className="chart-row"><Donut values={m.usage} center="空间"/><Legend names={['办公','会议','培训','配套']} values={m.usage} unit="%"/></div></Panel>
  <Panel title="月度用能统计" note="模拟"><Monthly actual={m.monthly.actual} plan={m.monthly.plan}/></Panel>
 </aside>
 <aside key={state.mode+state.building+state.floor+state.room+'right'} className="viz-column viz-right">
  <Panel title="运行成本占比" note="模拟"><div className="cost-bar">{costs.map((v,i)=><span key={i} style={{width:v+'%',background:costColors[i]}}><AnimatedNumber value={v}/>%</span>)}</div><div className="cost-legend">{['能源','维护','物业','其他'].map((v,i)=><div key={v}><i style={{background:costColors[i]}}/>{v}<b><AnimatedNumber value={costs[i]}/>%</b></div>)}</div></Panel>
  <Panel title={isRoom?'房间设备':'设备类型分布'}>{isRoom?<div className="device-picker">{m.ds.map(d=><button className={state.device===d.id?'selected':''} key={d.id} data-device={d.id} onClick={()=>dispatch({type:'device',id:d.id})}><Icon kind={d.id.includes('DSP')?3:0}/><span>{d.type}<small>{d.id}</small></span><span>›</span></button>)}{visualAssets.filter(a=>a.room_id===state.room).map(a=><button key={a.id} data-visual-asset={a.id} onClick={()=>dispatch({type:'inspect',id:a.id})}><Icon kind={0}/><span>{a.label}<small>独立查看 / 部件拆解</small></span><span>↗</span></button>)}</div>:<><div className="chart-row"><Donut values={m.deviceTypes} center="设备" colors={costColors} pie/><Legend names={['环境传感','交互屏','门禁','占用传感']} values={m.deviceTypes} unit="" colors={costColors}/></div><div className="chart-total"><AnimatedNumber value={m.ds.length}/> 台</div></>}</Panel>
  <Panel title="告警列表" note="文件快照"><table className="alarm-table"><thead><tr><th>时间</th><th>设备</th><th>状态</th></tr></thead><tbody>{m.alarms.slice(0,3).map(a=><tr key={a.alarm_id} onClick={()=>{const id=deviceBinding(a.device_id,bundle);if(id)dispatch({type:'device',id})}}><td>{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(a.started_at))}</td><td><button title={a.title}>{a.device_id.replace('A-903-','903 · ')}<small>{a.source_kind==='mock'?'模拟':'真实标记'}</small></button></td><td className={'status-'+a.status}>{a.status==='resolved'?'已恢复':a.status==='acknowledged'?'已确认':'待处理'}</td></tr>)}</tbody></table>{!m.alarms.length&&<div className="no-alarms">当前范围暂无导入告警</div>}<div className="panel-foot">{m.alarms.filter(a=>a.status!=='resolved').length} 条未恢复 · {m.businessDevices.length} 台业务设备 / {m.points.length} 测点 <button className="data-detail-link" onClick={onData}>明细 ↗</button></div></Panel>
 </aside>
 {state.device&&<div className="device-detail"><div className="detail-head"><span>设备详情 · {state.device}</span><button aria-label="关闭设备详情" onClick={()=>dispatch({type:'room',id:state.room})}>×</button></div><DeviceReadings modelId={state.device} bundle={bundle} now={now}/></div>}
 </>;
}
