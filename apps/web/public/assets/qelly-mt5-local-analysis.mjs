import {parseMt5Html,parseMt5Xlsx,MT5_REPORT_LIMITS} from './qelly-mt5-report-parser.mjs';
import {analyzeMt5ClosedDeals} from './qelly-mt5-advanced-metrics.mjs';

// Worker-only processing uses the same bounded parser and scientific metrics.
export async function analyzeLocalMt5({source,format}={}){
  if(!['html','xlsx'].includes(format))throw new Error('Choose an MT5 HTML or XLSX report.');
  if(source instanceof Uint8Array&&source.byteLength>MT5_REPORT_LIMITS.fileBytes)throw new Error('MT5 reports must not exceed 5 MB.');
  const html=format==='html'&&source instanceof Uint8Array?new TextDecoder().decode(source):source;
  const parsed=format==='xlsx'?await parseMt5Xlsx(source,{maxRows:MT5_REPORT_LIMITS.rows}):parseMt5Html(html,{maxRows:MT5_REPORT_LIMITS.rows});
  return analyzeMt5ClosedDeals(parsed.trades,parsed.validation);
}
