const MAX_ROWS=100000;
const SCORE_MIN=0;
const SCORE_MAX=100;

const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const round=(value,digits=2)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const normalizedHeader=(value)=>String(value??'').trim().toLowerCase().replace(/[\s./\\-]+/g,'_').replace(/[^a-z0-9_]/g,'');
const percentile=(values,p)=>{
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const position=(sorted.length-1)*clamp(p);
  const lower=Math.floor(position),upper=Math.ceil(position);
  if(lower===upper)return sorted[lower];
  return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);
};
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const standardDeviation=(values)=>{
  if(values.length<2)return 0;
  const average=mean(values);
  return Math.sqrt(values.reduce((sum,value)=>sum+(value-average)**2,0)/(values.length-1));
};

const aliases=Object.freeze({
  pnl:['pnl','profit','net_profit','netprofit','net_pnl','profit_loss','profitandloss','pl','result','trade_profit'],
  returnPct:['return','return_pct','return_percent','profit_pct','pnl_pct','percentage_return'],
  openedAt:['open_time','entry_time','opened_at','time_open','date_open','open_date'],
  closedAt:['close_time','exit_time','closed_at','time_close','date_close','close_date'],
  symbol:['symbol','instrument','asset','ticker','market'],
  side:['side','type','direction','trade_type'],
  fees:['fees','fee','commission','commissions','cost','costs']
});

function detectDelimiter(line){
  const candidates=[',',';','\t','|'];
  let best=',',score=-1;
  for(const delimiter of candidates){
    let count=0,quoted=false;
    for(let index=0;index<line.length;index+=1){
      const character=line[index];
      if(character==='"')quoted=!quoted;
      else if(character===delimiter&&!quoted)count+=1;
    }
    if(count>score){best=delimiter;score=count;}
  }
  return best;
}

function parseDelimitedLine(line,delimiter){
  const cells=[];
  let value='',quoted=false;
  for(let index=0;index<line.length;index+=1){
    const character=line[index];
    if(character==='"'){
      if(quoted&&line[index+1]==='"'){value+='"';index+=1;}
      else quoted=!quoted;
      continue;
    }
    if(character===delimiter&&!quoted){cells.push(value);value='';continue;}
    value+=character;
  }
  cells.push(value);
  return cells.map(cell=>cell.trim());
}

function numericValue(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  let source=String(value??'').trim();
  if(!source||/^(?:n\/?a|null|none|--?)$/i.test(source))return null;
  const negative=/^\(.*\)$/.test(source);
  source=source.replace(/[()]/g,'').replace(/[₹$€£¥%]/g,'').replace(/\s/g,'');
  if(source.includes(',')&&!source.includes('.')&&/^[-+]?\d+,\d+$/.test(source))source=source.replace(',','.');
  else source=source.replace(/,/g,'');
  const parsed=Number(source);
  return Number.isFinite(parsed)?(negative?-Math.abs(parsed):parsed):null;
}

function columnFor(headers,names){
  for(const name of names){const index=headers.indexOf(name);if(index>=0)return index;}
  return -1;
}

export function parseTradeCsv(source,{maxRows=MAX_ROWS}={}){
  const text=String(source??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!text)throw Object.assign(new Error('The strategy file is empty.'),{code:'verify_file_empty'});
  const lines=text.split('\n').filter(line=>line.trim().length);
  if(lines.length<2)throw Object.assign(new Error('The file must contain a header and at least one trade row.'),{code:'verify_rows_missing'});
  if(lines.length-1>maxRows)throw Object.assign(new Error(`The file exceeds the ${maxRows.toLocaleString()}-trade prototype limit.`),{code:'verify_row_limit'});
  const delimiter=detectDelimiter(lines[0]);
  const rawHeaders=parseDelimitedLine(lines[0],delimiter);
  const headers=rawHeaders.map(normalizedHeader);
  const pnlIndex=columnFor(headers,aliases.pnl);
  const returnIndex=columnFor(headers,aliases.returnPct);
  if(pnlIndex<0&&returnIndex<0)throw Object.assign(new Error('A P&L column is required. Use a header such as pnl, profit or net_profit.'),{code:'verify_pnl_column_missing'});
  const fieldIndexes=Object.fromEntries(Object.entries(aliases).map(([key,names])=>[key,columnFor(headers,names)]));
  const trades=[];
  const invalidRows=[];
  for(let lineIndex=1;lineIndex<lines.length;lineIndex+=1){
    const cells=parseDelimitedLine(lines[lineIndex],delimiter);
    const pnl=numericValue(cells[pnlIndex>=0?pnlIndex:returnIndex]);
    if(pnl==null){invalidRows.push({row:lineIndex+1,reason:'P&L is missing or not numeric'});continue;}
    const fees=fieldIndexes.fees>=0?numericValue(cells[fieldIndexes.fees]):null;
    trades.push(Object.freeze({
      index:trades.length+1,
      pnl,
      fees,
      openedAt:fieldIndexes.openedAt>=0?cells[fieldIndexes.openedAt]||null:null,
      closedAt:fieldIndexes.closedAt>=0?cells[fieldIndexes.closedAt]||null:null,
      symbol:fieldIndexes.symbol>=0?cells[fieldIndexes.symbol]||null:null,
      side:fieldIndexes.side>=0?cells[fieldIndexes.side]||null:null
    }));
  }
  if(!trades.length)throw Object.assign(new Error('No valid trade rows were found in the file.'),{code:'verify_no_valid_trades'});
  return Object.freeze({
    trades:Object.freeze(trades),
    validation:Object.freeze({
      totalRows:lines.length-1,
      validRows:trades.length,
      invalidRows:invalidRows.length,
      invalidExamples:Object.freeze(invalidRows.slice(0,10)),
      delimiter:delimiter==='\t'?'tab':delimiter,
      detectedPnlColumn:rawHeaders[pnlIndex>=0?pnlIndex:returnIndex],
      detectedFields:Object.freeze(Object.fromEntries(Object.entries(fieldIndexes).filter(([,index])=>index>=0).map(([key,index])=>[key,rawHeaders[index]])))
    })
  });
}

function maxDrawdown(values){
  let equity=0,peak=0,maximum=0;
  for(const value of values){equity+=value;peak=Math.max(peak,equity);maximum=Math.max(maximum,peak-equity);}
  return maximum;
}

function longestLosingStreak(values){
  let current=0,maximum=0;
  for(const value of values){if(value<0){current+=1;maximum=Math.max(maximum,current);}else current=0;}
  return maximum;
}

function seedFor(values){
  let seed=2166136261;
  for(const value of values){
    const text=Number(value).toFixed(8);
    for(const character of text){seed^=character.charCodeAt(0);seed=Math.imul(seed,16777619);}
  }
  return seed>>>0||1;
}

function randomGenerator(seed){
  let value=seed>>>0;
  return ()=>{value+=0x6D2B79F5;let next=value;next=Math.imul(next^(next>>>15),next|1);next^=next+Math.imul(next^(next>>>7),next|61);return((next^(next>>>14))>>>0)/4294967296;};
}

function sequenceStress(values,{iterations=500}={}){
  if(values.length<2)return {iterations:0,medianMaxDrawdown:maxDrawdown(values),stressMaxDrawdown:maxDrawdown(values),stressLosingStreak:longestLosingStreak(values)};
  const random=randomGenerator(seedFor(values));
  const drawdowns=[],streaks=[];
  for(let iteration=0;iteration<iterations;iteration+=1){
    const shuffled=[...values];
    for(let index=shuffled.length-1;index>0;index-=1){const swap=Math.floor(random()*(index+1));[shuffled[index],shuffled[swap]]=[shuffled[swap],shuffled[index]];}
    drawdowns.push(maxDrawdown(shuffled));
    streaks.push(longestLosingStreak(shuffled));
  }
  return {
    iterations,
    medianMaxDrawdown:round(percentile(drawdowns,.5)),
    stressMaxDrawdown:round(percentile(drawdowns,.95)),
    stressLosingStreak:Math.ceil(percentile(streaks,.95)??0)
  };
}

function scoreBand(score){return score>=80?'Strong':score>=65?'Promising':score>=50?'Mixed':score>=35?'Weak':'Insufficient';}
function riskBand(score){return score>=70?'High':score>=40?'Moderate':'Lower';}

export function analyzeTrades(trades,{sourceName='Local strategy CSV'}={}){
  const values=(Array.isArray(trades)?trades:[]).map(trade=>Number(trade?.pnl)).filter(Number.isFinite);
  if(values.length<5)throw Object.assign(new Error('At least five valid trades are required for the prototype analysis.'),{code:'verify_sample_too_small'});
  const wins=values.filter(value=>value>0),losses=values.filter(value=>value<0),flat=values.length-wins.length-losses.length;
  const grossProfit=wins.reduce((sum,value)=>sum+value,0);
  const grossLoss=Math.abs(losses.reduce((sum,value)=>sum+value,0));
  const netProfit=values.reduce((sum,value)=>sum+value,0);
  const averageWin=mean(wins),averageLoss=Math.abs(mean(losses));
  const winRate=wins.length/values.length;
  const payoffRatio=averageLoss>0?averageWin/averageLoss:null;
  const profitFactor=grossLoss>0?grossProfit/grossLoss:(grossProfit>0?Infinity:0);
  const expectancy=mean(values);
  const averageAbsolute=mean(values.map(Math.abs))||1;
  const observedMaxDrawdown=maxDrawdown(values);
  const lossStreak=longestLosingStreak(values);
  const midpoint=Math.max(1,Math.floor(values.length/2));
  const firstExpectancy=mean(values.slice(0,midpoint));
  const secondExpectancy=mean(values.slice(midpoint));
  const consistencyGap=Math.abs(firstExpectancy-secondExpectancy)/(averageAbsolute||1);
  const totalAbsolute=values.reduce((sum,value)=>sum+Math.abs(value),0)||1;
  const concentration=[...values].sort((a,b)=>Math.abs(b)-Math.abs(a)).slice(0,3).reduce((sum,value)=>sum+Math.abs(value),0)/totalAbsolute;
  const sampleScore=clamp(Math.log10(values.length)/2,0,1);
  const expectancyScore=clamp(.5+expectancy/(averageAbsolute*2),0,1);
  const profitFactorScore=clamp((Math.min(Number.isFinite(profitFactor)?profitFactor:4,4)-.7)/2.3,0,1);
  const drawdownScore=clamp(1-observedMaxDrawdown/Math.max(grossProfit,averageAbsolute*4),0,1);
  const consistencyScore=clamp(1-consistencyGap,0,1);
  const concentrationScore=clamp(1-(concentration-.15)/.7,0,1);
  const streakScore=clamp(1-lossStreak/Math.max(5,values.length*.25),0,1);
  const qualityScore=Math.round(clamp(expectancyScore*.30+profitFactorScore*.25+drawdownScore*.20+consistencyScore*.15+sampleScore*.10)*100);
  const robustnessScore=Math.round(clamp(sampleScore*.35+consistencyScore*.30+concentrationScore*.20+streakScore*.15)*100);
  const overfittingRisk=Math.round(clamp(1-(robustnessScore/100)*.72-(qualityScore/100)*.18+Math.min(.25,concentration*.25))*100);
  const rawKelly=payoffRatio&&payoffRatio>0?Math.max(0,winRate-(1-winRate)/payoffRatio):0;
  const constrainedLow=Math.min(.02,rawKelly*.10);
  const constrainedHigh=Math.min(.05,rawKelly*.25);
  const stress=sequenceStress(values);
  const warnings=[];
  if(values.length<30)warnings.push('Small sample: fewer than 30 valid trades materially limits confidence.');
  if(concentration>.45)warnings.push('Outcome concentration: the three largest trades dominate the sample.');
  if(consistencyGap>.8)warnings.push('Stability warning: expectancy differs materially between the first and second halves.');
  if(profitFactor<1)warnings.push('Negative edge warning: gross losses exceed gross profits in the uploaded sample.');
  if(stress.stressMaxDrawdown>Math.max(observedMaxDrawdown*1.35,averageAbsolute*8))warnings.push('Sequence risk: reordered trades produce a materially larger stress drawdown.');
  if(!warnings.length)warnings.push('No primary heuristic warning fired; this does not prove future robustness.');
  const limitations=Object.freeze([
    'Scores are deterministic prototype heuristics, not calibrated probabilities or performance forecasts.',
    'Sequence stress reorders the uploaded trades; it does not model regime shifts, slippage, liquidity or unseen market conditions.',
    'Fractional-Kelly research ranges use historical win rate and payoff only and are capped at 5% of capital.',
    'No trade is executed and no personalized financial recommendation is produced.'
  ]);
  return Object.freeze({
    schemaVersion:1,
    product:'Qelly Verify',
    generatedAt:new Date().toISOString(),
    sourceName:String(sourceName||'Local strategy CSV').slice(0,180),
    truthState:'DETERMINISTIC LOCAL ANALYSIS',
    sample:Object.freeze({trades:values.length,wins:wins.length,losses:losses.length,flat}),
    performance:Object.freeze({
      netProfit:round(netProfit),
      grossProfit:round(grossProfit),
      grossLoss:round(grossLoss),
      winRate:round(winRate*100),
      averageWin:round(averageWin),
      averageLoss:round(averageLoss),
      payoffRatio:round(payoffRatio),
      expectancy:round(expectancy),
      profitFactor:Number.isFinite(profitFactor)?round(profitFactor):null,
      returnDispersion:round(standardDeviation(values)),
      maxDrawdown:round(observedMaxDrawdown),
      longestLosingStreak:lossStreak,
      firstHalfExpectancy:round(firstExpectancy),
      secondHalfExpectancy:round(secondExpectancy),
      topThreeConcentration:round(concentration*100)
    }),
    scores:Object.freeze({
      strategyQuality:Object.freeze({value:qualityScore,band:scoreBand(qualityScore)}),
      robustness:Object.freeze({value:robustnessScore,band:scoreBand(robustnessScore)}),
      overfittingRisk:Object.freeze({value:overfittingRisk,band:riskBand(overfittingRisk)})
    }),
    allocation:Object.freeze({
      rawKelly:round(rawKelly*100),
      constrainedFractionalKellyLow:round(constrainedLow*100),
      constrainedFractionalKellyHigh:round(Math.max(constrainedLow,constrainedHigh)*100),
      status:rawKelly>0?'research-range-available':'no-positive-range'
    }),
    stress:Object.freeze(stress),
    warnings:Object.freeze(warnings),
    limitations
  });
}

export function sampleTradeCsv(){
  const rows=['ticket,symbol,side,open_time,close_time,net_profit'];
  for(let index=1;index<=80;index+=1){
    const cycle=Math.sin(index*.77)*42+Math.cos(index*.21)*18;
    const regime=index<22?-11:index<55?17:5;
    const shock=[13,29,46,67].includes(index)?-95:[18,38,58,76].includes(index)?128:0;
    const pnl=round(cycle+regime+shock);
    rows.push(`${1000+index},BTCUSD,${index%3===0?'sell':'buy'},2026-05-${String((index%28)+1).padStart(2,'0')} 09:00,2026-05-${String((index%28)+1).padStart(2,'0')} 12:00,${pnl}`);
  }
  return rows.join('\n');
}

export const __qellyVerifyTest=Object.freeze({
  MAX_ROWS,
  aliases,
  detectDelimiter,
  parseDelimitedLine,
  numericValue,
  maxDrawdown,
  longestLosingStreak,
  sequenceStress,
  percentile,
  clamp,
  SCORE_MIN,
  SCORE_MAX
});
