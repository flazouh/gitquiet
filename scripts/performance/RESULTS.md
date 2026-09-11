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

## Comparison with the published 0.12.0 release

Twelve recordings compared GitHub's published `gitquiet-0.12.0-chrome.zip` with merged commit `80692a9`, built with `RELEASE_VERSION=0.12.1`. Each PR had three alternating pairs. The config records the downloaded ZIP hash and every JavaScript file hash in both builds. The candidate version identifies a test build; no release was published by this measurement.

| Metric, median | Small before | Small after | Large before | Large after |
| --- | ---: | ---: | ---: | ---: |
| Response-to-diff readiness | 1,371.1 ms | 1,247.4 ms | 2,068.0 ms | 1,663.3 ms |
| Startup main-thread work | 1,257.5 ms | 1,232.4 ms | 1,617.3 ms | 1,384.7 ms |
| Tree scrolling main-thread work | 117.0 ms | 120.8 ms | 1,603.0 ms | 1,444.7 ms |
| Settings main-thread work | 936.2 ms | 758.1 ms | 2,305.8 ms | 1,527.9 ms |
| Diff scrolling main-thread work | 32.2 ms | 30.8 ms | 317.5 ms | 296.0 ms |
| File-switch readiness, 15 clicks per build | 91.1 ms | 31.8 ms | 253.4 ms | 108.8 ms |
| Selection main-thread work | 585.6 ms | 486.8 ms | 1,998.4 ms | 1,791.4 ms |

The worst file switch fell from 419.0 to 390.6 ms on the small PR and from 582.9 to 539.8 ms on the large PR. Slow switches remain. Improvements are not uniform: the first candidate small-PR startup took 2,584.8 ms after the response, versus 1,881.7 ms before. The first large-tree scrolling phase used 2,208.0 ms of main-thread time, versus 1,603.0 ms before. Later pairs lowered the median. No field data establishes how often these cases occur for users.

Blank-page calibration delivered about 29 presented frames per second and reported 75.7% dropped outcomes even without the injected blocking task. Those readings cannot certify zero dropped frames on a foreground desktop. Task-budget overruns also remain in the application traces.

A follow-up reading of `large-2-after` assigns about 366 ms of sampled time to the tree viewport refresh called from `deselectPath`. GitQuiet clears the old selection before selecting the new file, so the tree refreshes an intermediate empty selection. The controller already offers a single-selection operation internally. The atomic selection comparison below tests that change.

Raw evidence is in `.tmp/performance-release-0.12.0`. Extension restoration was verified, task space 6 closed, and no build or test ran during recording.


## Atomic tree selection comparison

Three large-PR pairs compared frozen commit `80692a9` with `585c1b4`. Each recording selected the same five files in the same order. The first run completed two pairs, then exited during the third baseline selection phase without a useful error message. That incomplete trace is excluded. A separate retry completed the missing pair with fresh extension storage.

| Pair | Selection CPU before | Selection CPU after | Tasks above 16.7 ms before | Tasks above 16.7 ms after |
| --- | ---: | ---: | ---: | ---: |
| 1 | 766.1 ms | 672.6 ms | 13 | 12 |
| 2 | 741.2 ms | 614.9 ms | 15 | 13 |
| 3, fresh-storage retry | 1,110.8 ms | 840.3 ms | 21 | 16 |

Median selection CPU fell from 766.1 to 672.6 ms. Median diff readiness increased from 99.8 to 104.0 ms; worst readiness fell from 443.6 to 314.7 ms. The patch reduces selection CPU in every pair. It does not establish faster median clicks or zero dropped frames. The retry uses different storage conditions, so the pairs remain visible above.

The regression test failed before the fix with an empty intermediate selection and three notifications. It passes after the fix, with complete selection and at most two notifications. All 4,775 tests, lint, both typechecks, production builds, and Chrome and Firefox packaging passed. A fresh frozen install reproduced the patched runtime. The final whole-change code-quality review found no blocker.

Both package manifests identify version 0.12.1. The source ZIP contains 694 files and is 2,505,059 bytes. Its dependency patch, package metadata, and lockfile match the checked files.

Evidence is in `.tmp/performance-atomic-tree` and `.tmp/performance-atomic-tree-retry`. No build or test ran during recording. Test extension copies were removed, original extension states were restored, and task space 7 closed.


## Remaining style cost after 0.12.1

Release `v0.12.1` points to merged commit `30b5b17`. Its CI and every release job passed. Published extension ZIPs contain version 0.12.1 and the atomic selection method. The published source archive contains 693 files; its patch, package metadata, and lockfile match the source. Chrome and Firefox submission jobs passed. Firefox reported zero errors and 44 warnings. Store submission does not establish store approval.

The latest atomic-selection trace still records substantial style work. In `large-0-after` from the retry, settings used 302.4 ms of `UpdateLayoutTree` time. Individual updates visited about 5,700 elements. Selection used 202.7 ms of style updates. CPU samples place expensive reads under the tree viewport refresh and Radix style reads. Sampled stacks identify where work is requested, not which stylesheet causes it. The local sampler groups Ego's own extension with GitQuiet; its combined extension total must not be presented as GitQuiet CPU.

A follow-up browser probe used frozen candidate `585c1b4` on the same large PR URL. Exactly one GitQuiet copy was enabled. The document contained 118,477 elements. Each sample appended an empty span to the root, forced a computed-style read, removed the span, and forced another read. These synchronous samples exclude observer delivery and represent synthetic style work, not interaction latency or FPS. No build or test ran during measurement.

| Temporary intervention | Baseline median per cycle | Intervention median per cycle |
| --- | ---: | ---: |
| Disable 56 GitHub stylesheet links, pair 1 | 32.6 ms | 33.8 ms |
| Disable 56 GitHub stylesheet links, pair 2 | 31.9 ms | 32.6 ms |
| Disable 56 GitHub stylesheet links, pair 3 | 33.7 ms | 33.8 ms |
| Disable GitQuiet's linked stylesheet, pair 1 | 40.8 ms | 31.9 ms |
| Disable GitQuiet's linked stylesheet, pair 2 | 37.4 ms | 31.8 ms |
| Move root into shadow DOM with copied GitQuiet stylesheet, pair 1 | 33.5 ms | 20.8 ms |
| Move root into shadow DOM with copied GitQuiet stylesheet, pair 2 | 52.8 ms | 26.6 ms |

The first intervention did not improve the probe. The stylesheet inventory changed later as more native sheets loaded. These results do not isolate every native rule or extension-injected stylesheet. Disabling GitQuiet's sheet changes layout and removes styles users need. Moving the root changes style matching and custom-element connection state. Although root width remained 1,262 pixels in both isolation pairs, that does not establish equal rendering. The second baseline also slowed substantially. No intervention is ready to ship from this evidence.

The next check should attribute style invalidation with a trace and establish a fixture that preserves the real rendering. A shadow-root migration must preserve portals, delegated events, native HTML styling, navigation queries, and screen recovery. Tests and an equivalent interaction comparison must precede any claim of a user-visible improvement.

Raw probe results are in `.tmp/perf-observers/restyle-native-sheets.json`, `restyle-own-sheet.json`, and `restyle-shadow.json`. Styles and root placement were restored. The test copy was removed, the original development copy was enabled, and the store copy remained disabled. Task space 8 closed. No production code changed.


## Home gate invalidation fix, browser comparison incomplete

The invalidation trace identifies the generated home `body:has(#dashboard.dashboard)` rules in a body-subtree invalidation after an empty span is inserted into GitQuiet. Replacing only that CSS condition in a diagnostic build removed that invalidation in a fresh trace. Its sampled cycle took 1.53 ms versus 28.70 ms in the baseline trace. Separate repeated synthetic comparisons were mixed, so these isolated times establish a cause to investigate rather than an interaction speedup.

Commit `45870ab` preserves the native region selector and replaces its CSS condition with `body[data-gitquiet-home]`. The shell maintains that marker from the dashboard's ID, class, and body membership. It removes the marker on body replacement or cleanup. Generated CSS retains the initial body cover and waits for the marker during soft navigation. The canary manifest keeps both the native proof and the marked stage.

Four initial tests failed before implementation. A further descendant test failed before correcting the body-self case. The final focused run passed 128 tests. `bun run gates` passed 4,782 tests, lint, and both typechecks. `RELEASE_VERSION=0.12.2 bun run build` passed. Code-quality review found and fixed a canary weakness in the initial stage choice. No remaining code blocker was found. Browser validation remains required.

The real candidate trace records no body-subtree invalidation in any of three synthetic cycles. The first cycle took 10.99 ms and included an existing style update for 2,572 elements. Later cycles took 0.94 and 0.81 ms and restyled 20 elements on insertion and 19 on removal. These are synthetic style checks, not frame-rate or end-to-end interaction results. That probe restored the original extension states and closed space 12.

The full comparison then completed three small-PR recordings before its process exited with status 1 and no error message. A direct check of the same space returned `task space not found: 13`. Its disappearance is confirmed; its cause is not. No large-PR recordings completed. The saved runs are complete and were analysed after the process stopped.

| Small-PR metric | First baseline | First candidate | Second candidate, unpaired |
| --- | ---: | ---: | ---: |
| Startup CPU | 1,082.1 ms | 1,287.1 ms | 1,052.1 ms |
| Tree-scroll CPU | 74.6 ms | 101.8 ms | 85.9 ms |
| Settings CPU | 521.3 ms | 600.8 ms | 514.7 ms |
| Selection CPU | 448.6 ms | 393.3 ms | 372.5 ms |
| Median file-switch readiness | 25.8 ms | 18.3 ms | 20.4 ms |

The one complete pair improves selection work and readiness but worsens other CPU measures. The extra candidate run is not a second pair. These results do not justify a release. Repeat the interrupted comparison and check real home/feed navigation before shipping. Zero dropped frames remains unproven.

Evidence: `.tmp/perf-observers/style-invalidation.trace.json`, `style-invalidation-no-body-has.trace.json`, `style-invalidation-home-gate.trace.json`, and `.tmp/performance-home-gate/summary.json`. Space 13 no longer exists, so its final extension cleanup could not be verified. Check the installed copies before restarting measurement. The earlier spaces restored their copies successfully.


## Completed home-gate comparison and file-request correction

After approval to replace the missing space, six short rounds completed three pairs on each PR. Each round used fresh extension storage for both builds and the same browser space. Build order alternated between pairs. The baseline was frozen `585c1b4`, which contains the production code released in 0.12.1. The candidate was frozen `45870ab`. Configs retain JavaScript and CSS hashes. These measurements predate the file-request correction below.

| Metric, median | Small baseline | Small candidate | Large baseline | Large candidate |
| --- | ---: | ---: | ---: | ---: |
| Response-to-diff readiness | 2,055.0 ms | 1,984.2 ms | 2,830.2 ms | 2,544.1 ms |
| Startup CPU | 1,066.0 ms | 1,119.5 ms | 1,753.4 ms | 1,699.6 ms |
| Tree-scroll CPU | 76.3 ms | 68.9 ms | 1,212.8 ms | 1,450.0 ms |
| Settings CPU | 471.9 ms | 379.5 ms | 1,351.1 ms | 1,008.3 ms |
| Diff-scroll CPU | 21.1 ms | 23.2 ms | 161.4 ms | 152.6 ms |
| Selection CPU, two matching pairs | 390.2 ms | 285.9 ms | 958.0 ms | 550.5 ms |
| File-switch readiness, ten matching clicks | 21.2 ms | 11.0 ms | 45.8 ms | 26.4 ms |

Settings CPU fell in all six pairs. Large-tree scrolling used more CPU in two pairs. It also delivered more frames in every pair: 56 to 83, 57 to 154, and 91 to 168. Tasks exceeding 16.7 ms fell from 15 to 14, 15 to 9, and 13 to 11. These frame reports come from the throttled browser environment and do not establish foreground FPS. Higher CPU time alone does not establish worse scrolling, but these results do not prove uniform improvement either.

Small pair 0 and large pair 2 selected different file sequences between builds. Their selection phases are excluded from the selection medians above. Their earlier phases remain included. A retry that located the current Next button on every click still produced different small-PR sequences, so stale coordinates alone do not explain the difference. The large retry matched, but is not pooled into the table because its action method changed.

A regression test then proved a separate selection defect: after a linked file opens and the reader chooses the next file, a metadata refresh reapplies the same link request. The visible file jumps back. Commit `65bbf76` applies each request object once. A new object remains a deliberate request, even for the same path; a missing requested file still opens when it arrives. Tests cover clearing, replacement, late data, and continued Next navigation. The initial regression failed on the old code and passed after the correction.

The final browser check used `65bbf76` and the real large PR. Five named Next clicks opened these expected files in order: `packages/frontend/utils/fetch-internal-api.test.ts`, `packages/frontend/utils/fetch-internal-api.ts`, `packages/frontend/bun-test-preload.ts`, `packages/helpers/url.ts`, and `packages/providers/get-provider-info.ts`. This verifies continued navigation after the correction. It does not provide an updated performance comparison for that commit.

Live home/feed checks passed with the home-gate candidate. Direct home navigation set the marker and showed GitQuiet. The feed had no home marker and remained visible. A dashboard-switch dialog intercepted the first Home click. After closing it, the native Home link opened the correct page. That link loaded a new document, so this flow does not claim a measured soft-navigation paint boundary; the DOM tests cover the soft gate's arrival and removal conditions.

Final checks passed: 4,787 tests, lint, both typechecks, and the 0.12.2 candidate build. The whole-change quality review found no code blocker. The home-gate packages also passed archive checks before the file-request correction; final packages were rebuilt after that correction.

The initial replacement space later disappeared as well. A subsequent inventory found the development extension enabled, the store copy disabled, and no test copy. The final browser check wrote its verified restored inventory to `.tmp/perf-observers/file-request-cleanup.json` and closed space 7. No build, test, or trace analysis ran alongside the recordings.

Evidence is in `.tmp/performance-home-gate-{small,large}-pair-{0,1,2}`, `.tmp/perf-observers/home-gate-pairs.json`, `home-feed-qa.json`, `file-request-browser.json`, and the named-selection retry folders. Zero dropped frames remains unproven.

## Large-tree scroll: where the time actually goes

The three large-PR pairs above were re-analysed for frame outcomes and for the scripts
inside the scroll window. This does not add new recordings.

| Pair | Build | Delivered FPS | Dropped % | Tasks over 16.7 ms | Median completion gap |
| --- | --- | ---: | ---: | ---: | ---: |
| 0 | before | 12.2 | 79.3 | 15 | 50.0 ms |
| 0 | after | 17.9 | 78.9 | 14 | 41.7 ms |
| 1 | before | 14.3 | 79.9 | 15 | 50.0 ms |
| 1 | after | 48.8 | 39.8 | 9 | 25.0 ms |
| 2 | before | 20.0 | 76.8 | 13 | 41.7 ms |
| 2 | after | 51.9 | 36.4 | 11 | 25.0 ms |

Median delivered FPS during the tree scroll was 14.3 before and 48.8 after. Median
dropped outcomes were 79.3 and 39.8 percent, and median over-budget tasks 15 and 11.

Total renderer main-thread time in the window was 2,227, 2,026 and 2,793 ms before,
versus 2,684, 2,506 and 2,732 ms after. Those totals are close, and higher in two pairs.
Non-idle CPU samples per delivered frame tell the other half: 176.8 to 143.0, 137.2 to
61.4, and 116.1 to 61.2. Counting only samples outside the profiler's idle and program
pseudo-frames gives 74.6 to 51.2, 57.4 to 21.5, and 44.4 to 20.3. Either way the
candidate delivered two to three times as many frames at a lower cost each, which is why
its total work is similar or higher.

Attributed self time from `FunctionCall`, `Layout`, `Paint` and `UpdateLayoutTree`
in the scroll window. Extension script is split by extension id, because two other
extensions were also loaded in this profile and one of them injects a script that runs
during the scroll. Only the id the runner loaded is counted as GitQuiet.

| Pair | Build | GitQuiet | Other extension | GitHub | Browser layout or paint |
| --- | --- | ---: | ---: | ---: | ---: |
| 0 | before | 195 ms | 102 ms | 221 ms | 590 ms |
| 0 | after | 201 ms | 121 ms | 233 ms | 704 ms |
| 1 | before | 193 ms | 92 ms | 200 ms | 564 ms |
| 1 | after | 202 ms | 108 ms | 202 ms | 660 ms |
| 2 | before | 273 ms | 115 ms | 213 ms | 778 ms |
| 2 | after | 210 ms | 117 ms | 205 ms | 770 ms |

Browser layout and paint dominate every run. GitQuiet's own script time is 193 to 273 ms
before and 201 to 210 ms after. The page's own long-animation-frame observer recorded no
GitQuiet script inside any long frame after the 7 second mark; all of that script time
belongs to GitHub's bundles. The remaining over-budget frames during tree scroll are
GitHub's work plus browser layout and paint.

One measurement limit applies. The blank-page control in the same session recorded 62.9
percent dropped outcomes while idle, so Ego's task space is throttled. Raw dropped counts
cannot show native desktop zero-drop behaviour. The relative comparison is still useful,
and the small PR matched the baseline while the large PR improved.
