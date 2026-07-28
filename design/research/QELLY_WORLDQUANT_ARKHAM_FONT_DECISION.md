# Qelly WorldQuant / Arkham typography decision

## User-supplied reference

The supplied reference identifies WorldQuant with GT Eesti Display and Text, and Arkham with IBM Plex Sans plus a private icon font. Qelly treats that list as design-reference input, not as proof that third-party font binaries may be copied or redistributed.

## Verified licensing boundary

- **IBM Plex Sans** is distributed under SIL Open Font License 1.1 and may be bundled and self-hosted with the application when the licence notice is retained.
- **GT Eesti** is a commercial Grilli Type family. Web use requires a purchased web licence. Trial files and font files extracted from another website are not production assets.
- **webflow-icons** is an Arkham/Webflow-specific icon font, not a general text family. Qelly preserves its existing semantic inline-SVG icon registry for accessibility, rendering reliability and originality.

## Production system now used by Qelly

- UI, display, body, navigation, controls, tables, charts, dialogs, mobile sheets, timestamps and numeric evidence: **IBM Plex Sans Variable**.
- Fallbacks: **Arial**, **Helvetica Neue**, then generic **sans-serif**.
- Numeric rendering uses tabular lining figures and the slashed-zero feature where supported.
- No Google Fonts request is made. The selected variable WOFF2 is copied into the static build and preloaded from Qelly's own origin.
- Geist and Geist Mono are no longer product typography. Historical comparison artifacts may retain their names as rejected evidence only.

## GT Eesti upgrade path

Qelly reserves semantic display and text roles for a future licensed GT Eesti integration. GT Eesti must not become active until the repository receives:

1. proof of an appropriate Qelly web licence;
2. licensed GT Eesti Pro Display WOFF2 files;
3. licensed GT Eesti Pro Text WOFF2 files;
4. the applicable licence terms and deployment limits;
5. a new PR-only rendering and layout-shift review.

Until those conditions are met, the display and text roles resolve to IBM Plex Sans Variable so every user receives the same legal, deterministic typography.
