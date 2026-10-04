import {parseTradeCsv,analyzeTrades} from './qelly-verify-engine.mjs';
import {parseMt5Html,parseMt5Xlsx,MT5_REPORT_LIMITS} from './qelly-mt5-report-parser.mjs';
import {analyzeMt5ClosedDeals} from './qelly-mt5-advanced-metrics.mjs';
import {composeStrategyEvidenceReport} from './qelly-verify-report.mjs';

export async function analyzeLocalVerify({source,sourceName,format}={}){
  if(!['csv','mt5-html','mt5-xlsx'].includes(format))throw new Error('Choose trade CSV, MT5 HTML or MT5 XLSX.');
  const binary=source instanceof Uint8Array;
  if((binary?source.byteLength:new TextEncoder().encode(String(source)).byteLength)>MT5_REPORT_LIMITS.fileBytes)throw new Error('Files must not exceed 5 MB.');
  const sourceText=binary&&format!=='mt5-xlsx'?new TextDecoder().decode(source):source;
  const parsed=format==='mt5-html'?parseMt5Html(sourceText,{maxRows:MT5_REPORT_LIMITS.rows})
    :format==='mt5-xlsx'?await parseMt5Xlsx(sourceText,{maxRows:MT5_REPORT_LIMITS.rows}):parseTradeCsv(sourceText);
  const mt5Report=parsed.validation.mt5?analyzeMt5ClosedDeals(parsed.trades,parsed.validation):null;
  const generalEngineEligible=!mt5Report||(parsed.trades.length>=5&&parsed.trades.length<=5000);
  const analysis=generalEngineEligible?analyzeTrades(parsed.trades,{sourceName}):null;
  const evidence=analysis?await composeStrategyEvidenceReport({analysis,validation:parsed.validation,sourceText,sourceName}):null;
  // Raw source and normalized trade rows stay inside this one-use worker.
  return {validation:parsed.validation,evidence,mt5Report};
}
