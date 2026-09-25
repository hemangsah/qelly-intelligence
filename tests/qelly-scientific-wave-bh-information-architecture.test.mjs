import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeDefinitions,productDomains} from '../apps/web/public/assets/route-registry.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const routeRows=()=>routeDefinitions.map((item,index)=>({
  index:index+1,
  route:item.route,
  label:item.label,
  section:item.section,
  public:Boolean(item.public),
  implementation:'runnable-route'
}));
const csv=(rows,columns)=>[columns.join(','),...rows.map(row=>columns.map(key=>`"${String(row[key]??'').replaceAll('"','""')}"`).join(','))].join('\n')+'\n';

test('Wave BH committed route inventories exactly match the canonical route registry',async()=>{
  const [jsonText,csvText]=await Promise.all([
    read('artifacts/QELLY_ROUTE_INVENTORY.json'),
    read('artifacts/QELLY_ROUTE_INVENTORY.csv')
  ]);
  const inventory=JSON.parse(jsonText);
  const rows=routeRows();
  assert.equal(rows.length,71);
  assert.equal(inventory.count,rows.length);
  assert.deepEqual(inventory.items,rows);
  assert.equal(csvText,csv(rows,['index','route','label','section','public','implementation']));
});

test('Wave BH route identities and visible labels are unique and every route has an explicit purpose/use case',()=>{
  const routeIds=routeDefinitions.map(item=>item.route);
  const labels=routeDefinitions.map(item=>item.label);
  assert.equal(new Set(routeIds).size,routeIds.length);
  assert.equal(new Set(labels).size,labels.length);
  for(const item of routeDefinitions){
    assert.equal(typeof item.purpose,'string',`${item.route} purpose`);
    assert.ok(item.purpose.trim().length>=8,`${item.route} purpose`);
    assert.equal(typeof item.useCase,'string',`${item.route} useCase`);
    assert.ok(item.useCase.trim().length>=8,`${item.route} useCase`);
    assert.ok(item.domain,`${item.route} domain`);
    assert.ok(item.kind,`${item.route} kind`);
  }
});

test('Wave BH priority research surfaces use canonical public labels and access states',()=>{
  const expected={
    market:['Market Command',true],
    'decision-provenance':['Decision Intelligence',true],
    'formula-screener':['Formula Screener',true],
    asset:['Asset Dossier',true],
    'news-research':['Qelly Chat & Research',true],
    search:['Universal Search',true],
    'india-finance':['India Finance & SIP',true],
    'alert-center':['Alert Rules',true],
    'notification-center':['Notifications',true],
    'qelly-verify':['Qelly Verify',true],
    'calculator-center':['Quant Calculator Center',true]
  };
  for(const [route,[label,isPublic]] of Object.entries(expected)){
    const item=routeDefinitions.find(value=>value.route===route);
    assert.ok(item,route);
    assert.equal(item.label,label,route);
    assert.equal(Boolean(item.public),isPublic,route);
  }
});

test('Wave BH product-domain defaults provide the master-prompt Home/Markets/Research/Evidence entry points',()=>{
  const byId=new Map(productDomains.map(item=>[item.id,item]));
  assert.equal(byId.get('home')?.defaultRoute,'feature-universe');
  assert.equal(byId.get('markets')?.defaultRoute,'market');
  assert.equal(byId.get('research')?.defaultRoute,'news-research');
  assert.equal(byId.get('evidence')?.defaultRoute,'decision-provenance');
  assert.equal(byId.get('tools')?.defaultRoute,'calculator-center');
  assert.equal(byId.get('workspaces')?.defaultRoute,'watchlist');
  for(const domain of productDomains){
    assert.ok(domain.label&&domain.shortLabel&&domain.defaultRoute,domain.id);
    assert.ok(routeDefinitions.some(item=>item.route===domain.defaultRoute),domain.id+' default route');
  }
});

test('Wave BH generated inventory no longer carries retired public/private or label truth',async()=>{
  const inventory=JSON.parse(await read('artifacts/QELLY_ROUTE_INVENTORY.json'));
  const byRoute=new Map(inventory.items.map(item=>[item.route,item]));
  assert.equal(byRoute.get('decision-provenance')?.label,'Decision Intelligence');
  assert.equal(byRoute.get('decision-provenance')?.public,true);
  assert.equal(byRoute.get('trust-center')?.label,'Research Methodology');
  assert.equal(byRoute.get('trust-center')?.public,true);
  for(const route of ['discovery-hub','formula-screener','category-detail','venue-detail','research-article']){
    assert.equal(byRoute.get(route)?.public,true,route);
  }
  assert.equal(inventory.items.some(item=>item.label==='Decision Provenance'),false);
  assert.equal(inventory.items.some(item=>item.label==='Trust Center'),false);
});

test('Wave BH inventory generator remains registry-owned instead of maintaining a second route list',async()=>{
  const source=await read('scripts/build-product-inventory.mjs');
  assert.match(source,/registry\.routeDefinitions\.map/);
  assert.match(source,/QELLY_ROUTE_INVENTORY\.json/);
  assert.match(source,/QELLY_ROUTE_INVENTORY\.csv/);
  assert.doesNotMatch(source,/const\s+routeRows\s*=\s*\[/);
});
