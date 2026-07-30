# Qelly Prompt 2B Focused Gate Failure

- Exact workflow head: `02197e9d163f1d5276e8019ced07ef47107546b9`
- Server integration was not committed.
- One-use workflow removed after recording the complete focused-test log.

```text
TAP version 13
# Subtest: fresh formula catalog has exactly 101 unique non-colliding governed IDs
ok 1 - fresh formula catalog has exactly 101 unique non-colliding governed IDs
  ---
  duration_ms: 1.85538
  type: 'test'
  ...
# Subtest: 101 primary reference vectors and deterministic JSON repeats pass
ok 2 - 101 primary reference vectors and deterministic JSON repeats pass
  ---
  duration_ms: 14.417188
  type: 'test'
  ...
# Subtest: at least 1,000 formula fuzz cases remain bounded and serializable
ok 3 - at least 1,000 formula fuzz cases remain bounded and serializable
  ---
  duration_ms: 26.226879
  type: 'test'
  ...
# Subtest: fresh formula security and invalid-input behavior is explicit
not ok 4 - fresh formula security and invalid-input behavior is explicit
  ---
  duration_ms: 0.416645
  type: 'test'
  location: '/home/runner/work/qelly-intelligence/qelly-intelligence/tests/fresh-formula-catalog.test.mjs:53:1'
  failureType: 'testCodeFailure'
  error: 'Unsafe key rejected: __proto__'
  code: 'unsafe_key'
  name: 'FreshFormulaError'
  stack: |-
    safe (file:///home/runner/work/qelly-intelligence/qelly-intelligence/apps/web/public/assets/calculation/fresh-formula-core.mjs:8:426)
    calculateFreshFormula (file:///home/runner/work/qelly-intelligence/qelly-intelligence/apps/web/public/assets/calculation/fresh-formula-catalog.mjs:15:1118)
    TestContext.<anonymous> (file:///home/runner/work/qelly-intelligence/qelly-intelligence/tests/fresh-formula-catalog.test.mjs:55:16)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: fresh formula algebraic properties hold
ok 5 - fresh formula algebraic properties hold
  ---
  duration_ms: 0.35919
  type: 'test'
  ...
# Subtest: fresh indicator catalog has exactly 34 unique non-colliding governed IDs
ok 6 - fresh indicator catalog has exactly 34 unique non-colliding governed IDs
  ---
  duration_ms: 2.105479
  type: 'test'
  ...
# Subtest: 34 reference executions align outputs and repeat deterministically
ok 7 - 34 reference executions align outputs and repeat deterministically
  ---
  duration_ms: 21.027878
  type: 'test'
  ...
# Subtest: 340 indicator fuzz cases preserve alignment and finiteness
ok 8 - 340 indicator fuzz cases preserve alignment and finiteness
  ---
  duration_ms: 47.116298
  type: 'test'
  ...
# Subtest: constant and monotonic properties are explicit
ok 9 - constant and monotonic properties are explicit
  ---
  duration_ms: 0.654847
  type: 'test'
  ...
# Subtest: indicator security rejects unsafe keys, misalignment and invalid bars
ok 10 - indicator security rejects unsafe keys, misalignment and invalid bars
  ---
  duration_ms: 0.580638
  type: 'test'
  ...
# Subtest: representative 10,000-point indicators remain bounded
ok 11 - representative 10,000-point indicators remain bounded
  ---
  duration_ms: 83.985747
  type: 'test'
  ...
# Subtest: saved lifecycle supports reopen rename update duplicate revisions and restore
ok 12 - saved lifecycle supports reopen rename update duplicate revisions and restore
  ---
  duration_ms: 33.445664
  type: 'test'
  ...
# Subtest: saved list supports search tags favorites and deterministic sorting
ok 13 - saved list supports search tags favorites and deterministic sorting
  ---
  duration_ms: 25.448646
  type: 'test'
  ...
# Subtest: wrong user tenant and workspace cannot read mutate duplicate restore or delete
ok 14 - wrong user tenant and workspace cannot read mutate duplicate restore or delete
  ---
  duration_ms: 21.54741
  type: 'test'
  ...
# Subtest: legacy schema migrates non-destructively and preserves formula version
ok 15 - legacy schema migrates non-destructively and preserves formula version
  ---
  duration_ms: 3.439409
  type: 'test'
  ...
# Subtest: unsafe keys are rejected and missing revisions return structured errors
ok 16 - unsafe keys are rejected and missing revisions return structured errors
  ---
  duration_ms: 5.309209
  type: 'test'
  ...
# Subtest: saved calculation store enforces user, tenant and workspace isolation
ok 17 - saved calculation store enforces user, tenant and workspace isolation
  ---
  duration_ms: 10.428528
  type: 'test'
  ...
1..17
# tests 17
# suites 0
# pass 16
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 249.20665
```
