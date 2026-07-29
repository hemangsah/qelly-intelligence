# Qelly Decision Log

## 2026-07-29 — Prompt 1 exact-head guard

**Decision:** Do not merge PR #13.

**Reason:** Prompt 1 explicitly approved `75e39537e0ca6ba5eaf8fb688d0248fa63bd5614`, while live GitHub head is `6fabb1ac65d73cde25d1dca6d63a6685ef7d7e9a`.

**Evidence:** The branch is two commits ahead and changes only review/evidence tooling. The product compiled preview is unchanged except `BUILD_INFO.json`, but the authorization is SHA-bound.

**Governance interpretation:** No new subjective visual review is required unless Hemang Sah chooses one; explicit authorization of the live exact SHA is still required.

**Protected actions not performed:** ready-for-review transition, merge, auto-merge, feature-branch deletion, main mutation, brand tag creation, public deployment, public-beta bootstrap.
