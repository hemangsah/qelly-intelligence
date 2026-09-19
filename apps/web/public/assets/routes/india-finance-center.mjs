import {mountTradingViewWidget,tradingViewAppearance} from '../market/tradingview-display-widget.mjs';
import {adSlot,mountAdSlots} from '../qelly-ad-slot.mjs';
import { calculateFormula, listFormulaDefinitions } from '../calculation/formula-engine-extended.mjs';
import { INDIA_RULE_REGISTRY, selectIndiaRule, calculateCustomIndiaCharges } from '../calculation/india-rules.mjs';
import { saveCalculation, resultToCsv } from '../calculation/persistence.mjs';
const INDIA_STYLESHEET=new URL('./india-finance-center.css',import.meta.url).href;
const installIndiaStyles=()=>{if(document.querySelector('link[data-india-finance]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=INDIA_STYLESHEET;link.dataset.indiaFinance='consumer-v1';document.head.append(link);};

const EXAMPLES={
  'sip-future-value':{monthlyContribution:25000,annualReturnPercent:12,years:15,timing:'end'},
  'step-up-sip':{monthlyContribution:25000,annualReturnPercent:12,years:15,annualStepUpPercent:10},
  'lump-sum-future-value':{principal:500000,annualReturnPercent:11,years:10,compoundsPerYear:1},
  'swp-schedule':{initialBalance:5000000,monthlyWithdrawal:40000,annualReturnPercent:8,months:120},
  'goal-planner':{currentSavings:500000,goalAmount:5000000,inflationPercent:6,annualReturnPercent:11,years:12},
  'loan-emi':{principal:5000000,annualRatePercent:8.5,months:240},
  'loan-amortization':{principal:5000000,annualRatePercent:8.5,months:240},
  'loan-prepayment':{principal:5000000,annualRatePercent:8.5,months:240,prepaymentMonth:24,prepaymentAmount:500000},
  'simple-interest':{principal:100000,annualRatePercent:7.5,years:5},
  'compound-interest':{principal:100000,annualRatePercent:7.5,years:5,compoundsPerYear:4},
  'fresh-india-tax-gross-up':{netAmount:900,taxRate:0.1},
  xirr:{cashflows:[{amount:-100000,date:'2024-01-01'},{amount:-25000,date:'2024-07-01'},{amount:150000,date:'2025-06-30'}]}
};
const fmt=(value)=>typeof value==='number'?new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(value):String(value??'—');
const rows=(output)=>Object.entries(output??{}).filter(([,value])=>!(Array.isArray(value)||value&&typeof value==='object'));
const download=(name,content,type)=>{const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);};

export async function renderIndiaFinanceCenter(main,{pageHead,escapeHtml,toast}){
  installIndiaStyles();
  const formulas=listFormulaDefinitions({domain:'india-finance'});
  main.innerHTML=`<section class="q-page q-india-finance-page">
    ${pageHead('Qelly India finance','India Finance & SIP Center','Plan goals, investments and loans with Indian number formatting, then follow live India market movers and headlines in one public workspace.',`<span class="q-status q-status--live">PUBLIC · NO SIGN-IN</span>`)}
    <div class="q-state-banner is-simulated"><span class="q-status q-status--simulated">RESEARCH ONLY</span><p>Calculators run privately in this browser. Market panels are live external research displays. QELLY does not invent missing statutory rates or guarantee outcomes.</p></div>
    <div class="q-india-grid">
      <section class="q-panel">
        <div class="q-panel-head"><div><h2>Investment and loan calculators</h2><p>${formulas.length} goal, return and borrowing tools</p></div></div>
        <div class="q-panel-body">
          <label class="q-field"><span>Calculator</span><select id="india-formula">${formulas.map(item=>`<option value="${item.formulaId}">${escapeHtml(item.name)}</option>`).join('')}</select></label>
          <label class="q-field"><span>Inputs (JSON)</span><textarea id="india-input" rows="13" spellcheck="false"></textarea></label>
          <div id="india-errors" class="q-form-errors" role="alert" aria-live="polite"></div>
          <div class="q-actions"><button class="q-button q-button--primary" data-action="calculate">Calculate</button><button class="q-button q-button--secondary" data-action="reset">Reset</button><button class="q-button q-button--ghost" data-action="save" disabled>Save locally</button><button class="q-button q-button--ghost" data-action="csv" disabled>Export CSV</button></div>
        </div>
      </section>
      <section class="q-panel">
        <div class="q-panel-head"><div><h2>Your result</h2><p id="india-summary">Choose a calculation and run it locally.</p></div></div>
        <div class="q-panel-body"><div class="q-result-priority"><h3 id="india-primary">Ready</h3><p>INR values use Indian grouping for display; canonical stored values remain plain numbers.</p></div><div class="q-table-shell"><table class="q-table"><thead><tr><th>Output</th><th>Value</th></tr></thead><tbody id="india-results"><tr><td colspan="2">No result yet</td></tr></tbody></table></div><details><summary>Calculation details</summary><pre id="india-evidence">No evidence yet.</pre></details></div>
      </section>
      <section class="q-panel q-india-market-pulse">
        <div class="q-panel-head"><div><p class="q-eyebrow">LIVE INDIA FINANCE</p><h2>Movers, benchmarks and market news</h2><p>Explore NSE and BSE market activity, Nifty and Sensex context, USD/INR and current India-focused headlines.</p></div><span class="q-status q-status--live">LIVE DISPLAY</span></div>
        <div class="q-panel-body"><div class="q-india-live-grid"><div><h3>India market movers</h3><div class="q-india-widget q-india-widget--screener" data-india-screener></div></div><div><h3>Benchmarks & rupee</h3><div class="q-india-widget" data-india-quotes></div></div></div><div><h3>India market headlines</h3><div class="q-india-widget q-india-widget--stories" data-india-stories></div></div><div class="q-actions"><a class="q-button q-button--secondary" href="https://www.nseindia.com/market-data/live-equity-market" target="_blank" rel="noopener noreferrer nofollow">NSE market data ↗</a><a class="q-button q-button--secondary" href="https://www.rbi.org.in/" target="_blank" rel="noopener noreferrer nofollow">RBI ↗</a><a class="q-button q-button--secondary" href="https://www.sebi.gov.in/" target="_blank" rel="noopener noreferrer nofollow">SEBI ↗</a></div></div>
      </section>
      ${adSlot('india-finance-inline')}
      <details class="q-panel q-india-methodology"><summary>Rates, sources and calculation method</summary><div class="q-panel-body"><p>Current statutory rates are used only after a primary source is verified. Stale rates are not reused, and custom rates remain clearly labelled.</p><ul>${INDIA_RULE_REGISTRY.rules.map(rule=>`<li><strong>${escapeHtml(rule.name)}</strong> · ${escapeHtml(rule.sourceAuthority)} · effective ${rule.effectiveFrom}</li>`).join('')}</ul></div></details>
      <section class="q-panel q-india-charges">
        <div class="q-panel-head"><div><h2>Custom India trading costs</h2><p>Enter current broker, exchange and statutory charges yourself. No broker fee is universal.</p></div></div>
        <div class="q-panel-body"><div class="q-charge-fields">${['turnover','brokerage','exchangeCharges','stt','ctt','sebiCharges','stampDuty','dpCharges','otherCharges'].map(name=>`<label class="q-field"><span>${escapeHtml(name.replace(/([A-Z])/g,' $1'))}</span><input type="number" min="0" step="any" value="0" data-charge="${name}"></label>`).join('')}<label class="q-field"><span>GST rate (%)</span><input type="number" min="0" step="any" value="18" data-charge="gstRatePercent"></label></div><button class="q-button q-button--secondary" data-action="charges">Calculate custom charges</button><pre id="charge-result">User-entered rates only.</pre></div>
      </section>
    </div>
  </section>`;
  mountAdSlots(main);
  const appearance=tradingViewAppearance();const shared={autosize:true,width:'100%',height:'100%',colorTheme:appearance,locale:'en',isTransparent:false};
  const indiaWidgets=[
    mountTradingViewWidget(main.querySelector('[data-india-screener]'),{kind:'screener',label:'India market movers',openUrl:'https://www.tradingview.com/markets/stocks-india/market-movers-all-stocks/',config:{...shared,market:'india',defaultColumn:'overview',showToolbar:true}}),
    mountTradingViewWidget(main.querySelector('[data-india-quotes]'),{kind:'marketQuotes',label:'India benchmarks and rupee',openUrl:'https://www.tradingview.com/markets/indices/quotes-india/',config:{...shared,symbolGroups:[{name:'India',symbols:[{name:'NSE:NIFTY',displayName:'Nifty 50'},{name:'BSE:SENSEX',displayName:'Sensex'},{name:'NSE:BANKNIFTY',displayName:'Bank Nifty'},{name:'FX_IDC:USDINR',displayName:'USD / INR'},{name:'MCX:GOLD1!',displayName:'Gold'}]}],showSymbolLogo:true}}),
    mountTradingViewWidget(main.querySelector('[data-india-stories]'),{kind:'topStories',label:'India market headlines',openUrl:'https://www.tradingview.com/news/markets/india/',config:{...shared,feedMode:'market',market:'stock',isTransparent:false}})
  ];window.__qellyIndiaFinanceCleanup=()=>indiaWidgets.forEach(widget=>widget?.destroy?.());
  let result=null;
  const select=main.querySelector('#india-formula'),editor=main.querySelector('#india-input');
  const setActions=(enabled)=>main.querySelectorAll('[data-action="save"],[data-action="csv"]').forEach(button=>button.disabled=!enabled);
  const clearResult=()=>{result=null;main.querySelector('#india-primary').textContent='Ready';main.querySelector('#india-summary').textContent='Choose a calculation and run it locally.';main.querySelector('#india-results').innerHTML='<tr><td colspan="2">No result yet</td></tr>';main.querySelector('#india-evidence').textContent='No evidence yet.';setActions(false);};
  const reset=()=>{editor.value=JSON.stringify(EXAMPLES[select.value]??{},null,2);main.querySelector('#india-errors').textContent='';clearResult();};
  const run=()=>{clearResult();let input;try{input=JSON.parse(editor.value);}catch(error){main.querySelector('#india-errors').textContent=`Invalid JSON: ${error.message}`;return;}result=calculateFormula(select.value,input,{assumptions:['Indian number grouping affects display only; calculation values remain canonical.']});if(result.status!=='success'){main.querySelector('#india-errors').innerHTML=result.validationErrors.map(item=>`<p>${escapeHtml(item.field??'Input')}: ${escapeHtml(item.message)}</p>`).join('');return;}main.querySelector('#india-errors').textContent='';const outputRows=rows(result.outputs);main.querySelector('#india-results').innerHTML=outputRows.map(([key,value])=>`<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(fmt(value))}</td></tr>`).join('')||'<tr><td colspan="2">Structured schedule available in evidence JSON.</td></tr>';const primary=outputRows.find(([,value])=>typeof value==='number');main.querySelector('#india-primary').textContent=primary?`${primary[0]}: ${fmt(primary[1])}`:'Calculation complete';main.querySelector('#india-summary').textContent=`${result.formulaId} · version ${result.formulaVersion} · deterministic local`;main.querySelector('#india-evidence').textContent=JSON.stringify(result,null,2);setActions(true);toast('India finance calculation completed locally',{tone:'success'});};
  select.addEventListener('change',reset);main.querySelector('[data-action="calculate"]').addEventListener('click',run);main.querySelector('[data-action="reset"]').addEventListener('click',reset);main.querySelector('[data-action="save"]').addEventListener('click',()=>{saveCalculation({name:`India · ${select.options[select.selectedIndex].text}`,result});toast('Saved in this browser only',{tone:'success'});});main.querySelector('[data-action="csv"]').addEventListener('click',()=>download(`qelly-${select.value}.csv`,resultToCsv(result),'text/csv'));
  main.querySelector('[data-action="charges"]').addEventListener('click',()=>{try{const input=Object.fromEntries([...main.querySelectorAll('[data-charge]')].map(element=>[element.dataset.charge,element.value]));const charges=calculateCustomIndiaCharges(input);main.querySelector('#charge-result').textContent=JSON.stringify(charges,null,2);toast('Custom charges calculated from user-entered values',{tone:'success'});}catch(error){main.querySelector('#charge-result').textContent=error.message;}});
  select.value='sip-future-value';reset();selectIndiaRule('india-tax-framework');
}
