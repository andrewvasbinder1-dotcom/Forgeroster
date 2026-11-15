# ForgeRoster stabilization QA

Baseline production commit: `c4332826f141ddf5c3148897439d23af658f2ffc`.
Baseline: 42 passed, zero failed, zero skipped. Candidate: 46 passed, zero
failed, zero skipped in the Node suite. Existing combat regression tests retained.
The static Pages bundle was assembled locally. No package install is required for
the static build. Local Chromium was unable to start because this environment
denied its process socket and ptrace operations.

| ID | Severity | Reproduce on baseline | Cause and repair | Candidate verification |
| --- | --- | --- | --- | --- |
| QA-01 | High | Request an uncached asset revision offline with an old worker installed. A cached script with an identical path can be substituted. A cache write failure can also hide a successful online response. | The worker stripped query strings and looked up assets by path. Asset keys now include the revision, cache failures preserve the network response, and online navigation no longer replaces the installed offline HTML. | Two worker VM regressions passed. Browser offline smoke is in the staging matrix. |
| QA-02 | Medium | Navigate from Army Builder to Rules, then press Back. | Tab changes replaced the existing history entry. User navigation now pushes an entry and route initialization normalizes with replace. | Browser regression added to staging matrix. |
| QA-03 | High | Select a Vehicle attacker, return to a manual profile and calculate Hazardous damage or shooting while engaged. | Vehicle-dependent inputs survived source changes. They now reset on manual or untagged selection. | Source repair. Browser verification pending. |
| QA-04 | Medium | Queue standard melee from two rosters that share an imported unit ID. | The queue used a unit ID without its roster identity. Queue identifiers now scope to the roster and attachment root. | Source repair. Browser verification pending. |

Additional combat assertions independently verify Torrent with Lethal Hits and
Twin-linked with a wound modifier. Catalogue checks verify the bundled snapshot,
which contains 30 faction catalogues and 1,768 entries. These tests do not certify
official point, datasheet, or wargear accuracy. Official comparison across the
3,023 audited pricing rows and comprehensive allied restrictions remain open.

The pull-request workflow tests the staged static build with Chromium at 390 px,
Firefox at 768 px, and WebKit at 1280 px. It covers roster creation, faction search,
navigation history, casualty controls, public reporting and admin routes, and
Chromium offline reload. These environments do not substitute for physical phones.
Production remains on the baseline pending review and approval.

Hosted authentication, RLS, private screenshots, real two-account isolation,
database performance, delivery/retry testing and backup restoration require
authorized staging project access, disposable accounts and a designated mail
recipient. See [production operations](PRODUCTION.md). Missing administrator
features listed in that runbook remain out of scope for these bug fixes. A full
WCAG audit, production performance profiling and installed-device PWA tests are
still outstanding.
