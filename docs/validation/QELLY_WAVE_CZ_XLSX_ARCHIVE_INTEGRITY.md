# MT5 XLSX archive integrity

The browser-local reader verifies the worksheet/shared-string CRC32 after bounded stored/deflate decoding. All central entry names and local record metadata are reconciled, even for ignored workbook parts. Duplicate aliases, overlaps, unsafe paths, contradictory directory bounds/counts, encrypted features, split archives and ZIP64 are rejected. Streaming data descriptors are supported with and without their optional signature.

Limits remain 5 MiB compressed input, 96 ZIP entries, 20 MiB per decoded entry, 48 MiB total declared inflation and 100,000 realized deals. XML entity definitions and formula-derived cells, including namespace-prefixed/shared formula shapes, are unsupported. No network request, active HTML, macro execution or persistence is introduced.

ZIP structure follows [PKWARE APPNOTE 6.3.10](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT), particularly data integrity and data descriptors. The implementation intentionally supports plain static report exports rather than every ZIP feature. Export a fresh plain XLSX when rejected.

CRC verifies consistency with archive metadata. It does not authenticate the broker, the account, the trades, the report currency or source accuracy; a deliberately rewritten report with recomputed CRC remains user-supplied evidence. Existing scientific/cost/currency boundaries remain intact.

The synthetic acceptance corpus covers ordinary stored/deflated reports, signed/unsigned descriptors, comments, same-length profit tampering, forged checksums, header/descriptor conflicts, duplicates, traversal, overlaps, directory count/size errors, ZIP64, encryption, inflated-size lies and formula/entity cells. Independent Node zlib CRC builds the fixtures. No real account report is represented by this corpus.

Browser gates additionally verify visible corruption errors and stale-analysis removal in both Verify and the standalone analyzer, at desktop and mobile sizes. The initial gate exposed a hidden Verify error: clearing the old report recreated its secondary tool drawer in the closed state. Rejection now opens that drawer, and its label names MT5 reports as well as CSV. The visible-error assertion remains required. Exact-head gates and canonical deployment checks remain required before production acceptance.
