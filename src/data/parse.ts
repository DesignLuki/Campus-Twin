import {unzipSync,strFromU8} from 'fflate';
import {columns,emptyRows,tables,type Row,type Rows,type Table} from './types';
import {excelDate} from './time';
const MAX_BYTES=10*1024*1024,MAX_ROWS=20000;
export function parseCSV(text:string):string[][] {
 text=text.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(c==='"'){if(cell||closed)throw Error('CSV引号位置不合法');quoted=true;continue}
  if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++}continue}
  if(closed){if(c===' '||c==='\t')continue;throw Error('CSV引号结束后只能是分隔符')}
  cell+=c;
 }
 if(quoted)throw Error('CSV引号未闭合');if(cell||row.length||closed){row.push(cell);rows.push(row)}
 if(rows.length>MAX_ROWS+10)throw Error('每张表最多支持20000条记录');return rows;
}
const key=(v:string)=>v.trim().split(/\r?\n/).at(-1)!.trim().replace(/\*$/,'');
function classify(headers:string[]):Table|undefined {
 if(headers.includes('space_type'))return 'spaces';if(headers.includes('device_type'))return 'devices';
 if(headers.includes('collected_at'))return 'readings';if(headers.includes('alarm_id'))return 'alarms';
 if(headers.includes('source_type'))return 'sources';if(headers.includes('record_path'))return 'mappings';if(headers.includes('metric_name'))return 'points';
}
export function matrixToRows(matrix:string[][],name:string,formulaCells=new Set<string>(),date1904=false,numericDates=new Set<string>()):Partial<Rows> {
 const headerIndex=matrix.findIndex((r,i)=>i<10&&r.map(key).includes('record_kind'));
 if(headerIndex<0){if(name.includes('填写说明'))return {};throw Error(`${name}：未找到 record_kind 表头`)}
 const headers=matrix[headerIndex].map(key),table=classify(headers);if(!table)throw Error(`${name}：无法识别数据表类型`);
 const seen=new Set<string>();for(const h of headers){if(!h)continue;if(seen.has(h))throw Error(`${name}：表头 ${h} 重复`);seen.add(h)}
 const required=columns[table].filter(k=>!['notes','layout_ref','location_hint','model','sample_ref','request_selector','quality_map'].includes(k));
 for(const col of required)if(!headers.includes(col))throw Error(`${name}：缺少列 ${col}`);
 const result:Row[]=[];
 for(let i=headerIndex+1;i<matrix.length;i++){
  if(!matrix[i]?.some(v=>v.trim()))continue;
  const r:Row={_sheet:name,_row:String(i+1)};
  headers.forEach((h,j)=>{if(!columns[table].includes(h))return;let value=matrix[i][j]??'';
   if(formulaCells.has(`${i}:${j}`))throw Error(`${name} 第${i+1}行：请将公式转换为明确的值后导入`);
   if(['collected_at','started_at','resolved_at'].includes(h)&&value&&numericDates.has(`${i}:${j}`))value=excelDate(Number(value),date1904);
   r[h]=h==='value_text'?value:value.trim();
  });result.push(r);
 }
 if(result.length>MAX_ROWS)throw Error(`${name}：最多支持20000条记录`);return {[table]:result};
}
function xml(value:Uint8Array|undefined,label:string){if(!value)throw Error(`Excel缺少${label}`);const text=strFromU8(value);if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Excel XML声明不支持');const d=new DOMParser().parseFromString(text,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error(`Excel ${label} 无法解析`);return d}
const elements=(root:Document|Element,name:string)=>Array.from(root.getElementsByTagNameNS('*',name));
export function parseXLSX(bytes:Uint8Array,name:string):Rows {
 if(bytes.byteLength>MAX_BYTES)throw Error('单个文件最大10MB');let size=0,count=0;
 const entries=unzipSync(bytes,{filter:f=>{if(++count>512)throw Error('Excel压缩条目过多');if(f.originalSize>20*1024*1024||(size+=f.originalSize)>50*1024*1024)throw Error('Excel解压内容超过50MB');return /^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(f.name)}});
 const book=xml(entries['xl/workbook.xml'],'workbook'),relations=xml(entries['xl/_rels/workbook.xml.rels'],'relationships');
 const rels=new Map(elements(relations,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')!]));
 const shared=entries['xl/sharedStrings.xml']?elements(xml(entries['xl/sharedStrings.xml'],'sharedStrings'),'si').map(si=>elements(si,'t').map(t=>t.textContent||'').join('')):[];
 const date1904=['1','true'].includes(elements(book,'workbookPr')[0]?.getAttribute('date1904')||'');const result=emptyRows();
 for(const sheet of elements(book,'sheet')){
  const id=sheet.getAttribute('r:id')??sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const target=rels.get(id);if(!target)throw Error('Excel工作表关系缺失');
  const path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');if(path.includes('..'))throw Error('Excel工作表路径不支持');
  const title=sheet.getAttribute('name')||'';if(title==='填写说明')continue;
  const doc=xml(entries[path],title),matrix:string[][]=[],formulas=new Set<string>(),numeric=new Set<string>();
  for(const row of elements(doc,'row')){const i=Number(row.getAttribute('r'))-1;if(!Number.isInteger(i)||i<0||i>MAX_ROWS+10)throw Error('Excel行号超出范围');matrix[i]=[];
   for(const cell of elements(row,'c')){const addr=cell.getAttribute('r')||'';const letters=addr.match(/^[A-Z]+/)?.[0];if(!letters)throw Error('Excel单元格地址不合法');const j=[...letters].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1;if(j>64)throw Error('Excel数据表最多支持65列');
    const t=cell.getAttribute('t'),value=elements(cell,'v')[0]?.textContent??'';
    if(elements(cell,'f').length)formulas.add(`${i}:${j}`);if(t==='e')throw Error(`${title} ${addr} 包含Excel错误值`);
    if(t==='s'){if(!/^\d+$/.test(value)||shared[Number(value)]===undefined)throw Error('Excel共享字符串引用无效');matrix[i][j]=shared[Number(value)]}
    else if(t==='inlineStr')matrix[i][j]=elements(cell,'t').map(n=>n.textContent||'').join('');
    else if(t==='b')matrix[i][j]=value==='1'?'TRUE':'FALSE';
    else {matrix[i][j]=value;if((t===null||t==='n')&&value)numeric.add(`${i}:${j}`)}
   }
  }
  const parsed=matrixToRows(Array.from({length:matrix.length},(_,i)=>matrix[i]||[]),`${name} / ${title}`,formulas,date1904,numeric);
  for(const table of tables)result[table].push(...parsed[table]||[]);
 }
 return result;
}
export async function parseFiles(files:File[]):Promise<Rows>{
 if(!files.length||files.length>10)throw Error('一次请选择1–10个文件');const result=emptyRows();
 for(const file of files){if(file.size>MAX_BYTES)throw Error(`${file.name} 超过10MB`);let rows:Partial<Rows>;
  if(/\.xlsx$/i.test(file.name))rows=parseXLSX(new Uint8Array(await file.arrayBuffer()),file.name);
  else if(/\.csv$/i.test(file.name)){let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer())}catch{throw Error(`${file.name} 请另存为 UTF-8 CSV`)}rows=matrixToRows(parseCSV(text),file.name)}
  else throw Error('仅支持 .xlsx 和 UTF-8 .csv 文件');
  for(const table of tables){result[table].push(...rows[table]||[]);if(result[table].length>MAX_ROWS)throw Error('同一批次每类表最多20000条记录')}
 }
 return result;
}
