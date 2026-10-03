import {mt5SampleStatistics} from './qelly-mt5-statistics.mjs';
/* Wave DA. Realized closing-deal evidence, not broker account equity. */
const r=(n,d=4)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const sum=a=>a.reduce((s,n)=>s+n,0);
export function mt5ReportClock(value){
 const m=/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value??'').trim());
 if(!m)return null;
 const [y,mo,d,h,min]=m.slice(1,6).map(Number),sec=m[6]===undefined?0:Number(m[6]),date=new Date(Date.UTC(y,mo-1,d,h,min,sec));
 if(y<1970||y>2200||h>23||min>59||sec>59||date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d)return null;
 return {ms:date.getTime(),weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getUTCDay()],hour:h,month:String(y)+'-'+String(mo).padStart(2,'0')};
}
const grouped=(rows,key)=>{
 const out=new Map();for(const row of rows){if(row[key]===null||row[key]===undefined||row[key]==='')continue;
 const k=String(row[key]),v=out.get(k)||{key:k,count:0,net:0,wins:0,losses:0};v.count++;v.net+=row.pnl;if(row.pnl>0)v.wins++;else if(row.pnl<0)v.losses++;out.set(k,v);}
 return [...out.values()].map(v=>({...v,net:r(v.net),winRatePct:r(100*v.wins/v.count,2)})).sort((a,b)=>b.net-a.net||a.key.localeCompare(b.key));
};
export function analyzeMt5ClosedDeals(trades,validation={}){
 if(!validation?.mt5||!Array.isArray(trades)||!trades.length||trades.length>100000)throw new TypeError('Validated MT5 closing deals required');
 let balance=0,peak=0,maxDrawdown=0,winRun=0,lossRun=0,maxWins=0,maxLosses=0,underwaterRun=0,longestUnderwater=0;
 const rows=trades.map((t,i)=>{
   if(typeof t?.pnl!=='number'||!Number.isFinite(t.pnl))throw new TypeError('Nonfinite closing-deal P&L at row '+(i+1));
   balance+=t.pnl;peak=Math.max(peak,balance);maxDrawdown=Math.max(maxDrawdown,peak-balance);
   underwaterRun=peak-balance>1e-8?underwaterRun+1:0;
   longestUnderwater=Math.max(longestUnderwater,underwaterRun);
   winRun=t.pnl>0?winRun+1:0;lossRun=t.pnl<0?lossRun+1:0;maxWins=Math.max(maxWins,winRun);maxLosses=Math.max(maxLosses,lossRun);
   const clock=mt5ReportClock(t.closedAt),side=String(t.side??'').toLowerCase();
   const record={index:i+1,pnl:t.pnl,cumulative:r(balance,8),drawdown:r(peak-balance,8),symbol:typeof t.symbol==='string'?t.symbol.trim().slice(0,40)||null:null,side:['buy','sell'].includes(side)?side:null,ms:clock?.ms??null,weekday:clock?.weekday??null,hour:clock?.hour??null,month:clock?.month??null};
   for(const field of ['commission','fee','swap'])record[field]=typeof t[field]==='number'&&Number.isFinite(t[field])?t[field]:null;
   return record;
 });
 const wins=rows.filter(t=>t.pnl>0),losses=rows.filter(t=>t.pnl<0),profit=sum(wins.map(t=>t.pnl)),loss=-sum(losses.map(t=>t.pnl));
 const calendar=rows.filter(t=>t.ms!==null),chronological=calendar.length===rows.length&&rows.every((t,i)=>!i||t.ms>=rows[i-1].ms);
 const uniqueChronological=calendar.length===rows.length&&rows.every((t,i)=>!i||t.ms>rows[i-1].ms);
 const largestWinningDeal=wins.length?wins.reduce((max,row)=>Math.max(max,row.pnl),0):null;
 const largestProfitContributionPct=largestWinningDeal!==null&&profit>0?r(100*largestWinningDeal/profit,2):null;
 const largestLosingDeal=losses.length?losses.reduce((max,row)=>Math.max(max,-row.pnl),0):null;
 const largestLossContributionPct=largestLosingDeal!==null&&loss>0?r(100*largestLosingDeal/loss,2):null;
 const costs={};for(const field of ['commission','fee','swap']){const known=rows.map(t=>t[field]).filter(t=>t!==null);costs[field]={knownTotal:known.length?r(sum(known)):null,coveragePct:r(100*known.length/rows.length,2)};}
 const stride=Math.max(1,Math.ceil(rows.length/160)),points=rows.filter((t,i)=>!i||i===rows.length-1||i%stride===0).map(t=>({index:t.index,cumulative:t.cumulative,drawdown:t.drawdown}));
 const warnings=['This is a realized closing-deal P&L sequence, not account equity or account balance.','Entry-side costs, deposits, withdrawals and floating P&L are not reconciled.'];
 if(rows.length<30)warnings.push('LIMITED SAMPLE: fewer than 30 closing deals.');if(!chronological)warnings.push('Execution ordering is unverified; source deal order is used.');
 if(chronological&&!uniqueChronological)warnings.push('Some closing deals share the same report-clock timestamp; their exact order is not verifiable. Longest underwater span is withheld.');
 if(calendar.length)warnings.push('Calendar groupings use exported report time without a verified broker timezone.');
 if(validation.mt5.closingDealsWithMissingCosts)warnings.push('Some closing-deal cost cells are missing or invalid.');
 return {statisticalEvidence:mt5SampleStatistics(rows.map(x=>x.pnl)),schema:'qelly.mt5.closed-deals/1.0',truthState:'DETERMINISTIC LOCAL ANALYSIS',sample:{deals:rows.length,wins:wins.length,losses:losses.length,flat:rows.length-wins.length-losses.length,grade:rows.length<30?'LIMITED SAMPLE':'OBSERVED SAMPLE'},metrics:{netPnl:r(balance),grossProfit:r(profit),grossLoss:r(loss),profitFactor:loss>0?r(profit/loss):null,expectedPnlPerDeal:r(balance/rows.length),winRatePct:r(100*wins.length/rows.length,2),maxClosedDealDrawdown:r(maxDrawdown),recoveryFactor:maxDrawdown>0?r(balance/maxDrawdown):null,maxConsecutiveWins:maxWins,maxConsecutiveLosses:maxLosses,largestWinningDealPnl:largestWinningDeal===null?null:r(largestWinningDeal),largestProfitContributionPct,largestLosingDealPnl:largestLosingDeal===null?null:r(-largestLosingDeal),largestLossContributionPct,longestUnderwaterClosingDeals:uniqueChronological?longestUnderwater:null,sharpe:null,sortino:null,calmar:null,relativeAccountDrawdown:null},costs,groups:{symbol:grouped(rows,'symbol'),side:grouped(rows,'side'),weekday:grouped(calendar,'weekday'),hour:grouped(calendar,'hour'),month:grouped(calendar,'month')},series:{chronological,uniqueChronological,total:rows.length,points},warnings,unavailable:['Broker account equity/balance','Starting capital and relative account drawdown','Verified timezone','Holding time','Entry risk and position-level R multiples','Annualized Sharpe, Sortino and Calmar']};
}
