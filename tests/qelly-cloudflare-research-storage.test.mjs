import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__researchCloudflareTest} from '../functions/api/v1/research/[[route]].js';
import {matchUnavailableCapability} from '../functions/_lib/capability-registry.js';

const {routePath,safeScore,safeStatus,metadataFor,projectToWorkspace,revisionToVersion}=__researchCloudflareTest;

test('research route normalizes Pages catch-all workspace paths',()=>{
  assert.equal(routePath({params:{route:'workspaces'}}),'');
  assert.equal(routePath({params:{route:['workspaces','11111111-1111-4111-8111-111111111111','items']}}),'11111111-1111-4111-8111-111111111111/items');
  assert.equal(routePath({params:{route:'workspaces/abc/versions/def/restore'}}),'abc/versions/def/restore');
});

test('research input validation mirrors database truth constraints',()=>{
  assert.equal(safeScore(null,'score'),null);
  assert.equal(safeScore(0,'score'),0);
  assert.equal(safeScore(1,'score'),1);
  assert.throws(()=>safeScore(1.01,'score'),/between 0 and 1/);
  assert.equal(safeStatus('review'),'review');
  assert.throws(()=>safeStatus('published'),/status is invalid/);
  assert.deepEqual(metadataFor({description:'Evidence board',tags:['macro','rates']},{}),{description:'Evidence board',tags:['macro','rates']});
});

test('research database records map to the V6 workspace contract without inventing freshness',()=>{
  const mapped=projectToWorkspace({id:'11111111-1111-4111-8111-111111111111',title:'Rates thesis',metadata:{description:'Evidence',tags:['macro']},status:'active',hypothesis:'H',confidence:0.7,invalidation_conditions:['x'],current_revision:3,created_at:'2026-08-16T00:00:00Z',updated_at:'2026-08-16T01:00:00Z'},[{id:'22222222-2222-4222-8222-222222222222',source_type:'reference',title:'ECB',payload:{note:'Observed reference'},source_ref:'ECB',source_url:null,evidence_role:'supporting',freshness:'missing',confidence:null,coverage:null,method:null,assumptions:[],contradictions:[],limitations:[],audit_id:'33333333-3333-4333-8333-333333333333',created_at:'2026-08-16T00:30:00Z',updated_at:'2026-08-16T00:30:00Z'}]);
  assert.equal(mapped.cloudSync,true);
  assert.equal(mapped.localPersistence,false);
  assert.equal(mapped.items[0].freshness,'missing');
  assert.equal(mapped.items[0].referenceId,'ECB');
  assert.equal(mapped.revision,3);
});

test('research revision rows map to immutable audit versions',()=>{
  const mapped=revisionToVersion({id:'44444444-4444-4444-8444-444444444444',revision_no:4,snapshot:{metadata:{manualCheckpoint:{message:'IC checkpoint'}}},created_at:'2026-08-16T02:00:00Z'});
  assert.equal(mapped.sequence,4);
  assert.equal(mapped.message,'IC checkpoint');
  assert.equal(mapped.snapshotRevision,4);
});

test('research Cloudflare handler uses user-token RLS, CSRF and production tables',async()=>{
  const source=await readFile(new URL('../functions/api/v1/research/[[route]].js',import.meta.url),'utf8');
  for(const table of ['qelly_research_projects','qelly_research_evidence','qelly_research_project_revisions'])assert.match(source,new RegExp(table));
  assert.match(source,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(source,/restRequest\(env,session\.accessToken/);
  assert.match(source,/requireCsrf\(request\)/);
  assert.match(source,/requireOrigin\(request,env\)/);
  assert.match(source,/freshness:'missing'/);
  assert.doesNotMatch(source,/service[_ -]?role|SUPABASE_SERVICE/i);
  assert.equal(matchUnavailableCapability('research/workspaces'),null);
});
