# Qelly Intelligence information architecture

## Progressive product domains

The shell groups the broader destination inventory into nine discoverable domains. It does not place every route in one menu.

| Shell domain | Destination families | Default route |
| --- | --- | --- |
| Home | Home, Product, Company, Learning | `feature-universe` |
| Markets | Markets, Discovery, Assets, Derivatives, Exchanges, Charts, Screener | `market` |
| Research | Research, News, Events, Learning | `news-research` |
| Workspaces | Portfolio, Watchlists, Alerts, Workspaces, Settings | `watchlist` |
| Evidence | Decision Provenance, Evidence, Trust | `decision-provenance` |
| Data plane | Data Sources, Developer/API, Operations | `data-mesh` |
| Operations | Operations, Security, Trust | `platform-readiness` |
| Account | Settings, Workspaces, Team | `account-session` |
| Experience | Personas, Navigation, Accessibility | `theme-personas` |

The wider canonical destination vocabulary remains available through universal command search and the route inventory. Missing product families are recorded in `design/inventory/QELLY_FEATURE_MATRIX.csv`; they are not represented as fake placeholder routes.

## Navigation composition

1. The **slim edge dock** selects a product domain.
2. The **expandable category navigator** exposes routes only inside the selected domain.
3. The **operating-mode ribbon** changes persona behavior.
4. The **context shelf** shows breadcrumbs and nearby destinations.
5. **Universal command search** resolves routes, assets, and actions.
6. The **workspace switcher** preserves tenant/workspace context.
7. The **compare tray**, **Watchlist**, and **Explain This Move** actions remain discoverable.
8. The **source inspector** exposes evidence without leaving the route.
9. Mobile uses a compact bottom navigator and the category drawer.

## Page-shell taxonomy

- `public-story` — expressive editorial hierarchy and restrained narrative motion;
- `analytical` — dense, stable, filterable, and chart/table focused;
- `research` — readable long-form evidence, citations, and provenance;
- `operational` — low-motion dependency status and controlled action;
- `access` — secure, focused identity and recovery journeys.

The route registry assigns one shell kind and one product domain to every executable route. `design/inventory/QELLY_ROUTE_INVENTORY.csv` is the canonical audit output.

## Location and state

Routes remain hash-addressable in the Static visual preview and preserve direct GitHub Pages navigation through the existing `404.html` redirect. Production uses the same route registry while retaining authenticated route policy. Loading, empty, error, offline, stale, delayed, partial, simulated, and demo states preserve location context and do not collapse into blank space.
