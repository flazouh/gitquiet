# Performance trace results

Zero dropped frames is not verified. The observer fixes reduce some panel work, but they do not establish faster startup or remove the large tree's frame-budget overruns.

| Signal | Scope | Before | After | Source |
| --- | --- | ---: | ---: | --- |
| Response to first diff ready | Small PR, repeat median | 845.7 ms | 1,069.8 ms | Full trace matrix |
| Response to first diff ready | Large PR, repeat median | 1,457.9 ms | 1,438.4 ms | Full trace matrix |
| Main-thread work during three panel cycles | Small PR, repeat median | 782.1 ms | 626.3 ms | Full trace matrix |
| Main-thread work during three panel cycles | Large PR, repeat median | 2,516.5 ms | 2,078.9 ms | Full trace matrix |
| Main-thread work during tree scroll | Small PR, repeat median | 93.3 ms | 92.0 ms | Full trace matrix |
| Main-thread work during tree scroll | Large PR, repeat median | 1,507.0 ms | 1,545.7 ms | Full trace matrix |
| Response to first diff ready, tracing disabled | Small PR, repeat median | 982.8 ms | 1,181.0 ms | Separate startup check |

## Conditions and scope

The baseline is `a5d71df`. The candidate is `fdd1f28`, which contains the combined observer fixes. This is not a release 0.12.0 comparison. Both snapshots used production builds and the same dependencies.

The browser reported Chrome 152 through Ego Lite on macOS. The viewport was 1600 by 900 at device scale 1. These were authenticated GitHub PR pages. The runner disabled page HTTP cache and alternated build order. It did not set an explicit CPU or network throttle. Each run used a fresh document and exactly one enabled GitQuiet copy. No build, test, or trace-analysis job ran during recording. Other machine activity was not controlled.

The main matrix has five runs per build per PR, 20 runs total. The table excludes each PR's first visit and uses four repeat runs. Extension storage stays warm within a build. The small PR has 23 changed files, with 20 in the code filter. The large PR has 159 changed files. The full config records the URLs and shell bundle hashes locally.

Diff readiness means nonempty diff markup and a file tree, checked every 50 ms. It is not a paint measurement. Response-to-diff time excludes time to first byte. Median TTFB was 2,517.2/2,661.7 ms for the small PR and 2,484.8/2,552.8 ms for the large PR, before/after.

## Measured limits

Small-PR response-to-diff ranges were 410.4 to 1,228.3 ms before and 956.4 to 1,830.2 ms after. The candidate was slower in all four traced repeat pairs, by 162.3 to 666.8 ms. A separate ten-navigation check with tracing disabled also had a slower candidate median. Its repeat ranges were 486.7 to 1,313.6 ms before and 1,058.9 to 1,294.8 ms after. Startup improvement remains unproven, and the slower small-PR result needs investigation.

Large-PR response-to-diff ranges were 1,375.4 to 1,634.5 ms before and 1,403.9 to 1,633.1 ms after. These overlap closely.

Panel CPU medians fell by about 20% on the small PR and 17% on the large PR. Three of four repeat pairs improved in each case. Small-PR panel ranges were 653.6 to 826.4 ms before and 601.6 to 779.0 ms after. Large-PR ranges were 2,123.5 to 3,195.3 ms before and 1,585.2 to 2,596.2 ms after. This measures renderer main-thread work across the full scripted phase, including GitHub work and pauses between actions.

The large tree still exceeded a 16.7 ms task budget 12 to 36 times per candidate run. It exceeded an 8.3 ms task budget 63 to 72 times. These are task-duration diagnostics for 60 Hz and 120 Hz. They are not counts of missed display frames. Several shorter tasks can also exceed a frame's total budget.

The blank-page animation control recorded 19.0 presented frames per second and 75.7% dropped outcomes. Its two-second animation phase lasted 2.84 seconds. The 180 ms blocking control recorded one 180.7 ms task and a 1,016.7 ms gap between frame completions. This browser environment cannot establish native desktop zero-drop behavior from raw frame counts.

## Additional interaction probes

The candidate ran three fresh-page interaction recordings on each PR. Each recording scrolled the initial diff down and back, then clicked Next five times. The selection observer checked the newly active diff's text. These values measure pointerdown dispatch to DOM readiness, not input queue delay or paint.

Small-PR diff scrolling had no task above 8.3 ms in these three samples. Large-PR diff scrolling had 5 to 6 tasks above 16.7 ms and 7 to 9 above 8.3 ms. Neither recorded a task above 50 ms during diff scrolling.

The second small-PR switch took 330.7, 341.0, and 343.9 ms. Other switches ranged from 7.4 to 105.4 ms. The large PR's second switch took 365.9, 364.6, and 387.2 ms. Other large-PR switches ranged from 11.9 to 359.9 ms. These repeated delays remain unresolved.

The large selection phases had no usable presented/dropped frame telemetry. The analyzer reports null rates for those phases. Zero observed reports must not be read as zero dropped frames.

Tree search did not open through the current page's `f` shortcut. Search performance was not measured. End-of-run heap size and DOM counts were captured, but allocation growth and memory leaks were not tested. There is no extension-specific field telemetry in this report. GitHub origin metrics cannot isolate GitQuiet.

## Trace causes and rejected experiment

One candidate large-tree trace spent about 418 ms in layout and 307 ms in paint during scrolling. Its sampled JavaScript time included about 272 ms attributed through extension stacks and 199 ms through GitHub stacks. Timeline categories can overlap and must not be added as independent totals. The tree's wheel handler, Preact rendering, and GitHub observers appeared in those samples.

A small-PR startup sample showed about 371 ms of sampled GitHub script work during candidate startup, versus none in that baseline sample's shorter startup window. The candidate also had more idle time. This shows competing page work and scheduling differences; it does not prove which source change caused the slower startup.

A three-run experiment applied `contain: layout paint style` to the tree host, alternating measurement order. It increased tree CPU work in all three pairs: 1,230 to 1,308 ms, 1,630 to 2,006 ms, and 1,331 to 1,553 ms. Frame readings varied widely. No containment change was added to production.

## Probe defects fixed with evidence

The first matrix reused the large PR's fragment URL. Chromium retained the old document and content script. A browser assertion reproduced the unchanged `performance.timeOrigin`. Navigation through `about:blank` passed the same check. The corrected matrix has 20 distinct document time origins. The invalid matrix stays separate and supports no A/B claim.

Regression tests also caught reused trace IDs, unknown frame outcomes being omitted from rates, and missing task counts below 50 ms. The analyzer now fails on missing phase markers and reports null rates for missing or incomplete frame telemetry.

The quality review found that one cleanup failure could prevent extension restoration. Cleanup now attempts all disable, uninstall, and restoration operations before reporting failures. The completed runs restored the original development copy and left the store copy disabled.

Seven analyzer tests pass. Probe lint and the repository typecheck pass. No additional production optimization was made in this measurement pass. Zero-drop readiness is not approved.

## Local evidence

Raw traces can contain private page details and stay under ignored `.tmp`:

- `.tmp/performance-traces/summary.json`: corrected 20-run A/B results and controls.
- `.tmp/performance-traces/*.trace.json`: Chromium trace dumps with CPU samples.
- `.tmp/performance-interactions/summary.json`: diff-scroll and file-switch results.
- `.tmp/performance-containment/summary.json`: rejected containment experiment.
- `.tmp/performance-startup-no-trace/runs.json`: startup check without tracing.

The corresponding configs and diagnostic outputs are under `.tmp/perf-observers`. Use the [recording guide](TRACING.md) to repeat the tests.

Addy Osmani's requested `performance` skill was installed at `.agents/skills/performance`. Its measurement workflow informed the distinction between lab observations, field data, and unproven hypotheses.

## Prepared-diff reuse follow-up

Commit `a236f81` keeps an existing diff drawing when only file metadata changes. The renderer effect previously depended on an `Option` wrapper. A metadata refresh created another wrapper for identical patch text, which destroyed the prepared drawing and scheduled another draw. The effect now depends on the patch text itself.

The regression test failed before the fix: a read-state update produced two renderer calls instead of one. It passes after the fix and also checks that changed patch content still redraws. The 64 related UI tests passed. Full gates passed 4,562 tests with zero failures, and the production build passed. The code-quality review found no remaining issue in this change.

A separate clock-dependent test failed by one millisecond during full verification. Commit `04c1d3b` gives that test one fixed clock value. It changes no production behavior.

The matched live comparison did not finish. Its first attempt hit a navigation timeout. During the retry, the Ego task space disappeared and extension cleanup failed. No completed comparison result exists in `.tmp/performance-patch-reuse`. The previously measured 330 to 387 ms delay is therefore not yet proved fixed by this change.
