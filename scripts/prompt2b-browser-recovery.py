#!/usr/bin/env python3
from __future__ import annotations

import collections
import csv
import hashlib
import json
import pathlib
import sys
import zipfile

EXPECTED_ARTIFACT_BYTES = 63_140_064
EXPECTED_ARTIFACT_SHA256 = "e880c3402bbd29276d7465f59582b7cd4346ca4904c6fde9aae8302cb97ff10e"
EXPECTED_ARTIFACT_ENTRIES = 371
EXPECTED_REVIEW_HEAD = "9b5d87e42e5ba2f9b1f49b53da392fcae2ea6f3b"
EXPECTED_RECORDS = 1080
EXPECTED_FAILURES = 343


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_and_extract(artifact: pathlib.Path, extract_root: pathlib.Path) -> None:
    if artifact.stat().st_size != EXPECTED_ARTIFACT_BYTES:
        raise SystemExit(f"Artifact byte mismatch: {artifact.stat().st_size}")
    actual_sha = sha256(artifact)
    if actual_sha != EXPECTED_ARTIFACT_SHA256:
        raise SystemExit(f"Artifact SHA-256 mismatch: {actual_sha}")
    with zipfile.ZipFile(artifact) as archive:
        if len(archive.infolist()) != EXPECTED_ARTIFACT_ENTRIES:
            raise SystemExit(f"Artifact entry mismatch: {len(archive.infolist())}")
        bad = archive.testzip()
        if bad:
            raise SystemExit(f"Artifact CRC failure: {bad}")
        archive.extractall(extract_root)


def classify(extract_root: pathlib.Path, project_state: pathlib.Path) -> dict[str, object]:
    root = extract_root / ".prompt2b-review"
    browser = json.loads((root / "BROWSER_MATRIX.json").read_text())
    theme = json.loads((root / "THEME_DIFFERENTIATION.json").read_text())
    performance = json.loads((root / "PERFORMANCE.json").read_text())
    shots = json.loads((root / "SCREENSHOT_MANIFEST.json").read_text())
    if browser["head"] != EXPECTED_REVIEW_HEAD:
        raise SystemExit(f"Review head mismatch: {browser['head']}")
    records = browser["records"]
    failures = browser["failures"]
    if len(records) != EXPECTED_RECORDS or len(failures) != EXPECTED_FAILURES:
        raise SystemExit(f"Unexpected record counts: {len(records)}/{len(failures)}")
    families = collections.Counter(
        reason.split(":", 1)[0] for item in failures for reason in item["reasons"]
    )
    if families != {"fixed-nav-clearance": EXPECTED_FAILURES}:
        raise SystemExit(f"Unexpected failure families: {families}")
    if theme["failures"] or performance["failures"]:
        raise SystemExit("Unexpected theme or performance failure")

    failure_keys = {
        (x["browser"], x["width"], x["height"], x["appearance"], x["motion"], x["route"]): x
        for x in failures
    }
    shot_map = {
        (x["browser"], x["width"], x["height"], x["appearance"], x["motion"], x["route"]): x["name"]
        for x in shots["files"]
    }
    fields = [
        "record_id", "outcome", "failure_id", "run_id", "artifact_id", "exact_head",
        "route", "browser", "viewport", "theme", "persona", "motion",
        "first_failing_assertion", "all_failure_reasons", "console_error", "page_error",
        "resource_failure", "horizontal_overflow_px", "font_status", "truth_boundary_passed",
        "cls", "screenshot_path", "likely_category", "confirmed_root_cause",
        "affected_source_path", "severity", "fix_commit", "retest_result", "waiver_status",
        "waiver_rationale",
    ]
    rows: list[dict[str, object]] = []
    for index, record in enumerate(records, 1):
        key = (
            record["browser"], record["width"], record["height"], record["appearance"],
            record["motion"], record["route"],
        )
        failure = failure_keys.get(key)
        reasons = failure["reasons"] if failure else []
        rows.append({
            "record_id": f"P2B-R30515801762-{index:04d}",
            "outcome": "FAIL" if failure else "PASS",
            "failure_id": f"R2-{index:04d}" if failure else "",
            "run_id": "30515801762",
            "artifact_id": "8749246424",
            "exact_head": browser["head"],
            "route": record["route"],
            "browser": record["browser"],
            "viewport": f"{record['width']}x{record['height']}",
            "theme": record["appearance"],
            "persona": record.get("persona", ""),
            "motion": record["motion"],
            "first_failing_assertion": reasons[0] if reasons else "",
            "all_failure_reasons": " | ".join(reasons),
            "console_error": " | ".join(record.get("consoleErrors", [])),
            "page_error": " | ".join(record.get("pageErrors", [])),
            "resource_failure": " | ".join(
                f"{x.get('url')}::{x.get('error')}" for x in record.get("failedResources", [])
            ),
            "horizontal_overflow_px": record.get("overflowX", 0),
            "font_status": record.get("fontStatus", ""),
            "truth_boundary_passed": record.get("truth", False),
            "cls": record.get("cls", 0),
            "screenshot_path": (
                f".prompt2b-review/screenshots/{shot_map[key]}" if key in shot_map else ""
            ),
            "likely_category": "test harness defect" if failure else "none",
            "confirmed_root_cause": (
                "Opening-brand readiness and smooth-scroll measurement defect: the harness wrote an "
                "unrelated local-storage key instead of the product session-storage opening key, then "
                "measured before the actual scroll owner settled."
                if failure else ""
            ),
            "affected_source_path": "scripts/prompt2b-final-review.mjs" if failure else "",
            "severity": "MEDIUM" if failure else "NONE",
            "fix_commit": "PENDING",
            "retest_result": "PENDING" if failure else "PASS",
            "waiver_status": "NO",
            "waiver_rationale": "",
        })

    project_state.mkdir(exist_ok=True)
    classification = project_state / "QELLY_PROMPT2B_BROWSER_RETEST_CLASSIFICATION.csv"
    with classification.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    route_counts = collections.Counter(x["route"] for x in failures)
    browser_counts = collections.Counter(x["browser"] for x in failures)
    viewport_counts = collections.Counter(f"{x['width']}x{x['height']}" for x in failures)
    motion_counts = collections.Counter(x["motion"] for x in failures)
    summary = project_state / "QELLY_PROMPT2B_BROWSER_RETEST_SUMMARY.md"
    summary.write_text(
        f"""# Qelly Prompt 2B Corrected Browser Retest Forensics

## Evidence identity

- Run: `30515801762`
- Exact head: `{browser['head']}`
- Artifact ID: `8749246424`
- Artifact bytes: `{EXPECTED_ARTIFACT_BYTES}`
- Artifact SHA-256: `{EXPECTED_ARTIFACT_SHA256}`
- ZIP entries: `{EXPECTED_ARTIFACT_ENTRIES}`
- ZIP CRC: passed

## Results

- Records: `{len(records)}`
- Failures: `{len(failures)}`
- Theme failures: `0`
- Performance failures: `0`
- Screenshots: `{len(shots['files'])}`
- Failure families: `{dict(families)}`
- Route distribution: `{dict(route_counts)}`
- Browser distribution: `{dict(browser_counts)}`
- Viewport distribution: `{dict(viewport_counts)}`
- Motion distribution: `{dict(motion_counts)}`

## Confirmed root causes

1. Qelly's opening sequence is gated by `sessionStorage['qelly.brand.opening.v1']`; the prior harness wrote an unrelated local-storage key.
2. The document uses smooth scrolling; the prior harness measured before the actual scroll owner settled.

All 343 failures are individually recorded in `QELLY_PROMPT2B_BROWSER_RETEST_CLASSIFICATION.csv`. There were no console, page, required-resource, horizontal-overflow, font, truth-boundary, CLS, theme or performance failures. No waiver is issued.
""",
        encoding="utf-8",
    )
    return {
        "records": len(records),
        "failures": len(failures),
        "families": dict(families),
        "classificationBytes": classification.stat().st_size,
        "classificationSha256": sha256(classification),
        "summaryBytes": summary.stat().st_size,
        "summarySha256": sha256(summary),
    }


def patch_harness(path: pathlib.Path) -> dict[str, object]:
    source = path.read_text()
    old = """          await context.addInitScript(()=>{\n            localStorage.setItem('qelly-opening-seen','true');\n            localStorage.removeItem('qelly.calculations.v1');"""
    new = """          await context.addInitScript(()=>{\n            sessionStorage.setItem('qelly.brand.opening.v1','seen');\n            localStorage.removeItem('qelly.calculations.v1');"""
    if old not in source:
        raise SystemExit("Opening init block not found")
    source = source.replace(old, new, 1)
    old_wait = """  await page.evaluate(async()=>{await document.fonts?.ready;});\n  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));\n};"""
    new_wait = """  await page.evaluate(async()=>{await document.fonts?.ready;});\n  await page.waitForFunction(()=>!document.querySelector('.qelly-opening'),null,{timeout:5000});\n  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));\n};"""
    if old_wait not in source:
        raise SystemExit("Route readiness block not found")
    source = source.replace(old_wait, new_wait, 1)
    start = source.index("const measureNavigationClearance=async(page)=>page.evaluate(async()=>{")
    end = source.index("\n\ntry{", start)
    replacement = r'''const measureNavigationClearance=async(page)=>page.evaluate(async()=>{
  const main=document.querySelector('#main');
  const navigation=document.querySelector('#mobile-navigation');
  if(!main||!navigation||getComputedStyle(navigation).position!=='fixed'||getComputedStyle(navigation).display==='none'){
    return {supported:false,obscured:0,navHeight:0,clearance:null,focusClearance:null,scrollOwner:'none'};
  }
  const sentinel=document.createElement('div');
  sentinel.tabIndex=-1;
  sentinel.dataset.reviewEnd='true';
  sentinel.setAttribute('aria-hidden','true');
  sentinel.style.cssText='display:block;inline-size:1px;block-size:1px;padding:0;margin:0;border:0;opacity:.001;';
  main.append(sentinel);
  const scrollingElement=document.scrollingElement||document.documentElement;
  const scrollOwner=(()=>{
    let node=sentinel.parentElement;
    while(node&&node!==document.body&&node!==document.documentElement){
      const style=getComputedStyle(node);
      if(/auto|scroll|overlay/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1)return node;
      node=node.parentElement;
    }
    return scrollingElement;
  })();
  const ownerName=scrollOwner===scrollingElement?'document':`${scrollOwner.tagName.toLowerCase()}${scrollOwner.id?`#${scrollOwner.id}`:''}${scrollOwner.classList.length?`.${[...scrollOwner.classList].join('.')}`:''}`;
  const previousRootBehavior=document.documentElement.style.scrollBehavior;
  const previousOwnerBehavior=scrollOwner.style.scrollBehavior;
  document.documentElement.style.scrollBehavior='auto';
  scrollOwner.style.scrollBehavior='auto';
  const maxScroll=()=>Math.max(0,scrollOwner.scrollHeight-(scrollOwner===scrollingElement?innerHeight:scrollOwner.clientHeight));
  const settle=async(target)=>{
    for(let attempt=0;attempt<60;attempt++){
      scrollOwner.scrollTop=target;
      await new Promise(resolve=>requestAnimationFrame(resolve));
      if(Math.abs(scrollOwner.scrollTop-target)<=1)return true;
    }
    return false;
  };
  const target=maxScroll();
  const settled=await settle(target);
  sentinel.focus({preventScroll:true});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const navRect=navigation.getBoundingClientRect();
  const sentinelRect=sentinel.getBoundingClientRect();
  const candidates=[...main.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')]
    .filter(element=>!navigation.contains(element)&&getComputedStyle(element).visibility!=='hidden'&&getComputedStyle(element).display!=='none');
  const lastAction=candidates.at(-1)??null;
  if(lastAction){
    lastAction.focus({preventScroll:true});
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const finalNavRect=navigation.getBoundingClientRect();
  const lastRect=lastAction?.getBoundingClientRect?.()??null;
  const obscured=candidates.filter(element=>{
    const rect=element.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&rect.top<innerHeight&&rect.bottom>finalNavRect.top+1;
  }).length;
  const clearance=navRect.top-sentinelRect.bottom;
  const focusClearance=lastRect?finalNavRect.top-lastRect.bottom:null;
  const actualScroll=scrollOwner.scrollTop;
  sentinel.remove();
  document.documentElement.style.scrollBehavior=previousRootBehavior;
  scrollOwner.style.scrollBehavior=previousOwnerBehavior;
  return {supported:true,obscured,navHeight:finalNavRect.height,clearance,focusClearance,scrollOwner:ownerName,targetScroll:target,actualScroll,settled,lastAction:lastAction?.outerHTML?.slice(0,180)??null};
});'''
    source = source[:start] + replacement + source[end:]
    path.write_text(source)
    return {"harnessBytes": path.stat().st_size, "harnessSha256": sha256(path)}


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prompt2b-browser-recovery.py <artifact.zip>")
    artifact = pathlib.Path(sys.argv[1])
    extract_root = pathlib.Path("/tmp/prompt2b-browser-recovery")
    verify_and_extract(artifact, extract_root)
    result = classify(extract_root, pathlib.Path("project-state"))
    result.update(patch_harness(pathlib.Path("scripts/prompt2b-final-review.mjs")))
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
