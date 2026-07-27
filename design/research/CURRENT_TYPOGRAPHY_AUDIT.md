# Qelly current typography audit

## Scope

This audit covers the rejected PR #11 screenshots, the focused surface correction, and the later user-supplied WorldQuant / Arkham font reference. It distinguishes reference-site observations from fonts that Qelly can legally and deterministically ship.

## Rejected implementation

- The rejected route declared an unbundled fallback stack and did not guarantee the named faces.
- Page titles, table labels and compact controls depended on platform fallbacks.
- Several table and metadata roles were too small and overused uppercase tracking.
- The first focused correction selected Geist and Geist Mono, but the user later replaced that direction with the WorldQuant / Arkham reference.

## Supplied reference and verified boundary

The supplied reference identifies:

1. WorldQuant: GT Eesti Pro Display and GT Eesti Pro Text, with Arial, Helvetica Neue and sans-serif fallbacks.
2. Arkham: IBM Plex Sans, plus a private Webflow icon font and Arial/sans-serif fallbacks.

Qelly does not treat another website's font requests as permission to redistribute its font files.

- GT Eesti is a commercial Grilli Type family. Qelly requires a purchased web licence and licensed WOFF2 assets before it can become active.
- IBM Plex Sans is available under SIL Open Font License 1.1 and can be self-hosted with its licence notice.
- The Arkham/Webflow icon font is not reused. Qelly keeps semantic inline SVG icons, which are accessible, deterministic and original to the product implementation.

## Candidate comparison

The PR-only board renders the same Qelly roles using:

1. the rejected fallback stack;
2. a clearly labelled GT Eesti commercial licence gate that is not represented as a rendered GT Eesti specimen;
3. IBM Plex Sans Variable;
4. Manrope Variable;
5. Plus Jakarta Sans Variable;
6. the final selected Qelly system.

The actual candidate files are local Fontsource variable packages under SIL Open Font License 1.1. GT Eesti is never downloaded, copied, simulated or included as a trial asset.

## Selected production system

- UI, display, body, navigation, controls, tables, chart labels, dialogs, mobile sheets, timestamps and numeric evidence: **IBM Plex Sans Variable** (`Qelly IBM Plex Sans`).
- Product-visible family count: one.
- Fallbacks: **Arial**, **Helvetica Neue**, then **sans-serif**.
- Numeric evidence uses tabular lining figures and the slashed-zero feature where supported.
- The application copies one Latin variable WOFF2 file and its OFL licence into the static build.
- The font is preloaded from Qelly's own origin; there is no Google Fonts or other third-party font request.
- Existing semantic SVG icons remain unchanged.

## Role map

| Role | Qelly IBM Plex range |
|---|---|
| Page title | 42–52px desktop; 36–44px tablet; 30–34px mobile; 600 weight |
| Section title | 22–28px; 550–600 weight |
| Module title | 15–18px; 500–600 weight |
| Metric XL | 30–38px; 550–600 weight |
| Metric | 20–27px; 500–600 weight |
| Body | 14.5–16px; 400 weight; 1.45–1.6 line height |
| Compact body | 13–14px; 400–500 weight |
| Table cells | 13–14px; 400–500 weight |
| Table headers | 12px; 600 weight; sentence case |
| Labels | 11.5–12.5px; 500 weight |

## GT Eesti activation gate

GT Eesti Pro Display and Text may replace the corresponding semantic roles only after Qelly supplies proof of a valid web licence, the licensed files, the licence limits and a new browser artifact proving layout, accessibility and performance. Until then, both display and text roles resolve to IBM Plex Sans Variable.

## Evidence boundary

The repository records the source-level contract. The PR-only browser report records the final computed family, loaded resource, WOFF2 size, used weights, line heights, tracking, fallback state and layout-shift entries. That browser report is the authoritative rendered evidence.
