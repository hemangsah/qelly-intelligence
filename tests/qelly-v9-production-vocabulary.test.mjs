import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');

test('production shell does not expose a simulated runtime state',()=>{
  const index=read('apps/web/public/index.html');
  assert.equal(index.includes('value="simulated"'),false,'legacy simulated state selector must not ship');
  assert.equal(index.includes('>Simulated<'),false,'customer shell must not label a production state as Simulated');
});

test('deterministic analytical routes do not reuse simulated market semantics',()=>{
  const formula=read('apps/web/public/assets/routes/formula-detail.mjs');
  const calculator=read('apps/web/public/assets/routes/calculator-detail.mjs');
  const indicator=read('apps/web/public/assets/routes/indicator-detail.mjs');

  assert.equal(formula.includes('is-simulated'),false,'deterministic formula banner must not use simulated semantics');
  assert.equal(formula.includes('q-status--simulated'),false,'deterministic formula badge must not use simulated semantics');
  assert.ok(formula.includes('DETERMINISTIC'),'formula truth label must remain explicit');

  for(const [name,source] of [['calculator',calculator],['indicator',indicator]]){
    assert.equal(source.includes('is-simulated'),false,`${name} deterministic banner must not use simulated semantics`);
    assert.equal(source.includes('q-status--simulated'),false,`${name} local/deterministic badges must not use simulated semantics`);
    assert.ok(source.includes('data-truth-state="deterministic"'),`${name} must expose explicit deterministic truth metadata`);
    assert.ok(source.includes('data-truth-state="local"'),`${name} must expose explicit local-result truth metadata`);
  }
});

test('account profile surface distinguishes local fixture persistence without simulated or mock semantics',()=>{
  const account=read('apps/web/public/assets/routes/account-session.mjs');
  assert.equal(account.includes('q-status--simulated'),false,'account local profile status must not use simulated styling');
  assert.doesNotMatch(account,/\bsimulated\b/i,'account customer copy must not describe unsupported controls as simulated');
  assert.doesNotMatch(account,/\bmock\b/i,'account customer copy must not describe unavailable security controls as mock');
  assert.ok(account.includes("data-profile-storage=\"${cloudProfile?'secure-cloud':'this-device'}\""),'account persistence badge must expose customer-readable storage truth metadata');
  assert.ok(account.includes("cloudProfile?'live':'cached'"),'local profile fixture must use a neutral non-live status style');
});
