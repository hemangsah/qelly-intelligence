import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeGrowthEvent,createGrowthAnalytics,recordRecentActivity,readRecentActivity,readPinnedActivity,togglePinnedActivity,updateGrowthConsent,isGrowthOpenTarget,recentDescriptorFromHash} from '../apps/web/public/assets/qelly-growth-runtime.mjs';

const memoryStorage=()=>{const values=new Map();return{getItem:(key)=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};};

test('growth events accept only coarse allowlisted properties',()=>{
  const event=sanitizeGrowthEvent({name:'calculator_complete',properties:{route:'calculator-detail',feature:'retirement',query:'secret search',value:'42000',email:'person@example.com'}} ,0);
  assert.deepEqual(event,{name:'calculator_complete',properties:{route:'calculator-detail',feature:'retirement'},occurredAt:'1970-01-01T00:00:00.000Z'});
  assert.equal(sanitizeGrowthEvent({name:'keystroke',properties:{}}),null);
  assert.equal(sanitizeGrowthEvent({name:'asset_search',properties:{route:'search',feature:'BTC USD'}})?.properties.feature,undefined);
});

test('analytics is disabled without explicit consent and honors global privacy control',async()=>{
  const storage=memoryStorage();let requests=0;
  const analytics=createGrowthAnalytics({config:{enabled:true,endpoint:'/api/v1/analytics/events'},storage,navigatorObject:{doNotTrack:'0'},fetchImpl:async()=>{requests+=1;return{ok:true};},now:()=>0});
  assert.equal(analytics.track('route_view',{route:'market'}),false);
  updateGrowthConsent(true,storage);
  assert.equal(analytics.track('route_view',{route:'market'}),true);
  await analytics.flush();assert.equal(requests,1);
  const privateAnalytics=createGrowthAnalytics({config:{enabled:true},storage,navigatorObject:{globalPrivacyControl:true}});
  assert.equal(privateAnalytics.track('route_view',{route:'market'}),false);
});

test('recent activity stays bounded, local and de-duplicated by privacy-safe key',()=>{
  const storage=memoryStorage();
  for(let index=0;index<12;index+=1)recordRecentActivity({route:`tool-${index}`,key:`tool-${index}`,href:`#/tool-${index}`,label:`Tool ${index}`,kind:'calculator'},storage,index);
  recordRecentActivity({route:'tool-5',key:'tool-5',href:'#/tool-5',label:'Tool five',kind:'calculator'},storage,20);
  const recent=readRecentActivity(storage);
  assert.equal(recent.length,8);assert.equal(recent[0].key,'tool-5');assert.equal(recent.filter((item)=>item.key==='tool-5').length,1);
});

test('recent activity uses privacy-safe taxonomy tokens',()=>{
  const storage=memoryStorage();
  assert.equal(recordRecentActivity({route:'decision-provenance',label:'Decision Intelligence',kind:'decision_intelligence'},storage,0).length,1);
  assert.equal(recordRecentActivity({route:'market',label:'Markets',kind:'research page'},storage,1).length,0);
});

test('recent descriptors keep distinct assets and calculators local without widening analytics route taxonomy',()=>{
  assert.deepEqual(recentDescriptorFromHash('#/asset/QI-CRYPTO-BTC'),{route:'asset',key:'asset:btc',href:'#/asset/QI-CRYPTO-BTC',label:'BTC · Asset Dossier',kind:'asset'});
  assert.deepEqual(recentDescriptorFromHash('#/asset/QI-CRYPTO-ETH'),{route:'asset',key:'asset:eth',href:'#/asset/QI-CRYPTO-ETH',label:'ETH · Asset Dossier',kind:'asset'});
  assert.deepEqual(recentDescriptorFromHash('#/calculator-detail/kelly-criterion-calculator?source=research'),{route:'calculator-detail',key:'calculator:kelly-criterion-calculator',href:'#/calculator-detail/kelly-criterion-calculator',label:'Kelly Criterion Calculator · Calculator',kind:'calculator'});
});

test('recent activity preserves separate assets and calculators while de-duplicating the same detail',()=>{
  const storage=memoryStorage();
  recordRecentActivity(recentDescriptorFromHash('#/asset/QI-CRYPTO-BTC'),storage,1);
  recordRecentActivity(recentDescriptorFromHash('#/asset/QI-CRYPTO-ETH'),storage,2);
  recordRecentActivity(recentDescriptorFromHash('#/calculator-detail/volatility-calculator'),storage,3);
  recordRecentActivity(recentDescriptorFromHash('#/asset/QI-CRYPTO-BTC'),storage,4);
  const recent=readRecentActivity(storage);
  assert.equal(recent.length,3);
  assert.deepEqual(recent.map((item)=>item.key),['asset:btc','calculator:volatility-calculator','asset:eth']);
  assert.equal(recent[0].href,'#/asset/QI-CRYPTO-BTC');
});

test('pinned tools stay browser-local, bounded and toggle by exact safe key',()=>{
  const storage=memoryStorage();
  const btc=recentDescriptorFromHash('#/asset/QI-CRYPTO-BTC');
  const eth=recentDescriptorFromHash('#/asset/QI-CRYPTO-ETH');
  togglePinnedActivity(btc,storage);
  togglePinnedActivity(eth,storage);
  let pinned=readPinnedActivity(storage);
  assert.deepEqual(pinned.map((item)=>item.key),['asset:eth','asset:btc']);
  assert.equal(pinned[0].href,'#/asset/QI-CRYPTO-ETH');
  togglePinnedActivity(btc,storage);
  pinned=readPinnedActivity(storage);
  assert.deepEqual(pinned.map((item)=>item.key),['asset:eth']);
  for(let index=0;index<8;index+=1)togglePinnedActivity({route:'calculator-detail',key:'calculator:tool-'+index,href:'#/calculator-detail/tool-'+index,label:'Tool '+index,kind:'calculator'},storage);
  assert.equal(readPinnedActivity(storage).length,6);
});

test('pinned tools reject unsafe href and invalid taxonomy',()=>{
  const storage=memoryStorage();
  togglePinnedActivity({route:'market',key:'market',href:'https://evil.example/',label:'Market',kind:'research_page'},storage);
  togglePinnedActivity({route:'market',key:'market',href:'#/market',label:'Market',kind:'research page'},storage);
  assert.equal(readPinnedActivity(storage).length,0);
});

test('recent activity trigger survives shell button replacement',()=>{
  const trigger={closest:(selector)=>selector==='[data-growth-open]'?trigger:null};
  assert.equal(isGrowthOpenTarget(trigger),true);
  assert.equal(isGrowthOpenTarget({closest:()=>null}),false);
});
