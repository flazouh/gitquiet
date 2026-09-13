# Full-extension performance traces

Use Ego Lite to record Chromium trace dumps. The runner compares two production builds on small and large PRs. It records initial diff readiness, tree scrolling, and file-settings transitions.

## Run the comparison

Prepare both builds before recording. Use the same dependencies and production build command. Record each source commit and the shell bundle SHA256. Keep the source snapshots, builds, config, and raw traces under ignored `.tmp`.

Create one Ego task space with a control page at `chrome://extensions/` and a measurement page. Put this config in `.tmp/perf-observers/trace-config.json`:

```json
{
  "spaceId": 12,
  "controlPage": "p1",
  "measurePage": "p2",
  "repeats": 5,
  "builds": [
    { "name": "before", "commit": "BASE_COMMIT", "path": "/absolute/baseline/.output/chrome-mv3", "shellSha256": "BASE_HASH" },
    { "name": "after", "commit": "FIX_COMMIT", "path": "/absolute/candidate/.output/chrome-mv3", "shellSha256": "FIX_HASH" }
  ],
  "cases": [
    { "name": "small", "url": "https://github.com/OWNER/REPO/pull/SMALL/changes?diff=unified" },
    { "name": "large", "url": "https://github.com/OWNER/REPO/pull/LARGE/changes?diff=unified" }
  ]
}
```

Replace every example value with the actual build and task information. Preserve any previous `.tmp/performance-traces` directory before starting another run.

1. Run `bun scripts/performance/launch-traces.ts`. Do not run builds, tests, or trace analysis during recording.
2. Verify that only the original GitQuiet copy is enabled after the runner exits.
3. Run `bun scripts/performance/analyze-traces.ts`.
4. Close the task space when no further browser checks remain. Do not close unrelated spaces.

The launcher embeds the repository path because Ego does not forward caller environment variables. The runner streams traces through `Page.events()` and CDP `IO.read` in the same Ego round. It writes progress after each completed trace.

## Measurement rules

Each run starts from `about:blank`. This forces a new document even when the target URL contains a fragment. Navigating directly to the same fragment URL can retain the old document and its old content script. The runner checks the document time origin. Missing phase markers make analysis fail.

The viewport is 1600 by 900. Page HTTP cache is disabled. Build order reverses each repeat. Each extension starts with empty storage; later visits retain its storage. Treat the first visit to each PR separately from repeat visits. General extension state can carry over from the small PR to the large PR.

Exactly one GitQuiet copy must be enabled for each run. The runner disables original copies, loads both test builds, and switches between them. Cleanup attempts all disable, uninstall, and restore operations, then reports any errors.

The load marker means the first diff has text and the file tree exists. It is sampled every 50 ms. It does not prove that the diff has painted. Navigation time includes the server response wait. Report time to first byte and response-to-diff time separately.

Frame outcomes come from Chromium `PipelineReporter` events. They do not come from `requestAnimationFrame`. The analyzer pairs reused async IDs in timestamp order and excludes other renderer processes. Unknown or incomplete frame outcomes invalidate rates. Frame completion gaps are diagnostic values, not a direct display capture.

The control uses a two-second CSS animation on a blank page. The negative control adds a 180 ms main-thread block. Report both beside the app results. Ego can throttle frame delivery even when the page reports visible and focused. Its raw dropped-frame rate must not be attributed entirely to GitQuiet.

A phase can contain idle time. The small tree can reach its scroll limit before a gesture ends. Panel phases include pauses between actions. The full-phase presented FPS is not continuous animation FPS.

Raw traces contain private page details. Keep them local. Heap size and DOM counts at the end of a run do not prove or disprove a memory leak. Page performance entries also cannot fully attribute work inside extension contexts; use trace CPU samples for that work.

## Probe verification

`bun test scripts/performance/trace-analysis.test.ts` checks missing markers, missing telemetry, partial frames, unknown states, reused IDs, duplicate reports, event ordering, renderer isolation, and clipped nested tasks. These tests use fixed Chromium-shaped events and literal expected results.

The fresh-document regression was reproduced in Ego: direct navigation to the current fragment URL retained `performance.timeOrigin`. Navigation through `about:blank` changed it. The first matrix is preserved under `.tmp/performance-traces-invalid-fragment-navigation` and must not support an A/B claim.

## Focused runs

The config supports these optional measurements:

- `outputName`: a separate directory name under `.tmp`, to preserve the main matrix.
- `containmentExperiment: true`: compare ordinary tree scrolling with temporary CSS containment, in alternating order.
- `interactions: true`: add diff scrolling and five Next clicks. Each click must activate another nonempty diff.
- `startupOnly: true` with `captureTrace: false`: collect startup observations without the Chromium profiler. This produces `runs.json`, not trace dumps.

For a focused trace directory, run `bun scripts/performance/analyze-traces.ts .tmp/DIRECTORY`. Do not use the trace analyzer on a run with tracing disabled.

The analyzer also counts tasks above 16.7 ms and 8.3 ms. These are frame-budget warnings, not dropped-frame counts. Missing task telemetry produces null budget counts.
