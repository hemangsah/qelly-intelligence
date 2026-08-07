import test from 'node:test';
import assert from 'node:assert/strict';
import {buildShellContext,REQUIRED_EVIDENCE_FIELDS} from '../functions/_lib/shell-context.js';
import {deriveTerminalShellState} from '../apps/web/public/assets/terminal-shell-context.mjs';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const text=(relative)=>readFile(new URL(relative,root),'utf8');

test('backend shell context exposes evidence policy and immutable read-only guardrails',()=>{
  const context=buildShellContext({
    workspace:{workspaceId:'workspace-1',name:'Research Desk'},
    profile:{timezone:'Asia/Kolkata',base_currency:'INR'},
    session:{assurance:'email',expiresAt:'2026-08-08T00:00:00.000Z'}
  },{
    environment:'cloudflare-pages-preview',
    releaseSha:'1234567890abcdef',
    capabilities:{liveProviders:true,cloudSync:true}
  });
  assert.deepEqual(context.evidencePolicy.requiredFields,REQUIRED_EVIDENCE_FIELDS);
  assert.equal(context.evidencePolicy.requiredFields.length,12);
  assert.equal(context.evidencePolicy.contradictionsFirstClass,true);
  assert.equal(context.evidencePolicy.missingEvidence,'preserve-missing');
  assert.equal(context.defaults.timezone,'Asia/Kolkata');
  assert.equal(context.defaults.baseCurrency,'INR');
  assert.equal(context.safety.readOnly,true);
  assert.equal(context.safety.tradeExecution,false);
  assert.equal(context.safety.custody,false);
  assert.equal(context.safety.transfers,false);
  assert.equal(context.safety.secretsSerialized,false);
  assert.equal(JSON.stringify(context).includes('private'),false);
});

test('terminal shell derives typed route context without inventing production evidence',()=>{
  const model=deriveTerminalShellState({
    hash:'#/asset/QI-CRYPTO-BTC',
    rootDataset:{timeframe:'1D'},
    config:{release:'abcdef123456',cloud:{providerRuntime:true},capabilityTruth:{persistentJobs:false,productionNotifications:false}},
    identity:{
      workspace:{name:'Research Desk'},
      session:{assurance:'email'},
      shell:{defaults:{timezone:'Asia/Kolkata',baseCurrency:'INR'},system:{environment:'preview',releaseSha:'abcdef123456'},evidencePolicy:{requiredFields:REQUIRED_EVIDENCE_FIELDS,contradictionsFirstClass:true},safety:{secretsSerialized:false}}
    }
  });
  assert.equal(model.context.type,'Instrument');
  assert.equal(model.context.object,'QI-CRYPTO-BTC');
  assert.equal(model.context.timeframe,'1D');
  assert.equal(model.context.source,'Panel-owned evidence');
  assert.equal(model.context.freshness,'Inspect panel');
  assert.equal(model.context.confidence,'Inspect evidence');
  assert.equal(model.system.timezone,'Asia/Kolkata');
  assert.equal(model.system.baseCurrency,'INR');
  assert.equal(model.system.readOnly,true);
  assert.equal(model.policy.contradictionsFirstClass,true);
  assert.equal(model.policy.secretsSerialized,false);
});

test('static preview shell remains explicit demonstration evidence',()=>{
  const model=deriveTerminalShellState({hash:'#/market',rootDataset:{timeframe:'1H'},staticVisualPreview:true});
  assert.equal(model.context.type,'Instrument');
  assert.equal(model.context.source,'Qelly deterministic demonstration');
  assert.equal(model.context.freshness,'Simulated');
  assert.equal(model.context.confidence,'Not assessed');
  assert.equal(model.system.session,'Anonymous');
  assert.equal(model.system.providers,'Unavailable');
});

test('legacy calculator alias resolves into the governed quant-model shell context',()=>{
  const model=deriveTerminalShellState({hash:'#/quant-calculator'});
  assert.equal(model.context.type,'Quant model');
  assert.equal(model.context.object,'Quant Calculator Center');
});

test('frontend exposes one governed seven-layer shell and intelligence inspector contract',async()=>{
  const [index,shell,styles,runtime]=await Promise.all([
    text('apps/web/public/index.html'),
    text('apps/web/public/assets/shell-foundations.mjs'),
    text('apps/web/public/assets/terminal-shell-context.css'),
    text('apps/web/public/assets/terminal-shell-context.mjs')
  ]);
  for(const marker of ['q-global-strip','q-command-bar','q-rail','context-shelf','main','context-drawer','compare-tray'])assert.match(index,new RegExp(marker));
  assert.match(index,/Intelligence Inspector/);
  assert.match(index,/terminal-shell-context\.mjs/);
  assert.match(index,/terminal-shell-context\.css/);
  assert.match(shell,/shell-context-contract/);
  assert.match(shell,/shell-activity-contract/);
  assert.match(shell,/READ ONLY/);
  assert.match(runtime,/Explanation.*Evidence.*Contradictions.*Sources.*Assumptions.*Methodology.*Related decisions.*Audit/s);
  assert.match(styles,/q-terminal-context/);
  assert.match(styles,/q-terminal-activity/);
  assert.doesNotMatch(shell,/>\s*(Buy|Sell|Execute|Deposit|Withdraw|Transfer|Swap)\s*</i);
});
