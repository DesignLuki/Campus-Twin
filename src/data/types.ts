export const tables=['spaces','devices','points','readings','alarms','sources','mappings'] as const;
export type Table=typeof tables[number];
export type Row=Record<string,string>;
export type Rows=Record<Table,Row[]>;
export const emptyRows=():Rows=>({spaces:[],devices:[],points:[],readings:[],alarms:[],sources:[],mappings:[]});
export interface Bindings {spaces:Record<string,string>;devices:Record<string,string>}
export interface Bundle {rows:Rows;bindings:Bindings;files:string[];demo:boolean}
export interface Snapshot extends Bundle {version:1;appliedAt:string}
export interface Issue {level:'error'|'warning';table:string;row:string;field:string;message:string}
export interface Preview {bundle:Bundle;issues:Issue[];added:number;updated:number;skipped:number;incoming:number}
export const titles:Record<Table,string>={spaces:'01空间',devices:'02设备',points:'03测点',readings:'04读数',alarms:'05告警',sources:'06数据源',mappings:'07接口映射'};
export const columns:Record<Table,string[]>={
 spaces:['record_kind','space_id','parent_id','space_type','name','floor_no','usage','area_m2','capacity','provenance','layout_ref'],
 devices:['record_kind','device_id','space_id','name','device_type','model','location_hint','provenance','notes'],
 points:['record_kind','point_id','device_id','metric_name','value_type','unit','data_mode','source_id','stale_after_s','aggregation','semantics','notes'],
 readings:['record_kind','point_id','collected_at','value_number','value_text','value_boolean','quality','source_kind','batch_id'],
 alarms:['record_kind','alarm_id','device_id','point_id','severity','title','started_at','status','resolved_at','source_kind'],
 sources:['record_kind','source_id','name','source_type','endpoint','method_topic','refresh_s','auth_type','credential_ref','source_timezone','sample_ref','notes'],
 mappings:['record_kind','point_id','external_device_id','request_selector','record_path','value_path','time_path','time_format','source_unit','scale','offset','quality_map']
};
export const primary:Record<Table,string>={spaces:'space_id',devices:'device_id',points:'point_id',readings:'point_id',alarms:'alarm_id',sources:'source_id',mappings:'point_id'};
