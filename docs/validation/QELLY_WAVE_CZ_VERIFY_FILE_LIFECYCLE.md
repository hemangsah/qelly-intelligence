# Verify local-file lifecycle

Based on fetched production 43696b00c4fb703baa2027871bfba93a049603d1 after PR #503.

A new primary file previously left old report/export controls available until parsing completed. Size/type rejection updated only the status, preserving stale analysis. An older File read or evidence fingerprint could also complete after a newer selection, reset or route change.

Every primary selection now invalidates the previous generation, clears the report before reading and displays the local-read state in the open evidence drawer. Size/type errors use the same visible rejection path as parser errors. Clear report is available during the read and invalidates its completion. Completion checks the current generation and active Verify route before committing output or errors. The existing central route owner resets primary/comparison memory on leaving Verify; methodology entry resets the same state. No additional global route reconciliation listener is introduced. Comparison replacement clears its old report before reading.

Required Browser E2E adds synthetic oversize/unsupported inputs, delayed local reads with a newer two-deal replacement, clear during an in-flight read, and delayed completion after leaving the route. Assertions require no stale export/report, latest selection wins, and no local report restored on return. Existing privacy, genuine-calibration boundaries, HTML inertness, XLSX checksums and both-theme acceptance remain required. This change does not move expensive processing to a worker; that performance follow-up remains open.

Local suite: 2,115 passed, one skipped, zero failures. The existing exact-source router test now requires the reset call as well as owner/subview cleanup. Exact-head/preview acceptance must pass before merge. No external report data is uploaded or retained by this repair.
