# Qelly Validation History

## PR #13 approved head

Head: `6fabb1ac65d73cde25d1dca6d63a6685ef7d7e9a`

Successful workflow runs:

- Continuous Integration — `30423496850`
- Container Build — `30423496819`
- Production Foundation Services — `30423496851`
- CodeQL — `30423496798`
- Typography Governance Review — `30423496825`
- Qelly IBM Plex Governance Audit — `30423496863`
- Qelly UI Rescue Review — `30423496794`
- Qelly Theme Intelligence Review — `30423496885`
- Qelly Logo Brand Review — `30423496829`
- Qelly Logo Final Visual Correction Review — `30423496834`

Approval artifact:

- ZIP SHA-256: `b2b10a6b80bb45cb10faf6173d39c4b2d9bb0893039da1b9936878189b1f492c`
- ZIP bytes: `73,792,804`
- entries: `391`
- internal checksums: `354/354`
- PDF SHA-256: `66d2d7cb656d25a8b6b7011bc6818c2f3f8db33ce7f051e95b2a35999b99a9c9`
- compiled preview SHA-256: `fa528379f1cc1ef4d4446aaf832b8e0d7b88e924b6c2f51ef17d73fc878ba39d`

## Merge verification

- merge commit: `94fbd4ff91c0d61f87e42724038f03fa5c36f97a`
- approved-head to merge-result file differences: zero
- post-merge workflow/browser/deployment evidence: pending completion by the Prompt 1 verification workflow

## Public-beta bootstrap correction history

The first draft CI run identified two test-contract defects and one inherited exact-count contract:

1. the brand-freeze test incorrectly expected the build-generated IBM Plex binary in the source tree;
2. the negative evidence-envelope test reached timestamp validation before its intended identity assertion;
3. product validation and smoke evidence still expected 65 schemas after adding two governed public-beta schemas.

Corrections preserve strict validation:

- IBM Plex source is verified through the locked package, build copier and index preload;
- required source, lineage and entitlement are validated before timing fields;
- product validation requires exactly 67 schemas and both public-beta schema filenames;
- both smoke assertions require 67 loaded schemas;
- the one-use patch workflow removed itself from the permanent tree.

The branch must pass the complete repository test suite, brand-freeze tests, public-beta contract tests, generated-inventory reproducibility and security/release gates before review status can advance.
