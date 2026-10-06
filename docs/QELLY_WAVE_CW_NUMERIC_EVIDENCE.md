# Governed numeric evidence in Chat

Provider values such as null, empty strings, booleans and arrays previously
passed through Number(), which could turn missing evidence into zero. A Chat
midpoint row could also receive a live label without declared provenance.

The shared numeric evidence reader accepts finite numbers and nonblank numeric
strings, retaining genuine zero and signed statistics. Midpoints additionally
require a positive value. Chat market receipts require an explicit live,
cached or delayed source state; unusable quotes are withheld. Provider loaders
discard malformed quotes and macro observations, and empty results fail closed.
World Bank question context and IMF period selection preserve measured zero.
Decision and generic Chat fallbacks display absent evidence as unavailable.

Regression tests exercise missing/type-confused inputs, positive quote and
provenance boundaries, absent Decision confidence/entry/stop, real zero GDP,
empty upstream payloads and IMF selection across a missing latest period.
Provider tests use isolated fixtures and restore fetch; no production outcomes,
provider-health measurements or user chat history are inserted.

This repair does not enable additional providers or establish calibration.
The normal exact-head and production release gates remain required.
