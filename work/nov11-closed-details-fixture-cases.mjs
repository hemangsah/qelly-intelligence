export const closedDetailsFloorCases=[
  {
    "id": "closed-first-summary",
    "html": "<details id=\"outer\"><summary><span id=\"summaryText\">Summary remains visible</span></summary><span id=\"bodyText\">Body initially hidden</span></details>",
    "mustFloorInitially": [
      "summaryText"
    ],
    "mustDeferInitially": [
      "bodyText"
    ]
  },
  {
    "id": "nested-closed-summary",
    "html": "<details id=\"outer\"><summary><span id=\"outerSummary\">Outer summary</span></summary><details id=\"inner\"><summary><span id=\"innerSummary\">Inner summary hidden by outer</span></summary><span id=\"innerBody\">Nested body</span></details></details>",
    "mustFloorInitially": [
      "outerSummary"
    ],
    "mustDeferInitially": [
      "innerSummary",
      "innerBody"
    ]
  },
  {
    "id": "inner-open-outer-closed",
    "html": "<details id=\"outer\"><summary><span id=\"outerSummary\">Outer summary</span></summary><details id=\"inner\" open><summary><span id=\"innerSummary\">Inner summary hidden by outer</span></summary><span id=\"innerBody\">Open inner remains hidden</span></details></details>",
    "mustFloorInitially": [
      "outerSummary"
    ],
    "mustDeferInitially": [
      "innerSummary",
      "innerBody"
    ]
  },
  {
    "id": "outer-open-inner-closed",
    "html": "<details id=\"outer\" open><summary><span id=\"outerSummary\">Outer summary</span></summary><details id=\"inner\"><summary><span id=\"innerSummary\">Visible inner summary</span></summary><span id=\"innerBody\">Closed inner body</span></details></details>",
    "mustFloorInitially": [
      "outerSummary",
      "innerSummary"
    ],
    "mustDeferInitially": [
      "innerBody"
    ]
  },
  {
    "id": "multiple-summaries",
    "html": "<details id=\"outer\"><summary><span id=\"first\">Native first summary</span></summary><summary><span id=\"second\">Second summary belongs to body</span></summary><span id=\"bodyText\">Body</span></details>",
    "mustFloorInitially": [
      "first"
    ],
    "mustDeferInitially": [
      "second",
      "bodyText"
    ]
  },
  {
    "id": "no-explicit-summary",
    "html": "<details id=\"outer\"><span id=\"bodyText\">Native generated summary is outside this body</span></details>",
    "mustFloorInitially": [],
    "mustDeferInitially": [
      "bodyText"
    ]
  },
  {
    "id": "summary-after-body-node",
    "html": "<details id=\"outer\"><span id=\"beforeSummary\">Body before first summary</span><summary><span id=\"summaryText\">Native first summary</span></summary><span id=\"bodyText\">Body</span></details>",
    "mustFloorInitially": [
      "summaryText"
    ],
    "mustDeferInitially": [
      "beforeSummary",
      "bodyText"
    ]
  },
  {
    "id": "normal-visible-text",
    "html": "<section><span id=\"outsideText\">Ordinary text remains floored</span></section>",
    "mustFloorInitially": [
      "outsideText"
    ],
    "mustDeferInitially": []
  }
];
