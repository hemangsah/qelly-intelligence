import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionAssetEvidenceProfile,decisionEvidenceProfileCatalog,evidenceProfileDefinition} from '../functions/_lib/decision-asset-evidence-profiles.js';
import {decisionAssetCapabilities} from '../functions/_lib/decision-asset-capabilities.js';

test('Wave BY defines market-specific evidence profiles without making unsupported classes selectable',()=>{
  const catalog=decisionEvidenceProfileCatalog();
  const ids=catalog.map(item=>item.id);
  for(const id of ['crypto','fx','indian-equities','global-equities','indices','metals-commodities','rates-bonds','etfs'])assert.ok(ids.includes(id),id);
  assert.match(evidenceProfileDefinition('crypto').description,/derivatives|liquidity/i);
  assert.match(evidenceProfileDefinition('fx').description,/central-bank|rates/i);
  assert.match(evidenceProfileDefinition('indian-equities').description,/corporate actions|exchange disclosures/i);
  assert.match(evidenceProfileDefinition('global-equities').description,/earnings|filings/i);
  assert.match(evidenceProfileDefinition('indices').description,/breadth|sector contribution/i);
  assert.match(evidenceProfileDefinition('metals').description,/inventories|geopolitical/i);
  const assets=decisionAssetCapabilities();
  assert.deepEqual(assets.selectableSymbols,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
  assert.equal(assets.groups.find(group=>group.id==='forex').selectable,false);
  assert.equal(assets.groups.find(group=>group.id==='indian-equities').selectable,false);
  assert.equal(assets.groups.find(group=>group.id==='global-equities').selectable,false);
});

test('Wave BY active crypto profile reports real availability and unavailable evidence without inventing it',()=>{
  const profile=buildDecisionAssetEvidenceProfile({
    assetClass:'crypto',
    graph:{market:{candles:[{}]},quant:{structure:{state:'TREND'} }},
    multiTimeframe:{agreement:{total:4}},
    evidence:{
      derivatives:{state:'live'},liquidity:{state:'live'},news:{state:'pending'},eventRisk:{state:'unavailable'},
      crossAsset:{state:'available'},macro:{state:'available'},onChain:{state:'unavailable'},options:{state:'unavailable'},
      institutionalFlow:{state:'unavailable'},fundamentals:{state:'unavailable'}
    }
  });
  assert.equal(profile.profileId,'crypto');
  assert.equal(profile.active,true);
  assert.equal(profile.modules.find(item=>item.id==='derivatives').state,'AVAILABLE');
  assert.equal(profile.modules.find(item=>item.id==='news-events').state,'PARTIAL');
  assert.equal(profile.modules.find(item=>item.id==='on-chain').state,'UNAVAILABLE');
  assert.equal(profile.modules.find(item=>item.id==='exchange-flow').state,'UNAVAILABLE');
  assert.match(profile.boundary,/do not invent missing data/i);
  assert.match(profile.weightingBoundary,/not a new score|not a new.*probability/i);
});

test('Wave BY non-active profiles disclose source requirements rather than fake evidence',()=>{
  for(const assetClass of ['fx','indian-equities','global-equities','indices','metals-commodities','rates-bonds','etfs']){
    const profile=buildDecisionAssetEvidenceProfile({assetClass,evidence:{}});
    assert.equal(profile.active,false);
    assert.ok(profile.modules.length>=5);
    assert.ok(profile.modules.every(item=>item.state==='UNAVAILABLE'));
    assert.ok(profile.modules.every(item=>item.sourceRequirement));
  }
});
