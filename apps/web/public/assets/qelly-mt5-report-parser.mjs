/* Wave DT: bounded, browser-local MT5 report ingestion.
 * Only realized closing DEALS enter P&L. Orders, open entries, balances and
 * report statistics are not trades. This parser never executes uploaded HTML.
 * XLSX supports ZIP stored/deflate worksheets without remote dependencies. */
export const MT5_REPORT_LIMITS=Object.freeze({fileBytes:5*1024*1024,rows:100000,zipEntries:96,entryBytes:20*1024*1024,totalInflatedBytes:48*1024*1024});
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const decodeEntities=(s)=>String(s??'').replace(/&(#x[0-9a-f]+|#[0-9]+|nbsp|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
  const low=entity.toLowerCase();const named={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(low in named)return named[low];
  const code=low.startsWith('#x')?parseInt(low.slice(2),16):parseInt(low.slice(1),10);return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):' ';
});
const plain=(html)=>decodeEntities(String(html??'').replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,' ').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,' ').replace(/[\u00a0\s]+/g,' ').trim());
const key=(s)=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const num=(s)=>{
  let v=String(s??'').trim().replace(/[\u00a0\u202f\s]/g,'').replace(/[$€£₹¥%]/g,'');if(!v||/^(?:-|--|n\/a|null)$/i.test(v))return null;
  const neg=/^\(.*\)$/.test(v);v=v.replace(/[()]/g,'');
  if(v.includes(',')&&v.includes('.'))v=v.lastIndexOf(',')>v.lastIndexOf('.')?v.replace(/\./g,'').replace(',','.'):v.replace(/,/g,'');
  else if(v.includes(',')&&/^[-+]?\d{1,3}(?:,\d{3})+$/.test(v))v=v.replace(/,/g,'');
  else if(v.includes(','))v=v.replace(',','.');
  if(!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v))return null;
  const n=Number(v);return Number.isFinite(n)?(neg?-Math.abs(n):n):null;
};
const COLUMNS=Object.freeze({
  deal:['deal','ticket','deal id'],time:['time','date','close time','execution time'],symbol:['symbol','instrument','asset'],
  type:['type','deal type'],direction:['direction','entry','entry type','deal entry'],
  profit:['profit','p l','pnl','net profit'],commission:['commission','commissions'],fee:['fee','fees'],swap:['swap','storage'],position:['position','position id','positionid','position id'],balance:['balance']
});
const indexOf=(headers,names)=>{for(const name of names){const idx=headers.findIndex(h=>h===name);if(idx>=0)return idx;}return -1;};
const mapHeaders=(row)=>{
  const headers=row.map(key);
  const fields=Object.fromEntries(Object.entries(COLUMNS).map(([field,names])=>[field,indexOf(headers,names)]));
  return fields.profit>=0&&fields.type>=0&&fields.direction>=0&&(fields.deal>=0||fields.time>=0)?fields:null;
};
function parseRows(rows,{sourceFormat,maxRows=MT5_REPORT_LIMITS.rows}={}){
  if(!Array.isArray(rows)||rows.length>maxRows+1500)fail('mt5_report_row_limit','The MT5 report exceeds the local row limit.');
  let mapping=null,found=false,total=0,closed=0,skippedOpen=0,skippedNontrades=0,unpriced=0,unknownCost=0;
  const trades=[],invalidExamples=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i].map(v=>String(v??'').trim());
    const possible=mapHeaders(row);
    if(possible){mapping=possible;found=true;continue;}
    if(!mapping||row.every(v=>!v))continue;
    const at=field=>mapping[field]<0?'':row[mapping[field]]??'';
    const kind=key(at('type'));
    const entry=key(at('direction'));
    if(!['buy','sell'].includes(kind)){if(kind&&!['type','deal type'].includes(kind))skippedNontrades++;continue;}
    total++;
    // Partial close, close by and reversal exits carry realized P&L. Entry
    // deals are excluded, even if MT5 shows entry-side commission or swap.
    if(!['out','out by','inout','in out','close','close by'].includes(entry)){skippedOpen++;continue;}
    if(closed>=maxRows)fail('mt5_report_row_limit','The MT5 report exceeds the local realized-deal limit.');
    const rawProfit=num(at('profit'));if(rawProfit===null){unpriced++;if(invalidExamples.length<10)invalidExamples.push({row:i+1,reason:'Closing deal has no numeric realized profit'});continue;}
    const fields=['commission','fee','swap'];let knownCost=0,missingCost=false;const closingCosts={commission:null,fee:null,swap:null};
    for(const name of fields){
      if(mapping[name]<0)continue;
      const raw=at(name);const n=num(raw);
      if(n===null){missingCost=true;continue;}
      closingCosts[name]=n;
      knownCost+=n;
    }
    if(missingCost)unknownCost++;
    const time=at('time'),symbol=at('symbol');
    trades.push(Object.freeze({index:trades.length+1,pnl:Math.round((rawProfit+knownCost)*1e8)/1e8,fees:Math.round(knownCost*1e8)/1e8,commission:closingCosts.commission,fee:closingCosts.fee,swap:closingCosts.swap,openedAt:null,closedAt:time||null,symbol:symbol||null,side:kind,dealId:at('deal')||null,positionId:at('position')||null}));
    closed++;
  }
  if(!found)fail('mt5_deals_table_missing','No supported MT5 Deals table was found. A report must include Profit, Type, Direction and Time or Deal headers.');
  if(closed===0)fail('mt5_no_realized_deals','No realized closing buy/sell deals with numeric profit were found. Open positions, deposits and summary statistics are excluded.');
  const hasCost=mapping&&['commission','fee','swap'].some(k=>mapping[k]>=0);
  const detectedFields={closedAt:'Time',symbol:'Symbol',side:'Type',...(hasCost?{fees:'Reported deal-level commission, fee and swap'}:{})};
  return Object.freeze({trades:Object.freeze(trades),validation:Object.freeze({
    totalRows:total,validRows:closed,invalidRows:unpriced,invalidExamples:Object.freeze(invalidExamples),delimiter:sourceFormat,
    detectedPnlColumn:'Realized Profit + reported closing-deal costs',
    detectedFields:Object.freeze(detectedFields),
    mt5:Object.freeze({format:sourceFormat,realizedDeals:closed,openDealsExcluded:skippedOpen,nonTradeRowsExcluded:skippedNontrades,
      unpricedClosingDeals:unpriced,costFieldsPresent:hasCost,closingDealsWithMissingCosts:unknownCost,
      entrySideCostsReconciled:false,netPnlBoundary:'Known profit and reported costs on each closing deal only; entry-side commission, account cash flows and unmatched swaps are not allocated to positions.'})
  })});
}
export function parseMt5Html(source,{maxRows=MT5_REPORT_LIMITS.rows}={}){
  const html=String(source??'');
  if(!html.trim())fail('mt5_file_empty','The MT5 report is empty.');
  if(new TextEncoder().encode(html).byteLength>MT5_REPORT_LIMITS.fileBytes)fail('mt5_file_too_large','MT5 reports must not exceed 5 MB.');
  if(!/<table\b/i.test(html)||!/<tr\b/i.test(html))fail('mt5_deals_table_missing','No supported MT5 report table was found.');
  const rows=[];
  const noScripts=html.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,'');
  for(const match of noScripts.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)){
    const cells=[...match[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)\s*>/gi)].map(m=>plain(m[1]));
    if(cells.length)rows.push(cells);
    if(rows.length>maxRows+1500)fail('mt5_report_row_limit','MT5 HTML contains too many table rows.');
  }
  return parseRows(rows,{sourceFormat:'mt5-html',maxRows});
}
const le16=(v,n)=>v.getUint16(n,true),le32=(v,n)=>v.getUint32(n,true);
const bytesInput=value=>value instanceof Uint8Array?value:value instanceof ArrayBuffer?new Uint8Array(value):null;
const assertPath=name=>{if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..'))fail('mt5_xlsx_invalid_path','The XLSX archive contains an unsafe entry path.');return name;};
async function unzipXml(bytes){
  if(bytes.byteLength>MT5_REPORT_LIMITS.fileBytes)fail('mt5_file_too_large','MT5 XLSX files must not exceed 5 MB.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(le32(view,p)===0x06054b50){end=p;break;}
  if(end<0)fail('mt5_xlsx_invalid','The file is not a valid XLSX ZIP archive.');
  const count=le16(view,end+10),directorySize=le32(view,end+12),directoryStart=le32(view,end+16);
  if(count>MT5_REPORT_LIMITS.zipEntries||directoryStart+directorySize>bytes.length)fail('mt5_xlsx_limit','The XLSX archive exceeds the safe local limits.');
  const out=new Map(),decoder=new TextDecoder('utf-8',{fatal:true});
  let offset=directoryStart,totalInflated=0;
  for(let i=0;i<count;i++){
    if(offset+46>bytes.length||le32(view,offset)!==0x02014b50)fail('mt5_xlsx_invalid','Invalid XLSX ZIP central directory.');
    const flags=le16(view,offset+8),method=le16(view,offset+10),packed=le32(view,offset+20),unpacked=le32(view,offset+24),nameLength=le16(view,offset+28),extra=le16(view,offset+30),comment=le16(view,offset+32),localOffset=le32(view,offset+42);
    if(offset+46+nameLength+extra+comment>bytes.length)fail('mt5_xlsx_invalid','Invalid XLSX entry metadata.');
    const name=assertPath(decoder.decode(bytes.subarray(offset+46,offset+46+nameLength)));
    offset+=46+nameLength+extra+comment;
    if(flags&1||![0,8].includes(method)||unpacked>MT5_REPORT_LIMITS.entryBytes||packed>MT5_REPORT_LIMITS.fileBytes)fail('mt5_xlsx_unsupported','Encrypted, unsupported or oversized XLSX entries are rejected.');
    if(/(?:^|\/)(?:vbaProject\.bin|externalLinks|embeddings)(?:\/|$)/i.test(name))fail('mt5_xlsx_unsupported','Macro-enabled, externally linked and embedded-object XLSX workbooks are not supported. Export a plain MT5 XLSX report instead.');
    if(out.has(name))fail('mt5_xlsx_invalid','Duplicate XLSX archive entry names are not supported.');
    totalInflated+=unpacked;
    if(totalInflated>MT5_REPORT_LIMITS.totalInflatedBytes)fail('mt5_xlsx_limit','The decompressed XLSX workbook exceeds 48 MB.');
    if(!/^xl\/(?:worksheets\/[^/]+\.xml|sharedStrings\.xml)$/i.test(name))continue;
    if(localOffset+30>bytes.length||le32(view,localOffset)!==0x04034b50)fail('mt5_xlsx_invalid','Invalid XLSX local entry.');
    const start=localOffset+30+le16(view,localOffset+26)+le16(view,localOffset+28);
    if(start+packed>bytes.length)fail('mt5_xlsx_invalid','Truncated XLSX compressed data.');
    const body=bytes.subarray(start,start+packed);
    let inflated;
    if(method===0)inflated=body;
    else{
      if(typeof DecompressionStream!=='function')fail('mt5_xlsx_decompression_unavailable','Your browser cannot decompress this XLSX workbook locally. Export MT5 CSV instead.');
      let reader;
      try{
        reader=new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
        const chunks=[];let received=0;
        for(;;){
          const {done,value}=await reader.read();if(done)break;
          received+=value.byteLength;
          if(received>unpacked||received>MT5_REPORT_LIMITS.entryBytes){await reader.cancel();fail('mt5_xlsx_limit','XLSX decompression exceeded its declared safe size.');}
          chunks.push(value);
        }
        inflated=new Uint8Array(received);let written=0;
        for(const chunk of chunks){inflated.set(chunk,written);written+=chunk.byteLength;}
      }catch(error){
        if(error?.code==='mt5_xlsx_limit')throw error;
        try{await reader?.cancel();}catch{}
        fail('mt5_xlsx_decompression_failed','The XLSX sheet could not be decompressed. Export a CSV instead.');
      }
    }
    if(inflated.byteLength!==unpacked||inflated.byteLength>MT5_REPORT_LIMITS.entryBytes)fail('mt5_xlsx_invalid','The XLSX decompressed entry size does not match its ZIP metadata.');
    const xml=decoder.decode(inflated);
    if(/<!DOCTYPE|<!ENTITY|<f(?:\s|>)/i.test(xml))fail('mt5_xlsx_unsupported','XLSX documents containing entity definitions or formula-derived cells are rejected. Export a static MT5 report.');
    out.set(name,xml);
  }
  return out;
}
const colNumber=(reference)=>{const letters=/^[A-Z]+/i.exec(reference||'')?.[0]||'';let n=0;for(const ch of letters.toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1;};
const xmlValue=s=>decodeEntities(s.replace(/<[^>]+>/g,''));
function parseSheetXml(xml,strings,maxRows){
  const rows=[];
  for(const result of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)){
    const cells=[];
    for(const c of result[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)){
      const column=/\br="([A-Z]+)[0-9]+"/i.exec(c[1])?.[1]||'';
      const index=column?colNumber(column):cells.length;
      if(index<0||index>=48)continue;
      const kind=/\bt="([^"]+)"/i.exec(c[1])?.[1]||'';
      const content=c[2]||'';
      const raw=/<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(content)?.[1]??(/<is\b[^>]*>([\s\S]*?)<\/is>/i.exec(content)?.[1]??'');
      const decoded=xmlValue(raw);
      cells[index]=kind==='s'?strings[Number(decoded)]??'':decoded;
    }
    if(cells.length)rows.push(Array.from({length:cells.length},(_,n)=>cells[n]||''));
    if(rows.length>maxRows+1500)fail('mt5_report_row_limit','The MT5 XLSX worksheet contains too many rows.');
  }
  return rows;
}
export async function parseMt5Xlsx(value,{maxRows=MT5_REPORT_LIMITS.rows}={}){
  const bytes=bytesInput(value);if(!bytes)fail('mt5_xlsx_input_invalid','MT5 XLSX analysis requires a local binary file.');
  const content=await unzipXml(bytes);
  const ss=content.get('xl/sharedStrings.xml')||'';
  const strings=[...ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(n=>xmlValue(n[1])).join(''));
  const sheets=[...content.entries()].filter(([path])=>/^xl\/worksheets\//i.test(path)).sort(([a],[b])=>a.localeCompare(b));
  let lastError=null;
  for(const [,xml] of sheets){
    try{return parseRows(parseSheetXml(xml,strings,maxRows),{sourceFormat:'mt5-xlsx',maxRows});}
    catch(error){if(!['mt5_deals_table_missing','mt5_no_realized_deals'].includes(error?.code))throw error;lastError=error;}
  }
  if(!sheets.length)fail('mt5_xlsx_invalid','The XLSX file has no supported worksheets.');
  throw lastError;
}
export const __mt5ParserTest=Object.freeze({key,num,plain,mapHeaders,parseRows,colNumber,decodeEntities});
