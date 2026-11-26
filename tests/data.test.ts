import {describe,it,expect} from 'vitest';
import {parseCSV,matrixToRows} from '../src/data/parse';
import {parseTime,excelDate} from '../src/data/time';
import {previewImport,validateBundle,readingValue,deviceBinding,spaceBinding} from '../src/data/validate';
import {emptyRows,columns,type Snapshot,type Bundle} from '../src/data/types';
import {demoRows} from '../src/data/demo';
import {pointView,energySummary,readSaved,writeSaved} from '../src/data/runtime';
const NOW=Date.UTC(2026,10,18,2),bindings={spaces:{},devices:{}};
const bundle=():Bundle=>({rows:demoRows(NOW),bindings,files:['TEST_ONLY'],demo:true});
const snapshot=():Snapshot=>({...bundle(),version:1,appliedAt:new Date(NOW).toISOString()});
describe('file decoding and time semantics',()=>{
 it('preserves quoted commas, multiline text, escaped quotes and trailing blanks',()=>expect(parseCSV('\uFEFFid,note,x\r\n1,"a,b\n""c""",\r\n')).toEqual([['id','note','x'],['1','a,b\n"c"','']]));
 it('rejects malformed quotes',()=>{expect(()=>parseCSV('x,"open')).toThrow();expect(()=>parseCSV('x,"ok"wrong')).toThrow()});
 it('recognizes multiline template headers and retains FALSE / 0',()=>{const m=[['title'],columns.readings.map(x=>'中文\n'+x),['data','P','2026-11-18 08:00:00','0','','','good','real','']];const r=matrixToRows(m,'fixture.csv').readings![0];expect(r.value_number).toBe('0');expect(r._row).toBe('3')});
 it('rejects duplicate headers',()=>expect(()=>matrixToRows([['record_kind','collected_at','point_id','point_id']], 'fixture')).toThrow('重复'));
 it('uses Shanghai for local times and respects explicit offsets',()=>{expect(parseTime('2026-11-18 08:00:00')).toBe(parseTime('2026-11-18T00:00:00Z'));expect(parseTime('2026-11-18T08:00:00+08:00')).toBe(parseTime('2026-11-18T00:00:00Z'))});
 it('rejects impossible calendar dates and ambiguous formats',()=>{for(const s of ['2026-02-30 08:00:00','2026-13-01 08:00:00','2026-01-01 25:00:00','11/18/2026','2026-01-01T00:00:00+14:30'])expect(()=>parseTime(s)).toThrow()});
 it('supports Excel 1900/1904 systems without shifting local date',()=>{expect(excelDate(1)).toBe('1900-01-01T00:00:00+08:00');expect(excelDate(0,true)).toBe('1904-01-01T00:00:00+08:00');expect(excelDate(25569.5)).toBe('1970-01-01T12:00:00+08:00');expect(()=>excelDate(60)).toThrow()});
});
describe('validation and non-destructive merge',()=>{
 it('accepts built-in mixed demo without errors',()=>expect(validateBundle(bundle(),NOW).filter(i=>i.level==='error')).toEqual([]));
 it('never applies example rows as submitted data',()=>{const r=demoRows(NOW);for(const list of Object.values(r))for(const row of list)row.record_kind='example';const p=previewImport(r,null,bindings,['example']);expect(p.incoming).toBe(0);expect(p.skipped).toBeGreaterThan(0);expect(p.bundle.rows.points).toHaveLength(0)});
 it('retains zero and false as valid typed values',()=>{const b=bundle();b.rows.readings[0].value_number='0';expect(readingValue(b.rows.readings[0],b.rows.points[0])).toBe(0);expect(readingValue(b.rows.readings.at(-1)!,b.rows.points[2])).toBe(false);expect(validateBundle(b,NOW).filter(i=>i.level==='error')).toEqual([])});
 it('reports duplicate incoming samples despite equivalent time formats',()=>{const r=emptyRows(),original=snapshot(),row=original.rows.readings[0];r.readings=[row,{...row,collected_at:row.collected_at.replace('.000Z','+00:00')}];const p=previewImport(r,original,bindings,['duplicate']);expect(p.issues.some(i=>i.message.includes('重复'))).toBe(true);expect(original.rows.readings).toHaveLength(21)});
 it('valid updates replace one sample, leave source snapshot immutable',()=>{const current=snapshot(),r=emptyRows();r.readings=[{...current.rows.readings[0],value_number:'0'}];const p=previewImport(r,current,bindings,['update']);expect(p.updated).toBe(1);expect(p.bundle.rows.readings).toHaveLength(21);expect(current.rows.readings[0].value_number).not.toBe('0')});
 it('catches unknown references, wrong units and inconsistent value columns',()=>{const b=bundle();b.rows.points[0].unit='kWh';b.rows.readings[0].value_boolean='FALSE';b.rows.alarms[0].device_id='missing';const errors=validateBundle(b,NOW).filter(i=>i.level==='error');expect(errors.some(i=>i.field==='unit')).toBe(true);expect(errors.some(i=>i.field==='value_boolean')).toBe(true);expect(errors.some(i=>i.field==='device_id')).toBe(true)});
 it('rejects stale thresholds of zero and non-finite values',()=>{const b=bundle();b.rows.points[0].stale_after_s='0';b.rows.readings[0].value_number='Infinity';expect(validateBundle(b,NOW).filter(i=>i.level==='error').length).toBeGreaterThanOrEqual(2)});
 it('requires explicit real-data mode and validates alarm order',()=>{const b=bundle();b.rows.readings.push({...b.rows.readings[0],point_id:'DEMO_RH',source_kind:'real'});b.rows.alarms[0].status='resolved';b.rows.alarms[0].resolved_at='2020-01-01 00:00:00';const e=validateBundle(b,NOW);expect(e.some(i=>i.message.includes('模拟测点'))).toBe(true);expect(e.some(i=>i.message.includes('早于'))).toBe(true)});
 it('binds business aliases explicitly while protecting room ownership',()=>{const b=bundle();b.rows.devices[0].device_id='CUSTOM';b.rows.points[0].device_id='CUSTOM';b.rows.points[1].device_id='CUSTOM';b.rows.alarms[0].device_id='CUSTOM';b.bindings={spaces:{},devices:{CUSTOM:'A-903-TH01'}};expect(validateBundle(b,NOW).filter(i=>i.level==='error')).toEqual([]);b.bindings.devices.CUSTOM='B-201-TH01';expect(validateBundle(b,NOW).some(i=>i.message.includes('不属于'))).toBe(true)});
 it('does not read inherited prototype keys as bindings',()=>{const b=bundle();expect(deviceBinding('constructor',b)).toBeUndefined();expect(spaceBinding('__proto__',b)).toBeUndefined()});
 it('rejects duplicate model ownership',()=>{const b=bundle();b.rows.devices.push({...b.rows.devices[0],device_id:'ALIAS'});b.bindings={spaces:{},devices:{ALIAS:'A-903-TH01'}};expect(validateBundle(b,NOW).some(i=>i.message.includes('两条'))).toBe(true)});
});
describe('sources, quality and correct aggregation',()=>{
 it('does not substitute a mock value for a missing file reading',()=>{const b=bundle();b.rows.readings=b.rows.readings.filter(r=>r.point_id!=='DEMO_TEMP');const view=pointView(b.rows.points[0],b,NOW);expect(view.status).toBe('missing');expect(view.value).toBeUndefined();expect(view.source).toBe('none')});
 it('marks stale data and bad latest sample without falling back',()=>{const b=bundle();expect(pointView(b.rows.points[0],b,NOW+7200000).status).toBe('stale');const last=b.rows.readings.filter(r=>r.point_id==='DEMO_TEMP').at(-1)!;last.quality='bad';last.value_number='';const view=pointView(b.rows.points[0],b,NOW);expect(view.status).toBe('bad');expect(view.value).toBeUndefined()});
 it('generates clearly mock values only for explicit mock mode',()=>{const b=bundle();const view=pointView(b.rows.points[1],b,NOW);expect(view.source).toBe('mock');expect(view.value).toBeGreaterThan(47);expect(view.value).toBeLessThan(49);b.rows.points[1].data_mode='api';expect(pointView(b.rows.points[1],b,NOW).status).toBe('api')});
 it('uses differences for counters, separates real and mock',()=>{const b=bundle();const summary=energySummary(b,new Set(['A-903-DSP01']));expect(summary.mock).toBeCloseTo(1.8);expect(summary.real).toBeNull();expect(summary.valid).toBe(1)});
 it('refuses counter rollback and mixed provenance instead of overstating totals',()=>{const b=bundle();b.rows.readings.filter(r=>r.point_id==='DEMO_ENERGY')[4].value_number='0';expect(energySummary(b,new Set(['A-903-DSP01'])).mock).toBeNull();const c=bundle();c.rows.readings.find(r=>r.point_id==='DEMO_ENERGY')!.source_kind='real';expect(energySummary(c,new Set(['A-903-DSP01'])).valid).toBe(0)});
 it('does not treat missing snapshot data as a real zero aggregate',()=>{const b=bundle();b.rows.readings=[];expect(energySummary(b,new Set(['A-903-DSP01'])).real).toBeNull()});
});
describe('snapshot transaction safety',()=>{
 it('round-trips valid data and restores previous snapshot metadata',()=>{let text='';writeSaved({setItem:(_k,v)=>{text=v}},snapshot(),null);const r=readSaved({getItem:()=>text});expect(r.error).toBe('');expect(r.saved.current?.rows.points).toHaveLength(4)});
 it('rejects corrupt or invalid persisted data',()=>{expect(readSaved({getItem:()=>'{broken'}).saved.current).toBeNull();const s=snapshot();s.rows.points[0].value_type='evil';expect(readSaved({getItem:()=>JSON.stringify({version:1,current:s,previous:null})}).error).not.toBe('')});
 it('storage failure leaves old serialized snapshot unchanged',()=>{const original=JSON.stringify(snapshot());let text=original;expect(()=>writeSaved({setItem:()=>{throw Error('QuotaExceeded')}},snapshot(),null)).toThrow('未应用');expect(text).toBe(original)});
});

describe('merged snapshot invariants',()=>{
 it('blocks aggregate row counts that cannot reload safely',()=>{const b=bundle();b.rows.readings=Array.from({length:20001},(_,i)=>({...b.rows.readings[0],collected_at:new Date(NOW-i*1000).toISOString()}));expect(validateBundle(b,NOW).some(i=>i.message.includes('20000'))).toBe(true)});
 it('rejects two ledger spaces claiming the same model room',()=>{const b=bundle();b.rows.spaces=[{record_kind:'data',space_id:'R1',parent_id:'A-F09',space_type:'room',name:'Room 1',provenance:'inferred'},{record_kind:'data',space_id:'R2',parent_id:'A-F09',space_type:'room',name:'Room 2',provenance:'inferred'}];b.bindings={spaces:{R1:'A-903',R2:'A-903'},devices:{}};expect(validateBundle(b,NOW).some(i=>i.message.includes('两条业务空间'))).toBe(true)});
});

it('does not summarize readings under a disconnected API point',()=>{const b=bundle();b.rows.points.find(p=>p.point_id==='DEMO_ENERGY')!.data_mode='api';expect(energySummary(b,new Set(['A-903-DSP01'])).valid).toBe(0)});
