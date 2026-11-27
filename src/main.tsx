import {useEffect,useReducer,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CampusScene} from './scene';
import {initial,reduce,type Mode} from './state';
import {data,buildings,rooms,floorRooms} from './domain';
import {DataHub} from './data/DataHub';
import {EquipmentInspector} from './visual/EquipmentInspector';
import {Panels} from './visual/Panels';
import {DataSummary} from './data/DataViews';
import sample from '../public/data/presentation-sample.json';
import {readSaved,writeSaved} from './data/runtime';
import {deviceBinding,validateBundle} from './data/validate';
import type {Snapshot,Preview} from './data/types';
import './data/style.css';
import './style.css';
import './visual/dashboard.css';
const modes:Mode[]=['city','campus','building','floor','room'];
declare global {interface Window {__twin:CampusScene|undefined}}
function App(){
 const [state,dispatch]=useReducer(reduce,initial,s=>location.hash==='#city'?{...s,mode:'city' as const}:s),[ready,setReady]=useState(false),[error,setError]=useState(''),[orbit,setOrbit]=useState(false),[search,setSearch]=useState(''),[ledgerOpen,setLedgerOpen]=useState(false),[dataDetails,setDataDetails]=useState(false),[motion,setMotion]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [loaded]=useState(()=>{try{return readSaved(localStorage)}catch{return {saved:{version:1 as const,current:null,previous:null},error:'浏览器存储不可用；三维浏览可用，数据保存暂不可用。'}}});
 const [snapshot,setSnapshot]=useState<Snapshot|null>(loaded.saved.current),[previous,setPrevious]=useState<Snapshot|null>(loaded.saved.previous),[canUndo,setCanUndo]=useState(loaded.saved.current!==null||loaded.saved.previous!==null),[notice,setNotice]=useState(loaded.error),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
 function applyData(preview:Preview){try{if(!preview.incoming||validateBundle(preview.bundle).some(i=>i.level==='error'))throw Error('数据校验失败，未应用');const next:Snapshot={...preview.bundle,version:1,appliedAt:new Date().toISOString()};writeSaved(localStorage,next,snapshot);setPrevious(snapshot);setSnapshot(next);setCanUndo(true);setNotice('已应用到本浏览器，可撤销上次应用。');return true}catch(e){setNotice((e as Error).message);return false}}
 function undoData(){try{writeSaved(localStorage,previous,snapshot);setSnapshot(previous);setPrevious(snapshot);setCanUndo(true);setNotice('已恢复上一个快照。')}catch(e){setNotice((e as Error).message)}}
 function clearData(){try{writeSaved(localStorage,null,snapshot);setPrevious(snapshot);setSnapshot(null);setCanUndo(true);setNotice('已清空导入快照，显示内置模拟样本；可撤销。')}catch(e){setNotice((e as Error).message)}}
 const displayBundle=snapshot??sample;
 const host=useRef<HTMLDivElement>(null),engine=useRef<CampusScene|null>(null);
 useEffect(()=>{if(!host.current)return;const scene=new CampusScene(host.current,dispatch,e=>{if(e)setError(e);else setReady(true)});engine.current=scene;window.__twin=scene;return()=>{scene.dispose();window.__twin=undefined}},[]);
 useEffect(()=>{engine.current?.setState(state);setOrbit(false)},[state]);
 useEffect(()=>setSearch(''),[state.building,state.floor]);
 useEffect(()=>{engine.current?.setAlarmDevices(displayBundle.rows.alarms.filter(a=>a.status!=='resolved').map(a=>deviceBinding(a.device_id,displayBundle)).filter((id):id is string=>!!id))},[snapshot,ready]);
 useEffect(()=>{if(ready)engine.current?.interior.updateSensor(displayBundle,state.device,now)},[displayBundle,state.device,now,ready]);
 const b=buildings.get(state.building)!,room=rooms.get(state.room)!;
 const selectedRooms=state.mode==='room'?[room]:state.mode==='floor'?floorRooms(b.id,state.floor):state.mode==='building'?data.rooms.filter(r=>r.building===b.id):data.rooms;
 const scopeTitle=state.mode==='campus'?'园区空间概况':state.mode==='building'?b.name:state.mode==='floor'?`${b.id}楼 · ${state.floor}F 空间索引`:`${room.id} · ${room.name}`;
 const roomList=floorRooms(b.id,state.floor).filter(r=>`${r.id} ${r.name}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="app visual-app">
  <div className="scene-backdrop"><div className="viewport" ref={host}/></div>
  <div className="atmosphere"/>
  <header className="visual-header"><div className="brand"><svg className="brand-symbol" viewBox="0 0 50 34" aria-hidden="true"><path fill="#f5a443" d="M16 3h19L17 30H0Z"/><path fill="#ef8d35" d="M29 18h21L42 30H21Z"/></svg><h1>Campus Twin</h1></div><span className="edition">{state.mode==='city'?'上海市':`上海市 / ${state.mode==='campus'?'园区总览':scopeTitle}`}</span><div className="header-actions"><DataHub snapshot={snapshot} canUndo={canUndo} onApply={applyData} onUndo={undoData} onClear={clearData} notice={notice}/><button className="motion-toggle" aria-pressed={motion} disabled={!ready} onClick={()=>{const next=!motion;setMotion(next);if(engine.current?.night)engine.current.night.enabled=next}}>{motion?'暂停光效':'播放光效'}</button></div></header>
  <nav className="visual-nav" aria-label="空间层级">{modes.map((mode,i)=><button data-mode={mode} key={mode} disabled={!ready} className={state.mode===mode?'active':''} onClick={()=>dispatch({type:'navigate',mode})}>{['城市','园区','楼宇','楼层','房间'][i]}</button>)}</nav>
  {state.inspect?<EquipmentInspector state={state} dispatch={dispatch} components={(engine.current?.objects.get(state.inspect)?.children??[]).filter(p=>p.userData.component_id).map(p=>({id:p.userData.component_id,label:p.userData.component_label}))} bundle={displayBundle} now={now}/>:<Panels key={String(ready)} state={state} selected={selectedRooms} bundle={displayBundle} dispatch={dispatch} now={now} onLedger={()=>setLedgerOpen(true)} onData={()=>setDataDetails(true)}/>}
  {!['city','campus'].includes(state.mode)&&<div className="scope-trail"><button onClick={()=>setLedgerOpen(true)}>{b.id} 楼 / {state.mode==='building'?'楼宇总览':`${state.floor}F`}{state.mode==='room'?` / ${room.id} ${room.name}`:''}<span>切换空间 ⌄</span></button></div>}
  {state.mode==='city'&&<div className="map-source terrain-credit"><a href="https://cloudless.eox.at/" target="_blank" rel="noreferrer">EOxCloudless</a> by EOX IT Services GmbH<br/>Contains modified Copernicus Sentinel data 2016 &amp; 2017</div>}
  {!ready&&<div className="loading" role="status">{error?`加载失败：${error}`:'正在载入园区模型与内部空间…'}</div>}
  {ready&&['floor','room'].includes(state.mode)&&<div className="interior-views" aria-label="模型视角">{(['front','side','top'] as const).map((view,i)=><button key={view} onClick={()=>{engine.current?.viewPreset(view);setOrbit(false)}}>{['正视','侧视','俯视'][i]}</button>)}{state.device&&!state.inspect&&<button onClick={()=>{engine.current?.viewPreset('device');setOrbit(false)}}>设备近景</button>}{state.device&&!state.inspect&&<button onClick={()=>dispatch({type:'inspect',id:state.device!})}>独立查看</button>}</div>}
  <div className="tools visual-tools"><button disabled={!ready||state.mode==='city'} onClick={()=>dispatch({type:'back'})}>{state.inspect?'返回房间':state.mode==='campus'?'返回城市':'返回上级'}</button><button disabled={!ready} onClick={()=>engine.current?.reset()}>重置视角</button><button disabled={!ready} aria-pressed={orbit} onClick={()=>{if(engine.current){engine.current.controls.autoRotate=!orbit;setOrbit(!orbit)}}}>{orbit?'停止环绕':'环绕视角'}</button>{state.inspect?<button className="accent" aria-pressed={!!state.partsExploded} onClick={()=>dispatch({type:'parts-toggle'})}>{state.partsExploded?'复原设备':'拆开设备'}</button>:state.mode==='building'?<button className="accent" aria-pressed={state.exploded} onClick={()=>dispatch({type:'explode'})}>{state.exploded?'合拢楼层':'展开楼层'}</button>:state.mode==='campus'?<button className="accent" onClick={()=>dispatch({type:'building',id:'A'})}>进入 A 楼</button>:state.mode==='city'?<button className="accent" data-enter-campus onClick={()=>dispatch({type:'navigate',mode:'campus'})}>进入园区</button>:<button className="accent" onClick={()=>setLedgerOpen(true)}>空间导航</button>}</div>
  {ledgerOpen&&<div className="spatial-scrim" onClick={()=>setLedgerOpen(false)}><div className="spatial-dialog" role="dialog" aria-modal="true" aria-label="空间导航" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setLedgerOpen(false)}}><div className="detail-head"><h2>空间导航</h2><button autoFocus aria-label="关闭空间导航" onClick={()=>setLedgerOpen(false)}>×</button></div><h3>楼栋</h3><div className="building-tabs">{data.buildings.map(v=><button data-building={v.id} className={state.building===v.id?'selected':''} key={v.id} onClick={()=>dispatch({type:'building',id:v.id})}>{v.id} 楼 <small>{v.floors} 层 · {v.use}</small></button>)}</div><h3>楼层</h3><div className="floor-grid">{data.floors.filter(f=>f.building===b.id).slice().reverse().map(f=><button key={f.id} data-floor={f.id} className={state.floor===f.floor?'selected':''} onClick={()=>dispatch({type:'floor',building:b.id,floor:f.floor})}>{f.floor}F</button>)}</div><h3>{b.id} 楼 · {state.floor}F 房间</h3><input aria-label="搜索本层房间" className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索房间编号或用途"/><div className="room-list">{roomList.map(r=><button key={r.id} data-room={r.id} className={'room-item '+(state.room===r.id?'selected':'')} onClick={()=>{dispatch({type:'room',id:r.id});setLedgerOpen(false)}}><span>{r.id}<small>{r.name}</small></span><span>{r.area.toFixed(1)} m²</span></button>)}</div><a className="download" href={`./assets/v10/${b.id}.glb`} download>下载 {b.id} 楼可编辑 GLB</a></div></div>}
  {dataDetails&&<div className="spatial-scrim" onClick={()=>setDataDetails(false)}><div className="spatial-dialog" role="dialog" aria-modal="true" aria-label="当前空间业务明细" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setDataDetails(false)}}><div className="detail-head"><h2>当前空间业务明细</h2><button autoFocus aria-label="关闭业务明细" onClick={()=>setDataDetails(false)}>×</button></div><DataSummary bundle={displayBundle} modelRooms={new Set(selectedRooms.map(r=>r.id))} now={now} onDevice={id=>{dispatch({type:'device',id});setDataDetails(false)}}/></div></div>}
 </div>
}
createRoot(document.getElementById('root')!).render(<App/>);
