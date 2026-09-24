import {peekResearchContext,storeDecisionContext,storeResearchContext} from '../decision-context-bridge.mjs';
const ENDPOINT='/api/v1/formula-screener';

const formatNumber=(value,digits=3)=>Number.isFinite(Number(value))?Number(value).toLocaleString(undefined,{maximumFractionDigits:digits}):'Unavailable';
const formatTime=(value)=>{if(!value)return 'Unavailable';const date=new Date(value);return Number.isNaN(date.getTime())?'Unavailable':date.toLocaleString();};
const statusClass=(state)=>state==='live'||state==='available'?'fresh':state==='partial'||state==='delayed'?'cached':'unavailable';

export async function renderFormulaScreener(main,deps){
  const {api,pageHead,stateBanner,escapeHtml,QellyDataGrid,toast,navigate}=deps;
  let catalog;
  try{catalog=await api(ENDPOINT);}
  catch(error){
    main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Screening','Formula Screener','Rank supported digital assets with transparent quantitative metrics derived from recent market observations.')}${stateBanner()}<section class="q-panel"><div class="q-panel-body"><h2>Formula Screener is temporarily unavailable</h2><p>${escapeHtml(error?.message||'The public screener catalog could not be loaded. Please retry.')}</p><button class="q-button q-button--primary" data-action="retry-page">Retry</button></div></section></section>`;
    main.querySelector('[data-action="retry-page"]')?.addEventListener('click',()=>renderFormulaScreener(main,deps));
    return;
  }

  const researchContext=peekResearchContext();
  const contextAsset=catalog.assets.includes(researchContext.asset)?researchContext.asset:null;
  const contextTimeframe=researchContext.timeframe||'1h';
  const contextFormula=catalog.formulas.some((formula)=>formula.id===researchContext.formulaId)?researchContext.formulaId:null;
  const formulaOptions=catalog.formulas.map((formula)=>`<option value="${escapeHtml(formula.id)}" ${formula.id===contextFormula?'selected':''}>${escapeHtml(formula.label)}</option>`).join('');
  const assetOptions=catalog.assets.map((asset)=>`<label class="q-setting"><span>${escapeHtml(asset)}</span><input type="checkbox" data-asset="${escapeHtml(asset)}" ${!contextAsset||asset===contextAsset?'checked':''}></label>`).join('');
  const contextMarkup=contextAsset?`<div class="q-truth-callout is-compact"><span class="q-status q-status--cached">research context</span><p>Continuing <strong>${escapeHtml(contextAsset)}</strong> · ${escapeHtml(contextTimeframe)} from ${escapeHtml(String(researchContext.source||'prior research').replaceAll('-',' '))}. Formula Screener still uses its declared ${escapeHtml(catalog.source.interval)} candle method; the research timeframe is preserved only for downstream Decision/Chat handoff.</p></div>`:'';
  main.innerHTML=`<section class="q-page">
    ${pageHead('Qelly Intelligence · Screening','Formula Screener','Rank supported digital assets with transparent quantitative metrics derived from recent market observations.',`<button class="q-button q-button--primary" data-action="run">Refresh results</button>`)}
    ${stateBanner()}
    ${contextMarkup}
    <div class="q-kpi-grid">
      <article class="q-kpi"><div class="q-kpi-label">Assets</div><div class="q-kpi-value">${catalog.assets.length}</div><div class="q-kpi-meta"><span>Supported universe</span><span class="q-status q-status--fresh">Public</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Metrics</div><div class="q-kpi-value">${catalog.formulas.length}</div><div class="q-kpi-meta"><span>Bounded quantitative choices</span><span class="q-status q-status--fresh">Transparent</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Source</div><div class="q-kpi-value">Hyperliquid</div><div class="q-kpi-meta"><span>${escapeHtml(catalog.source.interval)} candles</span><span class="q-status q-status--fresh">Market data</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Available rows</div><div class="q-kpi-value" id="formula-row-count">—</div><div class="q-kpi-meta"><span id="formula-generated-at">Awaiting refresh</span><span class="q-status q-status--cached" id="formula-state">Ready</span></div></article>
    </div>
    <section class="q-panel">
      <div class="q-panel-head"><div><h2>Screen configuration</h2><p>Choose one metric and the assets you want to compare. Results are recalculated from recent public market candles.</p></div></div>
      <div class="q-panel-body">
        <div class="q-inline-form">
          <label class="q-setting"><span>Metric</span><select id="formula-choice">${formulaOptions}</select></label>
        </div>
        <div class="q-inline-form" id="formula-assets" aria-label="Assets">${assetOptions}</div>
        <p id="formula-description">${escapeHtml(catalog.formulas[0]?.description||'')}</p>
      </div>
    </section>
    <section class="q-panel">
      <div class="q-panel-head"><div><h2>Ranked results</h2><p>Unavailable assets remain explicit. Freshness is based on the most recent observed candle for each row.</p></div></div>
      <div class="q-panel-body" id="formula-error" hidden></div>
      <div id="formula-grid"></div>
    </section>
    <section class="q-panel">
      <div class="q-panel-head"><div><h2>Continue the research flow</h2><p>Screener rank is supporting evidence only. Opening an asset does not bypass calibration, multi-timeframe, liquidity, event-risk or NO TRADE gates.</p></div><span class="q-status q-status--cached">Decision → Formula → Chat</span></div>
      <div class="q-panel-body"><div class="q-inline-form"><label class="q-setting"><span>Asset</span><select id="formula-decision-asset" disabled><option>Run the screener first</option></select></label><button class="q-button q-button--primary" type="button" data-action="open-decision" disabled>Open in Decision Intelligence</button><button class="q-button q-button--secondary" type="button" data-action="open-chat" disabled>Continue in Qelly Chat</button></div><p id="formula-decision-boundary">Formula results never create trade eligibility on their own.</p></div>
    </section>
  </section>`;

  const choice=main.querySelector('#formula-choice');
  const description=main.querySelector('#formula-description');
  const errorBox=main.querySelector('#formula-error');
  const runButton=main.querySelector('[data-action="run"]');
  let lastPayload=null;
  const selectedAssets=()=>[...main.querySelectorAll('[data-asset]:checked')].map((input)=>input.dataset.asset);
  const updateDescription=()=>{description.textContent=catalog.formulas.find((formula)=>formula.id===choice.value)?.description||'';};
  choice.addEventListener('change',updateDescription);

  const renderRows=(payload)=>{
    lastPayload=payload;
    const target=main.querySelector('#formula-grid');
    target.innerHTML='';
    const rows=payload.rows.map((row,index)=>({
      rank:row.state==='available'?index+1:'—',
      asset:row.asset,
      result:row.value==null?'Unavailable':formatNumber(row.value,4),
      price:row.metrics?.lastPrice==null?'Unavailable':formatNumber(row.metrics.lastPrice,4),
      change24h:row.metrics?.change24hPct==null?'Unavailable':`${formatNumber(row.metrics.change24hPct,2)}%`,
      volatility:row.metrics?.realizedVolatilityPct==null?'Unavailable':`${formatNumber(row.metrics.realizedVolatilityPct,2)}%`,
      freshness:row.freshness?.state||'unavailable',
      observedAt:formatTime(row.source?.observedAt),
      state:row.state
    }));
    new QellyDataGrid(target,{
      caption:'Formula Screener ranked results',
      columns:[
        {key:'rank',label:'#',width:55},
        {key:'asset',label:'Asset',width:90},
        {key:'result',label:payload.formula.label,width:150,numeric:true},
        {key:'price',label:'Price',width:120,numeric:true},
        {key:'change24h',label:'24h',width:90},
        {key:'volatility',label:'Realized vol.',width:120},
        {key:'freshness',label:'Freshness',width:110,format:'status'},
        {key:'observedAt',label:'Observed',width:190},
        {key:'state',label:'State',width:110,format:'status'}
      ],
      rows
    });
    main.querySelector('#formula-row-count').textContent=String(payload.available);
    main.querySelector('#formula-generated-at').textContent=`Updated ${formatTime(payload.generatedAt)}`;
    const decisionSelect=main.querySelector('#formula-decision-asset');
    const decisionButton=main.querySelector('[data-action="open-decision"]');
    const chatButton=main.querySelector('[data-action="open-chat"]');
    const availableAssets=payload.rows.filter((row)=>row.state==='available').map((row)=>row.asset);
    decisionSelect.innerHTML=availableAssets.length?availableAssets.map((asset)=>`<option value="${escapeHtml(asset)}" ${asset===contextAsset?'selected':''}>${escapeHtml(asset)}</option>`).join(''):'<option>No available asset</option>';
    decisionSelect.disabled=!availableAssets.length;
    decisionButton.disabled=!availableAssets.length;
    chatButton.disabled=!availableAssets.length;
    main.querySelector('#formula-decision-boundary').textContent=payload.decisionBoundary?.message||'Formula results never create trade eligibility on their own.';
    const state=main.querySelector('#formula-state');
    state.textContent=payload.state==='live'?'Live':payload.state==='partial'?'Partial':'Unavailable';
    state.className=`q-status q-status--${statusClass(payload.state)}`;
  };

  const run=async()=>{
    const assets=selectedAssets();
    errorBox.hidden=true;
    errorBox.textContent='';
    if(!assets.length){
      errorBox.hidden=false;
      errorBox.textContent='Select at least one asset to run the screen.';
      return;
    }
    runButton.disabled=true;
    runButton.textContent='Refreshing…';
    try{
      const payload=await api(ENDPOINT,{method:'POST',body:JSON.stringify({formula:choice.value,assets})});
      renderRows(payload);
      toast(payload.state==='partial'?'Results refreshed with some assets unavailable':'Formula results refreshed',{tone:payload.state==='partial'?'warning':'success'});
    }catch(error){
      const state=main.querySelector('#formula-state');
      state.textContent='Unavailable';
      state.className='q-status q-status--unavailable';
      errorBox.hidden=false;
      errorBox.innerHTML=`<strong>Live results are temporarily unavailable.</strong><p>${escapeHtml(error?.message||'The market data provider could not complete this screen. Retry shortly.')}</p><button class="q-button" data-action="retry-results">Retry</button>`;
      errorBox.querySelector('[data-action="retry-results"]')?.addEventListener('click',run,{once:true});
    }finally{
      runButton.disabled=false;
      runButton.textContent='Refresh results';
    }
  };

  runButton.addEventListener('click',run);
  main.querySelector('[data-action="open-decision"]')?.addEventListener('click',()=>{
    const asset=main.querySelector('#formula-decision-asset')?.value;
    if(!storeDecisionContext({asset,timeframe:contextTimeframe,source:'formula-screener'}))return;
    navigate?.('decision-provenance');
  });
  main.querySelector('[data-action="open-chat"]')?.addEventListener('click',()=>{
    const asset=main.querySelector('#formula-decision-asset')?.value;
    const row=lastPayload?.rows?.find((item)=>item.asset===asset&&item.state==='available');
    if(!asset||!row||!storeResearchContext({asset,timeframe:contextTimeframe,source:'formula-screener',formulaId:choice.value}))return;
    navigate?.('news-research');
  });
  await run();
}
