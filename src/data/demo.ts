import {emptyRows,type Rows} from './types';
/** Synthetic test/demo data only. Every reading and alarm is marked mock. */
export function demoRows(now=Date.now()):Rows {
 const rows=emptyRows();
 rows.devices=[{record_kind:'data',device_id:'A-903-TH01',space_id:'A-903',name:'903环境传感器（演示）',device_type:'环境传感器',model:'',location_hint:'',provenance:'inferred',notes:'内置演示，无真实设备连接'}, {record_kind:'data',device_id:'A-903-DSP01',space_id:'A-903',name:'903交互屏（演示）',device_type:'显示屏',model:'',location_hint:'',provenance:'inferred',notes:'内置演示'}];
 rows.sources=[{record_kind:'data',source_id:'DEMO_FILE',name:'演示文件快照',source_type:'file',endpoint:'内置模拟样本',method_topic:'',refresh_s:'',auth_type:'none',credential_ref:'',source_timezone:'Asia/Shanghai',sample_ref:'',notes:'不代表实际采集'}];
 const p=(point_id:string,device_id:string,metric_name:string,value_type:string,unit:string,data_mode:string,aggregation='none',semantics='instant')=>({record_kind:'data',point_id,device_id,metric_name,value_type,unit,data_mode,source_id:data_mode==='file'?'DEMO_FILE':'',stale_after_s:data_mode==='file'?'3600':'',aggregation,semantics,notes:'演示测点'});
 rows.points=[p('DEMO_TEMP','A-903-TH01','温度','number','°C','file'),p('DEMO_RH','A-903-TH01','相对湿度','number','%','mock'),p('DEMO_POWER','A-903-DSP01','电源状态','boolean','1','file','none','state'),p('DEMO_ENERGY','A-903-DSP01','累计电量','number','kWh','file','delta','counter')];
 for(let i=0;i<10;i++){const collected_at=new Date(now-(10-i)*60000).toISOString();for(const [id,value] of [['DEMO_TEMP',23.6+i*.1],['DEMO_ENERGY',10+i*.2]] as const)rows.readings.push({record_kind:'data',point_id:id,collected_at,value_number:value.toFixed(1),value_text:'',value_boolean:'',quality:'good',source_kind:'mock',batch_id:'DEMO'});}
 rows.readings.push({record_kind:'data',point_id:'DEMO_POWER',collected_at:new Date(now-60000).toISOString(),value_number:'',value_text:'',value_boolean:'FALSE',quality:'good',source_kind:'mock',batch_id:'DEMO'});
 rows.alarms=[{record_kind:'data',alarm_id:'DEMO_ALARM',device_id:'A-903-TH01',point_id:'DEMO_TEMP',severity:'warning',title:'演示：环境巡检提醒',started_at:new Date(now-300000).toISOString(),status:'active',resolved_at:'',source_kind:'mock'}];
 for(const key of Object.keys(rows) as (keyof Rows)[])rows[key].forEach((r,i)=>{r._sheet='内置演示 / '+key;r._row=String(i+2)});return rows;
}
