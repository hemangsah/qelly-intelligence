import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here=path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot=path.resolve(here,'..');
const load=(relative)=>readFile(path.join(repositoryRoot,relative),'utf8');

export async function captureV53ActivationBrowserEvidence(){
  const [baseCss,refinementCss]=await Promise.all([
    load('apps/web/public/assets/qelly-ui-lock-v5-3.css'),
    load('apps/web/public/assets/qelly-v53-visible-refinement.css')
  ]);

  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.setContent(`<!doctype html>
      <html data-ui-lock-v53="active">
        <head><style>${baseCss}\n${refinementCss}</style></head>
        <body>
          <header class="q-global-strip"><span>activation probe</span></header>
          <main id="main">
            <section class="q-panel"><div class="q-panel-body">panel probe</div></section>
            <section id="series-grid"><div class="q-grid-scroll"><div style="height:1200px">series probe</div></div></section>
          </main>
        </body>
      </html>`);

    const snapshot=()=>page.evaluate(()=>{
      const root=document.documentElement;
      const strip=getComputedStyle(document.querySelector('.q-global-strip'));
      const main=getComputedStyle(document.querySelector('#main'));
      const panel=getComputedStyle(document.querySelector('.q-panel'));
      const series=getComputedStyle(document.querySelector('#series-grid .q-grid-scroll'));
      return {
        attributes:{
          actual:root.getAttribute('data-ui-lock-v53'),
          legacy:root.getAttribute('data-ui-lock-v5-3')
        },
        globalStrip:{height:strip.height,paddingInlineStart:strip.paddingInlineStart},
        main:{paddingTop:main.paddingTop,paddingInlineStart:main.paddingInlineStart,backgroundImage:main.backgroundImage},
        panel:{borderRadius:panel.borderRadius,boxShadow:panel.boxShadow},
        timeSeries:{maxHeight:series.maxHeight,overflowY:series.overflowY}
      };
    });

    const current=await snapshot();
    await page.evaluate(()=>document.documentElement.setAttribute('data-ui-lock-v5-3','active'));
    const legacyActivated=await snapshot();

    const currentTimeSeriesBounded=current.timeSeries.maxHeight!=='none'&&current.timeSeries.overflowY==='auto';
    const globalLegacyDelta=current.globalStrip.height!==legacyActivated.globalStrip.height||
      current.main.paddingTop!==legacyActivated.main.paddingTop||
      current.main.backgroundImage!==legacyActivated.main.backgroundImage||
      current.panel.boxShadow!==legacyActivated.panel.boxShadow;

    if(current.attributes.actual!=='active'||current.attributes.legacy!==null){
      throw new Error(`Unexpected current activation attributes: ${JSON.stringify(current.attributes)}`);
    }
    if(!currentTimeSeriesBounded){
      throw new Error(`Expected the route-scoped Time Series exception to be active: ${JSON.stringify(current.timeSeries)}`);
    }
    if(!globalLegacyDelta){
      throw new Error('Legacy V5.3 activation produced no computed-style delta; activation-risk probe is no longer meaningful.');
    }

    return {
      schemaVersion:1,
      viewport:{width:390,height:844},
      current,
      legacyActivated,
      assertions:{
        currentRuntimeAttributePresent:true,
        legacyAttributeAbsentByDefault:true,
        timeSeriesActualAttributeExceptionActive:currentTimeSeriesBounded,
        legacyGlobalActivationChangesComputedStyles:globalLegacyDelta
      },
      evidenceBoundary:'Synthetic browser probe using repository CSS only; no production data, provider calls, auth, execution, custody or persistence.'
    };
  }finally{
    await browser.close();
  }
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  const report=await captureV53ActivationBrowserEvidence();
  process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
}
