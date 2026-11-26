import {useEffect,useMemo,useRef,useState} from 'react';
import {zipSync,strToU8} from 'fflate';
import {parseFiles} from './parse';
import {previewImport,spaceOptions,spaceBinding,deviceBinding,modelOptions} from './validate';
import {columns,tables,titles,type Snapshot,type Rows,type Bindings,type Preview} from './types';
import {demoRows} from './demo';
import {formatTime} from './time';
const download=(name:string,blob:Blob)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
export function DataHub({snapshot,canUndo,onApply,onUndo,onClear,notice}:{snapshot:Snapshot|null;canUndo:boolean;onApply:(p:Preview)=>boolean;onUndo:()=>void;onClear:()=>void;notice:string}){
 const [open,setOpen]=useState(false),[raw,setRaw]=useState<Rows|null>(null),[fileNames,setFileNames]=useState<string[]>([]),[bindings,setBindings]=useState<Bindings>({spaces:{},devices:{}}),[replace,setReplace]=useState(false),[demo,setDemo]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tab,setTab]=useState<(typeof tables)[number]>('points');
 const dialog=useRef<HTMLDialogElement>(null),sequence=useRef(0);
 useEffect(()=>{if(open)dialog.current?.showModal()},[open]);
 const close=()=>{sequence.current++;setBusy(false);setOpen(false)};
 const preview=useMemo(()=>raw?previewImport(raw,snapshot,bindings,fileNames,replace,demo):null,[raw,snapshot,bindings,fileNames,replace,demo]);
 const errors=preview?.issues.filter(i=>i.level==='error')||[],warnings=preview?.issues.filter(i=>i.level==='warning')||[];
 async function choose(files:File[]){const token=++sequence.current;setBusy(true);setError('');setRaw(null);setDemo(false);setBindings({spaces:{},devices:{}});setFileNames(files.map(f=>f.name));try{const rows=await parseFiles(files);if(token===sequence.current)setRaw(rows)}catch(e){if(token===sequence.current)setError((e as Error).message)}finally{if(token===sequence.current)setBusy(false)}}
 function demoPreview(){sequence.current++;setBusy(false);setRaw(demoRows());setBindings({spaces:{},devices:{}});setFileNames(['内置演示（全部模拟）']);setDemo(true);setReplace(true);setError('')}
 function sampleCSV(){const rows=demoRows(),files:Record<string,Uint8Array>={};for(const t of tables){if(!rows[t].length)continue;const csv=[columns[t],...rows[t].map(r=>columns[t].map(k=>r[k]||''))].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');files[titles[t]+'.csv']=strToU8('\uFEFF'+csv)}download('演示CSV数据包_全部模拟.zip',new Blob([zipSync(files) as BlobPart],{type:'application/zip'}))}
 return <><button className="data-open" onClick={()=>setOpen(true)}>数据接入{snapshot&&<span>{snapshot.rows.points.length}</span>}</button>
 {open&&<dialog className="data-dialog" ref={dialog} onCancel={e=>{e.preventDefault();close()}} aria-label="Excel与CSV数据接入">
  <div className="dialog-head"><div><div className="eyebrow">DATA WORKSPACE</div><h2>Excel / CSV 数据接入</h2></div><button aria-label="关闭数据接入" onClick={close}>×</button></div>
  <div className="dialog-body"><div className="data-info"><b>{snapshot?`当前快照：${snapshot.rows.points.length} 个测点 / ${snapshot.rows.readings.length} 条读数`:'当前没有业务数据快照'}</b><span>{snapshot?`${snapshot.demo?'含内置演示 · ':''}应用于 ${formatTime(snapshot.appliedAt)} 北京时间`:'解析、校验和保存均在本浏览器进行'}</span></div>
   {(notice||error)&&<div className={error||!notice.startsWith('已')?'import-error':'import-notice'} role="alert">{error||notice}</div>}
   <div className="import-actions"><label className="file-button">选择 Excel / CSV<input aria-label="选择数据文件" type="file" accept=".xlsx,.csv" multiple disabled={busy} onChange={e=>{choose([...e.target.files||[]]);e.target.value=''}}/></label><button onClick={demoPreview}>载入演示预览</button><a href="./data/数字孪生混合数据模板_v1.xlsx" download>下载原始Excel模板</a><button onClick={sampleCSV}>下载演示CSV包</button></div>
   <p className="import-help">支持原模板及对应 UTF-8 CSV，可同时选择多张 CSV。单文件最大10MB，每类表最多20000行。example 行自动跳过；填写 data 才会应用。无时区的时间按北京时间解析。</p>
   <div className="import-mode"><label><input type="radio" name="import-mode" checked={!replace} onChange={()=>setReplace(false)}/>按编号合并更新</label><label><input type="radio" name="import-mode" checked={replace} onChange={()=>setReplace(true)}/>整份替换当前快照</label><span>应用前预览，保留一步撤销</span></div>
   {busy&&<div className="empty-data" role="status">正在解析文件…</div>}
   {!raw&&!busy&&<div className="import-empty"><b>先选择文件，或载入演示预览</b><p>业务编号与模型编号不一致时，可在预览中绑定。未绑定的设备保留为台账。</p><small>内置演示覆盖 A-903 两台设备，全部来源为模拟，不代表真实采集。</small></div>}
   {preview&&raw&&<>
    <div className="import-counts"><span>新增 <b>{preview.added}</b></span><span>更新 <b>{preview.updated}</b></span><span>跳过示例 <b>{preview.skipped}</b></span><span className={errors.length?'danger':''}>错误 <b>{errors.length}</b></span><span>提示 <b>{warnings.length}</b></span></div>
    {demo&&<div className="demo-note">全部为内置模拟数据。应用后可查看文件快照与模拟测点混合显示，以及 FALSE、告警和累计电量。</div>}
    {!!preview.issues.length&&<div className="issue-list">{preview.issues.slice(0,80).map((i,n)=><div key={n} className={i.level==='error'?'danger':''}><b>{i.level==='error'?'错误':'提示'}</b><span>{i.table}{i.row?` · 第${i.row}行`:''} · {i.field}</span><p>{i.message}</p></div>)}{preview.issues.length>80&&<p>另有 {preview.issues.length-80} 条，请先修正以上问题后重试。</p>}</div>}
    {(raw.spaces.some(r=>r.record_kind==='data')||raw.devices.some(r=>r.record_kind==='data'))&&<details className="bindings" open><summary>业务编号与三维对象绑定</summary>
     {raw.spaces.filter(r=>r.record_kind==='data').map((r,i)=><label key={'s'+i}><span>{r.space_id}<small>{r.name} · {r.space_type}</small></span><select aria-label={`绑定空间 ${r.space_id}`} value={spaceBinding(r.space_id,preview.bundle)||''} onChange={e=>setBindings(v=>({...v,spaces:{...v.spaces,[r.space_id]:e.target.value}}))}><option value="">仅台账 / 未绑定</option>{spaceOptions(r.space_type).map(([id,s])=><option key={id} value={id}>{id} · {s.name}</option>)}</select></label>)}
     {raw.devices.filter(r=>r.record_kind==='data').map((r,i)=><label key={'d'+i}><span>{r.device_id}<small>{r.name} · {r.space_id}</small></span><select aria-label={`绑定设备 ${r.device_id}`} value={deviceBinding(r.device_id,preview.bundle)||''} onChange={e=>setBindings(v=>({...v,devices:{...v.devices,[r.device_id]:e.target.value}}))}><option value="">仅台账 / 未绑定</option>{modelOptions(r.space_id,preview.bundle).map(d=><option key={d.id} value={d.id}>{d.id} · {d.type}</option>)}</select></label>)}
    </details>}
    <div className="preview-tabs">{tables.map(t=><button key={t} className={t===tab?'selected':''} onClick={()=>setTab(t)}>{titles[t]} <small>{preview.bundle.rows[t].length}</small></button>)}</div>
    <div className="table-scroll"><table><thead><tr>{columns[tab].map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{preview.bundle.rows[tab].slice(0,8).map((r,i)=><tr key={i}>{columns[tab].map(c=><td key={c}>{r[c]??''}</td>)}</tr>)}</tbody></table>{!preview.bundle.rows[tab].length&&<p>此表暂无记录。</p>}</div><small>显示合并后前8行。{replace?'本次应用将替换整份快照。':'同编号记录及同测点同时间读数将按本次文件更新。'}</small>
   </>}
  </div>
  <div className="dialog-footer"><div><button disabled={!canUndo||busy} onClick={()=>{onUndo();setRaw(null)}}>撤销上次应用</button><button disabled={!snapshot||busy} onClick={()=>{onClear();setRaw(null)}}>清空当前快照</button>{snapshot&&<button onClick={()=>download('数据快照备份.json',new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}))}>导出快照备份</button>}</div><button className="apply-data" disabled={!preview||!!errors.length||!preview.incoming||busy} onClick={()=>{if(preview&&onApply(preview))setRaw(null)}}>校验通过并应用</button></div>
 </dialog>}
 </>;
}
