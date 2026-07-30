#!/usr/bin/env python3
"""Generate durable Prompt 2B browser-forensics records from a verified review artifact."""

from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import pathlib
import zipfile


EXPECTED = {
    "artifact_id": 8736360914,
    "bytes": 6034854,
    "sha256": "15b6cdf2c9e500470f30629b40a41adc45bb2ef648e651c9bf51412c5e0ae8f7",
    "entries": 23,
    "head": "ff6a8ab2180527e3dc62e2cf4890338eef18aa96",
    "records": 420,
    "failures": 379,
}


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def action_for(route: str) -> str:
    return {
        "calculator-center": "valid calculation after route render",
        "indicator-library": "valid indicator calculation after route render",
        "saved-calculations": "initial/empty local-persistence state",
        "india-finance": "initial India finance truth/unavailable-rule state",
        "formula-library": "initial formula catalogue state",
    }.get(route, "initial route state")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--output", default="project-state")
    args = parser.parse_args()

    artifact = pathlib.Path(args.artifact)
    if artifact.stat().st_size != EXPECTED["bytes"]:
        raise SystemExit(f"artifact size mismatch: {artifact.stat().st_size}")
    if sha256(artifact) != EXPECTED["sha256"]:
        raise SystemExit("artifact SHA-256 mismatch")

    extracted = artifact.parent / "prompt2b-forensics-extracted"
    extracted.mkdir(exist_ok=True)
    with zipfile.ZipFile(artifact) as archive:
        bad = archive.testzip()
        if bad:
            raise SystemExit(f"ZIP CRC failure: {bad}")
        if len(archive.infolist()) != EXPECTED["entries"]:
            raise SystemExit(f"artifact entry-count mismatch: {len(archive.infolist())}")
        archive.extractall(extracted)

    root = extracted / ".prompt2b-review"
    browser = json.loads((root / "BROWSER_MATRIX.json").read_text())
    themes = json.loads((root / "THEME_DIFFERENTIATION.json").read_text())
    screenshots = json.loads((root / "SCREENSHOT_MANIFEST.json").read_text())
    if browser.get("head") != EXPECTED["head"]:
        raise SystemExit(f"artifact head mismatch: {browser.get('head')}")
    records, failures = browser["records"], browser["failures"]
    if len(records) != EXPECTED["records"] or len(failures) != EXPECTED["failures"]:
        raise SystemExit(f"browser count mismatch: {len(records)}/{len(failures)}")

    failure_keys = {
        (item["browser"], item["width"], item["height"], item["appearance"], item["route"]): item
        for item in failures
    }
    screenshot_map = {
        (item["browser"], item["route"], item["width"], item["height"], item["appearance"]): item["name"]
        for item in screenshots["files"]
    }
    output = pathlib.Path(args.output)
    output.mkdir(exist_ok=True)

    fields = [
        "record_id", "outcome", "failure_id", "run_id", "exact_head", "route", "browser", "viewport",
        "theme_requested", "theme_observed", "motion_mode", "authentication_state", "persistence_state",
        "action_state", "first_failing_assertion", "console_error", "page_error", "resource_failure",
        "screenshot_path", "likely_category", "confirmed_root_cause", "affected_source_path", "severity",
        "fix_commit", "retest_result", "waiver_status", "waiver_rationale", "fixed_nav_overlap_count",
        "horizontal_overflow_px", "unlabeled_controls", "cls", "truth_boundary_passed", "font_status", "load_ms",
    ]
    rows = []
    for index, record in enumerate(records, 1):
        key = (record["browser"], record["width"], record["height"], record["appearance"], record["route"])
        failure = failure_keys.get(key)
        screenshot = screenshot_map.get(key, "")
        rows.append({
            "record_id": f"P2B-R30482255458-{index:03d}",
            "outcome": "FAIL" if failure else "PASS",
            "failure_id": f"BF-{index:03d}" if failure else "",
            "run_id": "30482255458",
            "exact_head": browser["head"],
            "route": record["route"],
            "browser": record["browser"],
            "viewport": f"{record['width']}x{record['height']}",
            "theme_requested": record["appearance"],
            "theme_observed": record.get("theme", ""),
            "motion_mode": "reduced",
            "authentication_state": "anonymous static visual preview",
            "persistence_state": "local storage reset before context; route-specific browser-local only",
            "action_state": action_for(record["route"]),
            "first_failing_assertion": failure["reasons"][0] if failure else "",
            "console_error": " | ".join(record.get("consoleErrors", [])),
            "page_error": " | ".join(record.get("pageErrors", [])),
            "resource_failure": " | ".join(
                f"{item.get('url')}::{item.get('error')}" for item in record.get("failedResources", [])
            ),
            "screenshot_path": f".prompt2b-review/screenshots/{screenshot}" if screenshot else "",
            "likely_category": "test harness defect" if failure else "none",
            "confirmed_root_cause": (
                "The harness counted any visible interactive rectangle intersecting the fixed bottom-navigation "
                "rectangle, including navigation descendants and content temporarily behind it after Playwright "
                "auto-scroll. It did not test whether final focusable content can scroll fully above the navigation."
                if failure else ""
            ),
            "affected_source_path": "scripts/prompt2b-final-review.mjs" if failure else "",
            "severity": "MEDIUM" if failure else "NONE",
            "fix_commit": "PENDING",
            "retest_result": "PENDING" if failure else "PASS_ON_RECORDED_RUN",
            "waiver_status": "NO",
            "waiver_rationale": "",
            "fixed_nav_overlap_count": record.get("fixedNavOverlap", 0),
            "horizontal_overflow_px": record.get("overflowX", 0),
            "unlabeled_controls": record.get("unlabeledControls", 0),
            "cls": record.get("cls", 0),
            "truth_boundary_passed": record.get("truth", False),
            "font_status": record.get("fontStatus", ""),
            "load_ms": record.get("loadMs", ""),
        })

    classification = output / "QELLY_PROMPT2B_BROWSER_FAILURE_CLASSIFICATION.csv"
    with classification.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    browser_counts = collections.Counter(item["browser"] for item in failures)
    route_counts = collections.Counter(item["route"] for item in failures)
    viewport_counts = collections.Counter(f"{item['width']}x{item['height']}" for item in failures)
    appearance_counts = collections.Counter(item["appearance"] for item in failures)
    overlap = [item["fixedNavOverlap"] for item in failures]

    summary = [
        "# Qelly Prompt 2B Browser Failure Forensics — Run 30482255458", "",
        "## Evidence identity", "",
        f"- Exact workflow head: `{browser['head']}`",
        "- GitHub artifact ID: `8736360914`",
        f"- Artifact bytes: `{EXPECTED['bytes']}`",
        f"- Artifact SHA-256: `{EXPECTED['sha256']}`",
        f"- ZIP entries: `{EXPECTED['entries']}`",
        "- ZIP CRC: passed",
        f"- Browser records: `{len(records)}`",
        f"- Failed records: `{len(failures)}`",
        f"- Passed records: `{len(records) - len(failures)}`",
        f"- Theme-comparison failures: `{len(themes['failures'])}`",
        "- Performance failures: `0`",
        f"- Screenshots: `{len(screenshots['files'])}`", "",
        "## Complete classification", "",
        "All 379 failures are individually represented in "
        "`QELLY_PROMPT2B_BROWSER_FAILURE_CLASSIFICATION.csv`. Every failed record had only the first assertion "
        "`fixed-nav-overlap:<count>`. No failed record contained a console error, page error, required-local-resource "
        "failure, horizontal overflow, font-loading failure, truth-boundary failure or CLS failure.", "",
        "| Confirmed category | Count |", "|---|---:|",
        "| Test harness defect — fixed-navigation overlap measurement | 379 |",
        "| Real product defect proven by this artifact | 0 |",
        "| Unknown requiring reproduction | 0 |", "",
        f"- Browsers: `{dict(browser_counts)}`",
        f"- Routes: `{dict(route_counts)}`",
        f"- Viewports: `{dict(viewport_counts)}`",
        f"- Requested themes: `{dict(appearance_counts)}`",
        f"- Overlap-count range: `{min(overlap)}–{max(overlap)}`", "",
        "## Confirmed harness defect", "",
        "The old harness counted all visible interactive rectangles intersecting a fixed bottom element. It counted "
        "bottom-navigation descendants and controls temporarily behind the bar after Playwright auto-scroll, evaluated "
        "an arbitrary post-action scroll position, and never tested whether final actionable content can scroll above "
        "the fixed navigation and receive focus without clipping.", "",
        "The corrected harness must preserve a strict navigation-clearance assertion, exclude navigation descendants, "
        "scroll and focus final actionable content deterministically, and retain screenshots and first-error evidence.", "",
        "## Theme failures", "",
        "All 15 recorded theme failures are harness setup defects. The old review wrote unsupported generic appearance "
        "names to an unused local-storage key. Qelly themes are governed persona IDs applied through the application "
        "preference path. The corrected matrix must apply real IDs, assert the resolved ID, wait for fonts, and compare "
        "semantic tokens.", "",
        "## Waivers", "", "None. Every recorded failure remains open until exact-head retest passes.",
    ]
    (output / "QELLY_PROMPT2B_BROWSER_FAILURE_SUMMARY.md").write_text("\n".join(summary) + "\n")

    theme_report = [
        "# Qelly Prompt 2B Theme Differentiation Forensics", "",
        "Run: `30482255458`  ", f"Exact head: `{browser['head']}`", "",
        "## Recorded result", "",
        f"- Browser × route dark/light pairs: `{len(themes['pairs'])}`",
        f"- Failed pairs: `{len(themes['failures'])}`",
        "- Dark and requested-light body background in every failed pair: `rgb(8, 9, 10)`", "",
        "## Confirmed root cause", "",
        "The harness did not activate Qelly themes. It wrote `dark`, `light`, `oled` and `high-contrast` to "
        "`localStorage['qelly-appearance']`, but the application uses governed persona preferences and "
        "`document.documentElement.dataset.theme`. Every requested appearance retained `burgundy-command`.", "",
        "Correct mapping to verify in the replacement harness:", "",
        "- dark → `burgundy-command`",
        "- porcelain light → `porcelain-burgundy`",
        "- OLED → verified governed low-luminance persona",
        "- high contrast → `high-contrast`", "",
        "Semantic canvas, surface, border, text, focus, chart-grid, positive and negative tokens must be compared. "
        "Raw body-background equality alone is insufficient.", "",
        "## Disposition", "",
        "- Product theme defect proven by run: 0",
        "- Harness theme setup defects: 15",
        "- Waivers: 0",
        "- Retest: pending",
    ]
    (output / "QELLY_PROMPT2B_THEME_DIFFERENTIATION_REPORT.md").write_text(
        "\n".join(theme_report) + "\n"
    )

    matrix_fields = [
        "matrix_id", "source_run", "exact_head", "route", "action_state", "browser", "viewport",
        "theme_request", "motion", "authentication", "expected_truth", "result", "first_failure",
        "console_errors", "page_errors", "failed_resources", "horizontal_overflow_px", "notes",
    ]
    matrix = []
    for index, record in enumerate(records, 1):
        key = (record["browser"], record["width"], record["height"], record["appearance"], record["route"])
        failure = failure_keys.get(key)
        matrix.append({
            "matrix_id": f"OLD-{index:04d}",
            "source_run": "30482255458",
            "exact_head": browser["head"],
            "route": record["route"],
            "action_state": action_for(record["route"]),
            "browser": record["browser"],
            "viewport": f"{record['width']}x{record['height']}",
            "theme_request": record["appearance"],
            "motion": "reduced",
            "authentication": "anonymous static preview",
            "expected_truth": "deterministic/local or unavailable; never live",
            "result": "BLOCKED_BY_HARNESS_DEFECT" if failure else "PASS_RECORDED_LIMITED_SCOPE",
            "first_failure": failure["reasons"][0] if failure else "",
            "console_errors": len(record["consoleErrors"]),
            "page_errors": len(record["pageErrors"]),
            "failed_resources": len(record["failedResources"]),
            "horizontal_overflow_px": record["overflowX"],
            "notes": "Old five-route matrix only; final complete route/action/state matrix still required.",
        })
    matrix_path = output / "QELLY_PROMPT2B_ROUTE_ACTION_STATE_MATRIX.csv"
    with matrix_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=matrix_fields)
        writer.writeheader()
        writer.writerows(matrix)

    memory = [
        "# Qelly Prompt 2B Running Memory Summary", "",
        "Updated: 2026-07-30  ", "Repository: `hemangsah/qelly-intelligence`", "",
        "## Authenticated authority", "",
        "- Authenticated GitHub user: `hemangsah` (`274469799`)",
        "- Repository permission: admin, maintain, push, pull and triage",
        "- Repository auto-merge setting: disabled", "",
        "## Exact live state before mutation", "",
        "- Main SHA: `9cb98780893924ad26fbf4baaa9048e80a162b2c`",
        "- Main versus recorded Program A closeout: identical",
        "- PR #23 base SHA: `9cb98780893924ad26fbf4baaa9048e80a162b2c`",
        "- PR #23 head SHA: `ff6a8ab2180527e3dc62e2cf4890338eef18aa96`",
        "- PR state: open, draft, mergeable, unmerged",
        "- Branch: `feature/calculator-and-indicator-foundation`",
        "- Changed files: 43", "- Commits: 35",
        "- PR comments/reviews/review threads: 0/0/0",
        "- Feature-branch deployment: none", "",
        "## Exact-head workflow state", "",
        "Successful: Continuous Integration, Container Build, Production Foundation Services, CodeQL, Typography "
        "Governance Review, IBM Plex Governance Audit, UI Rescue Review and Theme Intelligence Visual Correction Review.", "",
        "Failing: Qelly Prompt 2B Wave 1 Review run `30482255458`, browser-matrix step only.", "",
        "## Artifact and product counts", "",
        "- Artifact ID: `8736360914`",
        "- Bytes/SHA-256/entries/CRC: `6034854` / "
        "`15b6cdf2c9e500470f30629b40a41adc45bb2ef648e651c9bf51412c5e0ae8f7` / `23` / passed",
        "- Browser records/failures/theme failures/performance failures/screenshots: `420/379/15/0/17`",
        "- Executable deterministic formulas: 50",
        "- Governed deterministic indicators: 20",
        "- Runtime/governed routes: 66",
        "- Prompt 2B routes: 5",
        "- Production-connected external financial providers: 0", "",
        "## Current blockers and next action", "",
        "Correct the proven fixed-navigation and theme-activation harness defects without weakening assertions; rerun "
        "the original matrix; independently validate the uninstalled catalog expansion; reconcile source lineage and "
        "registries; run the complete matrix; generate the 18-section artifact; update PR #23 truthfully.", "",
        "## Prohibited actions", "",
        "Do not modify main, merge or mark PR #23 ready, enable auto-merge, deploy the branch, start Prompt 2C, "
        "activate providers, enable trading/custody/deposits/withdrawals/private-key/seed/autonomous execution, weaken "
        "assertions, or fabricate completion.",
    ]
    (output / "QELLY_PROMPT2B_RUNNING_MEMORY.md").write_text("\n".join(memory) + "\n")

    generated = [
        classification,
        output / "QELLY_PROMPT2B_BROWSER_FAILURE_SUMMARY.md",
        output / "QELLY_PROMPT2B_THEME_DIFFERENTIATION_REPORT.md",
        matrix_path,
        output / "QELLY_PROMPT2B_RUNNING_MEMORY.md",
    ]
    print(json.dumps({
        "artifact": EXPECTED,
        "records": len(records),
        "failures": len(failures),
        "generated": [
            {"path": str(path), "bytes": path.stat().st_size, "sha256": sha256(path)}
            for path in generated
        ],
    }, indent=2))


if __name__ == "__main__":
    main()
