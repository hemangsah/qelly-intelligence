import { compileFormula } from './formula-engine.mjs';
import { marketRows } from '../server/fixtures.mjs';

const supplemental={
 'QI-EQUITY-AAPL':{peRatio:34.1,volatility30d:22.4,dividendYield:0.44,revenueGrowth:5.6},
 'QI-EQUITY-NVDA':{peRatio:52.4,volatility30d:41.8,dividendYield:0.03,revenueGrowth:55.2},
 'QI-FUND-QQQ':{peRatio:31.2,volatility30d:19.8,dividendYield:0.58,revenueGrowth:null},
 'QI-CRYPTO-BTC':{peRatio:null,volatility30d:48.2,dividendYield:null,revenueGrowth:null},
 'QI-CRYPTO-ETH':{peRatio:null,volatility30d:55.6,dividendYield:null,revenueGrowth:null},
 'QI-COMMODITY-GOLD':{peRatio:null,volatility30d:16.1,dividendYield:null,revenueGrowth:null},
 'QI-INDEX-SPX':{peRatio:27.9,volatility30d:15.3,dividendYield:1.18,revenueGrowth:null},
 'QI-FX-USDINR':{peRatio:null,volatility30d:4.9,dividendYield:null,revenueGrowth:null}
};
const rows=marketRows.map(row=>({...row,...supplemental[row.id]}));
const formulaFields=['price','change24h','marketCap','volume24h','peRatio','volatility30d','dividendYield','revenueGrowth'];
function compare(actual,operator,value){if(operator==='is_available')return actual!==null&&actual!==undefined;if(operator==='is_unavailable')return actual===null||actual===undefined;if(actual==null)return false;if(operator==='equals')return String(actual)===String(value);if(operator==='not_equals')return String(actual)!==String(value);if(operator==='contains')return String(actual).toLowerCase().includes(String(value).toLowerCase());if(operator==='in')return Array.isArray(value)&&value.map(String).includes(String(actual));const number=Number(value);if(operator==='greater_than')return Number(actual)>number;if(operator==='greater_than_or_equal')return Number(actual)>=number;if(operator==='less_than')return Number(actual)<number;if(operator==='less_than_or_equal')return Number(actual)<=number;return false;}
export class ScreenerService {
  catalog(){return {fields:[
    {field:'assetClass',label:'Asset class',type:'enum',operators:['equals','not_equals','in']},
    {field:'price',label:'Price',type:'number',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal']},
    {field:'change24h',label:'24h change',type:'number',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal']},
    {field:'marketCap',label:'Market value',type:'number',operators:['greater_than','less_than','is_available','is_unavailable']},
    {field:'volume24h',label:'Volume',type:'number',operators:['greater_than','less_than','is_available','is_unavailable']},
    {field:'peRatio',label:'P/E ratio',type:'number',operators:['greater_than','less_than','is_available','is_unavailable']},
    {field:'volatility30d',label:'30-day volatility',type:'number',operators:['greater_than','less_than']},
    {field:'dividendYield',label:'Dividend yield',type:'number',operators:['greater_than','less_than','is_available','is_unavailable']},
    {field:'revenueGrowth',label:'Revenue growth',type:'number',operators:['greater_than','less_than','is_available','is_unavailable']}
  ],maxFilters:12,maxResults:100,serverSideExecution:false,licensedData:false};}
  formulaCatalog(){return {fields:formulaFields,functions:['abs','min','max','coalesce','pct'],operators:['+','-','*','/'],examples:[{name:'momentumQuality',expression:'change24h / max(volatility30d, 1)'},{name:'valueGrowth',expression:'coalesce(revenueGrowth, 0) / max(coalesce(peRatio, 1), 1)'}],safeParser:true,dynamicCodeExecution:false};}
  runFormula({filters=[],formulas=[],formulaFilters=[],sort='marketCap',direction='desc',limit=50}={}){if(formulas.length>8)throw Object.assign(new Error('A maximum of eight formulas is supported'),{status:400,code:'formula_limit_exceeded'});const compiled=formulas.map(item=>({name:String(item.name),...compileFormula(item.expression,{allowedFields:formulaFields})}));let result=rows.map(row=>{const computed={};for(const formula of compiled)computed[formula.name]=formula.evaluate({...row,...computed});return {...row,formulas:computed,...computed};});result=result.filter(row=>filters.every(filter=>compare(row[filter.field],filter.operator,filter.value))&&formulaFilters.every(filter=>compare(row.formulas?.[filter.formula],filter.operator,filter.value)));const dir=direction==='asc'?1:-1;result.sort((a,b)=>{const av=a[sort]??a.formulas?.[sort],bv=b[sort]??b.formulas?.[sort];if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return-1;return(av>bv?1:av<bv?-1:0)*dir;});result=result.slice(0,Math.max(1,Math.min(Number(limit)||50,100)));return {items:result,total:result.length,query:{filters,formulas,formulaFilters,sort,direction,limit:Number(limit)},mode:'safe-deterministic-formula-screener',dynamicCodeExecution:false,serverSideDistributedExecution:false,licensedData:false,investmentAdvice:false,generatedAt:'2026-07-24T09:30:02.000Z'};}
  run({filters=[],sort='marketCap',direction='desc',limit=50}={}){let result=rows.filter(row=>filters.every(filter=>compare(row[filter.field],filter.operator,filter.value)));const dir=direction==='asc'?1:-1;result.sort((a,b)=>{const av=a[sort],bv=b[sort];if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return-1;return(av>bv?1:av<bv?-1:0)*dir;});result=result.slice(0,Math.max(1,Math.min(Number(limit)||50,100)));return {items:result,total:result.length,query:{filters,sort,direction,limit:Number(limit)},mode:'deterministic-local-screener',serverSideExecution:false,licensedData:false,investmentAdvice:false,generatedAt:'2026-07-24T08:30:02.000Z'};}
}
