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

After the interrupted comparison, the original development extension was restored and verified enabled. The store copy remained disabled. The cleanup task space closed successfully.

## Matched retry after prepared-diff reuse

The retry completed all six small-PR recordings: three alternating pairs of `fdd1f28` and `a236f81`. The candidate build was copied to a frozen directory before recording. The config records each file-screen bundle hash as well as the shell hash, since this fix changes the file-screen bundle and leaves the shell unchanged.

Across 15 switches per build, median pointerdown-to-diff-ready time was 104.1 ms before and 33.8 ms after. The worst switch was 369.7 ms before and 403.2 ms after. The candidate's second switch remained slow in all three runs: 376.1, 403.2, and 380.8 ms. The median improved in each pair, but this does not establish that the original slow-switch problem is fixed.

Selection-phase main-thread totals were 871.4, 1,174.1, and 876.3 ms before, versus 935.0, 894.0, and 836.1 ms after. Their medians were 876.3 and 894.0 ms. Total CPU work did not consistently improve. Candidate selection phases still had 13 to 16 tasks above 16.7 ms and 25 to 28 above 8.3 ms.

The blank-page control itself recorded a 107.4 ms long task and 77.4% dropped frame outcomes. These environment limits prevent a zero-drop claim. The data supports retaining the regression fix for unnecessary metadata redraws, but the remaining scheduled wait needs separate diagnosis.

The result is saved at `.tmp/performance-patch-reuse-retry/summary.json`, with its trace dumps in the same directory. No build or test job overlapped recording. Automatic cleanup restored the development copy to enabled and left the store copy disabled; a separate inventory check verified both states.

### Remaining second-switch timer wait

The saved candidate traces contain two 250 ms timers after each second selection. The table shows the later timer, relative to pointerdown. Events match by renderer PID, main-thread ID, and timer ID.

| Candidate run | Timer installed | Timer fired | Callback duration | Diff ready |
| --- | ---: | ---: | ---: | ---: |
| 0 | 93.9 ms | 351.3 ms | 25.0 ms | 376.1 ms |
| 1 | 136.5 ms | 386.6 ms | 16.9 ms | 403.2 ms |
| 2 | 106.2 ms | 363.8 ms | 17.4 ms | 380.8 ms |

The callback ends near diff readiness in every run. Timer events contain no install stack, so these events alone do not identify the caller. The 250 ms interval matches the `afterPaint` fallback in `src/app/idle.ts`. Both tree selection sync and diff drawing use that helper. Caller attribution remains a hypothesis until a stack or a build mark identifies it.

Do not reduce the fallback based on these timings alone. The helper defers drawing so the selection can paint first, and Ego frame throttling can trigger its fallback. The next probe must identify the caller and separate its scheduling wait from drawing time.

## Tree selection without a frame wait

A diagnostic build marked tree selection and diff drawing separately. The tree callback waited about 250 ms after selection. The second diff was newly prepared in the background in that run; its render took about 8 ms. This separates the delayed tree highlight from diff drawing. The diagnostic marks were removed from source after the build.

A regression test holds frame callbacks and changes external selection through the real tree component. Before the fix, the visible row remained `a.ts` after selection changed to `b.ts`. Removing the tree's `afterPaint` wrapper passes that test. Heavy diff rendering still uses `afterPaint`. Tests also cover rapid changes, repeated selection, a missing path, and an empty tree. The 66 related tests, typecheck, lint, and production build passed. Code-quality review found no remaining issue in this change.

Three alternating small-PR pairs compared `a236f81` with the immediate tree selection change. A local probe variant added tree selection reads through the tree shadow root. It sampled with the existing 20 ms polling interval and mutation callback. The final baseline click ended recording before its delayed highlight arrived, so tree comparisons use only the first four clicks per run on both builds.

| Metric | Before | After |
| --- | ---: | ---: |
| Median tree highlight time, first four clicks per run | 279.7 ms | 79.6 ms |
| Tree highlight range, same clicks | 266.7 to 291.7 ms | 33.1 to 96.5 ms |
| Median diff readiness, all 15 clicks | 10.4 ms | 27.5 ms |
| Worst diff readiness | 359.9 ms | 346.2 ms |
| Median selection-phase main-thread work | 493.7 ms | 432.2 ms |

Selection CPU work fell in each pair: 512.4 to 396.5 ms, 493.7 to 464.8 ms, and 439.7 to 432.2 ms. Tasks above 16.7 ms fell from 9, 7, and 8 to 7 in each candidate run. The tree answers sooner, but moving its work forward increases typical diff readiness time. The slow second diff remains unresolved. These runs do not prove zero dropped frames or large-tree performance.

Evidence stays in `.tmp/performance-tree-selection`, with the local probe at `.tmp/perf-observers/record-tree-selection.js`. Diagnostic marks are recorded in `.tmp/performance-draw-marks`. No build, test, or trace analysis ran during recording. Cleanup restored the original extension states and closed task space 3.

## Integration with current main

The release branch merged `origin/main` at `c2076da`. Main keeps the screen under `body` so GitHub cannot detach it by replacing a native region. That exposed a conflict in the observer optimization: its hidden-content check required the root's parent to match a native region. With the stable body surface, that condition never passed.

Two regression tests failed before the integration fix: hidden diff updates and late content inside a hidden ancestor both triggered document queries. The guard now skips hidden ancestors that do not contain our screen. A hidden wrapper containing our screen still reaches recovery. The updated tests also keep the screen on body when native regions change. Four existing assertions now check hidden ancestors instead of requiring a redundant `hidden` attribute on each new descendant.

The huge browser probe now replaces its retained native region rather than the root's parent, which is body on current main. It checks that our screen stays connected and visible while native content stays hidden. This check works with both the old placement and the stable surface.

The merged code passed `bun run gates`: 4,774 tests, zero failures, plus lint and both typechecks. All 96 mount tests passed. The whole-change code-quality review found the integration defects above; both were fixed and the follow-up review passed.

Candidate-only browser probes passed at 0, 1,000, 100,000, 250,000, and 500,000 hidden nodes. Each size ran 40 updates in each of four phases. Every phase recorded zero document queries. Each added-link phase checked exactly 40 links. Recovery and teardown passed at every size. At 500,000 nodes, median update times were 5.0 to 5.1 ms, including the timer used to await observer delivery. These checks establish bounded observer work, not frame smoothness.

Results are in `.tmp/perf-observers-stable-surface/results.json`. The probe space closed and its local server stopped. The earlier full-extension recordings predate this merge; a release comparison must use the merged build and the actual `v0.12.0` baseline.
