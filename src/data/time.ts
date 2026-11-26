/** Template wall-clock timestamps use Asia/Shanghai; explicit ISO offsets are respected. */
export function parseTime(raw:string):number {
 const m=raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/);
 if(!m)throw Error('时间须为 yyyy-mm-dd hh:mm:ss（北京时间）或带时区的 ISO 时间');
 const [y,mo,d,h,mi,s]=m.slice(1,7).map(Number);const base=new Date(Date.UTC(y,mo-1,d,h,mi,s));
 if(y<1900||mo<1||mo>12||base.getUTCFullYear()!==y||base.getUTCMonth()!==mo-1||base.getUTCDate()!==d||h>23||mi>59||s>59)throw Error('日期或时间不存在');
 const zone=m[8]||'+08:00';let offset=0;
 if(zone!=='Z'){const zh=Number(zone.slice(1,3)),zm=Number(zone.slice(4,6));if(zh>14||zm>59||(zh===14&&zm!==0))throw Error('时区偏移不合法');offset=(zh*60+zm)*(zone[0]==='+'?1:-1)}
 return base.getTime()+Math.round(Number(m[7]||0)*1000)-offset*60000;
}
export function excelDate(serial:number,date1904=false):string {
 if(!Number.isFinite(serial)||serial<0||serial>2958465)throw Error('Excel日期序号不合法');
 if(!date1904&&Math.floor(serial)===60)throw Error('Excel虚构日期1900-02-29不支持');
 const epoch=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,serial<60?31:30);
 return new Date(epoch+Math.round(serial*86400000)).toISOString().slice(0,19)+'+08:00';
}
export const formatTime=(value:string|number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(typeof value==='number'?value:parseTime(value));
