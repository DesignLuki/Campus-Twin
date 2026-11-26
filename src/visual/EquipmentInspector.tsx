import type {State,Action} from '../state';
import assets from '../../public/visual-assets-v9.json';
import {devices} from '../domain';
import {DeviceReadings} from '../data/DataViews';
import type {Bundle} from '../data/types';
export function EquipmentInspector({state,dispatch,components,bundle,now}:{state:State;dispatch:(a:Action)=>void;components:{id:string;label:string}[];bundle:Bundle;now:number}){
 const asset=assets.find(a=>a.id===state.inspect),device=devices.get(state.inspect??'');
 return <div className="inspection-panels"><section className="inspection-card"><span className="eyebrow">EQUIPMENT EXPLORER</span><h2>{asset?.label??device?.type??'设备独立查看'}</h2><p>{state.inspect}</p><div className="inspection-status">{state.partsExploded?'拆解状态':'装配状态'} · {components.length} 个部件</div><div className="component-list">{components.map(p=><button key={p.id} data-component={p.id} className={state.part===p.id?'selected':''} onClick={()=>dispatch({type:'component',id:p.id})}><span>{p.label}</span><span>↗</span></button>)}</div></section><section className="inspection-card"><h2>设备档案</h2><dl><dt>所属空间</dt><dd>{state.room}</dd><dt>当前部件</dt><dd>{components.find(p=>p.id===state.part)?.label??'点击模型或左侧部件'}</dd>{asset?.dimensions_m&&<><dt>外形尺寸</dt><dd>600 × 1000 × 2000 mm</dd></>}</dl>{device?<DeviceReadings modelId={device.id} bundle={bundle} now={now}/>:<p className="inspection-note">可视资产，尚未绑定业务测点。</p>}<p className="inspection-note">拖动旋转 · 滚轮缩放<br/>部件结构为虚构展示方案</p></section></div>
}
